const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

// Inject the mobile bottom sheet just before <div id="main-content-area"
const mobileModalStr = `
<!-- ── RECIPE SELECTOR (MOBILE BOTTOM SHEET ONLY) ─────────────────────────────────────── -->
<div id="recipe-selector-overlay" class="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[1050] transition-opacity duration-300 opacity-0 pointer-events-none xl:hidden" onclick="closeRecipeSelector()"></div>

<div id="modal-recipe-selector" class="fixed z-[1100] bg-white shadow-2xl transition-transform duration-300 flex flex-col inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh] translate-y-full xl:hidden">
  
  <div class="w-12 h-1 bg-slate-300 rounded-full mx-auto mt-3 mb-2 flex-shrink-0"></div>
  
  <div class="p-4 flex-shrink-0">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-bold text-slate-900" style="font-family:Outfit">Seleccionar Receta</h3>
      <button onclick="closeRecipeSelector()" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"><span class="material-symbols-outlined">close</span></button>
    </div>
    
    <div class="mb-3">
      <input type="text" id="mobile-recipe-selector-search" onkeyup="filterMobileRecipeSelector(this.value)" placeholder="Buscar por nombre o familia..." class="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-slate-50 focus:bg-white transition-colors" />
    </div>
    
    <div id="mobile-recipe-selector-categories" class="flex overflow-x-auto whitespace-nowrap scrollbar-none gap-2 pb-1">
    </div>
  </div>
  
  <div class="flex-1 overflow-y-auto p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start" id="mobile-recipe-selector-grid">
  </div>
</div>
`;

if (!html.includes('id="modal-recipe-selector"')) {
  html = html.replace(/<div id="main-content-area"/, mobileModalStr + '\n<div id="main-content-area"');
}

// Fix applyRecipeSelectorFilters to also populate mobile if visible
const fixFiltersJS = `
window.applyRecipeSelectorFilters = function() {
  const q = _currentRecipeSelectorQuery.toLowerCase();
  
  const filtered = (typeof RECIPES !== 'undefined' ? RECIPES : []).filter(r => {
    const matchesSearch = (r.name && r.name.toLowerCase().includes(q)) || (r.category && r.category.toLowerCase().includes(q));
    const matchesCat = _currentRecipeSelectorCat === '' || r.category_id === _currentRecipeSelectorCat;
    return matchesSearch && matchesCat;
  });
  
  // Render Desktop Sidebar
  const grid = document.getElementById('recipe-selector-grid');
  if (grid) {
      grid.innerHTML = filtered.map(r => \`
        <div class="bg-[#1e1e1e] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform duration-200 flex flex-col relative" draggable="true" ondragstart="dragRecipe(event, '\${r.id}')" onclick="selectRecipeForPlanner('\${r.id}')">
          \${r.image_url ? \`<img src="\${r.image_url}" class="w-full h-32 object-cover" onerror="this.style.display='none'" />\` : \`<div class="w-full h-32 bg-[#3a3b3f] flex items-center justify-center text-slate-500"><span class="material-symbols-outlined text-4xl">restaurant</span></div>\`}
          <div class="absolute top-2 right-2 bg-[#1e1e1e]/90 text-white backdrop-blur-sm px-2 py-0.5 rounded shadow-sm border border-white/10 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full \${r.category === 'Vegetariano' ? 'bg-green-400' : 'bg-brand'}"></span>
            <span class="text-[9px] font-bold uppercase tracking-wider">\${r.category}</span>
          </div>
          <div class="p-3 flex flex-col justify-center">
            <p class="text-sm font-semibold text-white leading-snug line-clamp-2">\${r.name}</p>
          </div>
        </div>
      \`).join('');
  }

  // Render Mobile Bottom Sheet
  const mGrid = document.getElementById('mobile-recipe-selector-grid');
  if (mGrid) {
      mGrid.innerHTML = filtered.map(r => \`
        <div class="card overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-200 flex flex-col h-full relative" onclick="selectRecipeForPlanner('\${r.id}')">
          \${r.image_url ? \`<img src="\${r.image_url}" class="w-full h-28 object-cover rounded-t-lg" onerror="this.style.display='none'" />\` : \`<div class="w-full h-28 bg-slate-100 flex items-center justify-center text-slate-400 rounded-t-lg"><span class="material-symbols-outlined text-4xl">restaurant</span></div>\`}
          <div class="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border border-slate-100/50">
            <span class="text-[10px] font-bold text-slate-700 uppercase tracking-wider">\${r.category}</span>
          </div>
          <div class="p-2 bg-white flex-1 flex flex-col justify-center">
            <p class="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">\${r.name}</p>
          </div>
        </div>
      \`).join('');
  }
}
`;

html = html.replace(/window\.applyRecipeSelectorFilters = function\(\) \{[\s\S]*?\}\n/s, fixFiltersJS + '\n');

// Update render categories to also do mobile
const renderCatsJs = `
window.renderRecipeSelectorCategories = function() {
  const safeCategories = (typeof RECIPE_CATEGORIES !== 'undefined') ? RECIPE_CATEGORIES : [];
  
  // Desktop
  const container = document.getElementById('recipe-selector-categories');
  if (container) {
      let html = \`<button onclick="setRecipeSelectorCategory('')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 \${_currentRecipeSelectorCat === '' ? 'bg-[#5e6ad2] text-white shadow-sm' : 'bg-[#3f4044] text-gray-300 hover:bg-[#4a4b4f]'}">Todas</button>\`;
      
      safeCategories.forEach(c => {
        const isSelected = _currentRecipeSelectorCat === c.id;
        html += \`<button onclick="setRecipeSelectorCategory('\${c.id}')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 \${isSelected ? 'bg-[#5e6ad2] text-white shadow-sm' : 'bg-[#3f4044] text-gray-300 hover:bg-[#4a4b4f]'}">\${c.name}</button>\`;
      });
      container.innerHTML = html;
  }

  // Mobile
  const mContainer = document.getElementById('mobile-recipe-selector-categories');
  if (mContainer) {
      let html = \`<button onclick="setRecipeSelectorCategory('')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 \${_currentRecipeSelectorCat === '' ? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">Todas</button>\`;
      
      safeCategories.forEach(c => {
        const isSelected = _currentRecipeSelectorCat === c.id;
        html += \`<button onclick="setRecipeSelectorCategory('\${c.id}')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 \${isSelected ? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">\${c.name}</button>\`;
      });
      mContainer.innerHTML = html;
  }
};
`;
html = html.replace(/window\.renderRecipeSelectorCategories = function\(\) \{[\s\S]*?\};\n/s, renderCatsJs + '\n');


const fixOpenJs = `
window.filterMobileRecipeSelector = function(q) {
   filterRecipeSelector(q);
}

window.openRecipeSelector = function(target) {
  _currentPlannerTarget = target;
  _currentRecipeSelectorCat = '';
  _currentRecipeSelectorQuery = '';
  
  if (window.innerWidth >= 1280) {
     const sidebar = document.getElementById('recipe-selector-search');
     if (sidebar) sidebar.focus();
     toast('Selecciona una receta del catálogo lateral');
     closePlannerDayModal();
  } else {
     // Mobile: show bottom sheet
     const searchInput = document.getElementById('mobile-recipe-selector-search');
     if (searchInput) searchInput.value = '';
     renderRecipeSelectorCategories();
     applyRecipeSelectorFilters();
     
     const selector = document.getElementById('modal-recipe-selector');
     const overlay = document.getElementById('recipe-selector-overlay');
     
     if (selector && overlay) {
       selector.classList.remove('translate-y-full');
       overlay.classList.remove('opacity-0', 'pointer-events-none');
     }
  }
}

window.closeRecipeSelector = function() {
  const selector = document.getElementById('modal-recipe-selector');
  const overlay = document.getElementById('recipe-selector-overlay');
  
  if (selector && overlay) {
      selector.classList.add('translate-y-full');
      overlay.classList.add('opacity-0', 'pointer-events-none');
  }
}
`;

html = html.replace(/window\.openRecipeSelector = function\(target\) \{[\s\S]*?\}\n/s, fixOpenJs + '\n');

fs.writeFileSync('frontend/index.html', html);
