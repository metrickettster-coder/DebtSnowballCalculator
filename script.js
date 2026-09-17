const STORAGE_KEY = "debt-snowball-calculator-state";
const MAX_MONTHS = 600;

const debtRowsEl = document.getElementById("debt-rows");
const rowTemplate = document.getElementById("debt-row-template");
const addDebtBtn = document.getElementById("add-debt");
const extraPaymentEl = document.getElementById("extra-payment");
const strategySliderEl = document.getElementById("strategy-slider");
const strategyReadoutEl = document.getElementById("strategy-readout");
const warningEl = document.getElementById("warning");
const totalDebtEl = document.getElementById("total-debt");
const payoffDateEl = document.getElementById("payoff-date");
const payoffTimeEl = document.getElementById("payoff-time");
const totalInterestEl = document.getElementById("total-interest");
const payoffOrderEl = document.getElementById("payoff-order");
const shareBtn = document.getElementById("share-btn");
const exportCsvBtn = document.getElementById("export-csv-btn");
const printBtn = document.getElementById("print-btn");
const shareFeedbackEl = document.getElementById("share-feedback");

let chart = null;
let lastResult = null;

function currency(value) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function addDebtRow(debt = {}) {
  const fragment = rowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".debt-row");
  row.querySelector(".debt-name").value = debt.name ?? "";
  row.querySelector(".debt-balance").value = debt.balance ?? "";
  row.querySelector(".debt-rate").value = debt.rate ?? "";
  row.querySelector(".debt-min-payment").value = debt.minPayment ?? "";

  row.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", scheduleUpdate);
  });
  row.querySelector(".btn-remove").addEventListener("click", () => {
    row.remove();
    scheduleUpdate();
  });

  debtRowsEl.appendChild(row);
}

function readDebts() {
  return Array.from(debtRowsEl.querySelectorAll(".debt-row")).map((row, index) => ({
    name: row.querySelector(".debt-name").value.trim() || `Debt ${index + 1}`,
    balance: Number(row.querySelector(".debt-balance").value) || 0,
    rate: Number(row.querySelector(".debt-rate").value) || 0,
    minPayment: Number(row.querySelector(".debt-min-payment").value) || 0,
  })).filter((d) => d.balance > 0);
}

function snapshotTimeline(debts, month) {
  return {
    month,
    total: debts.reduce((sum, d) => sum + Math.max(d.remaining, 0), 0),
    byDebt: debts.map((d) => ({ name: d.name, remaining: Math.max(d.remaining, 0) })),
  };
}

function simulate(inputDebts, extraPayment, blend) {
  const debts = inputDebts.map((d) => ({ ...d, remaining: d.balance, payoffMonth: null, interestPaid: 0 }));
  const timeline = [snapshotTimeline(debts, 0)];

  let month = 0;
  let freedMinimums = 0;
  let totalInterest = 0;

  while (debts.some((d) => d.remaining > 0.5) && month < MAX_MONTHS) {
    month++;

    debts.forEach((d) => {
      if (d.remaining > 0.5) {
        const interest = d.remaining * (d.rate / 100 / 12);
        d.remaining += interest;
        d.interestPaid += interest;
        totalInterest += interest;
      }
    });

    debts.forEach((d) => {
      if (d.remaining > 0.5) {
        const pay = Math.min(d.minPayment, d.remaining);
        d.remaining -= pay;
      }
    });

    const active = debts.filter((d) => d.remaining > 0.5);
    let pool = extraPayment + freedMinimums;
    freedMinimums = 0;

    if (active.length > 0 && pool > 0) {
      const maxBalance = Math.max(...active.map((d) => d.remaining), 1);
      const maxRate = Math.max(...active.map((d) => d.rate), 0.0001);
      const blendFactor = blend / 100;

      const ranked = [...active].sort((a, b) => {
        const scoreA = (1 - blendFactor) * (1 - a.remaining / maxBalance) + blendFactor * (a.rate / maxRate);
        const scoreB = (1 - blendFactor) * (1 - b.remaining / maxBalance) + blendFactor * (b.rate / maxRate);
        return scoreB - scoreA;
      });

      for (const d of ranked) {
        if (pool <= 0) break;
        const pay = Math.min(pool, d.remaining);
        d.remaining -= pay;
        pool -= pay;
      }
    }

    debts.forEach((d) => {
      if (d.payoffMonth === null && d.remaining <= 0.5) {
        d.payoffMonth = month;
        freedMinimums += d.minPayment;
      }
    });

    timeline.push(snapshotTimeline(debts, month));
  }

  return {
    debts,
    timeline,
    totalInterest,
    months: month,
    payoffReached: !debts.some((d) => d.remaining > 0.5),
  };
}

function monthsFromNow(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDuration(months) {
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} yr${years !== 1 ? "s" : ""}`);
  if (remMonths > 0 || years === 0) parts.push(`${remMonths} mo${remMonths !== 1 ? "s" : ""}`);
  return parts.join(" ");
}

function renderWarning(debts) {
  const stuck = debts.filter((d) => d.balance > 0 && d.minPayment <= d.balance * (d.rate / 100 / 12));
  if (stuck.length === 0) {
    warningEl.hidden = true;
    return;
  }
  warningEl.hidden = false;
  warningEl.textContent = `${stuck.map((d) => d.name).join(", ")}: the minimum payment doesn't cover the monthly interest, so this debt will never be paid off at that rate. Increase the minimum payment or extra payment.`;
}

function renderChart(timeline) {
  if (typeof Chart === "undefined") return;

  const ctx = document.getElementById("payoff-chart");
  const labels = timeline.map((point) => point.month);
  const data = timeline.map((point) => Math.round(point.total));

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
    return;
  }

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Remaining balance",
        data,
        borderColor: "#0d9488",
        backgroundColor: "rgba(13, 148, 136, 0.15)",
        fill: true,
        tension: 0.2,
        pointRadius: 0,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: "Months from now" } },
        y: { title: { display: true, text: "Remaining balance ($)" }, beginAtZero: true },
      },
    },
  });
}

function renderPayoffOrder(debts) {
  payoffOrderEl.innerHTML = "";
  const ordered = [...debts].sort((a, b) => (a.payoffMonth ?? Infinity) - (b.payoffMonth ?? Infinity));

  ordered.forEach((d) => {
    const li = document.createElement("li");
    const pct = d.balance > 0 ? Math.min(100, Math.round(((d.balance - Math.max(d.remaining, 0)) / d.balance) * 100)) : 0;

    li.innerHTML = `
      <div class="debt-line">
        <span>${d.name}</span>
        <span>${d.payoffMonth ? `Paid off ${monthsFromNow(d.payoffMonth)}` : "Not paid off within 50 years"}</span>
      </div>
      <div class="debt-meta">${currency(d.balance)} balance &middot; ${d.rate}% APR &middot; ${currency(d.interestPaid)} interest paid</div>
      <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
    `;
    payoffOrderEl.appendChild(li);
  });
}

function totalPaid(debts, result) {
  const principal = debts.reduce((sum, d) => sum + d.balance, 0);
  return principal + result.totalInterest;
}

function renderComparisonColumn(prefix, debts, extraPayment, blend) {
  const result = simulate(debts, extraPayment, blend);
  document.getElementById(`cmp-${prefix}-date`).textContent = result.payoffReached ? monthsFromNow(result.months) : "50+ years";
  document.getElementById(`cmp-${prefix}-interest`).textContent = currency(result.totalInterest);
  document.getElementById(`cmp-${prefix}-total`).textContent = currency(totalPaid(debts, result));
  return result;
}

function renderComparison(debts, extraPayment, blend) {
  renderComparisonColumn("snowball", debts, extraPayment, 0);
  renderComparisonColumn("blend", debts, extraPayment, blend);
  renderComparisonColumn("avalanche", debts, extraPayment, 100);
}

function clearComparison() {
  ["snowball", "blend", "avalanche"].forEach((prefix) => {
    document.getElementById(`cmp-${prefix}-date`).textContent = "—";
    document.getElementById(`cmp-${prefix}-interest`).textContent = "—";
    document.getElementById(`cmp-${prefix}-total`).textContent = "—";
  });
}

function csvEscape(value) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function exportCsv() {
  if (!lastResult || lastResult.timeline.length === 0) return;

  const debtNames = lastResult.timeline[0].byDebt.map((d) => d.name);
  const header = ["Month", "Total remaining", ...debtNames].map(csvEscape).join(",");
  const rows = lastResult.timeline.map((point) => [
    point.month,
    point.total.toFixed(2),
    ...point.byDebt.map((d) => d.remaining.toFixed(2)),
  ].map(csvEscape).join(","));

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "debt-payoff-plan.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function buildShareUrl(debts, extraPayment, blend) {
  const params = new URLSearchParams();
  params.set("debts", debts.map((d) => [d.name, d.balance, d.rate, d.minPayment].map(encodeURIComponent).join(":")).join(","));
  params.set("extra", extraPayment);
  params.set("blend", blend);
  return `${location.origin}${location.pathname}?${params.toString()}`;
}

function parseShareUrl() {
  const params = new URLSearchParams(location.search);
  if (!params.has("debts")) return null;

  const debts = params.get("debts").split(",").filter(Boolean).map((chunk) => {
    const [name, balance, rate, minPayment] = chunk.split(":").map(decodeURIComponent);
    return { name, balance: Number(balance) || 0, rate: Number(rate) || 0, minPayment: Number(minPayment) || 0 };
  }).filter((d) => d.balance > 0);

  if (debts.length === 0) return null;

  return {
    debts,
    extraPayment: Number(params.get("extra")) || 0,
    blend: Number(params.get("blend")) || 0,
  };
}

async function shareCurrentPlan() {
  const debts = readDebts();
  if (debts.length === 0) return;

  const url = buildShareUrl(debts, Math.max(0, Number(extraPaymentEl.value) || 0), Number(strategySliderEl.value));

  try {
    await navigator.clipboard.writeText(url);
    shareFeedbackEl.textContent = "Link copied!";
  } catch (e) {
    shareFeedbackEl.textContent = url;
  }
  shareFeedbackEl.hidden = false;
  clearTimeout(shareFeedbackEl._hideHandle);
  shareFeedbackEl._hideHandle = setTimeout(() => { shareFeedbackEl.hidden = true; }, 4000);
}

function update() {
  const debts = readDebts();
  const extraPayment = Math.max(0, Number(extraPaymentEl.value) || 0);
  const blend = Number(strategySliderEl.value);

  strategyReadoutEl.textContent = blend === 0
    ? "(smallest balance first)"
    : blend === 100
      ? ""
      : `(${100 - blend}% snowball / ${blend}% avalanche)`;

  renderWarning(debts);

  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
  totalDebtEl.textContent = currency(totalDebt);

  if (debts.length === 0) {
    payoffDateEl.textContent = "—";
    payoffTimeEl.textContent = "—";
    totalInterestEl.textContent = currency(0);
    payoffOrderEl.innerHTML = "";
    renderChart([{ month: 0, total: 0, byDebt: [] }]);
    clearComparison();
    lastResult = null;
    saveState(debts, extraPayment, blend);
    return;
  }

  const result = simulate(debts, extraPayment, blend);
  lastResult = result;

  payoffDateEl.textContent = result.payoffReached ? monthsFromNow(result.months) : "50+ years";
  payoffTimeEl.textContent = result.payoffReached ? formatDuration(result.months) : `${MAX_MONTHS}+ months`;
  totalInterestEl.textContent = currency(result.totalInterest);

  renderChart(result.timeline);
  renderPayoffOrder(result.debts);
  renderComparison(debts, extraPayment, blend);
  saveState(debts, extraPayment, blend);
}

let updateHandle = null;
function scheduleUpdate() {
  clearTimeout(updateHandle);
  updateHandle = setTimeout(update, 120);
}

function saveState(debts, extraPayment, blend) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ debts, extraPayment, blend }));
  } catch (e) {
    // localStorage unavailable (private browsing, quota) — nothing to persist against
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function init() {
  const shared = parseShareUrl();
  const saved = shared ?? loadState();

  if (saved && Array.isArray(saved.debts) && saved.debts.length > 0) {
    saved.debts.forEach(addDebtRow);
    extraPaymentEl.value = saved.extraPayment ?? 100;
    strategySliderEl.value = saved.blend ?? 0;
  } else {
    addDebtRow({ name: "Credit Card", balance: 4000, rate: 22, minPayment: 100 });
    addDebtRow({ name: "Car Loan", balance: 12000, rate: 6.5, minPayment: 250 });
  }

  addDebtBtn.addEventListener("click", () => {
    addDebtRow();
    scheduleUpdate();
  });
  extraPaymentEl.addEventListener("input", scheduleUpdate);
  strategySliderEl.addEventListener("input", scheduleUpdate);
  shareBtn.addEventListener("click", shareCurrentPlan);
  exportCsvBtn.addEventListener("click", exportCsv);
  printBtn.addEventListener("click", () => window.print());

  update();
}

init();
