import { useWindowDimensions } from 'react-native'

const BASE_WIDTH = 390 // iPhone 14 Pro

export function useResponsive() {
  const { width, height } = useWindowDimensions()

  const scale = (size: number) => Math.round((size * width) / BASE_WIDTH)

  const isSmall = width < 360
  const isMedium = width >= 360 && width < 414
  const isLarge = width >= 414

  const px = Math.round(width * 0.055) // ~21px sur 390, ~18px sur 320
  const gutter = Math.round(width * 0.04)
  const cardPadding = Math.round(width * 0.045)

  const fs = {
    xs: scale(10),
    sm: scale(12),
    md: scale(14),
    lg: scale(16),
    xl: scale(20),
    xxl: scale(24),
    hero: scale(28),
  }

  return {
    width,
    height,
    scale,
    isSmall,
    isMedium,
    isLarge,
    px,
    gutter,
    cardPadding,
    fs,
  }
}
