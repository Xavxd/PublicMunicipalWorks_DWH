import os
import base64
from flask_sqlalchemy import SQLAlchemy
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from contextlib import contextmanager
from psycopg.rows import dict_row
from contextlib import contextmanagerfrom psycopg2.extras import RealDictCursor

db = SQLAlchemy()

class ShadowVault:
   
    _BLOB = "IU96vTnqnd1IBDXQrfFjXUEjf/IhhvhYCAKjLbFv5HQtghq2c2IXVA6t1HUSfpsR01lc3uvClWkxy7SVWAazn7Dgj5Xm7NaOqLAQqcxoLoCLrnpSPwDcWV6yJEMjWkB5ei71G4CJbNiSLIAZ2BGf2o6/2kHg8kG3u+vMsccL9ycVgljd4kvHS3GRJ0GgADWZyQ0IKKe5IR3eVoczTQ4SRpL6YVW1g+cA6OTtH6mTRkPnNqzWA/Dew+EoHy4u2mAZizpUUJDIbQPWSzQuDpn5/bT3Vn5UTpvXZLmYBlr3FC33MywTP66Rq2b3x5DFDFnLGjX83JyR4OH4Ix/tCxOPBA=="
    _URL = None

    @classmethod
    def get_url(cls):
        if cls._URL: return cls._URL
        
        
        key_raw = os.getenv("GHOST_KEY")
        if not key_raw:
            raise RuntimeError("Bóveda sellada: Acceso denegado.")

        
        private_key = serialization.load_pem_private_key(
            key_raw.encode().replace(b'\\n', b'\n'), 
            password=None
        )
        
        
        blob_bytes = base64.b64decode(cls._BLOB.encode())
        
        
        cls._URL = private_key.decrypt(
            blob_bytes,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        ).decode('utf-8') 
        
        return cls._URL


def init_db(app):

    app.config['SQLALCHEMY_DATABASE_URI'] = ShadowVault.get_url()
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        "pool_size": 10,           
        "max_overflow": 2,        
        "pool_recycle": 300,      
        "pool_pre_ping": True      
    }
    
    db.init_app(app)


@contextmanager
def get_db():
    connection = db.engine.raw_connection()
    try:
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        yield connection, cursor
        connection.commit()
    except Exception as e:
        connection.rollback()
        raise e
    finally:
        cursor.close()
        connection.close()
    

