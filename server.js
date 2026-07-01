// Importa o módulo Express, um framework para construir aplicações web em Node.js
const express = require('express');
// Importa o módulo 'fs' (File System) para interagir com o sistema de arquivos
const fs = require('fs');
// Importa o módulo 'path' para manipular caminhos de arquivos de forma consistente
const path = require('path');
// Importa as funções de validação
const { isValidCnpj, isValidCpf } = require('./validator');
// Importa multer para upload de arquivos e csv-parser para leitura de CSV
const multer = require('multer');
const csvParser = require('csv-parser');
const { Readable } = require('stream');

// Configura multer para armazenar uploads em memória
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Cria uma instância do aplicativo Express
const app = express();
// Define a porta do servidor, utilizando a variável de ambiente PORT ou 3019 como padrão
const PORT = process.env.PORT || 3019;

// Middleware para parsear o corpo da requisição como JSON
app.use(express.json());

// Middleware para servir arquivos estáticos da interface web
app.use(express.static(path.join(__dirname, 'public')));

// --- Mapeamento de Erros Conforme a Documentação (item 4.1 do Manual v1.6) ---
const API_ERRORS = {
    // Erros de Bad Request (400)
    PARAM_CODIGO_INSCRICAO_FALTANDO: { status: 400, codigo: 'PARAM_001', mensagem: 'Parâmetro de pesquisa esperado não foi informado: codigoInscricao' },
    PARAM_NUMERO_INSCRICAO_FALTANDO: { status: 400, codigo: 'PARAM_002', mensagem: 'Parâmetro de pesquisa esperado não foi informado: numeroInscricao' },
    PARAM_COMPETENCIA_FALTANDO: { status: 400, codigo: 'PARAM_003', mensagem: 'Parâmetro de pesquisa esperado não foi informado: competencia' },
    PARAM_CPF_FALTANDO: { status: 400, codigo: 'PARAM_007', mensagem: 'Parâmetro de pesquisa esperado não foi informado: cpf' },
    PARAM_CODIGO_SOLICITANTE_FALTANDO: { status: 400, codigo: 'PARAM_005', mensagem: 'Parâmetro de pesquisa esperado não foi informado: codigoSolicitante' },
    PARAM_NUMERO_CONTRATO_FALTANDO: { status: 400, codigo: 'PARAM_006', mensagem: 'Parâmetro de pesquisa esperado não foi informado: numeroContrato' },

    // Erros de Precondition Failed (412)
    CT_COMPETENCIA_INVALIDA: { status: 412, codigo: 'CT', mensagem: 'A competência de consulta está inválida' },
    CT_COMPETENCIA_FUTURA: { status: 412, codigo: 'CT', mensagem: 'Dados de Contratos para esta competência ainda não foram fechados' },
    LF_NAO_ENCONTRADO: { status: 412, codigo: 'LF', mensagem: 'Consulta não encontrou registros' },
    PR_SEM_PROCURACAO: { status: 412, codigo: 'PR', mensagem: 'O CNPJ/CPF autenticado não possui procuração outorgada pelo empregador' },
    SJ_CNPJ_DV_INVALIDO: { status: 412, codigo: 'SJ', mensagem: 'O CNPJ informado está com o DV inválido' },
    SP_CNPJ_FORMATO_INVALIDO: { status: 412, codigo: 'SP', mensagem: 'O parâmetro CNPJ informado não representa um CNPJ raiz ou CNPJ completo válido' },
    SQ_CPF_DV_INVALIDO: { status: 412, codigo: 'SQ', mensagem: 'O CPF informado está com o DV inválido' },
    SU_INSCRICAO_CARACTERES_INVALIDOS: { status: 412, codigo: 'SU', mensagem: 'Número de inscrição inválido' },
    OZ_SERVICO_SUSPENSO: { status: 412, codigo: 'OZ', mensagem: 'Serviço suspenso' },
};

// Função auxiliar para enviar respostas de erro padronizadas
const sendError = (res, error) => {
    return res.status(error.status).json({
        erros: [{
            codigo: error.codigo,
            mensagem: error.mensagem,
        }],
    });
};

// --- Carregamento dos dados mockados ---
// Cada serviço possui seu próprio arquivo de mock. A chave do objeto é usada
// também como alvo (dataset) do endpoint POST /update-mock.
const MOCK_FILES = {
    consignacoes: 'dados-consignacoes-mock.json',
    extrato: 'extrato-trabalhador-mock.json',
    emprestimo: 'emprestimo-trabalhador-mock.json',
};

const mockData = {};
for (const [dataset, fileName] of Object.entries(MOCK_FILES)) {
    const filePath = path.join(__dirname, fileName);
    try {
        mockData[dataset] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        console.log(`Dados mockados carregados de ${fileName} (dataset: ${dataset})`);
    } catch (error) {
        console.error(`Erro ao carregar o arquivo ${fileName}:`, error.message);
        process.exit(1); // Encerra o processo se algum mock não puder ser carregado
    }
}

/**
 * Valida os parâmetros de inscrição do empregador comuns a todos os serviços.
 * @param {string} codigoInscricao - Tipo de inscrição ("1" = CNPJ, "2" = CPF).
 * @param {string} numeroInscricao - Número de inscrição do empregador.
 * @returns {object|null} O objeto de erro a ser enviado, ou null se válido.
 */
const validarInscricaoEmpregador = (codigoInscricao, numeroInscricao) => {
    // Apenas dígitos são aceitos no número de inscrição
    if (!/^\d+$/.test(numeroInscricao)) {
        return API_ERRORS.SU_INSCRICAO_CARACTERES_INVALIDOS;
    }

    if (codigoInscricao === '1') { // CNPJ
        if (numeroInscricao.length !== 8 && numeroInscricao.length !== 14) {
            return API_ERRORS.SP_CNPJ_FORMATO_INVALIDO;
        }
        if (!isValidCnpj(numeroInscricao)) {
            return API_ERRORS.SJ_CNPJ_DV_INVALIDO;
        }
    } else if (codigoInscricao === '2') { // CPF
        if (!isValidCpf(numeroInscricao)) {
            return API_ERRORS.SQ_CPF_DV_INVALIDO;
        }
    } else {
        return { status: 412, codigo: 'PARAM_004', mensagem: 'Parâmetro "codigoInscricao" deve ser 1 (CNPJ) ou 2 (CPF).' };
    }

    return null;
};

/**
 * Retorna a raiz da inscrição do empregador usada nas buscas.
 * Para CNPJ (código 1), considera os 8 primeiros dígitos (CNPJ raiz).
 */
const obterRaizInscricao = (codigoInscricao, numeroInscricao) =>
    codigoInscricao === '1' ? numeroInscricao.substring(0, 8) : numeroInscricao;

/**
 * Simula restrições de acesso comuns a todos os serviços a partir de prefixos
 * especiais do número de inscrição (úteis para testar cenários de erro):
 *   - prefixo 99999999 -> PR (sem procuração outorgada)
 *   - prefixo 88888888 -> OZ (serviço suspenso)
 * @returns {object|null} O objeto de erro a ser enviado, ou null se sem restrição.
 */
const simularRestricoesAcesso = (numeroInscricao) => {
    if (numeroInscricao.startsWith('88888888')) {
        return API_ERRORS.OZ_SERVICO_SUSPENSO;
    }
    if (numeroInscricao.startsWith('99999999')) {
        return API_ERRORS.PR_SEM_PROCURACAO;
    }
    return null;
};

/**
 * Endpoint para verificar a saúde da aplicação (Health Check).
 * Retorna um status 200 OK se a aplicação estiver rodando.
 */
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

/**
 * 3.1 Consulta de Dados de Consignações para Empregadores via API.
 * Valida os parâmetros de entrada e retorna os dados ou um erro,
 * conforme especificado na documentação (Manual v1.6).
 */
app.get('/dados-consignacoes-empregador', (req, res) => {
    const { codigoInscricao, numeroInscricao, competencia } = req.query;

    // 1. Validação de presença dos parâmetros (HTTP 400)
    if (!codigoInscricao) return sendError(res, API_ERRORS.PARAM_CODIGO_INSCRICAO_FALTANDO);
    if (!numeroInscricao) return sendError(res, API_ERRORS.PARAM_NUMERO_INSCRICAO_FALTANDO);
    if (!competencia) return sendError(res, API_ERRORS.PARAM_COMPETENCIA_FALTANDO);

    // 2. Validações de formato e regras de negócio (HTTP 412)
    // Validação do número de inscrição (CPF/CNPJ)
    const erroInscricao = validarInscricaoEmpregador(codigoInscricao, numeroInscricao);
    if (erroInscricao) return sendError(res, erroInscricao);

    // Validação de formato da competência
    if (!/^\d{6}$/.test(competencia) || parseInt(competencia.substring(4, 6)) > 12 || parseInt(competencia.substring(4, 6)) === 0) {
        return sendError(res, API_ERRORS.CT_COMPETENCIA_INVALIDA);
    }

    // Simulação de competência futura/não fechada
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1; // getMonth() é 0-11
    const anoReq = parseInt(competencia.substring(0, 4));
    const mesReq = parseInt(competencia.substring(4, 6));

    if (anoReq > anoAtual || (anoReq === anoAtual && mesReq > mesAtual)) {
        return sendError(res, API_ERRORS.CT_COMPETENCIA_FUTURA);
    }

    // Simulação de restrições de acesso (PR/OZ) por prefixo da inscrição
    const restricao = simularRestricoesAcesso(numeroInscricao);
    if (restricao) return sendError(res, restricao);

    // 3. Lógica de busca dos dados
    const ano = competencia.substring(0, 4);
    const mes = competencia.substring(4, 6);
    const referencia = `${mes}/${ano}`;

    // A busca é feita pelo CNPJ raiz (8 primeiros dígitos)
    const numeroInscricaoEmpregadorRaiz = obterRaizInscricao(codigoInscricao, numeroInscricao);

    console.log(`Pesquisando por: CNPJ Raiz=${numeroInscricaoEmpregadorRaiz}, Competência=${referencia}`);

    const resultados = mockData.consignacoes.filter(item =>
        item.competencia == referencia && item.numeroInscricaoEmpregador == numeroInscricaoEmpregadorRaiz
    );

    // 4. Retorno dos dados ou erro "Não Encontrado" (LF)
    if (resultados.length === 0) {
        console.log(`Nenhum dado encontrado para o CNPJ raiz ${numeroInscricaoEmpregadorRaiz} e a competência ${referencia}`);
        return sendError(res, API_ERRORS.LF_NAO_ENCONTRADO);
    }

    console.log(`Consulta bem-sucedida para: codigoInscricao=${codigoInscricao}, numeroInscricao=${numeroInscricao}, competencia=${competencia}`);
    res.status(200).json(resultados);
});

/**
 * 3.2 Consulta de Extrato do Trabalhador para Empregadores via API.
 * Retorna o histórico de empréstimos de um trabalhador (CPF) vinculado ao empregador.
 */
app.get('/extrato-trabalhador-empregador', (req, res) => {
    const { codigoInscricao, numeroInscricao, cpf } = req.query;

    // 1. Validação de presença dos parâmetros (HTTP 400)
    if (!codigoInscricao) return sendError(res, API_ERRORS.PARAM_CODIGO_INSCRICAO_FALTANDO);
    if (!numeroInscricao) return sendError(res, API_ERRORS.PARAM_NUMERO_INSCRICAO_FALTANDO);
    if (!cpf) return sendError(res, API_ERRORS.PARAM_CPF_FALTANDO);

    // 2. Validações de formato e regras de negócio (HTTP 412)
    // Validação do número de inscrição (CPF/CNPJ)
    const erroInscricao = validarInscricaoEmpregador(codigoInscricao, numeroInscricao);
    if (erroInscricao) return sendError(res, erroInscricao);

    // Validação de formato/DV do CPF do trabalhador
    if (!isValidCpf(cpf)) {
        return sendError(res, API_ERRORS.SQ_CPF_DV_INVALIDO);
    }

    // Simulação de restrições de acesso (PR/OZ) por prefixo da inscrição
    const restricao = simularRestricoesAcesso(numeroInscricao);
    if (restricao) return sendError(res, restricao);

    // 3. Lógica de busca dos dados (por raiz da inscrição + CPF do trabalhador)
    const raiz = obterRaizInscricao(codigoInscricao, numeroInscricao);
    console.log(`Pesquisando extrato por: Inscrição Raiz=${raiz}, CPF=${cpf}`);

    const resultados = mockData.extrato.filter(item =>
        item.numeroInscricaoEmpregador == raiz && item.cpf == cpf
    );

    // 4. Retorno dos dados ou erro "Não Encontrado" (LF)
    if (resultados.length === 0) {
        console.log(`Nenhum extrato encontrado para a inscrição raiz ${raiz} e o CPF ${cpf}`);
        return sendError(res, API_ERRORS.LF_NAO_ENCONTRADO);
    }

    console.log(`Consulta de extrato bem-sucedida para: numeroInscricao=${numeroInscricao}, cpf=${cpf}`);
    res.status(200).json(resultados);
});

/**
 * 3.3 Consulta de Empréstimo (unitário) para Empregadores via API.
 * Retorna os dados de um contrato de empréstimo específico do empregador.
 */
app.get('/emprestimo-trabalhador', (req, res) => {
    const { codigoInscricao, numeroInscricao, codigoSolicitante, numeroContrato } = req.query;

    // 1. Validação de presença dos parâmetros (HTTP 400)
    if (!codigoInscricao) return sendError(res, API_ERRORS.PARAM_CODIGO_INSCRICAO_FALTANDO);
    if (!numeroInscricao) return sendError(res, API_ERRORS.PARAM_NUMERO_INSCRICAO_FALTANDO);
    if (!codigoSolicitante) return sendError(res, API_ERRORS.PARAM_CODIGO_SOLICITANTE_FALTANDO);
    if (!numeroContrato) return sendError(res, API_ERRORS.PARAM_NUMERO_CONTRATO_FALTANDO);

    // 2. Validações de formato e regras de negócio (HTTP 412)
    // Validação do número de inscrição (CPF/CNPJ)
    const erroInscricao = validarInscricaoEmpregador(codigoInscricao, numeroInscricao);
    if (erroInscricao) return sendError(res, erroInscricao);

    // Simulação de restrições de acesso (PR/OZ) por prefixo da inscrição
    const restricao = simularRestricoesAcesso(numeroInscricao);
    if (restricao) return sendError(res, restricao);

    // 3. Lógica de busca dos dados (por raiz da inscrição + número do contrato + solicitante)
    const raiz = obterRaizInscricao(codigoInscricao, numeroInscricao);
    console.log(`Pesquisando empréstimo por: Inscrição Raiz=${raiz}, Contrato=${numeroContrato}, Solicitante=${codigoSolicitante}`);

    const resultado = mockData.emprestimo.find(item =>
        item.numeroInscricaoEmpregador == raiz &&
        item.contrato == numeroContrato &&
        item['ifConcessora.codigo'] == codigoSolicitante
    );

    // 4. Retorno do dado (objeto único) ou erro "Não Encontrado" (LF)
    if (!resultado) {
        console.log(`Nenhum empréstimo encontrado para a inscrição raiz ${raiz} e o contrato ${numeroContrato}`);
        return sendError(res, API_ERRORS.LF_NAO_ENCONTRADO);
    }

    console.log(`Consulta de empréstimo bem-sucedida para: numeroInscricao=${numeroInscricao}, numeroContrato=${numeroContrato}`);
    res.status(200).json(resultado);
});

/**
 * Endpoint para atualizar os dados mockados a partir de um JSON array.
 * @query {string} [dataset=consignacoes] - Qual mock atualizar: 'consignacoes', 'extrato' ou 'emprestimo'.
 * @query {string} [mode=replace] - 'replace' substitui todos os dados; 'append' adiciona aos existentes.
 * @body {Array<object>} - Um array de objetos para atualizar o mock.
 */
app.post('/update-mock', (req, res) => {
    const { mode, dataset = 'consignacoes' } = req.query;
    const newData = req.body;

    // 1. Validação do dataset alvo
    if (!MOCK_FILES[dataset]) {
        return res.status(400).json({
            erros: [{
                codigo: 'DATASET_001',
                mensagem: `Dataset inválido. Use um de: ${Object.keys(MOCK_FILES).join(', ')}.`,
            }],
        });
    }

    // 2. Validação do corpo da requisição
    if (!Array.isArray(newData)) {
        return res.status(400).json({
            erros: [{
                codigo: 'BODY_001',
                mensagem: 'O corpo da requisição deve ser um JSON array.',
            }],
        });
    }

    // 3. Lógica de atualização (append ou replace)
    if (mode === 'append') {
        mockData[dataset].push(...newData);
        console.log(`Modo 'append' (${dataset}): ${newData.length} registros adicionados.`);
    } else {
        mockData[dataset] = newData;
        console.log(`Modo 'replace' (${dataset}): Mock substituído com ${newData.length} registros.`);
    }

    // 4. Salva os dados atualizados de volta no arquivo .json
    const filePath = path.join(__dirname, MOCK_FILES[dataset]);
    fs.writeFile(filePath, JSON.stringify(mockData[dataset], null, 2), 'utf-8', (err) => {
        if (err) {
            console.error('Erro ao salvar o arquivo de mock:', err);
            return res.status(500).json({
                erros: [{
                    codigo: 'FILE_001',
                    mensagem: 'Erro interno ao tentar salvar os dados mockados.',
                }],
            });
        }

        console.log(`Arquivo ${MOCK_FILES[dataset]} atualizado com sucesso.`);
        res.status(200).json({
            mensagem: `Dados atualizados com sucesso. Dataset: ${dataset}. Modo: ${mode === 'append' ? 'append' : 'replace'}. Total de registros agora: ${mockData[dataset].length}.`,
        });
    });
});

// --- API CRUD para gerenciamento de mock data (interface web) ---

const writeQueues = {
    consignacoes: Promise.resolve(),
    extrato: Promise.resolve(),
    emprestimo: Promise.resolve()
};

/**
 * Função auxiliar para salvar o dataset em disco de forma assíncrona.
 */
const salvarDataset = (dataset, callback) => {
    writeQueues[dataset] = writeQueues[dataset].then(() => {
        return new Promise((resolve) => {
            const filePath = path.join(__dirname, MOCK_FILES[dataset]);
            const dataString = JSON.stringify(mockData[dataset], null, 2);
            fs.writeFile(filePath, dataString, 'utf-8', (err) => {
                if (callback) callback(err);
                resolve();
            });
        });
    }).catch(err => {
        console.error(`Erro na fila de escrita para ${dataset}:`, err);
        if (callback) callback(err);
    });
};

// Express param validator para centralizar a existência do dataset
app.param('dataset', (req, res, next, dataset) => {
    if (!MOCK_FILES[dataset]) {
        return res.status(400).json({ erro: `Dataset inválido. Use: ${Object.keys(MOCK_FILES).join(', ')}` });
    }
    next();
});

/**
 * GET /api/mock/:dataset — Retorna todos os registros do dataset.
 */
app.get('/api/mock/:dataset', (req, res) => {
    const { dataset } = req.params;
    res.json({ dataset, total: mockData[dataset].length, registros: mockData[dataset] });
});

/**
 * POST /api/mock/:dataset — Cria um novo registro no dataset.
 */
app.post('/api/mock/:dataset', (req, res) => {
    const { dataset } = req.params;
    const novoRegistro = req.body;
    if (!novoRegistro || typeof novoRegistro !== 'object' || Array.isArray(novoRegistro)) {
        return res.status(400).json({ erro: 'O corpo deve ser um objeto JSON (registro único).' });
    }
    mockData[dataset].push(novoRegistro);
    salvarDataset(dataset, (err) => {
        if (err) return res.status(500).json({ erro: 'Erro ao salvar dados.' });
        res.status(201).json({ mensagem: 'Registro criado com sucesso.', index: mockData[dataset].length - 1, registro: novoRegistro });
    });
});

/**
 * PUT /api/mock/:dataset/:index — Atualiza o registro no índice informado.
 */
app.put('/api/mock/:dataset/:index', (req, res) => {
    const { dataset, index } = req.params;
    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0 || idx >= mockData[dataset].length) {
        return res.status(404).json({ erro: `Índice ${index} fora do intervalo (0-${mockData[dataset].length - 1}).` });
    }
    const registroAtualizado = req.body;
    if (!registroAtualizado || typeof registroAtualizado !== 'object' || Array.isArray(registroAtualizado)) {
        return res.status(400).json({ erro: 'O corpo deve ser um objeto JSON (registro único).' });
    }
    mockData[dataset][idx] = registroAtualizado;
    salvarDataset(dataset, (err) => {
        if (err) return res.status(500).json({ erro: 'Erro ao salvar dados.' });
        res.json({ mensagem: 'Registro updated com sucesso.', index: idx, registro: registroAtualizado });
    });
});

/**
 * DELETE /api/mock/:dataset/:index — Remove o registro no índice informado.
 */
app.delete('/api/mock/:dataset/:index', (req, res) => {
    const { dataset, index } = req.params;
    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0 || idx >= mockData[dataset].length) {
        return res.status(404).json({ erro: `Índice ${index} fora do intervalo.` });
    }
    const removido = mockData[dataset].splice(idx, 1)[0];
    salvarDataset(dataset, (err) => {
        if (err) return res.status(500).json({ erro: 'Erro ao salvar dados.' });
        res.json({ mensagem: 'Registro removido com sucesso.', registro: removido });
    });
});

/**
 * POST /api/mock/:dataset/import — Importa dados de arquivo CSV ou JSON.
 * @query {string} [mode=replace] — 'replace' substitui todos os dados; 'append' adiciona.
 */
app.post('/api/mock/:dataset/import', upload.single('file'), (req, res) => {
    const { dataset } = req.params;
    const mode = req.query.mode || 'replace';
    if (!req.file) {
        return res.status(400).json({ erro: 'Nenhum arquivo enviado. Envie um arquivo com o campo "file".' });
    }

    const fileName = req.file.originalname.toLowerCase();
    const buffer = req.file.buffer;

    if (fileName.endsWith('.json')) {
        // Parse JSON
        try {
            const dados = JSON.parse(buffer.toString('utf-8'));
            if (!Array.isArray(dados)) {
                return res.status(400).json({ erro: 'O arquivo JSON deve conter um array de objetos.' });
            }
            if (mode === 'append') {
                mockData[dataset].push(...dados);
            } else {
                mockData[dataset] = dados;
            }
            salvarDataset(dataset, (err) => {
                if (err) return res.status(500).json({ erro: 'Erro ao salvar dados.' });
                res.json({ mensagem: `Importação JSON concluída (${mode}). ${dados.length} registros processados. Total: ${mockData[dataset].length}.` });
            });
        } catch (e) {
            return res.status(400).json({ erro: `Erro ao parsear JSON: ${e.message}` });
        }
    } else if (fileName.endsWith('.csv')) {
        // Parse CSV
        const resultados = [];
        const stream = Readable.from(buffer.toString('utf-8'));
        stream
            .pipe(csvParser({ separator: ';' }))
            .on('data', (row) => resultados.push(row))
            .on('end', () => {
                if (mode === 'append') {
                    mockData[dataset].push(...resultados);
                } else {
                    mockData[dataset] = resultados;
                }
                salvarDataset(dataset, (err) => {
                    if (err) return res.status(500).json({ erro: 'Erro ao salvar dados.' });
                    res.json({ mensagem: `Importação CSV concluída (${mode}). ${resultados.length} registros processados. Total: ${mockData[dataset].length}.` });
                });
            })
            .on('error', (err) => {
                res.status(400).json({ erro: `Erro ao parsear CSV: ${err.message}` });
            });
    } else {
        return res.status(400).json({ erro: 'Formato de arquivo não suportado. Use .json ou .csv.' });
    }
});

/**
 * GET /api/mock/:dataset/export — Exporta os dados do dataset como JSON.
 */
app.get('/api/mock/:dataset/export', (req, res) => {
    const { dataset } = req.params;
    res.setHeader('Content-Disposition', `attachment; filename=${MOCK_FILES[dataset]}`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(mockData[dataset], null, 2));
});

// Middleware para rotas não encontradas
app.use((req, res) => {
    res.status(404).json({
        erros: [{
            codigo: 'ROUTE_001',
            mensagem: 'Endpoint não encontrado.',
        }],
    });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor de emulação da API rodando em http://localhost:${PORT}`);
    console.log('\nEndpoints disponíveis:');
    console.log('  - GET  /health');
    console.log('  - GET  /dados-consignacoes-empregador');
    console.log('  - GET  /extrato-trabalhador-empregador');
    console.log('  - GET  /emprestimo-trabalhador');
    console.log('  - POST /update-mock?dataset=[consignacoes|extrato|emprestimo]&mode=[replace|append]');
    console.log('\n--- Exemplos de Teste ---');
    console.log(`  Consignações (sucesso): http://localhost:${PORT}/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=14772711000199&competencia=202506`);
    console.log(`  Extrato (sucesso): http://localhost:${PORT}/extrato-trabalhador-empregador?codigoInscricao=1&numeroInscricao=47192091008403&cpf=68019017968`);
    console.log(`  Empréstimo (sucesso): http://localhost:${PORT}/emprestimo-trabalhador?codigoInscricao=1&numeroInscricao=47192091008403&codigoSolicitante=999&numeroContrato=199912345678`);
    console.log(`  Sem Procuração (PR): http://localhost:${PORT}/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=99999999000199&competencia=202506`);
    console.log('-------------------------\n');
});
