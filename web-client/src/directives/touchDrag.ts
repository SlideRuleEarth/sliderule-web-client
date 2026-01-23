import type { Directive } from 'vue'

/**
 * Directive that enables touch dragging by converting touch events to mouse events.
 * Apply to the draggable element (dialog header) to enable PrimeVue's drag on touch devices.
 *
 * Usage: <div v-touch-drag>...</div>
 */

function createMouseEvent(type: string, touch: Touch): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: touch.clientX,
    clientY: touch.clientY,
    screenX: touch.screenX,
    screenY: touch.screenY
  })
}

/**
 * Check if the touch target is an interactive element (button, link, etc.)
 * that should handle its own touch events
 */
function isInteractiveElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false

  // Check if target or any ancestor is a button or clickable element
  const interactiveSelectors = 'button, a, input, [role="button"], .p-button, .sr-pin-button'
  return target.closest(interactiveSelectors) !== null
}

function handleTouchStart(e: TouchEvent) {
  // Don't interfere with interactive elements like buttons
  if (isInteractiveElement(e.target)) return

  if (e.touches.length === 1) {
    e.preventDefault()
    e.target?.dispatchEvent(createMouseEvent('mousedown', e.touches[0]))
  }
}

function handleTouchMove(e: TouchEvent) {
  // Don't interfere with interactive elements
  if (isInteractiveElement(e.target)) return

  if (e.touches.length === 1) {
    e.preventDefault()
    document.dispatchEvent(createMouseEvent('mousemove', e.touches[0]))
  }
}

function handleTouchEnd(e: TouchEvent) {
  // Don't interfere with interactive elements
  if (isInteractiveElement(e.target)) return

  e.preventDefault()
  if (e.changedTouches.length > 0) {
    document.dispatchEvent(createMouseEvent('mouseup', e.changedTouches[0]))
  }
}

export const vTouchDrag: Directive = {
  mounted(el: HTMLElement) {
    el.addEventListener('touchstart', handleTouchStart, { passive: false })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: false })
  },
  unmounted(el: HTMLElement) {
    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
  }
}

export default vTouchDrag
