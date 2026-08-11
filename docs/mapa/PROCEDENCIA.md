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
2. **`app/src/App.tsx` y `app/src/utils/coordinates.ts`** — el reloj, las fechas
   y las cifras estaban fijados a `'es-MX'`. Como el sitio que ahora aloja el
   mapa es bilingüe, el locale pasa a seguir el idioma del documento
   (`document.documentElement.lang`).
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
   galería con flechas y puntos de posición, que lee las mismas rutas que las
   vistas de rol (`../img/obras/…`, relativas a `/mapa/`). Enseña el estado
   terminado; el conmutador antes/después vive en las vistas de rol, donde la
   ficha de la obra tiene sitio para él y el visor cartográfico no.

El resto de la adaptación no toca el código del visor:

- **Idioma** — `docs/mapa/index.html` carga `../js/i18n.js`, el mismo motor de
  traducción por frase del resto del sitio, que actúa sobre el DOM que React
  genera.
- **Temas** — [`docs/css/mapa-tema.css`](../css/mapa-tema.css) reescribe desde
  fuera las variables que el visor sí declara (`--text-*`, `--glass-*`) y las
  pocas reglas donde el color quedó fijo, siguiendo los mismos dos ejes que el
  resto del sitio. Con el tema «original» en oscuro el visor se ve exactamente
  como el de Uriel.

## Datos y servicios externos

Los registros son sintéticos e ilustrativos, como en toda la demostración. El
mapa base sí es externo: teselas de **CARTO Dark Matter** sobre datos de
**OpenStreetMap** (ODbL). Es la única dependencia de red del artefacto
publicado, y es inherente a cualquier visor cartográfico; no es una API de
aplicación.

## Autoría y licencia

El código del visor es de Uriel González Casiano, coautor del capítulo ICOKG
2026 que este repositorio acompaña. El repositorio de origen no declara una
licencia, de modo que esta copia se conserva aquí como respaldo del artefacto
de reproducibilidad y por acuerdo entre los autores; cualquier reutilización
fuera de ese ámbito debe consultarse con él.
