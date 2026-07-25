import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Trash2, Check, Edit2, AlertCircle } from 'lucide-react';
import { fetchComensales, insertComensal, updateComensal, deleteComensal } from '../api';

export default function ComensalesModal({ isOpen, onClose }) {
  const [comensales, setComensales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form state
  const [form, setForm] = useState({
    nombre: '',
    categoria_equipo: 'Primer Equipo',
    dieta: 'Ninguna',
    alergias: '',
    activo: true
  });

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
    }
  }, [isOpen]);

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
        // Update
        const { error } = await updateComensal(editingId, form);
        if (error) throw error;
        if (typeof window.toast === 'function') {
          window.toast('👤 Comensal actualizado correctamente');
        }
      } else {
        // Insert
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
        window.toast('🗑️ Comensal eliminado');
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users className="text-brand" size={22} />
            <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>
              Gestión de Comensales & Perfiles
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 mb-3">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-6 overflow-hidden flex-1 pb-2">
          {/* Left panel: CRUD form */}
          <form onSubmit={handleSave} className="w-full md:w-80 bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col gap-3.5 flex-shrink-0">
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
                onChange={e => setForm(prev => ({ ...prev, alergias: e.target.value }))}
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
              <span className="text-[11px] font-semibold text-slate-600">Perfil Activo (asistencia regular)</span>
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
                {editingId ? 'Guardar Cambios' : 'Añadir Comensal'}
              </button>
            </div>
          </form>

          {/* Right panel: Table list of comensales */}
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-white">
            {loading && comensales.length === 0 ? (
              <div className="text-center p-8 text-slate-400 text-xs italic">Cargando comensales...</div>
            ) : comensales.length === 0 ? (
              <div className="text-center p-8 text-slate-400 text-xs italic">No hay comensales registrados en Supabase. Use el formulario de la izquierda para añadir perfiles.</div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                    <th className="p-3">Estado</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Dieta</th>
                    <th className="p-3">Alergias</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comensales.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => toggleActivo(c)}
                          className={`badge ${c.activo ? 'badge-ok' : 'badge-warn'} text-[10px] cursor-pointer`}
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
                      <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleEdit(c)}
                          className="p-1 text-slate-400 hover:text-brand rounded-lg hover:bg-slate-100 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
