/**
 * Media source helpers.
 *
 * Project media in portfolio.json is authored as plain share links — a repo
 * path, a Google Drive "view" URL, a YouTube link — and each of those needs a
 * different shape to actually render: an <img> src, an embeddable iframe URL,
 * a thumbnail for the strip. Everything that knows those per-host rules lives
 * here so normalize.js and the viewer only deal with the resolved result.
 */

const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v)(?:[?#]|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(?:[?#]|$)/i;

/** Absolute URLs only — a relative repo path is not a host-specific source. */
function absolute(url) {
  try {
    return new URL(str(url));
  } catch {
    return null;
  }
}

const hostOf = (parsed) => parsed.hostname.replace(/^www\./, '');

/* ------------------------------------------------------------------ ids -- */

export function youtubeId(url) {
  const parsed = absolute(url);
  if (!parsed) return null;
  const host = hostOf(parsed);

  if (host === 'youtu.be') return parsed.pathname.slice(1).split('/')[0] || null;
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    return parsed.searchParams.get('v')
      || parsed.pathname.match(/^\/(?:embed|shorts|v)\/([^/?]+)/)?.[1]
      || null;
  }
  return null;
}

export function driveId(url) {
  const parsed = absolute(url);
  if (!parsed || hostOf(parsed) !== 'drive.google.com') return null;
  return parsed.pathname.match(/\/d\/([^/]+)/)?.[1] || parsed.searchParams.get('id') || null;
}

function vimeoId(url) {
  const parsed = absolute(url);
  if (!parsed || hostOf(parsed) !== 'vimeo.com') return null;
  const id = parsed.pathname.split('/').filter(Boolean)[0];
  return /^\d+$/.test(id || '') ? id : null;
}

/* --------------------------------------------------------------- embeds -- */

/**
 * Turns a YouTube, Google Drive or Vimeo share link into an embeddable one.
 *
 * The old implementation split on 'v=' and on '/d/' without checking the
 * result, so a URL carrying extra query params produced a broken id and a
 * Drive URL in any other shape threw outright. This returns null instead of
 * guessing, and the caller falls back to a plain link or the cover image.
 */
export function embedUrl(url) {
  const yt = youtubeId(url);
  if (yt) return `https://www.youtube.com/embed/${yt}`;

  const drive = driveId(url);
  if (drive) return `https://drive.google.com/file/d/${drive}/preview`;

  const vimeo = vimeoId(url);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo}`;

  return null;
}

/* ----------------------------------------------------------- thumbnails -- */

/**
 * A still frame for the gallery strip, so a video reads as its own content
 * rather than a grey box. Vimeo has no static thumbnail endpoint without an
 * API call, and a local file has none at all — both fall back to the poster
 * the author supplied, then to an icon tile in the viewer.
 */
export function posterFor(url) {
  const yt = youtubeId(url);
  if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;

  const drive = driveId(url);
  if (drive) return `https://drive.google.com/thumbnail?id=${drive}&sz=w640`;

  return '';
}

/**
 * Drive's /view and /preview URLs are HTML pages, not bitmaps, so they cannot
 * go in an <img src>. The thumbnail endpoint serves the actual file and is the
 * only Drive form that renders inline; asking for a wide size gets something
 * usable full-bleed rather than a 220px sprite.
 */
export function directImageUrl(url) {
  const drive = driveId(url);
  return drive ? `https://drive.google.com/thumbnail?id=${drive}&sz=w1600` : str(url);
}

/* -------------------------------------------------------------- kind/src -- */

/**
 * `type` in the JSON is optional. Extensions decide it where they exist, and a
 * known video host decides it otherwise. Drive can hold either, and its
 * /preview iframe renders both, so an undeclared Drive link is treated as a
 * video — declare `"type": "image"` to get a real <img> instead.
 */
export function inferKind(src, declared) {
  const type = str(declared).toLowerCase();
  if (type === 'video' || type === 'image') return type;

  if (VIDEO_EXT.test(src)) return 'video';
  if (IMAGE_EXT.test(src)) return 'image';
  if (youtubeId(src) || vimeoId(src) || driveId(src)) return 'video';

  return 'image';
}

/**
 * Sanitiser for media sources.
 *
 * Deliberately not safeHref() from normalize.js: that one requires a leading
 * `/` or `./`, which would blank every existing repo-relative path in
 * portfolio.json. Scheme-less paths pass; anything carrying a scheme other
 * than http(s) — javascript:, data:, file: — is dropped.
 */
export function safeMediaSrc(src) {
  const value = str(src);
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^\/\//.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
  return value;
}
