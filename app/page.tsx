import { redirect } from 'next/navigation'
import { Storefront } from '@/components/storefront/storefront'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: productRows, error: productError }] = await Promise.all([
    supabase.from('profiles').select('username, email, role, is_active').eq('id', user.id).maybeSingle(),
    supabase.from('products').select('id, name, category, price, stock, image_url, description').order('created_at', { ascending: false }),
  ])
  if (profile?.is_active === false) redirect('/akun-nonaktif')

  const products = (productRows ?? []).map((product, index) => ({
    id: product.id,
    name: product.name,
    category: product.category as 'Snack' | 'Minuman',
    detail: product.description || product.category,
    price: Number(product.price),
    stock: product.stock,
    imageUrl: product.image_url,
    color: index % 2 === 0 ? 'from-blue-500/20 to-violet-500/10' : 'from-amber-500/20 to-rose-500/10',
  }))

  return <Storefront
    profile={{
      username: profile?.username ?? user.user_metadata?.username ?? 'Pengguna',
      email: profile?.email ?? user.email ?? '',
      role: profile?.role === 'admin' ? 'admin' : 'user',
    }}
    products={products}
    catalogError={productError ? 'Katalog belum dapat dimuat saat ini.' : undefined}
  />
}
