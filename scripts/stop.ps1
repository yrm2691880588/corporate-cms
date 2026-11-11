# 企业官网 CMS —— 停止脚本

$ErrorActionPreference = "SilentlyContinue"

# 控制台编码统一为 UTF-8，避免中文变成乱码方块
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
    # 某些受限终端不允许改编码，忽略即可
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  停止示例科技 官网服务" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$conns = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

if (-not $conns) {
    Write-Host "3000 端口没有正在运行的服务，无需停止。" -ForegroundColor Gray
} else {
    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $pids) {
        $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
        $name = if ($proc) { $proc.ProcessName } else { "未知" }
        Write-Host "正在停止 PID=$p ($name) ..." -ForegroundColor Yellow
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
    $still = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    if ($still) {
        Write-Host "部分进程未能停止，请手动在任务管理器结束 node.exe" -ForegroundColor Red
    } else {
        Write-Host ""
        Write-Host "已停止，3000 端口已释放。" -ForegroundColor Green
    }
}

Write-Host ""
Read-Host "按回车键退出"
