# Arquitetura e decisões

## Visão geral

SPA React 19 (Vite). Dados remotos vivem no **TanStack Query**; navegação e estado de listagem (busca, filtros,
ordem, aba, página, faixa de preço) vivem na **URL** (TanStack Router, `search params` validados por Zod).
A sessão fica em `AuthContext` (token em `localStorage`, ver `src/lib/session.ts`). O tempo real é um único
`RealtimeProvider` (Socket.IO) que escreve no cache do Query.

```
UI (pages/components) → hooks (Query) → api (Axios) ──► MSW (handlers) ──► db (localStorage)
                    ▲                                         │ orderEngine / market
                    └──── RealtimeProvider (Socket.IO) ◄──────┘ eventos versionados
```

## O que é simulado e quais são os limites

- **HTTP**: MSW intercepta Axios no navegador (service worker). Latência, falhas e cenários vêm de
  `src/mocks/scenarios.ts`. Os dados persistem em `localStorage` (`kurio:mock-db:v1`) e podem ser zerados com
  `__kurioMocks.reset()`.
- **Socket.IO**: `@mswjs/socket.io-binding` implementa o servidor no mesmo service worker. É um **servidor de
  verdade do ponto de vista do cliente** (handshake, `auth`, eventos, reconexão) — o front usa `socket.io-client`
  normal, sem atalhos. Nada é injetado por UI ou cache para "fingir" evento.
- **Limites**: não há processo de servidor, então (1) "outros usuários" são abas/sockets do mesmo navegador e
  o estado compartilhado é o `localStorage`; (2) o service worker precisa estar ativo antes do primeiro request
  (os testes esperam `navigator.serviceWorker.controller`); (3) a criptografia/senhas do mock são de
  demonstração; (4) a "transação" do comprovante é rotulada **(simulada)**.
- **Eventos**: `nft.updated` (todos os sockets), `order.updated` (só o dono do pedido), `session.ready`,
  `auth.error`. Cada evento carrega `version`.

## Decisões sobre condições de corrida

1. **Eventos por versão.** `applyEvents.ts` só aplica `nft.updated` se `event.version > cache.version`.
   Duplicados e eventos atrasados não mudam a tela (cenário `socket-noisy` e teste "nunca anda para trás").
2. **Listagem com respostas fora de ordem.** O catálogo usa `placeholderData: keepPreviousData` e a chave do
   Query contém todos os filtros; o Query descarta resposta de chave antiga (cenário `variable`).
3. **Compra idempotente.** Cada tentativa de compra tem uma `Idempotency-Key` derivada do conteúdo confirmado
   (carteira + impressão digital da cotação + dados do comprador), guardada em `sessionStorage` e atada ao
   token (`src/lib/checkoutAttempt.ts`). Duplo clique, timeout (`order-timeout`) ou refresh no meio da compra
   reutilizam a mesma chave e recuperam o **mesmo** pedido; conteúdo diferente gera chave nova. O servidor
   inclui os dados do comprador no hash da chave, então reutilizar a chave com outro conteúdo é um conflito.
4. **Nada é comprado sem confirmação do total.** Se o preço/estoque muda entre abrir o checkout e confirmar
   (cenários `purchase-price-change` e `purchase-sold-out`, e eventos ao vivo), o servidor recusa com o total
   novo, a tela mostra o novo valor e exige nova confirmação. Estoque esgotado bloqueia o botão e explica.
5. **Pedido pendente.** Depois de criar o pedido, a tela de comprovante assina `order.updated`; com socket
   conectado faz poll de segurança a cada 5 s e, sem socket, a cada 2 s. Um pagamento que termina com a
   conexão caída é recuperado na reconexão (e após refresh).
6. **Isolamento entre usuários.** Cache do Query, carrinho de visitante, tentativa de compra e eventos de
   pedido são limpos/validados na troca de sessão; o carrinho do visitante é **mesclado** na conta ao entrar.
   Eventos de pedido só chegam ao socket autenticado como dono.
7. **Sessão expirada.** Qualquer 401 `SESSION_EXPIRED` encerra a sessão, avisa e reabre o login sem perder o
   carrinho.
8. **Dinheiro.** Valores em ETH usam `Decimal.js` (strings na API); nunca `number` para somar/multiplicar.

## Interface e acessibilidade

- Tema escuro marrom/laranja do Figma; `--radius` ≈ 0, então raios são valores arbitrários.
- Mobile (< md): barra superior do header escondida, `MobileNav` inferior em `/`, `/profile` e `/orders`;
  `/nft`, `/cart` e `/checkout` têm barra de topo própria. Filtros viram _bottom sheet_
  (`src/lib/mobileFilters.ts`); toasts vão para o topo no mobile para não cobrir as ações.
- Diálogos com foco preso e retorno de foco, rótulos e erros por campo, foco no primeiro campo inválido,
  `aria-live` para quantidade/total/estado de conexão; itens fora do escopo são `aria-disabled` com "Em breve".

## Testes

- **Vitest**: API mock, cálculo de carrinho/cotação, motor de pedidos (idempotência), cliente Axios, eventos
  de realtime, formulários.
- **Playwright** (desktop/tablet/mobile): fluxos completos pela interface; falhas e tempo real via cenários e
  controles do servidor simulado (`e2e/fixtures.ts`). Os overlays de devtools do TanStack são ocultados nos
  testes porque cobrem a barra inferior no mobile.
- **Regressão visual**: baselines por projeto em `e2e/__screenshots__`; teste de "sem rolagem lateral".

## Diferenças em relação ao Figma

- Perfil/Carteiras: campos sem requisito no desafio não são persistidos (nome de usuário derivado, ENS
  desativado; tipo/código/e-mail de carteira omitidos).
- O Figma mobile não tem formulário do comprador; o checkout mobile mantém o formulário (o desafio exige).
- A barra de topo do perfil mobile tem um ícone de usuário acrescentado; "Sair" fica na barra lateral do perfil.
- Desativados com "Em breve": Google/Facebook, esqueci a senha, Etherscan, Favoritos como página, botão de
  scan, Atividade, newsletter.
- Imagens de NFT são fixtures locais gerados para o mock.
