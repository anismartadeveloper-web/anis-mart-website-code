'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'

export function AccountAvatar({ src, name, size = 'size-12' }: { src: string | null; name: string; size?: string }) {
  const [loading, setLoading] = useState(Boolean(src))
  const [failed, setFailed] = useState(false)
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'A'

  useEffect(() => {
    setLoading(Boolean(src))
    setFailed(false)
  }, [src])

  return <span className={`relative grid ${size} shrink-0 place-items-center overflow-hidden rounded-full border border-violet-300/20 bg-gradient-to-br from-blue-500/20 to-violet-500/20 font-bold text-violet-100`}>
    {src && !failed && <Image key={src} src={src} alt="" fill sizes="96px" unoptimized className="object-cover" onLoad={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true) }} />}
    {loading && src && <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-white/10" />}
    {!src || failed ? (initials.length ? <span aria-hidden="true">{initials}</span> : <UserRound className="size-5" aria-hidden="true" />) : null}
  </span>
}
