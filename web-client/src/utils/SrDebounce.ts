import { renderCachedData } from '@/utils/deck3DPlotUtils';
/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was invoked.
 * @param func The function to debounce.
 * @param wait The number of milliseconds to delay.
 * @returns A new debounced function.
 */
export function SrDebounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
// --- Debounced Renderer ---
// This fast function will be called for UI controls.
export const debouncedRender = SrDebounce((localDeckContainer) => {
  if (localDeckContainer) {
    renderCachedData(localDeckContainer);
  } else {
    console.warn('debouncedRender: localDeckContainer is null or undefined');
  }
}, 150); // 150ms delay is usually a good balance
