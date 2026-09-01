@echo off
setlocal
chcp 65001 >nul 2>&1
title Emulador Credito ao Trabalhador
cd /d "%~dp0"

echo ================================================================
echo   Iniciando Emulador de Credito ao Trabalhador
echo ================================================================
echo.

:: Verifica se o Node esta instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js nao foi encontrado no sistema.
    echo Por favor, execute primeiro o instalador: install.bat
    echo.
    pause
    exit /b 1
)

:: Verifica se node_modules existe
if not exist "node_modules\" (
    echo [AVISO] Dependencias nao encontradas. Instalando agora...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRO] Falha ao instalar dependencias.
        pause
        exit /b 1
    )
)

echo [OK] Servidor iniciando...
echo Acesse no navegador: http://localhost:3019
echo Pressione CTRL+C para encerrar o servidor.
echo.

:: Abre o navegador padrao apos 1 segundo
start "" http://localhost:3019

:: Inicia a aplicacao Node
npm start
