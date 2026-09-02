/**
 * app.js — Lógica da interface web do Emulador de Crédito Trabalhador
 * Vanilla JS — CRUD, importação CSV/JSON, exportação e teste de endpoint.
 *
 * A disposição dos campos vem de schema.js (ordem canônica, agrupamento,
 * tipo de controle e largura). Este arquivo cuida de estado, renderização
 * e persistência.
 */

// ============================================================
// Estado da aplicação
// ============================================================
const STORAGE_KEY = 'emulador-ui-state';
const DATASETS = DATASET_SCHEMA;

let currentPage = 'dashboard';
let dataCache = {};
let confirmCallback = null;
let healthTimer = null;
let lastFocusedElement = null;

/** Estado de visualização por dataset (busca, ordenação, página, seleção). */
const viewState = {};

/** Grupos de formulário recolhidos, por id de grupo. */
let collapsedGroups = {};

function defaultViewState() {
  return { search: '', sortKey: null, sortDir: 'asc', page: 1, pageSize: 25, selected: [] };
}

function loadUiState() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    saved = {};
  }
  for (const ds of Object.keys(DATASETS)) {
    viewState[ds] = Object.assign(defaultViewState(), (saved.view || {})[ds] || {});
    viewState[ds].selected = [];
  }
  collapsedGroups = saved.collapsedGroups || {};
}

function saveUiState() {
  try {
    const view = {};
    for (const ds of Object.keys(viewState)) {
      const { search, sortKey, sortDir, page, pageSize } = viewState[ds];
      view[ds] = { search, sortKey, sortDir, page, pageSize };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ view, collapsedGroups }));
  } catch {
    /* localStorage indisponível — segue sem persistir */
  }
}

// Sub-CRUD de empréstimos (dentro do formulário de Extrato)
let subcrudEmprestimos = [];
let subcrudEditingIndex = -1;
let subcrudIsAdding = false;

// ============================================================
// API Helper
// ============================================================
const api = {
  async get(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  },
  async post(url, body) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return resp.json();
  },
  async put(url, body) {
    const resp = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return resp.json();
  },
  async del(url) {
    const resp = await fetch(url, { method: 'DELETE' });
    return resp.json();
  },
  async upload(url, file) {
    const formData = new FormData();
    formData.append('file', file);
    const resp = await fetch(url, { method: 'POST', body: formData });
    return resp.json();
  }
};

// ============================================================
// Validação de CPF/CNPJ
// Espelha validator.js (que roda no servidor); mantidos em sincronia
// manualmente porque validator.js não é servido para o navegador.
// ============================================================
const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');
const allDigitsEqual = (v) => /^(\d)\1+$/.test(v);

function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || allDigitsEqual(cpf)) return false;
  for (const [len, factor] of [[9, 10], [10, 11]]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(cpf[i], 10) * (factor - i);
    let check = (sum * 10) % 11;
    if (check >= 10) check = 0;
    if (check !== parseInt(cpf[len], 10)) return false;
  }
  return true;
}

function isValidCnpj(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length === 8) return true; // raiz é aceita nas consultas
  if (cnpj.length !== 14 || allDigitsEqual(cnpj)) return false;
  for (const size of [12, 13]) {
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(cnpj[size - i], 10) * pos--;
      if (pos < 2) pos = 9;
    }
    const check = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (check !== parseInt(cnpj[size], 10)) return false;
  }
  return true;
}

// ============================================================
// Formatação e conversão de valores
// Formatos gravados no mock: data = DD/MM/AAAA, competência = MM/AAAA
// ============================================================
const fmt = {
  cpf(v) {
    const d = onlyDigits(v).slice(0, 11);
    if (!d) return '';
    return d.replace(/^(\d{3})(\d{0,3})(\d{0,3})(\d{0,2}).*/, (_, a, b, c, e) =>
      a + (b ? '.' + b : '') + (c ? '.' + c : '') + (e ? '-' + e : ''));
  },
  cnpj(v) {
    const d = onlyDigits(v).slice(0, 14);
    if (!d) return '';
    if (d.length <= 8) {
      return d.replace(/^(\d{2})(\d{0,3})(\d{0,3}).*/, (_, a, b, c) =>
        a + (b ? '.' + b : '') + (c ? '.' + c : ''));
    }
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})(\d{0,2}).*/, (_, a, b, c, e, f) =>
      `${a}.${b}.${c}` + (e ? '/' + e : '') + (f ? '-' + f : ''));
  },
  money(v) {
    if (v === '' || v === null || v === undefined) return '';
    const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'));
    if (!isFinite(n)) return String(v);
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  moneyToNumber(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(String(v).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  },
  /** 'DD/MM/AAAA' (ou 'DD/MM/AA') -> 'AAAA-MM-DD' para o input type=date */
  dateToInput(v) {
    const m = String(v ?? '').match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
    if (!m) return '';
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2]}-${m[1]}`;
  },
  /** 'AAAA-MM-DD' -> 'DD/MM/AAAA' */
  dateFromInput(v) {
    const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  },
  /** 'MM/AAAA' -> 'AAAA-MM' para o input type=month */
  competenciaToInput(v) {
    const m = String(v ?? '').match(/^(\d{2})\/(\d{4})$/);
    return m ? `${m[2]}-${m[1]}` : '';
  },
  /** 'AAAA-MM' -> 'MM/AAAA' */
  competenciaFromInput(v) {
    const m = String(v ?? '').match(/^(\d{4})-(\d{2})$/);
    return m ? `${m[2]}/${m[1]}` : '';
  }
};

/** Converte texto livre em número/booleano quando faz sentido (campos 'text'). */
function parseFieldValue(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (/^0\d/.test(val)) return val;                 // preserva zeros à esquerda
  if (/^\d+$/.test(val) && val.length <= 15) {
    const num = Number(val);
    if (!isNaN(num) && String(num) === val) return num;
  }
  if (/^\d+[.,]\d+$/.test(val)) {
    const num = Number(val.replace(',', '.'));
    if (!isNaN(num)) return num;
  }
  return val;
}

// ============================================================
// Leitura e escrita de campos do formulário
// ============================================================
function fieldInputId(prefix, key) {
  return `${prefix}-${key.replace(/\W/g, '_')}`;
}

/** Valor de exibição (no input) a partir do valor bruto do registro. */
function toInputValue(def, raw) {
  if (raw === null || raw === undefined) return '';
  switch (def.type) {
    case 'cpf': return fmt.cpf(raw);
    case 'cnpj': case 'inscricao': return fmt.cnpj(raw);
    case 'money': case 'percent': return fmt.money(raw);
    case 'date': return fmt.dateToInput(raw);
    case 'competencia': return fmt.competenciaToInput(raw);
    case 'bool': return raw === true || raw === 'true' ? 'true' : 'false';
    default: return String(raw);
  }
}

/** Valor a gravar no registro a partir do que está no input. */
function fromInputValue(def, rawInput) {
  const val = String(rawInput ?? '').trim();
  switch (def.type) {
    case 'cpf': case 'cnpj': case 'inscricao': {
      const d = onlyDigits(val);
      return d === '' ? undefined : d;
    }
    case 'money': case 'percent': {
      const n = fmt.moneyToNumber(val);
      return n === null ? undefined : n;
    }
    case 'int': {
      if (val === '') return undefined;
      const n = Number(val);
      return isFinite(n) ? n : val;
    }
    case 'date': {
      const d = fmt.dateFromInput(val);
      return d === '' ? undefined : d;
    }
    case 'competencia': {
      const c = fmt.competenciaFromInput(val);
      return c === '' ? undefined : c;
    }
    case 'bool': return val === 'true';
    case 'select': {
      if (val === '') return undefined;
      return /^-?\d+$/.test(val) ? Number(val) : val;
    }
    default:
      return val === '' ? undefined : parseFieldValue(val);
  }
}

/**
 * Devolve uma mensagem de erro, ou null quando o campo está válido.
 * `root` permite validação cruzada (ex.: a inscrição do empregador é
 * conferida como CNPJ ou como CPF conforme o tipo escolhido ao lado).
 */
function validateField(def, rawInput, root = null) {
  const val = String(rawInput ?? '').trim();

  if (def.required && val === '') return 'Campo obrigatório.';
  if (val === '') return null;

  switch (def.type) {
    case 'cpf':
      if (onlyDigits(val).length !== 11) return 'O CPF precisa ter 11 dígitos.';
      if (!isValidCpf(val)) return 'Dígito verificador do CPF inválido.';
      return null;
    case 'inscricao':
      if (!/^\d+$/.test(onlyDigits(val))) return 'Informe apenas dígitos.';
      return null;
    case 'cnpj': {
      const d = onlyDigits(val);
      const tipo = def.tipoField && root
        ? String(root.querySelector(`[data-field="${def.tipoField}"]`)?.value ?? '')
        : '';
      if (tipo === '2') {
        if (d.length !== 11) return 'Para tipo CPF, informe 11 dígitos.';
        if (!isValidCpf(d)) return 'Dígito verificador do CPF inválido.';
        return null;
      }
      if (d.length !== 8 && d.length !== 14) return 'Informe a raiz (8 dígitos) ou o CNPJ completo (14).';
      if (!isValidCnpj(d)) return 'Dígito verificador do CNPJ inválido.';
      return null;
    }
    case 'money': case 'percent':
      if (fmt.moneyToNumber(val) === null) return 'Valor numérico inválido.';
      return null;
    case 'int':
      if (!/^-?\d+$/.test(val)) return 'Informe um número inteiro.';
      return null;
    case 'date':
      if (fmt.dateFromInput(val) === '') return 'Data inválida.';
      return null;
    case 'competencia':
      if (fmt.competenciaFromInput(val) === '') return 'Competência inválida.';
      return null;
    default:
      return null;
  }
}

// ============================================================
// Inicialização
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  loadUiState();
  renderSkeleton();
  await loadAllDatasets();
  checkServerHealth();
  healthTimer = setInterval(checkServerHealth, 15000);
  renderCurrentPage();
});

// ============================================================
// Carregamento de dados
// ============================================================
async function loadAllDatasets() {
  try {
    const results = await Promise.all(
      Object.keys(DATASETS).map(ds => api.get(`/api/mock/${ds}`))
    );
    Object.keys(DATASETS).forEach((ds, i) => { dataCache[ds] = results[i].registros; });
    updateBadges();
    updateDashboardStats();
  } catch (err) {
    toast('Erro ao carregar dados: ' + err.message, 'error');
  }
}

async function loadDataset(dataset) {
  try {
    const result = await api.get(`/api/mock/${dataset}`);
    dataCache[dataset] = result.registros;
    viewState[dataset].selected = [];
    updateBadges();
    updateDashboardStats();
  } catch (err) {
    toast('Erro ao carregar dataset: ' + err.message, 'error');
  }
}

async function checkServerHealth() {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const stat = document.getElementById('stat-status');
  try {
    const result = await api.get('/health');
    if (result.status === 'UP') {
      dot.classList.remove('offline');
      text.textContent = 'Servidor ativo';
      stat.textContent = 'UP';
      stat.style.color = 'var(--success)';
    }
  } catch {
    dot.classList.add('offline');
    text.textContent = 'Servidor offline';
    stat.textContent = 'DOWN';
    stat.style.color = 'var(--danger)';
  }
}

function updateBadges() {
  for (const ds of Object.keys(DATASETS)) {
    const badge = document.getElementById(`badge-${ds}`);
    if (badge) badge.textContent = (dataCache[ds] || []).length;
  }
}

function updateDashboardStats() {
  for (const ds of Object.keys(DATASETS)) {
    const el = document.getElementById(`stat-${ds}`);
    if (el) el.textContent = (dataCache[ds] || []).length;
  }
}

function renderSkeleton() {
  for (const ds of Object.keys(DATASETS)) {
    const el = document.getElementById(`page-${ds}`);
    if (el && !el.innerHTML.trim()) {
      el.innerHTML = `<div class="skeleton-stack">${'<div class="skeleton-row"></div>'.repeat(6)}</div>`;
    }
  }
}

// ============================================================
// Navegação
// ============================================================
function navigateTo(page) {
  currentPage = page;

  document.querySelectorAll('.nav-item').forEach(item => {
    const active = item.dataset.page === page;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });

  document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  if (page !== 'dashboard') renderDatasetPage(page);

  document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const open = sidebar.classList.toggle('open');
  document.getElementById('mobileMenuBtn').setAttribute('aria-expanded', String(open));
}

function renderCurrentPage() {
  if (currentPage !== 'dashboard') renderDatasetPage(currentPage);
}

// ============================================================
// Página de dataset — estrutura fixa (a busca nunca é recriada)
// ============================================================
function renderDatasetPage(dataset) {
  const config = DATASETS[dataset];
  const st = viewState[dataset];
  const pageEl = document.getElementById(`page-${dataset}`);

  pageEl.innerHTML = `
    <div class="page-header">
      <h2>${config.icon} ${config.label}</h2>
      <p>${escapeHtml(config.description)}</p>
    </div>

    <div class="toolbar">
      <div class="toolbar-search">
        <div class="search-box">
          <span class="search-box-icon" aria-hidden="true">🔍</span>
          <input type="search" id="search-${dataset}" placeholder="Buscar registros..."
                 aria-label="Buscar registros em ${escapeHtml(config.label)}"
                 value="${escapeHtml(st.search)}">
          <button type="button" class="search-clear" id="clear-${dataset}"
                  aria-label="Limpar busca" ${st.search ? '' : 'hidden'}>✕</button>
        </div>
        <span class="result-count" id="count-${dataset}"></span>
      </div>

      <div class="toolbar-actions">
        <button class="btn btn-primary" onclick="openCreateModal('${dataset}')">
          <span aria-hidden="true">＋</span> Adicionar
        </button>
        <div class="menu" id="menu-${dataset}">
          <button class="btn btn-secondary btn-icon" aria-haspopup="true" aria-expanded="false"
                  aria-label="Mais ações" onclick="toggleMenu('${dataset}')">⋯</button>
          <div class="menu-panel" role="menu" hidden>
            <button role="menuitem" onclick="closeMenus(); openImportModal('${dataset}')">📥 Importar CSV/JSON</button>
            <button role="menuitem" onclick="closeMenus(); exportDataset('${dataset}')">📤 Exportar JSON</button>
            <div class="menu-sep"></div>
            <button role="menuitem" class="menu-danger" onclick="closeMenus(); confirmClearAll('${dataset}')">🗑️ Limpar tudo</button>
          </div>
        </div>
      </div>
    </div>

    <div class="bulk-bar" id="bulk-${dataset}" hidden>
      <span id="bulk-count-${dataset}"></span>
      <div class="bulk-actions">
        <button class="btn btn-ghost btn-sm" onclick="clearSelection('${dataset}')">Limpar seleção</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteSelected('${dataset}')">🗑️ Excluir selecionados</button>
      </div>
    </div>

    <div class="table-container" id="table-${dataset}"></div>
  `;

  const input = document.getElementById(`search-${dataset}`);
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    document.getElementById(`clear-${dataset}`).hidden = input.value === '';
    debounce = setTimeout(() => {
      st.search = input.value;
      st.page = 1;
      saveUiState();
      renderTable(dataset);
    }, 200);
  });

  document.getElementById(`clear-${dataset}`).addEventListener('click', () => {
    input.value = '';
    st.search = '';
    st.page = 1;
    saveUiState();
    document.getElementById(`clear-${dataset}`).hidden = true;
    renderTable(dataset);
    input.focus();
  });

  renderTable(dataset);
}

// ============================================================
// Tabela — renderizada isoladamente, sem tocar na busca
// ============================================================
function getVisibleRows(dataset) {
  const config = DATASETS[dataset];
  const data = dataCache[dataset] || [];
  const st = viewState[dataset];
  const filter = st.search.toLowerCase();

  let rows = data.map((item, idx) => ({ item, idx }));

  if (filter) {
    rows = rows.filter(({ item }) => Object.values(item).some(val => {
      const str = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val);
      return str.toLowerCase().includes(filter);
    }));
  }

  if (st.sortKey) {
    const dir = st.sortDir === 'desc' ? -1 : 1;
    rows.sort((a, b) => compareValues(a.item[st.sortKey], b.item[st.sortKey]) * dir);
  }

  return { rows, total: data.length, config };
}

function compareValues(a, b) {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const na = Number(a);
  const nb = Number(b);
  if (isFinite(na) && isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
}

function renderTable(dataset) {
  const st = viewState[dataset];
  const { rows, total, config } = getVisibleRows(dataset);
  const container = document.getElementById(`table-${dataset}`);
  if (!container) return;

  const countEl = document.getElementById(`count-${dataset}`);
  if (countEl) {
    countEl.textContent = st.search
      ? `${rows.length} de ${total} registros`
      : `${total} registro${total === 1 ? '' : 's'}`;
  }

  if (rows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">📭</div>
        <h3>Nenhum registro encontrado</h3>
        <p>${st.search
          ? 'Nenhum resultado para a busca. Tente outro termo.'
          : 'Adicione registros ou importe um arquivo CSV/JSON.'}</p>
      </div>`;
    updateBulkBar(dataset);
    return;
  }

  const pageSize = st.pageSize === 0 ? rows.length : st.pageSize;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  if (st.page > pageCount) st.page = pageCount;
  const start = (st.page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  const sortIcon = (col) => {
    if (st.sortKey !== col) return '<span class="sort-icon" aria-hidden="true">↕</span>';
    return `<span class="sort-icon is-active" aria-hidden="true">${st.sortDir === 'asc' ? '↑' : '↓'}</span>`;
  };

  const allOnPageSelected = pageRows.every(r => st.selected.includes(r.idx));

  container.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-check">
              <input type="checkbox" aria-label="Selecionar página"
                     ${allOnPageSelected ? 'checked' : ''}
                     onchange="toggleSelectPage('${dataset}', this.checked)">
            </th>
            <th class="col-identity">Registro</th>
            ${config.keyColumns.map(col => `
              <th aria-sort="${st.sortKey === col ? (st.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">
                <button type="button" class="th-sort" onclick="sortBy('${dataset}', '${col}')">
                  ${escapeHtml(fieldLabel(col))} ${sortIcon(col)}
                </button>
              </th>`).join('')}
            <th class="col-actions">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${pageRows.map(({ item, idx }) => renderRow(dataset, config, item, idx)).join('')}
        </tbody>
      </table>
    </div>
    <div class="table-footer">
      <span>Exibindo ${pageRows.length} de ${rows.length} registros filtrados</span>
      <div class="pagination">
        <label class="page-size">
          Por página
          <select onchange="setPageSize('${dataset}', this.value)">
            ${[25, 50, 100, 0].map(n => `
              <option value="${n}" ${st.pageSize === n ? 'selected' : ''}>${n === 0 ? 'Todos' : n}</option>
            `).join('')}
          </select>
        </label>
        <div class="page-nav">
          <button class="btn btn-ghost btn-sm" ${st.page <= 1 ? 'disabled' : ''}
                  onclick="goToPage('${dataset}', ${st.page - 1})" aria-label="Página anterior">‹</button>
          <span>${st.page} / ${pageCount}</span>
          <button class="btn btn-ghost btn-sm" ${st.page >= pageCount ? 'disabled' : ''}
                  onclick="goToPage('${dataset}', ${st.page + 1})" aria-label="Próxima página">›</button>
        </div>
      </div>
    </div>
  `;

  updateBulkBar(dataset);
}

function renderRow(dataset, config, item, idx) {
  const st = viewState[dataset];
  const checked = st.selected.includes(idx) ? 'checked' : '';
  const [primary, secondary, tertiary] = config.identity;

  const idPrimary = formatCellValue(item[primary]);
  const idSecondary = [item[secondary], item[tertiary]].filter(v => v !== undefined && v !== '')
    .map(v => formatCellValue(v)).join(' · ');

  return `
    <tr class="${checked ? 'is-selected' : ''}">
      <td class="col-check">
        <input type="checkbox" ${checked} aria-label="Selecionar registro ${escapeHtml(idPrimary)}"
               onchange="toggleSelectRow('${dataset}', ${idx}, this.checked)">
      </td>
      <td class="col-identity">
        <span class="identity-primary" title="Índice interno: ${idx}">${escapeHtml(idPrimary)}</span>
        <span class="identity-secondary">${escapeHtml(idSecondary || '—')}</span>
      </td>
      ${config.keyColumns.map(col => `
        <td title="${escapeHtml(formatCellValue(item[col]))}">${renderCell(dataset, col, item, idx)}</td>
      `).join('')}
      <td class="col-actions">
        <div class="actions-cell">
          <button class="btn btn-ghost btn-icon btn-sm" title="Testar endpoint com este registro"
                  aria-label="Testar endpoint" onclick="openTestModal('${dataset}', ${idx})">▶</button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Ver detalhes"
                  aria-label="Ver detalhes" onclick="openViewModal('${dataset}', ${idx})">👁️</button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Editar"
                  aria-label="Editar" onclick="openEditModal('${dataset}', ${idx})">✏️</button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Excluir"
                  aria-label="Excluir" onclick="confirmDelete('${dataset}', ${idx})">🗑️</button>
        </div>
      </td>
    </tr>`;
}

/** Valor formatado de acordo com o tipo declarado no schema. */
function formatByField(col, val) {
  const def = fieldDef(col);
  if (!def || val === null || val === undefined || val === '') return formatCellValue(val);
  switch (def.type) {
    case 'money': return fmt.money(val);
    case 'percent': return fmt.money(val) + ' %';
    case 'cpf': return fmt.cpf(val);
    case 'cnpj': case 'inscricao': return fmt.cnpj(val);
    default: return formatCellValue(val);
  }
}

function renderCell(dataset, col, item, idx) {
  const val = item[col];
  if (col === 'emprestimos') {
    const n = Array.isArray(val) ? val.length : 0;
    return `<button type="button" class="badge badge-info badge-btn"
                    onclick="openEditModal('${dataset}', ${idx})">
              ${n} empréstimo${n === 1 ? '' : 's'}
            </button>`;
  }
  const def = fieldDef(col);
  if (def && (def.type === 'money' || def.type === 'percent') && typeof val === 'number') {
    return `<span class="num">${escapeHtml(fmt.money(val))}</span>`;
  }
  if (def && def.type === 'cpf') return `<span class="num">${escapeHtml(fmt.cpf(val))}</span>`;
  if (def && def.type === 'int' && typeof val === 'number') {
    return `<span class="num">${escapeHtml(String(val))}</span>`;
  }
  return escapeHtml(formatCellValue(val));
}

function sortBy(dataset, col) {
  const st = viewState[dataset];
  if (st.sortKey === col) {
    if (st.sortDir === 'asc') st.sortDir = 'desc';
    else { st.sortKey = null; st.sortDir = 'asc'; }
  } else {
    st.sortKey = col;
    st.sortDir = 'asc';
  }
  saveUiState();
  renderTable(dataset);
}

function goToPage(dataset, page) {
  viewState[dataset].page = Math.max(1, page);
  saveUiState();
  renderTable(dataset);
}

function setPageSize(dataset, size) {
  viewState[dataset].pageSize = Number(size);
  viewState[dataset].page = 1;
  saveUiState();
  renderTable(dataset);
}

// ============================================================
// Seleção múltipla
// ============================================================
function toggleSelectRow(dataset, idx, checked) {
  const sel = viewState[dataset].selected;
  const pos = sel.indexOf(idx);
  if (checked && pos === -1) sel.push(idx);
  if (!checked && pos !== -1) sel.splice(pos, 1);
  renderTable(dataset);
}

function toggleSelectPage(dataset, checked) {
  const st = viewState[dataset];
  const { rows } = getVisibleRows(dataset);
  const pageSize = st.pageSize === 0 ? rows.length : st.pageSize;
  const pageRows = rows.slice((st.page - 1) * pageSize, (st.page - 1) * pageSize + pageSize);
  for (const { idx } of pageRows) {
    const pos = st.selected.indexOf(idx);
    if (checked && pos === -1) st.selected.push(idx);
    if (!checked && pos !== -1) st.selected.splice(pos, 1);
  }
  renderTable(dataset);
}

function clearSelection(dataset) {
  viewState[dataset].selected = [];
  renderTable(dataset);
}

function updateBulkBar(dataset) {
  const bar = document.getElementById(`bulk-${dataset}`);
  if (!bar) return;
  const n = viewState[dataset].selected.length;
  bar.hidden = n === 0;
  const label = document.getElementById(`bulk-count-${dataset}`);
  if (label) label.textContent = `${n} registro${n === 1 ? '' : 's'} selecionado${n === 1 ? '' : 's'}`;
}

// ============================================================
// Menu de ações secundárias
// ============================================================
function toggleMenu(dataset) {
  const menu = document.getElementById(`menu-${dataset}`);
  const panel = menu.querySelector('.menu-panel');
  const btn = menu.querySelector('button');
  const willOpen = panel.hidden;
  closeMenus();
  panel.hidden = !willOpen;
  btn.setAttribute('aria-expanded', String(willOpen));
}

function closeMenus() {
  document.querySelectorAll('.menu-panel').forEach(p => { p.hidden = true; });
  document.querySelectorAll('.menu > button').forEach(b => b.setAttribute('aria-expanded', 'false'));
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu')) closeMenus();
});

// ============================================================
// Formulário a partir do schema
// ============================================================
/** Índice de seções — renderizado fora da área rolável do modal. */
function renderFormJumps(groups, prefix) {
  return `<nav class="form-jumps" aria-label="Seções do formulário">${
    groups.map(g => `
      <button type="button" class="form-jump" onclick="jumpToGroup('${prefix}', '${g.id}')">
        <span aria-hidden="true">${g.icon}</span> ${escapeHtml(g.label)}
      </button>`).join('')
  }</nav>`;
}

function renderFormGroups(groups, values, prefix, extraHtmlByGroup = {}) {
  const sections = groups.map(g => {
    const collapsed = collapsedGroups[`${prefix}:${g.id}`] === true;
    const fields = g.fields.map(def => renderField(def, values[def.key], prefix)).join('');
    return `
      <fieldset class="field-group${g.primary ? ' is-primary' : ''}" id="${prefix}-grp-${g.id}">
        <legend>
          <button type="button" class="group-toggle" aria-expanded="${!collapsed}"
                  onclick="toggleGroup('${prefix}', '${g.id}')">
            <span class="group-chevron" aria-hidden="true">▾</span>
            <span aria-hidden="true">${g.icon}</span>
            <span class="group-label">${escapeHtml(g.label)}</span>
            ${g.primary ? '<span class="group-tag">obrigatório para a consulta</span>' : ''}
          </button>
        </legend>
        <div class="group-body" ${collapsed ? 'hidden' : ''}>
          ${g.note ? `<p class="group-note">${escapeHtml(g.note)}</p>` : ''}
          <div class="field-grid">${fields}</div>
          ${extraHtmlByGroup[g.id] || ''}
        </div>
      </fieldset>`;
  }).join('');

  return sections;
}

function renderField(def, rawValue, prefix) {
  const id = fieldInputId(prefix, def.key);
  const value = toInputValue(def, rawValue);
  const listId = SUGGESTIONS[def.key] ? `${id}-list` : null;
  const req = def.required ? '<span class="req" aria-hidden="true">*</span>' : '';
  const describedBy = def.help ? `${id}-help` : '';

  let control;
  switch (def.type) {
    case 'select':
      control = `
        <select id="${id}" data-field="${escapeHtml(def.key)}" data-type="select"
                ${def.required ? 'required aria-required="true"' : ''}
                ${describedBy ? `aria-describedby="${describedBy}"` : ''}>
          <option value="">—</option>
          ${def.options.map(o => `
            <option value="${escapeHtml(String(o.value))}" ${String(o.value) === value ? 'selected' : ''}>
              ${escapeHtml(o.label)}
            </option>`).join('')}
        </select>`;
      break;

    case 'bool':
      control = `
        <label class="switch">
          <input type="checkbox" id="${id}" data-field="${escapeHtml(def.key)}" data-type="bool"
                 ${value === 'true' ? 'checked' : ''}>
          <span class="switch-track" aria-hidden="true"></span>
          <span class="switch-text">${escapeHtml(def.label)}</span>
        </label>`;
      break;

    case 'date':
      control = `<input type="date" id="${id}" data-field="${escapeHtml(def.key)}" data-type="date"
                        value="${escapeHtml(value)}">`;
      break;

    case 'competencia':
      control = `<input type="month" id="${id}" data-field="${escapeHtml(def.key)}" data-type="competencia"
                        value="${escapeHtml(value)}" ${def.required ? 'required aria-required="true"' : ''}>`;
      break;

    case 'int':
      control = `<input type="number" step="1" inputmode="numeric" id="${id}"
                        data-field="${escapeHtml(def.key)}" data-type="int" value="${escapeHtml(value)}"
                        ${listId ? `list="${listId}"` : ''}>`;
      break;

    case 'money': case 'percent':
      control = `<input type="text" inputmode="decimal" id="${id}"
                        data-field="${escapeHtml(def.key)}" data-type="${def.type}"
                        value="${escapeHtml(value)}" placeholder="0,00">`;
      break;

    case 'cpf':
      control = `<input type="text" inputmode="numeric" maxlength="14" id="${id}"
                        data-field="${escapeHtml(def.key)}" data-type="cpf"
                        value="${escapeHtml(value)}" placeholder="000.000.000-00"
                        ${def.required ? 'required aria-required="true"' : ''}>`;
      break;

    case 'cnpj': case 'inscricao':
      control = `<input type="text" inputmode="numeric" maxlength="18" id="${id}"
                        data-field="${escapeHtml(def.key)}" data-type="${def.type}"
                        value="${escapeHtml(value)}" placeholder="00.000.000/0000-00"
                        ${def.required ? 'required aria-required="true"' : ''}>`;
      break;

    default:
      control = `<input type="text" id="${id}" data-field="${escapeHtml(def.key)}" data-type="text"
                        value="${escapeHtml(value)}" ${listId ? `list="${listId}"` : ''}>`;
  }

  const datalist = listId
    ? `<datalist id="${listId}">${SUGGESTIONS[def.key].map(s => `<option value="${escapeHtml(s)}"></option>`).join('')}</datalist>`
    : '';

  return `
    <div class="field" style="--span:${def.span}" data-field-wrap="${escapeHtml(def.key)}">
      ${def.type === 'bool' ? '' : `<label for="${id}">${escapeHtml(def.label)} ${req}</label>`}
      ${control}
      ${datalist}
      ${def.help ? `<p class="field-help" id="${id}-help">${escapeHtml(def.help)}</p>` : ''}
      <p class="field-error" hidden></p>
    </div>`;
}

function toggleGroup(prefix, groupId) {
  const el = document.getElementById(`${prefix}-grp-${groupId}`);
  const body = el.querySelector('.group-body');
  const btn = el.querySelector('.group-toggle');
  const collapsed = !body.hidden;
  body.hidden = collapsed;
  btn.setAttribute('aria-expanded', String(!collapsed));
  collapsedGroups[`${prefix}:${groupId}`] = collapsed;
  saveUiState();
}

function jumpToGroup(prefix, groupId) {
  const el = document.getElementById(`${prefix}-grp-${groupId}`);
  if (!el) return;
  const body = el.querySelector('.group-body');
  if (body.hidden) toggleGroup(prefix, groupId);
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const firstInput = el.querySelector('input, select');
  if (firstInput) firstInput.focus({ preventScroll: true });
}

/** Máscaras ao vivo, espelho de descrições e formatação de moeda. */
function wireFormBehaviour(root) {
  root.querySelectorAll('[data-type="cpf"]').forEach(el => {
    el.addEventListener('input', () => { el.value = fmt.cpf(el.value); clearFieldError(el); });
  });
  root.querySelectorAll('[data-type="cnpj"], [data-type="inscricao"]').forEach(el => {
    el.addEventListener('input', () => { el.value = fmt.cnpj(el.value); clearFieldError(el); });
  });
  root.querySelectorAll('[data-type="money"], [data-type="percent"]').forEach(el => {
    el.addEventListener('blur', () => {
      const n = fmt.moneyToNumber(el.value);
      if (n !== null) el.value = fmt.money(n);
    });
    el.addEventListener('input', () => clearFieldError(el));
  });
  root.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', () => clearFieldError(el));
  });

  // Preenche a descrição correspondente ao código escolhido.
  for (const [sourceKey, rule] of Object.entries(MIRROR_LABELS)) {
    const source = root.querySelector(`[data-field="${sourceKey}"]`);
    const target = root.querySelector(`[data-field="${rule.target}"]`);
    if (!source || !target) continue;
    source.addEventListener('change', () => {
      const label = rule.map[source.value];
      if (label !== undefined) target.value = label;
    });
  }
}

function clearFieldError(el) {
  const wrap = el.closest('.field');
  if (!wrap) return;
  wrap.classList.remove('has-error');
  const msg = wrap.querySelector('.field-error');
  if (msg) msg.hidden = true;
}

function showFieldError(root, key, message) {
  const wrap = root.querySelector(`[data-field-wrap="${key}"]`);
  if (!wrap) return null;
  wrap.classList.add('has-error');
  const msg = wrap.querySelector('.field-error');
  msg.textContent = message;
  msg.hidden = false;
  return wrap;
}

/**
 * Lê e valida todos os campos do formulário.
 * Devolve { ok, record } — em caso de erro, rola até o primeiro campo inválido.
 */
function collectForm(root, groups) {
  const record = {};
  let firstInvalid = null;

  root.querySelectorAll('.field.has-error').forEach(w => {
    w.classList.remove('has-error');
    w.querySelector('.field-error').hidden = true;
  });

  for (const group of groups) {
    for (const def of group.fields) {
      const el = root.querySelector(`[data-field="${def.key}"]`);
      if (!el) continue;

      const raw = def.type === 'bool' ? String(el.checked) : el.value;
      const error = validateField(def, raw, root);

      if (error) {
        const wrap = showFieldError(root, def.key, error);
        if (!firstInvalid) firstInvalid = { wrap, el, group };
        continue;
      }

      const value = fromInputValue(def, raw);
      if (value !== undefined) record[def.key] = value;
    }
  }

  if (firstInvalid) {
    const body = firstInvalid.wrap.closest('.group-body');
    if (body && body.hidden) {
      const groupId = firstInvalid.wrap.closest('.field-group').id;
      const [prefix, , id] = [groupId.split('-grp-')[0], null, groupId.split('-grp-')[1]];
      toggleGroup(prefix, id);
    }
    firstInvalid.wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstInvalid.el.focus({ preventScroll: true });
    toast('Corrija os campos destacados antes de salvar.', 'warning');
    return { ok: false, record: null };
  }

  return { ok: true, record };
}

// ============================================================
// CRUD — Criar
// ============================================================
function openCreateModal(dataset) {
  const config = DATASETS[dataset];
  const isExtrato = dataset === 'extrato';

  if (isExtrato) {
    subcrudEmprestimos = [];
    subcrudEditingIndex = -1;
    subcrudIsAdding = false;
  }

  openModal({
    title: `Adicionar registro — ${config.label}`,
    wide: true,
    subheader: renderFormJumps(config.groups, 'create'),
    body: `<form id="recordForm" novalidate>
             ${renderFormGroups(config.groups, {}, 'create')}
             ${isExtrato ? `<div id="subcrudMount">${renderSubcrudEmprestimos()}</div>` : ''}
           </form>`,
    buttons: [
      { label: 'Cancelar', class: 'btn-secondary', action: () => closeModal() },
      { label: 'Criar registro', class: 'btn-primary', action: () => handleCreate(dataset) }
    ],
    onMount: (root) => {
      wireFormBehaviour(root);
      const form = root.querySelector('#recordForm');
      form.addEventListener('submit', (e) => { e.preventDefault(); handleCreate(dataset); });
    }
  });
}

async function handleCreate(dataset) {
  const config = DATASETS[dataset];
  const root = document.getElementById('modalBody');
  const { ok, record } = collectForm(root, config.groups);
  if (!ok) return;

  if (dataset === 'extrato') record.emprestimos = [...subcrudEmprestimos];

  try {
    const result = await api.post(`/api/mock/${dataset}`, record);
    if (result.erro) return toast(result.erro, 'error');
    toast(result.mensagem, 'success');
    closeModal();
    await loadDataset(dataset);
    renderTable(dataset);
  } catch (err) {
    toast('Erro ao criar registro: ' + err.message, 'error');
  }
}

// ============================================================
// CRUD — Editar
// ============================================================
function openEditModal(dataset, index) {
  const config = DATASETS[dataset];
  const item = dataCache[dataset][index];
  const isExtrato = dataset === 'extrato';

  if (isExtrato) {
    subcrudEmprestimos = Array.isArray(item.emprestimos)
      ? JSON.parse(JSON.stringify(item.emprestimos)) : [];
    subcrudEditingIndex = -1;
    subcrudIsAdding = false;
  }

  const extras = extraFieldsHtml(config, item, 'edit');

  openModal({
    title: `Editar — ${recordLabel(dataset, item)}`,
    wide: true,
    subheader: renderFormJumps(config.groups, 'edit'),
    body: `<form id="recordForm" novalidate>
             ${renderFormGroups(config.groups, item, 'edit')}
             ${extras}
             ${isExtrato ? `<div id="subcrudMount">${renderSubcrudEmprestimos()}</div>` : ''}
           </form>`,
    buttons: [
      { label: 'Cancelar', class: 'btn-secondary', action: () => closeModal() },
      { label: 'Salvar alterações', class: 'btn-primary', action: () => handleEdit(dataset, index) }
    ],
    onMount: (root) => {
      wireFormBehaviour(root);
      const form = root.querySelector('#recordForm');
      form.addEventListener('submit', (e) => { e.preventDefault(); handleEdit(dataset, index); });
    }
  });
}

/** Campos presentes no registro mas ausentes do schema — preservados como JSON. */
function extraFieldsHtml(config, item, prefix) {
  const known = new Set(schemaKeys(datasetIdOf(config)));
  if (config.subcrud) known.add(config.subcrud);
  const extras = Object.keys(item).filter(k => !known.has(k));
  if (extras.length === 0) return '';

  return `
    <fieldset class="field-group is-extra" id="${prefix}-grp-extras">
      <legend>
        <button type="button" class="group-toggle" aria-expanded="true"
                onclick="toggleGroup('${prefix}', 'extras')">
          <span class="group-chevron" aria-hidden="true">▾</span>
          <span aria-hidden="true">🧩</span>
          <span class="group-label">Campos fora do schema</span>
        </button>
      </legend>
      <div class="group-body">
        <p class="group-note">Presentes neste registro mas não previstos no schema. Editados como JSON.</p>
        <div class="field-grid">
          ${extras.map(k => {
            const id = fieldInputId(prefix, k);
            const raw = item[k];
            const val = typeof raw === 'object' && raw !== null ? JSON.stringify(raw, null, 2) : String(raw ?? '');
            return `
              <div class="field" style="--span:12" data-field-wrap="${escapeHtml(k)}">
                <label for="${id}">${escapeHtml(k)}</label>
                <textarea id="${id}" data-extra-field="${escapeHtml(k)}">${escapeHtml(val)}</textarea>
                <p class="field-error" hidden></p>
              </div>`;
          }).join('')}
        </div>
      </div>
    </fieldset>`;
}

function datasetIdOf(config) {
  return Object.keys(DATASETS).find(k => DATASETS[k] === config);
}

async function handleEdit(dataset, index) {
  const config = DATASETS[dataset];
  const root = document.getElementById('modalBody');
  const { ok, record } = collectForm(root, config.groups);
  if (!ok) return;

  // Campos fora do schema
  for (const el of root.querySelectorAll('[data-extra-field]')) {
    const key = el.dataset.extraField;
    const raw = el.value.trim();
    if (raw === '') continue;
    try {
      record[key] = JSON.parse(raw);
    } catch {
      record[key] = parseFieldValue(raw);
    }
  }

  if (dataset === 'extrato') record.emprestimos = [...subcrudEmprestimos];

  try {
    const result = await api.put(`/api/mock/${dataset}/${index}`, record);
    if (result.erro) return toast(result.erro, 'error');
    toast(result.mensagem, 'success');
    closeModal();
    await loadDataset(dataset);
    renderTable(dataset);
  } catch (err) {
    toast('Erro ao atualizar registro: ' + err.message, 'error');
  }
}

// ============================================================
// Ver detalhes — resumo legível + JSON
// ============================================================
function openViewModal(dataset, index) {
  const config = DATASETS[dataset];
  const item = dataCache[dataset][index];

  const summary = config.groups.map(g => `
    <section class="detail-group">
      <h4><span aria-hidden="true">${g.icon}</span> ${escapeHtml(g.label)}</h4>
      <dl class="detail-list">
        ${g.fields.map(def => `
          <div>
            <dt>${escapeHtml(def.label)}</dt>
            <dd>${escapeHtml(displayValue(def, item[def.key]))}</dd>
          </div>`).join('')}
      </dl>
    </section>`).join('');

  const emprestimos = Array.isArray(item.emprestimos) && item.emprestimos.length
    ? `<section class="detail-group">
         <h4><span aria-hidden="true">💳</span> Empréstimos (${item.emprestimos.length})</h4>
         <div class="scroll-x"><table class="subcrud-table">
           <thead><tr>${EMPRESTIMO_SUBCRUD_KEY_COLS.map(c => `<th>${escapeHtml(fieldLabel(c))}</th>`).join('')}</tr></thead>
           <tbody>${item.emprestimos.map(e => `
             <tr>${EMPRESTIMO_SUBCRUD_KEY_COLS.map(c => `<td>${escapeHtml(formatByField(c, e[c]))}</td>`).join('')}</tr>
           `).join('')}</tbody>
         </table></div>
       </section>`
    : '';

  openModal({
    title: `Detalhes — ${recordLabel(dataset, item)}`,
    wide: true,
    body: `
      <div class="tabs" role="tablist">
        <button role="tab" aria-selected="true" class="tab is-active" onclick="switchTab(this,'tab-resumo')">Resumo</button>
        <button role="tab" aria-selected="false" class="tab" onclick="switchTab(this,'tab-json')">JSON</button>
      </div>
      <div id="tab-resumo" role="tabpanel">${summary}${emprestimos}</div>
      <div id="tab-json" role="tabpanel" hidden>
        <div class="json-viewer">${escapeHtml(JSON.stringify(item, null, 2))}</div>
      </div>`,
    buttons: [
      { label: 'Fechar', class: 'btn-secondary', action: () => closeModal() },
      { label: '▶ Testar endpoint', class: 'btn-secondary', action: () => { closeModal(); openTestModal(dataset, index); } },
      { label: 'Editar', class: 'btn-primary', action: () => { closeModal(); openEditModal(dataset, index); } }
    ]
  });
}

function switchTab(btn, panelId) {
  const container = btn.closest('.modal-body');
  container.querySelectorAll('[role="tabpanel"]').forEach(p => { p.hidden = p.id !== panelId; });
  container.querySelectorAll('.tab').forEach(t => {
    const active = t === btn;
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', String(active));
  });
}

function displayValue(def, raw) {
  if (raw === null || raw === undefined || raw === '') return '—';
  switch (def.type) {
    case 'cpf': return fmt.cpf(raw);
    case 'cnpj': case 'inscricao': return fmt.cnpj(raw);
    case 'money': return 'R$ ' + fmt.money(raw);
    case 'percent': return fmt.money(raw) + ' %';
    case 'bool': return raw === true ? 'Sim' : 'Não';
    default: return formatCellValue(raw);
  }
}

function recordLabel(dataset, item) {
  const ids = DATASETS[dataset].identity
    .map(k => item[k])
    .filter(v => v !== undefined && v !== '')
    .map(v => formatCellValue(v));
  return ids.length ? ids.join(' · ') : 'registro sem identificação';
}

// ============================================================
// Testar endpoint com os dados do registro
// ============================================================
function openTestModal(dataset, index) {
  const config = DATASETS[dataset];
  const item = dataCache[dataset][index];
  const params = buildTestParams(dataset, item);

  if (!params) {
    const faltando = config.lookupFields.filter(k => item[k] === undefined || item[k] === '');
    toast(
      `Preencha os campos-chave antes de testar: ${faltando.map(fieldLabel).join(', ') || 'chave de consulta incompleta'}.`,
      'warning'
    );
    return;
  }

  const query = new URLSearchParams(params).toString();
  const url = `${config.endpoint}?${query}`;

  openModal({
    title: `Testar — ${config.label}`,
    wide: true,
    body: `
      <div class="test-url">
        <span class="badge badge-success">GET</span>
        <code id="testUrl">${escapeHtml(url)}</code>
      </div>
      <dl class="detail-list test-params">
        ${Object.entries(params).map(([k, v]) => `
          <div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd></div>`).join('')}
      </dl>
      <div id="testResult" class="test-result">
        <div class="test-pending"><span class="spinner" aria-hidden="true"></span> Consultando…</div>
      </div>`,
    buttons: [
      { label: 'Fechar', class: 'btn-secondary', action: () => closeModal() },
      { label: 'Abrir em nova aba', class: 'btn-secondary', action: () => window.open(url, '_blank') },
      { label: 'Repetir consulta', class: 'btn-primary', action: () => runTest(url) }
    ],
    onMount: () => runTest(url)
  });
}

async function runTest(url) {
  const box = document.getElementById('testResult');
  if (!box) return;
  box.innerHTML = '<div class="test-pending"><span class="spinner" aria-hidden="true"></span> Consultando…</div>';
  try {
    const resp = await fetch(url);
    const body = await resp.json();
    const ok = resp.ok;
    box.innerHTML = `
      <div class="test-status ${ok ? 'is-ok' : 'is-fail'}">
        <span class="badge ${ok ? 'badge-success' : 'badge-danger'}">HTTP ${resp.status}</span>
        <span>${ok ? 'O emulador encontrou o registro.' : 'O emulador não retornou o registro.'}</span>
      </div>
      <div class="json-viewer">${escapeHtml(JSON.stringify(body, null, 2))}</div>`;
  } catch (err) {
    box.innerHTML = `<div class="test-status is-fail">
        <span class="badge badge-danger">Falha</span><span>${escapeHtml(err.message)}</span>
      </div>`;
  }
}

// ============================================================
// Sub-CRUD: Empréstimos (dentro do formulário de Extrato)
// ============================================================
function renderSubcrudEmprestimos() {
  const items = subcrudEmprestimos;
  return `
    <div class="subcrud-container" id="subcrudContainer">
      <div class="subcrud-header">
        <div class="subcrud-header-left">
          <h4><span aria-hidden="true">💳</span> Empréstimos</h4>
          <span class="subcrud-count">${items.length}</span>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="subcrudStartAdd()">
          <span aria-hidden="true">＋</span> Adicionar empréstimo
        </button>
      </div>

      <div class="subcrud-table-wrap">
        ${items.length === 0
          ? `<div class="subcrud-empty">
               <div class="subcrud-empty-icon" aria-hidden="true">📭</div>
               <p>Nenhum empréstimo cadastrado</p>
             </div>`
          : `<div class="subcrud-table-scroll">
               <table class="subcrud-table">
                 <thead>
                   <tr>
                     <th>#</th>
                     ${EMPRESTIMO_SUBCRUD_KEY_COLS.map(c => `<th>${escapeHtml(fieldLabel(c))}</th>`).join('')}
                     <th class="col-actions">Ações</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${items.map((emp, i) => `
                     <tr>
                       <td>${i + 1}</td>
                       ${EMPRESTIMO_SUBCRUD_KEY_COLS.map(c => `
                         <td title="${escapeHtml(formatByField(c, emp[c]))}">${escapeHtml(formatByField(c, emp[c]))}</td>`).join('')}
                       <td class="col-actions">
                         <div class="subcrud-actions">
                           <button type="button" class="btn btn-ghost btn-icon btn-sm" title="Editar"
                                   aria-label="Editar empréstimo ${i + 1}" onclick="subcrudStartEdit(${i})">✏️</button>
                           <button type="button" class="btn btn-ghost btn-icon btn-sm" title="Excluir"
                                   aria-label="Excluir empréstimo ${i + 1}" onclick="subcrudDelete(${i})">🗑️</button>
                         </div>
                       </td>
                     </tr>`).join('')}
                 </tbody>
               </table>
             </div>`}
      </div>

      <div id="subcrudFormArea"></div>
    </div>`;
}

function refreshSubcrud() {
  const mount = document.getElementById('subcrudMount');
  if (!mount) return;
  mount.innerHTML = renderSubcrudEmprestimos();
}

function renderSubcrudForm(title, emprestimo) {
  return `
    <div class="subcrud-form-overlay">
      <div class="subcrud-form-header">
        <h5>${escapeHtml(title)}</h5>
        <button type="button" class="btn btn-ghost btn-sm" onclick="subcrudCancelForm()">✕ Fechar</button>
      </div>
      <div class="subcrud-form-body" id="subcrudFormBody">
        ${renderFormGroups(EMPRESTIMO_SUBCRUD_GROUPS, emprestimo || {}, 'sub')}
      </div>
      <div class="subcrud-form-footer">
        <button type="button" class="btn btn-secondary btn-sm" onclick="subcrudCancelForm()">Cancelar</button>
        <button type="button" class="btn btn-primary btn-sm" onclick="subcrudSaveForm()">Salvar empréstimo</button>
      </div>
    </div>`;
}

function subcrudStartAdd() {
  subcrudIsAdding = true;
  subcrudEditingIndex = -1;
  mountSubcrudForm('Adicionar empréstimo', null);
}

function subcrudStartEdit(idx) {
  subcrudIsAdding = false;
  subcrudEditingIndex = idx;
  mountSubcrudForm(`Editar empréstimo ${idx + 1}`, subcrudEmprestimos[idx]);
}

function mountSubcrudForm(title, emprestimo) {
  const area = document.getElementById('subcrudFormArea');
  if (!area) return;
  area.innerHTML = renderSubcrudForm(title, emprestimo);
  wireFormBehaviour(area);
  area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function subcrudCancelForm() {
  subcrudIsAdding = false;
  subcrudEditingIndex = -1;
  const area = document.getElementById('subcrudFormArea');
  if (area) area.innerHTML = '';
}

function subcrudSaveForm() {
  const root = document.getElementById('subcrudFormBody');
  const { ok, record } = collectForm(root, EMPRESTIMO_SUBCRUD_GROUPS);
  if (!ok) return;

  if (subcrudIsAdding) {
    subcrudEmprestimos.push(record);
    toast('Empréstimo adicionado à lista.', 'success');
  } else if (subcrudEditingIndex >= 0) {
    subcrudEmprestimos[subcrudEditingIndex] = record;
    toast('Empréstimo atualizado na lista.', 'success');
  }

  subcrudIsAdding = false;
  subcrudEditingIndex = -1;
  refreshSubcrud();
}

function subcrudDelete(idx) {
  subcrudEmprestimos.splice(idx, 1);
  toast('Empréstimo removido da lista.', 'info');
  refreshSubcrud();
}

// ============================================================
// Excluir
// ============================================================
function confirmDelete(dataset, index) {
  const item = dataCache[dataset][index];
  showConfirm(
    '🗑️',
    'Excluir este registro?',
    recordLabel(dataset, item) + ' — esta ação não pode ser desfeita.',
    async () => {
      try {
        const result = await api.del(`/api/mock/${dataset}/${index}`);
        if (result.erro) return toast(result.erro, 'error');
        toast(result.mensagem, 'success');
        await loadDataset(dataset);
        renderTable(dataset);
      } catch (err) {
        toast('Erro ao excluir: ' + err.message, 'error');
      }
    }
  );
}

function confirmDeleteSelected(dataset) {
  const selected = [...viewState[dataset].selected].sort((a, b) => b - a);
  if (selected.length === 0) return;

  showConfirm(
    '🗑️',
    `Excluir ${selected.length} registro${selected.length === 1 ? '' : 's'}?`,
    'Os registros selecionados serão removidos permanentemente.',
    async () => {
      try {
        // Índices em ordem decrescente para não deslocar os seguintes.
        for (const idx of selected) {
          const result = await api.del(`/api/mock/${dataset}/${idx}`);
          if (result.erro) return toast(result.erro, 'error');
        }
        toast(`${selected.length} registro(s) excluído(s).`, 'success');
        await loadDataset(dataset);
        renderTable(dataset);
      } catch (err) {
        toast('Erro ao excluir: ' + err.message, 'error');
      }
    }
  );
}

function confirmClearAll(dataset) {
  const config = DATASETS[dataset];
  const total = (dataCache[dataset] || []).length;
  showConfirm(
    '⚠️',
    `Limpar todos os registros de ${config.label}?`,
    `${total} registro(s) serão removidos permanentemente do arquivo de mock.`,
    async () => {
      try {
        const resp = await fetch(`/update-mock?dataset=${dataset}&mode=replace`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '[]'
        });
        const result = await resp.json();
        if (!resp.ok) {
          const errorMsg = result.erros?.[0]?.mensagem || result.erro || 'Erro ao limpar dados.';
          return toast(errorMsg, 'error');
        }
        toast(result.mensagem || 'Dados limpos com sucesso.', 'success');
        await loadDataset(dataset);
        renderTable(dataset);
      } catch (err) {
        toast('Erro: ' + err.message, 'error');
      }
    },
    'Limpar tudo'
  );
}

// ============================================================
// Importar / Exportar
// ============================================================
let pendingImportFile = null;

function openImportModal(dataset) {
  const config = DATASETS[dataset];

  openModal({
    title: `Importar dados — ${config.label}`,
    body: `
      <div class="import-section">
        <div class="import-zone" id="importZone">
          <div class="import-zone-icon" aria-hidden="true">📁</div>
          <h4>Arraste um arquivo aqui ou clique para selecionar</h4>
          <p>Formatos aceitos: .json e .csv (separador: ponto e vírgula)</p>
          <input type="file" id="importFileInput" accept=".json,.csv"
                 aria-label="Arquivo para importar" onchange="handleFileSelect()">
        </div>
        <fieldset class="import-options">
          <legend>Modo de importação</legend>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="importMode" value="replace" checked>
              <span><strong>Substituir</strong> — troca todos os registros existentes</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="importMode" value="append">
              <span><strong>Adicionar</strong> — mantém os atuais e acrescenta os novos</span>
            </label>
          </div>
        </fieldset>
        <div id="importPreview" class="mt-4"></div>
      </div>`,
    buttons: [
      { label: 'Cancelar', class: 'btn-secondary', action: () => closeModal() },
      { label: 'Importar', class: 'btn-primary', action: () => executeImport(dataset), id: 'importBtn', disabled: true }
    ],
    onMount: (root) => {
      const zone = root.querySelector('#importZone');
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
          root.querySelector('#importFileInput').files = e.dataTransfer.files;
          handleFileSelect();
        }
      });
    }
  });
}

function handleFileSelect() {
  const fileInput = document.getElementById('importFileInput');
  const file = fileInput.files[0];
  if (!file) return;

  pendingImportFile = file;
  const importBtn = document.getElementById('importBtn');
  if (importBtn) importBtn.disabled = false;

  document.getElementById('importPreview').innerHTML = `
    <div class="import-file">
      <span class="import-file-icon" aria-hidden="true">${file.name.endsWith('.csv') ? '📊' : '📄'}</span>
      <div>
        <div class="import-file-name">${escapeHtml(file.name)}</div>
        <div class="import-file-size">${formatFileSize(file.size)}</div>
      </div>
      <span class="badge badge-success">Pronto para importar</span>
    </div>`;
}

async function executeImport(dataset) {
  if (!pendingImportFile) return toast('Selecione um arquivo antes de importar.', 'warning');

  const mode = document.querySelector('input[name="importMode"]:checked')?.value || 'replace';
  try {
    const result = await api.upload(`/api/mock/${dataset}/import?mode=${mode}`, pendingImportFile);
    if (result.erro) return toast(result.erro, 'error');
    toast(result.mensagem, 'success');
    pendingImportFile = null;
    closeModal();
    await loadDataset(dataset);
    renderTable(dataset);
  } catch (err) {
    toast('Erro na importação: ' + err.message, 'error');
  }
}

function exportDataset(dataset) {
  window.open(`/api/mock/${dataset}/export`, '_blank');
  toast('Download iniciado.', 'info');
}

// ============================================================
// Modal
// ============================================================
function openModal({ title, body, buttons, wide = false, onMount = null, subheader = '' }) {
  const overlay = document.getElementById('modalOverlay');
  const modalEl = document.getElementById('modalContainer');
  const bodyEl = document.getElementById('modalBody');
  const footerEl = document.getElementById('modalFooter');
  const subEl = document.getElementById('modalSubheader');

  lastFocusedElement = document.activeElement;

  document.getElementById('modalTitle').textContent = title;
  bodyEl.innerHTML = body;
  subEl.innerHTML = subheader;
  subEl.hidden = subheader === '';
  modalEl.classList.toggle('modal-wide', wide);

  footerEl.innerHTML = '';
  buttons.forEach(btn => {
    const button = document.createElement('button');
    button.className = `btn ${btn.class}`;
    button.type = 'button';
    if (btn.id) button.id = btn.id;
    if (btn.disabled) button.disabled = true;
    button.textContent = btn.label;
    button.onclick = btn.action;
    footerEl.appendChild(button);
  });

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  if (onMount) onMount(bodyEl);

  bodyEl.scrollTop = 0;
  const firstField = bodyEl.querySelector('input:not([type=hidden]), select, textarea');
  (firstField || document.querySelector('#modalContainer .modal-close')).focus();
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('active');
  document.getElementById('modalSubheader').hidden = true;
  document.body.style.overflow = '';
  pendingImportFile = null;
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

// ============================================================
// Diálogo de confirmação
// ============================================================
function showConfirm(icon, message, sub, callback, confirmLabel = 'Confirmar') {
  document.getElementById('confirmIcon').textContent = icon;
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmSub').textContent = sub;
  document.getElementById('confirmBtn').textContent = confirmLabel;
  confirmCallback = callback;
  lastFocusedElement = document.activeElement;
  document.getElementById('confirmOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  document.getElementById('confirmBtn').focus();
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('active');
  document.body.style.overflow = '';
  confirmCallback = null;
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

async function confirmAction() {
  const cb = confirmCallback;
  closeConfirm();
  if (cb) await cb();
}

// ============================================================
// Toasts
// ============================================================
function toast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span class="toast-icon" aria-hidden="true">${icons[type]}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// ============================================================
// Utilidades
// ============================================================
function fieldLabel(key) {
  const def = fieldDef(key);
  if (def) return def.label;
  if (key === 'emprestimos') return 'Empréstimos';
  return key
    .replace(/\./g, ' › ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function formatCellValue(val) {
  if (val === null || val === undefined || val === '') return '—';
  if (Array.isArray(val)) return `${val.length} itens`;
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  return String(val);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================================
// Teclado: Escape fecha, Tab fica preso no diálogo aberto
// ============================================================
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function activeDialog() {
  const confirmOverlay = document.getElementById('confirmOverlay');
  if (confirmOverlay.classList.contains('active')) return confirmOverlay.querySelector('.modal');
  const modalOverlay = document.getElementById('modalOverlay');
  if (modalOverlay.classList.contains('active')) return modalOverlay.querySelector('.modal');
  return null;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.querySelector('.menu-panel:not([hidden])')) return closeMenus();
    if (document.getElementById('confirmOverlay').classList.contains('active')) return closeConfirm();
    if (document.getElementById('modalOverlay').classList.contains('active')) return closeModal();
    return;
  }

  if (e.key !== 'Tab') return;
  const dialog = activeDialog();
  if (!dialog) return;

  const items = [...dialog.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

// Clique no fundo não fecha o diálogo — apenas sinaliza com um tremor.
function shakeDialog(overlay) {
  const modal = overlay.querySelector('.modal');
  if (!modal) return;
  modal.classList.remove('modal-shake');
  void modal.offsetWidth;
  modal.classList.add('modal-shake');
}

document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) shakeDialog(e.currentTarget);
});

document.getElementById('confirmOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) shakeDialog(e.currentTarget);
});
