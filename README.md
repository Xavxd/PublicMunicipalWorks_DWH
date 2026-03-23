⚠️ Sistema Integral de Gestión de Obras Públicas

H. Ayuntamiento de Temascaltepec, Estado de México
Este sistema es una plataforma web robusta diseñada para la administración, supervisión y transparencia de la infraestructura pública. Permite el control total del ciclo de vida de una obra: desde la planeación presupuestal hasta la entrega final.

🏗️ Arquitectura del Proyecto
El proyecto sigue una arquitectura de Single Page Application (SPA) simulada mediante el manejo de paneles dinámicos y persistencia de datos en el lado del cliente.

Frontend: HTML5, CSS3 (Custom Properties, Flexbox, Grid) y JavaScript Vanila (ES6+).

Diseño: Interfaz de alto impacto visual con estética "Dark Mode", efectos de cristalería (Glassmorphism) y un sistema de partículas de ruido.

Persistencia: LocalStorage para datos globales (obras, presupuestos) y SessionStorage para el control de sesiones de usuario.

Contenedores: Configurado para desplegarse mediante Podman/Docker para asegurar la paridad de entornos.

🛠️ Lógica de Negocio por Roles
El sistema se divide en 4 niveles de acceso, cada uno con una lógica programática específica:

1. Director de Obras (Nivel Directivo)
Gestión Global: Creación y edición de expedientes de obra.

Control de Constructoras: Catálogo de contratistas (Ayuntamiento vs. Privadas).

Asignación de Recursos: Vinculación de obras con fuentes de financiamiento (FISM, FORTAMUN).

Lógica JS: Maneja el filtrado masivo de datos y el cálculo de estadísticas generales en tiempo real.

2. Proyectista (Nivel Técnico)
Ingeniería de Costos: Interfaz para el desglose de conceptos (Materiales, Mano de Obra, Equipo).

Cálculos Automáticos: El script proyectista.js calcula subtotales por categoría e importes totales de forma reactiva.

Resumen Ejecutivo: Generación de gráficos de barras dinámicos según el peso porcentual de cada gasto.

3. Supervisor (Nivel Operativo)
Bitácora de Avance: Registro de informes mensuales con validación de fechas.

Control de Avance: Uso de sliders sincronizados para representar el avance físico vs. financiero.

Gestión de Evidencia: Lógica para adjuntar y visualizar archivos/fotografías de la obra.

4. Secretaría (Nivel Administrativo)
Documentación: Gestión de oficios de permisos y actas de entrega.

Validación: Asegura que la obra cumpla con los requisitos legales antes de cerrarse en el sistema.

💻 Detalles Técnicos Relevantes

Sistema de Sesiones
La autenticación es simulada mediante un objeto de configuración en main.js. Al iniciar sesión, se genera un token en sessionStorage:
Incluye un usuario por cada uno de los ingresos. 


EJEMPLOS DEL DESGLOSE DE LA SESION:

<img width="1835" height="883" alt="image" src="https://github.com/user-attachments/assets/9550f1a7-8405-47f0-b1f0-5e7c14395137" />
<img width="1835" height="883" alt="image" src="https://github.com/user-attachments/assets/0446ed60-43ba-403d-b29e-efa5553e7199" />

