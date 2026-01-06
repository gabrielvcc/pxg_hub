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

// CARREGAR PERFIL
fetch('data/profile.json')
  .then(res => res.json())
  .then(data => {

    // Info básica
    document.getElementById('username').innerText = data.username;
    document.getElementById('title').innerText = data.title;
    document.getElementById('avatar').src = data.avatar;

    // Stats
    document.getElementById('level').innerText = data.stats.level;
    document.getElementById('captures').innerText = data.stats.captures;
    document.getElementById('profession').innerText = data.stats.profession;
    document.getElementById('nightmare').innerText = data.stats.nightmare;
    document.getElementById('achievements').innerText = data.stats.achievements;
    document.getElementById('pokelog').innerText = data.stats.pokelog;
    document.getElementById('fishing').innerText = data.stats.fishing;
    document.getElementById('wins').innerText = data.stats.wins;

    // Badges
    const badgesDiv = document.getElementById('badges');
    data.badges.forEach(b => {
      const img = document.createElement('img');
      img.src = b;
      img.className = 'badge';
      badgesDiv.appendChild(img);
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

  // Espera renderizar pra medir
  requestAnimationFrame(() => {
    const rect = tooltip.getBoundingClientRect();
    const padding = 8;

    // Passou da esquerda
    if (rect.left < padding) {
      tooltip.style.left = '0';
      tooltip.style.transform = 'translateX(0)';
    }

    // Passou da direita
    if (rect.right > window.innerWidth - padding) {
      tooltip.style.left = '100%';
      tooltip.style.transform = 'translateX(-100%)';
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

