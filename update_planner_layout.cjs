const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

// 1. Remove the old recipe selector overlay completely since it's going into the main planner screen
html = html.replace(/<!-- ── RECIPE SELECTOR \(SIDEBAR\/BOTTOM SHEET\) ──(.*?)<!-- ── MAIN ──/s, '<!-- ── MAIN ──');

// 2. Change screen-planner to be a flex layout and inject the dark sidebar
html = html.replace(
  /<div id="screen-planner" class="screen">/s,
  `<div id="screen-planner" class="screen hidden">
    <div class="flex gap-6 h-[calc(100vh-140px)]">
      <div class="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-none pb-12">`
);

html = html.replace(
  /    <div class="md:hidden flex flex-col gap-3 mt-4" id="cal-list-mobile"><\/div>\n\n  <\/div>/,
  `    <div class="md:hidden flex flex-col gap-3 mt-4" id="cal-list-mobile"></div>
      </div>
      
      <!-- DESKTOP CATALOG SIDEBAR (Dark UI) -->
      <aside class="hidden xl:flex w-[340px] flex-shrink-0 bg-[#262626] rounded-2xl flex-col shadow-xl sticky top-0 h-full overflow-hidden">
        <div class="p-5 pb-3 flex justify-between items-center">
          <h2 class="text-xl font-bold text-white flex items-center gap-2"><span class="material-symbols-outlined">menu_book</span> Catalog</h2>
          <span class="material-symbols-outlined text-slate-400">search</span>
        </div>
        <div class="px-5 mb-4">
          <input type="text" id="recipe-selector-search" onkeyup="filterRecipeSelector(this.value)" placeholder="Search recipes..." class="w-full bg-[#3a3b3f] text-white placeholder-slate-400 border-none rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-brand" />
        </div>
        <div class="px-5 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none pb-2" id="recipe-selector-categories">
          <!-- Populated via JS -->
        </div>
        <div class="flex-1 overflow-y-auto px-5 pb-5 flex flex-col gap-4 mt-2" id="recipe-selector-grid">
          <!-- Populated via JS -->
        </div>
      </aside>
    </div>
  </div>`
);

// 3. Update the applyRecipeSelectorFilters for the dark theme cards and drag functionality
html = html.replace(/grid\.innerHTML = filtered\.map\(r => `\n    <div class="card overflow-hidden(.*?)<\/div>\n  `\)\.join\(''\);/s,
`grid.innerHTML = filtered.map(r => \`
    <div class="bg-[#1e1e1e] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform duration-200 flex flex-col relative" draggable="true" ondragstart="dragRecipe(event, '\${r.id}')" onclick="selectRecipeForPlanner('\${r.id}')">
      \${r.image_url ? \`<img src="\${r.image_url}" class="w-full h-32 object-cover" onerror="this.style.display='none'" />\` : \`<div class="w-full h-32 bg-[#3a3b3f] flex items-center justify-center text-slate-500"><span class="material-symbols-outlined text-4xl">restaurant</span></div>\`}
      <div class="absolute top-2 left-2 bg-[#1e1e1e]/90 text-white backdrop-blur-sm px-2 py-0.5 rounded shadow-sm border border-white/10 flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full \${r.category === 'Vegetariano' ? 'bg-green-400' : 'bg-brand'}"></span>
        <span class="text-[9px] font-bold uppercase tracking-wider">\${r.category}</span>
      </div>
      <div class="p-3 flex flex-col justify-center">
        <p class="text-sm font-semibold text-white leading-snug line-clamp-2">\${r.name}</p>
      </div>
    </div>
  \`).join('');`);

// 4. Update renderRecipeSelectorCategories for dark pills
html = html.replace(/let html = `<button onclick="setRecipeSelectorCategory\(''\)" class="px-3 py-1\.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 \${_currentRecipeSelectorCat === '' \? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">Todas<\/button>`;/,
`let html = \`<button onclick="setRecipeSelectorCategory('')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 \${_currentRecipeSelectorCat === '' ? 'bg-[#5e6ad2] text-white shadow-sm' : 'bg-[#3f4044] text-gray-300 hover:bg-[#4a4b4f]'}">Todas</button>\`;`);

html = html.replace(/html \+= `<button onclick="setRecipeSelectorCategory\('\${c\.id}'\)" class="px-3 py-1\.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 \${isSelected \? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">\${c\.name}<\/button>`;/,
`html += \`<button onclick="setRecipeSelectorCategory('\${c.id}')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 \${isSelected ? 'bg-[#5e6ad2] text-white shadow-sm' : 'bg-[#3f4044] text-gray-300 hover:bg-[#4a4b4f]'}">\${c.name}</button>\`;`);

// 5. Update renderCalendar to support drop targets
html = html.replace(/<div class="cal-day \${isToday \? 'today' : ''} \${hasMenu && !isToday \? 'has-menu' : ''}"\n           onclick="openPlannerDayModal\(\${d}\)">/s,
`<div class="cal-day \${isToday ? 'today' : ''} flex flex-col h-full min-h-[120px] relative transition-colors" ondragover="allowDrop(event)" ondragleave="leaveDrop(event)" ondrop="dropRecipe(event, '\${d}')">
        <!-- Overlay drop mask -->
        <div class="absolute inset-0 bg-brand/10 border-2 border-brand border-dashed rounded-lg opacity-0 pointer-events-none transition-opacity drop-mask z-10 flex items-center justify-center font-bold text-brand">Asignar</div>
        
        <div class="flex-1" onclick="openPlannerDayModal(\${d})">`);

// Close the flex-1 wrapper in cal-day
html = html.replace(/<div class="flex-grow flex items-end justify-center pb-1">\n            <span class="text-\[9px\] text-slate-200">\+ Añadir<\/span>\n          <\/div>`}/s,
`<div class="flex-grow flex items-end justify-center pb-1">
            <span class="text-[9px] text-slate-300 hover:text-brand transition-colors">+ Añadir</span>
          </div>\`
        }</div>`);

// 6. Inject Drag and Drop JS
html = html.replace(/window\.openRecipeSelector = function\(target\) {/s,
`window.allowDrop = function(ev) {
  ev.preventDefault();
  ev.currentTarget.querySelector('.drop-mask').classList.remove('opacity-0');
}
window.leaveDrop = function(ev) {
  ev.currentTarget.querySelector('.drop-mask').classList.add('opacity-0');
}
window.dragRecipe = function(ev, id) {
  ev.dataTransfer.setData("recipe_id", id);
}
window.dropRecipe = async function(ev, d) {
  ev.preventDefault();
  ev.currentTarget.querySelector('.drop-mask').classList.add('opacity-0');
  
  const recipeId = ev.dataTransfer.getData("recipe_id");
  if (!recipeId) return;
  
  const dateStr = \`2026-07-\${String(d).padStart(2, '0')}\`;
  
  toast('Asignando...');
  
  // Guardar en la cena si es tarde, o almuerzo por defecto
  const mealType = 'lunch'; 
  
  const payload = {
    date: dateStr,
    [mealType + '_recipe_id']: recipeId
  };
  
  try {
     const {error} = await supabase.from('menu_planner').upsert(payload, {onConflict: 'date'});
     if(error) throw error;
     await fetchPlannerData();
     renderCalendar();
     toast('✅ Receta asignada al Almuerzo (Doble clic en el día para moverla)');
  } catch(e) {
     toast('❌ Error: ' + e.message);
  }
}

window.openRecipeSelector = function(target) {`);

// 7. Remove the openRecipeSelector logic that played with body classes (since we no longer use a modal overlay for it)
html = html.replace(/window\.openRecipeSelector = function\(target\) \{.*?\n\}/s, 
`window.openRecipeSelector = function(target) {
  _currentPlannerTarget = target;
  _currentRecipeSelectorCat = '';
  _currentRecipeSelectorQuery = '';
  // In mobile we could open a modal here, but the user explicitly requested drag and drop for desktop.
  // For mobile, we should show a prompt to use the desktop version or a simplified selector if needed.
  // But let's just use the existing logic if they click the button in modal: 
  // We can just scroll to the sidebar on desktop.
  const sidebar = document.getElementById('recipe-selector-search');
  if (sidebar && window.innerWidth >= 1280) {
     sidebar.focus();
     toast('Selecciona una receta del catálogo lateral');
     closePlannerDayModal();
  } else {
     toast('El selector visual es exclusivo de pantallas grandes. Arrastra desde el catálogo lateral.', 'info');
  }
}`);


fs.writeFileSync('frontend/index.html', html);
