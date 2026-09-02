/**
 * schema.js — Metadados dos campos dos datasets do emulador.
 *
 * Centraliza rótulo, tipo de controle, largura no grid, obrigatoriedade e
 * agrupamento de cada campo. A ordem declarada aqui é a ordem canônica de
 * exibição: ela nunca depende das chaves presentes em um registro específico.
 *
 * Os registros são gravados com chaves "achatadas" (ex.: "ifConcessora.codigo"),
 * exatamente como o server.js os consulta.
 */

// ============================================================
// Domínios (listas fechadas)
// ============================================================
const DOMAINS = {
  tipoInscricao: [
    { value: 1, label: '1 — CNPJ' },
    { value: 2, label: '2 — CPF' }
  ],
  tipoInscricaoEstabelecimento: [
    { value: 1, label: '1 — CNPJ' },
    { value: 3, label: '3 — CAEPF' },
    { value: 4, label: '4 — CNO' }
  ],
  situacaoEmprestimo: [
    { value: 0, label: '0 — Ativo' },
    { value: 1, label: '1 — Quitado' }
  ]
};

// Descrições espelhadas: ao escolher o código, a descrição é preenchida sozinha.
const MIRROR_LABELS = {
  'inscricaoEmpregador.codigo': { target: 'inscricaoEmpregador.descricao', map: { 1: 'CNPJ', 2: 'CPF' } },
  'inscricaoEstabelecimento.codigo': {
    target: 'inscricaoEstabelecimento.descricao',
    map: {
      1: 'CNPJ',
      3: 'Cadastro de Atividade Econômica de Pessoa Física',
      4: 'Cadastro Nacional de Obras'
    }
  },
  'situacaoEmprestimo.codigo': { target: 'situacaoEmprestimo.descricao', map: { 0: 'Ativo', 1: 'Quitado' } }
};

// Sugestões abertas (datalist) — o usuário pode digitar qualquer outro valor.
const SUGGESTIONS = {
  'ifConcessora.codigo': ['104', '237', '341', '1'],
  'ifConcessora.descricao': ['CAIXA ECONOMICA FEDERAL', 'BANCO BRADESCO S.A.', 'BANCO ITAU S.A.', 'BANCO DO BRASIL'],
  'categoriaTrabalhador.codigo': ['101', '102', '103', '104', '105']
};

// ============================================================
// Definição dos campos
// span = colunas ocupadas num grid de 12
// ============================================================
const F = {
  ifConcessoraCodigo: {
    key: 'ifConcessora.codigo', label: 'Código da IF concessora', type: 'int', span: 4,
    help: 'Código do banco (COMPE). Vira o parâmetro codigoSolicitante na consulta.'
  },
  ifConcessoraDescricao: { key: 'ifConcessora.descricao', label: 'Instituição financeira', type: 'text', span: 8 },

  contrato: { key: 'contrato', label: 'Número do contrato', type: 'text', span: 6 },

  cpf: { key: 'cpf', label: 'CPF do trabalhador', type: 'cpf', span: 4 },
  matricula: { key: 'matricula', label: 'Matrícula', type: 'text', span: 4 },
  nomeTrabalhador: { key: 'nomeTrabalhador', label: 'Nome do trabalhador', type: 'text', span: 8 },
  dataAdmissao: { key: 'dataAdmissao', label: 'Data de admissão', type: 'date', span: 4 },

  categoriaCodigo: { key: 'categoriaTrabalhador.codigo', label: 'Categoria (código eSocial)', type: 'int', span: 4 },
  categoriaDescricao: { key: 'categoriaTrabalhador.descricao', label: 'Categoria — descrição', type: 'text', span: 12 },

  inscEmpregadorCodigo: {
    key: 'inscricaoEmpregador.codigo', label: 'Tipo de inscrição', type: 'select', span: 4,
    options: DOMAINS.tipoInscricao,
    help: 'Precisa ser igual ao codigoInscricao enviado na consulta.'
  },
  inscEmpregadorDescricao: { key: 'inscricaoEmpregador.descricao', label: 'Tipo — descrição', type: 'text', span: 4 },
  numeroInscEmpregador: {
    key: 'numeroInscricaoEmpregador', label: 'Inscrição do empregador', type: 'cnpj', span: 4, required: true,
    // O dígito verificador é conferido conforme o tipo escolhido (CNPJ ou CPF).
    tipoField: 'inscricaoEmpregador.codigo',
    help: 'Para CNPJ, o servidor busca pela raiz (8 primeiros dígitos).'
  },
  nomeEmpregador: { key: 'nomeEmpregador', label: 'Nome do empregador', type: 'text', span: 12 },

  inscEstabCodigo: {
    key: 'inscricaoEstabelecimento.codigo', label: 'Tipo de inscrição do estabelecimento', type: 'select', span: 5,
    options: DOMAINS.tipoInscricaoEstabelecimento
  },
  inscEstabDescricao: { key: 'inscricaoEstabelecimento.descricao', label: 'Estabelecimento — descrição', type: 'text', span: 7 },
  // Pode ser CNPJ, CAEPF ou CNO — só o formato numérico é cobrado, sem dígito verificador.
  numeroInscEstab: { key: 'numeroInscricaoEstabelecimento', label: 'Inscrição do estabelecimento', type: 'inscricao', span: 5 },

  dataInicioContrato: { key: 'dataInicioContrato', label: 'Início do contrato', type: 'date', span: 3 },
  dataFimContrato: { key: 'dataFimContrato', label: 'Fim do contrato', type: 'date', span: 3 },
  compInicioDesconto: { key: 'competenciaInicioDesconto', label: 'Competência inicial do desconto', type: 'competencia', span: 3 },
  compFimDesconto: { key: 'competenciaFimDesconto', label: 'Competência final do desconto', type: 'competencia', span: 3 },

  competencia: {
    key: 'competencia', label: 'Competência', type: 'competencia', span: 4, required: true,
    help: 'A consulta envia AAAAMM; o registro guarda MM/AAAA.'
  },

  situacaoCodigo: {
    key: 'situacaoEmprestimo.codigo', label: 'Situação', type: 'select', span: 5,
    options: DOMAINS.situacaoEmprestimo
  },
  situacaoDescricao: { key: 'situacaoEmprestimo.descricao', label: 'Situação — descrição', type: 'text', span: 7 },

  valorEmprestimo: { key: 'valorEmprestimo', label: 'Valor do empréstimo', type: 'money', span: 4 },
  valorLiberado: { key: 'valorLiberado', label: 'Valor liberado', type: 'money', span: 4 },
  valorParcela: { key: 'valorParcela', label: 'Valor da parcela', type: 'money', span: 4 },
  totalParcelas: { key: 'totalParcelas', label: 'Total de parcelas', type: 'int', span: 4 },
  valorSaldoDevedor: { key: 'valorSaldoDevedor', label: 'Saldo devedor', type: 'money', span: 4 },
  qtdPagamentos: { key: 'qtdPagamentos', label: 'Qtd. de pagamentos', type: 'int', span: 4 },
  qtdEscrituracoes: { key: 'qtdEscrituracoes', label: 'Qtd. de escriturações', type: 'int', span: 4 },

  temGarantias: { key: 'garantia.temGarantias', label: 'Possui garantias', type: 'bool', span: 12 },
  garantiaSaldoFgts: { key: 'garantia.valorSaldoDisponivelGarantiaFgts', label: 'Saldo FGTS disponível', type: 'money', span: 4 },
  garantiaMultaFgts: { key: 'garantia.valorMultaRescisoriaGarantiaFgts', label: 'Multa rescisória FGTS', type: 'money', span: 4 },
  garantiaPercVerba: { key: 'garantia.percVerbaRescisoriaGarantia', label: '% da verba rescisória', type: 'percent', span: 4 }
};

// ============================================================
// Agrupamento por dataset
// ============================================================
const DATASET_SCHEMA = {
  consignacoes: {
    label: 'Consignações',
    icon: '📋',
    endpoint: '/dados-consignacoes-empregador',
    description: 'Dados de consignações para empregadores (GET /dados-consignacoes-empregador)',
    identity: ['contrato', 'cpf', 'nomeTrabalhador'],
    lookupFields: ['numeroInscricaoEmpregador', 'competencia', 'inscricaoEmpregador.codigo'],
    // A coluna "Registro" já mostra os campos de identidade; não repetir aqui.
    keyColumns: [
      'nomeEmpregador', 'numeroInscricaoEmpregador', 'competencia', 'valorParcela',
      'totalParcelas', 'valorEmprestimo', 'dataInicioContrato', 'dataFimContrato'
    ],
    groups: [
      {
        id: 'chave', label: 'Chave de consulta', icon: '🔑', primary: true,
        note: 'Só estes campos determinam se o endpoint encontra o registro.',
        fields: [F.numeroInscEmpregador, F.competencia, F.inscEmpregadorCodigo, F.inscEmpregadorDescricao]
      },
      {
        id: 'trabalhador', label: 'Trabalhador', icon: '👤',
        fields: [F.cpf, F.matricula, F.dataAdmissao, F.nomeTrabalhador, F.categoriaCodigo, F.categoriaDescricao]
      },
      {
        id: 'empregador', label: 'Empregador e estabelecimento', icon: '🏢',
        fields: [F.nomeEmpregador, F.inscEstabCodigo, F.inscEstabDescricao, F.numeroInscEstab]
      },
      {
        id: 'contrato', label: 'Contrato', icon: '🏦',
        fields: [
          F.ifConcessoraCodigo, F.ifConcessoraDescricao, F.contrato,
          F.dataInicioContrato, F.dataFimContrato, F.compInicioDesconto, F.compFimDesconto
        ]
      },
      {
        id: 'valores', label: 'Valores', icon: '💰',
        fields: [
          F.valorEmprestimo, F.valorLiberado, F.valorParcela,
          F.totalParcelas, F.qtdPagamentos, F.qtdEscrituracoes
        ]
      }
    ]
  },

  extrato: {
    label: 'Extrato Trabalhador',
    icon: '📄',
    endpoint: '/extrato-trabalhador-empregador',
    description: 'Extrato do trabalhador para empregadores (GET /extrato-trabalhador-empregador)',
    identity: ['cpf', 'matricula', 'nomeTrabalhador'],
    lookupFields: ['numeroInscricaoEmpregador', 'cpf', 'inscricaoEmpregador.codigo'],
    keyColumns: ['nomeEmpregador', 'numeroInscricaoEmpregador', 'emprestimos'],
    subcrud: 'emprestimos',
    groups: [
      {
        id: 'chave', label: 'Chave de consulta', icon: '🔑', primary: true,
        note: 'Só estes campos determinam se o endpoint encontra o registro.',
        fields: [F.numeroInscEmpregador, F.cpf, F.inscEmpregadorCodigo, F.inscEmpregadorDescricao]
      },
      { id: 'trabalhador', label: 'Trabalhador', icon: '👤', fields: [F.nomeTrabalhador, F.matricula] },
      { id: 'empregador', label: 'Empregador', icon: '🏢', fields: [F.nomeEmpregador] }
    ]
  },

  emprestimo: {
    label: 'Empréstimo',
    icon: '💳',
    endpoint: '/emprestimo-trabalhador',
    description: 'Consulta de empréstimo unitário (GET /emprestimo-trabalhador)',
    identity: ['contrato', 'cpf', 'nomeTrabalhador'],
    lookupFields: ['numeroInscricaoEmpregador', 'contrato', 'ifConcessora.codigo'],
    keyColumns: [
      'nomeEmpregador', 'numeroInscricaoEmpregador', 'situacaoEmprestimo.descricao',
      'valorParcela', 'totalParcelas', 'valorEmprestimo'
    ],
    groups: [
      {
        id: 'chave', label: 'Chave de consulta', icon: '🔑', primary: true,
        note: 'Só estes campos determinam se o endpoint encontra o registro.',
        fields: [
          F.numeroInscEmpregador, F.contrato, F.ifConcessoraCodigo,
          F.ifConcessoraDescricao, F.inscEmpregadorCodigo, F.inscEmpregadorDescricao
        ]
      },
      { id: 'trabalhador', label: 'Trabalhador', icon: '👤', fields: [F.cpf, F.matricula, F.nomeTrabalhador] },
      { id: 'empregador', label: 'Empregador', icon: '🏢', fields: [F.nomeEmpregador] },
      {
        id: 'contrato', label: 'Contrato', icon: '🏦',
        fields: [F.dataInicioContrato, F.dataFimContrato, F.compInicioDesconto, F.compFimDesconto]
      },
      { id: 'situacao', label: 'Situação', icon: '⚖️', fields: [F.situacaoCodigo, F.situacaoDescricao] },
      {
        id: 'valores', label: 'Valores', icon: '💰',
        fields: [F.valorEmprestimo, F.valorLiberado, F.valorParcela, F.totalParcelas, F.valorSaldoDevedor]
      },
      {
        id: 'garantia', label: 'Garantia FGTS', icon: '🛡️',
        fields: [F.temGarantias, F.garantiaSaldoFgts, F.garantiaMultaFgts, F.garantiaPercVerba]
      }
    ]
  }
};

// ============================================================
// Sub-CRUD de empréstimos (dentro do Extrato)
// ============================================================
const EMPRESTIMO_SUBCRUD_GROUPS = [
  {
    id: 'contrato', label: 'Contrato', icon: '🏦',
    fields: [
      F.ifConcessoraCodigo, F.ifConcessoraDescricao, F.contrato,
      F.situacaoCodigo, F.situacaoDescricao,
      F.dataInicioContrato, F.dataFimContrato, F.compInicioDesconto, F.compFimDesconto
    ]
  },
  {
    id: 'valores', label: 'Valores', icon: '💰',
    fields: [F.valorEmprestimo, F.valorLiberado, F.valorParcela, F.totalParcelas, F.valorSaldoDevedor]
  },
  {
    id: 'garantia', label: 'Garantia FGTS', icon: '🛡️',
    fields: [F.temGarantias, F.garantiaSaldoFgts, F.garantiaMultaFgts, F.garantiaPercVerba]
  }
];

const EMPRESTIMO_SUBCRUD_KEY_COLS = [
  'ifConcessora.descricao', 'contrato', 'situacaoEmprestimo.descricao',
  'valorParcela', 'totalParcelas', 'valorEmprestimo'
];

// ============================================================
// Helpers de schema
// ============================================================

/** Lista achatada dos campos de um dataset, na ordem canônica. */
function schemaFields(dataset) {
  return DATASET_SCHEMA[dataset].groups.flatMap(g => g.fields);
}

/** Lista achatada das chaves de um dataset, na ordem canônica. */
function schemaKeys(dataset) {
  return schemaFields(dataset).map(f => f.key);
}

/** Busca a definição de um campo em qualquer dataset (ou no sub-CRUD). */
function fieldDef(key) {
  for (const def of Object.values(F)) {
    if (def.key === key) return def;
  }
  return null;
}

/**
 * Monta os parâmetros de consulta do endpoint real a partir de um registro.
 * Devolve null quando o registro não tem os campos-chave preenchidos.
 */
function buildTestParams(dataset, record) {
  const codigoInscricao = record['inscricaoEmpregador.codigo'];
  const numeroInscricao = record['numeroInscricaoEmpregador'];
  if (numeroInscricao === undefined || numeroInscricao === '') return null;

  const params = {
    codigoInscricao: codigoInscricao === undefined || codigoInscricao === '' ? 1 : codigoInscricao,
    numeroInscricao: String(numeroInscricao)
  };

  if (dataset === 'consignacoes') {
    // O registro guarda MM/AAAA; o endpoint espera AAAAMM.
    const comp = String(record.competencia || '');
    const m = comp.match(/^(\d{2})\/(\d{4})$/);
    if (!m) return null;
    params.competencia = `${m[2]}${m[1]}`;
  } else if (dataset === 'extrato') {
    if (record.cpf === undefined || record.cpf === '') return null;
    params.cpf = String(record.cpf);
  } else if (dataset === 'emprestimo') {
    if (record.contrato === undefined || record.contrato === '') return null;
    params.numeroContrato = String(record.contrato);
    params.codigoSolicitante = String(record['ifConcessora.codigo'] ?? '');
  }

  return params;
}
