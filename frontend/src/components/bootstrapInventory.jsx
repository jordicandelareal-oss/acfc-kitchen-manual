import React from 'react';
import ReactDOM from 'react-dom/client';
import InventoryTab from './InventoryTab.jsx';

const container = document.getElementById('screen-inventory');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<InventoryTab />);
}
