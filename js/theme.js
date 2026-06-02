/**
 * theme.js — Sistema de tema claro/oscuro
 * Persistencia en localStorage, sincronización entre páginas.
 * NO TOCAR: solo gestiona el atributo data-theme en <html> y el icono del toggle.
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'obras_publicas_theme';
  const THEMES = { DARK: 'dark', LIGHT: 'light' };

  function getStoredTheme() {
    return localStorage.getItem(STORAGE_KEY);
  }

  function setStoredTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
  }

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? THEMES.LIGHT
      : THEMES.DARK;
  }

  function getEffectiveTheme() {
    const stored = getStoredTheme();
    return stored || getSystemTheme();
  }

  function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === THEMES.LIGHT) {
      html.setAttribute('data-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
    }
    updateToggleButton(theme);
  }

  function toggleTheme() {
    const current = getEffectiveTheme();
    const next = current === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
    setStoredTheme(next);
    applyTheme(next);
    // Sincronizar entre pestañas/ventanas del mismo origen
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: next,
        oldValue: current,
        url: window.location.href
      }));
    } catch (e) { /* noop */ }
  }

  // Iconos SVG para el botón de toggle
  const ICON_SUN = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px;"><circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.2"/><line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="10" y1="16" x2="10" y2="18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="2" y1="10" x2="4" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="16" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="4.34" y1="4.34" x2="5.76" y2="5.76" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="14.24" y1="14.24" x2="15.66" y2="15.66" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="4.34" y1="15.66" x2="5.76" y2="14.24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="14.24" y1="5.76" x2="15.66" y2="4.34" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  const ICON_MOON = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px;"><path d="M17.5 11.5c-.7 3.4-3.6 6-7.1 6.3-3.9.3-7.3-2.4-7.7-6.3-.3-3.1 1.6-5.9 4.3-7.1.4-.2.9 0 1.1.4.2.4 0 .9-.4 1.1-1.9.9-3.2 3-2.9 5.3.3 2.8 2.9 4.9 5.7 4.6 2-.2 3.7-1.6 4.4-3.4.2-.4.6-.6 1-.5.4.2.6.6.5 1z" fill="currentColor"/></svg>';

  function updateToggleButton(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    const isLight = theme === THEMES.LIGHT;
    btn.innerHTML = isLight ? ICON_MOON : ICON_SUN;
    btn.title = isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
    btn.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  }

  function createToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'theme-toggle-btn';
    btn.type = 'button';
    btn.className = 'theme-toggle-btn';
    btn.addEventListener('click', toggleTheme);
    return btn;
  }

  function injectToggleButton() {
    // Buscar el contenedor .header-meta en el header
    const headerMeta = document.querySelector('.header-meta');
    if (headerMeta) {
      const btn = createToggleButton();
      // Insertar antes del último elemento (normalmente el botón de salir/badge)
      headerMeta.insertBefore(btn, headerMeta.firstChild);
      updateToggleButton(getEffectiveTheme());
      return;
    }
    // Fallback: si no hay header-meta, no inyectar (la página lo maneja)
  }

  // Inicialización inmediata (antes de que el DOM esté listo)
  const theme = getEffectiveTheme();
  applyTheme(theme);

  // Cuando el DOM esté listo, inyectar el botón
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToggleButton);
  } else {
    injectToggleButton();
  }

  // Escuchar cambios de tema desde otras pestañas
  window.addEventListener('storage', function(e) {
    if (e.key === STORAGE_KEY) {
      const newTheme = e.newValue || getSystemTheme();
      applyTheme(newTheme);
    }
  });

  // Escuchar cambios en la preferencia del sistema
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(e) {
    if (!getStoredTheme()) {
      applyTheme(e.matches ? THEMES.LIGHT : THEMES.DARK);
    }
  });

})();
