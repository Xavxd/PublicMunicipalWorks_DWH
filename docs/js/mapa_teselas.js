/**
 * mapa_teselas.js — que el mapa base del visor nunca se quede en blanco.
 *
 * El visor pedía sus teselas a CARTO y a nadie más. En 2026 CARTO empezó a
 * contestar a cada petición sin clave con un 200 OK y una imagen que dice
 * «API KEY REQUIRED». Para Leaflet eso no es un error —la imagen llega y se
 * pinta— de modo que el mapa se quedó en una cuadrícula de marcas de agua sin
 * que nada lo detectara. Este script sustituye esa dependencia única por una
 * cadena de proveedores gratuitos y sin clave, y comprueba cada uno antes de
 * usarlo:
 *
 *   1. CARTO, el que cita el capítulo, mientras siga sirviendo mapa.
 *   2. Esri, OpenStreetMap, OSM HOT, OpenTopoMap e imagen de satélite.
 *   3. La copia local: un extracto de OpenStreetMap servido desde este mismo
 *      sitio (mapa/base/temascaltepec.json) y dibujado en el navegador. Si la
 *      página cargó, esto también carga.
 *   4. Y si ni ese archivo llegara, el contorno del municipio que va escrito
 *      aquí abajo, en CONTORNO_MINIMO. Por debajo de eso no se puede caer.
 *
 * Cómo se comprueba un proveedor: se descargan dos teselas contiguas del
 * centro del municipio. Tienen que llegar, ser imágenes y ser distintas entre
 * sí: una marca de agua como la de CARTO es la misma imagen para cualquier
 * coordenada, y así se delata. Ya en uso, si las teselas empiezan a fallar o
 * se atascan, se pasa solo al siguiente y se avisa.
 *
 * Además queda un control a la vista, «¿No carga el mapa? Probar otro
 * proveedor», con la lista completa para elegir a mano. `?teselas=<id>` en la
 * URL fija uno (`?teselas=local` no depende de ningún servidor externo), y la
 * elección se recuerda como el tema, el modo y el idioma.
 *
 * El visor no se recompila (véase docs/mapa/PROCEDENCIA.md): Leaflet se
 * publica a sí mismo en window.L al cargar, y este script, que va antes del
 * bundle, lo intercepta en ese momento para engancharse a la capa de teselas
 * que crea React. La URL de CARTO que React le pasa sólo se usa para saber si
 * el visor está en modo claro u oscuro.
 */
(function () {
  'use strict';

  var K_PROVEEDOR = 'obras-mapa-proveedor';
  /* Vista inicial del visor (uM y cM en el bundle): las teselas de prueba son
     las del centro, que luego se muestran, así que la prueba no se desperdicia. */
  var CENTRO = { lat: 19.0333, lng: -100.0333 };
  var ZOOM_PRUEBA = 12;
  var ESPERA_PRUEBA = 4000;   // ms por tesela de prueba
  var ESCALON = 700;          // ms antes de probar el siguiente en paralelo
  var PLAZO_TOTAL = 6000;     // ms para decidir, aunque sea por la copia local
  var ATASCO = 10000;         // ms cargando sin recibir ni una tesela
  var VACIO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  var BASE_URL = (function () {
    var s = document.currentScript && document.currentScript.src;
    try { return new URL('../mapa/base/temascaltepec.json', s || document.baseURI).href; }
    catch (e) { return 'base/temascaltepec.json'; }
  })();

  var OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  var ESRI = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>';
  var ARCGIS = 'https://server.arcgisonline.com/ArcGIS/rest/services/';

  var PROVEEDORES = [
    { id: 'carto', nombre: 'CARTO', nota: 'mapa.teselas.nota.carto',
      claro: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      oscuro: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      sub: 'abcd', max: 20,
      atribucion: OSM + ' &copy; <a href="https://carto.com/attributions">CARTO</a>' },
    { id: 'esri-gris', nombre: 'Esri Canvas', nota: 'mapa.teselas.nota.gris',
      claro: ARCGIS + 'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      oscuro: ARCGIS + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      max: 16,
      atribucion: ESRI + ' &mdash; Esri, HERE, Garmin, ' + OSM + ', and the GIS User Community' },
    { id: 'osm', nombre: 'OpenStreetMap', nota: 'mapa.teselas.nota.osm',
      claro: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      invertir: true, max: 19, atribucion: OSM },
    { id: 'esri-calles', nombre: 'Esri World Street Map', nota: 'mapa.teselas.nota.calles',
      claro: ARCGIS + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      invertir: true, max: 19,
      atribucion: ESRI + ' &mdash; Source: Esri, HERE, Garmin, USGS, ' + OSM },
    { id: 'osm-hot', nombre: 'OpenStreetMap HOT', nota: 'mapa.teselas.nota.hot',
      claro: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      sub: 'abc', invertir: true, max: 19,
      atribucion: OSM + ', tiles style by <a href="https://www.hotosm.org/">HOT</a>' +
        ' hosted by <a href="https://openstreetmap.fr/">OpenStreetMap France</a>' },
    { id: 'topo', nombre: 'OpenTopoMap', nota: 'mapa.teselas.nota.topo',
      claro: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      sub: 'abc', invertir: true, max: 17,
      atribucion: 'Map data: ' + OSM + ', SRTM | Map style: &copy; ' +
        '<a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' },
    { id: 'esri-satelite', nombre: 'Esri World Imagery', nota: 'mapa.teselas.nota.satelite',
      claro: ARCGIS + 'World_Imagery/MapServer/tile/{z}/{y}/{x}',
      max: 19,
      atribucion: ESRI + ' &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community' },
    { id: 'local', nombre: null, nota: 'mapa.teselas.nota.local', local: true,
      atribucion: OSM + ' (ODbL)' }
  ];
  var LOCAL = PROVEEDORES[PROVEEDORES.length - 1];

  /* Contorno del municipio (relación OSM 5606454) simplificado a 150 m, en
     enteros de 1e-5 grados codificados en deltas. Lo genera
     scripts/generar_mapa_base.py. */
  var CONTORNO_MINIMO = [[-10009661,1901296,320,444,639,129,739,-217,422,176,1959,-89,1665,1607,1954,-415,405,114,298,407,1432,-265,-66,-175,436,-367,1668,-820,1815,-170,1607,115,620,244,976,-76,-2044,-1080,-370,-642,-706,-432,2673,-674,-51,-274,3067,-514,641,3652,1394,-290,-181,-1148,3135,-982,-76,3451,984,-295,767,45,-377,912,1209,124,1062,354,-1431,1212,-1451,-339,-30,388,1178,1264,412,96,-24,661,-674,263,-1122,5,517,957,860,3829,-32,962,-628,1601,-1764,484,-683,-103,-1324,503,765,-31,1310,669,658,23,41,260,371,60,136,647,-457,252,314,742,-1046,1215,-268,-465,-2407,1191,716,1158,1030,70,-709,1907,-622,-109,-64,-572,-1679,-570,-351,85,42,884,-471,-176,-925,-2792,-1392,-939,-4227,-787,1147,-1101,-396,-1167,-773,-904,-600,-1402,-1121,-569,-373,808,-234,-13,-92,-499,436,-344,-399,-221,368,-361,-155,-431,194,-66,4,-299,-1002,-918,-326,-77,-185,173,-41,991,-629,78,103,-236,-336,-614,-501,-141,-694,849,-1543,-220,-448,-249,-419,579,-708,145,-153,-295,218,-335,-75,-600,-325,-101,252,-960,-106,-1216,296,-441,-311,-348,-386,-57,-308,225,-616,-172,-379,239,-114,612,-835,368,6,-148,-237,15,-112,-523,-817,-280,-34,-553,-588,370,-1040,-235,-386,111,-612,845,-630,113,151,249,-717,353,-57,-345,-627,-303,-2102,-48,-2501,773,-880,566,-711,907,-957,579,154,-767,-684,-1401,122,-809,-162,-950,-488,-1029,-329,-116,-255,162,-579,-473,-22,-887,193,-60,-151,-175,206,32,277,-412,-45,-553,361,-450,59,-851,-322,-911,-851,-707,364,-14,55,-174,332,220,802,-141,374,-342,268,18,-121,-458,509,-72,308,-398,243,137,27,-257,243,193,874,-240,400,-346,575,0,1396,-1677,1515,815,126,755,590,856,-402,325,247,339,402,246,753,31,82,205,232,-101,168,499,961,13,360,348,-51,-175,1466,-125,250,-393,683,3,316,-243]];
  var CABECERA = ['Temascaltepec de González', 0, -10004143, 1904337];

  var estado = {
    L: null, mapa: null, capa: null, local: null, control: null,
    actual: null, manual: false, modo: modoDocumento(),
    disponibilidad: {}, cargas: 0, errores: 0, tanda: 0, ultima: 0, cargando: false, cayendo: false,
    provisional: false
  };
  var pruebas = {};

  /* ------------------------------------------------------------------ */

  function t(clave, vars) {
    return window.I18N && window.I18N.t ? window.I18N.t(clave, vars) : clave;
  }

  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }

  function modoDocumento() {
    return document.documentElement.getAttribute('data-modo') === 'claro' ? 'claro' : 'oscuro';
  }

  function porId(id) {
    for (var i = 0; i < PROVEEDORES.length; i++) if (PROVEEDORES[i].id === id) return PROVEEDORES[i];
    return null;
  }

  function nombre(p) { return p.nombre || t('mapa.teselas.local'); }

  function plantilla(p, modo) { return (modo === 'claro' ? p.claro : p.oscuro) || p.claro; }

  /* ------------------------------------------------------------------
     Comprobación
     ------------------------------------------------------------------ */

  function teselaCentro(z) {
    var n = Math.pow(2, z), lat = CENTRO.lat * Math.PI / 180;
    return {
      x: Math.floor((CENTRO.lng + 180) / 360 * n),
      y: Math.floor((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n)
    };
  }

  function urlTesela(p, modo, z, x, y) {
    return plantilla(p, modo)
      .replace('{s}', p.sub ? p.sub.charAt(0) : '')
      .replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{r}', '');
  }

  function bajar(url) {
    var ctl = window.AbortController ? new AbortController() : null;
    var reloj;
    var plazo = new Promise(function (_, no) {
      reloj = setTimeout(function () { if (ctl) ctl.abort(); no(new Error('plazo')); }, ESPERA_PRUEBA);
    });
    var pedido = fetch(url, { mode: 'cors', credentials: 'omit', signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        var tipo = r.headers.get('content-type') || '';
        if (!r.ok || tipo.indexOf('image/') !== 0) throw new Error(r.status + ' ' + tipo);
        return r.arrayBuffer();
      });
    return Promise.race([pedido, plazo]).then(
      function (b) { clearTimeout(reloj); return b; },
      function (e) { clearTimeout(reloj); throw e; });
  }

  function iguales(a, b) {
    if (a.byteLength !== b.byteLength) return false;
    var x = new Uint8Array(a), y = new Uint8Array(b);
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }

  function marcar(id, valor) {
    estado.disponibilidad[id] = valor;
    pintarControl();
  }

  /* Promesa de booleano. Nunca se rechaza. */
  function probar(p, modo) {
    if (p.local) return Promise.resolve(true);
    if (!window.fetch || !window.Promise) return Promise.resolve(true);  // sin forma de comprobarlo
    var clave = p.id + ':' + modo;
    if (pruebas[clave]) return pruebas[clave];
    marcar(p.id, 'comprobando');
    var c = teselaCentro(ZOOM_PRUEBA);
    pruebas[clave] = Promise.all([
      bajar(urlTesela(p, modo, ZOOM_PRUEBA, c.x, c.y)),
      bajar(urlTesela(p, modo, ZOOM_PRUEBA, c.x + 1, c.y))
    ]).then(function (b) { return !iguales(b[0], b[1]); }, function () { return false; })
      .then(function (ok) { marcar(p.id, ok ? 'ok' : 'falla'); return ok; });
    return pruebas[clave];
  }

  /* El primero de `orden` que pase la prueba. Se prueban escalonados: si el
     preferido responde enseguida no se molesta a los demás, y si tarda, el
     siguiente ya va en camino. Pasado PLAZO_TOTAL se elige lo mejor que haya
     respondido, y si nada respondió, la copia local; si después contesta un
     proveedor remoto, se cambia a él. */
  function elegir(orden) {
    return new Promise(function (resolver) {
      var res = {}, lanzados = 0, listo = false;

      function decidir(final) {
        if (listo) return;
        for (var i = 0; i < orden.length; i++) {
          var r = res[orden[i].id];
          if (r === true) { listo = true; resolver(orden[i]); return; }
          if (r === undefined && !final) return;
        }
        if (final) { listo = true; resolver(LOCAL); }
      }

      function lanzar() {
        if (listo || lanzados >= orden.length) return;
        var p = orden[lanzados++];
        var siguiente = setTimeout(lanzar, ESCALON);
        probar(p, estado.modo).then(function (ok) {
          res[p.id] = ok;
          clearTimeout(siguiente);
          if (!ok) lanzar();
          if (listo && ok && !p.local && estado.actual && estado.actual.local && !estado.manual) {
            activar(p, 'auto');
          }
          decidir(false);
        });
      }

      lanzar();
      setTimeout(function () { decidir(true); }, PLAZO_TOTAL);
    });
  }

  function ordenInicial() {
    var param = null;
    try { param = new URLSearchParams(window.location.search).get('teselas'); } catch (e) { /* nada */ }
    var preferido = porId(param);
    if (preferido) {
      guardar(K_PROVEEDOR, preferido.id);
    } else {
      preferido = porId(leer(K_PROVEEDOR));
    }
    if (preferido) estado.manual = true;
    var orden = preferido ? [preferido] : [];
    for (var i = 0; i < PROVEEDORES.length; i++) {
      if (PROVEEDORES[i] !== preferido) orden.push(PROVEEDORES[i]);
    }
    return orden;
  }

  /* ------------------------------------------------------------------
     Activación y vigilancia
     ------------------------------------------------------------------ */

  function activar(p, origen) {
    estado.actual = p;
    estado.cargas = estado.errores = 0;
    estado.ultima = Date.now();
    if (origen === 'manual') {
      estado.manual = true;
      estado.provisional = false;
      guardar(K_PROVEEDOR, p.id);
    }
    document.documentElement.setAttribute('data-teselas', p.id);
    pintar(false);
    pintarControl();
    /* Uno elegido a mano tampoco se queda puesto si no sirve. */
    probar(p, estado.modo).then(function (ok) { if (!ok && estado.actual === p) caer(); });
  }

  function caer() {
    var p = estado.actual;
    if (!p || p.local || estado.cayendo) return;
    estado.cayendo = true;
    pruebas[p.id + ':' + estado.modo] = Promise.resolve(false);
    marcar(p.id, 'falla');
    /* Los remotos que siguen en la lista, dando la vuelta, y la copia local
       siempre al final. */
    var resto = [];
    var i0 = PROVEEDORES.indexOf(p);
    for (var i = 1; i < PROVEEDORES.length; i++) {
      var q = PROVEEDORES[(i0 + i) % PROVEEDORES.length];
      if (!q.local && estado.disponibilidad[q.id] !== 'falla') resto.push(q);
    }
    resto.push(LOCAL);
    elegir(resto).then(function (q) {
      estado.cayendo = false;
      if (estado.actual !== p) return;   // entretanto se eligió otro a mano
      activar(q, 'auto');
      avisar(t('mapa.teselas.aviso', { antes: nombre(p), ahora: nombre(q) }));
    });
  }

  function vigilar(capa) {
    function remoto() { return estado.actual && !estado.actual.local && capa === estado.capa; }
    capa.on('loading', function () {
      estado.cargando = true;
      estado.tanda = 0;
      estado.ultima = Date.now();
    });
    capa.on('load', function () { estado.cargando = false; });
    capa.on('tileload', function () {
      if (!remoto()) return;
      estado.cargas++;
      estado.tanda++;
      estado.ultima = Date.now();
    });
    capa.on('tileerror', function () {
      if (!remoto()) return;
      estado.errores++;
      estado.ultima = Date.now();
      if (estado.errores >= 4 && estado.errores > estado.cargas) caer();
    });
  }

  /* Atasco: una tanda entera de teselas sin que llegue ninguna. Una sola
     tesela lenta entre muchas que sí llegaron no cuenta. */
  setInterval(function () {
    if (estado.cargando && !estado.tanda && estado.capa && estado.capa._map &&
        estado.actual && !estado.actual.local && Date.now() - estado.ultima > ATASCO) {
      caer();
    }
  }, 2000);

  /* ------------------------------------------------------------------
     La capa de React
     ------------------------------------------------------------------ */

  function esCarto(url) { return typeof url === 'string' && url.indexOf('basemaps.cartocdn.com') !== -1; }

  function adoptar(capa) {
    estado.capa = capa;
    estado.modo = /light_all/.test(capa._url) ? 'claro' : 'oscuro';
    var setUrl = capa.setUrl;
    capa._fijarUrl = function (url, noRedraw) { return setUrl.call(capa, url, noRedraw); };
    /* react-leaflet llama a setUrl cuando el visor cambia de modo. */
    capa.setUrl = function (url, noRedraw) {
      if (!esCarto(url)) return setUrl.call(this, url, noRedraw);
      var modo = /light_all/.test(url) ? 'claro' : 'oscuro';
      if (modo !== estado.modo) {
        estado.modo = modo;
        pintar(noRedraw);
        var p = estado.actual;
        if (p) probar(p, modo).then(function (ok) { if (!ok && estado.actual === p) caer(); });
      }
      return this;
    };
    vigilar(capa);
    pintar(true);
  }

  function ponerAtribucion(texto) {
    var capa = estado.capa;
    var anterior = capa.options.attribution;
    if (anterior === texto) return;
    capa.options.attribution = texto;
    var ctl = capa._map && capa._map.attributionControl;
    if (ctl) {
      if (anterior) ctl.removeAttribution(anterior);
      if (texto) ctl.addAttribution(texto);
    }
  }

  function pintar(noRedraw) {
    var capa = estado.capa, p = estado.actual;
    if (!capa) return;
    var remoto = p && !p.local;
    capa.options.subdomains = remoto && p.sub ? p.sub.split('') : ['a'];
    capa.options.maxNativeZoom = remoto ? p.max : undefined;
    capa._fijarUrl(remoto ? plantilla(p, estado.modo) : VACIO, noRedraw);
    ponerAtribucion(p ? p.atribucion : '');

    var mapa = estado.mapa;
    if (!mapa) return;
    var cont = mapa.getContainer();
    if (remoto && p.invertir && estado.modo === 'oscuro') cont.classList.add('teselas-invertidas');
    else cont.classList.remove('teselas-invertidas');

    if (p && p.local) {
      var local = capaLocal();
      if (local) {
        if (!mapa.hasLayer(local)) local.addTo(mapa);
        else if (!noRedraw) local.redraw();
      }
    } else if (estado.local && mapa.hasLayer(estado.local)) {
      mapa.removeLayer(estado.local);
    }
  }

  /* ------------------------------------------------------------------
     Copia local: el extracto de OSM dibujado en lienzos de 256 px.
     ------------------------------------------------------------------ */

  var base = null, baseCargando = null, conMinima = false;
  var etiquetasPorZoom = {};

  function proyectar(lon, lat) {
    var s = Math.sin(lat * Math.PI / 180);
    return [lon / 360 + 0.5, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
  }

  function decodificar(enteros, q) {
    var n = enteros.length, p = new Float64Array(n);
    var lon = 0, lat = 0, caja = [Infinity, Infinity, -Infinity, -Infinity];
    for (var i = 0; i < n; i += 2) {
      lon += enteros[i];
      lat += enteros[i + 1];
      var m = proyectar(lon / q, lat / q);
      p[i] = m[0];
      p[i + 1] = m[1];
      if (m[0] < caja[0]) caja[0] = m[0];
      if (m[1] < caja[1]) caja[1] = m[1];
      if (m[0] > caja[2]) caja[2] = m[0];
      if (m[1] > caja[3]) caja[3] = m[1];
    }
    return { p: p, caja: caja };
  }

  function poligono(anillos, q) {
    var a = anillos.map(function (r) { return decodificar(r, q); });
    var caja = [Infinity, Infinity, -Infinity, -Infinity];
    a.forEach(function (r) {
      caja = [Math.min(caja[0], r.caja[0]), Math.min(caja[1], r.caja[1]),
              Math.max(caja[2], r.caja[2]), Math.max(caja[3], r.caja[3])];
    });
    return { anillos: a, caja: caja };
  }

  function preparar(doc) {
    var q = doc.q || 100000;
    var capas = {};
    Object.keys(doc.capas || {}).forEach(function (c) {
      capas[c] = doc.capas[c].map(function (r) {
        return c === 'agua' ? poligono(r, q) : decodificar(r, q);
      });
    });
    return {
      municipio: poligono(doc.municipio, q),
      capas: capas,
      lugares: (doc.lugares || []).map(function (l) {
        var m = proyectar(l[2] / q, l[3] / q);
        return { n: l[0], c: l[1], x: m[0], y: m[1] };
      })
    };
  }

  var BASE_MINIMA = null;
  function baseMinima() {
    if (!BASE_MINIMA) {
      BASE_MINIMA = preparar({ municipio: CONTORNO_MINIMO, capas: {}, lugares: [CABECERA] });
    }
    return BASE_MINIMA;
  }

  function cargarBase() {
    if (base) return Promise.resolve(base);
    if (!baseCargando) {
      baseCargando = fetch(BASE_URL, { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (doc) {
          base = preparar(doc);
          etiquetasPorZoom = {};
          /* Teselas que salieron del contorno mínimo mientras el archivo no
             llegaba: ahora que llegó, se rehacen con el mapa completo. */
          if (conMinima && estado.local) {
            conMinima = false;
            setTimeout(function () { estado.local.redraw(); }, 0);
          }
          return base;
        })
        .catch(function (e) { baseCargando = null; throw e; });   // se reintenta en la siguiente tesela
    }
    return baseCargando;
  }

  function marca() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--mapa-marca');
    return (v && v.trim()) || '59, 130, 246';
  }

  function paleta() {
    var m = marca();
    return estado.modo === 'claro' ? {
      agua: '#c3d3e0', rio: '#9fbbd1', arroyo: '#b7cbdb',
      limite: 'rgba(71, 85, 105, 0.35)',
      relleno: 'rgba(' + m + ', 0.05)', borde: 'rgba(' + m + ', 0.55)',
      via1: '#9aa4b1', via2: '#a9b2bd', via3: '#b8c0ca', via4: '#ccd3db', brecha: '#c9cfd6',
      texto: '#3c4757', halo: 'rgba(238, 241, 245, 0.92)'
    } : {
      agua: '#0f1f2b', rio: '#1f4057', arroyo: '#183447',
      limite: 'rgba(148, 163, 184, 0.30)',
      relleno: 'rgba(' + m + ', 0.06)', borde: 'rgba(' + m + ', 0.60)',
      via1: '#6f7a88', via2: '#5a6573', via3: '#48525e', via4: '#353d47', brecha: '#2f363f',
      texto: '#a7b1be', halo: 'rgba(8, 12, 15, 0.9)'
    };
  }

  /* Grosor a zoom 12 y zoom mínimo al que aparece cada capa. */
  var LINEAS = [
    ['arroyo', 0.6, 12], ['rio', 1.3, 10], ['limite', 1, 10],
    ['brecha', 0.7, 13], ['via4', 0.8, 12], ['via3', 1.3, 10], ['via2', 1.8, 10], ['via1', 2.3, 10]
  ];

  function cruza(caja, v) {
    return caja[2] >= v[0] && caja[0] <= v[2] && caja[3] >= v[1] && caja[1] <= v[3];
  }

  function trazar(ctx, p, k, ox, oy) {
    ctx.moveTo(p[0] * k - ox, p[1] * k - oy);
    for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * k - ox, p[i + 1] * k - oy);
  }

  function fuente(clase) {
    return clase === 0 ? '600 13px "DM Sans", system-ui, sans-serif'
      : clase === 1 ? '500 11px "DM Sans", system-ui, sans-serif'
      : '400 10px "DM Sans", system-ui, sans-serif';
  }

  /* Los rótulos se colocan una vez por zoom y para todo el mapa, no por
     tesela: así un nombre que cruza el borde entre dos teselas aparece
     entero en las dos mitades y nunca choca con otro. */
  function etiquetas(b, z) {
    var clave = z + (b === base ? '' : 'm');
    if (etiquetasPorZoom[clave]) return etiquetasPorZoom[clave];
    var maxClase = z < 12 ? 0 : z < 14 ? 1 : 2;
    var k = 256 * Math.pow(2, z);
    var ctx = document.createElement('canvas').getContext('2d');
    var puestas = [];
    b.lugares.forEach(function (l) {
      if (l.c > maxClase) return;
      ctx.font = fuente(l.c);
      var an = ctx.measureText(l.n).width, al = l.c === 0 ? 13 : 11;
      var x = l.x * k, y = l.y * k;
      var caja = [x - an / 2 - 4, y - al / 2 - 3, x + an / 2 + 4, y + al / 2 + 3];
      for (var i = 0; i < puestas.length; i++) if (cruza(puestas[i].caja, caja)) return;
      puestas.push({ l: l, x: x, y: y, caja: caja });
    });
    etiquetasPorZoom[clave] = puestas;
    return puestas;
  }

  function dibujar(lienzo, coords, r, b) {
    var ctx = lienzo.getContext('2d');
    var z = coords.z, k = 256 * Math.pow(2, z);
    var ox = coords.x * 256, oy = coords.y * 256;
    var margen = 12 / k;
    var vista = [coords.x / Math.pow(2, z) - margen, coords.y / Math.pow(2, z) - margen,
                 (coords.x + 1) / Math.pow(2, z) + margen, (coords.y + 1) / Math.pow(2, z) + margen];
    var c = paleta();
    var escala = Math.min(4, Math.pow(2, (z - 12) * 0.6));
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    function rellenar(pol, color) {
      if (!cruza(pol.caja, vista)) return;
      ctx.beginPath();
      pol.anillos.forEach(function (a) { trazar(ctx, a.p, k, ox, oy); ctx.closePath(); });
      ctx.fillStyle = color;
      ctx.fill('evenodd');
    }

    rellenar(b.municipio, c.relleno);
    (b.capas.agua || []).forEach(function (pol) { rellenar(pol, c.agua); });

    LINEAS.forEach(function (def) {
      var lista = b.capas[def[0]];
      if (!lista || z < def[2]) return;
      ctx.beginPath();
      for (var i = 0; i < lista.length; i++) {
        if (cruza(lista[i].caja, vista)) trazar(ctx, lista[i].p, k, ox, oy);
      }
      ctx.strokeStyle = c[def[0]];
      ctx.lineWidth = Math.min(9, def[1] * escala);
      ctx.setLineDash(def[0] === 'brecha' ? [4, 3] : def[0] === 'limite' ? [6, 4] : []);
      ctx.stroke();
      if (def[0] === 'limite') {
        /* El municipio se dibuja encima de los linderos vecinos. */
        ctx.beginPath();
        b.municipio.anillos.forEach(function (a) { trazar(ctx, a.p, k, ox, oy); ctx.closePath(); });
        ctx.setLineDash([]);
        ctx.strokeStyle = c.borde;
        ctx.lineWidth = Math.max(1.6, Math.min(4, 2 * escala));
        ctx.stroke();
      }
    });
    if (!b.capas.limite) {
      ctx.beginPath();
      b.municipio.anillos.forEach(function (a) { trazar(ctx, a.p, k, ox, oy); ctx.closePath(); });
      ctx.setLineDash([]);
      ctx.strokeStyle = c.borde;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    var vistaPx = [ox, oy, ox + 256, oy + 256];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.setLineDash([]);
    etiquetas(b, z).forEach(function (e) {
      if (!cruza(e.caja, vistaPx)) return;
      ctx.font = fuente(e.l.c);
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.halo;
      ctx.strokeText(e.l.n, e.x - ox, e.y - oy);
      ctx.fillStyle = c.texto;
      ctx.fillText(e.l.n, e.x - ox, e.y - oy);
    });
  }

  function capaLocal() {
    if (estado.local) return estado.local;
    var L = estado.L;
    if (!L || !L.GridLayer) return null;
    var Clase = L.GridLayer.extend({
      createTile: function (coords, hecho) {
        var tam = this.getTileSize();
        var r = Math.min(2, window.devicePixelRatio || 1);
        var lienzo = document.createElement('canvas');
        lienzo.width = tam.x * r;
        lienzo.height = tam.y * r;
        cargarBase().then(function (b) {
          dibujar(lienzo, coords, r, b);
          hecho(null, lienzo);
        }, function () {
          conMinima = true;
          dibujar(lienzo, coords, r, baseMinima());
          hecho(null, lienzo);
        });
        return lienzo;
      }
    });
    estado.local = new Clase({ pane: 'tilePane', zIndex: 2, keepBuffer: 3 });
    return estado.local;
  }

  /* ------------------------------------------------------------------
     El control «¿No carga el mapa?»
     ------------------------------------------------------------------ */

  var aviso = { nodo: null, reloj: null };

  function montarControl(mapa) {
    var L = estado.L;
    if (estado.control || !L || !L.Control) return;
    var Control = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function () {
        var raiz = L.DomUtil.create('div', 'mapa-teselas leaflet-control');
        raiz.innerHTML =
          '<div class="mapa-teselas__aviso" role="status" aria-live="polite" hidden></div>' +
          '<div class="mapa-teselas__panel" id="mapa-teselas-panel" hidden>' +
          '  <p class="mapa-teselas__titulo"></p>' +
          '  <ul class="mapa-teselas__lista"></ul>' +
          '  <p class="mapa-teselas__nota"></p>' +
          '</div>' +
          '<div class="mapa-teselas__barra">' +
          '  <button type="button" class="mapa-teselas__probar">' +
          '    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '    <span class="mapa-teselas__pregunta"></span> <strong class="mapa-teselas__accion"></strong>' +
          '  </button>' +
          '  <button type="button" class="mapa-teselas__abrir" aria-expanded="false" aria-controls="mapa-teselas-panel">' +
          '    <span class="mapa-teselas__actual"></span>' +
          '    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '  </button>' +
          '</div>';
        L.DomEvent.disableClickPropagation(raiz);
        L.DomEvent.disableScrollPropagation(raiz);

        raiz.querySelector('.mapa-teselas__probar').addEventListener('click', probarOtro);
        raiz.querySelector('.mapa-teselas__abrir').addEventListener('click', function () {
          abrirPanel(raiz.querySelector('.mapa-teselas__panel').hidden);
        });
        raiz.querySelector('.mapa-teselas__lista').addEventListener('click', function (ev) {
          var b = ev.target.closest('[data-id]');
          if (!b) return;
          var p = porId(b.getAttribute('data-id'));
          if (p) activar(p, 'manual');
        });
        raiz.addEventListener('keydown', function (ev) {
          if (ev.key === 'Escape') {
            abrirPanel(false);
            raiz.querySelector('.mapa-teselas__abrir').focus();
          }
        });
        aviso.nodo = raiz.querySelector('.mapa-teselas__aviso');
        return raiz;
      }
    });
    estado.control = new Control().addTo(mapa);
    mapa.on('click', function () { abrirPanel(false); });
    pintarControl();
  }

  function raizControl() { return estado.control && estado.control.getContainer(); }

  function abrirPanel(abrir) {
    var raiz = raizControl();
    if (!raiz) return;
    raiz.querySelector('.mapa-teselas__panel').hidden = !abrir;
    raiz.querySelector('.mapa-teselas__abrir').setAttribute('aria-expanded', abrir ? 'true' : 'false');
    /* Al abrir la lista se comprueban todos, para que el estado de cada uno
       esté a la vista antes de elegir. */
    if (abrir) PROVEEDORES.forEach(function (p) { probar(p, estado.modo); });
  }

  function probarOtro() {
    var i0 = Math.max(0, PROVEEDORES.indexOf(estado.actual));
    for (var i = 1; i <= PROVEEDORES.length; i++) {
      var q = PROVEEDORES[(i0 + i) % PROVEEDORES.length];
      if (estado.disponibilidad[q.id] !== 'falla') {
        activar(q, 'manual');
        avisar(t('mapa.teselas.usando', { nombre: nombre(q) }));
        return;
      }
    }
    activar(LOCAL, 'manual');
  }

  function avisar(texto) {
    if (!aviso.nodo) return;
    aviso.nodo.textContent = texto;
    aviso.nodo.hidden = false;
    clearTimeout(aviso.reloj);
    aviso.reloj = setTimeout(function () { aviso.nodo.hidden = true; }, 6000);
  }

  function pintarControl() {
    var raiz = raizControl();
    if (!raiz) return;
    var p = estado.actual;
    raiz.querySelector('.mapa-teselas__pregunta').textContent = t('mapa.teselas.pregunta');
    raiz.querySelector('.mapa-teselas__accion').textContent = t('mapa.teselas.probar');
    raiz.querySelector('.mapa-teselas__actual').textContent = p ? nombre(p) : t('mapa.teselas.comprobando');
    var abrir = raiz.querySelector('.mapa-teselas__abrir');
    abrir.title = t('mapa.teselas.elegir');
    abrir.setAttribute('aria-label', t('mapa.teselas.elegir') + ' — ' + (p ? nombre(p) : ''));
    raiz.querySelector('.mapa-teselas__titulo').textContent = t('mapa.teselas.titulo');
    raiz.querySelector('.mapa-teselas__nota').textContent = t('mapa.teselas.explica');
    /* Los botones se crean una vez y luego sólo se actualizan: rehacerlos
       con cada resultado de prueba le quitaría el foco a quien navega con
       el teclado. */
    var lista = raiz.querySelector('.mapa-teselas__lista');
    if (!lista.children.length) {
      PROVEEDORES.forEach(function (q) {
        var li = document.createElement('li');
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mapa-teselas__opcion';
        b.setAttribute('data-id', q.id);
        b.innerHTML = '<span class="mapa-teselas__punto" aria-hidden="true"></span>' +
          '<span class="mapa-teselas__nombre"></span><small class="mapa-teselas__tipo"></small>' +
          '<span class="mapa-teselas__estado"></span>';
        li.appendChild(b);
        lista.appendChild(li);
      });
    }
    PROVEEDORES.forEach(function (q, i) {
      var b = lista.children[i].firstChild;
      var disp = q === p ? 'uso' : (estado.disponibilidad[q.id] || (q.local ? 'ok' : 'nada'));
      b.setAttribute('data-estado', disp);
      b.setAttribute('aria-pressed', q === p ? 'true' : 'false');
      b.querySelector('.mapa-teselas__nombre').textContent = nombre(q);
      b.querySelector('.mapa-teselas__tipo').textContent = t(q.nota);
      b.querySelector('.mapa-teselas__estado').textContent =
        disp === 'nada' ? '' : t('mapa.teselas.estado.' + disp);
    });
  }

  document.addEventListener('idiomacambiado', pintarControl);
  /* El tema (original/guinda) no pasa por React; la copia local toma su
     color de --mapa-marca y se repinta aquí. */
  document.addEventListener('temacambiado', function () {
    if (estado.local && estado.mapa && estado.mapa.hasLayer(estado.local)) estado.local.redraw();
  });

  /* ------------------------------------------------------------------
     Enganche con Leaflet
     ------------------------------------------------------------------ */

  function alCargarLeaflet(L) {
    if (!L || estado.L || !L.TileLayer || !L.Map) return;
    estado.L = L;
    L.Map.addInitHook(function () {
      var mapa = this;
      estado.mapa = mapa;
      mapa.whenReady(function () {
        montarControl(mapa);
        pintar(true);
      });
    });
    L.TileLayer.addInitHook(function () {
      if (esCarto(this._url)) adoptar(this);
    });
  }

  try {
    var valor = window.L;
    Object.defineProperty(window, 'L', {
      configurable: true,
      enumerable: true,
      get: function () { return valor; },
      set: function (v) {
        valor = v;
        try { alCargarLeaflet(v); } catch (e) { if (window.console) console.error('mapa_teselas:', e); }
      }
    });
    if (valor) alCargarLeaflet(valor);
  } catch (e) {
    if (window.console) console.error('mapa_teselas:', e);
  }

  /* La elección arranca ya, antes de que cargue el bundle: para cuando React
     crea la capa, normalmente ya se sabe qué proveedor responde. Si tarda
     más de un momento, entretanto se muestra la copia local, para que el
     mapa no espere en blanco a que se agoten los plazos. */
  var provisional = setTimeout(function () {
    if (estado.actual) return;
    activar(LOCAL, 'auto');
    estado.provisional = true;
  }, 1500);
  elegir(ordenInicial()).then(function (p) {
    clearTimeout(provisional);
    if (!estado.actual || (estado.provisional && estado.actual === LOCAL)) activar(p, 'auto');
    estado.provisional = false;
  });

  window.MapaTeselas = {
    proveedores: PROVEEDORES.map(function (p) { return p.id; }),
    actual: function () { return estado.actual && estado.actual.id; },
    disponibilidad: function () { return JSON.parse(JSON.stringify(estado.disponibilidad)); },
    usar: function (id) { var p = porId(id); if (p) activar(p, 'manual'); return !!p; }
  };
})();
