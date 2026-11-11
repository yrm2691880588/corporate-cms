@echo off
rem ============================================================
rem  Corporate CMS - Stop
rem  Chinese messages live in scripts\stop.ps1
rem ============================================================
cd /d "%~dp0"

where pwsh >nul 2>nul
if %errorlevel%==0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1"
    goto :eof
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1"
