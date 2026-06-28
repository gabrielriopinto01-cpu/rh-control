/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function distanceMeters(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 6371000 // raio da Terra em metros
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export interface Geofence {
  lat: number
  lng: number
  radius_m: number
}

/** Verifica se um ponto está dentro da cerca virtual. */
export function isWithinFence(
  lat: number, lng: number, fence: Geofence,
): boolean {
  return distanceMeters(lat, lng, fence.lat, fence.lng) <= fence.radius_m
}

/** Reverse geocoding best-effort via OpenStreetMap Nominatim (sem chave). */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } })
    if (!res.ok) return null
    const data = await res.json()
    return (data?.display_name as string) ?? null
  } catch {
    return null
  }
}
