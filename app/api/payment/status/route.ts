import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const orderId = new URL(req.url).searchParams.get('order_id')
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'Order ID tidak valid.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 })

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, user_id, status, payment_status, payment_method, total_price')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (orderError || !order) return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 })

  if (order.payment_method !== 'COD' && order.status === 'pending') {
    const serverKey = process.env.MIDTRANS_SERVER_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serverKey && supabaseUrl && serviceRoleKey) {
      try {
        const auth = Buffer.from(`${serverKey}:`).toString('base64')
        const response = await fetch(`https://api.sandbox.midtrans.com/v2/${encodeURIComponent(orderId)}/status`, {
          headers: { Authorization: `Basic ${auth}` },
          cache: 'no-store',
        })
        if (response.ok) {
          const payment = await response.json()
          const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
          await admin.rpc('apply_midtrans_status', { p_order_id: orderId, p_midtrans_status: payment.transaction_status })
        }
      } catch {
        // The verified webhook remains the authoritative fallback when a status lookup is temporarily unavailable.
      }
    }
  }

  const { data: refreshed } = await supabase.from('orders').select('id, status, payment_status, payment_method, total_price').eq('id', orderId).eq('user_id', user.id).single()
  return NextResponse.json({ order: refreshed ?? order })
}
