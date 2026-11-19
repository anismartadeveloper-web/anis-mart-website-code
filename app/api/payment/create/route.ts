import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const paymentTypes: Record<string, string> = {
  DANA: 'dana',
  GoPay: 'gopay',
  ShopeePay: 'shopeepay',
  OVO: 'ovo',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 })

  try {
    const body: unknown = await req.json()
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Data pesanan tidak valid.' }, { status: 400 })
    const input = body as Record<string, unknown>
    const { product_id, quantity, delivery_method, shipping_address, latitude, longitude, payment_method } = input
    const rawItems = input.items
    const isCartOrder = Array.isArray(rawItems)
    let cartItems: { product_id: string; quantity: number }[] = []

    if (isCartOrder) {
      if (rawItems.length < 1 || rawItems.length > 50) return NextResponse.json({ error: 'Jumlah produk dalam pesanan tidak valid.' }, { status: 400 })
      for (const item of rawItems) {
        if (!item || typeof item !== 'object') return NextResponse.json({ error: 'Data produk pesanan tidak valid.' }, { status: 400 })
        const line = item as Record<string, unknown>
        if (typeof line.product_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(line.product_id)) return NextResponse.json({ error: 'Produk tidak valid.' }, { status: 400 })
        if (!Number.isInteger(line.quantity) || (line.quantity as number) < 1 || (line.quantity as number) > 99) return NextResponse.json({ error: 'Jumlah pesanan tidak valid.' }, { status: 400 })
        cartItems.push({ product_id: line.product_id, quantity: line.quantity as number })
      }
    } else {
      if (typeof product_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(product_id)) return NextResponse.json({ error: 'Produk tidak valid.' }, { status: 400 })
      if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 99) return NextResponse.json({ error: 'Jumlah pesanan tidak valid.' }, { status: 400 })
    }
    if (delivery_method !== 'ambil' && delivery_method !== 'antar') return NextResponse.json({ error: 'Metode pengiriman tidak valid.' }, { status: 400 })
    if (typeof payment_method !== 'string' || (payment_method !== 'COD' && !paymentTypes[payment_method])) return NextResponse.json({ error: 'Metode pembayaran tidak valid.' }, { status: 400 })
    if (delivery_method === 'antar' && (typeof shipping_address !== 'string' || shipping_address.trim().length < 8 || shipping_address.length > 500)) return NextResponse.json({ error: 'Masukkan alamat pengiriman yang lengkap.' }, { status: 400 })

    const validCoordinate = (value: unknown, min: number, max: number) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max)
    if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) return NextResponse.json({ error: 'Koordinat lokasi tidak valid.' }, { status: 400 })

    const orderArguments = {
      p_delivery_method: delivery_method,
      p_shipping_address: typeof shipping_address === 'string' ? shipping_address.trim() : '',
      p_latitude: typeof latitude === 'number' ? latitude : null,
      p_longitude: typeof longitude === 'number' ? longitude : null,
      p_payment_method: payment_method,
    }
    const { data, error } = isCartOrder
      ? await supabase.rpc('place_order', { ...orderArguments, p_items: cartItems })
      : await supabase.rpc('place_order', {
          ...orderArguments,
          p_product_id: product_id,
          p_quantity: quantity,
          p_shipping_fee: 0,
        })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    const order = data?.[0]
    if (!order) return NextResponse.json({ error: 'Pesanan tidak dapat dibuat.' }, { status: 500 })

    if (payment_method === 'COD') return NextResponse.json({ success: true, order })

    const serverKey = process.env.MIDTRANS_SERVER_KEY
    if (!serverKey) {
      await supabase.rpc('cancel_order', { p_order_id: order.order_id })
      return NextResponse.json({ error: 'Pembayaran online belum dikonfigurasi. Silakan pilih bayar di tempat.' }, { status: 503 })
    }

    const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
    const auth = Buffer.from(`${serverKey}:`).toString('base64')
    let midtransResponse: Response
    try {
      midtransResponse = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify({
          transaction_details: { order_id: order.order_id, gross_amount: Math.round(Number(order.total_price)) },
          item_details: [
            ...(Array.isArray(order.items)
              ? order.items.map((item: { product_id: string; name: string; unit_price: number; quantity: number }) => ({
                  id: item.product_id,
                  price: Math.round(Number(item.unit_price)),
                  quantity: item.quantity,
                  name: String(item.name).slice(0, 50),
                }))
              : [{ id: product_id, price: Math.round(Number(order.unit_price)), quantity, name: String(order.product_name).slice(0, 50) }]),
            ...(Number(order.shipping_fee) > 0 ? [{ id: 'shipping', price: Math.round(Number(order.shipping_fee)), quantity: 1, name: 'Ongkos kirim' }] : []),
          ],
          customer_details: { first_name: profile?.username || user.email?.split('@')[0] || 'Pelanggan', email: user.email },
          enabled_payments: [paymentTypes[payment_method]],
          expiry: { unit: 'minute', duration: 15 },
        }),
        cache: 'no-store',
      })
    } catch {
      await supabase.rpc('cancel_order', { p_order_id: order.order_id })
      return NextResponse.json({ error: 'Tidak dapat menghubungi Midtrans. Stok telah dikembalikan; silakan coba lagi.' }, { status: 502 })
    }

    const result = await midtransResponse.json().catch(() => ({}))
    if (!midtransResponse.ok || typeof result.token !== 'string') {
      await supabase.rpc('cancel_order', { p_order_id: order.order_id })
      const providerMessage = JSON.stringify(result).toLowerCase()
      const unavailable = /channel|payment type|not available|unsupported|disabled/.test(providerMessage)
      return NextResponse.json({ error: unavailable ? 'Metode ini belum tersedia di sandbox. Pilih metode lain.' : 'Midtrans belum dapat membuat pembayaran. Stok telah dikembalikan; silakan coba lagi.' }, { status: 502 })
    }

    const { error: tokenError } = await supabase.rpc('attach_snap_token', { p_order_id: order.order_id, p_snap_token: result.token })
    if (tokenError) {
      await supabase.rpc('cancel_order', { p_order_id: order.order_id })
      return NextResponse.json({ error: 'Token pembayaran tidak dapat disimpan. Stok pesanan telah dikembalikan.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, order, snap_token: result.token })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan saat membuat pesanan.' }, { status: 500 })
  }
}
