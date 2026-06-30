#!/bin/bash
# ============================================================================
# SCRIPT DE BENCHMARK AUTOMATIZADO
# ============================================================================

set -e  # Detener si hay error

BASE_URL="${1:-https://obras-publicas-demo.onrender.com}"
OUTPUT_DIR="results/$(date +%Y%m%d_%H%M%S)"
NUM_USERS=50
SPAWN_RATE=2
RUN_TIME="3m"

echo "=============================================="
echo "BENCHMARK - SISTEMA LAKEHOUSE OBRAS PÚBLICAS"
echo "=============================================="
echo ""
echo "Configuración:"
echo "  Base URL: $BASE_URL"
echo "  Usuarios concurrentes: $NUM_USERS"
echo "  Spawn rate: $SPAWN_RATE usuarios/segundo"
echo "  Duración: $RUN_TIME"
echo "  Directorio de salida: $OUTPUT_DIR"
echo ""

# Crear directorio de resultados
mkdir -p "$OUTPUT_DIR"

# Ejecutar Locust en modo headless
echo "Iniciando pruebas de carga con Locust..."
locust \
    -f locustfile.py \
    --host="$BASE_URL" \
    --headless \
    -u "$NUM_USERS" \
    -r "$SPAWN_RATE" \
    --run-time "$RUN_TIME" \
    --csv="$OUTPUT_DIR/benchmark" \
    --html="$OUTPUT_DIR/report.html" \
    --html="$OUTPUT_DIR/report.html"

# Generar resumen
echo ""
echo "=============================================="
echo "PRUEBAS COMPLETADAS"
echo "=============================================="
echo ""
echo "Resultados guardados en:"
echo "  - CSV: $OUTPUT_DIR/benchmark_stats.csv"
echo "  - HTML: $OUTPUT_DIR/report.html"
echo ""

# Calcular percentil 95 desde CSV (si existe)
if [ -f "$OUTPUT_DIR/benchmark_stats.csv" ]; then
    echo "Métricas principales (percentil 95):"
    echo ""
    # Extraer métricas del CSV de Locust
    python3 -c "
import csv
import sys

with open('$OUTPUT_DIR/benchmark_stats.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row['Name'] != 'Aggregated':
            continue
        print(f\"  Requests: {row['Request Count']}\")
        print(f\"  Failures: {row['Failure Count']}\")
        print(f\"  Avg Response Time: {row['Average Response Time']} ms\")
        print(f\"  Min Response Time: {row['Min Response Time']} ms\")
        print(f\"  Max Response Time: {row['Max Response Time']} ms\")
        print(f\"  Median Response Time: {row['50%']} ms\")
        print(f\"  95th Percentile: {row['95%']} ms\")
        print(f\"  99th Percentile: {row['99%']} ms\")
        print(f\"  Requests/sec: {row['Current RPS']}\")
"
fi

echo ""
echo "=============================================="
echo "Entorno de prueba:"
echo "  Fecha: $(date)"
echo "  Sistema: $(uname -a)"
echo "  Python: $(python3 --version)"
echo "  Locust: $(locust --version)"
echo "=============================================="
