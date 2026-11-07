export interface City {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  /** Former name the user typed, when the match came from it */
  formerly?: string;
}

/** Small offline list until the engine's geocode() is wired in. */
export const CITIES: City[] = [
  { name: 'New Delhi, India', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' },
  { name: 'Mumbai, India', latitude: 19.076, longitude: 72.8777, timezone: 'Asia/Kolkata' },
  { name: 'Bengaluru, India', latitude: 12.9716, longitude: 77.5946, timezone: 'Asia/Kolkata' },
  { name: 'Chennai, India', latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata' },
  { name: 'Kolkata, India', latitude: 22.5726, longitude: 88.3639, timezone: 'Asia/Kolkata' },
  { name: 'Puducherry, India', latitude: 11.9416, longitude: 79.8083, timezone: 'Asia/Kolkata' },
  { name: 'Pune, India', latitude: 18.5204, longitude: 73.8567, timezone: 'Asia/Kolkata' },
  { name: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867, timezone: 'Asia/Kolkata' },
  { name: 'Varanasi, India', latitude: 25.3176, longitude: 82.9739, timezone: 'Asia/Kolkata' },
  { name: 'Kathmandu, Nepal', latitude: 27.7172, longitude: 85.324, timezone: 'Asia/Kathmandu' },
  { name: 'Colombo, Sri Lanka', latitude: 6.9271, longitude: 79.8612, timezone: 'Asia/Colombo' },
  { name: 'Dubai, UAE', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai' },
  { name: 'London, UK', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
  { name: 'Paris, France', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' },
  { name: 'Berlin, Germany', latitude: 52.52, longitude: 13.405, timezone: 'Europe/Berlin' },
  { name: 'New York, USA', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' },
  { name: 'Chicago, USA', latitude: 41.8781, longitude: -87.6298, timezone: 'America/Chicago' },
  { name: 'Houston, USA', latitude: 29.7604, longitude: -95.3698, timezone: 'America/Chicago' },
  { name: 'Atlanta, USA', latitude: 33.749, longitude: -84.388, timezone: 'America/New_York' },
  { name: 'Los Angeles, USA', latitude: 34.0522, longitude: -118.2437, timezone: 'America/Los_Angeles' },
  { name: 'San Francisco, USA', latitude: 37.7749, longitude: -122.4194, timezone: 'America/Los_Angeles' },
  { name: 'Toronto, Canada', latitude: 43.6532, longitude: -79.3832, timezone: 'America/Toronto' },
  { name: 'Mexico City, Mexico', latitude: 19.4326, longitude: -99.1332, timezone: 'America/Mexico_City' },
  { name: 'São Paulo, Brazil', latitude: -23.5505, longitude: -46.6333, timezone: 'America/Sao_Paulo' },
  { name: 'Lagos, Nigeria', latitude: 6.5244, longitude: 3.3792, timezone: 'Africa/Lagos' },
  { name: 'Nairobi, Kenya', latitude: -1.2921, longitude: 36.8219, timezone: 'Africa/Nairobi' },
  { name: 'Singapore', latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore' },
  { name: 'Tokyo, Japan', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo' },
  { name: 'Sydney, Australia', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' },
];
