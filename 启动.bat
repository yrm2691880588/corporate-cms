@echo off
rem ============================================================
rem  Corporate CMS - Launcher
rem  All Chinese messages live in scripts\start.ps1 so that the
rem  codepage of cmd.exe cannot corrupt them.
rem  Prefers PowerShell 7 (pwsh), falls back to Windows PowerShell.
rem ============================================================
cd /d "%~dp0"

where pwsh >nul 2>nul
if %errorlevel%==0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"
    goto :eof
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"
