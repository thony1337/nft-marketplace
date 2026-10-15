# Kurio — Marketplace de NFTs

Front-end do desafio "Marketplace de NFTs": catálogo, detalhe, carrinho, checkout com pagamento simulado,
comprovante, perfil e carteiras, com atualizações em tempo real (Socket.IO).
Não existe back-end: a API REST e o servidor Socket.IO são **simulados no navegador com MSW**
(ver [ARCHITECTURE.md](./ARCHITECTURE.md)).

- Demo publicada: _<URL do deploy>_ (os mocks ficam ligados no deploy)
- Conta de demonstração: `anthony@example.com` / `Senha@123` (outra, para testar isolamento: `collector@example.com` / `Senha@123`)

## Stack

React 19 + TypeScript · Vite · Tailwind CSS v4 · shadcn/ui (Radix) · TanStack Router · TanStack Query ·
Axios · Zod · Socket.IO client · MSW (`@mswjs/socket.io-binding`) · Decimal.js · Vitest · Playwright · Lighthouse

## Como rodar

```bash
npm install
npm run dev          # http://localhost:5173 (com os mocks ligados)
npm run build        # build de produção
npm run preview      # serve o build
npm run typecheck    # tsc -b
```

Os mocks são ligados por `VITE_ENABLE_MOCKS=true` (já definido em `.env.development` e `.env.production`
para o deploy de demonstração). Sem a variável, o app chamaria uma API real em `/api`.

## Cenários do mock

Abra o app com `?mockScenario=<nome>` (ex.: `/?mockScenario=slow`). O padrão é `default`.

| Cenário | O que simula |
| --- | --- |
| `default` | Latência curta e variável (150–450 ms) |
| `fast` | Sem latência, pagamento imediato (usado nos testes) |
| `slow` | Rede lenta (1,5–3 s) |
| `variable` | Latência muito variável; respostas podem chegar fora de ordem |
| `empty` | Catálogo vazio |
| `server-error` | A listagem responde 503 |
| `offline` | Falha de conexão em toda requisição |
| `timeout` | Nenhuma requisição responde |
| `session-expired` | Toda rota autenticada responde sessão expirada |
| `favorites-error` | Favoritar/desfavoritar falha |
| `coupon-expired` | Todos os cupons estão expirados |
| `payment-declined` | O pagamento é recusado após 1,5 s |
| `order-timeout` | O pedido é criado mas a resposta nunca chega; repetir com a mesma chave recupera o pedido |
| `purchase-price-change` | O preço sobe no momento de confirmar a compra (uma vez) |
| `purchase-sold-out` | A edição esgota no momento de confirmar (uma vez) |
| `socket-noisy` | Eventos em tempo real duplicados e, depois, uma versão antiga atrasada |

No console do navegador há `window.__kurioMocks` (`setScenario`, `reset`, `setPrice`, `setEditionStock`,
`settleOrders`, `dropSockets`, `expireSessions`…) para mexer no "servidor" durante uma demonstração, por exemplo:

```js
__kurioMocks.setPrice('<id-do-nft>', '2.5')   // todos os clientes veem o preço mudar sem recarregar
__kurioMocks.dropSockets()                    // derruba a conexão em tempo real; o app reconecta
```

## Testes

```bash
npx vitest run                                   # unitários/integração (API mock, carrinho, pedidos, realtime…)
npx playwright test                              # E2E em 3 projetos: desktop, tablet e mobile
npx playwright test e2e/visual.spec.ts --update-snapshots   # regenera os baselines visuais
npx playwright test --project=mobile e2e/06-purchase.spec.ts
```

Os testes E2E exercitam a interface como o usuário (papéis e rótulos acessíveis); só o "servidor" é manipulado
(cenários, preço, estoque, queda do socket). Cobrem: catálogo e filtros na URL, detalhe, autenticação,
favoritos, carrinho e cupons, compra até o comprovante, falhas de pagamento, perfil e carteiras,
checkout ao vivo (Socket.IO), resiliência do tempo real, teclado/foco/diálogos, carregamento/erro/retry,
dados do comprador e regressão visual.

## Lighthouse

```bash
npm run build && npm run preview &
npx lighthouse http://localhost:4173 --only-categories=performance,accessibility,best-practices,seo \
  --output=html --output-path=./lighthouse-report.html --chrome-flags="--headless"
```

Resultado do último relatório: _<preencher com as notas>_.

## Estrutura

```
src/api        clientes HTTP (Axios) por domínio
src/mocks      servidor simulado: rotas MSW, banco em localStorage, cenários, motor de pedidos, realtime
src/realtime   provider do Socket.IO e aplicação de eventos por versão
src/hooks      TanStack Query (carrinho, cotação, pedidos, favoritos, perfil, carteiras)
src/pages      Catálogo, Detalhe, Carrinho, Checkout, Comprovante, Perfil
src/components Header/MobileNav, Hero, Footer, filtros, modal de login…
src/lib        schemas Zod, limites, ETH (Decimal), chave de idempotência, filtros mobile
e2e            Playwright · tests  Vitest
```

## Fora do escopo (mostrado como no design, mas desativado)

Login com Google/Facebook, "esqueci a senha", Etherscan, Favoritos como página, scan/QR, Atividade,
newsletter e demais páginas sem requisito no desafio aparecem como no Figma, marcadas "Em breve"
(`aria-disabled`) e não simulam funcionamento.
