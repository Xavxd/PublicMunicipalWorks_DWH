/* Static replacement for the participation module in the original interface. */
(() => {
  const open = () => {
    const root = document.getElementById('pp-root');
    if (!root) return;
    root.hidden = false;
    root.innerHTML = `<section class="pp-static-dialog" role="dialog" aria-modal="true" aria-label="Propuestas de la Comunidad"><button class="pp-static-close" type="button" aria-label="Cerrar">×</button><p class="pp-kicker">DEMO ESTÁTICO</p><h2>Propuestas de la Comunidad</h2><p>La interfaz pública conserva el flujo visual del prototipo. En GitHub Pages esta muestra no registra votos, usuarios ni propuestas y no consulta ningún servicio remoto.</p><div class="pp-static-cards"><article><strong>Sendero escolar seguro</strong><span>El Rincón · 184 apoyos ilustrativos</span></article><article><strong>Mejoramiento de cancha</strong><span>Tequesquipan · 126 apoyos ilustrativos</span></article></div><button class="pp-static-action" type="button">Explorar propuestas sintéticas</button></section>`;
    root.querySelector('.pp-static-close').addEventListener('click', () => { root.hidden = true; root.innerHTML = ''; });
    root.querySelector('.pp-static-action').addEventListener('click', () => alert('Los datos de esta demostración son sintéticos y no se almacenan.'));
  };
  document.addEventListener('DOMContentLoaded', () => document.getElementById('pp-launcher-btn')?.addEventListener('click', open));
})();
