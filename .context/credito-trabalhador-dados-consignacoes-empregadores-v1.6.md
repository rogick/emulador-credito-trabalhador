# Crédito Trabalhador — Dados de consignações para empregadores

**Versão 1.6** | Elaborado por DATAPREV

---

## Sumário

- [1. Histórico de revisões](#1-histórico-de-revisões)
- [2. Definições e resumo dos serviços disponibilizados](#2-definições-e-resumo-dos-serviços-disponibilizados)
  - [2.1 Definições](#21-definições)
  - [2.2 Resumo dos serviços disponibilizados](#22-resumo-dos-serviços-disponibilizados)
- [3. Operações](#3-operações)
  - [3.1 Consulta de Dados de Consignações para Empregadores via API](#31-consulta-de-dados-de-consignações-para-empregadores-via-api)
  - [3.2 Consulta de Extrato do Trabalhador para Empregadores via API](#32-consulta-de-extrato-do-trabalhador-para-empregadores-via-api)
  - [3.3 Consulta de Empréstimo para Empregadores via API](#33-consulta-de-empréstimo-para-empregadores-via-api)
- [4. Apêndice](#4-apêndice)
  - [4.1 Códigos de retorno](#41-códigos-de-retorno)
- [5. Anexos](#5-anexos)
  - [5.1 Autenticação e conectividade no gateway de API](#51-autenticação-e-conectividade-no-gateway-de-api)
  - [5.2 Fluxos, serviços, portais e backlog](#52-fluxos-serviços-portais-e-backlog)
  - [5.3 Mais informações](#53-mais-informações)
  - [5.4 Swagger](#54-swagger)
  - [5.5 Utilização do serviço na prática](#55-utilização-do-serviço-na-prática)
  - [5.6 Esclarecimentos sobre Empregador e Estabelecimento no eSocial](#56-esclarecimentos-sobre-empregador-e-estabelecimento-no-esocial)
  - [5.7 Perguntas frequentes (FAQ)](#57-perguntas-frequentes-faq)

---

## 1 Histórico de revisões

| Data | Versão | Descrição |
|---|---|---|
| 31/03/2025 | 1.0 | Elaboração inicial do documento. |
| 03/04/2025 | 1.1 | Inclusão de campos no leiaute de retorno. Esclarecimentos sobre procedimentos operacionais para o consumo das informações. Inclusão de capítulo para perguntas frequentes (FAQ). |
| 07/05/2025 | 1.2 | Alteração de leiaute para que informações de CNPJ e CPF sejam alfanuméricas. Inclusão da possibilidade de acesso via certificado digital, pessoa física, com procurações específicas para realização da consulta. |
| 14/05/2025 | 1.3 | Esclarecimentos adicionais sobre a utilização do serviço. |
| 15/05/2025 | 1.4 | Revisão após reunião com empresas do grupo de testes piloto do serviço: ajustes de endereços dos exemplos; ajustes nos parâmetros da requisição; melhoria nas regras de validação e negócio; planificação de dados de resposta do serviço conforme Portal Emprega Brasil. |
| 10/06/2026 | 1.5 | Alteração do tipo do campo `numeroInscricao` de integer para String no serviço de Consulta de Dados de Consignações. Inclusão do código de retorno `OZ` (Serviço suspenso). Inclusão de dois novos serviços: Consulta de Extrato do Trabalhador para Empregadores via API e Consulta de Empréstimo para Empregadores via API. Esclarecimento sobre restrição de acesso: os serviços retornam dados apenas de trabalhadores vinculados ao empregador consultante. |
| 11/06/2026 | 1.6 | Alteração do tipo do campo `cpf` de integer para String no serviço de Consulta de Extrato do Trabalhador para Empregadores via API. Inclusão de mensagens explicativas para esclarecimentos de serviços. |

---

## 2 Definições e resumo dos serviços disponibilizados

### 2.1 Definições

O horário de funcionamento das operações é entre **00:00 e 23:59**.

Informações de acesso, processo de subscrição, utilização de APIs, endereços, swagger e pré-condições estabelecidas podem ser obtidas em: <https://docs.dataprev.gov.br/docs/credito-trabalhador/>

Dentro do fluxo operacional do Crédito Trabalhador, a jornada inicia-se com o empregador recebendo uma notificação, por meio do **Domicílio Eletrônico Trabalhista (DET)**, sobre a existência de consignações realizadas por seus colaboradores que estejam aptas para desconto. A partir desse ponto, o empregador precisa acessar o **Portal Emprega Brasil** para realizar o download dessas informações. Este manual apresenta uma alternativa para o acesso a esses dados por meio de API, oferecendo maior eficiência e automatização ao processo.

A API é pública. Sua autenticação é feita com **certificado digital de pessoa jurídica** vinculado ao CNPJ do empregador. Também é possível o acesso com certificado de pessoa jurídica ou física que possuam **procuração** para acesso aos dados do CNPJ do empregador.

O sistema utiliza **procurações eletrônicas** em integração com o SERPRO. Os códigos dos sistemas utilizados no contexto do Crédito Trabalhador são:

- `00137` — grupo rotinas
- `00142` — desligamento
- `88888` — permissão total

> Para mais detalhes sobre procurações eletrônicas: <https://www.gov.br/esocial/pt-br/acesso-ao-sistema/orientacoes-assinatura-digital-e-procuracao-eletronica>

**O que você encontrará neste guia:**

- Como acessar a API de consignações
- Estrutura dos dados retornados
- Requisitos técnicos (certificação digital, protocolos SSL, truststore)
- Exemplo de resposta JSON
- Links para os portais de homologação e produção
- Regras específicas para integração com o Gateway de APIs da Dataprev

### 2.2 Resumo dos serviços disponibilizados

1. **Consulta de Dados de Consignações para Empregadores via API** — integração com a API de consulta de dados de consignações destinadas aos empregadores, permitindo acesso automatizado e seguro. Utilizada para obtenção dos dados necessários ao processamento mensal da folha de pagamento, incluindo os descontos de parcelas dos empréstimos consignados ativos.

2. **Consulta de Extrato do Trabalhador para Empregadores via API** — integração com a API de consulta do extrato do trabalhador, permitindo acesso automatizado e seguro ao histórico de movimentações do trabalhador.

3. **Consulta de Empréstimo (unitário) para Empregadores via API** — integração com a API de consulta de empréstimos, permitindo acesso automatizado e seguro aos dados de contratos de empréstimo dos colaboradores. Utilizada para consulta de contratos ativos, incluindo informações para apoiar procedimentos de desligamento e cálculo das garantias rescisórias.

> ⚠️ **Importante:** Todos os serviços retornam dados somente referentes aos trabalhadores **vinculados ao empregador autenticado**. Não é possível consultar dados de trabalhadores de outros empregadores.

---

## 3 Operações

### 3.1 Consulta de Dados de Consignações para Empregadores via API

#### 3.1.1 Campos da requisição

| Nome | Tipo | Local | Obrigatório | Descrição |
|---|---|---|---|---|
| `codigoInscricao` | Número | query parameter | Sim | Código de Inscrição do Empregador (ex: 1 = CNPJ) |
| `numeroInscricao` | Texto | query parameter | Sim | Número de Inscrição do Empregador (8 ou 14 caracteres) |
| `competencia` | Número | query parameter | Sim | Competência de referência no formato AAAAMM |

> O campo `codigoInscricao` informa o tipo de inscrição ao qual o número em `numeroInscricao` está associado. Esta solução é válida **somente para empregadores do tipo 1 (CNPJ)**.

#### 3.1.2 Exemplo via API

**Verbo HTTP:** `GET`

**Homologação:**
```
https://hapidf-mssl.dataprev.gov.br/credito-trabalhador-empregador/v1.0.0/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=42422253&competencia=202505
```

**Produção:**
```
https://papiecotrab.dataprev.gov.br/credito-trabalhador-empregador/v1.0.0/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=42422253&competencia=202505
```

> Body: não se aplica. Os parâmetros são passados via query parameter.

#### 3.1.3 Campos do retorno

| Campo | Descrição | Tipo | Formato | Obrigatório |
|---|---|---|---|---|
| `ifConcessora.codigo` | Código da instituição financeira | Número | 3 algarismos | Sim |
| `ifConcessora.descricao` | Nome da instituição financeira | Texto | 40 caracteres | Sim |
| `contrato` | Número do contrato do empréstimo consignado | Texto | 15 caracteres | Sim |
| `cpf` | CPF do trabalhador | Texto | 11 algarismos (zeros à esquerda) | Sim |
| `matricula` | Matrícula atribuída ao trabalhador pelo empregador | Texto | 30 caracteres | Não |
| `inscricaoEmpregador.codigo` | Código do tipo de inscrição do empregador | Número | 1 algarismo (conforme eSocial) | Sim |
| `inscricaoEmpregador.descricao` | Descrição do tipo de inscrição do empregador | Texto | "CNPJ" / "CPF" | Sim |
| `numeroInscricaoEmpregador` | Número de inscrição do empregador | Texto | 15 algarismos | Sim |
| `nomeTrabalhador` | Nome do trabalhador | Texto | 90 caracteres | Sim |
| `nomeEmpregador` | Nome do empregador | Texto | 150 caracteres | Sim |
| `dataInicioContrato` | Data do início do contrato | Texto | dd/mm/yyyy | Sim |
| `dataFimContrato` | Data de fim do contrato | Texto | dd/mm/yyyy | Sim |
| `competenciaInicioDesconto` | Competência de início do desconto | Texto | mm/yyyy | Sim |
| `competenciaFimDesconto` | Competência de fim do desconto | Texto | mm/yyyy | Sim |
| `totalParcelas` | Quantidade total de parcelas | Número | 3 algarismos | Sim |
| `valorParcela` | Valor da parcela do empréstimo consignado | Número | `<10 alg.>.<2 alg.>` | Sim |
| `valorEmprestimo` | Montante financeiro efetivamente emprestado (sobre o qual incidem juros e encargos) | Número | `<10 alg.>.<2 alg.>` | Sim |
| `valorLiberado` | Valor líquido repassado ao trabalhador após descontos | Número | `<10 alg.>.<2 alg.>` | Sim |
| `qtdPagamentos` | Quantidade de pagamentos realizados | Número | 3 algarismos | Não |
| `qtdEscrituracoes` | Quantidade de escriturações realizadas | Número | 3 algarismos | Não |
| `categoriaTrabalhador.codigo` | Código da categoria do trabalhador | Número | 3 algarismos (conforme eSocial) | Sim |
| `categoriaTrabalhador.descricao` | Descrição da categoria do trabalhador | Texto | Conforme eSocial | Sim |
| `competencia` | Competência de pesquisa | Texto | mm/yyyy | Sim |
| `inscricaoEstabelecimento.codigo` | Código do tipo de inscrição do estabelecimento | Número | 1 algarismo (conforme eSocial) | Não |
| `inscricaoEstabelecimento.descricao` | Descrição do tipo de inscrição do estabelecimento | Texto | "CNPJ" / "CNO" / "CAEPF" | Não |
| `numeroInscricaoEstabelecimento` | Número de inscrição do estabelecimento | Texto | 15 algarismos | Não |
| `dataAdmissao` | Data de admissão do vínculo | Texto | dd/mm/yyyy | Não |

---

### 3.2 Consulta de Extrato do Trabalhador para Empregadores via API

#### 3.2.1 Campos da requisição

| Nome | Tipo | Local | Obrigatório | Descrição |
|---|---|---|---|---|
| `codigoInscricao` | integer | query parameter | Sim | Código de Inscrição do Empregador (ex: 1 = CNPJ) |
| `numeroInscricao` | Texto | query parameter | Sim | Número de Inscrição do Empregador (8 ou 14 caracteres) |
| `cpf` | Texto | query parameter | Sim | CPF do Trabalhador |

#### 3.2.2 Exemplo via API

**Verbo HTTP:** `GET`

**Homologação:**
```
https://hapidf-mssl.dataprev.gov.br/credito-trabalhador-empregador/v1.0.0/extrato-trabalhador-empregador?codigoInscricao=1&numeroInscricao=47192091008403&cpf=68019017968
```

**Produção:**
```
https://papiecotrab.dataprev.gov.br/credito-trabalhador-empregador/v1.0.0/extrato-trabalhador-empregador?codigoInscricao=1&numeroInscricao=47192091008403&cpf=68019017968
```

> Body: não se aplica. Os parâmetros são passados via query parameter.

#### 3.2.3 Campos do retorno

| Campo | Descrição | Tipo | Formato | Obrigatório |
|---|---|---|---|---|
| `cpf` | CPF do Trabalhador | Texto | 11 algarismos | Sim |
| `matricula` | Matrícula do Trabalhador | Texto | 30 caracteres | Sim |
| `inscricaoEmpregador.codigo` | Código do tipo de inscrição do empregador | Número | 1 algarismo (conforme eSocial) | Sim |
| `inscricaoEmpregador.descricao` | Descrição do tipo de inscrição do empregador | Texto | Ex: CNPJ | Sim |
| `numeroInscricaoEmpregador` | Número de Inscrição do Empregador | Texto | 15 algarismos | Sim |
| `nomeTrabalhador` | Nome do Trabalhador | Texto | 90 caracteres | Sim |
| `nomeEmpregador` | Nome do Empregador | Texto | 150 caracteres | Sim |
| `emprestimos[].ifConcessora.codigo` | Código da instituição financeira concessionária | Número | 3 algarismos | Sim |
| `emprestimos[].ifConcessora.descricao` | Descrição da instituição financeira concessionária | Texto | 40 caracteres | Sim |
| `emprestimos[].contrato` | Número de Contrato | Texto | 15 caracteres | Sim |
| `emprestimos[].situacaoEmprestimo.codigo` | Código da situação do empréstimo | Número | 1 algarismo | Sim |
| `emprestimos[].situacaoEmprestimo.descricao` | Descrição da situação do empréstimo | Texto | Ex: Ativo | Sim |
| `emprestimos[].competenciaInicioDesconto` | Competência de início do desconto | Texto | MM/yyyy | Sim |
| `emprestimos[].competenciaFimDesconto` | Competência de fim do desconto | Texto | MM/yyyy | Sim |
| `emprestimos[].dataInicioContrato` | Data de Início do Contrato | Texto | dd/MM/yyyy | Sim |
| `emprestimos[].dataFimContrato` | Data de Fim do Contrato | Texto | dd/MM/yyyy | Sim |
| `emprestimos[].totalParcelas` | Quantidade de parcelas | Número | 3 algarismos | Sim |
| `emprestimos[].valorParcela` | Valor da parcela do empréstimo | Número | `<10 alg.>.<2 alg.>` | Sim |
| `emprestimos[].valorEmprestimo` | Montante financeiro efetivamente emprestado | Número | `<10 alg.>.<2 alg.>` | Sim |
| `emprestimos[].valorLiberado` | Valor líquido repassado ao trabalhador | Número | `<10 alg.>.<2 alg.>` | Sim |
| `emprestimos[].valorSaldoDevedor` | Valor do saldo devedor atual | Número | `<10 alg.>.<2 alg.>` | Não |
| `emprestimos[].garantia.temGarantias` | Indicador se foi utilizado FGTS como garantia | Booleano | true / false | Não |
| `emprestimos[].garantia.percVerbaRescisoriaGarantia` | Percentual da verba rescisória para garantia (até 35%) | Número | `<2 alg.>.<2 alg.>` | Não |

---

### 3.3 Consulta de Empréstimo para Empregadores via API

#### 3.3.1 Campos da requisição

| Nome | Tipo | Local | Obrigatório | Descrição |
|---|---|---|---|---|
| `codigoInscricao` | integer | query parameter | Sim | Tipo de Inscrição do Empregador (ex: 1 = CNPJ) |
| `numeroInscricao` | String | query parameter | Sim | Número de Inscrição do Empregador (8 ou 14 caracteres) |
| `codigoSolicitante` | integer | query parameter | Sim | Código do Solicitante (CBC) |
| `numeroContrato` | String | query parameter | Sim | Número de Contrato |

#### 3.3.2 Exemplo via API

**Verbo HTTP:** `GET`

**Homologação:**
```
https://hapidf-mssl.dataprev.gov.br/credito-trabalhador-empregador/v1.0.0/emprestimo-trabalhador?codigoInscricao=1&numeroInscricao=47192091008403&codigoSolicitante=999&numeroContrato=199912345678
```

**Produção:**
```
https://papiecotrab.dataprev.gov.br/credito-trabalhador-empregador/v1.0.0/emprestimo-trabalhador?codigoInscricao=1&numeroInscricao=47192091008403&codigoSolicitante=999&numeroContrato=199912345678
```

> Body: não se aplica. Os parâmetros são passados via query parameter.

#### 3.3.3 Campos do retorno

| Campo | Descrição | Tipo | Formato | Obrigatório |
|---|---|---|---|---|
| `ifConcessora.codigo` | Código da instituição financeira concessionária | Número | 3 algarismos | Sim |
| `ifConcessora.descricao` | Descrição da instituição financeira concessionária | Texto | 40 caracteres | Sim |
| `contrato` | Número de Contrato | Texto | 15 caracteres | Sim |
| `cpf` | CPF do Trabalhador | Texto | 11 algarismos | Sim |
| `matricula` | Matrícula do Trabalhador | Texto | 30 caracteres | Sim |
| `inscricaoEmpregador.codigo` | Código do tipo de inscrição do empregador | Número | 1 algarismo (conforme eSocial) | Sim |
| `inscricaoEmpregador.descricao` | Descrição do tipo de inscrição do empregador | Texto | Ex: CNPJ | Sim |
| `numeroInscricaoEmpregador` | Número de Inscrição do Empregador | Texto | 15 algarismos | Sim |
| `nomeTrabalhador` | Nome do Trabalhador | Texto | 90 caracteres | Sim |
| `nomeEmpregador` | Nome do Empregador | Texto | 150 caracteres | Sim |
| `dataInicioContrato` | Data de Início do Contrato | Texto | dd/MM/yyyy | Sim |
| `dataFimContrato` | Data de Fim do Contrato | Texto | dd/MM/yyyy | Sim |
| `competenciaInicioDesconto` | Competência de início do desconto | Texto | MM/yyyy | Sim |
| `competenciaFimDesconto` | Competência de fim do desconto | Texto | MM/yyyy | Sim |
| `situacaoEmprestimo.codigo` | Código da situação do empréstimo | Número | 1 algarismo | Sim |
| `situacaoEmprestimo.descricao` | Descrição da situação do empréstimo | Texto | Ex: Ativo | Sim |
| `totalParcelas` | Quantidade de parcelas | Número | 3 algarismos | Sim |
| `valorParcela` | Valor da parcela do empréstimo | Número | `<10 alg.>.<2 alg.>` | Sim |
| `valorEmprestimo` | Montante financeiro efetivamente emprestado | Número | `<10 alg.>.<2 alg.>` | Sim |
| `valorLiberado` | Valor líquido repassado ao trabalhador | Número | `<10 alg.>.<2 alg.>` | Sim |
| `valorSaldoDevedor` | Valor do saldo devedor atual | Número | `<10 alg.>.<2 alg.>` | Não |
| `garantia.temGarantias` | Indicador se foi utilizado FGTS como garantia | Booleano | true / false | Não |
| `garantia.percVerbaRescisoriaGarantia` | Percentual da verba rescisória para garantia (até 35%) | Número | `<2 alg.>.<2 alg.>` | Não |

---

## 4 Apêndice

### 4.1 Códigos de retorno

| Código | Descrição | HTTP |
|---|---|---|
| — | Parâmetro de pesquisa esperado não foi informado: `codigoInscricao` | 400 |
| — | Parâmetro de pesquisa esperado não foi informado: `numeroInscricao` | 400 |
| — | Parâmetro de pesquisa esperado não foi informado: `competencia` | 400 |
| `CT` | A competência de consulta está inválida (ex: `2025001`) | 412 |
| `CT` | Dados de Contratos para esta competência ainda não foram fechados (ex: `202512` quando a última fechada é `202505`) | 412 |
| `LF` | Consulta não encontrou registros | 412 |
| `PR` | O CNPJ/CPF autenticado não possui procuração outorgada pelo empregador | 412 |
| `SJ` | O CNPJ informado está com o DV inválido | 412 |
| `SP` | O parâmetro CNPJ informado não representa um CNPJ raiz ou CNPJ completo válido (ex: valor negativo ou excessivamente longo) | 412 |
| `SQ` | O CPF informado está com o DV inválido | 412 |
| `OZ` | Serviço suspenso | 412 |

---

## 5 Anexos

### 5.1 Autenticação e conectividade no gateway de API

A Dataprev disponibiliza uma API pública — **não exige cadastro, subscrição prévia ou uso de credenciais específicas**. O controle de acesso é feito exclusivamente por meio de **certificação digital**.

> ⚠️ Basta que o sistema consumidor esteja configurado para realizar chamadas HTTPS autenticadas com um **certificado digital válido (padrão ICP-Brasil)**.

**Para consumir os serviços:**

1. Configure o cliente HTTP para realizar requisição mútua **TLS (MTLS)** com o certificado digital.
2. Utilize diretamente a URL completa da API fornecida na documentação.
3. A requisição será processada normalmente desde que o certificado seja válido.

**Informações de acesso:**

- **Nome da API:** `creditoTrabalhadorEmpregador`
- **Versão:** `v1.0.0`

| Ambiente | Base URL | URL completa (exemplo) |
|---|---|---|
| Homologação | `https://hapidf-mssl.dataprev.gov.br` | `https://hapidf-mssl.dataprev.gov.br/credito-trabalhador-empregador/v1.0.0/dados-consignacoes-empregador?codigoInscricao=?&numeroInscricao=?&competencia=?` |
| Produção | `https://papiecotrab.dataprev.gov.br` | `https://papiecotrab.dataprev.gov.br/credito-trabalhador-empregador/v1.0.0/dados-consignacoes-empregador?codigoInscricao=?&numeroInscricao=?&competencia=?` |

Para a efetiva execução das operações:

- Enviar o certificado digital junto à requisição para o handshake TLS. Sem certificado válido, a conexão não é estabelecida.
- A autenticação é feita com o **CNPJ ou CPF** do certificado enviado.
- Formato dos serviços: **REST/JSON**, padrão OpenAPI 3.0.
- Protocolo: **HTTPS**, exigido **TLS 1.2 ou superior**.

#### 5.1.1 Requisitos de Truststore e Certificados

Dependendo da arquitetura do sistema, pode ser necessário instalar a cadeia de certificados da Dataprev na truststore local. Para obtenção dos certificados:

- Durante a negociação SSL (handshake)
- Acessando os endpoints diretamente via navegador
- Via OpenSSL:

```bash
openssl s_client -servername papiecotrab.dataprev.gov.br \
  -connect papiecotrab.dataprev.gov.br:443 | openssl x509 -text
```

#### 5.1.2 Certificados Digitais CNPJ — ICP Brasil

- Certificado padrão ICP-Brasil para **pessoa jurídica**, com o nome do empregador vinculado ao CNPJ.
- Campos recomendados na extensão Subject:
  - `CN` = host + domínio internet registrado
  - `OU` = Nome do Empregador
  - `OU` = `nnnnnnnn` (base do CNPJ)

> **Restrição obrigatória:** o certificado deve estar vinculado ao CNPJ do empregador. Em certificados ICP-Brasil (PJ), essa informação deve constar na extensão `Subject Alternative Name`, no campo `OtherName` com `OID=2.16.76.1.3.3`, conforme a Instrução Normativa ITI Nº 15, de 18/11/2020.

#### 5.1.3 Certificados Digitais CPF — ICP Brasil

- Certificado padrão ICP-Brasil para **pessoa física**, vinculado ao CPF do titular.
- Campos recomendados na extensão Subject:
  - `CN` = Nome completo do titular
  - `OU` = CPF do titular (sem pontuação)
  - ou `CN` = `Nome completo do titular:CPF do titular (sem pontuação)`

> **Restrição obrigatória:** o certificado deve estar vinculado ao CPF do titular. Em certificados ICP-Brasil (PF), o CPF deve constar na extensão `Subject Alternative Name`, no campo `OtherName` com `OID=2.16.76.1.3.1`. O CPF sempre ocupa os **bytes 9 a 19** da sequência (contagem iniciando em 1).

---

### 5.2 Fluxos, serviços, portais e backlog

<https://docs.dataprev.gov.br/docs/credito-trabalhador/fluxos-servicos-portais-e-backlog>

---

### 5.3 Mais informações

<https://docs.dataprev.gov.br/docs/credito-trabalhador/>

---

### 5.4 Swagger

1. Acesse a Loja de APIs:
   - Homologação: <https://hstore.dataprev.gov.br/devportal/>
   - Produção: <https://store.dataprev.gov.br/devportal/>
2. Na caixa de pesquisa, digite `creditoTrabalhadorEmpregador` e pressione Enter.
3. As informações da API serão exibidas, incluindo a documentação no formato Swagger (OpenAPI).

> ⚠️ Devido à exigência de certificado digital, **não é possível utilizar a funcionalidade "Try out"** diretamente pela loja de APIs.

---

### 5.5 Utilização do serviço na prática

#### 5.5.1 Via comando CURL

A API não exige cadastro, subscrição ou geração de token. A única exigência é um **certificado digital válido**.

**Certificado no formato `.pfx` (PKCS#12):**

```bash
curl --cert-type P12 --cert certificado.pfx:senha_do_certificado \
  "https://hapidf-mssl.dataprev.gov.br/credito-trabalhador-empregador/v1.0.0/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=42422253&competencia=202505"
```

**Certificado no formato `.pem` / `.cer` (com chave separada):**

```bash
curl --cert /caminho/para/certificado.pem --key /caminho/para/chave-privada.key \
  "https://hapidf-mssl.dataprev.gov.br/credito-trabalhador-empregador/v1.0.0/dados-consignacoes-empregador?codigoInscricao=1&numeroInscricao=42422253&competencia=202505"
```

> Outras formas de integração também são possíveis: Java, Python, Node.js ou qualquer outra linguagem com suporte a MTLS.

---

### 5.6 Esclarecimentos sobre Empregador e Estabelecimento no eSocial

No eSocial, existem duas informações distintas vinculadas ao trabalhador:

**1. Identificação do Empregador (`ideEmpregador`)**

- `tpInsc` (Tipo de Inscrição):
  - `1` = CNPJ
  - `2` = CPF
- `nrInsc` (Número da Inscrição): número conforme o tipo informado em `tpInsc`. É a identificação principal do empregador no eSocial.

**2. Identificação do Estabelecimento**

- Refere-se ao **CNPJ completo (14 dígitos)** do estabelecimento ao qual o trabalhador está alocado.
- Opcional quando o empregador é identificado por CPF.

No sistema Crédito Trabalhador, os contratos de empréstimo estão vinculados ao **empregador**, identificado majoritariamente pelo **CNPJ raiz**.

> A identificação do estabelecimento específico (filial) **não é retornada** pelo sistema atualmente.

---

### 5.7 Perguntas frequentes (FAQ)

#### 5.7.1 Quando posso obter as informações no serviço?

A Dataprev disponibiliza mensalmente os dados de consignações aptas para desconto. A competência mensal do Crédito Trabalhador encerra-se sempre no **dia 20** de cada mês.

**Entre os dias 21 e 25**, a Dataprev:

- Notifica os empregadores via **DET** (em integração com o SERPRO)
- Disponibiliza os dados das consignações no **Portal Emprega Brasil**

> A partir da disponibilização, as informações ficam disponíveis para consumo **a qualquer tempo**.

> Calendário operacional: <https://docs.dataprev.gov.br/docs/credito-trabalhador/calendario-operacional/>

#### 5.7.2 Modelo Simplificado do eSocial

Para vínculos no modelo simplificado (ex: empregados domésticos), a Dataprev enviará automaticamente (em integração com o SERPRO) os contratos consignados, que serão integrados à folha via **eSocial Web (DAE)**. O empregador **não precisará realizar a escrituração manual** dos dados.

#### 5.7.3 Importância da escrituração correta

As empresas devem utilizar as guias de recolhimento do **FGTS Digital** para efetuar o pagamento das parcelas dos empréstimos consignados. A inclusão desses débitos na guia exige que os eventos relacionados ao empréstimo consignado estejam **corretamente escriturados no eSocial**.
