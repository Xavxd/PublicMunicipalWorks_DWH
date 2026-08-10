/**
 * nav.js — barra de navegación del sistema para el Mapa Inteligente.
 *
 * El visor es una aplicación aparte (Urigc/mapa) servida bajo /mapa/. Sin
 * una barra propia se entra en él y no hay forma de volver: parecen dos
 * sitios distintos que se parecen. Esta barra le da la misma cabecera que
 * el resto —marca, acceso a las cuatro vistas de rol y los controles de
 * tema, idioma y modo— para que el conjunto se lea como un solo sistema.
 *
 * Se construye sobre el elemento [data-nav] y deja dentro un contenedor
 * [data-controles], que es donde theme.js inserta sus botones.
 *
 * Los enlaces de rol abren la vista directamente. El acceso es abierto por
 * diseño (véase js/static_backend.js), así que la sesión de demostración se
 * establece al vuelo con loginUser() en lugar de mandar al visitante a la
 * portada a rellenar un formulario que acepta cualquier cosa.
 */
(function () {
  'use strict';

  var ROLES = [
    { rol: 'Director',    etiqueta: 'Director de Obras', destino: '../director/director.html' },
    { rol: 'Supervisor',  etiqueta: 'Supervisor',        destino: '../supervisor/supervisor.html' },
    { rol: 'Proyectista', etiqueta: 'Proyectista',       destino: '../proyectista/proyectista.html' },
    { rol: 'Secretario',  etiqueta: 'Secretaría',        destino: '../secretaria/secretaria.html' }
  ];

  var EMBLEMA =
    '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">' +
    '<polygon points="24,4 44,14 44,34 24,44 4,34 4,14" stroke="currentColor" stroke-width="2" fill="none"/>' +
    '<circle cx="24" cy="24" r="4" fill="currentColor"/></svg>';

  function construir() {
    var host = document.querySelector('[data-nav]');
    if (!host || host.dataset.listo === '1') return;
    host.dataset.listo = '1';

    var enlaces = ROLES.map(function (r) {
      return '<button class="navsis__enlace" type="button" data-rol="' + r.rol +
        '" data-destino="' + r.destino + '">' + r.etiqueta + '</button>';
    }).join('');

    host.innerHTML =
      '<a class="navsis__marca" href="../index.html">' +
        '<span class="navsis__emblema">' + EMBLEMA + '</span>' +
        '<span class="navsis__texto">' +
          '<strong>Obras Públicas</strong>' +
          '<small>H. Ayuntamiento de Temascaltepec</small>' +
        '</span>' +
      '</a>' +
      '<nav class="navsis__menu">' +
        '<a class="navsis__enlace" href="../index.html">Portada</a>' +
        enlaces +
        '<span class="navsis__enlace navsis__enlace--actual" aria-current="page">Mapa Ciudadano</span>' +
      '</nav>' +
      '<div class="navsis__controles" data-controles></div>';

    host.querySelectorAll('[data-rol]').forEach(function (b) {
      b.addEventListener('click', function () {
        abrirRol(b.dataset.rol, b.dataset.destino);
      });
    });
  }

  /* El acceso es abierto: se abre la sesión de demostración sin pedir nada y
     se entra. Si por lo que sea el backend local no está disponible, se cae
     a la portada, que es donde vive el formulario. */
  function abrirRol(rol, destino) {
    if (typeof loginUser !== 'function') { window.location.href = '../index.html'; return; }
    loginUser('', '', rol).then(function () {
      window.location.href = destino;
    }).catch(function () {
      window.location.href = '../index.html';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', construir);
  } else {
    construir();
  }

  /* Al cambiar de idioma, theme.js rehace sus controles dentro de
     [data-controles]; la barra en sí la traduce i18n.js por frase, así que
     aquí no hay nada que rehacer. */
})();
