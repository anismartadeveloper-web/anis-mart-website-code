export const storeConfig = {
  location: { latitude: -7.2575, longitude: 112.7521 },
  delivery: { perKilometer: 3000, minimum: 5000, textOnly: 10000 },
} as const

export function shippingQuote(
  deliveryMethod: 'ambil' | 'antar',
  latitude: number | null,
  longitude: number | null,
) {
  if (deliveryMethod === 'ambil') return { distanceKm: 0, fee: 0 }
  if (latitude === null || longitude === null) {
    return { distanceKm: null, fee: storeConfig.delivery.textOnly }
  }

  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = radians(latitude - storeConfig.location.latitude)
  const dLon = radians(longitude - storeConfig.location.longitude)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(storeConfig.location.latitude)) *
      Math.cos(radians(latitude)) *
      Math.sin(dLon / 2) ** 2
  const distanceKm = 6371 * 2 * Math.asin(Math.sqrt(a))
  const fee = Math.max(
    storeConfig.delivery.minimum,
    Math.ceil(distanceKm * storeConfig.delivery.perKilometer),
  )
  return { distanceKm, fee }
}
