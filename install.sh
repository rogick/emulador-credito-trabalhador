#!/usr/bin/env bash
# Script de Instalação para Linux - Emulador Crédito Trabalhador
set -e

# Cores para saída no terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

show_header() {
    clear 2>/dev/null || true
    echo -e "${CYAN}=================================================================${NC}"
    echo -e "${YELLOW}${BOLD}       EMULADOR DE CRÉDITO AO TRABALHADOR - INSTALADOR (LINUX)   ${NC}"
    echo -e "${CYAN}=================================================================${NC}"
    echo ""
}

get_node_major_version() {
    if command -v node >/dev/null 2>&1; then
        local ver
        ver=$(node -v 2>/dev/null || echo "")
        if [[ $ver =~ ^v([0-9]+)\. ]]; then
            echo "${BASH_REMATCH[1]}"
            return
        fi
    fi
    echo "0"
}

get_sudo_prefix() {
    if [ "$EUID" -ne 0 ]; then
        if command -v sudo >/dev/null 2>&1; then
            echo "sudo"
        else
            echo ""
        fi
    else
        echo ""
    fi
}

install_node_via_tarball() {
    echo -e "${CYAN}  ➜ Baixando binário oficial do Node.js LTS pré-compilado...${NC}"
    local arch
    arch=$(uname -m)
    local node_arch="x64"
    if [ "$arch" = "aarch64" ] || [ "$arch" = "arm64" ]; then
        node_arch="arm64"
    elif [ "$arch" = "armv7l" ]; then
        node_arch="armv7l"
    fi

    local node_ver="v20.18.0"
    local tar_name="node-${node_ver}-linux-${node_arch}.tar.xz"
    local download_url="https://nodejs.org/dist/${node_ver}/${tar_name}"
    local temp_tar="/tmp/${tar_name}"
    local install_dir="$HOME/.local"

    echo -e "${BLUE}  ➜ Baixando: ${download_url}${NC}"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$download_url" -o "$temp_tar"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO "$temp_tar" "$download_url"
    else
        echo -e "${RED}  ✗ Erro: curl ou wget não encontrados para baixar o arquivo.${NC}"
        return 1
    fi

    echo -e "${CYAN}  ➜ Extraindo para ${install_dir}...${NC}"
    mkdir -p "$install_dir"
    tar -xJf "$temp_tar" -C "$install_dir" --strip-components=1
    rm -f "$temp_tar"

    # Adiciona ao PATH da sessao atual
    export PATH="$install_dir/bin:$PATH"

    # Adiciona ao ~/.bashrc e ~/.profile se ainda nao estiver
    if ! grep -q "$install_dir/bin" "$HOME/.bashrc" 2>/dev/null; then
        echo "export PATH=\"$install_dir/bin:\$PATH\"" >> "$HOME/.bashrc"
    fi
    if [ -f "$HOME/.profile" ] && ! grep -q "$install_dir/bin" "$HOME/.profile" 2>/dev/null; then
        echo "export PATH=\"$install_dir/bin:\$PATH\"" >> "$HOME/.profile"
    fi

    echo -e "${GREEN}  ✓ Node.js instalado localmente em ${install_dir}/bin com sucesso!${NC}"
    return 0
}

install_node() {
    local sudo_cmd
    sudo_cmd=$(get_sudo_prefix)

    # Identifica a distribuição Linux
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        local distro_id="${ID:-}"
        local distro_like="${ID_LIKE:-}"
    else
        local distro_id="unknown"
        local distro_like=""
    fi

    echo -e "${BLUE}  ➜ Distribuição identificada: ${distro_id:-Genérica}${NC}"

    local installed=false

    # Debian / Ubuntu / Mint / PopOS
    if command -v apt-get >/dev/null 2>&1; then
        echo -e "${CYAN}  ➜ Configurando repositório oficial NodeSource (Node.js 20.x)...${NC}"
        if [ -n "$sudo_cmd" ] || [ "$EUID" -eq 0 ]; then
            $sudo_cmd apt-get update -y
            $sudo_cmd apt-get install -y ca-certificates curl gnupg
            curl -fsSL https://deb.nodesource.com/setup_20.x | $sudo_cmd -E bash -
            $sudo_cmd apt-get install -y nodejs
            installed=true
        fi
    # Fedora / RHEL / CentOS / Rocky / Alma
    elif command -v dnf >/dev/null 2>&1; then
        echo -e "${CYAN}  ➜ Instalando Node.js via dnf...${NC}"
        if [ -n "$sudo_cmd" ] || [ "$EUID" -eq 0 ]; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | $sudo_cmd bash -
            $sudo_cmd dnf install -y nodejs
            installed=true
        fi
    elif command -v yum >/dev/null 2>&1; then
        echo -e "${CYAN}  ➜ Instalando Node.js via yum...${NC}"
        if [ -n "$sudo_cmd" ] || [ "$EUID" -eq 0 ]; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | $sudo_cmd bash -
            $sudo_cmd yum install -y nodejs
            installed=true
        fi
    # Arch Linux / Manjaro
    elif command -v pacman >/dev/null 2>&1; then
        echo -e "${CYAN}  ➜ Instalando Node.js via pacman...${NC}"
        if [ -n "$sudo_cmd" ] || [ "$EUID" -eq 0 ]; then
            $sudo_cmd pacman -Sy --noconfirm nodejs npm
            installed=true
        fi
    # Alpine Linux
    elif command -v apk >/dev/null 2>&1; then
        echo -e "${CYAN}  ➜ Instalando Node.js via apk...${NC}"
        if [ -n "$sudo_cmd" ] || [ "$EUID" -eq 0 ]; then
            $sudo_cmd apk add --no-cache nodejs npm
            installed=true
        fi
    # openSUSE
    elif command -v zypper >/dev/null 2>&1; then
        echo -e "${CYAN}  ➜ Instalando Node.js via zypper...${NC}"
        if [ -n "$sudo_cmd" ] || [ "$EUID" -eq 0 ]; then
            $sudo_cmd zypper install -y nodejs npm
            installed=true
        fi
    fi

    # Se nao conseguiu via gerenciador de pacotes ou nao tem sudo, usa o instalador via tarball
    if [ "$installed" != true ]; then
        echo -e "${YELLOW}  Instalação via gerenciador de pacotes não pôde ser completada ou sudo não disponível.${NC}"
        echo -e "${CYAN}  Utilizando método de instalação direta pré-compilada em ~/.local...${NC}"
        install_node_via_tarball
    fi
}

show_header

echo -e "${CYAN}[1/3] Verificando ambiente Node.js...${NC}"

node_major=$(get_node_major_version)

if [ "$node_major" -ge 18 ]; then
    node_ver=$(node -v)
    echo -e "${GREEN}  ✓ Node.js detectado: ${node_ver} (Versão compatível)${NC}"
else
    if [ "$node_major" -gt 0 ]; then
        echo -e "${YELLOW}  ⚠ Versão do Node.js instalada ($(node -v)) é inferior à recomendada (v18+).${NC}"
    else
        echo -e "${YELLOW}  ✗ Node.js não foi encontrado no sistema.${NC}"
    fi

    echo ""
    read -r -p "Deseja baixar e instalar o Node.js LTS (v20.x) automaticamente agora? [S/n]: " response
    response=${response:-S}
    if [[ "$response" =~ ^[Ss]$ ]] || [[ "$response" =~ ^[Yy]$ ]]; then
        install_node
        # Recarrega a versao apos instalacao
        node_major=$(get_node_major_version)
        if [ "$node_major" -lt 18 ]; then
            echo -e "${RED}  ✗ Não foi possível confirmar a instalação do Node.js.${NC}"
            echo -e "Por favor, instale o Node.js 18+ manualmente em https://nodejs.org/"
            exit 1
        fi
        echo -e "${GREEN}  ✓ Node.js $(node -v) pronto para uso!${NC}"
    else
        echo -e "${RED}Instalação cancelada. Por favor, instale o Node.js 18+ em https://nodejs.org/${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${CYAN}[2/3] Verificando dependências do projeto...${NC}"

# Inicializa arquivo .env se nao existir
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    echo -e "${GREEN}  ✓ Arquivo de configuração .env inicializado.${NC}"
fi

if [ -d "node_modules" ]; then
    echo -e "${GREEN}  ✓ Dependências já presentes (pasta node_modules encontrada).${NC}"
else
    echo -e "${CYAN}  ➜ Instalando dependências (npm install)...${NC}"
    npm install --omit=dev
    echo -e "${GREEN}  ✓ Dependências instaladas com sucesso!${NC}"
fi

echo ""
echo -e "${CYAN}[3/3] Configurando permissões e atalhos...${NC}"
chmod +x "$PROJECT_DIR/iniciar.sh" 2>/dev/null || true
chmod +x "$PROJECT_DIR/install.sh" 2>/dev/null || true
echo -e "${GREEN}  ✓ Permissões de execução configuradas.${NC}"

read -r -p "Deseja criar um atalho no menu de aplicativos e Área de Trabalho? [S/n]: " create_sc
create_sc=${create_sc:-S}
if [[ "$create_sc" =~ ^[Ss]$ ]] || [[ "$create_sc" =~ ^[Yy]$ ]]; then
    desktop_file="[Desktop Entry]
Version=1.0
Type=Application
Name=Emulador Crédito Trabalhador
Comment=Emulador de API Crédito ao Trabalhador
Exec=bash -c \"cd '$PROJECT_DIR' && ./iniciar.sh\"
Icon=utilities-terminal
Terminal=true
Categories=Development;Utility;"

    # Salva no menu de aplicativos XDG
    mkdir -p "$HOME/.local/share/applications" 2>/dev/null || true
    echo "$desktop_file" > "$HOME/.local/share/applications/emulador-credito-trabalhador.desktop"
    chmod +x "$HOME/.local/share/applications/emulador-credito-trabalhador.desktop" 2>/dev/null || true

    # Salva no Desktop caso o diretorio exista
    desktop_dir=""
    if [ -d "$HOME/Desktop" ]; then
        desktop_dir="$HOME/Desktop"
    elif [ -d "$HOME/Área de Trabalho" ]; then
        desktop_dir="$HOME/Área de Trabalho"
    fi

    if [ -n "$desktop_dir" ]; then
        echo "$desktop_file" > "$desktop_dir/emulador-credito-trabalhador.desktop"
        chmod +x "$desktop_dir/emulador-credito-trabalhador.desktop" 2>/dev/null || true
    fi
    echo -e "${GREEN}  ✓ Atalho criado com sucesso!${NC}"
fi

echo ""
echo -e "${GREEN}=================================================================${NC}"
echo -e "${GREEN}${BOLD}   🎉 INSTALAÇÃO FINALIZADA COM SUCESSO!                         ${NC}"
echo -e "${GREEN}=================================================================${NC}"
echo ""
echo -e "Para iniciar o emulador futuramente, execute:"
echo -e "  ${YELLOW}./iniciar.sh${NC}  ou  ${YELLOW}npm start${NC}"
echo ""

read -r -p "Deseja iniciar o Emulador e abrir no navegador agora? [S/n]: " start_now
start_now=${start_now:-S}
if [[ "$start_now" =~ ^[Ss]$ ]] || [[ "$start_now" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${CYAN}Iniciando o servidor...${NC}"
    "$PROJECT_DIR/iniciar.sh"
else
    echo -e "${CYAN}Instalação finalizada. Até logo!${NC}"
fi
