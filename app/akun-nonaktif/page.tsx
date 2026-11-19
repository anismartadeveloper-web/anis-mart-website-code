import { logoutDisabledAccount } from './actions'

export default function InactiveAccountPage() {
  return <main className="grid min-h-screen place-items-center bg-[#0b0b0f] px-4 py-10 text-white">
    <section className="w-full max-w-md rounded-3xl border border-amber-400/15 bg-[#121218] p-7 text-center shadow-2xl shadow-black/30 sm:p-9">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-amber-300/15 bg-amber-300/10 text-amber-200"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5m0 4h.01" /></svg></span>
      <p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-amber-200">Akses akun</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Akun sedang dinonaktifkan</h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-400">Akun Anda untuk sementara tidak dapat mengakses Anis Mart. Hubungi admin toko jika Anda merasa ini terjadi karena kesalahan.</p>
      <form action={logoutDisabledAccount} className="mt-7"><button className="min-h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-sm font-semibold transition hover:brightness-110">Keluar dari akun</button></form>
    </section>
  </main>
}
