@echo off
chcp 65001 >nul
echo.
echo  ==============================================
echo    儿童学习乐园 - 一键修复 + 自适应 + 打包 APK
echo    (可重复执行, 修复6个打包错误 / 屏幕自适应 / 同步资源 / 构建)
echo  ==============================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-and-build.ps1"
echo.
pause
