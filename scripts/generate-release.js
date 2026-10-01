#!/usr/bin/env node
/**
 * Script de Geração de Releases com Instalador
 * Emulador de API de Crédito ao Trabalhador
 *
 * Gera pacotes prontos para distribuição (.zip para Windows e .tar.gz para Linux)
 * contendo todos os instaladores automáticos e arquivos da aplicação.
 *
 * Suporta:
 *   - Pacote Padrão (leve, instalador baixa Node/deps se necessário)
 *   - Pacote Offline (com node_modules de produção pré-instalado)
 *   - Cálculo automático de checksums SHA-256
 *   - Geração de notas de release (RELEASE_INFO.md)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Raiz do projeto
const ROOT_DIR = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(ROOT_DIR, 'release');
const STAGING_DIR = path.join(RELEASE_DIR, '.staging');

// Cores ANSI para o terminal
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

// Arquivos e pastas essenciais para o release
const ESSENTIAL_FILES = [
  'server.js',
  'validator.js',
  'package.json',
  'package-lock.json',
  'dados-consignacoes-mock.json',
  'emprestimo-trabalhador-mock.json',
  'extrato-trabalhador-mock.json',
  'install.bat',
  'install.ps1',
  'install.sh',
  'iniciar.bat',
  'iniciar.sh',
  'run.bat',
  'README.md',
  '.env.example'
];

const ESSENTIAL_DIRS = [
  'public'
];

// Parser de argumentos da linha de comando
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    version: null,
    offline: false,
    all: false,
    clean: true,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--offline') {
      options.offline = true;
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--no-clean') {
      options.clean = false;
    } else if (arg === '--version' || arg === '-v') {
      options.version = args[++i];
    } else if (!arg.startsWith('-') && !options.version) {
      options.version = arg;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
${colors.bold}${colors.cyan}Geração de Releases com Instalador — Emulador Crédito Trabalhador${colors.reset}

${colors.yellow}Uso:${colors.reset}
  node scripts/generate-release.js [opções] [versão]
  npm run release [-- opções]

${colors.yellow}Opções:${colors.reset}
  --version, -v <versão>   Especifica a versão do release (padrão: versão do package.json)
  --offline                Gera o pacote offline (com node_modules de produção incluso)
  --all                    Gera ambos os pacotes: Padrão e Offline
  --no-clean               Não limpa a pasta release/ antes da execução
  --help, -h               Exibe esta mensagem de ajuda

${colors.yellow}Exemplos:${colors.reset}
  npm run release                   # Gera release padrão (ZIP e TAR.GZ com instalador)
  npm run release:offline           # Gera pacote com dependências pré-instaladas (offline)
  npm run release:all               # Gera releases padrão e offline
  node scripts/generate-release.js 1.1.0 --all
`);
}

function getPackageInfo() {
  const pkgPath = path.join(ROOT_DIR, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error('package.json não encontrado na raiz do projeto.');
  }
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    // Preserva permissões de execução para scripts shell
    if (src.endsWith('.sh') || src.endsWith('.bat')) {
      try {
        fs.chmodSync(dest, 0o755);
      } catch (_) {}
    }
  }
}

function sanitizePackageJson(destPath) {
  if (!fs.existsSync(destPath)) return;
  const content = JSON.parse(fs.readFileSync(destPath, 'utf8'));
  // Remove devDependencies do pacote de distribuição final
  delete content.devDependencies;
  fs.writeFileSync(destPath, JSON.stringify(content, null, 2) + '\n', 'utf8');
}

function calculateSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(2) + ' KB';
  const mb = kb / 1024;
  return mb.toFixed(2) + ' MB';
}

/**
 * Cria arquivo compactado usando a biblioteca archiver
 */
function createArchive(sourceDir, outFilePath, format, rootFolderName) {
  let archiver;
  try {
    archiver = require('archiver');
  } catch (e) {
    throw new Error('Módulo "archiver" não encontrado. Instale com "npm install --save-dev archiver".');
  }

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outFilePath);
    const archive = archiver(format, format === 'zip' ? { zlib: { level: 9 } } : { gzip: true, gzipOptions: { level: 9 } });

    output.on('close', () => {
      resolve({
        path: outFilePath,
        size: fs.statSync(outFilePath).size
      });
    });

    archive.on('error', (err) => reject(err));
    archive.pipe(output);

    // Adiciona o diretório com permissões corretas
    archive.directory(sourceDir, rootFolderName, (entry) => {
      const isExecutable = entry.name.endsWith('.sh') || entry.name.endsWith('.bat') || entry.name.includes('/bin/');
      entry.mode = isExecutable ? 0o755 : 0o644;
      return entry;
    });

    archive.finalize();
  });
}

async function prepareStaging(targetDir, includeNodeModules = false) {
  cleanDir(targetDir);
  ensureDir(targetDir);

  // Copia arquivos essenciais
  for (const file of ESSENTIAL_FILES) {
    const src = path.join(ROOT_DIR, file);
    const dest = path.join(targetDir, file);
    if (fs.existsSync(src)) {
      copyRecursive(src, dest);
    } else {
      console.warn(`${colors.yellow}  [Aviso] Arquivo essencial não encontrado: ${file}${colors.reset}`);
    }
  }

  // Copia diretórios essenciais
  for (const dir of ESSENTIAL_DIRS) {
    const src = path.join(ROOT_DIR, dir);
    const dest = path.join(targetDir, dir);
    if (fs.existsSync(src)) {
      copyRecursive(src, dest);
    }
  }

  // Limpa devDependencies do package.json de distribuição
  sanitizePackageJson(path.join(targetDir, 'package.json'));

  // Se solicitado pacote offline, instala apenas as dependências de produção
  if (includeNodeModules) {
    console.log(`${colors.cyan}  ➜ Instalando dependências de produção para pacote offline...${colors.reset}`);
    try {
      execSync('npm install --omit=dev --no-audit --no-fund --ignore-scripts', {
        cwd: targetDir,
        stdio: 'pipe'
      });
      console.log(`${colors.green}  ✓ Dependências de produção embutidas com sucesso.${colors.reset}`);
    } catch (err) {
      console.error(`${colors.red}  ✗ Erro ao instalar dependências em staging: ${err.message}${colors.reset}`);
      throw err;
    }
  }
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    showHelp();
    return;
  }

  const pkg = getPackageInfo();
  const version = options.version || pkg.version || '1.0.0';
  const appBaseName = 'emulador-credito-trabalhador';
  const rootFolderName = `${appBaseName}`;

  console.log(`${colors.bold}${colors.cyan}=================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.yellow}   GERADOR DE RELEASES COM INSTALADOR — v${version}               ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}=================================================================${colors.reset}`);
  console.log('');

  if (options.clean) {
    console.log(`${colors.gray}➜ Limpando pasta de releases (${RELEASE_DIR})...${colors.reset}`);
    cleanDir(RELEASE_DIR);
  }
  ensureDir(RELEASE_DIR);

  const builds = [];
  const buildStandard = !options.offline || options.all;
  const buildOffline = options.offline || options.all;

  if (buildStandard) {
    builds.push({
      name: 'Padrão (com instalador automático)',
      suffix: '',
      offline: false
    });
  }

  if (buildOffline) {
    builds.push({
      name: 'Offline / Standalone (com dependências pré-instaladas)',
      suffix: '-offline',
      offline: true
    });
  }

  const generatedArchives = [];

  for (const build of builds) {
    console.log(`${colors.bold}${colors.cyan}▶ Gerando Pacote: ${build.name}${colors.reset}`);
    const stagingPath = path.join(STAGING_DIR, build.offline ? 'offline' : 'standard');
    await prepareStaging(stagingPath, build.offline);

    // 1. Pacote Windows / Universal (.zip)
    const zipName = `${appBaseName}-v${version}${build.suffix}-instalador.zip`;
    const zipPath = path.join(RELEASE_DIR, zipName);
    console.log(`  ➜ Criando ${colors.yellow}${zipName}${colors.reset}...`);
    const zipResult = await createArchive(stagingPath, zipPath, 'zip', rootFolderName);
    generatedArchives.push({
      filename: zipName,
      path: zipPath,
      size: zipResult.size,
      type: 'ZIP (Windows/Multiplataforma)',
      offline: build.offline
    });

    // 2. Pacote Linux (.tar.gz)
    const tarName = `${appBaseName}-v${version}${build.suffix}-linux.tar.gz`;
    const tarPath = path.join(RELEASE_DIR, tarName);
    console.log(`  ➜ Criando ${colors.yellow}${tarName}${colors.reset}...`);
    const tarResult = await createArchive(stagingPath, tarPath, 'tar', rootFolderName);
    generatedArchives.push({
      filename: tarName,
      path: tarPath,
      size: tarResult.size,
      type: 'TAR.GZ (Linux)',
      offline: build.offline
    });

    console.log(`${colors.green}  ✓ Pacotes gerados com sucesso!${colors.reset}\n`);
  }

  // Limpa pasta staging
  cleanDir(STAGING_DIR);

  // Calcula checksums SHA-256
  console.log(`${colors.bold}${colors.cyan}▶ Calculando Checksums SHA-256...${colors.reset}`);
  let checksumFileContent = '';
  for (const item of generatedArchives) {
    item.sha256 = calculateSha256(item.path);
    checksumFileContent += `${item.sha256}  ${item.filename}\n`;
  }

  const checksumPath = path.join(RELEASE_DIR, 'SHA256SUMS.txt');
  fs.writeFileSync(checksumPath, checksumFileContent, 'utf8');
  console.log(`${colors.green}  ✓ Arquivo SHA256SUMS.txt criado com sucesso.${colors.reset}\n`);

  // Gera RELEASE_INFO.md com as notas e instruções
  const releaseInfoPath = path.join(RELEASE_DIR, 'RELEASE_INFO.md');
  const releaseInfoContent = generateReleaseNotes(version, generatedArchives);
  fs.writeFileSync(releaseInfoPath, releaseInfoContent, 'utf8');

  // Resumo no terminal
  console.log(`${colors.bold}${colors.green}=================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.green}   🎉 RELEASES GERADAS COM SUCESSO!                             ${colors.reset}`);
  console.log(`${colors.bold}${colors.green}=================================================================${colors.reset}`);
  console.log('');
  console.log(`${colors.bold}Arquivos gerados em ${path.relative(ROOT_DIR, RELEASE_DIR)}/:${colors.reset}`);
  console.log('');

  for (const item of generatedArchives) {
    console.log(`  📦 ${colors.bold}${item.filename}${colors.reset}`);
    console.log(`     Tamanho:  ${colors.cyan}${formatBytes(item.size)}${colors.reset}`);
    console.log(`     SHA-256:  ${colors.gray}${item.sha256}${colors.reset}`);
    console.log(`     Tipo:     ${item.type}`);
    console.log('');
  }

  console.log(`  📄 ${colors.bold}SHA256SUMS.txt${colors.reset} (Hashes de verificação)`);
  console.log(`  📄 ${colors.bold}RELEASE_INFO.md${colors.reset} (Instruções e notas de lançamento)`);
  console.log('');
  console.log(`${colors.yellow}Dica:${colors.reset} Você pode publicar estes arquivos diretamente na aba ${colors.bold}Releases${colors.reset} do GitHub`);
  console.log(`      ou disparar o workflow automatizado via GitHub Actions.`);
  console.log('');
}

function generateReleaseNotes(version, archives) {
  const dateStr = new Date().toLocaleDateString('pt-BR');
  let md = `# Release v${version} — Emulador Crédito Trabalhador (${dateStr})

Pacotes de instalação e execução do **Emulador de API Crédito ao Trabalhador** (DATAPREV Manual v1.6).

---

## 📦 Como Instalar e Executar

Escolha o pacote apropriado para o seu sistema operacional:

### 🪟 Windows

1. Baixe o arquivo **\`emulador-credito-trabalhador-v${version}-instalador.zip\`**.
2. Clique com o botão direito e escolha **Extrair Tudo**.
3. Acesse a pasta extraída e dê um duplo clique no arquivo **\`install.bat\`**.
   - O instalador verifica o Node.js, instala dependências e cria um atalho na sua Área de Trabalho.
4. Para iniciar futuramente, utilize o atalho na Área de Trabalho ou execute **\`iniciar.bat\`**.

### 🐧 Linux

1. Baixe o arquivo **\`emulador-credito-trabalhador-v${version}-linux.tar.gz\`**.
2. Extraia o arquivo no terminal:
   \`\`\`bash
   tar -xzf emulador-credito-trabalhador-v${version}-linux.tar.gz
   cd emulador-credito-trabalhador
   ./install.sh
   \`\`\`
3. Para iniciar futuramente, execute **\`./iniciar.sh\`** ou use o atalho criado no menu de aplicativos.

---

## 💾 Pacotes Disponíveis

| Arquivo | Tipo | Descrição |
| :--- | :--- | :--- |
`;

  for (const item of archives) {
    const desc = item.offline
      ? 'Ideal para ambientes sem internet (dependências embutidas)'
      : 'Pacote leve com instalador automático';
    md += `| \`${item.filename}\` | ${item.type} | ${desc} |\n`;
  }

  md += `
---

## 🔒 Verificação de Integridade (SHA-256)

\`\`\`text
`;

  for (const item of archives) {
    md += `${item.sha256}  ${item.filename}\n`;
  }

  md += `\`\`\`
`;

  return md;
}

main().catch((err) => {
  console.error(`\n${colors.red}${colors.bold}[ERRO FATAL]${colors.reset} ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
