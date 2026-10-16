# Resultados do Lighthouse

Medições por página e perfil: **3** (mediana de cada categoria e métrica).

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 84 ⚠️ | 100 | 100 | 100 | 3.71 s | 0.000 | 34 ms |
| Início | Desktop | 99 | 97 | 100 | 100 | 0.83 s | 0.013 | 0 ms |
| Detalhe do NFT | Mobile | 83 ⚠️ | 100 | 100 | 100 | 3.88 s | 0.000 | 25 ms |
| Detalhe do NFT | Desktop | 99 | 100 | 100 | 100 | 0.87 s | 0.000 | 0 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. ⚠️ = abaixo da meta.

## Medições individuais (Performance / Accessibility / Best Practices / SEO)

- Início / Mobile: 84/100/100/100 · 84/100/100/100 · 84/100/100/100
- Início / Desktop: 99/97/100/100 · 99/97/100/100 · 99/97/100/100
- Detalhe do NFT / Mobile: 84/100/100/100 · 83/100/100/100 · 82/100/100/100
- Detalhe do NFT / Desktop: 99/100/100/100 · 99/100/100/100 · 99/100/100/100

## Ambiente e condições

- URL auditada: http://localhost:4173 (build de produção local servido de `dist/` com brotli/gzip)
- Mocks: ligados (`VITE_ENABLE_MOCKS=true`), cenário padrão (`default`: latência de 150 a 450 ms), imagens, fontes e tempo real ativos
- Lighthouse 13.5.0 · Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/142.0.0.0 Safari/537.36
- Perfis: mobile (padrão do Lighthouse: emulação de celular e throttling simulado) e desktop (`desktop-config`)
- Node v24.21.0 · Linux 6.8.0-138-generic · 13th Gen Intel(R) Core(TM) i5-13600KF (2 núcleos) · 12 GB
- Projeto: nft-marketplace@0.0.0
- Data: 2026-10-16T02:40:25.024Z

Relatórios completos (HTML e JSON de cada medição): `lighthouse/reports/`.

## Justificativas para resultados abaixo da meta

**Onde ficou abaixo da meta:** apenas a nota de Performance no perfil **mobile** (Início 84 e Detalhe 83, meta 90). No desktop, Accessibility, Best Practices e SEO, tudo está dentro das metas, e Performance chega a 99. CLS é 0,000 em todas as medições exceto o Início desktop (0,013), e o TBT fica abaixo de 50 ms.

**Causa:** a nota mobile é limitada pelo **FCP/LCP (≈ 3,0 s / 3,7–3,9 s)**, não por layout shift nem por JavaScript bloqueando a thread (TBT abaixo de 50 ms). O Lighthouse mobile simula Slow 4G (≈ 1,6 Mbps, 150 ms de RTT) e CPU 4× mais lenta. Nessas condições, o que precisa chegar antes da primeira pintura é:

1. HTML e CSS (78 kB, 14 kB gzip; o CSS bloqueia a renderização).
2. O bundle principal (≈ 96 kB gzip) e seus chunks de inicialização.
3. O **servidor simulado** exigido pelo desafio (MSW + binding de Socket.IO, ≈ 145 kB gzip), baixado e iniciado antes de qualquer requisição, porque a API e o tempo real só existem por causa dele.
4. Só então a primeira chamada à API simulada (latência configurada de 150 a 450 ms) e, no Detalhe, o carregamento da imagem do NFT, que só é descoberta depois da resposta da API (≈ 600 ms de atraso de carregamento do recurso no LCP).

**O que foi feito e medido:**

- Divisão de código por rota (`autoCodeSplitting`) e servidor de medição com brotli/gzip, como na hospedagem real.
- Skeletons com as dimensões do conteúdo final: CLS do Detalhe caiu de 0,138 para 0,000 (desktop).
- Foi testada a renderização antes do servidor simulado terminar de subir (requisições e socket aguardando o servidor). A nota mobile **piorou** (78 e 79, LCP ≈ 4,2–4,4 s, por causa da disputa pela CPU limitada durante a inicialização), então a mudança foi revertida.

**Por que isso não representa o produto real:** o trecho dos itens 3 e 4 existe apenas porque o ambiente do desafio exige API e tempo real simulados no navegador. Com um servidor de verdade, o bundle do mock não seria enviado e a primeira requisição não esperaria o Service Worker. Essa estimativa não foi medida aqui; ela decorre do tamanho dos chunks (o do mock é o maior do build) e da cadeia de carregamento descrita acima.
