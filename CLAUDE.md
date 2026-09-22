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
- **Domain/canonical URLs** in `robots.txt`, `sitemap.xml`, each page's
  `<link rel="canonical">` / JSON-LD `url` / `og:url` / `og:image` /
  `twitter:image`, and `contact.html`'s Formspree `_next` redirect value
  all point at `payoffsnowball.com` (migrated 2026-09-22 from
  `debtsnowballcalculator.metrickettster.workers.dev` — see the AdSense
  bullet below for why). Update all of them together if the deployment
  URL ever changes again.
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
- **AdSense loader script is on all 17 pages** (including `404.html`),
  first thing inside `<head>`: `https://pagead2.googlesyndication.com/
  pagead/js/adsbygoogle.js?client=ca-pub-1342212789565397`. It was
  originally added for AdSense's site-verification step while the site
  still lived at `debtsnowballcalculator.metrickettster.workers.dev` —
  Cloudflare's `workers.dev` is on the Public Suffix List, so AdSense
  treated the *account-level* domain (`metrickettster.workers.dev`) as
  "the site," not the project's actual subdomain, and nothing was
  served at that bare account root, which broke the ads.txt/meta-tag
  verification methods. The "AdSense code snippet on every page" method
  was chosen specifically because it doesn't require anything at that
  root. **This whole problem is now moot** — the site moved to its own
  domain (`payoffsnowball.com`, see the bullet above) specifically to
  fix it — once AdSense's site record is re-pointed at the new domain,
  verification works normally against the real root. The snippet stays
  on every page either way (that's
  normal AdSense integration, not a workaround), but don't resurrect the
  ads.txt/meta-tag concern above as a reason to change verification
  method — it no longer applies.
  CSP in `worker.js` was widened to match: `script-src` gained
  `https://*.googlesyndication.com`; new `frame-src` directive added
  (`https://*.googlesyndication.com https://*.doubleclick.net` — there
  was no `frame-src` before, so it silently fell back to `default-src
  'self'`, which would have blocked every Google ad iframe); `img-src`
  and `connect-src` gained the same two domains plus `*.gstatic.com`
  on `img-src`. This covers loading the script and (once ads actually
  render) the ad iframes/images/pings — it has NOT been verified live
  (no outbound network access from the dev sandbox), so check the
  browser console on the real deployed site once ads start serving,
  same as every other CSP change here.
  **When actually placing ad units** (as opposed to just Auto ads),
  prefer Auto ads or another approach that doesn't require a per-slot
  inline `<script>(adsbygoogle = window.adsbygoogle || []).push({});
  </script>` tag — `script-src` has no `'unsafe-inline'` and no nonce
  mechanism, by design, matching this site's no-inline-script rule
  everywhere else. Adding one inline snippet per manual ad slot would
  mean either breaking that rule or building CSP nonce generation into
  `worker.js` — don't do either without discussing it first.
- **IP protection pass (2026-09-22)**: every page's footer has a
  `&copy; 2026 Debt Snowball Calculator. All rights reserved.` line;
  `terms.html` got a new "Content and reuse" section explicitly
  prohibiting copying/republishing the site's text or code (linking to
  `LICENSE`, which already said this for the source specifically —
  this extends the same stance to the on-page content, which the
  LICENSE alone doesn't cover); `index.html`'s JSON-LD gained
  `copyrightYear`/`copyrightHolder`. Separately, Cloudflare's bot
  policy for this domain has AI-training crawlers set to Disallow
  (configured at the Cloudflare dashboard level, not in this repo —
  nothing to keep in sync here, just noting it exists). None of this
  is a substitute for actually registering a trademark if that's ever
  wanted — that's a paid, out-of-scope legal step, not something
  fixable by editing site files.
