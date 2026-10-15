import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { fetchNfts } from '../api/nfts';
import { Skeleton } from '@/components/ui/skeleton';

// "NFT em destaque": the NFT that is moving most right now. It is a nicety, so it vanishes if there is none.
export function FeaturedNft() {
  const { data, isPending } = useQuery({
    queryKey: ['nfts', 'featured'],
    queryFn: () => fetchNfts({ tab: 'trending', pageSize: 1 }),
  });
  const nft = data?.items[0];

  if (isPending) return <Skeleton aria-hidden className="h-[470px] w-full rounded-[28px]" />;
  if (!nft) return null;

  return (
    <section aria-labelledby="featured-title" className="overflow-hidden rounded-[28px] bg-[#271a10]">
      <div className="px-5 pb-4 pt-6">
        <h2 id="featured-title" className="text-xl font-bold uppercase leading-none text-primary">
          NFT em destaque
        </h2>
        <p className="mt-5 text-center text-lg font-bold uppercase">Oferta limitada</p>
      </div>
      <Link to="/nft/$id" params={{ id: nft.id }} className="block" aria-label={`${nft.title}, ${nft.priceInEth} ETH`}>
        <img
          src={nft.image}
          alt=""
          loading="lazy"
          className="aspect-[310/366] w-full rounded-[28px] object-cover"
        />
      </Link>
    </section>
  );
}
