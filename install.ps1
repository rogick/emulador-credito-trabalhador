# Script de Instalação para Windows - Emulador Crédito Trabalhador
# Configuração de encoding UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

function Show-Header {
    Clear-Host
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host "       EMULADOR DE CRÉDITO AO TRABALHADOR - INSTALADOR           " -ForegroundColor Yellow
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Get-NodeVersion {
    try {
        $v = (node -v 2>$null)
        if ($v -match "^v(\d+)\.") {
            return [int]$matches[1]
        }
    } catch {}
    return 0
}

function Refresh-Path {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
    
    # Adiciona caminhos comuns do Node.js caso o registro ainda nao tenha propagado
    $nodeDefaultPaths = @(
        "$env:ProgramFiles\nodejs",
        "${env:ProgramFiles(x86)}\nodejs",
        "$env:APPDATA\npm"
    )
    foreach ($p in $nodeDefaultPaths) {
        if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
            $env:Path = "$p;$env:Path"
        }
    }
}

Show-Header

Write-Host "[1/3] Verificando ambiente Node.js..." -ForegroundColor Cyan

Refresh-Path
$nodeMajor = Get-NodeVersion

if ($nodeMajor -ge 18) {
    $nodeVer = (node -v)
    Write-Host "  ✓ Node.js detectado: $nodeVer (Versão compatível)" -ForegroundColor Green
} else {
    if ($nodeMajor -gt 0) {
        Write-Host "  ⚠ Versão do Node.js detectada ($((node -v))) é inferior à recomendada (v18+)." -ForegroundColor Yellow
    } else {
        Write-Host "  ✗ Node.js não foi encontrado no seu computador." -ForegroundColor Yellow
    }

    Write-Host ""
    $prompt = Read-Host "Deseja baixar e instalar o Node.js LTS (v20.x) automaticamente? (S/N) [Padrão: S]"
    if ([string]::IsNullOrWhiteSpace($prompt) -or $prompt.Trim().ToUpper() -eq 'S') {
        Write-Host ""
        Write-Host "  ➜ Preparando download do Node.js LTS..." -ForegroundColor Cyan
        
        $is64Bit = [Environment]::Is64BitOperatingSystem
        $arch = if ($is64Bit) { "x64" } else { "x86" }
        $nodeVersionTag = "v20.18.0"
        $msiFileName = "node-$nodeVersionTag-$arch.msi"
        $downloadUrl = "https://nodejs.org/dist/$nodeVersionTag/$msiFileName"
        $destPath = Join-Path $env:TEMP $msiFileName

        Write-Host "  ➜ Baixando $msiFileName de nodejs.org..." -ForegroundColor Gray
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $webClient = New-Object System.Net.WebClient
            $webClient.DownloadFile($downloadUrl, $destPath)
            Write-Host "  ✓ Download concluído com sucesso." -ForegroundColor Green
        } catch {
            Write-Host "  ✗ Falha ao baixar pelo método direto. Tentando Invoke-WebRequest..." -ForegroundColor Yellow
            Invoke-WebRequest -Uri $downloadUrl -OutFile $destPath -UseBasicParsing
        }

        Write-Host "  ➜ Instalando Node.js (uma janela de confirmação do Windows pode aparecer)..." -ForegroundColor Cyan
        
        # Executa a instalacao do MSI de forma passiva
        $process = Start-Process msiexec.exe -ArgumentList "/i `"$destPath`" /passive /norestart" -Wait -PassThru
        
        if ($process.ExitCode -eq 0 -or $process.ExitCode -eq 3010) {
            Write-Host "  ✓ Instalação do Node.js concluída!" -ForegroundColor Green
            Refresh-Path
        } else {
            Write-Host "  ⚠ Instalador retornou o código: $($process.ExitCode). Verificando se o Node está acessível..." -ForegroundColor Yellow
            Refresh-Path
        }

        # Remove o arquivo temporario
        if (Test-Path $destPath) {
            Remove-Item $destPath -Force -ErrorAction SilentlyContinue
        }

        $newNodeMajor = Get-NodeVersion
        if ($newNodeMajor -lt 18) {
            Write-Host ""
            Write-Host "  [ATENÇÃO] O Node.js foi instalado, mas seu terminal pode precisar ser reiniciado." -ForegroundColor Yellow
            Write-Host "  Caso o próximo passo falhe, feche esta janela e execute novamente o 'install.bat'." -ForegroundColor Yellow
            Write-Host ""
        }
    } else {
        Write-Host ""
        Write-Host "Instalação cancelada pelo usuário. Para usar este app, instale o Node.js v18+ em https://nodejs.org/" -ForegroundColor Red
        Write-Host "Pressione qualquer tecla para sair..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

Write-Host ""
Write-Host "[2/3] Instalando dependências do projeto (npm install)..." -ForegroundColor Cyan

$projectDir = $PSScriptRoot
Set-Location $projectDir

try {
    npm install
    Write-Host "  ✓ Todas as dependências foram instaladas com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Ocorreu um erro ao executar npm install: $_" -ForegroundColor Red
    Write-Host "Pressione qualquer tecla para sair..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "[3/3] Configuração concluída!" -ForegroundColor Cyan
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "   🎉 INSTALAÇÃO FINALIZADA COM SUCESSO!                         " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Para iniciar o emulador futuramente, basta dar um duplo clique em:"
Write-Host "  👉 iniciar.bat" -ForegroundColor Yellow
Write-Host ""

$startNow = Read-Host "Deseja iniciar o Emulador e abrir no navegador agora? (S/N) [Padrão: S]"
if ([string]::IsNullOrWhiteSpace($startNow) -or $startNow.Trim().ToUpper() -eq 'S') {
    Write-Host ""
    Write-Host "Iniciando o servidor..." -ForegroundColor Cyan
    Start-Process "http://localhost:3019"
    npm start
} else {
    Write-Host "Instalação finalizada. Até logo!" -ForegroundColor Gray
}
