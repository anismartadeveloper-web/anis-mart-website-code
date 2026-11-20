import { redirect } from 'next/navigation'
import { OrderHistory, type Order } from '@/components/storefront/order-history'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Pesanan Saya — Anis Mart' }

export default async function OrderHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=%2Fpesanan-saya')

  const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', user.id).maybeSingle()
  if (profile?.is_active === false) redirect('/akun-nonaktif')

  const { data, error } = await supabase.from('orders')
    .select('id, total_price, subtotal, shipping_fee, shipping_address, payment_method, payment_status, status, delivery_method, created_at, order_items(quantity, price, products(name, image_url))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return <OrderHistory orders={(data ?? []) as unknown as Order[]} email={user.email ?? ''} loadError={error?.message} />
}
