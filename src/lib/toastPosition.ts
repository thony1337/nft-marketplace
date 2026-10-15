/** On phones the bottom of the screen holds the action bars, so toasts go on top. */
export function toastPosition(): 'top-center' | undefined {
  try {
    return window.matchMedia('(max-width: 767px)').matches ? 'top-center' : undefined;
  } catch {
    return undefined;
  }
}
