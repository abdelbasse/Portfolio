# Updating the site

The whole site renders from one file: **`data/portfolio.json`**. Change it, push
it, done — you never touch HTML, CSS or JS to update content.

```bash
# edit data/portfolio.json, then:
git add data/portfolio.json
git commit -m "content: add the X project"
git push
```

The live site reads the JSON straight from GitHub at
`raw.githubusercontent.com/taoudi-abdelbasset/Portfolio/main/data/portfolio.json`,
so your change shows up within a minute or so — you don't have to wait for the
GitHub Pages build. You can also edit the file directly in GitHub's web editor
from your phone.

## Where the data comes from

`assets/js/data-source.js` tries these in order and takes the first that works:

| # | Source | Why |
|---|--------|-----|
| 1 | `?data=<url>` | Preview a draft or another branch before merging |
| 2 | Fresh `localStorage` copy | Instant paint; revalidates in the background |
| 3 | **raw.githubusercontent.com** | The real source of truth |
| 4 | jsDelivr mirror | Only if raw is unreachable (caches ~12h, so never primary) |
| 5 | Bundled `data/portfolio.json` | Shipped with the site |
| 6 | Stale `localStorage` copy | Better stale than blank |

If it falls through to 5 or 6, a toast tells you — a bad push is visible, not
silent. To move content to a different repo or branch later, change
`DATA_SOURCE` in `assets/js/config.js`. Nothing else needs to change.

**Preview before merging:**
`https://taoudi-abdelbasset.me/?data=https://raw.githubusercontent.com/taoudi-abdelbasset/Portfolio/some-branch/data/portfolio.json`

## Safety net

Anything missing degrades instead of breaking:

- A section that's empty or absent disappears — **and so does its nav link**.
- A missing field falls back to a sensible default.
- A broken image URL collapses to an icon rather than leaving a hole.
- `javascript:` and `data:` URLs in the JSON are stripped.
- Content is inserted as text, never as markup, so it can't inject HTML.

Run `python3 -m json.tool data/portfolio.json` before pushing to catch a stray
comma. That single check prevents nearly every content-push mistake.

---

# The schema

Only `main` is really required. Everything else is optional: leave a section out
and it simply won't render.

## `main`

```json
{
  "main": {
    "name": "TAOUDI Abdelbasset",
    "statement": "I turn raw data into *decisions*.",
    "contactStatement": "Open to opportunities and *collaborations*.",
    "roles": ["Data Scientist", "Backend Developer"],
    "education": "Big Data & Cloud Computing, ENSET Mohammedia",
    "location": "Mohammedia, Morocco",
    "availability": "",
    "resumeUrl": "",
    "img": "data/src/imgs/user.png",
    "bio": "Big Data and Cloud Computing engineer…"
  }
}
```

| Field | Notes |
|---|---|
| `name` | Required. Used in the wordmark, page title and schema.org data. |
| `statement` | The big hero line. Wrap one word in `*asterisks*` to render it as the italic accent — that's the single coloured moment on the page. Falls back to `name`. |
| `contactStatement` | The headline over the contact section. Same `*asterisk*` accent. Leave it out for the default. |
| `roles` | Cycles in the mono line under the statement. Shown as a plain list when the visitor prefers reduced motion. |
| `location`, `availability` | Optional; each renders a metadata row only if present. `availability` gets a green status dot. |
| `resumeUrl` | Leave `""` and the Résumé button doesn't appear anywhere. Fill it and it shows in the hero and the contact list. |
| `img` | Use a **relative** path like `data/src/imgs/user.png` so it works locally and live. |

## `experience` and `education`

Same shape. Experience uses `company`, education uses `location` as the
organisation.

```json
{
  "from": "Jul 2024",
  "to": "Sep 2024",
  "title": "Data & Process Optimization Intern",
  "company": "Annour Technologies",
  "location": "Casablanca, Morocco",
  "logo": "",
  "icon": "fas fa-briefcase",
  "description": "One paragraph…",
  "achievements": ["Bullet one", "Bullet two"],
  "skills": ["Laravel", "D3.js"]
}
```

Entries render in the order you list them. An entry with no `description`,
`achievements` or `skills` renders as a plain row with no expander.

## `skills`

```json
{
  "id": "bigdata",
  "title": "Big Data & Analytics",
  "icon": "fas fa-chart-line",
  "description": "One sentence…",
  "techTags": ["Spark", "Kafka"]
}
```

## `certifications`

A top-level list, rendered as its own section between Education and Skills.

```json
{
  "name": "Supervised Machine Learning",
  "issuer": "Coursera",
  "date": "Mar 2025",
  "credentialId": "ABC123",
  "link": "https://…",
  "icon": "fas fa-certificate",
  "skills": ["Machine Learning", "Python"]
}
```

Only `name` is required — every other field renders only if you fill it, and a
certificate with no `link` renders as plain text rather than a dead link.
Entries appear in the order you list them, so put the ones worth seeing first.

Certificates used to live inside each skill group as `skills[].certificates`.
That still works: if there's no top-level `certifications`, they're read from
there instead. Don't fill both — the top-level list wins and the nested one is
ignored.

## `projects`

```json
{
  "title": "RetailVision Analytics",
  "slug": "retailvision",
  "categories": ["ai", "bigdata", "web"],
  "description": "One line for the card.",
  "fullDescription": "The longer version for the detail panel.",
  "image": "fas fa-store",
  "imgBg": "data/src/imgs/projects/default.png",
  "media": [
    { "type": "video", "src": "https://youtu.be/XXXXXXXXXXX", "caption": "Two-minute walkthrough" },
    { "type": "image", "src": "data/src/imgs/projects/retailvision/dashboard.png", "caption": "Live dashboard" }
  ],
  "technologies": ["YOLOv8", "Spark", "Kafka"],
  "features": ["Feature one", "Feature two"],
  "githubLink": "",
  "documentation": "",
  "demoVideo": "",
  "liveUrl": "",
  "year": 2025,
  "featured": true,
  "teamMembers": [
    { "name": "Abdelbasset TAOUDI", "role": "Lead Developer", "contact": "you@example.com", "img": "" }
  ]
}
```

| Field | Notes |
|---|---|
| `categories` | Drives the **Type** filter chips. Give them readable names via `categoryLabels` (below), otherwise the slug gets title-cased. A legacy single `category` string still works. |
| `technologies` | Drives the **Tech** filter chips *and* search. The chips are ranked by how often a technology appears. |
| `slug` | Optional — the shareable `#project/<slug>` link. Derived from the title when omitted, so only set it if you want a shorter URL. |
| `imgBg` | **Card** background only — the detail panel reads `media`. Accepts a repo path, a Google Drive share link, or any `https://` image URL. **Leave it empty to let the gallery supply the card image** (see *Which image becomes the card* below). |
| `media` | The gallery in the detail panel — see below. |
| `year` | Optional. **The "Newest" sort option only appears once at least one project has a year** — otherwise it would silently duplicate "Featured". |
| `featured` | `true` floats it to the top under the default sort. |
| `demoVideo` | YouTube, Vimeo, or a Google Drive share link — embedded automatically. Only used when `media` is empty; prefer `media` for anything new. |

### `projects[].media` — the gallery

Optional. Give a project a list of screenshots and clips and the detail panel
grows a thumbnail strip under the stage, with a count so a visitor can see how
much there is before clicking. **Videos are always listed before images**,
keeping the order you wrote inside each group. One item renders as a plain
cover with no strip, which is what every project without `media` gets.

```json
"media": [
  { "type": "video", "src": "https://youtu.be/XXXXXXXXXXX", "caption": "Walkthrough" },
  { "type": "video", "src": "https://drive.google.com/file/d/<ID>/view" },
  { "type": "video", "src": "data/src/vids/demo.mp4", "poster": "data/src/imgs/projects/x/poster.png" },
  { "type": "image", "src": "data/src/imgs/projects/x/shot-1.png", "caption": "Admin console" },
  { "type": "image", "src": "https://drive.google.com/file/d/<ID>/view" }
]
```

| Field | Notes |
|---|---|
| `src` | Required. A repo-relative path, or an `https://` URL. Anything with another scheme (`javascript:`, `data:`) is dropped. A bare string entry is treated as `{ "src": … }`. |
| `type` | `"video"` or `"image"`. Optional — a file extension or a known video host decides it. **A Google Drive link can be either, so an undeclared one is treated as a video; set `"type": "image"` for Drive screenshots.** |
| `caption` | Optional. Shows under the stage, labels the thumbnail, and is searchable. |
| `poster` | Optional thumbnail override. YouTube and Drive posters are derived automatically; a repo video file has none, so give it one or the strip shows a play icon. |
| `cover` | `true` on one **image** pins it as the project's card background. Ignored on videos — a card needs a bitmap. |

#### Which image becomes the card

Highest wins:

```
imgBg  →  media item with "cover": true  →  first image in media  →  the `image` icon
```

So a project with a single screenshot needs no configuration at all: clear its
`imgBg` and that shot becomes the card. Use `"cover": true` when a gallery has
several stills and you want a specific one on the card regardless of how you
reorder the array later.

Drive images are fetched at `w640` for the card and `w1600` for the panel stage,
so a card doesn't pull a 600 KB screenshot to render it 640 px wide. The card and
the strip thumbnail share the same URL, and therefore one request.

Sources that work:

- **Repo files** — `data/src/imgs/…` for stills, `data/src/vids/….mp4` for clips. Committed video ships in the repo, so keep it small; there's no LFS here.
- **YouTube** — any `youtu.be`, `watch?v=`, `/shorts/` or `/embed/` link.
- **Google Drive** — the ordinary `…/file/d/<ID>/view` share link. **Set the file to "Anyone with the link — Viewer" first**, or visitors get a sign-in wall instead of the video and the thumbnail won't load.
- **Vimeo** — plays fine, but has no static thumbnail, so give it a `poster`.

## `categoryLabels`

Maps category slugs to display names, so filters read properly instead of
showing `BIGDATA`:

```json
{
  "categoryLabels": {
    "ai": "AI & Computer Vision",
    "bigdata": "Big Data",
    "web": "Web"
  }
}
```

## `contact`

```json
{ "type": "email", "value": "you@example.com", "label": "you@example.com",
  "icon": "fas fa-envelope", "link": "mailto:you@example.com" }
```

`mailto:` / `tel:` prefixes are added automatically for `email` and `phone`
types, so you can leave `link` out for those. Recognised types get a nicer
label: `email`, `phone`, `linkedin`, `github`, `leetcode`, `twitter`, `website`.

## Icons

Icons are inline SVG now — Font Awesome is gone. Your existing `"fas fa-…"`
values still work: they're mapped to the built-in set in
`assets/js/icons.js`. An unrecognised name falls back to a neutral glyph rather
than rendering nothing. To add a new one, add a path to `ICONS` and an entry to
`FA_ALIASES` in that file.

---

# Running it locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

A server is required — `fetch()` and ES modules don't work from `file://`.

Useful URLs while testing:

- `?q=spark&cat=bigdata` — search and filters are shareable and restore on load
- `#project/javadevllm` — opens that project's panel directly
- `?data=<url>` — render from a different JSON without deploying

Keyboard: `/` focuses search, `Esc` clears it or closes the panel, `←`/`→` move
between projects inside the panel.

---

# Project layout

```
index.html                  semantic shell — no content, no placeholders
data/portfolio.json         all content lives here
assets/css/
  fonts.css                 generated @font-face; regenerate, don't hand-edit
  tokens.css                colour/type/space tokens, both themes
  base.css                  reset, typography, layout primitives
  components.css            every component
assets/fonts/               self-hosted Newsreader + IBM Plex subsets
assets/js/
  config.js                 data source + GA id — the file you'd edit
  data-source.js            the fetch/fallback chain
  normalize.js              tolerant coercion of the JSON
  dom.js, icons.js          helpers
  theme.js nav.js reveal.js analytics.js
  sections/                 hero, ledger, skills, certifications, contact renderers
  projects/controller.js    search, filters, sort, URL state
  projects/viewer.js        the <dialog> detail panel
  main.js                   wiring
```
