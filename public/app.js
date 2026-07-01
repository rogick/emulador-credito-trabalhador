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
// Estado da aplicação
// ============================================================
let currentPage = 'dashboard';
let dataCache = {};           // { consignacoes: [...], extrato: [...], emprestimo: [...] }
let searchFilters = {};       // { consignacoes: 'searchterm', ... }
let confirmCallback = null;   // callback para o diálogo de confirmação

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
  const fields = getFieldsForDataset(dataset);

  openModal(`Adicionar Registro — ${config.label}`, () => {
    const formHtml = `
      <div class="form-grid">
        ${fields.map(f => {
          const escF = escapeHtml(f);
          const escLabel = escapeHtml(formatColumnName(f));
          return `
            <div class="form-group${f === 'emprestimos' ? ' full-width' : ''}">
              <label for="field-${escF}">${escLabel}</label>
              ${f === 'emprestimos'
                ? `<textarea id="field-${escF}" placeholder='[{"ifConcessora.codigo": 104, ...}]'></textarea>`
                : `<input type="text" id="field-${escF}" placeholder="${escF}">`
              }
            </div>`;
        }).join('')}
      </div>
    `;
    return formHtml;
  }, [
    { label: 'Cancelar', class: 'btn-secondary', action: () => closeModal() },
    { label: 'Criar Registro', class: 'btn-primary', action: () => handleCreate(dataset) }
  ]);
}

async function handleCreate(dataset) {
  const fields = getFieldsForDataset(dataset);
  const record = {};

  for (const f of fields) {
    const el = document.getElementById(`field-${f}`);
    if (!el) continue;
    const val = el.value.trim();
    if (val === '') continue;

    if (f === 'emprestimos') {
      try {
        record[f] = JSON.parse(val);
      } catch {
        toast('Campo "emprestimos" deve ser um JSON válido.', 'error');
        return;
      }
    } else {
      record[f] = parseFieldValue(val);
    }
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
  // Use actual keys from the item, merged with allFields for completeness
  const fields = [...new Set([...Object.keys(item), ...config.allFields])];

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
    `;
    return formHtml;
  }, [
    { label: 'Cancelar', class: 'btn-secondary', action: () => closeModal() },
    { label: 'Salvar Alterações', class: 'btn-primary', action: () => handleEdit(dataset, index, fields, item) }
  ]);
}

async function handleEdit(dataset, index, fields, originalItem) {
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
function openModal(title, contentFn, buttons) {
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const bodyEl = document.getElementById('modalBody');
  const footerEl = document.getElementById('modalFooter');

  titleEl.textContent = title;
  bodyEl.innerHTML = contentFn();

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

// Close modals by clicking overlay
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('confirmOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeConfirm();
});
