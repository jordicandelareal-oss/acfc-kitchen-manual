import React from 'react';
import ReactDOM from 'react-dom/client';
import RecipesTab from './RecipesTab.jsx';

const container = document.getElementById('screen-recetas');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<RecipesTab />);
}
