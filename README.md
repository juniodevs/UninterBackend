# API Rede Raizes do Nordeste

Projeto Multidisciplinar de Back-End da UNINTER (2026).  
Aluno: RU 5195825

API REST desenvolvida para gerenciar pedidos, estoque e cardapio da rede de lanchonetes Raizes do Nordeste, atendendo canais como totem, app e balcao.

## Links e informacoes de entrega

* Repositorio Git: https://github.com/juniodevs/UninterBackend
* Documentacao Swagger local: http://localhost:3000/docs
* Colecao de testes Postman: arquivo postman_collection.json disponivel na raiz deste projeto

## Requisitos de ambiente

* Node.js 18 ou superior instalado
* npm 9 ou superior
* SQLite (gerenciado pelo Prisma ORM, sem necessidade de banco externo instalado)

## Organizacao do projeto

O codigo-fonte foi estruturado em quatro camadas:

* src/domain: tipos basicos, enums de status de pedidos e canais de venda.
* src/application: regras de negocio para criacao de pedidos, estoque, autenticacao e pagamento mock.
* src/infrastructure: cliente do Prisma, conexao com o banco SQLite e gravacao de logs de auditoria.
* src/api: controllers, rotas Express, middlewares de JWT e formatador padrao de erros.

## Passo a passo para rodar o projeto

### 1. Clonar ou abrir a pasta do projeto

Abra o terminal na pasta raiz:

```bash
cd UninterBackend
```

### 2. Configurar as variaveis de ambiente

Crie o arquivo .env a partir do modelo .env.example:

No Windows (PowerShell):
```powershell
Copy-Item .env.example .env
```

No Linux ou macOS:
```bash
cp .env.example .env
```

Conteudo padrao do .env:
```env
PORT=3000
DATABASE_URL="file:./dev.db"
JWT_SECRET="raizes_do_nordeste_jwt_super_secret_key_2026"
```

### 3. Instalar dependencias

Execute:
```bash
npm install
```

### 4. Gerar o client e rodar as migrations

Para criar o arquivo SQLite e a estrutura das tabelas:
```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. Popular o banco com dados de teste (Seed)

O comando de seed cadastra duas unidades (Recife e Sao Paulo), produtos tipicos (cuscuz, tapiocas, canjica junina), saldos de estoque por filial e tres usuarios:
```bash
npm run seed
```

Contas cadastradas para teste:
* Administrador: francisca@raizesdonordeste.com.br | Senha: Senha@123 (perfil ADMIN)
* Gerente de filial: joao.gerente@raizesdonordeste.com.br | Senha: Senha@123 (perfil GERENTE)
* Cliente: maria.cliente@exemplo.com | Senha: Senha@123 (perfil CLIENTE)

### 6. Iniciar o servidor

Modo de desenvolvimento (com recarregamento automatico):
```bash
npm run dev
```

A API vai responder em:
```
http://localhost:3000
```

Teste rapido de status:
```
http://localhost:3000/api/health
```

## Documentacao da API (Swagger)

Com o servidor rodando, acesse pelo navegador:
```
http://localhost:3000/docs
```

Pela interface interativa e possivel testar as rotas, conferir os schemas JSON esperados e checar os retornos de erro.

## Execucao dos testes no Postman

O arquivo postman_collection.json contem os 10 cenarios obrigatorios exigidos pelo roteiro (6 positivos e 4 negativos com validacao de status code e regras de negocio).

Instrucoes para rodar:
1. Abra o Postman.
2. Clique em Import e selecione o arquivo postman_collection.json na raiz do projeto.
3. A colecao divide as chamadas por pastas.
4. Rode as requisicoes seguindo esta sequencia:
   * T01: Login valido (pega o token e salva na variavel da colecao automaticamente).
   * T02: Acesso a rota protegida sem token (retorna 401).
   * T03: Cliente tentando movimentar estoque (retorna 403 por falta de perfil GERENTE/ADMIN).
   * T04: Consulta de cardapio por unidade (retorna 200 e a lista com disponibilidade).
   * T05: Criacao de pedido informando canalPedido como TOTEM (retorna 201 e debita estoque).
   * T06: Criacao de pedido sem canalPedido (retorna 422 demonstrando a regra de multicanalidade).
   * T07: Pedido com quantidade maior do que o estoque disponivel (retorna 409).
   * T08: Filtro de pedidos por canal via query param ?canalPedido=TOTEM (retorna 200).
   * T09: Pagamento mock aprovado (retorna 200 e muda status do pedido para PREPARANDO).
   * T10: Pagamento mock recusado (retorna 402 e grava o motivo no banco).
