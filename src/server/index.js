const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const crypto = require('./crypto');

const app = express();
const PORT = 3001;

// Cache configuration
const VEHICLE_CACHE_TTL = 30 * 1000; // 30 seconds for vehicle data
const STATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for station data

class Cache {
  constructor() {
    this.stationCache = new Map();
    this.vehicleCache = new Map();
    this.lastStationUpdate = null;
  }

  getStationCacheKey(city, stationId) {
    return `${city}:${stationId}`;
  }

  getVehicleCacheKey(city, stationId) {
    return `${city}:${stationId}:vehicles`;
  }

  getCachedStation(city, stationId) {
    const key = this.getStationCacheKey(city, stationId);
    const cached = this.stationCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < STATION_CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  getCachedVehicles(city, stationId) {
    const key = this.getVehicleCacheKey(city, stationId);
    const cached = this.vehicleCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < VEHICLE_CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  setCachedStation(city, stationId, data) {
    const key = this.getStationCacheKey(city, stationId);
    this.stationCache.set(key, {
      timestamp: Date.now(),
      data
    });
  }

  setCachedVehicles(city, stationId, data) {
    const key = this.getVehicleCacheKey(city, stationId);
    this.vehicleCache.set(key, {
      timestamp: Date.now(),
      data
    });
  }

  clearExpiredCache() {
    const now = Date.now();
    
    // Clear expired station cache
    for (const [key, value] of this.stationCache.entries()) {
      if (now - value.timestamp > STATION_CACHE_TTL) {
        this.stationCache.delete(key);
      }
    }
    
    // Clear expired vehicle cache
    for (const [key, value] of this.vehicleCache.entries()) {
      if (now - value.timestamp > VEHICLE_CACHE_TTL) {
        this.vehicleCache.delete(key);
      }
    }
  }
}

// Initialize cache
const cache = new Cache();

// Configuration
const apikeys = require('./apikeys.json');
let id_uid_map = {};
let allStations = {};

app.use(cors());

// Helper Functions
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // returns distance in meters
}

function transformAllStationsResponse(response) {
  let newResp = {};
  response.stations.map((value) => {
    let station = {};
    station.name = value.name;
    station.uid = value.id;
    station.id = value.station_id;
    station.coords = [value.coordinates.latitude, value.coordinates.longitude];
    newResp[station.uid] = station;
  });
  return newResp;
}

function transformStationResponse(response, city) {
  let newResp = {};
  newResp.city = city;
  newResp.name = response[0].station_name;
  newResp.uid = response[0].station_uid;
  newResp.id = getKeyByValue(id_uid_map[city], response[0].station_uid.toString()) || "0";
  newResp.stopId = response[0].station_id;
  newResp.coords = allStations[city][newResp.uid].coords;
  newResp.vehicles = [];

  if (response[0].just_coordinates == "1") return newResp;

  response.map((value) => {
    let vehicle = {};
    vehicle.lineNumber = value.line_number;
    vehicle.lineName = value.main_line_title;
    vehicle.secondsLeft = value.seconds_left;
    vehicle.stationsBetween = value.stations_between;
    vehicle.stationName = value.vehicles[0].station_name;
    vehicle.stopId = newResp.stopId;
    vehicle.garageNo = value.vehicles[0].garageNo;
    vehicle.coords = [value.vehicles[0].lat, value.vehicles[0].lng];
    newResp.vehicles.push(vehicle);
  });

  return newResp;
}

let mapReady = false;

async function populateMap(force = false) {
  mapReady = false;
  for (const city of Object.keys(apikeys)) {
    console.log(`Populating map for city: ${city}`);
    try {
      const url = `${apikeys[city].url}/publicapi/v1/networkextended.php?action=get_cities_extended`;
      const response = await getRequest(url, apikeys[city].key);
      const transformedStations = transformAllStationsResponse(response);
      allStations[city] = transformedStations;

      id_uid_map[city] = {};
      Object.values(transformedStations).forEach(station => {
        id_uid_map[city][station.id.toString()] = station.uid.toString();
      });

      console.info(`Populating map finished for ${city}`);
    } catch (err) {
      console.error(`Populating map failed for ${city}:`, err.message);
    }
  }
  mapReady = true;
}

app.use(async (req, res, next) => {
  if (!mapReady) {
    console.warn('Map is not ready yet. Waiting for initialization...');
    await populateMap();
  }
  next();
});

const getKeyByValue = (object, value) => {
  return Object.keys(object).find((key) => object[key] === value);
};

async function getRequest(url, apikey) {
  const headers = {
    "X-Api-Authentication": apikey,
    'User-Agent': 'okhttp/4.10.0'
  };

  const response = await axios.get(url, { headers, timeout: 5000 });
  if (response.status !== 200) {
    throw new Error(`Request failed with status code ${response.status}`);
  }

  return response.data;
}

async function postRequest(url, apikey, payload) {
  const headers = {
    "X-Api-Authentication": apikey,
    'User-Agent': 'okhttp/4.10.0'
  };
  
  const response = await axios.post(url, payload, { headers, timeout: 5000 });
  if (response.status !== 200) {
    throw new Error(`Request failed with status code ${response.status}`);
  }

  return response.data;
}

function getStationUid(city, query) {
  console.log(`getStationUid called for city: ${city}, query:`, query);

  if (query.uid) {
    console.log(`Query contains UID: ${query.uid}`);
    return query.uid.toString();
  }

  if (query.id) {
    if (!id_uid_map[city]) {
      console.error(`Map for city '${city}' is not populated yet`);
      throw new Error(`Map for ${city} is not populated yet`);
    }

    const uid = id_uid_map[city][query.id.toString()];
    if (!uid) {
      console.error(`Station ID ${query.id} not found in map for city: ${city}`);
      console.log('Current id_uid_map:', id_uid_map[city]);
      throw new Error(`Invalid station ID: ${query.id}`);
    }

    console.log(`Resolved Station ID ${query.id} to UID ${uid}`);
    return uid;
  }

  console.error(`Invalid query: ${JSON.stringify(query)}`);
  throw new Error("Invalid query");
}

async function getStationInfo(city, query) {
  const uid = getStationUid(city, query);
  const stationId = query.id;

  // Try to get cached station data
  let stationData = cache.getCachedStation(city, stationId);
  let vehicleData = cache.getCachedVehicles(city, stationId);

  if (!stationData) {
    // Fetch fresh station data
    if (apikeys[city].api === "v1") {
      const url = `${apikeys[city].url}/publicapi/v1/announcement/announcement.php?action=get_announcement_data&station_uid=${uid}`;
      const resp = await getRequest(url, apikeys[city].key);
      
      if (resp === "") throw new Error("Endpoint returned nothing");
      if (resp[0].success === false) throw new Error("Invalid station ID");
      
      stationData = transformStationResponse(resp, city);
      vehicleData = stationData.vehicles;
      
      // Cache station data without vehicles
      const stationDataWithoutVehicles = { ...stationData, vehicles: [] };
      cache.setCachedStation(city, stationId, stationDataWithoutVehicles);
      cache.setCachedVehicles(city, stationId, vehicleData);
    } else {
      const url = `${apikeys[city].url}/publicapi/v2/api.php`;
      let json = {
        station_uid: uid,
        session_id: `A${Date.now()}`,
      };
      let base = crypto.encrypt(JSON.stringify(json), apikeys[city].v2_key, apikeys[city].v2_iv);
      let payload = `action=data_bulletin&base=${base}`;

      let resp = await postRequest(url, apikeys[city].key, payload);
      if (resp === "") throw new Error("Endpoint returned nothing");

      let decoded = JSON.parse(crypto.decrypt(resp, apikeys[city].v2_key, apikeys[city].v2_iv));
      if (decoded["success"] == false) throw new Error("Invalid station ID");

      stationData = transformStationResponse(decoded["data"], city);
      vehicleData = stationData.vehicles;
      
      // Cache station data without vehicles
      const stationDataWithoutVehicles = { ...stationData, vehicles: [] };
      cache.setCachedStation(city, stationId, stationDataWithoutVehicles);
      cache.setCachedVehicles(city, stationId, vehicleData);
    }
  } else if (!vehicleData) {
    // If we have station data but need fresh vehicle data
    if (apikeys[city].api === "v1") {
      const url = `${apikeys[city].url}/publicapi/v1/announcement/announcement.php?action=get_announcement_data&station_uid=${uid}`;
      const resp = await getRequest(url, apikeys[city].key);
      
      if (resp === "") throw new Error("Endpoint returned nothing");
      if (resp[0].success === false) throw new Error("Invalid station ID");
      
      const freshData = transformStationResponse(resp, city);
      vehicleData = freshData.vehicles;
      cache.setCachedVehicles(city, stationId, vehicleData);
    } else {
      const url = `${apikeys[city].url}/publicapi/v2/api.php`;
      let json = {
        station_uid: uid,
        session_id: `A${Date.now()}`,
      };
      let base = crypto.encrypt(JSON.stringify(json), apikeys[city].v2_key, apikeys[city].v2_iv);
      let payload = `action=data_bulletin&base=${base}`;

      let resp = await postRequest(url, apikeys[city].key, payload);
      if (resp === "") throw new Error("Endpoint returned nothing");

      let decoded = JSON.parse(crypto.decrypt(resp, apikeys[city].v2_key, apikeys[city].v2_iv));
      if (decoded["success"] == false) throw new Error("Invalid station ID");

      const freshData = transformStationResponse(decoded["data"], city);
      vehicleData = freshData.vehicles;
      cache.setCachedVehicles(city, stationId, vehicleData);
    }
  }

  // Combine cached station data with vehicle data
  return {
    ...stationData,
    vehicles: vehicleData || []
  };
}

async function getAllStations(city, lat, lon, rad) {
  if (!id_uid_map[city] || !allStations[city]) {
    throw new Error(`id_uid_map or allStations for city ${city} is not populated. Please initialize it first.`);
  }

  const stations = Object.values(allStations[city]);
  const nearbyStations = stations
    .map(station => {
      const distance = calculateDistance(
        lat,
        lon,
        station.coords[0],
        station.coords[1]
      );
      return { ...station, distance };
    })
    .filter(station => station.distance <= rad)
    .sort((a, b) => a.distance - b.distance);

  const stationsWithRealTime = await Promise.all(
    nearbyStations.map(async (station) => {
      try {
        const realTimeData = await getStationInfo(city, { id: station.id });
        return {
          ...station,
          stopId: station.id,
          vehicles: realTimeData.vehicles || [],
        };
      } catch (error) {
        console.error(`Failed to fetch real-time data for station ${station.id}:`, error);
        return {
          ...station,
          vehicles: [],
        };
      }
    })
  );

  return stationsWithRealTime;
}

// API endpoints
app.get('/api/stations/:city/search', async (req, res) => {
  const city = req.params.city;
  try {
    const response = await getStationInfo(city, req.query);
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stations/:city/all', async (req, res) => {
  const city = req.params.city;
  const { lat, lon, rad } = req.query;

  try {
    if (!mapReady) {
      console.warn('Map is not ready yet. Initializing...');
      await populateMap();
    }

    const response = await getAllStations(city, parseFloat(lat), parseFloat(lon), parseInt(rad));
    res.json(response);
  } catch (err) {
    console.error(`Error fetching stations for city ${city}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Cache cleanup interval
setInterval(() => {
  cache.clearExpiredCache();
}, 5 * 60 * 1000); // Clean every 5 minutes

// Server initialization
const startServer = async () => {
  try {
    console.log('Initializing server...');
    await populateMap(true);

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

startServer();