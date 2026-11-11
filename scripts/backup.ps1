# 企业官网 CMS —— 备份脚本

$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  备份数据库" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$dbPath = Join-Path $root "data\site.db"

if (-not (Test-Path $dbPath)) {
    Write-Host "[错误] 没有找到数据库文件 data\site.db" -ForegroundColor Red
    Write-Host "       请先运行「启动.bat」初始化数据库。" -ForegroundColor Gray
    Write-Host ""
    Read-Host "按回车键退出"
    exit 1
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $root "backup"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$target = Join-Path $backupDir "site_$stamp.db"

Write-Host "正在备份..." -ForegroundColor Yellow

# WAL 模式下直接复制可能丢数据，先让 SQLite 合并到主文件
try {
    $nodeScript = @"
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/site.db');
db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
db.close();
"@
    $tmpScript = Join-Path $env:TEMP "rm_checkpoint.js"
    Set-Content -Path $tmpScript -Value $nodeScript -Encoding UTF8
    & node $tmpScript 2>$null | Out-Null
    Remove-Item $tmpScript -ErrorAction SilentlyContinue
} catch {
    Write-Host "[提示] WAL 合并跳过，继续直接复制。" -ForegroundColor Gray
}

Copy-Item $dbPath $target -Force

# 图片目录也一起备份，否则恢复后文章配图会丢失
$uploadsDir = Join-Path $root "data\uploads"
$uploadsBackup = Join-Path $backupDir "uploads_$stamp"
$imgCount = 0
if (Test-Path $uploadsDir) {
    $imgCount = (Get-ChildItem $uploadsDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
    if ($imgCount -gt 0) {
        New-Item -ItemType Directory -Path $uploadsBackup -Force | Out-Null
        Copy-Item "$uploadsDir\*" $uploadsBackup -Recurse -Force
    }
}

$sizeKB = [Math]::Round((Get-Item $target).Length / 1KB, 0)

Write-Host ""
Write-Host "备份成功" -ForegroundColor Green
Write-Host "  数据库：backup\site_$stamp.db（$sizeKB KB）" -ForegroundColor White
if ($imgCount -gt 0) {
    Write-Host "  图片：  backup\uploads_$stamp（$imgCount 个文件）" -ForegroundColor White
}
Write-Host ""
Write-Host "  恢复方法：双击「恢复.bat」按提示操作。" -ForegroundColor Gray
Write-Host ""

Read-Host "按回车键退出"
