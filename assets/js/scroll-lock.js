/**
 * Ref-counted page scroll lock.
 *
 * The project viewer and the mobile nav sheet both want the page frozen while
 * they are up. Each setting `body.style.overflow` directly means whichever
 * closes first unfreezes the page under the other, so the count is kept here
 * and the style is only touched on the first lock and the last release.
 */
let depth = 0;
let previous = '';

export function lockScroll() {
  if (depth === 0) {
    previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  depth += 1;
}

export function unlockScroll() {
  if (depth === 0) return;
  depth -= 1;
  if (depth === 0) document.body.style.overflow = previous;
}
