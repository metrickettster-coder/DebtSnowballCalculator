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
- **`.assetsignore`** excludes `.git`, `README.md`, `CLAUDE.md`,
  `package.json`, and `wrangler.jsonc` from the Workers static-asset
  upload. Keep this in sync if new non-site files are added to the repo
  root — anything not excluded gets published as a public file.
