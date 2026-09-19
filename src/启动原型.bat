@echo off
chcp 65001 >nul
title AI 虚拟试衣大屏 · 本地原型服务
cd /d "%~dp0"
echo.
echo   正在启动本地服务（摄像头需要 localhost 才能打开）
echo   启动后浏览器会自动打开 http://localhost:5173/
echo   关闭这个黑窗口即可停止服务。
echo.
start "" http://localhost:5173/
node "%~dp0src\serve.js" 5173 "%~dp0."
pause
