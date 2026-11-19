import { notFound, redirect } from 'next/navigation'
import { PaymentConfirmation } from '@/components/storefront/payment-confirmation'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Konfirmasi Pesanan — Anis Mart' }

type Props = { params: Promise<{ id: string }> }

export default async function CheckoutConfirmationPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/pesanan/konfirmasi/${id}`)}`)

  const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', user.id).maybeSingle()
  if (profile?.is_active === false) redirect('/akun-nonaktif')

  const { data: order, error } = await supabase.from('orders')
    .select('id, user_id, status, payment_status, payment_method, total_price, delivery_method, shipping_address, created_at, snap_token, order_items(quantity, price, products(name))')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !order) notFound()

  return <PaymentConfirmation order={order as never} />
}
