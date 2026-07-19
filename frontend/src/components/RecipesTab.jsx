import React, { useState, useEffect, useMemo } from 'react';
import useRecipeCalculations, { calculateRecipe } from '../hooks/useRecipeCalculations';
import { fetchRecipesWithIngredients, fetchRecipes, fetchRecipeCategories, fetchIngredients } from '../api';
import { supabase } from '../supabaseClient';

export default function RecipesTab() {
  const [recipes, setRecipes] = useState([]);
  const [recipeCategories, setRecipeCategories] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState({
    valoracion: [],
    dificultad: [],
    tiempo_elaboracion: []
  });

  // Modals
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [confirmIngredientsModalOpen, setConfirmIngredientsModalOpen] = useState(false);

  // Recipe Editor State
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [recipeName, setRecipeName] = useState('');
  const [portions, setPortions] = useState(1);
  const [recipeCategoryId, setRecipeCategoryId] = useState('');
  const [recipeInstructions, setRecipeInstructions] = useState('');
  const [recipeImageUrl, setRecipeImageUrl] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState([]); // Array of { id, name, qty, unit, tipo_corte }

  // Recipe Editor autocomplete and inline form
  const [ingSearchQuery, setIngSearchQuery] = useState('');
  const [selectedIng, setSelectedIng] = useState(null);
  const [ingQty, setIngQty] = useState('');
  const [ingCorte, setIngCorte] = useState('Entero/a');

  // Recipe Categories Modal State
  const [catAddFormOpen, setCatAddFormOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // AI confirm ingredients placeholder
  const [aiNewIngredients, setAiNewIngredients] = useState([]);

  // Active view states (cocina vs escandallo)
  const [viewStates, setViewStates] = useState({}); // recipeId -> 'cocina' | 'escandallo'

  // Image upload
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    let active = true;
    const checkAndLoad = () => {
      if (window.supabase) {
        if (active) loadAllData();
        window.refreshReactRecipes = loadAllData;
        window.loadSupabaseRecipes = loadAllData;
      } else {
        setTimeout(checkAndLoad, 100);
      }
    };
    checkAndLoad();
    return () => {
      active = false;
      window.refreshReactRecipes = null;
      window.loadSupabaseRecipes = null;
    };
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Diagnostic Session logs
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('[RECIPES DEBUG] Active Session User:', sessionData?.session?.user || 'No logged user / Anon');
      }
      console.log('[RECIPES DEBUG] Loading inventory directly from API...');
      
      // Load inventory
      let inv = window.INVENTORY || [];
      if (inv.length === 0) {
        const { data } = await fetchIngredients();
        inv = data || [];
      }
      setInventory(inv);

      // Fetch Categories
      console.log('[RECIPES DEBUG] Fetching categories directly from API...');
      const { data: catData } = await fetchRecipeCategories();
      const cats = catData || [];
      setRecipeCategories(cats);
      window.RECIPE_CATEGORIES = cats;

      // Fetch Recipes
      console.log('[RECIPES DEBUG] Fetching recipes from API...');
      let recs = [];
      const { data: relationalData, error: relationalError } = await fetchRecipesWithIngredients();
      if (!relationalError && relationalData) {
        recs = relationalData;
      } else {
        console.warn('[RECIPES DEBUG] Relational fetch failed, falling back to flat fetch. Error:', relationalError);
        const { data: flatData } = await fetchRecipes();
        recs = flatData || [];
      }
      
      setRecipes(recs);
      window.RECIPES = recs;
      window.ALL_RECIPES = recs;
      console.log('[RECIPES DEBUG] Succeeded loading', recs.length, 'recipes.');
    } catch (err) {
      console.error('[RECIPES DEBUG] Error loading recipes tab data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper check Cairo
  const checkCairo = (ingObj) => {
    if (!ingObj) return false;
    const checkString = (s) => {
      if (!s) return false;
      const normalized = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return normalized.includes('cairo') || normalized.includes('samir');
    };
    return (
      ingObj.supplier_id === 'd257d90b-ad0b-4f84-97a0-fee73612953c' ||
      checkString(ingObj.supplier) ||
      checkString(ingObj.provider_name) ||
      checkString(ingObj.proveedor_principal)
    );
  };

  // Autocomplete suggestions
  const suggestions = useMemo(() => {
    if (!ingSearchQuery.trim()) return [];
    return inventory
      .filter(i => (i.name || '').toLowerCase().includes(ingSearchQuery.toLowerCase()))
      .slice(0, 8);
  }, [ingSearchQuery, inventory]);

  // Filtering Recipes
  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (r.name || '').toLowerCase().includes(q);
        const categoryMatch = (r.category || '').toLowerCase().includes(q);
        if (!nameMatch && !categoryMatch) return false;
      }

      // Family/Category Select
      if (selectedCategory) {
        if (r.category_id !== selectedCategory && r.category !== selectedCategory) {
          // Check if selected category id matches category_id or category name matches name
          const catObj = recipeCategories.find(c => c.id === selectedCategory);
          if (!catObj || (r.category !== catObj.name && r.category_id !== selectedCategory)) {
            return false;
          }
        }
      }

      // Advanced filters
      if (advancedFilters.valoracion.length && !advancedFilters.valoracion.includes(r.valoracion || 1)) return false;
      if (advancedFilters.dificultad.length && !advancedFilters.dificultad.includes(r.dificultad || 1)) return false;
      if (advancedFilters.tiempo_elaboracion.length && !advancedFilters.tiempo_elaboracion.includes(r.tiempo_elaboracion || 1)) return false;

      return true;
    });
  }, [recipes, searchQuery, selectedCategory, advancedFilters, recipeCategories]);

  // Math totals for the whole screen
  const stats = useMemo(() => {
    const total = filteredRecipes.length;
    let sumMargin = 0;
    let sumCost = 0;
    let highCostCount = 0;

    filteredRecipes.forEach(r => {
      const { costPerPortion } = calculateRecipe(r);
      sumCost += costPerPortion;
      if (costPerPortion > 10) {
        highCostCount++;
      }
      sumMargin += 70; // constant margin
    });

    return {
      total,
      avgMargin: total > 0 ? Math.round(sumMargin / total) : 0,
      avgCost: total > 0 ? (sumCost / total) : 0,
      highCostCount
    };
  }, [filteredRecipes]);

  // Advanced filters handling
  const toggleAdvancedFilter = (type, val) => {
    setAdvancedFilters(prev => {
      const current = prev[type];
      const next = current.includes(val)
        ? current.filter(v => v !== val)
        : [...current, val];
      return { ...prev, [type]: next };
    });
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      valoracion: [],
      dificultad: [],
      tiempo_elaboracion: []
    });
    window.toast && window.toast('🧹 Filtros avanzados restablecidos');
  };

  // Recipe Metrics stars update in DB
  const handleUpdateMetric = async (recipeId, field, value) => {
    if (!window.supabase) return;
    try {
      const { error } = await window.supabase
        .from('recipes')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', recipeId);
      if (error) throw error;
      
      // Update locally
      setRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, [field]: value } : r));
    } catch (e) {
      console.error('Error updating metric:', e);
      window.toast && window.toast('❌ Error al actualizar métrica');
    }
  };

  // Save new/edit recipe
  const handleSaveRecipe = async () => {
    if (!recipeName.trim()) {
      window.toast && window.toast('⚠️ Por favor ingresa el nombre de la receta');
      return;
    }
    if (recipeIngredients.length === 0) {
      window.toast && window.toast('⚠️ Añade al menos un ingrediente');
      return;
    }

    const catObj = recipeCategories.find(c => c.id === recipeCategoryId);
    const categoryName = catObj ? catObj.name : 'General';

    try {
      const payload = {
        name: recipeName.trim(),
        portions: parseInt(portions) || 1,
        category: categoryName,
        category_id: recipeCategoryId || null,
        instructions: recipeInstructions.trim(),
        image_url: recipeImageUrl || null,
        updated_at: new Date().toISOString()
      };

      let recipeId = editingRecipeId;
      if (editingRecipeId) {
        const { error } = await window.updateRecipe(editingRecipeId, payload);
        if (error) throw error;
      } else {
        const { data, error } = await window.insertRecipe(payload);
        if (error) throw error;
        recipeId = data.id;
      }

      // Delete ingredients
      const { error: delErr } = await window.deleteRecipeIngredients(recipeId);
      if (delErr) throw delErr;

      // Group duplicates
      const grouped = {};
      recipeIngredients.forEach(item => {
        const key = item.id + '_' + (item.tipo_corte || '');
        if (grouped[key]) {
          grouped[key].quantity += Number(item.qty);
          grouped[key].quantity_per_portion += Number(item.qty);
        } else {
          grouped[key] = {
            recipe_id: recipeId,
            ingredient_id: item.id,
            quantity: Number(item.qty),
            quantity_per_portion: Number(item.qty),
            unit: item.unit,
            tipo_corte: item.tipo_corte || null
          };
        }
      });

      const { error: insErr } = await window.insertRecipeIngredients(Object.values(grouped));
      if (insErr) throw insErr;

      window.toast && window.toast(`✅ Receta "${recipeName}" guardada con éxito.`);
      setRecipeModalOpen(false);
      loadAllData();
    } catch (err) {
      console.error(err);
      window.toast && window.toast('❌ Error al guardar receta: ' + err.message);
    }
  };

  // Delete recipe
  const handleDeleteRecipe = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar esta receta permanentemente?')) return;
    try {
      if (window.deleteRecipe) {
        const { error } = await window.deleteRecipe(id);
        if (error) throw error;
        window.toast && window.toast('✅ Receta eliminada correctamente');
        loadAllData();
      }
    } catch (e) {
      window.toast && window.toast('❌ Error al eliminar receta: ' + e.message);
    }
  };

  // Recipe Categories logic
  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      if (window.insertRecipeCategory) {
        const { error } = await window.insertRecipeCategory(newCategoryName.trim());
        if (error) throw error;
        window.toast && window.toast(`✅ Familia "${newCategoryName}" creada.`);
        setNewCategoryName('');
        setCatAddFormOpen(false);
        loadAllData();
      }
    } catch (err) {
      window.toast && window.toast('❌ Error: ' + err.message);
    }
  };

  const handleRenameCategory = async (id, oldName) => {
    const newName = prompt(`Renombrar familia "${oldName}" a:`, oldName);
    if (!newName || newName.trim() === oldName) return;
    try {
      if (window.updateRecipeCategory) {
        const { error } = await window.updateRecipeCategory(id, newName.trim());
        if (error) throw error;
        window.toast && window.toast('✅ Familia renombrada.');
        loadAllData();
      }
    } catch (err) {
      window.toast && window.toast('❌ Error: ' + err.message);
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la familia "${name}"?`)) return;
    try {
      if (window.deleteRecipeCategory) {
        const { error } = await window.deleteRecipeCategory(id);
        if (error) throw error;
        window.toast && window.toast('✅ Familia eliminada.');
        loadAllData();
      }
    } catch (err) {
      window.toast && window.toast('❌ Error: ' + err.message);
    }
  };

  // Image Upload helper
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.uploadRecipeImageFile || !window.getRecipePublicUrl) return;

    setUploadingImage(true);
    try {
      const compressedBlob = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxW = 800;
            let width = img.width;
            let height = img.height;

            if (width > maxW) {
              height = Math.round((height * maxW) / width);
              width = maxW;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Canvas compression failed'));
            }, 'image/webp', 0.75);
          };
        };
      });

      const fileId = editingRecipeId || 'new';
      const fileName = `recipe_${fileId}_${Date.now()}.webp`;

      const { error } = await window.uploadRecipeImageFile(fileName, compressedBlob, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false
      });
      if (error) throw error;

      const { data: urlData } = window.getRecipePublicUrl(fileName);
      if (urlData && urlData.publicUrl) {
        setRecipeImageUrl(urlData.publicUrl);
        window.toast && window.toast('✅ Foto subida y optimizada');
      }
    } catch (err) {
      console.error(err);
      window.toast && window.toast('❌ Error al subir imagen: ' + err.message);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const openNewRecipeModal = (editId = null) => {
    if (editId && typeof editId === 'string') {
      setEditingRecipeId(editId);
      const r = recipes.find(recipe => recipe.id === editId);
      if (r) {
        setRecipeName(r.name);
        setPortions(r.portions || 1);
        setRecipeCategoryId(r.category_id || '');
        setRecipeImageUrl(r.image_url || '');
        setRecipeInstructions(r.instructions || '');
        setRecipeIngredients((r.recipe_ingredients || []).map(ri => ({
          id: ri.ingredients?.id,
          name: ri.ingredients?.name || 'Sin nombre',
          qty: Number(ri.quantity) || Number(ri.quantity_per_portion) || 0,
          unit: ri.unit || 'Gr',
          tipo_corte: ri.tipo_corte || null
        })));
      }
    } else {
      setEditingRecipeId(null);
      setRecipeName('');
      setPortions(1);
      setRecipeCategoryId(recipeCategories[0]?.id || '');
      setRecipeImageUrl('');
      setRecipeInstructions('');
      setRecipeIngredients([]);
    }
    setRecipeModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Top Header Controls */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Catálogo de Recetas</h1>
          <p className="text-sm text-slate-500 mt-1">Fichas de coste, márgenes y explosión de ingredientes</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar receta..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-brand transition-colors placeholder-slate-400 w-full sm:w-60"
          />
          
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 outline-none select-custom pr-8"
          >
            <option value="">Todas las familias</option>
            {recipeCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button
            onClick={() => setCategoriesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>folder</span>Familias
          </button>

          <div className="h-6 w-[1px] bg-slate-200 hidden lg:block"></div>

          {/* Rating */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1">Val:</span>
            {[3, 2, 1].map(val => (
              <button
                key={val}
                onClick={() => toggleAdvancedFilter('valoracion', val)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all select-none ${
                  advancedFilters.valoracion.includes(val)
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {val}★
              </button>
            ))}
          </div>

          {/* Difficulty */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1">Dif:</span>
            {[
              { label: 'Fác', val: 1 },
              { label: 'Med', val: 2 },
              { label: 'Alt', val: 3 }
            ].map(item => (
              <button
                key={item.val}
                onClick={() => toggleAdvancedFilter('dificultad', item.val)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all select-none ${
                  advancedFilters.dificultad.includes(item.val)
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Time */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1">Tiem:</span>
            {[
              { label: 'Rap', val: 1 },
              { label: 'Med', val: 2 },
              { label: 'Lar', val: 3 }
            ].map(item => (
              <button
                key={item.val}
                onClick={() => toggleAdvancedFilter('tiempo_elaboracion', item.val)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all select-none ${
                  advancedFilters.tiempo_elaboracion.includes(item.val)
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            onClick={clearAdvancedFilters}
            className="text-[10px] text-slate-400 hover:text-red-500 hover:underline transition-colors font-semibold px-1"
          >
            Limpiar
          </button>
        </div>

        <button
          onClick={() => openNewRecipeModal()}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark transition-colors shadow-sm w-full sm:w-auto justify-center"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>Nueva receta
        </button>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>{stats.total}</p>
          <p className="text-xs text-slate-400 mt-0.5">Recetas activas</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-success" style={{ fontFamily: 'Outfit' }}>{stats.avgMargin}%</p>
          <p className="text-xs text-slate-400 mt-0.5">Margen medio</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-brand" style={{ fontFamily: 'Outfit' }}>{stats.avgCost.toFixed(2)}€</p>
          <p className="text-xs text-slate-400 mt-0.5">Coste/ración medio</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-warn" style={{ fontFamily: 'Outfit' }}>{stats.highCostCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">Coste alto (&gt;10€)</p>
        </div>
      </div>

      {/* Recipe List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10 text-slate-500">Cargando recetas del recetario...</div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-10 text-slate-400 italic">No se encontraron recetas con los filtros seleccionados.</div>
        ) : (
          filteredRecipes.map(r => {
            const { parsedIngredients, totalGrams, portions: rPortions, costPerPortion, totalRecipeCost, suggestedPrice } = calculateRecipe(r);
            const viewType = viewStates[r.id] || 'cocina';
            const detailOpen = viewStates[r.id + '_open'] || false;

            return (
              <div key={r.id} className="card overflow-hidden flex flex-col">
                {r.image_url && <img src={r.image_url} className="w-full h-32 object-cover" onError={e => e.target.style.display = 'none'} alt={r.name} />}
                
                <div className="px-6 py-5 flex flex-wrap justify-between items-start gap-4 cursor-pointer" onClick={() => setViewStates(prev => ({ ...prev, [r.id + '_open']: !detailOpen }))}>
                  <div className="flex items-center gap-4">
                    <div className="kpi-icon bg-brand-muted"><span className="material-symbols-outlined text-brand" style={{ fontSize: '22px' }}>restaurant_menu</span></div>
                    <div>
                      <h3 className="font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>{r.name || 'Sin nombre'}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <span className="badge badge-slate mr-2">{r.category || 'Sin familia'}</span>
                        {rPortions} pax · Coste total: {totalRecipeCost.toFixed(2)}€
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>{costPerPortion.toFixed(2)}€</p>
                      <p className="text-xs text-slate-400">por ración</p>
                    </div>
                    
                    {/* Stars Metric */}
                    <div className="flex flex-col gap-0.5 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1 text-slate-500 text-[11px]" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 text-center">⏱️</span>
                        <div className="flex">
                          {[1, 2, 3].map(val => (
                            <span
                              key={val}
                              onClick={() => handleUpdateMetric(r.id, 'tiempo_elaboracion', val)}
                              className={`cursor-pointer text-[13px] leading-none transition-transform hover:scale-125 ${val <= (r.tiempo_elaboracion || 1) ? 'text-amber-500' : 'text-slate-200'}`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 text-center">🔥</span>
                        <div className="flex">
                          {[1, 2, 3].map(val => (
                            <span
                              key={val}
                              onClick={() => handleUpdateMetric(r.id, 'dificultad', val)}
                              className={`cursor-pointer text-[13px] leading-none transition-transform hover:scale-125 ${val <= (r.dificultad || 1) ? 'text-amber-500' : 'text-slate-200'}`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 text-center">⭐</span>
                        <div className="flex">
                          {[1, 2, 3].map(val => (
                            <span
                              key={val}
                              onClick={() => handleUpdateMetric(r.id, 'valoracion', val)}
                              className={`cursor-pointer text-[13px] leading-none transition-transform hover:scale-125 ${val <= (r.valoracion || 1) ? 'text-amber-500' : 'text-slate-200'}`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      className="p-2 rounded-xl text-slate-400 hover:text-brand hover:bg-brand-muted transition-colors ml-2"
                      onClick={e => {
                        e.stopPropagation();
                        setViewStates(prev => ({ ...prev, [r.id + '_open']: !detailOpen }));
                      }}
                    >
                      <span className={`material-symbols-outlined transition-transform duration-200 ${detailOpen ? 'rotate-180' : ''}`} style={{ fontSize: '22px' }}>expand_more</span>
                    </button>
                  </div>
                </div>

                {/* Detail Accordion Panel */}
                {detailOpen && (
                  <div className="px-6 pb-6 border-t border-slate-100 pt-5">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-slate-700">Ficha Técnica e Ingredientes</h4>
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                          onClick={() => setViewStates(prev => ({ ...prev, [r.id]: 'cocina' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${viewType === 'cocina' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'} transition-all`}
                        >
                          Cocina
                        </button>
                        <button
                          onClick={() => setViewStates(prev => ({ ...prev, [r.id]: 'escandallo' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${viewType === 'escandallo' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'} transition-all`}
                        >
                          Escandallo
                        </button>
                      </div>
                    </div>

                    {/* VISTA A: COCINA */}
                    {viewType === 'cocina' && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                          <table className="w-full text-sm">
                            <thead>
                              <tr class="text-xs text-slate-400 uppercase border-b border-slate-100">
                                <th className="pb-2 text-left font-semibold">Ingrediente</th>
                                <th className="pb-2 text-right font-semibold">Cantidad</th>
                                <th className="pb-2 text-right font-semibold">Unidad</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {parsedIngredients.map((ing, idx) => (
                                <tr key={idx} className="text-slate-700">
                                  <td className="py-2.5 font-medium">{ing.name}</td>
                                  <td className="py-2.5 text-right text-slate-500 font-mono">{ing.rawQty}</td>
                                  <td className="py-2.5 text-right text-slate-400">{ing.unit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Instrucciones de Preparación</p>
                            <div className="text-sm text-slate-600 space-y-2">
                              {r.instructions ? r.instructions.split('\n').map((step, idx) => (
                                <p key={idx} className="leading-relaxed"><strong className="text-brand mr-1">{idx+1}.</strong> {step}</p>
                              )) : <p className="italic text-slate-400">Sin instrucciones registradas.</p>}
                            </div>
                          </div>
                          
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => openNewRecipeModal(r.id)}
                              className="flex-grow flex items-center justify-center gap-1.5 py-2 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition-colors"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>Editar
                            </button>
                            <button
                              onClick={() => handleDeleteRecipe(r.id)}
                              className="px-3 py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                              title="Eliminar Receta"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* VISTA B: ESCANDALLO */}
                    {viewType === 'escandallo' && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="text-slate-400 uppercase border-b border-slate-100">
                                <th className="pb-2 font-semibold">Ingrediente</th>
                                <th className="pb-2 font-semibold">Clasificación</th>
                                <th className="pb-2 text-right font-semibold">Porción</th>
                                <th className="pb-2 text-right font-semibold">Costo Unitario</th>
                                <th className="pb-2 text-right font-semibold">Merma</th>
                                <th className="pb-2 text-right font-semibold">Costo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {parsedIngredients.map((ing, idx) => (
                                <tr key={idx} className="text-slate-700">
                                  <td className="py-2.5 font-medium text-slate-900">{ing.name}</td>
                                  <td className="py-2.5"><span className="badge badge-slate">{ing.nutritional_category}</span></td>
                                  <td className="py-2.5 text-right font-mono">{ing.rawQty} {ing.unit}</td>
                                  <td className="py-2.5 text-right font-mono text-slate-500">{ing.unitCostText}</td>
                                  <td className="py-2.5 text-right font-mono text-slate-500">{ing.waste_percentage}%</td>
                                  <td className="py-2.5 text-right font-mono font-bold text-slate-800">{ing.cost.toFixed(3)}€</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Métricas de Negocio</p>
                            <div className="flex justify-between text-xs text-slate-600">
                              <span>Gramaje Total Ración:</span>
                              <span className="font-bold text-slate-900">{totalGrams.toFixed(0)} gr</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-600 border-t border-slate-100 pt-2">
                              <span>Costo Real Ración:</span>
                              <span className="font-bold text-brand text-sm">{costPerPortion.toFixed(2)}€</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-600 border-t border-slate-100 pt-2">
                              <span>Costo Total ({rPortions} pax):</span>
                              <span className="font-bold text-slate-900 text-sm">{totalRecipeCost.toFixed(2)}€</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-600 border-t border-slate-100 pt-2">
                              <span>PVP Sugerido (70% Margen):</span>
                              <span className="font-bold text-success text-sm">{suggestedPrice.toFixed(2)}€</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: NUEVA / EDITAR RECETA */}
      {recipeModalOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setRecipeModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-h-[90vh] flex flex-col" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>
                {editingRecipeId ? 'Editar Receta' : 'Nueva Receta'}
              </h3>
              <button onClick={() => setRecipeModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              {/* Basic Data */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre de la Receta</label>
                  <input
                    type="text"
                    value={recipeName}
                    onChange={e => setRecipeName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand"
                    placeholder="Ej: Paella Valenciana"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Porciones (Pax)</label>
                  <input
                    type="number"
                    value={portions}
                    onChange={e => setPortions(parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Familia / Categoría</label>
                  <select
                    value={recipeCategoryId}
                    onChange={e => setRecipeCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand bg-white"
                  >
                    <option value="">Seleccionar familia...</option>
                    {recipeCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Foto de la Receta</label>
                  <div className="flex gap-3 items-center">
                    <label className="flex-grow flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 border-dashed rounded-lg cursor-pointer hover:border-brand hover:bg-brand-muted/20 transition-all text-xs font-semibold text-slate-600">
                      <span className="material-symbols-outlined text-sm">cloud_upload</span>
                      <span>{uploadingImage ? 'Subiendo...' : recipeImageUrl ? 'Cambiar foto' : 'Subir imagen'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                    <div className="w-10 h-10 border border-slate-200 rounded-lg overflow-hidden flex-shrink-0 bg-slate-50 flex items-center justify-center relative">
                      {recipeImageUrl ? (
                        <img src={recipeImageUrl} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <span className="material-symbols-outlined text-slate-400 text-lg">image</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ingredients Builder */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Añadir Ingredientes</span>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-grow">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Buscar Insumo</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Buscar ingrediente por nombre..."
                        value={ingSearchQuery}
                        onChange={e => setIngSearchQuery(e.target.value)}
                        className="flex-grow px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand"
                      />
                      <button
                        onClick={() => {
                          setIngSearchQuery('');
                          setSelectedIng(null);
                          setIngQty('');
                        }}
                        className="px-3 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
                      >
                        Limpiar
                      </button>
                    </div>
                    {/* Autocomplete List */}
                    {suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                        {suggestions.map(m => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setSelectedIng(m);
                              setIngSearchQuery(m.name);
                              setIngQty('');
                            }}
                            className="px-4 py-2 text-xs text-slate-700 hover:bg-brand-muted hover:text-brand cursor-pointer font-semibold flex justify-between"
                          >
                            <span>{m.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{m.cat} · {m.unit}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="w-full sm:w-32">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Cantidad</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={ingQty}
                        onChange={e => setIngQty(e.target.value)}
                        disabled={!selectedIng}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand pr-8 disabled:bg-slate-50 disabled:text-slate-400"
                      />
                      <span className="absolute right-3 top-[9px] text-[10px] font-bold text-slate-400 uppercase">
                        {selectedIng ? selectedIng.unit : '--'}
                      </span>
                    </div>
                  </div>

                  {/* Cut type selector (Cairo rule) */}
                  {selectedIng && checkCairo(selectedIng) && (
                    <div className="w-full sm:w-40">
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tipo de Corte</label>
                      <select
                        value={ingCorte}
                        onChange={e => setIngCorte(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand bg-white"
                      >
                        <option value="Entero/a">Entero/a</option>
                        <option value="Tacos">Tacos</option>
                        <option value="Guiso">Guiso</option>
                        <option value="Picada">Picada</option>
                        <option value="Paella">Paella</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        if (!selectedIng) return;
                        const qtyVal = parseFloat(ingQty);
                        if (isNaN(qtyVal) || qtyVal <= 0) {
                          window.toast && window.toast('⚠️ Introduce una cantidad válida mayor que 0.');
                          return;
                        }

                        const isCairo = checkCairo(selectedIng);
                        const cType = isCairo ? ingCorte : null;

                        if (recipeIngredients.some(item => item.id === selectedIng.id && item.tipo_corte === cType)) {
                          window.toast && window.toast('⚠️ Este ingrediente con el mismo corte ya ha sido añadido.');
                          return;
                        }

                        setRecipeIngredients(prev => [...prev, {
                          id: selectedIng.id,
                          name: selectedIng.name,
                          qty: qtyVal,
                          unit: selectedIng.unit || 'Gr',
                          tipo_corte: cType
                        }]);

                        // Reset
                        setIngSearchQuery('');
                        setSelectedIng(null);
                        setIngQty('');
                      }}
                      disabled={!selectedIng}
                      className="w-full sm:w-auto px-4 py-2 bg-brand text-white font-semibold rounded-lg text-sm hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:bg-slate-300"
                    >
                      Añadir
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100">
                        <th className="py-2">Ingrediente</th>
                        <th className="py-2 text-right w-24">Cantidad</th>
                        <th className="py-2 text-center w-20">Unidad</th>
                        <th className="py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {recipeIngredients.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-4 text-center text-slate-400 italic">
                            No hay ingredientes añadidos. Usa el buscador de arriba.
                          </td>
                        </tr>
                      ) : (
                        recipeIngredients.map((item, idx) => {
                          const ingObj = inventory.find(i => i.id === item.id);
                          const isCairo = checkCairo(ingObj);

                          return (
                            <tr key={idx} className="align-middle">
                              <td className="py-2.5 font-medium text-slate-700">
                                {isCairo ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="font-semibold">{item.name}</span>
                                    <select
                                      value={item.tipo_corte || ''}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setRecipeIngredients(prev => prev.map((ri, rIdx) => rIdx === idx ? { ...ri, tipo_corte: val || null } : ri));
                                      }}
                                      className="w-full max-w-[150px] px-1.5 py-0.5 border border-slate-200 rounded-lg text-[10px] bg-amber-50/50 text-amber-900 outline-none focus:border-brand font-semibold"
                                    >
                                      <option value="">Seleccionar corte...</option>
                                      <option value="Entero/a">Entero/a</option>
                                      <option value="Tacos">Tacos</option>
                                      <option value="Guiso">Guiso</option>
                                      <option value="Picada">Picada</option>
                                      <option value="Paella">Paella</option>
                                    </select>
                                  </div>
                                ) : (
                                  <>
                                    {item.name}
                                    {item.tipo_corte && (
                                      <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-50 text-amber-700 rounded font-semibold border border-amber-100">
                                        {item.tipo_corte}
                                      </span>
                                    )}
                                  </>
                                )}
                              </td>
                              <td className="py-2.5">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.qty}
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setRecipeIngredients(prev => prev.map((ri, rIdx) => rIdx === idx ? { ...ri, qty: val } : ri));
                                  }}
                                  className="w-20 px-2 py-1 text-right border border-slate-200 rounded-lg text-xs font-mono"
                                />
                              </td>
                              <td className="py-2.5">
                                <select
                                  value={item.unit}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setRecipeIngredients(prev => prev.map((ri, rIdx) => rIdx === idx ? { ...ri, unit: val } : ri));
                                  }}
                                  className="w-16 px-1 py-1 border border-slate-200 rounded-lg text-xs bg-white text-center"
                                >
                                  <option value="Gr">Gr</option>
                                  <option value="Ml">Ml</option>
                                  <option value="ud">ud</option>
                                </select>
                              </td>
                              <td className="py-2.5 text-center">
                                <button
                                  onClick={() => setRecipeIngredients(prev => prev.filter((_, rIdx) => rIdx !== idx))}
                                  className="p-1 rounded text-slate-300 hover:text-red-500"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Instructions */}
              <div className="border-t border-slate-100 pt-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Instrucciones de Elaboración (un paso por línea)</label>
                <textarea
                  rows="4"
                  value={recipeInstructions}
                  onChange={e => setRecipeInstructions(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand resize-none placeholder-slate-400"
                  placeholder="Paso 1: Sofreír la cebolla y el ajo&#10;Paso 2: Añadir los ingredientes frescos"
                />
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3 bg-white flex-shrink-0">
              <button onClick={() => setRecipeModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
              <button
                onClick={handleSaveRecipe}
                className="px-6 py-2 text-sm font-semibold text-white bg-brand hover:bg-brand-dark rounded-lg shadow-sm transition-all flex items-center gap-2"
              >
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FAMILIAS DE RECETA */}
      {categoriesModalOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setCategoriesModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-h-[85vh] flex flex-col" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Familias de Receta</h3>
              <button onClick={() => setCategoriesModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="flex-grow overflow-y-auto pr-2 divide-y divide-slate-100">
              {recipeCategories.length === 0 ? (
                <p className="p-6 text-center text-slate-400 italic">No hay familias registradas.</p>
              ) : (
                recipeCategories.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-3">
                    <span className="text-sm font-semibold text-slate-700 font-display">{c.name}</span>
                    <div className="flex gap-1">
                      <button onClick={() => handleRenameCategory(c.id, c.name)} className="p-1 rounded text-slate-400 hover:text-brand">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button onClick={() => handleDeleteCategory(c.id, c.name)} className="p-1 rounded text-slate-400 hover:text-red-500">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 flex-shrink-0">
              {catAddFormOpen ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nombre de la nueva familia..."
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    className="flex-grow px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand"
                  />
                  <button onClick={handleSaveCategory} className="px-4 py-2 bg-success text-white text-xs font-semibold rounded-lg hover:bg-success-dark">Guardar</button>
                  <button onClick={() => setCatAddFormOpen(false)} className="px-3 py-2 border border-slate-200 text-xs text-slate-500 rounded-lg hover:bg-slate-50">Cancelar</button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <button onClick={() => setCatAddFormOpen(true)} className="flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-dark">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>Nueva Familia
                  </button>
                  <button onClick={() => setCategoriesModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cerrar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
