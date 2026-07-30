const fs = require('fs');

// Update api.js
let api = fs.readFileSync('frontend/src/api.js', 'utf8');

// We leave the db fetch but remove the fallback overrides or just let it be. 
// For saving, we can just pass the counts to the upserts or 0.
api = api.replace(/lunch_halal:\s*Number\([^)]+\)\s*\|\|\s*0,/g, 'lunch_halal: 0,');
api = api.replace(/lunch_kosher:\s*Number\([^)]+\)\s*\|\|\s*0,/g, 'lunch_kosher: 0,');
api = api.replace(/lunch_vegan:\s*Number\([^)]+\)\s*\|\|\s*0,/g, 'lunch_vegan: 0,');
api = api.replace(/dinner_halal:\s*Number\([^)]+\)\s*\|\|\s*0,/g, 'dinner_halal: 0,');
api = api.replace(/dinner_kosher:\s*Number\([^)]+\)\s*\|\|\s*0,/g, 'dinner_kosher: 0,');
api = api.replace(/dinner_vegan:\s*Number\([^)]+\)\s*\|\|\s*0,/g, 'dinner_vegan: 0,');

fs.writeFileSync('frontend/src/api.js', api);

// Update PlannerTab.jsx
let planner = fs.readFileSync('frontend/src/components/PlannerTab.jsx', 'utf8');

// 1. Add activeDietCounts state
if (!planner.includes('const [activeDietCounts')) {
  planner = planner.replace(
    /const \[plannerData, setPlannerData\] = useState\(\{\}\);/,
    `const [plannerData, setPlannerData] = useState({});\n  const [activeDietCounts, setActiveDietCounts] = useState({ halal: 0, vegan: 0, kosher: 0, vegetarian: 0 });`
  );
}

// 2. Fetch comensales in loadData
if (!planner.includes('api.fetchComensales()')) {
  planner = planner.replace(
    /const \[plannerRes, ingredientsRes, weeksRes\] = await Promise\.all\(\[/,
    `const [plannerRes, ingredientsRes, weeksRes, comensalesRes] = await Promise.all([`
  );
  planner = planner.replace(
    /api\.fetchMenuWeeks\(\)/,
    `api.fetchMenuWeeks(),\n        api.fetchComensales()`
  );
  
  planner = planner.replace(
    /const plannerMap = \{\};/,
    `let halal = 0, vegan = 0, kosher = 0, vegetarian = 0;\n      if (comensalesRes && comensalesRes.data) {\n        comensalesRes.data.forEach(c => {\n          if (c.activo !== false) {\n            const d = (c.dieta || '').toLowerCase().trim();\n            if (d === 'halal') halal++;\n            if (d === 'vegano' || d === 'vegan') vegan++;\n            if (d === 'kosher') kosher++;\n            if (d === 'vegetariano' || d === 'vegetarian') vegetarian++;\n          }\n        });\n      }\n      setActiveDietCounts({ halal, vegan, kosher, vegetarian });\n\n      const plannerMap = {};`
  );
}

// 3. Remove dietary auto-calculation from handleGenerateWeekly
planner = planner.replace(/breakfast_halal: Math\.round\([^)]+\),/g, 'breakfast_halal: 0,');
planner = planner.replace(/breakfast_kosher: 0,/g, 'breakfast_kosher: 0,');
planner = planner.replace(/breakfast_vegan: Math\.round\([^)]+\),/g, 'breakfast_vegan: 0,');
planner = planner.replace(/lunch_halal: Math\.round\([^)]+\),/g, 'lunch_halal: 0,');
planner = planner.replace(/lunch_kosher: Math\.round\([^)]+\),/g, 'lunch_kosher: 0,');
planner = planner.replace(/lunch_vegan: Math\.round\([^)]+\),/g, 'lunch_vegan: 0,');
planner = planner.replace(/dinner_halal: Math\.round\([^)]+\),/g, 'dinner_halal: 0,');
planner = planner.replace(/dinner_kosher: 0,/g, 'dinner_kosher: 0,');
planner = planner.replace(/dinner_vegan: Math\.round\([^)]+\),/g, 'dinner_vegan: 0,');

// 4. Replace dietary inputs in UI with dynamic display
const renderDietaryInputs = `                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Halal</label>
                        <input type="number" min="0" 
                          value={dayForm.lunch_halal} 
                          onChange={e => setDayForm(prev => ({ ...prev, lunch_halal: parseInt(e.target.value) || 0 }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Kosher</label>
                        <input type="number" min="0" 
                          value={dayForm.lunch_kosher} 
                          onChange={e => setDayForm(prev => ({ ...prev, lunch_kosher: parseInt(e.target.value) || 0 }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Vegano</label>
                        <input type="number" min="0" 
                          value={dayForm.lunch_vegan} 
                          onChange={e => setDayForm(prev => ({ ...prev, lunch_vegan: parseInt(e.target.value) || 0 }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white" />
                      </div>
                    </div>`;

const newDietaryDisplay = `                    <div className="flex gap-2 mt-2 overflow-x-auto">
                      <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold border border-emerald-200">
                        <span>Halal:</span><span>{activeDietCounts.halal}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold border border-blue-200">
                        <span>Kosher:</span><span>{activeDietCounts.kosher}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-md text-xs font-bold border border-orange-200">
                        <span>Vegano:</span><span>{activeDietCounts.vegan}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-md text-xs font-bold border border-green-200">
                        <span>Vegetariano:</span><span>{activeDietCounts.vegetarian}</span>
                      </div>
                    </div>`;

// Use regex to replace the old block for lunch and dinner
planner = planner.replace(/<div className="grid grid-cols-3 gap-2 mt-2">[\s\S]*?value=\{dayForm\.lunch_vegan\}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, newDietaryDisplay);
planner = planner.replace(/<div className="grid grid-cols-3 gap-2 mt-2">[\s\S]*?value=\{dayForm\.dinner_vegan\}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, newDietaryDisplay);

fs.writeFileSync('frontend/src/components/PlannerTab.jsx', planner);
console.log('Update script finished.');
