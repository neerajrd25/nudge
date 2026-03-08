/**
 * Map Utilities
 */

/**
 * Decode an encoded polyline string into an array of [lat, lng] coordinates
 * Implementation of the Google Maps Polyline Algorithm
 * @param {string} encoded - The encoded polyline string
 * @returns {Array<[number, number]>} Array of [lat, lng] pairs
 */
export const decodePolyline = (encoded) => {
  if (!encoded) return [];
  
  const poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    const p = [lat / 1e5, lng / 1e5];
    poly.push(p);
  }
  
  return poly;
};

/**
 * Get the bounding box for a set of coordinates
 * @param {Array<[number, number]>} coords 
 * @returns {[[number, number], [number, number]]} [[minLat, minLng], [maxLat, maxLng]]
 */
export const getBounds = (coords) => {
  if (!coords || coords.length === 0) return null;
  
  let minLat = coords[0][0], maxLat = coords[0][0];
  let minLng = coords[0][1], maxLng = coords[0][1];
  
  for (let i = 1; i < coords.length; i++) {
    const [lat, lng] = coords[i];
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  
  return [[minLat, minLng], [maxLat, maxLng]];
};
