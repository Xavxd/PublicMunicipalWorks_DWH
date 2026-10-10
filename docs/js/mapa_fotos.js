/**
 * mapa_fotos.js — que la foto de la obra en el popup del mapa siempre cargue.
 *
 * La galería del popup viene del visor compilado (véase
 * docs/mapa/PROCEDENCIA.md, cambio 6) y trata cualquier fallo de la imagen
 * como definitivo: su onError cambia la foto por un icono 🛠️ y no vuelve a
 * pedirla mientras no se pase a otra foto. Con una red lenta o inestable, y
 * sobre todo justo después de cambiar de proveedor de mapa —cuando el
 * navegador está bajando de golpe una pantalla entera de teselas—, bastaba un
 * tropiezo para que la obra se quedara sin foto.
 *
 * Tres cosas, sin recompilar el visor:
 *
 *   1. El error se intercepta antes que React. Un escuchador en fase de
 *      captura sobre document corre antes que el del propio <img>, y al
 *      detener ahí la propagación React nunca se entera. En su lugar se pone
 *      un rótulo «Cargando foto…» y se vuelve a pedir, alternando entre la
 *      miniatura y el original de 1600 px, con esperas crecientes y luego
 *      cada 10 s mientras el popup siga abierto. Si el navegador está sin
 *      conexión, espera al evento `online` y reintenta en ese momento.
 *   2. El popup lee miniaturas de 640 px (img/obras/mini/, unos 29 KB),
 *      cinco veces más ligeras que los originales. Las genera
 *      scripts/generar_miniaturas.py y el snapshot del mapa apunta a ellas.
 *   3. En cuanto el mapa termina de cargar, se precargan en segundo plano,
 *      primero la foto de portada de cada obra y luego el resto, de dos en
 *      dos para no competir con las teselas. Al abrir una obra la foto ya
 *      está en la caché, cambie o no el proveedor del mapa.
 */
(function () {
  'use strict';

  var ESPERAS = [400, 1000, 2000, 4000, 8000];   // ms; después, cada CADA
  var CADA = 10000;
  var SIMULTANEAS = 2;
  var RUTA = /\/img\/obras\/(?:[\w-]+\/)?([\w-]+\.webp)(?:[?#].*)?$/;

  var estados = typeof WeakMap === 'function' ? new WeakMap() : null;
  var enEspera = [];

  function t(clave) {
    return window.I18N && window.I18N.t ? window.I18N.t(clave) : 'Cargando foto…';
  }

  function archivo(url) {
    var m = RUTA.exec(url || '');
    return m ? m[1] : null;
  }

  /* Las dos fuentes de una foto: la miniatura y el original. */
  function fuentes(url) {
    var raiz = url.slice(0, url.indexOf('/img/obras/')) + '/img/obras/';
    var f = archivo(url);
    return [raiz + 'mini/' + f, raiz + f];
  }

  function rotulo() {
    var texto = String(t('mapa.foto.cargando')).replace(/[<&>]/g, '');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240" viewBox="0 0 600 240">' +
      '<rect width="600" height="240" fill="#8a97a8" fill-opacity="0.18"/>' +
      '<text x="300" y="128" text-anchor="middle" font-family="DM Sans, system-ui, sans-serif" ' +
      'font-size="22" fill="#8a97a8">' + texto + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function pedir(img, e) {
    /* Si entretanto el popup se cerró o se pasó a otra foto, React ya puso
       otra cosa en src y esta petición sobra. */
    if (!img.isConnected || img.getAttribute('src') !== e.rotulo) return;
    if (navigator.onLine === false) {
      if (enEspera.indexOf(img) < 0) enEspera.push(img);
      return;
    }
    var url = e.fuentes[e.n % e.fuentes.length];
    img.src = url + '?reintento=' + e.n;
  }

  document.addEventListener('error', function (ev) {
    var img = ev.target;
    if (!img || img.tagName !== 'IMG' || !estados) return;
    var url = img.currentSrc || img.src;
    var f = archivo(url);
    if (!f) return;
    ev.stopPropagation();

    var e = estados.get(img);
    if (!e || e.archivo !== f) {
      e = { archivo: f, n: 0, fuentes: fuentes(url) };
      estados.set(img, e);
    }
    e.n++;
    e.rotulo = rotulo();
    img.src = e.rotulo;
    clearTimeout(e.reloj);
    e.reloj = setTimeout(function () { pedir(img, e); },
      e.n <= ESPERAS.length ? ESPERAS[e.n - 1] : CADA);
  }, true);

  window.addEventListener('online', function () {
    var lista = enEspera;
    enEspera = [];
    lista.forEach(function (img) {
      var e = estados && estados.get(img);
      if (e) pedir(img, e);
    });
  });

  /* ------------------------------------------------------------------
     Precarga
     ------------------------------------------------------------------ */

  function precargar() {
    fetch(new URL('api/public/obras', document.baseURI).href, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var listas = ((j && j.data) || []).map(function (o) {
          return (o.imagenes || []).filter(Boolean);
        });
        var cola = [];
        listas.forEach(function (l) { if (l[0]) cola.push({ ruta: l[0], n: 0 }); });
        var ahorro = navigator.connection && navigator.connection.saveData;
        if (!ahorro) {
          listas.forEach(function (l) {
            l.slice(1).forEach(function (r) { cola.push({ ruta: r, n: 0 }); });
          });
        }
        var activas = 0;

        function siguiente() {
          while (activas < SIMULTANEAS && cola.length) cargar(cola.shift());
        }

        function cargar(item) {
          activas++;
          var im = new Image();
          im.decoding = 'async';
          im.onload = function () { activas--; siguiente(); };
          im.onerror = function () {
            activas--;
            if (++item.n < 4) setTimeout(function () { cola.push(item); siguiente(); }, 2000 * item.n);
            siguiente();
          };
          /* La misma URL que pedirá el popup (../img/obras/… desde /mapa/),
             para que la encuentre en la caché. */
          im.src = new URL('../' + item.ruta, document.baseURI).href;
        }

        siguiente();
      })
      .catch(function () { /* sin precarga; el popup las pide y reintenta igual */ });
  }

  function alCargar() { setTimeout(precargar, 1500); }
  if (document.readyState === 'complete') alCargar();
  else window.addEventListener('load', alCargar);
})();
