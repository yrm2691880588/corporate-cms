# 企业官网内容管理系统 —— 启动脚本
# 说明：本文件承载所有中文提示，由同目录的 .bat 调用。
#       内容为 UTF-8 带 BOM，PowerShell 5.1 与 7 都能正确显示。

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# 控制台编码统一为 UTF-8，避免中文变成乱码方块
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
    # 某些受限终端不允许改编码，忽略即可
}


function Write-Title($text) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Fail($msg) {
    Write-Host ""
    Write-Host "[错误] $msg" -ForegroundColor Red
    Write-Host ""
    Read-Host "按回车键退出"
    exit 1
}

Write-Title "企业官网内容管理系统"

# ── 1. 检查 Node.js ──
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Fail "没有找到 Node.js。请先安装 Node.js 20 或更高版本：https://nodejs.org/"
}
$nodeVer = (& node -v).Trim()
Write-Host "[1/4] Node.js 版本：$nodeVer" -ForegroundColor Green

# ── 2. 检查依赖 ──
if (-not (Test-Path "node_modules")) {
    Write-Host "[2/4] 首次运行，正在安装依赖（约 2-5 分钟，只需一次）..." -ForegroundColor Yellow
    & npm install --no-audit --no-fund --cache ".npm-cache"
    if ($LASTEXITCODE -ne 0) { Fail "依赖安装失败，请检查网络连接。" }
} else {
    Write-Host "[2/4] 依赖已就绪" -ForegroundColor Green
}

# ── 3. 初始化数据库 ──
if (-not (Test-Path "data\site.db")) {
    Write-Host "[3/4] 首次运行，正在初始化数据库与示例内容..." -ForegroundColor Yellow
    & npx tsx scripts/seed.ts
    if ($LASTEXITCODE -ne 0) { Fail "数据库初始化失败。" }
} else {
    Write-Host "[3/4] 数据库已存在，跳过初始化" -ForegroundColor Green
}

# ── 4. 构建 ──
if (-not (Test-Path ".next\BUILD_ID")) {
    Write-Host "[4/4] 首次运行，正在构建（约 1-2 分钟）..." -ForegroundColor Yellow
    & node node_modules\next\dist\bin\next build
    if ($LASTEXITCODE -ne 0) { Fail "构建失败。" }
} else {
    Write-Host "[4/4] 构建产物已存在" -ForegroundColor Green
}

# ── 检查端口是否被占用 ──
$inUse = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($inUse) {
    Write-Host ""
    Write-Host "[提示] 3000 端口已被占用，网站可能已经在运行。" -ForegroundColor Yellow
    Write-Host "       如需重启，请先双击「停止.bat」。" -ForegroundColor Yellow
    Write-Host ""
    Start-Process "http://localhost:3000"
    Read-Host "按回车键退出"
    exit 0
}

Write-Title "启动成功"
# ── 检测局域网地址，方便手机/其他电脑访问 ──
$lanIps = @()
try {
    # 只取真实物理网卡：排除虚拟网卡（VPN、虚拟机、Hyper-V 等）
    # 否则会列出 Radmin VPN、vEthernet 之类手机上根本连不通的地址
    $virtualKeywords = 'VPN|Virtual|vEthernet|Hyper-V|VMware|VirtualBox|Loopback|TAP|TUN|Radmin'
    $lanIps = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPv4DefaultGateway -ne $null -and
            $_.IPv4Address.IPAddress -notlike '127.*' -and
            $_.InterfaceAlias -notmatch $virtualKeywords
        } |
        ForEach-Object { $_.IPv4Address.IPAddress }
} catch {
    # 老系统或受限环境拿不到，跳过
}

Write-Host "  官网首页：  http://localhost:3000" -ForegroundColor White
if ($lanIps.Count -gt 0) {
    Write-Host "  手机访问：  （手机需连同一个 WiFi）" -ForegroundColor DarkGray
    foreach ($ip in $lanIps) {
        Write-Host "              http://${ip}:3000" -ForegroundColor Cyan
    }
}
Write-Host "  管理后台：  http://localhost:3000/admin/login" -ForegroundColor White
Write-Host ""
Write-Host "  默认管理员：admin / admin12345" -ForegroundColor Gray
Write-Host "  （首次登录后请立即修改密码）" -ForegroundColor Gray
Write-Host ""
# ── 显示自动备份状态 ──
# 读取 .env 里的 AUTO_BACKUP，让你一眼看到当前是开还是关
$autoBackup = $false
if (Test-Path ".env") {
    $envLine = Select-String -Path ".env" -Pattern "^\s*AUTO_BACKUP\s*=" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($envLine -and $envLine.Line -match "=\s*(1|true|yes)") { $autoBackup = $true }
}

if ($autoBackup) {
    Write-Host "  自动备份：  已开启（每天一份，保留 14 天）" -ForegroundColor Green
} else {
    Write-Host "  自动备份：  已关闭" -ForegroundColor DarkGray
    Write-Host "              需要时手动双击「备份.bat」，" -ForegroundColor DarkGray
    Write-Host "              或在 .env 里设置 AUTO_BACKUP=1 后重启" -ForegroundColor DarkGray
}
Write-Host ""

Write-Host "  注意：这个窗口不要关，关了网站就停了" -ForegroundColor Yellow
Write-Host "  关闭网站：按 Ctrl+C，或直接关掉这个窗口" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Start-Process "http://localhost:3000"
& node node_modules\next\dist\bin\next start -p 3000
