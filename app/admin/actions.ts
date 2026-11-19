'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).maybeSingle()
  if (profile?.is_active === false) redirect('/akun-nonaktif')
  if (profile?.role !== 'admin') redirect('/')
  return supabase
}

function productData(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const category = String(formData.get('category') ?? '')
  const price = Number(formData.get('price'))
  const stock = Number(formData.get('stock'))
  const imageUrl = String(formData.get('image_url') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  if (!name || !['Snack', 'Minuman'].includes(category) || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
    throw new Error('Data produk tidak valid. Periksa nama, kategori, harga, dan stok.')
  }
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) throw new Error('URL gambar harus diawali http:// atau https://.')
  return { name, category, price, stock, image_url: imageUrl || null, description: description || null }
}

export async function createProduct(formData: FormData) {
  const supabase = await requireAdmin()
  const { error } = await supabase.from('products').insert(productData(formData))
  if (error) throw new Error(`Produk gagal disimpan: ${error.message}`)
  revalidatePath('/admin')
  revalidatePath('/')
}

export async function updateProduct(formData: FormData) {
  const supabase = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('ID produk tidak valid.')
  const { error } = await supabase.from('products').update(productData(formData)).eq('id', id)
  if (error) throw new Error(`Perubahan produk gagal disimpan: ${error.message}`)
  revalidatePath('/admin')
  revalidatePath('/')
}

export async function deleteProduct(formData: FormData) {
  const supabase = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('ID produk tidak valid.')
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw new Error(`Produk gagal dihapus: ${error.message}`)
  revalidatePath('/admin')
  revalidatePath('/')
}

export async function updateOrderStatus(formData: FormData) {
  const supabase = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id) || !['pending', 'diproses', 'selesai', 'dibatalkan'].includes(status)) throw new Error('Status pesanan tidak valid.')
  if (status === 'dibatalkan') {
    const { error } = await supabase.rpc('cancel_order', { p_order_id: id })
    if (error) throw new Error(`Pesanan gagal dibatalkan: ${error.message}`)
  } else {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id)
    if (error) throw new Error(`Status pesanan gagal diperbarui: ${error.message}`)
  }
  revalidatePath('/admin')
  revalidatePath('/pesanan-saya')
}

export async function setCustomerActive(formData: FormData) {
  const supabase = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const isActive = String(formData.get('is_active') ?? '') === 'true'
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('ID pelanggan tidak valid.')
  const { data: target } = await supabase.from('profiles').select('role').eq('id', id).maybeSingle()
  if (target?.role !== 'user') throw new Error('Hanya akun pelanggan yang dapat diubah.')
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id)
  if (error) throw new Error(`Status akun gagal diperbarui: ${error.message}`)
  revalidatePath('/admin')
}
