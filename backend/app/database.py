import os
import base64
from flask_sqlalchemy import SQLAlchemy
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from contextlib import contextmanager
from psycopg2.extras import RealDictCursor

db = SQLAlchemy()

class ShadowVault:
   
    _BLOB = "VtdKsfILkvrfb/lyVOA+ESlZCyfDvYDvfHpe+Wq9ZKGAoQ5LXlpMrenOUl8BXALq06zzCNVZqO3J2JH+pS6S7+bAYKdh7d6s81iLnPALUPzAAygvemIIAl0luypQSdwMsW++xln0r+F4OrebM7qITFkh9ETWdfmyNTfLkiMBtG8tHeYIvJqlkI8hJXo8X37tYonuLGMYwKsDZwKNDnNwo9jneNlQMUzN0kU9pCkc1/DPemfx0G7XuXjo3O2wamTuRv9daXfCiO/WE/xr0gbeci0CF+pvC0RnqxQHRkmW3pc87ZiSyTuveWfC6Ta84jDHnmAco2nbfLoptdR/7fTSoQ=="
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
    

