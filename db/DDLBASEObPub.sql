-- =====================================================================
--  Esquema operacional — Obras Públicas Temascaltepec
--
--  Las tablas van en orden de dependencia, no alfabético: las claves
--  foráneas están declaradas en línea, así que una tabla no puede
--  crearse antes que aquella a la que referencia. Con el orden anterior
--  el volcado no cargaba en una base limpia (acta_entrega referenciaba a
--  obra, que todavía no existía) y la implementación de referencia no se
--  podía levantar desde cero.
--  Nota de tipos: varias columnas venían declaradas como `character`
--  sin longitud, que en PostgreSQL equivale a character(1) y no admite
--  ni un identificador como 'OBRA-0001'. Se declaran como `text`, que
--  es el tipo de las claves primarias a las que referencian.
-- =====================================================================

CREATE TABLE public.constructora (
  id_constructora text NOT NULL,
  rfc text UNIQUE,
  nombre_const text NOT NULL,
  tipo_ejecutor text NOT NULL,
  CONSTRAINT constructora_pkey PRIMARY KEY (id_constructora)
);

CREATE TABLE public.fuente_presupuestaria (
  id_fuente text NOT NULL,
  grado_nivel text NOT NULL,
  programa text NOT NULL,
  CONSTRAINT fuente_presupuestaria_pkey PRIMARY KEY (id_fuente)
);

CREATE TABLE public.personal (
  codigo_personal text NOT NULL,
  nombre text NOT NULL,
  apellido_paterno text NOT NULL,
  apellido_materno text,
  username character varying UNIQUE,
  password_hash text,
  rol character varying NOT NULL CHECK (rol::text = ANY (ARRAY['Supervisor'::character varying, 'Director'::character varying, 'Secretario'::character varying, 'Proyectista'::character varying]::text[])),
  CONSTRAINT personal_pkey PRIMARY KEY (codigo_personal)
);

CREATE TABLE public.region (
  id_region text NOT NULL,
  comunidad text NOT NULL,
  barrio text NOT NULL,
  colonia text,
  CONSTRAINT region_pkey PRIMARY KEY (id_region)
);

CREATE TABLE public.pobladores (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL,
  apellidos character varying NOT NULL,
  comunidad character varying NOT NULL,
  username character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  curp character varying NOT NULL UNIQUE,
  creado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT pobladores_pkey PRIMARY KEY (id)
);

CREATE TABLE public.proyectista (
  codigo_personal text NOT NULL,
  empresa text NOT NULL,
  id_constructora text NOT NULL,
  CONSTRAINT proyectista_pkey PRIMARY KEY (codigo_personal),
  CONSTRAINT rel_const FOREIGN KEY (id_constructora) REFERENCES public.constructora(id_constructora),
  CONSTRAINT subclass FOREIGN KEY (codigo_personal) REFERENCES public.personal(codigo_personal)
);

CREATE TABLE public.supervisor (
  codigo_personal text NOT NULL,
  telefono text,
  CONSTRAINT supervisor_pkey PRIMARY KEY (codigo_personal),
  CONSTRAINT subclass FOREIGN KEY (codigo_personal) REFERENCES public.personal(codigo_personal)
);

CREATE TABLE public.propuestas_obras (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  poblador_id integer NOT NULL,
  titulo character varying NOT NULL,
  region character varying NOT NULL,
  descripcion_obra text NOT NULL,
  descripcion_beneficiados text NOT NULL,
  pros_comunidad text NOT NULL,
  anio_convocatoria integer NOT NULL DEFAULT EXTRACT(year FROM CURRENT_DATE),
  creado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT propuestas_obras_pkey PRIMARY KEY (id),
  CONSTRAINT propuestas_obras_poblador_id_fkey FOREIGN KEY (poblador_id) REFERENCES public.pobladores(id)
);

CREATE TABLE public.obra (
  id_obra text NOT NULL,
  codigo_expediente text NOT NULL UNIQUE,
  nombre_obra text NOT NULL,
  etapa smallint,
  fecha_inicio date NOT NULL,
  fecha_final date NOT NULL,
  descripcion text NOT NULL,
  beneficiarios text NOT NULL,
  id_constructora text NOT NULL,
  id_region text NOT NULL,
  codigo_supervisor text NOT NULL,
  estado boolean NOT NULL DEFAULT true,
  CONSTRAINT obra_pkey PRIMARY KEY (id_obra),
  CONSTRAINT constructora FOREIGN KEY (id_constructora) REFERENCES public.constructora(id_constructora),
  CONSTRAINT region FOREIGN KEY (id_region) REFERENCES public.region(id_region),
  CONSTRAINT supervisor FOREIGN KEY (codigo_supervisor) REFERENCES public.supervisor(codigo_personal)
);

CREATE TABLE public.votos_propuestas (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  poblador_id integer NOT NULL,
  propuesta_id integer NOT NULL,
  periodo_voto character varying NOT NULL,
  creado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT votos_propuestas_pkey PRIMARY KEY (id),
  CONSTRAINT votos_propuestas_poblador_id_fkey FOREIGN KEY (poblador_id) REFERENCES public.pobladores(id),
  CONSTRAINT votos_propuestas_propuesta_id_fkey FOREIGN KEY (propuesta_id) REFERENCES public.propuestas_obras(id)
);

CREATE TABLE public.acta_entrega (
  id_acta text NOT NULL,
  acta_entrega text NOT NULL,
  fecha_expedicion date NOT NULL,
  id_obra text NOT NULL UNIQUE,
  CONSTRAINT acta_entrega_pkey PRIMARY KEY (id_acta),
  CONSTRAINT rel_obra FOREIGN KEY (id_obra) REFERENCES public.obra(id_obra)
);

CREATE TABLE public.financia (
  id_obra text NOT NULL,
  id_fuente text NOT NULL,
  CONSTRAINT financia_pkey PRIMARY KEY (id_obra, id_fuente),
  CONSTRAINT fuente_presup FOREIGN KEY (id_fuente) REFERENCES public.fuente_presupuestaria(id_fuente),
  CONSTRAINT rel_obra FOREIGN KEY (id_obra) REFERENCES public.obra(id_obra)
);

CREATE TABLE public.informes (
  id_informe text NOT NULL,
  ano_infor integer NOT NULL,
  mes text NOT NULL,
  porcentaje_avance_fisico smallint NOT NULL CHECK (porcentaje_avance_fisico >= 0 AND porcentaje_avance_fisico <= 100),
  porcentaje_avance_presupuestario smallint NOT NULL CHECK (porcentaje_avance_presupuestario >= 0 AND porcentaje_avance_presupuestario <= 100),
  doc_infome text NOT NULL,
  descripcion text NOT NULL,
  id_obra text NOT NULL,
  codigo_supervisor text NOT NULL,
  CONSTRAINT informes_pkey PRIMARY KEY (id_informe),
  CONSTRAINT rel_sup FOREIGN KEY (codigo_supervisor) REFERENCES public.supervisor(codigo_personal),
  CONSTRAINT rel_obra FOREIGN KEY (id_obra) REFERENCES public.obra(id_obra)
);

CREATE TABLE public.opcion_seleccion (
  id_participante text NOT NULL,
  constructora text NOT NULL,
  aprobado boolean NOT NULL,
  razones_decision text NOT NULL,
  id_obra text NOT NULL,
  CONSTRAINT opcion_seleccion_pkey PRIMARY KEY (id_participante),
  CONSTRAINT rel_obra FOREIGN KEY (id_obra) REFERENCES public.obra(id_obra)
);

CREATE TABLE public.permisos (
  id_oficio text NOT NULL,
  nombre_instancia text NOT NULL,
  oficio_acreditacion text NOT NULL,
  id_obra text NOT NULL,
  CONSTRAINT permisos_pkey PRIMARY KEY (id_oficio),
  CONSTRAINT rel_obra FOREIGN KEY (id_obra) REFERENCES public.obra(id_obra)
);

CREATE TABLE public.presupuesto_obra (
  id_presupuesto text NOT NULL,
  presupuesto_total numeric NOT NULL,
  id_proyectista text NOT NULL,
  id_obra text NOT NULL UNIQUE,
  CONSTRAINT presupuesto_obra_pkey PRIMARY KEY (id_presupuesto),
  CONSTRAINT proyectistacargo FOREIGN KEY (id_proyectista) REFERENCES public.proyectista(codigo_personal),
  CONSTRAINT obra_rel FOREIGN KEY (id_obra) REFERENCES public.obra(id_obra)
);

CREATE TABLE public.costos (
  id_gasto text NOT NULL,
  categoria text NOT NULL,
  costo numeric NOT NULL,
  descripcion text NOT NULL,
  id_presupuesto text NOT NULL,
  CONSTRAINT costos_pkey PRIMARY KEY (id_gasto),
  CONSTRAINT presupuesto FOREIGN KEY (id_presupuesto) REFERENCES public.presupuesto_obra(id_presupuesto)
);

CREATE TABLE public.firmantes (
  id_firmante text NOT NULL,
  nombre text NOT NULL,
  apellido_paterno text NOT NULL,
  apellido_materno text,
  cargo text NOT NULL,
  id_acta text NOT NULL,
  CONSTRAINT firmantes_pkey PRIMARY KEY (id_firmante),
  CONSTRAINT rel_acta FOREIGN KEY (id_acta) REFERENCES public.acta_entrega(id_acta)
);

CREATE TABLE public.imagenes_informe (
  id_imagen uuid NOT NULL DEFAULT gen_random_uuid(),
  id_informe text NOT NULL,
  url_publica text NOT NULL,
  ruta_r2 text NOT NULL,
  nombre_original text NOT NULL,
  tipo_mime text,
  tamaño_bytes integer,
  fecha_subida timestamp with time zone DEFAULT now(),
  CONSTRAINT imagenes_informe_pkey PRIMARY KEY (id_imagen),
  CONSTRAINT fk_informe FOREIGN KEY (id_informe) REFERENCES public.informes(id_informe)
);
