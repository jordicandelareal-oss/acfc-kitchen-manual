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
      desc: 'Evita planificar recetas de tipo Pasta o Arroz en almuerzo y cena del mismo día.',
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
    },
    {
      key: 'menu_setting_default_lunch_players',
      label: 'Comensales por defecto (Almuerzo)',
      desc: 'Número por defecto de raciones / comensales a asignar al almuerzo en la generación automática.',
      type: 'number',
      defaultValue: 25,
      section: 'personalizable'
    },
    {
      key: 'menu_setting_default_dinner_players',
      label: 'Comensales por defecto (Cena)',
      desc: 'Número por defecto de raciones / comensales a asignar a la cena en la generación automática.',
      type: 'number',
      defaultValue: 20,
      section: 'personalizable'
    }
  ],

  // Obtiene los valores activos (priorizando localStorage sobre los valores por defecto)
  getSettings() {
    const settings = {};
    this.usuario.forEach(rule => {
      const stored = localStorage.getItem(rule.key);
      if (stored !== null) {
        if (rule.type === 'number') {
          settings[rule.key] = parseInt(stored, 10) || rule.defaultValue;
        } else {
          settings[rule.key] = stored === 'true';
        }
      } else {
        settings[rule.key] = rule.defaultValue;
      }
    });
    return settings;
  },

  /**
   * Valida una sola receta contra el juego completo de reglas de negocio
   * y el historial de platos recientes (cola de rotación de 5 días).
   * 
   * @returns { { valid: boolean, reason?: string } }
   */
  isRecipeValid(recipe, recentRecipeIds, rules, isWeekend = false, mealType = 'lunch', lunchRecipe = null) {
    const incluirEspeciales = rules['menu_setting_incluir_especiales'];
    const menuSencilloFDS = rules['menu_setting_sencillo_fds'];
    const noPaellaNoche = rules['menu_setting_no_paella_noche'];
    const noRepetirCarbohidratos = rules['menu_setting_no_repetir_carbohidratos'];

    const name = (recipe.name || '').toLowerCase();
    const cat = (recipe.category || '').toLowerCase().trim();

    // 1. Regla de Especiales
    if (recipe.category === 'Especiales' && !incluirEspeciales) {
      return { valid: false, reason: 'Excluida por categoría Especiales desactivada' };
    }

    // 2. Regla de Fin de Semana Sencillo
    if (isWeekend && menuSencilloFDS) {
      const tiempo = Number(recipe.cook_time || recipe.tiempo_elaboracion) || 30;
      if (tiempo > 30) {
        return { valid: false, reason: `Excluida por tiempo superior a 30m en FDS (${tiempo} min)` };
      }
    }

    // 3. Regla de Paella / Guisos de Noche (Cenas ligeras)
    if (mealType === 'dinner') {
      if (noPaellaNoche && name.includes('paella')) {
        return { valid: false, reason: 'Excluida Paella en cena por regla de noche' };
      }
      if (name.includes('guiso') || name.includes('estofado') || name.includes('fabada') || name.includes('cocido')) {
        return { valid: false, reason: 'Excluido Guiso/Estofado pesado en cena' };
      }
    }

    // 4. Regla de No Repetir Carbohidratos (Pasta/Arroz)
    if (mealType === 'dinner' && noRepetirCarbohidratos && lunchRecipe) {
      const carbCategories = ['pasta', 'pastas', 'arroz', 'arroces'];
      const lunchCat = (lunchRecipe.category || '').toLowerCase().trim();
      const esCarbLunch = carbCategories.includes(lunchCat);
      const esCarbDinner = carbCategories.includes(cat);
      if (esCarbLunch && esCarbDinner) {
        return { valid: false, reason: `Repetición de carbohidratos bloqueada (${lunchCat} al mediodía y ${cat} por la noche)` };
      }
    }

    // 5. Regla de los 4-5 Días (Rotación Estricta de Platos)
    if (recentRecipeIds && recentRecipeIds.includes(recipe.id)) {
      return { valid: false, reason: 'Violación de rotación de 5 días (servido recientemente)' };
    }

    return { valid: true };
  },

  // Motor unificado de compatibilidad para filtros de lotes
  applyBusinessRules(recipes, rules, isWeekend = false, mealType = 'lunch', lunchRecipe = null, recentRecipeIds = []) {
    return recipes.filter(recipe => {
      const res = this.isRecipeValid(recipe, recentRecipeIds, rules, isWeekend, mealType, lunchRecipe);
      return res.valid;
    });
  }
};
