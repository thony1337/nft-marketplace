import type { CollectionId, Edition, NFT, NftDetail, Network } from '../types';
import apeEmerald from '@/assets/nfts/ape-emerald.webp';
import apeSage from '@/assets/nfts/ape-sage.webp';
import apeAmber from '@/assets/nfts/ape-amber.webp';
import apeNoir from '@/assets/nfts/ape-noir.webp';

const images = [apeEmerald, apeSage, apeAmber, apeNoir];

const collections: CollectionId[] = [
  'arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis',
  'generativa', 'jogos', 'assinaturas', 'utilidade',
];
const networks: Network[] = ['ethereum', 'polygon', 'solana'];

const adjectives = ['Golden', 'Crimson', 'Lunar', 'Velvet', 'Solar', 'Amber', 'Cobalt', 'Misty'];
const nouns = ['Beast', 'Signal', 'Frequency', 'Drifter', 'Oracle', 'Ape', 'Nomad', 'Baron'];
const attributePool = [
  'Óculos', 'Chapéu', 'Fones', 'Esmeralda', 'Lilás', 'Dourado', 'Blazer', 'Raro', 'Épico', 'Comum',
];

// Small seeded random generator: same seed, same sequence, every time
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Prices are built from integer hundredths so they never pass through float math
function centsToEth(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

const DAY = 86_400_000;
const LAST_DAY = Date.UTC(2026, 8, 30);

// First six items copy the design (names, prices and image order)
const designItems = [
  ['Emerald Ape #042', '1.19', 0],
  ['Sage Nomad #009', '1.69', 1],
  ['Neon Vessel #552', '1.99', 2],
  ['Cosmic Bloom #118', '1.29', 1],
  ['Violet Nomad #314', '1.39', 1],
  ['Ivory Baron #088', '1.79', 3],
] as const;

export function buildNftDetails(): NftDetail[] {
  const rand = mulberry32(20261015);
  const items: NftDetail[] = [];

  for (let i = 0; i < 42; i++) {
    const designed = designItems[i];
    const id = `nft-${i + 1}`;
    const soldOut = i % 11 === 10; // every 11th NFT has no stock in any edition

    const title =
      designed?.[0] ??
      `${adjectives[Math.floor(rand() * adjectives.length)]} ${
        nouns[Math.floor(rand() * nouns.length)]
      } #${String(100 + Math.floor(rand() * 900))}`;

    const image = designed ? images[designed[2]] : images[i % images.length];

    const editions: Edition[] = [
      { id: '1-1', label: '1/1', stock: soldOut ? 0 : Math.floor(rand() * 2) },
      { id: '1-10', label: '1/10', stock: soldOut ? 0 : Math.floor(rand() * 6) },
      { id: '1-50', label: '1/50', stock: soldOut ? 0 : 1 + Math.floor(rand() * 10) },
      { id: 'open', label: 'ABERTA', stock: soldOut ? 0 : 20 + Math.floor(rand() * 80) },
    ];
    const stock = editions.reduce((sum, e) => sum + e.stock, 0);

    const tokenNumber = title.match(/#(\d+)/)?.[1] ?? String(i + 1);
    const attributes = designed
      ? ['Óculos', 'Esmeralda', 'Raro']
      : [0, 1, 2].map(() => attributePool[Math.floor(rand() * attributePool.length)]);

    items.push({
      id,
      title,
      description: `${title}: obra digital da edição Kurio Editions, verificada na blockchain.`,
      image,
      priceInEth: designed?.[1] ?? centsToEth(25 + Math.floor(rand() * 1200)),
      creator: 'Kurio Apes',
      collection: collections[i % collections.length],
      network: networks[Math.floor(rand() * networks.length)],
      createdAt: new Date(LAST_DAY - i * 1.5 * DAY).toISOString(),
      trendingScore: Math.floor(rand() * 100),
      stock,
      version: 1,
      owner: i % 2 === 0 ? 'user-1' : 'user-2',
      isAvailable: stock > 0,
      edition: 1 + (i % 5),
      tokenId: `#${tokenNumber.padStart(4, '0')}`,
      collectionName: 'Kurio Apes',
      attributes: [...new Set(attributes)],
      rating: 4 + Math.floor(rand() * 11) / 10,
      reviewCount: 5 + Math.floor(rand() * 60),
      gallery: [image, image, image, image],
      details:
        `${title} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada atributo fica ` +
        `armazenado nos metadados do token e verificado na Ethereum.\n\n` +
        `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um ` +
        `registro permanente de procedência registrada na rede.`,
      editions,
    });
  }

  return items;
}

// The list endpoint returns the light version without the detail-only fields
export function toSummary(d: NftDetail): NFT {
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    image: d.image,
    priceInEth: d.priceInEth,
    creator: d.creator,
    collection: d.collection,
    network: d.network,
    createdAt: d.createdAt,
    trendingScore: d.trendingScore,
    stock: d.stock,
    version: d.version,
    owner: d.owner,
    isAvailable: d.isAvailable,
    edition: d.edition,
  };
}