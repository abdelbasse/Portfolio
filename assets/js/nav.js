import { el, clear, $, $$ } from './dom.js';
import { icon } from './icons.js';
import { lockScroll, unlockScroll } from './scroll-lock.js';

/**
 * Builds the section nav from whichever sections actually rendered, keeps the
 * current one marked, drives the reading-progress rule, and runs the mobile
 * menu. A section absent from the JSON never gets a link.
 */
/** Dropped and rebuilt on re-render so listeners never stack up. */
let listeners;

export function initNav() {
  listeners?.abort();
  listeners = new AbortController();
  const { signal } = listeners;

  const navList = $('[data-nav]');
  const navPanel = $('[data-nav-panel]');
  const topbar = $('[data-topbar]');
  const progress = $('[data-progress]');
  const menuBtn = $('[data-menu-toggle]');

  const sections = $$('[data-section]').filter((s) => !s.hidden);

  clear(navList);
  for (const section of sections) {
    navList.append(
      el('li', null,
        el('a', {
          href: `#${section.id}`,
          dataset: { navLink: section.id, track: 'nav_click', trackLabel: section.dataset.navLabel },
        }, section.dataset.navLabel || section.id),
      ),
    );
  }

  /* ---- mobile sheet ---- */
  if (menuBtn && navPanel) {
    /* Marked inert while the sheet is up, which traps Tab inside it without
       hand-rolling a focus cycle. The topbar stays reachable on purpose, so
       the theme toggle and the close button are still in the tab order. */
    const behind = [$('#main'), $('.footer')].filter(Boolean);

    const isOpen = () => navPanel.dataset.open === 'true';

    const setOpen = (open, { restoreFocus = true } = {}) => {
      if (open === isOpen()) return;

      navPanel.dataset.open = String(open);
      menuBtn.setAttribute('aria-expanded', String(open));
      clear(menuBtn);
      menuBtn.append(icon(open ? 'x' : 'menu', { size: 18 }));
      behind.forEach((node) => { node.inert = open; });

      if (open) {
        lockScroll();
        navList.querySelector('a')?.focus();
      } else {
        unlockScroll();
        if (restoreFocus) menuBtn.focus();
      }
    };

    /* A background revalidation re-enters initNav and rebuilds the links, so
       release whatever the previous run was still holding before resetting. */
    if (isOpen()) unlockScroll();

    navPanel.dataset.open = 'false';
    menuBtn.setAttribute('aria-expanded', 'false');
    clear(menuBtn);
    menuBtn.append(icon('menu', { size: 18 }));
    behind.forEach((node) => { node.inert = false; });

    menuBtn.addEventListener('click', () => setOpen(!isOpen()), { signal });
    navList.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false, { restoreFocus: false });
    }, { signal });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) setOpen(false);
    }, { signal });

    /* Rotating to landscape crosses the breakpoint and hides the toggle;
       without this the sheet stays flagged open behind a display:none button
       and the page stays locked. */
    const wide = window.matchMedia('(min-width: 60.0625rem)');
    wide.addEventListener('change', (e) => {
      if (e.matches) setOpen(false, { restoreFocus: false });
    }, { signal });
  }

  /* ---- current section + progress ---- */
  const links = new Map($$('[data-nav-link]').map((a) => [a.dataset.navLink, a]));

  if ('IntersectionObserver' in window && sections.length) {
    /* Track which sections are on screen and mark the topmost of them, which
       behaves better than a scroll handler comparing offsets. */
    const onScreen = new Set();

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target.id);
        else onScreen.delete(entry.target.id);
      }

      const currentId = sections.map((s) => s.id).find((id) => onScreen.has(id));
      for (const [id, link] of links) {
        link.setAttribute('aria-current', String(id === currentId));
      }
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

    sections.forEach((s) => observer.observe(s));
  }

  const onScroll = () => {
    if (topbar) topbar.dataset.stuck = String(window.scrollY > 8);
    if (progress) {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
      progress.style.setProperty('--progress', ratio.toFixed(4));
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true, signal });
  window.addEventListener('resize', onScroll, { passive: true, signal });
  onScroll();
}
