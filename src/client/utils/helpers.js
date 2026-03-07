import lineMapping from '../line_mapping.json';
import lineDetails from '../line_details.json';
import { NOW_ARRIVAL_THRESHOLD, UPCOMING_ARRIVAL_THRESHOLD } from './constants';

/**
 * Format seconds to minutes string
 * @param {number} seconds - Time in seconds
 * @param {Function} translate - Translation function
 * @returns {string} Formatted time string (e.g., "5min")
 */
export const formatMinutes = (seconds, translate) => {
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}${translate('minutes')}`;
};

/**
 * Transliterate Serbian text to URL-safe format
 * @param {string} text - Text to transliterate
 * @returns {string} URL-safe string
 */
export const transliterateToUrl = (text) => {
  const serbianToLatin = {
    'đ': 'd', 'Đ': 'D',
    'č': 'c', 'Č': 'C',
    'ć': 'c', 'Ć': 'C',
    'ž': 'z', 'Ž': 'Z',
    'š': 's', 'Š': 'S',
    'dž': 'dz', 'Dž': 'Dz', 'DŽ': 'DZ',
    'lj': 'lj', 'Lj': 'Lj', 'LJ': 'LJ',
    'nj': 'nj', 'Nj': 'Nj', 'NJ': 'NJ'
  };

  let result = text;

  // Replace Serbian characters
  Object.entries(serbianToLatin).forEach(([key, value]) => {
    result = result.split(key).join(value);
  });

  // Convert to lowercase
  result = result.toLowerCase();

  // Replace spaces and special chars with hyphens
  result = result
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  return result;
};

/**
 * Generate BG Prevoz URL for a station
 * @param {string} stopId - Station stop ID
 * @param {string} name - Station name
 * @param {string} city - City code
 * @returns {string|null} Full URL to station page or null
 */
export const getStationUrl = (stopId, name, city) => {
  if (city !== 'BG') return null;
  const slug = transliterateToUrl(name);
  return `https://www.bgprevoz.rs/linije/stajalista/${stopId}/${slug}`;
};

/**
 * Generate BG Prevoz URL for a line
 * @param {string} lineNumber - Line number (e.g., "5", "7A", "2L")
 * @param {string} city - City code
 * @returns {string|null} Full URL to line page or null
 */
export const getLineUrl = (lineNumber, city) => {
  if (city !== 'BG') return null;

  // Use line mapping to get the correct kod_linije for URL
  const kodLinije = lineMapping[lineNumber];
  if (kodLinije) {
    return `https://www.bgprevoz.rs/linije/red-voznje/smer-a/${kodLinije}`;
  }

  // Fallback to lineNumber if not found in mapping
  return `https://www.bgprevoz.rs/linije/red-voznje/smer-a/${lineNumber}`;
};

/**
 * Get detailed information about a line
 * @param {string} lineNumber - Line number (e.g., "5", "7A", "2L")
 * @param {string} city - City code
 * @returns {string|null} Formatted tooltip text or null
 */
export const getLineTooltip = (lineNumber, city) => {
  if (city !== 'BG') return null;

  const details = lineDetails[lineNumber];
  if (!details) return null;

  // Build tooltip with line route
  let tooltip = lineNumber;

  // Add type and/or category if available
  const typeAndCategory = [];
  if (details.type) {
    typeAndCategory.push(details.type);
  }
  if (details.category) {
    typeAndCategory.push(details.category);
  }

  if (typeAndCategory.length > 0) {
    tooltip += ` (${typeAndCategory.join(' - ')})`;
  }

  // Add streets information (all streets from direction A)
  if (details.streetsA && details.streetsA.length > 0) {
    // Remove trailing '...' if present
    const streets = details.streetsA.filter(s => s !== '...');
    tooltip += `\n${streets.join(' → ')}`;
  }

  return tooltip;
};

/**
 * Determine transport type from line number and name
 */
export const getTransportType = (lineNumber, city, lineName = '') => {
  if (city === 'BG') {
    const type = lineDetails[lineNumber]?.type;
    if (type) return type;
  }

  // Fallback: keyword matching on lineName
  const name = (lineName || '').toLowerCase();
  if (name.includes('трол') || name.includes('trol')) return 'тролејбус';
  if (name.includes('трам') || name.includes('tram')) return 'трамвај';
  if (name.includes('воз') || name.includes('voz'))   return 'БГ-воз';

  // Line number prefix patterns
  const num = (lineNumber || '').toUpperCase();
  if (num.startsWith('N') || num.startsWith('Н')) return 'ноћне-линије';
  if (num.startsWith('E') || num.startsWith('Е')) return 'E linije';

  return 'аутобус';
};

// Visual config per transport type (matches bgprevoz.rs colour scheme)
export const TRANSPORT_CONFIG = {
  'аутобус':      { btnClass: 'bg-sky-600 hover:bg-sky-700 text-white' },
  'трамвај':      { btnClass: 'bg-red-600 hover:bg-red-700 text-white' },
  'тролејбус':    { btnClass: 'bg-orange-500 hover:bg-orange-600 text-white' },
  'ноћне-линије': { btnClass: 'bg-indigo-800 hover:bg-indigo-900 text-white' },
  'БГ-воз':       { btnClass: 'bg-purple-600 hover:bg-purple-700 text-white' },
  'E linije':     { btnClass: 'bg-green-600 hover:bg-green-700 text-white' },
  'минибус':      { btnClass: 'bg-teal-600 hover:bg-teal-700 text-white' },
};

/**
 * Check if vehicle data has changed
 * @param {Object} oldVehicle - Previous vehicle data
 * @param {Object} newVehicle - New vehicle data
 * @returns {boolean} True if vehicle data changed
 */
export const isVehicleChanged = (oldVehicle, newVehicle) => {
  return oldVehicle.secondsLeft !== newVehicle.secondsLeft ||
         oldVehicle.stationsBetween !== newVehicle.stationsBetween;
};

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - First point latitude
 * @param {number} lon1 - First point longitude
 * @param {number} lat2 - Second point latitude
 * @param {number} lon2 - Second point longitude
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Create a key for station identification
 * @param {string} stopId - Station stop ID
 * @param {string} city - City code
 * @returns {string} Unique station key
 */
export const createStationKey = (stopId, city) => {
  return `${stopId}-${city}`;
};

/**
 * Parse distance string to meters
 * @param {string} distanceStr - Distance string (e.g., "500m")
 * @returns {number} Distance in meters
 */
export const parseDistance = (distanceStr) => {
  return parseInt(distanceStr.replace(/\D/g, ''), 10);
};

/**
 * Extract line number from vehicle data
 * @param {Object} vehicle - Vehicle object
 * @returns {string} Line number
 */
export const extractLineNumber = (vehicle) => {
  return vehicle.lineNumber || '';
};

/**
 * Check if arrival is "now" (less than threshold)
 * @param {number} seconds - Time until arrival
 * @param {number} threshold - Threshold in seconds
 * @returns {boolean}
 */
export const isNowArrival = (seconds, threshold = NOW_ARRIVAL_THRESHOLD) => {
  return seconds < threshold;
};

/**
 * Check if arrival is upcoming (less than threshold)
 * @param {number} seconds - Time until arrival
 * @param {number} threshold - Threshold in seconds
 * @returns {boolean}
 */
export const isUpcomingArrival = (seconds, threshold = UPCOMING_ARRIVAL_THRESHOLD) => {
  return seconds < threshold;
};

/**
 * Get the soonest arrival from a list of arrivals
 * @param {Array} arrivals - Array of arrival objects
 * @returns {Object|null} Soonest arrival or null
 */
export const getSoonestArrival = (arrivals) => {
  if (!arrivals || arrivals.length === 0) return null;
  return arrivals.reduce((soonest, current) => {
    return current.secondsLeft < soonest.secondsLeft ? current : soonest;
  });
};

/**
 * Sort stations by distance
 * @param {Array} stations - Array of station objects
 * @returns {Array} Sorted stations
 */
export const sortStationsByDistance = (stations) => {
  return [...stations].sort((a, b) => {
    const distA = parseDistance(a.distance);
    const distB = parseDistance(b.distance);
    return distA - distB;
  });
};

/**
 * Sort stations by soonest arrival time
 * @param {Array} stations - Array of station objects
 * @returns {Array} Sorted stations
 */
export const sortStationsByArrivalTime = (stations) => {
  return [...stations].sort((a, b) => {
    const soonestA = getSoonestArrival(a.vehicles);
    const soonestB = getSoonestArrival(b.vehicles);

    if (!soonestA && !soonestB) return 0;
    if (!soonestA) return 1;
    if (!soonestB) return -1;

    return soonestA.secondsLeft - soonestB.secondsLeft;
  });
};

/**
 * Sort stations by name
 * @param {Array} stations - Array of station objects
 * @returns {Array} Sorted stations
 */
export const sortStationsByName = (stations) => {
  return [...stations].sort((a, b) => {
    return a.name.localeCompare(b.name);
  });
};
