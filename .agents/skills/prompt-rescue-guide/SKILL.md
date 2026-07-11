---
name: prompt-rescue-guide
description: Guide to preserve navigation and prevent layout crashes in ACFC Kitchen
---

# Sistema de Preservación de Navegación y Guía de Buenas Prácticas - ACFC Kitchen

## 1. Diagnóstico del Error Crítico de Navegación

### Síntoma
La aplicación web se congela por completo al intentar alternar o hacer clic entre las pestañas principales del menú superior (Dashboard, Planificador, Inventario, Recetas y Escandallos, Proveedores). El usuario se queda atrapado en la pantalla activa y el router o conmutador de estados de React deja de emitir eventos.

### Causa Raíz Común de los Agentes de IA
Al programar mejoras complejas o visuales en secciones pesadas (como la implementación del Drag & Drop o el algoritmo con restricciones horarias en el *Planificador*), el agente altera layouts generales sin aislar los componentes. Las causas técnicas exactas suelen ser:
1. **Ruptura del Hilo de Ejecución Global:** Inyección accidental de variables huérfanas u ofuscadas en el componente del Navbar o App principal (por ejemplo, errores de tipo con variables generadas automáticamente como `zi`).
2. **SyntaxErrors Silenciosos:** Errores en el equilibrado de llaves `{}` o etiquetas de cierre de JSX que corrompen el flujo lógico de React, impidiendo que los disparadores `onClick` de la navegación superior se registren.
3. **Pérdida del Puente de Estado:** Sobrescribir de forma destructiva la propiedad de ventana global `window.showScreen` o los contextos (`Context Providers`) que coordinan las vistas.

---

## 2. Guía de Blindaje Técnico para el Agente (System Instructions)

Para optimizar de forma masiva los tokens de contexto y evitar que el agente vuelva a romper la navegación global, se establece la siguiente normativa técnica obligatoria para el proyecto:

### REGLA 1: Aislamiento Estricto de Layouts
* Queda terminantemente **prohibido** modificar el archivo raíz del Navbar, `App.tsx` o `main.tsx` si el objetivo del ticket se limita a una pestaña específica (como cambiar filtros en Recetas o modificar layouts del Planificador).
* Toda lógica operativa de una sección debe encapsularse en su propio componente o pestaña (*views/MenusTab*, *views/RecetasTab*), manteniendo el puente de navegación intacto.

### REGLA 2: Formato del Planificador Mensual
* El calendario mensual debe renderizarse utilizando siempre el ancho completo (`w-full`), eliminando barras laterales fijas invasivas que alteren las proporciones del layout general de la aplicación web.
* El selector de platos, buscador por Supabase y píldoras horizontales de categorías nutricionales no deben incrustarse de forma estática en la pantalla principal. **Deben abrirse única y exclusivamente dentro de un contenedor Modal clásico centrado en pantalla** al hacer clic en el botón "Asignar Receta" o sobre la celda del día.

### REGLA 3: Integración de Tipados y Limpieza
* Cada consulta `.select()` de Supabase debe protegerse con encadenamiento opcional (`?.`) y cortocircuitos (`|| []`) para evitar que la app colapse (Runtime Crash) si un JSON de receta viene sin ingredientes o faltan datos en alguna fila.
* Queda terminantemente **prohibida** la presencia de funciones vacías (`onClick={() => {}}`), importaciones muertas o variables ofuscadas remanentes de compilaciones automáticas.

---

## 3. Flujo Automático de Validación Pre-Despliegue

El agente deberá ejecutar de forma autónoma el siguiente protocolo de control de calidad local antes de interactuar con la infraestructura remota o consumir recursos de despliegue:
