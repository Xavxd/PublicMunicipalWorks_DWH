/**
 * mapa_locale.js — que las fechas del visor sigan el idioma del documento.
 *
 * El reloj de la cabecera del Mapa Inteligente formatea con `"es-MX"` escrito
 * a mano. Con la interfaz en inglés el resto de la página cambia y la fecha se
 * queda en «LUN, 10 DE AGO DE 2026», que es justo el tipo de resto en español
 * que delata una traducción a medias.
 *
 * El arreglo de verdad está en el fuente del visor y así se anota en
 * docs/mapa/PROCEDENCIA.md, pero recompilar el bundle vendorizado para cambiar
 * una cadena traería consigo riesgo desproporcionado. En su lugar se envuelven
 * los tres formateadores de Date antes de que cargue el bundle: si alguien pide
 * explícitamente un locale español y el documento está en otro idioma, se
 * sustituye. Cualquier otra llamada pasa intacta.
 *
 * Sólo Date. Los contadores del panel usan Number.prototype.toLocaleString y
 * ahí la diferencia entre es-MX y en-GB es el separador de millares, que no
 * delata idioma; se deja en paz para no ampliar el radio del parche.
 *
 * El reloj se repinta cada segundo, así que al cambiar de idioma se corrige
 * solo dentro de ese segundo y no hace falta escuchar el evento.
 */
(function () {
  'use strict';

  var METODOS = ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString'];
  var nativos = {};

  function equivalente(pedido) {
    if (typeof pedido !== 'string' || pedido.slice(0, 2) !== 'es') return pedido;
    var lang = (document.documentElement.getAttribute('lang') || 'es').slice(0, 2);
    return lang === 'es' ? pedido : 'en-GB';
  }

  METODOS.forEach(function (metodo) {
    nativos[metodo] = Date.prototype[metodo];
    Date.prototype[metodo] = function (locales, opciones) {
      return nativos[metodo].call(this, equivalente(locales), opciones);
    };
  });
})();
