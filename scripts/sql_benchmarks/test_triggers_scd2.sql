-- ============================================================================
-- BENCHMARK DE TRIGGERS SCD TIPO 2
-- ============================================================================
-- Propósito: Medir tiempo de inserción/actualización con triggers SCD 2
-- ============================================================================

\timing on

-- ============================================================================
-- PRUEBA 1: INSERCIÓN CON TRIGGER (dim_obra)
-- ============================================================================
DO $$
DECLARE
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_duration INTERVAL;
    v_total_duration INTERVAL := INTERVAL '0';
    i INTEGER;
    v_test_id TEXT;
BEGIN
    FOR i IN 1..100 LOOP
        v_test_id := 'BENCHMARK-TEST-' || i::TEXT;
        
        v_start_time := clock_timestamp();
        
        -- Inserción que dispara trigger trg_sync_dim_obra
        INSERT INTO public.obra (
            id_obra,
            codigo_expediente,
            nombre_obra,
            descripcion,
            etapa,
            estado,
            fecha_inicio,
            fecha_final,
            id_region,
            id_constructora,
            codigo_supervisor
        ) VALUES (
            v_test_id,
            'BENCH-' || i::TEXT,
            'Obra de prueba ' || i,
            'Obra generada para benchmark de triggers',
            1,
            TRUE,
            CURRENT_DATE,
            CURRENT_DATE + INTERVAL '180 days',
            'REG-001',
            'CONST-001',
            'PER-001'
        );
        
        v_end_time := clock_timestamp();
        v_duration := v_end_time - v_start_time;
        v_total_duration := v_total_duration + v_duration;
        
        -- Limpiar para siguiente iteración
        DELETE FROM public.obra WHERE id_obra = v_test_id;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TRIGGER SCD 2 - dim_obra';
    RAISE NOTICE 'Iteraciones: 100';
    RAISE NOTICE 'Tiempo promedio por inserción: % ms', 
        EXTRACT(MILLISECONDS FROM v_total_duration) / 100;
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- PRUEBA 2: ACTUALIZACIÓN CON TRIGGER (SCD 2 - cierre de versión)
-- ============================================================================
DO $$
DECLARE
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_duration INTERVAL;
    v_total_duration INTERVAL := INTERVAL '0';
    i INTEGER;
    v_test_id TEXT := 'BENCHMARK-UPDATE-TEST';
BEGIN
    -- Crear registro inicial
    INSERT INTO public.obra (
        id_obra, codigo_expediente, nombre_obra, etapa, estado,
        fecha_inicio, fecha_final, id_region, id_constructora, codigo_supervisor
    ) VALUES (
        v_test_id, 'BENCH-UPD', 'Obra update test', 1, TRUE,
        CURRENT_DATE, CURRENT_DATE + INTERVAL '180 days',
        'REG-001', 'CONST-001', 'PER-001'
    );
    
    FOR i IN 1..100 LOOP
        v_start_time := clock_timestamp();
        
        -- Actualización que dispara trigger y cierra versión anterior
        UPDATE public.obra 
        SET etapa = (i % 5) + 1,
            actualizado_en = NOW()
        WHERE id_obra = v_test_id;
        
        v_end_time := clock_timestamp();
        v_duration := v_end_time - v_start_time;
        v_total_duration := v_total_duration + v_duration;
    END LOOP;
    
    -- Limpiar
    DELETE FROM public.obra WHERE id_obra = v_test_id;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TRIGGER SCD 2 - UPDATE (cierre de versión)';
    RAISE NOTICE 'Iteraciones: 100';
    RAISE NOTICE 'Tiempo promedio: % ms', 
        EXTRACT(MILLISECONDS FROM v_total_duration) / 100;
    RAISE NOTICE '========================================';
END $$;

\timing off
