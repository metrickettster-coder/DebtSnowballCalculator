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
const lumpSumEnabledEl = document.getElementById("lump-sum-enabled");
const lumpSumFieldsEl = document.getElementById("lump-sum-fields");
const lumpSumAmountEl = document.getElementById("lump-sum-amount");
const lumpSumMonthEl = document.getElementById("lump-sum-month");
const lumpSumModeEl = document.getElementById("lump-sum-mode");
const newChargesEnabledEl = document.getElementById("new-charges-enabled");
const newChargesFieldsEl = document.getElementById("new-charges-fields");
const newChargesAmountEl = document.getElementById("new-charges-amount");
const newChargesTargetEl = document.getElementById("new-charges-target");
const customSplitEnabledEl = document.getElementById("custom-split-enabled");
const customSplitFieldsEl = document.getElementById("custom-split-fields");

let chart = null;
let lastResult = null;

function currency(value) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
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

function rankByPriority(active, blend) {
  const maxBalance = Math.max(...active.map((d) => d.remaining), 1);
  const maxRate = Math.max(...active.map((d) => d.rate), 0.0001);
  const blendFactor = blend / 100;

  return [...active].sort((a, b) => {
    const scoreA = (1 - blendFactor) * (1 - a.remaining / maxBalance) + blendFactor * (a.rate / maxRate);
    const scoreB = (1 - blendFactor) * (1 - b.remaining / maxBalance) + blendFactor * (b.rate / maxRate);
    return scoreB - scoreA;
  });
}

function cascadePayment(ranked, amount) {
  let pool = amount;
  for (const d of ranked) {
    if (pool <= 0) break;
    const pay = Math.min(pool, d.remaining);
    d.remaining -= pay;
    pool -= pay;
  }
  return pool;
}

function applyCustomSplit(activeDebts, pool, blend) {
  const totalAssigned = activeDebts.reduce((sum, d) => sum + d.customAmount, 0);
  if (totalAssigned <= 0) {
    cascadePayment(rankByPriority(activeDebts, blend), pool);
    return;
  }

  const scale = Math.min(pool / totalAssigned, 1);
  let leftover = pool > totalAssigned ? pool - totalAssigned : 0;

  activeDebts.forEach((d) => {
    const share = d.customAmount * scale;
    const pay = Math.min(share, d.remaining);
    d.remaining -= pay;
    leftover += share - pay;
  });

  if (leftover > 0.01) {
    const stillActive = activeDebts.filter((d) => d.remaining > 0.5);
    if (stillActive.length > 0) {
      cascadePayment(rankByPriority(stillActive, blend), leftover);
    }
  }
}

const DEFAULT_ADVANCED = {
  lumpSum: { enabled: false, amount: 0, month: 1, mode: "priority" },
  newCharges: { enabled: false, amount: 0, targetIndex: -1 },
  customSplit: { enabled: false, amounts: [] },
};

function simulate(inputDebts, extraPayment, blend, advanced = DEFAULT_ADVANCED) {
  const lumpSum = advanced.lumpSum ?? DEFAULT_ADVANCED.lumpSum;
  const newCharges = advanced.newCharges ?? DEFAULT_ADVANCED.newCharges;
  const customSplit = advanced.customSplit ?? DEFAULT_ADVANCED.customSplit;

  const debts = inputDebts.map((d, i) => ({
    ...d,
    remaining: d.balance,
    payoffMonth: null,
    interestPaid: 0,
    customAmount: customSplit.enabled ? Math.max(0, Number(customSplit.amounts[i]) || 0) : 0,
  }));
  const timeline = [snapshotTimeline(debts, 0)];

  let month = 0;
  let freedMinimums = 0;
  let totalInterest = 0;

  while (debts.some((d) => d.remaining > 0.5) && month < MAX_MONTHS) {
    month++;

    if (newCharges.enabled && debts[newCharges.targetIndex]) {
      const target = debts[newCharges.targetIndex];
      target.remaining += newCharges.amount;
      if (target.payoffMonth !== null && target.remaining > 0.5) {
        target.payoffMonth = null;
      }
    }

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
      const allActiveAreSplitAssigned = customSplit.enabled && active.every((d) => d.customAmount > 0);
      if (allActiveAreSplitAssigned) {
        applyCustomSplit(active, pool, blend);
      } else {
        cascadePayment(rankByPriority(active, blend), pool);
      }
    }

    if (lumpSum.enabled && month === lumpSum.month && lumpSum.amount > 0) {
      const activeNow = debts.filter((d) => d.remaining > 0.5);

      if (activeNow.length > 0) {
        if (lumpSum.mode === "split") {
          const totalRemaining = activeNow.reduce((sum, d) => sum + d.remaining, 0);
          let leftover = 0;
          activeNow.forEach((d) => {
            const share = lumpSum.amount * (d.remaining / totalRemaining);
            const pay = Math.min(share, d.remaining);
            d.remaining -= pay;
            leftover += share - pay;
          });
          if (leftover > 0.01) {
            cascadePayment(rankByPriority(debts.filter((d) => d.remaining > 0.5), blend), leftover);
          }
        } else {
          cascadePayment(rankByPriority(activeNow, blend), lumpSum.amount);
        }
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
        <span>${escapeHtml(d.name)}</span>
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

function renderComparisonColumn(prefix, debts, extraPayment, blend, advanced) {
  const result = simulate(debts, extraPayment, blend, advanced);
  document.getElementById(`cmp-${prefix}-date`).textContent = result.payoffReached ? monthsFromNow(result.months) : "50+ years";
  document.getElementById(`cmp-${prefix}-interest`).textContent = currency(result.totalInterest);
  document.getElementById(`cmp-${prefix}-total`).textContent = currency(totalPaid(debts, result));
  return result;
}

function renderComparison(debts, extraPayment, blend, advanced) {
  renderComparisonColumn("snowball", debts, extraPayment, 0, advanced);
  renderComparisonColumn("blend", debts, extraPayment, blend, advanced);
  renderComparisonColumn("avalanche", debts, extraPayment, 100, advanced);
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

function buildShareUrl(debts, extraPayment, blend, advanced) {
  const params = new URLSearchParams();
  params.set("debts", debts.map((d) => [d.name, d.balance, d.rate, d.minPayment].map(encodeURIComponent).join(":")).join(","));
  params.set("extra", extraPayment);
  params.set("blend", blend);

  if (advanced.lumpSum.enabled) {
    params.set("lsAmt", advanced.lumpSum.amount);
    params.set("lsMonth", advanced.lumpSum.month);
    params.set("lsMode", advanced.lumpSum.mode);
  }
  if (advanced.newCharges.enabled) {
    params.set("ncAmt", advanced.newCharges.amount);
    params.set("ncTarget", advanced.newCharges.targetIndex);
  }
  if (advanced.customSplit.enabled) {
    params.set("csAmt", advanced.customSplit.amounts.map((a) => a || 0).join(":"));
  }

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

  const advanced = {
    lumpSum: {
      enabled: params.has("lsAmt"),
      amount: Number(params.get("lsAmt")) || 0,
      month: Number(params.get("lsMonth")) || 1,
      mode: params.get("lsMode") === "split" ? "split" : "priority",
    },
    newCharges: {
      enabled: params.has("ncAmt"),
      amount: Number(params.get("ncAmt")) || 0,
      targetIndex: Number(params.get("ncTarget")) || 0,
    },
    customSplit: {
      enabled: params.has("csAmt"),
      amounts: params.has("csAmt") ? params.get("csAmt").split(":").map((v) => Number(v) || 0) : [],
    },
  };

  return {
    debts,
    extraPayment: Number(params.get("extra")) || 0,
    blend: Number(params.get("blend")) || 0,
    advanced,
  };
}

async function shareCurrentPlan() {
  const debts = readDebts();
  if (debts.length === 0) return;

  const url = buildShareUrl(debts, Math.max(0, Number(extraPaymentEl.value) || 0), Number(strategySliderEl.value), readAdvancedOptions());

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

function populateNewChargesTarget(debts) {
  const previousValue = newChargesTargetEl.value;
  newChargesTargetEl.innerHTML = "";
  debts.forEach((d, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = d.name;
    newChargesTargetEl.appendChild(opt);
  });
  if (previousValue !== "" && Number(previousValue) < debts.length) {
    newChargesTargetEl.value = previousValue;
  }
}

function populateCustomSplitFields(debts) {
  const signature = debts.map((d) => d.name).join("|");
  if (signature === customSplitFieldsEl.dataset.signature) return;
  customSplitFieldsEl.dataset.signature = signature;

  const previousValues = {};
  customSplitFieldsEl.querySelectorAll(".custom-split-amount").forEach((input) => {
    previousValues[input.dataset.index] = input.value;
  });

  customSplitFieldsEl.innerHTML = "";
  debts.forEach((d, i) => {
    const row = document.createElement("div");
    row.className = "field custom-split-row";
    row.innerHTML = `
      <label>${escapeHtml(d.name)}</label>
      <div class="input-prefix"><span>$</span><input type="number" class="custom-split-amount" data-index="${i}" min="0" step="1" inputmode="decimal" value="${escapeHtml(previousValues[i] ?? 0)}"></div>
    `;
    customSplitFieldsEl.appendChild(row);
  });
}

function readCustomSplitAmounts() {
  const amounts = [];
  customSplitFieldsEl.querySelectorAll(".custom-split-amount").forEach((input) => {
    amounts[Number(input.dataset.index)] = Math.max(0, Number(input.value) || 0);
  });
  return amounts;
}

function readAdvancedOptions() {
  return {
    lumpSum: {
      enabled: lumpSumEnabledEl.checked,
      amount: Math.max(0, Number(lumpSumAmountEl.value) || 0),
      month: Math.max(1, Math.round(Number(lumpSumMonthEl.value) || 1)),
      mode: lumpSumModeEl.value,
    },
    newCharges: {
      enabled: newChargesEnabledEl.checked,
      amount: Math.max(0, Number(newChargesAmountEl.value) || 0),
      targetIndex: Number(newChargesTargetEl.value) || 0,
    },
    customSplit: {
      enabled: customSplitEnabledEl.checked,
      amounts: readCustomSplitAmounts(),
    },
  };
}

function applyAdvancedOptions(advanced) {
  if (!advanced) return;
  lumpSumEnabledEl.checked = advanced.lumpSum.enabled;
  lumpSumAmountEl.value = advanced.lumpSum.amount;
  lumpSumMonthEl.value = advanced.lumpSum.month;
  lumpSumModeEl.value = advanced.lumpSum.mode;
  lumpSumFieldsEl.hidden = !advanced.lumpSum.enabled;

  newChargesEnabledEl.checked = advanced.newCharges.enabled;
  newChargesAmountEl.value = advanced.newCharges.amount;
  newChargesFieldsEl.hidden = !advanced.newCharges.enabled;
  newChargesTargetEl.dataset.pendingValue = advanced.newCharges.targetIndex;

  if (advanced.customSplit) {
    customSplitEnabledEl.checked = advanced.customSplit.enabled;
    customSplitFieldsEl.hidden = !advanced.customSplit.enabled;
    customSplitFieldsEl.dataset.pendingAmounts = JSON.stringify(advanced.customSplit.amounts);
  }
}

function update() {
  const debts = readDebts();
  const extraPayment = Math.max(0, Number(extraPaymentEl.value) || 0);
  const blend = Number(strategySliderEl.value);

  populateNewChargesTarget(debts);
  if (newChargesTargetEl.dataset.pendingValue !== undefined) {
    newChargesTargetEl.value = newChargesTargetEl.dataset.pendingValue;
    delete newChargesTargetEl.dataset.pendingValue;
  }

  populateCustomSplitFields(debts);
  if (customSplitFieldsEl.dataset.pendingAmounts !== undefined) {
    const pending = JSON.parse(customSplitFieldsEl.dataset.pendingAmounts);
    customSplitFieldsEl.querySelectorAll(".custom-split-amount").forEach((input) => {
      const i = Number(input.dataset.index);
      if (pending[i] !== undefined) input.value = pending[i];
    });
    delete customSplitFieldsEl.dataset.pendingAmounts;
  }

  const advanced = readAdvancedOptions();

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
    saveState(debts, extraPayment, blend, advanced);
    return;
  }

  const result = simulate(debts, extraPayment, blend, advanced);
  lastResult = result;

  payoffDateEl.textContent = result.payoffReached ? monthsFromNow(result.months) : "50+ years";
  payoffTimeEl.textContent = result.payoffReached ? formatDuration(result.months) : `${MAX_MONTHS}+ months`;
  totalInterestEl.textContent = currency(result.totalInterest);

  renderChart(result.timeline);
  renderPayoffOrder(result.debts);
  renderComparison(debts, extraPayment, blend, advanced);
  saveState(debts, extraPayment, blend, advanced);
}

let updateHandle = null;
function scheduleUpdate() {
  clearTimeout(updateHandle);
  updateHandle = setTimeout(update, 120);
}

function saveState(debts, extraPayment, blend, advanced) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ debts, extraPayment, blend, advanced }));
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
    applyAdvancedOptions(saved.advanced);
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

  lumpSumEnabledEl.addEventListener("change", () => {
    lumpSumFieldsEl.hidden = !lumpSumEnabledEl.checked;
    scheduleUpdate();
  });
  [lumpSumAmountEl, lumpSumMonthEl, lumpSumModeEl].forEach((el) => {
    el.addEventListener("input", scheduleUpdate);
    el.addEventListener("change", scheduleUpdate);
  });

  newChargesEnabledEl.addEventListener("change", () => {
    newChargesFieldsEl.hidden = !newChargesEnabledEl.checked;
    scheduleUpdate();
  });
  [newChargesAmountEl, newChargesTargetEl].forEach((el) => {
    el.addEventListener("input", scheduleUpdate);
    el.addEventListener("change", scheduleUpdate);
  });

  customSplitEnabledEl.addEventListener("change", () => {
    customSplitFieldsEl.hidden = !customSplitEnabledEl.checked;
    scheduleUpdate();
  });
  customSplitFieldsEl.addEventListener("input", scheduleUpdate);

  update();
}

init();
