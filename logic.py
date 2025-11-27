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
    # Si la distancia es larga, asumimos transporte aéreo (mayor factor por km)
    if distance >= 300:
        return round(distance * 0.25, 2)
    return round(distance * 0.15, 2)

def calc_duration(distance):
    """Duración en horas (60 km/h promedio)."""
    # Si la distancia es larga, asumimos vuelo: velocidad crucero ~800 km/h
    # y añadimos un tiempo fijo por vuelo (embarque/desembarque) ~1.5 h
    if distance >= 300:
        return round(distance / 800 + 1.5, 2)
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
    # Generar múltiples rutas simples (directas y con hasta 2 escalas)
    def generate_routes(origin, destination, budget, max_stops=2, max_results=3):
        results = []

        def dfs(current, path, visited, stops):
            # Si excede el número de escalas permitido, cortar
            if stops > max_stops:
                return

            # Si llegamos al destino (y la ruta tiene al menos un tramo), calcular métricas
            if current == destination and len(path) > 1:
                total_distance = 0
                total_duration = 0
                total_co2 = 0
                # Calcular métricas por tramo (asumiendo modo según distancia)
                for i in range(len(path) - 1):
                    leg = calc_distance(path[i], path[i+1])
                    total_distance += leg
                    total_duration += calc_duration(leg)
                    total_co2 += calc_co2(leg)
                cost = calc_cost(total_distance)
                if cost <= budget:
                    results.append({
                        "path": tuple(path),
                        "total_distance_km": round(total_distance, 2),
                        "total_cost": cost,
                        "total_co2": round(total_co2, 2),
                        "total_duration_h": round(total_duration, 2)
                    })
                return

            # Explorar siguientes ciudades (evitar ciclos)
            for nxt in cities:
                if nxt in visited:
                    continue
                # No necesitamos filtrar por existencia en `routes` porque `routes` contiene todas
                visited.add(nxt)
                dfs(nxt, path + [nxt], visited, stops + 1)
                visited.remove(nxt)

        dfs(origin, [origin], {origin}, 0)

        # Ordenar por costo y devolver hasta max_results rutas únicas
        # Evitar duplicados por camino
        unique = {}
        for r in sorted(results, key=lambda x: x["total_cost"]):
            key = "->".join(r["path"]) 
            if key not in unique:
                unique[key] = r
            if len(unique) >= max_results:
                break

        return list(unique.values())

    routes_found = generate_routes(origin, destination, budget, max_stops=2, max_results=3)
    if not routes_found:
        return None

    # Determinar la más barata y la más rápida (menor duración)
    cheapest = min(routes_found, key=lambda x: x["total_cost"])
    shortest = min(routes_found, key=lambda x: x["total_duration_h"])

    return {
        "cheapest": cheapest,
        "shortest": shortest,
        "all_routes": routes_found
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
