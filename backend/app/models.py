from .database import db


class Personal(db.Model):
    __tablename__ = 'personal'
    __table_args__ = {'schema': 'public'}

    codigo_personal  = db.Column(db.String, primary_key=True)
    nombre           = db.Column(db.String, nullable=False)
    apellido_paterno = db.Column(db.String, nullable=False)
    apellido_materno = db.Column(db.String, nullable=True)
    username         = db.Column(db.String, unique=True, nullable=False)
    password_hash    = db.Column(db.Text, nullable=False)
    rol              = db.Column(db.String, nullable=False)

    def to_dict(self):
        """Convierte el objeto a un diccionario para enviarlo como JSON al frontend."""
        return {
            "id": self.codigo_personal,
            "nombre": f"{self.nombre} {self.apellido_paterno}",
            "username": self.username,
            "rol": self.rol
        }


# ════════════════════════════════════════════════════════════════
#  CONSTRUCTORA
# ════════════════════════════════════════════════════════════════

class Constructora(db.Model):
    __tablename__ = 'constructora'
    __table_args__ = {'schema': 'public'}

    id_constructora = db.Column('id_constructora', db.String(10), primary_key=True)
    nombre_const      = db.Column('nombre_const', db.String(150), nullable=False)
    rfc             = db.Column('rfc', db.String(13), nullable=False)
    tipo_ejecutor   = db.Column('tipo_ejecutor', db.String(100), nullable=False)


# ════════════════════════════════════════════════════════════════
#  REGIÓN
# ════════════════════════════════════════════════════════════════

class Region(db.Model):
    __tablename__ = 'region'
    __table_args__ = {'schema': 'public'}

    id_region = db.Column('id_region', db.String(5), primary_key=True)
    comunidad = db.Column('comunidad', db.String(50), nullable=False)
    barrio    = db.Column('barrio', db.String(150), nullable=False)
    colonia   = db.Column('colonia', db.String(100), nullable=True)


# ════════════════════════════════════════════════════════════════
#  OBRA
# ════════════════════════════════════════════════════════════════

class Obra(db.Model):
    __tablename__ = 'obra'
    __table_args__ = {'schema': 'public'}

    id_obra           = db.Column('id_obra', db.String(20), primary_key=True)
    codigo_expediente = db.Column('codigo_expediente', db.String(20), nullable=False)
    nombre_obra       = db.Column('nombre_obra', db.String(200), nullable=False)
    etapa             = db.Column('etapa', db.Integer, default=1)
    fecha_inicio      = db.Column('fecha_inicio', db.Date, nullable=False)
    fecha_final       = db.Column('fecha_final', db.Date, nullable=False)
    descripcion       = db.Column('descripcion', db.Text, nullable=False)
    beneficiarios     = db.Column('beneficiarios', db.String(500), nullable=False)

    id_constructora   = db.Column('id_constructora', db.String(10),
                                  db.ForeignKey('public.constructora.id_constructora'),
                                  nullable=False)
    id_region         = db.Column('id_region', db.String(5),
                                  db.ForeignKey('public.region.id_region'),
                                  nullable=False)
    codigo_supervisor = db.Column('codigo_supervisor', db.String(20),
                                  db.ForeignKey('public.supervisor.codigo_personal'),
                                  nullable=False)

    constructora = db.relationship('Constructora', lazy='joined')
    region       = db.relationship('Region', lazy='joined')
    supervisor   = db.relationship('Supervisor', lazy='joined')


# ════════════════════════════════════════════════════════════════
#  PRESUPUESTO_OBRA
# ════════════════════════════════════════════════════════════════

class PresupuestoObra(db.Model):
    __tablename__ = 'presupuesto_obra'
    __table_args__ = {'schema': 'public'}

    id_presupuesto   = db.Column('id_presupuesto', db.String(10), primary_key=True)
    presupuesto_total = db.Column('presupuesto_total', db.Numeric(15, 2), default=0)
    id_proyectista   = db.Column('id_proyectista', db.String(20),
                                 db.ForeignKey('public.proyectista.codigo_personal'),
                                 nullable=False)
    id_obra          = db.Column('id_obra', db.String(20),
                                 db.ForeignKey('public.obra.id_obra'),
                                 nullable=False)

    obra = db.relationship('Obra', lazy='joined')
    proyectista = db.relationship('Proyectista', lazy='joined')


# ════════════════════════════════════════════════════════════════
#  FUENTE PRESUPUESTARIA
# ════════════════════════════════════════════════════════════════

class FuentePresupuestaria(db.Model):
    __tablename__ = 'fuente_presupuestaria'
    __table_args__ = {'schema': 'public'}

    id_fuente   = db.Column('id_fuente', db.String(10), primary_key=True)
    grado_nivel = db.Column('grado_nivel', db.String(50), nullable=False)
    programa    = db.Column('programa', db.Text, nullable=False)


# ════════════════════════════════════════════════════════════════
#  FINANCIA (obra ↔ fuente)
# ════════════════════════════════════════════════════════════════

class Financia(db.Model):
    __tablename__ = 'financia'
    __table_args__ = {'schema': 'public'}

    id_obra   = db.Column('id_obra', db.String(20),
                          db.ForeignKey('public.obra.id_obra'),
                          primary_key=True)
    id_fuente = db.Column('id_fuente', db.String(10),
                            db.ForeignKey('public.fuente_presupuestaria.id_fuente'),
                            primary_key=True)

    fuente = db.relationship('FuentePresupuestaria', lazy='joined')


# ════════════════════════════════════════════════════════════════
#  SUPERVISOR
# ════════════════════════════════════════════════════════════════

class Supervisor(db.Model):
    __tablename__ = 'supervisor'
    __table_args__ = {'schema': 'public'}

    codigo_personal = db.Column('codigo_personal', db.String(20),
                                db.ForeignKey('public.personal.codigo_personal'),
                                primary_key=True)
    telefono = db.Column('telefono', db.String, nullable=True) 

    personal = db.relationship('Personal', lazy='joined')


# ════════════════════════════════════════════════════════════════
#  PROYECTISTA
# ════════════════════════════════════════════════════════════════

class Proyectista(db.Model):
    __tablename__ = 'proyectista'
    __table_args__ = {'schema': 'public'}

    codigo_personal = db.Column('codigo_personal', db.String(20),
                                db.ForeignKey('public.personal.codigo_personal'),
                                primary_key=True)
    empresa = db.Column(db.String, nullable=False)
    id_constructora = db.Column(db.String(10), db.ForeignKey('public.constructora.id_constructora'), nullable=False)

    personal = db.relationship('Personal', lazy='joined')
    constructora = db.relationship('Constructora', lazy='joined') 
    
# ════════════════════════════════════════════════════════════════
#  OPCIÓN SELECCIÓN (concursos)
# ════════════════════════════════════════════════════════════════

class OpcionSeleccion(db.Model):
    __tablename__ = 'opcion_seleccion'
    __table_args__ = {'schema': 'public'}

    id_participante  = db.Column('id_participante', db.String(20), primary_key=True)
    id_obra          = db.Column('id_obra', db.String(20),
                                 db.ForeignKey('public.obra.id_obra'),
                                 nullable=False)
    constructora     = db.Column('constructora', db.String(150), nullable=False)
    aprobado         = db.Column('aprobado', db.Boolean, default=False)
    razones_decision = db.Column('razones_decision', db.Text, nullable=False)

    obra = db.relationship('Obra', lazy='joined')


class ActaEntrega(db.Model):
    __tablename__ = 'acta_entrega'
    __table_args__ = {'schema': 'public'}

    id_acta          = db.Column('id_acta', db.String, primary_key=True)
    acta_entrega     = db.Column('acta_entrega', db.Text, nullable=False)
    fecha_expedicion = db.Column('fecha_expedicion', db.Date, nullable=False)
    id_obra          = db.Column('id_obra', db.String(20),
                                 db.ForeignKey('public.obra.id_obra'),
                                 nullable=False, unique=True)

    obra = db.relationship('Obra', lazy='joined')


class Firmante(db.Model):
    __tablename__ = 'firmantes'
    __table_args__ = {'schema': 'public'}

    id_firmante       = db.Column('id_firmante', db.String, primary_key=True)
    nombre            = db.Column('nombre', db.String, nullable=False)
    apellido_paterno  = db.Column('apellido_paterno', db.String, nullable=False)
    apellido_materno  = db.Column('apellido_materno', db.String, nullable=True)
    cargo             = db.Column('cargo', db.String, nullable=False)
    id_acta           = db.Column('id_acta', db.String,
                                  db.ForeignKey('public.acta_entrega.id_acta'),
                                  nullable=False)

    acta = db.relationship('ActaEntrega', lazy='joined')


class Costo(db.Model):
    __tablename__ = 'costos'
    __table_args__ = {'schema': 'public'}

    id_gasto       = db.Column('id_gasto', db.String, primary_key=True)
    categoria      = db.Column('categoria', db.String, nullable=False)
    costo          = db.Column('costo', db.Numeric, nullable=False)
    descripcion    = db.Column('descripcion', db.Text, nullable=False)
    id_presupuesto = db.Column('id_presupuesto', db.String(10),
                               db.ForeignKey('public.presupuesto_obra.id_presupuesto'),
                               nullable=False)

    presupuesto = db.relationship('PresupuestoObra', lazy='joined')


class Informe(db.Model):
    __tablename__ = 'informes'
    __table_args__ = {'schema': 'public'}

    id_informe                      = db.Column('id_informe', db.String, primary_key=True)
    ano_infor                       = db.Column('ano_infor', db.Integer, nullable=False)
    mes                             = db.Column('mes', db.String, nullable=False)
    porcentaje_avance_fisico        = db.Column('porcentaje_avance_fisico', db.SmallInteger, nullable=False)
    porcentaje_avance_presupuestario = db.Column('porcentaje_avance_presupuestario', db.SmallInteger, nullable=False)
    doc_infome                      = db.Column('doc_infome', db.Text, nullable=False)
    descripcion                     = db.Column('descripcion', db.Text, nullable=False)
    id_obra                         = db.Column('id_obra', db.String(20),
                                                db.ForeignKey('public.obra.id_obra'),
                                                nullable=False)
    codigo_supervisor               = db.Column('codigo_supervisor', db.String(20),
                                                db.ForeignKey('public.supervisor.codigo_personal'),
                                                nullable=False)

    obra = db.relationship('Obra', lazy='joined')
    supervisor = db.relationship('Supervisor', lazy='joined')


class Permiso(db.Model):
    __tablename__ = 'permisos'
    __table_args__ = {'schema': 'public'}

    id_oficio          = db.Column('id_oficio', db.String, primary_key=True)
    nombre_instancia   = db.Column('nombre_instancia', db.String, nullable=False)
    oficio_acreditacion = db.Column('oficio_acreditacion', db.Text, nullable=False)
    id_obra            = db.Column('id_obra', db.String(20),
                                   db.ForeignKey('public.obra.id_obra'),
                                   nullable=False)

    obra = db.relationship('Obra', lazy='joined')
