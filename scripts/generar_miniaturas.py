"""
generar_miniaturas.py
=============================================================================
Genera docs/img/obras/mini/: las fotos de obra que enseña el popup del mapa.

Por qué existe
--------------
El popup del Mapa Inteligente dibuja la foto a 300 x 120 px, pero leía los
originales de 1600 x 900 (unos 120 KB cada uno) que usan las vistas de rol.
Con una red lenta, y sobre todo justo después de cambiar de proveedor de mapa
—cuando el navegador está bajando de golpe una pantalla entera de teselas—,
la foto tardaba o fallaba, y el visor la sustituía por un icono sin volver a
intentarlo. Las miniaturas pesan unas cinco veces menos; scripts/
generar_snapshot_mapa.mjs apunta el popup a ellas y docs/js/mapa_fotos.js
recurre al original si una miniatura no llega.

Sólo se generan las fotos de la obra terminada (obr-001-3.webp): las de
«antes» no aparecen en el mapa.

Uso
---
    python scripts/generar_miniaturas.py              # genera las que falten
    python scripts/generar_miniaturas.py --rehacer    # rehace todas
    python scripts/generar_miniaturas.py --verificar  # sólo comprueba (CI)
"""
import argparse
import re
import sys
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / 'docs' / 'img' / 'obras'
DESTINO = ORIGEN / 'mini'

# 640 x 360 cubre el recuadro de 300 x 120 del popup en pantallas de
# densidad 2 con el recorte de object-fit: cover.
TAMANO = (640, 360)
CALIDAD = 74
PATRON = re.compile(r'^obr-\d{3}-\d+\.webp$')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rehacer', action='store_true')
    ap.add_argument('--verificar', action='store_true')
    args = ap.parse_args()

    fuentes = sorted(p for p in ORIGEN.iterdir() if PATRON.match(p.name))
    faltan = [p for p in fuentes if not (DESTINO / p.name).exists()]
    sobran = sorted(p.name for p in DESTINO.glob('*.webp')
                    if not (ORIGEN / p.name).exists()) if DESTINO.exists() else []

    if args.verificar:
        for p in faltan:
            print(f'falta la miniatura de {p.name}')
        for n in sobran:
            print(f'miniatura sin original: {n}')
        sys.exit(1 if faltan or sobran else 0)

    DESTINO.mkdir(exist_ok=True)
    total_o = total_m = 0
    for p in fuentes:
        salida = DESTINO / p.name
        if salida.exists() and not args.rehacer:
            continue
        with Image.open(p) as im:
            im = im.convert('RGB')
            im.thumbnail(TAMANO, Image.LANCZOS)
            im.save(salida, 'WEBP', quality=CALIDAD, method=6)
        total_o += p.stat().st_size
        total_m += salida.stat().st_size
        print(f'{p.name}: {p.stat().st_size // 1024} KB -> {salida.stat().st_size // 1024} KB')
    if total_o:
        print(f'total: {total_o // 1024} KB -> {total_m // 1024} KB')
    for n in sobran:
        print(f'aviso: miniatura sin original, bórrela a mano: {n}')


if __name__ == '__main__':
    main()
