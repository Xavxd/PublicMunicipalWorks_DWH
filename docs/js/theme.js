/**
 * theme.js — tema de color, modo claro/oscuro e idioma.
 *
 * Dos ejes independientes en <html>, como en el artefacto del almacén de
 * agua (github.com/gabrielhuav/Data_Warehouse_static):
 *
 *   data-tema = "original" | "guinda"             color institucional
 *   data-modo = "oscuro"   | "claro"              luminosidad
 *
 * El tema «original» es el del prototipo y es el predeterminado, de modo
 * que quien llega por primera vez ve exactamente la página de siempre.
 * «guinda» (IPN) reescribe las variables de marca desde css/temas.css;
 * ningún componente sabe qué tema está activo.
 *
 * Compatibilidad: css/main.css expresa su versión clara con el selector
 * html[data-theme="light"], así que el modo claro sigue poniendo también
 * ese atributo. Es el único motivo por el que existen dos nombres.
 *
 * Este archivo sustituye al theme.js del prototipo, que sólo alternaba
 * claro/oscuro. La preferencia se guarda en localStorage y se comparte
 * entre la portada y las cuatro vistas de rol.
 */
(function () {
  'use strict';

  var I = window.I18N || { t: function (k) { return k; }, idioma: 'es', idiomas: [], set: function () {} };

  var K_TEMA = 'obras-tema';
  var K_MODO = 'obras-modo';

  /* Dos temas. El azul institucional de la ESCOM y el azul del prototipo
     eran prácticamente el mismo color, así que se conserva uno solo:
     «original», el del prototipo. Quien tuviera 'escom' guardado de una
     visita anterior cae en 'original' por la validación de abajo. */
  var TEMAS = [
    { id: 'original', clave: 'tema.original', muestra: '#3b82f6' },
    { id: 'guinda',   clave: 'tema.guinda',   muestra: '#6f1d46' }
  ];

  function leer(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var tema = leer(K_TEMA, 'original');
  if (!TEMAS.some(function (t) { return t.id === tema; })) tema = 'original';

  /* El prototipo nace oscuro; ése sigue siendo el punto de partida. */
  var modo = leer(K_MODO, 'oscuro');
  if (modo !== 'claro' && modo !== 'oscuro') modo = 'oscuro';

  var raiz = document.documentElement;

  function svg(d) {
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var ICONO = {
    claro: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4' +
      'M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>'),
    oscuro: svg('<path d="M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a6.8 6.8 0 0 0 10.8 10.8z"/>')
  };
  var CLAVE_MODO = { claro: 'modo.claro', oscuro: 'modo.oscuro' };

  /* Pintado inmediato, antes de que el navegador componga la página. */
  function pintar(avisar) {
    raiz.setAttribute('data-tema', tema);
    raiz.setAttribute('data-modo', modo);
    if (modo === 'claro') raiz.setAttribute('data-theme', 'light');
    else raiz.removeAttribute('data-theme');

    var botonesTema = document.querySelectorAll('.tema-btn');
    for (var i = 0; i < botonesTema.length; i++) {
      botonesTema[i].setAttribute('aria-pressed', String(botonesTema[i].dataset.tema === tema));
    }
    var botonesIdioma = document.querySelectorAll('.idioma-btn');
    for (var j = 0; j < botonesIdioma.length; j++) {
      botonesIdioma[j].setAttribute('aria-pressed', String(botonesIdioma[j].dataset.idioma === I.idioma));
    }
    var b = document.querySelector('.modo-btn');
    if (b) {
      b.innerHTML = ICONO[modo];
      b.title = I.t('modo.cambiar', { modo: I.t(CLAVE_MODO[modo]) });
      b.setAttribute('aria-label', b.title);
      b.dataset.modo = modo;
    }
    if (avisar !== false) {
      document.dispatchEvent(new CustomEvent('temacambiado', { detail: { tema: tema, modo: modo } }));
    }
  }
  pintar(false);

  /* ------------------------------------------------------------------
     Controles. Se insertan en .header-meta, que existe tanto en la
     portada como en las cuatro vistas de rol.
     ------------------------------------------------------------------ */
  function construirControles() {
    /* La portada y las vistas de rol tienen .header-meta; el Mapa
       Inteligente no comparte esa cabecera, así que su página declara un
       contenedor propio con [data-controles]. */
    var destino = document.querySelector('.header-meta, [data-controles]');
    if (!destino || destino.querySelector('.ui-controles')) return;

    var caja = document.createElement('div');
    caja.className = 'ui-controles';

    var temas = TEMAS.map(function (t) {
      return '<button class="tema-btn" type="button" data-tema="' + t.id + '" title="' +
        I.t(t.clave) + '"><i style="background:' + t.muestra + '"></i>' +
        '<span class="tema-btn__texto">' + I.t(t.clave) + '</span></button>';
    }).join('');

    var idiomas = (I.idiomas || []).map(function (l) {
      return '<button class="idioma-btn" type="button" data-idioma="' + l.id + '" lang="' + l.id +
        '" title="' + I.t('idioma.cambiar', { nombre: l.nombre }) + '">' + l.etiqueta + '</button>';
    }).join('');

    caja.innerHTML =
      '<div class="segmentado" role="group" aria-label="' + I.t('barra.tema') + '">' + temas + '</div>' +
      (idiomas ? '<div class="segmentado" role="group" aria-label="' + I.t('barra.idioma') + '">' +
        idiomas + '</div>' : '') +
      '<button class="modo-btn" type="button"></button>';

    destino.insertBefore(caja, destino.firstChild);

    caja.querySelectorAll('.tema-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        tema = b.dataset.tema; guardar(K_TEMA, tema); pintar();
      });
    });
    caja.querySelectorAll('.idioma-btn').forEach(function (b) {
      b.addEventListener('click', function () { I.set(b.dataset.idioma); });
    });
    caja.querySelector('.modo-btn').addEventListener('click', function () {
      modo = modo === 'claro' ? 'oscuro' : 'claro';
      guardar(K_MODO, modo); pintar();
    });

    pintar(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', construirControles);
  } else {
    construirControles();
  }

  /* Los títulos de los propios controles están en el idioma anterior tras
     un cambio, así que se rehacen enteros; el tema y el modo se conservan. */
  document.addEventListener('idiomacambiado', function () {
    var caja = document.querySelector('.ui-controles');
    if (caja) caja.parentNode.removeChild(caja);
    construirControles();
  });

  /* Sincronización entre pestañas del mismo origen. */
  window.addEventListener('storage', function (e) {
    if (e.key === K_TEMA && e.newValue) { tema = e.newValue; pintar(); }
    if (e.key === K_MODO && e.newValue) { modo = e.newValue; pintar(); }
  });
})();
