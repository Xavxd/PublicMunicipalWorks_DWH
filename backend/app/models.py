from .database import db

class Personal(db.Model):
    __tablename__ = 'personal'
    __table_args__ = {'schema': 'public'} # Especificamos el esquema según tu captura[cite: 2]

    # Definimos las columnas exactamente como están en tu base de datos
    codigo_personal = db.Column(db.String, primary_key=True)
    nombre          = db.Column(db.String, nullable=False)
    apellido_paterno = db.Column(db.String, nullable=False)
    apellido_materno = db.Column(db.String, nullable=True) # Es anulable según tu imagen[cite: 2]
    
    username        = db.Column(db.String, unique=True, nullable=False)
    password_hash   = db.Column(db.Text, nullable=False)
    rol             = db.Column(db.String, nullable=False)

    def to_dict(self):
        """Convierte el objeto a un diccionario para enviarlo como JSON al frontend."""
        return {
            "id": self.codigo_personal,
            "nombre": f"{self.nombre} {self.apellido_paterno}",
            "username": self.username,
            "rol": self.rol
        }
