# Debt Snowball Calculator

A free, private debt payoff calculator. Enter your debts, choose a strategy, and see your debt-free date update instantly.

- **Multiple debts** — add as many as you need (name, balance, interest rate, minimum payment).
- **Snowball, avalanche, or a blend** — a slider moves between paying off the smallest balance first (snowball) and the highest interest rate first (avalanche).
- **Live results** — total debt, projected debt-free date, time to pay off, and total interest paid, all recalculated as you type.
- **Payoff timeline chart** and a per-debt payoff order with progress bars.
- **Side-by-side comparison table** — snowball, your blend, and avalanche, each with debt-free date, total interest, and total paid.
- **Share via URL** — encodes your debts and strategy into a link you can copy and send.
- **CSV export** of the full month-by-month payoff timeline.
- **Print view** — a print stylesheet that hides the input forms and shows just the plan.
- **Warns** if a debt's minimum payment doesn't even cover its monthly interest.
- **Advanced options** — model a one-time lump-sum payment (applied to the highest-priority debt or split proportionally), ongoing new charges added to a chosen debt, or a custom fixed-dollar split of the extra payment across whichever debts remain once the others are paid off (e.g. "pay off the credit card first, then $500 to the car loan and $700 to the mortgage every month").
- **Light and dark themes** — a toggle in the nav overrides the OS preference and remembers your choice.
- **Responsive** — usable on phones, tablets, and desktops; the debt table, comparison table, and advanced options all adapt to screen width.
- **No sign-up, no server** — everything runs client-side in plain HTML/CSS/JS; your numbers are only saved to your own browser's local storage (or encoded in a share link you choose to send).

Also includes four supporting content pages (`what-is-debt-snowball.html`, `avalanche-vs-snowball.html`, `minimum-payment-trap.html`, `debt-free-date.html`) and the standard static-site SEO files (`robots.txt`, `sitemap.xml`, `_headers`, `favicon.svg`). The sitemap and canonical URLs point at `debtsnowballcalculator.metrickettster.workers.dev` — update them if you deploy elsewhere.

## Running it

It's a static site with no build step. Open `index.html` directly in a browser, or serve the folder with any static file server, e.g.:

```
python3 -m http.server
```
