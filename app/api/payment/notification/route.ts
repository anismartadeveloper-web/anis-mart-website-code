import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serverKey || !supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Payment service unavailable.' }, { status: 503 })

  try {
    const payload = await req.json()
    const { order_id, status_code, gross_amount, signature_key, transaction_status } = payload
    if (typeof order_id !== 'string' || typeof status_code !== 'string' || typeof gross_amount !== 'string' || typeof signature_key !== 'string' || typeof transaction_status !== 'string') {
      return NextResponse.json({ error: 'Invalid notification.' }, { status: 400 })
    }

    const expected = createHash('sha512').update(`${order_id}${status_code}${gross_amount}${serverKey}`).digest()
    const received = Buffer.from(signature_key, 'hex')
    if (received.length !== expected.length || !timingSafeEqual(expected, received)) return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })

    const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await admin.rpc('apply_midtrans_status', { p_order_id: order_id, p_midtrans_status: transaction_status })
    if (error) return NextResponse.json({ error: 'Unable to update the order.' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid notification.' }, { status: 400 })
  }
}
