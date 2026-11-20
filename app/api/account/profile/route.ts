import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { profilePatchSchema } from '@/lib/account/profile-schema'

function isOwnAvatarUrl(value: string | null, userId: string) {
  if (value === null) return true
  try {
    const origin = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!origin) return false
    const expected = new URL(`/storage/v1/object/public/avatars/${userId}/avatar.webp`, origin)
    const candidate = new URL(value)
    return candidate.origin === expected.origin
      && candidate.pathname === expected.pathname
      && /^\d+$/.test(candidate.searchParams.get('v') ?? '')
      && [...candidate.searchParams.keys()].every((key) => key === 'v')
  } catch {
    return false
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: 'Silakan masuk kembali.' }, { status: 401 })

  const body: unknown = await request.json().catch(() => null)
  const parsed = profilePatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? 'Data profil tidak valid.' }, { status: 400 })

  if (parsed.data.avatar_url !== undefined && !isOwnAvatarUrl(parsed.data.avatar_url, user.id)) {
    return NextResponse.json({ message: 'Foto profil tidak valid.' }, { status: 400 })
  }

  if (parsed.data.username !== undefined) {
    const { data: available, error: availabilityError } = await supabase.rpc('is_account_username_available', { candidate_username: parsed.data.username })
    if (availabilityError) return NextResponse.json({ message: 'Username belum dapat diperiksa. Coba lagi.' }, { status: 503 })
    if (!available) return NextResponse.json({ message: 'Username sudah dipakai.' }, { status: 409 })
  }

  const { data: updatedProfile, error } = await supabase.from('profiles').update(parsed.data).eq('id', user.id).select('id').maybeSingle()
  if (!error && !updatedProfile) return NextResponse.json({ message: 'Profil akun tidak ditemukan.' }, { status: 404 })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ message: 'Username sudah dipakai.' }, { status: 409 })
    return NextResponse.json({ message: 'Perubahan profil gagal disimpan. Coba lagi.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
