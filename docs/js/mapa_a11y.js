/**
 * mapa_a11y.js — nombres accesibles para los marcadores del Mapa Inteligente.
 *
 * El visor dibuja cada obra con un divIcon de Leaflet que lleva role="button"
 * y tabindex="0" pero ningún texto dentro: es un círculo de color. Un lector
 * de pantalla anuncia «botón» sin más, y Lighthouse lo marca en
 * aria-command-name. El nombre no puede añadirse en el fuente sin recompilar
 * el bundle vendorizado, y la regla del artefacto es tocarlo lo menos posible
 * (véase docs/mapa/PROCEDENCIA.md), así que se pone desde fuera.
 *
 * El nombre es genérico —«Obra pública»— y no el de cada obra: los marcadores
 * los monta React y los reordena el agrupador por conglomerados, de modo que
 * no hay forma fiable de emparejar un nodo del DOM con su registro sin
 * recompilar. Un nombre genérico más la ficha que se abre al activarlo es
 * peor que un nombre por obra y mucho mejor que ninguno; queda anotado por si
 * alguna vez se recompila el visor, que es donde tiene que arreglarse del todo.
 */
(function () {
  'use strict';

  function texto() {
    return window.I18N && window.I18N.t
      ? window.I18N.t('mapa.marcador')
      : 'Obra pública — abrir ficha técnica';
  }

  function etiquetar(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    var marcadores = raiz.querySelectorAll('.custom-marker[role="button"]');
    for (var i = 0; i < marcadores.length; i++) {
      marcadores[i].setAttribute('aria-label', texto());
    }
  }

  function arrancar() {
    etiquetar(document);
    new MutationObserver(function (mutaciones) {
      for (var i = 0; i < mutaciones.length; i++) {
        var nuevos = mutaciones[i].addedNodes;
        for (var j = 0; j < nuevos.length; j++) {
          if (nuevos[j].nodeType !== 1) continue;
          if (nuevos[j].matches && nuevos[j].matches('.custom-marker[role="button"]')) {
            nuevos[j].setAttribute('aria-label', texto());
          }
          etiquetar(nuevos[j]);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* Al cambiar de idioma hay que rehacerlos: el aria-label no es texto del
     DOM, así que el traductor por frase de i18n.js no lo alcanza. */
  document.addEventListener('idiomacambiado', function () { etiquetar(document); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }
})();
