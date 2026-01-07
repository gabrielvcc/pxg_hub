// NAVEGAÇÃO
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(i => i.classList.remove('active'));
    pages.forEach(p => p.classList.remove('active'));

    item.classList.add('active');
    document.getElementById(item.dataset.page).classList.add('active');
  });
});

/// PROFILE --------------------------------------------------------------------------------
Promise.all([
  fetch('data/profile.json').then(r => r.json()),
  fetch('data/helds.json').then(r => r.json()),
  fetch('data/types.json').then(r => r.json())
]).then(([profile, helds, types]) => {

  // Info básica
  document.getElementById('username').innerText = profile.username;
  document.getElementById('title').innerText = profile.title;
  document.getElementById('avatar').src = profile.avatar;

  // Stats
  document.getElementById('level').innerText = profile.stats.level;
  document.getElementById('captures').innerText = profile.stats.captures;
  document.getElementById('profession').innerText = profile.stats.profession;
  document.getElementById('nightmare').innerText = profile.stats.nightmare;
  document.getElementById('achievements').innerText = profile.stats.achievements;
  document.getElementById('pokelog').innerText = profile.stats.pokelog;
  document.getElementById('fishing').innerText = profile.stats.fishing;
  document.getElementById('wins').innerText = profile.stats.wins;

  const mainTypeKey = profile.main_type; // "grass"
const mainType = types[mainTypeKey];

if (mainType) {
  const mainTypeImg = document.getElementById('main_type');
  mainTypeImg.src = mainType.image;
  mainTypeImg.alt = mainType.name;
}

  // DEVICE

  const deviceDiv = document.getElementById('deviceHelds');

  profile.device.forEach(id => {
    const held = helds[id];
    if (!held) return;

    deviceDiv.innerHTML += `
      <div class="held">
        <img src="${held.image}">
        <div class="tooltip">
          <b>${held.name}</b><br>${held.description}
        </div>
      </div>
    `;
  });

  // METAS

  const metasContainer = document.getElementById('metasS');

profile.metas.forEach(meta => {
  const card = document.createElement('div');
  card.classList.add('meta-card', meta.status, 'clickable');

  card.addEventListener('click', () => {
  document.querySelector('[data-page="conquistas"]').click();
  setTimeout(() => {
    openConquistaById(meta.link);
  }, 200);
});

function openConquistaById(id) {
  const conquista = CONQUISTAS_DATA.find(c => c.id === id);

  if (!conquista) {
    console.warn('Conquista não encontrada:', id);
    return;
  }

  openConquista(conquista);
}



  card.innerHTML = `
    <div class="meta-image-wrapper">
      <img src="${meta.image}" class="meta-image">
    </div>

    <div class="meta-info">
      <div class="meta-title">${meta.title}</div>
      ${
        meta.status === 'progress'
          ? `<div class="meta-progress">
              Em progresso - ${meta.progress.current}/${meta.progress.total}
              ${meta.progress.label}
            </div>`
          : `<div class="meta-complete">Concluído</div>`
          
      }
    </div>
    <img src="/assets/icons/arrow leftdown-rightup.png" class="meta-arrow" alt="Ver conquista"/>

  `;

  metasContainer.appendChild(card);
});

});

teamGrid.classList.add('view-grid');

  Promise.all([
  fetch('data/team.json').then(r => r.json()),
  fetch('data/helds.json').then(r => r.json()),
  fetch('data/pokeballs.json').then(r => r.json()),
  fetch('data/types.json').then(r => r.json())
]).then(([team, helds, pokeballs, types]) => {

  const grid = document.getElementById('teamGrid');

  team.sort((a, b) => {
    const pA = a.priority ?? 999;
    const pB = b.priority ?? 999;
    return pA - pB;
  });

  team.forEach(poke => {
    const card = document.createElement('div');
    card.className = 'pokemon-card';
    if (poke.gradient) {
    card.classList.add(`gradient-${poke.gradient}`);
}

const typeIcons = (poke.types || [])
  .slice(0, 2)
  .map(t => {
    const type = types[t];
    if (!type) return '';

    return `
      <div class="type-icon">
        <img src="${type.image}" alt="${type.name}" title="${type.name}">
        <div class="tooltip">
          <b>${type.name}</b>
        </div>
      </div>
    `;
  })
  .join('');

//  HELDS X/Y

    const allHelds = [
    poke.heldX,
    poke.heldY,
    ...(poke.inactives || [])
  ];

    const gradientClass = poke.gradient
  ? `gradient-${poke.gradient}`
  : 'gradient-green';

    card.innerHTML = `
      <div class="pokemon-header">
        <img src="${poke.image}" class="poke-img">
        <div class="pokemon-types">${typeIcons}</div>
      </div>

      <div class="pokemon-name gradient-text ${gradientClass}">${poke.name}</div>
      <div class="pokemon-boost gradient-text ${gradientClass}">${poke.boost}</div>

      <div class="helds">
  ${allHelds.map(key => {
    const item = helds[key];
    if (!item) return '';

    return `
      <div class="held">
        <img src="${item.image}">
        <div class="tooltip">
          <b>${item.name}</b><br>${item.description}
        </div>
      </div>
    `;
  }).join('')}
</div>
      <div class="pokeball">
        <img src="${pokeballs[poke.pokeball].image}">
        <div class="tooltip">
          <b>${pokeballs[poke.pokeball].name}</b>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

});
document.addEventListener('mouseover', e => {
  const held = e.target.closest('.held, .inactive-item, .pokeball, .type-icon');
  if (!held) return;

  const tooltip = held.querySelector('.tooltip');
  if (!tooltip) return;

  tooltip.style.display = 'block';

  requestAnimationFrame(() => {
    const rect = tooltip.getBoundingClientRect();
    const padding = 8;

    const container = document.querySelector('.content'); // ⚠️ ajusta se necessário
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    // Passou da esquerda do conteúdo
    if (rect.left < containerRect.left + padding) {
      tooltip.style.left = '0';
      tooltip.style.right = 'auto';
      tooltip.style.transform = 'translateX(0)';
    }

    // Passou da direita do conteúdo
    if (rect.right > containerRect.right - padding) {
      tooltip.style.left = 'auto';
      tooltip.style.right = '0';
      tooltip.style.transform = 'translateX(0)';
    }
  });
});


document.addEventListener('mouseout', e => {
  const held = e.target.closest('.held, .inactive-item, .pokeball, .type-icon');
  if (!held) return;

  const tooltip = held.querySelector('.tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%)';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const viewButtons = document.querySelectorAll('.view-btn');
  const teamGrid = document.getElementById('teamGrid');

  if (!teamGrid || !viewButtons.length) return;

  viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      viewButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      teamGrid.classList.remove('view-grid', 'view-list');
      teamGrid.classList.add(`view-${btn.dataset.view}`);
    });
  });
});

// CONQUISTAS --------------------------------------------------------------------------

let CONQUISTAS_DATA = [];

fetch('data/conquistas.json')
  .then(res => res.json())
  .then(data => {
    CONQUISTAS_DATA = data;
    renderConquistasList();
  });

  function renderConquistasList() {
  const header = document.getElementById('conquistasHeader');
  const content = document.getElementById('conquistasContent');

  // Header padrão
  header.innerHTML = `<h1>Conquistas</h1>`;

  // Conteúdo volta a ser o board
  content.innerHTML = `
    <div class="conquistas-board" id="conquistasBoard"></div>
  `;

  const board = document.getElementById('conquistasBoard');

  CONQUISTAS_DATA.forEach(c => {
    const card = document.createElement('div');

    const gradientClass = c.gradient
  ? `gradient-${c.gradient}`
  : 'gradient-green';
  
    card.className = `conquista-card gradient-${c.gradient}`;
    card.dataset.id = c.id;

    card.innerHTML = `
      <img src="${c.image}">
      <h3 class="gradient-text ${gradientClass}">${c.title}</h3>
      <p>${c.description}</p>
    `;

    card.addEventListener('click', () => openConquista(c));
    board.appendChild(card);
  });
}

async function openConquista(conquista) {
  const header = document.getElementById('conquistasHeader');
  const content = document.getElementById('conquistasContent');

  // Header vira "Voltar + título"
  header.innerHTML = `
    <button class="back-btn"><img src="/assets/icons/left.png" alt="Seta" class="back-icon">Voltar</button>
  `;

  header.querySelector('.back-btn').addEventListener('click', () => {
    renderConquistasList();
  });

  // Conteúdo vira o viewer
  content.innerHTML = `<div class="conquista-viewer">Carregando...</div>`;

  const md = await fetch(`${conquista.file}`).then(r => r.text());

  content.innerHTML = `
    <div class="conquista-viewer">
      ${marked.parse(md)}
    </div>
  `;
}
