import type { NFT, NftDetail } from '../types';
import { buildNftDetails, toSummary } from './nftFixtures';

export const mockNftDetails: NftDetail[] = buildNftDetails();
export const mockNfts: NFT[] = mockNftDetails.map(toSummary);
