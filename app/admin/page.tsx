import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react'
import { SiteHeader } from '@/components/storefront/site-header'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role, username').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/')

  return <div className="min-h-screen bg-[#0b0b0f] text-white"><SiteHeader username={profile.username} email={user.email ?? ''} role="admin" onSearch={() => {}} /><main className="px-4 py-10 sm:px-6"><div className="mx-auto max-w-4xl"><Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-gray-400 transition hover:text-white"><ArrowLeft className="size-4" aria-hidden="true" />Kembali ke katalog</Link><section className="mt-6 rounded-3xl border border-white/10 bg-[#121218] p-6 sm:p-9"><div className="mb-5 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600"><ShieldCheck className="size-6" aria-hidden="true" /></div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Area terbatas</p><h1 className="mt-2 font-display text-3xl font-extrabold">Dashboard Admin</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-400">Halo, {profile.username}. Halaman placeholder admin ini hanya dapat diakses akun dengan role admin.</p><div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0b0f] p-4"><Sparkles className="size-5 text-blue-300" aria-hidden="true" /><p className="text-sm text-gray-300">Panel pengelolaan Anis Mart akan ditambahkan di sini.</p></div></section></div></main></div>
}
