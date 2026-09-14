@echo off
chcp 65001 >nul
title 🎈 儿童益智学习乐园
echo.
echo =======================================
echo    🎈 儿童益智学习乐园
echo =======================================
echo.
where python >nul 2>nul
if %errorlevel% == 0 (
    echo ✓ 正在启动本地服务器...
    echo ✓ 浏览器即将自动打开 http://localhost:8080
    echo ✓ 关掉这个窗口即可停止服务器
    echo.
    start "" http://localhost:8080
    python -m http.server 8080
) else (
    echo ✗ 未检测到 Python
    echo.
    echo 请安装 Python: https://www.python.org/downloads/
    echo 安装时勾选 "Add Python to PATH"
    echo.
    pause
)
