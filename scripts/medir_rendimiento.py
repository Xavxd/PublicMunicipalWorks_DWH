"""
medir_rendimiento.py
=============================================================================
Mide, contra la pila que levanta docker/compose.yml, las latencias que el
capítulo declaraba como objetivos de diseño.

Por qué existe
--------------
El capítulo daba siete cifras exactas —187 ms en /api/public/obras, 1.42 s de
carga inicial del mapa, 127 req/s, 89 ms para la vista de obras retrasadas,
34 ms para un alta que dispara el SCD 2, y demás— presentadas como «objetivos»
derivados de dimensionamiento arquitectónico. Un revisor observó que no
constaba de dónde salían: ni hardware, ni carga, ni repeticiones, ni datos
crudos, y que la auditoría Lighthouse mide la entrega de un frontend estático
que no ejecuta ni Flask ni PostgreSQL, de modo que RQ1 no quedaba respondida
empíricamente por ningún lado.

Esto lo mide. Cada número que el capítulo publique en esa tabla sale de aquí,
con su entorno anotado, sus repeticiones y su percentil 95, y se puede repetir
con un comando.

Uso
---
    docker compose -f docker/compose.yml up -d
    docker compose -f docker/compose.yml --profile tools run --rm seed
    python scripts/medir_rendimiento.py
    python scripts/medir_rendimiento.py --repeticiones 300 --json medidas.json
"""
import argparse
import json
import platform
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = "http://localhost:5000"
CONTENEDOR_DB = "obras-publicas-db-1"
USUARIO_DB = "obras"
BASE_DB = "obras_publicas"
NL = chr(10)

# (etiqueta, SQL). Las consultas son las que el capítulo nombra.
CONSULTAS = [
    ("v_obras_retraso (delayed works)", "SELECT * FROM warehouse.v_obras_retraso"),
    ("v_anomalias_deteccion (C1-C3)", "SELECT * FROM warehouse.v_anomalias_deteccion WHERE es_anomalia"),
    ("v_ejercicio_presupuestario", "SELECT * FROM warehouse.v_ejercicio_presupuestario"),
    ("v_participacion_ciudadana", "SELECT * FROM warehouse.v_participacion_ciudadana"),
]


def psql_repetido(sql, repeticiones):
    """Mide una consulta N veces dentro de UNA sola sesión.

    Abrir un `docker exec` por repetición cuesta cerca de un segundo y el
    coste del contenedor acaba dominando la medida de una consulta de
    milisegundos. Aquí las N repeticiones van en un único guion y lo que se
    lee es el «Execution Time» que informa el propio servidor, sin latencia
    de arranque de por medio.
    """
    guion = NL.join(f"EXPLAIN (ANALYZE, TIMING ON) {sql};"
                    for _ in range(repeticiones))
    r = subprocess.run(
        ["docker", "exec", "-i", CONTENEDOR_DB, "psql", "-U", USUARIO_DB,
         "-d", BASE_DB, "-t", "-A", "-q"],
        input=guion, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr.strip()[:300])
    tiempos = [float(l.split(":")[1].strip().split()[0])
               for l in r.stdout.splitlines() if l.startswith("Execution Time:")]
    if not tiempos:
        raise RuntimeError(r.stderr.strip()[:300] or "sin Execution Time")
    return tiempos


def pedir(ruta):
    inicio = time.perf_counter()
    try:
        with urllib.request.urlopen(API + ruta, timeout=30) as r:
            r.read()
            estado = r.status
    except urllib.error.HTTPError as e:
        estado = e.code
    except Exception:
        estado = 0
    return (time.perf_counter() - inicio) * 1000, estado


def resumen(muestras):
    m = sorted(muestras)
    return {
        "n": len(m),
        "media_ms": round(statistics.mean(m), 1),
        "p50_ms": round(statistics.median(m), 1),
        "p95_ms": round(m[int(len(m) * 0.95) - 1], 1),
        "max_ms": round(m[-1], 1),
    }


def entorno():
    def salida(orden):
        try:
            return subprocess.run(orden, capture_output=True, text=True).stdout.strip()
        except Exception:
            return "?"
    version_pg = salida(["docker", "exec", CONTENEDOR_DB, "psql", "-U", USUARIO_DB,
                         "-d", BASE_DB, "-t", "-A", "-c", "SHOW server_version"])
    cpus = salida(["docker", "exec", CONTENEDOR_DB, "nproc"])
    return {
        "anfitrion": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "python": platform.python_version(),
        "docker": salida(["docker", "--version"]),
        "postgresql": version_pg,
        "cpus_contenedor": cpus,
        "fecha": time.strftime("%Y-%m-%d %H:%M:%S %Z"),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repeticiones", type=int, default=200)
    ap.add_argument("--concurrencia", type=int, default=10)
    ap.add_argument("--json", help="vuelca las medidas crudas a un fichero")
    args = ap.parse_args()

    codigo, _ = pedir("/api/health")[1], None
    if codigo != 200:
        sys.exit("La API no responde en /api/health. Levanta docker/compose.yml.")

    env = entorno()
    print("Entorno")
    for k, v in env.items():
        print(f"  {k:18} {v}")
    print()

    medidas = {"entorno": env, "rutas": {}, "consultas": {}, "escritura": {}}

    # ---- latencia de las rutas de lectura --------------------------------
    print(f"Latencia de la API — {args.repeticiones} peticiones en serie")
    print(f"  {'ruta':44} {'media':>8} {'p50':>8} {'p95':>8}")
    for ruta in ("/api/public/obras", "/api/public/regiones", "/api/public/resumen",
                 "/api/analitica/anomalias?limite=500",
                 "/api/analitica/obras-retraso?limite=500"):
        muestras = []
        for _ in range(args.repeticiones):
            ms, estado = pedir(ruta)
            if estado == 200:
                muestras.append(ms)
        if not muestras:
            print(f"  {ruta:44} sin respuestas correctas")
            continue
        r = resumen(muestras)
        medidas["rutas"][ruta] = r
        print(f"  {ruta:44} {r['media_ms']:7.1f}ms {r['p50_ms']:7.1f}ms {r['p95_ms']:7.1f}ms")

    # ---- rendimiento sostenido -------------------------------------------
    print(f"\nRendimiento sostenido — {args.concurrencia} clientes en paralelo, "
          f"{args.repeticiones} peticiones")
    inicio = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.concurrencia) as pool:
        resultados = list(pool.map(lambda _: pedir("/api/public/obras"),
                                   range(args.repeticiones)))
    transcurrido = time.perf_counter() - inicio
    correctas = [ms for ms, est in resultados if est == 200]
    rps = len(correctas) / transcurrido
    r95 = resumen(correctas)["p95_ms"] if correctas else 0
    medidas["sostenido"] = {"req_por_segundo": round(rps, 1),
                            "concurrencia": args.concurrencia,
                            "p95_ms": r95,
                            "correctas": len(correctas),
                            "total": args.repeticiones}
    print(f"  {rps:.1f} req/s con p95 de {r95:.1f} ms "
          f"({len(correctas)}/{args.repeticiones} correctas)")

    # ---- consultas analíticas en el servidor -----------------------------
    print("\nConsultas analíticas — tiempo de ejecución en el servidor (EXPLAIN ANALYZE)")
    print(f"  {'consulta':44} {'media':>8} {'p95':>8}")
    for etiqueta, sql in CONSULTAS:
        try:
            muestras = psql_repetido(sql, 25)
        except RuntimeError as e:
            print(f"  {etiqueta:44} error: {e}")
            muestras = []
        if muestras:
            r = resumen(muestras)
            medidas["consultas"][etiqueta] = r
            print(f"  {etiqueta:44} {r['media_ms']:7.1f}ms {r['p95_ms']:7.1f}ms")

    # ---- escritura que dispara el SCD 2 ----------------------------------
    print("\nAlta que dispara el sincronizador SCD 2 de dim_region")
    sello = int(time.time() * 1000) % 10 ** 9
    guion = NL.join(
        f"EXPLAIN (ANALYZE, TIMING ON) "
        f"INSERT INTO public.region (id_region, comunidad, barrio, colonia) "
        f"VALUES ('BENCH-{sello}-{i}', 'Banco {i}', 'Barrio {i}', NULL);"
        for i in range(50))
    r = subprocess.run(
        ["docker", "exec", "-i", CONTENEDOR_DB, "psql", "-U", USUARIO_DB,
         "-d", BASE_DB, "-t", "-A", "-q"],
        input=guion, capture_output=True, text=True)
    muestras = [float(l.split(":")[1].strip().split()[0])
                for l in r.stdout.splitlines() if l.startswith("Execution Time:")]
    if not muestras:
        print(f"  error: {r.stderr.strip()[:200]}")
    if muestras:
        r = resumen(muestras)
        medidas["escritura"]["insert_dim_region_scd2"] = r
        print(f"  {r['media_ms']:.1f} ms de media, {r['p95_ms']:.1f} ms en el p95 "
              f"({r['n']} altas)")
    subprocess.run(["docker", "exec", CONTENEDOR_DB, "psql", "-U", USUARIO_DB,
                    "-d", BASE_DB, "-c",
                    "DELETE FROM public.region WHERE id_region LIKE 'BENCH-%'"],
                   capture_output=True)

    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(medidas, f, indent=2, ensure_ascii=False)
        print(f"\nmedidas en {args.json}")


if __name__ == "__main__":
    main()
