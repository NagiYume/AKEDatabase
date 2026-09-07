@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m ake_tool.cli gui
) else (
    python -m ake_tool.cli gui
)
if errorlevel 1 pause
