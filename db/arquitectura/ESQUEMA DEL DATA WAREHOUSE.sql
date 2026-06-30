-- ============================================================
-- 1. ESQUEMA DEL DATA WAREHOUSE
-- ============================================================
CREATE SCHEMA IF NOT EXISTS warehouse;

-- ============================================================
-- 2. DIMENSIÓN TIEMPO (SCD Tipo 0 - Inmutable)
-- ============================================================
CREATE TABLE warehouse.dim_tiempo (
    tiempo_key          INTEGER PRIMARY KEY,       
    fecha               DATE NOT NULL UNIQUE,
    anio                SMALLINT NOT NULL,
    trimestre           SMALLINT NOT NULL,
    mes                 SMALLINT NOT NULL,
    mes_nombre          VARCHAR(20) NOT NULL,
    mes_nombre_corto    VARCHAR(3) NOT NULL,
    dia                 SMALLINT NOT NULL,
    dia_semana          SMALLINT NOT NULL,         
    dia_nombre          VARCHAR(20) NOT NULL,
    dia_nombre_corto    VARCHAR(3) NOT NULL,
    dia_del_anio        SMALLINT NOT NULL,
    semana_del_anio     SMALLINT NOT NULL,
    es_fin_de_semana    BOOLEAN NOT NULL,
    es_dia_habil        BOOLEAN NOT NULL,          
    
    periodo_fiscal      VARCHAR(10) NOT NULL,       
    es_electoral        BOOLEAN DEFAULT FALSE,      
    es_cierre_ejercicio BOOLEAN DEFAULT FALSE,    
    
    creado_en           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dim_tiempo_anio_mes ON warehouse.dim_tiempo(anio, mes);
CREATE INDEX idx_dim_tiempo_periodo_fiscal ON warehouse.dim_tiempo(periodo_fiscal);

CREATE OR REPLACE FUNCTION warehouse.generar_dim_tiempo(
    p_fecha_inicio DATE,
    p_fecha_fin DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_fecha DATE := p_fecha_inicio;
    v_count INTEGER := 0;
    v_key INTEGER;
    v_periodo_fiscal VARCHAR(10);
BEGIN
    WHILE v_fecha <= p_fecha_fin LOOP
        v_key := TO_NUMBER(TO_CHAR(v_fecha, 'YYYYMMDD'), '99999999');
        
        v_periodo_fiscal := EXTRACT(YEAR FROM v_fecha)::VARCHAR || '-' || 
                           (EXTRACT(YEAR FROM v_fecha) + 1)::VARCHAR;
        
        INSERT INTO warehouse.dim_tiempo (
            tiempo_key, fecha, anio, trimestre, mes, mes_nombre, mes_nombre_corto,
            dia, dia_semana, dia_nombre, dia_nombre_corto, dia_del_anio,
            semana_del_anio, es_fin_de_semana, es_dia_habil,
            periodo_fiscal, es_electoral, es_cierre_ejercicio
        ) VALUES (
            v_key,
            v_fecha,
            EXTRACT(YEAR FROM v_fecha)::SMALLINT,
            EXTRACT(QUARTER FROM v_fecha)::SMALLINT,
            EXTRACT(MONTH FROM v_fecha)::SMALLINT,
            INITCAP(TO_CHAR(v_fecha, 'Month')),
            INITCAP(TO_CHAR(v_fecha, 'Mon')),
            EXTRACT(DAY FROM v_fecha)::SMALLINT,
            EXTRACT(ISODOW FROM v_fecha)::SMALLINT,
            INITCAP(TO_CHAR(v_fecha, 'Day')),
            INITCAP(TO_CHAR(v_fecha, 'Dy')),
            EXTRACT(DOY FROM v_fecha)::SMALLINT,
            EXTRACT(WEEK FROM v_fecha)::SMALLINT,
            EXTRACT(ISODOW FROM v_fecha) IN (6, 7),
            EXTRACT(ISODOW FROM v_fecha) BETWEEN 1 AND 5,
            v_periodo_fiscal,
            FALSE,  -- Actualizar manualmente para períodos electorales
            EXTRACT(MONTH FROM v_fecha) = 12 AND EXTRACT(DAY FROM v_fecha) = 31
        )
        ON CONFLICT (tiempo_key) DO NOTHING;
        
        v_count := v_count + 1;
        v_fecha := v_fecha + INTERVAL '1 day';
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

SELECT warehouse.generar_dim_tiempo('2020-01-01'::DATE, '2030-12-31'::DATE);

-- ============================================================
-- 3. DIMENSIÓN TIPO DE EVENTO (SCD Tipo 0)
-- ============================================================
CREATE TABLE warehouse.dim_tipo_evento (
    tipo_evento_key     SERIAL PRIMARY KEY,
    codigo_evento       VARCHAR(50) NOT NULL UNIQUE,
    nombre_evento       VARCHAR(100) NOT NULL,
    categoria           VARCHAR(50) NOT NULL,      
    subcategoria        VARCHAR(50),
    descripcion         TEXT,
    nivel_importancia   SMALLINT DEFAULT 5,        
    requiere_documento  BOOLEAN DEFAULT FALSE,      
    tabla_origen        VARCHAR(50),               
    es_auditable        BOOLEAN DEFAULT TRUE,
    
    creado_en           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dim_tipo_evento_categoria ON warehouse.dim_tipo_evento(categoria);

INSERT INTO warehouse.dim_tipo_evento 
    (codigo_evento, nombre_evento, categoria, subcategoria, descripcion, nivel_importancia, requiere_documento, tabla_origen)
VALUES

    ('CREACION_OBRA', 'Creación de Obra', 'administrativo', 'registro', 'Registro inicial de una nueva obra pública', 9, FALSE, 'obra'),
    ('MODIFICACION_OBRA', 'Modificación de Obra', 'administrativo', 'cambio', 'Cambio en datos generales de la obra', 7, FALSE, 'obra'),
    ('CAMBIO_ESTADO', 'Cambio de Estado de Obra', 'administrativo', 'estado', 'Activación o desactivación de obra, cambio de etapa', 8, FALSE, 'obra'),
    ('ASIGNACION_SUPERVISOR', 'Asignación/Cambio de Supervisor', 'administrativo', 'personal', 'Cambio en la supervisión de la obra', 8, FALSE, 'obra'),
    
    ('REGISTRO_PRESUPUESTO', 'Registro de Presupuesto', 'financiero', 'presupuesto', 'Asignación inicial del presupuesto total', 10, TRUE, 'presupuesto_obra'),
    ('MODIFICACION_PRESUPUESTO', 'Modificación de Presupuesto', 'financiero', 'presupuesto', 'Aumento o disminución del presupuesto', 10, TRUE, 'presupuesto_obra'),
    ('REGISTRO_COSTO', 'Registro de Gasto/Costo', 'financiero', 'ejercicio', 'Registro de un gasto específico de la obra', 9, TRUE, 'costos'),
    ('FINANCIAMIENTO_ASIGNADO', 'Asignación de Financiamiento', 'financiero', 'fuente', 'Vinculación de fuente presupuestaria', 9, TRUE, 'financia'),
    
    ('INFORME_AVANCE', 'Informe de Avance', 'tecnico', 'avance', 'Reporte mensual de avance físico y presupuestario', 8, TRUE, 'informes'),
    ('SUBIDA_IMAGEN', 'Evidencia Fotográfica', 'tecnico', 'evidencia', 'Carga de imagen como evidencia del avance', 6, TRUE, 'imagenes_informe'),
    ('EMISION_PERMISO', 'Emisión de Permiso', 'tecnico', 'tramite', 'Registro de permiso de instancia reguladora', 7, TRUE, 'permisos'),
    ('ACTA_ENTREGA', 'Acta de Entrega-Recepción', 'tecnico', 'cierre', 'Documento formal de entrega de la obra', 10, TRUE, 'acta_entrega'),
    
    ('PROPUESTA_REGISTRADA', 'Propuesta Ciudadana Registrada', 'ciudadano', 'participacion', 'Poblador registra propuesta de obra', 7, FALSE, 'propuestas_obras'),
    ('VOTO_EMITIDO', 'Voto Ciudadano Emitido', 'ciudadano', 'votacion', 'Poblador vota por una propuesta', 8, FALSE, 'votos_propuestas'),
    ('SELECCION_CONSTRUCTORA', 'Selección de Constructora', 'ciudadano', 'licitacion', 'Resultado del proceso de selección', 9, TRUE, 'opcion_seleccion'),
    
    ('INICIO_SESION', 'Inicio de Sesión', 'seguridad', 'acceso', 'Usuario accede al sistema', 4, FALSE, 'personal'),
    ('CAMBIO_ROL', 'Cambio de Rol/Privilegios', 'seguridad', 'permisos', 'Modificación de roles de usuario', 7, FALSE, 'personal');

-- ============================================================
-- 4. DIMENSIÓN OBRA (SCD Tipo 2 - Historial de cambios)
-- ============================================================
CREATE TABLE warehouse.dim_obra (
    obra_key            BIGSERIAL,
    obra_id             TEXT NOT NULL,               
    
    codigo_expediente   TEXT NOT NULL,
    nombre_obra         TEXT NOT NULL,
    descripcion         TEXT,
    etapa               SMALLINT,
    etapa_nombre        VARCHAR(50),                 
    estado              BOOLEAN,
    estado_nombre       VARCHAR(20),                 
    fecha_inicio        DATE,
    fecha_final         DATE,
    fecha_final_real    DATE,                        
    duracion_programada_dias INTEGER,                
    beneficiarios       TEXT,
    
    constructora_key    BIGINT,
    region_key          BIGINT,
    supervisor_key      BIGINT,
    
    fecha_efectiva      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_expiracion    TIMESTAMPTZ NOT NULL DEFAULT '9999-12-31'::TIMESTAMPTZ,
    es_actual           BOOLEAN NOT NULL DEFAULT TRUE,
    motivo_cambio       TEXT,                        
    
    creado_en           TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (obra_key)
);

CREATE INDEX idx_dim_obra_obra_id ON warehouse.dim_obra(obra_id);
CREATE INDEX idx_dim_obra_actual ON warehouse.dim_obra(obra_id, es_actual) WHERE es_actual = TRUE;

-- ============================================================
-- 5. DIMENSIÓN REGIÓN (SCD Tipo 2)
-- ============================================================
CREATE TABLE warehouse.dim_region (
    region_key          BIGSERIAL PRIMARY KEY,
    region_id           TEXT NOT NULL,
    
    comunidad           TEXT NOT NULL,
    barrio              TEXT NOT NULL,
    colonia             TEXT,
    
    fecha_efectiva      TIMESTAMPTZ DEFAULT NOW(),
    fecha_expiracion    TIMESTAMPTZ DEFAULT '9999-12-31'::TIMESTAMPTZ,
    es_actual           BOOLEAN DEFAULT TRUE,
    
    creado_en           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dim_region_id ON warehouse.dim_region(region_id);
CREATE INDEX idx_dim_region_actual ON warehouse.dim_region(region_id, es_actual) WHERE es_actual = TRUE;

-- ============================================================
-- 6. DIMENSIÓN CONSTRUCTORA (SCD Tipo 2)
-- ============================================================
CREATE TABLE warehouse.dim_constructora (
    constructora_key    BIGSERIAL PRIMARY KEY,
    constructora_id     TEXT NOT NULL,
    
    rfc                 TEXT,
    nombre_const        TEXT NOT NULL,
    tipo_ejecutor       TEXT NOT NULL,
    
    -- SCD Tipo 2
    fecha_efectiva      TIMESTAMPTZ DEFAULT NOW(),
    fecha_expiracion    TIMESTAMPTZ DEFAULT '9999-12-31'::TIMESTAMPTZ,
    es_actual           BOOLEAN DEFAULT TRUE,
    
    creado_en           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dim_constructora_id ON warehouse.dim_constructora(constructora_id);
CREATE INDEX idx_dim_constructora_actual ON warehouse.dim_constructora(constructora_id, es_actual) WHERE es_actual = TRUE;

-- ============================================================
-- 7. DIMENSIÓN PERSONAL (SCD Tipo 2)
-- ============================================================
CREATE TABLE warehouse.dim_personal (
    personal_key        BIGSERIAL PRIMARY KEY,
    personal_id         TEXT NOT NULL,
    
    nombre_completo     TEXT NOT NULL,
    rol                 VARCHAR(50) NOT NULL,
    es_supervisor       BOOLEAN DEFAULT FALSE,
    es_proyectista      BOOLEAN DEFAULT FALSE,
    es_director         BOOLEAN DEFAULT FALSE,
    es_secretario       BOOLEAN DEFAULT FALSE,
    
    empresa             TEXT,
    constructora_asignada TEXT,
    
    telefono            TEXT,
    
    fecha_efectiva      TIMESTAMPTZ DEFAULT NOW(),
    fecha_expiracion    TIMESTAMPTZ DEFAULT '9999-12-31'::TIMESTAMPTZ,
    es_actual           BOOLEAN DEFAULT TRUE,
    
    creado_en           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dim_personal_id ON warehouse.dim_personal(personal_id);
CREATE INDEX idx_dim_personal_actual ON warehouse.dim_personal(personal_id, es_actual) WHERE es_actual = TRUE;
CREATE INDEX idx_dim_personal_rol ON warehouse.dim_personal(rol);

-- ============================================================
-- 8. DIMENSIÓN FUENTE PRESUPUESTARIA (SCD Tipo 1 - Último valor)
-- ============================================================
CREATE TABLE warehouse.dim_fuente (
    fuente_key          SERIAL PRIMARY KEY,
    fuente_id           TEXT NOT NULL UNIQUE,
    
    grado_nivel         TEXT NOT NULL,
    programa            TEXT NOT NULL,
    
    -- Métricas acumuladas
    total_obras_financiadas INTEGER DEFAULT 0,
    monto_total_asignado NUMERIC(15,2) DEFAULT 0,
    
    creado_en           TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dim_fuente_programa ON warehouse.dim_fuente(programa);

-- ============================================================
-- 9. DIMENSIÓN PRESUPUESTO (SCD Tipo 2)
-- ============================================================
CREATE TABLE warehouse.dim_presupuesto (
    presupuesto_key     BIGSERIAL PRIMARY KEY,
    presupuesto_id      TEXT NOT NULL,
    
    presupuesto_total   NUMERIC(15,2) NOT NULL,
    proyectista_key     BIGINT,                   
    
    fecha_efectiva      TIMESTAMPTZ DEFAULT NOW(),
    fecha_expiracion    TIMESTAMPTZ DEFAULT '9999-12-31'::TIMESTAMPTZ,
    es_actual           BOOLEAN DEFAULT TRUE,
    
    creado_en           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dim_presupuesto_id ON warehouse.dim_presupuesto(presupuesto_id);
CREATE INDEX idx_dim_presupuesto_actual ON warehouse.dim_presupuesto(presupuesto_id, es_actual) WHERE es_actual = TRUE;

-- ============================================================
-- 10. DIMENSIÓN POBLADOR (SCD Tipo 2)
-- ============================================================
CREATE TABLE warehouse.dim_poblador (
    poblador_key        BIGSERIAL PRIMARY KEY,
    poblador_id         INTEGER NOT NULL,
    
    nombre_completo     TEXT NOT NULL,
    comunidad           TEXT NOT NULL,
    curp                TEXT,
    
    fecha_efectiva      TIMESTAMPTZ DEFAULT NOW(),
    fecha_expiracion    TIMESTAMPTZ DEFAULT '9999-12-31'::TIMESTAMPTZ,
    es_actual           BOOLEAN DEFAULT TRUE,
    
    creado_en           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dim_poblador_id ON warehouse.dim_poblador(poblador_id);

-- ============================================================
-- 11. DIMENSIÓN PROPUESTA (SCD Tipo 2)
-- ============================================================
CREATE TABLE warehouse.dim_propuesta (
    propuesta_key       BIGSERIAL PRIMARY KEY,
    propuesta_id        INTEGER NOT NULL,
    
    titulo              TEXT NOT NULL,
    region              TEXT NOT NULL,
    descripcion_obra    TEXT,
    descripcion_beneficiados TEXT,
    pros_comunidad      TEXT,
    anio_convocatoria   INTEGER,
    poblador_key        BIGINT,                    
    
    fecha_efectiva      TIMESTAMPTZ DEFAULT NOW(),
    fecha_expiracion    TIMESTAMPTZ DEFAULT '9999-12-31'::TIMESTAMPTZ,
    es_actual           BOOLEAN DEFAULT TRUE,
    
    creado_en           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dim_propuesta_id ON warehouse.dim_propuesta(propuesta_id);

-- ============================================================
-- 12. TABLA DE HECHOS: EVENTOS DE AUDITORÍA (Central)
-- ============================================================
CREATE TABLE warehouse.fact_eventos_auditoria (
    evento_key          BIGSERIAL,
    
    tiempo_key          INTEGER NOT NULL REFERENCES warehouse.dim_tiempo(tiempo_key),
    tipo_evento_key     INTEGER NOT NULL REFERENCES warehouse.dim_tipo_evento(tipo_evento_key),
    obra_key            BIGINT REFERENCES warehouse.dim_obra(obra_key),
    region_key          BIGINT REFERENCES warehouse.dim_region(region_key),
    personal_key        BIGINT REFERENCES warehouse.dim_personal(personal_key),    -- Quién ejecutó la acción
    constructora_key    BIGINT REFERENCES warehouse.dim_constructora(constructora_key),
    fuente_key          INTEGER REFERENCES warehouse.dim_fuente(fuente_key),
    presupuesto_key     BIGINT REFERENCES warehouse.dim_presupuesto(presupuesto_key),
    poblador_key        BIGINT REFERENCES warehouse.dim_poblador(poblador_key),
    propuesta_key       BIGINT REFERENCES warehouse.dim_propuesta(propuesta_key),
    

    monto_presupuesto   NUMERIC(15,2),            
    monto_costo         NUMERIC(15,2),            
    monto_ejercido      NUMERIC(15,2),            
    
    porcentaje_avance_fisico SMALLINT,
    porcentaje_avance_presup SMALLINT,
    dias_transcurridos  INTEGER,                  
    
    total_votos         INTEGER,
    votos_periodo       INTEGER,
    
    dias_desde_evento_anterior INTEGER,            
    
    es_evento_inicial   BOOLEAN DEFAULT FALSE,     
    es_evento_final     BOOLEAN DEFAULT FALSE,     
    requiere_atencion   BOOLEAN DEFAULT FALSE,    
    
    descripcion_evento  TEXT,
    documento_referencia TEXT,                   
    url_evidencia       TEXT,                    
    
    ip_address          INET,
    user_agent          TEXT,
    usuario_db          TEXT DEFAULT CURRENT_USER,
    
    session_id          TEXT,
    
    PRIMARY KEY (tiempo_key, evento_key)
) PARTITION BY RANGE (tiempo_key);

CREATE TABLE warehouse.fact_eventos_auditoria_2024 
    PARTITION OF warehouse.fact_eventos_auditoria
    FOR VALUES FROM (20240101) TO (20250101);
    
CREATE TABLE warehouse.fact_eventos_auditoria_2025 
    PARTITION OF warehouse.fact_eventos_auditoria
    FOR VALUES FROM (20250101) TO (20260101);
    
CREATE TABLE warehouse.fact_eventos_auditoria_2026 
    PARTITION OF warehouse.fact_eventos_auditoria
    FOR VALUES FROM (20260101) TO (20270101);

CREATE INDEX idx_fact_eventos_obra ON warehouse.fact_eventos_auditoria(obra_key);
CREATE INDEX idx_fact_eventos_tipo ON warehouse.fact_eventos_auditoria(tipo_evento_key);
CREATE INDEX idx_fact_eventos_personal ON warehouse.fact_eventos_auditoria(personal_key);
CREATE INDEX idx_fact_eventos_categoria ON warehouse.fact_eventos_auditoria(tipo_evento_key, tiempo_key);

-- ============================================================
-- 13. TABLA DE HECHOS: ACUMULADOS POR OBRA (Snapshot mensual)
-- ============================================================
CREATE TABLE warehouse.fact_obra_mensual (
    tiempo_key          INTEGER NOT NULL REFERENCES warehouse.dim_tiempo(tiempo_key),
    obra_key            BIGINT NOT NULL REFERENCES warehouse.dim_obra(obra_key),
    
    presupuesto_total   NUMERIC(15,2),
    costo_acumulado     NUMERIC(15,2),
    saldo_presupuesto   NUMERIC(15,2),
    porcentaje_ejercido NUMERIC(5,2),
    
    avance_fisico_acumulado SMALLINT,
    avance_presup_acumulado SMALLINT,
    
    dias_retraso        INTEGER,                   
    informes_registrados INTEGER,
    imagenes_evidencia  INTEGER,
    permisos_obtenidos  INTEGER,
    
    tiene_retraso       BOOLEAN,
    tiene_alertas       BOOLEAN,
    
    PRIMARY KEY (tiempo_key, obra_key)
);

CREATE INDEX idx_fact_obra_mensual_obra ON warehouse.fact_obra_mensual(obra_key);
CREATE INDEX idx_fact_obra_mensual_retraso ON warehouse.fact_obra_mensual(tiene_retraso) WHERE tiene_retraso = TRUE;


