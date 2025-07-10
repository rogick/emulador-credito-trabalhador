# Emulador de Crédito ao Trabalhador

Este projeto é um emulador de API para um sistema de crédito consignado. Ele utiliza um arquivo JSON como uma base de dados mock para simular a consulta de informações de consignações de trabalhadores. A aplicação é construída com Node.js e Express.

## Funcionalidades

- Servir dados mock de consignações a partir de um arquivo JSON.
- Filtrar consignações por CPF do trabalhador.
- Filtrar consignações por múltiplos CPFs.
- Agrupar consignações por CPF e somar os valores das parcelas.

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

A API fornece os seguintes endpoints para interagir com os dados de consignação:

#### Listar todas as consignações

- **URL:** `/consignacoes`
- **Método:** `GET`
- **Descrição:** Retorna uma lista com todos os contratos de consignação.
- **Exemplo de Requisição (usando curl):**
  ```bash
  curl http://localhost:3000/consignacoes
  ```

#### Buscar consignações por CPF

- **URL:** `/consignacoes/:cpf`
- **Método:** `GET`
- **Descrição:** Retorna uma lista de contratos de consignação para um CPF específico.
- **Parâmetros:**
  - `cpf` (string): O CPF do trabalhador.
- **Exemplo de Requisição (usando curl):**
  ```bash
  curl http://localhost:3000/consignacoes/77824324729
  ```

#### Buscar consignações para múltiplos CPFs

- **URL:** `/consignacoes`
- **Método:** `POST`
- **Descrição:** Retorna uma lista de contratos de consignação para uma lista de CPFs fornecida no corpo da requisição.
- **Corpo da Requisição (Body):**
  ```json
  {
    "cpfs": ["77824324729", "93097676503"]
  }
  ```
- **Exemplo de Requisição (usando curl):**
  ```bash
  curl -X POST -H "Content-Type: application/json" -d '{"cpfs": ["77824324729", "93097676503"]}' http://localhost:3000/consignacoes
  ```

#### Agrupar consignações por CPF

- **URL:** `/consignacoes/agrupado-por-cpf`
- **Método:** `GET`
- **Descrição:** Retorna os dados agrupados por CPF, com a soma do valor das parcelas e a lista de contratos de cada trabalhador.
- **Exemplo de Requisição (usando curl):**
  ```bash
  curl http://localhost:3000/consignacoes/agrupado-por-cpf
  ```

> **Nota:** O projeto inclui as dependências `multer` e `csv-parser`, sugerindo que pode haver uma funcionalidade de upload de arquivos CSV. Um endpoint como `POST /upload` pode estar disponível para isso.

## Estrutura dos Dados

Os dados de consignação são armazenados no arquivo `dados-consignacoes-mock.json`. Cada objeto no array representa um contrato de consignação com a seguinte estrutura (exemplo):

```json
{
  "ifConcessora.codigo": 908,
  "ifConcessora.descricao": "PARATI CFI S A",
  "contrato": 678001209,
  "cpf": 77824324729,
  "matricula": 9400,
  "valorParcela": "284,41"
}
```

## Dependências

As dependências do projeto estão listadas no arquivo `package.json`:
- `express`: Framework web para Node.js.
- `multer`: Middleware para manipulação de `multipart/form-data`, usado para upload de arquivos.
- `csv-parser`: Parser de streaming de CSV para Node.js.