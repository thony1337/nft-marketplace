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
