import fs from 'fs';
let html = fs.readFileSync('frontend/index.html', 'utf-8');

const modals = fs.readFileSync('scratch/planner_modals.html', 'utf-8');
html = html.replace('<!-- ── MAIN ─────────────────────────────────────────────────────── -->', modals + '\n<!-- ── MAIN ─────────────────────────────────────────────────────── -->');

const jsCode = `
// ── PLANNER LOGIC ──────────────────────────────────────────────────
let PLANNER_DATA = {};
let _currentPlannerDay = null;
let _currentPlannerTarget = null;
let _currentPlannerState = {};

async function fetchPlannerData() {
  try {
    const { data, error } = await window.supabase.from('menu_planner').select('*');
    if (error) throw error;
    PLANNER_DATA = {};
    if (data) {
      data.forEach(d => {
        const parts = d.date.split('-');
        const day = parseInt(parts[2]);
        PLANNER_DATA[day] = d;
      });
    }
  } catch (err) {
    console.error('Error fetching planner:', err);
  }
}

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  const today = new Date().getDate();
  const offset = 2; // Wed 1 July -> Mon=0, Tue=1, Wed=2
  let html = '';
  for (let i = 0; i < offset; i++) html += '<div></div>';
  for (let d = 1; d <= 31; d++) {
    const isToday = d === today;
    const menu = PLANNER_DATA[d];
    
    let lunchName = 'Añadir';
    let dinnerName = 'Añadir';
    
    if (menu) {
       const lr = ALL_RECIPES.find(r => r.id === menu.lunch_recipe_id);
       const dr = ALL_RECIPES.find(r => r.id === menu.dinner_recipe_id);
       if (lr) lunchName = lr.name;
       if (dr) dinnerName = dr.name;
    }

    const hasMenu = menu && (menu.lunch_recipe_id || menu.dinner_recipe_id || menu.breakfast_recipe_id);
    
    html += \`
      <div class="cal-day \${isToday ? 'today' : ''} \${hasMenu && !isToday ? 'has-menu' : ''}"
           onclick="openPlannerDayModal(\${d})">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-bold \${isToday ? 'text-brand bg-brand text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-slate-400'}">\${d}</span>
        </div>
        \${hasMenu ? \`
          <div class="flex-grow flex flex-col justify-end gap-1 mt-1">
            \${menu.lunch_recipe_id ? \`<p class="text-[10px] font-semibold text-brand leading-tight truncate" title="\${lunchName}">🌞 \${lunchName}</p>\` : ''}
            \${menu.dinner_recipe_id ? \`<p class="text-[10px] text-slate-500 leading-tight truncate" title="\${dinnerName}">🌙 \${dinnerName}</p>\` : ''}
          </div>\` : \`
          <div class="flex-grow flex items-end justify-center pb-1">
            <span class="text-[9px] text-slate-200">+ Añadir</span>
          </div>\`}
      </div>\`;
  }
  grid.innerHTML = html;
}

window.openPlannerDayModal = function(d) {
  _currentPlannerDay = d;
  document.getElementById('planner-day-date').textContent = \`\${d} de Julio, 2026\`;
  document.getElementById('planner-day-input').value = d;
  
  const menu = PLANNER_DATA[d] || {};
  _currentPlannerState = {
    breakfast_recipe_id: menu.breakfast_recipe_id || null,
    lunch_recipe_id: menu.lunch_recipe_id || null,
    dinner_recipe_id: menu.dinner_recipe_id || null,
    lunch_players: menu.lunch_players || 0,
    lunch_halal: menu.lunch_halal || 0,
    lunch_kosher: menu.lunch_kosher || 0,
    lunch_vegan: menu.lunch_vegan || 0,
    lunch_allergies: menu.lunch_allergies || '',
    dinner_players: menu.dinner_players || 0,
    dinner_halal: menu.dinner_halal || 0,
    dinner_kosher: menu.dinner_kosher || 0,
    dinner_vegan: menu.dinner_vegan || 0,
    dinner_allergies: menu.dinner_allergies || ''
  };
  
  ['lunch', 'dinner'].forEach(m => {
    document.getElementById(\`planner-\${m}-players\`).value = _currentPlannerState[\`\${m}_players\`];
    document.getElementById(\`planner-\${m}-halal\`).value = _currentPlannerState[\`\${m}_halal\`];
    document.getElementById(\`planner-\${m}-kosher\`).value = _currentPlannerState[\`\${m}_kosher\`];
    document.getElementById(\`planner-\${m}-vegan\`).value = _currentPlannerState[\`\${m}_vegan\`];
    document.getElementById(\`planner-\${m}-allergies\`).value = _currentPlannerState[\`\${m}_allergies\`];
  });
  
  renderPlannerTarget('breakfast');
  renderPlannerTarget('lunch');
  renderPlannerTarget('dinner');
  
  document.getElementById('modal-planner-day').classList.remove('hidden');
  document.getElementById('modal-planner-day').classList.add('flex');
}

window.closePlannerDayModal = function() {
  document.getElementById('modal-planner-day').classList.add('hidden');
  document.getElementById('modal-planner-day').classList.remove('flex');
}

window.renderPlannerTarget = function(target) {
  const recipeId = _currentPlannerState[\`\${target}_recipe_id\`];
  const btn = document.getElementById(\`planner-\${target}-btn\`);
  const card = document.getElementById(\`planner-\${target}-card\`);
  const img = document.getElementById(\`planner-\${target}-img\`);
  const name = document.getElementById(\`planner-\${target}-name\`);
  
  if (recipeId) {
    const r = ALL_RECIPES.find(rec => rec.id === recipeId);
    if (r) {
      btn.classList.add('hidden');
      card.classList.remove('hidden');
      name.textContent = r.name;
      if (r.image_url) {
        img.src = r.image_url;
        img.classList.remove('hidden');
      } else {
        img.classList.add('hidden');
      }
    }
  } else {
    btn.classList.remove('hidden');
    card.classList.add('hidden');
  }
}

window.clearPlannerRecipe = function(target) {
  _currentPlannerState[\`\${target}_recipe_id\`] = null;
  renderPlannerTarget(target);
}

window.openRecipeSelector = function(target) {
  _currentPlannerTarget = target;
  document.getElementById('recipe-selector-search').value = '';
  filterRecipeSelector('');
  document.getElementById('modal-recipe-selector').classList.remove('hidden');
  document.getElementById('modal-recipe-selector').classList.add('flex');
}

window.closeRecipeSelector = function() {
  document.getElementById('modal-recipe-selector').classList.add('hidden');
  document.getElementById('modal-recipe-selector').classList.remove('flex');
}

window.filterRecipeSelector = function(query) {
  const grid = document.getElementById('recipe-selector-grid');
  const q = query.toLowerCase();
  
  const filtered = ALL_RECIPES.filter(r => 
    (r.name && r.name.toLowerCase().includes(q)) || 
    (r.category && r.category.toLowerCase().includes(q))
  );
  
  grid.innerHTML = filtered.map(r => \`
    <div class="card overflow-hidden cursor-pointer hover:border-brand transition-colors flex flex-col h-full" onclick="selectRecipeForPlanner('\${r.id}')">
      \${r.image_url ? \`<img src="\${r.image_url}" class="w-full h-24 object-cover" onerror="this.style.display='none'" />\` : \`<div class="w-full h-24 bg-slate-100 flex items-center justify-center text-slate-400"><span class="material-symbols-outlined text-3xl">restaurant</span></div>\`}
      <div class="p-3">
        <p class="text-xs font-bold text-slate-900 leading-tight">\${r.name}</p>
        <p class="text-[10px] text-slate-500 mt-1">\${r.category}</p>
      </div>
    </div>
  \`).join('');
}

window.selectRecipeForPlanner = function(recipeId) {
  _currentPlannerState[\`\${_currentPlannerTarget}_recipe_id\`] = recipeId;
  renderPlannerTarget(_currentPlannerTarget);
  closeRecipeSelector();
}

window.savePlannerDay = async function() {
  const btn = document.getElementById('planner-save-btn');
  const spinner = document.getElementById('planner-save-spinner');
  const text = document.getElementById('planner-save-text');
  
  btn.disabled = true;
  spinner.classList.remove('hidden');
  text.textContent = 'Guardando...';
  
  const d = _currentPlannerDay;
  const dateStr = \`2026-07-\${d.toString().padStart(2, '0')}\`;
  
  ['lunch', 'dinner'].forEach(m => {
    _currentPlannerState[\`\${m}_players\`] = parseInt(document.getElementById(\`planner-\${m}-players\`).value) || 0;
    _currentPlannerState[\`\${m}_halal\`] = parseInt(document.getElementById(\`planner-\${m}-halal\`).value) || 0;
    _currentPlannerState[\`\${m}_kosher\`] = parseInt(document.getElementById(\`planner-\${m}-kosher\`).value) || 0;
    _currentPlannerState[\`\${m}_vegan\`] = parseInt(document.getElementById(\`planner-\${m}-vegan\`).value) || 0;
    _currentPlannerState[\`\${m}_allergies\`] = document.getElementById(\`planner-\${m}-allergies\`).value.trim();
  });
  
  const payload = {
    date: dateStr,
    breakfast_recipe_id: _currentPlannerState.breakfast_recipe_id,
    lunch_recipe_id: _currentPlannerState.lunch_recipe_id,
    dinner_recipe_id: _currentPlannerState.dinner_recipe_id,
    lunch_players: _currentPlannerState.lunch_players,
    lunch_halal: _currentPlannerState.lunch_halal,
    lunch_kosher: _currentPlannerState.lunch_kosher,
    lunch_vegan: _currentPlannerState.lunch_vegan,
    lunch_allergies: _currentPlannerState.lunch_allergies,
    dinner_players: _currentPlannerState.dinner_players,
    dinner_halal: _currentPlannerState.dinner_halal,
    dinner_kosher: _currentPlannerState.dinner_kosher,
    dinner_vegan: _currentPlannerState.dinner_vegan,
    dinner_allergies: _currentPlannerState.dinner_allergies
  };
  
  try {
    const { error } = await supabase.from('menu_planner').upsert(payload, { onConflict: 'date' });
    if (error) throw error;
    
    PLANNER_DATA[d] = payload;
    renderCalendar();
    closePlannerDayModal();
    toast('✅ Día actualizado');
  } catch(err) {
    console.error(err);
    toast('❌ Error: ' + err.message);
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
    text.textContent = 'Guardar Día';
  }
}
`;

// Replace the old renderCalendar block with the new one + JS logic
const oldCalendarRegex = /\/\/ ── CALENDAR ──────────────────────────────────────────────────────[\s\S]*?grid\.innerHTML = html;\n\}/;
html = html.replace(oldCalendarRegex, jsCode);

fs.writeFileSync('frontend/index.html', html);
