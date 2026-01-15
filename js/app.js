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

  const statsGrid = document.getElementById('statsGrid');

Object.values(profile.stats).forEach(stat => {
  const statEl = document.createElement('div');
  statEl.className = 'stat';

  const gradientClass = stat.gradient
    ? `gradient-${stat.gradient}`
    : 'gradient-green';

  statEl.innerHTML = `
    <div class="stat-icon">
      <img src="${stat.icon}" alt="${stat.label}">
    </div>

    <div class="stat-info">
      <span class="stat-label gradient-text ${gradientClass}">${stat.label}</span>
      <b class="stat-value">${stat.value}</b>
    </div>
  `;

  statsGrid.appendChild(statEl);
});

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
  
  let CONQUISTAS_DATA = [];

fetch('data/conquistas.json')
  .then(res => res.json())
  .then(data => {
    CONQUISTAS_DATA = data;

    renderConquistasList();

    if (window.renderMetasFromProfile) {
      window.renderMetasFromProfile();
    }
  });

window.renderMetasFromProfile = function () {
  const metasContainer = document.getElementById('metasS');
  metasContainer.innerHTML = '';

  profile.metas.forEach(meta => {
    const card = document.createElement('div');
    card.classList.add('meta-card', meta.status, 'clickable');

    card.addEventListener('click', () => {
      document.querySelector('[data-page="conquistas"]').click();
      setTimeout(() => {
        openConquistaById(meta.link);
      }, 200);
    });

    const conquistaRef = CONQUISTAS_DATA.find(c => c.id === meta.link);

    const gradientClass = conquistaRef?.gradient
      ? `gradient-${conquistaRef.gradient}`
      : 'gradient-green';

    card.innerHTML = `
      <div class="meta-image-wrapper">
        <img src="${meta.image}" class="meta-image">
      </div>

      <div class="meta-info">
        <div class="meta-title gradient-text ${gradientClass}">
          ${meta.title}
        </div>

        ${
          meta.status === 'progress'
            ? `<div class="meta-progress">
                Em progresso - ${meta.progress.current}/${meta.progress.total}
                ${meta.progress.label}
              </div>`
            : `<div class="meta-complete">Concluído</div>`
        }
      </div>

      <img
        src="/assets/icons/arrow leftdown-rightup.png"
        class="meta-arrow"
        alt="Ver conquista"
      />
    `;

    metasContainer.appendChild(card);
  });
};

function openConquistaById(id) {
  const conquista = CONQUISTAS_DATA.find(c => c.id === id);

  if (!conquista) {
    console.warn('Conquista não encontrada:', id);
    return;
  }

  openConquista(conquista);
}

});

// TEAM

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

    const allHelds = [
    poke.heldX,
    poke.heldY,
    ...(poke.inactives || [])
  ];

    const gradientClass = poke.gradient
  ? `gradient-${poke.gradient}`
  : 'gradient-green';

    card.innerHTML = `
  <div class="card-inner">

    <!-- FRENTE -->
    <div class="card-face card-front">
      <div class="pokemon-header">
        <img src="${poke.image}" class="poke-img">
        <div class="pokemon-types">${typeIcons}</div>
      </div>

      <div class="pokemon-name gradient-text ${gradientClass}">
        ${poke.name}
      </div>

      <div class="pokemon-boost gradient-text ${gradientClass}">
        ${poke.boost}
      </div>

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
    </div>

    <!-- VERSO -->
    <div class="card-face card-back">
      <div class="back-header">
        <span class="pokemon-name-back gradient-text ${gradientClass}">
          ${poke.name}
        </span>
      </div>
    <div class="back-gif-wrapper">
      <img 
        src="/assets/ingame_gifs/${poke.name}.gif" 
        class="poke-gif"
        loading="lazy"
      >
      </div>
  </div>
  </div>

  <button class="flip-btn" title="Virar carta">
    <img src="/assets/icons/flip32.png">
  </button>
`;


    grid.appendChild(card);

  const gif = card.querySelector('.poke-gif');
const flipBtns = card.querySelectorAll('.flip-btn');

gif.addEventListener('error', () => {
  // marca o card como "sem gif"
  card.classList.add('no-gif');

  // remove botões de flip
  flipBtns.forEach(btn => btn.remove());

  // remove o verso inteiro (opcional, mas recomendado)
  const back = card.querySelector('.card-back');
  if (back) back.remove();
});

  });

document.addEventListener('click', e => {
  const btn = e.target.closest('.flip-btn');
  if (!btn) return;

  // só funciona no modo cards
  if (!teamGrid.classList.contains('view-grid')) return;

  const card = btn.closest('.pokemon-card');
  if (card.classList.contains('no-gif')) return;
  const gif = card.querySelector('.poke-gif');
  if (!gif) return;

  const wasFlipped = card.classList.contains('flipped');

  card.classList.toggle('flipped');

  // se acabou de virar pro verso
  if (!wasFlipped) {
    const src = gif.getAttribute('src');

    // força reinício do gif
    gif.setAttribute('src', '');
    requestAnimationFrame(() => {
      gif.setAttribute('src', src);
    });
  }
});
});

document.addEventListener('mouseover', e => {
  const held = e.target.closest('.held, .inactive-item, .pokeball, .type-icon, .tooltip-target');
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
  const held = e.target.closest('.held, .inactive-item, .pokeball, .type-icon, .tooltip-target');
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

    if (window.renderMetasFromProfile) {
      window.renderMetasFromProfile();
    }
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
  await processHtmlIncludes(content);

  initPhotoViewers(content);

}

// TREVO

async function processHtmlIncludes(container = document) {
  const includes = container.querySelectorAll('[data-include-html]');
  for (const el of includes) {
    const file = el.getAttribute('data-include-html');
    const html = await fetch(file).then(r => r.text());
    el.innerHTML = html;
  }
}

let globalTooltip = null;

function ensureGlobalTooltip() {
  if (globalTooltip) return;

  globalTooltip = document.createElement('div');
  globalTooltip.id = 'global-tooltip';
  globalTooltip.className = 'tooltip';
  globalTooltip.style.display = 'none';

  document.body.appendChild(globalTooltip);
}
document.addEventListener('mouseover', e => {
  const target = e.target.closest('.tooltip-target');
  if (!target) return;

  ensureGlobalTooltip();

  const text = target.dataset.tooltip;
  if (!text) return;

  globalTooltip.innerHTML = text;
  globalTooltip.style.display = 'block';
  globalTooltip.style.left = '0px';
  globalTooltip.style.right = 'auto';
  globalTooltip.style.transform = 'translateX(20%)';

  const rect = target.getBoundingClientRect();
  const tooltipRect = globalTooltip.getBoundingClientRect();
  const padding = 10;

  let top = rect.top - tooltipRect.height - padding;
  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

  if (left < padding) left = padding;
  if (left + tooltipRect.width > window.innerWidth - padding) {
    left = window.innerWidth - tooltipRect.width - padding;
  }

  if (top < padding) {
    top = rect.bottom + padding;
  }

  globalTooltip.style.top = `${top}px`;
  globalTooltip.style.left = `${left}px`;
});
document.addEventListener('mouseout', e => {
  if (!e.target.closest('.tooltip-target')) return;
  if (!globalTooltip) return;

  globalTooltip.style.display = 'none';
});

// PHOTO VIEWER (CHOSEN)

function initPhotoViewers(container = document) {
  container.querySelectorAll('.photo-viewer').forEach(viewer => {
    const img = viewer.querySelector('.pv-image');
    const prev = viewer.querySelector('.pv-btn.prev');
    const next = viewer.querySelector('.pv-btn.next');

    const images = Array.from(
      viewer.querySelectorAll('.pv-list img')
    ).map(i => i.src);

    if (!images.length) return;

    let index = 0;
    img.src = images[index];

    next?.addEventListener('click', () => {
      index = (index + 1) % images.length;
      img.src = images[index];
    });

    prev?.addEventListener('click', () => {
      index = (index - 1 + images.length) % images.length;
      img.src = images[index];
    });

    img.addEventListener('click', () => {
      openFullscreen(img.src);
    });
  });
}

// fullscreen
function openFullscreen(src) {
  const overlay = document.createElement('div');
  overlay.className = 'pv-fullscreen';
  overlay.innerHTML = `<img src="${src}">`;

  overlay.addEventListener('click', () => overlay.remove());

  document.addEventListener(
    'keydown',
    e => e.key === 'Escape' && overlay.remove(),
    { once: true }
  );

  document.body.appendChild(overlay);
}