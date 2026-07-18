import React, { useState, useEffect, useCallback } from 'react';
import { fetchSuppliers, insertSupplier, updateSupplier } from '../api';

export default function SuppliersTab() {
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Form states
  const [newSupplier, setNewSupplier] = useState({ name: '', contact: '', email: '', phone: '', notes: '' });
  const [editSupplier, setEditSupplier] = useState({ id: '', name: '', contact: '', email: '', phone: '', notes: '' });

  // Fetch suppliers
  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchErr } = await fetchSuppliers();
      if (fetchErr) throw fetchErr;

      const list = data || [];
      setSuppliers(list);
      setError(null);

      // Expose to window for backward compatibility with the legacy select dropdowns
      window.SUPPLIERS = list;
      if (typeof window.populateProviderDropdown === 'function') {
        window.populateProviderDropdown();
      }
    } catch (err) {
      console.error('Error loading suppliers in React:', err);
      setError(err.message || 'Error al conectar con Supabase');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
    // Expose reload function to global window for interoperability
    window.fetchAndRenderSuppliers = loadSuppliers;
    return () => {
      window.fetchAndRenderSuppliers = null;
    };
  }, [loadSuppliers]);

  // Search filter
  const filteredSuppliers = suppliers.filter(s => {
    const q = searchQuery.toLowerCase();
    return !q || 
      (s.name || '').toLowerCase().includes(q) || 
      (s.contact_name || '').toLowerCase().includes(q);
  });

  // Save new supplier
  const handleSaveNew = async () => {
    const name = newSupplier.name.trim();
    const email = newSupplier.email.trim();
    const phone = newSupplier.phone.trim();

    if (!name) { window.toast('⚠️ El nombre es obligatorio'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      window.toast('⚠️ El formato del email no es válido'); return;
    }
    if (phone && !/^[\d\s\+\-\.\(\)]{6,20}$/.test(phone)) {
      window.toast('⚠️ El formato del teléfono no es válido'); return;
    }

    const payload = {
      name,
      contact_name: newSupplier.contact.trim() || null,
      email: email || null,
      phone: phone || null,
      notes: newSupplier.notes.trim() || null,
    };

    try {
      const { error: insErr } = await insertSupplier(payload);
      if (insErr) throw insErr;
      window.toast('✅ Proveedor creado correctamente');
      setAddModalOpen(false);
      setNewSupplier({ name: '', contact: '', email: '', phone: '', notes: '' });
      await loadSuppliers();
    } catch (err) {
      console.error('Error inserting supplier:', err);
      window.toast('❌ Error al guardar: ' + err.message);
    }
  };

  // Save edited supplier
  const handleSaveEdit = async () => {
    const name = editSupplier.name.trim();
    const email = editSupplier.email.trim();
    const phone = editSupplier.phone.trim();

    if (!name) { window.toast('⚠️ El nombre es obligatorio'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      window.toast('⚠️ El formato del email no es válido'); return;
    }
    if (phone && !/^[\d\s\+\-\.\(\)]{6,20}$/.test(phone)) {
      window.toast('⚠️ El formato del teléfono no es válido'); return;
    }

    const payload = {
      name,
      contact_name: editSupplier.contact.trim() || null,
      email: email || null,
      phone: phone || null,
      notes: editSupplier.notes.trim() || null,
    };

    try {
      const { error: updErr } = await updateSupplier(editSupplier.id, payload);
      if (updErr) throw updErr;
      window.toast('✅ Proveedor actualizado correctamente');
      setEditModalOpen(false);
      await loadSuppliers();
    } catch (err) {
      console.error('Error updating supplier:', err);
      window.toast('❌ Error al guardar: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Directorio de Proveedores</h1>
          <p className="text-sm text-slate-500 mt-1">Catálogo homologado · tarifas · condiciones de pago</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar proveedor..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-brand transition-colors placeholder-slate-400"
          />
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>Añadir
          </button>
        </div>
      </div>

      {/* Supplier stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>
            {loading ? '—' : suppliers.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Proveedores activos</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-success" style={{ fontFamily: 'Outfit' }}>98%</p>
          <p className="text-xs text-slate-400 mt-0.5">On-time delivery</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-brand" style={{ fontFamily: 'Outfit' }}>30d</p>
          <p className="text-xs text-slate-400 mt-0.5">Plazo pago medio</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-warn" style={{ fontFamily: 'Outfit' }}>0</p>
          <p className="text-xs text-slate-400 mt-0.5">Pedidos urgentes</p>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <p className="text-center text-slate-400 py-10">Cargando proveedores...</p>
      ) : error ? (
        <div className="text-center py-12 text-slate-400">
          <span className="material-symbols-outlined text-5xl block mb-3">wifi_off</span>
          <p className="font-semibold text-slate-500">No se pudieron cargar los proveedores</p>
          <p className="text-xs mt-1">{error}</p>
          <button onClick={loadSuppliers} className="mt-3 px-4 py-1.5 bg-brand text-white text-xs rounded-lg hover:bg-brand-dark transition-colors">
            Reintentar
          </button>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <span className="material-symbols-outlined text-5xl block mb-3">local_shipping</span>
          <p className="font-semibold text-slate-500">No hay proveedores registrados</p>
          <p className="text-sm mt-1">Haz clic en «Añadir» para crear el primero</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredSuppliers.map(s => {
            const waText = encodeURIComponent(`Hola ${s.contact_name || s.name}, te adjunto el pedido de ACFC Kitchen:`);
            const rawPhone = (s.phone || '').replace(/[\s\-().]/g, '');
            const waUrl = s.phone ? `https://wa.me/${rawPhone}?text=${waText}` : '';
            const mailtoUrl = s.email ? `mailto:${s.email}?subject=${encodeURIComponent('Pedido ACFC Kitchen')}&body=${waText}` : '';

            return (
              <div key={s.id} className="card p-6 flex flex-col gap-4 supplier-active hover:-translate-y-0.5 transition-transform">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-base truncate" style={{ fontFamily: 'Outfit' }}>{s.name}</h3>
                    {s.contact_name ? (
                      <p className="text-xs text-slate-400 mt-0.5">Contacto: {s.contact_name}</p>
                    ) : (
                      <p className="text-xs text-slate-300 mt-0.5 italic">Sin contacto</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setEditSupplier({
                        id: s.id,
                        name: s.name,
                        contact: s.contact_name || '',
                        email: s.email || '',
                        phone: s.phone || '',
                        notes: s.notes || ''
                      });
                      setEditModalOpen(true);
                    }}
                    title="Editar proveedor"
                    className="ml-2 p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-brand hover:border-brand transition-colors flex-shrink-0"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div>
                    <span className="font-semibold text-slate-700 block">Email</span>
                    {s.email ? <span className="truncate block">{s.email}</span> : <span className="text-slate-300 italic">No registrado</span>}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700 block">Teléfono</span>
                    {s.phone ? <span>{s.phone}</span> : <span className="text-slate-300 italic">No registrado</span>}
                  </div>
                </div>

                {s.notes && <p className="text-sm text-slate-500 leading-relaxed">{s.notes}</p>}

                <div className="flex gap-2 pt-1 border-t border-slate-100">
                  {waUrl ? (
                    <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition-colors text-xs font-semibold">
                      WhatsApp
                    </a>
                  ) : (
                    <button disabled className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-100 text-slate-300 cursor-not-allowed text-xs font-semibold">
                      WhatsApp
                    </button>
                  )}
                  {mailtoUrl ? (
                    <a href={mailtoUrl} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-colors text-xs font-semibold">
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>mail</span> Correo
                    </a>
                  ) : (
                    <button disabled className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-100 text-slate-300 cursor-not-allowed text-xs font-semibold">
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>mail</span> Correo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Supplier Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setAddModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 class="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Añadir Proveedor</h2>
              <button onClick={() => setAddModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre del proveedor *</label>
                <input type="text" value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="Ej: Makro" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Persona de contacto</label>
                <input type="text" value={newSupplier.contact} onChange={e => setNewSupplier({ ...newSupplier, contact: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="Ej: Juan García" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                  <input type="email" value={newSupplier.email} onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="pedidos@proveedor.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Teléfono</label>
                  <input type="tel" value={newSupplier.phone} onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="+34 93 000 00 00" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Notas / descripción</label>
                <textarea value={newSupplier.notes} onChange={e => setNewSupplier({ ...newSupplier, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand resize-none" placeholder="Ej: Mayorista de hostelería, envíos semanales..."></textarea>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setAddModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleSaveNew} className="flex-1 px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setEditModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 class="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Editar Proveedor</h2>
              <button onClick={() => setEditModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre del proveedor *</label>
                <input type="text" value={editSupplier.name} onChange={e => setEditSupplier({ ...editSupplier, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="Ej: Makro" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Persona de contacto</label>
                <input type="text" value={editSupplier.contact} onChange={e => setEditSupplier({ ...editSupplier, contact: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="Ej: Juan García" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                  <input type="email" value={editSupplier.email} onChange={e => setEditSupplier({ ...editSupplier, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="pedidos@proveedor.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Teléfono</label>
                  <input type="tel" value={editSupplier.phone} onChange={e => setEditSupplier({ ...editSupplier, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="+34 600 000 000" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Notas</label>
                <textarea value={editSupplier.notes} onChange={e => setEditSupplier({ ...editSupplier, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand resize-none" placeholder="Condiciones, frecuencia de entrega..."></textarea>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleSaveEdit} className="flex-1 px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark">Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
