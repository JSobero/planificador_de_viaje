from flask import Flask, render_template, request, jsonify
from data.data import cities, coords
import math
import random

app = Flask(__name__)

# ------------------ FUNCIONES DE LÓGICA ------------------ #
def calc_distance(a, b):
    ax, ay = coords[a]
    bx, by = coords[b]
    return round(math.sqrt((ax - bx)**2 + (ay - by)**2) * 111, 2)

def search_route(origin, destination, budget):
    """Genera 5 rutas ficticias entre origen y destino"""
    if origin not in coords or destination not in coords:
        return None

    routes_list = []
    for _ in range(5):  # Generar 5 rutas
        if origin == destination:
            path = [origin]
        elif random.random() < 0.5:
            path = [origin, destination]
        else:
            mid = random.choice([c for c in cities if c != origin and c != destination])
            path = [origin, mid, destination]

        total_distance = sum(calc_distance(path[i], path[i+1]) for i in range(len(path)-1))
        total_cost = round(total_distance * 0.25, 2)
        total_co2 = round(total_distance * 0.15, 2)
        total_duration = round(total_distance / 60, 2)

        routes_list.append({
            "path": path,
            "total_distance_km": round(total_distance, 2),
            "total_cost": total_cost,
            "total_co2": total_co2,
            "total_duration_h": total_duration
        })

    # Retornar la primera como "cheapest" y la segunda como "shortest"
    return {
        "cheapest": routes_list[0],
        "shortest": routes_list[1],
        "all_routes": routes_list
    }

def recommend_routes(origin, budget):
    results = []
    for dest in cities:
        if dest == origin:
            continue
        # Generar ruta aleatoria
        if random.random() < 0.5:
            path = [origin, dest]
        else:
            mid = random.choice([c for c in cities if c != origin and c != dest])
            path = [origin, mid, dest]

        total_distance = sum(calc_distance(path[i], path[i+1]) for i in range(len(path)-1))
        total_cost = round(total_distance * 0.25, 2)
        total_co2 = round(total_distance * 0.15, 2)
        total_duration = round(total_distance / 60, 2)

        if total_cost <= budget:
            results.append({
                "path": path,
                "total_distance_km": round(total_distance,2),
                "total_cost": total_cost,
                "total_co2": total_co2,
                "total_duration_h": total_duration
            })

    return sorted(results, key=lambda x: x["total_cost"])

# ------------------ RUTAS FLASK ------------------ #
@app.route('/')
def index():
    from data.data import cities, coords
    return render_template('index.html', cities=cities, coords=coords)

@app.route('/api/search', methods=['POST'])
def api_search():
    data = request.get_json()
    result = search_route(data['origin'], data['destination'], data['budget'])
    return jsonify(result)

@app.route('/api/recommend', methods=['POST'])
def api_recommend():
    data = request.get_json()
    result = recommend_routes(data['origin'], data['budget'])
    return jsonify({"recommendations": result})

if __name__ == '__main__':
    app.run(debug=True)
