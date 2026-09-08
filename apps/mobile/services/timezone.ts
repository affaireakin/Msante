/**
 * Toute la plateforme interprète les horaires en heure du Sénégal (GMT, sans
 * changement d'heure) : les créneaux saisis par les praticiens, la génération
 * des créneaux réservables et l'affichage des rendez-vous.
 *
 * Problème remonté : un praticien en France a saisi 16h30 en pensant à son
 * heure locale ; le rendez-vous a eu lieu 2h plus tard que prévu côté patient.
 * Une mention statique ne suffit pas — l'utilisateur doit voir l'équivalent
 * dans SON fuseau quand celui-ci diffère.
 */

export const PLATFORM_TZ = 'Africa/Dakar'
export const PLATFORM_TZ_LABEL = 'heure du Sénégal'

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || PLATFORM_TZ
  } catch {
    return PLATFORM_TZ
  }
}

/** Décalage (en minutes) du fuseau de l'appareil par rapport à la plateforme. */
export function deviceOffsetMinutes(at: Date = new Date()): number {
  const asUtc = (tz: string) => {
    // en-CA + h23 donne "YYYY-MM-DD, HH:MM:SS", parsable de façon stable
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at).reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value
      return acc
    }, {})
    return Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    )
  }
  try {
    return Math.round((asUtc(deviceTimeZone()) - asUtc(PLATFORM_TZ)) / 60000)
  } catch {
    return 0
  }
}

/** Vrai si l'appareil n'est pas sur le fuseau de la plateforme. */
export function isDeviceOffPlatform(at: Date = new Date()): boolean {
  return deviceOffsetMinutes(at) !== 0
}

/** "+2 h" / "−1 h 30" — décalage lisible, ou null si aucun. */
export function offsetLabel(at: Date = new Date()): string | null {
  const min = deviceOffsetMinutes(at)
  if (min === 0) return null
  const sign = min > 0 ? '+' : '−'
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h} h${m ? ` ${m}` : ''}`
}

export function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone })
}

/**
 * Heure dans le fuseau de l'appareil, uniquement si celui-ci diffère de la
 * plateforme — sinon null (rien à afficher, on évite le bruit visuel pour
 * l'immense majorité des utilisateurs au Sénégal).
 */
export function localEquivalent(iso: string): string | null {
  if (!isDeviceOffPlatform(new Date(iso))) return null
  return formatTime(iso, deviceTimeZone())
}
