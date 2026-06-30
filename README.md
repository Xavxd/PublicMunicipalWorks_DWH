⚠️ Sistema de Información — Dirección de Obras Públicas de Temascaltepec

> **Alumnos:** González Casiano Uriel  Maldonado Mejia Marco Tulio

> **Docente:** Hurtado Avilés Gabriel · ESCOM · IPN  
> **Materia:** Bases de Datos · Grupo 3CV2 · Turno Vespertino  
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
