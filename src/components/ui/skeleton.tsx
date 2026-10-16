import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import './skeleton.css';

// Placeholder for content that is loading. Callers give it the size of what will replace it, so
// nothing moves when the data arrives.
function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('kurio-skeleton rounded-md bg-accent', className)} {...props} />;
}

export { Skeleton };
