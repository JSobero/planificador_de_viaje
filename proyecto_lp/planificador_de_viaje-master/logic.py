# logic.py
from data.data import cities, coords, routes
import math
from pyDatalog import pyDatalog

# --------- Funciones puras -----------
def calc_distance(a, b):
    """Calcula distancia entre dos ciudades en km."""
    ax, ay = coords[a]
    bx, by = coords[b]
    return round(math.sqrt((ax - bx)**2 + (ay - by)**2) * 111, 2)

def calc_cost(distance):
    """Costo ficticio ($0.25 por km)."""
    return round(distance * 0.25, 2)

def calc_co2(distance):
    """CO₂ emitido ficticio (0.15 kg/km)."""
    return round(distance * 0.15, 2)

def calc_duration(distance):
    """Duración en horas (60 km/h promedio)."""
    return round(distance / 60, 2)

# ---------- Programación Lógica -----------
pyDatalog.clear()
pyDatalog.create_terms('City, Route, FeasibleRoute, O, D, Dist, B')

# Hechos: ciudades disponibles
for c in cities:
    + City(c)

# Hechos: rutas directas con distancias precalculadas
for (a, b) in routes:
    dist = calc_distance(a, b)
    + Route(a, b, dist)

# Regla: una ruta es factible si el costo (Dist * 0.25) <= presupuesto
FeasibleRoute(O, D, B) <= (Route(O, D, Dist)) & (Dist * 0.25 <= B)

# ----------- Funciones FP + LP -----------
def search_route(origin, destination, budget):
    """Busca ruta entre dos ciudades si es factible."""
    from pyDatalog import pyDatalog
    pyDatalog.clear()
    pyDatalog.create_terms('City, Route, FeasibleRoute, O, D, Dist, B')
    for c in cities:
        + City(c)
    for (a, b) in routes:
        dist = calc_distance(a, b)
        + Route(a, b, dist)
    FeasibleRoute(O, D, B) <= (Route(O, D, Dist)) & (Dist * 0.25 <= B)

    res = FeasibleRoute(origin, destination, budget)
    if not res:
        return None

    distance = calc_distance(origin, destination)
    cost = calc_cost(distance)
    co2 = calc_co2(distance)
    duration = calc_duration(distance)

    route = {
        "path": (origin, destination),
        "total_cost": cost,
        "total_distance_km": distance,
        "total_duration_h": duration,
        "total_co2": co2
    }

    return {
        "cheapest": route,
        "shortest": route,
        "all_routes": [route]
    }


def recommend_routes(origin, budget):
    """Recomienda destinos factibles según presupuesto."""
    from pyDatalog import pyDatalog
    pyDatalog.clear()
    pyDatalog.create_terms('City, Route, FeasibleRoute, O, D, Dist, B')
    for c in cities:
        + City(c)
    for (a, b) in routes:
        dist = calc_distance(a, b)
        + Route(a, b, dist)
    FeasibleRoute(O, D, B) <= (Route(O, D, Dist)) & (Dist * 0.25 <= B)

    feasible = FeasibleRoute(origin, D, budget)
    if not feasible:
        return []

    results = []
    for dest in feasible:
        dest_city = dest[0]
        distance = calc_distance(origin, dest_city)
        cost = calc_cost(distance)
        co2 = calc_co2(distance)
        duration = calc_duration(distance)
        results.append({
            "path": (origin, dest_city),
            "total_distance_km": distance,
            "total_cost": cost,
            "total_co2": co2,
            "total_duration_h": duration
        })

    return sorted(results, key=lambda x: x["total_cost"])
