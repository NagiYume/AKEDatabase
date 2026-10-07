"use strict";
const login = document.getElementById("login");
const connection = document.getElementById("connection");
const fields = document.getElementById("fields");
const intervalInput = document.getElementById("interval");
const concurrencyInput = document.getElementById("concurrency");
const downloadConcurrencyInput = document.getElementById("download-concurrency");
const controlMessage = document.getElementById("control-message");
let controlBusy = false;
let intervalDirty = false;
let concurrencyDirty = false;
let downloadConcurrencyDirty = false;
let lastState = null;
const clock = new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"});
function localTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : clock.format(date) + " UTC+8";
}
const memoryFields = new Set(["memory_current", "memory_peak", "memory_max", "disk_free_bytes"]);
const labels = {
  task_mode: "任务类型 / Task type", task_id: "模拟任务 / Replay task", task_status: "任务状态 / Task status",
  upload_concurrency: "上传并发数 / Upload concurrency",
  configured_upload_concurrency: "下次上传并发数 / Configured concurrency",
  download_concurrency: "下载并发数 / Download concurrency",
  configured_download_concurrency: "下次下载并发数 / Configured download concurrency",
  watch_state: "监听状态 / Watch state",
  stage: "阶段 / Stage", message: "进度 / Progress", healthy: "运行正常 / Healthy",
  official_version: "官方版本 / Official version", remote_latest: "远端版本 / Remote latest",
  last_check_at: "最后检查 / Last check", last_success_at: "最后完成 / Last success",
  interval_seconds: "检查间隔（秒） / Interval", upload_enabled: "自动发布 / Auto publish",
  table_count: "表数量 / Tables", remote_missing_files: "远端缺少 / Missing remotely",
  current: "已完成 / Completed", total: "总计 / Total", error: "错误 / Error",
  updated_at: "进度更新时间 / Progress updated", file_name: "当前文件 / Current file",
  file_index: "已完成文件数 / Completed files", file_total: "文件总数 / File count",
  memory_current: "服务内存（MB） / Memory", memory_peak: "内存峰值（MB） / Peak memory",
  memory_max: "内存上限（MB） / Memory limit", disk_free_bytes: "磁盘余量（MB） / Free disk",
  check_seconds: "接口耗时（秒） / API time", download_bytes: "下载大小（字节） / Download size",
  download_seconds: "下载耗时（秒） / Download time", extraction_seconds: "解析校验耗时（秒） / Extraction time",
  upload_bytes: "上传大小（字节） / Upload size", upload_seconds: "上传耗时（秒） / Upload time"
};
function updateButtons() {
  document.getElementById("start").disabled = controlBusy || !lastState || lastState.watch_state !== "stopped" || lastState.task_status === "running";
  document.getElementById("stop").disabled = controlBusy || !lastState?.watch_enabled;
  document.getElementById("save-interval").disabled = controlBusy;
  document.getElementById("save-concurrency").disabled = controlBusy;
  document.getElementById("save-download-concurrency").disabled = controlBusy;
}
function renderProgress(state) {
  const activeFiles = document.getElementById("active-files");
  activeFiles.replaceChildren();
  for (const file of state.active_files || []) {
    const row = document.createElement("li");
    row.textContent = `${file.name} · ${(file.bytes / 1000000).toFixed(2)} / ${(file.size / 1000000).toFixed(2)} MB`;
    activeFiles.append(row);
  }
  const stage = document.getElementById("stage-progress");
  const bytes = document.getElementById("byte-progress");
  const text = document.getElementById("task-progress");
  const byteText = document.getElementById("byte-progress-label");
  const unit = {bytes: "字节 / bytes", files: "文件 / files", chunks: "数据块 / chunks", steps: "步骤 / steps"}[state.progress_unit] || "";
  text.textContent = state.message || "等待任务 / Waiting for task";
  if (Number.isFinite(state.current) && state.total > 0) {
    const percent = Math.max(0, Math.min(100, state.current / state.total * 100));
    stage.value = percent;
    text.textContent += ` · ${state.current}/${state.total} ${unit} (${percent.toFixed(1)}%)`;
  } else stage.removeAttribute("value");
  stage.hidden = !state.total && ["stopped", "idle", "waiting_confirmation", "prepared", "cancelled", "complete"].includes(state.stage);
  bytes.hidden = !(state.bytes_total > 0);
  byteText.textContent = "";
  if (!bytes.hidden) {
    const percent = Math.max(0, Math.min(100, state.bytes_current / state.bytes_total * 100));
    bytes.value = percent;
    byteText.textContent = `${(state.bytes_current / 1000000).toFixed(2)} / ${(state.bytes_total / 1000000).toFixed(2)} MB (${percent.toFixed(1)}%)`;
    if (state.file_size > 0) byteText.textContent += ` · 当前文件 / File: ${(state.file_bytes / 1000000).toFixed(2)} / ${(state.file_size / 1000000).toFixed(2)} MB`;
  }
}
function render(state) {
  lastState = state;
  login.hidden = state.authenticated;
  document.getElementById("controls").hidden = !state.authenticated;
  document.getElementById("dashboard").hidden = false;
  document.getElementById("event-panel").hidden = !state.authenticated;
  if (!intervalDirty && document.activeElement !== intervalInput) intervalInput.value = state.interval_seconds;
  if (!concurrencyDirty && document.activeElement !== concurrencyInput) concurrencyInput.value = state.configured_upload_concurrency;
  if (!downloadConcurrencyDirty && document.activeElement !== downloadConcurrencyInput) downloadConcurrencyInput.value = state.configured_download_concurrency;
  updateButtons();
  renderProgress(state);
  fields.replaceChildren();
  for (const [key, label] of Object.entries(labels)) {
    if (state[key] === undefined) continue;
    const term = document.createElement("dt");
    const value = document.createElement("dd");
    term.textContent = label;
    const raw = state[key];
    value.textContent = raw === null ? "—" : key.endsWith("_at") ? localTime(raw)
      : key === "task_mode" ? ({replay: "模拟任务 / Replay", automatic: "自动监听 / Automatic watch"}[raw] || String(raw))
      : memoryFields.has(key) && typeof raw === "number" ? (raw / 1000000).toFixed(2) + " MB" : String(raw);
    fields.append(term, value);
  }
  document.getElementById("events").textContent = (state.events || []).slice().reverse()
    .map(event => `${localTime(event.at)} [${event.stage}] ${event.message}`).join("\n");
  connection.textContent = (state.authenticated ? "已登录 / Signed in · " : "公开状态 / Public status · ") + localTime(new Date());
}
async function refresh() {
  try {
    const response = await fetch("/api/status", {cache: "no-store", signal: AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error("HTTP " + response.status);
    const state = await response.json();
    if (!controlBusy) render(state);
  } catch (error) {
    connection.textContent = "连接中断，显示内容可能已过期 / Disconnected; displayed data may be stale";
  }
}
login.addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const input = document.getElementById("token");
    const response = await fetch("/api/login", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({token: input.value}), signal: AbortSignal.timeout(8000)});
    input.value = "";
    if (!response.ok) throw new Error("Sign-in failed");
    await refresh();
  } catch (error) { connection.textContent = "登录失败，请稍后重试 / Sign-in failed; try again later"; }
});
intervalInput.addEventListener("input", () => { intervalDirty = true; });
concurrencyInput.addEventListener("input", () => { concurrencyDirty = true; });
downloadConcurrencyInput.addEventListener("input", () => { downloadConcurrencyDirty = true; });
async function control(action, value) {
  if (controlBusy) return;
  controlBusy = true;
  updateButtons();
  controlMessage.textContent = "正在保存 / Saving…";
  try {
    const response = await fetch("/api/watch", {method: "POST", headers: {"Content-Type": "application/json", "X-AKE-Control": "1"},
      body: JSON.stringify({action, ...(value === undefined ? {} : {[action]: value})}), signal: AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error(String(response.status));
    const state = await response.json();
    if (action === "interval") { intervalDirty = false; intervalInput.value = state.interval_seconds; }
    if (action === "concurrency") { concurrencyDirty = false; concurrencyInput.value = state.configured_upload_concurrency; }
    if (action === "download_concurrency") { downloadConcurrencyDirty = false; downloadConcurrencyInput.value = state.configured_download_concurrency; }
    render(state);
    controlMessage.textContent = state.watch_state === "stopping"
      ? "正在停止，当前网络请求结束后停止后续步骤 / Stopping after the current network request"
      : "已保存，服务重启后仍保留 / Saved and retained after service restart";
  } catch (error) {
    controlMessage.textContent = "操作未确认，请检查登录、间隔、并发范围或等待停止完成 / Not confirmed; check login, interval, concurrency or stopping state";
  } finally { controlBusy = false; updateButtons(); await refresh(); }
}
document.getElementById("start").addEventListener("click", () => control("start"));
document.getElementById("stop").addEventListener("click", () => control("stop"));
document.getElementById("interval-form").addEventListener("submit", event => {
  event.preventDefault();
  const interval = Number(intervalInput.value);
  if (Number.isInteger(interval) && interval >= 1 && interval <= 86400) control("interval", interval);
});
document.getElementById("concurrency-form").addEventListener("submit", event => {
  event.preventDefault();
  const concurrency = Number(concurrencyInput.value);
  if (Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 64) control("concurrency", concurrency);
});
document.getElementById("download-concurrency-form").addEventListener("submit", event => {
  event.preventDefault();
  const concurrency = Number(downloadConcurrencyInput.value);
  if (Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 64) control("download_concurrency", concurrency);
});
async function poll() { await refresh(); setTimeout(poll, 2000); }
poll();
