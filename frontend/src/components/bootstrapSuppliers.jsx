import React from 'react';
import ReactDOM from 'react-dom/client';
import SuppliersTab from './SuppliersTab.jsx';

const container = document.getElementById('screen-proveedores');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<SuppliersTab />);
}
