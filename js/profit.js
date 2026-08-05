import { auth, login, onUserChange } from "./firebase.js";
import { db } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  doc,
  setDoc,
  writeBatch,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_EMAIL = "gabrielvarnes1@gmail.com";


Chart.defaults.devicePixelRatio = window.devicePixelRatio;

let currentUser = null;
let profits = [];
let unsubscribeProfits = null;
let unsubscribePriceCatalog = null;
let filteredProfits = [];
let catalogPrices = {};
let catalogInitializationPromise = null;

// INIT
document.addEventListener("DOMContentLoaded", async () => {
  setupAuth();
  setupUI();
  setupSave();
  setupDashboard();
  setupPricingReport();
  setupCatalogUI();
  applyChartTheme();
  window.addEventListener("themechange", () => {
    applyChartTheme();
    renderDashboard();
  });
});

// ================= AUTH =================
function setupAuth() {
  const avatar = document.getElementById("userAvatar");
  const dropdown = document.querySelector(".user-dropdown");
  const logoutBtn = document.getElementById("logoutBtn");

  if (avatar) {
    avatar.onclick = () => {
      if (!currentUser) {
        login();
      } else {
        dropdown?.classList.toggle("hidden");
      }
    };
  }

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await signOut(auth);
      dropdown?.classList.add("hidden");
    };
  }

  onUserChange((user) => {
    currentUser = user;
    const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    if (isAdmin) {
      document.body.classList.add("admin");
      initializeItemCatalog();
    } else {
      document.body.classList.remove("admin");
      unsubscribePriceCatalog?.();
      unsubscribePriceCatalog = null;
      catalogInitializationPromise = null;
      catalogPrices = {};
    }

    if (avatar) {
      avatar.src = user ? user.photoURL : "/assets/icons/user.png";
    }
  });
}

// ================= UI =================
function setupUI() {
  const modal = document.getElementById("modal");
  const openBtn = document.getElementById("openModalBtn");
  const closeBtn = document.getElementById("closeProfitModal");
  const entryType = document.getElementById("entryType");
  const textarea = document.getElementById("lootInput");
  const manualForm = document.getElementById("manualForm");

  const itemsContainer = document.getElementById("itemsContainer");
  const costContainer = document.getElementById("costContainer");

  const addItemBtn = document.getElementById("addItemBtn");
  const addCostBtn = document.getElementById("addCostBtn");

  openBtn.onclick = () => {
    modal.classList.remove("hidden");
    if (!costContainer.querySelector(".item-row")) createItemRow(costContainer, "supply");
  };

  closeBtn.onclick = () => modal.classList.add("hidden");

  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  };

  entryType.onchange = () => {
    if (entryType.value === "hunt") {
      textarea.classList.add("hidden");
      manualForm.classList.remove("hidden");
      if (!itemsContainer.querySelector(".item-row")) createItemRow(itemsContainer, "loot");
    } else {
      textarea.classList.remove("hidden");
      manualForm.classList.add("hidden");
    }
  };

  // GANHOS
  addItemBtn.onclick = () => {
    createItemRow(itemsContainer, "loot");
  };

  // GASTOS
  addCostBtn.onclick = () => {
    createItemRow(costContainer, "supply");
  };
}

// ================= ROW =================
function createItemRow(container, type) {
  const row = document.createElement("div");
  row.className = "item-row";

  row.innerHTML = `
    <div class="item-select">
      <div class="item-input">
        <img class="item-preview hidden">
        <input class="item-search" placeholder="Buscar item...">
      </div>
      <div class="item-dropdown hidden"></div>
    </div>
    <input class="item-qty" type="number" placeholder="Qtd">
    <button class="remove-item-btn" type="button" title="Remover item" aria-label="Remover item">×</button>
  `;

  container.appendChild(row);

  const input = row.querySelector(".item-search");
  const dropdown = row.querySelector(".item-dropdown");
  row.querySelector(".remove-item-btn").onclick = () => row.remove();

  input.onfocus = () => {
    dropdown.classList.remove("hidden");
    createDropdownOptions(dropdown, "", type);
  };

  input.oninput = () => {
    createDropdownOptions(dropdown, input.value, type);
  };

  document.addEventListener("click", (e) => {
    if (!row.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });
  input.oninput = () => {
  const preview = row.querySelector(".item-preview");

  // se apagar texto → remove imagem
  if (!input.value) {
    preview.classList.add("hidden");
    delete input.dataset.selected;
  }

  createDropdownOptions(dropdown, input.value, type);
};
}

// ================= SAVE =================
function setupSave() {
  const saveBtn = document.getElementById("saveBtn");
  const entryType = document.getElementById("entryType");
  const textarea = document.getElementById("lootInput");
  const modal = document.getElementById("modal");

  saveBtn.onclick = async () => {
    const type = entryType.value;

    if (!type) {
      alert("Selecione o tipo de conteúdo");
      return;
    }

    let parsedLoot = {};
    let parsedCosts = {};
    let rawText = "";

    // GANHOS
    if (type === "hunt") {
      document.querySelectorAll("#itemsContainer .item-row").forEach(row => {
        const input = row.querySelector(".item-search");
        const name = input.dataset.selected || input.value;
        const qty = parseInt(row.querySelector(".item-qty").value);

        if (name && qty) parsedLoot[name] = qty;
      });

      rawText = "manual_entry";

    } else {
      rawText = textarea.value.trim();
      if (!rawText) return alert("Cole o loot");

      parsedLoot = parseLoot(rawText);
    }

    // GASTOS
    document.querySelectorAll("#costContainer .item-row").forEach(row => {
      const input = row.querySelector(".item-search");
      const name = input.dataset.selected || input.value;
      const qty = parseInt(row.querySelector(".item-qty").value);

      if (name && qty) parsedCosts[name] = qty;
    });

    const gainData = calculateTotal(parsedLoot, "gain");
    const costData = calculateTotal(parsedCosts, "cost");

    const totalProfit = gainData.total;
    const totalCost = costData.total;
    const netProfit = totalProfit - totalCost;
    
    const hours = parseInt(document.getElementById("hoursInput").value) || 0;
    const minutes = parseInt(document.getElementById("minutesInput").value) || 0;

    const totalMinutes = (hours * 60) + minutes;

if (totalMinutes === 0) {
  alert("Informe o tempo da atividade");
  return;
}

const profitPerHour = (netProfit / totalMinutes) * 60;

    const missingItems = [
      ...gainData.missingItems,
      ...costData.missingItems
    ];

    try {
      await addDoc(collection(db, "profits"), {
        userId: currentUser?.uid || null,
        userEmail: currentUser?.email || null,
        type,
        loot: parsedLoot,
        costs: parsedCosts,
        prices: {
          gains: gainData.usedPrices,
          costs: costData.usedPrices
        },
        totalProfit,
        totalCost,
        netProfit,
        missingItems,
        raw: rawText,
        timeMinutes: totalMinutes,
        profitPerHour: profitPerHour,
        createdAt: serverTimestamp()
      });

      await Promise.allSettled([
        registerMissingItems(gainData.missingItems, "sell"),
        registerMissingItems(costData.missingItems, "buy")
      ]);

      showToast("Salvo com sucesso!");
      modal.classList.add("hidden");

      // RESET
      textarea.value = "";
      document.getElementById("itemsContainer").innerHTML = "";
      document.getElementById("costContainer").innerHTML = "";
      document.getElementById("hoursInput").value = "";
      document.getElementById("minutesInput").value = "";
      entryType.value = "";
      textarea.classList.remove("hidden");
      document.getElementById("manualForm").classList.add("hidden");

    } catch (err) {
      console.error(err);
      alert("Erro ao salvar");
    }
  };
}

function createDropdownOptions(container, filter = "", typeFilter = null) {
  container.innerHTML = "";

  const filterLower = filter.toLowerCase();

  getAvailableItems().forEach(item => {

    if (typeFilter && item.type !== typeFilter && item.type !== "both") return;

    if (!item.name.toLowerCase().includes(filterLower)) return;

    const option = document.createElement("div");
    option.className = "item-option";

    option.innerHTML = `
      ${item.image ? `<img src="${item.image}" alt="">` : ""}
      <span>${item.name}</span>
    `;

    option.onclick = () => {
  const wrapper = container.parentElement;
  const input = wrapper.querySelector(".item-search");
  const preview = wrapper.querySelector(".item-preview");

  input.value = item.name;
  input.dataset.selected = item.name;

  if (item.image) {
    preview.src = item.image;
    preview.classList.remove("hidden");
  } else {
    preview.removeAttribute("src");
    preview.classList.add("hidden");
  }

  container.classList.add("hidden");
};

    container.appendChild(option);
  });
}

// ================= CALC =================
function parseLoot(text) {
  const clean = text
    .replace(/^\d{2}:\d{2}\sVocê recebeu:\s?/i, "")
    .trim();

  const parts = clean.split(/,\s*|\s+e\s+/);

  const loot = {};

  parts.forEach(part => {
    part = part.trim().replace(/\.$/, "");

    const match = part.match(/^(\d+)\s+(.*)$/);

    let qty = 1;
    let name = part;

    if (match) {
      qty = parseInt(match[1]);
      name = match[2];
    }

    name = name
      .replace(/s$/i, "")
      .replace(/stones$/i, "stone")
      .replace(/shards$/i, "shard")
      .replace(/gems$/i, "gem");

    loot[name] = (loot[name] || 0) + qty;
  });

  return loot;
}

function calculateTotal(data, mode) {
  let total = 0;
  const usedPrices = {};
  const missingItems = [];

  for (const itemName in data) {
    const qty = data[itemName];

    const catalogEntry = catalogPrices[itemName.toLowerCase()];

    if (!catalogEntry) {
      usedPrices[itemName] = 0;
      missingItems.push(itemName);
      continue;
    }

    const catalogPrice = mode === "gain" ? catalogEntry?.sell : catalogEntry?.buy;
    const price = Number(catalogPrice);

    if (price == null || Number(price) <= 0) {
      usedPrices[itemName] = 0;
      missingItems.push(itemName);
    } else {
      usedPrices[itemName] = price;
      total += qty * price;
    }
  }

  return { total, usedPrices, missingItems };
}

// ================= TOAST =================
function showToast(message = "Salvo com sucesso") {
  const toast = document.getElementById("toast");
  const text = document.getElementById("toastMessage");

  text.textContent = message;
  toast.classList.remove("hidden");

  const bar = toast.querySelector(".toast-bar");
  bar.style.animation = "none";
  bar.offsetHeight;
  bar.style.animation = "shrink 5s linear forwards";

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 5000);
}

let gainChart = null;
let costChart = null;
let trendChart = null;

// 🔥 plugin pra criar espaço acima da legenda (sem mexer nos itens)
const legendSpacingPlugin = {
  id: 'legendSpacing',

  beforeInit(chart) {
    const originalFit = chart.legend.fit;

    chart.legend.fit = function () {
      originalFit.bind(chart.legend)();
      this.height += 0;
    };
  },

  afterLayout(chart) {
    if (chart.legend && chart.legend.top !== undefined) {
      chart.legend.top += 40;
      chart.legend.bottom += 40;
    }
  }
};

Chart.register(ChartDataLabels, legendSpacingPlugin);

function createChart(ctx, labels, values) {
  const theme = getChartTheme();

  return new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: window.devicePixelRatio || 1,

      cutout: "70%",

      layout: {
        padding: {
          top: 36,
          bottom: 54,
          left: 16,
          right: 16
        }
      },

      plugins: {
        legend: {
          position: "bottom",
          align: "center",
          labels: {
            color: theme.text,
            padding: 12,
            boxWidth: 10,
            boxHeight: 10,
            font: {
              size: 10,
              weight: "600"
            }
          }
        },

        datalabels: {
          color: "#fff",

          formatter: (value, ctx) => {
            const total = ctx.dataset.data.reduce((sum, currentValue) => {
              return sum + Math.abs(Number(currentValue || 0));
            }, 0);
            const percentage = total ? Math.abs(Number(value || 0)) / total : 0;

            // Fatias pequenas continuam identificadas na legenda e no tooltip,
            // mas não recebem rótulo externo para evitar sobreposição.
            if (percentage < 0.06) return null;

            const label = ctx.chart.data.labels[ctx.dataIndex];
            return label + "\n" + formatNumber(value);
          },

          anchor: "end",
          align: "end",

          offset: 8,

          clamp: true,
          clip: false,

          font: {
            size: 10,
            weight: "bold"
          }
        }
      }
    }
  });
}

function renderCharts(data) {

  const gainCanvas = document.getElementById("gainChart");
  const costCanvas = document.getElementById("costChart");

  // 🔥 limpeza total (evita bug de reload)
  if (gainChart) {
    gainChart.destroy();
    gainChart = null;
  }

  if (costChart) {
    costChart.destroy();
    costChart = null;
  }

  gainChart = createChart(
    gainCanvas,
    Object.keys(data.gains),
    Object.values(data.gains)
  );

  costChart = createChart(
    costCanvas,
    Object.keys(data.costs),
    Object.values(data.costs)
  );
}

function setupDashboard() {
  const dateFilter = document.getElementById("dateFilter");
  const contentFilter = document.getElementById("contentFilter");
  const profitSearch = document.getElementById("profitSearch");

  dateFilter?.addEventListener("change", renderDashboard);
  contentFilter?.addEventListener("change", renderDashboard);
  profitSearch?.addEventListener("input", renderTable);
  document.getElementById("exportProfitsBtn")?.addEventListener("click", exportProfitsCsv);
  setupProfitItemTooltip();

  unsubscribeProfits?.();
  unsubscribeProfits = onSnapshot(
    collection(db, "profits"),
    (snapshot) => {
      profits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateDateFilterOptions();
      renderDashboard();
      renderPricingReport();
    },
    (error) => {
      console.error("Erro ao carregar profits:", error);
      showToast("Não foi possível carregar os profits");
    }
  );
}

function updateDateFilterOptions() {
  const select = document.getElementById("dateFilter");
  if (!select) return;

  const previousValue = select.value;
  const now = new Date();
  const currentMonthKey = getMonthKey(now);
  const availableMonths = new Set();

  profits.forEach(profit => {
    const date = profit.createdAt?.toDate?.();
    if (date) availableMonths.add(getMonthKey(date));
  });

  const sortedMonths = [...availableMonths].sort((a, b) => b.localeCompare(a));
  select.innerHTML = "";

  if (sortedMonths.length) {
    const monthsGroup = document.createElement("optgroup");
    monthsGroup.label = "Meses com registros";

    sortedMonths.forEach(monthKey => {
      const option = document.createElement("option");
      option.value = `month:${monthKey}`;
      option.textContent = formatMonthFilterLabel(monthKey, monthKey === currentMonthKey);
      monthsGroup.appendChild(option);
    });

    select.appendChild(monthsGroup);
  }

  const periodsGroup = document.createElement("optgroup");
  periodsGroup.label = "Períodos gerais";
  periodsGroup.innerHTML = `
    <option value="year">Ano atual</option>
    <option value="all">Desde sempre</option>
  `;
  select.appendChild(periodsGroup);

  const normalizedPreviousValue = previousValue === "month"
    ? `month:${currentMonthKey}`
    : previousValue;
  const optionStillExists = [...select.options].some(option => option.value === normalizedPreviousValue);

  select.value = optionStillExists
    ? normalizedPreviousValue
    : (sortedMonths.length ? `month:${sortedMonths[0]}` : "all");
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthFilterLabel(monthKey, isCurrentMonth = false) {
  const [year, month] = monthKey.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
  return isCurrentMonth ? `${capitalizedLabel} (mês atual)` : capitalizedLabel;
}

function setupPricingReport() {
  document.getElementById("pricingReportToggle")?.addEventListener("click", () => {
    document.getElementById("pricingReportBody")?.classList.toggle("hidden");
  });

  document.getElementById("missingPricesList")?.addEventListener("click", async event => {
    const button = event.target.closest("button[data-price-item]");
    if (!button) return;

    const row = button.closest(".missing-price-row");
    const input = row?.querySelector("input");
    const price = getMoneyInputValue(input);
    const name = decodeURIComponent(button.dataset.priceItem);
    const priceField = button.dataset.priceField;

    if (!Number.isFinite(price) || price <= 0) {
      return showToast("Informe um valor maior que zero");
    }

    button.disabled = true;
    button.textContent = "Atualizando...";

    try {
      await updateMissingItemPrice(name, priceField, price);
      showToast(`${name} atualizado nos registros`);
    } catch (error) {
      console.error("Erro ao atualizar preço:", error);
      showToast("Erro ao atualizar o preço");
      button.disabled = false;
      button.textContent = "Atualizar";
    }
  });
}

function getAvailableItems() {
  return Object.values(catalogPrices).sort((a, b) => a.name.localeCompare(b.name));
}

async function initializeItemCatalog() {
  if (catalogInitializationPromise) return catalogInitializationPromise;

  catalogInitializationPromise = (async () => {
    await migrateLegacyItems();
    subscribeItemCatalog();
  })().catch(error => {
    catalogInitializationPromise = null;
    console.error("Erro ao inicializar catálogo:", error);
    showToast("Sem permissão para inicializar o catálogo");
  });

  return catalogInitializationPromise;
}

async function migrateLegacyItems() {
  const currentItems = await getDocs(collection(db, "items"));
  if (!currentItems.empty) return;

  const legacyPrices = await getDocs(collection(db, "itemPrices"));
  const itemsToMigrate = new Map();

  LEGACY_ITEM_SEED.forEach(item => itemsToMigrate.set(item.name.toLowerCase(), item));
  legacyPrices.docs.forEach(legacyDoc => {
    const legacyItem = normalizeCatalogItem(legacyDoc.data());
    const key = legacyItem.name?.toLowerCase();
    if (!key) return;
    const seededItem = itemsToMigrate.get(key) || {};
    itemsToMigrate.set(key, {
      ...seededItem,
      ...legacyItem,
      image: legacyItem.image || seededItem.image || "",
      buy: Number(legacyItem.buy) > 0 ? legacyItem.buy : Number(seededItem.buy || 0),
      sell: Number(legacyItem.sell) > 0 ? legacyItem.sell : Number(seededItem.sell || 0)
    });
  });

  const batch = writeBatch(db);
  itemsToMigrate.forEach(item => {
    const normalized = normalizeCatalogItem(item);
    const itemId = getPriceDocumentId(normalized.name);
    batch.set(doc(db, "items", itemId), {
      ...normalized,
      status: getItemStatus(normalized),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    batch.set(doc(collection(db, "items", itemId, "priceHistory")), {
      previousBuy: 0,
      previousSell: 0,
      buy: Number(normalized.buy || 0),
      sell: Number(normalized.sell || 0),
      changedField: "migration",
      changedAt: serverTimestamp(),
      changedBy: currentUser?.email || ADMIN_EMAIL,
      reason: "legacy-migration"
    });
  });
  await batch.commit();
}

function subscribeItemCatalog() {
  if (unsubscribePriceCatalog) return;

  unsubscribePriceCatalog = onSnapshot(collection(db, "items"), snapshot => {
    catalogPrices = {};
    const migrations = [];
    snapshot.docs.forEach(priceDoc => {
      const data = priceDoc.data();
      if (!data.name) return;

      const normalized = normalizeCatalogItem(data);
      catalogPrices[data.name.toLowerCase()] = { ...normalized, id: priceDoc.id };

      if (data.image == null || data.type == null || data.buy == null || data.sell == null) {
        migrations.push(setDoc(priceDoc.ref, normalized, { merge: true }));
      }
    });
    if (migrations.length) {
      Promise.all(migrations).catch(error => console.error("Erro ao normalizar catálogo:", error));
    }
    renderPricingReport();
    renderCatalog();
  }, error => {
    console.error("Erro ao carregar catálogo de preços:", error);
    unsubscribePriceCatalog = null;
  });
}

function normalizeCatalogItem(item) {
  const buy = Number(item.buy || 0);
  const sell = Number(item.sell || 0);
  const inferredType = buy > 0 && sell > 0 ? "both" : (sell > 0 ? "loot" : "supply");

  return {
    ...item,
    image: item.image || "",
    type: item.type || inferredType,
    buy,
    sell
  };
}

async function registerMissingItems(itemNames, priceField) {
  await Promise.all(itemNames.map(name => {
    const existing = catalogPrices[name.toLowerCase()];
    const inferredType = priceField === "sell" ? "loot" : "supply";
    const type = existing?.type && existing.type !== inferredType ? "both" : (existing?.type || inferredType);

    return setDoc(doc(db, "items", existing?.id || getPriceDocumentId(name)), {
      name,
      image: existing?.image || "",
      type,
      buy: Number(existing?.buy || 0),
      sell: Number(existing?.sell || 0),
      [priceField]: 0,
      status: "pending",
      createdAt: existing?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }));
}

function renderPricingReport() {
  const list = document.getElementById("missingPricesList");
  const count = document.getElementById("missingPriceCount");
  if (!list || !count) return;

  const pending = getPendingPrices();
  count.textContent = pending.length;

  if (!pending.length) {
    list.innerHTML = '<div class="pricing-empty">Tudo precificado. Nenhuma pendência encontrada.</div>';
    return;
  }

  list.innerHTML = pending.map(item => `
    <div class="missing-price-row">
      <div class="missing-price-name">
        <strong>${escapeHtml(item.name)}</strong>
        <small>${item.totalQuantity} unidades sem preço</small>
      </div>
      <span class="price-kind">${item.priceField === "sell" ? "Preço de venda" : "Preço de compra"}</span>
      <span class="missing-price-meta">${item.records.size} ${item.records.size === 1 ? "registro afetado" : "registros afetados"}</span>
      <div class="missing-price-action">
        <input class="money-input" type="text" inputmode="decimal" placeholder="Ex.: 1,5 ou 50k">
        <button type="button" data-price-item="${encodeURIComponent(item.name)}" data-price-field="${item.priceField}">Atualizar</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".money-input").forEach(input => initializeMoneyInput(input, 0));
}

function getPendingPrices() {
  const pending = new Map();

  profits.forEach(profit => {
    collectPendingFromRecord(pending, profit, "loot", "gains", "sell");
    collectPendingFromRecord(pending, profit, "costs", "costs", "buy");
  });

  return [...pending.values()].sort((a, b) => b.records.size - a.records.size || a.name.localeCompare(b.name));
}

function collectPendingFromRecord(pending, profit, itemsField, pricesField, priceField) {
  Object.entries(profit[itemsField] || {}).forEach(([name, quantity]) => {
    const savedPrice = Number(profit.prices?.[pricesField]?.[name] || 0);
    if (savedPrice > 0) return;

    const key = `${priceField}:${name.toLowerCase()}`;
    if (!pending.has(key)) {
      pending.set(key, { name, priceField, totalQuantity: 0, records: new Set() });
    }

    const item = pending.get(key);
    item.totalQuantity += Number(quantity || 0);
    item.records.add(profit.id);
  });
}

async function updateMissingItemPrice(name, priceField, price) {
  const existing = catalogPrices[name.toLowerCase()] || {};
  const inferredType = priceField === "sell" ? "loot" : "supply";
  const type = existing.type && existing.type !== inferredType ? "both" : (existing.type || inferredType);

  const itemId = existing.id || getPriceDocumentId(name);
  const itemRef = doc(db, "items", itemId);
  const priceBatch = writeBatch(db);
  priceBatch.set(itemRef, {
    name,
    image: existing.image || "",
    type,
    buy: Number(existing.buy || 0),
    sell: Number(existing.sell || 0),
    [priceField]: price,
    status: getItemStatus({
      type,
      buy: priceField === "buy" ? price : Number(existing.buy || 0),
      sell: priceField === "sell" ? price : Number(existing.sell || 0)
    }),
    updatedAt: serverTimestamp()
  }, { merge: true });
  priceBatch.set(doc(collection(db, "items", itemId, "priceHistory")), {
    previousBuy: Number(existing.buy || 0),
    previousSell: Number(existing.sell || 0),
    buy: priceField === "buy" ? price : Number(existing.buy || 0),
    sell: priceField === "sell" ? price : Number(existing.sell || 0),
    changedField: priceField,
    changedAt: serverTimestamp(),
    changedBy: currentUser?.email || ADMIN_EMAIL,
    reason: "pending-price"
  });
  await priceBatch.commit();
  await backfillMissingProfitPrices(name, priceField, price);
}

async function backfillMissingProfitPrices(name, priceField, price) {
  const affected = profits.filter(profit => {
    const source = priceField === "sell" ? profit.loot : profit.costs;
    const pricesField = priceField === "sell" ? "gains" : "costs";
    const key = findItemKey(source, name);
    return key && Number(profit.prices?.[pricesField]?.[key] || 0) <= 0;
  });

  for (let start = 0; start < affected.length; start += 500) {
    const batch = writeBatch(db);
    affected.slice(start, start + 500).forEach(profit => {
      const prices = {
        gains: { ...(profit.prices?.gains || {}) },
        costs: { ...(profit.prices?.costs || {}) }
      };
      const source = priceField === "sell" ? profit.loot : profit.costs;
      const pricesField = priceField === "sell" ? "gains" : "costs";
      const itemKey = findItemKey(source, name);
      prices[pricesField][itemKey] = price;

      const totalProfit = calculateSavedTotal(profit.loot, prices.gains);
      const totalCost = calculateSavedTotal(profit.costs, prices.costs);
      const netProfit = totalProfit - totalCost;
      const timeMinutes = Number(profit.timeMinutes || 0);
      const missingItems = getMissingItemsFromSnapshot(profit, prices);

      batch.update(doc(db, "profits", profit.id), {
        prices,
        totalProfit,
        totalCost,
        netProfit,
        profitPerHour: timeMinutes ? (netProfit / timeMinutes) * 60 : 0,
        missingItems,
        updatedAt: serverTimestamp()
      });
    });
    await batch.commit();
  }
}

function calculateSavedTotal(items = {}, savedPrices = {}) {
  return Object.entries(items).reduce((total, [name, quantity]) => {
    return total + Number(quantity || 0) * Number(savedPrices[name] || 0);
  }, 0);
}

function getMissingItemsFromSnapshot(profit, prices) {
  const names = [];
  Object.keys(profit.loot || {}).forEach(name => {
    if (Number(prices.gains[name] || 0) <= 0) names.push(name);
  });
  Object.keys(profit.costs || {}).forEach(name => {
    if (Number(prices.costs[name] || 0) <= 0) names.push(name);
  });
  return [...new Set(names)];
}

function findItemKey(items = {}, name) {
  return Object.keys(items).find(key => key.toLowerCase() === name.toLowerCase());
}

function getPriceDocumentId(name) {
  return encodeURIComponent(name.trim().toLowerCase());
}

function getItemStatus(item) {
  const buy = Number(item.buy || 0);
  const sell = Number(item.sell || 0);
  const hasRequiredPrice = item.type === "loot"
    ? sell > 0
    : item.type === "supply"
      ? buy > 0
      : buy > 0 && sell > 0;
  return hasRequiredPrice ? "priced" : "pending";
}

function setupCatalogUI() {
  const modal = document.getElementById("catalogModal");
  const imageInput = document.getElementById("catalogItemImage");

  document.getElementById("newCatalogItemBtn")?.addEventListener("click", () => openCatalogItem());
  document.getElementById("closeCatalogModal")?.addEventListener("click", closeCatalogModal);
  modal?.addEventListener("click", event => {
    if (event.target === modal) closeCatalogModal();
  });

  ["catalogSearch", "catalogTypeFilter", "catalogStatusFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener(id === "catalogSearch" ? "input" : "change", renderCatalog);
  });

  imageInput?.addEventListener("input", () => updateCatalogImagePreview(imageInput.value.trim()));
  ["catalogItemBuy", "catalogItemSell"].forEach(id => {
    const input = document.getElementById(id);
    if (input) setupMoneyInput(input);
  });
  document.getElementById("catalogGrid")?.addEventListener("click", event => {
    const card = event.target.closest("[data-catalog-id]");
    if (card) openCatalogItem(decodeURIComponent(card.dataset.catalogId));
  });
  document.getElementById("catalogItemForm")?.addEventListener("submit", saveCatalogItem);
  document.getElementById("deleteCatalogItemBtn")?.addEventListener("click", deleteCatalogItem);
}

function renderCatalog() {
  const grid = document.getElementById("catalogGrid");
  if (!grid) return;

  const allItems = getAvailableItems();
  const search = document.getElementById("catalogSearch")?.value.trim().toLowerCase() || "";
  const typeFilter = document.getElementById("catalogTypeFilter")?.value || "all";
  const statusFilter = document.getElementById("catalogStatusFilter")?.value || "all";

  document.getElementById("catalogTotal").textContent = allItems.length;
  document.getElementById("catalogNoImage").textContent = allItems.filter(item => !item.image).length;
  document.getElementById("catalogPending").textContent = allItems.filter(item => getItemStatus(item) === "pending").length;

  const visibleItems = allItems.filter(item => {
    if (!item.name.toLowerCase().includes(search)) return false;
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (statusFilter === "no-image") return !item.image;
    if (statusFilter !== "all" && getItemStatus(item) !== statusFilter) return false;
    return true;
  });

  if (!visibleItems.length) {
    grid.innerHTML = '<div class="catalog-empty">Nenhum item encontrado para esses filtros.</div>';
    return;
  }

  grid.innerHTML = visibleItems.map(item => {
    const status = getItemStatus(item);
    return `
      <article class="catalog-card" data-catalog-id="${encodeURIComponent(item.id)}">
        <div class="catalog-card-image">
          ${item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : "<span>SEM<br>IMAGEM</span>"}
        </div>
        <div>
          <h3 class="catalog-card-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h3>
          <div class="catalog-card-badges">
            <span class="catalog-badge">${escapeHtml(formatItemType(item.type))}</span>
            <span class="catalog-badge ${status === "pending" ? "pending" : ""}">${status === "pending" ? "Pendente" : "Precificado"}</span>
          </div>
          <div class="catalog-card-prices">
            <span>Compra <b>${formatMoney(item.buy)}</b></span>
            <span>Venda <b>${formatMoney(item.sell)}</b></span>
          </div>
        </div>
      </article>`;
  }).join("");
}

function formatItemType(type) {
  return ({ loot: "Loot", supply: "Suprimento", both: "Compra e venda" })[type] || type;
}

function openCatalogItem(itemId = null) {
  const item = itemId ? getAvailableItems().find(entry => entry.id === itemId) : null;
  document.getElementById("catalogItemId").value = item?.id || "";
  document.getElementById("catalogItemName").value = item?.name || "";
  document.getElementById("catalogItemType").value = item?.type || "loot";
  initializeMoneyInput(document.getElementById("catalogItemBuy"), Number(item?.buy || 0));
  initializeMoneyInput(document.getElementById("catalogItemSell"), Number(item?.sell || 0));
  document.getElementById("catalogItemImage").value = item?.image || "";
  document.getElementById("catalogModalTitle").textContent = item ? item.name : "Novo item";
  document.getElementById("catalogHistorySection").classList.toggle("hidden", !item);
  document.getElementById("deleteCatalogItemBtn").classList.toggle("hidden", !item);
  updateCatalogImagePreview(item?.image || "");
  document.getElementById("catalogModal").classList.remove("hidden");

  if (item) loadItemPriceHistory(item.id);
}

function closeCatalogModal() {
  document.getElementById("catalogModal")?.classList.add("hidden");
}

async function deleteCatalogItem() {
  if (currentUser?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return;

  const itemId = document.getElementById("catalogItemId").value;
  const item = getAvailableItems().find(entry => entry.id === itemId);
  if (!item) return;

  const affectedProfits = profits.filter(profit => {
    return findItemKey(profit.loot, item.name) || findItemKey(profit.costs, item.name);
  }).length;
  const historicalWarning = affectedProfits
    ? `\n\n${affectedProfits} profit(s) antigo(s) usam esse nome. Eles serão preservados como histórico.`
    : "";

  if (!window.confirm(`Excluir "${item.name}" do catálogo?${historicalWarning}`)) return;

  const button = document.getElementById("deleteCatalogItemBtn");
  button.disabled = true;
  button.textContent = "Excluindo...";

  try {
    await deleteDoc(doc(db, "items", item.id));
    closeCatalogModal();
    showToast("Item excluído do catálogo");
  } catch (error) {
    console.error("Erro ao excluir item:", error);
    showToast("Erro ao excluir o item");
  } finally {
    button.disabled = false;
    button.textContent = "Excluir item";
  }
}

function updateCatalogImagePreview(url) {
  const image = document.getElementById("catalogImagePreview");
  const fallback = document.getElementById("catalogImageFallback");
  if (!url) {
    image.classList.add("hidden");
    image.removeAttribute("src");
    fallback.classList.remove("hidden");
    return;
  }

  image.onload = () => {
    image.classList.remove("hidden");
    fallback.classList.add("hidden");
  };
  image.onerror = () => {
    image.classList.add("hidden");
    fallback.textContent = "Não foi possível carregar essa imagem";
    fallback.classList.remove("hidden");
  };
  fallback.textContent = "Carregando imagem...";
  fallback.classList.remove("hidden");
  image.src = url;
}

async function saveCatalogItem(event) {
  event.preventDefault();
  if (currentUser?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return;

  const idInput = document.getElementById("catalogItemId");
  const name = document.getElementById("catalogItemName").value.trim();
  const type = document.getElementById("catalogItemType").value;
  const buy = getMoneyInputValue(document.getElementById("catalogItemBuy"));
  const sell = getMoneyInputValue(document.getElementById("catalogItemSell"));
  const image = document.getElementById("catalogItemImage").value.trim();
  const existing = idInput.value ? getAvailableItems().find(item => item.id === idInput.value) : null;
  const duplicate = getAvailableItems().find(item => item.name.toLowerCase() === name.toLowerCase() && item.id !== existing?.id);
  const saveButton = document.getElementById("saveCatalogItemBtn");

  if (!name) return showToast("Informe o nome do item");
  if (buy < 0 || sell < 0) return showToast("Os preços não podem ser negativos");
  if (duplicate) return showToast("Já existe um item com esse nome");

  const itemId = existing?.id || getPriceDocumentId(name);
  const item = { name, type, buy, sell, image, status: getItemStatus({ type, buy, sell }) };
  const pricesChanged = !existing || buy !== Number(existing.buy || 0) || sell !== Number(existing.sell || 0);
  const batch = writeBatch(db);

  saveButton.disabled = true;
  saveButton.textContent = "Salvando...";

  try {
    batch.set(doc(db, "items", itemId), {
      ...item,
      createdAt: existing?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    if (pricesChanged) {
      batch.set(doc(collection(db, "items", itemId, "priceHistory")), {
        previousBuy: Number(existing?.buy || 0),
        previousSell: Number(existing?.sell || 0),
        buy,
        sell,
        changedField: existing ? "catalog-update" : "creation",
        changedAt: serverTimestamp(),
        changedBy: currentUser.email,
        reason: existing ? "catalog-update" : "item-created"
      });
    }

    await batch.commit();

    if (existing && Number(existing.buy || 0) <= 0 && buy > 0) {
      await backfillMissingProfitPrices(name, "buy", buy);
    }
    if (existing && Number(existing.sell || 0) <= 0 && sell > 0) {
      await backfillMissingProfitPrices(name, "sell", sell);
    }

    showToast("Item salvo no catálogo");
    closeCatalogModal();
  } catch (error) {
    console.error("Erro ao salvar item:", error);
    showToast("Erro ao salvar o item");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Salvar item";
  }
}

async function loadItemPriceHistory(itemId) {
  const list = document.getElementById("catalogHistoryList");
  list.innerHTML = '<div class="catalog-history-empty">Carregando histórico...</div>';

  try {
    const snapshot = await getDocs(collection(db, "items", itemId, "priceHistory"));
    const history = snapshot.docs
      .map(historyDoc => historyDoc.data())
      .sort((a, b) => (b.changedAt?.toMillis?.() || 0) - (a.changedAt?.toMillis?.() || 0));

    document.getElementById("catalogHistoryCount").textContent = `${history.length} ${history.length === 1 ? "alteração" : "alterações"}`;
    list.innerHTML = history.length ? history.map(entry => `
      <div class="catalog-history-row">
        <span>Compra: <b>${formatMoney(entry.previousBuy)} → ${formatMoney(entry.buy)}</b></span>
        <span>Venda: <b>${formatMoney(entry.previousSell)} → ${formatMoney(entry.sell)}</b></span>
        <span>${entry.changedAt?.toDate?.().toLocaleString("pt-BR") || "Agora"} · ${escapeHtml(entry.changedBy || "admin")}</span>
      </div>
    `).join("") : '<div class="catalog-history-empty">Nenhuma alteração de preço registrada ainda.</div>';
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
    list.innerHTML = '<div class="catalog-history-empty">Não foi possível carregar o histórico.</div>';
  }
}

function renderDashboard() {
  const dateFilter = document.getElementById("dateFilter")?.value || "all";
  const contentFilter = document.getElementById("contentFilter")?.value || "all";
  const now = new Date();

  filteredProfits = profits.filter(profit => {
    if (!matchesContentFilter(profit.type, contentFilter)) return false;
    if (dateFilter === "all") return true;

    const createdAt = profit.createdAt?.toDate?.();
    if (!createdAt) return false;

    if (dateFilter === "year") {
      return createdAt.getFullYear() === now.getFullYear();
    }

    if (dateFilter.startsWith("month:")) {
      return getMonthKey(createdAt) === dateFilter.slice("month:".length);
    }

    return createdAt.getFullYear() === now.getFullYear()
      && createdAt.getMonth() === now.getMonth();
  });

  const totals = filteredProfits.reduce((result, profit) => {
    const label = formatContentType(profit.type);
    result.gains[label] = (result.gains[label] || 0) + Number(profit.totalProfit || 0);
    result.costs[label] = (result.costs[label] || 0) + Number(profit.totalCost || 0);
    return result;
  }, { gains: {}, costs: {} });

  renderKpis(filteredProfits);
  renderCharts(totals);
  renderTrendChart(filteredProfits, dateFilter);
  renderTable();
}

function renderKpis(data) {
  const summary = data.reduce((result, profit) => {
    result.gains += Number(profit.totalProfit || 0);
    result.costs += Number(profit.totalCost || 0);
    result.net += Number(profit.netProfit || 0);
    result.minutes += Number(profit.timeMinutes || 0);
    return result;
  }, { gains: 0, costs: 0, net: 0, minutes: 0 });

  const perHour = summary.minutes ? (summary.net / summary.minutes) * 60 : 0;
  const margin = summary.gains ? (summary.net / summary.gains) * 100 : 0;

  document.getElementById("kpiGains").textContent = formatMoney(summary.gains);
  document.getElementById("kpiCosts").textContent = formatMoney(summary.costs);
  document.getElementById("kpiNet").textContent = formatMoney(summary.net);
  document.getElementById("kpiPerHour").textContent = formatMoney(perHour);
  document.getElementById("kpiMargin").textContent = `Margem de ${formatDecimal(margin)}%`;
  document.getElementById("kpiSessions").textContent = `${data.length} ${data.length === 1 ? "atividade registrada" : "atividades registradas"}`;

  document.querySelector(".kpi-net")?.classList.toggle("is-negative", summary.net < 0);
  document.querySelector(".kpi-hour")?.classList.toggle("is-negative", perHour < 0);
}

function renderTrendChart(data, dateFilter) {
  const canvas = document.getElementById("trendChart");
  if (!canvas) return;

  trendChart?.destroy();

  const grouped = new Map();
  data.forEach(profit => {
    const date = profit.createdAt?.toDate?.();
    if (!date) return;

    const key = dateFilter === "month" || dateFilter.startsWith("month:")
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    grouped.set(key, (grouped.get(key) || 0) + Number(profit.netProfit || 0));
  });

  const entries = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  const labels = entries.map(([key]) => formatPeriodLabel(key));
  const values = entries.map(([, value]) => value);
  const theme = getChartTheme();

  trendChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Lucro líquido",
        data: values,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34, 197, 94, 0.12)",
        pointBackgroundColor: "#4ade80",
        pointBorderColor: "#101018",
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      scales: {
        x: { grid: { color: theme.grid }, ticks: { color: theme.text } },
        y: {
          grid: { color: theme.grid },
          ticks: { color: theme.text, callback: value => formatNumber(value) }
        }
      },
      plugins: {
        datalabels: { display: false },
        legend: { display: false },
        tooltip: { callbacks: { label: context => `Lucro: ${formatMoney(context.raw)}` } }
      }
    }
  });
}

function renderTable() {
  const tbody = document.getElementById("profitsTableBody");
  if (!tbody) return;

  const search = document.getElementById("profitSearch")?.value.trim().toLowerCase() || "";
  const rows = filteredProfits
    .filter(profit => getProfitSearchText(profit).includes(search))
    .sort((a, b) => getProfitDate(b) - getProfitDate(a));

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-table-cell">Nenhum registro encontrado para este filtro.</td></tr>';
  } else {
    tbody.innerHTML = rows.map((profit, index) => {
      const date = getProfitDate(profit);
      const net = Number(profit.netProfit || 0);

      return `<tr>
        <td class="cell-number">${index + 1}</td>
        <td>${date ? escapeHtml(date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })) : "—"}</td>
        <td><span class="content-badge">${escapeHtml(formatContentType(profit.type))}</span></td>
        <td class="money-gain">${formatMoney(profit.totalProfit)}</td>
        <td class="money-cost">${formatMoney(profit.totalCost)}</td>
        <td class="money-net ${net < 0 ? "negative" : ""}">${formatMoney(net)}</td>
        <td>${formatDuration(profit.timeMinutes)}</td>
        <td class="money-net ${Number(profit.profitPerHour || 0) < 0 ? "negative" : ""}">${formatMoney(profit.profitPerHour)}</td>
        <td class="items-cell loot-items-cell">${renderItemsSummary(profit.loot, "loot")}</td>
        <td class="items-cell supply-items-cell">${renderItemsSummary(profit.costs, "supply")}</td>
      </tr>`;
    }).join("");
  }

  const visibleNet = rows.reduce((total, profit) => total + Number(profit.netProfit || 0), 0);
  document.getElementById("tableResultCount").textContent = `${rows.length} ${rows.length === 1 ? "registro" : "registros"}`;
  document.getElementById("tableTotalNet").textContent = `Lucro exibido: ${formatMoney(visibleNet)}`;
}

function renderItemsSummary(items = {}, kind = "loot") {
  const entries = Object.entries(items);
  if (!entries.length) return '<span class="items-empty">—</span>';

  const visibleEntries = entries.slice(0, 2);
  const remaining = entries.length - visibleEntries.length;
  const encodedItems = encodeURIComponent(JSON.stringify(items));
  const chips = visibleEntries.map(([name, quantity]) => {
    return `<span class="item-mini-chip"><b>${formatItemQuantity(quantity)}×</b>${escapeHtml(name)}</span>`;
  }).join("");

  return `<div class="items-summary ${kind}" data-profit-items="${encodedItems}" data-items-kind="${kind}" tabindex="0">
    ${chips}${remaining > 0 ? `<span class="item-more-chip">+${remaining}</span>` : ""}
  </div>`;
}

function setupProfitItemTooltip() {
  const tbody = document.getElementById("profitsTableBody");
  if (!tbody || document.getElementById("profitItemTooltip")) return;

  const tooltip = document.createElement("div");
  tooltip.id = "profitItemTooltip";
  tooltip.className = "profit-item-tooltip hidden";
  document.body.appendChild(tooltip);
  let tooltipHideTimer = null;
  let tooltipLocked = false;

  const cancelTooltipHide = () => {
    if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  };

  const scheduleTooltipHide = () => {
    if (tooltipLocked) return;
    cancelTooltipHide();
    tooltipHideTimer = setTimeout(() => tooltip.classList.add("hidden"), 220);
  };

  const showTooltip = (target, force = false) => {
    if (tooltipLocked && !force) return;
    cancelTooltipHide();
    const items = JSON.parse(decodeURIComponent(target.dataset.profitItems));
    const kind = target.dataset.itemsKind;
    const entries = Object.entries(items);
    tooltip.innerHTML = `
      <div class="profit-item-tooltip-header">
        <span>${kind === "loot" ? "Loot recebido" : "Suprimentos utilizados"}</span>
        <b>${entries.length} ${entries.length === 1 ? "item" : "itens"}</b>
        <small>${tooltipLocked ? "Fixado · clique fora para fechar" : "Clique para fixar"}</small>
      </div>
      <div class="profit-item-tooltip-list">
        ${entries.map(([name, quantity]) => {
          const catalogItem = catalogPrices[name.toLowerCase()];
          return `<div class="profit-tooltip-item">
            <span class="profit-tooltip-image">${catalogItem?.image ? `<img src="${escapeHtml(catalogItem.image)}" alt="">` : "◇"}</span>
            <span>${escapeHtml(name)}</span>
            <b>${formatItemQuantity(quantity)}×</b>
          </div>`;
        }).join("")}
      </div>`;
    tooltip.classList.remove("hidden");
  };

  const positionTooltip = (event, force = false) => {
    if (tooltipLocked && !force) return;
    const spacing = 14;
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const left = Math.min(event.clientX + spacing, window.innerWidth - width - spacing);
    const top = event.clientY + spacing + height > window.innerHeight
      ? event.clientY - height - spacing
      : event.clientY + spacing;
    tooltip.style.left = `${Math.max(spacing, left)}px`;
    tooltip.style.top = `${Math.max(spacing, top)}px`;
  };

  tbody.addEventListener("mouseover", event => {
    const target = event.target.closest("[data-profit-items]");
    if (target?.contains(event.relatedTarget)) return;
    if (target) {
      showTooltip(target);
      positionTooltip(event);
    }
  });
  tbody.addEventListener("mouseout", event => {
    const target = event.target.closest("[data-profit-items]");
    if (target && !target.contains(event.relatedTarget)) scheduleTooltipHide();
  });
  tbody.addEventListener("focusin", event => {
    const target = event.target.closest("[data-profit-items]");
    if (!target) return;
    showTooltip(target);
    const rect = target.getBoundingClientRect();
    positionTooltip({ clientX: rect.left, clientY: rect.bottom });
  });
  tbody.addEventListener("focusout", scheduleTooltipHide);
  tooltip.addEventListener("mouseenter", cancelTooltipHide);
  tooltip.addEventListener("mouseleave", scheduleTooltipHide);

  tbody.addEventListener("click", event => {
    const target = event.target.closest("[data-profit-items]");
    if (!target) return;

    tooltipLocked = true;
    cancelTooltipHide();
    tooltip.classList.add("locked");
    showTooltip(target, true);
    positionTooltip({ clientX: event.clientX, clientY: event.clientY }, true);
  });

  document.addEventListener("click", event => {
    if (!tooltipLocked) return;
    if (tooltip.contains(event.target) || event.target.closest("[data-profit-items]")) return;

    tooltipLocked = false;
    tooltip.classList.remove("locked");
    tooltip.classList.add("hidden");
  });
}

function formatItemQuantity(quantity) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(quantity || 0));
}

function exportProfitsCsv() {
  if (!filteredProfits.length) return showToast("Não há registros para exportar");

  const header = ["Data", "Conteúdo", "Ganhos", "Gastos", "Lucro líquido", "Tempo (min)", "Lucro/h", "Loot", "Suprimentos"];
  const rows = filteredProfits.map(profit => [
    getProfitDate(profit)?.toLocaleString("pt-BR") || "",
    formatContentType(profit.type),
    Number(profit.totalProfit || 0),
    Number(profit.totalCost || 0),
    Number(profit.netProfit || 0),
    Number(profit.timeMinutes || 0),
    Number(profit.profitPerHour || 0),
    formatItems(profit.loot),
    formatItems(profit.costs)
  ]);
  const csv = [header, ...rows]
    .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `profits-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function getProfitDate(profit) {
  return profit.createdAt?.toDate?.() || null;
}

function getProfitSearchText(profit) {
  return [formatContentType(profit.type), ...Object.keys(profit.loot || {}), ...Object.keys(profit.costs || {})]
    .join(" ")
    .toLowerCase();
}

function formatItems(items = {}) {
  const entries = Object.entries(items);
  return entries.length ? entries.map(([name, qty]) => `${qty}x ${name}`).join(", ") : "—";
}

function formatDuration(minutes = 0) {
  const total = Number(minutes || 0);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return hours ? `${hours}h ${rest}min` : `${rest}min`;
}

function formatPeriodLabel(key) {
  const [year, month, day] = key.split("-").map(Number);
  return day
    ? new Date(year, month - 1, day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function setupMoneyInput(input) {
  if (input.dataset.moneyReady) return;
  input.dataset.moneyReady = "true";

  input.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      if (input.dataset.decimalMode === "true") {
        const decimalDigits = input.dataset.decimalDigits || "";
        if (decimalDigits.length < 2) {
          renderDecimalMoneyInput(input, input.dataset.integerPart || "0", decimalDigits + event.key);
        }
        return;
      }

      const current = String(Math.trunc(getMoneyInputValue(input)));
      const replaceAll = input.selectionStart === 0 && input.selectionEnd === input.value.length;
      const digits = replaceAll || current === "0" ? event.key : current + event.key;
      initializeMoneyInput(input, Number(digits));
      return;
    }

    if (event.key === "," || event.key === ".") {
      event.preventDefault();
      const integerPart = String(Math.trunc(getMoneyInputValue(input)));
      renderDecimalMoneyInput(input, integerPart, "");
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      if (input.dataset.decimalMode === "true") {
        const decimalDigits = input.dataset.decimalDigits || "";
        if (decimalDigits) {
          renderDecimalMoneyInput(input, input.dataset.integerPart || "0", decimalDigits.slice(0, -1));
        } else {
          initializeMoneyInput(input, Number(input.dataset.integerPart || 0));
        }
        return;
      }

      const current = String(Math.trunc(getMoneyInputValue(input)));
      initializeMoneyInput(input, Number(current.slice(0, -1) || 0));
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      initializeMoneyInput(input, 0);
      return;
    }

    const navigationKeys = ["Tab", "ArrowLeft", "ArrowRight", "Home", "End", "Enter"];
    if (event.key.length === 1 && !navigationKeys.includes(event.key)) event.preventDefault();
  });

  input.addEventListener("paste", event => {
    event.preventDefault();
    initializeMoneyInput(input, parseGameMoney(event.clipboardData.getData("text")));
  });

  input.addEventListener("input", event => {
    if (input.dataset.moneyUpdating === "true") return;

    if (event.inputType?.startsWith("insert") && (event.data === "," || event.data === ".")) {
      renderDecimalMoneyInput(input, String(Math.trunc(Number(input.dataset.rawValue || 0))), "");
    } else if (event.inputType?.startsWith("insert") && /^\d$/.test(event.data || "")) {
      if (input.dataset.decimalMode === "true") {
        const decimalDigits = input.dataset.decimalDigits || "";
        if (decimalDigits.length < 2) {
          renderDecimalMoneyInput(input, input.dataset.integerPart || "0", decimalDigits + event.data);
        }
        return;
      }

      const current = String(Math.trunc(Number(input.dataset.rawValue || 0)));
      const digits = current === "0" ? event.data : current + event.data;
      initializeMoneyInput(input, Number(digits));
    } else if (event.inputType?.startsWith("delete")) {
      if (input.dataset.decimalMode === "true") {
        const decimalDigits = input.dataset.decimalDigits || "";
        if (decimalDigits) {
          renderDecimalMoneyInput(input, input.dataset.integerPart || "0", decimalDigits.slice(0, -1));
        } else {
          initializeMoneyInput(input, Number(input.dataset.integerPart || 0));
        }
        return;
      }

      const current = String(Math.trunc(Number(input.dataset.rawValue || 0)));
      initializeMoneyInput(input, Number(current.slice(0, -1) || 0));
    } else {
      initializeMoneyInput(input, parseGameMoney(input.value));
    }
  });

  input.addEventListener("focus", () => input.setAttribute("title", `Valor real: ${getMoneyInputValue(input)}`));
}

function initializeMoneyInput(input, value = 0) {
  if (!input) return;
  setupMoneyInput(input);
  const numericValue = Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
  input.dataset.moneyUpdating = "true";
  input.dataset.rawValue = String(numericValue);
  delete input.dataset.decimalMode;
  delete input.dataset.decimalDigits;
  delete input.dataset.integerPart;
  input.value = formatMoney(numericValue);
  input.setAttribute("title", `Valor real: ${numericValue}`);
  input.dataset.moneyUpdating = "false";
}

function renderDecimalMoneyInput(input, integerPart, decimalDigits) {
  const safeInteger = String(Math.max(0, Number(integerPart) || 0));
  const safeDecimals = String(decimalDigits || "").replace(/\D/g, "").slice(0, 2);
  const numericValue = Number(`${safeInteger}.${safeDecimals || "0"}`);

  input.dataset.moneyUpdating = "true";
  input.dataset.decimalMode = "true";
  input.dataset.integerPart = safeInteger;
  input.dataset.decimalDigits = safeDecimals;
  input.dataset.rawValue = String(numericValue);
  input.value = `${safeInteger},${safeDecimals}`;
  input.setAttribute("title", `Valor real: ${numericValue}`);
  input.dataset.moneyUpdating = "false";
}

function getMoneyInputValue(input) {
  if (!input) return 0;
  return Number(input.dataset.rawValue ?? parseGameMoney(input.value)) || 0;
}

function parseGameMoney(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s/g, "");
  const suffixMatch = normalized.match(/^([\d.,]+)(k+)$/);

  if (suffixMatch) {
    const amount = Number(suffixMatch[1].replace(",", "."));
    const expanded = amount * (1000 ** suffixMatch[2].length);
    return Number.isFinite(expanded) ? Math.round(expanded * 100) / 100 : 0;
  }

  const decimalValue = Number(normalized.replace(",", "."));
  return Number.isFinite(decimalValue) ? Math.round(decimalValue * 100) / 100 : 0;
}

function formatMoney(value = 0) {
  const numericValue = Number(value || 0);
  const sign = numericValue < 0 ? "-" : "";
  let compactValue = Math.abs(numericValue);
  let suffixLevel = 0;

  while (compactValue >= 1000 && suffixLevel < 6) {
    compactValue /= 1000;
    suffixLevel += 1;
  }

  if (!suffixLevel) {
    return `${sign}${new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(compactValue)}`;
  }

  const decimals = compactValue >= 100 ? 0 : compactValue >= 10 ? 1 : 2;
  const formatted = compactValue.toFixed(decimals).replace(/\.0+$|(?<=\.[0-9])0$/g, "");
  return `${sign}${formatted}${"k".repeat(suffixLevel)}`;
}

function formatDecimal(value = 0) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(value || 0));
}

function escapeHtml(value = "") {
  const element = document.createElement("div");
  element.textContent = String(value);
  return element.innerHTML;
}

function matchesContentFilter(type = "", filter) {
  if (filter === "all") return true;
  if (filter === "terror") return type.startsWith("terror");
  if (filter === "md") return type.startsWith("md");
  return type === filter;
}

function formatContentType(type = "") {
  const labels = {
    hunt: "Hunt",
    terror_hard: "Terror (Hard)",
    md_red: "MD Red",
    md_blue: "MD Blue",
    dg_shiny_tentacruel: "DG Shiny Tentacruel",
    legendary_dogs: "Cães Lendários",
    finder_rank_a: "Finder Rank A",
    subject_14: "Subject #14"
  };

  return labels[type] || type;
}

function formatNumber(num) {
  return formatMoney(num);
}

function getChartTheme() {
  const isLight = document.documentElement.dataset.theme === "light";
  return {
    text: isLight ? "#657786" : "#9eb0bf",
    grid: isLight ? "rgba(30, 55, 70, 0.08)" : "rgba(255, 255, 255, 0.06)"
  };
}

function applyChartTheme() {
  Chart.defaults.color = getChartTheme().text;
}
