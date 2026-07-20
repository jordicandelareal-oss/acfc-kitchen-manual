import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  fetchIngredients, 
  insertIngredient, 
  updateIngredient, 
  deleteIngredient,
  updateCategoryName,
  nullifyCategory,
  updateSubcategory
} from '../api';

export default function InventoryTab() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedSubcat, setSelectedSubcat] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState(1); // 1 asc, -1 desc

  // Pending changes for bulk save
  const [pendingChanges, setPendingChanges] = useState({});

  // Modals state
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [catManagerModalOpen, setCatManagerModalOpen] = useState(false);

  // Form states
  const [currentIngredientId, setCurrentIngredientId] = useState('');
  const [ingName, setIngName] = useState('');
  const [ingBrand, setIngBrand] = useState('');
  const [ingCategory, setIngCategory] = useState('');
  const [ingSubcategory, setIngSubcategory] = useState('');
  const [ingProviderId, setIngProviderId] = useState('');
  const [ingProviderRef, setIngProviderRef] = useState('');
  const [ingFormatGr, setIngFormatGr] = useState('');
  const [ingPurchasePrice, setIngPurchasePrice] = useState('');
  const [ingOutputScenario, setIngOutputScenario] = useState('KG_LT');
  const [ingWaste, setIngWaste] = useState(0);
  const [ingStockActual, setIngStockActual] = useState(0);
  const [ingStockMinimo, setIngStockMinimo] = useState(0);
  const [ingStockMaximo, setIngStockMaximo] = useState(0);
  const [ingImageUrl, setIngImageUrl] = useState('');
  const [processType, setProcessType] = useState('MERMA'); // MERMA or HIDRATACION

  // Category Manager panel states
  const [catMgrSelectedCat, setCatMgrSelectedCat] = useState(null);
  const [showAddCatForm, setShowAddCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [showAddSubcatForm, setShowAddSubcatForm] = useState(false);
  const [newSubcatName, setNewSubcatName] = useState('');

  // Fetch inventory
  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchErr } = await fetchIngredients();
      if (fetchErr) throw fetchErr;

      const suppliersList = window.SUPPLIERS || [];
      const mapped = (data || []).map(item => {
        const currentStock = Number(item.stock_actual !== null && item.stock_actual !== undefined ? item.stock_actual : item.current_stock) || 0;
        const minStock = Number(item.stock_minimo !== null && item.stock_minimo !== undefined ? item.stock_minimo : item.min_stock) || 0;
        
        // Dynamic cost calculation
        const price = Number(item.purchase_price) || 0;
        const format = Number(item.purchase_format_gr) || 0;
        const scenario = item.output_scenario || 'KG_LT';
        const pct = Number(item.waste_percentage) || 0;
        const pType = item.process_type || 'MERMA';

        let netCost = 0;
        if (price > 0 && window.mathUtils) {
          const baseCost = window.mathUtils.calcularCosteBase(price, format || 1000, scenario);
          netCost = window.mathUtils.calcularCosteNeto(baseCost, pct, pType);
        }

        const calculatedCost = netCost > 0 ? netCost : Number(item.calculated_net_cost_kg || item.precio_mas_bajo || item.precio_por_u || item.precio_por_kg || 0);

        // Supplier name resolution
        const suppObj = suppliersList.find(s => s.id === item.supplier_id);
        const resolvedSupplierName = suppObj ? suppObj.name : (item.proveedor_principal || (item.supplier_id ? 'Cargando...' : 'Sin proveedor asignado'));

        return {
          id: item.id,
          name: item.name || 'Sin nombre',
          cat: item.category || 'Sin categoría',
          subcategory: item.subcategory || '',
          brand: item.brand || '',
          provider_ref: item.provider_ref || '',
          provider_name: resolvedSupplierName,
          purchase_format_gr: Number(item.purchase_format_gr) || null,
          purchase_price: Number(item.purchase_price) || null,
          precio_compra: Number(item.purchase_price) || null,
          output_scenario: item.output_scenario || 'KG_LT',
          waste_percentage: Number(item.waste_percentage) || 0,
          process_type: pType,
          calculated_net_cost_kg: Number(item.calculated_net_cost_kg) || 0,
          stock: currentStock,
          stock_actual: currentStock,
          stock_reservado: Number(item.stock_reservado) || 0,
          stock_disponible: currentStock - (Number(item.stock_reservado) || 0),
          stock_minimo: minStock,
          stock_maximo: Number(item.stock_maximo !== null && item.stock_maximo !== undefined ? item.stock_maximo : item.max_stock) || 0,
          unit: item.unit || 'ud',
          min: minStock,
          cost: calculatedCost,
          supplier: resolvedSupplierName,
          supplier_id: item.supplier_id || null,
          proveedor_principal: item.proveedor_principal || null,
          critical: (currentStock - (Number(item.stock_reservado) || 0)) <= minStock,
          nutritional_category: item.nutritional_category || 'Sin asignar',
          image_url: item.image_url || null
        };
      });

      setInventory(mapped);
      window.INVENTORY = mapped;
      setError(null);

      // Legacy updateDashboardKPIs removed
    } catch (err) {
      console.error('Error loading inventory in React:', err);
      setError(err.message || 'Error al conectar con Supabase');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
    window.loadSupabaseInventory = loadInventory;
    return () => {
      window.loadSupabaseInventory = null;
    };
  }, [loadInventory]);

  // Derived filter arrays
  const categories = [...new Set(inventory.map(i => i.cat).filter(Boolean))].sort();
  const subcategories = [...new Set(inventory.map(i => i.subcategory).filter(Boolean))].sort();
  const providers = [...new Set(inventory.map(i => i.supplier).filter(p => p && p !== 'Sin proveedor asignado' && p !== 'Sin proveedor'))].sort();

  // Handle local change in table inputs
  const handleLocalFieldChange = (id, field, value) => {
    const numVal = parseFloat(value) || 0;

    setPendingChanges(prev => {
      const original = inventory.find(i => i.id === id) || {};
      const current = prev[id] || {
        stock_actual: original.stock_actual || 0,
        stock_minimo: original.stock_minimo || 0,
        stock_maximo: original.stock_maximo || 0
      };
      return {
        ...prev,
        [id]: {
          ...current,
          [field]: numVal
        }
      };
    });

    setInventory(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: numVal };
          if (field === 'stock_actual') updated.stock = numVal;
          if (field === 'stock_minimo') updated.min = numVal;
          updated.critical = (updated.stock_actual - updated.stock_reservado) <= updated.stock_minimo;
          return updated;
        }
        return item;
      });
    });
  };

  // Bulk save changes
  const saveAllChanges = async () => {
    const entries = Object.entries(pendingChanges);
    if (entries.length === 0) {
      window.toast('ℹ️ No hay cambios pendientes de guardar.');
      return;
    }

    try {
      const promises = entries.map(([id, fields]) => {
        const payload = {
          stock_actual: fields.stock_actual,
          stock_minimo: fields.stock_minimo,
          stock_maximo: fields.stock_maximo,
          updated_at: new Date().toISOString()
        };
        return updateIngredient(id, payload);
      });

      const results = await Promise.all(promises);
      const firstError = results.find(r => r.error);
      if (firstError) throw firstError.error;

      window.toast('✅ Cambios de inventario guardados correctamente.');
      setPendingChanges({});
      await loadInventory();
    } catch (err) {
      console.error('Error saving inventory bulk changes:', err);
      window.toast('❌ Error: ' + (err.message || 'No se pudieron guardar los cambios'));
    }
  };

  // Delete ingredient
  const handleDeleteIngredient = async (id, name) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el ingrediente "${name}"?`)) return;
    try {
      const { error: delErr } = await deleteIngredient(id);
      if (delErr) throw delErr;
      window.toast('✅ Ingrediente eliminado correctamente');
      setIngredientModalOpen(false);
      await loadInventory();
    } catch (err) {
      console.error('Error deleting ingredient:', err);
      window.toast('❌ Error al eliminar: ' + err.message);
    }
  };

  // Save single ingredient (Create or Edit mode)
  const handleSaveIngredient = async () => {
    if (!ingName.trim()) {
      window.toast('⚠️ El nombre del ingrediente es obligatorio');
      return;
    }

    const payload = {
      name: ingName.trim(),
      brand: ingBrand.trim(),
      category: ingCategory.trim(),
      subcategory: ingSubcategory.trim(),
      supplier_id: ingProviderId || null,
      provider_ref: ingProviderRef.trim(),
      purchase_format_gr: parseFloat(ingFormatGr) || null,
      purchase_price: parseFloat(ingPurchasePrice) || null,
      output_scenario: ingOutputScenario,
      waste_percentage: parseFloat(ingWaste) || 0,
      process_type: processType,
      unit: 'gr',
      stock_actual: parseFloat(ingStockActual) || 0,
      stock_minimo: parseFloat(ingStockMinimo) || 0,
      stock_maximo: parseFloat(ingStockMaximo) || 0,
      image_url: ingImageUrl.trim() || null
    };

    // Calculate net cost
    const format = parseFloat(ingFormatGr) || 0;
    const price = parseFloat(ingPurchasePrice) || 0;
    const pct = parseFloat(ingWaste) || 0;
    const baseCostPerKg = window.mathUtils ? window.mathUtils.calcularCosteBase(price, format, ingOutputScenario) : (ingOutputScenario === 'KG_LT' ? (format > 0 ? price / (format / 1000) : 0) : (format > 0 ? price / format : 0));
    const netCost = window.mathUtils ? window.mathUtils.calcularCosteNeto(baseCostPerKg, pct, processType) : (processType === 'MERMA' ? (1 - pct/100 > 0 ? baseCostPerKg / (1 - pct/100) : 0) : baseCostPerKg / (1 + pct/100));

    if (netCost > 0) {
      payload.calculated_net_cost_kg = netCost;
      payload.precio_mas_bajo = netCost;
      payload.precio_por_kg = netCost;
    }

    try {
      if (currentIngredientId) {
        // Edit mode
        const { error: updErr } = await updateIngredient(currentIngredientId, payload);
        if (updErr) throw updErr;
        window.toast('✅ Ingrediente actualizado correctamente');
      } else {
        // Create mode
        const { error: insErr } = await insertIngredient(payload);
        if (insErr) throw insErr;
        window.toast('✅ Ingrediente creado correctamente');
      }
      setIngredientModalOpen(false);
      await loadInventory();
    } catch (err) {
      console.error('Error saving ingredient:', err);
      window.toast('❌ Error al guardar: ' + err.message);
    }
  };

  // Open Edit modal
  const openEditModal = (item) => {
    setCurrentIngredientId(item.id);
    setIngName(item.name || '');
    setIngBrand(item.brand || '');
    setIngCategory(item.cat || '');
    setIngSubcategory(item.subcategory || '');
    setIngProviderId(item.supplier_id || '');
    setIngProviderRef(item.provider_ref || '');
    setIngFormatGr(item.purchase_format_gr || '');
    setIngPurchasePrice(item.purchase_price || '');
    setIngOutputScenario(item.output_scenario || 'KG_LT');
    setIngWaste(item.waste_percentage || 0);
    setIngStockActual(item.stock_actual || 0);
    setIngStockMinimo(item.stock_minimo || 0);
    setIngStockMaximo(item.stock_maximo || 0);
    setIngImageUrl(item.image_url || '');
    setProcessType(item.process_type || 'MERMA');
    setIngredientModalOpen(true);
  };

  // Open Create modal
  const openCreateModal = () => {
    setCurrentIngredientId('');
    setIngName('');
    setIngBrand('');
    setIngCategory('');
    setIngSubcategory('');
    setIngProviderId('');
    setIngProviderRef('');
    setIngFormatGr('');
    setIngPurchasePrice('');
    setIngOutputScenario('KG_LT');
    setIngWaste(0);
    setIngStockActual(0);
    setIngStockMinimo(0);
    setIngStockMaximo(0);
    setIngImageUrl('');
    setProcessType('MERMA');
    setIngredientModalOpen(true);
  };

  // Category Manager logic
  const getCatManagerData = () => {
    const map = {};
    inventory.forEach(item => {
      const c = item.cat || 'Sin categoría';
      if (!map[c]) map[c] = new Set();
      if (item.subcategory) map[c].add(item.subcategory);
    });
    return map;
  };

  const handleRenameCat = async (oldName) => {
    const newName = window.prompt(`Renombrar categoría "${oldName}" a:`, oldName);
    if (!newName || newName.trim() === oldName) return;
    const { error: err } = await updateCategoryName(oldName, newName.trim());
    if (err) { window.toast('❌ Error al renombrar: ' + err.message); return; }
    window.toast(`✅ Categoría renombrada a "${newName.trim()}"`);
    if (catMgrSelectedCat === oldName) setCatMgrSelectedCat(newName.trim());
    await loadInventory();
  };

  const handleDeleteCat = async (catName) => {
    const count = inventory.filter(i => i.cat === catName).length;
    if (!window.confirm(`¿Eliminar la categoría "${catName}"?\nEsto quitará la categoría de ${count} ingrediente(s) (no los borra).`)) return;
    const { error: err } = await nullifyCategory(catName);
    if (err) { window.toast('❌ Error al eliminar: ' + err.message); return; }
    window.toast(`✅ Categoría "${catName}" eliminada`);
    if (catMgrSelectedCat === catName) setCatMgrSelectedCat(null);
    await loadInventory();
  };

  const handleRenameSubcat = async (cat, oldSub) => {
    const newSub = window.prompt(`Renombrar subcategoría "${oldSub}" a:`, oldSub);
    if (!newSub || newSub.trim() === oldSub) return;
    const { error: err } = await updateSubcategory(cat, oldSub, newSub.trim());
    if (err) { window.toast('❌ Error: ' + err.message); return; }
    window.toast(`✅ Subcategoría renombrada a "${newSub.trim()}"`);
    await loadInventory();
  };

  const handleAddCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    window.toast(`✅ Categoría "${name}" lista. Asígnala al crear o editar un ingrediente.`);
    setShowAddCatForm(false);
    setNewCatName('');
  };

  const handleAddSubcategory = () => {
    const name = newSubcatName.trim();
    if (!name || !catMgrSelectedCat) return;
    window.toast(`✅ Subcategoría "${name}" lista. Asígnala al editar un ingrediente.`);
    setShowAddSubcatForm(false);
    setNewSubcatName('');
  };

  // Sort & Filter computations
  const filteredInventory = inventory.filter(i => {
    if (searchQuery && !(
      (i.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.brand || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.provider_ref || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.supplier || '').toLowerCase().includes(searchQuery.toLowerCase())
    )) return false;
    if (selectedCat && i.cat !== selectedCat) return false;
    if (selectedSubcat && i.subcategory !== selectedSubcat) return false;
    if (selectedProvider && i.supplier !== selectedProvider) return false;
    if (selectedStatus === 'critical' && !i.critical) return false;
    if (selectedStatus === 'ok' && i.critical) return false;
    return true;
  });

  filteredInventory.sort((a, b) => {
    const aVal = a[sortKey] ?? '';
    const bVal = b[sortKey] ?? '';
    if (typeof aVal === 'number') return (aVal - bVal) * sortDir;
    return String(aVal).localeCompare(String(bVal)) * sortDir;
  });

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev * -1);
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  // Stats computations
  const statsTotal = inventory.length;
  const statsCritical = inventory.filter(i => i.critical).length;
  const statsFillRate = statsTotal > 0 ? Math.round(((statsTotal - statsCritical) / statsTotal) * 100) : 0;
  const statsValue = useMemo(() => {
    return inventory.reduce((sum, item) => {
      const stockRaw = Number(item.stock_actual || 0);
      if (stockRaw <= 0) return sum;

      const price = Number(item.cost || item.calculated_net_cost_kg || item.precio_compra || item.purchase_price || 0);
      const unit = String(item.unit || '').toLowerCase().trim();

      // Normalize stock: if unit is gram (gr, g) or milliliter (ml), convert to kg/lt
      const isGramOrMl = unit === 'gr' || unit === 'g' || unit === 'ml';
      const stockNormalized = isGramOrMl ? stockRaw / 1000 : stockRaw;

      return sum + (stockNormalized * price);
    }, 0);
  }, [inventory]);

  const formatEuro = (val) => {
    return Number(val || 0).toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Calculate net cost display inside modal form
  const parsedFormat = parseFloat(ingFormatGr) || 0;
  const parsedPrice = parseFloat(ingPurchasePrice) || 0;
  const parsedWaste = parseFloat(ingWaste) || 0;
  const baseCostPerKg = window.mathUtils ? window.mathUtils.calcularCosteBase(parsedPrice, parsedFormat, ingOutputScenario) : (ingOutputScenario === 'KG_LT' ? (parsedFormat > 0 ? parsedPrice / (parsedFormat / 1000) : 0) : (parsedFormat > 0 ? parsedPrice / parsedFormat : 0));
  const modalNetCost = window.mathUtils ? window.mathUtils.calcularCosteNeto(baseCostPerKg, parsedWaste, processType) : (processType === 'MERMA' ? (1 - parsedWaste/100 > 0 ? baseCostPerKg / (1 - parsedWaste/100) : 0) : baseCostPerKg / (1 + parsedWaste/100));

  const hasBulkChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Control de Inventario</h1>
          <p className="text-sm text-slate-500 mt-1">Live Stock Matrix — datos en tiempo real</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="file"
            id="ai-stock-file-input"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => window.handleAiStockCameraUpload && window.handleAiStockCameraUpload(e)}
          />
          <button
            onClick={() => {
              const el = document.getElementById('ai-stock-file-input');
              if (el) el.click();
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>photo_camera</span>Escanear Insumo (IA)
          </button>
          <button onClick={() => setCatManagerModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-brand hover:text-brand transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>category</span>Categorías
          </button>
        </div>

      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>
            {loading ? '—' : statsTotal}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Total líneas</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-500" style={{ fontFamily: 'Outfit' }}>
            {loading ? '—' : statsCritical}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Stock crítico</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-success" style={{ fontFamily: 'Outfit' }}>
            {loading ? '—' : statsFillRate + '%'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Fill rate</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>
            {loading ? '—' : formatEuro(statsValue)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Valor stock</p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="relative lg:col-span-2">
            <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400" style={{ fontSize: '18px' }}>search</span>
            <input
              type="text"
              placeholder="Buscar ingrediente, marca, ref..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-brand transition-colors placeholder-slate-400"
            />
          </div>
          <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-brand w-full">
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={selectedSubcat} onChange={e => setSelectedSubcat(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-brand w-full">
            <option value="">Todas las subcategorías</option>
            {subcategories.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-brand w-full">
            <option value="">Todos los proveedores</option>
            {providers.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="flex gap-2">
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-brand">
              <option value="">Cualquier estado</option>
              <option value="critical">⚠️ Stock crítico</option>
              <option value="ok">✅ Stock óptimo</option>
            </select>
            <button onClick={() => { setSearchQuery(''); setSelectedCat(''); setSelectedSubcat(''); setSelectedProvider(''); setSelectedStatus(''); }} title="Limpiar filtros" className="flex-shrink-0 p-2.5 border border-slate-200 rounded-xl text-slate-400 hover:text-brand hover:border-brand hover:bg-brand-muted transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_alt_off</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Live Stock Matrix</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-400">
              {filteredInventory.length} de {inventory.length} líneas
            </span>
            {hasBulkChanges && (
              <button onClick={saveAllChanges} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm animate-bounce">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                <span>Guardar Cambios ({Object.keys(pendingChanges).length})</span>
              </button>
            )}
            <button onClick={openCreateModal} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark transition-colors shadow-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>Nuevo
            </button>
          </div>
        </div>

        {/* Desktop View */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 cursor-pointer hover:text-brand select-none" onClick={() => handleSort('name')}>Ingrediente {sortKey === 'name' && (sortDir === 1 ? '↑' : '↓')}</th>
                <th className="px-4 py-3 cursor-pointer hover:text-brand select-none" onClick={() => handleSort('cat')}>Categoría {sortKey === 'cat' && (sortDir === 1 ? '↑' : '↓')}</th>
                <th className="px-4 py-3 cursor-pointer hover:text-brand select-none" onClick={() => handleSort('stock')}>Stock Actual {sortKey === 'stock' && (sortDir === 1 ? '↑' : '↓')}</th>
                <th className="px-4 py-3">Mínimo</th>
                <th className="px-4 py-3">Máximo</th>
                <th className="px-4 py-3 hidden sm:table-cell cursor-pointer hover:text-brand select-none" onClick={() => handleSort('cost')}>Coste/kg {sortKey === 'cost' && (sortDir === 1 ? '↑' : '↓')}</th>
                <th className="px-4 py-3 hidden lg:table-cell cursor-pointer hover:text-brand select-none" onClick={() => handleSort('supplier')}>Proveedor {sortKey === 'supplier' && (sortDir === 1 ? '↑' : '↓')}</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white text-slate-700">
              {filteredInventory.map(item => (
                <tr key={item.id} className="tr-hover cursor-pointer" onClick={() => openEditModal(item)}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center flex-shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} className="w-full h-full object-cover" alt="" onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                        ) : (
                          <span className="material-symbols-outlined text-slate-400 text-lg">image</span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        {item.brand && <p className="text-[10px] text-slate-400 font-medium">{item.brand}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><span className="badge badge-slate">{item.cat}</span></td>
                  <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        value={item.stock_actual}
                        onChange={e => handleLocalFieldChange(item.id, 'stock_actual', e.target.value)}
                        className="w-16 px-1.5 py-0.5 text-xs font-semibold rounded bg-transparent border-0 hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-brand text-slate-900 text-center"
                      />
                      <span className="text-slate-400 text-[10px] font-normal">{item.unit}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        value={item.stock_minimo}
                        onChange={e => handleLocalFieldChange(item.id, 'stock_minimo', e.target.value)}
                        className="w-16 px-1.5 py-0.5 text-xs font-semibold rounded bg-transparent border-0 hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-brand text-slate-900 text-center"
                      />
                      <span className="text-slate-400 text-[10px] font-normal">{item.unit}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        value={item.stock_maximo}
                        onChange={e => handleLocalFieldChange(item.id, 'stock_maximo', e.target.value)}
                        className="w-16 px-1.5 py-0.5 text-xs font-semibold rounded bg-transparent border-0 hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-brand text-slate-900 text-center"
                      />
                      <span className="text-slate-400 text-[10px] font-normal">{item.unit}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700 hidden sm:table-cell">{(Number(item.cost) || 0).toFixed(2)}€</td>
                  <td className="px-4 py-4 text-slate-500 text-xs hidden lg:table-cell">{item.supplier}</td>
                  <td className="px-4 py-4">
                    {item.critical ? (
                      <span className="badge badge-red pulse-red">REORDENAR</span>
                    ) : (
                      <span className="badge badge-green">OK</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <button onClick={e => { e.stopPropagation(); openEditModal(item); }} className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand-muted transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden p-3 space-y-2">
          {filteredInventory.map(item => {
            const stockColor = item.stock_actual <= 0 ? 'text-red-500' : 'text-slate-700';
            const detailId = `react-inv-detail-${item.id}`;
            const toggleDetail = () => {
              const el = document.getElementById(detailId);
              if (el) el.classList.toggle('hidden');
            };

            return (
              <div key={item.id} className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                <div className="flex items-center py-2.5 px-3 gap-2">
                  <div className="flex flex-col min-w-0 flex-1 cursor-pointer" onClick={toggleDetail}>
                    <span className="font-medium text-slate-800 text-sm truncate leading-tight">{item.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal uppercase leading-none mt-0.5 truncate">{item.cat}</span>
                  </div>
                  <div className="flex items-baseline gap-1 flex-shrink-0 cursor-pointer" onClick={toggleDetail}>
                    <span className={`text-xs font-semibold ${stockColor}`}>{item.stock_actual}</span>
                    <span className="text-xs text-slate-400">{item.unit}</span>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={toggleDetail} className="p-1.5 text-slate-400 hover:text-slate-600">
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>expand_more</span>
                    </button>
                    <button onClick={() => openEditModal(item)} className="p-1.5 text-indigo-600 hover:text-indigo-900">
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                    </button>
                  </div>
                </div>

                <div id={detailId} className="hidden px-3 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-600 grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Proveedor</p>
                    <p className="font-medium text-slate-700 truncate">{item.supplier}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Marca / Ref.</p>
                    <p className="font-medium text-slate-700 truncate">{item.brand || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Merma</p>
                    <p className="font-medium text-slate-700">{item.waste_percentage > 0 ? item.waste_percentage + '%' : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Coste neto / {item.unit}</p>
                    <p className="font-bold text-slate-900">{(item.cost || 0).toFixed(2)}€</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Ingredient Modal */}
      {ingredientModalOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setIngredientModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>
                {currentIngredientId ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
              </h3>
              <button onClick={() => setIngredientModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre del ingrediente *</label>
                <input type="text" value={ingName} onChange={e => setIngName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Ej: Cebolla roja" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Categoría</label>
                  <input type="text" value={ingCategory} onChange={e => setIngCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Ej: Verduras" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Subcategoría</label>
                  <input type="text" value={ingSubcategory} onChange={e => setIngSubcategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Ej: Bulbos" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Proveedor asignado</label>
                  <select value={ingProviderId} onChange={e => setIngProviderId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="">Sin proveedor asignado</option>
                    {(window.SUPPLIERS || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Referencia proveedor</label>
                  <input type="text" value={ingProviderRef} onChange={e => setIngProviderRef(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Ej: REF-9902" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Formato (gr/ml)</label>
                  <input type="number" value={ingFormatGr} onChange={e => setIngFormatGr(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center" placeholder="1000" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">PVP Formato (€)</label>
                  <input type="number" step="any" value={ingPurchasePrice} onChange={e => setIngPurchasePrice(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center" placeholder="2.50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Escenario coste</label>
                  <select value={ingOutputScenario} onChange={e => setIngOutputScenario(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="KG_LT">€ / Kg o Litro</option>
                    <option value="UNIT">€ / Unidad</option>
                  </select>
                </div>
              </div>

              {/* Yield/Waste Loss process toggle */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Cálculo de coste de procesamiento</label>
                <div className="flex gap-2">
                  <button onClick={() => setProcessType('MERMA')} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${processType === 'MERMA' ? 'bg-brand text-white' : 'bg-white text-slate-500 border'}`}>
                    Merma
                  </button>
                  <button onClick={() => setProcessType('HIDRATACION')} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${processType === 'HIDRATACION' ? 'bg-sky-500 text-white' : 'bg-white text-slate-500 border'}`}>
                    Hidratación
                  </button>
                </div>
                <div className="flex gap-3 items-center">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      {processType === 'MERMA' ? 'Merma (%)' : 'Hidratación (%)'}
                    </label>
                    <input type="number" value={ingWaste} onChange={e => setIngWaste(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center" placeholder="10" />
                  </div>
                  <div className="flex-1 text-center bg-white border rounded-lg p-2">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Coste Neto Estimado</p>
                    <p className="text-base font-bold text-slate-900">{modalNetCost.toFixed(2)} €/kg</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Stock Actual</label>
                  <input type="number" value={ingStockActual} onChange={e => setIngStockActual(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Mínimo</label>
                  <input type="number" value={ingStockMinimo} onChange={e => setIngStockMinimo(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Máximo</label>
                  <input type="number" value={ingStockMaximo} onChange={e => setIngStockMaximo(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">URL de Imagen</label>
                <input type="text" value={ingImageUrl} onChange={e => setIngImageUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="https://example.com/imagen.jpg" />
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              {currentIngredientId && (
                <button onClick={() => handleDeleteIngredient(currentIngredientId, ingName)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors">
                  Eliminar
                </button>
              )}
              <button onClick={() => setIngredientModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleSaveIngredient} className="flex-1 px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {catManagerModalOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setCatManagerModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col gap-4">
            <div className="flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Gestionar Categorías</h3>
                <p className="text-xs text-slate-400 mt-0.5">Los cambios se reflejan de inmediato en los filtros e ingrediente(s)</p>
              </div>
              <button onClick={() => setCatManagerModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
              {/* Left Panel: Categories */}
              <div className="w-2/5 flex flex-col border border-slate-200 rounded-xl overflow-hidden flex-shrink-0">
                <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Categorías</span>
                  <button onClick={() => setShowAddCatForm(true)} className="p-1 rounded-lg text-brand hover:bg-brand-muted transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_circle</span>
                  </button>
                </div>
                {showAddCatForm && (
                  <div className="px-3 py-2 border-b bg-brand-muted/10 flex gap-2">
                    <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Categoría..." className="flex-1 text-xs px-2 py-1 border rounded" />
                    <button onClick={handleAddCategory} className="px-2 py-1 bg-brand text-white rounded text-xs font-semibold">OK</button>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                  {Object.keys(getCatManagerData()).sort().map(cat => {
                    const subCount = getCatManagerData()[cat].size;
                    const isSelected = cat === catMgrSelectedCat;
                    return (
                      <div key={cat} onClick={() => setCatMgrSelectedCat(cat)} className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-brand-muted' : 'hover:bg-slate-50'}`}>
                        <span className={`flex-1 text-sm font-medium ${isSelected ? 'text-brand' : 'text-slate-700'}`}>{cat}</span>
                        <span className="text-[10px] text-slate-400">{subCount} sub</span>
                        <button onClick={e => { e.stopPropagation(); handleRenameCat(cat); }} className="p-0.5 text-slate-300 hover:text-blue-500">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteCat(cat); }} className="p-0.5 text-slate-300 hover:text-red-500">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Panel: Subcategories */}
              <div className="flex-1 flex flex-col border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide truncate">
                    Subcategorías: <span className="text-brand normal-case">{catMgrSelectedCat || '—'}</span>
                  </span>
                  {catMgrSelectedCat && (
                    <button onClick={() => setShowAddSubcatForm(true)} className="p-1 rounded-lg text-brand hover:bg-brand-muted transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_circle</span>
                    </button>
                  )}
                </div>
                {showAddSubcatForm && (
                  <div className="px-3 py-2 border-b bg-brand-muted/10 flex gap-2">
                    <input type="text" value={newSubcatName} onChange={e => setNewSubcatName(e.target.value)} placeholder="Subcategoría..." className="flex-1 text-xs px-2 py-1 border rounded" />
                    <button onClick={handleAddSubcategory} className="px-2 py-1 bg-brand text-white rounded text-xs font-semibold">OK</button>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-3">
                  {!catMgrSelectedCat ? (
                    <p className="text-sm text-slate-400 text-center py-10">Selecciona una categoría para gestionar sus subcategorías</p>
                  ) : [...getCatManagerData()[catMgrSelectedCat]].length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-10 font-medium">Sin subcategorías. Pulsa + para añadir.</p>
                  ) : (
                    [...getCatManagerData()[catMgrSelectedCat]].sort().map(sub => (
                      <div key={sub} className="flex items-center gap-2 py-2 px-3 hover:bg-slate-50 rounded-lg">
                        <span className="flex-1 text-sm text-slate-700">{sub}</span>
                        <button onClick={() => handleRenameSubcat(catMgrSelectedCat, sub)} className="p-0.5 text-slate-300 hover:text-blue-500">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex-shrink-0 flex justify-end">
              <button onClick={() => setCatManagerModalOpen(false)} className="px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
