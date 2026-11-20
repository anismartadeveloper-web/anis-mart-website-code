import { redirect } from 'next/navigation'
import { Storefront } from '@/components/storefront/storefront'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: productRows, error: productError }] = await Promise.all([
    supabase.from('profiles').select('username, email, role, is_active').eq('id', user.id).maybeSingle(),
    supabase.from('products_public').select('id, name, category, price, promo_price, stock, image_url, description, unit_size, unit_label, unit_note').order('id'),
  ])
  if (profile?.is_active === false) redirect('/akun-nonaktif')

  const products = (productRows ?? []).map((product, index) => ({
    id: product.id,
    name: product.name,
    category: product.category as 'Snack' | 'Minuman',
    detail: product.description || product.category,
    price: Number(product.price),
    promoPrice: product.promo_price === null ? null : Number(product.promo_price),
    stock: product.stock,
    imageUrl: product.image_url,
    unitSize: product.unit_size === null ? null : Number(product.unit_size),
    unitLabel: product.unit_label,
    unitNote: product.unit_note,
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
