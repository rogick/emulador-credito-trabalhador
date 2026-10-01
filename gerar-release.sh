#!/usr/bin/env bash
# Script para Gerar Releases com Instalador (Linux/macOS)
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if ! command -v node >/dev/null 2>&1; then
    echo "[ERRO] Node.js não foi encontrado no sistema."
    exit 1
fi

node scripts/generate-release.js "$@"
