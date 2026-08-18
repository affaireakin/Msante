'use client'
import { useEffect, useState } from 'react'

const ROTATE_MS = 10_000
// Ratio réel des visuels fournis par le client (~851×1280, portrait) —
// utilisé tel quel pour ne jamais déformer ni rogner les images.
const IMAGE_RATIO = '851 / 1280'

export default function HeroCarousel({ image1, image2 }: { image1: string; image2: string | null }) {
  const images = [image1, image2].filter((src): src is string => !!src)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (images.length < 2) return
    const id = setInterval(() => setActiveIndex(i => (i + 1) % images.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [images.length])

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl shadow-2xl"
      style={{ aspectRatio: IMAGE_RATIO, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}
    >
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt="M-Santé"
          className="absolute inset-0 w-full h-full object-contain transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === activeIndex ? 1 : 0 }}
        />
      ))}
    </div>
  )
}
