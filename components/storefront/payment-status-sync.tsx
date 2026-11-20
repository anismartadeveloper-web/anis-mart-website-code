'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'

const fetchStatus = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Status pembayaran tidak dapat diperiksa.')
  return result as { order?: { status: string; payment_status: string } }
}

type Props = { orderId: string; status: string; paymentStatus: string }

export function PaymentStatusSync({ orderId, status, paymentStatus }: Props) {
  const router = useRouter()
  const shouldCheck = status === 'pending' && paymentStatus !== 'lunas'
  const { data } = useSWR(
    shouldCheck ? `/api/payment/status?order_id=${encodeURIComponent(orderId)}` : null,
    fetchStatus,
    { revalidateOnFocus: true, revalidateOnReconnect: true, shouldRetryOnError: false },
  )

  useEffect(() => {
    if (data?.order && (data.order.status !== status || data.order.payment_status !== paymentStatus)) router.refresh()
  }, [data, paymentStatus, router, status])

  return null
}
