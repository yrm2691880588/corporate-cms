# 企业官网 CMS —— 恢复数据库

$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  恢复数据库" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$backupDir = Join-Path $root "backup"
$dbPath = Join-Path $root "data\site.db"

if (-not (Test-Path $backupDir)) {
    Write-Host "[错误] 没有找到 backup 目录，说明还没有备份过。" -ForegroundColor Red
    Write-Host "       请先运行「备份.bat」。" -ForegroundColor Gray
    Write-Host ""
    Read-Host "按回车键退出"
    exit 1
}

$files = Get-ChildItem -Path $backupDir -Filter "site_*.db" | Sort-Object LastWriteTime -Descending

if ($files.Count -eq 0) {
    Write-Host "[错误] backup 目录里没有备份文件。" -ForegroundColor Red
    Write-Host ""
    Read-Host "按回车键退出"
    exit 1
}

Write-Host "找到 $($files.Count) 个备份，最新的几个：" -ForegroundColor White
Write-Host ""
for ($i = 0; $i -lt [Math]::Min(5, $files.Count); $i++) {
    $f = $files[$i]
    $sizeKB = [Math]::Round($f.Length / 1KB, 0)
    Write-Host ("  [{0}] {1}  ({2} KB)" -f ($i + 1), $f.Name, $sizeKB)
}
Write-Host ""

$choice = Read-Host "输入要恢复的编号（直接回车选最新那个，输入 0 取消）"

if ($choice -eq "0") {
    Write-Host "已取消。" -ForegroundColor Gray
    Write-Host ""
    Read-Host "按回车键退出"
    exit 0
}

$index = 1
if ($choice -ne "") {
    $parsed = 0
    if ([int]::TryParse($choice, [ref]$parsed) -and $parsed -ge 1 -and $parsed -le $files.Count) {
        $index = $parsed
    } else {
        Write-Host "[错误] 编号无效。" -ForegroundColor Red
        Read-Host "按回车键退出"
        exit 1
    }
}

$source = $files[$index - 1]

Write-Host ""
Write-Host "即将用这个备份覆盖当前数据库：" -ForegroundColor Yellow
Write-Host "  $($source.Name)" -ForegroundColor White
Write-Host ""
Write-Host "⚠️ 当前数据库里的所有内容、留言、账号都会被替换掉。" -ForegroundColor Red
Write-Host "⚠️ 这个操作不可撤销。如果你不确定，请先按 Ctrl+C 退出并重新备份。" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "确认恢复请输入 YES"

if ($confirm -ne "YES") {
    Write-Host ""
    Write-Host "已取消，什么都没有改动。" -ForegroundColor Gray
    Write-Host ""
    Read-Host "按回车键退出"
    exit 0
}

# 1. 先确认网站已停止，否则文件被占用会恢复失败
$conns = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    Write-Host ""
    Write-Host "[错误] 网站还在运行，无法安全恢复。" -ForegroundColor Red
    Write-Host "       请先双击「停止.bat」，然后重新运行本脚本。" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按回车键退出"
    exit 1
}

# 2. 把当前数据库先挪走（万一恢复错了还能找回）
if (Test-Path $dbPath) {
    $safety = Join-Path $backupDir ("before_restore_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".db")
    Copy-Item $dbPath $safety -Force
    Write-Host "已把当前数据库另存为：$([System.IO.Path]::GetFileName($safety))" -ForegroundColor Gray
}

# 3. 删掉 WAL 附属文件：否则旧数据会通过 WAL 回来，导致只见旧内容
foreach ($suffix in @("-wal", "-shm")) {
    $p = "$dbPath$suffix"
    if (Test-Path $p) {
        Remove-Item $p -Force
    }
}

# 4. 覆盖数据库
Copy-Item $source.FullName $dbPath -Force

# 5. 恢复图片目录
#    备份脚本会把 data\uploads 一起存成 backup\uploads_<时间戳>，
#    这里必须同步还原，否则数据库里的图片路径全都指向不存在的文件，文章配图会成片断图。
$stampOfSource = $source.BaseName -replace "^site_", ""
$uploadsBackup = Join-Path $backupDir "uploads_$stampOfSource"
$imgRestored = 0
$hasImages = Test-Path $uploadsBackup

if ($hasImages) {
    if (Test-Path $uploadsDir) {
        Remove-Item $uploadsDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null
    Copy-Item "$uploadsBackup\*" $uploadsDir -Recurse -Force
    $imgRestored = (Get-ChildItem $uploadsDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
}

$sizeKB = [Math]::Round((Get-Item $dbPath).Length / 1KB, 0)

Write-Host ""
Write-Host "恢复成功" -ForegroundColor Green
Write-Host "  数据库：$($source.Name)（$sizeKB KB）" -ForegroundColor White
if ($imgRestored -gt 0) {
    Write-Host "  图片：  已还原 $imgRestored 个文件" -ForegroundColor White
} else {
    Write-Host "  图片：  该备份不含图片目录，文章配图可能显示不出来" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "下一步：双击「启动.bat」重新打开网站。" -ForegroundColor Cyan
Write-Host ""

Read-Host "按回车键退出"
