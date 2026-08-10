import { el, clear, $ } from '../dom.js';
import { icon } from '../icons.js';
import { track } from '../analytics.js';
import { lockScroll, unlockScroll } from '../scroll-lock.js';
import { embedUrl } from '../media.js';

/**
 * Project detail viewer, built on a native <dialog>: top layer, backdrop, Esc
 * and focus trapping come from the platform rather than being hand-rolled.
 *
 * Beyond presentation it adds prev/next through the *current filtered set* and
 * a `#project/<slug>` deep link, so a single project can be shared directly.
 */
export function createViewer({ controller }) {
  const dialog = $('[data-viewer]');
  const body = $('[data-viewer-body]');
  const scroll = $('[data-viewer-scroll]');
  const counter = $('[data-viewer-counter]');
  const prevBtn = $('[data-viewer-prev]');
  const nextBtn = $('[data-viewer-next]');
  const copyBtn = $('[data-viewer-copy]');
  const closeBtn = $('[data-viewer-close]');

  let current = null;
  let opener = null;
  let suppressHashHandling = false;

  fill(prevBtn, 'chevron-left');
  fill(nextBtn, 'chevron-right');
  fill(copyBtn, 'link');
  fill(closeBtn, 'x');

  /* ---------------------------------------------------------------- open -- */

  function open(project, { fromHash = false } = {}) {
    if (!project) return;
    current = project;

    if (!fromHash) opener = document.activeElement;

    render(project);
    /* Stepping to a sibling re-enters open() on an already-open dialog; the
       lock is ref-counted, so it must only be taken on the way in. */
    if (!dialog.open) {
      dialog.showModal();
      lockScroll();
    }
    scroll.scrollTop = 0;

    setHash(`#project/${project.slug}`);
    updateNav();

    track('project_view', {
      project_name: project.title,
      project_category: project.categories.join(',') || 'uncategorised',
    });
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener('close', () => {
    unlockScroll();
    current = null;
    clear(body); // stops any embedded video from playing on
    if (location.hash.startsWith('#project/')) setHash('');
    if (opener && document.contains(opener)) opener.focus();
    opener = null;
  });

  /* Clicking the backdrop (i.e. the dialog element itself) closes. */
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  closeBtn.addEventListener('click', close);

  /* ------------------------------------------------------------ prev/next -- */

  function siblings() {
    const list = controller.getVisible();
    const at = current ? list.findIndex((p) => p.slug === current.slug) : -1;
    return { list, at };
  }

  function step(delta) {
    const { list, at } = siblings();
    if (at < 0) return;
    const next = list[at + delta];
    if (next) open(next);
  }

  function updateNav() {
    const { list, at } = siblings();
    const known = at >= 0;

    prevBtn.disabled = !known || at === 0;
    nextBtn.disabled = !known || at === list.length - 1;

    clear(counter);
    counter.append(known ? `${at + 1} / ${list.length}` : '');
  }

  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));

  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    /* Inside the gallery the arrows walk its items; the gallery handles them
       first and this must not also jump to the next project. */
    if (e.target.closest?.('[data-gallery]')) return;
    e.preventDefault();
    step(e.key === 'ArrowLeft' ? -1 : 1);
  });

  /* ------------------------------------------------------------ copy link -- */

  copyBtn.addEventListener('click', async () => {
    if (!current) return;
    const url = `${location.origin}${location.pathname}#project/${current.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      flash(copyBtn, 'check');
      track('project_link_click', { project_name: current.title, link: 'copy' });
    } catch {
      /* Clipboard is permission-gated; putting it in the address bar is the
         next best thing the user can act on. */
      setHash(`#project/${current.slug}`);
      flash(copyBtn, 'link');
    }
  });

  function flash(button, name) {
    clear(button);
    button.append(icon(name, { size: 16 }));
    setTimeout(() => fill(button, 'link'), 1400);
  }

  /* ------------------------------------------------------------- deep link -- */

  function setHash(hash) {
    suppressHashHandling = true;
    const url = `${location.pathname}${location.search}${hash}`;
    history.replaceState(null, '', url);
    requestAnimationFrame(() => { suppressHashHandling = false; });
  }

  function handleHash() {
    if (suppressHashHandling) return;
    const match = location.hash.match(/^#project\/(.+)$/);
    if (!match) {
      if (dialog.open) close();
      return;
    }
    const project = controller.findBySlug(decodeURIComponent(match[1]));
    if (project) open(project, { fromHash: true });
  }

  window.addEventListener('hashchange', handleHash);

  /* ---------------------------------------------------------------- render -- */

  function render(project) {
    clear(body);

    const media = renderMedia(project);
    if (media) body.append(media);

    body.append(
      el('header', { class: 'viewer__head' },
        project.categoryNames.length
          ? el('p', { class: 'viewer__cats' },
              project.categoryNames.map((c) => el('span', null, c)))
          : null,
        el('h2', { class: 'viewer__title' }, project.title),
      ),
    );

    if (project.fullDescription) {
      body.append(section('Overview', el('p', null, project.fullDescription)));
    }

    if (project.features.length) {
      body.append(section('Key features',
        el('ul', { class: 'featurelist' },
          project.features.map((f) => el('li', null, icon('check', { size: 14 }), el('span', null, f)))),
      ));
    }

    if (project.technologies.length) {
      body.append(section('Built with',
        el('ul', { class: 'taglist' },
          project.technologies.map((t) => el('li', { class: 'tag' }, t))),
      ));
    }

    if (project.team.length) {
      body.append(section('Team',
        el('ul', { class: 'team' }, project.team.map(teammate)),
      ));
    }

    const links = renderLinks(project);
    if (links) body.append(section('Links', links));
  }

  function section(title, ...children) {
    return el('section', { class: 'viewer__section' }, el('h4', null, title), ...children);
  }

  function teammate(member) {
    return el('li', { class: 'teammate' },
      el('span', { class: 'teammate__avatar' },
        member.img
          ? el('img', { src: member.img, alt: '', loading: 'lazy' })
          : initials(member.name)),
      el('span', { class: 'teammate__info' },
        el('span', { class: 'teammate__name' }, member.name),
        member.role ? el('span', { class: 'teammate__role' }, member.role) : null,
        member.contact
          ? el('a', { class: 'teammate__contact', href: `mailto:${member.contact}` }, member.contact)
          : null,
      ),
    );
  }

  function renderLinks(project) {
    const entries = [
      ['github', 'View source', project.links.github],
      ['book', 'Documentation', project.links.docs],
      ['play', 'Demo video', project.links.demo],
      ['globe', 'Live site', project.links.live],
    ].filter(([, , href]) => href);

    if (!entries.length) return null;

    return el('div', { class: 'viewer__links' },
      entries.map(([name, label, href], i) => el('a', {
        class: `btn ${i === 0 ? 'btn--primary' : 'btn--ghost'}`,
        href,
        target: '_blank',
        rel: 'noopener',
        dataset: {
          track: 'project_link_click',
          trackLabel: project.title,
          trackLink: name,
        },
      }, icon(name, { size: 15 }), label)),
    );
  }

  /** Called once after wiring, so `#project/<slug>` opens on a cold load. */
  return { open, close, updateNav, handleHash };
}

/* ---------------------------------------------------------------- gallery -- */

/**
 * Stage plus thumbnail strip, in the shape of a store page: the strip shows at
 * a glance how much there is and how it splits between clips and stills.
 *
 * The selected item is swapped by replacing the stage node rather than
 * retargeting it, which is what stops a video the moment you move off it —
 * the same trick the dialog's close handler relies on.
 *
 * State lives in this call's closure, so it resets on every open and cannot
 * survive the re-render that follows a background data revalidation.
 */
function renderMedia(project) {
  const items = project.media;
  if (!items.length) return null;

  const gallery = el('div', { class: 'viewer__gallery', dataset: { gallery: '' } });
  const stage = el('div', { class: 'viewer__media' });
  const caption = el('p', { class: 'viewer__caption' });

  let index = 0;
  let position = null;
  const thumbs = items.length > 1 ? items.map(thumbButton) : [];

  function show(next, { focus = false } = {}) {
    index = (next + items.length) % items.length;
    const item = items[index];

    clear(stage);
    stage.classList.remove('viewer__media--icon');
    stage.dataset.kind = item.kind;
    stage.append(stageNode(item, project));

    clear(caption);
    caption.hidden = !item.caption;
    if (item.caption) caption.append(item.caption);

    thumbs.forEach((btn, i) => {
      btn.setAttribute('aria-current', String(i === index));
      if (i !== index || !btn.isConnected) return;
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (focus) btn.focus();
    });

    if (position) {
      clear(position);
      position.append(`${index + 1} / ${items.length}`);
    }
  }

  function thumbButton(item, i) {
    const label = item.caption || `${item.kind === 'video' ? 'Video' : 'Image'} ${i + 1}`;

    return el('button', {
      class: `viewer__thumb viewer__thumb--${item.kind}`,
      type: 'button',
      'aria-label': label,
      'aria-current': 'false',
      on: { click: () => show(i) },
    },
    item.poster
      ? el('img', {
          src: item.poster,
          alt: '',
          loading: 'lazy',
          decoding: 'async',
          /* Replace only the image so the play badge above it survives. */
          on: { error: (e) => e.target.replaceWith(thumbIcon(item.kind)) },
        })
      : thumbIcon(item.kind),
    item.kind === 'video' ? el('span', { class: 'viewer__thumbbadge' }, icon('play', { size: 12 })) : null,
    );
  }

  gallery.append(stage, caption);

  if (thumbs.length) {
    position = el('span', { class: 'viewer__position' });

    const prev = navButton('chevron-left', 'Previous item', () => show(index - 1));
    const next = navButton('chevron-right', 'Next item', () => show(index + 1));

    gallery.append(
      el('div', { class: 'viewer__thumbs' }, thumbs),
      el('div', { class: 'viewer__gallerybar' },
        el('span', { class: 'viewer__count' }, countLabel(project.mediaCounts)),
        el('span', { class: 'viewer__gallerynav' }, prev, position, next),
      ),
    );

    /* Left/Right walk the gallery while it holds focus; the dialog-level
       binding keeps them walking between projects everywhere else. A focused
       <video> is left alone so its own seek shortcuts still work. */
    gallery.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'VIDEO') return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      show(index + (e.key === 'ArrowLeft' ? -1 : 1), { focus: true });
    });
  }

  show(0);
  return gallery;
}

function stageNode(item, project) {
  if (item.render === 'embed') {
    return el('iframe', {
      src: item.src,
      title: item.caption || `${project.title} — video`,
      loading: 'lazy',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowfullscreen: true,
    });
  }

  if (item.render === 'file') {
    return el('video', {
      src: item.src,
      poster: item.poster || null,
      controls: true,
      playsinline: true,
      preload: 'metadata',
    });
  }

  return el('img', {
    src: item.src,
    alt: item.alt || '',
    loading: 'lazy',
    decoding: 'async',
    /* Same degradation as project cards: a dead source becomes an icon tile
       rather than a browser's broken-image glyph. */
    on: {
      error: (e) => {
        const wrap = e.target.parentElement;
        if (!wrap) return;
        clear(wrap);
        wrap.classList.add('viewer__media--icon');
        wrap.append(icon('image', { size: 36 }));
      },
    },
  });
}

function thumbIcon(kind) {
  return el('span', { class: 'viewer__thumbicon' },
    icon(kind === 'video' ? 'play' : 'image', { size: 20 }));
}

function countLabel({ videos = 0, images = 0 } = {}) {
  const parts = [];
  if (videos) parts.push(`${videos} ${videos === 1 ? 'video' : 'videos'}`);
  if (images) parts.push(`${images} ${images === 1 ? 'image' : 'images'}`);
  return parts.join(' · ');
}

function navButton(name, label, onClick) {
  return el('button', {
    class: 'iconbtn iconbtn--sm',
    type: 'button',
    'aria-label': label,
    on: { click: onClick },
  }, icon(name, { size: 15 }));
}

/* ------------------------------------------------------------------ utils -- */

function fill(button, name) {
  clear(button);
  button.append(icon(name, { size: 16 }));
}

function initials(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}
