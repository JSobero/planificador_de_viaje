const cityCoords = JSON.parse(document.getElementById("coords-data").textContent);

let map = L.map('map').setView([-9.2, -75.0], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let routeLayer;
let chart;
let scatterChart;
let valueChart;
let routePolylines = [];
let selectedPolyline = null;
const routeColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f472b6"];

// Formatea duración en horas decimales a "H h M min"
function formatDuration(hours) {
  if (hours === undefined || hours === null || isNaN(hours)) return "-";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h} h ${m} min`;
}

document.getElementById("searchBtn").onclick = searchRoute;
document.getElementById("recommendBtn").onclick = recommend;

// ---------- BUSCAR RUTA ----------
async function searchRoute() {
  const origin = document.getElementById("origin").value;
  const destination = document.getElementById("destination").value;
  const budget = parseFloat(document.getElementById("budget").value);

  try {
    const res = await axios.post("/api/search", { origin, destination, budget });
    const data = res.data;

    if (!data || !data.all_routes || data.all_routes.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Ruta no disponible",
        text: "No se encontró una ruta factible con el presupuesto indicado.",
        confirmButtonColor: "#3b82f6"
      });
      return;
    }

    updateDashboard(data.all_routes);
  } catch (error) {
    console.error(error);
    Swal.fire({
      icon: "error",
      title: "Error en la búsqueda",
      text: "Ocurrió un error al procesar la solicitud.",
      confirmButtonColor: "#ef4444"
    });
  }
}

// ---------- RECOMENDAR -----------
async function recommend() {
  const origin = document.getElementById("origin").value;
  const budget = parseFloat(document.getElementById("budget").value);

  try {
    const res = await axios.post("/api/recommend", { origin, budget });
    const data = res.data;

    if (!data || !data.recommendations || data.recommendations.length === 0) {
      Swal.fire({
        icon: "info",
        title: "Sin recomendaciones",
        text: "No se encontraron destinos posibles dentro de tu presupuesto.",
        confirmButtonColor: "#3b82f6"
      });
      return;
    }

    updateDashboard(data.recommendations);
  } catch (error) {
    console.error(error);
    Swal.fire({
      icon: "error",
      title: "Error en la recomendación",
      text: "Ocurrió un problema al generar las recomendaciones.",
      confirmButtonColor: "#ef4444"
    });
  }
}

// ------- DASHBOARD --------
function updateDashboard(routes) {
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
  updateValueChart(uniqueRoutes);
  showAllRoutes(uniqueRoutes);
}

// ----------- MAPA ---------
function drawRoutes(routes) {
  if (routeLayer) map.removeLayer(routeLayer);
  routeLayer = L.layerGroup();
  routePolylines = [];

  routes.forEach((r, i) => {
    const color = routeColors[i % routeColors.length];
    const pts = r.path.map(c => cityCoords[c]).filter(Boolean);
    const poly = L.polyline(pts, { color, weight: 3, opacity: 0.9 });
    poly.addTo(routeLayer);

    // Guardar referencia y enlazar eventos para interactividad
    poly.routeIndex = i;
    routePolylines.push(poly);

    poly.on('click', function(e) {
      // Resetear estilo de todas
      routePolylines.forEach(p => { p.setStyle({ weight: 3, opacity: 0.9 }); p.selected = false; });
      // Resaltar seleccionado
      this.setStyle({ weight: 6, opacity: 1 });
      this.selected = true;
      selectedPolyline = this;

      // Mostrar popup con detalles de la ruta
      const route = routes[this.routeIndex];
        const popupContent = `<b>Ruta</b><br>${route.path.join(' → ')}<br>Dist: ${route.total_distance_km} km<br>Costo: $${route.total_cost}<br>Duración: ${formatDuration(route.total_duration_h)}<br>CO₂: ${route.total_co2} kg`;
      this.bindPopup(popupContent).openPopup(e.latlng);

      // Actualizar métricas principales para reflejar la ruta seleccionada
      document.getElementById("stat-cost").textContent = `$${route.total_cost}`;
        document.getElementById("stat-duration").textContent = formatDuration(route.total_duration_h);
        const co2Elem = document.getElementById("stat-co2");
        if (co2Elem) co2Elem.textContent = `${route.total_co2} kg`;
      // Resaltar barra correspondiente en el gráfico de Costo por hora
      highlightValueBar(this.routeIndex);
    });

    poly.on('mouseover', function() { if (!this.selected) this.setStyle({ weight: 5 }); });
    poly.on('mouseout', function() { if (!this.selected) this.setStyle({ weight: 3 }); });
  });
  routeLayer.addTo(map);

  // Ajustar vista para incluir todas las rutas dibujadas
  try {
    const bounds = routeLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  } catch (err) {
    // ignore
  }
}

// -------- MÉTRICAS ---------
function updateMetrics(routes) {
  if (!routes.length) return;

  const cheapest = routes.reduce((a,b) => a.total_cost < b.total_cost ? a : b);
  const shortest = routes.reduce((a,b) => a.total_duration_h < b.total_duration_h ? a : b);

  document.getElementById("stat-cheapest").textContent = cheapest.path.join(" → ");
  document.getElementById("stat-shortest").textContent = shortest.path.join(" → ");
  document.getElementById("stat-cost").textContent = `$${cheapest.total_cost}`;
  document.getElementById("stat-duration").textContent = formatDuration(cheapest.total_duration_h);
  const co2Elem = document.getElementById("stat-co2");
  if (co2Elem) co2Elem.textContent = `${cheapest.total_co2} kg`;
}

// ------- GRÁFICOS ----------
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

function updateScatterChart(routes) {
  const ctx = document.getElementById("scatterChart").getContext("2d");
  const points = routes.map(r => ({x: r.total_cost, y: r.total_duration_h, label: r.path.join(" → ")}));

  if (scatterChart) scatterChart.destroy();
  scatterChart = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: [{ label: "Tiempo vs Costo", data: points, backgroundColor: "#f87171" }] },
    options: {
      responsive: true,
      plugins: { 
        tooltip: { callbacks: { 
          label: ctx => ctx.raw.label + `: ($${ctx.raw.x}, ${formatDuration(ctx.raw.y)})` 
        } },
        legend: { labels: { color: "#fff" } }
      },
      scales: { 
        x: { 
          title: { display: true, text: 'Costo ($)', color: "#fff" },
          ticks: { color: "#fff" }
        },
        y: { 
          title: { display: true, text: 'Duración (h)', color: "#fff" },
          ticks: { color: "#fff" }
        }
      }
    }
  });
}

// -------- LISTA DE RUTAS -------
function showAllRoutes(routes) {
  const container = document.getElementById("allRoutes");
  container.innerHTML = "";
  routes.forEach((r, i) => {
    const div = document.createElement("div");
    div.className = "bg-gray-700 p-2 rounded shadow hover:shadow-lg transition cursor-pointer";
    div.innerHTML = `<b class="text-blue-300">${r.path.join(" → ")}</b> | Distancia: ${r.total_distance_km} km | Costo: $${r.total_cost} | Duración: ${formatDuration(r.total_duration_h)} | CO₂: ${r.total_co2} kg`;
    div.onclick = () => {
      if (routePolylines[i]) {
        // Simular click en la polilínea correspondiente
        routePolylines.forEach(p => { p.setStyle({ weight: 3, opacity: 0.9 }); p.selected = false; });
        routePolylines[i].fire('click');
        try { map.fitBounds(routePolylines[i].getBounds(), { padding: [40, 40] }); } catch (err) {}
        // Resaltar barra correspondiente
        highlightValueBar(i);
      }
    };
    container.appendChild(div);
  });
}

// Actualiza gráfico de Costo por hora (Costo / Duración)
function updateValueChart(routes) {
  const el = document.getElementById('valueChart');
  if (!el) return;
  const ctx = el.getContext('2d');
  const labels = routes.map(r => r.path.join(' → '));
  const values = routes.map(r => {
    const dur = parseFloat(r.total_duration_h) || 0;
    return dur > 0 ? parseFloat((r.total_cost / dur).toFixed(2)) : parseFloat(r.total_cost.toFixed(2));
  });

  const bg = labels.map((_, i) => routeColors[i % routeColors.length]);

  if (valueChart) valueChart.destroy();
  valueChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Costo por hora ($/h)', data: values, backgroundColor: bg }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      scales: {
        x: { ticks: { color: '#fff' }, title: { display: true, text: '$ / h', color: '#fff' } },
        y: { ticks: { color: '#fff' }, title: { display: false } }
      },
      plugins: { legend: { labels: { color: '#fff' } } },
      onClick: (evt, elements) => {
        if (elements && elements.length) {
          const idx = elements[0].index;
          if (routePolylines[idx]) routePolylines[idx].fire('click');
        }
      }
    }
  });
}

function highlightValueBar(index) {
  if (!valueChart) return;
  const ds = valueChart.data.datasets[0];
  const n = ds.data.length;
  const bg = [];
  const border = [];
  const bw = [];
  for (let i = 0; i < n; i++) {
    if (i === index) {
      bg.push('#ffee58');
      border.push('#ffd600');
      bw.push(2);
    } else {
      bg.push(routeColors[i % routeColors.length]);
      border.push('#00000000');
      bw.push(0);
    }
  }
  ds.backgroundColor = bg;
  ds.borderColor = border;
  ds.borderWidth = bw;
  valueChart.update();
}
