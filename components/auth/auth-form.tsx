'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LoaderCircle, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type AuthFormProps = { mode: 'login' | 'register' }

export function AuthForm({ mode }: AuthFormProps) {
  const isRegister = mode === 'register'
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setMessage('')
    setSuccess(false)
    const supabase = createClient()

    try {
      if (isRegister) {
        const normalizedUsername = username.trim()
        if (!/^[\p{L}\p{N}_]{3,24}$/u.test(normalizedUsername)) {
          setMessage('Username harus 3–24 karakter, hanya huruf, angka, atau garis bawah.')
          return
        }
        const { data: available, error: availabilityError } = await supabase.rpc('is_username_available', {
          candidate_username: normalizedUsername,
        })
        if (availabilityError) {
          setMessage('Pemeriksaan username belum berhasil. Coba lagi sebentar.')
          return
        }
        if (!available) {
          setMessage('Username tersebut sudah digunakan. Silakan pilih username lain.')
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo:
              process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
              `${window.location.origin}/auth/callback`,
            data: { username: normalizedUsername },
          },
        })
        if (error) {
          setMessage(error.message.includes('already') || error.message.includes('duplicate')
            ? 'Username atau email tersebut sudah terdaftar.'
            : error.message.toLowerCase().includes('password')
              ? 'Kata sandi minimal 6 karakter.'
              : 'Pendaftaran belum berhasil. Periksa data dan coba lagi.')
          return
        }
        if (data.session) {
          router.replace('/')
          router.refresh()
          return
        }
        setSuccess(true)
        setMessage('Akun berhasil dibuat. Silakan cek email untuk mengonfirmasi akun, lalu masuk.')
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        if (error.code === 'email_not_confirmed') {
          setMessage('Email belum dikonfirmasi. Buka tautan konfirmasi di email Anda, lalu coba masuk kembali.')
        } else if (error.status === 429) {
          setMessage('Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.')
        } else if (error.code === 'invalid_credentials') {
          setMessage('Email atau kata sandi salah.')
        } else {
          setMessage('Email atau kata sandi salah. Periksa kembali data Anda.')
        }
        return
      }
      router.replace('/')
      router.refresh()
    } catch {
      setMessage('Terjadi kendala koneksi. Silakan coba lagi.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0b0f] px-4 py-10 text-white sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-blue-600/20 blur-[110px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-0 size-80 rounded-full bg-purple-600/20 blur-[120px]" />
      <section className="relative z-10 w-full max-w-[420px] rounded-[28px] border border-white/10 bg-[#121218]/90 p-6 shadow-2xl shadow-purple-950/30 backdrop-blur-xl sm:p-8">
        <Link href="/" className="mb-8 inline-flex items-center gap-2.5" aria-label="Anis Mart">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-purple-900/40"><Sparkles aria-hidden="true" className="size-5" /></span>
          <span className="font-display text-2xl font-extrabold tracking-tight">Anis<span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">Mart</span></span>
        </Link>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-blue-300">{isRegister ? 'Selamat datang' : 'Senang bertemu kembali'}</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{isRegister ? 'Buat akun' : 'Masuk ke akun'}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">{isRegister ? 'Daftar dulu untuk mulai memilih camilan favoritmu.' : 'Masuk untuk melanjutkan belanja di Anis Mart.'}</p>

        <form className="mt-7 flex flex-col gap-4" onSubmit={handleSubmit}>
          {isRegister && <label className="flex flex-col gap-2 text-sm font-medium text-gray-200">Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={24} required placeholder="contoh: anis_mart" className="h-12 rounded-xl border border-white/10 bg-[#0b0b0f] px-4 text-base text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
            <span className="text-xs font-normal text-gray-500">3–24 karakter, huruf, angka, dan garis bawah.</span>
          </label>}
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-200">Alamat email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="nama@email.com" className="h-12 rounded-xl border border-white/10 bg-[#0b0b0f] px-4 text-base text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-200">Kata sandi
            <span className="relative block">
              <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={6} required placeholder="Minimal 6 karakter" className="h-12 w-full rounded-xl border border-white/10 bg-[#0b0b0f] px-4 pr-12 text-base text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-gray-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400" aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={showPassword}>{showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>
            </span>
          </label>
          {message && <p role={success ? 'status' : 'alert'} className={`rounded-xl border px-3.5 py-3 text-sm leading-relaxed ${success ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : 'border-red-400/25 bg-red-500/10 text-red-200'}`}>{message}</p>}
          <button type="submit" disabled={pending} className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-sm font-bold shadow-lg shadow-violet-950/30 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121218] disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Memproses...</> : isRegister ? 'Daftar sekarang' : 'Masuk'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-400">{isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
          <Link href={isRegister ? '/login' : '/register'} className="font-semibold text-blue-300 underline-offset-4 hover:text-violet-300 hover:underline">{isRegister ? 'Masuk' : 'Daftar'}</Link>
        </p>
        <p className="mt-7 border-t border-white/10 pt-5 text-center text-xs leading-relaxed text-gray-500">Camilan seru dan minuman segar, siap menemani harimu.</p>
      </section>
    </main>
  )
}
