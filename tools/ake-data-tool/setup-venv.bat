@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" python -m venv .venv
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
    echo 安装失败。
    pause
    exit /b 1
)
echo 环境安装完成，可以运行 run-gui.bat。
pause
