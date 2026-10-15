import { useSyncExternalStore } from 'react';

// On phones the filters live in a sheet opened from the button next to the search field. The button
// and the sheet are on different parts of the page, so the open state sits here, not in either one.
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const setMobileFiltersOpen = (value: boolean) => {
  if (open === value) return;
  open = value;
  emit();
};
export const useMobileFiltersOpen = () =>
  useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => open,
    () => false,
  );
