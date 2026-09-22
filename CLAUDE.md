# Project notes for Claude

Static site, no build step. See README.md for the feature list.

## Safeguards to keep in place

- **No fabricated trust signals.** Don't add fake reviews, star ratings
  (`aggregateRating` in schema.org markup or elsewhere), testimonials, or
  usage numbers. Deliberately left out of the JSON-LD on every page.
- **Privacy policy stays accurate.** `privacy-policy.html` describes what
  actually happens (localStorage only, no server, third-party scripts in
  use). Update it the moment any tracking, analytics, or ads are added —
  don't let it go stale.
- **Cookie/consent notice** — not needed today (no cookies are set). Add
  one before turning on AdSense or any analytics, since AdSense's EU User
  Consent Policy requires it.
- **Domain/canonical URLs** in `robots.txt`, `sitemap.xml`, and each
  page's `<link rel="canonical">` / JSON-LD `url` point at
  `debtsnowballcalculator.metrickettster.workers.dev`. Update all of them
  together if the deployment URL changes (e.g. moving to a custom domain
  or Cloudflare Pages).
- **`.assetsignore`** excludes `.git`, `.wrangler`, `README.md`,
  `CLAUDE.md`, `package.json`, `wrangler.jsonc`, and `worker.js` from
  the Workers static-asset upload. Keep this in sync if new non-site
  files are added to the repo root — anything not excluded gets
  published as a public file.
- **Four required pages**: `privacy-policy.html`, `about.html`,
  `contact.html`, `terms.html` all exist and are linked from nav,
  footer, and `sitemap.xml` on every page (plus `404.html`, linked but
  intentionally excluded from the sitemap). This is a standing
  requirement for all projects (see the global CLAUDE.md).
- **Nav/footer is shared and deliberately short**: Calculator, Guides,
  About, Contact, Terms, Privacy Policy — six links, identical on every
  page. It used to list every content page individually; that stopped
  scaling once there were more than four. A new educational content
  page does NOT get its own nav/footer entry — add it to `guides.html`
  (title + one-line description) and to `sitemap.xml` instead, and
  cross-link it contextually from 1–2 related articles' body text.
- **Security headers ship via `worker.js`, not `_headers`.** Cloudflare
  Workers static assets ignore `_headers` (that's Pages-only); this
  deployment uses `wrangler.jsonc`'s `main: worker.js` to wrap
  `env.ASSETS.fetch` and attach headers, including a real CSP
  (`script-src 'self' https://cdn.jsdelivr.net` for Chart.js). If you
  add a new external script/style/font source, you must also add it to
  the CSP in `worker.js` or it will be silently blocked in production —
  this can't be caught by `wrangler deploy --dry-run`, only by loading
  the real deployed site and checking the browser console. `_headers`
  is kept only as a fallback for a possible future move to Pages.
- **Debt identity, not array position.** Each debt row gets a stable
  `dataset.debtId` (assigned once, in `addDebtRow`) used to keep
  "new charges" target and "custom split" amounts attached to the
  correct debt when debts are added/removed/reordered. Don't revert to
  matching by raw array index in `populateNewChargesTarget` /
  `populateCustomSplitFields` — that previously caused amounts to
  silently reattach to the wrong debt.
- **CSV export escaping covers two different risks**, both in
  `csvEscape()`: standard CSV quoting (commas/quotes/newlines) AND
  formula-injection neutralization (a debt name starting with
  `=`/`+`/`-`/`@` gets an apostrophe prefix so Excel/Sheets can't
  execute it as a formula). Keep both when touching that function.
- **Contact form submits to Formspree via fetch, not a plain POST.**
  The plain-HTML-POST-with-`_next`-redirect version caused a real,
  reported UX bug (the page navigating away and effectively "closing"
  instead of coming back) — likely Formspree's first-submission
  confirmation flow or a `_next` domain-allowlist issue, but the exact
  cause doesn't matter: the fix is that `contact-form.js` now
  intercepts the form's `submit` event, does its own `fetch()` POST
  with `Accept: application/json`, and shows success/error in place —
  the page never navigates away at all. The `action`/`method`/`_next`
  attributes stay on the `<form>` as a no-JS fallback only. This is why
  `worker.js`'s CSP needs `connect-src` to include
  `https://formspree.io` in addition to the `form-action` addition.
  `.contact-form[hidden] { display: none; }` exists because the class
  sets `display: flex`, which — being an author-stylesheet rule —
  overrides the browser's default `[hidden]` behavior; without it,
  hiding the form via `form.hidden = true` silently does nothing.
  The honeypot field (`_gotcha`) must keep the `.honeypot-field` class
  (CSS `display:none`, not an inline `style=` attribute — inline
  styles are blocked by the CSP's `style-src`). This is the one
  exception to "nothing you type is sent anywhere," and
  `privacy-policy.html` discloses it — keep that disclosure in sync if
  the form ever changes (new fields, a different provider, etc.).
- **Theme defaults to light, always — it does not follow
  `prefers-color-scheme`.** A first-time visitor sees light regardless
  of OS/browser dark-mode settings; dark only applies once someone
  explicitly clicks the toggle (then persists via localStorage). This
  was a deliberate reversal of the original behavior (which followed
  the OS setting) per explicit request. `theme.js` always sets
  `data-theme="light"` or `"dark"` on `<html>` — never leaves it unset
  — and `styles.css` has no `@media (prefers-color-scheme: dark)`
  block anymore. Don't reintroduce one without being asked to.
- **`og-image.png`** is a real generated asset (not a placeholder/fake
  screenshot) — a plain 1200×630 branded card built from the site's own
  color tokens, referenced via `og:image`/`twitter:image` on all 16
  indexable pages (`twitter:card` is `summary_large_image`). It's a
  public site asset, so it must NOT be added to `.assetsignore`. If the
  brand colors in `styles.css` `:root` ever change meaningfully,
  regenerate it to match (script: ask Claude to recreate via Pillow —
  no source `.py` is kept in the repo since there's no build step).
  `index.html` was also missing `<link rel="canonical">` entirely until
  this pass — it's fixed now, but re-check new pages for it since
  nothing enforces it automatically.
