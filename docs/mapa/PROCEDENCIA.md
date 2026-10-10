# Mapa Inteligente — copia publicada

Este directorio contiene una **compilación** del visor geoespacial *Mapa
Inteligente de Obras Públicas*, cuya autoría y código fuente son de
**Uriel González Casiano**:

| | |
|---|---|
| Repositorio de origen | https://github.com/Urigc/mapa |
| Commit compilado | `4d50022529e522d5380d7ab303a6da87cf99480f` (2026-06-30) |
| Despliegue original | https://polite-frangipane-c8c252.netlify.app/ |
| Esta copia | `https://gabrielhuav.github.io/PublicMunicipalWorks_DWH/mapa/` |

## Por qué existe esta copia

El despliegue original vive en una cuenta de Netlify ajena a este repositorio y
consume la API pública del backend de Obras Públicas. Si cualquiera de los dos
desaparece, el enlace «Mapa Ciudadano» de la portada queda roto y el artefacto
de reproducibilidad deja de ser completo. Esta copia se sirve desde el mismo
sitio de GitHub Pages que el resto de la demostración y no depende de ningún
servidor.

## Cómo se reproduce

```bash
git clone https://github.com/Urigc/mapa.git
cd mapa/app
git checkout 4d50022529e522d5380d7ab303a6da87cf99480f
npm install --legacy-peer-deps
VITE_API_URL=. npm run build      # produce dist/
```

`VITE_API_URL=.` es la única pieza que cambia el comportamiento: el visor lee
`import.meta.env.VITE_API_URL` y, con un punto, pide `./api/public/obras`,
`./api/public/regiones` y `./api/public/resumen` **relativos a su propia
página** en lugar de al backend en Render. Esos tres archivos son la instantánea
que genera [`scripts/generar_snapshot_mapa.mjs`](../../scripts/generar_snapshot_mapa.mjs)
a partir del mismo conjunto sintético que usa el resto de la demostración, con
las mismas formas que devuelve `backend/routes/public.py`. No hay un segundo
conjunto de datos: el mapa y las vistas de rol muestran las mismas obras.

Volver a apuntar la copia a un backend real no requiere tocar código: basta
recompilar con `VITE_API_URL=https://…`.

## Cambios aplicados al fuente

Seis, todos anotados aquí para que la compilación sea auditable:

1. **`app/tailwind.config.js`** — el archivo usaba `require("tailwindcss-animate")`
   dentro de un paquete declarado `"type": "module"`, lo que impide compilar con
   Node 22 (`ReferenceError: require is not defined`). Se sustituyó por un
   `import`. No altera el resultado visual.
2. **`app/src/utils/coordinates.ts`** — las cifras estaban fijadas a `'es-MX'`.
   Como el sitio que ahora aloja el mapa es bilingüe, el locale pasa a seguir el
   idioma del documento (`document.documentElement.lang`). El reloj de la
   cabecera se quedó fuera de este parche —sigue formateando con `'es-MX'` a
   mano— y se corrige desde fuera; véase más abajo.
3. **`app/src/App.tsx`** — al pinchar un marcador no aparecía nada. El popup
   se renderizaba con `{isSelected && <Popup/>}`, es decir, se montaba después
   de que Leaflet ya había atendido el clic; nacía cerrado y nadie lo abría.
   Montado siempre, Leaflet lo enlaza con `bindPopup` y lo abre él mismo.
4. **`app/src/utils/coordinates.ts` y `App.tsx`** — las posiciones se derivaban
   de un hash del nombre de la comunidad dentro de la caja del municipio. Ahora
   se usa la coordenada real de la comunidad cuando la fuente la aporta, con un
   desplazamiento determinista de hasta 150 m para que dos obras de la misma
   comunidad no se encimen; el hash queda como respaldo.
5. **`app/src/App.tsx`** — el visor era sólo oscuro: teselas `dark_all` de CARTO
   y lienzo `#080c0f`, ambos escritos a mano. Se añadió el hook `useModo()`, que
   lee `data-modo` de `<html>` y escucha el evento `temacambiado` que emite
   `theme.js`; el juego de teselas y el color del lienzo pasan a depender de él.
   Es el único cambio que el CSS no podía hacer desde fuera, porque la URL de las
   teselas es una prop de React.
6. **`app/src/App.tsx`** — la ficha técnica del popup describía la obra sólo con
   texto. Ahora, cuando la fuente aporta el campo `imagenes`, muestra encima una
   galería con flechas y puntos de posición, que lee las rutas que trae el
   snapshot, relativas a `/mapa/` (hoy, las miniaturas de `img/obras/mini/`;
   véase «Fotos» más abajo). Enseña el estado terminado; el conmutador
   antes/después vive en las vistas de rol, donde la ficha de la obra tiene
   sitio para él y el visor cartográfico no.

El resto de la adaptación no toca el código del visor:

- **Idioma** — `docs/mapa/index.html` carga `../js/i18n.js`, el mismo motor de
  traducción por frase del resto del sitio, que actúa sobre el DOM que React
  genera.
- **Fechas** — [`docs/js/mapa_locale.js`](../js/mapa_locale.js) envuelve los
  formateadores de `Date` antes de que cargue el bundle: cuando alguien pide un
  locale español y el documento está en otro idioma, lo sustituye. Existe porque
  el reloj de la cabecera formatea con `'es-MX'` escrito a mano, de modo que con
  la interfaz en inglés la fecha se quedaba en «LUN, 10 DE AGO DE 2026». El
  arreglo de verdad está en el fuente; recompilar el bundle para cambiar una
  cadena traía más riesgo que valor, y aquí queda anotado para quien lo
  recompile.
- **Accesibilidad** — [`docs/js/mapa_a11y.js`](../js/mapa_a11y.js) da nombre
  accesible a los marcadores, que son `divIcon` con `role="button"` y ningún
  texto dentro. Mismo motivo y mismo destino: el fuente.
- **Mapa base** — [`docs/js/mapa_teselas.js`](../js/mapa_teselas.js) se
  carga antes del bundle, intercepta a Leaflet cuando éste se publica en
  `window.L` y se queda con la capa de teselas que crea React. De la URL de
  CARTO que el visor le pasa sólo toma el modo (claro u oscuro); qué
  proveedor sirve las teselas lo decide él. Véase la sección siguiente.
- **Fotos** — la galería del cambio 6 trata cualquier fallo de la imagen como
  definitivo: su `onError` pone un icono 🛠️ y no vuelve a pedirla. Con red
  lenta, y sobre todo al cambiar de proveedor de mapa, cuando el navegador
  baja de golpe una pantalla de teselas, una obra podía quedarse sin foto.
  [`docs/js/mapa_fotos.js`](../js/mapa_fotos.js) intercepta el error en fase
  de captura, antes que React, enseña «Cargando foto…» y reintenta alternando
  la miniatura y el original, con esperas crecientes y al recuperar la
  conexión. Además precarga en segundo plano las 30 fotos del mapa en cuanto
  éste termina de cargar. Las miniaturas (640 px, unas cinco veces más
  ligeras que los originales de 1600 px) las genera
  [`scripts/generar_miniaturas.py`](../../scripts/generar_miniaturas.py), y
  el snapshot apunta a ellas. El arreglo de fondo —reintentar en el propio
  `onError`— queda anotado para quien recompile el visor.
- **Temas** — [`docs/css/mapa-tema.css`](../css/mapa-tema.css) reescribe desde
  fuera las variables que el visor sí declara (`--text-*`, `--glass-*`) y las
  pocas reglas donde el color quedó fijo, siguiendo los mismos dos ejes que el
  resto del sitio. Con el tema «original» en oscuro el visor se ve exactamente
  como el de Uriel.

## Datos y servicios externos

Los registros son sintéticos e ilustrativos, como en toda la demostración. El
mapa base sí es externo, y es la única dependencia de red del artefacto
publicado; es inherente a cualquier visor cartográfico y no es una API de
aplicación.

El visor compilado pide teselas de **CARTO** (Positron y Dark Matter) sobre
datos de **OpenStreetMap**, y a nadie más. En 2026 CARTO empezó a contestar a
toda petición sin clave con un `200 OK` y una imagen con la leyenda «API KEY
REQUIRED»; como para Leaflet eso no es un error, el mapa se quedó en blanco sin
que nada lo notara. Desde entonces el proveedor no es uno solo:
[`mapa_teselas.js`](../js/mapa_teselas.js) prueba cada uno antes de usarlo
—dos teselas contiguas del centro del municipio tienen que llegar, ser imágenes
y ser distintas, porque una marca de agua es la misma imagen en cualquier
coordenada— y lo vigila mientras está en uso. El orden es:

1. CARTO, el que cita el capítulo, mientras siga sirviendo mapa.
2. Esri Canvas (gris claro y oscuro), OpenStreetMap, Esri World Street Map,
   OpenStreetMap HOT, OpenTopoMap y Esri World Imagery. Todos gratuitos y sin
   clave; los que no tienen versión oscura se invierten con un filtro CSS.
3. Una **copia local**: un extracto de OpenStreetMap (ODbL) del municipio y su
   entorno —límites, vías, ríos, cuerpos de agua y localidades— en
   [`base/temascaltepec.json`](base/temascaltepec.json), servido desde este
   mismo sitio y dibujado en el navegador. Lo genera
   [`scripts/generar_mapa_base.py`](../../scripts/generar_mapa_base.py) desde
   Overpass. Si ni ese archivo llegara, el contorno del municipio va escrito en
   el propio script.

El control «¿No carga el mapa? Probar otro proveedor», abajo a la derecha,
enseña la lista con el estado de cada uno, y `?teselas=<id>` fija uno desde la
URL (`carto`, `esri-gris`, `osm`, `esri-calles`, `osm-hot`, `topo`,
`esri-satelite` o `local`).

## Autoría y licencia

El código del visor es de Uriel González Casiano, coautor del capítulo ICOKG
2026 que este repositorio acompaña. El repositorio de origen no declara una
licencia, de modo que esta copia se conserva aquí como respaldo del artefacto
de reproducibilidad y por acuerdo entre los autores; cualquier reutilización
fuera de ese ámbito debe consultarse con él.
