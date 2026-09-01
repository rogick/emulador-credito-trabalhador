/**
 * app.js — Lógica da interface web do Emulador de Crédito Trabalhador
 * Vanilla JS — CRUD, Importação CSV/JSON, Exportação
 */

// ============================================================
// Configuração dos datasets e seus campos-chave para exibição
// ============================================================
const DATASETS = {
  consignacoes: {
    label: 'Consignações',
    icon: '📋',
    endpoint: '/dados-consignacoes-empregador',
    description: 'Dados de consignações para empregadores (GET /dados-consignacoes-empregador)',
    keyColumns: [
      'contrato', 'cpf', 'nomeTrabalhador', 'nomeEmpregador',
      'numeroInscricaoEmpregador', 'competencia', 'valorParcela',
      'totalParcelas', 'valorEmprestimo', 'dataInicioContrato', 'dataFimContrato'
    ],
    allFields: [
      'ifConcessora.codigo', 'ifConcessora.descricao', 'contrato', 'cpf', 'matricula',
      'inscricaoEmpregador.codigo', 'inscricaoEmpregador.descricao', 'numeroInscricaoEmpregador',
      'nomeTrabalhador', 'nomeEmpregador', 'dataInicioContrato', 'dataFimContrato',
      'competenciaInicioDesconto', 'competenciaFimDesconto', 'totalParcelas', 'valorParcela',
      'valorEmprestimo', 'valorLiberado', 'qtdPagamentos', 'qtdEscrituracoes',
      'categoriaTrabalhador.codigo', 'categoriaTrabalhador.descricao', 'competencia',
      'inscricaoEstabelecimento.codigo', 'inscricaoEstabelecimento.descricao',
      'numeroInscricaoEstabelecimento', 'dataAdmissao'
    ]
  },
  extrato: {
    label: 'Extrato Trabalhador',
    icon: '📄',
    endpoint: '/extrato-trabalhador-empregador',
    description: 'Extrato do trabalhador para empregadores (GET /extrato-trabalhador-empregador)',
    keyColumns: [
      'cpf', 'matricula', 'nomeTrabalhador', 'nomeEmpregador',
      'numeroInscricaoEmpregador', 'emprestimos'
    ],
    allFields: [
      'cpf', 'matricula', 'inscricaoEmpregador.codigo', 'inscricaoEmpregador.descricao',
      'numeroInscricaoEmpregador', 'nomeTrabalhador', 'nomeEmpregador', 'emprestimos'
    ]
  },
  emprestimo: {
    label: 'Empréstimo',
    icon: '💳',
    endpoint: '/emprestimo-trabalhador',
    description: 'Consulta de empréstimo unitário (GET /emprestimo-trabalhador)',
    keyColumns: [
      'contrato', 'cpf', 'nomeTrabalhador', 'nomeEmpregador',
      'numeroInscricaoEmpregador', 'valorParcela', 'totalParcelas',
      'valorEmprestimo', 'situacaoEmprestimo.descricao'
    ],
    allFields: [
      'ifConcessora.codigo', 'ifConcessora.descricao', 'contrato', 'cpf', 'matricula',
      'inscricaoEmpregador.codigo', 'inscricaoEmpregador.descricao', 'numeroInscricaoEmpregador',
      'nomeTrabalhador', 'nomeEmpregador', 'dataInicioContrato', 'dataFimContrato',
      'competenciaInicioDesconto', 'competenciaFimDesconto',
      'situacaoEmprestimo.codigo', 'situacaoEmprestimo.descricao',
      'totalParcelas', 'valorParcela', 'valorEmprestimo', 'valorLiberado', 'valorSaldoDevedor',
      'garantia.temGarantias', 'garantia.valorSaldoDisponivelGarantiaFgts',
      'garantia.valorMultaRescisoriaGarantiaFgts', 'garantia.percVerbaRescisoriaGarantia'
    ]
  }
};

// ============================================================
// Campos do sub-CRUD de empréstimos dentro do Extrato
// ============================================================
const EMPRESTIMO_SUBCRUD_FIELDS = [
  'ifConcessora.codigo', 'ifConcessora.descricao', 'contrato',
  'situacaoEmprestimo.codigo', 'situacaoEmprestimo.descricao',
  'competenciaInicioDesconto', 'competenciaFimDesconto',
  'dataInicioContrato', 'dataFimContrato',
  'totalParcelas', 'valorParcela', 'valorEmprestimo', 'valorLiberado', 'valorSaldoDevedor',
  'garantia.temGarantias', 'garantia.valorSaldoDisponivelGarantiaFgts',
  'garantia.valorMultaRescisoriaGarantiaFgts', 'garantia.percVerbaRescisoriaGarantia'
];

// Colunas resumidas para exibição na tabela do sub-CRUD
const EMPRESTIMO_SUBCRUD_KEY_COLS = [
  'ifConcessora.descricao', 'contrato', 'situacaoEmprestimo.descricao',
  'valorParcela', 'totalParcelas', 'valorEmprestimo'
];

// Campos do extrato SEM empréstimos (para o formulário principal)
const EXTRATO_MAIN_FIELDS = [
  'cpf', 'matricula', 'inscricaoEmpregador.codigo', 'inscricaoEmpregador.descricao',
  'numeroInscricaoEmpregador', 'nomeTrabalhador', 'nomeEmpregador'
];

// ============================================================
// Estado da aplicação
// ============================================================
let currentPage = 'dashboard';
let dataCache = {};           // { consignacoes: [...], extrato: [...], emprestimo: [...] }
let searchFilters = {};       // { consignacoes: 'searchterm', ... }
let confirmCallback = null;   // callback para o diálogo de confirmação

// Sub-CRUD state for emprestimos
let subcrudEmprestimos = [];       // current list of emprestimos being edited
let subcrudEditingIndex = -1;      // -1 = not editing, >= 0 = editing that loan index
let subcrudIsAdding = false;       // true when adding a new emprestimo
let subcrudCurrentDataset = null;  // 'create' or 'edit'
let subcrudParentIndex = -1;       // parent record index (for edit mode)

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
// Inicialização
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllDatasets();
  checkServerHealth();
  renderCurrentPage();
});

// ============================================================
// Carregamento de dados
// ============================================================
async function loadAllDatasets() {
  try {
    const results = await Promise.all([
      api.get('/api/mock/consignacoes'),
      api.get('/api/mock/extrato'),
      api.get('/api/mock/emprestimo')
    ]);
    dataCache.consignacoes = results[0].registros;
    dataCache.extrato = results[1].registros;
    dataCache.emprestimo = results[2].registros;
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
    updateBadges();
    updateDashboardStats();
  } catch (err) {
    toast('Erro ao carregar dataset: ' + err.message, 'error');
  }
}

async function checkServerHealth() {
  try {
    const result = await api.get('/health');
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const stat = document.getElementById('stat-status');
    if (result.status === 'UP') {
      dot.classList.remove('offline');
      text.textContent = 'Servidor ativo';
      stat.textContent = 'UP';
      stat.style.color = '#34d399';
    }
  } catch {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const stat = document.getElementById('stat-status');
    dot.classList.add('offline');
    text.textContent = 'Servidor offline';
    stat.textContent = 'DOWN';
    stat.style.color = '#f87171';
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

// ============================================================
// Navegação
// ============================================================
function navigateTo(page) {
  currentPage = page;

  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Show correct page
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) {
    pageEl.classList.add('active');
  }

  // Render dataset page if needed
  if (page !== 'dashboard') {
    renderDatasetPage(page);
  }

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function renderCurrentPage() {
  if (currentPage !== 'dashboard') {
    renderDatasetPage(currentPage);
  }
}

// ============================================================
// Render Dataset Page
// ============================================================
function renderDatasetPage(dataset) {
  const config = DATASETS[dataset];
  const data = dataCache[dataset] || [];
  const filter = (searchFilters[dataset] || '').toLowerCase();

  const filteredData = filter
    ? data.filter(item => {
        return Object.values(item).some(val => {
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          return str.toLowerCase().includes(filter);
        });
      })
    : data;

  // Build a Map of items to their original indices in `data` to achieve O(1) index lookup
  const itemToIdxMap = new Map();
  data.forEach((item, idx) => itemToIdxMap.set(item, idx));

  const pageEl = document.getElementById(`page-${dataset}`);

  pageEl.innerHTML = `
    <div class="page-header">
      <h2>${config.icon} ${config.label}</h2>
      <p>${config.description}</p>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="search-box">
        <span class="search-box-icon">🔍</span>
        <input type="text" id="search-${dataset}" placeholder="Buscar registros..."
               value="${escapeHtml(searchFilters[dataset] || '')}"
               oninput="handleSearch('${dataset}', this.value)">
      </div>
      <div class="toolbar-actions">
        <button class="btn btn-primary" onclick="openCreateModal('${dataset}')">
          ＋ Adicionar
        </button>
        <button class="btn btn-secondary" onclick="openImportModal('${dataset}')">
          📥 Importar
        </button>
        <button class="btn btn-secondary" onclick="exportDataset('${dataset}')">
          📤 Exportar JSON
        </button>
        <button class="btn btn-danger btn-sm" onclick="confirmClearAll('${dataset}')">
          🗑️ Limpar Tudo
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      ${filteredData.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <h3>Nenhum registro encontrado</h3>
            <p>${filter ? 'Nenhum resultado para a busca. Tente outro termo.' : 'Adicione registros ou importe um arquivo CSV/JSON.'}</p>
           </div>`
        : `<div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  ${config.keyColumns.map(col => `<th>${escapeHtml(formatColumnName(col))}</th>`).join('')}
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${filteredData.map((item, filteredIdx) => {
                  // Find the real index in the original data array
                  const realIdx = itemToIdxMap.get(item);
                  return `
                  <tr>
                    <td>${realIdx}</td>
                    ${config.keyColumns.map(col => `<td title="${escapeHtml(formatCellValue(item[col]))}">${escapeHtml(formatCellValue(item[col]))}</td>`).join('')}
                    <td>
                      <div class="actions-cell">
                        <button class="btn btn-ghost btn-icon btn-sm" title="Ver detalhes" onclick="openViewModal('${dataset}', ${realIdx})">👁️</button>
                        <button class="btn btn-ghost btn-icon btn-sm" title="Editar" onclick="openEditModal('${dataset}', ${realIdx})">✏️</button>
                        <button class="btn btn-ghost btn-icon btn-sm" title="Excluir" onclick="confirmDelete('${dataset}', ${realIdx})">🗑️</button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
           </div>
           <div class="table-footer">
             <span>Exibindo ${filteredData.length} de ${data.length} registros</span>
           </div>`
      }
    </div>
  `;
}

// ============================================================
// Search
// ============================================================
function handleSearch(dataset, value) {
  searchFilters[dataset] = value;
  renderDatasetPage(dataset);
}

// ============================================================
// CRUD Operations
// ============================================================

// --- CREATE ---
function openCreateModal(dataset) {
  const config = DATASETS[dataset];
  const isExtrato = dataset === 'extrato';
  const fields = isExtrato ? EXTRATO_MAIN_FIELDS : getFieldsForDataset(dataset);

  // Initialize sub-CRUD state for extrato
  if (isExtrato) {
    subcrudEmprestimos = [];
    subcrudEditingIndex = -1;
    subcrudIsAdding = false;
    subcrudCurrentDataset = 'create';
    subcrudParentIndex = -1;
  }

  openModal(`Adicionar Registro — ${config.label}`, () => {
    const formHtml = `
      <div class="form-grid">
        ${fields.map(f => {
          const escF = escapeHtml(f);
          const escLabel = escapeHtml(formatColumnName(f));
          return `
            <div class="form-group">
              <label for="field-${escF}">${escLabel}</label>
              <input type="text" id="field-${escF}" placeholder="${escF}">
            </div>`;
        }).join('')}
      </div>
      ${isExtrato ? renderSubcrudEmprestimos() : ''}
    `;
    return formHtml;
  }, [
    { label: 'Cancelar', class: 'btn-secondary', action: () => closeModal() },
    { label: 'Criar Registro', class: 'btn-primary', action: () => handleCreate(dataset) }
  ], isExtrato);
}

async function handleCreate(dataset) {
  const isExtrato = dataset === 'extrato';
  const fields = isExtrato ? EXTRATO_MAIN_FIELDS : getFieldsForDataset(dataset);
  const record = {};

  for (const f of fields) {
    const el = document.getElementById(`field-${f}`);
    if (!el) continue;
    const val = el.value.trim();
    if (val === '') continue;
    record[f] = parseFieldValue(val);
  }

  // Attach sub-CRUD emprestimos for extrato
  if (isExtrato) {
    record.emprestimos = [...subcrudEmprestimos];
  }

  try {
    const result = await api.post(`/api/mock/${dataset}`, record);
    if (result.erro) {
      toast(result.erro, 'error');
      return;
    }
    toast(result.mensagem, 'success');
    closeModal();
    await loadDataset(dataset);
    renderDatasetPage(dataset);
  } catch (err) {
    toast('Erro ao criar registro: ' + err.message, 'error');
  }
}

// --- VIEW ---
function openViewModal(dataset, index) {
  const config = DATASETS[dataset];
  const item = dataCache[dataset][index];

  openModal(`Detalhes — ${config.label} #${index}`, () => {
    return `<div class="json-viewer">${escapeHtml(JSON.stringify(item, null, 2))}</div>`;
  }, [
    { label: 'Fechar', class: 'btn-secondary', action: () => closeModal() },
    { label: 'Editar', class: 'btn-primary', action: () => { closeModal(); openEditModal(dataset, index); } }
  ]);
}

// --- EDIT ---
function openEditModal(dataset, index) {
  const config = DATASETS[dataset];
  const item = dataCache[dataset][index];
  const isExtrato = dataset === 'extrato';

  // For extrato, separate main fields from emprestimos
  let fields;
  if (isExtrato) {
    fields = [...new Set([...Object.keys(item).filter(k => k !== 'emprestimos'), ...EXTRATO_MAIN_FIELDS])];
    subcrudEmprestimos = Array.isArray(item.emprestimos) ? JSON.parse(JSON.stringify(item.emprestimos)) : [];
    subcrudEditingIndex = -1;
    subcrudIsAdding = false;
    subcrudCurrentDataset = 'edit';
    subcrudParentIndex = index;
  } else {
    fields = [...new Set([...Object.keys(item), ...config.allFields])];
  }

  openModal(`Editar Registro — ${config.label} #${index}`, () => {
    const formHtml = `
      <div class="form-grid">
        ${fields.map(f => {
          const rawVal = item[f];
          const isComplex = typeof rawVal === 'object' && rawVal !== null;
          const displayVal = isComplex ? JSON.stringify(rawVal, null, 2) : (rawVal ?? '');
          const escF = escapeHtml(f);
          const escLabel = escapeHtml(formatColumnName(f));
          return `
            <div class="form-group${isComplex ? ' full-width' : ''}">
              <label for="edit-field-${escF}">${escLabel}</label>
              ${isComplex
                ? `<textarea id="edit-field-${escF}">${escapeHtml(String(displayVal))}</textarea>`
                : `<input type="text" id="edit-field-${escF}" value="${escapeHtml(String(displayVal))}">`
              }
            </div>`;
        }).join('')}
      </div>
      ${isExtrato ? renderSubcrudEmprestimos() : ''}
    `;
    return formHtml;
  }, [
    { label: 'Cancelar', class: 'btn-secondary', action: () => closeModal() },
    { label: 'Salvar Alterações', class: 'btn-primary', action: () => handleEdit(dataset, index, fields, item) }
  ], isExtrato);
}

async function handleEdit(dataset, index, fields, originalItem) {
  const isExtrato = dataset === 'extrato';
  const record = {};

  for (const f of fields) {
    const el = document.getElementById(`edit-field-${f}`);
    if (!el) continue;
    const val = el.value.trim();

    const originalVal = originalItem[f];
    const isComplex = typeof originalVal === 'object' && originalVal !== null;

    if (isComplex) {
      if (val === '') {
        record[f] = originalVal;
      } else {
        try {
          record[f] = JSON.parse(val);
        } catch {
          toast(`Campo "${f}" deve ser um JSON válido.`, 'error');
          return;
        }
      }
    } else {
      record[f] = val === '' ? '' : parseFieldValue(val);
    }
  }

  // Attach sub-CRUD emprestimos for extrato
  if (isExtrato) {
    record.emprestimos = [...subcrudEmprestimos];
  }

  try {
    const result = await api.put(`/api/mock/${dataset}/${index}`, record);
    if (result.erro) {
      toast(result.erro, 'error');
      return;
    }
    toast(result.mensagem, 'success');
    closeModal();
    await loadDataset(dataset);
    renderDatasetPage(dataset);
  } catch (err) {
    toast('Erro ao atualizar registro: ' + err.message, 'error');
  }
}

// ============================================================
// Sub-CRUD: Empréstimos (dentro do formulário Extrato)
// ============================================================

/**
 * Renders the full sub-CRUD HTML for emprestimos.
 */
function renderSubcrudEmprestimos() {
  const items = subcrudEmprestimos;
  return `
    <div class="subcrud-container" id="subcrudContainer">
      <div class="subcrud-header">
        <div class="subcrud-header-left">
          <h4>💳 Empréstimos</h4>
          <span class="subcrud-count">${items.length}</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="subcrudStartAdd()">
          ＋ Adicionar Empréstimo
        </button>
      </div>

      <div class="subcrud-table-wrap">
        ${items.length === 0
          ? `<div class="subcrud-empty">
               <div class="subcrud-empty-icon">📭</div>
               <p>Nenhum empréstimo cadastrado</p>
             </div>`
          : `<div class="subcrud-table-scroll">
               <table class="subcrud-table">
                 <thead>
                   <tr>
                     <th>#</th>
                     ${EMPRESTIMO_SUBCRUD_KEY_COLS.map(c => `<th>${escapeHtml(formatColumnName(c))}</th>`).join('')}
                     <th>Ações</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${items.map((emp, i) => `
                     <tr>
                       <td>${i}</td>
                       ${EMPRESTIMO_SUBCRUD_KEY_COLS.map(c => `<td title="${escapeHtml(formatCellValue(emp[c]))}">${escapeHtml(formatCellValue(emp[c]))}</td>`).join('')}
                       <td>
                         <div class="subcrud-actions">
                           <button class="btn btn-ghost btn-icon btn-sm" title="Editar" onclick="subcrudStartEdit(${i})">✏️</button>
                           <button class="btn btn-ghost btn-icon btn-sm" title="Excluir" onclick="subcrudDelete(${i})">🗑️</button>
                         </div>
                       </td>
                     </tr>
                   `).join('')}
                 </tbody>
               </table>
             </div>`
        }
      </div>

      <div id="subcrudFormArea"></div>
    </div>
  `;
}

/**
 * Re-renders only the sub-CRUD section inside the modal, preserving main form values.
 */
function refreshSubcrud() {
  const container = document.getElementById('subcrudContainer');
  if (!container) return;
  // Create a temporary element to parse the new HTML
  const temp = document.createElement('div');
  temp.innerHTML = renderSubcrudEmprestimos();
  container.replaceWith(temp.firstElementChild);
}

/**
 * Renders the inline add/edit form for a single empréstimo.
 */
function renderSubcrudForm(title, emprestimo) {
  const fields = EMPRESTIMO_SUBCRUD_FIELDS;
  return `
    <div class="subcrud-form-overlay">
      <div class="subcrud-form-header">
        <h5>${escapeHtml(title)}</h5>
        <button class="btn btn-ghost btn-sm" onclick="subcrudCancelForm()">✕ Fechar</button>
      </div>
      <div class="subcrud-form-body">
        <div class="form-grid">
          ${fields.map(f => {
            const val = emprestimo ? (emprestimo[f] ?? '') : '';
            const escF = escapeHtml(f);
            const escLabel = escapeHtml(formatColumnName(f));
            return `
              <div class="form-group">
                <label for="subcrud-field-${escF}">${escLabel}</label>
                <input type="text" id="subcrud-field-${escF}" value="${escapeHtml(String(val))}" placeholder="${escF}">
              </div>`;
          }).join('')}
        </div>
      </div>
      <div class="subcrud-form-footer">
        <button class="btn btn-secondary btn-sm" onclick="subcrudCancelForm()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="subcrudSaveForm()">Salvar</button>
      </div>
    </div>
  `;
}

function subcrudStartAdd() {
  subcrudIsAdding = true;
  subcrudEditingIndex = -1;
  const area = document.getElementById('subcrudFormArea');
  if (area) area.innerHTML = renderSubcrudForm('Adicionar Empréstimo', null);
}

function subcrudStartEdit(idx) {
  subcrudIsAdding = false;
  subcrudEditingIndex = idx;
  const emp = subcrudEmprestimos[idx];
  const area = document.getElementById('subcrudFormArea');
  if (area) area.innerHTML = renderSubcrudForm(`Editar Empréstimo #${idx}`, emp);
}

function subcrudCancelForm() {
  subcrudIsAdding = false;
  subcrudEditingIndex = -1;
  const area = document.getElementById('subcrudFormArea');
  if (area) area.innerHTML = '';
}

function subcrudSaveForm() {
  const fields = EMPRESTIMO_SUBCRUD_FIELDS;
  const record = {};

  for (const f of fields) {
    const el = document.getElementById(`subcrud-field-${f}`);
    if (!el) continue;
    const val = el.value.trim();
    if (val === '') continue;
    record[f] = parseFieldValue(val);
  }

  if (subcrudIsAdding) {
    subcrudEmprestimos.push(record);
    toast('Empréstimo adicionado.', 'success');
  } else if (subcrudEditingIndex >= 0) {
    subcrudEmprestimos[subcrudEditingIndex] = record;
    toast('Empréstimo atualizado.', 'success');
  }

  subcrudIsAdding = false;
  subcrudEditingIndex = -1;
  refreshSubcrud();
}

function subcrudDelete(idx) {
  subcrudEmprestimos.splice(idx, 1);
  toast('Empréstimo removido.', 'info');
  refreshSubcrud();
}

// --- DELETE ---
function confirmDelete(dataset, index) {
  showConfirm(
    '🗑️',
    `Excluir registro #${index}?`,
    'Esta ação não pode ser desfeita.',
    async () => {
      try {
        const result = await api.del(`/api/mock/${dataset}/${index}`);
        if (result.erro) {
          toast(result.erro, 'error');
          return;
        }
        toast(result.mensagem, 'success');
        await loadDataset(dataset);
        renderDatasetPage(dataset);
      } catch (err) {
        toast('Erro ao excluir: ' + err.message, 'error');
      }
    }
  );
}

// --- CLEAR ALL ---
function confirmClearAll(dataset) {
  const config = DATASETS[dataset];
  showConfirm(
    '⚠️',
    `Limpar todos os registros de ${config.label}?`,
    'Todos os dados serão removidos permanentemente.',
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
          toast(errorMsg, 'error');
          return;
        }
        toast(result.mensagem || 'Dados limpos com sucesso.', 'success');
        await loadDataset(dataset);
        renderDatasetPage(dataset);
      } catch (err) {
        toast('Erro: ' + err.message, 'error');
      }
    }
  );
}

// ============================================================
// Import / Export
// ============================================================
function openImportModal(dataset) {
  const config = DATASETS[dataset];

  openModal(`Importar Dados — ${config.label}`, () => {
    return `
      <div class="import-section">
        <div class="import-zone" id="importZone">
          <div class="import-zone-icon">📁</div>
          <h4>Arraste um arquivo aqui ou clique para selecionar</h4>
          <p>Formatos aceitos: .json, .csv (separador: ponto e vírgula)</p>
          <input type="file" id="importFileInput" accept=".json,.csv" onchange="handleFileSelect('${dataset}')">
        </div>
        <div class="import-options">
          <label>Modo de importação:</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="importMode" value="replace" checked>
              Substituir (replace)
            </label>
            <label class="radio-option">
              <input type="radio" name="importMode" value="append">
              Adicionar (append)
            </label>
          </div>
        </div>
        <div id="importPreview" class="mt-4"></div>
      </div>
    `;
  }, [
    { label: 'Cancelar', class: 'btn-secondary', action: () => closeModal() },
    { label: 'Importar', class: 'btn-primary', action: () => executeImport(dataset), id: 'importBtn', disabled: true }
  ]);

  // Set up drag and drop after DOM is rendered
  setTimeout(() => {
    const zone = document.getElementById('importZone');
    if (!zone) return;
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const fileInput = document.getElementById('importFileInput');
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        handleFileSelect(dataset);
      }
    });
  }, 100);
}

let pendingImportFile = null;

function handleFileSelect(dataset) {
  const fileInput = document.getElementById('importFileInput');
  const file = fileInput.files[0];
  if (!file) return;

  pendingImportFile = file;

  const preview = document.getElementById('importPreview');
  const importBtn = document.getElementById('importBtn');
  if (importBtn) importBtn.disabled = false;

  // Show file info preview
  preview.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; padding:12px 16px; background:var(--bg-card); border:1px solid var(--border-card); border-radius:var(--radius-md);">
      <span style="font-size:1.5rem">${file.name.endsWith('.csv') ? '📊' : '📄'}</span>
      <div>
        <div style="font-weight:600; color:var(--text-primary)">${escapeHtml(file.name)}</div>
        <div style="font-size:0.78rem; color:var(--text-muted)">${formatFileSize(file.size)}</div>
      </div>
      <span class="badge badge-success" style="margin-left:auto">Pronto para importar</span>
    </div>
  `;
}

async function executeImport(dataset) {
  if (!pendingImportFile) {
    toast('Selecione um arquivo antes de importar.', 'warning');
    return;
  }

  const mode = document.querySelector('input[name="importMode"]:checked')?.value || 'replace';

  try {
    const result = await api.upload(`/api/mock/${dataset}/import?mode=${mode}`, pendingImportFile);
    if (result.erro) {
      toast(result.erro, 'error');
      return;
    }
    toast(result.mensagem, 'success');
    pendingImportFile = null;
    closeModal();
    await loadDataset(dataset);
    renderDatasetPage(dataset);
  } catch (err) {
    toast('Erro na importação: ' + err.message, 'error');
  }
}

function exportDataset(dataset) {
  window.open(`/api/mock/${dataset}/export`, '_blank');
  toast('Download iniciado.', 'info');
}

// ============================================================
// Modal System
// ============================================================
function openModal(title, contentFn, buttons, wide = false) {
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const bodyEl = document.getElementById('modalBody');
  const footerEl = document.getElementById('modalFooter');
  const modalEl = document.getElementById('modalContainer');

  titleEl.textContent = title;
  bodyEl.innerHTML = contentFn();

  // Apply wide class for sub-CRUD modals
  modalEl.classList.toggle('modal-wide', wide);

  footerEl.innerHTML = '';
  buttons.forEach(btn => {
    const button = document.createElement('button');
    button.className = `btn ${btn.class}`;
    if (btn.id) button.id = btn.id;
    if (btn.disabled) button.disabled = true;
    button.textContent = btn.label;
    button.onclick = btn.action;
    footerEl.appendChild(button);
  });

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  pendingImportFile = null;
}

// ============================================================
// Confirm Dialog
// ============================================================
function showConfirm(icon, message, sub, callback) {
  document.getElementById('confirmIcon').textContent = icon;
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmSub').textContent = sub;
  confirmCallback = callback;
  document.getElementById('confirmOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('active');
  document.body.style.overflow = '';
  confirmCallback = null;
}

async function confirmAction() {
  if (confirmCallback) {
    await confirmCallback();
  }
  closeConfirm();
}

// ============================================================
// Toast Notifications
// ============================================================
function toast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${escapeHtml(message)}</span>`;

  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// ============================================================
// Utility Functions
// ============================================================
function getFieldsForDataset(dataset) {
  const config = DATASETS[dataset];
  // If we have data, use the first record's keys as a reference, otherwise fall back to allFields
  const data = dataCache[dataset] || [];
  if (data.length > 0) {
    return [...new Set([...Object.keys(data[0]), ...config.allFields])];
  }
  return config.allFields;
}

function formatColumnName(name) {
  // Convert dot-notation field names to readable labels
  return name
    .replace(/\./g, ' › ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function formatCellValue(val) {
  if (val === null || val === undefined) return '—';
  if (Array.isArray(val)) return `[${val.length} itens]`;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function parseFieldValue(val) {
  // Try to parse as number, boolean, etc. Keep strings as-is if they look like codes
  if (val === 'true') return true;
  if (val === 'false') return false;
  // Don't parse strings that start with 0 as numbers (e.g., CPF "068...")
  if (/^0\d/.test(val)) return val;
  // Don't parse very long numeric strings as numbers (precision loss)
  if (/^\d+$/.test(val) && val.length <= 15) {
    const num = Number(val);
    if (!isNaN(num) && String(num) === val) return num;
  }
  // Try float
  if (/^\d+[.,]\d+$/.test(val)) {
    const num = Number(val.replace(',', '.'));
    if (!isNaN(num)) return num;
  }
  return val;
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

// Close modals with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('confirmOverlay').classList.contains('active')) {
      closeConfirm();
    } else if (document.getElementById('modalOverlay').classList.contains('active')) {
      closeModal();
    }
  }
});

// Popups não fecham ao clicar fora (backdrop / overlay)
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    const modal = document.getElementById('modalContainer');
    if (modal) {
      modal.classList.remove('modal-shake');
      void modal.offsetWidth; // Força reflow para reiniciar animação
      modal.classList.add('modal-shake');
    }
  }
});

document.getElementById('confirmOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    const confirmModal = e.currentTarget.querySelector('.modal');
    if (confirmModal) {
      confirmModal.classList.remove('modal-shake');
      void confirmModal.offsetWidth;
      confirmModal.classList.add('modal-shake');
    }
  }
});
