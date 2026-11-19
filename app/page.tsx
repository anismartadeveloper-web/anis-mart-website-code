import { redirect } from 'next/navigation'
import { Storefront } from '@/components/storefront/storefront'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, email, role')
    .eq('id', user.id)
    .maybeSingle()

  return <Storefront profile={{
    username: profile?.username ?? user.user_metadata?.username ?? 'Pengguna',
    email: profile?.email ?? user.email ?? '',
    role: profile?.role === 'admin' ? 'admin' : 'user',
  }} />
}
