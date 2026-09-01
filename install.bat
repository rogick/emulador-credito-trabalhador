@echo off
setlocal
chcp 65001 >nul 2>&1
title Instalador - Emulador Credito Trabalhador

echo ================================================================
echo   Iniciando Instalador - Emulador Credito ao Trabalhador
echo ================================================================
echo.

:: Verifica se o PowerShell esta disponivel
where powershell >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] PowerShell nao foi encontrado no sistema.
    echo Por favor, instale o Node.js manualmente em https://nodejs.org/
    pause
    exit /b 1
)

:: Executa o script PowerShell ignorando politica de execucao restritiva
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] Ocorreu uma interrupcao ou erro no instalador.
    pause
)
