-- ============================================================
-- FUNCIONES DE AUTO-GENERACIÓN DE DIMENSIONES
-- ============================================================

-- Auto-generar dim_obra desde tabla obra (con SCD Tipo 2)
CREATE OR REPLACE FUNCTION warehouse.sync_dim_obra()
RETURNS TRIGGER AS $$
DECLARE
    v_obra_key BIGINT;
    v_constructora_key BIGINT;
    v_region_key BIGINT;
    v_supervisor_key BIGINT;
    v_etapa_nombre VARCHAR(50);
    v_estado_nombre VARCHAR(20);
BEGIN
    -- Resolver claves de dimensiones relacionadas
    SELECT constructora_key INTO v_constructora_key
    FROM warehouse.dim_constructora 
    WHERE constructora_id = NEW.id_constructora AND es_actual = TRUE;
    
    SELECT region_key INTO v_region_key
    FROM warehouse.dim_region 
    WHERE region_id = NEW.id_region AND es_actual = TRUE;
    
    SELECT personal_key INTO v_supervisor_key
    FROM warehouse.dim_personal 
    WHERE personal_id = NEW.codigo_supervisor AND es_actual = TRUE;
    
    -- Mapear etapa
    v_etapa_nombre := CASE NEW.etapa
        WHEN 1 THEN 'Planeación'
        WHEN 2 THEN 'Licitación'
        WHEN 3 THEN 'Ejecución'
        WHEN 4 THEN 'Supervisión'
        WHEN 5 THEN 'Cierre'
        ELSE 'Desconocida'
    END;
    
    v_estado_nombre := CASE NEW.estado
        WHEN TRUE THEN 'Activa'
        ELSE 'Inactiva'
    END;
    
    -- Si es UPDATE, cerrar versión anterior
    IF TG_OP = 'UPDATE' THEN
        UPDATE warehouse.dim_obra
        SET 
            fecha_expiracion = NOW(),
            es_actual = FALSE,
            motivo_cambio = 'modificacion'
        WHERE obra_id = NEW.id_obra AND es_actual = TRUE;
    END IF;
    
    -- Insertar nueva versión
    INSERT INTO warehouse.dim_obra (
        obra_id, codigo_expediente, nombre_obra, descripcion,
        etapa, etapa_nombre, estado, estado_nombre,
        fecha_inicio, fecha_final, duracion_programada_dias, beneficiarios,
        constructora_key, region_key, supervisor_key,
        motivo_cambio
    ) VALUES (
        NEW.id_obra, NEW.codigo_expediente, NEW.nombre_obra, NEW.descripcion,
        NEW.etapa, v_etapa_nombre, NEW.estado, v_estado_nombre,
        NEW.fecha_inicio, NEW.fecha_final, 
        NEW.fecha_final - NEW.fecha_inicio, NEW.beneficiarios,
        v_constructora_key, v_region_key, v_supervisor_key,
        CASE WHEN TG_OP = 'INSERT' THEN 'creacion' ELSE 'modificacion' END
    )
    RETURNING obra_key INTO v_obra_key;
    
    -- Si es INSERT, registrar evento de auditoría
    IF TG_OP = 'INSERT' THEN
        INSERT INTO warehouse.fact_eventos_auditoria (
            tiempo_key, tipo_evento_key, obra_key, region_key, 
            personal_key, constructora_key,
            descripcion_evento, es_evento_inicial
        ) VALUES (
            TO_NUMBER(TO_CHAR(NOW(), 'YYYYMMDD'), '99999999'),
            (SELECT tipo_evento_key FROM warehouse.dim_tipo_evento WHERE codigo_evento = 'CREACION_OBRA'),
            v_obra_key, v_region_key, v_supervisor_key, v_constructora_key,
            'Obra registrada en el sistema', TRUE
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger en obra
CREATE TRIGGER trg_sync_dim_obra
    AFTER INSERT OR UPDATE ON public.obra
    FOR EACH ROW
    EXECUTE FUNCTION warehouse.sync_dim_obra();

-- Auto-generar dim_region
CREATE OR REPLACE FUNCTION warehouse.sync_dim_region()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        UPDATE warehouse.dim_region
        SET fecha_expiracion = NOW(), es_actual = FALSE
        WHERE region_id = NEW.id_region AND es_actual = TRUE;
    END IF;
    
    INSERT INTO warehouse.dim_region (region_id, comunidad, barrio, colonia)
    VALUES (NEW.id_region, NEW.comunidad, NEW.barrio, NEW.colonia);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_dim_region
    AFTER INSERT OR UPDATE ON public.region
    FOR EACH ROW
    EXECUTE FUNCTION warehouse.sync_dim_region();

-- Auto-generar dim_constructora
CREATE OR REPLACE FUNCTION warehouse.sync_dim_constructora()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        UPDATE warehouse.dim_constructora
        SET fecha_expiracion = NOW(), es_actual = FALSE
        WHERE constructora_id = NEW.id_constructora AND es_actual = TRUE;
    END IF;
    
    INSERT INTO warehouse.dim_constructora (constructora_id, rfc, nombre_const, tipo_ejecutor)
    VALUES (NEW.id_constructora, NEW.rfc, NEW.nombre_const, NEW.tipo_ejecutor);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_dim_constructora
    AFTER INSERT OR UPDATE ON public.constructora
    FOR EACH ROW
    EXECUTE FUNCTION warehouse.sync_dim_constructora();

-- Auto-generar dim_personal
CREATE OR REPLACE FUNCTION warehouse.sync_dim_personal()
RETURNS TRIGGER AS $$
DECLARE
    v_es_supervisor BOOLEAN := FALSE;
    v_es_proyectista BOOLEAN := FALSE;
    v_es_director BOOLEAN := FALSE;
    v_es_secretario BOOLEAN := FALSE;
    v_empresa TEXT := NULL;
    v_constructora_asignada TEXT := NULL;
    v_telefono TEXT := NULL;
BEGIN
    -- Determinar roles
    v_es_supervisor := NEW.rol = 'Supervisor';
    v_es_proyectista := NEW.rol = 'Proyectista';
    v_es_director := NEW.rol = 'Director';
    v_es_secretario := NEW.rol = 'Secretario';
    
    -- Obtener datos específicos según rol
    IF v_es_proyectista THEN
        SELECT empresa, id_constructora INTO v_empresa, v_constructora_asignada
        FROM public.proyectista WHERE codigo_personal = NEW.codigo_personal;
    ELSIF v_es_supervisor THEN
        SELECT telefono INTO v_telefono
        FROM public.supervisor WHERE codigo_personal = NEW.codigo_personal;
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        UPDATE warehouse.dim_personal
        SET fecha_expiracion = NOW(), es_actual = FALSE
        WHERE personal_id = NEW.codigo_personal AND es_actual = TRUE;
    END IF;
    
    INSERT INTO warehouse.dim_personal (
        personal_id, nombre_completo, rol,
        es_supervisor, es_proyectista, es_director, es_secretario,
        empresa, constructora_asignada, telefono
    ) VALUES (
        NEW.codigo_personal, 
        NEW.nombre || ' ' || NEW.apellido_paterno || COALESCE(' ' || NEW.apellido_materno, ''),
        NEW.rol,
        v_es_supervisor, v_es_proyectista, v_es_director, v_es_secretario,
        v_empresa, v_constructora_asignada, v_telefono
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_dim_personal
    AFTER INSERT OR UPDATE ON public.personal
    FOR EACH ROW
    EXECUTE FUNCTION warehouse.sync_dim_personal();

-- Auto-generar dim_fuente
CREATE OR REPLACE FUNCTION warehouse.sync_dim_fuente()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO warehouse.dim_fuente (fuente_id, grado_nivel, programa)
    VALUES (NEW.id_fuente, NEW.grado_nivel, NEW.programa)
    ON CONFLICT (fuente_id) DO UPDATE SET
        grado_nivel = EXCLUDED.grado_nivel,
        programa = EXCLUDED.programa,
        actualizado_en = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_dim_fuente
    AFTER INSERT OR UPDATE ON public.fuente_presupuestaria
    FOR EACH ROW
    EXECUTE FUNCTION warehouse.sync_dim_fuente();

-- Auto-generar dim_presupuesto
CREATE OR REPLACE FUNCTION warehouse.sync_dim_presupuesto()
RETURNS TRIGGER AS $$
DECLARE
    v_proyectista_key BIGINT;
BEGIN
    SELECT personal_key INTO v_proyectista_key
    FROM warehouse.dim_personal
    WHERE personal_id = NEW.id_proyectista AND es_actual = TRUE;
    
    IF TG_OP = 'UPDATE' THEN
        UPDATE warehouse.dim_presupuesto
        SET fecha_expiracion = NOW(), es_actual = FALSE
        WHERE presupuesto_id = NEW.id_presupuesto AND es_actual = TRUE;
    END IF;
    
    INSERT INTO warehouse.dim_presupuesto (presupuesto_id, presupuesto_total, proyectista_key)
    VALUES (NEW.id_presupuesto, NEW.presupuesto_total, v_proyectista_key);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_dim_presupuesto
    AFTER INSERT OR UPDATE ON public.presupuesto_obra
    FOR EACH ROW
    EXECUTE FUNCTION warehouse.sync_dim_presupuesto();

-- Auto-generar dim_poblador
CREATE OR REPLACE FUNCTION warehouse.sync_dim_poblador()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        UPDATE warehouse.dim_poblador
        SET fecha_expiracion = NOW(), es_actual = FALSE
        WHERE poblador_id = NEW.id AND es_actual = TRUE;
    END IF;
    
    INSERT INTO warehouse.dim_poblador (poblador_id, nombre_completo, comunidad, curp)
    VALUES (NEW.id, NEW.nombre || ' ' || NEW.apellidos, NEW.comunidad, NEW.curp);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_dim_poblador
    AFTER INSERT OR UPDATE ON public.pobladores
    FOR EACH ROW
    EXECUTE FUNCTION warehouse.sync_dim_poblador();

-- Auto-generar dim_propuesta
CREATE OR REPLACE FUNCTION warehouse.sync_dim_propuesta()
RETURNS TRIGGER AS $$
DECLARE
    v_poblador_key BIGINT;
BEGIN
    SELECT poblador_key INTO v_poblador_key
    FROM warehouse.dim_poblador
    WHERE poblador_id = NEW.poblador_id AND es_actual = TRUE;
    
    IF TG_OP = 'UPDATE' THEN
        UPDATE warehouse.dim_propuesta
        SET fecha_expiracion = NOW(), es_actual = FALSE
        WHERE propuesta_id = NEW.id AND es_actual = TRUE;
    END IF;
    
    INSERT INTO warehouse.dim_propuesta (
        propuesta_id, titulo, region, descripcion_obra,
        descripcion_beneficiados, pros_comunidad, anio_convocatoria, poblador_key
    ) VALUES (
        NEW.id, NEW.titulo, NEW.region, NEW.descripcion_obra,
        NEW.descripcion_beneficiados, NEW.pros_comunidad, NEW.anio_convocatoria, v_poblador_key
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_dim_propuesta
    AFTER INSERT OR UPDATE ON public.propuestas_obras
    FOR EACH ROW
    EXECUTE FUNCTION warehouse.sync_dim_propuesta();

-- ============================================================
-- FUNCIÓN PARA REGISTRAR EVENTOS ESPECÍFICOS
-- ============================================================

CREATE OR REPLACE FUNCTION warehouse.registrar_evento(
    p_codigo_evento VARCHAR(50),
    p_obra_id TEXT DEFAULT NULL,
    p_personal_id TEXT DEFAULT NULL,
    p_monto_presupuesto NUMERIC DEFAULT NULL,
    p_monto_costo NUMERIC DEFAULT NULL,
    p_porcentaje_avance_fisico SMALLINT DEFAULT NULL,
    p_porcentaje_avance_pres SMALLINT DEFAULT NULL,
    p_descripcion TEXT DEFAULT NULL,
    p_documento_referencia TEXT DEFAULT NULL,
    p_url_evidencia TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_evento_key BIGINT;
    v_tiempo_key INTEGER;
    v_tipo_evento_key INTEGER;
    v_obra_key BIGINT;
    v_personal_key BIGINT;
    v_region_key BIGINT;
    v_constructora_key BIGINT;
    v_fuente_key INTEGER;
    v_presupuesto_key BIGINT;
BEGIN
    v_tiempo_key := TO_NUMBER(TO_CHAR(NOW(), 'YYYYMMDD'), '99999999');
    
    SELECT tipo_evento_key INTO v_tipo_evento_key
    FROM warehouse.dim_tipo_evento WHERE codigo_evento = p_codigo_evento;
    
    IF p_obra_id IS NOT NULL THEN
        SELECT obra_key, region_key, constructora_key 
        INTO v_obra_key, v_region_key, v_constructora_key
        FROM warehouse.dim_obra 
        WHERE obra_id = p_obra_id AND es_actual = TRUE;
    END IF;
    
    IF p_personal_id IS NOT NULL THEN
        SELECT personal_key INTO v_personal_key
        FROM warehouse.dim_personal
        WHERE personal_id = p_personal_id AND es_actual = TRUE;
    END IF;
    
    INSERT INTO warehouse.fact_eventos_auditoria (
        tiempo_key, tipo_evento_key, obra_key, region_key,
        personal_key, constructora_key,
        monto_presupuesto, monto_costo,
        porcentaje_avance_fisico, porcentaje_avance_pres,
        descripcion_evento, documento_referencia, url_evidencia
    ) VALUES (
        v_tiempo_key, v_tipo_evento_key, v_obra_key, v_region_key,
        v_personal_key, v_constructora_key,
        p_monto_presupuesto, p_monto_costo,
        p_porcentaje_avance_fisico, p_porcentaje_avance_pres,
        p_descripcion, p_documento_referencia, p_url_evidencia
    )
    RETURNING evento_key INTO v_evento_key;
    
    RETURN v_evento_key;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS PARA EVENTOS ESPECÍFICOS
-- ============================================================

--Evento: Registro de informe de avance
CREATE OR REPLACE FUNCTION warehouse.evento_informe_avance()
RETURNS TRIGGER AS $$
DECLARE
    v_obra_id TEXT;
    v_costo_acumulado NUMERIC;
BEGIN
    SELECT id_obra INTO v_obra_id FROM public.informes WHERE id_informe = NEW.id_informe;
    
    SELECT COALESCE(SUM(costo), 0) INTO v_costo_acumulado
    FROM public.costos
    WHERE id_presupuesto = (SELECT id_presupuesto FROM public.presupuesto_obra WHERE id_obra = v_obra_id);
    
    PERFORM warehouse.registrar_evento(
        'INFORME_AVANCE',
        v_obra_id,
        NEW.codigo_supervisor,
        NULL,
        NULL,
        NEW.porcentaje_avance_fisico,
        NEW.porcentaje_avance_presupuestario,
        'Informe mensual registrado: ' || NEW.mes || ' ' || NEW.ano_infor,
        NEW.id_informe,
        NULL
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evento_informe
    AFTER INSERT ON public.informes
    FOR EACH ROW
    EXECUTE FUNCTION warehouse.evento_informe_avance();

-- Evento: Registro de costo
CREATE OR REPLACE FUNCTION warehouse.evento_registro_costo()
RETURNS TRIGGER AS $$
DECLARE
    v_obra_id TEXT;
BEGIN
    SELECT id_obra INTO v_obra_id
    FROM public.presupuesto_obra
    WHERE id_presupuesto = NEW.id_presupuesto;
    
    PERFORM warehouse.registrar_evento(
        'REGISTRO_COSTO',
        v_obra_id,
        NULL,
        NULL,
        NEW.costo,
        NULL,
        NULL,
        'Gasto registrado: ' || NEW.categoria || ' - ' || NEW.descripcion,
        NEW.id_gasto,
        NULL
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evento_costo
    AFTER INSERT ON public.costos
    FOR EACH ROW
    EXECUTE FUNCTION warehouse.evento_registro_costo();

--Evento: Subida de imagen
CREATE OR REPLACE FUNCTION warehouse.evento_subida_imagen()
RETURNS TRIGGER AS $$
DECLARE
    v_obra_id TEXT;
BEGIN
    SELECT id_obra INTO v_obra_id FROM public.informes WHERE id_informe = NEW.id_informe;
    
    PERFORM warehouse.registrar_evento(
        'SUBIDA_IMAGEN',
        v_obra_id,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        'Evidencia fotográfica subida: ' || NEW.nombre_original,
        NEW.id_imagen::TEXT,
        NEW.url_publica
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evento_imagen
    AFTER INSERT ON public.imagenes_informe
    FOR EACH ROW
    EXECUTE FUNCTION warehouse.evento_subida_imagen();

-- Evento: Voto ciudadano
CREATE OR REPLACE FUNCTION warehouse.evento_voto()
RETURNS TRIGGER AS $$
DECLARE
    v_poblador_key BIGINT;
    v_propuesta_key BIGINT;
    v_region TEXT;
BEGIN
    SELECT dp.poblador_key, dpr.propuesta_key, dpr.region
    INTO v_poblador_key, v_propuesta_key, v_region
    FROM warehouse.dim_poblador dp
    CROSS JOIN warehouse.dim_propuesta dpr
    WHERE dp.poblador_id = NEW.poblador_id AND dp.es_actual = TRUE
      AND dpr.propuesta_id = NEW.propuesta_id AND dpr.es_actual = TRUE;
    
    INSERT INTO warehouse.fact_eventos_auditoria (
        tiempo_key, tipo_evento_key, poblador_key, propuesta_key,
        descripcion_evento, total_votos
    ) VALUES (
        TO_NUMBER(TO_CHAR(NOW(), 'YYYYMMDD'), '99999999'),
        (SELECT tipo_evento_key FROM warehouse.dim_tipo_evento WHERE codigo_evento = 'VOTO_EMITIDO'),
        v_poblador_key,
        v_propuesta_key,
        'Voto emitido en período: ' || NEW.periodo_voto,
        1
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evento_voto
    AFTER INSERT ON public.votos_propuestas
    FOR EACH ROW
    EXECUTE FUNCTION warehouse.evento_voto();

-- ============================================================
-- FUNCIÓN ETL: GENERAR SNAPSHOT MENSUAL
-- ============================================================

CREATE OR REPLACE FUNCTION warehouse.generar_snapshot_mensual(p_anio INTEGER, p_mes INTEGER)
RETURNS TABLE(
    obras_procesadas INTEGER,
    obras_con_retraso INTEGER,
    monto_total_presupuesto NUMERIC,
    monto_total_ejercido NUMERIC
) AS $$
DECLARE
    v_tiempo_key INTEGER;
    v_obras_procesadas INTEGER := 0;
    v_obras_retraso INTEGER := 0;
    v_monto_presupuesto NUMERIC := 0;
    v_monto_ejercido NUMERIC := 0;
BEGIN
    v_tiempo_key := p_anio * 10000 + p_mes * 100 + 1; -- Primer día del mes
    
    FOR rec IN 
        SELECT 
            o.obra_key,
            o.fecha_inicio,
            o.fecha_final,
            po.presupuesto_total,
            COALESCE(SUM(c.costo), 0) as costo_acumulado,
            COUNT(DISTINCT i.id_informe) as informes_count,
            COUNT(DISTINCT img.id_imagen) as imagenes_count,
            COUNT(DISTINCT p.id_oficio) as permisos_count
        FROM warehouse.dim_obra o
        LEFT JOIN public.presupuesto_obra po ON o.obra_id = po.id_obra
        LEFT JOIN public.costos c ON po.id_presupuesto = c.id_presupuesto
        LEFT JOIN public.informes i ON o.obra_id = i.id_obra 
            AND i.ano_infor = p_anio AND i.mes = TO_CHAR(TO_DATE(p_mes::TEXT, 'MM'), 'Month')
        LEFT JOIN public.imagenes_informe img ON i.id_informe = img.id_informe
        LEFT JOIN public.permisos p ON o.obra_id = p.id_obra
        WHERE o.es_actual = TRUE
        GROUP BY o.obra_key, o.fecha_inicio, o.fecha_final, po.presupuesto_total
    LOOP
        INSERT INTO warehouse.fact_obra_mensual (
            tiempo_key, obra_key,
            presupuesto_total, costo_acumulado, saldo_presupuesto,
            porcentaje_ejercido,
            dias_retraso,
            informes_registrados, imagenes_evidencia, permisos_obtenidos,
            tiene_retraso
        ) VALUES (
            v_tiempo_key,
            rec.obra_key,
            rec.presupuesto_total,
            rec.costo_acumulado,
            rec.presupuesto_total - rec.costo_acumulado,
            CASE WHEN rec.presupuesto_total > 0 
                 THEN ROUND((rec.costo_acumulado / rec.presupuesto_total) * 100, 2)
                 ELSE 0 
            END,
            EXTRACT(DAY FROM NOW() - rec.fecha_final)::INTEGER,
            rec.informes_count,
            rec.imagenes_count,
            rec.permisos_count,
            NOW() > rec.fecha_final AND rec.costo_acumulado < rec.presupuesto_total
        )
        ON CONFLICT (tiempo_key, obra_key) DO UPDATE SET
            costo_acumulado = EXCLUDED.costo_acumulado,
            saldo_presupuesto = EXCLUDED.saldo_presupuesto,
            porcentaje_ejercido = EXCLUDED.porcentaje_ejercido,
            dias_retraso = EXCLUDED.dias_retraso,
            informes_registrados = EXCLUDED.informes_registrados,
            imagenes_evidencia = EXCLUDED.imagenes_evidencia,
            permisos_obtenidos = EXCLUDED.permisos_obtenidos,
            tiene_retraso = EXCLUDED.tiene_retraso;
        
        v_obras_procesadas := v_obras_procesadas + 1;
        v_monto_presupuesto := v_monto_presupuesto + COALESCE(rec.presupuesto_total, 0);
        v_monto_ejercido := v_monto_ejercido + rec.costo_acumulado;
        
        IF NOW() > rec.fecha_final AND rec.costo_acumulado < rec.presupuesto_total THEN
            v_obras_retraso := v_obras_retraso + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_obras_procesadas, v_obras_retraso, v_monto_presupuesto, v_monto_ejercido;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VISTAS ANALÍTICAS PARA REPORTES DE AUDITORÍA
-- ============================================================

-- Dashboard de obras con retraso
CREATE OR REPLACE VIEW warehouse.v_obras_retraso AS
SELECT 
    o.obra_id,
    o.nombre_obra,
    o.codigo_expediente,
    o.etapa_nombre,
    o.estado_nombre,
    o.fecha_inicio,
    o.fecha_final,
    o.fecha_final_real,
    r.comunidad,
    r.barrio,
    c.nombre_const as constructora,
    p.nombre_completo as supervisor,
    fom.presupuesto_total,
    fom.costo_acumulado,
    fom.saldo_presupuesto,
    fom.porcentaje_ejercido,
    fom.dias_retraso,
    fom.informes_registrados,
    fom.imagenes_evidencia
FROM warehouse.fact_obra_mensual fom
JOIN warehouse.dim_obra o ON fom.obra_key = o.obra_key AND o.es_actual = TRUE
LEFT JOIN warehouse.dim_region r ON o.region_key = r.region_key AND r.es_actual = TRUE
LEFT JOIN warehouse.dim_constructora c ON o.constructora_key = c.constructora_key AND c.es_actual = TRUE
LEFT JOIN warehouse.dim_personal p ON o.supervisor_key = p.personal_key AND p.es_actual = TRUE
WHERE fom.tiene_retraso = TRUE
  AND fom.tiempo_key = (SELECT MAX(tiempo_key) FROM warehouse.fact_obra_mensual);

-- Trazabilidad completa de una obra
CREATE OR REPLACE VIEW warehouse.v_trazabilidad_obra AS
SELECT 
    o.obra_id,
    o.nombre_obra,
    t.fecha as fecha_evento,
    te.codigo_evento,
    te.nombre_evento,
    te.categoria,
    fea.descripcion_evento,
    fea.monto_presupuesto,
    fea.monto_costo,
    fea.porcentaje_avance_fisico,
    fea.porcentaje_avance_pres,
    fea.documento_referencia,
    fea.url_evidencia,
    per.nombre_completo as ejecutor
FROM warehouse.fact_eventos_auditoria fea
JOIN warehouse.dim_tiempo t ON fea.tiempo_key = t.tiempo_key
JOIN warehouse.dim_tipo_evento te ON fea.tipo_evento_key = te.tipo_evento_key
JOIN warehouse.dim_obra o ON fea.obra_key = o.obra_key
LEFT JOIN warehouse.dim_personal per ON fea.personal_key = per.personal_key
ORDER BY o.obra_id, t.fecha;

-- Participación ciudadana por región
CREATE OR REPLACE VIEW warehouse.v_participacion_ciudadana AS
SELECT 
    dp.region,
    dp.anio_convocatoria,
    COUNT(DISTINCT dp.propuesta_id) as total_propuestas,
    COUNT(DISTINCT v.poblador_key) as votantes_unicos,
    COUNT(v.evento_key) as total_votos,
    ROUND(COUNT(v.evento_key)::NUMERIC / NULLIF(COUNT(DISTINCT v.poblador_key), 0), 2) as promedio_votos_por_persona
FROM warehouse.dim_propuesta dp
LEFT JOIN warehouse.fact_eventos_auditoria v ON dp.propuesta_key = v.propuesta_key
    AND v.tipo_evento_key = (SELECT tipo_evento_key FROM warehouse.dim_tipo_evento WHERE codigo_evento = 'VOTO_EMITIDO')
WHERE dp.es_actual = TRUE
GROUP BY dp.region, dp.anio_convocatoria;

-- Ejercicio presupuestario por fuente
CREATE OR REPLACE VIEW warehouse.v_ejercicio_presupuestario AS
SELECT 
    f.fuente_id,
    f.grado_nivel,
    f.programa,
    COUNT(DISTINCT o.obra_key) as obras_financiadas,
    SUM(fom.presupuesto_total) as presupuesto_asignado,
    SUM(fom.costo_acumulado) as monto_ejercido,
    SUM(fom.saldo_presupuesto) as saldo_pendiente,
    ROUND(SUM(fom.costo_acumulado) / NULLIF(SUM(fom.presupuesto_total), 0) * 100, 2) as porcentaje_ejercicio
FROM warehouse.dim_fuente f
JOIN public.financia fin ON f.fuente_id = fin.id_fuente
JOIN warehouse.dim_obra o ON fin.id_obra = o.obra_id AND o.es_actual = TRUE
JOIN warehouse.fact_obra_mensual fom ON o.obra_key = fom.obra_key
    AND fom.tiempo_key = (SELECT MAX(tiempo_key) FROM warehouse.fact_obra_mensual)
GROUP BY f.fuente_id, f.grado_nivel, f.programa;

-- Alertas de auditoría (eventos que requieren atención)
CREATE OR REPLACE VIEW warehouse.v_alertas_auditoria AS
SELECT 
    fea.evento_key,
    t.fecha as fecha_evento,
    te.codigo_evento,
    te.nombre_evento,
    o.obra_id,
    o.nombre_obra,
    fea.descripcion_evento,
    fea.monto_costo,
    fea.documento_referencia,
    CASE 
        WHEN te.codigo_evento = 'REGISTRO_COSTO' AND fea.monto_costo > 1000000 THEN 'ALTO_MONTO'
        WHEN te.codigo_evento = 'CAMBIO_ESTADO' AND o.estado = FALSE THEN 'OBRA_CANCELADA'
        WHEN te.codigo_evento = 'MODIFICACION_PRESUPUESTO' THEN 'CAMBIO_PRESUPUESTAL'
        WHEN fea.dias_desde_evento_anterior > 90 THEN 'EVENTO_TARDIO'
        ELSE 'REVISAR'
    END as tipo_alerta
FROM warehouse.fact_eventos_auditoria fea
JOIN warehouse.dim_tiempo t ON fea.tiempo_key = t.tiempo_key
JOIN warehouse.dim_tipo_evento te ON fea.tipo_evento_key = te.tipo_evento_key
JOIN warehouse.dim_obra o ON fea.obra_key = o.obra_key
WHERE fea.requiere_atencion = TRUE
   OR te.nivel_importancia >= 8
ORDER BY t.fecha DESC;
