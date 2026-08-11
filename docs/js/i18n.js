/* =====================================================================
   i18n.js — español/inglés para la demostración publicada.

   Sigue la convención del artefacto del almacén de agua
   (github.com/gabrielhuav/Data_Warehouse_static): la preferencia vive en
   localStorage junto al tema y al modo, el script se carga en el <head>
   sin defer para fijar el idioma antes del primer pintado, y al cambiar
   emite 'idiomacambiado' sobre document.

   Diferencia con aquel sitio: aquí la interfaz no la escribimos nosotros,
   viene del prototipo original y buena parte se genera desde JavaScript
   (tablas de obras, informes, tarjetas de propuestas). Anotar cada nodo
   con data-i18n obligaría a tocar cinco mil líneas heredadas y volvería a
   quedar incompleto en cuanto una vista se repintara. Por eso el motor
   traduce por frase: un diccionario de cadenas completas más un puñado de
   patrones para las plantillas con variables, aplicado a los nodos de
   texto y a los atributos visibles, y mantenido por un MutationObserver
   para que lo que dibuje la aplicación quede traducido también.

   El español es la lengua de origen: si una frase no está en el
   diccionario se muestra tal cual, de modo que una traducción incompleta
   nunca deja un hueco en la interfaz.
   ===================================================================== */
(function () {
  'use strict';

  var K_IDIOMA = 'obras-idioma';
  var IDIOMAS = [
    { id: 'es', etiqueta: 'ES', nombre: 'Español' },
    { id: 'en', etiqueta: 'EN', nombre: 'English' }
  ];
  var LOCALE = { es: 'es-MX', en: 'en-US' };

  /* ------------------------------------------------------------------
     Claves con nombre. Se usan para el <title>, la metadescripción y los
     textos que generan los controles de la cabecera.
     ------------------------------------------------------------------ */
  var CLAVES = {
    es: {
      'titulo.index': 'Sistema de Obras Públicas — H. Ayuntamiento Temascaltepec',
      'titulo.director': 'Director de Obras — Panel de Gestión',
      'titulo.supervisor': 'Supervisor — Informes de Obra',
      'titulo.proyectista': 'Proyectista — Presupuesto de Obra',
      'titulo.secretaria': 'Secretaría — Obras Públicas Temascaltepec',
      'titulo.mapa': 'Mapa Inteligente de Obras Públicas — H. Ayuntamiento de Temascaltepec',
      'barra.tema': 'Tema de color',
      'barra.idioma': 'Idioma',
      'tema.original': 'Original',
      'tema.guinda': 'Guinda',
      'modo.claro': 'Modo claro',
      'modo.oscuro': 'Modo oscuro',
      'modo.cambiar': '{modo} — clic para cambiar',
      'idioma.cambiar': 'Ver el sitio en {nombre}',
      'galeria.foto': 'Foto {numero} de {total}',
      'galeria.anterior': 'Anterior',
      'galeria.siguiente': 'Siguiente',
      'galeria.cerrar': 'Cerrar',
      'galeria.abrir': 'Abrir galería de {titulo}',
      'galeria.alt': 'Foto {numero} de {total} de {titulo}',
      'galeria.altAntes': 'Foto {numero} de {total} de {titulo}, antes de la obra',
      'mapa.marcador': 'Obra pública — abrir ficha técnica',
      'galeria.vista': 'Estado de la obra',
      'galeria.antes': 'Antes',
      'galeria.despues': 'Después',
      'galeria.noDisponible': 'Imagen no disponible'
    },
    en: {
      'titulo.index': 'Public Works System — Temascaltepec Municipality',
      'titulo.director': 'Works Director — Management Panel',
      'titulo.supervisor': 'Supervisor — Works Reports',
      'titulo.proyectista': 'Budget Planner — Works Budget',
      'titulo.secretaria': 'Records Office — Temascaltepec Public Works',
      'titulo.mapa': 'Smart Map of Public Works — Municipality of Temascaltepec',
      'barra.tema': 'Colour theme',
      'barra.idioma': 'Language',
      'tema.original': 'Original',
      'tema.guinda': 'Guinda',
      'modo.claro': 'Light mode',
      'modo.oscuro': 'Dark mode',
      'modo.cambiar': '{modo} — click to change',
      'idioma.cambiar': 'View this site in {nombre}',
      'galeria.foto': 'Photo {numero} of {total}',
      'galeria.anterior': 'Previous',
      'galeria.siguiente': 'Next',
      'galeria.cerrar': 'Close',
      'galeria.abrir': 'Open gallery for {titulo}',
      'galeria.alt': 'Photo {numero} of {total} of {titulo}',
      'galeria.altAntes': 'Photo {numero} of {total} of {titulo}, before the work',
      'mapa.marcador': 'Public work — open technical card',
      'galeria.vista': 'State of the work',
      'galeria.antes': 'Before',
      'galeria.despues': 'After',
      'galeria.noDisponible': 'Image unavailable'
    }
  };

  /* ------------------------------------------------------------------
     Diccionario de frases completas. La clave es el español exacto, ya
     recortado de espacios. Los topónimos de Temascaltepec, los RFC, los
     identificadores y los nombres de usuario no aparecen aquí: son
     nombres propios o datos, no interfaz.
     ------------------------------------------------------------------ */
  var FRASES = {
    /* ---------------- portada: cabecera y hero ---------------- */
    'Obras Públicas': 'Public Works',
    'Anterior': 'Previous',
    'Siguiente': 'Next',
    'Cerrar': 'Close',
    'Imagen no disponible': 'Image unavailable',
    'H. Ayuntamiento de Temascaltepec': 'Municipality of Temascaltepec',
    'H. Ayuntamiento de Temascaltepec · Estado de México': 'Municipality of Temascaltepec · State of Mexico',
    'Sistema en línea': 'System online',
    '🗺️ Mapa Ciudadano': '🗺️ Citizen Map',
    'Sistema Integral de Gestión': 'Integrated Management System',
    'Dirección de': 'Directorate of',
    'Estado de México': 'State of Mexico',
    'Planos': 'Drawings',
    'Proyecto Arquitectónico': 'Architectural Design',
    'Sistema': 'System',
    'Panel de Control': 'Control Panel',
    'En progreso': 'In progress',
    'Obra Temascaltepec': 'Temascaltepec Works',
    'Acta oficial': 'Official record',
    'Documentación Pública': 'Public Documentation',
    'Plataforma digital para la administración, supervisión y transparencia de la':
      'Digital platform for the administration, supervision and transparency of the',
    'infraestructura pública de las comunidades de Temascaltepec.':
      'public infrastructure of the communities of Temascaltepec.',
    'Propuestas de la Comunidad': 'Community Proposals',

    /* ---------------- portada: acceso por rol ---------------- */
    'Acceso por Rol': 'Access by Role',
    'Selecciona tu perfil': 'Choose your working',
    'de trabajo': 'profile',
    'Cada rol cuenta con permisos específicos que garantizan la integridad y trazabilidad de la información pública.':
      'Each role carries specific permissions that safeguard the integrity and traceability of public information.',
    'Acceso abierto': 'Open access',
    'Entra con cualquiera de estas credenciales': 'Sign in with any of these credentials',
    /* Párrafos completos: el motor normaliza los espacios interiores, así
       que la clave es el párrafo entero en una línea, aunque en el HTML
       venga repartido en varias. */
    'Están publicadas a propósito: esta demostración no consulta ningún servidor y no guarda nada fuera de tu propia pestaña. Lo que registres se borra al cerrarla, y nadie más lo ve. El formulario admite además cualquier valor, incluso vacío.':
      'They are published on purpose: this demonstration queries no server and keeps nothing outside your own tab. Whatever you enter is discarded when you close the tab, and nobody else ever sees it. The form also accepts any other value, including an empty one.',
    'Las mismas cuentas existen en la API Flask de referencia (':
      'The same accounts exist in the reference Flask API (',
    '), donde el prefijo': '), where the prefix',
    'las restringe a sólo lectura. Reiniciar los datos de esta pestaña:':
      'restricts them to read-only. Reset the data in this tab:',
    'restablecer demostración': 'reset the demonstration',
    'Nivel Directivo': 'Executive Level',
    'Nivel Operativo': 'Operational Level',
    'Nivel Técnico': 'Technical Level',
    'Nivel Administrativo': 'Administrative Level',
    'Director de Obras': 'Works Director',
    'Supervisor': 'Supervisor',
    'Proyectista': 'Budget Planner',
    'Secretaría': 'Records Office',
    'Secretario': 'Records Officer',
    'Director': 'Director',
    'Registro y gestión completa de obras públicas, asignación de constructoras y supervisión general del sistema.':
      'Full registration and management of public works, contractor assignment and overall system oversight.',
    '✦ Registrar obras': '✦ Register works',
    '✦ Asignar constructoras': '✦ Assign contractors',
    '◈ Ver todos los datos': '◈ View all data',
    'Ingresar': 'Enter',
    'Generación de informes de avance mensual, registro de avances físicos y financieros de las obras asignadas.':
      'Monthly progress reporting, and recording of physical and financial progress for assigned works.',
    '✦ Crear informes': '✦ Create reports',
    '◈ Ver obra asignada': '◈ View assigned work',
    '✦ Registrar avances': '✦ Record progress',
    'Elaboración detallada del presupuesto de obra, desglose de costos por categoría con herramientas de cálculo integradas.':
      'Detailed preparation of the works budget, with cost breakdown by category and built-in calculation tools.',
    '✦ Crear presupuestos': '✦ Create budgets',
    '✦ Gestionar costos': '✦ Manage costs',
    '◈ Ver obras activas': '◈ View active works',
    'Registro de oficios de permisos institucionales y generación del Acta de Entrega con firma de todos los involucrados.':
      'Registration of institutional permit letters and issuance of the Handover Record signed by all parties.',
    '✦ Oficios de permisos': '✦ Permit letters',
    '✦ Acta de entrega': '✦ Handover record',
    '◈ Gestión documental': '◈ Document management',
    'Demo estática': 'Static demo',
    'OBRAS PÚBLICAS': 'PUBLIC WORKS',
    'Sistema Integral v1.0': 'Integrated System v1.0',
    'Datos protegidos bajo normativa federal': 'Data protected under federal regulations',

    /* ---------------- portada: modal de acceso ---------------- */
    'Acceso abierto.': 'Open access.',
    'Las credenciales de este rol ya vienen escritas y se muestran a la vista. Cualquier otro valor —o ninguno— también entra.':
      'This role’s credentials are already filled in and shown in plain sight. Any other value — or none at all — also gets you in.',
    'Usuario / Clave de acceso': 'User / Access key',
    'Contraseña': 'Password',
    'Tu clave de usuario': 'Your user key',
    'Contraseña pública del rol': 'Public password for this role',
    'Acceder al sistema': 'Enter the system',
    'Demostración sin servidor · H. Ayuntamiento Temascaltepec':
      'Serverless demonstration · Municipality of Temascaltepec',
    'Bienvenido, ': 'Welcome, ',
    'Demostración restablecida a los datos sintéticos iniciales.':
      'Demonstration reset to the initial synthetic data.',
    'No se pudo abrir la demostración.': 'The demonstration could not be opened.',
    'El módulo de demostración no se cargó. Recarga la página.':
      'The demonstration module did not load. Reload the page.',
    'No se pudo completar la operación en la demostración.':
      'The operation could not be completed in the demonstration.',

    /* ---------------- aviso de las páginas de rol ---------------- */
    'Demostración': 'Demonstration',
    'Acceso abierto y sin servidor. Puedes crear, editar y borrar libremente: los cambios viven sólo en esta pestaña y se descartan al cerrarla.':
      'Open access, no server. You may create, edit and delete freely: changes live only in this tab and are discarded when you close it.',
    'Volver al inicio': 'Back to home',
    'Regresar al inicio': 'Back to home',
    'Salir': 'Sign out',

    /* ---------------- director ---------------- */
    'Gestión': 'Management',
    'Nueva Obra': 'New Work',
    'Obras Registradas': 'Registered Works',
    'Constructoras': 'Contractors',
    'Consultas': 'Queries',
    'Fuentes Presupuestarias': 'Funding Sources',
    'Registrar Nueva Obra': 'Register a New Work',
    'El registro se realiza en tres pasos para garantizar la integridad de los datos.':
      'Registration runs in three steps to guarantee data integrity.',
    'Constructora': 'Contractor',
    'Región': 'Region',
    'Datos de Obra': 'Work Details',
    'Constructora Ejecutora de la Obra': 'Contractor Executing the Work',
    'Registra los datos completos de la empresa o entidad que ejecutará la obra. Esta información quedará vinculada de forma permanente al expediente.':
      'Record the full details of the company or body that will carry out the work. This information stays permanently linked to the case file.',
    'Nombre / Razón Social *': 'Name / Legal name *',
    'RFC *': 'Tax ID (RFC) *',
    'Formato: 3–4 letras + 6 números + 3 caracteres':
      'Format: 3–4 letters + 6 digits + 3 characters',
    'Tipo de Ejecutor *': 'Type of executor *',
    'Seleccionar tipo…': 'Select a type…',
    'Empresa Externa': 'External company',
    'Gobierno Municipal (ejecución propia)': 'Municipal government (in-house)',
    'Gobierno Municipal': 'Municipal government',
    'Organismo Público': 'Public body',
    'Cooperativa Local': 'Local cooperative',
    'Los datos se enviarán a la base de datos al presionar "Continuar"':
      'The data is submitted when you press “Continue”',
    'Registrar y Continuar': 'Register and continue',
    'Región y Comunidad de la Obra': 'Region and Community of the Work',
    'Especifica el área geográfica donde se ejecutará la obra. Los datos de región se almacenan de forma independiente para su reutilización.':
      'Specify the geographic area where the work will be carried out. Region records are stored independently so they can be reused.',
    'Comunidad / Localidad *': 'Community / Locality *',
    'Comunidad / Localidad': 'Community / Locality',
    'Barrio / Sección *': 'Neighbourhood / Section *',
    'Colonia (opcional)': 'Sub-district (optional)',
    'Regresar': 'Back',
    'Los datos de región se guardarán al continuar': 'The region is saved when you continue',
    'Datos Específicos de la Obra': 'Specific Details of the Work',
    'Nombre de la Obra *': 'Name of the work *',
    'Nombre de la Obra': 'Name of the work',
    'Etapa': 'Stage',
    'Etapa 1': 'Stage 1',
    'Etapa 2': 'Stage 2',
    'Etapa 3': 'Stage 3',
    'Etapa 4': 'Stage 4',
    'Supervisor Asignado *': 'Assigned supervisor *',
    'Cargando supervisores…': 'Loading supervisors…',
    'Seleccionar supervisor…': 'Select a supervisor…',
    'Error al cargar supervisores': 'Error loading supervisors',
    'Fecha de Inicio *': 'Start date *',
    'Fecha de Finalización *': 'Completion date *',
    'Presupuesto Total Asignado ($)': 'Total budget allocated ($)',
    'Fuentes de Financiamiento': 'Funding sources',
    'Agrega las fuentes que financian esta obra. Puedes agregar tantas como sean necesarias. Si una fuente ya existe en el sistema, el registro se reutilizará automáticamente.':
      'Add the sources funding this work. You may add as many as needed. If a source already exists in the system, the record is reused automatically.',
    'Nivel *': 'Level *',
    'Seleccionar…': 'Select…',
    'FEDERAL': 'FEDERAL',
    'ESTATAL': 'STATE',
    'MUNICIPAL': 'MUNICIPAL',
    'OTRO': 'OTHER',
    'Programa / Nombre de la Fuente *': 'Programme / Source name *',
    'Agregar': 'Add',
    'Aún no se ha agregado ninguna fuente. Usa el formulario de arriba.':
      'No source added yet. Use the form above.',
    'Descripción y Beneficiarios': 'Description and Beneficiaries',
    'Descripción general de la obra': 'General description of the work',
    'Beneficiarios *': 'Beneficiaries *',
    'Registrar Obra': 'Register work',
    'Historial completo de obras en el sistema.': 'Complete history of works in the system.',
    'Fecha Inicio': 'Start date',
    'Fecha Fin': 'End date',
    'Filtrar': 'Filter',
    'Limpiar': 'Clear',
    'Expediente': 'Case file',
    'Estado': 'Status',
    'Acciones': 'Actions',
    'Catálogo de Constructoras': 'Contractor Catalogue',
    'Empresas y entidades ejecutoras registradas en el sistema.':
      'Companies and executing bodies registered in the system.',
    'Cargando…': 'Loading…',
    'Cargando obras…': 'Loading works…',
    'Catálogo completo de fuentes de financiamiento registradas en el sistema.':
      'Complete catalogue of funding sources registered in the system.',
    'Activa': 'Active',
    'Inactiva': 'Inactive',
    'No hay obras registradas.': 'No works registered.',
    'Registrar primera obra': 'Register the first work',
    'No hay constructoras registradas.': 'No contractors registered.',
    'Reintentar': 'Retry',
    'Error al conectar con el servidor.': 'Could not reach the server.',
    'Constructora registrada': 'Contractor registered',
    'Región registrada': 'Region registered',
    '¡Obra registrada exitosamente!': 'Work registered successfully.',
    'Todos los campos son obligatorios': 'All fields are required',
    'Comunidad y barrio son campos obligatorios.': 'Community and neighbourhood are required.',
    'Completa todos los campos obligatorios marcados con *.':
      'Fill in every required field marked with *.',
    'La fecha de inicio debe ser anterior a la fecha de finalización.':
      'The start date must be earlier than the completion date.',
    'La fecha de inicio debe ser anterior o igual a la fecha de fin.':
      'The start date must be earlier than or equal to the end date.',
    'Debes completar el Paso 1: Constructora ejecutora.': 'Complete Step 1: executing contractor.',
    'Debes completar el Paso 2: Región de la obra.': 'Complete Step 2: region of the work.',
    'Selecciona el nivel de la fuente (Federal, Estatal, Municipal…)':
      'Select the level of the source (Federal, State, Municipal…)',
    'Escribe el nombre del programa o fuente presupuestaria.':
      'Type the name of the programme or budget source.',
    'Reutilizada': 'Reused',
    'Quitar de esta obra': 'Remove from this work',
    'No se encontraron comunidades': 'No communities found',

    /* ---------------- supervisor ---------------- */
    'Supervisor de Obra': 'Works Supervisor',
    'Mis Obras': 'My Works',
    'Obras Asignadas': 'Assigned Works',
    'Nuevo Informe': 'New Report',
    'Libro de Informes': 'Report Book',
    'Estas son las obras bajo tu supervisión.': 'These are the works under your supervision.',
    'Registrar Informe Mensual': 'Register Monthly Report',
    'Documentación del avance físico y financiero de la obra.':
      'Documentation of the physical and financial progress of the work.',
    'Identificación del Informe': 'Report Identification',
    'Obra *': 'Work *',
    'Obra': 'Work',
    'Seleccionar obra…': 'Select a work…',
    'Sin obras asignadas': 'No works assigned',
    'Año *': 'Year *',
    'Mes *': 'Month *',
    'Seleccionar mes…': 'Select a month…',
    'Enero': 'January',
    'Febrero': 'February',
    'Marzo': 'March',
    'Abril': 'April',
    'Mayo': 'May',
    'Junio': 'June',
    'Julio': 'July',
    'Agosto': 'August',
    'Septiembre': 'September',
    'Octubre': 'October',
    'Noviembre': 'November',
    'Diciembre': 'December',
    'Avances de la Obra': 'Progress of the Work',
    '% Avance Físico *': '% Physical progress *',
    '% Avance Financiero *': '% Financial progress *',
    'Avance físico': 'Physical progress',
    'Físico': 'Physical',
    'Financiero': 'Financial',
    'Contenido del Informe': 'Report Content',
    'Descripción del Avance *': 'Description of progress *',
    'Documento del Informe (URL)': 'Report document (URL)',
    'Enlace al documento del informe (PDF, DOC, etc.). Dejar vacío si no aplica.':
      'Link to the report document (PDF, DOC, etc.). Leave empty if not applicable.',
    'Evidencia Fotográfica del Avance': 'Photographic Evidence of Progress',
    'Adjuntar imágenes': 'Attach images',
    'Haz clic para seleccionar fotografías': 'Click to select photographs',
    'JPG o PNG — máximo 10 MB por imagen': 'JPG or PNG — 10 MB per image maximum',
    'Las imágenes se subirán al registrar el informe. Quedarán visibles en el mapa público para la ciudadanía.':
      'Images are uploaded when the report is registered. They stay visible on the public citizen map.',
    'Registrar Informe': 'Register report',
    'informes': 'reports',
    'informe': 'report',
    'Registrando...': 'Registering…',
    'Historial completo de informes registrados.': 'Complete history of registered reports.',
    'Todas las obras': 'All works',
    'No tienes obras asignadas aún.': 'You have no assigned works yet.',
    'El director de obras debe asignarte a una obra primero.':
      'The works director must assign you to a work first.',
    'No hay informes registrados aún.': 'No reports registered yet.',
    'Error al cargar obras.': 'Error loading works.',
    'Error al cargar informes.': 'Error loading reports.',
    'Verifica tu conexión.': 'Check your connection.',
    'Intenta de nuevo.': 'Try again.',
    'Error al cargar obras': 'Error loading works',
    'Selecciona una obra.': 'Select a work.',
    'Error al registrar el informe.': 'Error registering the report.',
    'Ver documento del informe': 'View report document',
    '📎 Ver documento del informe': '📎 View report document',
    'Eliminar imagen': 'Delete image',
    'Imagen eliminada.': 'Image deleted.',
    'No se pudo eliminar la imagen.': 'The image could not be deleted.',
    'Quitar': 'Remove',
    'Evidencia': 'Evidence',
    'Último avance:': 'Latest progress:',
    'físico': 'physical',
    'físico /': 'physical /',
    'financiero': 'financial',
    'Inicio': 'Start',
    'Región / Comunidad': 'Region / Community',
    'Período': 'Period',

    /* ---------------- proyectista ---------------- */
    'Presupuesto': 'Budget',
    'Seleccionar Obra': 'Select Work',
    'Editor de Costos': 'Cost Editor',
    'Resumen General': 'Overall Summary',
    'Trabajando en:': 'Working on:',
    'Elige la obra para elaborar o editar su presupuesto.':
      'Choose the work whose budget you want to prepare or edit.',
    'Editor de Presupuesto': 'Budget Editor',
    'Selecciona una obra primero.': 'Select a work first.',
    'Total estimado': 'Estimated total',
    '🧱 Materiales': '🧱 Materials',
    '👷 Mano de Obra': '👷 Labour',
    '🚜 Equipo': '🚜 Equipment',
    '📋 Costos Indirectos': '📋 Indirect Costs',
    '⚠️ Imprevistos': '⚠️ Contingencies',
    'Descripción del Concepto': 'Item description',
    'Descripción del concepto': 'Item description',
    'Unidad': 'Unit',
    'Unidad (m², kg, pza…)': 'Unit (m², kg, pcs…)',
    'Cantidad': 'Quantity',
    'Precio Unitario': 'Unit price',
    'Precio unitario ($)': 'Unit price ($)',
    'Importe': 'Amount',
    'Subtotal categoría': 'Category subtotal',
    'Limpiar categoría': 'Clear category',
    'Guardar Presupuesto': 'Save budget',
    'Resumen de Presupuesto': 'Budget Summary',
    'Total del presupuesto elaborado:': 'Total budget prepared:',
    'Vista consolidada de todos los costos por categoría.':
      'Consolidated view of every cost by category.',
    'Sin conceptos en esta categoría. Agrégalos abajo.':
      'No items in this category. Add them below.',
    'No hay obras registradas por el Director.': 'The Director has registered no works.',
    'Elaborar Presupuesto': 'Prepare budget',
    'Ver Resumen': 'View summary',
    '✓ Presupuesto elaborado': '✓ Budget prepared',
    'Error al cargar presupuesto.': 'Error loading the budget.',
    'Presupuesto guardado exitosamente.': 'Budget saved successfully.',
    'Error al guardar presupuesto.': 'Error saving the budget.',
    'Ingresa una descripción para el concepto.': 'Enter a description for the item.',
    'Selecciona una obra para ver su resumen.': 'Select a work to see its summary.',

    /* ---------------- secretaría ---------------- */
    'Secretaría ·': 'Records Office ·',
    'Módulo Documental': 'Document Module',
    'Gestión de': 'Management of',
    'Documentos Oficiales': 'Official Documents',
    'Registro de oficios de permisos, actas de entrega, concursos de selección de obra y personal institucional.':
      'Registration of permit letters, handover records, contractor selection processes and institutional staff.',
    'Permisos': 'Permits',
    'Actas': 'Records',
    'Concursos': 'Tenders',
    'Personal': 'Staff',
    'Oficios de Permisos': 'Permit Letters',
    'Actas de Entrega': 'Handover Records',
    'Concurso de Selección': 'Selection Tender',
    'Registro de Personal': 'Staff Registration',
    'Nuevo Oficio de Permiso': 'New Permit Letter',
    'Asociar permiso institucional a una obra': 'Link an institutional permit to a work',
    'Obra asociada *': 'Associated work *',
    'Instancia emisora *': 'Issuing authority *',
    'Nombre de la instancia': 'Name of the authority',
    'URL del oficio adjunto *': 'URL of the attached letter *',
    'Registrar Permiso': 'Register permit',
    'Oficios Registrados': 'Registered Letters',
    'Cargando oficios…': 'Loading letters…',
    'Aún no hay oficios registrados': 'No letters registered yet',
    'Registrado': 'Registered',
    'Eliminar': 'Delete',
    'Nueva Acta de Entrega': 'New Handover Record',
    'Cierre formal con todos los firmantes': 'Formal closure with every signatory',
    'Obra que se entrega *': 'Work being handed over *',
    'Fecha de expedición *': 'Date of issue *',
    'Firmantes obligatorios': 'Required signatories',
    'Cargo': 'Position',
    'Nombre(s)': 'First name(s)',
    'Apellido Paterno': 'Paternal surname',
    'Apellido Materno': 'Maternal surname',
    'Registrar Acta de Entrega': 'Register handover record',
    'Cargando actas…': 'Loading records…',
    'Aún no hay actas registradas': 'No handover records yet',
    'Firmantes registrados': 'Registered signatories',
    'Cerrada': 'Closed',
    'Registrar Participante': 'Register Participant',
    'Constructora en concurso de selección de obra': 'Contractor in the works selection tender',
    'Obra en concurso *': 'Work under tender *',
    'Nombre / Razón Social de la Constructora *': 'Name / Legal name of the contractor *',
    'Resultado de la evaluación *': 'Evaluation result *',
    'No aprobada': 'Not approved',
    'Aprobada / Ganadora': 'Approved / Winner',
    '✓ Aprobada': '✓ Approved',
    'Solo puede existir una constructora aprobada por obra.':
      'Only one contractor may be approved per work.',
    'Razones de la decisión *': 'Reasons for the decision *',
    'Participantes Registrados': 'Registered Participants',
    'Filtrar por obra:': 'Filter by work:',
    'Cargando concursos…': 'Loading tenders…',
    'Sin participantes registrados': 'No participants registered',
    'Nuevo Miembro de Personal': 'New Staff Member',
    'Registro de supervisor, proyectista o secretario':
      'Registration of a supervisor, budget planner or records officer',
    'Nombre *': 'First name *',
    'Apellido Paterno *': 'Paternal surname *',
    'Nombre de usuario *': 'Username *',
    'Contraseña *': 'Password *',
    'Rol *': 'Role *',
    '— Seleccionar rol —': '— Select a role —',
    'Constructora *': 'Contractor *',
    'Cargando constructoras…': 'Loading contractors…',
    '— Seleccionar constructora —': '— Select a contractor —',
    '— Seleccionar obra —': '— Select a work —',
    'Empresa asignada:': 'Assigned company:',
    'Teléfono *': 'Phone *',
    'Registrar Personal': 'Register staff',
    'Personal Registrado': 'Registered Staff',
    'Filtrar por rol:': 'Filter by role:',
    'Todos los roles': 'All roles',
    'Cargando personal…': 'Loading staff…',
    'Sin personal registrado': 'No staff registered',
    'No se pudieron cargar las obras activas.': 'Active works could not be loaded.',
    'No se pudieron cargar las constructoras.': 'Contractors could not be loaded.',
    'Completa los campos obligatorios: Obra, Instancia y Oficio.':
      'Fill in the required fields: Work, Authority and Letter.',
    'Permiso registrado correctamente.': 'Permit registered successfully.',
    'Error al registrar el permiso.': 'Error registering the permit.',
    'Oficio eliminado.': 'Letter deleted.',
    'Selecciona la obra y la fecha de expedición.': 'Select the work and the date of issue.',
    'Registra al menos 3 firmantes con nombre y apellido paterno.':
      'Register at least 3 signatories with a first name and paternal surname.',
    'Acta de entrega registrada correctamente.': 'Handover record registered successfully.',
    'Error al registrar el acta.': 'Error registering the handover record.',
    'Completa los campos obligatorios: Obra, Constructora y Razones.':
      'Fill in the required fields: Work, Contractor and Reasons.',
    'Error al registrar el participante.': 'Error registering the participant.',
    'Participante eliminado.': 'Participant deleted.',
    'Personal eliminado.': 'Staff member deleted.',
    'Completa los campos obligatorios: Nombre, Apellido Paterno, Usuario, Contraseña y Rol.':
      'Fill in the required fields: First name, Paternal surname, Username, Password and Role.',
    'Selecciona una constructora para el rol Proyectista.':
      'Select a contractor for the Budget Planner role.',
    'Ingresa el teléfono para el rol Supervisor.': 'Enter a phone number for the Supervisor role.',
    'Error al registrar el personal.': 'Error registering the staff member.',
    'Ese nombre de usuario ya existe.': 'That username already exists.',

    /* ---------------- presupuesto participativo ---------------- */
    'Sistema de Presupuesto Participativo': 'Participatory Budgeting System',
    'Presupuesto Participativo · Temascaltepec': 'Participatory Budgeting · Temascaltepec',
    'Visualiza las obras que tus vecinos sienten urgentes y suma tus 3 votos del cuatrimestre.':
      'See the works your neighbours consider urgent and cast your 3 votes for the period.',
    'Iniciar sesion / Registrarse': 'Sign in / Register',
    'Iniciar sesion': 'Sign in',
    'Trending del cuatrimestre': 'Trending this period',
    'Cercanas a ti': 'Near you',
    'Activar ubicacion': 'Enable location',
    'Permite el acceso a tu GPS para encontrar propuestas en tu micro-region de la sierra de Temascaltepec.':
      'Allow GPS access to find proposals in your micro-region of the Temascaltepec highlands.',
    'Todas las propuestas': 'All proposals',
    'Registrar nueva propuesta': 'Register a new proposal',
    'Beneficiados': 'Beneficiaries',
    'Pros para la comunidad': 'Benefits for the community',
    'Votos en el periodo': 'Votes this period',
    'Votar por esta propuesta': 'Vote for this proposal',
    'Ver detalles': 'View details',
    'Votar': 'Vote',
    'Crear cuenta': 'Create account',
    'Bienvenido de vuelta': 'Welcome back',
    'Nombre de usuario': 'Username',
    'Usuario': 'User',
    'Contrasena': 'Password',
    'Entrar': 'Sign in',
    'Da de alta tu cuenta': 'Set up your account',
    'Apellidos': 'Surnames',
    'Selecciona tu comunidad': 'Choose your community',
    'Verificacion CURP': 'CURP verification',
    'Ingresa tu CURP de 18 caracteres. Solo se aceptan registros de residentes del':
      'Enter your 18-character CURP. Only records for residents of the',
    'Estado de Mexico': 'State of Mexico',
    'Cabecera Municipal': 'Municipal Seat',
    'Titulo de la obra': 'Title of the work',
    'Selecciona la comunidad beneficiada': 'Choose the community that benefits',
    'Descripcion de la obra': 'Description of the work',
    'Personas beneficiadas': 'People who benefit',
    'Publicar propuesta': 'Publish proposal',
    'Volver al mapa': 'Back to the map',
    'Acceso': 'Access',
    'Cerrar': 'Close',
    'Propuesta': 'Proposal',
    'Inicia sesión para poder votar.': 'Sign in to vote.',
    'Voto registrado correctamente.': 'Vote recorded successfully.',
    'No pudimos registrar el voto.': 'We could not record the vote.',
    'No pudimos abrir el detalle.': 'We could not open the details.',
    'Captura usuario y contraseña.': 'Enter a username and password.',
    'Credenciales incorrectas.': 'Incorrect credentials.',
    'Ingresa tu CURP de 18 caracteres.': 'Enter your 18-character CURP.',
    'No pudimos crear la cuenta.': 'We could not create the account.',
    'Sesión cerrada.': 'Signed out.',
    'Tu propuesta fue publicada.': 'Your proposal was published.',
    'No pudimos registrar la propuesta.': 'We could not register the proposal.',
    'No pudimos cargar el listado. Intenta más tarde.':
      'We could not load the list. Try again later.',
    'No pudimos cargar las\n        propuestas cercanas. Intenta más tarde.':
      'We could not load nearby proposals. Try again later.',
    'No pudimos cargar el\n        carrusel de trending.': 'We could not load the trending carousel.',
    'No se pudo cargar el módulo. Recarga e intenta de nuevo.':
      'The module could not be loaded. Reload and try again.',
    '⏳ Verificando CURP…': '⏳ Verifying CURP…',
    '❌ La CURP debe tener exactamente 18 caracteres.':
      '❌ The CURP must be exactly 18 characters long.',
    '✅ CURP válida — Estado de México confirmado.':
      '✅ Valid CURP — State of Mexico confirmed.',
    '❌ Esta CURP ya tiene una cuenta. Inicia sesión.':
      '❌ This CURP already has an account. Sign in instead.',
    'La CURP debe tener 18 caracteres.': 'The CURP must be 18 characters long.',
    'La CURP sólo admite letras y dígitos.': 'The CURP accepts only letters and digits.',
    'La clave de entidad no corresponde al Estado de México (MC).':
      'The state code does not correspond to the State of Mexico (MC).',
    'Captura un nombre de usuario.': 'Enter a username.',
    'Ese usuario ya existe. Inicia sesión.': 'That user already exists. Sign in instead.',
    'Ya apoyaste esta propuesta en el periodo actual.':
      'You already supported this proposal in the current period.',
    'Agotaste tus votos del periodo.': 'You have used all your votes for this period.',
    'Inicia sesión para registrar una propuesta.': 'Sign in to register a proposal.',
    'El título y la región son obligatorios.': 'The title and the region are required.',
    'Tu ubicación está fuera del municipio de Temascaltepec. La demostración sólo cubre esa área.':
      'Your location is outside the municipality of Temascaltepec. The demonstration only covers that area.',
    'Aún no hay propuestas en\n          el periodo actual. Sé el primero en proponer una obra.':
      'There are no proposals in the current period yet. Be the first to propose a work.',
    'Todavía no hay propuestas publicadas. Cuando alguien registre una,\n          aparecerá aquí.':
      'No proposals have been published yet. When somebody registers one, it will appear here.',

    /* ------------------------------------------------------------------
       Conjunto sintético de js/static_backend.js. Los registros pasan por
       el DOM como cualquier otro texto, así que basta con traducirlos aquí
       y el almacén local sigue siendo uno solo, en español. Los topónimos
       de Temascaltepec y las razones sociales no se traducen: son nombres
       propios.
       ------------------------------------------------------------------ */
    'Dirección de Obra Municipal': 'Municipal Works Directorate',
    'Pavimentación de la calle Morelos, primera etapa':
      'Paving of Morelos street, first stage',
    'Rehabilitación de la red de agua potable, San Francisco Oxtotilpan':
      'Rehabilitation of the drinking water network, San Francisco Oxtotilpan',
    'Construcción de aula didáctica, San Martín Tequesquipan':
      'Construction of a teaching classroom, San Martín Tequesquipan',
    'Muro de contención sobre el camino a Real de Arriba':
      'Retaining wall along the road to Real de Arriba',
    'Alumbrado público con luminarias LED, San Mateo Almomoloa':
      'Street lighting with LED luminaires, San Mateo Almomoloa',
    'Techumbre de la plaza cívica, Cabecera Municipal':
      'Roofing of the civic square, Municipal Seat',
    'Pavimentación con concreto hidráulico de 620 metros lineales y guarniciones.':
      'Hydraulic concrete paving over 620 linear metres, plus kerbs.',
    'Sustitución de 3.2 km de línea de conducción y rehabilitación del tanque de regulación.':
      'Replacement of 3.2 km of supply main and rehabilitation of the balancing tank.',
    'Aula de 6 x 8 metros con instalación eléctrica, mobiliario y rampa de acceso.':
      'A 6 × 8 metre classroom with electrical installation, furniture and an access ramp.',
    'Muro de mampostería de 145 metros con drenaje pluvial y señalización.':
      'A 145 metre masonry wall with storm drainage and signage.',
    'Sustitución de 210 luminarias de vapor de sodio por tecnología LED.':
      'Replacement of 210 sodium vapour luminaires with LED technology.',
    'Estructura metálica de 480 m² con cubierta translúcida y captación pluvial.':
      'A 480 m² steel structure with a translucent roof and rainwater capture.',
    'Sin descripción.': 'No description.',
    'Trazo, nivelación y retiro de carpeta existente en los primeros 180 metros.':
      'Setting out, levelling and removal of the existing surface over the first 180 metres.',
    'Colado de concreto hidráulico en 260 metros lineales y guarniciones norte.':
      'Hydraulic concrete pour over 260 linear metres and the northern kerbs.',
    'Guarniciones sur concluidas; inicia banqueta poniente.':
      'Southern kerbs completed; the western pavement begins.',
    'Excavación de cepa y suministro de tubería para el primer kilómetro.':
      'Trench excavation and pipe supply for the first kilometre.',
    'Tendido e interconexión de 1.1 km de línea de conducción.':
      'Laying and interconnection of 1.1 km of supply main.',
    'Retiro de 64 luminarias y montaje de 58 equipos LED en el circuito norte.':
      'Removal of 64 luminaires and installation of 58 LED units on the northern circuit.',
    'Informe de prueba automatizada.': 'Automated test report.',
    'Concreto hidráulico f\'c=250 kg/cm²': 'Hydraulic concrete f\'c = 250 kg/cm²',
    'Acero de refuerzo del No. 3': 'No. 3 reinforcing steel',
    'Base hidráulica compactada': 'Compacted hydraulic base',
    'Cuadrilla de albañilería': 'Masonry crew',
    'Cuadrilla de construcción': 'Construction crew',
    'Operador de maquinaria': 'Machinery operator',
    'Retroexcavadora': 'Backhoe loader',
    'Vibrocompactador': 'Vibratory compactor',
    'Supervisión técnica y bitácora': 'Technical supervision and site log',
    'Dirección de obra': 'Works management',
    'Reserva por variación de precios': 'Reserve for price variation',
    'Block hueco de concreto 15x20x40': 'Hollow concrete block 15×20×40',
    'Lámina estructural galvanizada': 'Galvanised structural sheeting',
    'Concepto de prueba': 'Test item',
    'jornal': 'work-day',
    'hora': 'hour',
    'mes': 'month',
    'global': 'lump sum',
    'pza': 'pcs',
    'ton': 'tonne',
    'Director de Obras Públicas': 'Director of Public Works',
    'Delegado / Rep. de Beneficiarios': 'Delegate / Beneficiaries’ representative',
    'Representante de la Constructora': 'Contractor’s representative',
    'Presidente Municipal': 'Municipal Mayor',
    'Contralor': 'Comptroller',
    'Representante de la comunidad': 'Community representative',
    'Comité Vecinal Real de Arriba': 'Real de Arriba Neighbourhood Committee',
    'Propuesta económica más baja y experiencia acreditada en pavimentación con concreto hidráulico.':
      'Lowest financial bid and proven experience in hydraulic concrete paving.',
    'Propuesta técnica solvente, pero el plazo de ejecución excede el programa autorizado.':
      'Sound technical proposal, but the delivery time exceeds the approved schedule.',
    'FAIS - FONDO DE INFRAESTRUCTURA SOCIAL MUNICIPAL':
      'FAIS — MUNICIPAL SOCIAL INFRASTRUCTURE FUND',
    'PROGRAMA DE MEJORAMIENTO URBANO': 'URBAN IMPROVEMENT PROGRAMME',
    'FEFOM - FONDO ESTATAL DE FORTALECIMIENTO MUNICIPAL':
      'FEFOM — STATE MUNICIPAL STRENGTHENING FUND',
    'RECURSO PROPIO MUNICIPAL': 'MUNICIPAL OWN RESOURCES',
    'Sendero escolar seguro': 'Safe school path',
    'Andador peatonal iluminado de 400 metros entre la primaria y la plaza cívica.':
      'A 400 metre lit pedestrian walkway between the primary school and the civic square.',
    'Alrededor de 260 estudiantes y sus familias.': 'Around 260 pupils and their families.',
    'Reduce el riesgo vial en el trayecto escolar y ordena el paso peatonal.':
      'It reduces road risk on the school journey and organises pedestrian crossing.',
    'Mejoramiento de la cancha comunitaria': 'Improvement of the community court',
    'Rehabilitación de la superficie de juego, gradas y malla perimetral.':
      'Rehabilitation of the playing surface, stands and perimeter fencing.',
    'Ligas juveniles y actividades escolares del barrio.':
      'Youth leagues and school activities in the neighbourhood.',
    'Recupera el único espacio deportivo techado de la comunidad.':
      'It restores the only covered sports space in the community.',
    'Captación de agua de lluvia en la escuela': 'Rainwater capture at the school',
    'Sistema de captación y filtrado con cisterna de 20 m³.':
      'A capture and filtering system with a 20 m³ cistern.',
    '180 estudiantes y personal docente.': '180 pupils and teaching staff.',
    'Asegura agua para servicios sanitarios durante el estiaje.':
      'It secures water for sanitary facilities during the dry season.',
    'Rehabilitación del camino saca-cosechas': 'Rehabilitation of the farm access road',
    'Revestimiento y obras de drenaje en 2.6 km de camino rural.':
      'Surfacing and drainage works along 2.6 km of rural road.',
    '94 unidades de producción agrícola.': '94 agricultural production units.',
    'Reduce pérdidas por traslado en temporada de lluvias.':
      'It reduces transport losses during the rainy season.',
    'Luminarias solares en el acceso norte': 'Solar luminaires on the northern approach',
    'Instalación de 24 luminarias fotovoltaicas autónomas.':
      'Installation of 24 stand-alone photovoltaic luminaires.',
    'Cerca de 500 habitantes del acceso norte.':
      'Around 500 residents of the northern approach.',
    'Mejora la seguridad nocturna sin aumentar el gasto de energía.':
      'It improves night-time safety without increasing energy costs.',
    'Supervisión Zona Norte': 'Supervision North Zone',
    'Supervisión Zona Sur': 'Supervision South Zone',
    'Ciudadanía de Demostración': 'Demonstration Citizen',
    'Ciudadanía': 'Citizen',
    'de Demostración': 'of Demonstration',
    '(demostración)': '(demonstration)',
    'Demo': 'Demo',
    'Supervisión': 'Supervision',
    'Zona': 'Zone',
    'Norte': 'North',
    'Sur': 'South',
    'Centro': 'Centre',

    /* ------------------------------------------------------------------
       Mapa Inteligente. Es una aplicación React aparte (Urigc/mapa), servida
       desde docs/mapa/; su interfaz se traduce igual que el resto, por frase
       y sin tocar su código. Los rótulos vienen sin acentos en el original y
       así se conservan como clave.
       ------------------------------------------------------------------ */
    'Portada': 'Home',
    'Mapa Ciudadano': 'Citizen Map',
    'Mapa Inteligente — Obras Publicas': 'Smart Map — Public Works',
    'Temascaltepec de Gonzalez, Edo. Mex.': 'Temascaltepec de González, State of Mexico',
    'Obras Activas': 'Active works',
    'Completadas': 'Completed',
    'En Progreso': 'In progress',
    'Retrasadas': 'Delayed',
    'Inversion Total': 'Total investment',
    'Completada': 'Completed',
    'Retrasada': 'Delayed',
    'Desconocido': 'Unknown',
    'Avance Fisico': 'Physical progress',
    'Beneficiarios': 'Beneficiaries',
    'Fin': 'End',
    'Cargando mapa inteligente...': 'Loading the smart map…',
    'Conectando con el servidor': 'Connecting to the server',
    'Error de conexion': 'Connection error',

    /* ---------------- textos de ayuda de los formularios ---------------- */
    'Ej. FONDO DE INFRAESTRUCTURA SOCIAL MUNICIPAL':
      'e.g. MUNICIPAL SOCIAL INFRASTRUCTURE FUND',
    'Buscar y seleccionar comunidad…': 'Search and pick a community…',
    'Escribe para buscar…': 'Type to search…',
    'Describe el alcance y propósito de la obra, tipo de trabajos, longitud, superficie, etc.':
      'Describe the scope and purpose of the work: type of works, length, area, and so on.',
    'Buscar por nombre, expediente…': 'Search by name or case file…',
    'Buscar por oficio, instancia…': 'Search by letter or authority…',
    'Buscar por número, obra…': 'Search by number or work…',
    'Buscar por constructora, obra…': 'Search by contractor or work…',
    'Buscar por nombre, rol, usuario…': 'Search by name, role or user…',
    'Describe los criterios de evaluación y la justificación…':
      'Describe the evaluation criteria and the rationale…',
    'Describe los trabajos realizados durante el mes, condiciones de la obra, incidencias, personal trabajando, materiales empleados…':
      'Describe the work carried out during the month: site conditions, incidents, staff on site, materials used…',
    'https://drive.google.com/... o URL del documento':
      'https://drive.google.com/... or a document URL',

    /* ---------------- validaciones y errores compartidos ---------------- */
    'La obra no existe.': 'The work does not exist.',
    'El informe no existe.': 'The report does not exist.',
    'La imagen no existe.': 'The image does not exist.',
    'El oficio no existe.': 'The letter does not exist.',
    'El acta no existe.': 'The handover record does not exist.',
    'El registro no existe.': 'The record does not exist.',
    'El registro de personal no existe.': 'The staff record does not exist.',
    'La propuesta no existe.': 'The proposal does not exist.',
    'Sesión no válida.': 'Invalid session.',
    'Selecciona una obra válida.': 'Select a valid work.',
    'Coordenadas no válidas.': 'Invalid coordinates.',
    'El nombre de la obra es obligatorio.': 'The name of the work is required.',
    'Nombre y RFC son obligatorios.': 'Name and tax ID are required.',
    'Comunidad y barrio son obligatorios.': 'Community and neighbourhood are required.',
    'Nivel y programa son obligatorios.': 'Level and programme are required.',
    'Instancia y número de oficio son obligatorios.':
      'Authority and letter number are required.',
    'Constructora y razones son obligatorias.': 'Contractor and reasons are required.',
    'Esa obra ya tiene una propuesta aprobada.': 'That work already has an approved bid.',
    'Faltan campos obligatorios del personal.': 'Required staff fields are missing.',
    'Sin resultados': 'No results',
    'Sin coincidencias en tu micro-región.': 'No matches in your micro-region.',
    'No hay propuestas registradas cerca de tu comunidad.':
      'There are no proposals registered near your community.'
  };

  /* ------------------------------------------------------------------
     Patrones para las plantillas con variables. Se prueban en orden
     sobre la frase completa cuando el diccionario no la contiene.
     ------------------------------------------------------------------ */
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];

  function mesEn(nombre) {
    var i = MESES.indexOf(nombre);
    return i < 0 ? nombre : MESES_EN[i];
  }

  var PATRONES = [
    [/^Informe de (\w+) (\d{4})$/, function (m) { return mesEn(m[1]) + ' ' + m[2] + ' report'; }],
    [/^Elaborando presupuesto para: (.+)$/, function (m) { return 'Preparing the budget for: ' + m[1]; }],
    [/^Informe de (\w+) (\d{4}) registrado exitosamente\.$/, function (m) {
      return mesEn(m[1]) + ' ' + m[2] + ' report registered successfully.'; }],
    [/^(\d[\d,]*) obras? registradas?$/, function (m) {
      return m[1] + ' work' + (m[1] === '1' ? '' : 's') + ' registered'; }],
    [/^— obras registradas$/, function () { return '— works registered'; }],
    [/^(\d+) informes?$/, function (m) { return m[1] + ' report' + (m[1] === '1' ? '' : 's'); }],
    [/^(\d+) firmantes$/, function (m) { return m[1] + ' signatories'; }],
    [/^(\d+) propuestas$/, function (m) { return m[1] + ' proposals'; }],
    [/^(\d+) votos$/, function (m) { return m[1] + ' votes'; }],
    [/^(\d+) \/ (\d+) votos$/, function (m) { return m[1] + ' / ' + m[2] + ' votes'; }],
    [/^Periodo (.+)$/, function (m) { return 'Period ' + m[1]; }],
    [/^Foto (\d+) de (\d+)(: )?(.+)?$/, function (m) { return 'Photo ' + m[1] + ' of ' + m[2] + (m[3] || '') + (m[4] || ''); }],
    [/^\$(.+) asignados$/, function (m) { return '$' + m[1] + ' allocated'; }],
    [/^Presupuesto asignado: (.+)$/, function (m) { return 'Allocated budget: ' + m[1]; }],
    [/^Subieron? (\d+) imagen/, function (m) { return 'Uploading ' + m[1] + ' image(s)…'; }],
    [/^Fuente registrada: "(.+)" → ID (.+)$/, function (m) {
      return 'Source registered: “' + m[1] + '” → ID ' + m[2]; }],
    [/^Fuente reutilizada: "(.+)" \(ya existía en el sistema\)\.$/, function (m) {
      return 'Source reused: “' + m[1] + '” (it already existed in the system).'; }],
    [/^La fuente "(.+)" ya está en la lista de esta obra\.$/, function (m) {
      return 'The source “' + m[1] + '” is already listed for this work.'; }],
    [/^Constructora registrada con ID (.+)$/, function (m) {
      return 'Contractor registered with ID ' + m[1]; }],
    [/^Región registrada con ID (.+)$/, function (m) { return 'Region registered with ID ' + m[1]; }],
    [/^Obra "(.+)" registrada · (.+)$/, function (m) {
      return 'Work “' + m[1] + '” registered · ' + m[2]; }],
    [/^Obra "(.+)" eliminada\.$/, function (m) { return 'Work “' + m[1] + '” deleted.'; }],
    [/^Bienvenido, (.+)$/, function (m) { return 'Welcome, ' + m[1]; }],
    [/^Personal registrado correctamente \((.+)\)\.$/, function (m) {
      return 'Staff member registered successfully (' + m[1] + ').'; }],
    [/^Participante "(.+)" registrado correctamente\.$/, function (m) {
      return 'Participant “' + m[1] + '” registered successfully.'; }],
    [/^(\d+) fuente\(s\) de financiamiento vinculadas$/, function (m) {
      return m[1] + ' funding source(s) linked'; }],
    /* La identidad de la sesión aparece incrustada en insignias y saludos
       ("🏛️ Demostración Director", "📋 Demo Supervisor (DEMO-SUP-001)"),
       así que el rol se traduce dentro de la frase, no como frase suelta. */
    [/^(.*?)\bDemostración (Director|Supervisor|Proyectista|Secretario)\b(.*)$/, function (m) {
      return m[1] + 'Demonstration ' + (FRASES[m[2]] || m[2]) + m[3]; }],
    [/^(.*?)\bDemo (Director|Supervisor|Proyectista|Secretario)\b(.*)$/, function (m) {
      return m[1] + 'Demo ' + (FRASES[m[2]] || m[2]) + m[3]; }],
    [/^([\d,.]+) habitantes$/, function (m) { return m[1] + ' inhabitants'; }],
    /* Los marcadores de posición van todos con el mismo prefijo y su
       contenido es un ejemplo, no texto que deba traducirse. */
    [/^Ej\. (.+)$/, function (m) { return 'e.g. ' + m[1]; }],
    /* El resumen del presupuesto imprime cantidad y unidad juntas. */
    [/^\((\d[\d.,]*) (\S+)\)$/, function (m) {
      return '(' + m[1] + ' ' + (FRASES[m[2]] || m[2]) + ')'; }],
    /* Las listas de la secretaría anteponen el identificador al nombre del
       registro; el identificador es un dato y se conserva. */
    [/^([A-Z]{2,5}-[\w-]+) · (.+)$/, function (m) {
      return m[1] + ' · ' + traducirFrase(m[2]); }],
    [/^(📍|🏢|🏗️|📄|📜|🏆) (.+)$/, function (m) {
      return m[1] + ' ' + traducirFrase(m[2]); }],
    /* Última red: los rótulos compuestos con «·» se traducen por partes.
       Cada mitad vuelve a pasar por el diccionario, y lo que no esté —un
       identificador, un topónimo— se queda como está. */
    [/^(.+?) · (.+)$/, function (m) {
      return traducirFrase(m[1]) + ' · ' + traducirFrase(m[2]); }],
    [/^Cuenta creada\. Bienvenido, (.+)\.$/, function (m) {
      return 'Account created. Welcome, ' + m[1] + '.'; }],
    [/^Ruta no disponible en la demostración: (.+)$/, function (m) {
      return 'Route not available in the demonstration: ' + m[1]; }],
    [/^Mostrando hasta 5 propuestas más cercanas a tu micro-región\.$/, function () {
      return 'Showing up to 5 proposals closest to your micro-region.'; }],
    [/^Ubicación recibida\. Buscando propuestas cercanas…$/, function () {
      return 'Location received. Looking for nearby proposals…'; }],
    [/^Solicitando ubicación…$/, function () { return 'Requesting location…'; }],
    [/^Permiso de ubicación negado\. Puedes activarlo desde la barra del navegador\.$/, function () {
      return 'Location permission denied. You can enable it from the browser bar.'; }],
    [/^No pudimos obtener tu ubicación\. Intenta de nuevo\.$/, function () {
      return 'We could not get your location. Try again.'; }],
    [/^Tu navegador no soporta geolocalización\.$/, function () {
      return 'Your browser does not support geolocation.'; }]
  ];

  /* ------------------------------------------------------------------
     Estado
     ------------------------------------------------------------------ */
  function leer(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function valido(id) { return IDIOMAS.some(function (l) { return l.id === id; }); }

  /* Igual que el tema y el modo (véase js/theme.js), la URL manda:
     ?idioma=en abre el sitio en inglés y deja la elección guardada. */
  var paramIdioma = new URLSearchParams(window.location.search).get('idioma');
  var idioma = paramIdioma || leer(K_IDIOMA, 'es');
  if (!valido(idioma)) idioma = 'es';
  if (paramIdioma && valido(paramIdioma)) guardar(K_IDIOMA, idioma);

  var pagina = (document.documentElement.getAttribute('data-pagina') || 'index');

  /* Traducción de una frase suelta. Devuelve el español si no hay
     equivalente, nunca una cadena vacía inesperada. */
  function traducirFrase(es) {
    if (idioma === 'es') return es;
    if (Object.prototype.hasOwnProperty.call(FRASES, es)) return FRASES[es];
    for (var i = 0; i < PATRONES.length; i++) {
      var m = es.match(PATRONES[i][0]);
      if (m) return PATRONES[i][1](m);
    }
    /* Algunas vistas recortan el texto para la vista previa ("razones…").
       El recorte nunca coincidirá con una clave, así que se busca la frase
       completa por prefijo y se recorta la traducción a lo ancho
       equivalente, sin partir una palabra. */
    if (es.length > 30 && es.charAt(es.length - 1) === '…') {
      var prefijo = es.slice(0, -1);
      for (var clave in FRASES) {
        if (!Object.prototype.hasOwnProperty.call(FRASES, clave)) continue;
        if (clave.indexOf(prefijo) !== 0) continue;
        var completa = FRASES[clave];
        if (completa.length <= prefijo.length) return completa;
        return completa.slice(0, prefijo.length).replace(/\s+\S*$/, '') + '…';
      }
    }
    return es;
  }

  /* Conserva los espacios y saltos originales alrededor del texto: los
     nodos del prototipo vienen sangrados dentro del HTML y perderlos
     descuadraría la maquetación. */
  function traducirConEspacios(valor) {
    var m = valor.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!m || !m[2]) return valor;
    return m[1] + traducirFrase(m[2].replace(/\s+/g, ' ')) + m[3];
  }

  function t(clave, vars) {
    var tabla = CLAVES[idioma] || CLAVES.es;
    var s = tabla[clave];
    if (s === undefined) s = CLAVES.es[clave];
    if (s === undefined) return clave;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (_, k) {
        return vars[k] === undefined ? '{' + k + '}' : vars[k];
      });
    }
    return s;
  }

  /* ------------------------------------------------------------------
     Aplicación sobre el DOM.

     Para cada nodo se recuerda su español de origen y la traducción que
     dejamos escrita. Si el valor actual no coincide con ninguno de los
     dos es que la aplicación lo reescribió, y entonces se vuelve a tomar
     como origen. Así el motor sobrevive a los repintados de las vistas.
     ------------------------------------------------------------------ */
  var memoriaTexto = new WeakMap();
  var memoriaAttr = new WeakMap();
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  /* `value` sólo se traduce en las celdas editables del presupuesto. En un
     <option> o en un campo oculto ese atributo es un identificador —
     traducir value="Secretario" rompería el selector de rol—, así que la
     excepción se limita a este selector. */
  var SEL_VALOR = 'input.inline-edit';
  var IGNORAR = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, svg: 1 };
  var aplicando = false;

  function textoNodo(n) {
    var actual = n.nodeValue;
    if (!actual || !/\S/.test(actual)) return;
    var rec = memoriaTexto.get(n);
    if (!rec || (actual !== rec.es && actual !== rec.out)) {
      rec = { es: actual, out: actual };
      memoriaTexto.set(n, rec);
    }
    var salida = idioma === 'es' ? rec.es : traducirConEspacios(rec.es);
    rec.out = salida;
    if (actual !== salida) { aplicando = true; n.nodeValue = salida; aplicando = false; }
  }

  function atributosElemento(el) {
    var rec = memoriaAttr.get(el);
    if (!rec) { rec = {}; memoriaAttr.set(el, rec); }
    var lista = ATTRS;
    if (el.matches && el.matches(SEL_VALOR)) lista = ATTRS.concat('value');
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      if (!el.hasAttribute(a)) continue;
      var actual = el.getAttribute(a);
      var r = rec[a];
      if (!r || (actual !== r.es && actual !== r.out)) r = rec[a] = { es: actual, out: actual };
      var salida = idioma === 'es' ? r.es : traducirConEspacios(r.es);
      r.out = salida;
      if (actual !== salida) { aplicando = true; el.setAttribute(a, salida); aplicando = false; }
    }
  }

  function recorrer(raiz) {
    if (!raiz) return;
    if (raiz.nodeType === 3) { textoNodo(raiz); return; }
    if (raiz.nodeType !== 1 && raiz.nodeType !== 9 && raiz.nodeType !== 11) return;
    var nombre = raiz.nodeName;
    if (IGNORAR[nombre]) return;

    var caminante = document.createTreeWalker(
      raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: function (n) {
          if (n.nodeType === 1) {
            return IGNORAR[n.nodeName] ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
    if (raiz.nodeType === 1) { atributosElemento(raiz); }
    var n;
    while ((n = caminante.nextNode())) {
      if (n.nodeType === 3) textoNodo(n);
      else atributosElemento(n);
    }
  }

  function aplicar(raiz) { recorrer(raiz || document.documentElement); }

  /* Cabecera del documento: atributo lang y título. */
  function cabecera() {
    document.documentElement.lang = idioma;
    var titulo = t('titulo.' + pagina);
    if (titulo && titulo !== 'titulo.' + pagina) document.title = titulo;
  }
  cabecera();

  /* ------------------------------------------------------------------
     Sin parpadeo, y de forma permanente: el observador traduce cada nodo
     nuevo en cuanto aparece. A diferencia del sitio del agua, aquí no se
     retira al terminar de cargar, porque las vistas de rol reescriben su
     contenido continuamente.
     ------------------------------------------------------------------ */
  var observador = new MutationObserver(function (muts) {
    if (aplicando) return;
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === 'characterData') { textoNodo(m.target); continue; }
      if (m.type === 'attributes') {
        if (m.target.nodeType === 1) atributosElemento(m.target);
        continue;
      }
      for (var j = 0; j < m.addedNodes.length; j++) recorrer(m.addedNodes[j]);
    }
  });

  function observar() {
    observador.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
  }

  if (document.readyState === 'loading') {
    observar();
    document.addEventListener('DOMContentLoaded', function () { aplicar(); });
  } else {
    aplicar();
    observar();
  }

  function set(nuevo) {
    if (!valido(nuevo) || nuevo === idioma) return;
    idioma = nuevo;
    guardar(K_IDIOMA, idioma);
    API.idioma = idioma;
    cabecera();
    aplicar();
    document.dispatchEvent(new CustomEvent('idiomacambiado', { detail: { idioma: idioma } }));
  }

  function locale() { return LOCALE[idioma] || 'es-MX'; }

  var API = {
    idioma: idioma,
    idiomas: IDIOMAS,
    t: t,
    frase: traducirFrase,
    set: set,
    aplicar: aplicar,
    locale: locale,
    num: function (n, opciones) {
      if (n == null || n === '' || isNaN(Number(n))) return '—';
      return new Intl.NumberFormat(locale(), opciones).format(Number(n));
    }
  };
  window.I18N = API;
})();
