// ── DATA ──────────────────────────────────────────────────────────
const SCREENS = ['dashboard','inventory','recetas','proveedores','planner','recipes'];

let INVENTORY = [];

let RECIPES = [];
let RECIPE_CATEGORIES = [];

// SUPPLIERS is populated dynamically from Supabase
let SUPPLIERS = [];

const ACTIVITIES = [
  { icon:'inventory_2', color:'brand',   text:'12 unidades de Arroz Koshihikari actualizadas',   time:'hace 5 min'  },
  { icon:'receipt_long',color:'success', text:'Nuevo escandallo creado: Crema de Calabaza',       time:'hace 42 min' },
  { icon:'warning',     color:'danger',  text:'Stock crítico: Ternera Gallega (0.8 kg restantes)', time:'hace 1h'     },
  { icon:'local_shipping',color:'warn',  text:'Pedido confirmado a Pescados del Atlántico',       time:'hace 2h'     },
  { icon:'auto_awesome',color:'brand',   text:'IA procesó: Risotto de Setas — 8 ingredientes',   time:'hace 3h'     },
];

const ALERTS = [
  { icon:'warning', color:'danger', title:'Stock crítico — Ternera Gallega', desc:'0.8 kg en stock. Mínimo requerido: 8 kg', action:'Pedir ahora' },
  { icon:'warning', color:'danger', title:'Stock crítico — Wagyu Beef A5',   desc:'2.5 kg en stock. Mínimo requerido: 10 kg', action:'Pedir ahora' },
  { icon:'info',    color:'warn',   title:'Presupuesto al 75%',              desc:'Queda 6.1K€ del límite mensual (24.5K€)', action:'Ver detalle' },
];

const MENU_DATA = {
  1: { almuerzo:'Risotto de Setas', cena:'Salmón Plancha',     cost:'€€€' },
  2: { almuerzo:'Crema Calabaza',   cena:'Wagyu A5',           cost:'€€€€' },
  7: { almuerzo:'Penne Arrabiata',  cena:'Ensalada César',     cost:'€€' },
  8: { almuerzo:'Steak Wagyu',      cena:'Crema Calabaza',     cost:'€€€' },
  14:{ almuerzo:'Pulpo a la Brasa', cena:'Burrata con Tomate', cost:'€€€' },
  15:{ almuerzo:'Arroz Negro',      cena:'Vieiras Plancha',    cost:'€€€' },
  21:{ almuerzo:'Cochinillo',       cena:'Sopa de Trufa',      cost:'€€€€' },
  22:{ almuerzo:'Merluza en Salsa', cena:'Foie Mi-Cuit',       cost:'€€€' },
  28:{ almuerzo:'Paella Valenciana',cena:'Gambas al Ajillo',   cost:'€€€' },
};

// ── NAV ────────────────────────────────────────────────────────────
function showScreen(id) {
  SCREENS.forEach(s => {
    document.getElementById('screen-' + s)?.classList.remove('active');
    document.getElementById('nav-' + s)?.classList.remove('active');
    document.getElementById('mnav-' + s)?.classList.remove('active');
  });
  document.getElementById('screen-' + id)?.classList.add('active');
  document.getElementById('nav-' + id)?.classList.add('active');
  document.getElementById('mnav-' + id)?.classList.add('active');
  document.getElementById('mobile-nav')?.classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileNav() {
  document.getElementById('mobile-nav').classList.toggle('hidden');
}

// ── MODAL ─────────────────────────────────────────────────────────
function openNewModal() {
  document.getElementById('modal-new').classList.add('open');
}
function closeNewModal() {
  document.getElementById('modal-new').classList.remove('open');
}

function openNewIngredientModal() {
  // Clear all fields for creation mode
  document.getElementById('ing-id').value = ''; // empty = create mode
  document.getElementById('modal-ingredient-title').textContent = 'Nuevo Ingrediente';
  document.getElementById('ing-name').value = '';
  document.getElementById('ing-brand').value = '';
  document.getElementById('ing-category').value = '';
  document.getElementById('ing-subcategory').value = '';
  document.getElementById('ing-provider').value = 'Sin proveedor';
  document.getElementById('ing-provider-ref').value = '';
  document.getElementById('ing-format-gr').value = '';
  document.getElementById('ing-purchase-price').value = '';
  document.getElementById('ing-output-scenario').value = 'KG_LT';
  document.getElementById('ing-waste').value = 0;
  document.getElementById('ing-waste-slider').value = 0;
  document.getElementById('ing-stock-actual').value = 0;
  document.getElementById('ing-stock-minimo').value = 0;
  document.getElementById('ing-stock-maximo').value = 0;
  document.getElementById('ing-save-text').textContent = 'Crear Ingrediente';
  setProcessType('MERMA');
  calculateNetCost();
  document.getElementById('modal-ingredient').classList.add('open');
  // Focus name after animation
  setTimeout(() => document.getElementById('ing-name').focus(), 100);
}

function openIngredientModal(id) {
  const item = INVENTORY.find(i => i.id === id);
  if (!item) return;
  document.getElementById('modal-ingredient-title').textContent = 'Editar Ingrediente';
  document.getElementById('ing-save-text').textContent = 'Guardar cambios';
  document.getElementById('ing-id').value = item.id;
  document.getElementById('ing-name').value = item.name || '';
  document.getElementById('ing-brand').value = item.brand || '';
  document.getElementById('ing-category').value = item.cat || '';
  document.getElementById('ing-subcategory').value = item.subcategory || '';
  document.getElementById('ing-provider').value = item.provider_name || 'Sin proveedor';
  document.getElementById('ing-provider-ref').value = item.provider_ref || '';
  document.getElementById('ing-format-gr').value = item.purchase_format_gr || '';
  document.getElementById('ing-purchase-price').value = item.purchase_price || '';
  document.getElementById('ing-output-scenario').value = item.output_scenario || 'KG_LT';
  document.getElementById('ing-waste').value = item.waste_percentage || 0;
  document.getElementById('ing-waste-slider').value = Math.min(item.waste_percentage || 0, 99);
  document.getElementById('ing-stock-actual').value = item.stock_actual || 0;
  document.getElementById('ing-stock-minimo').value = item.stock_minimo || 0;
  document.getElementById('ing-stock-maximo').value = item.stock_maximo || 0;
  setProcessType(item.process_type || 'MERMA');
  calculateNetCost();
  document.getElementById('modal-ingredient').classList.add('open');
}

function closeIngredientModal() {
  document.getElementById('modal-ingredient').classList.remove('open');
}

// Track active process type
let _processType = 'MERMA';

function setProcessType(type) {
  _processType = type;
  const isMerma = type === 'MERMA';
  
  // Toggle button styles
  document.getElementById('btn-merma').className = isMerma
    ? 'px-3 py-1.5 bg-brand text-white transition-all'
    : 'px-3 py-1.5 bg-white text-slate-500 transition-all';
  document.getElementById('btn-hidratacion').className = !isMerma
    ? 'px-3 py-1.5 bg-sky-500 text-white transition-all'
    : 'px-3 py-1.5 bg-white text-slate-500 transition-all';
  
  // Update label and description
  document.getElementById('ing-waste-label').textContent = isMerma ? 'Merma (%)' : 'Hidratación (%)';
  document.getElementById('ing-process-desc').innerHTML = isMerma
    ? '🧄 <strong>Merma</strong>: El producto pierde peso (limpieza, cocción, deshuesado). El coste/kg sube.'
    : '💧 <strong>Hidratación</strong>: El producto gana peso absorbiendo agua (arroz, legumbres). El coste/kg baja.';
  
  // Slider max: merma max 99%, hidratacion up to 999%
  const slider = document.getElementById('ing-waste-slider');
  if (isMerma) {
    slider.max = 99;
    document.getElementById('ing-slider-max-label').textContent = '99%';
    document.getElementById('ing-waste').max = 99;
  } else {
    slider.max = 300; // practical max for hydration (pasta goes ~200%)
    document.getElementById('ing-slider-max-label').textContent = '300%';
    document.getElementById('ing-waste').max = 999;
  }
  
  calculateNetCost();
}

function syncSlider() {
  const val = parseFloat(document.getElementById('ing-waste').value) || 0;
  const slider = document.getElementById('ing-waste-slider');
  slider.value = Math.min(val, parseFloat(slider.max));
}

function calculateNetCost() {
  const format = parseFloat(document.getElementById('ing-format-gr').value) || 0;
  const price  = parseFloat(document.getElementById('ing-purchase-price').value) || 0;
  const pct    = parseFloat(document.getElementById('ing-waste').value) || 0;
  const scenario = document.getElementById('ing-output-scenario').value;
  
  // Step 1: Precio Base por KG o por UD
  let baseCostPerKg = 0;
  if (scenario === 'KG_LT') {
    if (format > 0) baseCostPerKg = price / (format / 1000); // = price * 1000 / format
  } else {
    // UNIDADES: base per unit
    if (format > 0) baseCostPerKg = price / format;
  }
  
  // Step 2: Apply process formula
  let netCost = 0;
  let formulaStr = '';
  
  if (_processType === 'MERMA') {
    // Merma: product lost → cost goes UP
    // Coste_Neto_KG = Base / (1 - merma/100)
    const divisor = 1 - (pct / 100);
    netCost = divisor > 0 ? baseCostPerKg / divisor : 0;
    formulaStr = `${baseCostPerKg.toFixed(4)}€ / (1 - ${pct}%) = ${netCost.toFixed(4)}€`;
  } else {
    // Hidratación: product gains weight → cost goes DOWN
    // Coste_Neto_KG = Base / (1 + hidratacion/100)
    netCost = baseCostPerKg / (1 + (pct / 100));
    formulaStr = `${baseCostPerKg.toFixed(4)}€ / (1 + ${pct}%) = ${netCost.toFixed(4)}€`;
  }
  
  // Display
  const basePriceDisplay = document.getElementById('ing-base-price-display');
  if (basePriceDisplay) basePriceDisplay.textContent = baseCostPerKg > 0 ? baseCostPerKg.toFixed(4) + ' €/kg' : '—';
  
  document.getElementById('ing-calculated-cost').textContent = netCost.toFixed(2) + ' €';
  document.getElementById('ing-cost-formula').textContent = formulaStr || '—';
  
  return netCost;
}

async function saveIngredient() {
  if (!window.supabase) {
    toast('Error: Cliente Supabase no inicializado');
    return;
  }

  const nameVal = document.getElementById('ing-name').value.trim();
  if (!nameVal) {
    toast('⚠️ El nombre del ingrediente es obligatorio');
    document.getElementById('ing-name').focus();
    return;
  }

  const btn = document.getElementById('ing-save-btn');
  const spinner = document.getElementById('ing-save-spinner');
  const txt = document.getElementById('ing-save-text');
  const id = document.getElementById('ing-id').value.trim(); // empty = create mode
  const isCreateMode = !id;

  btn.disabled = true;
  spinner.classList.remove('hidden');
  txt.textContent = isCreateMode ? 'Creando...' : 'Guardando...';

  const netCost = calculateNetCost();

  const payload = {
    name: nameVal,
    brand: document.getElementById('ing-brand').value.trim(),
    category: document.getElementById('ing-category').value.trim(),
    subcategory: document.getElementById('ing-subcategory').value.trim(),
    provider_name: document.getElementById('ing-provider').value,
    provider_ref: document.getElementById('ing-provider-ref').value.trim(),
    purchase_format_gr: parseFloat(document.getElementById('ing-format-gr').value) || null,
    purchase_price: parseFloat(document.getElementById('ing-purchase-price').value) || null,
    output_scenario: document.getElementById('ing-output-scenario').value,
    waste_percentage: parseFloat(document.getElementById('ing-waste').value) || 0,
    process_type: _processType,
    calculated_net_cost_kg: netCost,
    unit: 'gr',
    stock_actual: parseFloat(document.getElementById('ing-stock-actual').value) || 0,
    stock_minimo: parseFloat(document.getElementById('ing-stock-minimo').value) || 0,
    stock_maximo: parseFloat(document.getElementById('ing-stock-maximo').value) || 0
  };

  try {
    if (isCreateMode) {
      // ── INSERT ──
      const { data, error } = await window.supabase
        .from('ingredients')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      // Add to local INVENTORY
      const newItem = {
        id: data.id,
        name: data.name,
        cat: data.category || 'Sin categoría',
        subcategory: data.subcategory || '',
        brand: data.brand || '',
        provider_ref: data.provider_ref || '',
        provider_name: data.provider_name || 'Sin proveedor',
        purchase_format_gr: data.purchase_format_gr,
        purchase_price: data.purchase_price,
        output_scenario: data.output_scenario || 'KG_LT',
        waste_percentage: data.waste_percentage || 0,
        process_type: data.process_type || 'MERMA',
        calculated_net_cost_kg: data.calculated_net_cost_kg || 0,
        stock_actual: data.stock_actual || 0,
        stock_minimo: data.stock_minimo || 0,
        stock_maximo: data.stock_maximo || 0,
        stock: data.stock_actual || 0,
        unit: data.unit || 'gr',
        min: data.stock_minimo || 0,
        max: data.stock_maximo || 0,
        cost: netCost,
        supplier: data.provider_name || 'Sin proveedor',
        critical: (data.stock_actual || 0) <= (data.stock_minimo || 0)
      };
      INVENTORY.push(newItem);
      INVENTORY.sort((a, b) => a.name.localeCompare(b.name));

      closeIngredientModal();
      toast('✅ Ingrediente creado correctamente');

    } else {
      // ── UPDATE ──
      const { error } = await window.supabase
        .from('ingredients')
        .update(payload)
        .eq('id', id);
      if (error) throw error;

      // Update local INVENTORY
      const index = INVENTORY.findIndex(i => i.id === id);
      if (index > -1) {
        INVENTORY[index] = {
          ...INVENTORY[index],
          ...payload,
          cat: payload.category || 'Sin categoría',
          cost: netCost,
          supplier: payload.provider_name,
          stock_actual: payload.stock_actual,
          stock_minimo: payload.stock_minimo,
          stock_maximo: payload.stock_maximo,
          stock: payload.stock_actual,
          min: payload.stock_minimo,
          max: payload.stock_maximo,
          critical: payload.stock_actual <= payload.stock_minimo
        };
      }

      closeIngredientModal();
      toast('✅ Ingrediente actualizado correctamente');
    }

    // Refresh filters and table
    populateInventoryFilters();
    updateInventoryStats();
    filterInventory();

  } catch (err) {
    console.error('Error guardando ingrediente:', err);
    const msg = err.message?.includes('duplicate') || err.message?.includes('unique')
      ? '❌ Ya existe un ingrediente con ese nombre'
      : '❌ Error al guardar el ingrediente';
    toast(msg);
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
    txt.textContent = id ? 'Guardar cambios' : 'Crear Ingrediente';
  }
}


// ── TOAST ─────────────────────────────────────────────────────────
function toast(msg, duration=3000) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, duration);
}

// ── DASHBOARD ─────────────────────────────────────────────────────
function initDashboard() {
  // Date
  const now = new Date();
  const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  const el = document.getElementById('dash-date');
  if (el) el.textContent = now.toLocaleDateString('es-ES', opts);

  // Activity
  const al = document.getElementById('activity-list');
  if (al) {
    al.innerHTML = ACTIVITIES.map(a => `
      <div class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg bg-${a.color === 'brand' ? 'brand-muted' : a.color === 'success' ? 'emerald-50' : a.color === 'danger' ? 'red-50' : 'amber-50'} flex items-center justify-center flex-shrink-0 mt-0.5">
          <span class="material-symbols-outlined text-${a.color === 'brand' ? 'brand' : a.color === 'success' ? 'success' : a.color === 'danger' ? 'red-500' : 'warn'}" style="font-size:16px">${a.icon}</span>
        </div>
        <div class="min-w-0 flex-grow">
          <p class="text-sm text-slate-700">${a.text}</p>
          <p class="text-xs text-slate-400 mt-0.5">${a.time}</p>
        </div>
      </div>
    `).join('');
  }

  // Alerts
  const alertEl = document.getElementById('alert-list');
  if (alertEl) {
    alertEl.innerHTML = ALERTS.map(a => `
      <div class="flex items-start gap-3 p-3 rounded-xl ${a.color === 'danger' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'}">
        <span class="material-symbols-outlined ${a.color === 'danger' ? 'text-red-500' : 'text-warn'} flex-shrink-0 mt-0.5" style="font-size:18px">${a.icon}</span>
        <div class="flex-grow min-w-0">
          <p class="text-sm font-semibold ${a.color === 'danger' ? 'text-red-700' : 'text-amber-800'}">${a.title}</p>
          <p class="text-xs ${a.color === 'danger' ? 'text-red-500' : 'text-amber-600'} mt-0.5">${a.desc}</p>
        </div>
        <button onclick="toast('🔄 Procesando pedido...')" class="text-xs font-semibold ${a.color === 'danger' ? 'text-red-600 hover:text-red-800' : 'text-amber-700 hover:text-amber-900'} whitespace-nowrap mt-0.5 transition-colors">${a.action}</button>
      </div>
    `).join('');
  }
}

// ── INVENTORY ─────────────────────────────────────────────────────
function stockPct(item) {
  const max = item.stock_maximo || (item.stock_minimo * 1.5) || 1;
  return Math.min(100, Math.round(((item.stock_actual || 0) / max) * 100));
}

function renderInventory(items) {
  const tbody = document.getElementById('inv-tbody');
  const count = document.getElementById('inv-count');
  if (!tbody) return;
  count.textContent = `${items.length} de ${INVENTORY.length} líneas`;
  if (!items.length) { tbody.innerHTML = `<tr><td colspan="8" class="p-10 text-center text-slate-400 text-sm">Sin resultados para los filtros seleccionados.</td></tr>`; return; }

  tbody.innerHTML = items.map(item => {
    const pct = stockPct(item);
    const barColor = item.critical ? '#ef4444' : pct < 70 ? '#d97706' : '#059669';
    const statusBadge = item.critical
      ? `<span class="badge badge-red pulse-red">REORDENAR</span>`
      : `<span class="badge badge-green">OK</span>`;
    return `
      <tr class="tr-hover cursor-pointer" onclick="openIngredientModal('${item.id}')">
        <td class="px-6 py-4">
          <p class="font-semibold text-slate-900">${item.name}</p>
        </td>
        <td class="px-4 py-4"><span class="badge badge-slate">${item.cat}</span></td>
        <td class="px-4 py-4 font-semibold ${item.critical ? 'text-red-600' : 'text-slate-900'}">${item.stock_actual || 0} ${item.unit}</td>
        <td class="px-4 py-4 hidden md:table-cell" style="min-width:120px">
          <div class="prog-track w-24"><div class="prog-fill" style="width:${pct}%;background:${barColor}"></div></div>
          <p class="text-[10px] text-slate-400 mt-1">min: ${item.stock_minimo || 0} ${item.unit} · max: ${item.stock_maximo || 0} ${item.unit}</p>
        </td>
        <td class="px-4 py-4 font-semibold text-slate-700 hidden sm:table-cell">${item.cost.toFixed(2)}€</td>
        <td class="px-4 py-4 text-slate-500 text-xs hidden lg:table-cell">${item.supplier}</td>
        <td class="px-4 py-4">${statusBadge}</td>
        <td class="px-4 py-4">
          <button onclick="event.stopPropagation();openIngredientModal('${item.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand-muted transition-colors">
            <span class="material-symbols-outlined" style="font-size:16px">edit</span>
          </button>
        </td>
      </tr>`;
  }).join('');
}

let _invSortKey = 'name';
let _invSortDir = 1; // 1 asc, -1 desc

function sortInventory(key) {
  if (_invSortKey === key) {
    _invSortDir *= -1;
  } else {
    _invSortKey = key;
    _invSortDir = 1;
  }
  // Update sort indicators
  ['name','cat','stock','cost','supplier'].forEach(k => {
    const el = document.getElementById('sort-' + k);
    if (el) el.textContent = k === _invSortKey ? (_invSortDir === 1 ? '↑' : '↓') : '';
  });
  filterInventory();
}

function clearInventoryFilters() {
  document.getElementById('inv-search').value = '';
  document.getElementById('inv-cat').value = '';
  document.getElementById('inv-subcat').value = '';
  document.getElementById('inv-provider').value = '';
  document.getElementById('inv-status').value = '';
  filterInventory();
}

function filterInventory() {
  const q = document.getElementById('inv-search').value.toLowerCase().trim();
  const cat = document.getElementById('inv-cat').value;
  const subcat = document.getElementById('inv-subcat').value;
  const provider = document.getElementById('inv-provider').value;
  const status = document.getElementById('inv-status').value;

  let filtered = INVENTORY.filter(i => {
    if (q && !(
      (i.name || '').toLowerCase().includes(q) ||
      (i.brand || '').toLowerCase().includes(q) ||
      (i.provider_ref || '').toLowerCase().includes(q) ||
      (i.supplier || '').toLowerCase().includes(q)
    )) return false;
    if (cat && i.cat !== cat) return false;
    if (subcat && i.subcategory !== subcat) return false;
    if (provider && i.supplier !== provider) return false;
    if (status === 'critical' && !i.critical) return false;
    if (status === 'ok' && i.critical) return false;
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    const aVal = a[_invSortKey] ?? '';
    const bVal = b[_invSortKey] ?? '';
    if (typeof aVal === 'number') return (aVal - bVal) * _invSortDir;
    return String(aVal).localeCompare(String(bVal)) * _invSortDir;
  });

  // Update filter chips
  const chips = [];
  if (q) chips.push({ label: `"${q}"`, clear: () => { document.getElementById('inv-search').value = ''; filterInventory(); } });
  if (cat) chips.push({ label: cat, clear: () => { document.getElementById('inv-cat').value = ''; filterInventory(); } });
  if (subcat) chips.push({ label: subcat, clear: () => { document.getElementById('inv-subcat').value = ''; filterInventory(); } });
  if (provider) chips.push({ label: provider, clear: () => { document.getElementById('inv-provider').value = ''; filterInventory(); } });
  if (status) chips.push({ label: status === 'critical' ? 'Stock crítico' : 'Stock óptimo', clear: () => { document.getElementById('inv-status').value = ''; filterInventory(); } });
  
  const chipContainer = document.getElementById('inv-filter-chips');
  if (chips.length) {
    chipContainer.classList.remove('hidden');
    chipContainer.innerHTML = '<span class="text-xs text-slate-400 self-center">Filtros activos:</span>' +
      chips.map((c, idx) => `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-muted text-brand text-xs rounded-full font-medium">${c.label}<button onclick="(${c.clear.toString()})()" class="hover:text-red-500 ml-0.5">&times;</button></span>`).join('');
  } else {
    chipContainer.classList.add('hidden');
  }

  renderInventory(filtered);
}

function populateInventoryFilters() {
  const cats = [...new Set(INVENTORY.map(i => i.cat).filter(Boolean))].sort();
  const subcats = [...new Set(INVENTORY.map(i => i.subcategory).filter(Boolean))].sort();
  const providers = [...new Set(INVENTORY.map(i => i.supplier).filter(v => v && v !== 'Sin proveedor'))].sort();
  
  const catSel = document.getElementById('inv-cat');
  catSel.innerHTML = '<option value="">Todas las categorías</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
  
  const subcatSel = document.getElementById('inv-subcat');
  subcatSel.innerHTML = '<option value="">Todas las subcategorías</option>' +
    subcats.map(s => `<option value="${s}">${s}</option>`).join('');
  
  const provSel = document.getElementById('inv-provider');
  provSel.innerHTML = '<option value="">Todos los proveedores</option>' +
    providers.map(p => `<option value="${p}">${p}</option>`).join('');
}

function updateInventoryStats() {
  const total = INVENTORY.length;
  const critical = INVENTORY.filter(i => i.critical).length;
  const fillRate = total > 0 ? Math.round(((total - critical) / total) * 100) : 0;
  const value = INVENTORY.reduce((sum, i) => sum + (i.cost * i.stock_actual), 0);
  
  const fmt = v => v >= 1000 ? (v/1000).toFixed(1) + 'K€' : v.toFixed(0) + '€';
  document.getElementById('inv-stat-total').textContent = total;
  document.getElementById('inv-stat-critical').textContent = critical;
  document.getElementById('inv-stat-fillrate').textContent = fillRate + '%';
  document.getElementById('inv-stat-value').textContent = fmt(value);
}

// Local recipe view states (stored by recipe ID: 'cocina' or 'escandallo')
let _recipeViewStates = {};

function toggleRecipe(id) {
  const el = document.getElementById('recipe-detail-' + id);
  if (!el) return;
  el.classList.toggle('open');
  const btn = document.getElementById('recipe-toggle-' + id);
  if (btn) btn.textContent = el.classList.contains('open') ? 'expand_less' : 'expand_more';
}

function setRecipeView(recipeId, viewType) {
  _recipeViewStates[recipeId] = viewType;
  
  // Toggle active buttons
  const btnCocina = document.getElementById(`btn-view-cocina-${recipeId}`);
  const btnEscandallo = document.getElementById(`btn-view-escandallo-${recipeId}`);
  if (btnCocina && btnEscandallo) {
    if (viewType === 'cocina') {
      btnCocina.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 shadow-sm transition-all";
      btnEscandallo.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-700 transition-all";
    } else {
      btnEscandallo.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 shadow-sm transition-all";
      btnCocina.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-700 transition-all";
    }
  }

  // Toggle active containers
  const viewCocinaEl = document.getElementById(`recipe-view-cocina-${recipeId}`);
  const viewEscandalloEl = document.getElementById(`recipe-view-escandallo-${recipeId}`);
  if (viewCocinaEl && viewEscandalloEl) {
    if (viewType === 'cocina') {
      viewCocinaEl.classList.remove('hidden');
      viewEscandalloEl.classList.add('hidden');
    } else {
      viewEscandalloEl.classList.remove('hidden');
      viewCocinaEl.classList.add('hidden');
    }
  }
}

// Render recipes list dynamically with try-catch and calculations
function renderRecipes() {
  const el = document.getElementById('recipe-list');
  if (!el) return;
  
  try {
    if (RECIPES.length === 0) {
      el.innerHTML = `<div class="p-8 text-center text-slate-400">No hay recetas que mostrar.</div>`;
      return;
    }

    el.innerHTML = RECIPES.map((r, i) => {
      try {
        let totalCost = 0;
        let totalGrams = 0;
        
        const parsedIngs = (r.recipe_ingredients || []).map(ri => {
          const ing = ri.ingredients || {};
          const qty = Number(ri.quantity) || Number(ri.quantity_per_portion) || 0;
          const unit = ri.unit || 'Gr';
          const nutritionalCategory = ing.nutritional_category || ing.category || 'Sin asignar';
          
          let itemCost = 0;
          let unitCostText = "0.00€";
          const uLower = unit.toLowerCase();
          if (uLower === 'gr' || uLower === 'ml' || uLower === 'g') {
            const costPerKg = Number(ing.calculated_net_cost_kg || ing.precio_mas_bajo || ing.precio_por_kg || 0);
            itemCost = (qty / 1000) * costPerKg;
            unitCostText = `${costPerKg.toFixed(2)}€/kg`;
            totalGrams += qty;
          } else {
            const costPerUnit = Number(ing.precio_por_u || ing.precio_mas_bajo || 0);
            itemCost = qty * costPerUnit;
            unitCostText = `${costPerUnit.toFixed(2)}€/ud`;
          }
          
          totalCost += itemCost;
          
          return {
            id: ing.id,
            name: ing.name || 'Sin nombre',
            nutritional_category: nutritionalCategory,
            qty: `${qty} ${unit}`,
            rawQty: qty,
            unit: unit,
            unitCostText,
            waste_percentage: Number(ing.waste_percentage) || 0,
            cost: itemCost
          };
        });

        const portions = Number(r.portions) || 1;
        const costPerPortion = totalCost;
        const totalRecipeCost = totalCost * portions;
        const suggestedPrice = costPerPortion / 0.30; 
        const margin = 70;
        const marginColor = 'success';
        
        const viewType = _recipeViewStates[r.id] || 'cocina';
        
        return `
          <div class="card overflow-hidden flex flex-col">
            ${r.image_url ? `<img src="${r.image_url}" class="w-full h-32 object-cover" onerror="this.style.display='none'" alt="${r.name}" />` : ''}
            <div class="px-6 py-5 flex flex-wrap justify-between items-start gap-4 cursor-pointer" onclick="toggleRecipe('${r.id}')">
              <div class="flex items-center gap-4">
                <div class="kpi-icon bg-brand-muted"><span class="material-symbols-outlined text-brand" style="font-size:22px">restaurant_menu</span></div>
                <div>
                  <h3 class="font-bold text-slate-900" style="font-family:Outfit">${r.name || 'Sin nombre'}</h3>
                  <p class="text-xs text-slate-400 mt-0.5"><span class="badge badge-slate mr-2">${r.category || 'Sin familia'}</span>${portions} pax · Coste total: ${totalRecipeCost.toFixed(2)}€</p>
                </div>
              </div>
              <div class="flex items-center gap-4">
                <div class="text-right">
                  <p class="text-xl font-bold text-slate-900" style="font-family:Outfit">${costPerPortion.toFixed(2)}€</p>
                  <p class="text-xs text-slate-400">por ración</p>
                </div>
                <div class="text-right">
                  <p class="text-xl font-bold text-${marginColor}" style="font-family:Outfit">${margin}%</p>
                  <p class="text-xs text-slate-400">margen obj.</p>
                </div>
                <div class="text-right hidden sm:block">
                  <p class="text-xl font-bold text-slate-900" style="font-family:Outfit">${suggestedPrice.toFixed(2)}€</p>
                  <p class="text-xs text-slate-400">PVP sugerido</p>
                </div>
                <button id="recipe-toggle-${r.id}" class="p-2 rounded-xl text-slate-400 hover:text-brand hover:bg-brand-muted transition-colors ml-2" onclick="event.stopPropagation(); toggleRecipe('${r.id}')">
                  <span class="material-symbols-outlined" style="font-size:22px">expand_more</span>
                </button>
              </div>
            </div>
            
            <div id="recipe-detail-${r.id}" class="recipe-detail">
              <div class="px-6 pb-6 border-t border-slate-100 pt-5">
                <div class="flex justify-between items-center mb-4">
                  <h4 class="text-sm font-bold text-slate-700">Ficha Técnica e Ingredientes</h4>
                  
                  <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button onclick="event.stopPropagation(); setRecipeView('${r.id}', 'cocina')" id="btn-view-cocina-${r.id}" 
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold ${viewType === 'cocina' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'} transition-all">
                      Cocina
                    </button>
                    <button onclick="event.stopPropagation(); setRecipeView('${r.id}', 'escandallo')" id="btn-view-escandallo-${r.id}" 
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold ${viewType === 'escandallo' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'} transition-all">
                      Escandallo
                    </button>
                  </div>
                </div>

                <!-- VISTA A: COCINA / FICHA TÉCNICA -->
                <div id="recipe-view-cocina-${r.id}" class="${viewType === 'cocina' ? '' : 'hidden'}">
                  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-2">
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="text-xs text-slate-400 uppercase border-b border-slate-100">
                            <th class="pb-2 text-left font-semibold">Ingrediente</th>
                            <th class="pb-2 text-right font-semibold">Cantidad</th>
                            <th class="pb-2 text-right font-semibold">Unidad</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                          ${parsedIngs.map(ing => `
                            <tr class="text-slate-700">
                              <td class="py-2.5 font-medium">${ing.name}</td>
                              <td class="py-2.5 text-right text-slate-500 font-mono">${ing.rawQty}</td>
                              <td class="py-2.5 text-right text-slate-400">${ing.unit}</td>
                            </tr>`).join('')}
                        </tbody>
                      </table>
                    </div>
                    
                    <div class="space-y-4">
                      <div class="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Instrucciones de Preparación</p>
                        <div class="text-sm text-slate-600 space-y-2">
                          ${r.instructions ? r.instructions.split('\n').map((step, idx) => `<p class="leading-relaxed"><strong class="text-brand mr-1">${idx+1}.</strong> ${step}</p>`).join('') : '<p class="italic text-slate-400">Sin instrucciones registradas.</p>'}
                        </div>
                      </div>
                      
                      <div class="flex gap-2 flex-wrap">
                        <button onclick="openNewRecipeModal('${r.id}')" class="flex-grow flex items-center justify-center gap-1.5 py-2 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition-colors">
                          <span class="material-symbols-outlined" style="font-size:16px">edit</span>Editar
                        </button>
                        <button onclick="deleteRecipe('${r.id}')" class="px-3 py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors" title="Eliminar Receta">
                          <span class="material-symbols-outlined" style="font-size:16px">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- VISTA B: FINANCIERO / ESCANDALLO -->
                <div id="recipe-view-escandallo-${r.id}" class="${viewType === 'escandallo' ? '' : 'hidden'}">
                  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-2 overflow-x-auto">
                      <table class="w-full text-xs text-left">
                        <thead>
                          <tr class="text-slate-400 uppercase border-b border-slate-100">
                            <th class="pb-2 font-semibold">Ingrediente</th>
                            <th class="pb-2 font-semibold">Clasificación</th>
                            <th class="pb-2 text-right font-semibold">Porción</th>
                            <th class="pb-2 text-right font-semibold">Costo Unitario</th>
                            <th class="pb-2 text-right font-semibold">Merma</th>
                            <th class="pb-2 text-right font-semibold">Costo</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                          ${parsedIngs.map(ing => `
                            <tr class="text-slate-700">
                              <td class="py-2.5 font-medium text-slate-900">${ing.name}</td>
                              <td class="py-2.5"><span class="badge badge-slate">${ing.nutritional_category}</span></td>
                              <td class="py-2.5 text-right font-mono">${ing.rawQty} ${ing.unit}</td>
                              <td class="py-2.5 text-right font-mono text-slate-500">${ing.unitCostText}</td>
                              <td class="py-2.5 text-right font-mono text-slate-500">${ing.waste_percentage}%</td>
                              <td class="py-2.5 text-right font-mono font-bold text-slate-800">${ing.cost.toFixed(3)}€</td>
                            </tr>`).join('')}
                        </tbody>
                      </table>
                    </div>

                    <div class="space-y-4">
                      <div class="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                        <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Métricas de Negocio</p>
                        <div class="flex justify-between text-xs text-slate-600">
                          <span>Gramaje Total Ración:</span>
                          <span class="font-bold text-slate-900">${totalGrams.toFixed(0)} gr</span>
                        </div>
                        <div class="flex justify-between text-xs text-slate-600 border-t border-slate-100 pt-2">
                          <span>Costo Real Ración:</span>
                          <span class="font-bold text-brand text-sm">${costPerPortion.toFixed(2)}€</span>
                        </div>
                        <div class="flex justify-between text-xs text-slate-600 border-t border-slate-100 pt-2">
                          <span>Costo Total (${portions} pax):</span>
                          <span class="font-bold text-slate-900 text-sm">${totalRecipeCost.toFixed(2)}€</span>
                        </div>
                        <div class="flex justify-between text-xs text-slate-600 border-t border-slate-100 pt-2">
                          <span>PVP Sugerido (70% Margen):</span>
                          <span class="font-bold text-success text-sm">${suggestedPrice.toFixed(2)}€</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>`;
      } catch (innerErr) {
        console.error("Error rendering recipe card:", r, innerErr);
        return `<div class="card p-4 border border-red-100 bg-red-50 text-red-700 text-xs">Error al renderizar receta "${r.name || 'Sin nombre'}": ${innerErr.message}</div>`;
      }
    }).join('');
  } catch (err) {
    console.error("Error in renderRecipes:", err);
    el.innerHTML = `<div class="p-6 text-center text-red-600 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold">Error al renderizar la lista: ${err.message}</div>`;
  }
}

// ── SUPPLIERS ─────────────────────────────────────────────────────
function renderSuppliers(list) {
  const el = document.getElementById('supplier-grid');
  if (!el) return;
  if (list.length === 0) {
    el.innerHTML = `<div class="col-span-3 text-center py-16 text-slate-400">
      <span class="material-symbols-outlined text-5xl block mb-3">local_shipping</span>
      <p class="font-semibold text-slate-500">No hay proveedores registrados</p>
      <p class="text-sm mt-1">Haz clic en «Añadir» para crear el primero</p>
    </div>`;
    return;
  }
  el.innerHTML = list.map((s) => {
    const id       = s.id || '';
    const name     = s.name || '—';
    const contact  = s.contact_name || '';
    const email    = s.email || '';
    const phone    = s.phone || '';
    const notes    = s.notes || '';
    // Escape for inline onclick attributes
    const esc = v => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');

    // WhatsApp: strip all non-digit chars except leading +
    const rawPhone  = phone.replace(/[\s\-().]/g, '');
    const waText    = encodeURIComponent(`Hola ${contact || name}, te adjunto el pedido de ACFC Kitchen:`);
    const waUrl     = phone ? `https://wa.me/${rawPhone}?text=${waText}` : '';

    // Mailto
    const mailSubj  = encodeURIComponent('Pedido ACFC Kitchen');
    const mailBody  = encodeURIComponent(`Hola ${contact || name}, un saludo. Aquí tienes el pedido:`);
    const mailtoUrl = email ? `mailto:${email}?subject=${mailSubj}&body=${mailBody}` : '';

    return `
      <div class="card p-6 flex flex-col gap-4 supplier-active hover:-translate-y-0.5 transition-transform">
        <!-- Header -->
        <div class="flex justify-between items-start">
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-slate-900 text-base truncate" style="font-family:Outfit">${name}</h3>
            ${contact ? `<p class="text-xs text-slate-400 mt-0.5">Contacto: ${contact}</p>` : '<p class="text-xs text-slate-300 mt-0.5 italic">Sin contacto</p>'}
          </div>
          <!-- Edit button -->
          <button
            onclick="openEditSupplierModal('${esc(id)}','${esc(name)}','${esc(contact)}','${esc(email)}','${esc(phone)}','${esc(notes)}')"
            title="Editar proveedor"
            class="ml-2 p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-brand hover:border-brand transition-colors flex-shrink-0">
            <span class="material-symbols-outlined" style="font-size:16px">edit</span>
          </button>
        </div>

        <!-- Contact info grid -->
        <div class="grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div>
            <span class="font-semibold text-slate-700 block">Email</span>
            ${email ? `<span class="truncate block">${email}</span>` : '<span class="text-slate-300 italic">No registrado</span>'}
          </div>
          <div>
            <span class="font-semibold text-slate-700 block">Teléfono</span>
            ${phone ? `<span>${phone}</span>` : '<span class="text-slate-300 italic">No registrado</span>'}
          </div>
        </div>

        ${notes ? `<p class="text-sm text-slate-500 leading-relaxed">${notes}</p>` : ''}

        <!-- Action buttons -->
        <div class="flex gap-2 pt-1 border-t border-slate-100">
          <!-- WhatsApp -->
          ${waUrl
            ? `<a href="${waUrl}" target="_blank" rel="noopener"
                 title="Enviar pedido por WhatsApp"
                 class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition-colors text-xs font-semibold">
                <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                WhatsApp
              </a>`
            : `<button disabled title="Añade un teléfono para activar WhatsApp"
                 class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-100 text-slate-300 cursor-not-allowed text-xs font-semibold">
                <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                WhatsApp
              </button>`
          }
          <!-- Email -->
          ${mailtoUrl
            ? `<a href="${mailtoUrl}"
                 title="Enviar pedido por email"
                 class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-colors text-xs font-semibold">
                <span class="material-symbols-outlined" style="font-size:15px">mail</span>
                Correo
              </a>`
            : `<button disabled title="Añade un email para activar esta opción"
                 class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-100 text-slate-300 cursor-not-allowed text-xs font-semibold">
                <span class="material-symbols-outlined" style="font-size:15px">mail</span>
                Correo
              </button>`
          }
        </div>
      </div>`;
  }).join('');

  const totalEl = document.getElementById('stat-suppliers-total');
  if (totalEl) totalEl.textContent = list.length;
}

function filterSuppliers() {
  const q = document.getElementById('supp-search')?.value.toLowerCase() || '';
  const filtered = SUPPLIERS.filter(s => !q || (s.name || '').toLowerCase().includes(q) || (s.contact_name || '').toLowerCase().includes(q));
  renderSuppliers(filtered);
}

async function fetchAndRenderSuppliers() {
  const el = document.getElementById('supplier-grid');
  if (el) el.innerHTML = '<p class="col-span-3 text-center text-slate-400 py-10">Cargando proveedores...</p>';
  try {
    const { data, error } = await window.supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    // Handle table-not-found or RLS errors gracefully
    if (error) {
      const isTableMissing = error.message?.includes('does not exist') ||
                             error.code === '42P01' ||
                             error.code === 'PGRST200';
      if (isTableMissing) {
        console.warn('Tabla suppliers no encontrada. Ejecuta la migración 007 en Supabase.');
        if (el) el.innerHTML = `<div class="col-span-3 text-center py-12 text-slate-400">
          <span class="material-symbols-outlined text-5xl block mb-3">local_shipping</span>
          <p class="font-semibold text-slate-500">Tabla de proveedores pendiente de configurar</p>
          <p class="text-xs mt-1 text-slate-400">Ejecuta la migración SQL en Supabase para activar este módulo</p>
        </div>`;
        return;
      }
      throw error;
    }

    SUPPLIERS = data || [];
    renderSuppliers(SUPPLIERS);
    await populateProviderDropdown();
  } catch (err) {
    console.error('Error fetching suppliers:', err.message || err);
    if (el) el.innerHTML = `<div class="col-span-3 text-center py-12 text-slate-400">
      <span class="material-symbols-outlined text-5xl block mb-3">wifi_off</span>
      <p class="font-semibold text-slate-500">No se pudieron cargar los proveedores</p>
      <p class="text-xs mt-1">${err.message || 'Error de conexión'}</p>
      <button onclick="fetchAndRenderSuppliers()" class="mt-3 px-4 py-1.5 bg-brand text-white text-xs rounded-lg hover:bg-brand-dark transition-colors">Reintentar</button>
    </div>`;
  }
}

async function populateProviderDropdown() {
  const sel = document.getElementById('ing-provider');
  if (!sel) return;
  const currentVal = sel.value;
  try {
    let suppList = SUPPLIERS;
    if (suppList.length === 0) {
      const { data } = await window.supabase.from('suppliers').select('id, name').order('name');
      suppList = data || [];
    }
    sel.innerHTML = '<option value="Sin proveedor">Sin proveedor</option>' +
      suppList.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    if (currentVal) sel.value = currentVal;
  } catch (err) {
    console.error('Error populating supplier dropdown:', err);
    sel.innerHTML = '<option value="Sin proveedor">Sin proveedor</option>';
  }
}

function openAddSupplierModal() {
  document.getElementById('new-supplier-name').value = '';
  document.getElementById('new-supplier-contact').value = '';
  document.getElementById('new-supplier-email').value = '';
  document.getElementById('new-supplier-phone').value = '';
  document.getElementById('new-supplier-notes').value = '';
  document.getElementById('modal-add-supplier').classList.remove('hidden');
}

function closeAddSupplierModal() {
  document.getElementById('modal-add-supplier').classList.add('hidden');
}

// ── EDIT SUPPLIER ─────────────────────────────────────────────────
function openEditSupplierModal(id, name, contact, email, phone, notes) {
  document.getElementById('edit-supplier-id').value      = id;
  document.getElementById('edit-supplier-name').value    = name;
  document.getElementById('edit-supplier-contact').value = contact;
  document.getElementById('edit-supplier-email').value   = email;
  document.getElementById('edit-supplier-phone').value   = phone;
  document.getElementById('edit-supplier-notes').value   = notes;
  document.getElementById('modal-edit-supplier').classList.remove('hidden');
}

function closeEditSupplierModal() {
  document.getElementById('modal-edit-supplier').classList.add('hidden');
}

async function saveEditSupplier() {
  const id    = document.getElementById('edit-supplier-id').value;
  const name  = document.getElementById('edit-supplier-name').value.trim();
  const email = document.getElementById('edit-supplier-email').value.trim();
  const phone = document.getElementById('edit-supplier-phone').value.trim();

  if (!name) { toast('⚠️ El nombre es obligatorio'); return; }

  // Basic email format validation
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toast('⚠️ El formato del email no es válido'); return;
  }
  // Basic phone validation (digits, spaces, +, -, parentheses)
  if (phone && !/^[\d\s\+\-\.\(\)]{6,20}$/.test(phone)) {
    toast('⚠️ El formato del teléfono no es válido'); return;
  }

  const payload = {
    name,
    contact_name: document.getElementById('edit-supplier-contact').value.trim() || null,
    email: email || null,
    phone: phone || null,
    notes: document.getElementById('edit-supplier-notes').value.trim() || null,
  };

  try {
    const { error } = await window.supabase
      .from('suppliers')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
    toast('✅ Proveedor actualizado correctamente');
    closeEditSupplierModal();
    await fetchAndRenderSuppliers();
  } catch (err) {
    console.error('Error updating supplier:', err);
    toast('❌ Error al guardar: ' + err.message);
  }
}

async function saveNewSupplier() {
  const name  = document.getElementById('new-supplier-name').value.trim();
  const email = document.getElementById('new-supplier-email').value.trim();
  const phone = document.getElementById('new-supplier-phone').value.trim();
  if (!name) { toast('⚠️ El nombre es obligatorio'); return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toast('⚠️ El formato del email no es válido'); return;
  }
  if (phone && !/^[\d\s\+\-\.\(\)]{6,20}$/.test(phone)) {
    toast('⚠️ El formato del teléfono no es válido'); return;
  }
  const payload = {
    name,
    contact_name: document.getElementById('new-supplier-contact').value.trim() || null,
    email: email || null,
    phone: phone || null,
    notes: document.getElementById('new-supplier-notes').value.trim() || null,
  };
  try {
    const { error } = await window.supabase.from('suppliers').insert(payload);
    if (error) throw error;
    toast('✅ Proveedor creado correctamente');
    closeAddSupplierModal();
    await fetchAndRenderSuppliers();
  } catch (err) {
    console.error('Error saving supplier:', err);
    toast('❌ Error al guardar: ' + err.message);
  }
}


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
  const mList = document.getElementById('cal-list-mobile');
  if (!grid) return;
  const today = new Date().getDate();
  const offset = 2; // Wed 1 July -> Mon=0, Tue=1, Wed=2
  let html = '';
  for (let i = 0; i < offset; i++) html += '<div></div>';
  
  let mHtml = '';

  for (let d = 1; d <= 31; d++) {
    const isToday = d === today;
    const menu = PLANNER_DATA[d];
    
    let breakfastName = 'Añadir';
    let lunchName = 'Añadir';
    let dinnerName = 'Añadir';
    
    if (menu) {
       const br = (typeof RECIPES !== 'undefined' ? RECIPES : []).find(r => r.id === menu.breakfast_recipe_id);
       const lr = (typeof RECIPES !== 'undefined' ? RECIPES : []).find(r => r.id === menu.lunch_recipe_id);
       const dr = (typeof RECIPES !== 'undefined' ? RECIPES : []).find(r => r.id === menu.dinner_recipe_id);
       if (br) breakfastName = br.name;
       if (lr) lunchName = lr.name;
       if (dr) dinnerName = dr.name;
    }

    const hasMenu = menu && (menu.lunch_recipe_id || menu.dinner_recipe_id || menu.breakfast_recipe_id);
    
    html += `
      <div class="cal-day ${isToday ? 'today' : ''} flex flex-col h-full min-h-[120px] relative transition-colors" ondragover="allowDrop(event)" ondragleave="leaveDrop(event)" ondrop="dropRecipe(event, '${d}')">
        <!-- Overlay drop mask -->
        <div class="absolute inset-0 bg-brand/10 border-2 border-brand border-dashed rounded-lg opacity-0 pointer-events-none transition-opacity drop-mask z-10 flex items-center justify-center font-bold text-brand">Asignar</div>
        
        <div class="flex-1" onclick="openPlannerDayModal(${d})">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-bold ${isToday ? 'text-brand bg-brand text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-slate-400'}">${d}</span>
        </div>
        ${hasMenu ? `
          <div class="flex-grow flex flex-col justify-end gap-1 mt-1">
            ${menu.breakfast_recipe_id ? `<p class="text-[10px] font-semibold text-slate-700 leading-tight truncate" title="${breakfastName}">☕ ${breakfastName}</p>` : ''}
            ${menu.lunch_recipe_id ? `<p class="text-[10px] font-semibold text-brand leading-tight truncate" title="${lunchName}">🌞 ${lunchName}</p>` : ''}
            ${menu.dinner_recipe_id ? `<p class="text-[10px] text-slate-500 leading-tight truncate" title="${dinnerName}">🌙 ${dinnerName}</p>` : ''}
          </div>` : `
          <div class="flex-grow flex items-end justify-center pb-1">
            <span class="text-[9px] text-slate-300 hover:text-brand transition-colors">+ Añadir</span>
          </div>`
        }</div>
      </div>`;
      
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dateObj = new Date(2026, 6, d);
      const dayName = dayNames[dateObj.getDay()];
      
      mHtml += `
      <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative">
        ${isToday ? '<span class="absolute top-3 right-3 w-2 h-2 rounded-full bg-brand"></span>' : ''}
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">${dayName} ${d} de Julio</p>
        
        <div class="space-y-2 mb-4">
          <div class="flex items-center gap-2">
            <span class="text-sm">☕</span>
            <span class="text-sm ${menu && menu.breakfast_recipe_id ? 'text-slate-800 font-semibold' : 'text-slate-400 italic'} truncate flex-1">${breakfastName}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm">🌞</span>
            <span class="text-sm ${menu && menu.lunch_recipe_id ? 'text-brand font-semibold' : 'text-slate-400 italic'} truncate flex-1">${lunchName}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm">🌙</span>
            <span class="text-sm ${menu && menu.dinner_recipe_id ? 'text-slate-600 font-semibold' : 'text-slate-400 italic'} truncate flex-1">${dinnerName}</span>
          </div>
        </div>
        
        <button onclick="openPlannerDayModal(${d})" class="w-full flex justify-center items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold transition-colors border border-slate-200">
          <span class="material-symbols-outlined text-[16px]">edit</span> Editar Detalles
        </button>
      </div>`;
  }
  grid.innerHTML = html;
  if (mList) mList.innerHTML = mHtml;
}

window.updatePlannerState = function(meal, field, value) {
  if (field === 'allergies') {
    _currentPlannerState[`${meal}_${field}`] = value;
  } else {
    _currentPlannerState[`${meal}_${field}`] = parseInt(value) || 0;
  }
}

window.openPlannerDayModal = function(d) {
  _currentPlannerDay = d;
  document.getElementById('planner-day-date').textContent = `${d} de Julio, 2026`;
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
    document.getElementById(`planner-${m}-players`).value = _currentPlannerState[`${m}_players`];
    document.getElementById(`planner-${m}-halal`).value = _currentPlannerState[`${m}_halal`];
    document.getElementById(`planner-${m}-kosher`).value = _currentPlannerState[`${m}_kosher`];
    document.getElementById(`planner-${m}-vegan`).value = _currentPlannerState[`${m}_vegan`];
    document.getElementById(`planner-${m}-allergies`).value = _currentPlannerState[`${m}_allergies`];
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
  const recipeId = _currentPlannerState[`${target}_recipe_id`];
  const btn = document.getElementById(`planner-${target}-btn`);
  const card = document.getElementById(`planner-${target}-card`);
  const img = document.getElementById(`planner-${target}-img`);
  const name = document.getElementById(`planner-${target}-name`);
  
  if (recipeId) {
    const r = (typeof RECIPES !== 'undefined' ? RECIPES : []).find(rec => rec.id === recipeId);
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
  _currentPlannerState[`${target}_recipe_id`] = null;
  renderPlannerTarget(target);
}

let _currentRecipeSelectorCat = '';
let _currentRecipeSelectorQuery = '';


window.renderRecipeSelectorCategories = function() {
  const safeCategories = (typeof RECIPE_CATEGORIES !== 'undefined') ? RECIPE_CATEGORIES : [];
  
  // Desktop
  const container = document.getElementById('recipe-selector-categories');
  if (container) {
      let html = `<button onclick="setRecipeSelectorCategory('')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 ${_currentRecipeSelectorCat === '' ? 'bg-[#5e6ad2] text-white shadow-sm' : 'bg-[#3f4044] text-gray-300 hover:bg-[#4a4b4f]'}">Todas</button>`;
      
      safeCategories.forEach(c => {
        const isSelected = _currentRecipeSelectorCat === c.id;
        html += `<button onclick="setRecipeSelectorCategory('${c.id}')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 ${isSelected ? 'bg-[#5e6ad2] text-white shadow-sm' : 'bg-[#3f4044] text-gray-300 hover:bg-[#4a4b4f]'}">${c.name}</button>`;
      });
      container.innerHTML = html;
  }

  // Mobile
  const mContainer = document.getElementById('mobile-recipe-selector-categories');
  if (mContainer) {
      let html = `<button onclick="setRecipeSelectorCategory('')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 ${_currentRecipeSelectorCat === '' ? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">Todas</button>`;
      
      safeCategories.forEach(c => {
        const isSelected = _currentRecipeSelectorCat === c.id;
        html += `<button onclick="setRecipeSelectorCategory('${c.id}')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 ${isSelected ? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${c.name}</button>`;
      });
      mContainer.innerHTML = html;
  }
};


window.setRecipeSelectorCategory = function(catId) {
  _currentRecipeSelectorCat = catId;
  renderRecipeSelectorCategories();
  applyRecipeSelectorFilters();
};

window.allowDrop = function(ev) {
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
  
  const dateStr = `2026-07-${String(d).padStart(2, '0')}`;
  
  toast('Asignando...');
  
  // Merge existing data to not overwrite other meals
  const existing = PLANNER_DATA[d] || {
      breakfast_recipe_id: null,
      lunch_recipe_id: null,
      dinner_recipe_id: null,
      lunch_players: 0,
      lunch_halal: 0,
      lunch_kosher: 0,
      lunch_vegan: 0,
      lunch_allergies: '',
      dinner_players: 0,
      dinner_halal: 0,
      dinner_kosher: 0,
      dinner_vegan: 0,
      dinner_allergies: ''
  };
  
  const mealType = 'lunch';
  const payload = {
    ...existing,
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

window.filterRecipeSelector = function(query) {
  _currentRecipeSelectorQuery = query;
  applyRecipeSelectorFilters();
}


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
      grid.innerHTML = filtered.map(r => `
        <div class="bg-[#1e1e1e] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform duration-200 flex flex-col relative" draggable="true" ondragstart="dragRecipe(event, '${r.id}')" onclick="selectRecipeForPlanner('${r.id}')">
          ${r.image_url ? `<img src="${r.image_url}" class="w-full h-32 object-cover" onerror="this.style.display='none'" />` : `<div class="w-full h-32 bg-[#3a3b3f] flex items-center justify-center text-slate-500"><span class="material-symbols-outlined text-4xl">restaurant</span></div>`}
          <div class="absolute top-2 right-2 bg-[#1e1e1e]/90 text-white backdrop-blur-sm px-2 py-0.5 rounded shadow-sm border border-white/10 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full ${r.category === 'Vegetariano' ? 'bg-green-400' : 'bg-brand'}"></span>
            <span class="text-[9px] font-bold uppercase tracking-wider">${r.category}</span>
          </div>
          <div class="p-3 flex flex-col justify-center">
            <div class="flex justify-between items-start gap-2">
               <p class="text-sm font-semibold text-white leading-snug line-clamp-2">${r.name}</p>
               ${r.computed_cost > 0 ? `<span class="text-[10px] font-mono text-brand whitespace-nowrap bg-brand/10 px-1 rounded-sm">$${r.computed_cost.toFixed(2)}/p</span>` : ''}
            </div>
          </div>
        </div>
      `).join('');
  }

  // Render Mobile Bottom Sheet
  const mGrid = document.getElementById('mobile-recipe-selector-grid');
  if (mGrid) {
      mGrid.innerHTML = filtered.map(r => `
        <div class="card overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-200 flex flex-col h-full relative" onclick="selectRecipeForPlanner('${r.id}')">
          ${r.image_url ? `<img src="${r.image_url}" class="w-full h-28 object-cover rounded-t-lg" onerror="this.style.display='none'" />` : `<div class="w-full h-28 bg-slate-100 flex items-center justify-center text-slate-400 rounded-t-lg"><span class="material-symbols-outlined text-4xl">restaurant</span></div>`}
          <div class="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border border-slate-100/50">
            <span class="text-[10px] font-bold text-slate-700 uppercase tracking-wider">${r.category}</span>
          </div>
          <div class="p-2 bg-white flex-1 flex flex-col justify-center">
            <div class="flex justify-between items-start gap-1">
               <p class="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">${r.name}</p>
               ${r.computed_cost > 0 ? `<span class="text-[9px] font-mono text-brand whitespace-nowrap">$${r.computed_cost.toFixed(2)}</span>` : ''}
            </div>
          </div>
        </div>
      `).join('');
  }
}

window.selectRecipeForPlanner = function(recipeId) {
  _currentPlannerState[`${_currentPlannerTarget}_recipe_id`] = recipeId;
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
  const dateStr = `2026-07-${d.toString().padStart(2, '0')}`;
  
  // State is now maintained by updatePlannerState and selectRecipeForPlanner
  // No need to scrape DOM values. Just ensure we use _currentPlannerState directly.
  
  const payload = {
    date: dateStr,
    breakfast_recipe_id: _currentPlannerState.breakfast_recipe_id || null,
    lunch_recipe_id: _currentPlannerState.lunch_recipe_id || null,
    dinner_recipe_id: _currentPlannerState.dinner_recipe_id || null,
    lunch_players: _currentPlannerState.lunch_players || 0,
    lunch_halal: _currentPlannerState.lunch_halal || 0,
    lunch_kosher: _currentPlannerState.lunch_kosher || 0,
    lunch_vegan: _currentPlannerState.lunch_vegan || 0,
    lunch_allergies: _currentPlannerState.lunch_allergies || '',
    dinner_players: _currentPlannerState.dinner_players || 0,
    dinner_halal: _currentPlannerState.dinner_halal || 0,
    dinner_kosher: _currentPlannerState.dinner_kosher || 0,
    dinner_vegan: _currentPlannerState.dinner_vegan || 0,
    dinner_allergies: _currentPlannerState.dinner_allergies || ''
  };
  
  try {
    const { error } = await window.supabase.from('menu_planner').upsert(payload, { onConflict: 'date' });
    if (error) throw error;
    
    PLANNER_DATA[d] = payload;
    renderCalendar();
    closePlannerDayModal();
    toast('✅ Día actualizado');
  } catch(err) {
    console.error('Error al guardar menú:', err);
    toast('❌ Error: ' + err.message);
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
    text.textContent = 'Guardar Día';
  }
}

window.openWeeklyConfigModal = function() {
  document.getElementById('modal-weekly-config').classList.remove('hidden');
  document.getElementById('modal-weekly-config').classList.add('flex');
}
window.closeWeeklyConfigModal = function() {
  document.getElementById('modal-weekly-config').classList.add('hidden');
  document.getElementById('modal-weekly-config').classList.remove('flex');
}

window.saveWeeklyConfig = async function() {
  const startDateStr = document.getElementById('weekly-config-date').value;
  if (!startDateStr) {
    toast('❌ Debes seleccionar una fecha de inicio.');
    return;
  }
  
  const btn = document.getElementById('weekly-save-btn');
  const spinner = document.getElementById('weekly-save-spinner');
  const text = document.getElementById('weekly-save-text');
  
  btn.disabled = true;
  spinner.classList.remove('hidden');
  text.textContent = 'Aplicando...';
  
  try {
    const config = {
      breakfast_players: Number(document.getElementById('weekly-breakfast-players').value) || 0,
      breakfast_halal: Number(document.getElementById('weekly-breakfast-halal').value) || 0,
      breakfast_kosher: Number(document.getElementById('weekly-breakfast-kosher').value) || 0,
      breakfast_vegan: Number(document.getElementById('weekly-breakfast-vegan').value) || 0,
      breakfast_allergies: document.getElementById('weekly-breakfast-allergies').value || '',
      lunch_players: Number(document.getElementById('weekly-lunch-players').value) || 0,
      lunch_halal: Number(document.getElementById('weekly-lunch-halal').value) || 0,
      lunch_kosher: Number(document.getElementById('weekly-lunch-kosher').value) || 0,
      lunch_vegan: Number(document.getElementById('weekly-lunch-vegan').value) || 0,
      lunch_allergies: document.getElementById('weekly-lunch-allergies').value || '',
      dinner_players: Number(document.getElementById('weekly-dinner-players').value) || 0,
      dinner_halal: Number(document.getElementById('weekly-dinner-halal').value) || 0,
      dinner_kosher: Number(document.getElementById('weekly-dinner-kosher').value) || 0,
      dinner_vegan: Number(document.getElementById('weekly-dinner-vegan').value) || 0,
      dinner_allergies: document.getElementById('weekly-dinner-allergies').value || ''
    };
    
    // Create payload for 7 days
    const upserts = [];
    const baseParts = startDateStr.split('-');
    const baseDate = new Date(baseParts[0], baseParts[1] - 1, baseParts[2]);
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const isoDate = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
      
      const existing = Object.values(PLANNER_DATA).find(p => p.date === isoDate) || {};
      
      upserts.push({
        date: isoDate,
        breakfast_recipe_id: existing.breakfast_recipe_id || null,
        lunch_recipe_id: existing.lunch_recipe_id || null,
        dinner_recipe_id: existing.dinner_recipe_id || null,
        ...config
      });
    }
    
    const { error } = await window.supabase.from('menu_planner').upsert(upserts, { onConflict: 'date' });
    if (error) throw error;
    
    upserts.forEach(up => {
      // Assuming we are still in July 2026 for the UI month view
      if (up.date.startsWith('2026-07-')) {
        const day = parseInt(up.date.split('-')[2], 10);
        PLANNER_DATA[day] = up;
      }
    });
    
    renderCalendar();
    closeWeeklyConfigModal();
    toast('✅ Configuración semanal aplicada');
  } catch(err) {
    console.error('Error config semanal:', err);
    toast('❌ Error: ' + err.message);
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
    text.textContent = 'Aplicar a 7 días';
  }
}


// ── AI ASSISTANT ──────────────────────────────────────────────────
function processAI() {
  const input = document.getElementById('ai-input');
  const text = input.value.trim();
  if (!text) { toast('⚠️ Escribe o pega el texto de una receta primero'); return; }

  const msgs = document.getElementById('chat-messages');

  // User bubble
  msgs.innerHTML += `
    <div class="flex justify-end">
      <div class="chat-bubble chat-user">${text.length > 200 ? text.substring(0,200)+'...' : text}</div>
    </div>`;

  // Simulated response
  const ingredients = extractIngredients(text);
  setTimeout(() => {
    msgs.innerHTML += `
      <div class="flex gap-3">
        <div class="w-8 h-8 rounded-xl bg-brand-muted flex items-center justify-center flex-shrink-0">
          <span class="material-symbols-outlined text-brand" style="font-size:18px">auto_awesome</span>
        </div>
        <div class="chat-bubble chat-ai">
          <p class="font-semibold text-slate-900 mb-2">✅ Ingredientes extraídos (${ingredients.length} detectados):</p>
          <ul class="space-y-1 mb-3">
            ${ingredients.map(i => `<li class="text-sm flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-brand inline-block flex-shrink-0"></span>${i}</li>`).join('')}
          </ul>
          <p class="text-xs text-slate-400 border-t border-slate-100 pt-2 mt-2">Coste estimado calculado contra inventario activo. Revisa el escandallo en la sección Recetas.</p>
          <button onclick="showScreen('recetas');toast('📋 Escandallo generado correctamente')" class="mt-3 flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-xs font-semibold hover:bg-brand-dark transition-colors">
            <span class="material-symbols-outlined" style="font-size:14px">receipt_long</span>Ver escandallo generado
          </button>
        </div>
      </div>`;
    msgs.scrollTop = msgs.scrollHeight;
  }, 1200);

  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;
  toast('🤖 Procesando con IA...');
}

function extractIngredients(text) {
  const units = ['kg', 'g', 'l', 'ml', 'ud', 'unidad', 'unidades', 'taza', 'cucharada', 'cucharadita', 'litro', 'litros'];
  const words = text.toLowerCase().split(/\s+/);
  const found = [];
  const seen = new Set();
  for (let i = 0; i < words.length - 1; i++) {
    const isNum = /^\d+([.,]\d+)?$/.test(words[i]);
    const isUnit = units.some(u => words[i+1]?.includes(u));
    if (isNum && i + 2 < words.length) {
      const ingredient = words.slice(i+1, Math.min(i+4, words.length)).join(' ')
        .replace(/[,.:;]/g,'').trim();
      if (!seen.has(ingredient) && ingredient.length > 2) {
        found.push(`${words[i]} ${ingredient}`);
        seen.add(ingredient);
      }
    }
  }
  if (found.length === 0) {
    return ['Ingrediente A (cantidad detectada)', 'Ingrediente B (cantidad detectada)', 'Ingrediente C (cantidad detectada)'];
  }
  return found.slice(0, 10);
}

// ── INIT moved to module script ──

// ── CATEGORY MANAGER ──────────────────────────────────────────────
// In-memory category store derived from INVENTORY data.
// Uses Supabase to rename/rename categories on ingredients directly.
let _catMgrSelectedCat = null;

function openCatManager() {
  renderCatManagerList();
  document.getElementById('modal-cat-manager').classList.add('open');
}
function closeCatManager() {
  document.getElementById('modal-cat-manager').classList.remove('open');
  _catMgrSelectedCat = null;
}

function getCatManagerData() {
  // Build { cat: Set(subcats) } map from live INVENTORY
  const map = {};
  INVENTORY.forEach(item => {
    const c = item.cat || 'Sin categoría';
    if (!map[c]) map[c] = new Set();
    if (item.subcategory) map[c].add(item.subcategory);
  });
  return map;
}

function renderCatManagerList() {
  const map = getCatManagerData();
  const cats = Object.keys(map).sort();
  const el = document.getElementById('cat-list');
  if (!cats.length) {
    el.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">Sin categorías</p>';
    return;
  }
  el.innerHTML = cats.map(cat => {
    const subCount = map[cat].size;
    const isSelected = cat === _catMgrSelectedCat;
    return `
      <div class="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-brand-muted' : 'hover:bg-slate-50'}"
           onclick="selectCatManagerCat('${cat.replace(/'/g, "\\'")}')">
        <span class="flex-1 text-sm font-medium ${isSelected ? 'text-brand' : 'text-slate-700'}">${cat}</span>
        <span class="text-[10px] text-slate-400">${subCount} sub</span>
        <button onclick="event.stopPropagation();renameCat('${cat.replace(/'/g, "\\'")}')"
          class="p-0.5 rounded text-slate-300 hover:text-blue-500 transition-colors" title="Renombrar">
          <span class="material-symbols-outlined" style="font-size:14px">edit</span>
        </button>
        <button onclick="event.stopPropagation();deleteCat('${cat.replace(/'/g, "\\'")}')"
          class="p-0.5 rounded text-slate-300 hover:text-red-500 transition-colors" title="Eliminar categoría">
          <span class="material-symbols-outlined" style="font-size:14px">delete</span>
        </button>
      </div>`;
  }).join('');
}

function selectCatManagerCat(cat) {
  _catMgrSelectedCat = cat;
  renderCatManagerList();
  renderSubcatPanel(cat);
  document.getElementById('subcat-panel-title').textContent = cat;
  document.getElementById('subcat-add-btn').classList.remove('hidden');
}

function renderSubcatPanel(cat) {
  const map = getCatManagerData();
  const subcats = map[cat] ? [...map[cat]].sort() : [];
  const el = document.getElementById('subcat-list');
  if (!subcats.length) {
    el.innerHTML = '<p class="text-sm text-slate-400 text-center py-8">Sin subcategorías. Pulsa + para añadir.</p>';
    return;
  }
  el.innerHTML = subcats.map(s => `
    <div class="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors">
      <span class="flex-1 text-sm text-slate-700">${s}</span>
      <button onclick="renameSubcat('${cat.replace(/'/g,"\\'")}','${s.replace(/'/g,"\\'")}') "
        class="p-0.5 rounded text-slate-300 hover:text-blue-500 transition-colors" title="Renombrar">
        <span class="material-symbols-outlined" style="font-size:14px">edit</span>
      </button>
      <button onclick="deleteSubcat('${cat.replace(/'/g,"\\'")}','${s.replace(/'/g,"\\'")}') "
        class="p-0.5 rounded text-slate-300 hover:text-red-500 transition-colors" title="Eliminar">
        <span class="material-symbols-outlined" style="font-size:14px">delete</span>
      </button>
    </div>`).join('');
}

// ── ADD / SAVE CATEGORY ───────────────────────────────────────────
function startAddCategory() {
  document.getElementById('cat-add-form').classList.remove('hidden');
  document.getElementById('cat-new-name').value = '';
  document.getElementById('cat-new-name').focus();
}
function cancelAddCategory() {
  document.getElementById('cat-add-form').classList.add('hidden');
}
async function saveNewCategory() {
  const name = document.getElementById('cat-new-name').value.trim();
  if (!name) return;
  // Category doesn't exist as a row — it's just a field on ingredients.
  // We can't create an empty category without an ingredient, so we just track it.
  // For now: add to UI as a local entry and inform user.
  toast(`✅ Categoría "${name}" lista. Asígnala al crear o editar un ingrediente.`);
  cancelAddCategory();
}

// ── RENAME CATEGORY ───────────────────────────────────────────────
async function renameCat(oldName) {
  const newName = prompt(`Renombrar categoría "${oldName}" a:`, oldName);
  if (!newName || newName.trim() === oldName) return;
  if (!window.supabase) { toast('Error: Supabase no inicializado'); return; }
  const { error } = await window.supabase
    .from('ingredients')
    .update({ category: newName.trim() })
    .eq('category', oldName);
  if (error) { toast('❌ Error al renombrar: ' + error.message); return; }
  // Update local INVENTORY
  INVENTORY.forEach(i => { if (i.cat === oldName) { i.cat = newName.trim(); } });
  toast(`✅ Categoría renombrada a "${newName.trim()}"`);
  if (_catMgrSelectedCat === oldName) _catMgrSelectedCat = newName.trim();
  renderCatManagerList();
  if (_catMgrSelectedCat) selectCatManagerCat(_catMgrSelectedCat);
  populateInventoryFilters();
}

// ── DELETE CATEGORY ───────────────────────────────────────────────
async function deleteCat(cat) {
  const count = INVENTORY.filter(i => i.cat === cat).length;
  if (!confirm(`¿Eliminar la categoría "${cat}"?\nEsto quitará la categoría de ${count} ingrediente(s) (no los borra).`)) return;
  if (!window.supabase) { toast('Error: Supabase no inicializado'); return; }
  const { error } = await window.supabase
    .from('ingredients')
    .update({ category: null })
    .eq('category', cat);
  if (error) { toast('❌ Error al eliminar: ' + error.message); return; }
  INVENTORY.forEach(i => { if (i.cat === cat) i.cat = 'Sin categoría'; });
  if (_catMgrSelectedCat === cat) {
    _catMgrSelectedCat = null;
    document.getElementById('subcat-panel-title').textContent = '—';
    document.getElementById('subcat-list').innerHTML = '<p class="text-sm text-slate-400 text-center py-10">Selecciona una categoría para ver sus subcategorías</p>';
    document.getElementById('subcat-add-btn').classList.add('hidden');
  }
  toast(`✅ Categoría "${cat}" eliminada`);
  renderCatManagerList();
  populateInventoryFilters();
}

// ── ADD / SAVE SUBCATEGORY ────────────────────────────────────────
function startAddSubcategory() {
  if (!_catMgrSelectedCat) return;
  document.getElementById('subcat-add-form').classList.remove('hidden');
  document.getElementById('subcat-new-name').value = '';
  document.getElementById('subcat-new-name').focus();
}
function cancelAddSubcategory() {
  document.getElementById('subcat-add-form').classList.add('hidden');
}
async function saveNewSubcategory() {
  const name = document.getElementById('subcat-new-name').value.trim();
  if (!name || !_catMgrSelectedCat) return;
  toast(`✅ Subcategoría "${name}" lista. Asígnala al editar un ingrediente.`);
  cancelAddSubcategory();
}

// ── RENAME SUBCATEGORY ────────────────────────────────────────────
async function renameSubcat(cat, oldSub) {
  const newSub = prompt(`Renombrar subcategoría "${oldSub}" a:`, oldSub);
  if (!newSub || newSub.trim() === oldSub) return;
  if (!window.supabase) { toast('Error: Supabase no inicializado'); return; }
  const { error } = await window.supabase
    .from('ingredients')
    .update({ subcategory: newSub.trim() })
    .eq('category', cat)
    .eq('subcategory', oldSub);
  if (error) { toast('❌ Error: ' + error.message); return; }
  INVENTORY.forEach(i => { if (i.cat === cat && i.subcategory === oldSub) i.subcategory = newSub.trim(); });
  toast(`✅ Subcategoría renombrada a "${newSub.trim()}"`);
  renderSubcatPanel(cat);
  populateInventoryFilters();
}

// ── DELETE SUBCATEGORY ────────────────────────────────────────────
async function deleteSubcat(cat, sub) {
  const count = INVENTORY.filter(i => i.cat === cat && i.subcategory === sub).length;
  if (!confirm(`¿Eliminar subcategoría "${sub}"?\nAfecta a ${count} ingrediente(s) (no los borra).`)) return;
  if (!window.supabase) { toast('Error: Supabase no inicializado'); return; }
  const { error } = await window.supabase
    .from('ingredients')
    .update({ subcategory: null })
    .eq('category', cat)
    .eq('subcategory', sub);
  if (error) { toast('❌ Error: ' + error.message); return; }
  INVENTORY.forEach(i => { if (i.cat === cat && i.subcategory === sub) i.subcategory = ''; });
  toast(`✅ Subcategoría "${sub}" eliminada`);
  renderSubcatPanel(cat);
  populateInventoryFilters();
}
