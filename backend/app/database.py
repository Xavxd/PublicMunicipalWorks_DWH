import os
import base64
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding

class ShadowVault:
   
    _BLOB = "bZw1Z0rAXH5scY7AzxRE9IStf86hkBHJDNrPY27A8ZvkjENbc4tudULbXCF7Q2kWeF6F1eMYyeujPDWB3Hz/eay02yApLHIlIWPAnigrkgq2VxAeh1GASdkZM+GK/kCcsyyNhzfd4+oNkvb1UQjeJc8QjsU8HIahgi7bq+brdAhid18sJCJtQ/L8xv7Xx2J2MF+7Xg/mqmBkgBVvWPAXvhgj4GTbgEqXY+dRU9KEH+JRtzb3UwMjzFU6ip9vMPAekLRbj9JArXsVkwgfzoq1Kb2nhthivXWChFHNHMjeyHfK0TwIDqO6puwCycRGziP0q4/wIldAlxX0qhOSGkFKzw=="
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

@contextmanager
def get_db():
    """Manejo de conexiones vía Transaction Pooler (Puerto 6543)."""
    conn = psycopg2.connect(
        ShadowVault.get_url(),
        cursor_factory=psycopg2.extras.RealDictCursor,
        connect_timeout=5  
    )
    try:
        with conn:
            with conn.cursor() as cur:
                yield conn, cur
    finally:
       
        conn.close()
