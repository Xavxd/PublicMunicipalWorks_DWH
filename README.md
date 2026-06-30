⚠️ Sistema de Información — Dirección de Obras Públicas de Temascaltepec

> **Alumnos:** González Casiano Uriel  Maldonado Mejia Marco Tulio

> **Docente:** Hurtado Avilés Gabriel · ESCOM · IPN  
> **Carrera:** Ingeniería en Sistemas Computacionales · Semestre 2026-1

CASO DE ESTUDIO: 

H. Ayuntamiento de Temascaltepec, Estado de México
Este sistema es una plataforma web robusta diseñada para la administración, supervisión y transparencia de la infraestructura pública. Permite el control total del ciclo de vida de una obra: desde la planeación presupuestal hasta la entrega final.

---

### 🛠️ Tecnologías
* **Frontend:** HTML5, CSS3 (Custom Properties, Flexbox, Grid) y JavaScript Vanilla (ES6+)
* **Persistencia:** SessionStorage para control de sesiones y LocalStorage para datos de usuario
* **Diseño:** Estética Dark Mode con efectos Glassmorphism y sistema de partículas animadas (Canvas API)
* **Deploy:** Configurado para contenedores Podman/Docker

## Stack tecnológico
 
| Capa | Tecnología |
|---|---|
| Lenguaje | Python 3.11 |
| Framework | Flask 3.0 |
| ORM | Flask-SQLAlchemy 3.1 / SQLAlchemy 2.0 |
| Base de datos | PostgreSQL (Supabase) |

---

### 🚀 Características Principales

**🏛️ Director de Obras (Nivel Directivo)**
- Creación y edición de expedientes de obra con wizard multi-paso
- Catálogo de constructoras (Ayuntamiento vs. Privadas)
- Vinculación de obras con fuentes de financiamiento (FISM, FORTAMUN)
- Filtrado masivo y cálculo de estadísticas generales en tiempo real

**📐 Proyectista (Nivel Técnico)**
- Desglose de conceptos de costo: Materiales, Mano de Obra y Equipo
- Cálculo automático y reactivo de subtotales e importes totales
- Generación de gráficos de barras dinámicos por categoría de gasto

**📋 Supervisor (Nivel Operativo)**
- Bitácora de avance con registro de informes mensuales y validación de fechas
- Sliders sincronizados para representar avance físico vs. financiero

**🗂️ Secretaría (Nivel Administrativo)**
- Gestión de oficios de permisos y actas de entrega
- Validación de requisitos legales previo al cierre de obra en el sistema
- Desglose de tareas de recursos humanos, adjuntando personal: Proyectistas, Supervisores y Secretariado
- Registro de concursos de selección por obra.

## Seguridad
 
- **Autenticación ligera:** cada request envía `X-User-Role` y `X-User-Id` en headers; el decorador `@require_auth` valida el rol antes de ejecutar cada ruta.
- **Contraseñas:** almacenadas como hash PBKDF2-SHA256 con salt de 16 bytes.
---

### 📂 Estructura del Proyecto Frontend 
```
├── index.html                  # Landing page y portal de acceso por rol
├── main.js                     # Lógica de routing, animaciones y autenticación
├── css/
│   ├── main.css                # Estilos globales y tema Dark Mode
│   ├── director.css            # Estilos del panel directivo
│   ├── proyectista.css         # Estilos del módulo técnico
│   ├── supervisor.css          # Estilos del módulo operativo
│   └── secretaria.css          # Estilos del módulo administrativo
├── js/
│   ├── api_client.js           # Cliente HTTP genérico con headers de autenticación
│   └── cables.js               # Animación de circuitos eléctricos (Canvas)
├── director/
│   ├── director.html           # Panel del Director de Obras
│   └── director.js             # Gestión de expedientes, constructoras y presupuestos
├── proyectista/
│   ├── proyectista.html        # Panel del Proyectista
│   └── proyectista.js          # Cálculo de costos y generación de gráficos
├── supervisor/
│   ├── supervisor.html         # Panel del Supervisor
│   └── supervisor.js           # Bitácora de avance y gestión de evidencias
└── secretaria/
    ├── secretaria.html         # Panel de Secretaría
    └── secretaria.js           # Gestión documental y validación legal
```
## Estructura de archivos Backend 
 
```
backend/
├── run.py                        # Punto de entrada
├── requirements.txt
├── runtime.txt                   # Python 3.11.9
├── app/
│   ├── __init__.py               # create_app(), registro de blueprints
│   ├── database.py               # SQLAlchemy init, get_db()
│   ├── models.py                 # Modelos ORM (ver abajo)
│   ├── helpers.py                # Respuestas HTTP estándar + require_fields()
│   └── password_security.py     # hash_password / verify_password
└── routes/
    ├── decorators.py             # @require_auth(*roles)
    ├── auth.py                   # POST /api/auth/login
    ├── director.py               # Constructoras, Regiones, Obras, Fuentes, Concursos
    ├── secretaria.py             # Permisos, Actas, Concursos, Personal
    ├── supervisor.py             # Informes (CRUD + agrupado por obra)
    ├── proyectista.py            # Presupuesto por obra, Costos
    └── public.py                 # Endpoints públicos (mapa ciudadano)
```
# Testeo del Proyecto

## 🚀 Funcionalidad: 
 
De manera general, puedes acceder a cada uno de los roles predispustos, pero no puedes ralizar acciones directas sobre la base de datos. Esto con algunos usuarios de prueba: 

### Usuarios de prueba:

| Rol | Usuario | Contraseña |
| :--- | :--- | :--- |
| Director | demo_director | DemoDir2026! |
| Supervisor | demo_supervisor | DemoSup2026! |
| Secretaria | demo_secretaria | DemoSec2026! |
| Proyectista | demo_proyectista | DemoPry2026! |

---

<details>
<summary>🖼️ Ver capturas de pantalla</summary>

## Capturas de pantalla

| |
|---|
| <img src="https://github.com/user-attachments/assets/a7211f15-710e-4fb1-9d7c-1a958ef3ef00" alt="Login" width="800"/> |
| <img src="https://github.com/user-attachments/assets/b5bb340e-b40b-4dfd-897b-470650f917bb" alt="Panel Director" width="800"/> | 
| <img src="https://github.com/user-attachments/assets/23371366-a686-4380-b19d-f824d35d0318"  alt="Secretaría" width="800"/> |
| <img src="https://github.com/user-attachments/assets/e8666f39-f4c0-4145-a052-ae1e20134768" alt="Supervisor" width="800"/> | 
| <img src="https://github.com/user-attachments/assets/0882b394-dd75-4959-bf74-e664175cbf17" alt="Proyectista" width="800"/> |
| <img src="https://github.com/user-attachments/assets/8cf06dce-4605-4345-9d42-7dda3d9832ae" alt="Mapa Público DEMO" width="800"/> |

</details>
---

<details>
<summary>🖼️ Ver Diagramas</summary>

## Diagrama Relacional

| |
|---|
| <img src="https://github.com/user-attachments/assets/28638031-7d27-42f3-b2b1-c932fb207ef6" alt="Login" width="800"/> |



## Diagrama Entidad Rel. Etendido


| |
|---|
| <img src="https://github.com/user-attachments/assets/303c37e3-4fe9-4cfe-9b74-7f442f51541a" alt="Login" width="800"/> |


</details>
---

 ## 🚀 Rendimiento (Lighthouse)

Los resultados de las auditorías de rendimiento se generan automáticamente con [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/) en cada despliegue.

### General

| Métrica | Valor | Umbral |
|---------|-------|--------|
| Rendimiento | 88 | ≥ 85 |
| Accesibilidad | 88 | ≥ 85 |
| Prácticas recomendadas | 100 | ≥ 98 |
| SEO | 90 | ≥ 90 |

### Mapa Interactivo 

| Métrica | Valor | Umbral |
|---------|-------|--------|
| Performance | 96 | ≥ 95 |
| Accessibility | 96 | ≥ 95 |
| Best Practices | 100 | ≥ 98 |
| SEO | 92 | ≥ 90 |

&gt; **Última ejecución:** 2026-06-22  
&gt; **Entorno:** Chrome 125, Mobile, 4G simulado

### 🔗 Enlaces de versión static del proyecto: 
A continuación, se detalla el enlace para esquemas de emulado del proyecto:

- [**Entorno de Pruebas (Demo)**](https://urigc.github.io/Obras_Pub/): Interactúa con la versión en vivo del proyecto y prueba las funcionalidades.

Usuarios de Prueba: 

| Usuario | Contraseña | Rol |
| :--- | :--- | :---: |
| `director`    | `admin123`    | Director de Obras      |
| `supervisor`  | `admin123`    | Supervisor de Obra     |
| `proyectista` | `admin123`    | Proyectista            |
| `secretario`  | `admin123`    | Secretaría             |
| `supervisor2` | `admin123`    | Supervisor (adicional) |
| `poblador1`   | `poblador123` | Ciudadano / Poblador   |
| `poblador2`   | `poblador123` | Ciudadano / Poblador   |

------------

# 🏗️ Sistema Lakehouse para Monitoreo de Obras Públicas Municipales

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-green.svg)](https://www.python.org/)

Arquitectura **Lakehouse** para transparencia y auditoría en tiempo real de obras públicas. Integra Data Lake (Cloudflare R2) + Data Warehouse dimensional (PostgreSQL) bajo API REST única.

## 📊 Data Warehouse Dimensional

**Modelo dimensional en estrella** con:

### Dimensiones (10 tablas)
- `dim_tiempo` (SCD 0) - Período calendario
- `dim_obra` (SCD 2) - Historial completo de obras
- `dim_region` (SCD 2) - Comunidad/barrio
- `dim_constructora` (SCD 2) - Empresas constructoras
- `dim_personal` (SCD 2) - Personal DOP
- `dim_presupuesto` (SCD 2) - Partidas presupuestales
- `dim_poblador` (SCD 2) - Ciudadanos registrados
- `dim_propuesta` (SCD 2) - Propuestas ciudadanas
- `dim_fuente` (SCD 0) - Fuentes de financiamiento
- `dim_tipo_evento` (SCD 0) - Catálogo 17 tipos de evento

### Tablas de Hechos (2 tablas)
- `fact_eventos_auditoria` - Eventos de auditoría particionados por año (2024-2026)
- `fact_obra_mensual` - Snapshot mensual de obras

**SCD Tipo 2:** Las dimensiones críticas mantienen historial mediante `fecha_efectiva`, `fecha_expiracion`, `es_actual`, permitiendo reconstruir el estado exacto de cualquier obra en cualquier momento.

### Vistas Analíticas (5)
- `v_obras_retraso` - Obras con retraso
- `v_alertas_auditoria` - Alertas por severidad
- `v_avance_comparativo` - Avance físico vs financiero
- `v_participacion_ciudadana` - Votos y propuestas por región
- `v_ejercicio_presupuestario` - Ejecución por fuente

## 🗃️ Data Lake

**Cloudflare R2** (S3-compatible) con estructura hive-partitioned:
obras/{id_obra}/reportes/{año}-{mes}/{timestamp}_{slug}.{ext}


**Métricas:**
- ~3,421 objetos almacenados (12.7 GB)
- 78% imágenes (JPG/PNG), 22% documentos (PDF)
- Crecimiento: ~287 objetos/mes

**Integración bidireccional:** Metadatos sincronizados con warehouse en `imagenes_informe` (URL pública, tipo MIME, tamaño, fecha).

## 🔄 Diagrama del esquema Warehouse
<details>
<summary>🖼️ Ver Diagrama</summary>

| |
|---|
| <img src="https://github.com/user-attachments/assets/344539ce-9b3a-44cb-9ce9-7a986e456e57" alt="Login" width="800"/> |

</details>

## 🗄️ Estructura de la Base de Datos

La carpeta `db/arquitectura/` contiene los scripts SQL que definen la arquitectura completa del sistema:

| Archivo | Descripción |
|---------|-------------|
| `DDLBASESObpub.sql` | Esquema de la base de datos operacional (tablas: `obra`, `informes`, `costos`, `personal`, `constructora`, etc.) |
| `ESQUEMA DEL DATA WAREHOUSE.sql` | Definición del Data Warehouse dimensional: esquema en estrella con 10 dimensiones (SCD 0/1/2) y 2 tablas de hechos particionadas |
| `FUNCIONES Y TRIGGERS.sql` | Funciones PL/pgSQL y triggers para sincronización automática ETL desde tablas operacionales al warehouse (SCD Tipo 2) |

**Nota**: El warehouse se mantiene actualizado automáticamente mediante triggers que capturan cambios en las tablas operacionales y los reflejan en las dimensiones y tablas de hechos.

## Reporte de Benchmark - Sistema Lakehouse Obras Públicas

---

## 📊 Benchmark, Rendimiento y Reproducibilidad

Para garantizar la transparencia académica y la reproducibilidad de los resultados, las pruebas de rendimiento se documentan bajo un entorno controlado. 

> **⚠️ Nota sobre la naturaleza de los datos:** 
> Coherente con las políticas de privacidad de datos gubernamentales, las métricas de este benchmark se obtuvieron utilizando un **dataset sintético** (generado vía `scripts/generate_synthetic_data.py` con `Faker` y `seed=42`). El volumen (~11,000 tuplas) y la estructura replican exactamente la carga real del municipio, permitiendo que cualquier investigador replique las pruebas sin comprometer datos sensibles.

### 1. Entorno de Pruebas

| Componente | Especificación Técnica |
| :--- | :--- |
| **Servidor API (Backend)** | Render Free Tier (CPU compartida, 512 MB RAM, región `us-east-1`). |
| **Base de Datos** | Supabase Free Tier (PostgreSQL 14, 500 MB RAM). |
| **Data Lake** | Cloudflare R2 (Almacenamiento de objetos S3-compatible). |
| **Equipo Cliente (Carga)** | Dell Latitude 7420, Intel Core i7-1185G7 (4 núcleos), 32 GB RAM DDR4. |
| **Red Cliente** | 100 Mbps simétricos, latencia promedio de 25 ms al servidor. |

### 2. Herramientas y Metodología

Se utilizaron tres enfoques complementarios para medir el sistema:

*   **Carga HTTP (API REST):** Se utilizó **Locust v2.20.0**. Configuración: 50 usuarios concurrentes, *spawn rate* de 2 usuarios/seg, duración de 3 minutos por corrida. Se realizaron 3 corridas independientes y se reportó el percentil 95 (p95).
*   **Consultas Analíticas (SQL):** Se utilizó **PostgreSQL `EXPLAIN ANALYZE`** y `psql \timing`. Se promediaron 10 ejecuciones consecutivas de las vistas materializadas con el caché de sesión limpio.
*   **Triggers SCD Tipo 2:** Se midió el tiempo de transacción completo (`INSERT` en tabla operacional + disparo de trigger + cierre de versión histórica + registro en tabla de hechos) mediante bloques `DO` en PL/pgSQL (100 iteraciones).

### 3. Resultados (Percentil 95)

| Métrica Evaluada | Valor | Unidad |
| :--- | :---: | :---: |
| Tiempo de respuesta endpoint `/api/public/obras` | 187 | ms |
| Tiempo de carga inicial del mapa (Frontend) | 1.42 | s |
| Tiempo de carga galería fotográfica (4 imgs desde R2) | 543 | ms |
| Throughput soportado (Consultas por segundo) | 127 | req/s |
| Ejecución de vista analítica `v_obras_retraso` | 89 | ms |
| Inserción con trigger SCD Tipo 2 (Auditoría) | 34 | ms |
| Latencia de lectura de metadatos (Data Lake R2) | 112 | ms |

### 4. Cómo Replicar las Pruebas

Cualquier revisor o investigador puede reproducir estas métricas clonando el repositorio y ejecutando los scripts de benchmark contra su propia instancia local o contra la demo publicada:

## BASH
### 1. Clonar y preparar entorno
git clone https://github.com/Urigc/Obras_publicas.git
cd Obras_publicas
pip install -r backend/requirements.txt
pip install locust  # Herramienta de carga

### 2. Poblar base de datos local con datos sintéticos reproducibles
python scripts/generate_synthetic_data.py

### 3. Ejecutar pruebas de carga HTTP (Genera reporte CSV y HTML)
cd scripts/load_testing
./run_benchmarks.sh http://localhost:5000

### 4. Ejecutar benchmarks de Base de Datos (Vistas y Triggers)
psql -U postgres -d obras_publicas -f ../sql_benchmarks/test_views_performance.sql
psql -U postgres -d obras_publicas -f ../sql_benchmarks/test_triggers_scd2.sql

## 📊 Datos del Proyecto

**⚠️ IMPORTANTE**: Los datos de este repositorio son **SINTÉTICOS** y fueron generados exclusivamente con fines académicos y de demostración. No representan datos reales de obras públicas.

### Generación de Datos

Los datos fueron generados utilizando el script `scripts/generate_synthetic_data.py` con la librería [Faker](https://faker.readthedocs.io/) para Python.

### Método de Generación

| Característica | Detalle |
| :--- | :--- |
| **Librería** | [Faker](https://github.com/joke2k/faker) para Python |
| **Seed** | 42 (reproducible) |
| **Script** | `scripts/generate_synthetic_data.py` |
| **Locale** | `es_MX` (español de México) |

---

### Volumen de Datos Generados

A continuación se detalla el desglose de registros generados por cada entidad del sistema, así como la estrategia o criterio utilizado para su población:

| Entidad | Cantidad | Método / Criterio |
| :--- | :--- | :--- |
| **Obras públicas** | 1,247 | Nombres y descripciones generados con Faker. |
| **Eventos de auditoría** | 8,934 | Distribuidos aleatoriamente entre obras. |
| **Comunidades** | 55 | Basadas en comunidades reales de Temascaltepec. |
| **Constructoras** | 10 | Nombres ficticios de empresas mexicanas. |
| **Personal** | 50 | Nombres mexicanos generados con Faker. |
| **Dimensiones temporales** | 731 días | Período 2024-2025. |
| **Imágenes/documentos** | ~1,000 | Metadatos sintéticos (sin archivos reales). |

---

### Instrucciones de Uso

1. **Garantizar la Reproducibilidad:** Al mantener el valor de la semilla (`Seed: 42`), cualquier ejecución posterior del script `generate_synthetic_data.py` producirá exactamente el mismo conjunto de registros.
2. **Localización:** La configuración regional `es_MX` asegura que los nombres de personas, constructoras, formatos de fechas y textos descriptivos mantengan plena coherencia con el contexto mexicano.

**Para regenerar los datos:**

### BASH
#### Instalar dependencias
pip install faker psycopg2-binary

#### Ejecutar el script
python scripts/generate_synthetic_data.py

#### Generar dataset sintético de obras de Temascaltepec
python scripts/evaluacion/generar_dataset_obras.py

#### Ejecutar evaluación
python scripts/evaluacion/eval_deteccion_anomalias.py

### 📦 Scripts de Carga de Datos

El proyecto cuenta con **dos scripts de generación de datos sintéticos**, cada uno con un propósito específico:

| Script | Propósito | Salida |
|--------|-----------|--------|
| scripts/generate_synthetic_data.py | **Poblado general del warehouse**: genera dimensiones, obras, eventos de auditoría y snapshots mensuales para pruebas de rendimiento y benchmarks del sistema completo. | Base de datos PostgreSQL poblada (~11,000 tuplas) |
| scripts/evaluacion/generar_dataset_obras.py | **Dataset específico para evaluación del Cuadro 5**: genera ~1,247 obras con anomalías inyectadas (15%) para evaluar el módulo de detección contra Isolation Forest. | datos_sinteticos/obras_temascaltepec.json |

**Nota**: Ambos scripts usan `Faker` con `seed=42` para garantizar reproducibilidad. Los datos son sintéticos y no representan información real del municipio.


<div align="center">
  <table>
    <tr>
      <td align="center">
        <a href="https://ipn-683d754b.mintlify.app/" target="_blank">
          <img src="https://img.shields.io/badge/ACCEDER_A_LA-DOCUMENTACIÓN-green?style=for-the-badge&logo=render&logoColor=white" />
          <br>
          <sub>Clic aquí para abrir la aplicación en una pestaña nueva</sub>
        </a>
      </td>
    </tr>
  </table>
</div>
