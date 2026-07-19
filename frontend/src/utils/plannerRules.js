/**
 * Reglas de negocio y nutricionales para la generación automática de menús.
 * Contiene metadatos ricos para el mapeo dinámico en la interfaz de usuario.
 */
export const PLANNER_RULES = {
  // Reglas fijas del sistema (inmutables por el usuario)
  sistema: [
    {
      key: 'no_paella_noche',
      label: 'Prohibir Paella por la noche',
      desc: 'Evita planificar recetas que contengan la palabra "Paella" en las cenas.',
      type: 'fixed_boolean',
      value: true,
      section: 'sistema'
    },
    {
      key: 'no_repetir_carbohidratos',
      label: 'Evitar repetir Carbohidratos',
      desc: 'Evita planificar recetas del tipo "Pasta" o "Arroz" tanto en el almuerzo como en la cena del mismo día.',
      type: 'fixed_boolean',
      value: true,
      section: 'sistema'
    },
    {
      key: 'incluir_guarniciones',
      label: 'Inclusión de Guarniciones',
      desc: 'Asigna automáticamente un plato de categoría "Acompañamiento" a los almuerzos.',
      type: 'fixed_boolean',
      value: true,
      section: 'sistema'
    },
    {
      key: 'maxCarneRojaSemana',
      label: 'Límite de Carne Roja',
      desc: 'Máximo recomendado de raciones de carne roja por semana.',
      type: 'number',
      value: 2,
      section: 'sistema'
    },
    {
      key: 'maxPastaSemana',
      label: 'Límite de Platos de Pasta',
      desc: 'Máximo recomendado de platos de pasta por semana.',
      type: 'number',
      value: 2,
      section: 'sistema'
    }
  ],

  // Reglas configurables por el usuario (mutables y persistidas en localStorage)
  usuario: [
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
        settings[rule.key] = rule.type === 'boolean' ? stored === 'true' : Number(stored);
      } else {
        settings[rule.key] = rule.defaultValue;
      }
    });
    return settings;
  },

  // Algoritmo de filtrado y selección inteligente de recetas basado en reglas nutricionales
  filtrarRecetas(recipes, settings, isWeekend = false) {
    const incluirEspeciales = settings['menu_setting_incluir_especiales'];
    const menuSencilloFDS = settings['menu_setting_sencillo_fds'];
    
    return recipes.filter(recipe => {
      // 1. Regla de Especiales
      if (recipe.category === 'Especiales' && !incluirEspeciales) {
        return false;
      }

      // 2. Regla de Fin de Semana Sencillo
      if (isWeekend && menuSencilloFDS) {
        const tiempo = Number(recipe.cook_time || recipe.tiempo_elaboracion) || 30;
        if (tiempo > 30) return false;
      }

      return true;
    });
  },

  // Validador de consistencia de plato individual
  validarPlato(receta, mealType, almuerzoAsignado = null) {
    if (!receta) return true;
    const name = (receta.name || '').toLowerCase();
    
    // Regla: Prohibir Paella por la noche
    if (mealType === 'dinner' && name.includes('paella')) {
      return false;
    }

    // Regla: Evitar repetir carbohidratos/pasta el mismo día
    if (mealType === 'dinner' && almuerzoAsignado) {
      const almuerzoName = (almuerzoAsignado.name || '').toLowerCase();
      const esPastaAlmuerzo = almuerzoName.includes('pasta') || almuerzoName.includes('tallarines') || almuerzoName.includes('macarrones') || almuerzoName.includes('arroz') || almuerzoName.includes('paella');
      const esPastaCena = name.includes('pasta') || name.includes('tallarines') || name.includes('macarrones') || name.includes('arroz') || name.includes('paella');
      if (esPastaAlmuerzo && esPastaCena) {
        return false;
      }
    }

    return true;
  }
};
