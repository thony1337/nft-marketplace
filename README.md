# Kurio — Marketplace de NFTs

Front-end do desafio "Marketplace de NFTs": catálogo, detalhe, carrinho, pagamento com confirmação simulada,
comprovante, conta, perfil e carteiras, com atualizações em tempo real (Socket.IO), em desktop e mobile.
Não existe back-end: a API REST e o servidor Socket.IO são **simulados na camada de rede com MSW**
(decisões, contratos e limites em [ARCHITECTURE.md](./ARCHITECTURE.md)).

- **Aplicação publicada:** <https://thony1337-nft-marketplace.vercel.app>
- **Repositório:** <https://github.com/thony1337/nft-marketplace>
- **Credenciais fictícias:** `anthony@example.com` / `Senha@123` · segundo usuário (para testar isolamento):
  `collector@example.com` / `Senha@123`. Também é possível criar uma conta pelo cadastro.

## Stack

React 19 + TypeScript · Vite · TanStack Router · TanStack Query · Axios · Socket.IO client · Tailwind CSS v4 ·
shadcn/ui (Radix) · MSW + `@mswjs/socket.io-binding` · Zod · Decimal.js · Playwright · Lighthouse

## Setup

Requisitos: Node 20+ e npm. A partir de um checkout limpo:

```bash
npm ci
npm run dev        # http://localhost:5173, com os mocks ligados
```

Nada depende de serviços privados ou de backend: tudo roda no navegador.

### Variáveis de ambiente

| Variável | Valor | Efeito |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga o MSW (REST + Socket.IO). Está em `.env.development` e `.env.production`, então `dev`, `build` e o deploy de demonstração usam os mocks. Sem ela, o app chamaria uma API real em `/api`. |
| `E2E_PORT` / `E2E_COMMAND` / `E2E_NO_SERVER` | opcionais | Só para o Playwright: porta, comando do servidor e uso de um servidor já em execução. |
| `LH_BASE_URL` | opcional | Só para o Lighthouse: audita uma URL já publicada em vez do build local. |

## Comandos

```bash
npm run dev          # desenvolvimento com mocks
npm run build        # verificação de tipos + build de produção (com mocks, para a demonstração)
npm run preview      # serve o build em http://localhost:4173
npm run typecheck    # tsc -b
npm run lint         # ESLint
npm run test:e2e     # testes Playwright (desktop, mobile e tablet para a regressão visual)
npm run lighthouse   # auditoria Lighthouse (veja a seção abaixo)
```

## Cenários do mock e reset

Abra o app com `?mockScenario=<nome>` (por exemplo, `/?mockScenario=slow`). O padrão é `default`. Os dados
ficam em `localStorage`, então sobrevivem ao refresh. **Reset:** no console do navegador,
`__kurioMocks.reset()` restaura a seed conhecida (`__kurioMocks.reset('<cenário>')` também troca o cenário);
apagar o `localStorage` do site tem o mesmo efeito.

| Cenário | O que simula |
| --- | --- |
| `default` | Latência curta e variável (150 a 450 ms) |
| `fast` | Sem latência, pagamento imediato (usado nos testes) |
| `slow` | Rede lenta (1,5 a 3 s) |
| `variable` | Latência muito variável; respostas podem chegar fora de ordem |
| `empty` | Catálogo vazio |
| `server-error` | A listagem responde 503 |
| `offline` | Falha de conexão em toda requisição |
| `timeout` | Nenhuma requisição responde (estoura o timeout) |
| `session-expired` | Toda rota autenticada responde sessão expirada |
| `favorites-error` | Favoritar e desfavoritar falham |
| `coupon-expired` | Todos os cupons estão expirados |
| `payment-declined` | O pagamento é recusado após 1,5 s |
| `order-timeout` | O pedido é criado, mas a resposta nunca chega; repetir com a mesma chave recupera o pedido |
| `purchase-price-change` | O preço sobe no momento de confirmar a compra (uma vez) |
| `purchase-sold-out` | A edição esgota no momento de confirmar a compra (uma vez) |
| `socket-noisy` | Eventos em tempo real duplicados e, em seguida, uma versão antiga atrasada |
| `wallet-refused` | A carteira recusa toda solicitação de conexão |

Controles no console (`window.__kurioMocks`): `setScenario`, `reset`, `setPrice(nftId, eth)`,
`setEditionStock(nftId, editionId, stock)`, `settleOrders()`, `dropSockets()`, `setSocketsDown(bool)`,
`expireSessions()`, `socketCount()`.

### Como reproduzir os fluxos de falha

| Fluxo | Como ver |
| --- | --- |
| Lista vazia / erro / sem conexão | `/?mockScenario=empty`, `server-error` ou `offline`; use "Tentar novamente" |
| Carregamento lento (skeletons) | `/?mockScenario=slow` |
| Respostas fora de ordem | `/?mockScenario=variable` e troque filtros rapidamente |
| Sessão expirada | entre, abra o carrinho/checkout e rode `__kurioMocks.expireSessions()`, ou use `session-expired` |
| Cupom inválido ou expirado | digite um código qualquer; com `coupon-expired`, todos expiram |
| Pagamento recusado | `?mockScenario=payment-declined`, compre (o carrinho permanece intacto) |
| Timeout após criar o pedido | `?mockScenario=order-timeout`, compre e tente de novo: volta o **mesmo** pedido |
| Carteira: conectar, recusar, desconectar | no pagamento, use "Desconectar" e "Conectar carteira" (a principal do usuário de demonstração já começa conectada); com `?mockScenario=wallet-refused` a conexão é recusada e explicada. Sem carteira conectada a compra não é enviada nem aceita pelo servidor |
| Clique repetido | clique várias vezes em "Confirmar compra": um único pedido |
| Preço muda / esgota na compra | `purchase-price-change` ou `purchase-sold-out`: a tela exige nova confirmação |
| Preço muda com o item no carrinho | com o carrinho aberto: `__kurioMocks.setPrice('nft-1', '2.5')` |
| Conexão em tempo real caiu | `__kurioMocks.dropSockets()` (ou `setSocketsDown(true)`); o aviso aparece e a tela é reconciliada ao voltar |
| Eventos duplicados ou antigos | `?mockScenario=socket-noisy` e mude um preço: a tela nunca volta atrás |
| Pedido pendente após refresh | inicie uma compra com pagamento lento e recarregue: o pedido pendente é recuperado |

## Testes (Playwright)

```bash
npm run test:e2e                                   # tudo: desktop + mobile (+ tablet na regressão visual)
npx playwright test --project=mobile e2e/06-purchase.spec.ts
npx playwright test e2e/visual.spec.ts --update-snapshots   # regenera os baselines visuais
npx playwright show-report                         # relatório HTML (playwright-report/)
npx playwright show-trace test-results/<pasta>/trace.zip    # trace de uma falha
```

Os testes rodam contra os mesmos handlers MSW, partem de um estado isolado (contexto novo, seed conhecida),
verificam a interface e os resultados das operações, e só mexem no "servidor" (cenário, preço, estoque, queda
do socket). Os de tempo real passam pelo `socket.io-client`. Cobrem: busca/filtros/ordenação/paginação com
histórico, detalhe e recurso inexistente, cadastro/login/expiração/logout/troca de usuário, favoritos com falha,
carrinho e cupom, compra até o recibo, falhas de pagamento/clique repetido/timeout, perfil/avatar/senha/carteiras,
alteração de preço durante o checkout, eventos duplicados e desconexão, teclado e foco, skeletons e recuperação,
dados do colecionador, conexão/recusa/desconexão da carteira, página não encontrada, shimmer com movimento reduzido e regressão visual (início, detalhe, carrinho, pagamento).

## Lighthouse

```bash
npm run lighthouse                 # build + preview + 3 medições por página e perfil
npm run lighthouse -- --runs=1     # medição rápida
LH_BASE_URL=https://thony1337-nft-marketplace.vercel.app npm run lighthouse   # audita o deploy
```

Audita **Início** e **Detalhe do NFT** em **mobile e desktop**, com o build de produção, mocks ligados e cenário
padrão, e reporta a **mediana** de cada categoria e de **LCP, CLS e TBT**. A configuração está em
`lighthouse/run.mjs`; os relatórios HTML/JSON de cada medição, as versões, o ambiente e as justificativas estão em
`lighthouse/reports/` e `lighthouse/results.md`.

Resultado resumido: ver [`lighthouse/results.md`](./lighthouse/results.md).

## Estrutura

```
src/api         clientes HTTP (Axios) por domínio, contratos tipados
src/mocks       servidor simulado: handlers MSW, banco em localStorage, cenários, motor de pedidos, realtime
src/realtime    provider do Socket.IO e aplicação de eventos por versão
src/hooks       TanStack Query (carrinho, cotação, pedidos, favoritos, perfil, carteiras)
src/pages       Início/Catálogo, Detalhe, Carrinho, Pagamento, Comprovante, Perfil
src/components  Header/MobileNav, Hero, Footer, filtros, modal de login…
src/lib         schemas Zod, limites, ETH (Decimal), chave de idempotência, filtros mobile
e2e             Playwright · lighthouse   auditoria
```

## Fora do escopo

Login com Google/Facebook, "esqueci a senha", Etherscan, Favoritos como página, scan/QR, Atividade, newsletter,
páginas editoriais e de suporte aparecem como no design, marcadas "Em breve" (`aria-disabled`), e não simulam
funcionamento. Desvios do Figma, decisões de UX e limitações estão em [ARCHITECTURE.md](./ARCHITECTURE.md).
