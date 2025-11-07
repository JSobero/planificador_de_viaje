# logic.py
from data.data import cities, coords, routes
import math

# ------------------ Funciones de distancia y métricas ------------------ #
def calc_distance(a, b):
    """Calcula distancia aproximada entre dos ciudades en km"""
    ax, ay = coords[a]
    bx, by = coords[b]
    return round(math.sqrt((ax - bx)**2 + (ay - by)**2) * 111, 2)

def calc_cost(distance):
    """Costo ficticio: $0.25 por km"""
    return round(distance * 0.25, 2)

def calc_co2(distance):
    """CO₂ emitido ficticio: 0.15 kg por km"""
    return round(distance * 0.15, 2)

def calc_duration(distance):
    """Duración ficticia en horas (velocidad promedio 60 km/h)"""
    return round(distance / 60, 2)

# ------------------ Funciones de rutas ------------------ #
def search_route(origin, destination, budget):
    """Busca la ruta más barata y más corta entre dos ciudades (simulada)"""
    if origin not in coords or destination not in coords:
        return None

    path = [origin, destination]
    distance = calc_distance(origin, destination)
    cost = calc_cost(distance)
    co2 = calc_co2(distance)
    duration = calc_duration(distance)

    return {
        "cheapest": {
            "path": path,
            "total_cost": cost,
            "total_distance_km": distance,
            "total_duration_h": duration,
            "total_co2": co2
        },
        "shortest": {
            "path": path,
            "total_cost": cost,
            "total_distance_km": distance,
            "total_duration_h": duration,
            "total_co2": co2
        }
    }

def recommend_routes(origin, budget):
    """Recomienda destinos accesibles desde el origen según presupuesto"""
    results = []
    for dest in cities:
        if dest == origin:
            continue
        d = calc_distance(origin, dest)
        cost = calc_cost(d)
        if cost <= budget:
            results.append({
                "destination": dest,
                "distance": d,
                "cost": cost,
                "co2": calc_co2(d)
            })
    return sorted(results, key=lambda x: x["cost"])
