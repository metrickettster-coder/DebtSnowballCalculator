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
- **`ads.txt`** exists at the repo root: `google.com, pub-1342212789565397,
  DIRECT, f08c47fec0942fa0` — the standard IAB-spec line authorizing
  Google to sell ad inventory on this domain directly. `f08c47fec0942fa0`
  is Google's fixed TAG-ID, the same for every AdSense publisher, not
  secret to this account. Added once the AdSense dashboard's Sites list
  showed "Ads.txt status: Not found" for `payoffsnowball.com` — added
  now rather than waiting for full approval since the publisher ID
  (`pub-1342212789565397`) was already known from the loader script.
  Not excluded in `.assetsignore` (must stay published, same as
  `robots.txt`/`sitemap.xml`) and needs no CSP entry (a plain static
  text file, not a script/frame/fetch resource).
- **AdSense "Low value content" pass (2026-10-05)**: AdSense rejected the
  site with "Low value content". Response: (1) original research page
  `snowball-vs-avalanche-study.html` — 10,000 simulated profiles run on
  the real `simulate()` engine with a fixed seed (20261005); if the
  engine changes, re-run and update the numbers there, on `index.html`'s
  "what the numbers say" section + FAQ JSON-LD, and in
  `avalanche-vs-snowball.html`. (2) Every guide has a byline (pen name
  **M.T.**, linked to `about.html#author`), published/updated dates,
  Article JSON-LD, and a Sources section linking only to verified
  primary sources (CFPB, FTC, studentaid.gov, Federal Reserve, HBR).
  Bump "Updated" + `dateModified` + sitemap `<lastmod>` when a guide
  changes. (3) `about.html` gained author, editorial-standards, and
  funding sections — it previously said "doesn't run ads", which
  contradicted the AdSense script. (4) Footer line changed from "does
  not send data to any server" (untrue once AdSense loads) to "Your
  debt numbers stay on your device". (5) `index.html` got a
  crawlable how-to/assumptions/FAQ section below the calculator
  (`no-print`). (6) Fixed a factual error in `what-is-debt-snowball.html`
  (the $500 store card at 24% WAS the highest rate) and added a
  worked four-debt example with a month-by-month table — the numbers
  are engine output; keep them in sync. Author identity stays a pen
  name by the owner's choice; don't add the owner's full name.
- **"Your best next move" panel (2026-10-05)**: `#best-move` in
  `index.html`, rendered by `renderBestMove()` in `script.js`. All numbers
  come from `simulate()`. The minimums-only baseline (`minimumsOnly()`)
  deliberately runs each debt on its own so paid-off minimums do NOT roll
  forward — rollover is the plan's value, so including it would hide it.
  "Every extra $1 a month saves $X" = (plan interest − plan+$100 interest)
  ÷ 100. "Wait 6 months" = 6 months of minimums (`afterDelay()`), then the
  plan from those balances, ignoring lump sum/custom split/new charges.
  When the current plan never pays off, the table is hidden and only a
  "+$200 a month would finish in X" line shows (comparing against a
  50-year non-payoff produced absurd numbers). On phones the table stacks
  via `data-label` attributes; `.best-move-table` overrides the
  comparison table's 480px `min-width` there. Wording stays descriptive
  ("you keep", "less interest"), never advice.
- **Cache busting (2026-10-05)**: after the best-move upload, the owner's
  browser kept running the old `script.js`, so the panel never appeared.
  Fix: every page links `styles.css`, `theme.js`, `script.js`,
  `contact-form.js` with a `?v=` version (currently `20261008a`), and
  `worker.js` sends `Cache-Control: no-cache` on HTML responses. **Bump
  the `?v=` value on every page whenever any CSS/JS file changes**, or
  returning visitors may keep the old file.
- Best-move panel wording: rows say "Add $50 more a month / on top of
  your $X" when an extra payment is already set (the owner read "+$50" as
  ambiguous), and an order line names where the extra money goes.
- **Strategy explainer (2026-10-05)**: the slider label used to read
  "Snowball (39% snowball / 61% avalanche) vs Avalanche…" because the
  readout span sat inside the label — confusing. Now: a plain question
  label, end labels (Snowball / Avalanche with "quicker wins" / "least
  interest"), a separate "Your choice:" readout, a live
  `renderStrategyAdvice()` line comparing pure snowball vs avalanche for
  the user's own debts, and a `<details>` "Which one should I pick?" with
  links to the guide and the study.
- **Advanced options fix (2026-10-05)**: `.advanced-subfields` (grid) and
  `.custom-split-fields` (flex) overrode the `hidden` attribute, so every
  option's fields showed even when unticked — the owner thought they were
  live and expected them to react to the slider. Fixed with explicit
  `[hidden] { display: none; }` rules (same trap as `.contact-form`).
  Each option now has a one-line `.option-help`, the section has an
  intro saying the strategy decides which debt and these options don't
  change that, and the custom-split label/help says it overrides the
  strategy. Its explanatory hint (`#custom-split-hint`) only shows when
  ticked.
- **"What to pay each month" (2026-10-05)**: `#pay-plan`, rendered by
  `renderPayPlan()`. `simulate()` now records per-debt `paid` in each
  timeline snapshot (via `d.paidThisMonth`, reset each month and added at
  every place a payment is applied: minimums, `cascadePayment`,
  `applyCustomSplit`, lump-sum split). Phases start in month 1 and the
  month after each payoff; amounts are sampled from the phase's first
  month (skipping the lump-sum month when possible). If you add a new
  payment path to `simulate()`, also increment `d.paidThisMonth` there.
- **ROLLOVER BUG FIXED (2026-10-05)**: `simulate()` used to add a paid-off
  debt's minimum to the extra pool for ONE month only (`freedMinimums = 0`
  after each use), so the snowball never actually grew and every payoff
  date/interest figure was too pessimistic. Now `freedMinimums` persists
  (and is subtracted again if new charges re-open a paid-off debt, via
  `d.rolled`). The 10,000-plan study, the worked examples in
  `what-is-debt-snowball.html`, and the study numbers quoted on
  `index.html` (text + FAQ JSON-LD) and `avalanche-vs-snowball.html` were
  all re-run and updated. "Minimums only" figures are true per-debt
  minimums with no rollover (same as the panel's `minimumsOnly()`).
- Pay plan rows show "$X minimum + $Y extra" under each amount.
- Pay plan has a `<details>` "See every month until you're debt-free"
  table (`renderPaySchedule()`), one row per month from the timeline's
  per-debt `paid` values. The best-move order line breaks payoff-month
  ties by the strategy's first-month ranking.
- Each pay-plan phase after a payoff shows "Extra = your $X + $Y in minimums you no longer owe (…)" — the owner was confused where extra above her chosen amount came from. `simulate()` returns `extraPayment` for this.
- **Rollover toggle (2026-10-05)**: `advanced.rollover` (default true;
  checkbox `#rollover-enabled`, share-link param `noRoll=1` when off,
  old saved states without the field count as on). When off, paid-off
  minimums are NOT added to the extra pool; the pay plan shows "$X a month
  back in your budget" and `#pay-plan-rollnote` compares against rolling
  over. Any new simulate() call that builds its own `advanced` object
  should spread the user's `advanced` so `rollover` is preserved.
- **Google Search Console verification file**: `google0cb1719cc494d2b3.html`
  at the repo root (URL-prefix property `https://payoffsnowball.com/`).
  Google says to keep it forever or verification is lost — do not delete
  it or add it to `.assetsignore`.
- **Extensionless URLs (2026-10-05)**: Cloudflare Workers static assets
  (default `html_handling: auto-trailing-slash`) 307-redirect `/page.html`
  to `/page`. Google Search Console showed every `.html` URL as "unknown"
  while canonicals pointed at the redirecting `.html` address. All
  canonicals, `og:url`, JSON-LD urls, sitemap `<loc>`s and internal links
  now use the extensionless form (`/about`, `/what-is-debt-snowball`,
  homepage `/`). New pages must follow this — never link or canonicalize
  `something.html`. (The Google verification file is the one exception;
  leave it as is.) Local `python -m http.server` won't resolve these
  links; test with `npx wrangler dev` instead.
- `guides.html` has a "Free tools we trust" section (#free-tools): AnnualCreditReport.com, Credit Karma, NFCC, CFPB, Federal Student Aid. Not affiliate links; keep the "not paid or affiliated" line true.
- **CSP widened for AdSense + consent (2026-10-07)**: `worker.js` now also
  allows `*.google.com`, `*.gstatic.com`, `*.adtrafficquality.google` and
  `fundingchoicesmessages.google.com` (Google's consent message) across
  script/img/connect/frame, and `style-src` gained `'unsafe-inline'` because
  Auto ads set inline styles. Scripts stay strict (no inline scripts).
  Google officially supports only nonce-based strict CSP for its ad tags;
  if ads or the consent banner still fail in the live browser console,
  the next step is nonces in `worker.js` (discuss first).
- **Three guides added (2026-10-07)**: `how-long-to-pay-off-10000-credit-card-debt`,
  `debt-snowball-with-car-loan`, `debt-snowball-spreadsheet-vs-calculator`.
  All numbers are `simulate()` output (fixed payments, default advanced
  options; rollover off only where stated). Re-run if the engine changes.
- **Marketing batch 1 (2026-10-08)**: every Article page (all guides + the
  study) now has a second JSON-LD block, `BreadcrumbList` (Home > Guides >
  page, name = the Article `headline`); new guides must add one too.
  `index.html` already had the `WebApplication` block (price 0, no ratings),
  so it was left as is. The study page gained a "Cite this study" box
  (`.cite-box`, plain link + one-sentence summary using only numbers already
  on that page; no JS). If the study numbers change, update that sentence
  too. Two guides added: `how-long-to-pay-off-5000-credit-card-debt` and
  `how-long-to-pay-off-20000-credit-card-debt` (same structure as the $10k
  guide, cross-linked with it). Their numbers are `simulate()` output for one
  card at 22% (plus 18%/29% rows) with `minPayment` = the fixed payment,
  extra 0, default advanced options; re-run if the engine changes. `?v=` bumped
  to `20261008a` for the new CSS. Known leftover: 8 older guides still carry an
  earlier Article JSON-LD block (author = Organization, no dates) above the
  current M.T. one; it was left in place pending a decision.
- **Marketing batch 1 (2026-10-08)**: BreadcrumbList JSON-LD (Home > Guides > page)
  on every guide and the study; "Cite this study" box (`.cite-box`) on the study
  page, using only numbers already on that page (update it if the study is
  re-run); new guides `how-long-to-pay-off-5000-credit-card-debt` and
  `how-long-to-pay-off-20000-credit-card-debt` (all numbers `simulate()` output,
  same method as the $10k guide). Cache-bust version is now `20261008a`.
  Plan: Enterprise-Triad-Framework `outbox/2026-10-08_snowball-marketing-plan.md`.
