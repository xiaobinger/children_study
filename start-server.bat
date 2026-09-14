@echo off
chcp 65001 >nul
echo.
echo 🎈 正在启动儿童益智学习乐园...
echo.
where python >nul 2>nul
if %errorlevel% == 0 (
    echo ✓ 使用 Python 启动服务器
    echo ✓ 请在浏览器打开: http://localhost:8080
    echo ✓ 按 Ctrl+C 停止服务器
    echo.
    python -m http.server 8080
) else (
    echo ✗ 未检测到 Python，请安装 Python 或手动启动服务器
    echo.
    echo 方法1: 安装 Python 后重新运行此脚本
    echo 方法2: 命令行运行  npx serve .
    echo 方法3: 用 VS Code 的 Live Server 插件
    pause
)
