"""
marcar_ilustrativo.py
=============================================================================
Graba la leyenda «ILUSTRATIVO» en las imágenes de docs/img/obras/.

Por qué no se le pide al generador
----------------------------------
Se le pidió, y de treinta imágenes trece salieron sin leyenda y las diecisiete
restantes la traían en posiciones, tamaños y colores distintos. Los modelos de
imagen no son fiables rotulando texto, y aquí la leyenda no es decorativa: es
lo que distingue una ilustración generada de la fotografía de una obra real.
Se compone después, que es determinista y se puede verificar.

La banda inferior cumple dos funciones: sostiene la leyenda y tapa cualquier
rótulo que el generador hubiera dejado en esa zona, sin importar dónde lo
pusiera. Por eso ocupa todo el ancho en lugar de sólo la esquina.

La marca se graba en el archivo, no en CSS, para que viaje con la imagen si
alguien la descarga o la reutiliza fuera del sitio.

Uso
---
    python scripts/marcar_ilustrativo.py            # marca las que falten
    python scripts/marcar_ilustrativo.py --rehacer  # rehace todas

Es idempotente: deja una marca EXIF y no vuelve a procesar una imagen ya
marcada, salvo con --rehacer.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
DIRECTORIO = RAIZ / "docs" / "img" / "obras"

LEYENDA = "ILUSTRATIVO"
ALTO_BANDA = 120         # px sobre una imagen de 900 de alto
MARGEN_DERECHO = 28
CALIDAD = 82
FIRMA = b"ILUSTRATIVO-marcado-v1"


def fuente(tam):
    """Una sans condensada si el sistema la tiene; si no, la de Pillow."""
    for nombre in ("arialbd.ttf", "Arial_Bold.ttf", "DejaVuSans-Bold.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(nombre, tam)
        except OSError:
            continue
    return ImageFont.load_default()


def ya_marcada(ruta):
    with Image.open(ruta) as im:
        return FIRMA in (im.info.get("exif") or b"")


def marcar(ruta):
    with Image.open(ruta) as original:
        im = original.convert("RGB")

    ancho, alto = im.size

    # Los rótulos que dejó el generador caen dentro de esta franja, a alturas
    # distintas en cada imagen. Un degradado oscuro no basta para taparlos: se
    # desenfoca la franja primero, que convierte cualquier texto en una mancha,
    # y encima va el degradado. El resultado se lee como una barra de crédito
    # fotográfico, no como un parche.
    franja = im.crop((0, alto - ALTO_BANDA, ancho, alto))
    franja = franja.filter(ImageFilter.GaussianBlur(radius=14))
    im.paste(franja, (0, alto - ALTO_BANDA))

    banda = Image.new("RGBA", (ancho, ALTO_BANDA), (0, 0, 0, 0))
    pincel = ImageDraw.Draw(banda)

    # Degradado de transparente a negro: sostiene la leyenda y apaga del todo
    # lo que hubiera debajo.
    for y in range(ALTO_BANDA):
        alfa = int(190 * (y / ALTO_BANDA) ** 1.1)
        pincel.line([(0, y), (ancho, y)], fill=(0, 0, 0, alfa))

    tam = max(15, alto // 46)
    f = fuente(tam)
    caja = pincel.textbbox((0, 0), LEYENDA, font=f)
    ancho_texto, alto_texto = caja[2] - caja[0], caja[3] - caja[1]
    x = ancho - ancho_texto - MARGEN_DERECHO
    y = ALTO_BANDA - alto_texto - 24

    # Sombra corta para que se sostenga también sobre un cielo claro.
    pincel.text((x + 1, y + 1), LEYENDA, font=f, fill=(0, 0, 0, 160))
    pincel.text((x, y), LEYENDA, font=f, fill=(255, 255, 255, 235))

    lienzo = im.convert("RGBA")
    lienzo.alpha_composite(banda, (0, alto - ALTO_BANDA))
    lienzo.convert("RGB").save(ruta, "WEBP", quality=CALIDAD, method=6, exif=FIRMA)
    return ruta.stat().st_size


def main():
    rehacer = "--rehacer" in sys.argv
    imagenes = sorted(DIRECTORIO.glob("*.webp"))
    if not imagenes:
        sys.exit(f"No hay imágenes en {DIRECTORIO}")

    hechas = omitidas = 0
    mayor = 0
    for ruta in imagenes:
        if not rehacer and ya_marcada(ruta):
            omitidas += 1
            continue
        tam = marcar(ruta)
        mayor = max(mayor, tam)
        hechas += 1

    print(f"marcadas {hechas}, ya marcadas {omitidas}, total {len(imagenes)}")
    if mayor:
        print(f"archivo mayor tras marcar: {mayor/1024:.0f} KB")
    if mayor > 200 * 1024:
        sys.exit("Alguna imagen supera los 200 KB; baja CALIDAD y repite.")


if __name__ == "__main__":
    main()
