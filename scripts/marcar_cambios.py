"""
marcar_cambios.py
=============================================================================
Genera paper/main_with_changes.pdf: el capítulo con lo que cambió respecto a
la versión que se envió a revisión, en color.

Por qué no se hace a mano
-------------------------
Antes cada trozo reescrito se envolvía en `\\rev{}` y un interruptor del
preámbulo lo pintaba de azul. Eso marca lo que alguien se acordó de envolver,
no lo que de verdad cambió; después de varias rondas de correcciones las dos
cosas habían dejado de coincidir y el PDF «con cambios» daba una idea falsa
de qué se había tocado. Aquí las marcas salen de comparar los dos ficheros,
así que no dependen de la memoria de nadie y no pueden quedarse atrás.

Los envoltorios manuales se retiraron del fuente: `main_camera_ready.tex` ya
no tiene maquinaria de marcado, sólo el texto.

Qué produce
-----------
Añadido en azul subrayado, suprimido en rojo tachado (el estilo por omisión
de latexdiff, UNDERLINE).

Las tablas se comparan como bloques enteros y no por celdas: latexdiff mete
su marcado entre `\\midrule` y las filas, y el resultado no compila. Es el
precio de que el documento se pueda generar; el texto que rodea cada tabla sí
va marcado y es donde se explica lo que cambió. Las figuras TikZ se excluyen
por lo mismo.

Requisitos
----------
`latexdiff-fast`, que viene con MiKTeX y usa el `diff` del sistema en lugar
del módulo Perl Algorithm::Diff, que aquí no está instalado.

Uso
---
    python scripts/marcar_cambios.py
"""
import shutil
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PAPER = RAIZ / "paper"
ACTUAL = PAPER / "main_camera_ready.tex"
SALIDA = PAPER / "main_with_changes.pdf"

ORIGINAL = Path(
    r"C:\Users\gabri\Downloads\ICOKG 2026 REVIEWS\Sent\DWH Obras Públicas\main_final_EN.tex"
)

# Entornos cuyo interior se deja intacto; véase la nota de arriba.
SIN_MARCAR = "picture|DIFnomarkup|tikzpicture|tabular"

BASE = "_diff_original"
NUEVO = "_diff_actual"
MARCADO = "_diff_marcado"


def correr(orden, **kw):
    r = subprocess.run(orden, cwd=PAPER, capture_output=True, **kw)
    return r


def main():
    if not ORIGINAL.exists():
        sys.exit(f"No encuentro la versión enviada a revisión:\n  {ORIGINAL}\n"
                 f"Si está en otro sitio, corrige ORIGINAL en este script.")

    shutil.copyfile(ORIGINAL, PAPER / f"{BASE}.tex")
    shutil.copyfile(ACTUAL, PAPER / f"{NUEVO}.tex")

    salida = correr(["latexdiff-fast", "--config", f"PICTUREENV={SIN_MARCAR}",
                     f"{BASE}.tex", f"{NUEVO}.tex"])
    if salida.returncode:
        sys.exit("latexdiff-fast falló:\n" + salida.stderr.decode("utf-8", "replace")[:800])
    (PAPER / f"{MARCADO}.tex").write_bytes(salida.stdout)

    # Dos pasadas: la segunda resuelve las referencias cruzadas.
    for _ in range(2):
        correr(["pdflatex", "-interaction=nonstopmode", f"{MARCADO}.tex"])

    pdf = PAPER / f"{MARCADO}.pdf"
    if not pdf.exists():
        sys.exit(f"No se generó {pdf.name}; mira {MARCADO}.log")

    registro = (PAPER / f"{MARCADO}.log").read_text(encoding="utf-8", errors="ignore")
    fallos = [l for l in registro.splitlines() if l.startswith("!")]
    if fallos:
        print("Avisos de compilación:")
        for f in fallos[:5]:
            print("  " + f)

    shutil.copyfile(pdf, SALIDA)
    paginas = registro.count("[") and [l for l in registro.splitlines()
                                       if "Output written" in l]
    print(f"{SALIDA.relative_to(RAIZ)} escrito")
    if paginas:
        print("  " + paginas[0].strip())

    for sufijo in (".tex", ".pdf", ".aux", ".log", ".out", ".bbl", ".blg"):
        for nombre in (BASE, NUEVO, MARCADO):
            (PAPER / f"{nombre}{sufijo}").unlink(missing_ok=True)


if __name__ == "__main__":
    main()
