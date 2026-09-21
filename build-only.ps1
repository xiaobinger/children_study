# 精简构建脚本：只做 Gradle 构建 + 复制 APK（修复步骤已全部应用过）
$ErrorActionPreference = 'Stop'
$P   = 'E:\new_workspace\children_study\android_build'
$SRC = 'E:\new_workspace\children_study'
$JDK = 'C:\Users\admin\.jdks\jbr-17.0.14'
$GRADLE_BAT = Join-Path $P '.gradle\8.0\wrapper\dists\gradle-8.0-bin\ca5e32bp14vu59qr306oxotwh\gradle-8.0\bin\gradle.bat'

if (-not (Test-Path $GRADLE_BAT)) { throw "Gradle not found: $GRADLE_BAT" }
Write-Host "Gradle found, starting build..." -ForegroundColor Green

$env:JAVA_HOME = $JDK
$env:GRADLE_USER_HOME = 'C:\Users\admin\.gradle'

# 停掉残留守护进程
& $GRADLE_BAT --stop 2>$null | Out-Null

# 构建
Write-Host "`n[Building APK...]" -ForegroundColor Cyan
& $GRADLE_BAT -p $P --console=plain assembleDebug
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

# 复制 APK
$apk = Get-ChildItem "$P\app\build\outputs\apk\debug\*.apk" -ErrorAction SilentlyContinue |
    Where-Object { $_ -is [System.IO.FileInfo] } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($apk) {
    Copy-Item -LiteralPath $apk.FullName -Destination $SRC -Force
    Write-Host "`n============================================" -ForegroundColor Green
    Write-Host "  BUILD SUCCESS!" -ForegroundColor Green
    Write-Host ("  APK: " + $apk.FullName) -ForegroundColor Yellow
    Write-Host ("  Copy: $SRC\" + $apk.Name) -ForegroundColor Yellow
    Write-Host ("  Size: {0:N1} MB" -f ($apk.Length/1MB)) -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Green
} else {
    throw "APK not found in output directory"
}
