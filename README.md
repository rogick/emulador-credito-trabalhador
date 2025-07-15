# Emulador de API de Crédito ao Trabalhador

Este projeto é um emulador de API para um sistema de consulta de dados de consignações de crédito ao trabalhador. Ele utiliza um arquivo JSON (`dados-consignacoes-mock.json`) como uma base de dados mock e implementa as regras de negócio e validações especificadas para o serviço. A aplicação é construída com Node.js e Express.

## Funcionalidades

- Servir dados mock de consignações a partir de um arquivo JSON.
- Filtrar consignações por CNPJ/CPF do empregador e competência.
- Realizar validações de parâmetros de entrada (formato, regras de negócio) conforme especificação.
- Simular respostas de erro padronizadas (400, 412) para diferentes cenários.
- Permitir a atualização dinâmica dos dados mock via API (substituir ou adicionar registros).

## Pré-requisitos

Antes de começar, você vai precisar ter as seguintes ferramentas instaladas em sua máquina:
- [Node.js](https://nodejs.org/en/) (versão 18 ou superior)
- [npm](https://www.npmjs.com/) (geralmente vem com o Node.js)

## Instalação

1. Clone o repositório:
   ```bash
   git clone <URL_DO_REPOSITORIO>
   ```

2. Navegue até o diretório do projeto:
   ```bash
   cd emuladorCreditoTrab
   ```

3. Instale as dependências:
   ```bash
   npm install
   ```

## Como Usar

1. Inicie o servidor:
   ```bash
   npm start
   ```

2. O servidor estará rodando em `http://localhost:3000`.

### Endpoints da API

A API fornece os seguintes endpoints:

#### Health Check

- **URL:** `/health`
- **Método:** `GET`
- **Descrição:** Verifica a saúde da aplicação. Retorna um status `UP` se o servidor estiver rodando.
- **Exemplo de Requisição (usando `curl`):**
  ```bash
  curl "http://localhost:3000/health"
  ```
- **Exemplo de Resposta:**
  ```json
  {
    "status": "UP"
  }
  ```

#### Consultar Dados de Consignação por Empregador

- **URL:** `/dados-consignacoes-empregador`
- **Método:** `GET`
- **Descrição:** Retorna uma lista com todos os contratos de consignação para um determinado empregador e competência.
- **Query Parameters:**
  - `codigoInscricao` (obrigatório): Tipo de inscrição. Usar `1` para CNPJ.
  - `numeroInscricao` (obrigatório): O número do CNPJ (14 dígitos ou 8 para a raiz).
  - `competencia` (obrigatório): A competência da consulta no formato `YYYYMM`.
- **Exemplos de Requisição (usando `curl`):**
  - **Consulta com sucesso:**
    ```bash
    curl "http://localhost:3000/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=14772711000199&competencia=202506"
    ```
  - **Registros não encontrados (Erro LF):**
    ```bash
    curl "http://localhost:3000/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=14772711000199&competencia=202501"
    ```
  - **CNPJ com DV inválido (Erro SJ):**
    ```bash
    curl "http://localhost:3000/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=14772711000198&competencia=202506"
    ```
  - **Competência inválida (Erro CT):**
    ```bash
    curl "http://localhost:3000/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=14772711000199&competencia=202513"
    ```
  - **Sem procuração (Erro PR - Simulado):**
    ```bash
    curl "http://localhost:3000/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=99999999000199&competencia=202506"
    ```

#### Atualizar Dados Mock

- **URL:** `/update-mock`
- **Método:** `POST`
- **Descrição:** Atualiza o arquivo `dados-consignacoes-mock.json` com novos dados. Esta funcionalidade é útil para testar diferentes cenários sem precisar editar o arquivo manualmente.
- **Query Parameters:**
  - `mode` (opcional): Define o modo de atualização.
    - `replace` (padrão): Substitui todo o conteúdo do arquivo mock com os dados enviados.
    - `append`: Adiciona os dados enviados ao
## Validações e Códigos de Erro

A API implementa as seguintes validações e retorna os erros correspondentes:

| Status | Código | Mensagem |
| :--- | :--- | :--- |
| 400 | `PARAM_001` | Parâmetro de pesquisa esperado não foi informado: codigoInscricao |
| 400 | `PARAM_002` | Parâmetro de pesquisa esperado não foi informado: numeroInscricao |
| 400 | `PARAM_003` | Parâmetro de pesquisa esperado não foi informado: competencia |
| 412 | `CT` | A competência de consulta está inválida |
| 412 | `CT` | Dados de Contratos para esta competência ainda não foram fechados |
| 412 | `LF` | Consulta não encontrou registros |
| 412 | `PR` | O CNPJ/CPF autenticado não possui procuração outorgada pelo empregador |
| 412 | `SJ` | O CNPJ informado está com o DV inválido |
| 412 | `SP` | O parâmetro CNPJ informado não representa um CNPJ raiz ou CNPJ completo válido |
| 412 | `SQ` | O CPF informado está com o DV inválido |
| 412 | `SU` | Número de inscrição inválido |

## Estrutura dos Dados

Os dados de consignação são armazenados no arquivo `dados-consignacoes-mock.json`. Cada objeto no array representa um contrato de consignação com a seguinte estrutura (exemplo):

  ```json
  {
    "ifConcessora.codigo": 908,
    "ifConcessora.descricao": "PARATI CFI S A",
    "contrato": 678001209,
    "cpf": 77824324729,
    "matricula": 9400,
    "inscricaoEmpregador.codigo": 1,
    "inscricaoEmpregador.descricao": "CNPJ",
    "numeroInscricaoEmpregador": 14772711,
    "nomeTrabalhador": "",
    "nomeEmpregador": "SOS INFORMATICA",
    "dataInicioContrato": "25/03/2025",
    "dataFimContrato": "20/08/2026",
    "competenciaInicioDesconto": "05/2025",
    "competenciaFimDesconto": "07/2026",
    "totalParcelas": 15,
    "valorParcela": "284,41",
    "valorEmprestimo": "4266,15",
    "valorLiberado": "3023,82",
    "qtdPagamentos": "",
    "qtdEscrituracoes": "",
    "categoriaTrabalhador.codigo": 101,
    "categoriaTrabalhador.descricao": "Empregado - Geral, inclusive o empregado público da administração direta ou indireta contratado pela CLT",
    "competencia": "06/2025",
    "inscricaoEstabelecimento.codigo": 1,
    "inscricaoEstabelecimento.descricao": "CNPJ",
    "numeroInscricaoEstabelecimento": 14772711000199
  }
  ```

## Dependências

As dependências do projeto estão listadas no arquivo `package.json`:
- `express`: Framework web para Node.js.
- `multer`: Middleware para manipulação de `multipart/form-data`.
- `csv-parser`: Parser de streaming de CSV.
- `validator.js`: Módulo local com funções de validação de CPF/CNPJ.