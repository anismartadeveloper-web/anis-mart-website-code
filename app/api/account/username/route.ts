import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { usernameSchema } from '@/lib/account/profile-schema'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: 'Silakan masuk kembali.' }, { status: 401 })

  const candidate = usernameSchema.safeParse(request.nextUrl.searchParams.get('value') ?? '')
  if (!candidate.success) return NextResponse.json({ available: false, message: candidate.error.issues[0]?.message ?? 'Username tidak valid.' }, { status: 400 })

  const { data: available, error } = await supabase.rpc('is_account_username_available', { candidate_username: candidate.data })
  if (error) return NextResponse.json({ message: 'Username belum dapat diperiksa. Coba lagi.' }, { status: 503 })
  return NextResponse.json({ available: Boolean(available) })
}
