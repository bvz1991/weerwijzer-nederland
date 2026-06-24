const DEFAULT_PLACE = { name: "De Bilt", admin1: "Utrecht", country: "Nederland", latitude: 52.1017, longitude: 5.1789 };
const CODES = {
  0:["Onbewolkt","☀️"],1:["Overwegend helder","🌤️"],2:["Halfbewolkt","⛅"],3:["Bewolkt","☁️"],
  45:["Mist","🌫️"],48:["Rijpmist","🌫️"],51:["Lichte motregen","🌦️"],53:["Motregen","🌦️"],
  55:["Zware motregen","🌧️"],56:["Lichte ijzelmotregen","🌧️"],57:["Zware ijzelmotregen","🌧️"],
  61:["Lichte regen","🌦️"],63:["Regen","🌧️"],65:["Zware regen","🌧️"],66:["Lichte ijzel","🌧️"],
  67:["Zware ijzel","🌧️"],71:["Lichte sneeuw","🌨️"],73:["Sneeuw","🌨️"],75:["Zware sneeuw","❄️"],
  77:["Sneeuwkorrels","🌨️"],80:["Lichte buien","🌦️"],81:["Buien","🌧️"],82:["Zware buien","⛈️"],
  85:["Lichte sneeuwbuien","🌨️"],86:["Zware sneeuwbuien","❄️"],95:["Onweer","⛈️"],
  96:["Onweer met hagel","⛈️"],99:["Zwaar onweer met hagel","⛈️"]
};
const DAYS = ["zo","ma","di","wo","do","vr","za"];
let currentPlace = JSON.parse(localStorage.getItem("weerwijzer-place") || "null") || DEFAULT_PLACE;
let weatherData = null;
let deferredInstallPrompt = null;
let searchTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const fmt = (value, decimals = 0, suffix = "") =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? "–" : `${Number(value).toFixed(decimals).replace(".", ",")}${suffix}`;
const weatherInfo = code => CODES[Number(code)] || ["Onbekend","🌡️"];
const windDirection = deg => ["N","NO","O","ZO","Z","ZW","W","NW"][Math.round(Number(deg || 0) / 45) % 8];
const hourlyIcon = (code, isDay) => {
  const numericCode = Number(code);
  if (Number(isDay) === 0 && numericCode <= 2) return numericCode === 2 ? "☾" : "🌙";
  return weatherInfo(numericCode)[1];
};
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
const placeLabel = place => [...new Set([place.name, place.admin1, place.country].filter(Boolean))].join(", ");

function setStatus(message = "", type = "") {
  const node = $("#status");
  node.textContent = message;
  node.className = message ? `status ${type}` : "status hidden";
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function weatherUrl(place) {
  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: "auto",
    forecast_days: "7",
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,is_day,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,uv_index",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max"
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

async function loadWeather(place = currentPlace) {
  setStatus("Actuele weergegevens ophalen…");
  $("#currentCard").classList.add("skeleton");
  try {
    weatherData = await getJson(weatherUrl(place));
    currentPlace = place;
    localStorage.setItem("weerwijzer-place", JSON.stringify(place));
    renderWeather();
    loadAirQuality();
    loadAlerts();
    setStatus("");
  } catch (error) {
    setStatus("De weergegevens zijn nu niet bereikbaar. Controleer je verbinding en probeer opnieuw.", "error");
  } finally {
    $("#currentCard").classList.remove("skeleton");
  }
}

function renderWeather() {
  const current = weatherData.current;
  const daily = weatherData.daily;
  const [description, icon] = weatherInfo(current.weather_code);
  $("#placeName").textContent = placeLabel(currentPlace);
  $("#updatedTime").textContent = `Bijgewerkt ${new Date(current.time).toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"})}`;
  $("#currentTemp").textContent = fmt(current.temperature_2m, 0, "°");
  $("#currentDescription").textContent = description;
  $("#feelsLike").textContent = `Voelt als ${fmt(current.apparent_temperature, 0, "°")}`;
  $("#currentIcon").textContent = icon;
  $("#rainNow").textContent = fmt(current.precipitation, 1, " mm");
  $("#windNow").textContent = `${fmt(current.wind_speed_10m, 0, " km/u")} ${windDirection(current.wind_direction_10m)}`;
  $("#gustNow").textContent = fmt(current.wind_gusts_10m, 0, " km/u");
  $("#humidityNow").textContent = fmt(current.relative_humidity_2m, 0, "%");
  renderForecast(daily);
  renderHourlyStrip(weatherData.hourly);
  renderHourlyDays(weatherData.hourly);
  renderRainChart(weatherData.hourly);
  renderDetails(current, daily);
}

function renderForecast(daily) {
  $("#forecast").innerHTML = daily.time.slice(0,5).map((dateText,index) => {
    const date = new Date(`${dateText}T12:00:00`);
    const [description, icon] = weatherInfo(daily.weather_code[index]);
    const day = index === 0 ? "Vandaag" : DAYS[date.getDay()].toUpperCase();
    return `<article class="day-card" title="${escapeHtml(description)}">
      <strong>${day}</strong><div class="date">${date.toLocaleDateString("nl-NL",{day:"numeric",month:"short"})}</div>
      <div class="weather-icon">${icon}</div>
      <strong>${fmt(daily.temperature_2m_max[index],0,"°")}</strong>
      <span class="low"> / ${fmt(daily.temperature_2m_min[index],0,"°")}</span>
      <div class="rain">💧 ${fmt(daily.precipitation_probability_max[index],0,"%")}</div>
    </article>`;
  }).join("");
}

function renderRainChart(hourly) {
  const now = Date.now();
  let start = hourly.time.findIndex(value => new Date(value).getTime() >= now - 3600000);
  if (start < 0) start = 0;
  const points = hourly.time.slice(start,start + 24).map((time,index) => ({
    time, rain: Number(hourly.precipitation[start + index] || 0),
    chance: Number(hourly.precipitation_probability[start + index] || 0)
  }));
  const maxRain = Math.max(1, ...points.map(point => point.rain));
  $("#rainChart").innerHTML = points.map((point,index) => {
    const rainHeight = Math.max(2, (point.rain / maxRain) * 80);
    const chanceBottom = Math.max(3, point.chance * .82);
    const label = index % 3 === 0 ? new Date(point.time).toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"}) : "";
    return `<div class="rain-column" title="${fmt(point.rain,1," mm")} · ${fmt(point.chance,0,"% kans")}">
      <div class="chance-dot" style="bottom:${chanceBottom}%"></div>
      <div class="rain-bar" style="height:${rainHeight}%"></div>
      <span class="rain-label">${label}</span>
    </div>`;
  }).join("");
}

function hourlyStartIndex(hourly) {
  const now = Date.now();
  const index = hourly.time.findIndex(value => new Date(value).getTime() >= now - 30 * 60 * 1000);
  return index < 0 ? 0 : index;
}

function hourlyPoint(hourly, index) {
  return {
    time: hourly.time[index],
    temperature: hourly.temperature_2m[index],
    feels: hourly.apparent_temperature[index],
    rain: hourly.precipitation[index],
    chance: hourly.precipitation_probability[index],
    code: hourly.weather_code[index],
    isDay: hourly.is_day[index],
    wind: hourly.wind_speed_10m[index],
    windDirection: hourly.wind_direction_10m[index],
    gust: hourly.wind_gusts_10m[index]
  };
}

function renderHourlyStrip(hourly) {
  const start = hourlyStartIndex(hourly);
  const points = hourly.time.slice(start, start + 12).map((_, offset) => hourlyPoint(hourly, start + offset));
  $("#hourlyPreviewTitle").textContent = `Komende uren in ${currentPlace.name || "jouw plaats"}`;
  $("#hourlyStrip").innerHTML = points.map((point, index) => {
    const date = new Date(point.time);
    const label = index === 0 ? "Nu" : date.toLocaleTimeString("nl-NL", {hour:"2-digit", minute:"2-digit"});
    const description = weatherInfo(point.code)[0];
    return `<article class="hour-card" title="${escapeHtml(description)}">
      <strong class="hour-time">${label}</strong>
      <span class="hour-icon">${hourlyIcon(point.code, point.isDay)}</span>
      <strong>${fmt(point.temperature,0,"°C")}</strong>
      <span>${windDirection(point.windDirection)} ${fmt(point.wind,0," km/u")}</span>
      <span class="hour-rain">${fmt(point.rain,1," mm")}</span>
      <small>${fmt(point.chance,0,"% kans")}</small>
    </article>`;
  }).join("");
}

function renderHourlyDays(hourly) {
  const start = hourlyStartIndex(hourly);
  const groups = new Map();
  hourly.time.slice(start).forEach((_, offset) => {
    const point = hourlyPoint(hourly, start + offset);
    const key = point.time.slice(0,10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
  });

  $("#hourlyDays").innerHTML = [...groups.entries()].slice(0,5).map(([dateText, points], dayIndex) => {
    const date = new Date(`${dateText}T12:00:00`);
    const dayLabel = dayIndex === 0
      ? `Vandaag · ${date.toLocaleDateString("nl-NL",{day:"numeric",month:"long"})}`
      : date.toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long"});
    const rows = points.map((point, pointIndex) => {
      const dateTime = new Date(point.time);
      const time = dayIndex === 0 && pointIndex === 0
        ? `Nu · ${dateTime.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"})}`
        : dateTime.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"});
      return `<tr>
        <th scope="row">${time}</th>
        <td class="weather-cell" title="${escapeHtml(weatherInfo(point.code)[0])}">${hourlyIcon(point.code, point.isDay)}</td>
        <td><strong>${fmt(point.temperature,0,"°C")}</strong></td>
        <td>${fmt(point.feels,0,"°C")}</td>
        <td><strong>${fmt(point.rain,1," mm")}</strong></td>
        <td>${fmt(point.chance,0,"%")}</td>
        <td><span class="wind-value">${windDirection(point.windDirection)} ${fmt(point.wind,0," km/u")}</span>
          <span class="wind-arrow" style="transform:rotate(${Number(point.windDirection || 0)}deg)">↓</span></td>
        <td>${fmt(point.gust,0," km/u")}</td>
      </tr>`;
    }).join("");
    return `<details class="hourly-day" ${dayIndex === 0 ? "open" : ""}>
      <summary>
        <span>${dayLabel}</span>
        <small>${fmt(Math.min(...points.map(point => Number(point.temperature))),0,"°")} – ${fmt(Math.max(...points.map(point => Number(point.temperature))),0,"°")}</small>
      </summary>
      <div class="hour-table-wrap">
        <table class="hour-table">
          <thead><tr><th>Tijd</th><th>Weer</th><th>Temp.</th><th>Gevoel</th><th>Neerslag</th><th>Kans</th><th>Wind</th><th>Stoten</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </details>`;
  }).join("");
}

function renderDetails(current, daily) {
  const sunrise = new Date(daily.sunrise[0]).toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"});
  const sunset = new Date(daily.sunset[0]).toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"});
  const details = [
    ["Bewolking",fmt(current.cloud_cover,0,"%")],
    ["Luchtdruk",fmt(current.surface_pressure,0," hPa")],
    ["Windrichting",`${windDirection(current.wind_direction_10m)} · ${fmt(current.wind_direction_10m,0,"°")}`],
    ["UV-index",fmt(daily.uv_index_max[0],1)],
    ["Zonsopkomst",sunrise],
    ["Zonsondergang",sunset],
    ["Neerslag vandaag",fmt(daily.precipitation_sum[0],1," mm")],
    ["Maximale wind",fmt(daily.wind_speed_10m_max[0],0," km/u")],
    ["Maximale windstoot",fmt(daily.wind_gusts_10m_max[0],0," km/u")]
  ];
  $("#detailsGrid").innerHTML = details.map(([label,value]) =>
    `<div class="detail-card"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

async function loadAirQuality() {
  const params = new URLSearchParams({
    latitude: currentPlace.latitude, longitude: currentPlace.longitude, timezone: "auto",
    current: "european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,alder_pollen,birch_pollen,grass_pollen"
  });
  try {
    const data = await getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
    const air = data.current || {};
    const aqi = Number(air.european_aqi);
    const level = aqi <= 20 ? "Zeer goed" : aqi <= 40 ? "Goed" : aqi <= 60 ? "Matig" : aqi <= 80 ? "Slecht" : aqi <= 100 ? "Zeer slecht" : "Extreem slecht";
    $("#airContent").innerHTML = `<div class="aqi-head"><span class="soft">Europese luchtkwaliteitsindex</span><br><strong>${fmt(aqi,0)} · ${level}</strong></div>
      <div class="details-grid">
        <div class="detail-card"><span>Fijnstof PM2,5</span><strong>${fmt(air.pm2_5,1," µg/m³")}</strong></div>
        <div class="detail-card"><span>Fijnstof PM10</span><strong>${fmt(air.pm10,1," µg/m³")}</strong></div>
        <div class="detail-card"><span>Ozon</span><strong>${fmt(air.ozone,1," µg/m³")}</strong></div>
        <div class="detail-card"><span>Graspollen</span><strong>${fmt(air.grass_pollen,1," /m³")}</strong></div>
        <div class="detail-card"><span>Berkpollen</span><strong>${fmt(air.birch_pollen,1," /m³")}</strong></div>
        <div class="detail-card"><span>Elspollen</span><strong>${fmt(air.alder_pollen,1," /m³")}</strong></div>
      </div>`;
  } catch {
    $("#airContent").innerHTML = `<div class="notice">Luchtkwaliteitsgegevens zijn tijdelijk niet beschikbaar.</div>`;
  }
}

async function loadAlerts() {
  try {
    const response = await fetch("/api/alerts");
    if (!response.ok) throw new Error();
    const xml = await response.text();
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const entries = [...doc.querySelectorAll("entry")].map(entry => ({
      title: entry.querySelector("title")?.textContent?.trim() || "Weerwaarschuwing",
      summary: entry.querySelector("summary")?.textContent?.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim() || ""
    })).filter(item => !/green|groen|no warnings/i.test(`${item.title} ${item.summary}`));
    $("#alertList").innerHTML = entries.length
      ? entries.slice(0,10).map(item => `<article class="alert-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.summary.slice(0,500))}</p></article>`).join("")
      : `<div class="notice">Geen actieve Meteoalarm-waarschuwingen voor Nederland gevonden.</div>`;
  } catch {
    $("#alertList").innerHTML = `<div class="notice">Automatisch ophalen lukt op deze hosting nog niet. Gebruik hieronder de officiële KNMI- en Meteoalarm-links.</div>`;
  }
}

async function searchPlaces(query) {
  const box = $("#searchResults");
  if (query.trim().length < 2) { box.classList.add("hidden"); return; }
  try {
    const params = new URLSearchParams({name:query.trim(),count:"7",language:"nl",format:"json"});
    const data = await getJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    const results = data.results || [];
    box.innerHTML = results.length ? results.map((place,index) =>
      `<button data-index="${index}"><b>${escapeHtml(place.name)}</b><small>${escapeHtml([place.admin1,place.country].filter(Boolean).join(", "))}</small></button>`
    ).join("") : `<div class="notice">Geen plaats gevonden.</div>`;
    box.classList.remove("hidden");
    box.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
      const place = results[Number(button.dataset.index)];
      $("#searchInput").value = "";
      box.classList.add("hidden");
      loadWeather(place);
    }));
  } catch {
    box.innerHTML = `<div class="notice">Zoeken is tijdelijk niet beschikbaar.</div>`;
    box.classList.remove("hidden");
  }
}

async function useLocation() {
  if (!navigator.geolocation) return setStatus("Deze browser ondersteunt geen locatiebepaling.", "error");
  setStatus("Wachten op toestemming voor je locatie…");
  navigator.geolocation.getCurrentPosition(async position => {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    let place = {name:"Huidige locatie",admin1:"",country:"",latitude,longitude};
    try {
      const params = new URLSearchParams({latitude,longitude,localityLanguage:"nl"});
      const data = await getJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`);
      place = {name:data.city || data.locality || "Huidige locatie",admin1:data.principalSubdivision || "",country:data.countryName || "",latitude,longitude};
    } catch {}
    loadWeather(place);
  }, error => setStatus(error.code === 1 ? "Locatietoegang is geweigerd. Zoek handmatig een plaats of sta locatie toe in je browser." : "Je locatie kon niet worden bepaald.", "error"), {
    enableHighAccuracy:false, timeout:10000, maximumAge:300000
  });
}

function setupTabs() {
  $$(".tab").forEach(button => button.addEventListener("click", () => {
    $$(".tab").forEach(tab => tab.classList.toggle("active", tab === button));
    $$(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === button.dataset.tab));
  }));
  $$("[data-open-tab]").forEach(button => button.addEventListener("click", () => {
    const target = button.dataset.openTab;
    const tab = $(`.tab[data-tab="${target}"]`);
    if (tab) {
      tab.click();
      tab.scrollIntoView({behavior:"smooth", block:"center", inline:"center"});
    }
  }));
}

function setupInstallation() {
  const button = $("#installButton");
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    button.classList.remove("hidden");
  });
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (isiOS && !standalone) button.classList.remove("hidden");
  button.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      button.classList.add("hidden");
    } else if (isiOS) {
      $("#iosInstallDialog").showModal();
    } else {
      setStatus("Open het browsermenu en kies ‘App installeren’ of ‘Toevoegen aan startscherm’.", "success");
    }
  });
  $(".dialog-close").addEventListener("click", () => $("#iosInstallDialog").close());
}

$("#searchInput").addEventListener("input", event => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => searchPlaces(event.target.value), 350);
});
$("#locationButton").addEventListener("click", useLocation);
$("#refreshButton").addEventListener("click", () => loadWeather());
document.addEventListener("click", event => {
  if (!event.target.closest(".search-panel")) $("#searchResults").classList.add("hidden");
});

setupTabs();
setupInstallation();
loadWeather().then(() => {
  if (new URLSearchParams(window.location.search).get("location") === "1") useLocation();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
}
