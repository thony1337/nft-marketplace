import Decimal from 'decimal.js';

// ETH amounts travel as decimal strings and are shown the way the catalog and the NFT page already
// show them ("1.19 ETH"). Never goes through a JS number.
export function formatEth(value: string): string {
  return `${new Decimal(value).toFixed()} ETH`;
}
