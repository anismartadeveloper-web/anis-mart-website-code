import { redirect } from 'next/navigation'
import { AdminConsole } from '@/components/admin/admin-console'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role, username, is_active').eq('id', user.id).maybeSingle()
  if (profile?.is_active === false) redirect('/akun-nonaktif')
  if (profile?.role !== 'admin') redirect('/')

  const [productsResult, ordersResult, customersResult, params] = await Promise.all([
    supabase.from('products').select('id, name, category, price, stock, image_url, description, created_at').order('created_at', { ascending: false }),
    supabase.from('orders').select('id, user_id, total_price, shipping_address, payment_method, status, created_at, profiles(username), order_items(quantity, price, products(name))').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, username, email, role, is_active, created_at').eq('role', 'user').order('created_at', { ascending: false }),
    searchParams,
  ])
  const errors = [productsResult.error, ordersResult.error, customersResult.error].filter(Boolean).map((error) => error!.message)

  return <AdminConsole
    username={profile.username ?? 'Admin'}
    products={(productsResult.data ?? []) as never[]}
    orders={(ordersResult.data ?? []) as never[]}
    customers={(customersResult.data ?? []) as never[]}
    error={params.error ?? (errors.length ? `Sebagian data tidak dapat dimuat: ${errors.join(' · ')}` : undefined)}
  />
}
