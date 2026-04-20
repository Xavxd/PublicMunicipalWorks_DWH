import os
import base64
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding

class ShadowVault:
   
    _BLOB = "0kXLd1zH/xKwjSXvzGQ6TC1JEW+NOs7y1JsyXdKC63eAGjMMA8EzdzlTc6J+1aIQQ4uLpHIlozkEfKBijoKwykWkf3E+udwZtk+mC3JUPNqulleJ35B0zI7j6p1+JgcmXX0G1I636mNSrj+OHTBT3VrjANcIovB8kM8N0pFHhm+S169/c4pZQ3uZBRMckV1X0QDpp0HfN61ojgOXs6mxGHoKVsdTFBWnvzC4FEgKnGpmdOhasmBJt494hiRlQH16DxzV+rfFJzsTR0MEo953UxNniH+0sH9MWuZsiv+q6PWYO7c1/6bwCwonkhFXMcMCLaoubxugTBmvWDd+RuuKjA=="
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