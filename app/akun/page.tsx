import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AccountPage } from '@/components/account/account-page'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Info Akun | Anis Mart',
  description: 'Kelola nama, username, tanggal lahir, foto profil, dan kata sandi akun Anis Mart Anda.',
  robots: { index: false, follow: false },
}

export default async function AccountRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/akun')

  const { data: profile } = await supabase.from('profiles')
    .select('id, username, display_name, birth_date, avatar_url, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) redirect('/login?next=/akun')
  if (profile.is_active === false) redirect('/akun-nonaktif')

  return <AccountPage profile={{
    id: user.id,
    username: profile.username,
    displayName: profile.display_name?.trim() || profile.username,
    birthDate: profile.birth_date,
    avatarUrl: profile.avatar_url,
    email: user.email ?? '',
    role: profile.role === 'admin' ? 'admin' : 'user',
  }} />
}
