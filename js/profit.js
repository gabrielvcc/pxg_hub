import { auth, login, onUserChange } from "./firebase.js";

// BOTÃO LOGIN
const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
  loginBtn.onclick = login;
}

const ADMIN_EMAIL = "gabrielvarnes1@gmail.com";

onUserChange((user) => {
  if (!user) {
    document.body.classList.remove("admin");
    return;
  }

  console.log("Logado como:", user.email);

  if (user.email === ADMIN_EMAIL) {
    document.body.classList.add("admin");
  } else {
    document.body.classList.remove("admin");
  }
});

function parseLoot(text) {
  // remove "Você recebeu:" e horário
  const clean = text
    .replace(/^\d{2}:\d{2}\sVocê recebeu:\s?/i, "")
    .trim();

  // separa por vírgula e " e "
  const parts = clean.split(/,\s*|\s+e\s+/);

  const loot = {};

  parts.forEach(part => {
    part = part.trim().replace(/\.$/, "");

    // tenta pegar quantidade
    const match = part.match(/^(\d+)\s+(.*)$/);

    let qty = 1;
    let name = part;

    if (match) {
      qty = parseInt(match[1]);
      name = match[2];
    }

    // normalização simples (plural → singular)
    name = name
      .replace(/s$/i, "") // remove plural simples
      .replace(/stones$/i, "stone")
      .replace(/shards$/i, "shard")
      .replace(/gems$/i, "gem");

    // soma se repetir
    if (loot[name]) {
      loot[name] += qty;
    } else {
      loot[name] = qty;
    }
  });

  return loot;
}

document.getElementById("saveBtn").onclick = () => {
  const text = document.getElementById("lootInput").value;

  const parsed = parseLoot(text);

  console.log(parsed);
};