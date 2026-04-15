import { auth, login, onUserChange } from "./firebase.js";
import { db } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_EMAIL = "gabrielvarnes1@gmail.com";

let itemsData = {};

// INIT
document.addEventListener("DOMContentLoaded", async () => {
  await loadItems();

  setupAuth();
  setupUI();
  setupSave();
});

// ================= AUTH =================
function setupAuth() {
  const avatar = document.getElementById("userAvatar");
  const dropdown = document.querySelector(".user-dropdown");
  const logoutBtn = document.getElementById("logoutBtn");

  let currentUser = null;

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

    if (user?.email === ADMIN_EMAIL) {
      document.body.classList.add("admin");
    } else {
      document.body.classList.remove("admin");
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
  const entryType = document.getElementById("entryType");
  const textarea = document.getElementById("lootInput");
  const manualForm = document.getElementById("manualForm");

  const itemsContainer = document.getElementById("itemsContainer");
  const costContainer = document.getElementById("costContainer");

  const addItemBtn = document.getElementById("addItemBtn");
  const addCostBtn = document.getElementById("addCostBtn");

  openBtn.onclick = () => modal.classList.remove("hidden");

  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  };

  entryType.onchange = () => {
    if (entryType.value === "hunt") {
      textarea.classList.add("hidden");
      manualForm.classList.remove("hidden");
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
  `;

  container.appendChild(row);

  const input = row.querySelector(".item-search");
  const dropdown = row.querySelector(".item-dropdown");

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

    const gainData = calculateTotal(parsedLoot, itemsData, "gain");
    const costData = calculateTotal(parsedCosts, itemsData, "cost");

    const totalProfit = gainData.total;
    const totalCost = costData.total;
    const netProfit = totalProfit - totalCost;

    const missingItems = [
      ...gainData.missingItems,
      ...costData.missingItems
    ];

    try {
      await addDoc(collection(db, "profits"), {
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
        createdAt: serverTimestamp()
      });

      showToast("Salvo com sucesso!");
      modal.classList.add("hidden");

      // RESET
      textarea.value = "";
      document.getElementById("itemsContainer").innerHTML = "";
      document.getElementById("costContainer").innerHTML = "";
      entryType.value = "";
      textarea.classList.remove("hidden");
      document.getElementById("manualForm").classList.add("hidden");

    } catch (err) {
      console.error(err);
      alert("Erro ao salvar");
    }
  };
}

// ================= DATA =================
async function loadItems() {
  const res = await fetch("/data/items.json");
  itemsData = await res.json();
}

function createDropdownOptions(container, filter = "", typeFilter = null) {
  container.innerHTML = "";

  const filterLower = filter.toLowerCase();

  Object.values(itemsData).forEach(item => {

    if (typeFilter && item.type !== typeFilter && item.type !== "both") return;

    if (!item.name.toLowerCase().includes(filterLower)) return;

    const option = document.createElement("div");
    option.className = "item-option";

    option.innerHTML = `
      <img src="${item.image}">
      <span>${item.name}</span>
    `;

    option.onclick = () => {
  const wrapper = container.parentElement;
  const input = wrapper.querySelector(".item-search");
  const preview = wrapper.querySelector(".item-preview");

  input.value = item.name;
  input.dataset.selected = item.name;

  // 🔥 MOSTRAR IMAGEM
  preview.src = item.image;
  preview.classList.remove("hidden");

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

function calculateTotal(data, itemsData, mode) {
  let total = 0;
  const usedPrices = {};
  const missingItems = [];

  for (const itemName in data) {
    const qty = data[itemName];

    const item = Object.values(itemsData).find(i => i.name === itemName);

    if (!item) {
      usedPrices[itemName] = 0;
      missingItems.push(itemName);
      continue;
    }

    const price = mode === "gain" ? item.sell : item.buy;

    if (price == null) {
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