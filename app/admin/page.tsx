import { redirect } from 'next/navigation'
import { AdminConsole } from '@/components/admin/admin-console'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role, username, display_name, avatar_url, is_active').eq('id', user.id).maybeSingle()
  if (profile?.is_active === false) redirect('/akun-nonaktif')
  if (profile?.role !== 'admin') redirect('/')

  const [productsResult, ordersResult, customersResult, settingsResult, paymentMethodsResult, params] = await Promise.all([
    supabase.from('products').select('id, sku, name, category, price, promo_price, extra_shipping_fee, stock, is_active, image_url, image_path, description, unit_size, unit_label, unit_note, created_at').order('created_at', { ascending: false }),
    supabase.from('orders').select('id, user_id, subtotal, shipping_fee, total_price, shipping_address, delivery_method, payment_method, payment_status, status, created_at, profiles(username), order_items(quantity, price, products(name))').order('created_at', { ascending: false }),
    supabase.rpc('admin_list_customers'),
    supabase.from('store_settings').select('id, store_name, store_lat, store_lng, store_address, tarif_dasar, tarif_per_km, jarak_gratis_km, maks_jarak_km, ongkir_minimum, gratis_ongkir_min_belanja, updated_at').eq('id', true).maybeSingle(),
    supabase.from('payment_methods').select('id, label, deskripsi, is_active, urutan').order('urutan'),
    searchParams,
  ])
  const errors = [productsResult.error, ordersResult.error, customersResult.error, settingsResult.error, paymentMethodsResult.error].filter(Boolean).map((error) => error!.message)

  return <AdminConsole
    username={profile.username ?? 'Admin'}
    displayName={profile.display_name?.trim() || profile.username || 'Admin'}
    email={user.email ?? ''}
    avatarUrl={profile.avatar_url}
    products={(productsResult.data ?? []) as never[]}
    orders={(ordersResult.data ?? []) as never[]}
    customers={(customersResult.data ?? []) as never[]}
    settings={(settingsResult.data ?? { id: true, store_name: 'Anis Mart', store_lat: -7.2575, store_lng: 112.7521, store_address: 'Alamat toko belum diatur', tarif_dasar: 0, tarif_per_km: 3000, jarak_gratis_km: 0, maks_jarak_km: 25, ongkir_minimum: 5000, gratis_ongkir_min_belanja: null, updated_at: new Date().toISOString() }) as never}
    paymentMethods={(paymentMethodsResult.data ?? []) as never[]}
    error={params.error ?? (errors.length ? `Sebagian data tidak dapat dimuat: ${errors.join(' · ')}` : undefined)}
  />
}
