import React, { useState, useEffect, useMemo } from 'react';
import { X, Users, Plus, Trash2, Check, Edit2, AlertCircle, Calendar, Sliders } from 'lucide-react';
import { fetchComensales, insertComensal, updateComensal, deleteComensal, guardarMenuBorrador, guardarYConfirmarMenu } from '../api';
import { getMadridWeeksInMonth, getMadridWeekRange, getMadridWeekRangeLabelForSelector } from '../utils/dateUtils';

export default function ComensalesModal({
  isOpen,
  onClose,
  canEdit = false,
  currentDate = new Date(),
  selectedWeeks = [1],
  getActiveRestrictions,
  plannerData = {},
  setPlannerData,
  weeklyPlayers = {},
  setWeeklyPlayers,
  loadData,
  addLog
}) {
  const [activeTab, setActiveTab] = useState('ficha'); // 'ficha' | 'asignar' | 'visualizar'
  const [comensales, setComensales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedWeek, setExpandedWeek] = useState(null);

  // Tab 1: Ficha Form state
  const [form, setForm] = useState({
    nombre: '',
    categoria_equipo: 'Primer Equipo',
    dieta: 'Ninguna',
    alergias: '',
    activo: true
  });

  // Tab 2: Asignación Form state
  const [baseForm, setBaseForm] = useState({
    breakfast_players: 20,
    lunch_players: 20,
    dinner_players: 20
  });

  const [targetWeek, setTargetWeek] = useState(selectedWeeks[0] || 1);

  const year = currentDate ? currentDate.getFullYear() : new Date().getFullYear();
  const month = currentDate ? currentDate.getMonth() : new Date().getMonth();
  const numWeeks = getMadridWeeksInMonth ? getMadridWeeksInMonth(year, month) : 4;
  const weeksArr = Array.from({ length: numWeeks }, (_, i) => i + 1);

  // Load master list of players
  const loadComensalesList = async () => {
    setLoading(true);
    try {
      const { data, error } = await fetchComensales();
      if (error) throw error;
      setComensales(data || []);
    } catch (err) {
      console.error('Error loading comensales:', err);
      setErrorMsg('No se pudieron cargar los comensales.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadComensalesList();
      resetForm();
      setErrorMsg('');
      if (selectedWeeks && selectedWeeks[0]) {
        setTargetWeek(selectedWeeks[0]);
      }
    }
  }, [isOpen, selectedWeeks]);

  // Load weekly base comensales configuration into Tab 2 form when targetWeek or weeklyPlayers change
  useEffect(() => {
    if (!isOpen) return;
    const weekNum = targetWeek;
    if (getMadridWeekRange && currentDate) {
      const weekDaysList = getMadridWeekRange(year, month, weekNum);
      if (weekDaysList && weekDaysList[0]) {
        const weekMondayStr = weekDaysList[0].dateStr;
        const currentWeekly = weeklyPlayers?.[weekMondayStr];
        setBaseForm({
          breakfast_players: currentWeekly?.breakfast ?? 20,
          lunch_players: currentWeekly?.lunch ?? 20,
          dinner_players: currentWeekly?.dinner ?? 20
        });
      }
    }
  }, [targetWeek, weeklyPlayers, currentDate, isOpen]);

  const resetForm = () => {
    setForm({
      nombre: '',
      categoria_equipo: 'Primer Equipo',
      dieta: 'Ninguna',
      alergias: '',
      activo: true
    });
    setEditingId(null);
  };

  const handleEdit = (comensal) => {
    setEditingId(comensal.id);
    setForm({
      nombre: comensal.nombre,
      categoria_equipo: comensal.categoria_equipo || 'Primer Equipo',
      dieta: comensal.dieta || 'Ninguna',
      alergias: comensal.alergias || '',
      activo: comensal.activo ?? true
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      setErrorMsg('El nombre es obligatorio.');
      return;
    }
    setErrorMsg('');

    try {
      if (editingId) {
        const { error } = await updateComensal(editingId, form);
        if (error) throw error;
        if (typeof window.toast === 'function') {
          window.toast('👤 Comensal actualizado correctamente');
        }
      } else {
        const { error } = await insertComensal(form);
        if (error) throw error;
        if (typeof window.toast === 'function') {
          window.toast('👤 Comensal añadido correctamente');
        }
      }
      resetForm();
      loadComensalesList();
    } catch (err) {
      console.error('Error saving comensal:', err);
      setErrorMsg('Error al guardar el comensal.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este comensal de la lista maestra?')) return;
    try {
      const { error } = await deleteComensal(id);
      if (error) throw error;
      if (typeof window.toast === 'function') {
        window.toast('🗑️ Comensal de baja');
      }
      loadComensalesList();
      if (editingId === id) resetForm();
    } catch (err) {
      console.error('Error deleting comensal:', err);
      setErrorMsg('No se pudo eliminar el comensal.');
    }
  };

  const toggleActivo = async (comensal) => {
    try {
      const newActivo = !comensal.activo;
      const { error } = await updateComensal(comensal.id, { activo: newActivo });
      if (error) throw error;
      loadComensalesList();
    } catch (err) {
      console.error('Error toggling active status:', err);
    }
  };

  // Tab 2: Apply weekly base diners to Supabase menu_planner
  const handleApplyWeeklyComensales = async () => {
    if (!canEdit) return;
    const weekNum = targetWeek;
    if (getMadridWeekRange && currentDate) {
      const weekDaysList = getMadridWeekRange(year, month, weekNum);
      if (!weekDaysList || weekDaysList.length === 0) return;

      if (addLog) addLog(`Aplicando comensales base a la semana ${weekNum}...`, 'info');

      try {
        const daysToSave = [];
        const confirmedDaysToSave = [];
        const newPlannerData = { ...plannerData };

        const bPlayers = Number(baseForm.breakfast_players) || 0;
        const lPlayers = Number(baseForm.lunch_players) || 0;
        const dPlayers = Number(baseForm.dinner_players) || 0;

        const bRest = getActiveRestrictions ? getActiveRestrictions(bPlayers) : { halal: 0, kosher: 0, vegan: 0, allergies: '' };
        const lRest = getActiveRestrictions ? getActiveRestrictions(lPlayers) : { halal: 0, kosher: 0, vegan: 0, allergies: '' };
        const dRest = getActiveRestrictions ? getActiveRestrictions(dPlayers) : { halal: 0, kosher: 0, vegan: 0, allergies: '' };

        weekDaysList.forEach(({ dateStr }) => {
          const existing = plannerData[dateStr] || {};
          if (existing.lunch_allergies?.includes('[manual]')) {
            return;
          }

          const updatedDay = {
            ...existing,
            date: dateStr,
            breakfast_recipe_id: existing.breakfast_recipe_id || existing.breakfast_recipe || null,
            lunch_recipe_id: existing.lunch_recipe_id || existing.lunch_recipe || null,
            lunch_side_recipe_id: existing.lunch_side_recipe_id || existing.lunch_side_recipe || null,
            dinner_recipe_id: existing.dinner_recipe_id || existing.dinner_recipe || null,
            breakfast_players: bPlayers,
            breakfast_halal: bRest.halal,
            breakfast_kosher: bRest.kosher,
            breakfast_vegan: bRest.vegan,
            breakfast_allergies: bRest.allergies,
            lunch_players: lPlayers,
            lunch_halal: lRest.halal,
            lunch_kosher: lRest.kosher,
            lunch_vegan: lRest.vegan,
            lunch_allergies: lRest.allergies,
            dinner_players: dPlayers,
            dinner_halal: dRest.halal,
            dinner_kosher: dRest.kosher,
            dinner_vegan: dRest.vegan,
            dinner_allergies: dRest.allergies,
          };

          newPlannerData[dateStr] = updatedDay;

          if (existing.confirmado) {
            confirmedDaysToSave.push({ ...updatedDay, confirmado: true });
          } else {
            daysToSave.push(updatedDay);
          }
        });

        if (daysToSave.length > 0) {
          const { error } = await guardarMenuBorrador(daysToSave);
          if (error) throw error;
        }

        if (confirmedDaysToSave.length > 0) {
          const { error } = await guardarYConfirmarMenu(confirmedDaysToSave);
          if (error) throw error;
        }

        if (setPlannerData) setPlannerData(newPlannerData);

        const weekMondayStr = weekDaysList[0].dateStr;
        if (setWeeklyPlayers) {
          setWeeklyPlayers(prev => {
            const updated = {
              ...prev,
              [weekMondayStr]: {
                lunch: lPlayers,
                dinner: dPlayers,
                breakfast: bPlayers
              }
            };
            try {
              localStorage.setItem('acfc_weekly_players_v2', JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });
        }

        if (addLog) addLog(`Comensales base aplicados con éxito a la semana ${weekNum}`, 'success');
        if (typeof window.toast === 'function') {
          window.toast(`✅ Comensales base aplicados a la semana ${weekNum}`);
        }
        if (loadData) loadData();
      } catch (err) {
        console.error(err);
        if (addLog) addLog(`Error al aplicar comensales base: ${err.message}`, 'error');
        setErrorMsg('Error al guardar la asignación base de la semana.');
      }
    }
  };

  // Tab 3: Calculate weekly total and daily breakdowns dynamically
  const getWeeklyBreakdowns = useMemo(() => {
    if (!isOpen || !getMadridWeekRange || !currentDate || !plannerData) return [];

    const result = [];
    for (let w = 1; w <= numWeeks; w++) {
      const days = getMadridWeekRange(year, month, w);
      let totalRations = 0;
      const dayBreakdowns = [];
      let isAnyConfirmed = false;

      days.forEach(day => {
        const data = plannerData[day.dateStr] || {};
        const b = Number(data.breakfast_players) || 0;
        const l = Number(data.lunch_players) || 0;
        const d = Number(data.dinner_players) || 0;
        totalRations += (b + l + d);
        if (data.confirmado) isAnyConfirmed = true;

        const bRest = getActiveRestrictions ? getActiveRestrictions(b) : { halal: 0, kosher: 0, vegan: 0, allergies: '' };
        const lRest = getActiveRestrictions ? getActiveRestrictions(l) : { halal: 0, kosher: 0, vegan: 0, allergies: '' };
        const dRest = getActiveRestrictions ? getActiveRestrictions(d) : { halal: 0, kosher: 0, vegan: 0, allergies: '' };

        dayBreakdowns.push({
          dateStr: day.dateStr,
          dayNum: day.dayNum,
          label: day.label,
          confirmado: !!data.confirmado,
          breakfast: { players: b, ...bRest },
          lunch: { players: l, ...lRest },
          dinner: { players: d, ...dRest }
        });
      });

      const labelRange = getMadridWeekRangeLabelForSelector ? getMadridWeekRangeLabelForSelector(year, month, w) : `Semana ${w}`;

      result.push({
        weekNum: w,
        label: `Semana ${w} (${labelRange})`,
        totalRations,
        isConfirmed: isAnyConfirmed,
        days: dayBreakdowns
      });
    }
    return result;
  }, [isOpen, currentDate, plannerData, getMadridWeekRange, getActiveRestrictions, year, month, numWeeks]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box max-w-4xl max-h-[85vh] flex flex-col p-6 rounded-3xl">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users className="text-brand" size={22} />
            <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>
              Gestión Centralizada de Comensales
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 mb-5 flex-shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('ficha'); setErrorMsg(''); }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'ficha'
                ? 'border-brand text-brand'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users size={14} />
            <span>Ficha de Jugadores</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('asignar'); setErrorMsg(''); }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'asignar'
                ? 'border-brand text-brand'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sliders size={14} />
            <span>Asignar Semanal</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('visualizar'); setErrorMsg(''); }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'visualizar'
                ? 'border-brand text-brand'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar size={14} />
            <span>Visualizar Censo</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 mb-4 flex-shrink-0">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          
          {/* TAB 1: FICHA DE JUGADORES */}
          {activeTab === 'ficha' && (
            <div className="flex flex-col md:flex-row gap-6 overflow-hidden flex-1 pb-2">
              {canEdit && (
                <form onSubmit={handleSave} className="w-full md:w-80 bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col gap-3.5 flex-shrink-0 overflow-y-auto">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    {editingId ? '📝 Editar Perfil' : '➕ Nuevo Comensal'}
                  </h4>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Nombre Completo</label>
                    <input 
                      type="text"
                      placeholder="Nombre del jugador..."
                      value={form.nombre}
                      onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Categoría / Equipo</label>
                    <select
                      value={form.categoria_equipo}
                      onChange={e => setForm(prev => ({ ...prev, categoria_equipo: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                    >
                      <option value="Primer Equipo">Primer Equipo</option>
                      <option value="Juvenil A">Juvenil A</option>
                      <option value="Juvenil B">Juvenil B</option>
                      <option value="Cadete A">Cadete A</option>
                      <option value="Staff Técnico">Staff Técnico</option>
                      <option value="Otro">Otro / Invitados</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Restricción Dietética</label>
                    <select
                      value={form.dieta}
                      onChange={e => setForm(prev => ({ ...prev, dieta: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                    >
                      <option value="Ninguna">Ninguna</option>
                      <option value="Halal">Halal</option>
                      <option value="Kosher">Kosher</option>
                      <option value="Vegano">Vegano</option>
                      <option value="Vegetariano">Vegetariano</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Alergias Conocidas</label>
                    <input 
                      type="text"
                      placeholder="Ej: Gluten, Lactosa..."
                      value={form.alergias}
                      onChange={e => setForm(prev => ({ ...prev, allergies: e.target.value, alergias: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-brand"
                    />
                  </div>

                  <div className="flex items-center gap-2 py-1">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={form.activo}
                        onChange={e => setForm(prev => ({ ...prev, activo: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
                    </label>
                    <span className="text-[11px] font-semibold text-slate-600">Perfil Activo</span>
                  </div>

                  <div className="flex gap-2 mt-2 pt-2 border-t border-slate-200">
                    {editingId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="flex-1 py-2 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-brand text-white hover:bg-brand-dark rounded-lg text-xs font-semibold shadow-xs"
                    >
                      {editingId ? 'Guardar' : 'Añadir'}
                    </button>
                  </div>
                </form>
              )}
              
              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-white">
                {loading && comensales.length === 0 ? (
                  <div className="text-center p-8 text-slate-400 text-xs italic">Cargando comensales...</div>
                ) : comensales.length === 0 ? (
                  <div className="text-center p-8 text-slate-400 text-xs italic">No hay comensales registrados en la academia.</div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                        <th className="p-3">Estado</th>
                        <th className="p-3">Nombre</th>
                        <th className="p-3">Categoría</th>
                        <th className="p-3">Dieta</th>
                        <th className="p-3">Alergias</th>
                        {canEdit && <th className="p-3 text-right">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comensales.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => toggleActivo(c)}
                              className={`badge ${c.activo ? 'badge-ok' : 'badge-warn'} text-[10px] ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              {c.activo ? 'Activo' : 'Inactivo'}
                            </button>
                          </td>
                          <td className="p-3 font-semibold text-slate-800">{c.nombre}</td>
                          <td className="p-3 text-slate-500">{c.categoria_equipo || 'Primer Equipo'}</td>
                          <td className="p-3">
                            {c.dieta && c.dieta !== 'Ninguna' ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.dieta === 'Halal' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                c.dieta === 'Kosher' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                c.dieta === 'Vegano' || c.dieta === 'Vegan' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                                'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}>
                                {c.dieta}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 truncate max-w-[120px]" title={c.alergias}>
                            {c.alergias || <span className="text-slate-400">—</span>}
                          </td>
                          {canEdit && (
                            <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleEdit(c)}
                                className="p-1 text-slate-400 hover:text-brand rounded-lg hover:bg-slate-100 transition-colors"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(c.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ASIGNACIÓN DE COMENSALES */}
          {activeTab === 'asignar' && (
            <div className="flex-1 overflow-y-auto max-w-lg mx-auto w-full py-2 space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs rounded-2xl p-4 leading-relaxed">
                💡 Esta sección permite configurar el número base de comensales (Pax) para los tres servicios principales de la semana elegida. Las dietas especiales y alergias se computarán en base a las fichas activas.
              </div>

              <div className="space-y-4 bg-slate-50 border border-slate-200/80 p-5 rounded-2xl">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Semana de Aplicación
                  </label>
                  <select
                    value={targetWeek}
                    onChange={e => setTargetWeek(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:border-brand font-semibold text-slate-800"
                  >
                    {weeksArr.map(w => (
                      <option key={w} value={w}>
                        Semana {w} ({getMadridWeekRangeLabelForSelector(year, month, w)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="border-l-4 border-amber-400 pl-3 space-y-1.5">
                    <label className="block text-[10px] font-extrabold text-amber-700 uppercase tracking-wide">
                      🍳 Desayuno Pax
                    </label>
                    <input 
                      type="number"
                      disabled={!canEdit}
                      value={baseForm.breakfast_players}
                      onChange={e => setBaseForm(prev => ({ ...prev, breakfast_players: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden focus:border-amber-400 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  <div className="border-l-4 border-brand pl-3 space-y-1.5">
                    <label className="block text-[10px] font-extrabold text-brand uppercase tracking-wide">
                      ☀️ Almuerzo Pax
                    </label>
                    <input 
                      type="number"
                      disabled={!canEdit}
                      value={baseForm.lunch_players}
                      onChange={e => setBaseForm(prev => ({ ...prev, lunch_players: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden focus:border-brand disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  <div className="border-l-4 border-indigo-400 pl-3 space-y-1.5">
                    <label className="block text-[10px] font-extrabold text-indigo-700 uppercase tracking-wide">
                      🌙 Cena Pax
                    </label>
                    <input 
                      type="number"
                      disabled={!canEdit}
                      value={baseForm.dinner_players}
                      onChange={e => setBaseForm(prev => ({ ...prev, dinner_players: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden focus:border-indigo-400 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                </div>

                {canEdit ? (
                  <button
                    type="button"
                    onClick={handleApplyWeeklyComensales}
                    className="w-full py-3 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand-dark transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                  >
                    <Check size={14} />
                    <span>Aplicar Valores a la Semana {targetWeek}</span>
                  </button>
                ) : (
                  <div className="text-center p-3 text-red-650 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold mt-4">
                    ⚠️ Solo los administradores y jefes de cocina pueden configurar comensales semanales.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: VISUALIZACIÓN DE CENSO (CON ACORDEONES COLAPSABLES) */}
          {activeTab === 'visualizar' && (
            <div className="space-y-3 overflow-y-auto flex-1 pr-1 pb-2">
              {getWeeklyBreakdowns.map(b => {
                const isExpanded = expandedWeek === b.weekNum;
                return (
                  <div key={b.weekNum} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    
                    {/* Week Card Header */}
                    <div 
                      onClick={() => setExpandedWeek(isExpanded ? null : b.weekNum)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-brand flex-shrink-0">
                          <Calendar size={16} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm" style={{ fontFamily: 'Outfit' }}>
                            {b.label}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Total de platos estimados: <span className="font-extrabold text-brand">{b.totalRations} raciones</span>
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                          b.isConfirmed 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-250/30' 
                            : 'bg-amber-50 text-amber-700 border border-amber-250/30'
                        }`}>
                          {b.isConfirmed ? '✓ Confirmado' : 'Borrador'}
                        </span>
                        <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 20 }}>
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Collapsible content (Accordion) */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                        {b.totalRations === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-xs italic">
                            Sin censo asignado para esta semana. Configura los comensales base en la pestaña "Asignar Semanal".
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-2.5">
                            {b.days.map(day => {
                              const hasManual = day.lunch.allergies?.includes('[manual]');
                              return (
                                <div 
                                  key={day.dateStr} 
                                  className={`p-2.5 rounded-xl border flex flex-col justify-between space-y-2 bg-white ${
                                    day.confirmado 
                                      ? 'border-emerald-100 shadow-2xs' 
                                      : 'border-slate-200/70 shadow-3xs'
                                  }`}
                                >
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                    <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-tight">
                                      {day.label} {day.dayNum}
                                    </span>
                                    {hasManual && (
                                      <span 
                                        className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded-sm font-bold scale-90" 
                                        title="Valores personalizados manualmente para este día"
                                      >
                                        👤
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="space-y-1.5 text-[10px]">
                                    {/* Breakfast */}
                                    <div className="bg-amber-50/30 p-1.5 rounded-lg border border-amber-100/40">
                                      <div className="flex justify-between items-center font-bold text-amber-900">
                                        <span>🍳 Desayuno</span>
                                        <span>{day.breakfast.players} pax</span>
                                      </div>
                                      {(day.breakfast.halal > 0 || day.breakfast.kosher > 0 || day.breakfast.vegan > 0) && (
                                        <div className="text-[8px] text-amber-700 mt-1 space-y-0.5 border-t border-amber-100/20 pt-1">
                                          {day.breakfast.halal > 0 && <div>🕌 H: {day.breakfast.halal}</div>}
                                          {day.breakfast.kosher > 0 && <div>✡️ K: {day.breakfast.kosher}</div>}
                                          {day.breakfast.vegan > 0 && <div>🌱 V: {day.breakfast.vegan}</div>}
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Lunch */}
                                    <div className="bg-brand-muted/5 p-1.5 rounded-lg border border-brand/5">
                                      <div className="flex justify-between items-center font-bold text-brand">
                                        <span>☀️ Almuerzo</span>
                                        <span>{day.lunch.players} pax</span>
                                      </div>
                                      {(day.lunch.halal > 0 || day.lunch.kosher > 0 || day.lunch.vegan > 0) && (
                                        <div className="text-[8px] text-brand mt-1 space-y-0.5 border-t border-brand/5 pt-1">
                                          {day.lunch.halal > 0 && <div>🕌 H: {day.lunch.halal}</div>}
                                          {day.lunch.kosher > 0 && <div>✡️ K: {day.lunch.kosher}</div>}
                                          {day.lunch.vegan > 0 && <div>🌱 V: {day.lunch.vegan}</div>}
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Dinner */}
                                    <div className="bg-indigo-50/20 p-1.5 rounded-lg border border-indigo-100/30">
                                      <div className="flex justify-between items-center font-bold text-indigo-900">
                                        <span>🌙 Cena</span>
                                        <span>{day.dinner.players} pax</span>
                                      </div>
                                      {(day.dinner.halal > 0 || day.dinner.kosher > 0 || day.dinner.vegan > 0) && (
                                        <div className="text-[8px] text-indigo-700 mt-1 space-y-0.5 border-t border-indigo-100/20 pt-1">
                                          {day.dinner.halal > 0 && <div>🕌 H: {day.dinner.halal}</div>}
                                          {day.dinner.kosher > 0 && <div>✡️ K: {day.dinner.kosher}</div>}
                                          {day.dinner.vegan > 0 && <div>🌱 V: {day.dinner.vegan}</div>}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
