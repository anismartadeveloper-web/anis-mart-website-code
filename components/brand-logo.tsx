'use client'

import Image from 'next/image'
import { useState } from 'react'

type BrandLogoProps = { variant: 'auth' | 'header' | 'sidebar' }

const variantStyles = {
  auth: 'h-[150px] w-[150px] sm:h-[190px] sm:w-[190px]',
  header: 'h-14 w-14 sm:h-16 sm:w-16 lg:h-[68px] lg:w-[68px]',
  sidebar: 'h-24 w-24 sm:h-28 sm:w-28',
} satisfies Record<BrandLogoProps['variant'], string>

const variantSizes = {
  auth: '(max-width: 640px) 150px, 190px',
  header: '(max-width: 639px) 56px, (max-width: 1023px) 64px, 68px',
  sidebar: '(max-width: 639px) 96px, 112px',
} satisfies Record<BrandLogoProps['variant'], string>

export function BrandLogo({ variant }: BrandLogoProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <span className={`inline-flex shrink-0 items-center justify-center text-center font-display font-extrabold text-white ${variantStyles[variant]}`}>Anis Mart</span>
  }

  return (
    <Image
      src="/brand/anismart-logo.png"
      alt="Logo Anis Mart"
      width={1254}
      height={1254}
      sizes={variantSizes[variant]}
      priority={variant !== 'sidebar'}
      onError={() => setFailed(true)}
      className={`block shrink-0 object-contain ${variantStyles[variant]}`}
    />
  )
}
