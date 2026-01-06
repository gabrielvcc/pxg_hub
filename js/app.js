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

// PERFIL
Promise.all([
  fetch('data/profile.json').then(r => r.json()),
  fetch('data/helds.json').then(r => r.json())
]).then(([profile, helds]) => {

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
  card.classList.add('meta-card', meta.status);

  if (meta.status === 'completed' && meta.link) {
    card.classList.add('clickable');
    card.addEventListener('click', () => {
      document.querySelector('[data-page="conquistas"]').click();
      if (meta.link.includes('#')) {
        setTimeout(() => {
          location.hash = meta.link.split('#')[1];
        }, 200);
      }
    });
  }

  card.innerHTML = `
    <img src="${meta.image}" class="meta-image">

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

