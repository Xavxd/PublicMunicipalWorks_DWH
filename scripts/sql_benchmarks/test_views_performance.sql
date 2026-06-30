-- ============================================================================
-- BENCHMARK DE VISTAS ANALÍTICAS - DATA WAREHOUSE
-- ============================================================================
-- Propósito: Medir tiempos de ejecución de vistas del warehouse
-- ============================================================================

-- Configuración de sesión
SET statement_timeout = '5min';
SET work_mem = '64MB';

-- ============================================================================
-- 1. VISTA: v_obras_retraso
-- ============================================================================
\timing on  -- Activar timing en psql

-- Medición 1: EXPLAIN ANALYZE (muestra plan de ejecución y tiempos reales)
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM warehouse.v_obras_retraso;

-- Medición 2: Ejecución múltiple para promediar (10 iteraciones)
DO $$
DECLARE
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_duration INTERVAL;
    v_total_duration INTERVAL := INTERVAL '0';
    i INTEGER;
BEGIN
    FOR i IN 1..10 LOOP
        v_start_time := clock_timestamp();
        
        PERFORM * FROM warehouse.v_obras_retraso;
        
        v_end_time := clock_timestamp();
        v_duration := v_end_time - v_start_time;
        v_total_duration := v_total_duration + v_duration;
        
        RAISE NOTICE 'Iteración %: % ms', 
            i, 
            EXTRACT(MILLISECONDS FROM v_duration);
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tiempo promedio: % ms', 
        EXTRACT(MILLISECONDS FROM v_total_duration) / 10;
END $$;

-- ============================================================================
-- 2. VISTA: v_alertas_auditoria
-- ============================================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM warehouse.v_alertas_auditoria;

DO $$
DECLARE
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_duration INTERVAL;
    v_total_duration INTERVAL := INTERVAL '0';
    i INTEGER;
BEGIN
    FOR i IN 1..10 LOOP
        v_start_time := clock_timestamp();
        PERFORM * FROM warehouse.v_alertas_auditoria;
        v_end_time := clock_timestamp();
        v_duration := v_end_time - v_start_time;
        v_total_duration := v_total_duration + v_duration;
    END LOOP;
    
    RAISE NOTICE 'v_alertas_auditoria - Promedio (10 iteraciones): % ms', 
        EXTRACT(MILLISECONDS FROM v_total_duration) / 10;
END $$;

-- ============================================================================
-- 3. VISTA: v_ejercicio_presupuestario
-- ============================================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM warehouse.v_ejercicio_presupuestario;

-- ============================================================================
-- 4. VISTA: v_participacion_ciudadana
-- ============================================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM warehouse.v_participacion_ciudadana;

-- ============================================================================
-- 5. CONSULTA COMPLEJA: JOIN entre múltiples vistas
-- ============================================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT 
    r.comunidad,
    COUNT(DISTINCT o.obra_id) as total_obras,
    SUM(fom.presupuesto_total) as presupuesto_total,
    AVG(fom.dias_retraso) as promedio_retraso
FROM warehouse.fact_obra_mensual fom
JOIN warehouse.dim_obra o ON fom.obra_key = o.obra_key
JOIN warehouse.dim_region r ON o.region_key = r.region_key
WHERE fom.tiempo_key = (SELECT MAX(tiempo_key) FROM warehouse.fact_obra_mensual)
GROUP BY r.comunidad
ORDER BY presupuesto_total DESC;

\timing off
