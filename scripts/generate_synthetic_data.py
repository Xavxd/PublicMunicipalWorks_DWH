"""
Generador de Datos Sintéticos para el Sistema de Obras Públicas
Temascaltepec, Estado de México
"""
import random
import json
from datetime import datetime, timedelta
from faker import Faker
import psycopg2
from psycopg2.extras import execute_values

# Configuración
fake = Faker('es_MX')  # Datos en español de México
random.seed(42)  # Para reproducibilidad
fake.seed_instance(42)

# Configuración de la base de datos (ajusta según tu entorno)
DB_CONFIG = {
    'dbname': 'obras_publicas',
    'user': 'postgres',
    'password': 'tu_password',
    'host': 'localhost',
    'port': '5432'
}

# ============================================================
# DATOS BASE REALISTAS DE TEMASCALTEPEC
# ============================================================

COMUNIDADES_TEMASCALTEPEC = [
    'Temascaltepec de González', 'San Juan de las Huertas', 'San José Ixtapan',
    'San Diego del Nichi', 'San Francisco Oxtotilpan', 'San Lucas',
    'San Pedro de los Baños', 'Santa Ana Zicatecoyan', 'Santa María Nativitas',
    'Santiago Tlacotepec', 'El Carmen', 'La Ciénega', 'El Rincón',
    'La Cofradía', 'El Cerrito', 'La Presa', 'El Aguacate', 'La Estancia',
    'El Capulín', 'La Laguna', 'El Ocote', 'La Palmilla', 'El Potrero',
    'La Raya', 'El Salto', 'La Soledad', 'El Tule', 'La Venta',
    'El Zapote', 'Los Alamos', 'Los Arrayanes', 'Los Cedros',
    'Los Pinos', 'Rancho Viejo', 'San Agustín', 'San Antonio',
    'San Bartolo', 'San Cristóbal', 'San Felipe', 'San Isidro',
    'San José', 'San Miguel', 'San Nicolás', 'San Pablo',
    'San Pedro', 'San Rafael', 'San Sebastián', 'Santa Cruz',
    'Santa Elena', 'Santa Fe', 'Santa Lucía', 'Santa Rosa',
    'Santiago', 'Santo Domingo', 'Valle de Bravo'
]

BARRIOS = [
    'Centro', 'La Loma', 'El Barrio', 'La Cruz', 'San Miguel',
    'La Esperanza', 'El Progreso', 'La Unión', 'El Triunfo', 'La Paz'
]

NOMBRES_OBRAS = [
    'Pavimentación de calle', 'Construcción de muro de contención',
    'Rehabilitación de camino rural', 'Construcción de drenaje pluvial',
    'Ampliación de red de agua potable', 'Construcción de escuela primaria',
    'Remodelación de plaza principal', 'Construcción de centro de salud',
    'Mejoramiento de vivienda', 'Construcción de cancha deportiva',
    'Instalación de alumbrado público', 'Construcción de puente peatonal',
    'Rehabilitación de edificio municipal', 'Construcción de mercado municipal',
    'Pavimentación de avenida principal', 'Construcción de sistema de alcantarillado',
    'Remodelación de parque', 'Construcción de biblioteca pública',
    'Mejoramiento de camino vecinal', 'Construcción de módulo de salud'
]

CONSTRUCTORAS = [
    'Constructora del Valle S.A. de C.V.', 'Obras y Proyectos México S.A.',
    'Infraestructura Moderna S.A. de C.V.', 'Constructora Toluca S.A.',
    'Edificaciones del Estado S.A. de C.V.', 'Proyectos Urbanos México S.A.',
    'Constructora Temascaltepec S.A. de C.V.', 'Obras Públicas Avanzadas S.A.',
    'Infraestructura Rural S.A. de C.V.', 'Constructora del Altiplano S.A.'
]

FUENTES_FINANCIAMIENTO = [
    {'id': 'FISM-2024', 'grado': 'Federal', 'programa': 'FISM'},
    {'id': 'FORTAMUN-2024', 'grado': 'Federal', 'programa': 'FORTAMUN'},
    {'id': 'RAMO-33-2024', 'grado': 'Federal', 'programa': 'Ramo 33'},
    {'id': 'ESTATAL-2024', 'grado': 'Estatal', 'programa': 'Fondo Estatal'},
    {'id': 'MUNICIPAL-2024', 'grado': 'Municipal', 'programa': 'Recursos Propios'}
]

ROLES_PERSONAL = ['Director', 'Supervisor', 'Proyectista', 'Secretario']

# ============================================================
# FUNCIONES DE GENERACIÓN
# ============================================================

def generar_dimensiones(conn):
    """Genera todas las dimensiones del warehouse"""
    cur = conn.cursor()
    
    print("Generando dim_tiempo...")
    # Generar dim_tiempo (2024-2025)
    fecha_inicio = datetime(2024, 1, 1)
    fecha_fin = datetime(2025, 12, 31)
    fecha_actual = fecha_inicio
    
    while fecha_actual <= fecha_fin:
        tiempo_key = int(fecha_actual.strftime('%Y%m%d'))
        cur.execute("""
            INSERT INTO warehouse.dim_tiempo 
            (tiempo_key, fecha, anio, trimestre, mes, mes_nombre, mes_nombre_corto,
             dia, dia_semana, dia_nombre, dia_nombre_corto, dia_del_anio,
             semana_del_anio, es_fin_de_semana, es_dia_habil,
             periodo_fiscal, es_electoral, es_cierre_ejercicio)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (tiempo_key) DO NOTHING
        """, (
            tiempo_key,
            fecha_actual.date(),
            fecha_actual.year,
            (fecha_actual.month - 1) // 3 + 1,
            fecha_actual.month,
            fecha_actual.strftime('%B').capitalize(),
            fecha_actual.strftime('%b').capitalize(),
            fecha_actual.day,
            fecha_actual.isoweekday(),
            fecha_actual.strftime('%A').capitalize(),
            fecha_actual.strftime('%a').capitalize(),
            fecha_actual.timetuple().tm_yday,
            fecha_actual.isocalendar()[1],
            fecha_actual.isoweekday() >= 6,
            1 <= fecha_actual.isoweekday() <= 5,
            f"{fecha_actual.year}-{fecha_actual.year + 1}",
            False,
            fecha_actual.month == 12 and fecha_actual.day == 31
        ))
        fecha_actual += timedelta(days=1)
    
    print("Generando dim_region...")
    # Generar dim_region
    for comunidad in COMUNIDADES_TEMASCALTEPEC:
        for barrio in random.sample(BARRIOS, 3):  # 3 barrios por comunidad
            region_id = f"REG-{comunidad[:3].upper()}-{barrio[:3].upper()}"
            cur.execute("""
                INSERT INTO warehouse.dim_region (region_id, comunidad, barrio)
                VALUES (%s, %s, %s)
                ON CONFLICT (region_id) DO NOTHING
            """, (region_id, comunidad, barrio))
    
    print("Generando dim_constructora...")
    # Generar dim_constructora
    for i, nombre in enumerate(CONSTRUCTORAS, 1):
        constructora_id = f"CONST-{i:03d}"
        cur.execute("""
            INSERT INTO warehouse.dim_constructora 
            (constructora_id, rfc, nombre_const, tipo_ejecutor)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (constructora_id) DO NOTHING
        """, (constructora_id, fake.rfc(), nombre, random.choice(['Privada', 'Pública'])))
    
    print("Generando dim_personal...")
    # Generar dim_personal
    for i in range(50):  # 50 empleados
        personal_id = f"PER-{i+1:03d}"
        rol = random.choice(ROLES_PERSONAL)
        cur.execute("""
            INSERT INTO warehouse.dim_personal 
            (personal_id, nombre_completo, rol, es_supervisor, es_proyectista, es_director, es_secretario)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (personal_id) DO NOTHING
        """, (
            personal_id,
            fake.name(),
            rol,
            rol == 'Supervisor',
            rol == 'Proyectista',
            rol == 'Director',
            rol == 'Secretario'
        ))
    
    print("Generando dim_fuente...")
    # Generar dim_fuente
    for fuente in FUENTES_FINANCIAMIENTO:
        cur.execute("""
            INSERT INTO warehouse.dim_fuente (fuente_id, grado_nivel, programa)
            VALUES (%s, %s, %s)
            ON CONFLICT (fuente_id) DO NOTHING
        """, (fuente['id'], fuente['grado'], fuente['programa']))
    
    print("Generando dim_tipo_evento...")
    # dim_tipo_evento ya está poblada por el DDL, verificar
    cur.execute("SELECT COUNT(*) FROM warehouse.dim_tipo_evento")
    count = cur.fetchone()[0]
    if count == 0:
        print("⚠️  dim_tipo_evento está vacía. Ejecuta primero el DDL del warehouse.")
    
    conn.commit()
    print("✓ Dimensiones generadas correctamente")


def generar_obras(conn, num_obras=1247):
    """Genera obras públicas sintéticas"""
    cur = conn.cursor()
    
    print(f"Generando {num_obras} obras públicas...")
    
    obras_data = []
    for i in range(1, num_obras + 1):
        obra_id = f"OBRA-{i:04d}"
        codigo_expediente = f"EXP-{2024}-{i:04d}"
        nombre_obra = f"{random.choice(NOMBRES_OBRAS)} #{i}"
        descripcion = fake.paragraph(nb_sentences=2)
        etapa = random.randint(1, 5)
        estado = random.random() > 0.15  # 85% activas
        
        # Fechas realistas
        fecha_inicio = fake.date_between(start_date=datetime(2024, 1, 1), end_date=datetime(2025, 6, 1))
        duracion_dias = random.randint(90, 730)
        fecha_final = fecha_inicio + timedelta(days=duracion_dias)
        
        # Claves foráneas (obtener de dimensiones existentes)
        cur.execute("SELECT region_key FROM warehouse.dim_region ORDER BY RANDOM() LIMIT 1")
        region_key = cur.fetchone()[0]
        
        cur.execute("SELECT constructora_key FROM warehouse.dim_constructora ORDER BY RANDOM() LIMIT 1")
        constructora_key = cur.fetchone()[0]
        
        cur.execute("SELECT personal_key FROM warehouse.dim_personal WHERE es_supervisor = TRUE ORDER BY RANDOM() LIMIT 1")
        supervisor_key = cur.fetchone()[0]
        
        # Insertar en tabla operacional (simulada)
        cur.execute("""
            INSERT INTO public.obra 
            (id_obra, codigo_expediente, nombre_obra, descripcion, etapa, estado,
             fecha_inicio, fecha_final, id_region, id_constructora, codigo_supervisor)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 
                    (SELECT region_id FROM warehouse.dim_region WHERE region_key = %s),
                    (SELECT constructora_id FROM warehouse.dim_constructora WHERE constructora_key = %s),
                    (SELECT personal_id FROM warehouse.dim_personal WHERE personal_key = %s))
            ON CONFLICT (id_obra) DO NOTHING
            RETURNING id_obra
        """, (
            obra_id, codigo_expediente, nombre_obra, descripcion, etapa, estado,
            fecha_inicio, fecha_final, region_key, constructora_key, supervisor_key
        ))
        
        if cur.fetchone():
            obras_data.append({
                'obra_id': obra_id,
                'presupuesto': random.uniform(100000, 5000000)
            })
    
    conn.commit()
    print(f"✓ {len(obras_data)} obras generadas")
    return obras_data


def generar_eventos_auditoria(conn, obras_data, num_eventos=8934):
    """Genera eventos de auditoría sintéticos"""
    cur = conn.cursor()
    
    print(f"Generando {num_eventos} eventos de auditoría...")
    
    # Obtener tipos de evento
    cur.execute("SELECT tipo_evento_key, codigo_evento FROM warehouse.dim_tipo_evento")
    tipos_evento = cur.fetchall()
    
    eventos_generados = 0
    for obra in obras_data:
        # Cada obra tiene entre 5 y 15 eventos
        num_eventos_obra = random.randint(5, 15)
        
        for _ in range(num_eventos_obra):
            if eventos_generados >= num_eventos:
                break
            
            tipo_evento_key, codigo_evento = random.choice(tipos_evento)
            
            # Tiempo aleatorio entre 2024-2025
            fecha_evento = fake.date_between(start_date=datetime(2024, 1, 1), end_date=datetime(2025, 12, 31))
            tiempo_key = int(fecha_evento.strftime('%Y%m%d'))
            
            # Métricas financieras
            monto_presupuesto = random.uniform(100000, 5000000) if codigo_evento in ['REGISTRO_PRESUPUESTO', 'MODIFICACION_PRESUPUESTO'] else None
            monto_costo = random.uniform(10000, 500000) if codigo_evento == 'REGISTRO_COSTO' else None
            
            # Avance físico
            porcentaje_avance = random.randint(0, 100) if codigo_evento == 'INFORME_AVANCE' else None
            
            # Insertar evento
            cur.execute("""
                INSERT INTO warehouse.fact_eventos_auditoria
                (tiempo_key, tipo_evento_key, obra_key,
                 monto_presupuesto, monto_costo, porcentaje_avance_fisico,
                 descripcion_evento, es_evento_inicial, es_evento_final)
                VALUES (
                    %s, %s,
                    (SELECT obra_key FROM warehouse.dim_obra WHERE obra_id = %s AND es_actual = TRUE),
                    %s, %s, %s, %s, %s, %s
                )
            """, (
                tiempo_key, tipo_evento_key, obra['obra_id'],
                monto_presupuesto, monto_costo, porcentaje_avance,
                f"Evento {codigo_evento} generado sintéticamente",
                codigo_evento == 'CREACION_OBRA',
                codigo_evento == 'ACTA_ENTREGA'
            ))
            
            eventos_generados += 1
    
    conn.commit()
    print(f"✓ {eventos_generados} eventos de auditoría generados")


def generar_snapshot_mensual(conn, obras_data):
    """Genera snapshots mensuales de obras"""
    cur = conn.cursor()
    
    print("Generando snapshots mensuales...")
    
    meses = [(2024, i) for i in range(1, 13)] + [(2025, i) for i in range(1, 13)]
    
    for obra in obras_data:
        for anio, mes in meses:
            tiempo_key = anio * 10000 + mes * 100 + 1
            
            # Calcular métricas simuladas
            meses_transcurridos = (anio - 2024) * 12 + (mes - 1)
            avance_fisico = min(100, meses_transcurridos * random.randint(3, 8))
            avance_presup = min(100, meses_transcurridos * random.randint(4, 9))
            
            presupuesto_total = obra['presupuesto']
            costo_acumulado = presupuesto_total * (avance_presup / 100)
            saldo = presupuesto_total - costo_acumulado
            
            dias_retraso = random.randint(-30, 120)  # Puede estar adelantada o retrasada
            
            cur.execute("""
                INSERT INTO warehouse.fact_obra_mensual
                (tiempo_key, obra_key, presupuesto_total, costo_acumulado,
                 saldo_presupuesto, porcentaje_ejercido, avance_fisico_acumulado,
                 avance_presup_acumulado, dias_retraso, informes_registrados,
                 imagenes_evidencia, permisos_obtenidos, tiene_retraso)
                VALUES (
                    %s,
                    (SELECT obra_key FROM warehouse.dim_obra WHERE obra_id = %s AND es_actual = TRUE),
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (tiempo_key, obra_key) DO NOTHING
            """, (
                tiempo_key, obra['obra_id'],
                presupuesto_total, costo_acumulado, saldo,
                (costo_acumulado / presupuesto_total * 100) if presupuesto_total > 0 else 0,
                avance_fisico, avance_presup, dias_retraso,
                random.randint(0, meses_transcurridos),
                random.randint(0, meses_transcurridos * 3),
                random.randint(0, 5),
                dias_retraso > 60
            ))
    
    conn.commit()
    print("✓ Snapshots mensuales generados")


def generar_pobladores_y_propuestas(conn, num_pobladores=2341, num_propuestas=2156):
    """
    Genera ciudadanos registrados (pobladores) y sus propuestas de obra.
    Esto es necesario para generar votos posteriormente.
    """
    cur = conn.cursor()
    
    print(f"Generando {num_pobladores} ciudadanos registrados...")
    
    # Generar pobladores
    pobladores_ids = []
    for i in range(num_pobladores):
        cur.execute("""
            INSERT INTO public.pobladores (nombre, apellidos, comunidad, username, password_hash, curp)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            fake.first_name(),
            fake.last_name() + " " + fake.last_name(),
            random.choice(COMUNIDADES_TEMASCALTEPEC),
            f"poblador_{i+1}",
            "$2b$12$LQv3c1yqBwMZTn1Zq3q3qO7q3q3q3q3q3q3q3q3q3q3q3q3q3q3q",  # Hash de "poblador123"
            fake.rfc()[:18]  # CURP simulado
        ))
        poblador_id = cur.fetchone()[0]
        pobladores_ids.append(poblador_id)
    
    print(f"✓ {num_pobladores} ciudadanos generados")
    
    print(f"Generando {num_propuestas} propuestas ciudadanas...")
    
    propuestas_ids = []
    for i in range(num_propuestas):
        poblador_id = random.choice(pobladores_ids)
        cur.execute("""
            INSERT INTO public.propuestas_obras 
            (poblador_id, titulo, region, descripcion_obra, descripcion_beneficiados, pros_comunidad, anio_convocatoria)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            poblador_id,
            fake.sentence(nb_words=6),
            random.choice(COMUNIDADES_TEMASCALTEPEC),
            fake.paragraph(nb_sentences=3),
            fake.paragraph(nb_sentences=2),
            fake.paragraph(nb_sentences=2),
            random.choice([2023, 2024, 2025])
        ))
        propuesta_id = cur.fetchone()[0]
        propuestas_ids.append(propuesta_id)
    
    conn.commit()
    print(f"✓ {num_propuestas} propuestas generadas")
    
    return pobladores_ids, propuestas_ids


def generar_votos_propuestas(conn, pobladores_ids, propuestas_ids, num_votos=8934):
    """
    Genera votos de ciudadanos para las propuestas de obra.
    Cada ciudadano puede votar múltiples veces en diferentes períodos.
    """
    cur = conn.cursor()
    
    print(f"Generando {num_votos} votos ciudadanos...")
    
    periodos_voto = ['2024-1', '2024-2', '2025-1', '2025-2']
    votos_generados = 0
    
    # Combinaciones únicas de (poblador, propuesta, período)
    combinaciones_usadas = set()
    
    while votos_generados < num_votos:
        poblador_id = random.choice(pobladores_ids)
        propuesta_id = random.choice(propuestas_ids)
        periodo = random.choice(periodos_voto)
        
        # Evitar votos duplicados (un ciudadano no puede votar 2 veces por la misma propuesta en el mismo período)
        combinacion = (poblador_id, propuesta_id, periodo)
        if combinacion in combinaciones_usadas:
            continue
        
        combinaciones_usadas.add(combinacion)
        
        cur.execute("""
            INSERT INTO public.votos_propuestas (poblador_id, propuesta_id, periodo_voto)
            VALUES (%s, %s, %s)
        """, (poblador_id, propuesta_id, periodo))
        
        votos_generados += 1
        
        # Registrar evento de auditoría para cada voto
        fecha_voto = fake.date_between(start_date=datetime(2024, 1, 1), end_date=datetime(2025, 12, 31))
        tiempo_key = int(fecha_voto.strftime('%Y%m%d'))
        
        cur.execute("""
            INSERT INTO warehouse.fact_eventos_auditoria
            (tiempo_key, tipo_evento_key, obra_key, poblador_key, propuesta_key,
             descripcion_evento, es_evento_inicial, es_evento_final)
            VALUES (
                %s,
                (SELECT tipo_evento_key FROM warehouse.dim_tipo_evento WHERE codigo_evento = 'VOTO_EMITIDO'),
                NULL,
                %s,
                %s,
                %s,
                FALSE,
                FALSE
            )
        """, (
            tiempo_key,
            poblador_id,
            propuesta_id,
            f"Voto emitido por poblador {poblador_id} para propuesta {propuesta_id}"
        ))
    
    conn.commit()
    print(f"✓ {num_votos} votos generados")


# ============================================================
# EJECUCIÓN PRINCIPAL
# ============================================================

def main():
    print("=" * 70)
    print("GENERADOR DE DATOS SINTÉTICOS - OBRAS PÚBLICAS TEMASCALTEPEC")
    print("=" * 70)
    print("\n⚠️  ADVERTENCIA: Este script genera datos SINTÉTICOS para fines")
    print("   académicos y de demostración. Los datos NO son reales.\n")
    
    try:
        # Conectar a la base de datos
        print("Conectando a la base de datos...")
        conn = psycopg2.connect(**DB_CONFIG)
        print("✓ Conexión establecida\n")
        
        # Generar dimensiones
        generar_dimensiones(conn)
        
        # Generar obras
        obras_data = generar_obras(conn, num_obras=1247)
        
        # Generar eventos de auditoría
        generar_eventos_auditoria(conn, obras_data, num_eventos=8934)
        
        # Generar snapshots mensuales
        generar_snapshot_mensual(conn, obras_data)
        
        # Generar ciudadanos, propuestas y votos
        pobladores_ids, propuestas_ids = generar_pobladores_y_propuestas(
            conn, 
            num_pobladores=2341,
            num_propuestas=2156
        )
        
        # Generar votos (8,934 votos para mantener consistencia con eventos de auditoría)
        generar_votos_propuestas(
            conn,
            pobladores_ids,
            propuestas_ids,
            num_votos=8934
        )
        
        print("\n" + "=" * 70)
        print("✓ GENERACIÓN COMPLETADA EXITOSAMENTE")
        print("=" * 70)
        print("\n📊 Resumen de datos generados:")
        print("   - 1,247 obras públicas")
        print("   - 8,934 eventos de auditoría")
        print("   - 2,341 ciudadanos registrados")
        print("   - 2,156 propuestas ciudadanas")
        print("   - 8,934 votos emitidos en procesos participativos")
        print("   - Snapshots mensuales (2024-2025)")
        print("   - Dimensiones completas")
        print("\n Los datos son SINTÉTICOS y reproducibles.")
        print("   Ejecuta este script nuevamente para regenerar los mismos datos.\n")
        
        conn.close()
        
    except psycopg2.Error as e:
        print(f"\n❌ Error de base de datos: {e}")
        print("\n💡 Solución: Verifica la configuración en DB_CONFIG")
    except Exception as e:
        print(f"\n❌ Error inesperado: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
