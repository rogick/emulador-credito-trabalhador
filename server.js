// Importa o módulo Express, um framework para construir aplicações web em Node.js
const express = require('express');
// Importa o módulo 'fs' (File System) para interagir com o sistema de arquivos
const fs = require('fs');
// Importa o módulo 'path' para manipular caminhos de arquivos de forma consistente
const path = require('path');
// Importa as funções de validação
const { isValidCnpj, isValidCpf } = require('./validator');

// Cria uma instância do aplicativo Express
const app = express();
// Define a porta do servidor, utilizando a variável de ambiente PORT ou 3000 como padrão
const PORT = process.env.PORT || 3000;

// --- Mapeamento de Erros Conforme a Documentação (item 4.1 do PDF) ---
const API_ERRORS = {
    // Erros de Bad Request (400)
    PARAM_CODIGO_INSCRICAO_FALTANDO: { status: 400, codigo: 'PARAM_001', mensagem: 'Parâmetro de pesquisa esperado não foi informado: codigoInscricao' },
    PARAM_NUMERO_INSCRICAO_FALTANDO: { status: 400, codigo: 'PARAM_002', mensagem: 'Parâmetro de pesquisa esperado não foi informado: numeroInscricao' },
    PARAM_COMPETENCIA_FALTANDO: { status: 400, codigo: 'PARAM_003', mensagem: 'Parâmetro de pesquisa esperado não foi informado: competencia' },
    
    // Erros de Precondition Failed (412)
    CT_COMPETENCIA_INVALIDA: { status: 412, codigo: 'CT', mensagem: 'A competência de consulta está inválida' },
    CT_COMPETENCIA_FUTURA: { status: 412, codigo: 'CT', mensagem: 'Dados de Contratos para esta competência ainda não foram fechados' },
    LF_NAO_ENCONTRADO: { status: 412, codigo: 'LF', mensagem: 'Consulta não encontrou registros' },
    PR_SEM_PROCURACAO: { status: 412, codigo: 'PR', mensagem: 'O CNPJ/CPF autenticado não possui procuração outorgada pelo empregador' },
    SJ_CNPJ_DV_INVALIDO: { status: 412, codigo: 'SJ', mensagem: 'O CNPJ informado está com o DV inválido' },
    SP_CNPJ_FORMATO_INVALIDO: { status: 412, codigo: 'SP', mensagem: 'O parâmetro CNPJ informado não representa um CNPJ raiz ou CNPJ completo válido' },
    SQ_CPF_DV_INVALIDO: { status: 412, codigo: 'SQ', mensagem: 'O CPF informado está com o DV inválido' },
    SU_INSCRICAO_CARACTERES_INVALIDOS: { status: 412, codigo: 'SU', mensagem: 'Número de inscrição inválido' },
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


// Carregar os dados mockados do arquivo JSON ao iniciar o servidor
let mockDataTemplate = [];
const mockDataPath = path.join(__dirname, 'dados-consignacoes-mock.json');

try {
  const fileContent = fs.readFileSync(mockDataPath, 'utf-8');
  mockDataTemplate = JSON.parse(fileContent);
  console.log('Dados mockados carregados de dados-consignacoes-mock.json');
} catch (error) {
  console.error('Erro ao carregar o arquivo dados-consignacoes-mock.json:', error.message);
  process.exit(1); // Encerra o processo se o mock não puder ser carregado
}

/**
 * Endpoint principal para consulta de dados de consignações.
 * Valida os parâmetros de entrada e retorna os dados ou um erro,
 * conforme especificado na documentação.
 */
app.get('/dados-consignacoes-empregador', (req, res) => {
  const { codigoInscricao, numeroInscricao, competencia } = req.query;

  // 1. Validação de presença dos parâmetros (HTTP 400)
  if (!codigoInscricao) return sendError(res, API_ERRORS.PARAM_CODIGO_INSCRICAO_FALTANDO);
  if (!numeroInscricao) return sendError(res, API_ERRORS.PARAM_NUMERO_INSCRICAO_FALTANDO);
  if (!competencia) return sendError(res, API_ERRORS.PARAM_COMPETENCIA_FALTANDO);

  // 2. Validações de formato e regras de negócio (HTTP 412)
  if (!/^\d+$/.test(numeroInscricao)) {
    return sendError(res, API_ERRORS.SU_INSCRICAO_CARACTERES_INVALIDOS);
  }
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

  // Validação do número de inscrição (CPF/CNPJ)
  if (codigoInscricao === '1') { // CNPJ
    if (numeroInscricao.length !== 8 && numeroInscricao.length !== 14) {
        return sendError(res, API_ERRORS.SP_CNPJ_FORMATO_INVALIDO);
    }
    if (!isValidCnpj(numeroInscricao)) {
        return sendError(res, API_ERRORS.SJ_CNPJ_DV_INVALIDO);
    }
  } else if (codigoInscricao === '2') { // CPF
    if (!isValidCpf(numeroInscricao)) {
        return sendError(res, API_ERRORS.SQ_CPF_DV_INVALIDO);
    }
  } else {
    return sendError(res, { status: 412, codigo: 'PARAM_004', mensagem: 'Parâmetro "codigoInscricao" deve ser 1 (CNPJ) ou 2 (CPF).' });
  }

  // Simulação de erro de procuração (PR) para um CNPJ específico
  if (numeroInscricao.startsWith('99999999')) {
    return sendError(res, API_ERRORS.PR_SEM_PROCURACAO);
  }
  
  // 3. Lógica de busca dos dados
  const competenciaStr = competencia.toString();
  const ano = competenciaStr.substring(0, 4);
  const mes = competenciaStr.substring(4, 6);
  const referencia = `${mes}/${ano}`;

  // A busca é feita pelo CNPJ raiz (8 primeiros dígitos)
  const numeroInscricaoEmpregadorRaiz = numeroInscricao.substring(0, 8);

  console.log(`Pesquisando por: CNPJ Raiz=${numeroInscricaoEmpregadorRaiz}, Competência=${referencia}`);
  
  const resultados = mockDataTemplate.filter(item => {
      // Garante que a comparação seja feita com strings
      return item.competencia == referencia && item.numeroInscricaoEmpregador == numeroInscricaoEmpregadorRaiz;
  });

  // 4. Retorno dos dados ou erro "Não Encontrado" (LF)
  if (resultados.length === 0) {
    // Para simular um resultado vazio, use uma competência sem dados, como 202501
    console.log(`Nenhum dado encontrado para o CNPJ raiz ${numeroInscricaoEmpregadorRaiz} e a competência ${referencia}`);
    return sendError(res, API_ERRORS.LF_NAO_ENCONTRADO);
  }

  console.log(`Consulta bem-sucedida para: codigoInscricao=${codigoInscricao}, numeroInscricao=${numeroInscricao}, competencia=${competencia}`);
  res.status(200).json(resultados);
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
  console.log('Endpoint disponível: GET /dados-consignacoes-empregador');
  console.log('\n--- Exemplos de Teste ---');
  console.log(`Sucesso: http://localhost:${PORT}/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=14772711000199&competencia=202506`);
  console.log(`Não Encontrado (LF): http://localhost:${PORT}/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=14772711000199&competencia=202501`);
  console.log(`CNPJ Inválido (SJ): http://localhost:${PORT}/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=14772711000198&competencia=202506`);
  console.log(`Competência Inválida (CT): http://localhost:${PORT}/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=14772711000199&competencia=202513`);
  console.log(`Sem Procuração (PR): http://localhost:${PORT}/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=99999999000199&competencia=202506`);
  console.log('-------------------------\n');
});
