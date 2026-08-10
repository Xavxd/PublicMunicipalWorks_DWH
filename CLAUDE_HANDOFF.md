# Prompt de relevo para Claude — ICOKG 2026 / Obras Públicas

Trabaja como agente principal en el repositorio local indicado abajo. **No respondas sólo con un diagnóstico**: termina la corrección, valida los entregables, publica el artefacto estático en GitHub Pages y comprueba la página pública. Conserva cambios ajenos del árbol de trabajo y no uses `git add -A`, `git reset --hard` ni borrados amplios.

## Objetivo del usuario (mensaje inicial y aclaraciones)

El usuario, **Gabriel Hurtado Avilés**, pidió corregir el artículo ICOKG 2026 *A Dimensional Data Warehouse for Geospatial Monitoring of Municipal Public Works, with an Evolution Path Toward a Lakehouse Architecture*, atendiendo las revisiones. Es autor de correspondencia. Pidió replicar las convenciones de su artículo de DWH de agua: plantilla LNCS, adscripción ESCOM–IPN, correo de correspondencia, ORCID y enlaces clicables, DOI hipervinculados, PDF final y PDF con correcciones en color.

Además, el repositorio `gabrielhuav/PublicMunicipalWorks_DWH` debe ser un artefacto reproducible coherente con el artículo. Debe tener un release/artefacto realmente visitable en GitHub Pages y no puede depender de Flask/Python REST API para funcionar. La interfaz estática **debe conservar la apariencia de la página original** de Urigc; no se debe sustituir por un dashboard rediseñado. El usuario remarcó que, al ser un clon de `Urigc/Obras_publicas`, la versión publicada debe ser visualmente equivalente al original. Debe conservar guinda/azul y tema claro/oscuro cuando ello forme parte del original o del alcance pactado.

Todos los datos, README, CFF, código y texto del artículo deben coincidir. No inventar DOI del capítulo: se añadirá cuando Springer lo asigne. Para las personas, el enlace correcto es **ORCID**, no DOI.

## Rutas y URLs obligatorias

| Recurso | Ruta o URL |
|---|---|
| Repositorio local | `C:\Users\gabri\Documents\GitHub Desktop\PublicMunicipalWorks_DWH` |
| Remoto que debe publicarse | `https://github.com/gabrielhuav/PublicMunicipalWorks_DWH` |
| URL esperada de Pages | `https://gabrielhuav.github.io/PublicMunicipalWorks_DWH/` |
| Upstream/original del clon | `https://github.com/Urigc/Obras_publicas` |
| Referencia visual original | `https://urigc.github.io/Obras_publicas/` |
| Mapa Ciudadano enlazado por el original | `https://polite-frangipane-c8c252.netlify.app/` |
| Comentarios de revisores | `C:\Users\gabri\.codex\attachments\019ac559-9321-464c-9947-124af8dd5153\pasted-text.txt` |
| Primer texto/anotaciones de la revisión | `C:\Users\gabri\.codex\attachments\99cdc405-f04d-4b60-ac17-5d8a74d08a33\pasted-text.txt` |
| Artículo originalmente enviado | `C:\Users\gabri\Downloads\ICOKG 2026 REVIEWS\Sent\DWH Obras Públicas\main_final_EN.tex` |
| Artículo DWH de agua ya enviado (referencia de formato y declaración IA) | `C:\Users\gabri\Downloads\ICOKG 2026 REVIEWS\Sent\DWH AGUA\Revision 1 DWH Agua\dw_agua_icokg2026.tex` |
| Fuente final actual del artículo | `paper\main_camera_ready.tex` |
| PDF limpio actual | `paper\main_final.pdf` |
| PDF de cambios azul actual | `paper\main_with_changes.pdf` |
| Figura requerida por LaTeX | `paper\ejemplo.png` |
| Demo candidata a Pages | `docs\` |
| Workflow de Pages | `.github\workflows\deploy-pages.yml` |
| Metadatos de cita | `CITATION.cff` |

## Identidad de autoría

- Gabriel Hurtado Avilés — ORCID `0009-0002-5686-1822`; autor de correspondencia; `gabrielhuav@gmail.com`.
- Uriel González Casiano — ORCID `0009-0009-8172-9584`.
- Marco Tulio Maldonado Mejía — ORCID `0009-0005-4691-9607`.
- Adscripción: Escuela Superior de Cómputo (ESCOM), Instituto Politécnico Nacional, Mexico City, Mexico.

## Revisión solicitada por los árbitros

El archivo de revisiones contiene, entre otros puntos: añadir preguntas de investigación; mejorar estado del arte y contraste; describir el módulo de retrasos/alertas y explicar resultados; traducir/refactorizar Figura 1 y coherencia capa–texto; asegurar que Figura 2 sea visible y referenciada; corregir la ecuación/títulos de tablas; mejorar citas, redacción y tamaño de figuras; distinguir resultados medidos, metas de diseño y proyecciones; moderar afirmaciones de impacto social; declarar granularidad de hechos, estrategia de vistas y casos SCD2; mantener el alcance actual como DWH con almacenamiento de objetos y evolución futura hacia lakehouse/Linked Data.

## Estado real actual (verificar; no asumir que esté publicado)

### Artículo

`paper/main_camera_ready.tex` ya incorpora buena parte de la respuesta a revisores: RQs, comparación, granularidad, SCD, aclaración de resultados sintéticos, módulo de detección, figura de arquitectura en inglés y disponibilidad. Contiene un interruptor:

```tex
\revisionmarksfalse
```

Con `false` produce final limpio; con `true` marca texto revisado en azul. Incluye la declaración de IA tomada/adaptada del artículo de agua y ahora envuelve los tres `\orcidID{...}` en `\href{https://orcid.org/...}{...}`. Los DOI de la bibliografía deben seguir siendo clicables.

Los dos PDFs fueron recompilados después de esos cambios. Verificación realizada: **15 páginas**, 0 `Overfull \hbox`, 0 referencias indefinidas, y `pypdf` detectó 3 URLs ORCID en cada PDF. Aun así, al modificar el texto, recompila dos veces y renderiza/inspecciona visualmente antes de entregar. MiKTeX disponible en:

```text
C:\Users\gabri\AppData\Local\Programs\MiKTeX\miktex\bin\x64\pdflatex.exe
```

El usuario pidió en `paper/` sólo un `.tex` y dos PDFs como entregables; `ejemplo.png` se conserva porque es dependencia imprescindible del `.tex`. No dejes PDFs anteriores/duplicados ni temporales.

### Artefacto estático

La primera implementación de `docs/` fue un rediseño incorrecto. Ya fue reemplazada mecánicamente por la interfaz existente del clon:

- `docs/index.html` proviene de `index.html` del root.
- `docs/css/main.css` es **idéntico byte a byte** a `css/main.css` del root.
- `docs/css/propuestas.css`, `docs/js/theme.js`, `docs/js/cables.js` provienen del original.
- `docs/main.js` proviene del original, salvo que su `loginUser()` remoto fue sustituido por un resultado sintético en memoria y el login no redirige a páginas de rol inexistentes bajo `docs/`.
- `docs/js/propuestas.js` fue sustituido por un pequeño modal estático para que el botón de participación no llame a la API.
- `docs/js/api_client.js` fue removido.

Hay por tanto una portada visualmente equivalente al original y sin llamadas `fetch` / `backend-obraspublicas` / Render en los scripts desplegados. Sin embargo, **no se ha hecho una prueba visual local completa** porque el navegador de esta sesión bloqueó abrir `file:///...`; la página pública aún no existe. El original carga fuentes, GSAP y el enlace externo al Mapa Ciudadano. Conserva esa identidad visual, pero comprueba tras publicar que recursos, botones, tema y modal funcionen. Decide explícitamente si deben incluirse páginas de rol estáticas equivalentes o si el modal/flujo de demostración es suficiente; no dejes enlaces rotos. No vuelvas a sustituir la UI por otro diseño.

### Publicación pendiente

`.github/workflows/deploy-pages.yml` despliega `docs/` al recibir push a la rama actual `TestDefinitivo`. La URL de Pages devolvía 404 antes de crear el workflow. **Todavía no hubo staging, commit, push ni activación/verificación efectiva de Pages.**

El CLI `gh` existe, pero `gh auth status` informó token inválido para `gabrielhuav`; no dependas de esa sesión sin reautenticar. GitHub Desktop puede tener credenciales válidas para `git push`. Si GitHub Pages no queda habilitado automáticamente por `actions/deploy-pages`, habilítalo para el repositorio con fuente “GitHub Actions” a través de la interfaz o API autenticada y verifica la URL final.

El archivo `.git/index.lock` residual vacío (creado el 5 de agosto) fue eliminado explícitamente por instrucción del usuario. Si reaparece, inspecciona procesos Git antes de actuar, salvo nueva autorización explícita.

## Estado de Git y alcance de commit

Rama actual: `TestDefinitivo`.

```text
origin   https://github.com/gabrielhuav/PublicMunicipalWorks_DWH.git
upstream https://github.com/Urigc/Obras_publicas.git
```

El árbol está sucio. Antes de publicar, inspecciona todos los cambios y no incluyas por defecto archivos que no pertenezcan al artículo/artefacto. Estado observado al crear este relevo:

```text
 M README.md
 M scripts/evaluacion/generar_dataset_obras.py
?? .__wtest
?? .gitattributes
?? .github/
?? CITATION.cff
?? docs/
?? notas_release.md
?? paper/
?? scripts/evaluacion/eval_deteccion_anomalias_DEPRECATED.py
?? scripts/evaluacion/eval_deteccion_v2.py
?? scripts/seed_demo_users.py
```

Posible conjunto inicial a revisar/stagear por relación directa con la entrega: `README.md`, `CITATION.cff`, `docs/`, `.github/workflows/deploy-pages.yml`, `paper/`, `scripts/evaluacion/generar_dataset_obras.py`, `scripts/evaluacion/eval_deteccion_v2.py`, `scripts/evaluacion/eval_deteccion_anomalias_DEPRECATED.py`. Revisa `notas_release.md`, `.gitattributes` y `scripts/seed_demo_users.py` antes de decidir: podrían ser trabajo previo relevante, pero no se deben publicar ciegamente. `. __wtest` (sin espacio; nombre exacto `.__wtest`) parece ajeno y no debe incluirse sin inspección.

## Criterios de terminación

1. La web pública `https://gabrielhuav.github.io/PublicMunicipalWorks_DWH/` deja de dar 404 y se comprueba visualmente contra `https://urigc.github.io/Obras_publicas/`.
2. La web conserva la UI original; no requiere backend/API para sus acciones demostrativas y no tiene enlaces internos rotos.
3. README, `CITATION.cff`, demo y sección Availability del artículo dicen exactamente lo mismo sobre el alcance estático y el backend de referencia.
4. `paper/` contiene sólo el `.tex`, la figura fuente necesaria, `main_final.pdf` y `main_with_changes.pdf`; ambos a 15 páginas y visualmente revisados. La versión de cambios muestra azul; la final no.
5. Los tres ORCID son clicables en los dos PDFs y en CFF. No se inventa DOI del capítulo.
6. Se hace commit intencional y push de sólo los cambios pertinentes, se verifica el workflow de Pages y se informa el commit/URL final. Si GitHub exige una acción que requiera login o autoridad del usuario, pide la mínima intervención concreta.

