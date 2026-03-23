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

JavaScript
sessionStorage.setItem('op_user', JSON.stringify({ role: 'director', ... }));
Cada página interna cuenta con un Auth Guard que redirige al index.html si el rol no coincide o la sesión no existe.

Cursor Personalizado y UX
Se implementó un sistema de cursor dual (punto + seguidor) que utiliza requestAnimationFrame para un movimiento fluido. Los elementos interactivos activan una transformación de escala (scale(2.5)) para mejorar la retroalimentación visual.

Estructura de Datos (JSON)
El sistema utiliza un esquema relacional simulado en objetos JSON:

op_obras: Contiene el ID, expediente, presupuesto base y supervisor asignado.

op_presupuestos: Indexado por obraId, contiene el desglose de costos del proyectista.

op_informes: Histórico de reportes del supervisor.

🚀 Instalación y Despliegue
Requisitos
Servidor web (Nginx, Apache) o extensión "Live Server" en VS Code.

Navegador moderno (soporte para CSS Grid y ES6).

Ejecución con Podman
Bash
# Construir la imagen
podman build -t sistema-obras .

# Ejecutar el contenedor
podman run -d -p 8080:80 --name gestor-obras sistema-obras
📂 Estructura de Archivos
Plaintext
├── css/
│   ├── main.css        # Estilos globales y tokens de diseño
│   ├── director.css    # Estilos específicos del panel directivo
│   └── ...
├── js/
│   ├── main.js         # Lógica de login y cursor
│   ├── director.js     # Lógica de gestión de obras
│   └── ...
├── director/           # Vistas de nivel directivo
├── supervisor/         # Vistas de nivel operativo
└── index.html          # Punto de entrada y login
