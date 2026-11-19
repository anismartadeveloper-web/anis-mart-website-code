import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Anis Mart — Snack Ciki & Minuman Segar',
  description: 'Pilih snack ciki favorit dan minuman dingin segar dari Anis Mart. Praktis, tinggal klik, siap diantar.',
  applicationName: 'Anis Mart',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b0b0f',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body className="antialiased">{children}</body></html>
}
