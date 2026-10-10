"""
generar_mapa_base.py
============================================================================
Builds the offline basemap that the Smart Map falls back to when no tile
provider answers: docs/mapa/base/temascaltepec.json.

Why it exists
-------------
The published viewer used CARTO raster tiles and nothing else. When CARTO
started answering every request with a 200 OK "API KEY REQUIRED" watermark,
the map went blank in front of an audience, and Leaflet never noticed,
because nothing had failed at the HTTP level. docs/js/mapa_teselas.js now
tries a chain of free providers and verifies each one; this file is the last
link of that chain. It is served from the same GitHub Pages site as the page
itself, so if the page loaded, the basemap loads.

What it contains
----------------
An extract of OpenStreetMap (ODbL) around the municipality of Temascaltepec
(relation 5606454): its boundary, the neighbouring municipal limits, roads by
class, rivers and streams, bodies of water and named places. Geometries are
simplified with Douglas-Peucker (tolerances in metres, below one pixel at the
viewer's maximum zoom of 16), quantised to 1e-5 degrees (~1.1 m) and
delta-encoded; minor roads are kept only within 0.04 deg of the municipality.
The browser draws it on canvas tiles, see `CapaLocal` in mapa_teselas.js.

Usage
-----
    python scripts/generar_mapa_base.py                # downloads from Overpass
    python scripts/generar_mapa_base.py --desde DIR    # reuses DIR/area.json
                                                       # and DIR/municipio.json

Also prints the simplified outline embedded in mapa_teselas.js as
`CONTORNO_MINIMO`, which is drawn if even this file cannot be fetched.
"""
import argparse
import json
import math
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict

RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SALIDA = os.path.join(RAIZ, 'docs', 'mapa', 'base', 'temascaltepec.json')

RELACION = 5606454          # Temascaltepec, admin_level 6 (INEGI 15086)
CAJA = (18.85, -100.36, 19.32, -99.70)   # s, w, n, e: el encuadre del visor con margen
MARGEN_MENORES = 0.04       # grados alrededor del municipio para calles y brechas
Q = 100000                  # 1e-5 grados

ESPEJOS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
]

CONSULTA_AREA = (
    '[out:json][timeout:240][bbox:{s},{w},{n},{e}];('
    'way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|'
    'motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|living_street|track)$"];'
    'way["waterway"~"^(river|stream)$"];'
    'way["natural"="water"];rel["natural"="water"];way["landuse"="reservoir"];'
    'node["place"~"^(city|town|village|hamlet)$"];'
    'rel["boundary"="administrative"]["admin_level"="6"];'
    ');out geom qt;'
)
CONSULTA_MUNICIPIO = '[out:json][timeout:120];rel({rel});out geom;'

# Tolerancias de Douglas-Peucker en metros. A zoom 16 un píxel mide ~2.3 m en
# esta latitud; las vías principales se quedan por debajo del par de píxeles.
TOL = {'via1': 4, 'via2': 5, 'via3': 6, 'via4': 7, 'brecha': 10,
       'rio': 7, 'arroyo': 12, 'agua': 6, 'limite': 20, 'municipio': 8}
TOL_CONTORNO_MINIMO = 150

R = 6378137.0


def descargar(consulta, destino):
    datos = urllib.parse.urlencode({'data': consulta}).encode()
    ultimo = None
    for url in ESPEJOS:
        try:
            req = urllib.request.Request(url, data=datos, headers={
                'User-Agent': 'PublicMunicipalWorks_DWH (github.com/gabrielhuav/PublicMunicipalWorks_DWH)'})
            with urllib.request.urlopen(req, timeout=300) as r:
                cuerpo = r.read()
            json.loads(cuerpo)
            with open(destino, 'wb') as f:
                f.write(cuerpo)
            print(f'  {os.path.basename(destino)} <- {url} ({len(cuerpo) / 1e6:.1f} MB)')
            return
        except Exception as e:  # el siguiente espejo
            ultimo = e
            print(f'  {url}: {e}', file=sys.stderr)
    raise SystemExit(f'Ningún espejo de Overpass respondió: {ultimo}')


def merc(lon, lat):
    return math.radians(lon) * R, math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * R


def simplificar(pts, tol):
    """Douglas-Peucker iterativo sobre [(lon, lat)], tolerancia en metros."""
    if len(pts) < 3:
        return pts
    m = [merc(*p) for p in pts]
    queda = [False] * len(pts)
    queda[0] = queda[-1] = True
    pila = [(0, len(pts) - 1)]
    tol2 = tol * tol
    while pila:
        a, b = pila.pop()
        ax, ay = m[a]
        dx, dy = m[b][0] - ax, m[b][1] - ay
        l2 = dx * dx + dy * dy
        mejor, im = -1.0, -1
        for i in range(a + 1, b):
            px, py = m[i]
            t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
            d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d2 > mejor:
                mejor, im = d2, i
        if mejor > tol2:
            queda[im] = True
            pila += [(a, im), (im, b)]
    return [p for p, k in zip(pts, queda) if k]


def codificar(pts):
    """Enteros a 1e-5 grados en deltas: [lon0, lat0, dlon1, dlat1, ...]."""
    out, px, py = [], None, None
    for lon, lat in pts:
        x, y = round(lon * Q), round(lat * Q)
        if px is None:
            out += [x, y]
        elif (x, y) != (px, py):
            out += [x - px, y - py]
        else:
            continue
        px, py = x, y
    return out


def unir_anillos(tramos):
    """Une tramos abiertos por sus extremos hasta cerrar anillos."""
    tramos = [list(t) for t in tramos if len(t) >= 2]
    anillos = []
    while tramos:
        cur = tramos.pop()
        cambiado = True
        while cur[0] != cur[-1] and cambiado:
            cambiado = False
            for i, t in enumerate(tramos):
                if t[0] == cur[-1]:
                    cur += t[1:]
                elif t[-1] == cur[-1]:
                    cur += t[::-1][1:]
                elif t[-1] == cur[0]:
                    cur = t + cur[1:]
                elif t[0] == cur[0]:
                    cur = t[::-1] + cur[1:]
                else:
                    continue
                tramos.pop(i)
                cambiado = True
                break
        if len(cur) >= 4:
            anillos.append(cur)
    return anillos


def geom(g):
    return [(p['lon'], p['lat']) for p in g]


def clase_via(hw):
    if hw in ('motorway', 'trunk', 'primary', 'motorway_link', 'trunk_link', 'primary_link'):
        return 'via1'
    if hw in ('secondary', 'secondary_link'):
        return 'via2'
    if hw in ('tertiary', 'tertiary_link'):
        return 'via3'
    if hw in ('unclassified', 'residential', 'living_street'):
        return 'via4'
    return 'brecha'


def compactar(area, muni):
    b = muni['elements'][0]['bounds']

    def cerca(g):
        return any(b['minlat'] - MARGEN_MENORES <= la <= b['maxlat'] + MARGEN_MENORES and
                   b['minlon'] - MARGEN_MENORES <= lo <= b['maxlon'] + MARGEN_MENORES
                   for lo, la in g)

    capas = defaultdict(list)
    lugares = []
    linderos = set()

    for e in area['elements']:
        t = e.get('tags', {})
        if e['type'] == 'node' and 'place' in t:
            if t.get('name'):
                clase = {'city': 0, 'town': 0, 'village': 1, 'hamlet': 2}[t['place']]
                # OSM la registra como village y sin capital=*; es la cabecera
                # y tiene que rotularse desde el zoom más alejado.
                if t['name'].startswith('Temascaltepec'):
                    clase = 0
                lugares.append([t['name'], clase, round(e['lon'] * Q), round(e['lat'] * Q)])
        elif e['type'] == 'way' and 'highway' in t:
            c = clase_via(t['highway'])
            g = geom(e['geometry'])
            if c in ('via4', 'brecha') and not cerca(g):
                continue
            capas[c].append(codificar(simplificar(g, TOL[c])))
        elif e['type'] == 'way' and 'waterway' in t:
            c = 'rio' if t['waterway'] == 'river' else 'arroyo'
            capas[c].append(codificar(simplificar(geom(e['geometry']), TOL[c])))
        elif t.get('boundary') == 'administrative':
            if e['id'] == RELACION:
                continue  # el propio municipio va aparte, como polígono
            for m in e.get('members', []):
                if m['type'] != 'way' or m.get('role') not in ('outer', '') or 'geometry' not in m:
                    continue
                if m['ref'] in linderos:
                    continue  # el lindero entre dos vecinos viene en los dos
                linderos.add(m['ref'])
                capas['limite'].append(codificar(simplificar(geom(m['geometry']), TOL['limite'])))
        elif e['type'] == 'way':
            g = geom(e['geometry'])
            if len(g) >= 4 and g[0] == g[-1]:
                capas['agua'].append([codificar(simplificar(g, TOL['agua']))])
        elif e['type'] == 'relation':
            miembros = [m for m in e.get('members', []) if m['type'] == 'way' and 'geometry' in m]
            anillos = (unir_anillos([geom(m['geometry']) for m in miembros if m.get('role') == 'outer']) +
                       unir_anillos([geom(m['geometry']) for m in miembros if m.get('role') == 'inner']))
            if anillos:
                capas['agua'].append([codificar(simplificar(a, TOL['agua'])) for a in anillos])

    rel = muni['elements'][0]
    exteriores = unir_anillos([geom(m['geometry']) for m in rel['members']
                               if m['type'] == 'way' and m.get('role') == 'outer' and 'geometry' in m])
    lugares.sort(key=lambda p: (p[1], p[0]))
    doc = {
        'v': 1,
        'q': Q,
        'fuente': '© OpenStreetMap contributors (ODbL)',
        'fecha': area['osm3s']['timestamp_osm_base'],
        'municipio': [codificar(simplificar(a, TOL['municipio'])) for a in exteriores],
        'capas': dict(capas),
        'lugares': lugares,
    }
    minimo = [codificar(simplificar(a, TOL_CONTORNO_MINIMO)) for a in exteriores]
    return doc, minimo


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[3])
    ap.add_argument('--desde', help='carpeta con area.json y municipio.json ya descargados')
    args = ap.parse_args()

    carpeta = args.desde
    if not carpeta:
        import tempfile
        carpeta = tempfile.mkdtemp(prefix='mapa_base_')
        print('Descargando de Overpass…')
        s, w, n, e = CAJA
        descargar(CONSULTA_AREA.format(s=s, w=w, n=n, e=e), os.path.join(carpeta, 'area.json'))
        descargar(CONSULTA_MUNICIPIO.format(rel=RELACION), os.path.join(carpeta, 'municipio.json'))

    with open(os.path.join(carpeta, 'area.json'), encoding='utf-8') as f:
        area = json.load(f)
    with open(os.path.join(carpeta, 'municipio.json'), encoding='utf-8') as f:
        muni = json.load(f)

    doc, minimo = compactar(area, muni)
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))

    print(f'{os.path.relpath(SALIDA, RAIZ)}: {os.path.getsize(SALIDA) / 1024:.0f} KB, '
          f'datos OSM de {doc["fecha"]}')
    for c, v in sorted(doc['capas'].items()):
        print(f'  {c:8s} {len(v):6d} rasgos')
    print(f'  lugares  {len(doc["lugares"]):6d}')
    print('\nCONTORNO_MINIMO para docs/js/mapa_teselas.js:')
    print(json.dumps(minimo, separators=(',', ':')))


if __name__ == '__main__':
    main()
