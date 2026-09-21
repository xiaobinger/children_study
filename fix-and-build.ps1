# ============================================================
#  儿童学习乐园 - 一键修复 + 自适应 + 打包 APK
#  覆盖：6 个打包报错修复 / 屏幕自适应 / 资源同步 / Gradle 构建
#  可重复执行（幂等），跑完 APK 会复制到网页项目根目录
# ============================================================
$ErrorActionPreference = 'Stop'
$P   = 'E:\new_workspace\children_study_android'    # Android 项目
$SRC = 'E:\new_workspace\children_study'            # 网页源项目
$JDK = 'C:\Users\admin\.jdks\jbr-17.0.14'           # Gradle 用 JDK17
$GRADLE_BAT = Join-Path $P '.gradle\8.0\wrapper\dists\gradle-8.0-bin\ca5e32bp14vu59qr306oxotwh\gradle-8.0\bin\gradle.bat'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Step($n, $msg) { Write-Host ("`n[{0}/7] {1}" -f $n, $msg) -ForegroundColor Cyan }

# ---------- 0. 环境检查 ----------
if (-not (Test-Path $P))   { throw "找不到 Android 项目: $P" }
if (-not (Test-Path "$JDK\bin\java.exe")) { throw "找不到 JDK17: $JDK (在 Android Studio 的 SDK Manager 里装 jbr-17)" }
if (-not (Test-Path $GRADLE_BAT)) { throw "找不到 Gradle: $GRADLE_BAT" }
Write-Host "环境检查通过" -ForegroundColor Green

# ---------- 1. 补 gradle.properties（缺它 AndroidX 检查必失败）----------
# 注意：低内存机器用 1024m + SerialGC，别用 2048m（会因页面文件不足崩守护进程）
Step 1 '补 gradle.properties (AndroidX + 低内存配置)'
Set-Content -Path "$P\gradle.properties" -Encoding ASCII -Value @(
    'org.gradle.jvmargs=-Xmx1024m -XX:MaxMetaspaceSize=384m -XX:+UseSerialGC -Dfile.encoding=UTF-8',
    'android.useAndroidX=true',
    'org.gradle.vfs.watch=false'
)

# ---------- 2. 修复 styles.xml（@android:Theme.Leanback 在 API34 不存在）----------
Step 2 '修复 styles.xml (TV 主题改为 androidx 库主题)'
[System.IO.File]::WriteAllText("$P\app\src\main\res\values\styles.xml", @'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="@android:Theme.NoTitleBar.Fullscreen">
        <item name="android:windowBackground">@android:color/black</item>
        <item name="android:windowNoTitle">true</item>
        <item name="android:windowFullscreen">true</item>
    </style>

    <style name="TvTheme" parent="@style/Theme.Leanback">
        <item name="android:windowBackground">@android:color/black</item>
    </style>
</resources>
'@, $utf8)

# ---------- 3. 修复图标（adaptive-icon 要求 API26，minSdk 21 需 PNG 回退）----------
Step 3 '修复应用图标 (adaptive-icon + 各密度 PNG)'
$res = "$P\app\src\main\res"

# 3a. background 误写成了 adaptive-icon（图标递归引用自己），改回纯色 shape
[System.IO.File]::WriteAllText("$res\drawable\ic_launcher_background.xml", @'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="#4a90d9"/>
</shape>
'@, $utf8)

# 3b. adaptive-icon 挪到 anydpi-v26（API26+ 才能用）
$anydpi = "$res\mipmap-anydpi-v26"
New-Item $anydpi -ItemType Directory -Force | Out-Null
[System.IO.File]::WriteAllText("$anydpi\ic_launcher.xml", @'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
'@, $utf8)

# 3c. API21-25 的 PNG 回退图标
Add-Type -AssemblyName System.Drawing
foreach ($kv in @{ mdpi=48; hdpi=72; xhdpi=96; xxhdpi=144; xxxhdpi=192 }.GetEnumerator()) {
    $dir = "$res\mipmap-$($kv.Key)"
    New-Item $dir -ItemType Directory -Force | Out-Null
    Remove-Item "$dir\ic_launcher.xml" -Force -ErrorAction SilentlyContinue
    $bmp = New-Object System.Drawing.Bitmap($kv.Value, $kv.Value)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::FromArgb(255, 74, 144, 217))
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 184, 77))
    $r = [int]($kv.Value * 0.22)
    $g.FillEllipse($brush, ($kv.Value/2 - $r), ($kv.Value/2 - $r), ($r*2), ($r*2))
    $brush.Dispose(); $g.Dispose()
    $bmp.Save("$dir\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# ---------- 4. Manifest：TV 主题改名 + 支持分屏/折叠屏 + 允许 http 明文流量 ----------
Step 4 'AndroidManifest.xml (TV 主题 + resizeableActivity + 明文HTTP)'
$m = "$P\app\src\main\AndroidManifest.xml"
$xml = [System.IO.File]::ReadAllText($m)
$xml = $xml.Replace('android:theme="@style/Theme.Leanback"', 'android:theme="@style/TvTheme"')
if ($xml -notmatch 'resizeableActivity') {
    $xml = $xml.Replace('android:allowBackup="true"', 'android:allowBackup="true" android:resizeableActivity="true"')
}
# 小爱音箱桥接走 http://局域网IP:8899，Android 9+ 默认禁止明文 HTTP，必须显式放开
if ($xml -notmatch 'usesCleartextTraffic') {
    $xml = $xml.Replace('android:allowBackup="true"', 'android:allowBackup="true" android:usesCleartextTraffic="true"')
}
[System.IO.File]::WriteAllText($m, $xml, $utf8)

# ---------- 5. MainActivity：去掉强制横屏（手机竖屏自适应，TV 恒横屏不受影响）----------
Step 5 'MainActivity.java (去掉强制横屏)'
$f = "$P\app\src\main\java\com\children\study\MainActivity.java"
$lines = [System.IO.File]::ReadAllLines($f) | Where-Object {
    $_ -notmatch 'SENSOR_LANDSCAPE' -and
    $_ -notmatch '横屏更适合电视' -and
    $_ -notmatch 'import android\.content\.pm\.ActivityInfo;'
}
[System.IO.File]::WriteAllLines($f, $lines, $utf8)

# ---------- 5b. WebView 允许 file:// 页面跨域访问 AI 接口（否则 APK 内 AI 对话被 CORS 拦截）----------
Step '5b' 'WebView 跨域权限 (AI 对话需要)'
foreach ($java in @("$P\app\src\main\java\com\children\study\MainActivity.java",
                   "$P\app\src\main\java\com\children\study\TvActivity.java")) {
    $javaContent = [System.IO.File]::ReadAllText($java)
    if ($javaContent -notmatch 'setAllowUniversalAccessFromFileURLs') {
        $javaContent = $javaContent.Replace('settings.setJavaScriptEnabled(true);',
            'settings.setJavaScriptEnabled(true);' + [Environment]::NewLine +
            '        settings.setAllowUniversalAccessFromFileURLs(true); // AI 接口跨域访问')
        [System.IO.File]::WriteAllText($java, $javaContent, $utf8)
    }
}

# ---------- 5c. Java 文件去 BOM（javac 不认 \ufeff 头，会报"非法字符"）----------
Step '5c' 'Java 文件去 BOM (防编译报错)'
Get-ChildItem "$P\app\src\main\java" -Recurse -Filter *.java | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        [System.IO.File]::WriteAllBytes($_.FullName, $bytes[3..($bytes.Length-1)])
        Write-Host ("  已去除 BOM: " + $_.Name) -ForegroundColor Yellow
    }
}

# ---------- 5d. WebView 防跳转补丁（外部链接交系统浏览器，动画内嵌播放不被劫持） ----------
Step '5d' 'WebView 防跳转补丁 (MainActivity/TvActivity)'
$patchDir = "$SRC\tools\android-patch"
if (Test-Path "$patchDir\MainActivity.java") {
    [System.IO.File]::WriteAllText("$P\app\src\main\java\com\children\study\MainActivity.java",
        [System.IO.File]::ReadAllText("$patchDir\MainActivity.java"), $utf8)
    Write-Host "  已更新 MainActivity.java（外部链接→系统浏览器）" -ForegroundColor Yellow
}
if (Test-Path "$patchDir\TvActivity.java") {
    [System.IO.File]::WriteAllText("$P\app\src\main\java\com\children\study\TvActivity.java",
        [System.IO.File]::ReadAllText("$patchDir\TvActivity.java"), $utf8)
    Write-Host "  已更新 TvActivity.java（外部链接→系统浏览器）" -ForegroundColor Yellow
}

# ---------- 6. 同步网页资源（含本次自适应样式）----------
Step 6 '同步网页资源到 assets/www'
$DST = "$P\app\src\main\assets\www"
New-Item $DST -ItemType Directory -Force | Out-Null
# 用 PowerShell Copy-Item 替代 xcopy（cmd /c 在部分环境被阻止，且 >nul 会吞掉错误）
Copy-Item -Path "$SRC\css" -Destination "$DST\" -Recurse -Force -ErrorAction Stop
Copy-Item -Path "$SRC\js"  -Destination "$DST\" -Recurse -Force -ErrorAction Stop
Copy-Item -Path "$SRC\index.html" -Destination "$DST\" -Force -ErrorAction Stop
Write-Host "  已同步 css/ js/ index.html" -ForegroundColor Yellow
# 预生成配音（Edge TTS mp3，若存在则一并打进 APK）
if (Test-Path "$SRC\audio") {
    Copy-Item -Path "$SRC\audio" -Destination "$DST\" -Recurse -Force -ErrorAction Stop
    $audioCount = (Get-ChildItem "$DST\audio" -Recurse -File -Filter *.mp3).Count
    Write-Host "  已打包配音: $audioCount 个 mp3" -ForegroundColor Yellow
}
$total = (Get-ChildItem $DST -Recurse -File).Count
Write-Host "  共 $total 个文件已同步到 assets/www" -ForegroundColor Yellow
if ($total -lt 10) { throw "同步后文件数过少($total)，可能是复制失败，请检查上方报错" }

# ---------- 7. 构建 APK ----------
Step 7 'Gradle 构建 APK (JDK17)'
$env:JAVA_HOME = $JDK
$env:GRADLE_USER_HOME = 'C:\Users\admin\.gradle'

# 7a. 停掉所有残留 Gradle 守护进程（低内存机器上旧守护进程会占着内存不放）
& $GRADLE_BAT --stop 2>$null | Out-Null
$env:GRADLE_USER_HOME = "$P\.gradle\8.0"
& $GRADLE_BAT --stop 2>$null | Out-Null
$env:GRADLE_USER_HOME = 'C:\Users\admin\.gradle'

# 7b. 内存检查：虚拟内存 < 2GB 时守护进程大概率起不来，提醒先关程序
$os = Get-CimInstance Win32_OperatingSystem
$freeGB = [math]::Round($os.FreeVirtualMemory / 1MB, 1)
Write-Host ("当前虚拟内存可用: {0} GB" -f $freeGB)
if ($freeGB -lt 2) {
    Write-Host "⚠ 虚拟内存不足! 请先关闭占内存的程序(浏览器/多个终端窗口/Postman/Navicat等)后按回车重试" -ForegroundColor Yellow
    Read-Host '关好后按回车继续'
    $os = Get-CimInstance Win32_OperatingSystem
    $freeGB = [math]::Round($os.FreeVirtualMemory / 1MB, 1)
    if ($freeGB -lt 1.5) { throw "内存仍然不足(可用 ${freeGB}GB)，请重启电脑后再运行本脚本" }
}

& $GRADLE_BAT -p $P --console=plain assembleDebug
if ($LASTEXITCODE -ne 0) { throw "构建失败: 把上方报错贴给 AI 助手即可" }

# ---------- 完成 ----------
$apk = Get-ChildItem "$P\app\build\outputs\apk\debug\*.apk" -ErrorAction SilentlyContinue |
    Where-Object { $_ -is [System.IO.FileInfo] } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($apk) {
    try {
        Copy-Item -LiteralPath $apk.FullName -Destination $SRC -Force
        Write-Host "`n============================================" -ForegroundColor Green
        Write-Host "  打包成功!" -ForegroundColor Green
        Write-Host ("  APK: " + $apk.FullName) -ForegroundColor Yellow
        Write-Host ("  副本: $SRC\" + $apk.Name) -ForegroundColor Yellow
        Write-Host "  大小: {0:N1} MB" -ForegroundColor Yellow -f ($apk.Length/1MB)
        Write-Host "============================================" -ForegroundColor Green
    } catch {
        Write-Host "⚠ APK 已生成但复制失败，请手动复制:" -ForegroundColor Yellow
        Write-Host ("  " + $apk.FullName) -ForegroundColor Yellow
    }
}
