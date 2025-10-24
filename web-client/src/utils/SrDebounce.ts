import { renderCachedData } from '@/utils/deck3DPlotUtils';
import { createLogger } from '@/utils/logger';

const logger = createLogger('SrDebounce');
/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was invoked.
 * @param func The function to debounce.
 * @param wait The number of milliseconds to delay.
 * @returns A new debounced function.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any, no-unused-vars
export function SrDebounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-unused-vars
): (...args: any[]) => void {
  let timeout: ReturnType<typeof setTimeout> | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-unused-vars
  return function executedFunction(...args: any[]) {
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
    logger.warn('debouncedRender: localDeckContainer is null or undefined');
  }
}, 150); // 150ms delay is usually a good balance
