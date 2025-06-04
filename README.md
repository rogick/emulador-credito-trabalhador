# Emulador Crédito Trabalhador

Este projeto é um emulador de API para consulta de dados de consignações de empregadores, desenvolvido em Node.js com Express. Ele simula respostas de uma API real, utilizando dados mockados em um arquivo JSON.

## Funcionalidades

- Endpoint para consulta de dados de consignações de empregadores.
- Validação de parâmetros obrigatórios.
- Autenticação via API Key.
- Respostas mockadas baseadas em parâmetros da requisição.
- Retorno de erros padronizados para parâmetros inválidos ou ausentes.

## Pré-requisitos

- Node.js (versão 18 ou superior)
- npm

## Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/SEU_USUARIO/emulador-credito-trabalhador.git
   cd emulador-credito-trabalhador
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Crie um arquivo `.env` na raiz do projeto (exemplo já incluso):
   ```
   PORT=3003
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=seu_usuario
   DB_PASSWORD=sua_senha
   DB_NAME=nome_do_banco
   JWT_SECRET=sua_chave_secreta
   ```

4. Certifique-se de que o arquivo `dados-consignacoes-mock.json` está presente na raiz do projeto e contém os dados mockados.

## Uso

Inicie o servidor:

```bash
npm start
```

O servidor estará disponível em `http://localhost:3003` (ou na porta definida no `.env`).

### Endpoint disponível

```
GET /dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=12345678000195&competencia=202501
```

#### Parâmetros obrigatórios

- `codigoInscricao`: Código de inscrição do empregador (inteiro).
- `numeroInscricao`: Número de inscrição do empregador (string).
- `competencia`: Competência no formato AAAAMM (ex: 202501 para Jan/2025).

#### Autenticação

Inclua o header `apikey` com o valor definido na constante `EXPECTED_API_KEY` do código (padrão: `supersecretapikey`).

Exemplo de requisição com `curl`:

```bash
curl -H "apikey: supersecretapikey" "http://localhost:3003/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=12345678000195&competencia=202501"
```

## Observações

- Para a competência `202412`, o endpoint retorna uma lista vazia (simulando ausência de dados).
- O arquivo `.gitignore` já está configurado para ignorar arquivos sensíveis e diretórios comuns de build/cache.

## Licença

Este projeto está licenciado sob a licença ISC.
