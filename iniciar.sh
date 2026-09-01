#!/usr/bin/env bash
# Script de Inicialização para Linux - Emulador Crédito Trabalhador
set -e

# Cores para o terminal
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Se o node estiver em ~/.local/bin, garante que esteja no PATH
if [ -d "$HOME/.local/bin" ] && [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    export PATH="$HOME/.local/bin:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}[ERRO] Node.js não foi encontrado no sistema.${NC}"
    echo "Por favor, execute o instalador primeiro: ./install.sh"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[AVISO] Dependências não encontradas. Executando npm install...${NC}"
    npm install
fi

echo -e "${CYAN}=================================================================${NC}"
echo -e "${GREEN}  🚀 Emulador de Crédito ao Trabalhador - Iniciando...           ${NC}"
echo -e "${CYAN}=================================================================${NC}"
echo -e "Acesse a interface no navegador: ${YELLOW}http://localhost:3019${NC}"
echo "Pressione CTRL+C para encerrar o servidor."
echo ""

# Abre o navegador em background caso haja ambiente grafico
if command -v xdg-open >/dev/null 2>&1 && [ -n "$DISPLAY" ]; then
    (sleep 1.2 && xdg-open "http://localhost:3019" >/dev/null 2>&1) &
fi

npm start
