# Arquitetura e decisões

Este documento descreve como a solução está organizada e **por quê**: contratos REST e eventos, política de
sessão, estado do carrinho, estratégia de cache, reconciliação entre REST e Socket.IO, o que é simulado (e seus
limites), decisões de UX e desvios em relação ao Figma.

## 1. Visão geral

SPA React 19 + TypeScript (Vite). Roteamento e estado de listagem na URL com **TanStack Router**; dados remotos
no **TanStack Query**; toda chamada REST passa pelo **Axios** (`src/api/client.ts`); tempo real com
**socket.io-client**; o "servidor" é **MSW** (REST) + `@mswjs/socket.io-binding` (Socket.IO).

```
UI (pages/components)
   │  hooks (TanStack Query)            src/hooks
   ▼
api (Axios, contratos tipados)          src/api ──► MSW handlers ──► banco em localStorage
   ▲                                                  │  orderEngine · market · scenarios
   └── RealtimeProvider (socket.io-client) ◄──────────┘  eventos versionados
```

Regras que organizam o código:

- Componentes, hooks e o cliente Axios **não** contêm respostas fictícias nem caminhos de negócio alternativos:
  tudo que é simulação vive em `src/mocks`, na camada de rede. Trocar o MSW por uma API real não exige mudar
  `src/api`, `src/hooks` nem a interface.
- Os tipos de transporte (`src/types.ts`) são os mesmos usados pelo cliente, pelo cache e pelos handlers. Os
  formulários são validados com Zod (`src/lib/schemas.ts`); o servidor simulado valida de novo e devolve
  `fieldErrors` por campo.
- Valores em ETH trafegam como **strings decimais** e são calculados com `Decimal.js`; quantidades são inteiras.
  A **cotação do servidor é a única fonte** do total: a tela nunca recalcula o que o usuário vai pagar.

## 2. Contratos REST

Base `/api`, JSON, timeout de 8 s. Rotas privadas levam `Authorization: Bearer <token>`; carrinho e cotação de
visitante levam `X-Guest-Id`. Todo erro tem a forma `{ code, message, fieldErrors? }`, normalizada no cliente
em `ApiError` (`status`, `code`, `isRetryable`, `isSessionProblem`).

| Recurso | Rotas |
| --- | --- |
| Sessão e conta | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` · `POST /auth/logout` |
| NFTs | `GET /nfts` (`q`, filtros, `sort`, `page`) · `GET /nfts/:id` |
| Favoritos | `GET /favorites` · `PUT /favorites/:nftId` · `DELETE /favorites/:nftId` |
| Carrinho | `GET /cart` · `POST /cart/items` · `PATCH /cart/items/:itemId` · `DELETE /cart/items/:itemId` · `DELETE /cart` · `POST /cart/merge` |
| Cotação e cupom | `GET /quote` · `PUT /cart/coupon` · `DELETE /cart/coupon` |
| Pedidos | `POST /orders` (exige `Idempotency-Key`) · `GET /orders` · `GET /orders/:id` |
| Perfil | `PATCH /profile` · `PUT /profile/avatar` · `DELETE /profile/avatar` · `POST /profile/password` |
| Carteiras | `GET /wallets` · `POST /wallets` · `PATCH /wallets/:id` · `DELETE /wallets/:id` |

Códigos de erro usados: `VALIDATION_ERROR` (422, com `fieldErrors`), `EMAIL_TAKEN` e `WALLET_EXISTS` (409),
`INVALID_CREDENTIALS`, `UNAUTHENTICATED` e `SESSION_EXPIRED` (401), `FORBIDDEN` (403), `NFT_NOT_FOUND`,
`ORDER_NOT_FOUND`, `CART_ITEM_NOT_FOUND`, `WALLET_NOT_FOUND` (404), conflitos de disponibilidade
(`OUT_OF_STOCK`, `QUANTITY_LIMIT`, `QUOTE_CHANGED`, `EMPTY_CART`, 409), `IDEMPOTENCY_KEY_REQUIRED` (400),
`IDEMPOTENCY_CONFLICT` (409), `FILE_TOO_LARGE` (413), `INVALID_CURRENT_PASSWORD` (422) e falhas transitórias
(5xx, `NETWORK_ERROR`, `TIMEOUT`, marcadas como `isRetryable`).

### Pedido idempotente

`POST /orders` carrega a carteira, o fingerprint da cotação que o usuário confirmou e os dados do colecionador.
O servidor guarda o pedido sob a `Idempotency-Key`: repetir a **mesma** chave devolve o **mesmo** pedido;
reutilizar a chave com conteúdo diferente (inclusive dados do comprador) responde `409 IDEMPOTENCY_CONFLICT`.
Se o fingerprint não bate com a cotação atual, responde `409 QUOTE_CHANGED` com o total novo. O recibo é o
**snapshot** do pedido (itens, taxas, total): alterações posteriores no catálogo não o modificam.

## 3. Eventos Socket.IO

Conexão em `path: /realtime/`, `transports: ['websocket']`, `auth: { token }`. Todo evento carrega `id` estável,
recurso afetado e `version`.

| Evento | Destino | Efeito no cliente |
| --- | --- | --- |
| `nft.updated` | todos os sockets | atualiza preço, estoque e edições em **todas** as cópias em cache (catálogo, detalhe, favoritos, carrinho) |
| `order.updated` | só o socket autenticado como dono | atualiza o estado do pedido; a tela mostra confirmação ou recusa |
| `session.ready` | cada conexão | informa se o token foi aceito; se não, o cliente consulta `GET /auth/me` |
| `auth.error` | conexão | a camada de sessão decide (invalida `me`) |

## 4. Reconciliação entre REST e Socket.IO

1. **Versões.** `applyEvents.ts` só aplica um evento se `event.version` for maior que a versão em cache.
   Duplicados e eventos atrasados não mudam a tela nem reaplicam efeitos (cenário `socket-noisy` e teste).
2. **Reconexão.** A conexão só é considerada "de volta" depois de se manter estável por um instante; então a
   interface sai do estado "reconectando" e **relê da API REST** o que está na tela (`reconcile`): eventos
   perdidos durante a queda não deixam a tela velha.
3. **Pedido pendente.** `GET /orders/:id` é refeito a cada 5 s com o socket conectado e a cada 2 s sem ele,
   enquanto o pedido estiver `pending`. Confirmado e recusado são terminais e param o polling. Depois de um
   refresh, o pedido pendente é recuperado pela mesma rota.
4. **Quem recebe o quê.** O servidor só envia `order.updated` ao dono; no cliente, as chaves do Query incluem o
   token, então um evento de outra sessão nunca encontra uma entrada para atualizar. Ao trocar de sessão o
   provider fecha o socket e abre outro com o novo token (os listeners são liberados no `cleanup` do efeito).

Cenário "preço muda com o item no carrinho": o evento atualiza o cache, o carrinho informa a alteração e a
cotação é refeita; no checkout, o envio usa o fingerprint da cotação que o usuário viu, e uma cotação
desatualizada responde `QUOTE_CHANGED`: a tela mostra o total novo e exige **nova confirmação**.

## 5. Política de cache, retries e sincronização (TanStack Query)

Padrão global (`main.tsx`): `staleTime` 5 min, `retry` 2, `refetchOnWindowFocus` desligado. Exceções por recurso:

| Recurso (chave) | Política |
| --- | --- |
| Catálogo `['nfts', params]` | a chave contém todos os parâmetros; `placeholderData: keepPreviousData` (sem piscar entre páginas); o Query descarta resposta de chave antiga, então respostas fora de ordem não sobrescrevem a tela |
| Detalhe `['nft', id]` | não repete em `404` (NFT inexistente aparece na hora); demais erros seguem o padrão |
| Sessão `['me', token]` | `staleTime: Infinity`; repete **uma** vez e só se o erro for transitório |
| Carrinho `['cart', token\|guest]` | `staleTime` 30 s; visitante que nunca adicionou nada não dispara consulta |
| Cotação `['quote', token\|guest]` | `staleTime: 0` (sempre confirmada no servidor); escritas de cupom gravam o resultado direto no cache e usam `scope` para serializar |
| Pedido `['order', token, id]` | `refetchOnMount: 'always'`, sem retry em 403/404, polling enquanto `pending` (seção 4) |
| Favoritos, carteiras, perfil | chaves por token; invalidados após cada mutation |

- **Isolamento.** Toda chave privada começa com uma das raízes de `PRIVATE_ROOTS` e inclui o token (ou `guest`).
  No logout, na perda de sessão e na troca de usuário, `clearPrivateData` cancela e **remove** todas as queries
  privadas; o checkout em andamento (chave de idempotência) é descartado.
- **Atualização otimista com rollback:** favoritos. `onMutate` cancela consultas, grava o novo estado do
  coração e guarda o anterior; em erro, restaura o anterior e avisa o usuário; em qualquer caso invalida.
- **Mutations de pedido** não fazem retry automático: a recuperação é explícita e idempotente (mesma chave).
- O Axios também normaliza `NETWORK_ERROR` e `TIMEOUT`, para que a interface ofereça "tentar novamente".

## 6. Sessão

- Token e expiração ficam em `localStorage` (`auth_token`, `auth_expires_at`); se o armazenamento estiver
  bloqueado, a sessão vive em memória até fechar a página. A sessão é recuperada no refresh com `GET /auth/me`.
- **Senhas** nunca são guardadas em claro: o mock guarda hash. Credenciais são fictícias.
- **Expiração** (`401 SESSION_EXPIRED`) durante a navegação ou o checkout: a sessão é encerrada, o usuário é
  avisado, os dados privados saem do cache e o login reabre **no mesmo ponto**; depois de entrar, retoma o fluxo
  (o carrinho é preservado). Rotas privadas (checkout, perfil, carteiras, pedidos) redirecionam ao login e
  voltam ao destino.
- **Visitante:** o carrinho pertence a um `guestId` (`localStorage`, `kurio:guest-id`). Ao autenticar,
  `POST /cart/merge` funde o carrinho do visitante no da conta (a operação é segura de repetir).
- **Logout / troca de usuário:** limpa cache privado, tentativa de compra e fecha as subscriptions do socket.

## 7. Estado do carrinho

O carrinho é do servidor (consultado por `GET /cart`), nunca da interface: sobrevive a refresh, respeita estoque
por NFT e edição, e as quantidades alteram-se com `PATCH` (a linha mostra a quantidade pendente enquanto a
mutation roda). Subtotal, desconto, taxa de rede e total vêm da cotação. Depois de uma compra confirmada,
**só os itens e quantidades comprados** saem do carrinho; em falha (recusa, timeout) o carrinho fica intacto.

## 8. Camada de mocks (MSW)

- **Ativação:** `VITE_ENABLE_MOCKS=true` (também no build de demonstração). Os mesmos handlers servem
  desenvolvimento, demo e testes.
- **Estado consistente:** banco único em `localStorage` (`kurio:mock-db:v1`) que sustenta refresh; catálogo,
  favoritos, carrinho, perfil, carteiras e pedidos leem e escrevem nele. `__kurioMocks.reset()` restaura um
  cenário conhecido (seed determinística: 42 NFTs, 2 usuários).
- **Cenários** (`?mockScenario=`, ver README): latência fixa/variável, timeouts, offline, 5xx, sessão expirada,
  cupom expirado, pagamento recusado, timeout após criar o pedido, preço mudando ou edição esgotando durante a
  compra e socket com eventos duplicados/antigos. São determinísticos (gerador pseudoaleatório com seed).
- **Socket.IO:** `@mswjs/socket.io-binding` implementa o servidor no mesmo service worker, e os cenários passam
  por `socket.io-client` de verdade (handshake, `auth`, eventos, reconexão). Nada de setters ou cache.
- **Limitações do transporte simulado:** não há processo de servidor, então "outros usuários" são outras abas
  do mesmo navegador (estado compartilhado via `localStorage`); o service worker precisa controlar a página
  antes do primeiro request; o payload de eventos é o mesmo do contrato, mas não há latência de rede real no
  WebSocket; a "transação" do comprovante e o link de exploração são simulados.

## 9. Testes

- **Playwright** (Chromium; projetos desktop 1440, mobile 390 e, para a regressão visual, tablet 768): os fluxos
  rodam pela interface e só manipulam o "servidor" (cenário, preço, estoque, queda do socket, conclusão de
  pagamento). Cada teste começa em contexto novo (storage vazio, seed conhecida). Relatório HTML em
  `playwright-report/` e traces das falhas (`trace: retain-on-failure`).
- **Regressão visual:** início, detalhe, carrinho (com cupom) e pagamento, com baselines por projeto em
  `e2e/__screenshots__` e animações desligadas; um teste adicional garante que não há rolagem horizontal.
- Os testes de tempo real passam pelo `socket.io-client`; os de REST, pelos handlers MSW.
- Em dev, os overlays das devtools do TanStack são ocultados nos testes, porque cobrem a barra inferior no mobile.

## 10. Interface e acessibilidade

- Tema escuro marrom/laranja do Figma; `--radius` ≈ 0, então raios usam valores arbitrários.
- **Mobile (< md):** a barra superior some; `MobileNav` inferior em início, perfil e pedidos; detalhe, carrinho
  e pagamento têm barra de topo própria. Filtros viram _bottom sheet_. Toasts vão ao topo no mobile para não
  cobrir as ações da parte de baixo.
- **Teclado e foco:** foco visível, diálogos com foco preso e retorno ao elemento de origem (Esc fecha),
  erros ligados ao campo (`aria-describedby`/`aria-invalid`), foco no primeiro campo inválido.
- **Feedback acessível:** regiões `aria-live` para quantidade, total, estado da conexão em tempo real e
  resultado das mutations; estados nunca dependem só de cor.
- **Skeletons** com shimmer no catálogo, detalhe, resumo do carrinho e pagamento, com as mesmas dimensões do
  conteúdo (sem deslocamento de layout) e animação desligada com `prefers-reduced-motion`.
- Imagens de NFT têm `alt`; imagens decorativas, `alt=""`.

## 11. Decisões de UX e desvios do Figma

- **Perfil e carteiras:** campos sem requisito no desafio não são persistidos (nome de usuário derivado, ENS
  desativado; tipo, código e e-mail de carteira omitidos). Perfil, carteiras e confirmação funcionam em mobile
  sem frame específico, seguindo o mesmo padrão visual.
- **Checkout mobile:** o Figma mobile não tem o formulário do colecionador; o desafio exige validar os dados
  do colecionador, então o formulário foi mantido, com o mesmo visual.
- **Barra de topo do perfil (mobile):** ganhou um ícone de usuário; "Sair" fica na barra lateral do perfil.
- **Fora do escopo, desativados como no design** (`aria-disabled`, "Em breve", sem simular sucesso): Google e
  Facebook, esqueci a senha, Etherscan, Favoritos como página, botão de escanear, Atividade, newsletter,
  páginas editoriais e de suporte.
- **Assets:** imagens dos NFTs são fixtures locais (WebP) para a execução offline; fontes via
  `@fontsource-variable/roboto-mono` (sem CDN).
- Estados não desenhados (erro, vazio, recusa, sessão expirada, reconexão) seguem o padrão visual existente.

## 12. Auditoria de performance

`npm run lighthouse` (`lighthouse/run.mjs`): build de produção, `vite preview`, mocks ligados e cenário padrão;
Início e Detalhe em mobile e desktop, três medições por página e perfil, mediana de cada categoria e de LCP,
CLS e TBT. Relatórios HTML/JSON, versões, ambiente e justificativas em `lighthouse/results.md`.
