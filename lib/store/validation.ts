import { z } from 'zod'

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(120),
  category: z.enum(['Snack', 'Minuman']),
  price: z.number().finite().positive('Harga normal harus lebih dari 0.').max(1_000_000_000),
  promo_price: z.number().finite().positive().max(1_000_000_000).nullable(),
  stock: z.number().int().min(0).max(1_000_000),
  extra_shipping_fee: z.number().finite().min(0).max(1_000_000_000),
  is_active: z.boolean(),
  image_url: z.string().url().nullable(),
  image_path: z.string().max(512).nullable(),
  description: z.string().trim().max(1000).nullable(),
}).refine((value) => value.promo_price === null || value.promo_price < value.price, {
  message: 'Harga promo harus lebih rendah dari harga normal.',
  path: ['promo_price'],
})

export type ProductInput = z.infer<typeof productSchema>

const coordinateDraftSchema = (label: string, minimum: number, maximum: number) => z.string()
  .trim()
  .min(1, `${label} wajib diisi.`)
  .transform((value) => Number(value.replace(',', '.')))
  .pipe(z.number().finite(`${label} harus berupa angka.`).min(minimum, `${label} minimal ${minimum}.`).max(maximum, `${label} maksimal ${maximum}.`))

export const storeLatitudeDraftSchema = coordinateDraftSchema('Latitude', -90, 90)
export const storeLongitudeDraftSchema = coordinateDraftSchema('Longitude', -180, 180)

export const storeSettingsSchema = z.object({
  store_name: z.string().trim().min(2).max(120),
  store_lat: z.number().finite().min(-90).max(90),
  store_lng: z.number().finite().min(-180).max(180),
  store_address: z.string().trim().min(8).max(500),
  tarif_dasar: z.number().finite().min(0).max(1_000_000_000),
  tarif_per_km: z.number().finite().min(0).max(1_000_000_000),
  jarak_gratis_km: z.number().finite().min(0).max(500),
  maks_jarak_km: z.number().finite().positive().max(500),
  ongkir_minimum: z.number().finite().min(0).max(1_000_000_000),
  gratis_ongkir_min_belanja: z.number().finite().min(0).max(1_000_000_000).nullable(),
})

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>
