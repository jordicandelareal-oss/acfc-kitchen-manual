/**
 * Reglas de negocio y nutricionales para la generación automática de menús.
 */
export const PLANNER_RULES = {
  // Reglas del planificador (configurables por el usuario y persistidas en localStorage)
  usuario: [
    {
      key: 'menu_setting_no_paella_noche',
      label: 'Prohibir Paella por la noche',
      desc: 'Evita planificar recetas que contengan la palabra "Paella" en las cenas.',
      type: 'boolean',
      defaultValue: true,
      section: 'personalizable'
    },
    {
      key: 'menu_setting_no_repetir_carbohidratos',
      label: 'Evitar repetir Carbohidratos',
      desc: 'Evita planificar recetas del tipo "Pasta" o "Arroz" tanto en el almuerzo como en la cena del mismo día.',
      type: 'boolean',
      defaultValue: true,
      section: 'personalizable'
    },
    {
      key: 'menu_setting_incluir_guarniciones',
      label: 'Asignar Guarniciones Automáticas',
      desc: 'Asigna automáticamente un plato de acompañamiento (ensalada, etc.) a los almuerzos.',
      type: 'boolean',
      defaultValue: true,
      section: 'personalizable'
    },
    {
      key: 'menu_setting_incluir_especiales',
      label: 'Incluir recetas Especiales',
      desc: 'Permite seleccionar platos de la categoría "Especiales" (ej. marisco o premium).',
      type: 'boolean',
      defaultValue: false,
      section: 'personalizable'
    },
    {
      key: 'menu_setting_sencillo_fds',
      label: 'Menús rápidos de Fin de Semana',
      desc: 'Filtra y selecciona solo platos de preparación rápida (< 30 min) para sábados y domingos.',
      type: 'boolean',
      defaultValue: false,
      section: 'personalizable'
    }
  ],

  // Obtiene los valores activos (priorizando localStorage sobre los valores por defecto)
  getSettings() {
    const settings = {};
    this.usuario.forEach(rule => {
      const stored = localStorage.getItem(rule.key);
      if (stored !== null) {
        settings[rule.key] = stored === 'true';
      } else {
        settings[rule.key] = rule.defaultValue;
      }
    });
    return settings;
  },

  // Motor unificado de reglas de negocio
  applyBusinessRules(recipes, rules, isWeekend = false, mealType = 'lunch', lunchRecipe = null, recentRecipeIds = []) {
    const incluirEspeciales = rules['menu_setting_incluir_especiales'];
    const menuSencilloFDS = rules['menu_setting_sencillo_fds'];
    const noPaellaNoche = rules['menu_setting_no_paella_noche'];
    const noRepetirCarbohidratos = rules['menu_setting_no_repetir_carbohidratos'];

    return recipes.filter(recipe => {
      const name = (recipe.name || '').toLowerCase();
      const cat = (recipe.category || '').toLowerCase();

      // 1. Regla de Especiales
      if (recipe.category === 'Especiales' && !incluirEspeciales) {
        return false;
      }

      // 2. Regla de Fin de Semana Sencillo
      if (isWeekend && menuSencilloFDS) {
        const tiempo = Number(recipe.cook_time || recipe.tiempo_elaboracion) || 30;
        if (tiempo > 30) return false;
      }

      // 3. Regla de Paella / Guisos de Noche (Cenas ligeras)
      if (mealType === 'dinner') {
        if (noPaellaNoche && name.includes('paella')) {
          return false;
        }
        // Excluir guisos pesados y asados pesados por la noche
        if (name.includes('guiso') || name.includes('estofado') || name.includes('fabada') || name.includes('cocido')) {
          return false;
        }
      }

      // 4. Regla de No Repetir Carbohidratos (Pasta/Arroz)
      if (mealType === 'dinner' && noRepetirCarbohidratos && lunchRecipe) {
        const lunchName = (lunchRecipe.name || '').toLowerCase();
        const esCarbLunch = lunchName.includes('pasta') || lunchName.includes('tallarines') || lunchName.includes('macarrones') || lunchName.includes('arroz') || lunchName.includes('paella');
        const esCarbDinner = name.includes('pasta') || name.includes('tallarines') || name.includes('macarrones') || name.includes('arroz') || name.includes('paella');
        if (esCarbLunch && esCarbDinner) {
          return false;
        }
      }

      // 5. Regla de los 4-5 Días (Rotación Estricta de Platos)
      if (recentRecipeIds && recentRecipeIds.includes(recipe.id)) {
        return false;
      }

      return true;
    });
  }
};
