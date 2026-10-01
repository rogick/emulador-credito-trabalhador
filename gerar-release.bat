@echo off
setlocal
chcp 65001 >nul 2>&1
title Gerador de Releases - Emulador Credito Trabalhador
cd /d "%~dp0"

echo ================================================================
echo   Gerador de Releases com Instalador
echo ================================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js nao foi encontrado no sistema.
    pause
    exit /b 1
)

node scripts\generate-release.js %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha ao gerar release.
    pause
    exit /b 1
)

echo.
pause
