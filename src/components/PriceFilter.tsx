import { useState } from 'react';
import Decimal from 'decimal.js';
import { Button } from '@/components/ui/button';

// The range is worked in cents (whole numbers), so no price ever goes through float math
const FLOOR = 2; // 0.02 ETH
const CEIL = 1230; // 12.30 ETH
const STEP = 1;

const toCents = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  try {
    const cents = new Decimal(value).mul(100).round().toNumber();
    return Math.min(CEIL, Math.max(FLOOR, cents));
  } catch {
    return fallback;
  }
};
const toEth = (cents: number) => new Decimal(cents).div(100).toFixed(2); // "1.50", as the API wants it
const show = (cents: number) => toEth(cents).replace('.', ',');

type Props = {
  min?: string;
  max?: string;
  onApply: (minPrice: string | undefined, maxPrice: string | undefined) => void;
};

// Two thumbs on one track. Each is a real range input, so the keyboard works (arrows, Home, End).
export function PriceFilter({ min, max, onApply }: Props) {
  const [low, setLow] = useState(() => toCents(min, FLOOR));
  const [high, setHigh] = useState(() => toCents(max, CEIL));

  const span = CEIL - FLOOR;
  const left = ((low - FLOOR) / span) * 100;
  const right = ((high - FLOOR) / span) * 100;

  const thumb =
    'pointer-events-none absolute inset-0 h-4 w-full appearance-none bg-transparent ' +
    '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none ' +
    '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary ' +
    '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full ' +
    '[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary ' +
    '[&:focus-visible::-webkit-slider-thumb]:outline-2 [&:focus-visible::-webkit-slider-thumb]:outline-offset-2 ' +
    '[&:focus-visible::-webkit-slider-thumb]:outline-foreground [&:focus-visible::-moz-range-thumb]:outline-2 ' +
    '[&:focus-visible::-moz-range-thumb]:outline-offset-2 [&:focus-visible::-moz-range-thumb]:outline-foreground';

  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold">Faixa de preço</h2>

      <div className="relative mx-0.5 mt-4 h-4">
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-primary/50" />
        <div
          aria-hidden
          className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-primary"
          style={{ left: `${left}%`, right: `${100 - right}%` }}
        />
        <input
          type="range"
          aria-label="Preço mínimo (ETH)"
          aria-valuetext={`${show(low)} ETH`}
          min={FLOOR}
          max={CEIL}
          step={STEP}
          value={low}
          onChange={(e) => setLow(Math.min(Number(e.target.value), high))}
          className={thumb}
          // when both thumbs meet at the top, the lower one must stay reachable
          style={{ zIndex: low >= CEIL - 20 ? 2 : 1 }}
        />
        <input
          type="range"
          aria-label="Preço máximo (ETH)"
          aria-valuetext={`${show(high)} ETH`}
          min={FLOOR}
          max={CEIL}
          step={STEP}
          value={high}
          onChange={(e) => setHigh(Math.max(Number(e.target.value), low))}
          className={thumb}
        />
      </div>

      <p className="mt-4 px-3 text-sm" aria-live="polite">
        Preço: {show(low)} - {show(high)} ETH
      </p>

      <Button
        type="button"
        className="ml-3 mt-3 h-9 rounded px-4 font-bold"
        onClick={() => onApply(low === FLOOR ? undefined : toEth(low), high === CEIL ? undefined : toEth(high))}
      >
        Aplicar
      </Button>
    </div>
  );
}
