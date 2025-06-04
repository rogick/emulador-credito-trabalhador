// Importa o módulo Express, um framework para construir aplicações web em Node.js
const express = require('express');
// Importa o módulo 'fs' (File System) para interagir com o sistema de arquivos
const fs = require('fs');
// Importa o módulo 'path' para manipular caminhos de arquivos de forma consistente
const path = require('path');

// Cria uma instância do aplicativo Express
const app = express();
// Define a porta do servidor, utilizando a variável de ambiente PORT ou 3000 como padrão
const PORT = process.env.PORT || 3000;

// Chave de API esperada para emulação (você pode alterar este valor)
const EXPECTED_API_KEY = 'supersecretapikey';

// Carregar os dados mockados do arquivo JSON ao iniciar o servidor
let mockDataTemplate = [];
const mockDataPath = path.join(__dirname, 'dados-consignacoes-mock.json');

try {
  // Lê o conteúdo do arquivo JSON de forma síncrona
  const fileContent = fs.readFileSync(mockDataPath, 'utf-8');
  // Converte o conteúdo JSON para um objeto JavaScript
  mockDataTemplate = JSON.parse(fileContent);
  console.log('Dados mockados carregados de dados-consignacoes-mock.json');
} catch (error) {
  console.error('Erro ao carregar o arquivo dados-consignacoes-mock.json:', error.message);
  console.error('Verifique se o arquivo existe no caminho correto e se é um JSON válido.');
  // Se não conseguir carregar, o servidor pode parar ou usar um fallback.
  // Por simplicidade, mockDataTemplate continuará como array vazio e o erro será logado.
  // Em um cenário de produção, você poderia querer encerrar o processo: process.exit(1);
}


/**
 * Middleware para verificar a API Key no cabeçalho da requisição.
 * @param {express.Request} req - Objeto da requisição.
 * @param {express.Response} res - Objeto da resposta.
 * @param {express.NextFunction} next - Função para chamar o próximo middleware.
 */
const checkApiKey = (req, res, next) => {
  const apiKey = req.header('apikey');
  if (!apiKey) {
    return res.status(401).json({
      erros: [{
        codigo: 'AUTH_001',
        mensagem: 'API Key não fornecida.',
      }],
    });
  }
  if (apiKey !== EXPECTED_API_KEY) {
    return res.status(403).json({
      erros: [{
        codigo: 'AUTH_002',
        mensagem: 'API Key inválida.',
      }],
    });
  }
  next();
};

app.get('/dados-consignacoes-empregador', checkApiKey, (req, res) => {
  const { codigoInscricao, numeroInscricao, competencia } = req.query;

  const errosValidacao = [];
  if (!codigoInscricao) {
    errosValidacao.push({
      codigo: 'PARAM_001',
      mensagem: 'Parâmetro obrigatório "codigoInscricao" não fornecido.',
    });
  }
  if (!numeroInscricao) {
    errosValidacao.push({
      codigo: 'PARAM_002',
      mensagem: 'Parâmetro obrigatório "numeroInscricao" não fornecido.',
    });
  }
  if (!competencia) {
    errosValidacao.push({
      codigo: 'PARAM_003',
      mensagem: 'Parâmetro obrigatório "competencia" não fornecido.',
    });
  }

  if (codigoInscricao && isNaN(parseInt(codigoInscricao))) {
    errosValidacao.push({
      codigo: 'PARAM_004',
      mensagem: 'Parâmetro "codigoInscricao" deve ser um inteiro.',
    });
  }
  if (competencia && (isNaN(parseInt(competencia)) || competencia.length !== 6) ) {
     errosValidacao.push({
      codigo: 'PARAM_005',
      mensagem: 'Parâmetro "competencia" deve ser um inteiro no formato AAAAMM (ex: 202501 para Jan/2025).',
    });
  }

  if (errosValidacao.length > 0) {
    return res.status(412).json({
      erros: errosValidacao,
    });
  }

  const competenciaStr = competencia.toString();
  const ano = parseInt(competenciaStr.substring(0, 4));
  const mes = parseInt(competenciaStr.substring(4, 6));

  // Criar uma cópia profunda do template para esta requisição
  const requestSpecificMockData = JSON.parse(JSON.stringify(mockDataTemplate));

  // Personalizar os dados mockados com base nos parâmetros da requisição
  const processedMockData = requestSpecificMockData.map(templateItem => {
    const item = { ...templateItem }; // Copia o item do template

    item.contrato = `CTR${numeroInscricao}${String(mes).padStart(2,'0')}${ano}${item.contratoSuffix}`;
    item.matricula = `MAT${numeroInscricao.slice(-5)}${item.matriculaSuffix}`;
    item['inscricaoEmpregador.codigo'] = parseInt(codigoInscricao);
    item['inscricaoEmpregador.descricao'] = parseInt(codigoInscricao) === 1 ? 'CNPJ' : 'CAEPF'; // Exemplo
    item.numeroInscricaoEmpregador = numeroInscricao;
    item.numeroInscricaoEstabelecimento = `${numeroInscricao.substring(0,8)}0001${numeroInscricao.slice(-2)}`; // Exemplo de CNPJ de estabelecimento
    item.nomeEmpregador = `Empregador Exemplo ${numeroInscricao}`;
    
    item.dataInicioContrato = `${item.dataInicioContratoDay.padStart(2,'0')}/${String(mes).padStart(2,'0')}/${ano}`;
    
    let fimContratoMesCalc = mes + item.dataFimContratoOffsetMonths;
    let fimContratoAnoCalc = ano;
    if (fimContratoMesCalc > 12) {
        fimContratoAnoCalc += Math.floor((fimContratoMesCalc -1) / 12);
        fimContratoMesCalc = (fimContratoMesCalc -1) % 12 + 1;
    }
    item.dataFimContrato = `${item.dataFimContratoDay.padStart(2,'0')}/${String(fimContratoMesCalc).padStart(2,'0')}/${fimContratoAnoCalc}`;

    item.competenciaInicioDesconto = `${String(mes).padStart(2,'0')}/${ano}`;

    let fimDescontoMesCalc = mes + item.competenciaFimDescontoOffsetMonths;
    let fimDescontoAnoCalc = ano;
    if (fimDescontoMesCalc > 12) {
        fimDescontoAnoCalc += Math.floor((fimDescontoMesCalc -1) / 12);
        fimDescontoMesCalc = (fimDescontoMesCalc -1) % 12 + 1;
    }
    item.competenciaFimDesconto = `${String(fimDescontoMesCalc).padStart(2,'0')}/${fimDescontoAnoCalc}`;
    
    item.competencia = `${String(mes).padStart(2,'0')}/${ano}`;

    // Remove as chaves de template que foram usadas para gerar os dados
    delete item.contratoSuffix;
    delete item.matriculaSuffix;
    delete item.dataInicioContratoDay;
    delete item.dataFimContratoDay;
    delete item.dataFimContratoOffsetMonths;
    delete item.competenciaFimDescontoOffsetMonths;

    return item;
  });

  if (competencia === '202412') { // Mantendo o exemplo para dados vazios
    console.log(`Nenhum dado encontrado para a competência ${String(mes).padStart(2,'0')}/${ano} (parâmetro: ${competencia})`);
    return res.status(200).json([]);
  }

  console.log(`Consulta bem-sucedida para: codigoInscricao=${codigoInscricao}, numeroInscricao=${numeroInscricao}, competencia=${competencia}`);
  res.status(200).json(processedMockData);
});

app.use((req, res) => {
  res.status(404).json({
    erros: [{
      codigo: 'ROUTE_001',
      mensagem: 'Endpoint não encontrado.',
    }],
  });
});

app.listen(PORT, () => {
  console.log(`Servidor de emulação da API rodando em http://localhost:${PORT}`);
  console.log(`API Key para testes: ${EXPECTED_API_KEY}`);
  if (mockDataTemplate.length === 0 && fs.existsSync(mockDataPath)) {
    console.warn(`AVISO: O arquivo mock '${mockDataPath}' foi encontrado, mas parece estar vazio ou não pôde ser processado como JSON válido.`);
  } else if (mockDataTemplate.length === 0 && !fs.existsSync(mockDataPath)) {
     console.warn(`AVISO: O arquivo mock '${mockDataPath}' não foi encontrado. Respostas mockadas estarão vazias.`);
  }
  console.log('Endpoint disponível:');
  console.log(`GET http://localhost:${PORT}/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=12345678000195&competencia=202501`);
  console.log('Exemplo para dados vazios (competencia 202412):')
  console.log(`GET http://localhost:${PORT}/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=12345678000195&competencia=202412`);
});