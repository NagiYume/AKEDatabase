from __future__ import annotations

import json
import re
import sys
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from threading import Event

from PyQt6.QtCore import QObject, Qt, QThread, QUrl, pyqtSignal, pyqtSlot
from PyQt6.QtGui import QColor, QCloseEvent, QDesktopServices, QFont, QTextCharFormat, QTextCursor
from PyQt6.QtWidgets import (
    QApplication,
    QAbstractItemView,
    QCheckBox,
    QComboBox,
    QFileDialog,
    QFormLayout,
    QFrame,
    QGridLayout,
    QGroupBox,
    QHeaderView,
    QHBoxLayout,
    QLabel,
    QLayout,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPlainTextEdit,
    QProgressBar,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QSpinBox,
    QTabWidget,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from .config import (
    AppConfig,
    CONFIG_FILE,
    DEFAULT_IMAGE_CONTAINERS_FILTER,
    default_full_image_filter_rules,
    build_containers_filter,
    default_image_filter_rules,
    load_config,
    normalize_containers_filter,
    save_config,
)
from .errors import CancelledError, ValidationError
from .hotfix_api import HotfixClient
from .image_config_cloud import CloudImageConfigLoader, ImageConfigResolution
from .image_paths import (
    FULL_IMAGE_CONTAINERS_FILTER,
    IMAGE_PROFILE_FULL,
    IMAGE_PROFILE_STANDARD,
    IMAGE_PROFILES,
    ImageParsingConfig,
    normalize_image_profile,
)
from .image_assets import ImageAssetPipeline
from .models import CancellationToken, LatestInfo, ProgressEvent
from .pipeline import Pipeline
from .release import ReleaseManager
from .state_store import StateStore


ANSI_CSI_RE = re.compile(r"\x1b\[([0-?]*)([ -/]*)([@-~])")
ANSI_COLORS = (
    "#1f2937",
    "#b91c1c",
    "#15803d",
    "#a16207",
    "#1d4ed8",
    "#a21caf",
    "#0e7490",
    "#e2e8f0",
)
ANSI_BRIGHT_COLORS = (
    "#64748b",
    "#ef4444",
    "#22c55e",
    "#eab308",
    "#3b82f6",
    "#d946ef",
    "#06b6d4",
    "#ffffff",
)


def _ansi_indexed_color(index: int) -> QColor:
    if index < 8:
        return QColor(ANSI_COLORS[index])
    if index < 16:
        return QColor(ANSI_BRIGHT_COLORS[index - 8])
    if index < 232:
        value = index - 16
        levels = (0, 95, 135, 175, 215, 255)
        return QColor(
            levels[(value // 36) % 6],
            levels[(value // 6) % 6],
            levels[value % 6],
        )
    gray = 8 + min(index - 232, 23) * 10
    return QColor(gray, gray, gray)


def _apply_ansi_sgr(current: QTextCharFormat, raw_parameters: str) -> QTextCharFormat:
    result = QTextCharFormat(current)
    try:
        parameters = [int(value or 0) for value in raw_parameters.split(";")]
    except ValueError:
        return result
    index = 0
    while index < len(parameters):
        code = parameters[index]
        if code == 0:
            result = QTextCharFormat()
        elif code == 1:
            result.setFontWeight(QFont.Weight.Bold.value)
        elif code == 2:
            result.setFontWeight(QFont.Weight.Light.value)
        elif code == 3:
            result.setFontItalic(True)
        elif code == 4:
            result.setFontUnderline(True)
        elif code == 22:
            result.setFontWeight(QFont.Weight.Normal.value)
        elif code == 23:
            result.setFontItalic(False)
        elif code == 24:
            result.setFontUnderline(False)
        elif 30 <= code <= 37:
            result.setForeground(QColor(ANSI_COLORS[code - 30]))
        elif 90 <= code <= 97:
            result.setForeground(QColor(ANSI_BRIGHT_COLORS[code - 90]))
        elif code == 39:
            result.clearForeground()
        elif 40 <= code <= 47:
            result.setBackground(QColor(ANSI_COLORS[code - 40]))
        elif 100 <= code <= 107:
            result.setBackground(QColor(ANSI_BRIGHT_COLORS[code - 100]))
        elif code == 49:
            result.clearBackground()
        elif code in {38, 48} and index + 2 < len(parameters):
            target_foreground = code == 38
            mode = parameters[index + 1]
            if mode == 5:
                color = _ansi_indexed_color(max(0, min(parameters[index + 2], 255)))
                if target_foreground:
                    result.setForeground(color)
                else:
                    result.setBackground(color)
                index += 2
            elif mode == 2 and index + 4 < len(parameters):
                color = QColor(
                    max(0, min(parameters[index + 2], 255)),
                    max(0, min(parameters[index + 3], 255)),
                    max(0, min(parameters[index + 4], 255)),
                )
                if target_foreground:
                    result.setForeground(color)
                else:
                    result.setBackground(color)
                index += 4
        index += 1
    return result


def _insert_ansi_text(cursor: QTextCursor, text: str) -> None:
    position = 0
    current_format = QTextCharFormat()
    for match in ANSI_CSI_RE.finditer(text):
        if match.start() > position:
            cursor.insertText(text[position : match.start()], current_format)
        if match.group(3) == "m" and not match.group(2):
            current_format = _apply_ansi_sgr(current_format, match.group(1))
        position = match.end()
    if position < len(text):
        cursor.insertText(text[position:], current_format)


def append_console_log(widget: QPlainTextEdit, message: str) -> None:
    timestamp = datetime.now().strftime("%H:%M:%S")
    timestamp_format = QTextCharFormat()
    timestamp_format.setForeground(QColor("#64748b"))
    cursor = widget.textCursor()
    cursor.movePosition(QTextCursor.MoveOperation.End)
    for line in message.splitlines() or [""]:
        if cursor.position() > 0:
            cursor.insertBlock()
        cursor.insertText(f"{timestamp}  ", timestamp_format)
        _insert_ansi_text(cursor, line)
    widget.setTextCursor(cursor)
    widget.ensureCursorVisible()


class PipelineWorker(QObject):
    progress = pyqtSignal(object)
    succeeded = pyqtSignal(object)
    failed = pyqtSignal(str)
    cancelled = pyqtSignal()

    def __init__(self, stages: list[str], config: AppConfig) -> None:
        super().__init__()
        self.stages = stages
        self.config = config
        self.token = CancellationToken()

    def cancel(self) -> None:
        self.token.cancel()

    @pyqtSlot()
    def execute(self) -> None:
        try:
            pipeline = Pipeline(self.config, progress=self.progress.emit, token=self.token)
            if self.stages == ["check"]:
                result = pipeline.check_latest()
            else:
                result = pipeline.run_steps(self.stages)
            self.succeeded.emit(result)
        except CancelledError:
            self.cancelled.emit()
        except Exception as exc:
            self.failed.emit(str(exc))


class ImageAssetWorker(QObject):
    progress = pyqtSignal(object)
    succeeded = pyqtSignal(object)
    failed = pyqtSignal(str)
    cancelled = pyqtSignal()

    def __init__(
        self,
        stages: list[str],
        config: AppConfig,
        image_profile: str = IMAGE_PROFILE_STANDARD,
        image_config: ImageParsingConfig | None = None,
    ) -> None:
        super().__init__()
        self.stages = stages
        self.config = config
        self.image_profile = image_profile
        self.image_config = image_config
        self.token = CancellationToken()

    def cancel(self) -> None:
        self.token.cancel()

    @pyqtSlot()
    def execute(self) -> None:
        try:
            result = ImageAssetPipeline(
                self.config,
                progress=self.progress.emit,
                token=self.token,
                image_profile=self.image_profile,
                image_config=self.image_config,
            ).run_steps(self.stages)
            self.succeeded.emit(result)
        except CancelledError:
            self.cancelled.emit()
        except Exception as exc:
            self.failed.emit(str(exc))


class R2VersionWorker(QObject):
    progress = pyqtSignal(object)
    succeeded = pyqtSignal(object)
    failed = pyqtSignal(str)

    def __init__(self, action: str, config: AppConfig, version_id: str = "") -> None:
        super().__init__()
        self.action = action
        self.config = config
        self.version_id = version_id
        self.token = CancellationToken()

    @pyqtSlot()
    def execute(self) -> None:
        try:
            manager = ReleaseManager(self.config, self.token, self.progress.emit)
            if self.action == "list":
                result = manager.list_r2_versions()
            elif self.action == "delete":
                result = manager.delete_r2_version(self.version_id)
            else:
                raise ValueError(f"未知 R2 版本操作：{self.action}")
            self.succeeded.emit(result)
        except Exception as exc:
            self.failed.emit(str(exc))


class AssetUploadWorker(QObject):
    progress = pyqtSignal(object)
    succeeded = pyqtSignal(object)
    failed = pyqtSignal(str)

    def __init__(
        self,
        action: str,
        config: AppConfig,
        plan: dict | None = None,
        include_json: bool = False,
        include_images: bool = False,
        image_profile: str = "",
        image_config: ImageParsingConfig | None = None,
        manual_update: bool = False,
    ) -> None:
        super().__init__()
        self.action = action
        self.config = config
        self.plan = dict(plan or {})
        self.include_json = include_json
        self.include_images = include_images
        self.image_profile = image_profile
        self.image_config = image_config
        self.manual_update = manual_update
        self.token = CancellationToken()

    @pyqtSlot()
    def execute(self) -> None:
        try:
            manager = ReleaseManager(self.config, self.token, self.progress.emit)
            if self.action == "plan":
                result = manager.plan_asset_sync(
                    self.include_json,
                    self.include_images,
                    image_profile=self.image_profile or None,
                    image_config=self.image_config,
                    manual_update=self.manual_update,
                )
            elif self.action == "sync":
                result = manager.sync_assets(
                    self.plan,
                    self.image_config,
                    current_image_profile=self.image_profile or None,
                )
            else:
                raise ValueError(f"未知资产上传操作：{self.action}")
            self.succeeded.emit(result)
        except Exception as exc:
            self.failed.emit(str(exc))


class ImageConfigWorker(QObject):
    succeeded = pyqtSignal(object)
    failed = pyqtSignal(str)

    def __init__(
        self,
        action: str,
        config: AppConfig,
        profile: str = "",
        image_config: ImageParsingConfig | None = None,
    ) -> None:
        super().__init__()
        self.action = action
        self.config = config
        self.profile = profile
        self.image_config = image_config

    @pyqtSlot()
    def execute(self) -> None:
        try:
            if self.action == "load":
                local = {profile: self.config.image_config(profile) for profile in IMAGE_PROFILES}
                result = CloudImageConfigLoader(self.config.request_timeout).load(local)
            elif self.action == "sync":
                if self.image_config is None:
                    raise ValidationError("当前页面图片配置为空")
                result = ReleaseManager(
                    self.config, CancellationToken(), lambda _event: None
                ).sync_image_parsing_config(self.profile, self.image_config)
            else:
                raise ValidationError(f"未知图片配置操作：{self.action}")
            self.succeeded.emit(result)
        except Exception as exc:
            self.failed.emit(str(exc))


class AutoWatchWorker(QObject):
    checked = pyqtSignal(object, bool)
    progress = pyqtSignal(object)
    update_started = pyqtSignal(str, str)
    update_succeeded = pyqtSignal(object)
    error = pyqtSignal(str)
    status = pyqtSignal(str)
    stopped = pyqtSignal()

    def __init__(self, config: AppConfig) -> None:
        super().__init__()
        self.config = config
        self.stop_event = Event()
        self.token = CancellationToken()

    def stop(self) -> None:
        self.stop_event.set()
        self.token.cancel()

    @pyqtSlot()
    def execute(self) -> None:
        state = StateStore(self.config.work_root).load()
        completed_stages = state.get("completed_stages", {})
        completion_stage = "upload" if self.config.watch_upload_r2 else "publish"
        has_published_version = completion_stage in completed_stages
        processed_version = str(state.get("hotfix_res_version", "")) if has_published_version else ""
        first_check = True
        client = HotfixClient(timeout=self.config.request_timeout, appcode=self.config.appcode)

        while not self.stop_event.is_set():
            try:
                self.status.emit("正在检查 Seed 与 Hotfix…")
                latest = client.get_latest()
                current_version = latest.hotfix.res_version
                if first_check and not has_published_version and current_version:
                    processed_version = current_version
                    first_check = False
                    self.checked.emit(latest, False)
                    self.status.emit(f"未找到已发布版本，已建立监听基线：{current_version}")
                    if self.stop_event.wait(self.config.watch_interval):
                        break
                    continue
                changed = bool(current_version and current_version != processed_version)
                self.checked.emit(latest, changed)

                if changed and first_check and not self.config.watch_update_on_start:
                    processed_version = current_version
                    self.status.emit(f"已建立监听基线：{current_version}")
                elif changed:
                    self.update_started.emit(processed_version, current_version)
                    automatic_stages = [
                        "download",
                        "unpack",
                        "validate",
                        "publish",
                    ]
                    if self.config.watch_upload_r2:
                        automatic_stages.append("upload")
                    current_state = StateStore(self.config.work_root).load()
                    already_completed = (
                        current_state.get("completed_stages", {})
                        if current_state.get("hotfix_res_version") == current_version
                        else {}
                    )
                    remaining_stages = [
                        stage for stage in automatic_stages if stage not in already_completed
                    ]
                    if remaining_stages:
                        automatic_config = replace(
                            self.config,
                            manual_version_enabled=False,
                            manual_seed_version="",
                            manual_rand_str="",
                            manual_publish_latest=False,
                        )
                        result = Pipeline(
                            automatic_config,
                            progress=self.progress.emit,
                            token=self.token,
                        ).run_steps(remaining_stages)
                    else:
                        result = current_state
                    processed_version = current_version
                    self.update_succeeded.emit(result)
                    self.status.emit(f"更新完成，等待下一次检查（{self.config.watch_interval} 秒）")
                else:
                    self.status.emit(f"版本无变化，等待下一次检查（{self.config.watch_interval} 秒）")
                if current_version:
                    first_check = False
            except CancelledError:
                break
            except Exception as exc:
                self.error.emit(str(exc))
                self.status.emit(f"检查失败，将在 {self.config.watch_interval} 秒后重试")

            if self.stop_event.wait(self.config.watch_interval):
                break

        self.stopped.emit()


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.config = load_config()
        self.worker: PipelineWorker | None = None
        self.worker_thread: QThread | None = None
        self.watcher_worker: AutoWatchWorker | None = None
        self.watcher_thread: QThread | None = None
        self.image_worker: ImageAssetWorker | None = None
        self.image_thread: QThread | None = None
        self.image_config_worker: ImageConfigWorker | None = None
        self.image_config_thread: QThread | None = None
        self._image_config_action = ""
        self._image_config_profile = ""
        self.image_controls: dict[str, dict[str, object]] = {}
        self.image_effective_configs: dict[str, ImageParsingConfig] = {
            profile: self.config.image_config(profile) for profile in IMAGE_PROFILES
        }
        self.image_config_resolutions: dict[str, ImageConfigResolution] = {
            profile: ImageConfigResolution(
                self.image_effective_configs[profile],
                "local_loading",
                "等待读取云端配置",
            )
            for profile in IMAGE_PROFILES
        }
        self._image_upload_invalid_reasons: dict[str, str] = {}
        self._image_active_profile = IMAGE_PROFILE_STANDARD
        self._loading_image_controls = False
        self._cloud_image_resolutions_cache: dict[str, ImageConfigResolution] | None = None
        self.r2_worker: R2VersionWorker | None = None
        self.r2_thread: QThread | None = None
        self._r2_action = ""
        self.json_worker: AssetUploadWorker | None = None
        self.json_thread: QThread | None = None
        self._json_action = ""
        self._json_plan_result: dict = {}
        self._close_when_idle = False
        self._last_message = ""
        self._watch_last_message = ""
        self._requested_stages: list[str] = []
        self._active_stage = ""
        self._image_requested_stages: list[str] = []
        self._image_active_stage = ""
        self._image_last_message = ""
        self._image_task_kind = "image"
        self._build_ui()
        self._load_config_into_ui()
        self._load_last_state()
        self._start_cloud_image_config_load()

    def _build_ui(self) -> None:
        self.setWindowTitle("AKE Data Tool")
        self.resize(1240, 880)
        self.setMinimumSize(980, 680)

        self.tabs = QTabWidget()
        self.tabs.setDocumentMode(True)
        self.setCentralWidget(self.tabs)

        task_page = QWidget()
        task_page.setMinimumWidth(1120)
        root = QVBoxLayout(task_page)
        root.setSizeConstraint(QLayout.SizeConstraint.SetMinimumSize)
        root.setContentsMargins(20, 18, 20, 18)
        root.setSpacing(20)
        task_scroll = QScrollArea()
        task_scroll.setWidgetResizable(True)
        task_scroll.setFrameShape(QFrame.Shape.NoFrame)
        task_scroll.setWidget(task_page)
        self.tabs.addTab(task_scroll, "手动更新")

        watch_page = QWidget()
        watch_page.setMinimumWidth(1120)
        watch_root = QVBoxLayout(watch_page)
        watch_root.setSizeConstraint(QLayout.SizeConstraint.SetMinimumSize)
        watch_root.setContentsMargins(20, 18, 20, 18)
        watch_root.setSpacing(20)
        watch_scroll = QScrollArea()
        watch_scroll.setWidgetResizable(True)
        watch_scroll.setFrameShape(QFrame.Shape.NoFrame)
        watch_scroll.setWidget(watch_page)
        self.tabs.addTab(watch_scroll, "自动监听")

        image_page = QWidget()
        image_page.setMinimumWidth(1120)
        image_root = QVBoxLayout(image_page)
        image_root.setSizeConstraint(QLayout.SizeConstraint.SetMinimumSize)
        image_root.setContentsMargins(20, 18, 20, 18)
        image_root.setSpacing(20)
        image_scroll = QScrollArea()
        image_scroll.setWidgetResizable(True)
        image_scroll.setFrameShape(QFrame.Shape.NoFrame)
        image_scroll.setWidget(image_page)
        self.tabs.addTab(image_scroll, "图片解析")

        full_image_page = QWidget()
        full_image_page.setMinimumWidth(1120)
        full_image_root = QVBoxLayout(full_image_page)
        full_image_root.setSizeConstraint(QLayout.SizeConstraint.SetMinimumSize)
        full_image_root.setContentsMargins(20, 18, 20, 18)
        full_image_root.setSpacing(20)
        full_image_scroll = QScrollArea()
        full_image_scroll.setWidgetResizable(True)
        full_image_scroll.setFrameShape(QFrame.Shape.NoFrame)
        full_image_scroll.setWidget(full_image_page)
        self.tabs.addTab(full_image_scroll, "图片解析（完整）")

        json_parse_page = QWidget()
        json_parse_page.setMinimumWidth(1120)
        json_parse_root = QVBoxLayout(json_parse_page)
        json_parse_root.setSizeConstraint(QLayout.SizeConstraint.SetMinimumSize)
        json_parse_root.setContentsMargins(20, 18, 20, 18)
        json_parse_root.setSpacing(20)
        json_parse_scroll = QScrollArea()
        json_parse_scroll.setWidgetResizable(True)
        json_parse_scroll.setFrameShape(QFrame.Shape.NoFrame)
        json_parse_scroll.setWidget(json_parse_page)
        self.tabs.addTab(json_parse_scroll, "Json 解析")

        json_page = QWidget()
        json_page.setMinimumWidth(1120)
        json_root = QVBoxLayout(json_page)
        json_root.setSizeConstraint(QLayout.SizeConstraint.SetMinimumSize)
        json_root.setContentsMargins(20, 18, 20, 18)
        json_root.setSpacing(20)
        json_scroll = QScrollArea()
        json_scroll.setWidgetResizable(True)
        json_scroll.setFrameShape(QFrame.Shape.NoFrame)
        json_scroll.setWidget(json_page)
        self.json_tab_index = self.tabs.addTab(json_scroll, "资产上传")

        r2_page = QWidget()
        r2_page.setMinimumWidth(1120)
        r2_root = QVBoxLayout(r2_page)
        r2_root.setSizeConstraint(QLayout.SizeConstraint.SetMinimumSize)
        r2_root.setContentsMargins(20, 18, 20, 18)
        r2_root.setSpacing(20)
        r2_scroll = QScrollArea()
        r2_scroll.setWidgetResizable(True)
        r2_scroll.setFrameShape(QFrame.Shape.NoFrame)
        r2_scroll.setWidget(r2_page)
        self.r2_tab_index = self.tabs.addTab(r2_scroll, "R2 版本管理")

        config_page = QWidget()
        config_page.setMinimumWidth(1120)
        config_root = QVBoxLayout(config_page)
        config_root.setSizeConstraint(QLayout.SizeConstraint.SetMinimumSize)
        config_root.setContentsMargins(20, 18, 20, 18)
        config_root.setSpacing(20)
        config_scroll = QScrollArea()
        config_scroll.setWidgetResizable(True)
        config_scroll.setFrameShape(QFrame.Shape.NoFrame)
        config_scroll.setWidget(config_page)
        self.config_tab_index = self.tabs.addTab(config_scroll, "工具配置")

        title_row = QHBoxLayout()
        title_box = QVBoxLayout()
        title = QLabel("AKE Data Tool")
        title.setObjectName("pageTitle")
        subtitle = QLabel("终末地 TableCfg 下载、校验与安全解包")
        subtitle.setObjectName("subtitle")
        title_box.addWidget(title)
        title_box.addWidget(subtitle)
        title_row.addLayout(title_box)
        title_row.addStretch()
        root.addLayout(title_row)

        manual_source_group = QGroupBox("数据版本来源")
        manual_source_layout = QVBoxLayout(manual_source_group)
        manual_source_row = QHBoxLayout()
        self.manual_version_check = QCheckBox("手动指定游戏版本")
        self.manual_version_edit = QLineEdit()
        self.manual_version_edit.setPlaceholderText("例如 1.2.5")
        self.manual_version_edit.setMinimumHeight(40)
        self.manual_version_edit.setMinimumWidth(150)
        self.manual_rand_edit = QLineEdit()
        self.manual_rand_edit.setPlaceholderText("例如 mStKKtMSeUpoODur")
        self.manual_rand_edit.setMinimumHeight(40)
        self.manual_rand_edit.setMinimumWidth(260)
        self.manual_publish_latest_check = QCheckBox("上传后设为 R2 latest")
        manual_source_row.addWidget(self.manual_version_check)
        manual_source_row.addSpacing(12)
        manual_source_row.addWidget(QLabel("游戏版本 version"))
        manual_source_row.addWidget(self.manual_version_edit)
        manual_source_row.addWidget(QLabel("rand_str"))
        manual_source_row.addWidget(self.manual_rand_edit, 1)
        manual_source_row.addWidget(self.manual_publish_latest_check)
        manual_source_layout.addLayout(manual_source_row)
        manual_source_hint = QLabel(
            "未启用时使用官方当前最新版。手动模式会查询指定 version/rand_str 对应的最新 Hotfix；"
            "R2 目录使用该 version 与云端 main.version。历史版本默认不切换线上 latest。"
        )
        manual_source_hint.setObjectName("pathHint")
        manual_source_hint.setWordWrap(True)
        manual_source_layout.addWidget(manual_source_hint)
        root.addWidget(manual_source_group)
        self.manual_version_check.toggled.connect(self._update_manual_version_controls)

        watch_title_box = QVBoxLayout()
        watch_title = QLabel("自动监听")
        watch_title.setObjectName("pageTitle")
        watch_subtitle = QLabel("定时检查 Hotfix；发现新版本后自动更新并发布 TableCfg")
        watch_subtitle.setObjectName("subtitle")
        watch_title_box.addWidget(watch_title)
        watch_title_box.addWidget(watch_subtitle)
        watch_root.addLayout(watch_title_box)

        watch_state_group = QGroupBox("监听状态")
        watch_state_group.setMinimumHeight(130)
        watch_state_layout = QGridLayout(watch_state_group)
        watch_state_layout.setHorizontalSpacing(28)
        self.watch_state_label = self._version_value("已停止")
        self.watch_last_check_label = self._version_value("—")
        self.watch_seed_label = self._version_value("—")
        self.watch_hotfix_label = self._version_value("—")
        watch_state_layout.addWidget(QLabel("当前状态"), 0, 0)
        watch_state_layout.addWidget(self.watch_state_label, 1, 0)
        watch_state_layout.addWidget(QLabel("最后检查"), 0, 1)
        watch_state_layout.addWidget(self.watch_last_check_label, 1, 1)
        watch_state_layout.addWidget(QLabel("Seed 版本"), 0, 2)
        watch_state_layout.addWidget(self.watch_seed_label, 1, 2)
        watch_state_layout.addWidget(QLabel("Hotfix"), 0, 3)
        watch_state_layout.addWidget(self.watch_hotfix_label, 1, 3)
        watch_state_layout.setColumnStretch(3, 2)
        watch_root.addWidget(watch_state_group)

        watch_options_group = QGroupBox("监听设置")
        watch_options_group.setMinimumHeight(150)
        watch_options_layout = QVBoxLayout(watch_options_group)
        watch_options_layout.setContentsMargins(18, 24, 18, 18)
        watch_options_row = QHBoxLayout()
        self.watch_interval_spin = QSpinBox()
        self.watch_interval_spin.setRange(1, 86400)
        self.watch_interval_spin.setSuffix(" 秒")
        self.watch_interval_spin.setMinimumHeight(38)
        self.watch_interval_spin.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self.watch_interval_spin.setKeyboardTracking(False)
        self.watch_interval_spin.lineEdit().setReadOnly(False)
        self.watch_interval_spin.lineEdit().setPlaceholderText("输入秒数")
        self.watch_update_on_start_check = QCheckBox("启动时发现已发布版本之后有新版本则立即更新")
        self.watch_upload_r2_check = QCheckBox("上传到 R2")
        watch_options_row.addWidget(QLabel("检查间隔"))
        watch_options_row.addWidget(self.watch_interval_spin)
        watch_options_row.addSpacing(24)
        watch_options_row.addWidget(self.watch_update_on_start_check)
        watch_options_row.addSpacing(24)
        watch_options_row.addWidget(self.watch_upload_r2_check)
        watch_options_row.addStretch()
        watch_options_layout.addLayout(watch_options_row)
        watch_scope = QLabel(
            "自动流程：准备 TableCfg VFS → beyond-sdk 解析 → 验证工作目录中的结果 → 直接发布 public/TableCfg。"
            "仅在勾选“上传到 R2”时继续上传 Cloudflare R2 并更新远端 manifest.json；"
            "否则到发布 public 为止。不修改 version.json，也不执行 Git。"
            "自动监听始终忽略手动版本输入，只跟踪官方当前最新版。JsonData、Json 和 images 不在监听范围内。"
        )
        watch_scope.setWordWrap(True)
        watch_scope.setObjectName("pathHint")
        watch_options_layout.addWidget(watch_scope)
        watch_root.addWidget(watch_options_group)

        watch_action_row = QHBoxLayout()
        self.watch_start_button = QPushButton("开始监听")
        self.watch_start_button.setObjectName("primaryButton")
        self.watch_start_button.setMinimumHeight(40)
        self.watch_stop_button = QPushButton("停止监听")
        self.watch_stop_button.setObjectName("dangerButton")
        self.watch_stop_button.setMinimumHeight(40)
        self.watch_stop_button.setEnabled(False)
        watch_action_row.addWidget(self.watch_start_button)
        watch_action_row.addWidget(self.watch_stop_button)
        watch_action_row.addStretch()
        watch_root.addLayout(watch_action_row)

        watch_progress_frame = QFrame()
        watch_progress_frame.setObjectName("statusFrame")
        watch_progress_frame.setMinimumHeight(72)
        watch_progress_layout = QVBoxLayout(watch_progress_frame)
        self.watch_status_text = QLabel("监听尚未启动")
        self.watch_status_text.setObjectName("statusLabel")
        self.watch_progress_bar = QProgressBar()
        self.watch_progress_bar.setTextVisible(False)
        self.watch_progress_bar.setRange(0, 1000)
        self.watch_progress_bar.setValue(0)
        watch_progress_layout.addWidget(self.watch_status_text)
        watch_progress_layout.addWidget(self.watch_progress_bar)
        watch_root.addWidget(watch_progress_frame)

        watch_log_group = QGroupBox("监听日志")
        watch_log_group.setMinimumHeight(260)
        watch_log_layout = QVBoxLayout(watch_log_group)
        self.watch_log = QPlainTextEdit()
        self.watch_log.setReadOnly(True)
        self.watch_log.setMaximumBlockCount(3000)
        self.watch_log.setMinimumHeight(200)
        self.watch_log.setFont(QFont("Cascadia Mono"))
        watch_log_layout.addWidget(self.watch_log)
        watch_root.addWidget(watch_log_group, 1)

        config_title_row = QHBoxLayout()
        config_title_box = QVBoxLayout()
        config_title = QLabel("工具配置")
        config_title.setObjectName("pageTitle")
        config_subtitle = QLabel("下载、解包、发布路径与网络请求设置")
        config_subtitle.setObjectName("subtitle")
        config_title_box.addWidget(config_title)
        config_title_box.addWidget(config_subtitle)
        config_title_row.addLayout(config_title_box)
        config_title_row.addStretch()
        self.config_path_label = QLabel(f"本地配置：{CONFIG_FILE.name}")
        self.config_path_label.setObjectName("pathHint")
        self.config_path_label.setToolTip(str(CONFIG_FILE))
        config_title_row.addWidget(self.config_path_label)
        config_root.addLayout(config_title_row)

        appcode_frame = QFrame()
        appcode_frame.setObjectName("appcodeFrame")
        appcode_layout = QHBoxLayout(appcode_frame)
        appcode_layout.setContentsMargins(14, 10, 14, 10)
        appcode_label = QLabel("AppCode")
        appcode_label.setObjectName("appcodeLabel")
        self.appcode_edit = QLineEdit()
        self.appcode_edit.setPlaceholderText("请输入游戏 AppCode")
        self.appcode_edit.setClearButtonEnabled(True)
        self.appcode_edit.setMinimumWidth(520)
        self.appcode_edit.setMinimumHeight(40)
        self.appcode_edit.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        appcode_hint = QLabel("用于查询 Seed 与 Hotfix；运行任务时自动保存")
        appcode_hint.setObjectName("pathHint")
        appcode_layout.addWidget(appcode_label)
        appcode_layout.addWidget(self.appcode_edit, 1)
        appcode_layout.addWidget(appcode_hint)
        config_root.addWidget(appcode_frame)

        version_group = QGroupBox("版本状态")
        version_layout = QGridLayout(version_group)
        version_layout.setHorizontalSpacing(24)
        self.game_value = self._version_value("—")
        self.seed_value = self._version_value("—")
        self.hotfix_value = self._version_value("—")
        self.last_success_value = self._version_value("尚未完成任务")
        version_layout.addWidget(QLabel("游戏版本"), 0, 0)
        version_layout.addWidget(self.game_value, 1, 0)
        version_layout.addWidget(QLabel("Seed 版本"), 0, 1)
        version_layout.addWidget(self.seed_value, 1, 1)
        version_layout.addWidget(QLabel("Hotfix"), 0, 2)
        version_layout.addWidget(self.hotfix_value, 1, 2)
        version_layout.addWidget(QLabel("最后成功"), 0, 3)
        version_layout.addWidget(self.last_success_value, 1, 3)
        version_layout.setColumnStretch(3, 2)
        root.addWidget(version_group)

        settings_group = QGroupBox("任务配置")
        settings_group.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        settings_group.setMinimumHeight(350)
        settings_layout = QGridLayout(settings_group)
        settings_layout.setContentsMargins(18, 22, 18, 18)
        settings_layout.setColumnStretch(1, 1)
        settings_layout.setColumnMinimumWidth(1, 760)
        settings_layout.setHorizontalSpacing(10)
        settings_layout.setVerticalSpacing(10)
        for row in range(4):
            settings_layout.setRowMinimumHeight(row, 40)

        self.rclone_edit = QLineEdit()
        self.public_edit = QLineEdit()
        for path_edit in (self.rclone_edit, self.public_edit):
            path_edit.setMinimumWidth(760)
            path_edit.setMinimumHeight(40)
            path_edit.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
            path_edit.setClearButtonEnabled(True)
        settings_layout.addWidget(QLabel("rclone"), 0, 0)
        settings_layout.addWidget(self.rclone_edit, 0, 1)
        settings_layout.addWidget(self._browse_button("浏览", self._browse_rclone), 0, 2)
        settings_layout.addWidget(QLabel("public 目录"), 1, 0)
        settings_layout.addWidget(self.public_edit, 1, 1)
        settings_layout.addWidget(self._browse_button("浏览", lambda: self._browse_directory(self.public_edit)), 1, 2)

        options = QHBoxLayout()
        options.setSpacing(10)
        self.main_check = QCheckBox("main")
        self.initial_check = QCheckBox("initial")
        self.table_block_check = QCheckBox("TableCfg")
        self.md5_check = QCheckBox("MD5 校验")
        self.keep_check = QCheckBox("保留任务文件")
        self.keep_check.setToolTip("保留已下载 VFS 和 staging，后续任务可以断点续传")
        self.timeout_spin = QSpinBox()
        self.timeout_spin.setRange(10, 600)
        self.timeout_spin.setSuffix(" 秒")
        self.timeout_spin.setMinimumHeight(36)
        self.retry_spin = QSpinBox()
        self.retry_spin.setRange(1, 10)
        self.retry_spin.setMinimumHeight(36)
        options.addWidget(QLabel("资源："))
        options.addWidget(self.main_check)
        options.addWidget(self.initial_check)
        options.addSpacing(16)
        options.addWidget(QLabel("区块："))
        options.addWidget(self.table_block_check)
        options.addSpacing(16)
        options.addWidget(self.md5_check)
        options.addWidget(self.keep_check)
        options.addStretch()
        settings_layout.addLayout(options, 2, 0, 1, 3)

        runtime_options = QHBoxLayout()
        runtime_options.setSpacing(10)
        runtime_options.addWidget(QLabel("网络请求："))
        runtime_options.addWidget(QLabel("超时"))
        runtime_options.addWidget(self.timeout_spin)
        runtime_options.addSpacing(12)
        runtime_options.addWidget(QLabel("重试"))
        runtime_options.addWidget(self.retry_spin)
        runtime_options.addStretch()
        settings_layout.addLayout(runtime_options, 3, 0, 1, 3)
        config_root.addWidget(settings_group)

        release_config_group = QGroupBox("Cloudflare R2 发布")
        release_config_group.setMinimumHeight(115)
        release_config_layout = QHBoxLayout(release_config_group)
        release_config_layout.setContentsMargins(18, 24, 18, 18)
        self.r2_remote_edit = QLineEdit()
        self.r2_bucket_edit = QLineEdit()
        for release_edit in (self.r2_remote_edit, self.r2_bucket_edit):
            release_edit.setMinimumHeight(40)
        release_config_layout.addWidget(QLabel("rclone Remote"))
        release_config_layout.addWidget(self.r2_remote_edit, 1)
        release_config_layout.addWidget(QLabel("R2 Bucket"))
        release_config_layout.addWidget(self.r2_bucket_edit, 1)
        config_root.addWidget(release_config_group)

        image_config_group = QGroupBox("beyond-sdk 与游戏资源")
        image_config_group.setMinimumHeight(315)
        image_config_layout = QGridLayout(image_config_group)
        image_config_layout.setContentsMargins(18, 24, 18, 18)
        image_config_layout.setColumnStretch(1, 1)
        image_config_layout.setColumnMinimumWidth(1, 760)
        image_config_layout.setHorizontalSpacing(10)
        image_config_layout.setVerticalSpacing(10)
        self.image_sdk_edit = QLineEdit()
        self.java_edit = QLineEdit()
        self.streaming_assets_edit = QLineEdit()
        self.persistent_edit = QLineEdit()
        self.image_work_edit = QLineEdit()
        for image_edit in (
            self.image_sdk_edit,
            self.java_edit,
            self.streaming_assets_edit,
            self.persistent_edit,
            self.image_work_edit,
        ):
            image_edit.setMinimumWidth(760)
            image_edit.setMinimumHeight(40)
            image_edit.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
            image_edit.setClearButtonEnabled(True)
        image_config_layout.addWidget(QLabel("beyond-sdk.jar"), 0, 0)
        image_config_layout.addWidget(self.image_sdk_edit, 0, 1)
        image_config_layout.addWidget(
            self._browse_button("浏览", lambda: self._browse_file(self.image_sdk_edit, "选择 beyond-sdk.jar", "JAR (*.jar)")),
            0,
            2,
        )
        image_config_layout.addWidget(QLabel("Java 命令"), 1, 0)
        image_config_layout.addWidget(self.java_edit, 1, 1)
        image_config_layout.addWidget(
            self._browse_button("浏览", lambda: self._browse_file(self.java_edit, "选择 java.exe", "Executable (*.exe)")),
            1,
            2,
        )
        image_config_layout.addWidget(QLabel("StreamingAssets"), 2, 0)
        image_config_layout.addWidget(self.streaming_assets_edit, 2, 1)
        image_config_layout.addWidget(
            self._browse_button("浏览", lambda: self._browse_directory(self.streaming_assets_edit)), 2, 2
        )
        image_config_layout.addWidget(QLabel("Persistent"), 3, 0)
        image_config_layout.addWidget(self.persistent_edit, 3, 1)
        image_config_layout.addWidget(
            self._browse_button("浏览", lambda: self._browse_directory(self.persistent_edit)), 3, 2
        )
        image_config_layout.addWidget(QLabel("统一工作目录"), 4, 0)
        image_config_layout.addWidget(self.image_work_edit, 4, 1)
        image_config_layout.addWidget(
            self._browse_button("浏览", lambda: self._browse_directory(self.image_work_edit)), 4, 2
        )
        image_options = QHBoxLayout()
        self.image_md5_check = QCheckBox("按最新索引执行 MD5 校验（强制）")
        self.image_md5_check.setChecked(True)
        self.image_md5_check.setEnabled(False)
        image_copy_label = QLabel("复制方式：独立内容副本")
        image_cleanup_label = QLabel("旧解析输出：自动删除")
        image_options.addWidget(self.image_md5_check)
        image_options.addSpacing(16)
        image_options.addWidget(image_copy_label)
        image_options.addSpacing(16)
        image_options.addWidget(image_cleanup_label)
        image_options.addStretch()
        image_config_layout.addLayout(image_options, 5, 0, 1, 3)
        config_root.addWidget(image_config_group)

        config_action_row = QHBoxLayout()
        config_action_row.addStretch()
        self.save_button = QPushButton("保存配置")
        self.save_button.setObjectName("primaryButton")
        self.save_button.setMinimumHeight(40)
        config_action_row.addWidget(self.save_button)
        config_root.addLayout(config_action_row)
        config_root.addStretch()

        steps_group = QGroupBox("流程步骤 · 可勾选组合运行，也可单步执行")
        steps_group.setMinimumHeight(300)
        steps_layout = QGridLayout(steps_group)
        steps_layout.setContentsMargins(18, 24, 18, 18)
        steps_layout.setSpacing(10)
        self.step_checks: dict[str, QCheckBox] = {}
        self.step_status: dict[str, QLabel] = {}
        self.single_step_buttons: list[QPushButton] = []
        stage_specs = [
            ("check", "1. 检查版本"),
            ("download", "2. 下载数据"),
            ("unpack", "3. 解包/解析"),
            ("validate", "4. 验证工作目录结果"),
            ("publish", "5. 直接发布到 public"),
            ("upload", "6. 上传到 R2"),
        ]
        for index, (stage, label_text) in enumerate(stage_specs):
            card = QFrame()
            card.setObjectName("stepCard")
            card_layout = QVBoxLayout(card)
            card_layout.setContentsMargins(10, 8, 10, 8)
            checkbox = QCheckBox(label_text)
            checkbox.setChecked(True)
            status = QLabel("待运行")
            status.setObjectName("stepStatus")
            single = QPushButton("单步执行")
            single.setMinimumHeight(30)
            single.clicked.connect(lambda _checked=False, selected=stage: self._start_steps([selected]))
            card_layout.addWidget(checkbox)
            card_layout.addWidget(status)
            card_layout.addWidget(single)
            steps_layout.addWidget(card, index // 4, index % 4)
            self.step_checks[stage] = checkbox
            self.step_status[stage] = status
            self.single_step_buttons.append(single)
        root.addWidget(steps_group)

        action_row = QHBoxLayout()
        self.check_button = QPushButton("检查最新版本")
        self.check_button.setObjectName("secondaryButton")
        self.run_button = QPushButton("一键运行全部")
        self.run_button.setObjectName("primaryButton")
        self.selected_button = QPushButton("运行勾选步骤")
        self.selected_button.setObjectName("secondaryButton")
        self.cancel_button = QPushButton("取消")
        self.cancel_button.setObjectName("dangerButton")
        self.cancel_button.setEnabled(False)
        self.open_button = QPushButton("打开工作目录")
        action_row.addWidget(self.check_button)
        action_row.addWidget(self.run_button)
        action_row.addWidget(self.selected_button)
        action_row.addWidget(self.cancel_button)
        action_row.addStretch()
        action_row.addWidget(self.open_button)
        root.addLayout(action_row)

        status_frame = QFrame()
        status_frame.setObjectName("statusFrame")
        status_frame.setMinimumHeight(72)
        status_layout = QVBoxLayout(status_frame)
        status_top = QHBoxLayout()
        self.status_label = QLabel("就绪")
        self.status_label.setObjectName("statusLabel")
        self.percent_label = QLabel("")
        self.percent_label.setObjectName("percentLabel")
        status_top.addWidget(self.status_label)
        status_top.addStretch()
        status_top.addWidget(self.percent_label)
        status_layout.addLayout(status_top)
        self.progress_bar = QProgressBar()
        self.progress_bar.setTextVisible(False)
        self.progress_bar.setRange(0, 1000)
        self.progress_bar.setValue(0)
        status_layout.addWidget(self.progress_bar)
        root.addWidget(status_frame)

        log_group = QGroupBox("实时日志")
        log_group.setMinimumHeight(240)
        log_layout = QVBoxLayout(log_group)
        self.log = QPlainTextEdit()
        self.log.setReadOnly(True)
        self.log.setMaximumBlockCount(3000)
        self.log.setMinimumHeight(180)
        self.log.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        mono = QFont("Cascadia Mono")
        mono.setStyleHint(QFont.StyleHint.Monospace)
        self.log.setFont(mono)
        log_layout.addWidget(self.log)
        root.addWidget(log_group, 1)

        self.check_button.clicked.connect(lambda: self._start_steps(["check"]))
        self.run_button.clicked.connect(
            lambda: self._start_steps(
                ["check", "download", "unpack", "validate", "publish", "upload"]
            )
        )
        self.selected_button.clicked.connect(self._run_selected_steps)
        self.cancel_button.clicked.connect(self._cancel_task)
        self.save_button.clicked.connect(self._save_from_ui)
        self.open_button.clicked.connect(self._open_work_root)
        self.watch_start_button.clicked.connect(self._start_watcher)
        self.watch_stop_button.clicked.connect(self._stop_watcher)

        self._build_image_page(image_root, IMAGE_PROFILE_STANDARD)
        self._build_image_page(full_image_root, IMAGE_PROFILE_FULL)
        self._build_json_parse_page(json_parse_root)
        self._build_json_page(json_root)
        self._build_r2_page(r2_root)

        self.setStyleSheet(
            """
            QMainWindow, QWidget { background: #f5f7fb; color: #182230; font-size: 13px; }
            QTabWidget::pane { border: 0; }
            QTabBar::tab { background: #e8edf5; border: 1px solid #cbd5e1; border-bottom: 0;
                           padding: 9px 24px; min-width: 92px; font-weight: 650; }
            QTabBar::tab:selected { background: #f5f7fb; color: #1d4ed8; }
            QLabel#pageTitle { font-size: 25px; font-weight: 700; color: #0f172a; }
            QLabel#subtitle, QLabel#pathHint { color: #64748b; }
            QLabel#pathHint { font-size: 11px; }
            QLabel#versionValue { font-size: 16px; font-weight: 650; color: #1d4ed8; }
            QGroupBox { background: white; border: 1px solid #dce3ee; border-radius: 9px;
                        margin-top: 10px; padding: 12px; font-weight: 650; }
            QGroupBox::title { subcontrol-origin: margin; left: 12px; padding: 0 5px; }
            QLineEdit, QSpinBox, QComboBox, QPlainTextEdit, QTableWidget {
                background: #fbfdff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px;
            }
            QLineEdit:focus, QSpinBox:focus, QComboBox:focus, QTableWidget:focus {
                border-color: #3b82f6;
            }
            QHeaderView::section { background: #eef2f7; border: 0; border-bottom: 1px solid #cbd5e1;
                                   padding: 6px; font-weight: 650; }
            QPushButton { background: white; border: 1px solid #cbd5e1; border-radius: 6px;
                          padding: 8px 14px; font-weight: 600; }
            QPushButton:hover { background: #eef4ff; border-color: #94b4ec; }
            QPushButton:disabled { color: #94a3b8; background: #f1f5f9; }
            QPushButton#primaryButton { background: #2563eb; color: white; border-color: #2563eb; }
            QPushButton#primaryButton:hover { background: #1d4ed8; }
            QPushButton#secondaryButton { color: #1d4ed8; border-color: #93b4ef; }
            QPushButton#dangerButton { color: #b91c1c; border-color: #f0a3a3; }
            QFrame#statusFrame { background: white; border: 1px solid #dce3ee; border-radius: 9px; }
            QFrame#appcodeFrame { background: #eef4ff; border: 1px solid #bfd1f5; border-radius: 9px; }
            QLabel#appcodeLabel { color: #1d4ed8; font-weight: 700; min-width: 72px; }
            QFrame#stepCard { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 7px; }
            QLabel#stepStatus { color: #64748b; font-size: 12px; }
            QLabel#statusLabel { font-weight: 650; }
            QLabel#percentLabel { color: #475569; }
            QProgressBar { background: #e2e8f0; border: 0; border-radius: 5px; height: 10px; }
            QProgressBar::chunk { background: #2563eb; border-radius: 5px; }
            """
        )

    def _build_json_page(self, root: QVBoxLayout) -> None:
        title = QLabel("资产上传")
        title.setObjectName("pageTitle")
        subtitle = QLabel("比较并同步本地图片、Json 数据至 Cloudflare R2")
        subtitle.setObjectName("subtitle")
        root.addWidget(title)
        root.addWidget(subtitle)

        selection_group = QGroupBox("上传内容")
        selection_layout = QHBoxLayout(selection_group)
        self.asset_images_check = QCheckBox("图片素材")
        self.asset_images_full_check = QCheckBox("图片素材（全部）")
        self.asset_json_check = QCheckBox("Json 数据")
        self.asset_images_check.setChecked(False)
        self.asset_images_full_check.setChecked(False)
        self.asset_json_check.setChecked(True)
        self.asset_delta_check = QCheckBox("根据差分 Map 结果上传")
        self.asset_delta_check.setToolTip(
            "仅检查并比较本次差分 Map 实际导出的图片；Json 仍按完整目录校对"
        )
        self.asset_manual_check = QCheckBox("手动更新")
        self.asset_manual_check.setToolTip(
            "按远端索引全量比较本地图片和 Json；不要求图片解析或 Map 先完成"
        )
        selection_layout.addWidget(self.asset_images_check)
        selection_layout.addWidget(self.asset_images_full_check)
        selection_layout.addWidget(self.asset_json_check)
        selection_layout.addWidget(self.asset_delta_check)
        selection_layout.addWidget(self.asset_manual_check)
        selection_layout.addStretch()
        root.addWidget(selection_group)

        map_version_frame = QFrame()
        map_version_frame.setObjectName("appcodeFrame")
        map_version_layout = QHBoxLayout(map_version_frame)
        map_version_layout.setContentsMargins(14, 10, 14, 10)
        map_version_label = QLabel("Map 版本")
        map_version_label.setObjectName("appcodeLabel")
        self.asset_map_version_edit = QLineEdit()
        self.asset_map_version_edit.setPlaceholderText(
            "留空则自动使用当前版本，例如 1.2.5@1242134-1"
        )
        self.asset_map_version_edit.setClearButtonEnabled(True)
        self.asset_map_version_edit.setMinimumWidth(420)
        self.asset_map_version_edit.setMinimumHeight(40)
        map_version_hint = QLabel(
            "仅控制上传 map 的版本名；不影响解析、资源版本或资产索引"
        )
        map_version_hint.setObjectName("pathHint")
        map_version_layout.addWidget(map_version_label)
        map_version_layout.addWidget(self.asset_map_version_edit, 1)
        map_version_layout.addWidget(map_version_hint)
        root.addWidget(map_version_frame)

        policy_group = QGroupBox("同步策略")
        policy_layout = QVBoxLayout(policy_group)
        policy = QLabel(
            "比较操作读取 R2 根目录 asset-sync-index.json，按路径、大小和 MD5 比较本地图片与 Json 数据；"
            "Json 子目录 manifest.json 仅作兼容保留，不再由本工具生成或更新。正式同步会复用当前差异计划，并先删除远端多余对象，"
            "再上传新增或变更文件。比较和正式同步都会检查整个 R2 Bucket，"
            "预计或实际占用超过 10 GB 时只会提醒，不会阻止上传。图片只比较所选 profile 的正则作用域，"
            "范围外远端记录保持不变；不会改变根 manifest 的 latest、版本列表或 sharedRevision。"
            "开启“手动更新”后将同时全量比较图片和 Json，不要求图片解析或 Map 先完成。"
        )
        policy.setWordWrap(True)
        policy.setObjectName("pathHint")
        policy_layout.addWidget(policy)
        root.addWidget(policy_group)

        location_group = QGroupBox("同步位置")
        location_layout = QGridLayout(location_group)
        self.json_source_value = QLineEdit("—")
        self.json_source_value.setReadOnly(True)
        self.json_source_value.setMinimumWidth(0)
        self.json_source_value.setMinimumHeight(38)
        self.json_remote_value = QLineEdit("—")
        self.json_remote_value.setReadOnly(True)
        self.json_remote_value.setMinimumWidth(0)
        self.json_remote_value.setMinimumHeight(38)
        self.json_local_count_value = self._version_value("—")
        self.json_local_size_value = self._version_value("—")
        self.asset_r2_size_value = self._version_value("—")
        self.asset_projected_size_value = self._version_value("—")
        location_layout.addWidget(QLabel("本地来源"), 0, 0)
        location_layout.addWidget(self.json_source_value, 1, 0)
        location_layout.addWidget(QLabel("R2 目标"), 0, 1)
        location_layout.addWidget(self.json_remote_value, 1, 1)
        location_layout.addWidget(QLabel("本地文件"), 0, 2)
        location_layout.addWidget(self.json_local_count_value, 1, 2)
        location_layout.addWidget(QLabel("本地体积"), 0, 3)
        location_layout.addWidget(self.json_local_size_value, 1, 3)
        location_layout.addWidget(QLabel("索引资产总量"), 0, 4)
        location_layout.addWidget(self.asset_r2_size_value, 1, 4)
        location_layout.addWidget(QLabel("同步后预计"), 0, 5)
        location_layout.addWidget(self.asset_projected_size_value, 1, 5)
        location_layout.setColumnStretch(0, 3)
        location_layout.setColumnStretch(1, 3)
        root.addWidget(location_group)

        changes_group = QGroupBox("资产差异预览")
        changes_layout = QVBoxLayout(changes_group)
        self.json_change_summary = QLabel("尚未比较")
        self.json_change_summary.setObjectName("statusLabel")
        self.json_change_table = QTableWidget(0, 2)
        self.json_change_table.setHorizontalHeaderLabels(["操作", "相对路径"])
        self.json_change_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.json_change_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.json_change_table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.json_change_table.setMinimumHeight(300)
        self.json_change_table.verticalHeader().setVisible(False)
        self.json_change_table.horizontalHeader().setSectionResizeMode(
            0, QHeaderView.ResizeMode.ResizeToContents
        )
        self.json_change_table.horizontalHeader().setSectionResizeMode(
            1, QHeaderView.ResizeMode.Stretch
        )
        changes_layout.addWidget(self.json_change_summary)
        changes_layout.addWidget(self.json_change_table)
        root.addWidget(changes_group, 1)

        actions = QHBoxLayout()
        self.json_plan_button = QPushButton("比较资产差异")
        self.json_plan_button.setObjectName("secondaryButton")
        self.json_plan_button.setEnabled(False)
        self.json_upload_button = QPushButton("按本地资产同步到 R2")
        self.json_upload_button.setObjectName("primaryButton")
        self.json_upload_button.setEnabled(False)
        actions.addWidget(self.json_plan_button)
        actions.addWidget(self.json_upload_button)
        actions.addStretch()
        root.addLayout(actions)

        status_frame = QFrame()
        status_frame.setObjectName("statusFrame")
        status_layout = QVBoxLayout(status_frame)
        self.json_status_label = QLabel("请选择上传内容并比较本地与远端资产")
        self.json_status_label.setObjectName("statusLabel")
        self.json_progress_bar = QProgressBar()
        self.json_progress_bar.setTextVisible(False)
        self.json_progress_bar.setRange(0, 1000)
        self.json_progress_bar.setValue(0)
        status_layout.addWidget(self.json_status_label)
        status_layout.addWidget(self.json_progress_bar)
        root.addWidget(status_frame)

        log_group = QGroupBox("资产上传日志")
        log_layout = QVBoxLayout(log_group)
        self.json_log = QPlainTextEdit()
        self.json_log.setReadOnly(True)
        self.json_log.setMaximumBlockCount(3000)
        self.json_log.setMinimumHeight(180)
        self.json_log.setFont(QFont("Cascadia Mono"))
        log_layout.addWidget(self.json_log)
        root.addWidget(log_group)

        self.json_plan_button.clicked.connect(lambda: self._start_json_action("plan"))
        self.json_upload_button.clicked.connect(self._confirm_json_upload)
        self.asset_images_check.toggled.connect(self._invalidate_asset_selection)
        self.asset_images_full_check.toggled.connect(self._invalidate_asset_selection)
        self.asset_images_check.toggled.connect(
            lambda checked: self._enforce_asset_selection_exclusive(
                self.asset_images_check, checked
            )
        )
        self.asset_images_full_check.toggled.connect(
            lambda checked: self._enforce_asset_selection_exclusive(
                self.asset_images_full_check, checked
            )
        )
        self.asset_json_check.toggled.connect(
            lambda checked: self._enforce_asset_selection_exclusive(
                self.asset_json_check, checked
            )
        )
        self.asset_delta_check.toggled.connect(
            lambda checked: self._enforce_asset_selection_exclusive(
                self.asset_delta_check, checked
            )
        )
        self.asset_manual_check.toggled.connect(
            lambda checked: self._enforce_asset_selection_exclusive(
                self.asset_manual_check, checked
            )
        )
        self.asset_map_version_edit.textChanged.connect(self._invalidate_asset_selection)
        self.public_edit.textChanged.connect(self._invalidate_json_plan)
        self.r2_remote_edit.textChanged.connect(self._invalidate_json_plan)
        self.r2_bucket_edit.textChanged.connect(self._invalidate_json_plan)

    def _build_r2_page(self, root: QVBoxLayout) -> None:
        title = QLabel("R2 版本管理")
        title.setObjectName("pageTitle")
        subtitle = QLabel("查看并删除 Cloudflare R2 中指定的 TableCfg 数据版本")
        subtitle.setObjectName("subtitle")
        root.addWidget(title)
        root.addWidget(subtitle)

        warning_group = QGroupBox("删除规则")
        warning_layout = QVBoxLayout(warning_group)
        warning = QLabel(
            "版本列表来自远端 manifest.json。删除时只处理选中版本对应的精确 TableCfg 目录，"
            "并同步移除 manifest 记录；操作无法撤销。若删除当前 latest，latest 会切换为列表中的下一个版本。"
        )
        warning.setWordWrap(True)
        warning.setObjectName("pathHint")
        warning_layout.addWidget(warning)
        root.addWidget(warning_group)

        summary_group = QGroupBox("远端状态")
        summary_layout = QGridLayout(summary_group)
        self.r2_manage_remote_value = self._version_value("尚未读取")
        self.r2_manage_latest_value = self._version_value("—")
        self.r2_manage_count_value = self._version_value("0")
        self.r2_manage_updated_value = self._version_value("—")
        summary_layout.addWidget(QLabel("R2 位置"), 0, 0)
        summary_layout.addWidget(self.r2_manage_remote_value, 1, 0)
        summary_layout.addWidget(QLabel("当前 latest"), 0, 1)
        summary_layout.addWidget(self.r2_manage_latest_value, 1, 1)
        summary_layout.addWidget(QLabel("版本数量"), 0, 2)
        summary_layout.addWidget(self.r2_manage_count_value, 1, 2)
        summary_layout.addWidget(QLabel("manifest 更新时间"), 0, 3)
        summary_layout.addWidget(self.r2_manage_updated_value, 1, 3)
        summary_layout.setColumnStretch(0, 2)
        summary_layout.setColumnStretch(1, 2)
        root.addWidget(summary_group)

        versions_group = QGroupBox("可删除版本")
        versions_layout = QVBoxLayout(versions_group)
        self.r2_version_table = QTableWidget(0, 6)
        self.r2_version_table.setHorizontalHeaderLabels(
            ["状态", "版本 ID", "游戏版本", "Hotfix", "发布时间", "R2 数据路径"]
        )
        self.r2_version_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.r2_version_table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.r2_version_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.r2_version_table.setMinimumHeight(300)
        self.r2_version_table.verticalHeader().setVisible(False)
        header = self.r2_version_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(5, QHeaderView.ResizeMode.Stretch)
        versions_layout.addWidget(self.r2_version_table)
        root.addWidget(versions_group, 1)

        actions = QHBoxLayout()
        self.r2_refresh_button = QPushButton("读取远端版本")
        self.r2_refresh_button.setObjectName("secondaryButton")
        self.r2_delete_button = QPushButton("删除选中版本")
        self.r2_delete_button.setObjectName("dangerButton")
        self.r2_delete_button.setEnabled(False)
        actions.addWidget(self.r2_refresh_button)
        actions.addWidget(self.r2_delete_button)
        actions.addStretch()
        root.addLayout(actions)

        status_frame = QFrame()
        status_frame.setObjectName("statusFrame")
        status_layout = QVBoxLayout(status_frame)
        self.r2_status_label = QLabel("点击“读取远端版本”获取 manifest.json")
        self.r2_status_label.setObjectName("statusLabel")
        self.r2_progress_bar = QProgressBar()
        self.r2_progress_bar.setTextVisible(False)
        self.r2_progress_bar.setRange(0, 1000)
        self.r2_progress_bar.setValue(0)
        status_layout.addWidget(self.r2_status_label)
        status_layout.addWidget(self.r2_progress_bar)
        root.addWidget(status_frame)

        log_group = QGroupBox("R2 操作日志")
        log_layout = QVBoxLayout(log_group)
        self.r2_log = QPlainTextEdit()
        self.r2_log.setReadOnly(True)
        self.r2_log.setMaximumBlockCount(2000)
        self.r2_log.setMinimumHeight(180)
        self.r2_log.setFont(QFont("Cascadia Mono"))
        log_layout.addWidget(self.r2_log)
        root.addWidget(log_group)

        self.r2_refresh_button.clicked.connect(self._refresh_r2_versions)
        self.r2_delete_button.clicked.connect(self._delete_selected_r2_version)
        self.r2_version_table.itemSelectionChanged.connect(self._update_r2_delete_button)

    def _build_image_page(self, root: QVBoxLayout, profile: str) -> None:
        profile = normalize_image_profile(profile)
        controls: dict[str, object] = {}
        self.image_controls[profile] = controls
        title = QLabel("图片解析" if profile == IMAGE_PROFILE_STANDARD else "图片解析（完整）")
        title.setObjectName("pageTitle")
        subtitle = QLabel(
            "合并游戏本体 VFS 与热更新覆盖，使用 beyond-sdk.jar 解析并发布到 public/images"
        )
        subtitle.setObjectName("subtitle")
        root.addWidget(title)
        root.addWidget(subtitle)

        relation_group = QGroupBox("VFS 与热更新关系")
        relation_layout = QVBoxLayout(relation_group)
        relation = QLabel(
            "每次图片任务都会先查询官方最新 Seed/Hotfix，并以远端 main/initial 索引为目标。"
            "StreamingAssets 与 Persistent 只作为本地缓存；索引或 MD5 不匹配的文件会从最新 Hotfix "
            "按需下载。只处理 Bundle、InitialBundle、BundleManifest，并在解析前后复查版本。"
        )
        relation.setWordWrap(True)
        relation.setObjectName("pathHint")
        relation_layout.addWidget(relation)
        root.addWidget(relation_group)

        image_version_group = QGroupBox("最新图片资源版本")
        image_version_layout = QGridLayout(image_version_group)
        game_value = self._version_value("尚未检查")
        seed_value = self._version_value("—")
        hotfix_value = self._version_value("—")
        remote_value = self._version_value("—")
        image_version_layout.addWidget(QLabel("游戏版本"), 0, 0)
        image_version_layout.addWidget(game_value, 1, 0)
        image_version_layout.addWidget(QLabel("Seed 版本"), 0, 1)
        image_version_layout.addWidget(seed_value, 1, 1)
        image_version_layout.addWidget(QLabel("Hotfix"), 0, 2)
        image_version_layout.addWidget(hotfix_value, 1, 2)
        image_version_layout.addWidget(QLabel("需要远端下载"), 0, 3)
        image_version_layout.addWidget(remote_value, 1, 3)
        image_version_layout.setColumnStretch(2, 2)
        root.addWidget(image_version_group)

        filter_group = QGroupBox("JAR 图片容器正则")
        filter_layout = QVBoxLayout(filter_group)
        filter_row = QHBoxLayout()
        filter_edit = QLineEdit()
        filter_edit.setMinimumHeight(40)
        filter_edit.setClearButtonEnabled(True)
        filter_edit.setPlaceholderText("请输入当前 profile 的 --containers_filter")
        filter_edit.setToolTip(
            "可只输入正则，也可以直接粘贴 --containers_filter \"正则\"；运行任务时自动保存。"
        )
        filter_reset_button = QPushButton("恢复默认")
        filter_reset_button.setMinimumHeight(40)
        filter_reset_button.clicked.connect(lambda: self._reset_image_filter_rules(profile))
        filter_row.addWidget(QLabel("--containers_filter"))
        filter_row.addWidget(filter_edit, 1)
        filter_row.addWidget(filter_reset_button)
        filter_layout.addLayout(filter_row)
        filter_hint = QLabel("输入框中无需添加引号；也兼容直接粘贴完整参数。空值将使用 JAR 自身默认行为。")
        filter_hint.setObjectName("pathHint")
        filter_layout.addWidget(filter_hint)

        add_rule_row = QHBoxLayout()
        rule_mode_combo = QComboBox()
        rule_mode_combo.addItem("包含", "include")
        rule_mode_combo.addItem("排除", "exclude")
        rule_mode_combo.setMinimumHeight(38)
        rule_content_edit = QLineEdit()
        rule_content_edit.setMinimumHeight(38)
        rule_content_edit.setPlaceholderText("输入路径或正则片段")
        rule_add_button = QPushButton("添加单项")
        rule_add_button.setObjectName("secondaryButton")
        rule_add_button.setMinimumHeight(38)
        rule_remove_button = QPushButton("删除选中")
        rule_remove_button.setMinimumHeight(38)
        rule_clear_button = QPushButton("清空单项")
        rule_clear_button.setMinimumHeight(38)
        add_rule_row.addWidget(QLabel("添加正则"))
        add_rule_row.addWidget(rule_mode_combo)
        add_rule_row.addWidget(QLabel("内容"))
        add_rule_row.addWidget(rule_content_edit, 1)
        add_rule_row.addWidget(rule_add_button)
        add_rule_row.addWidget(rule_remove_button)
        add_rule_row.addWidget(rule_clear_button)
        filter_layout.addLayout(add_rule_row)

        rule_table = QTableWidget(0, 2)
        rule_table.setHorizontalHeaderLabels(["规则", "内容（可双击编辑）"])
        rule_table.setMinimumHeight(150)
        rule_table.setMaximumHeight(220)
        rule_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        rule_table.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)
        rule_table.verticalHeader().setVisible(False)
        rule_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        rule_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        rule_table.itemChanged.connect(lambda _item, selected=profile: self._rebuild_image_filter_from_rules(selected))
        rule_add_button.clicked.connect(lambda: self._add_image_filter_rule(profile))
        rule_remove_button.clicked.connect(lambda: self._remove_selected_image_filter_rules(profile))
        rule_clear_button.clicked.connect(lambda: self._clear_image_filter_rules(profile))
        rule_content_edit.returnPressed.connect(lambda: self._add_image_filter_rule(profile))
        filter_layout.addWidget(rule_table)

        cloud_row = QHBoxLayout()
        read_cloud_check = QCheckBox("读取云端配置")
        config_source_label = QLabel("等待读取云端配置")
        config_source_label.setObjectName("statusLabel")
        config_detail_label = QLabel("—")
        config_detail_label.setObjectName("pathHint")
        config_sync_button = QPushButton("将配置同步到远端")
        config_sync_button.setObjectName("secondaryButton")
        cloud_row.addWidget(read_cloud_check)
        cloud_row.addWidget(config_source_label)
        cloud_row.addStretch()
        cloud_row.addWidget(config_sync_button)
        filter_layout.addLayout(cloud_row)
        filter_layout.addWidget(config_detail_label)
        root.addWidget(filter_group)

        steps_group = QGroupBox("图片流程 · 可勾选组合运行，也可单步执行")
        steps_layout = QGridLayout(steps_group)
        steps_layout.setContentsMargins(18, 24, 18, 18)
        steps_layout.setSpacing(10)
        step_checks: dict[str, QCheckBox] = {}
        step_status: dict[str, QLabel] = {}
        single_buttons: list[QPushButton] = []
        specs = [
            ("image_analyze", "1. 检查最新版本/索引"),
            ("image_prepare", "2. 合并并校验 VFS"),
            ("image_extract", "3. JAR 解析图片"),
            ("image_publish", "4. 发布到 public"),
        ]
        for index, (stage, text) in enumerate(specs):
            card = QFrame()
            card.setObjectName("stepCard")
            card_layout = QVBoxLayout(card)
            checkbox = QCheckBox(text)
            checkbox.setChecked(True)
            status = QLabel("待运行")
            status.setObjectName("stepStatus")
            single = QPushButton("单步执行")
            single.clicked.connect(
                lambda _checked=False, selected=stage, selected_profile=profile: self._start_image_steps([selected], selected_profile)
            )
            card_layout.addWidget(checkbox)
            card_layout.addWidget(status)
            card_layout.addWidget(single)
            steps_layout.addWidget(card, 0, index)
            step_checks[stage] = checkbox
            step_status[stage] = status
            single_buttons.append(single)
        root.addWidget(steps_group)

        actions = QHBoxLayout()
        run_all_button = QPushButton("一键解析并发布")
        run_all_button.setObjectName("primaryButton")
        run_selected_button = QPushButton("运行勾选步骤")
        run_selected_button.setObjectName("secondaryButton")
        cancel_button = QPushButton("取消")
        cancel_button.setObjectName("dangerButton")
        cancel_button.setEnabled(False)
        open_output_button = QPushButton("打开解析输出")
        actions.addWidget(run_all_button)
        actions.addWidget(run_selected_button)
        actions.addWidget(cancel_button)
        actions.addStretch()
        actions.addWidget(open_output_button)
        root.addLayout(actions)

        status_frame = QFrame()
        status_frame.setObjectName("statusFrame")
        status_layout = QVBoxLayout(status_frame)
        status_row = QHBoxLayout()
        status_label = QLabel("等待云端配置")
        status_label.setObjectName("statusLabel")
        percent_label = QLabel("")
        status_row.addWidget(status_label)
        status_row.addStretch()
        status_row.addWidget(percent_label)
        progress_bar = QProgressBar()
        progress_bar.setTextVisible(False)
        progress_bar.setRange(0, 1000)
        progress_bar.setValue(0)
        status_layout.addLayout(status_row)
        status_layout.addWidget(progress_bar)
        root.addWidget(status_frame)

        log_group = QGroupBox("图片任务日志")
        log_layout = QVBoxLayout(log_group)
        log = QPlainTextEdit()
        log.setReadOnly(True)
        log.setMaximumBlockCount(5000)
        log.setMinimumHeight(240)
        log.setFont(QFont("Cascadia Mono"))
        log_layout.addWidget(log)
        root.addWidget(log_group, 1)

        controls.update(
            {
                "game_value": game_value,
                "seed_value": seed_value,
                "hotfix_value": hotfix_value,
                "remote_value": remote_value,
                "filter_edit": filter_edit,
                "filter_reset_button": filter_reset_button,
                "rule_mode_combo": rule_mode_combo,
                "rule_content_edit": rule_content_edit,
                "rule_add_button": rule_add_button,
                "rule_remove_button": rule_remove_button,
                "rule_clear_button": rule_clear_button,
                "rule_table": rule_table,
                "read_cloud_check": read_cloud_check,
                "config_source_label": config_source_label,
                "config_detail_label": config_detail_label,
                "config_sync_button": config_sync_button,
                "step_checks": step_checks,
                "step_status": step_status,
                "single_buttons": single_buttons,
                "run_all_button": run_all_button,
                "run_selected_button": run_selected_button,
                "cancel_button": cancel_button,
                "open_output_button": open_output_button,
                "status_label": status_label,
                "percent_label": percent_label,
                "progress_bar": progress_bar,
                "log": log,
            }
        )
        run_all_button.clicked.connect(
            lambda: self._start_image_steps(
                ["image_analyze", "image_prepare", "image_extract", "image_publish"], profile
            )
        )
        run_selected_button.clicked.connect(lambda: self._run_selected_image_steps(profile))
        cancel_button.clicked.connect(self._cancel_image_task)
        open_output_button.clicked.connect(self._open_image_output)
        read_cloud_check.toggled.connect(
            lambda checked, selected=profile: self._on_cloud_config_toggle(selected, checked)
        )
        config_sync_button.clicked.connect(lambda: self._start_image_config_sync(profile))
        filter_edit.textChanged.connect(lambda _text, selected=profile: self._image_config_edited(selected))

    def _build_json_parse_page(self, root: QVBoxLayout) -> None:
        title = QLabel("Json 解析")
        title.setObjectName("pageTitle")
        subtitle = QLabel(
            "在启动 beyond-sdk 前准备完整 VFS，解析 Json 并发布指定的 Json 数据目录"
        )
        subtitle.setObjectName("subtitle")
        root.addWidget(title)
        root.addWidget(subtitle)

        relation_group = QGroupBox("输入、输出与发布范围")
        relation_layout = QVBoxLayout(relation_group)
        relation = QLabel(
            "输入固定为统一工作目录下的 VFS/775A31D1。工具会先按最新 main/initial 索引准备并校验 "
            "SDK 所需的全部 VFS 文件，任何文件缺失时都不会启动 SDK。解析输出位于 json-output；"
            "发布目标固定为 BuffData、LevelData、LevelScriptData、MissionRuntimeAsset、SkillData 和 "
            "SpawnerConfig，其他文件和目录一律忽略。"
        )
        relation.setWordWrap(True)
        relation.setObjectName("pathHint")
        relation_layout.addWidget(relation)
        root.addWidget(relation_group)

        version_group = QGroupBox("最新 Json 资源版本")
        version_layout = QGridLayout(version_group)
        self.json_parse_game_value = self._version_value("尚未检查")
        self.json_parse_seed_value = self._version_value("—")
        self.json_parse_hotfix_value = self._version_value("—")
        self.json_parse_remote_value = self._version_value("—")
        version_layout.addWidget(QLabel("游戏版本"), 0, 0)
        version_layout.addWidget(self.json_parse_game_value, 1, 0)
        version_layout.addWidget(QLabel("Seed 版本"), 0, 1)
        version_layout.addWidget(self.json_parse_seed_value, 1, 1)
        version_layout.addWidget(QLabel("Hotfix"), 0, 2)
        version_layout.addWidget(self.json_parse_hotfix_value, 1, 2)
        version_layout.addWidget(QLabel("需要远端下载"), 0, 3)
        version_layout.addWidget(self.json_parse_remote_value, 1, 3)
        version_layout.setColumnStretch(2, 2)
        root.addWidget(version_group)

        path_group = QGroupBox("Json 路径")
        path_layout = QGridLayout(path_group)
        self.json_parse_input_value = QLabel()
        self.json_parse_output_value = QLabel()
        self.json_parse_public_value = QLabel()
        for label in (
            self.json_parse_input_value,
            self.json_parse_output_value,
            self.json_parse_public_value,
        ):
            label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
            label.setWordWrap(True)
        path_layout.addWidget(QLabel("SDK 输入"), 0, 0)
        path_layout.addWidget(self.json_parse_input_value, 0, 1)
        path_layout.addWidget(QLabel("解析输出"), 1, 0)
        path_layout.addWidget(self.json_parse_output_value, 1, 1)
        path_layout.addWidget(QLabel("发布目标"), 2, 0)
        path_layout.addWidget(self.json_parse_public_value, 2, 1)
        path_layout.setColumnStretch(1, 1)
        root.addWidget(path_group)

        steps_group = QGroupBox("Json 流程 · 可勾选组合运行，也可单步执行")
        steps_layout = QGridLayout(steps_group)
        steps_layout.setContentsMargins(18, 24, 18, 18)
        steps_layout.setSpacing(10)
        self.json_parse_step_checks: dict[str, QCheckBox] = {}
        self.json_parse_step_status: dict[str, QLabel] = {}
        self.json_parse_single_buttons: list[QPushButton] = []
        specs = [
            ("json_analyze", "1. 检查最新版本/索引"),
            ("json_prepare", "2. 准备并校验 775A31D1"),
            ("json_extract", "3. JAR 解析 Json"),
            ("json_publish", "4. 发布对应目录到 public"),
        ]
        for index, (stage, text) in enumerate(specs):
            card = QFrame()
            card.setObjectName("stepCard")
            card_layout = QVBoxLayout(card)
            checkbox = QCheckBox(text)
            checkbox.setChecked(True)
            status = QLabel("待运行")
            status.setObjectName("stepStatus")
            single = QPushButton("单步执行")
            single.clicked.connect(
                lambda _checked=False, selected=stage: self._start_image_steps([selected])
            )
            card_layout.addWidget(checkbox)
            card_layout.addWidget(status)
            card_layout.addWidget(single)
            steps_layout.addWidget(card, 0, index)
            self.json_parse_step_checks[stage] = checkbox
            self.json_parse_step_status[stage] = status
            self.json_parse_single_buttons.append(single)
        root.addWidget(steps_group)

        actions = QHBoxLayout()
        self.json_parse_run_all_button = QPushButton("一键解析并发布")
        self.json_parse_run_all_button.setObjectName("primaryButton")
        self.json_parse_run_selected_button = QPushButton("运行勾选步骤")
        self.json_parse_run_selected_button.setObjectName("secondaryButton")
        self.json_parse_cancel_button = QPushButton("取消")
        self.json_parse_cancel_button.setObjectName("dangerButton")
        self.json_parse_cancel_button.setEnabled(False)
        self.json_parse_open_output_button = QPushButton("打开 Json 输出")
        actions.addWidget(self.json_parse_run_all_button)
        actions.addWidget(self.json_parse_run_selected_button)
        actions.addWidget(self.json_parse_cancel_button)
        actions.addStretch()
        actions.addWidget(self.json_parse_open_output_button)
        root.addLayout(actions)

        status_frame = QFrame()
        status_frame.setObjectName("statusFrame")
        status_layout = QVBoxLayout(status_frame)
        status_row = QHBoxLayout()
        self.json_parse_status_label = QLabel("就绪")
        self.json_parse_status_label.setObjectName("statusLabel")
        self.json_parse_percent_label = QLabel("")
        status_row.addWidget(self.json_parse_status_label)
        status_row.addStretch()
        status_row.addWidget(self.json_parse_percent_label)
        self.json_parse_progress_bar = QProgressBar()
        self.json_parse_progress_bar.setTextVisible(False)
        self.json_parse_progress_bar.setRange(0, 1000)
        self.json_parse_progress_bar.setValue(0)
        status_layout.addLayout(status_row)
        status_layout.addWidget(self.json_parse_progress_bar)
        root.addWidget(status_frame)

        log_group = QGroupBox("Json 任务日志")
        log_layout = QVBoxLayout(log_group)
        self.json_parse_log = QPlainTextEdit()
        self.json_parse_log.setReadOnly(True)
        self.json_parse_log.setMaximumBlockCount(5000)
        self.json_parse_log.setMinimumHeight(240)
        self.json_parse_log.setFont(QFont("Cascadia Mono"))
        log_layout.addWidget(self.json_parse_log)
        root.addWidget(log_group, 1)

        self.json_parse_run_all_button.clicked.connect(
            lambda: self._start_image_steps(
                ["json_analyze", "json_prepare", "json_extract", "json_publish"]
            )
        )
        self.json_parse_run_selected_button.clicked.connect(
            self._run_selected_json_parse_steps
        )
        self.json_parse_cancel_button.clicked.connect(self._cancel_image_task)
        self.json_parse_open_output_button.clicked.connect(self._open_json_output)

    def _image_filter_rules_from_table(self, profile: str) -> list[dict[str, str]]:
        table = self.image_controls[profile]["rule_table"]
        assert isinstance(table, QTableWidget)
        rules: list[dict[str, str]] = []
        for row in range(table.rowCount()):
            mode_item = table.item(row, 0)
            content_item = table.item(row, 1)
            if mode_item is None or content_item is None:
                continue
            content = content_item.text().strip()
            if not content:
                continue
            mode = str(mode_item.data(Qt.ItemDataRole.UserRole) or "")
            rules.append({"mode": mode, "content": content})
        return rules

    def _set_image_filter_rules(
        self,
        profile: str,
        rules: list[dict[str, str]],
        rebuild: bool = True,
    ) -> None:
        table = self.image_controls[profile]["rule_table"]
        assert isinstance(table, QTableWidget)
        table.blockSignals(True)
        try:
            table.setRowCount(0)
            for rule in rules:
                mode = str(rule.get("mode", "include")).strip().lower()
                content = str(rule.get("content", "")).strip()
                if mode not in {"include", "exclude"} or not content:
                    continue
                row = table.rowCount()
                table.insertRow(row)
                mode_item = QTableWidgetItem("包含" if mode == "include" else "排除")
                mode_item.setData(Qt.ItemDataRole.UserRole, mode)
                mode_item.setFlags(mode_item.flags() & ~Qt.ItemFlag.ItemIsEditable)
                table.setItem(row, 0, mode_item)
                table.setItem(row, 1, QTableWidgetItem(content))
        finally:
            table.blockSignals(False)
        if rebuild:
            self._rebuild_image_filter_from_rules(profile)

    def _add_image_filter_rule(self, profile: str) -> None:
        controls = self.image_controls[profile]
        content_edit = controls["rule_content_edit"]
        mode_combo = controls["rule_mode_combo"]
        assert isinstance(content_edit, QLineEdit) and isinstance(mode_combo, QComboBox)
        content = content_edit.text().strip()
        if not content:
            QMessageBox.warning(self, "缺少正则内容", "请输入要添加的单个正则片段。")
            return
        mode = str(mode_combo.currentData())
        rules = self._image_filter_rules_from_table(profile)
        if any(rule["mode"] == mode and rule["content"] == content for rule in rules):
            QMessageBox.information(self, "规则已存在", "相同类型和内容的规则已经存在。")
            return
        rules.append({"mode": mode, "content": content})
        self._set_image_filter_rules(profile, rules)
        content_edit.clear()
        content_edit.setFocus()

    def _remove_selected_image_filter_rules(self, profile: str) -> None:
        table = self.image_controls[profile]["rule_table"]
        assert isinstance(table, QTableWidget)
        selected_rows = sorted(
            {index.row() for index in table.selectedIndexes()},
            reverse=True,
        )
        for row in selected_rows:
            table.removeRow(row)
        if selected_rows:
            self._rebuild_image_filter_from_rules(profile)

    def _clear_image_filter_rules(self, profile: str) -> None:
        self._set_image_filter_rules(profile, [])

    def _reset_image_filter_rules(self, profile: str) -> None:
        rules = (
            default_image_filter_rules()
            if profile == IMAGE_PROFILE_STANDARD
            else default_full_image_filter_rules()
        )
        self._set_image_filter_rules(profile, rules)
        filter_edit = self.image_controls[profile]["filter_edit"]
        assert isinstance(filter_edit, QLineEdit)
        filter_edit.setText(
            DEFAULT_IMAGE_CONTAINERS_FILTER
            if profile == IMAGE_PROFILE_STANDARD
            else FULL_IMAGE_CONTAINERS_FILTER
        )

    def _rebuild_image_filter_from_rules(self, profile: str) -> None:
        controls = self.image_controls[profile]
        filter_edit = controls["filter_edit"]
        status_label = controls["status_label"]
        assert isinstance(filter_edit, QLineEdit) and isinstance(status_label, QLabel)
        try:
            filter_edit.setText(
                build_containers_filter(self._image_filter_rules_from_table(profile))
            )
        except (ValueError, ValidationError) as exc:
            status_label.setText(str(exc))

    def _current_image_config(self, profile: str) -> ImageParsingConfig:
        controls = self.image_controls[profile]
        filter_edit = controls["filter_edit"]
        assert isinstance(filter_edit, QLineEdit)
        return ImageParsingConfig.from_dict(
            {
                "image_containers_filter": normalize_containers_filter(filter_edit.text()),
                "image_filter_rules": self._image_filter_rules_from_table(profile),
                "updatedAt": self.image_effective_configs[profile].updated_at,
            }
        )

    def _apply_image_config_resolution(
        self,
        profile: str,
        resolution: ImageConfigResolution,
    ) -> None:
        controls = self.image_controls[profile]
        filter_edit = controls["filter_edit"]
        source_label = controls["config_source_label"]
        detail_label = controls["config_detail_label"]
        status_label = controls["status_label"]
        assert isinstance(filter_edit, QLineEdit)
        assert isinstance(source_label, QLabel)
        assert isinstance(detail_label, QLabel)
        assert isinstance(status_label, QLabel)
        self._loading_image_controls = True
        try:
            self.image_effective_configs[profile] = resolution.config
            self.image_config_resolutions[profile] = resolution
            if self._image_upload_invalid_reasons.get(profile, "").startswith(
                ("配置变化", "正则错误")
            ):
                self._image_upload_invalid_reasons.pop(profile, None)
            filter_edit.setText(resolution.config.image_containers_filter)
            self._set_image_filter_rules(
                profile,
                resolution.config.to_dict()["image_filter_rules"],
                rebuild=False,
            )
        finally:
            self._loading_image_controls = False
        source_text = {
            "cloud": "云端配置",
            "local_disabled": "本地配置（未启用云端读取）",
            "local_network_failure": "本地配置（云端请求失败）",
            "local_profile_missing": "本地配置（云端档案缺失）",
            "local_profile_invalid": "本地配置（云端档案无效）",
            "local_index_invalid": "本地配置（远端索引无效）",
            "local_edited": "本地配置（当前页面已编辑）",
        }.get(resolution.source, "本地配置")
        source_label.setText(source_text)
        detail_label.setText(
            f"profile={profile} · 更新时间={resolution.config.updated_at or '—'} · "
            f"摘要={resolution.config.digest()[:12]} · {resolution.detail}"
        )
        status_label.setText(resolution.detail)
        log = controls["log"]
        if isinstance(log, QPlainTextEdit):
            append_console_log(log, f"[{profile}] {source_text}：{resolution.detail}")
        self._refresh_image_upload_eligibility()

    def _image_config_edited(self, profile: str) -> None:
        if self._loading_image_controls:
            return
        try:
            config = self._current_image_config(profile)
        except Exception as exc:
            self._image_upload_invalid_reasons[profile] = f"正则错误：{exc}"
            source_label = self.image_controls[profile]["config_source_label"]
            status_label = self.image_controls[profile]["status_label"]
            if isinstance(source_label, QLabel):
                source_label.setText("当前 profile 配置错误")
            if isinstance(status_label, QLabel):
                status_label.setText(f"正则错误：{exc}")
            self._refresh_image_upload_eligibility()
            return
        self.image_effective_configs[profile] = config
        self.image_config_resolutions[profile] = ImageConfigResolution(
            config, "local_edited", "当前页面配置已编辑；对应发布资格需重新建立"
        )
        source_label = self.image_controls[profile]["config_source_label"]
        status_label = self.image_controls[profile]["status_label"]
        if isinstance(source_label, QLabel):
            source_label.setText("本地配置（当前页面已编辑）")
        if isinstance(status_label, QLabel):
            status_label.setText("配置变化：需要重新解析并发布")
        self._image_upload_invalid_reasons[profile] = "配置变化：需要重新解析并发布"
        self._refresh_image_upload_eligibility()

    def _on_cloud_config_toggle(self, profile: str, checked: bool) -> None:
        self.config = replace(self.config, image_read_cloud_config=checked)
        for selected, controls in self.image_controls.items():
            checkbox = controls["read_cloud_check"]
            if isinstance(checkbox, QCheckBox) and checkbox.isChecked() != checked:
                checkbox.blockSignals(True)
                checkbox.setChecked(checked)
                checkbox.blockSignals(False)
        if checked:
            self._start_cloud_image_config_load()
        else:
            for selected in IMAGE_PROFILES:
                local = self.config.image_config(selected)
                self._apply_image_config_resolution(
                    selected,
                    ImageConfigResolution(
                        local, "local_disabled", "云端读取已关闭，使用本地后备配置"
                    ),
                )

    def _start_cloud_image_config_load(self) -> None:
        if not self.config.image_read_cloud_config:
            self._on_cloud_config_toggle(IMAGE_PROFILE_STANDARD, False)
            return
        if self._cloud_image_resolutions_cache is not None:
            for profile, resolution in self._cloud_image_resolutions_cache.items():
                self._apply_image_config_resolution(profile, resolution)
            return
        if self.image_config_thread is not None:
            return
        self._image_config_action = "load"
        self._image_config_profile = ""
        thread = QThread(self)
        worker = ImageConfigWorker("load", self.config)
        worker.moveToThread(thread)
        thread.started.connect(worker.execute)
        worker.succeeded.connect(self._on_image_config_success)
        worker.failed.connect(self._on_image_config_failure)
        worker.succeeded.connect(thread.quit)
        worker.failed.connect(thread.quit)
        thread.finished.connect(worker.deleteLater)
        thread.finished.connect(self._on_image_config_thread_finished)
        thread.finished.connect(thread.deleteLater)
        self.image_config_thread = thread
        self.image_config_worker = worker
        self._set_busy(False)
        thread.start()

    def _start_image_config_sync(self, profile: str) -> None:
        if self.image_config_thread is not None:
            return
        if not self._save_from_ui(show_message=False):
            return
        try:
            config = self._current_image_config(profile)
        except Exception as exc:
            QMessageBox.critical(self, "当前 profile 配置错误", str(exc))
            return
        if not self.config.rclone.is_file():
            QMessageBox.critical(self, "无法连接 R2", f"rclone 不存在：\n{self.config.rclone}")
            return
        self._image_config_action = "sync"
        self._image_config_profile = profile
        thread = QThread(self)
        worker = ImageConfigWorker("sync", self.config, profile, config)
        worker.moveToThread(thread)
        thread.started.connect(worker.execute)
        worker.succeeded.connect(self._on_image_config_success)
        worker.failed.connect(self._on_image_config_failure)
        worker.succeeded.connect(thread.quit)
        worker.failed.connect(thread.quit)
        thread.finished.connect(worker.deleteLater)
        thread.finished.connect(self._on_image_config_thread_finished)
        thread.finished.connect(thread.deleteLater)
        self.image_config_thread = thread
        self.image_config_worker = worker
        self._set_busy(False)
        thread.start()

    def _on_image_config_success(self, result: object) -> None:
        if self._image_config_action == "load" and isinstance(result, dict):
            self._cloud_image_resolutions_cache = {
                profile: result[profile]
                for profile in IMAGE_PROFILES
                if isinstance(result.get(profile), ImageConfigResolution)
            }
            for profile in IMAGE_PROFILES:
                resolution = result.get(profile)
                if isinstance(resolution, ImageConfigResolution):
                    self._apply_image_config_resolution(profile, resolution)
        elif self._image_config_action == "sync" and isinstance(result, dict):
            profile = self._image_config_profile
            config = self._current_image_config(profile)
            synced = ImageParsingConfig(
                config.image_containers_filter,
                config.image_filter_rules,
                str(result.get("updatedAt", "")),
            )
            synced_resolution = ImageConfigResolution(
                synced, "cloud", "当前 profile 配置已同步到远端"
            )
            if self._cloud_image_resolutions_cache is not None:
                self._cloud_image_resolutions_cache[profile] = synced_resolution
            self._apply_image_config_resolution(
                profile,
                synced_resolution,
            )
            QMessageBox.information(self, "配置同步完成", f"{profile} 配置已同步并通过回读校验。")

    def _on_image_config_failure(self, message: str) -> None:
        if self._image_config_action == "load":
            fallback: dict[str, ImageConfigResolution] = {}
            for profile in IMAGE_PROFILES:
                local = self.config.image_config(profile)
                fallback[profile] = ImageConfigResolution(
                    local, "local_network_failure", f"云端配置读取失败：{message}"
                )
                self._apply_image_config_resolution(profile, fallback[profile])
            self._cloud_image_resolutions_cache = fallback
        else:
            QMessageBox.critical(self, "配置同步失败", message)

    def _on_image_config_thread_finished(self) -> None:
        self.image_config_worker = None
        self.image_config_thread = None
        self._image_config_action = ""
        self._image_config_profile = ""
        self._set_busy(False)
        self._close_if_requested()

    @staticmethod
    def _version_value(text: str) -> QLabel:
        label = QLabel(text)
        label.setObjectName("versionValue")
        label.setTextInteractionFlags(label.textInteractionFlags())
        return label

    @staticmethod
    def _browse_button(text: str, handler) -> QPushButton:
        button = QPushButton(text)
        button.setMinimumHeight(40)
        button.clicked.connect(handler)
        return button

    def _update_manual_version_controls(self, checked: bool) -> None:
        task_available = (
            self.worker_thread is None
            and self.watcher_thread is None
            and self.image_thread is None
            and self.r2_thread is None
            and self.json_thread is None
            and self.image_config_thread is None
        )
        enabled = checked and task_available
        self.manual_version_edit.setEnabled(enabled)
        self.manual_rand_edit.setEnabled(enabled)
        self.manual_publish_latest_check.setEnabled(enabled)

    def _load_config_into_ui(self) -> None:
        self.appcode_edit.setText(self.config.appcode)
        self.rclone_edit.setText(self.config.rclone_path)
        self.public_edit.setText(self.config.public_dir)
        self.main_check.setChecked("main" in self.config.parts)
        self.initial_check.setChecked("initial" in self.config.parts)
        self.table_block_check.setChecked("TableCfg" in self.config.blocks)
        self.md5_check.setChecked(self.config.verify_md5)
        self.keep_check.setChecked(self.config.keep_job_files)
        self.timeout_spin.setValue(self.config.request_timeout)
        self.retry_spin.setValue(self.config.retries)
        self.watch_interval_spin.setValue(self.config.watch_interval)
        self.watch_update_on_start_check.setChecked(self.config.watch_update_on_start)
        self.watch_upload_r2_check.setChecked(self.config.watch_upload_r2)
        self.manual_version_edit.setText(self.config.manual_seed_version)
        self.manual_rand_edit.setText(self.config.manual_rand_str)
        self.manual_publish_latest_check.setChecked(self.config.manual_publish_latest)
        self.manual_version_check.setChecked(self.config.manual_version_enabled)
        self._update_manual_version_controls(self.config.manual_version_enabled)
        self.r2_remote_edit.setText(self.config.r2_remote)
        self.r2_bucket_edit.setText(self.config.r2_bucket)
        self.asset_map_version_edit.setText(self.config.image_map_upload_version)
        self.asset_delta_check.blockSignals(True)
        self.asset_delta_check.setChecked(self.config.asset_upload_from_delta_map)
        self.asset_delta_check.blockSignals(False)
        self.asset_delta_check.setEnabled(False)
        self.asset_manual_check.blockSignals(True)
        self.asset_manual_check.setChecked(self.config.asset_manual_update)
        self.asset_manual_check.blockSignals(False)
        if self.asset_manual_check.isChecked():
            self._enforce_asset_selection_exclusive(self.asset_manual_check, True)
        self.json_source_value.setText(
            f"{self.config.public_root / 'images'}；{self.config.public_root / 'Json'}"
        )
        self.json_remote_value.setText(
            f"{self.config.r2_remote}:{self.config.r2_bucket}/public/images；"
            f"{self.config.r2_remote}:{self.config.r2_bucket}/public/Json"
        )
        self.image_sdk_edit.setText(self.config.image_sdk_path)
        self.java_edit.setText(self.config.java_path)
        self.streaming_assets_edit.setText(self.config.game_streaming_assets_dir)
        self.persistent_edit.setText(self.config.game_persistent_dir)
        self.image_work_edit.setText(self.config.image_work_dir)
        image_work_root = Path(self.config.image_work_dir).expanduser()
        self.json_parse_input_value.setText(
            str(image_work_root / "VFS" / "775A31D1")
        )
        self.json_parse_output_value.setText(str(image_work_root / "json-output"))
        self.json_parse_public_value.setText(str(self.config.public_root / "Json"))
        self.image_md5_check.setChecked(True)
        for profile in IMAGE_PROFILES:
            controls = self.image_controls[profile]
            checkbox = controls["read_cloud_check"]
            if isinstance(checkbox, QCheckBox):
                checkbox.blockSignals(True)
                checkbox.setChecked(self.config.image_read_cloud_config)
                checkbox.blockSignals(False)
            local = self.config.image_config(profile)
            self._apply_image_config_resolution(
                profile,
                ImageConfigResolution(local, "local_loading", "等待读取云端配置"),
            )

    def _config_from_ui(self) -> AppConfig:
        parts = []
        if self.main_check.isChecked():
            parts.append("main")
        if self.initial_check.isChecked():
            parts.append("initial")
        blocks = []
        if self.table_block_check.isChecked():
            blocks.append("TableCfg")
        image_configs = {}
        for profile in IMAGE_PROFILES:
            resolution = self.image_config_resolutions[profile]
            local_config = (
                self._current_image_config(profile)
                if resolution.source == "local_edited"
                else self.config.image_config(profile)
            )
            image_configs[profile] = local_config.to_dict()
        standard = ImageParsingConfig.from_dict(image_configs[IMAGE_PROFILE_STANDARD])
        cloud_check = self.image_controls[IMAGE_PROFILE_STANDARD]["read_cloud_check"]
        assert isinstance(cloud_check, QCheckBox)
        return AppConfig(
            appcode=self.appcode_edit.text().strip(),
            rclone_path=self.rclone_edit.text().strip(),
            public_dir=self.public_edit.text().strip(),
            parts=parts,
            blocks=blocks,
            request_timeout=self.timeout_spin.value(),
            retries=self.retry_spin.value(),
            verify_md5=self.md5_check.isChecked(),
            keep_job_files=self.keep_check.isChecked(),
            watch_interval=self.watch_interval_spin.value(),
            watch_update_on_start=self.watch_update_on_start_check.isChecked(),
            watch_upload_r2=self.watch_upload_r2_check.isChecked(),
            manual_version_enabled=self.manual_version_check.isChecked(),
            manual_seed_version=self.manual_version_edit.text().strip(),
            manual_rand_str=self.manual_rand_edit.text().strip(),
            manual_publish_latest=self.manual_publish_latest_check.isChecked(),
            r2_remote=self.r2_remote_edit.text().strip(),
            r2_bucket=self.r2_bucket_edit.text().strip(),
            image_sdk_path=self.image_sdk_edit.text().strip(),
            java_path=self.java_edit.text().strip(),
            game_streaming_assets_dir=self.streaming_assets_edit.text().strip(),
            game_persistent_dir=self.persistent_edit.text().strip(),
            image_work_dir=self.image_work_edit.text().strip(),
            image_verify_md5=self.image_md5_check.isChecked(),
            image_containers_filter=standard.image_containers_filter,
            image_filter_rules=standard.to_dict()["image_filter_rules"],
            image_parsing_configs=image_configs,
            image_read_cloud_config=cloud_check.isChecked(),
            image_map_upload_version=self.asset_map_version_edit.text().strip(),
            asset_upload_from_delta_map=(
                self.asset_delta_check.isChecked() and bool(self._selected_image_profile())
            ),
            asset_manual_update=self.asset_manual_check.isChecked(),
            vfs_validation_records=self.config.vfs_validation_records,
            required_tables=self.config.required_tables,
        )

    def _save_from_ui(self, show_message: bool = True) -> bool:
        try:
            config = self._config_from_ui()
            config.validate(require_tool=False)
            config.validate_images(require_sources=False)
            save_config(config)
            self.config = config
            image_work_root = config.image_work_root
            self.json_parse_input_value.setText(
                str(image_work_root / "VFS" / "775A31D1")
            )
            self.json_parse_output_value.setText(str(image_work_root / "json-output"))
            self.json_parse_public_value.setText(str(config.public_root / "Json"))
            if show_message:
                self._append_log("配置已保存")
            return True
        except Exception as exc:
            QMessageBox.critical(self, "配置错误", str(exc))
            return False

    def _load_last_state(self) -> None:
        state = StateStore(self.config.work_root).load()
        if not state:
            self._refresh_image_upload_eligibility()
            return
        self.game_value.setText(str(state.get("game_version", "—")))
        self.seed_value.setText(str(state.get("seed_version", "—")))
        self.hotfix_value.setText(str(state.get("hotfix_res_version", "—")))
        completed = str(state.get("completed_at", ""))
        self.last_success_value.setText(completed.replace("T", " ") if completed else "已完成")
        self._refresh_image_upload_eligibility()

    def _browse_rclone(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self,
            "选择 rclone.exe",
            self.rclone_edit.text() or str(Path.home()),
            "Executable (*.exe);;All files (*)",
        )
        if path:
            self.rclone_edit.setText(path)

    def _browse_directory(self, target: QLineEdit) -> None:
        path = QFileDialog.getExistingDirectory(self, "选择目录", target.text() or str(Path.home()))
        if path:
            target.setText(path)

    def _browse_file(self, target: QLineEdit, title: str, file_filter: str) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self,
            title,
            target.text() or str(Path.home()),
            f"{file_filter};;All files (*)",
        )
        if path:
            target.setText(path)

    def _invalidate_json_plan(self, _text: str = "") -> None:
        self._json_plan_result = {}
        self._refresh_asset_action_buttons()
        if self.json_thread is None:
            self.json_change_summary.setText("配置已变化，请重新读取远端索引并比较")

    def _invalidate_asset_selection(self, _checked: bool = False) -> None:
        self._json_plan_result = {}
        self._update_asset_map_version_control()
        if hasattr(self, "asset_delta_check"):
            image_selected = bool(self._selected_image_profile())
            if not image_selected and self.asset_delta_check.isChecked():
                self.asset_delta_check.blockSignals(True)
                self.asset_delta_check.setChecked(False)
                self.asset_delta_check.blockSignals(False)
            self.asset_delta_check.setEnabled(image_selected)
        self._refresh_asset_action_buttons()
        if self.json_thread is None:
            self.json_change_summary.setText("上传内容或比对方式已变化，请重新比较")

    def _enforce_asset_selection_exclusive(
        self, source: QCheckBox, checked: bool
    ) -> None:
        if not checked:
            return
        for checkbox in (
            self.asset_images_check,
            self.asset_images_full_check,
            self.asset_json_check,
            self.asset_delta_check,
            self.asset_manual_check,
        ):
            if checkbox is source or not checkbox.isChecked():
                continue
            checkbox.blockSignals(True)
            checkbox.setChecked(False)
            checkbox.blockSignals(False)
        self._invalidate_asset_selection()

    def _selected_image_profile(self) -> str:
        if self.asset_images_check.isChecked():
            return IMAGE_PROFILE_STANDARD
        if self.asset_images_full_check.isChecked():
            return IMAGE_PROFILE_FULL
        return ""

    def _asset_selection(self) -> tuple[bool, bool]:
        if self.asset_manual_check.isChecked():
            return True, True
        return self.asset_json_check.isChecked(), bool(self._selected_image_profile())

    def _update_asset_map_version_control(self) -> None:
        if not hasattr(self, "asset_map_version_edit"):
            return
        idle = not any(
            (
                self.worker_thread,
                self.watcher_thread,
                self.image_thread,
                self.r2_thread,
                self.json_thread,
                self.image_config_thread,
            )
        )
        self.asset_map_version_edit.setEnabled(
            idle and bool(self._selected_image_profile())
        )

    def _refresh_image_upload_eligibility(self) -> None:
        if not hasattr(self, "asset_images_check"):
            return
        try:
            state = json.loads(
                (self.config.image_work_root / "image-state.json").read_text(encoding="utf-8")
            )
        except (OSError, json.JSONDecodeError):
            state = {}
        profiles = state.get("profiles") if isinstance(state, dict) else {}
        profiles = profiles if isinstance(profiles, dict) else {}
        idle = not any(
            (
                self.worker_thread,
                self.watcher_thread,
                self.image_thread,
                self.r2_thread,
                self.json_thread,
                self.image_config_thread,
            )
        )
        for profile, checkbox in (
            (IMAGE_PROFILE_STANDARD, self.asset_images_check),
            (IMAGE_PROFILE_FULL, self.asset_images_full_check),
        ):
            record = profiles.get(profile)
            reason = self._image_upload_invalid_reasons.get(profile, "")
            if not isinstance(record, dict) or not record.get("published"):
                reason = reason or "尚未解析并发布成功"
            elif record.get("mapCommitted"):
                reason = "当前图片 map 已提交，请重新解析并发布后再上传"
            elif record.get("completedSteps") != [
                "image_analyze",
                "image_prepare",
                "image_extract",
                "image_publish",
            ]:
                reason = "图片步骤状态不完整"
            elif str(record.get("configDigest", "")) != self.image_effective_configs[profile].digest():
                reason = "当前有效配置摘要与最后发布摘要不一致"
            eligible = not reason
            if not eligible and checkbox.isChecked():
                checkbox.blockSignals(True)
                checkbox.setChecked(False)
                checkbox.blockSignals(False)
                self._invalidate_asset_selection()
            checkbox.setEnabled(eligible and idle)
            version = str(record.get("assetVersion", "—")) if isinstance(record, dict) else "—"
            checkbox.setToolTip(
                f"最后解析并发布版本：{version}；"
                + ("允许资产上传" if eligible else f"不允许资产上传：{reason}")
            )
            detail_label = self.image_controls[profile]["config_detail_label"]
            if isinstance(detail_label, QLabel):
                resolution = self.image_config_resolutions[profile]
                detail_label.setText(
                    f"profile={profile} · 配置更新时间={resolution.config.updated_at or '—'} · "
                    f"摘要={resolution.config.digest()[:12]} · 最后解析并发布版本={version} · "
                    + ("允许资产上传" if eligible else f"不允许资产上传 · 失效原因={reason}")
                )
        if hasattr(self, "asset_delta_check"):
            self.asset_delta_check.setEnabled(idle and bool(self._selected_image_profile()))
        self._update_asset_map_version_control()

    def _asset_plan_ready(self) -> bool:
        include_json, include_images = self._asset_selection()
        return include_json or include_images

    def _refresh_asset_action_buttons(self) -> None:
        idle = not any(
            (
                self.json_thread,
                self.worker_thread,
                self.watcher_thread,
                self.image_thread,
                self.r2_thread,
                self.image_config_thread,
            )
        )
        include_json, _ = self._asset_selection()
        self.json_plan_button.setEnabled(idle and self._asset_plan_ready())
        self.json_upload_button.setEnabled(
            idle
            and self._asset_plan_ready()
            and bool(
                self._json_plan_result.get("total_changes")
                or self._json_plan_result.get("image_map_digest")
            )
            and not bool(self._json_plan_result.get("counts", {}).get("error"))
        )

    def _confirm_json_upload(self) -> None:
        plan = self._json_plan_result
        include_json, _ = self._asset_selection()
        if not plan or not (
            plan.get("total_changes") or plan.get("image_map_digest")
        ):
            QMessageBox.warning(self, "步骤未完成", "请先完成资产差异比较。")
            return
        counts = plan.get("counts", {})
        if counts.get("error", 0):
            QMessageBox.critical(self, "差异比较有错误", "请解决比较错误后再上传。")
            return
        sync_note = (
            "手动更新将按远端索引全量比较并同步图片和 Json，不提交图片 Map。"
            if plan.get("manual_update")
            else "图片资产与索引确认后，完整 map 会先上传，manifest 最后提交。"
        )
        answer = QMessageBox.warning(
            self,
            "确认以本地资产同步 R2",
            f"本地来源：{plan.get('source')}\nR2 目标：{plan.get('remote')}\n\n"
            f"新增：{counts.get('upload', 0)}\n"
            f"覆盖：{counts.get('overwrite', 0)}\n"
            f"删除远端多余项：{counts.get('delete', 0)}\n"
            f"仅更新索引元数据：{counts.get('index_update', 0)}\n"
            f"图片 profile：{plan.get('image_profile') or '未选择'}\n"
            f"图片比较方式：{'手动全量比较' if plan.get('manual_update') else ('差分 Map' if plan.get('image_delta_upload_enabled') else '全量索引比较')}\n"
            f"差分文件总数：{plan.get('image_delta_export_file_count', 0)}\n"
            f"实际待上传数量：{counts.get('upload', 0) + counts.get('overwrite', 0)}\n"
            f"Json 比较：{'完整目录比较' if include_json else '未选择'}\n"
            f"正式资产版本：{plan.get('asset_version') or '—'}\n"
            f"Map 上传版本：{plan.get('image_map_upload_version') or '—'}\n"
            f"Map 文件：{plan.get('image_map_upload_file') or '—'}\n"
            f"索引资产：{int(plan.get('remote_total_bytes', 0)) / 1_000_000_000:.2f} GB\n"
            f"同步后预计：{int(plan.get('projected_total_bytes', 0)) / 1_000_000_000:.2f} GB\n"
            f"过程中峰值：{int(plan.get('peak_projected_total_bytes', 0)) / 1_000_000_000:.2f} GB"
            "（10 GB 仅作提醒）\n\n"
            + "差异来自 data.akedata.wiki 最新资产索引；同步成功后会更新该索引。\n"
            + "图片只会新增/覆盖且不会删除历史对象；Json 按差异同步。"
            + sync_note
            + "是否继续？",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if answer == QMessageBox.StandardButton.Yes:
            self._start_json_action("sync")

    def _start_json_action(self, action: str) -> None:
        if self.json_thread is not None:
            return
        if (
            self.worker_thread is not None
            or self.watcher_thread is not None
            or self.image_thread is not None
            or self.r2_thread is not None
            or self.image_config_thread is not None
        ):
            QMessageBox.warning(self, "任务运行中", "请先结束其他任务，再执行资产操作。")
            return
        if not self._save_from_ui(show_message=False):
            return
        include_json, include_images = self._asset_selection()
        image_profile = self._selected_image_profile()
        if not (include_json or include_images):
            QMessageBox.warning(self, "未选择资产", "请至少选择图片素材或 Json 数据。")
            return
        if action == "sync" and (
            not self._asset_plan_ready() or not self._json_plan_result
        ):
            QMessageBox.warning(self, "步骤未完成", "请先完成所选资产的差异比较。")
            return
        if action != "index" and not (
            action == "plan"
            and self.asset_manual_check.isChecked()
        ) and not self.config.rclone.is_file():
            QMessageBox.critical(self, "无法连接 R2", f"rclone 不存在：\n{self.config.rclone}")
            return
        sources: list[str] = []
        remotes: list[str] = []
        if include_images and action != "index":
            sources.append(str(self.config.public_root / "images"))
            remotes.append(f"{self.config.r2_remote}:{self.config.r2_bucket}/public/images")
        if include_json:
            json_root = self.config.public_root / "Json"
            if not json_root.is_dir():
                QMessageBox.critical(self, "Json 目录不存在", str(json_root))
                return
            sources.append(str(json_root))
            remotes.append(f"{self.config.r2_remote}:{self.config.r2_bucket}/public/Json")
        self.json_source_value.setText("；".join(sources))
        self.json_remote_value.setText("；".join(remotes))
        self._json_action = action
        if action == "plan":
            self._json_plan_result = {}
        action_text = {
            "plan": "读取远端索引并比较资产差异",
            "sync": "同步资产到 R2",
        }.get(action, action)
        self.json_status_label.setText(f"正在{action_text}…")
        self.json_progress_bar.setRange(0, 0)
        self._append_json_log(f"开始{action_text}")

        thread = QThread(self)
        worker = AssetUploadWorker(
            action,
            self.config,
            self._json_plan_result,
            include_json=include_json,
            include_images=include_images,
            image_profile=image_profile,
            image_config=(
                self.image_effective_configs[image_profile] if image_profile else None
            ),
            manual_update=self.asset_manual_check.isChecked(),
        )
        worker.moveToThread(thread)
        thread.started.connect(worker.execute)
        worker.progress.connect(self._on_json_progress)
        worker.succeeded.connect(self._on_json_success)
        worker.failed.connect(self._on_json_failure)
        worker.succeeded.connect(thread.quit)
        worker.failed.connect(thread.quit)
        thread.finished.connect(worker.deleteLater)
        thread.finished.connect(self._on_json_thread_finished)
        thread.finished.connect(thread.deleteLater)
        self.json_thread = thread
        self.json_worker = worker
        self._set_busy(False)
        thread.start()

    def _on_json_progress(self, event: ProgressEvent) -> None:
        self.json_status_label.setText(event.message)
        if event.total > 0:
            ratio = max(0.0, min(1.0, event.current / event.total))
            self.json_progress_bar.setRange(0, 1000)
            self.json_progress_bar.setValue(round(ratio * 1000))
        else:
            self.json_progress_bar.setRange(0, 0)
        self._append_json_log(f"[{event.stage}] {event.message}")

    def _on_json_success(self, result: object) -> None:
        if not isinstance(result, dict):
            return
        completed_sync = self._json_action == "sync"
        self._populate_json_plan(result, completed=completed_sync)
        self.json_progress_bar.setRange(0, 1000)
        self.json_progress_bar.setValue(1000)
        if completed_sync:
            if result.get("changed"):
                revision = str(result.get("sharedRevision", ""))
                self.json_status_label.setText("所选资产已同步，索引校验通过")
                if revision:
                    self._append_json_log(f"sharedRevision={revision}")
                self._append_json_log(
                    f"索引记录资产总量：{int(result.get('remote_total_bytes', 0)) / 1_000_000_000:.2f} GB"
                )
            else:
                self.json_status_label.setText("本地资产与 R2 已一致，无需上传")
                self._append_json_log("没有差异，未修改 sharedRevision")
            self._json_plan_result = {}
            self._refresh_asset_action_buttons()
        else:
            self._json_plan_result = result
            total = int(result.get("total_changes", 0) or 0)
            errors = int(result.get("counts", {}).get("error", 0) or 0)
            compare_label = (
                "手动全量比对"
                if result.get("manual_update")
                else (
                "本地索引比对"
                if result.get("compare_mode") == "local"
                else "远端比对"
                )
            )
            has_pending_map = bool(result.get("image_map_digest"))
            self.json_upload_button.setEnabled(
                self._asset_plan_ready() and (total > 0 or has_pending_map) and errors == 0
            )
            self.json_status_label.setText(
                f"{compare_label}完成：{total} 项，索引预计 "
                f"{int(result.get('projected_total_bytes', 0)) / 1_000_000_000:.2f} GB"
                if total
                else (
                    "本地资产与 R2 已一致，待提交图片完整 map"
                    if has_pending_map
                    else "本地资产与 R2 已一致"
                )
            )

    def _populate_json_plan(self, result: dict, completed: bool = False) -> None:
        counts = result.get("counts", {})
        prefix = "已执行" if completed and result.get("changed") else "待执行"
        self.json_change_summary.setText(
            f"{prefix}：新增 {counts.get('upload', 0)}，覆盖 {counts.get('overwrite', 0)}，"
            f"删除远端 {counts.get('delete', 0)}，索引元数据 {counts.get('index_update', 0)}，"
            f"错误 {counts.get('error', 0)}"
            + (
                f"；Map {result.get('image_map_upload_file')}"
                if result.get("image_map_upload_file")
                else ""
            )
        )
        self.json_source_value.setText(str(result.get("source", "—")))
        self.json_remote_value.setText(str(result.get("remote", "—")))
        self.json_local_count_value.setText(str(result.get("local_files", 0)))
        local_bytes = int(result.get("local_bytes", 0) or 0)
        self.json_local_size_value.setText(f"{local_bytes / 1024**2:.2f} MiB")
        remote_bytes = int(result.get("remote_total_bytes", 0) or 0)
        projected_bytes = int(result.get("projected_total_bytes", 0) or 0)
        peak_bytes = int(result.get("peak_projected_total_bytes", projected_bytes) or 0)
        self.asset_r2_size_value.setText(f"{remote_bytes / 1_000_000_000:.2f} GB")
        self.asset_projected_size_value.setText(
            f"{projected_bytes / 1_000_000_000:.2f} GB（峰值 {peak_bytes / 1_000_000_000:.2f}）"
        )
        changes = [change for change in result.get("changes", []) if isinstance(change, dict)]
        sorting_enabled = self.json_change_table.isSortingEnabled()
        self.json_change_table.setSortingEnabled(False)
        self.json_change_table.setUpdatesEnabled(False)
        try:
            self.json_change_table.clearContents()
            self.json_change_table.setRowCount(len(changes))
            for row, change in enumerate(changes):
                self.json_change_table.setItem(
                    row, 0, QTableWidgetItem(str(change.get("label", "")))
                )
                self.json_change_table.setItem(
                    row, 1, QTableWidgetItem(str(change.get("path", "")))
                )
        finally:
            self.json_change_table.setUpdatesEnabled(True)
            self.json_change_table.setSortingEnabled(sorting_enabled)
            self.json_change_table.viewport().update()

    def _on_json_failure(self, message: str) -> None:
        if self._json_action in {"plan", "sync"}:
            self._json_plan_result = {}
        self.json_progress_bar.setRange(0, 1000)
        self.json_progress_bar.setValue(0)
        self.json_status_label.setText("资产操作失败")
        profile = self._selected_image_profile()
        if profile and any(
            marker in message for marker in ("版本变化", "发布资格失效", "配置摘要")
        ):
            self._image_upload_invalid_reasons[profile] = message
            self._refresh_image_upload_eligibility()
        self._append_json_log(f"[错误] {message}")
        QMessageBox.critical(self, "资产操作失败", message)

    def _on_json_thread_finished(self) -> None:
        self.json_worker = None
        self.json_thread = None
        self._json_action = ""
        self._set_busy(False)
        self._close_if_requested()

    def _append_json_log(self, message: str) -> None:
        append_console_log(self.json_log, message)

    def _selected_r2_version_id(self) -> str:
        rows = self.r2_version_table.selectionModel().selectedRows()
        if not rows:
            return ""
        item = self.r2_version_table.item(rows[0].row(), 1)
        return item.text().strip() if item is not None else ""

    def _update_r2_delete_button(self) -> None:
        available = (
            self.r2_thread is None
            and self.worker_thread is None
            and self.watcher_thread is None
            and self.image_thread is None
            and self.json_thread is None
            and self.image_config_thread is None
        )
        self.r2_delete_button.setEnabled(available and bool(self._selected_r2_version_id()))

    def _refresh_r2_versions(self) -> None:
        self._start_r2_action("list")

    def _delete_selected_r2_version(self) -> None:
        version_id = self._selected_r2_version_id()
        if not version_id:
            QMessageBox.warning(self, "未选择版本", "请先在列表中选择要删除的 R2 版本。")
            return
        row = self.r2_version_table.selectionModel().selectedRows()[0].row()
        path_item = self.r2_version_table.item(row, 5)
        remote_path = path_item.text().strip() if path_item is not None else ""
        current_latest = self.r2_manage_latest_value.text().strip()
        remaining_ids = [
            self.r2_version_table.item(index, 1).text().strip()
            for index in range(self.r2_version_table.rowCount())
            if index != row and self.r2_version_table.item(index, 1) is not None
        ]
        next_latest = (
            current_latest
            if current_latest != version_id
            else (remaining_ids[0] if remaining_ids else "（空，无剩余版本）")
        )
        answer = QMessageBox.warning(
            self,
            "确认永久删除 R2 版本",
            f"即将永久删除：\n\n版本：{version_id}\n数据：{remote_path}\n"
            f"删除后 latest：{next_latest}\n\n此操作无法撤销，是否继续？",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if answer != QMessageBox.StandardButton.Yes:
            return
        self._start_r2_action("delete", version_id)

    def _start_r2_action(self, action: str, version_id: str = "") -> None:
        if self.r2_thread is not None:
            return
        if (
            self.worker_thread is not None
            or self.watcher_thread is not None
            or self.image_thread is not None
            or self.json_thread is not None
        ):
            QMessageBox.warning(self, "任务运行中", "请先结束其他任务，再执行 R2 版本操作。")
            return
        if not self._save_from_ui(show_message=False):
            return
        if not self.config.rclone.is_file():
            QMessageBox.critical(self, "无法连接 R2", f"rclone 不存在：\n{self.config.rclone}")
            return

        self._r2_action = action
        action_text = "读取远端版本" if action == "list" else f"删除版本 {version_id}"
        self.r2_status_label.setText(f"正在{action_text}…")
        self.r2_progress_bar.setRange(0, 0)
        self._append_r2_log(f"开始{action_text}")

        thread = QThread(self)
        worker = R2VersionWorker(action, self.config, version_id)
        worker.moveToThread(thread)
        thread.started.connect(worker.execute)
        worker.progress.connect(self._on_r2_progress)
        worker.succeeded.connect(self._on_r2_success)
        worker.failed.connect(self._on_r2_failure)
        worker.succeeded.connect(thread.quit)
        worker.failed.connect(thread.quit)
        thread.finished.connect(worker.deleteLater)
        thread.finished.connect(self._on_r2_thread_finished)
        thread.finished.connect(thread.deleteLater)
        self.r2_thread = thread
        self.r2_worker = worker
        self._set_busy(False)
        thread.start()

    def _on_r2_progress(self, event: ProgressEvent) -> None:
        self.r2_status_label.setText(event.message)
        if event.total > 0:
            ratio = max(0.0, min(1.0, event.current / event.total))
            self.r2_progress_bar.setRange(0, 1000)
            self.r2_progress_bar.setValue(round(ratio * 1000))
        else:
            self.r2_progress_bar.setRange(0, 0)
        self._append_r2_log(f"[{event.stage}] {event.message}")

    def _on_r2_success(self, result: object) -> None:
        if not isinstance(result, dict):
            return
        self._populate_r2_versions(result)
        self.r2_progress_bar.setRange(0, 1000)
        self.r2_progress_bar.setValue(1000)
        if self._r2_action == "delete":
            deleted = str(result.get("deleted_version", ""))
            self.r2_status_label.setText(f"已删除 R2 版本：{deleted}")
            self._append_r2_log(
                f"删除完成：{deleted}；latest={result.get('latest') or '空'}；"
                f"剩余 {result.get('remaining_count', 0)} 个版本"
            )
        else:
            count = len(result.get("versions", []))
            self.r2_status_label.setText(f"已读取 {count} 个 R2 版本")
            self._append_r2_log(f"远端版本读取完成：{count} 个")

    def _populate_r2_versions(self, result: dict) -> None:
        latest = str(result.get("latest", "")).strip()
        versions = [item for item in result.get("versions", []) if isinstance(item, dict)]
        self.r2_version_table.setRowCount(0)
        for version in versions:
            version_id = str(version.get("id", "")).strip()
            game_version = str(version.get("gameVersion", "")).strip()
            hotfix_version = str(version.get("hotfixVersion", "")).strip()
            table_path = str(version.get("tableCfgPath", "")).strip()
            if not table_path and game_version and hotfix_version:
                table_path = f"public/{game_version}/{hotfix_version}/TableCfg"
            row = self.r2_version_table.rowCount()
            self.r2_version_table.insertRow(row)
            values = [
                "latest" if version_id == latest else "历史",
                version_id,
                game_version,
                hotfix_version,
                str(version.get("publishedAt", "")).strip(),
                f"{self.config.r2_remote}:{self.config.r2_bucket}/{table_path}",
            ]
            for column, value in enumerate(values):
                self.r2_version_table.setItem(row, column, QTableWidgetItem(value))
        self.r2_manage_remote_value.setText(f"{self.config.r2_remote}:{self.config.r2_bucket}")
        self.r2_manage_latest_value.setText(latest or "空")
        self.r2_manage_count_value.setText(str(len(versions)))
        self.r2_manage_updated_value.setText(str(result.get("updatedAt", "")).strip() or "—")
        self._update_r2_delete_button()

    def _on_r2_failure(self, message: str) -> None:
        self.r2_progress_bar.setRange(0, 1000)
        self.r2_progress_bar.setValue(0)
        self.r2_status_label.setText("R2 操作失败")
        self._append_r2_log(f"[错误] {message}")
        QMessageBox.critical(self, "R2 操作失败", message)

    def _on_r2_thread_finished(self) -> None:
        self.r2_worker = None
        self.r2_thread = None
        self._r2_action = ""
        self._set_busy(False)
        self._close_if_requested()

    def _append_r2_log(self, message: str) -> None:
        append_console_log(self.r2_log, message)

    def _start_watcher(self) -> None:
        if self.watcher_thread is not None:
            return
        if (
            self.worker_thread is not None
            or self.image_thread is not None
            or self.r2_thread is not None
            or self.json_thread is not None
        ):
            QMessageBox.warning(self, "任务运行中", "请等待手动更新、图片或 R2 任务结束后再启动监听。")
            return
        if not self._save_from_ui(show_message=False):
            return
        if not self.config.image_sdk.is_file():
            QMessageBox.critical(self, "无法监听", f"beyond-sdk.jar 不存在：\n{self.config.image_sdk}")
            return
        if self.config.watch_upload_r2 and not self.config.rclone.is_file():
            QMessageBox.critical(self, "无法监听", f"rclone 不存在：\n{self.config.rclone}")
            return

        self._watch_last_message = ""
        self.watch_state_label.setText("监听中")
        self.watch_status_text.setText("正在启动监听…")
        self.watch_progress_bar.setRange(0, 0)
        watch_target = "Cloudflare R2" if self.config.watch_upload_r2 else "本地 public"
        self._append_watch_log(
            f"开始监听，检查间隔 {self.config.watch_interval} 秒；自动发布终点为 {watch_target}"
        )

        thread = QThread(self)
        worker = AutoWatchWorker(self.config)
        worker.moveToThread(thread)
        thread.started.connect(worker.execute)
        worker.checked.connect(self._on_watch_checked)
        worker.progress.connect(self._on_watch_progress)
        worker.update_started.connect(self._on_watch_update_started)
        worker.update_succeeded.connect(self._on_watch_update_succeeded)
        worker.error.connect(self._on_watch_error)
        worker.status.connect(self._on_watch_status)
        worker.stopped.connect(thread.quit)
        worker.stopped.connect(worker.deleteLater)
        thread.finished.connect(self._on_watcher_thread_finished)
        thread.finished.connect(thread.deleteLater)
        self.watcher_thread = thread
        self.watcher_worker = worker
        self._set_busy(False)
        thread.start()

    def _stop_watcher(self) -> None:
        if self.watcher_worker is None:
            return
        self.watch_state_label.setText("正在停止")
        self.watch_status_text.setText("正在停止监听并取消当前自动任务…")
        self.watch_stop_button.setEnabled(False)
        self.watcher_worker.stop()

    def _on_watch_checked(self, latest: LatestInfo, changed: bool) -> None:
        self.watch_last_check_label.setText(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        self.watch_seed_label.setText(latest.seed.seed_version)
        self.watch_hotfix_label.setText(latest.hotfix.res_version or "—")
        self._show_latest(latest)
        state = "检测到待发布版本" if changed else "版本无变化"
        self._append_watch_log(f"{state}：{latest.hotfix.res_version}")

    def _on_watch_update_started(self, previous: str, current: str) -> None:
        self.watch_state_label.setText("自动更新中")
        self.watch_progress_bar.setRange(0, 0)
        self._append_watch_log(f"检测到变化：{previous or '未发布'} -> {current}，开始自动更新")

    def _on_watch_progress(self, event: ProgressEvent) -> None:
        self.watch_status_text.setText(event.message)
        if event.total > 0:
            ratio = max(0.0, min(1.0, event.current / event.total))
            self.watch_progress_bar.setRange(0, 1000)
            self.watch_progress_bar.setValue(round(ratio * 1000))
        else:
            self.watch_progress_bar.setRange(0, 0)
        if event.message != self._watch_last_message:
            self._append_watch_log(f"[{event.stage}] {event.message}")
            self._watch_last_message = event.message

    def _on_watch_update_succeeded(self, result: object) -> None:
        self.watch_state_label.setText("监听中")
        self.watch_progress_bar.setRange(0, 1000)
        self.watch_progress_bar.setValue(1000)
        if isinstance(result, dict):
            self.last_success_value.setText(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            target = "R2" if self.config.watch_upload_r2 else "public"
            self._append_watch_log(
                f"自动发布到 {target} 成功："
                f"{result.get('r2_version_id', result.get('hotfix_res_version', ''))}"
            )

    def _on_watch_error(self, message: str) -> None:
        self.watch_state_label.setText("监听中（上次失败）")
        self._append_watch_log(f"[错误] {message}")

    def _on_watch_status(self, message: str) -> None:
        self.watch_status_text.setText(message)

    def _on_watcher_thread_finished(self) -> None:
        self.watcher_worker = None
        self.watcher_thread = None
        self.watch_state_label.setText("已停止")
        self.watch_status_text.setText("监听已停止")
        self.watch_progress_bar.setRange(0, 1000)
        self.watch_progress_bar.setValue(0)
        self._append_watch_log("监听已停止")
        self._set_busy(False)
        self._close_if_requested()

    def _append_watch_log(self, message: str) -> None:
        append_console_log(self.watch_log, message)

    def _run_selected_steps(self) -> None:
        stages = [stage for stage, checkbox in self.step_checks.items() if checkbox.isChecked()]
        self._start_steps(stages)

    def _start_steps(self, stages: list[str]) -> None:
        if self.watcher_thread is not None:
            QMessageBox.warning(self, "正在监听", "请先停止自动监听，再执行手动更新。")
            return
        if (
            self.worker_thread is not None
            or self.image_thread is not None
            or self.r2_thread is not None
            or self.json_thread is not None
        ):
            return
        if not stages:
            QMessageBox.warning(self, "没有步骤", "请至少勾选一个流程步骤。")
            return
        if not self._save_from_ui(show_message=False):
            return
        if "unpack" in stages and not self.config.image_sdk.is_file():
            QMessageBox.critical(self, "无法运行", f"beyond-sdk.jar 不存在：\n{self.config.image_sdk}")
            return
        if "upload" in stages and not self.config.rclone.is_file():
            QMessageBox.critical(self, "无法运行", f"rclone 不存在：\n{self.config.rclone}")
            return
        if (
            "upload" in stages
            and self.config.manual_version_enabled
            and self.config.manual_publish_latest
        ):
            answer = QMessageBox.question(
                self,
                "确认切换 R2 latest",
                f"手动版本 {self.config.manual_seed_version} 上传完成后将成为线上 latest。是否继续？",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            if answer != QMessageBox.StandardButton.Yes:
                return

        self._last_message = ""
        self._requested_stages = stages
        self._active_stage = ""
        for stage, label in self.step_status.items():
            label.setText("等待" if stage in stages else "未选择")
            label.setStyleSheet("")
        self.progress_bar.setRange(0, 0)
        self.percent_label.setText("")
        self._set_busy(True)
        self._append_log(f"开始执行步骤：{', '.join(stages)}")

        thread = QThread(self)
        worker = PipelineWorker(stages, self.config)
        worker.moveToThread(thread)
        thread.started.connect(worker.execute)
        worker.progress.connect(self._on_progress)
        worker.succeeded.connect(self._on_success)
        worker.failed.connect(self._on_failure)
        worker.cancelled.connect(self._on_cancelled)
        worker.succeeded.connect(thread.quit)
        worker.failed.connect(thread.quit)
        worker.cancelled.connect(thread.quit)
        thread.finished.connect(worker.deleteLater)
        thread.finished.connect(self._on_thread_finished)
        thread.finished.connect(thread.deleteLater)
        self.worker_thread = thread
        self.worker = worker
        thread.start()

    def _cancel_task(self) -> None:
        if self.worker is not None:
            self.status_label.setText("正在取消…")
            self.worker.cancel()

    def _on_progress(self, event: ProgressEvent) -> None:
        if event.stage in self.step_status:
            if self._active_stage and self._active_stage != event.stage and self._active_stage in self.step_status:
                previous = self.step_status[self._active_stage]
                previous.setText("完成")
                previous.setStyleSheet("color: #15803d; font-weight: 600;")
            self._active_stage = event.stage
            current_label = self.step_status[event.stage]
            current_label.setText("运行中")
            current_label.setStyleSheet("color: #1d4ed8; font-weight: 600;")
        self.status_label.setText(event.message)
        if event.total > 0:
            ratio = max(0.0, min(1.0, event.current / event.total))
            self.progress_bar.setRange(0, 1000)
            self.progress_bar.setValue(round(ratio * 1000))
            self.percent_label.setText(f"{ratio * 100:.1f}%")
        else:
            self.progress_bar.setRange(0, 0)
            self.percent_label.setText("")
        if event.message != self._last_message:
            prefix = {"warning": "警告", "error": "错误"}.get(event.level, event.stage)
            self._append_log(f"[{prefix}] {event.message}")
            self._last_message = event.message

    def _on_success(self, result: object) -> None:
        self.progress_bar.setRange(0, 1000)
        self.progress_bar.setValue(1000)
        self.percent_label.setText("100%")
        if isinstance(result, LatestInfo):
            self._show_latest(result)
            self.status_label.setText("版本检查完成")
            self._append_log(f"Hotfix URL: {result.hotfix.request_url}")
        elif isinstance(result, dict):
            self.game_value.setText(str(result.get("game_version", "—")))
            self.seed_value.setText(str(result.get("seed_version", "—")))
            self.hotfix_value.setText(str(result.get("hotfix_res_version", "—")))
            self.last_success_value.setText(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            self.status_label.setText("所选流程步骤已完成")
            self._append_log(json.dumps(result, ensure_ascii=False, indent=2))
        for stage in self._requested_stages:
            self.step_status[stage].setText("完成")
            self.step_status[stage].setStyleSheet("color: #15803d; font-weight: 600;")

    def _show_latest(self, latest: LatestInfo) -> None:
        self.game_value.setText(latest.seed.game_version)
        self.seed_value.setText(latest.seed.seed_version)
        self.hotfix_value.setText(latest.hotfix.res_version or "—")

    def _on_failure(self, message: str) -> None:
        self.progress_bar.setRange(0, 1000)
        self.progress_bar.setValue(0)
        self.percent_label.setText("")
        self.status_label.setText("任务失败")
        if self._active_stage in self.step_status:
            self.step_status[self._active_stage].setText("失败")
            self.step_status[self._active_stage].setStyleSheet("color: #b91c1c; font-weight: 600;")
        self._append_log(f"[错误] {message}")
        QMessageBox.critical(self, "任务失败", message)

    def _on_cancelled(self) -> None:
        self.progress_bar.setRange(0, 1000)
        self.progress_bar.setValue(0)
        self.percent_label.setText("")
        self.status_label.setText("任务已取消")
        if self._active_stage in self.step_status:
            self.step_status[self._active_stage].setText("已取消")
            self.step_status[self._active_stage].setStyleSheet("color: #b45309; font-weight: 600;")
        self._append_log("任务已取消；正式 Data 和成功版本状态未更新")

    def _on_thread_finished(self) -> None:
        self.worker = None
        self.worker_thread = None
        self._set_busy(False)
        self._close_if_requested()

    def _run_selected_image_steps(self, profile: str) -> None:
        controls = self.image_controls[profile]
        step_checks = controls["step_checks"]
        assert isinstance(step_checks, dict)
        stages = [
            stage for stage, checkbox in step_checks.items() if checkbox.isChecked()
        ]
        self._start_image_steps(stages, profile)

    def _run_selected_json_parse_steps(self) -> None:
        stages = [
            stage
            for stage, checkbox in self.json_parse_step_checks.items()
            if checkbox.isChecked()
        ]
        self._start_image_steps(stages)

    def _start_image_steps(self, stages: list[str], profile: str | None = None) -> None:
        if self.watcher_thread is not None:
            QMessageBox.warning(self, "正在监听", "请先停止自动监听，再执行素材任务。")
            return
        if (
            self.worker_thread is not None
            or self.image_thread is not None
            or self.r2_thread is not None
            or self.json_thread is not None
        ):
            return
        if not stages:
            QMessageBox.warning(self, "没有步骤", "请至少勾选一个素材流程步骤。")
            return
        stage_kinds = {"json" if stage.startswith("json_") else "image" for stage in stages}
        if len(stage_kinds) != 1:
            QMessageBox.warning(self, "步骤类型不一致", "图片与 Json 步骤必须在各自分页中运行。")
            return
        self._image_task_kind = stage_kinds.pop()
        if self._image_task_kind == "image":
            if self.image_config_thread is not None:
                QMessageBox.warning(self, "配置尚未就绪", "请等待本次启动的云端配置读取完成。")
                return
            self._image_active_profile = normalize_image_profile(profile or IMAGE_PROFILE_STANDARD)
        if not self._save_from_ui(show_message=False):
            return
        try:
            self.config.validate_images(
                require_sources=bool(
                    {"image_analyze", "image_prepare", "json_analyze", "json_prepare"}
                    & set(stages)
                )
            )
        except Exception as exc:
            QMessageBox.critical(self, "无法运行素材任务", str(exc))
            return
        self._image_last_message = ""
        self._image_requested_stages = stages
        self._image_active_stage = ""
        status_map = (
            self.json_parse_step_status
            if self._image_task_kind == "json"
            else self.image_controls[self._image_active_profile]["step_status"]
        )
        assert isinstance(status_map, dict)
        for stage, label in status_map.items():
            if stage in stages:
                label.setText("等待")
                label.setStyleSheet("")
        if self._image_task_kind == "json":
            self.json_parse_progress_bar.setRange(0, 0)
            self.json_parse_percent_label.setText("")
            self.json_parse_status_label.setText("正在启动 Json 任务…")
            self._append_json_parse_log(f"开始执行步骤：{', '.join(stages)}")
        else:
            controls = self.image_controls[self._image_active_profile]
            progress_bar = controls["progress_bar"]
            percent_label = controls["percent_label"]
            status_label = controls["status_label"]
            assert isinstance(progress_bar, QProgressBar)
            assert isinstance(percent_label, QLabel) and isinstance(status_label, QLabel)
            progress_bar.setRange(0, 0)
            percent_label.setText("")
            status_label.setText("正在启动图片任务…")
            self._append_image_log(
                f"开始执行步骤：{', '.join(stages)}", self._image_active_profile
            )

        thread = QThread(self)
        worker = ImageAssetWorker(
            stages,
            self.config,
            image_profile=self._image_active_profile,
            image_config=(
                self.image_effective_configs[self._image_active_profile]
                if self._image_task_kind == "image"
                else None
            ),
        )
        worker.moveToThread(thread)
        thread.started.connect(worker.execute)
        worker.progress.connect(self._on_image_progress)
        worker.succeeded.connect(self._on_image_success)
        worker.failed.connect(self._on_image_failure)
        worker.cancelled.connect(self._on_image_cancelled)
        worker.succeeded.connect(thread.quit)
        worker.failed.connect(thread.quit)
        worker.cancelled.connect(thread.quit)
        thread.finished.connect(worker.deleteLater)
        thread.finished.connect(self._on_image_thread_finished)
        thread.finished.connect(thread.deleteLater)
        self.image_thread = thread
        self.image_worker = worker
        self._set_busy(False)
        thread.start()

    def _cancel_image_task(self) -> None:
        if self.image_worker is not None:
            if self._image_task_kind == "json":
                self.json_parse_status_label.setText("正在取消…")
            else:
                status = self.image_controls[self._image_active_profile]["status_label"]
                assert isinstance(status, QLabel)
                status.setText("正在取消…")
            self.image_worker.cancel()

    def _on_image_progress(self, event: ProgressEvent) -> None:
        is_json = event.stage.startswith("json_")
        controls = self.image_controls[self._image_active_profile]
        status_map = self.json_parse_step_status if is_json else controls["step_status"]
        status_label = self.json_parse_status_label if is_json else controls["status_label"]
        progress_bar = self.json_parse_progress_bar if is_json else controls["progress_bar"]
        percent_label = self.json_parse_percent_label if is_json else controls["percent_label"]
        assert isinstance(status_map, dict)
        assert isinstance(status_label, QLabel)
        assert isinstance(progress_bar, QProgressBar) and isinstance(percent_label, QLabel)
        if event.stage in status_map:
            if (
                self._image_active_stage
                and self._image_active_stage != event.stage
                and self._image_active_stage in status_map
            ):
                previous = status_map[self._image_active_stage]
                previous.setText("完成")
                previous.setStyleSheet("color: #15803d; font-weight: 600;")
            self._image_active_stage = event.stage
            current = status_map[event.stage]
            current.setText("运行中")
            current.setStyleSheet("color: #1d4ed8; font-weight: 600;")
        status_label.setText(event.message)
        if event.total > 0:
            ratio = max(0.0, min(1.0, event.current / event.total))
            progress_bar.setRange(0, 1000)
            progress_bar.setValue(round(ratio * 1000))
            percent_label.setText(f"{ratio * 100:.1f}%")
        else:
            progress_bar.setRange(0, 0)
            percent_label.setText("")
        if event.message != self._image_last_message:
            if is_json:
                self._append_json_parse_log(f"[{event.stage}] {event.message}")
            else:
                self._append_image_log(
                    f"[{event.stage}] {event.message}", self._image_active_profile
                )
            self._image_last_message = event.message

    def _on_image_success(self, result: object) -> None:
        is_json = self._image_task_kind == "json"
        controls = self.image_controls[self._image_active_profile]
        progress_bar = self.json_parse_progress_bar if is_json else controls["progress_bar"]
        percent_label = self.json_parse_percent_label if is_json else controls["percent_label"]
        status_label = self.json_parse_status_label if is_json else controls["status_label"]
        status_map = self.json_parse_step_status if is_json else controls["step_status"]
        assert isinstance(progress_bar, QProgressBar) and isinstance(percent_label, QLabel)
        assert isinstance(status_label, QLabel) and isinstance(status_map, dict)
        progress_bar.setRange(0, 1000)
        progress_bar.setValue(1000)
        percent_label.setText("100%")
        status_label.setText("所选 Json 流程步骤已完成" if is_json else "所选图片流程步骤已完成")
        for stage in self._image_requested_stages:
            status_map[stage].setText("完成")
            status_map[stage].setStyleSheet("color: #15803d; font-weight: 600;")
        if isinstance(result, dict):
            if is_json and "json_game_version" in result:
                self.json_parse_game_value.setText(str(result.get("json_game_version", "—")))
                self.json_parse_seed_value.setText(str(result.get("json_seed_version", "—")))
                self.json_parse_hotfix_value.setText(str(result.get("json_hotfix_version", "—")))
                remote_count = int(result.get("json_remote_files", 0) or 0)
                remote_bytes = int(result.get("json_remote_bytes", 0) or 0)
                self.json_parse_remote_value.setText(
                    f"{remote_count} 个 / {remote_bytes / 1024**2:.2f} MiB"
                )
                self._append_json_parse_log(json.dumps(result, ensure_ascii=False, indent=2))
            elif "image_game_version" in result:
                game_value = controls["game_value"]
                seed_value = controls["seed_value"]
                hotfix_value = controls["hotfix_value"]
                remote_value = controls["remote_value"]
                assert isinstance(game_value, QLabel) and isinstance(seed_value, QLabel)
                assert isinstance(hotfix_value, QLabel) and isinstance(remote_value, QLabel)
                game_value.setText(str(result.get("image_game_version", "—")))
                seed_value.setText(str(result.get("image_seed_version", "—")))
                hotfix_value.setText(str(result.get("image_hotfix_version", "—")))
                remote_count = int(result.get("image_remote_files", 0) or 0)
                remote_bytes = int(result.get("image_remote_bytes", 0) or 0)
                remote_value.setText(
                    f"{remote_count} 个 / {remote_bytes / 1024**2:.2f} MiB"
                )
                self._append_image_log(
                    json.dumps(result, ensure_ascii=False, indent=2),
                    self._image_active_profile,
                )
                if result.get("image_published_profile") == self._image_active_profile:
                    self._image_upload_invalid_reasons.pop(self._image_active_profile, None)
                    self._refresh_image_upload_eligibility()

    def _on_image_failure(self, message: str) -> None:
        is_json = self._image_task_kind == "json"
        controls = self.image_controls[self._image_active_profile]
        progress_bar = self.json_parse_progress_bar if is_json else controls["progress_bar"]
        percent_label = self.json_parse_percent_label if is_json else controls["percent_label"]
        status_label = self.json_parse_status_label if is_json else controls["status_label"]
        status_map = self.json_parse_step_status if is_json else controls["step_status"]
        assert isinstance(progress_bar, QProgressBar) and isinstance(percent_label, QLabel)
        assert isinstance(status_label, QLabel) and isinstance(status_map, dict)
        progress_bar.setRange(0, 1000)
        progress_bar.setValue(0)
        percent_label.setText("")
        status_label.setText("Json 任务失败" if is_json else "图片任务失败")
        if self._image_active_stage in status_map:
            status = status_map[self._image_active_stage]
            status.setText("失败")
            status.setStyleSheet("color: #b91c1c; font-weight: 600;")
        if is_json:
            self._append_json_parse_log(f"[错误] {message}")
        else:
            self._image_upload_invalid_reasons[self._image_active_profile] = message
            self._refresh_image_upload_eligibility()
            self._append_image_log(f"[错误] {message}", self._image_active_profile)
        QMessageBox.critical(self, "Json 任务失败" if is_json else "图片任务失败", message)

    def _on_image_cancelled(self) -> None:
        is_json = self._image_task_kind == "json"
        controls = self.image_controls[self._image_active_profile]
        progress_bar = self.json_parse_progress_bar if is_json else controls["progress_bar"]
        percent_label = self.json_parse_percent_label if is_json else controls["percent_label"]
        status_label = self.json_parse_status_label if is_json else controls["status_label"]
        status_map = self.json_parse_step_status if is_json else controls["step_status"]
        assert isinstance(progress_bar, QProgressBar) and isinstance(percent_label, QLabel)
        assert isinstance(status_label, QLabel) and isinstance(status_map, dict)
        progress_bar.setRange(0, 1000)
        progress_bar.setValue(0)
        percent_label.setText("")
        status_label.setText("Json 任务已取消" if is_json else "图片任务已取消")
        if self._image_active_stage in status_map:
            status = status_map[self._image_active_stage]
            status.setText("已取消")
            status.setStyleSheet("color: #b45309; font-weight: 600;")
        message = "任务已取消；已完成的 VFS 文件可供下次断点复用"
        if is_json:
            self._append_json_parse_log(message)
        else:
            self._image_upload_invalid_reasons[self._image_active_profile] = "任务已取消"
            self._refresh_image_upload_eligibility()
            self._append_image_log(message, self._image_active_profile)

    def _on_image_thread_finished(self) -> None:
        self.image_worker = None
        self.image_thread = None
        self._set_busy(False)
        self._close_if_requested()

    def _append_image_log(self, message: str, profile: str | None = None) -> None:
        selected = profile or self._image_active_profile
        log = self.image_controls[selected]["log"]
        assert isinstance(log, QPlainTextEdit)
        append_console_log(log, message)

    def _append_json_parse_log(self, message: str) -> None:
        append_console_log(self.json_parse_log, message)

    def _open_image_output(self) -> None:
        path = Path(self.image_work_edit.text().strip()).expanduser() / "output"
        path.mkdir(parents=True, exist_ok=True)
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(path.resolve())))

    def _open_json_output(self) -> None:
        path = Path(self.image_work_edit.text().strip()).expanduser() / "json-output"
        path.mkdir(parents=True, exist_ok=True)
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(path.resolve())))

    def _set_busy(self, busy: bool) -> None:
        manual_busy = busy or self.worker_thread is not None
        image_busy = self.image_thread is not None
        watching = self.watcher_thread is not None
        r2_busy = self.r2_thread is not None
        json_busy = self.json_thread is not None
        image_config_busy = self.image_config_thread is not None
        available = not manual_busy and not image_busy and not watching and not r2_busy and not json_busy and not image_config_busy
        self.check_button.setEnabled(available)
        self.run_button.setEnabled(available)
        self.selected_button.setEnabled(available)
        self.save_button.setEnabled(available)
        self.cancel_button.setEnabled(manual_busy)
        self.watch_start_button.setEnabled(available)
        self.watch_stop_button.setEnabled(watching)
        self.watch_interval_spin.setEnabled(available)
        self.watch_update_on_start_check.setEnabled(available)
        self.watch_upload_r2_check.setEnabled(available)
        for profile, controls in self.image_controls.items():
            for key in (
                "run_all_button",
                "run_selected_button",
                "filter_edit",
                "filter_reset_button",
                "rule_mode_combo",
                "rule_content_edit",
                "rule_add_button",
                "rule_remove_button",
                "rule_clear_button",
                "rule_table",
                "read_cloud_check",
                "config_sync_button",
            ):
                widget = controls[key]
                if isinstance(widget, QWidget):
                    widget.setEnabled(available)
            cancel = controls["cancel_button"]
            if isinstance(cancel, QPushButton):
                cancel.setEnabled(
                    image_busy
                    and self._image_task_kind == "image"
                    and profile == self._image_active_profile
                )
            for button in controls["single_buttons"]:
                if isinstance(button, QPushButton):
                    button.setEnabled(available)
        self.json_parse_run_all_button.setEnabled(available)
        self.json_parse_run_selected_button.setEnabled(available)
        self.json_parse_cancel_button.setEnabled(image_busy and self._image_task_kind == "json")
        self.manual_version_check.setEnabled(available)
        self._update_manual_version_controls(
            self.manual_version_check.isChecked() and available
        )
        self.r2_refresh_button.setEnabled(available)
        self._update_r2_delete_button()
        self.asset_json_check.setEnabled(available)
        self.asset_manual_check.setEnabled(available)
        self._refresh_image_upload_eligibility()
        include_json, _ = self._asset_selection()
        self.json_plan_button.setEnabled(available and self._asset_plan_ready())
        self.json_upload_button.setEnabled(
            available
            and self._asset_plan_ready()
            and bool(
                self._json_plan_result.get("total_changes")
                or self._json_plan_result.get("image_map_digest")
            )
            and not bool(self._json_plan_result.get("counts", {}).get("error"))
        )
        self.tabs.setTabEnabled(self.config_tab_index, available)
        for button in self.single_step_buttons:
            button.setEnabled(available)
        for button in self.json_parse_single_buttons:
            button.setEnabled(available)

    def _close_if_requested(self) -> None:
        if (
            self._close_when_idle
            and self.worker_thread is None
            and self.watcher_thread is None
            and self.image_thread is None
            and self.r2_thread is None
            and self.json_thread is None
            and self.image_config_thread is None
        ):
            self._close_when_idle = False
            self.close()

    def _append_log(self, message: str) -> None:
        append_console_log(self.log, message)

    def _open_work_root(self) -> None:
        path = self.config.work_root
        path.mkdir(parents=True, exist_ok=True)
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(path.resolve())))

    def closeEvent(self, event: QCloseEvent) -> None:
        if (
            self.worker_thread is None
            and self.watcher_thread is None
            and self.image_thread is None
            and self.r2_thread is None
            and self.json_thread is None
            and self.image_config_thread is None
        ):
            event.accept()
            return
        answer = QMessageBox.question(
            self,
            "任务正在运行",
            "将停止可取消的任务；正在执行的 R2 删除或 Json 同步会等待其安全完成后再关闭。是否继续？",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if answer == QMessageBox.StandardButton.Yes:
            self._close_when_idle = True
            if self.worker_thread is not None:
                self._cancel_task()
            if self.watcher_thread is not None:
                self._stop_watcher()
            if self.image_thread is not None:
                self._cancel_image_task()
            if self.r2_thread is not None:
                self.r2_status_label.setText("正在等待 R2 操作安全完成后关闭…")
            if self.json_thread is not None:
                self.json_status_label.setText("正在等待 Json 同步安全完成后关闭…")
            if self.image_config_thread is not None:
                for controls in self.image_controls.values():
                    status = controls["status_label"]
                    if isinstance(status, QLabel):
                        status.setText("正在等待图片配置操作安全完成后关闭…")
        event.ignore()


def run_gui() -> int:
    app = QApplication.instance() or QApplication(sys.argv)
    app.setApplicationName("AKE Data Tool")
    app.setOrganizationName("AKEDatabase")
    app.setFont(QFont("Microsoft YaHei UI", 9))
    window = MainWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(run_gui())
