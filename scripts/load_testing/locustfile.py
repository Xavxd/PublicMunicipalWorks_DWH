"""
Pruebas de Carga - Sistema Lakehouse Obras Públicas
"""

from locust import HttpUser, task, between
import random
import json


class ObrasPublicasUser(HttpUser):
    """
    Simulación de usuarios del sistema de obras públicas
    """
    wait_time = between(1, 3)  # Espera entre 1-3 segundos entre tareas
    
    # IDs de obras válidas para pruebas (ajustar según datos reales)
    test_obras_ids = [f"OBRA-{i:04d}" for i in range(1, 101)]
    
    @task(3)
    def get_all_obras(self):
        """
        Endpoint: GET /api/public/obras
        Métrica: Tiempo de respuesta del endpoint principal
        """
        with self.client.get(
            "/api/public/obras",
            name="/api/public/obras",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    response.success()
                else:
                    response.failure("Respuesta vacía o formato incorrecto")
            else:
                response.failure(f"Código {response.status_code}")
    
    @task(2)
    def get_obra_by_id(self):
        """
        Endpoint: GET /api/public/obras/{id}
        Métrica: Tiempo de consulta individual
        """
        obra_id = random.choice(self.test_obras_ids)
        with self.client.get(
            f"/api/public/obras/{obra_id}",
            name="/api/public/obras/[id]",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Código {response.status_code}")
    
    @task(2)
    def get_obras_con_retraso(self):
        """
        Endpoint: GET /api/public/obras/retraso
        Métrica: Tiempo de ejecución de vista v_obras_retraso
        """
        with self.client.get(
            "/api/public/obras/retraso",
            name="/api/public/obras/retraso",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Código {response.status_code}")
    
    @task(1)
    def get_alertas_auditoria(self):
        """
        Endpoint: GET /api/public/alertas
        Métrica: Tiempo de vista v_alertas_auditoria
        """
        with self.client.get(
            "/api/public/alertas",
            name="/api/public/alertas",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Código {response.status_code}")
    
    @task(1)
    def get_ejercicio_presupuestario(self):
        """
        Endpoint: GET /api/public/presupuesto/ejercicio
        Métrica: Tiempo de vista v_ejercicio_presupuestario
        """
        with self.client.get(
            "/api/public/presupuesto/ejercicio",
            name="/api/public/presupuesto/ejercicio",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Código {response.status_code}")


class DataLakeUser(HttpUser):
    """
    Simulación de carga de imágenes/evidencia
    """
    wait_time = between(2, 5)
    
    @task(1)
    def test_image_metadata_endpoint(self):
        """
        Endpoint: GET /api/public/imagenes/{id_obra}
        Métrica: Latencia de lectura de metadatos del Data Lake
        """
        obra_id = random.choice(ObrasPublicasUser.test_obras_ids)
        with self.client.get(
            f"/api/public/imagenes/{obra_id}",
            name="/api/public/imagenes/[id_obra]",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Código {response.status_code}")
