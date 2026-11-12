/** Dünya ortalama yarıçapı (metre). */
const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Geçerli bir WGS84 koordinatı mı? (0,0 "Null Island" ve NaN reddedilir.) */
export function isValidCoord(lat: unknown, lng: unknown): lat is number {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  return !(lat === 0 && lng === 0);
}

/** İki koordinat arasındaki büyük çember mesafesi (Haversine, metre). */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}
