import { useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
];

const COLLECTIONS = [
  { id: 'arte-digital', label: 'Arte digital' },
  { id: 'fotografia', label: 'Fotografia' },
  { id: 'musica', label: 'Música' },
  { id: 'arte-3d', label: 'Arte 3D' },
  { id: 'utilidade', label: 'Utilidade' },
] as const;

// Pages that are outside the scope of this delivery: shown as in the design, but not clickable
const HELP = ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'];
const PROFILE_SOON = ['Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse'];
// Brand icons are not in lucide-react: plain letters keep the design's boxes without extra assets
const SOCIAL = [
  { label: 'Facebook', glyph: 'f' },
  { label: 'Instagram', glyph: 'ig' },
  { label: 'X (Twitter)', glyph: 'x' },
  { label: 'LinkedIn', glyph: 'in' },
  { label: 'YouTube', glyph: 'yt' },
];

const soon = { 'aria-disabled': true as const, title: 'Em breve' };
const linkClass = 'block w-fit hover:text-primary';
const soonClass = 'block w-fit cursor-default';

export function Footer() {
  const [email, setEmail] = useState('');

  // There is no newsletter service in this delivery: say so instead of pretending it worked
  const subscribe = (e: FormEvent) => {
    e.preventDefault();
    toast.info('O cadastro de newsletter não está disponível nesta demonstração.');
    setEmail('');
  };

  return (
    <footer className="mx-auto mt-24 w-full max-md:pb-24 max-w-[1200px] px-4 xl:px-0">
      <div className="bg-card">
        <div className="grid gap-y-8 py-8 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.3fr] lg:gap-y-0">
          {FEATURES.map((f, i) => (
            <section
              key={f.letter}
              aria-labelledby={`footer-feature-${i}`}
              className={`px-6 lg:px-6 ${i === 0 ? 'lg:pl-12' : ''} ${i > 0 ? 'lg:border-l lg:border-primary/60' : ''}`}
            >
              <span
                aria-hidden="true"
                className="grid size-[74px] place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground"
              >
                {f.letter}
              </span>
              <h2 id={`footer-feature-${i}`} className="mt-5 text-base font-bold leading-snug">
                {f.title}
              </h2>
              <p className="mt-2 text-sm leading-[22px] text-muted-foreground">{f.text}</p>
            </section>
          ))}

          <section aria-labelledby="footer-newsletter" className="px-6 lg:border-l lg:border-primary/60">
            <h2 id="footer-newsletter" className="text-lg font-bold leading-none">
              Antecipe-se ao próximo lançamento
            </h2>
            <form onSubmit={subscribe} className="mt-3 flex">
              <label htmlFor="footer-email" className="sr-only">
                Endereço para receber novidades
              </label>
              <Input
                id="footer-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="digite seu e-mail..."
                autoComplete="email"
                className="h-10 min-w-0 flex-1 rounded-r-none border-0 bg-[#38220f] text-sm"
              />
              <button
                type="submit"
                className="h-10 shrink-0 rounded-r-md bg-primary px-4 text-lg font-bold text-primary-foreground hover:bg-primary/90"
              >
                Enviar
              </button>
            </form>
            <p className="mt-3 text-sm leading-[22px] text-muted-foreground">
              Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
            </p>
          </section>
        </div>

        <div className="grid gap-4 bg-[#38220f] px-8 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p className="font-bold tracking-widest">KURIO</p>
          <p>Feito para colecionadores, criadores e cultura</p>
          <p>contato@email.com</p>
          <p>+55 11 4002 8922</p>
        </div>

        <nav aria-label="Rodapé" className="grid gap-8 px-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h2 className="text-lg font-bold">Meu perfil</h2>
            <ul className="mt-2 space-y-2 text-sm">
              <li>
                <Link to="/profile" className={linkClass}>
                  Meu perfil
                </Link>
              </li>
              {PROFILE_SOON.map((label) => (
                <li key={label}>
                  <span {...soon} className={soonClass}>
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold">Central de ajuda</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {HELP.map((label) => (
                <li key={label}>
                  <span {...soon} className={soonClass}>
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold">Coleções</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {COLLECTIONS.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/"
                    search={{ page: 1, tab: 'all', sort: 'recent', collection: c.id }}
                    hash="catalogo"
                    className={linkClass}
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold">Redes sociais</h2>
            <ul className="mt-3 flex gap-2">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <span
                    {...soon}
                    role="img"
                    aria-label={s.label}
                    className="grid size-8 cursor-default place-items-center rounded-md border border-primary text-xs font-bold text-primary"
                  >
                    {s.glyph}
                  </span>
                </li>
              ))}
            </ul>
            <h2 className="mt-6 text-lg font-bold">Carteiras compatíveis</h2>
            <p
              aria-label="Carteiras compatíveis: MetaMask, WalletConnect e Coinbase"
              className="mt-3 rounded-md border border-primary/40 bg-[#38220f] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-primary"
            >
              MetaMask · WalletConnect · Coinbase
            </p>
          </div>
        </nav>
      </div>

      <p className="py-4 text-center text-sm">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  );
}
