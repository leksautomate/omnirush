@echo off
setlocal enableextensions enabledelayedexpansion
cd /d "%~dp0"

title Kakkao Live / VidRush Live

echo ===================================================
echo     Kakkao Live / VidRush Live Launcher
echo ===================================================
echo.

:: Check for app-live directory
if not exist "app-live" (
    echo [ERROR] app-live directory not found!
    echo Please run this batch file from the project root directory.
    echo.
    pause
    exit /b 1
)

:: Check for .env.local file
if not exist "app-live\.env.local" (
    if exist "app-live\.env.local.example" (
        echo [WARNING] app-live\.env.local was not found.
        echo Found app-live\.env.local.example - you may want to copy it to .env.local.
        echo.
    ) else (
        echo [WARNING] app-live\.env.local not found. Make sure your environment variables are configured.
        echo.
    )
)

echo Launching Kakkao Live development server...
echo App will be available at: http://localhost:3000
echo.
echo Press Ctrl+C in this window to stop the server.
echo ---------------------------------------------------
echo.

cd app-live
npm run dev

if errorlevel 1 (
    echo.
    echo [ERROR] Server exited with error code %errorlevel%.
    pause
)
