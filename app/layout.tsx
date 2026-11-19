import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Anis Mart — Snack Ciki & Minuman Segar',
  description: 'Belanja snack dan minuman segar di Anis Mart. Pilih cara pengiriman, cek ongkir, dan bayar dengan tunai atau dompet digital melalui checkout aman.',
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
