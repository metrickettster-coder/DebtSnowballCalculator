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
- **Contact form submits directly to Formspree** (`contact.html`,
  endpoint `https://formspree.io/f/xjyvqjll`) via a plain HTML POST —
  no JS library, no bundler, so the CSP only needed one addition
  (`form-action` now allows `https://formspree.io` in `worker.js`).
  `contact-form.js` just reveals the `#contact-success` banner when
  Formspree's `_next` redirect brings the visitor back with `?sent=1`;
  it has no other role. This is the one exception to "nothing you type
  is sent anywhere," and `privacy-policy.html` discloses it — keep that
  disclosure in sync if the form ever changes (new fields, a different
  provider, etc.). The honeypot field (`_gotcha`) must keep the
  `.honeypot-field` class (CSS `display:none`, not an inline `style=`
  attribute — inline styles are blocked by the CSP's `style-src`).
