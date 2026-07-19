/**
 * Reglas de negocio y nutricionales para la generación automática de menús.
 * Contiene metadatos ricos para el mapeo dinámico en la interfaz de usuario.
 */
export const PLANNER_RULES = {
  // Reglas fijas del sistema (inmutables por el usuario)
  sistema: [
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
    },
    {
      key: 'minLegumbresSemana',
      label: 'Mínimo de Legumbres',
      desc: 'Mínimo recomendado de raciones de legumbres por semana.',
      type: 'number',
      value: 1,
      section: 'sistema'
    },
    {
      key: 'minPescadoSemana',
      label: 'Mínimo de Pescado/Marisco',
      desc: 'Mínimo recomendado de raciones de pescado o marisco a la semana.',
      type: 'number',
      value: 1,
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
    },
    {
      key: 'menu_setting_max_carne_roja_user',
      label: 'Límite personalizado Carne Roja',
      desc: 'Sobrescribe el límite semanal de carne roja en el generador.',
      type: 'number',
      defaultValue: 2,
      section: 'personalizable'
    },
    {
      key: 'menu_setting_max_pasta_user',
      label: 'Límite personalizado de Pasta',
      desc: 'Sobrescribe el límite semanal de platos de pasta en el generador.',
      type: 'number',
      defaultValue: 2,
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
  }
};
