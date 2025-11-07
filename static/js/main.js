const cityCoords = JSON.parse(document.getElementById("coords-data").textContent);

let map = L.map('map').setView([-9.2, -75.0], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let routeLayer;
let chart;
let scatterChart;

document.getElementById("searchBtn").onclick = searchRoute;
document.getElementById("recommendBtn").onclick = recommend;

async function searchRoute() {
  const origin = document.getElementById("origin").value;
  const destination = document.getElementById("destination").value;
  const budget = parseFloat(document.getElementById("budget").value);

  const res = await axios.post("/api/search", { origin, destination, budget });
  const data = res.data;

  const routes = data.all_routes; // Tomar todas las rutas

  updateDashboard(routes);
}

async function recommend() {
  const origin = document.getElementById("origin").value;
  const budget = parseFloat(document.getElementById("budget").value);

  const res = await axios.post("/api/recommend", { origin, budget });
  const recs = res.data.recommendations;

  if (!recs.length) return alert("No hay rutas disponibles");

  updateDashboard(recs);
}

// ------------------- Helpers ------------------- //

function updateDashboard(routes) {
  // Filtrar duplicados
  const uniqueRoutes = [];
  const seen = new Set();
  routes.forEach(r => {
    const key = r.path.join("→");
    if (!seen.has(key)) {
      uniqueRoutes.push(r);
      seen.add(key);
    }
  });

  drawRoutes(uniqueRoutes);
  updateMetrics(uniqueRoutes);
  updateChart(uniqueRoutes);
  updateScatterChart(uniqueRoutes);
  showAllRoutes(uniqueRoutes);
}

function drawRoutes(routes) {
  if (routeLayer) map.removeLayer(routeLayer);
  routeLayer = L.layerGroup();

  routes.forEach((r, i) => {
    const color = i === 0 ? "cyan" : "#f59e0b";
    const pts = r.path.map(c => cityCoords[c]).filter(Boolean);
    L.polyline(pts, { color, weight: 3 }).addTo(routeLayer);
  });
  routeLayer.addTo(map);
}

function updateMetrics(routes) {
  if (!routes.length) return;

  const cheapest = routes.reduce((a,b) => a.total_cost < b.total_cost ? a : b);
  const shortest = routes.reduce((a,b) => a.total_distance_km < b.total_distance_km ? a : b);

  document.getElementById("stat-cheapest").textContent = cheapest.path.join(" → ");
  document.getElementById("stat-shortest").textContent = shortest.path.join(" → ");
  document.getElementById("stat-cost").textContent = `$${cheapest.total_cost}`;
  document.getElementById("stat-co2").textContent = `${cheapest.total_co2} kg`;
}

// function updateChart(routes) {
//   const ctx = document.getElementById("chart").getContext("2d");
//   const labels = routes.map(r => r.path.join(" → "));
//   const distances = routes.map(r => r.total_distance_km);
//   const costs = routes.map(r => r.total_cost);
//   const co2 = routes.map(r => r.total_co2);

//   if (chart) chart.destroy();
//   chart = new Chart(ctx, {
//     type: "bar",
//     data: { labels, datasets: [
//       { label: "Distancia (km)", data: distances, backgroundColor: "#3b82f6" },
//       { label: "Costo ($)", data: costs, backgroundColor: "#10b981" },
//       { label: "CO₂ (kg)", data: co2, backgroundColor: "#f97316" }
//     ]},
//     options: { 
//       responsive: true, 
//       maintainAspectRatio: false, // Proporcional al contenedor
//       scales:{ y:{ beginAtZero:true } }, 
//       plugins:{ legend:{ labels:{ color:"#fff" } } } 
//     }
//   });
// }
function updateChart(routes) {
  const ctx = document.getElementById("chart").getContext("2d");
  const labels = routes.map(r => r.path.join(" → "));
  const distances = routes.map(r => r.total_distance_km);
  const costs = routes.map(r => r.total_cost);
  const co2 = routes.map(r => r.total_co2);

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: { 
      labels, 
      datasets: [
        { label: "Distancia (km)", data: distances, backgroundColor: "#3b82f6" },
        { label: "Costo ($)", data: costs, backgroundColor: "#10b981" },
        { label: "CO₂ (kg)", data: co2, backgroundColor: "#f59e0b" }
      ]
    },
    options: { 
      responsive: true, 
      scales: {
        x: { 
          ticks: { color: "#fff" },
          title: { display: true, text: 'Rutas', color: "#fff" }
        },
        y: { 
          beginAtZero: true,
          ticks: { color: "#fff" },
          title: { display: true, text: 'Valor', color: "#fff" }
        }
      },
      plugins: { 
        legend: { labels: { color: "#fff" } },
        tooltip: { titleColor: "#fff", bodyColor: "#fff" }
      }
    }
  });
}


// function updateScatterChart(routes) {
//   const ctx = document.getElementById("scatterChart").getContext("2d");
//   const points = routes.map(r => ({x: r.total_cost, y: r.total_co2, label: r.path.join(" → ")}));

//   if (scatterChart) scatterChart.destroy();
//   scatterChart = new Chart(ctx, {
//     type: 'scatter',
//     data: { datasets: [{ label: "CO₂ vs Costo", data: points, backgroundColor: "#f87171" }] },
//     options: {
//       responsive: true,
//       maintainAspectRatio: false,
//       plugins: { tooltip: { callbacks: { label: ctx => ctx.raw.label + `: ($${ctx.raw.x}, ${ctx.raw.y}kg)` } } },
//       scales: { x:{ title:{ display:true, text:'Costo ($)' } }, y:{ title:{ display:true, text:'CO₂ (kg)' } } }
//     }
//   });
// }
function updateScatterChart(routes) {
  const ctx = document.getElementById("scatterChart").getContext("2d");
  const points = routes.map(r => ({x: r.total_cost, y: r.total_co2, label: r.path.join(" → ")}));

  if (scatterChart) scatterChart.destroy();
  scatterChart = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: [{ label: "CO₂ vs Costo", data: points, backgroundColor: "#f87171" }] },
    options: {
      responsive: true,
      plugins: { 
        tooltip: { callbacks: { 
          label: ctx => ctx.raw.label + `: ($${ctx.raw.x}, ${ctx.raw.y}kg)` 
        } },
        legend: { labels: { color: "#fff" } }
      },
      scales: { 
        x: { 
          title: { display: true, text: 'Costo ($)', color: "#fff" },
          ticks: { color: "#fff" }
        },
        y: { 
          title: { display: true, text: 'CO₂ (kg)', color: "#fff" },
          ticks: { color: "#fff" }
        }
      }
    }
  });
}



function showAllRoutes(routes) {
  const container = document.getElementById("allRoutes");
  container.innerHTML = "";
  routes.forEach(r => {
    const div = document.createElement("div");
    div.className = "bg-gray-700 p-2 rounded shadow hover:shadow-lg transition";
    div.innerHTML = `<b class="text-blue-300">${r.path.join(" → ")}</b> | Distancia: ${r.total_distance_km} km | Costo: $${r.total_cost} | CO₂: ${r.total_co2} kg`;
    container.appendChild(div);
  });
}
