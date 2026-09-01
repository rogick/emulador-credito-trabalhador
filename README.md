# Emulador de API de Crédito ao Trabalhador

Este projeto é um emulador da API **Crédito Trabalhador — Dados de consignações para empregadores** (Manual DATAPREV v1.6). Implementa os três serviços de consulta destinados aos empregadores, usando arquivos JSON como base de dados mock e aplicando as regras de negócio e validações especificadas. A aplicação é construída com Node.js e Express.

## Serviços implementados (conforme Manual v1.6)

1. **Consulta de Dados de Consignações** — `GET /dados-consignacoes-empregador`
2. **Consulta de Extrato do Trabalhador** — `GET /extrato-trabalhador-empregador`
3. **Consulta de Empréstimo (unitário)** — `GET /emprestimo-trabalhador`

## Funcionalidades

- Servir dados mock dos três serviços a partir de arquivos JSON dedicados.
- Filtrar consignações por CNPJ/CPF do empregador e competência.
- Consultar o extrato (histórico de empréstimos) de um trabalhador por CPF.
- Consultar um contrato de empréstimo específico por número de contrato.
- Realizar validações de parâmetros de entrada (formato, regras de negócio) conforme especificação.
- Simular respostas de erro padronizadas (400, 412) para diferentes cenários.
- Permitir a atualização dinâmica dos dados mock via API (substituir ou adicionar registros) ou através do Painel Web integrado (interface administrativa CRUD com suporte a importação JSON/CSV e exportação).

## 🚀 Instalação Rápida e Automática (Windows e Linux)

O projeto conta com instaladores automatizados que verificam se o **Node.js** está instalado e, caso não esteja, oferecem o download e a instalação automática da versão LTS recomendada.

### 🪟 Windows

1. Dê um duplo clique no arquivo **`install.bat`** (ou execute no Prompt de Comando / PowerShell):

   ```cmd
   install.bat
   ```

2. O instalador verificará o Node.js e as dependências do projeto.
3. Para iniciar a aplicação futuramente, basta dar um duplo clique em **`iniciar.bat`** (ou `run.bat`).

---

### 🐧 Linux

1. Abra o terminal na pasta do projeto e execute:

   ```bash
   ./install.sh
   ```

   *(Caso necessário, dê permissão de execução com `chmod +x install.sh iniciar.sh`)*
2. O instalador detectará seu gerenciador de pacotes e instalará o Node.js e as dependências.
3. Para iniciar a aplicação futuramente, execute **`./iniciar.sh`** ou **`npm start`**.

---

## 🛠️ Instalação Manual

Se preferir configurar manualmente:

1. Tenha o [Node.js](https://nodejs.org/en/) (versão 18 ou superior) instalado.
2. Clone o repositório e navegue até a pasta:

   ```bash
   git clone <URL_DO_REPOSITORIO>
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

2. O servidor estará rodando em `http://localhost:3019` (ou na porta configurada pela variável `PORT`).

### Painel de Controle (Interface Web)

A aplicação disponibiliza um painel administrativo moderno diretamente no navegador para facilitar o gerenciamento dos dados do emulador.

- **Acesso:** Abra [http://localhost:3019](http://localhost:3019) no seu navegador.
- **Dashboard:** Visão geral do status da API (`UP`/`DOWN`) e a contagem total de registros em cada base mock.
- **Editor Tabular (CRUD):**
  - Navegue entre os datasets **Consignações**, **Extrato** e **Empréstimos**.
  - Crie, edite ou remova registros individualmente de forma visual.
- **Importador de Arquivos:**
  - Suporta upload de arquivos **JSON** (array de objetos) ou **CSV** (delimitador `;`).
  - Permite escolher se a importação deve adicionar registros (`append`) ou substituir todo o mock atual (`replace`).
- **Exportação:**
  - Baixe o estado atual de qualquer base de dados diretamente pela tela.

---

### Endpoints da API

A API fornece os seguintes endpoints:

#### Health Check

- **URL:** `/health`
- **Método:** `GET`
- **Descrição:** Verifica a saúde da aplicação. Retorna um status `UP` se o servidor estiver rodando.
- **Exemplo de Requisição (usando `curl`):**

  ```bash
  curl "http://localhost:3019/health"
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
    curl "http://localhost:3019/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=14772711000199&competencia=202506"
    ```

  - **Registros não encontrados (Erro LF):**

    ```bash
    curl "http://localhost:3019/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=14772711000199&competencia=202501"
    ```

  - **CNPJ com DV inválido (Erro SJ):**

    ```bash
    curl "http://localhost:3019/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=14772711000198&competencia=202506"
    ```

  - **Competência inválida (Erro CT):**

    ```bash
    curl "http://localhost:3019/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=14772711000199&competencia=202513"
    ```

  - **Sem procuração (Erro PR - Simulado):**

    ```bash
    curl "http://localhost:3019/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=99999999000199&competencia=202506"
    ```

#### Consultar Extrato do Trabalhador por Empregador

- **URL:** `/extrato-trabalhador-empregador`
- **Método:** `GET`
- **Descrição:** Retorna o extrato (histórico de empréstimos) de um trabalhador vinculado ao empregador.
- **Query Parameters:**
  - `codigoInscricao` (obrigatório): Tipo de inscrição. Usar `1` para CNPJ.
  - `numeroInscricao` (obrigatório): O número do CNPJ (14 dígitos ou 8 para a raiz).
  - `cpf` (obrigatório): O CPF do trabalhador.
- **Exemplos de Requisição (usando `curl`):**
  - **Consulta com sucesso:**

    ```bash
    curl "http://localhost:3019/extrato-trabalhador-empregador?codigoInscricao=1&numeroInscricao=47192091008403&cpf=68019017968"
    ```

  - **Registros não encontrados (Erro LF):**

    ```bash
    curl "http://localhost:3019/extrato-trabalhador-empregador?codigoInscricao=1&numeroInscricao=47192091008403&cpf=11144477735"
    ```

#### Consultar Empréstimo (unitário) por Empregador

- **URL:** `/emprestimo-trabalhador`
- **Método:** `GET`
- **Descrição:** Retorna os dados de um contrato de empréstimo específico do empregador (objeto único).
- **Query Parameters:**
  - `codigoInscricao` (obrigatório): Tipo de inscrição. Usar `1` para CNPJ.
  - `numeroInscricao` (obrigatório): O número do CNPJ (14 dígitos ou 8 para a raiz).
  - `codigoSolicitante` (obrigatório): Código do Solicitante (CBC).
  - `numeroContrato` (obrigatório): Número do contrato.
- **Exemplos de Requisição (usando `curl`):**
  - **Consulta com sucesso:**

    ```bash
    curl "http://localhost:3019/emprestimo-trabalhador?codigoInscricao=1&numeroInscricao=47192091008403&codigoSolicitante=999&numeroContrato=199912345678"
    ```

  - **Registros não encontrados (Erro LF):**

    ```bash
    curl "http://localhost:3019/emprestimo-trabalhador?codigoInscricao=1&numeroInscricao=47192091008403&codigoSolicitante=999&numeroContrato=000"
    ```

#### Atualizar Dados Mock (Bulk Update)

- **URL:** `/update-mock`
- **Método:** `POST`
- **Descrição:** Atualiza um dos arquivos de mock com novos dados. Esta funcionalidade é útil para testar diferentes cenários sem precisar editar o arquivo manualmente.
- **Query Parameters:**
  - `dataset` (opcional): Qual mock atualizar. `consignacoes` (padrão, arquivo `dados-consignacoes-mock.json`), `extrato` (`extrato-trabalhador-mock.json`) ou `emprestimo` (`emprestimo-trabalhador-mock.json`).
  - `mode` (opcional): Define o modo de atualização.
    - `replace` (padrão): Substitui todo o conteúdo do arquivo mock com os dados enviados.
    - `append`: Adiciona os dados enviados aos existentes.
- **Exemplo de Requisição (usando `curl`):**

  ```bash
  curl -X POST "http://localhost:3019/update-mock?dataset=extrato&mode=append" \
    -H "Content-Type: application/json" \
    -d '[{ "cpf": "68019017968", "numeroInscricaoEmpregador": "47192091", "emprestimos": [] }]'
  ```

#### API REST de Gerenciamento do Mock (CRUD e Utilitários)

O emulador também oferece endpoints REST para o gerenciamento individual ou importação/exportação de dados das tabelas de mock (`consignacoes`, `extrato`, `emprestimo`):

- **Listar todos os registros de um dataset:**
  - **URL:** `/api/mock/:dataset` (Ex: `/api/mock/consignacoes`)
  - **Método:** `GET`

- **Inserir registro único:**
  - **URL:** `/api/mock/:dataset`
  - **Método:** `POST`
  - **Corpo:** Objeto JSON contendo o registro único.

- **Atualizar registro por índice:**
  - **URL:** `/api/mock/:dataset/:index` (Ex: `/api/mock/consignacoes/0`)
  - **Método:** `PUT`
  - **Corpo:** Objeto JSON com a nova versão do registro.

- **Excluir registro por índice:**
  - **URL:** `/api/mock/:dataset/:index`
  - **Método:** `DELETE`

- **Importar dados em lote (JSON/CSV):**
  - **URL:** `/api/mock/:dataset/import`
  - **Método:** `POST`
  - **Query Parameters:** `mode` (opcional): `replace` (padrão) para substituir ou `append` para adicionar.
  - **Corpo:** Enviar via `multipart/form-data` contendo um arquivo no campo `file` (aceita `.json` com array de objetos ou `.csv` utilizando delimitador `;`).

- **Exportar dados como JSON:**
  - **URL:** `/api/mock/:dataset/export`
  - **Método:** `GET`
  - **Descrição:** Retorna o dataset completo em formato JSON com cabeçalho de download (`Content-Disposition`).

## Validações e Códigos de Erro

A API implementa as seguintes validações e retorna os erros correspondentes:

| Status | Código | Mensagem |
| :--- | :--- | :--- |
| 400 | `PARAM_001` | Parâmetro de pesquisa esperado não foi informado: codigoInscricao |
| 400 | `PARAM_002` | Parâmetro de pesquisa esperado não foi informado: numeroInscricao |
| 400 | `PARAM_003` | Parâmetro de pesquisa esperado não foi informado: competencia |
| 400 | `PARAM_004` | Parâmetro de pesquisa esperado não foi informado: cpf |
| 400 | `PARAM_005` | Parâmetro de pesquisa esperado não foi informado: codigoSolicitante |
| 400 | `PARAM_006` | Parâmetro de pesquisa esperado não foi informado: numeroContrato |
| 412 | `CT` | A competência de consulta está inválida |
| 412 | `CT` | Dados de Contratos para esta competência ainda não foram fechados |
| 412 | `LF` | Consulta não encontrou registros |
| 412 | `PR` | O CNPJ/CPF autenticado não possui procuração outorgada pelo empregador |
| 412 | `SJ` | O CNPJ informado está com o DV inválido |
| 412 | `SP` | O parâmetro CNPJ informado não representa um CNPJ raiz ou CNPJ completo válido |
| 412 | `SQ` | O CPF informado está com o DV inválido |
| 412 | `SU` | Número de inscrição inválido |
| 412 | `OZ` | Serviço suspenso |

### Hooks de simulação (válidos nos três serviços)

Para facilitar os testes, prefixos especiais do `numeroInscricao` disparam cenários de erro independentemente do dígito verificador:

| Prefixo do `numeroInscricao` | Erro simulado |
| :--- | :--- |
| `99999999...` | `PR` — sem procuração outorgada |
| `88888888...` | `OZ` — serviço suspenso |

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