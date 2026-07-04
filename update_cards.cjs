const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

const desktopCardTemplate = `        <div class="h-28 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform duration-200 relative group" draggable="true" ondragstart="dragRecipe(event, '\\${r.id}')" onclick="selectRecipeForPlanner('\\${r.id}')">
          \\${r.image_url ? \`<img src="\\${r.image_url}" class="absolute inset-0 w-full h-full object-cover" onerror="this.src='https://placehold.co/400x200/2a2a2a/ffffff?text=Receta'" />\` : \`<div class="absolute inset-0 w-full h-full bg-[#3a3b3f] flex items-center justify-center text-slate-500"><span class="material-symbols-outlined text-4xl">restaurant</span></div>\`}
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
          
          <div class="absolute top-2 left-2 px-2 py-0.5 rounded-full backdrop-blur-md border border-white/10 \\${r.category === 'Vegetariano' ? 'bg-green-500/30 text-green-100' : 'bg-white/20 text-white'}">
            <span class="text-[9px] font-bold uppercase tracking-wider">\\${r.category || 'Receta'}</span>
          </div>
          
          \\${r.computed_cost > 0 ? \`<div class="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md text-white border border-white/10">
            <span class="text-[10px] font-bold tracking-wide">$\\${r.computed_cost.toFixed(2)}/p</span>
          </div>\` : ''}
          
          <div class="absolute bottom-0 left-0 w-full p-3 pt-4">
             <h3 class="text-sm font-bold text-white leading-tight" style="font-family:Outfit">\\${r.name}</h3>
          </div>
        </div>`;

const mobileCardTemplate = `        <div class="h-28 rounded-xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform duration-200 relative group shadow-sm" onclick="selectRecipeForPlanner('\\${r.id}')">
          \\${r.image_url ? \`<img src="\\${r.image_url}" class="absolute inset-0 w-full h-full object-cover" onerror="this.src='https://placehold.co/400x200/2a2a2a/ffffff?text=Receta'" />\` : \`<div class="absolute inset-0 w-full h-full bg-slate-200 flex items-center justify-center text-slate-400"><span class="material-symbols-outlined text-4xl">restaurant</span></div>\`}
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
          
          <div class="absolute top-2 left-2 px-2 py-0.5 rounded-full backdrop-blur-md border border-white/10 \\${r.category === 'Vegetariano' ? 'bg-green-500/40 text-white' : 'bg-black/40 text-white'}">
            <span class="text-[9px] font-bold uppercase tracking-wider">\\${r.category || 'Receta'}</span>
          </div>
          
          \\${r.computed_cost > 0 ? \`<div class="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md text-white border border-white/10">
            <span class="text-[10px] font-bold tracking-wide">$\\${r.computed_cost.toFixed(2)}/p</span>
          </div>\` : ''}
          
          <div class="absolute bottom-0 left-0 w-full p-3 pt-4">
             <h3 class="text-sm font-bold text-white leading-tight" style="font-family:Outfit">\\${r.name}</h3>
          </div>
        </div>`;


// Replace desktop grid
html = html.replace(/grid\.innerHTML = filtered\.map\(r => \`[\s\S]*?`\)\.join\(''\);/, `grid.innerHTML = filtered.map(r => \`\n${desktopCardTemplate}\n      \`).join('');`);

// Replace mobile grid
html = html.replace(/mGrid\.innerHTML = filtered\.map\(r => \`[\s\S]*?`\)\.join\(''\);/, `mGrid.innerHTML = filtered.map(r => \`\n${mobileCardTemplate}\n      \`).join('');`);

fs.writeFileSync('frontend/index.html', html);
console.log('Cards updated!');
