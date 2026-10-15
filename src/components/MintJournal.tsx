import apeAmber from '@/assets/nfts/ape-amber.webp';
import apeEmerald from '@/assets/nfts/ape-emerald.webp';
import apeNoir from '@/assets/nfts/ape-noir.webp';
import apeSage from '@/assets/nfts/ape-sage.webp';

// Editorial content is outside this delivery: the cards are shown as designed, but "Ler mais" is not a link
const POSTS = [
  { date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: apeNoir },
  { date: '13 de setembro', read: 2, title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', image: apeEmerald },
  { date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: apeSage },
  { date: '15 de setembro', read: 2, title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', image: apeAmber },
] as const;

export function MintJournal() {
  return (
    <section aria-labelledby="journal-title" className="mt-24">
      <h2 id="journal-title" className="text-center text-3xl font-bold">
        Diário da Cunhagem
      </h2>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
      </p>

      <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title} className="overflow-hidden rounded-lg bg-card">
            <img src={post.image} alt="" loading="lazy" className="aspect-[268/195] w-full object-cover object-top" />
            <div className="p-4">
              <p className="text-[11px] text-muted-foreground">
                {post.date} <span aria-hidden>&nbsp;|&nbsp;</span>
                <span className="sr-only">, </span>Leitura de {post.read} min
              </p>
              <h3 className="mt-3 font-bold leading-6">{post.title}</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{post.text}</p>
              <span aria-disabled="true" title="Em breve" className="mt-3 inline-block cursor-default text-xs font-bold text-primary">
                Ler mais →
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
