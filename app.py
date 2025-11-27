from flask import Flask, render_template, request, jsonify
from data.data import cities, coords
from logic import search_route, recommend_routes

app = Flask(__name__)

# ----------- RUTAS FLASK ----------
@app.route('/')
def index():
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
