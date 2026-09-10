import { PlatformPressable } from '@react-navigation/elements'
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'

/**
 * Bouton d'onglet sans ripple.
 *
 * Par défaut, @react-navigation/bottom-tabs rend chaque onglet avec un
 * PlatformPressable qui applique le ripple Material d'Android : un disque gris
 * qui déborde largement de l'icône et reste visible le temps de la transition.
 * Sur notre barre en verre dépoli, ça se lit comme un artefact d'affichage.
 *
 * On garde le retour tactile par l'opacité seule, cohérent entre iOS et
 * Android et avec le reste de l'app.
 */
export function TabBarButton(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      android_ripple={{ color: 'transparent', borderless: false, radius: 0 }}
      pressOpacity={0.6}
    />
  )
}
