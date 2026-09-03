const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

let lastRequestTime = 0;
const MIN_INTERVAL = 1100; // Nominatim requires 1 req/sec

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const rateLimitedFetch = async (url) => {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL) {
    await wait(MIN_INTERVAL - elapsed);
  }
  lastRequestTime = Date.now();
  return fetch(url);
};

/**
 * Search for address suggestions
 * @param {string} query - Address text to search
 * @returns {Array<{displayName: string, lat: number, lng: number}>}
 */
export const searchAddresses = async (query) => {
  if (!query || query.trim().length < 3) return [];

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    countrycodes: 'ph',
    limit: '5',
    addressdetails: '1',
  });

  try {
    const res = await rateLimitedFetch(`${NOMINATIM_BASE}/search?${params}`);
    if (!res.ok) return [];

    const data = await res.json();
    return data.map((item) => ({
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.address,
    }));
  } catch {
    return [];
  }
};

/**
 * Reverse geocode coordinates to address
 * @param {number} lat
 * @param {number} lng
 * @returns {{displayName: string, address: object} | null}
 */
export const reverseGeocode = async (lat, lng) => {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    addressdetails: '1',
  });

  try {
    const res = await rateLimitedFetch(`${NOMINATIM_BASE}/reverse?${params}`);
    if (!res.ok) return null;

    const data = await res.json();
    return {
      displayName: data.display_name,
      address: data.address,
    };
  } catch {
    return null;
  }
};
