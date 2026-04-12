export interface NearbyPlace {
  name: string;
  address: string;
  phone?: string;
  distance: number; // km
  lat: number;
  lng: number;
  type: 'hospital' | 'fire_station' | 'police';
}

export async function findNearbyEmergencyServices(
  lat: number,
  lng: number,
  apiKey: string
): Promise<NearbyPlace[]> {
  const results: NearbyPlace[] = [];

  const types = [
    { type: 'hospital', name: 'Hastane' },
    { type: 'fire_station', name: 'İtfaiye' },
    { type: 'police', name: 'Polis' }
  ];

  for (const { type, name } of types) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=${type}&key=${apiKey}`
      );
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const place = data.results[0];
        const distance = calculateDistance(
          lat,
          lng,
          place.geometry.location.lat,
          place.geometry.location.lng
        );

        results.push({
          name: place.name,
          address: place.vicinity,
          distance: Math.round(distance * 10) / 10,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          type: type as any
        });
      }
    } catch (error) {
      console.error(`Error fetching ${name}:`, error);
    }
  }

  return results;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}