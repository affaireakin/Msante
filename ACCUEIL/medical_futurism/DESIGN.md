---
name: Medical Futurism
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3f484d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6f787e'
  outline-variant: '#bec8ce'
  surface-tint: '#006685'
  primary: '#006685'
  on-primary: '#ffffff'
  primary-container: '#82d8ff'
  on-primary-container: '#005e7a'
  inverse-primary: '#7bd1f8'
  secondary: '#705d00'
  on-secondary: '#ffffff'
  secondary-container: '#ffde5c'
  on-secondary-container: '#756100'
  tertiary: '#5c5f61'
  on-tertiary: '#ffffff'
  tertiary-container: '#cbcdcf'
  on-tertiary-container: '#545759'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bee9ff'
  primary-fixed-dim: '#7bd1f8'
  on-primary-fixed: '#001f2a'
  on-primary-fixed-variant: '#004d65'
  secondary-fixed: '#ffe170'
  secondary-fixed-dim: '#e4c546'
  on-secondary-fixed: '#221b00'
  on-secondary-fixed-variant: '#544600'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-base:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  margin-page: 24px
  gutter: 16px
  card-padding: 20px
  stack-gap: 12px
---

## Brand & Style

The design system is rooted in the concept of "Medical Futurism"—a synthesis of clinical precision and human-centric serenity. It is designed for M-Santé to feel like a high-end health sanctuary: technologically advanced yet deeply calming.

The aesthetic blends **Minimalism** with **Glassmorphism**. By prioritizing expansive whitespace and a reduced color palette, the system ensures that critical health data remains the focal point. To achieve a premium feel, the interface uses translucent layers and soft background blurs, creating a sense of physical depth and lightness reminiscent of modern iOS environments. The emotional goal is to move away from the "anxiety-inducing" hospital blue toward a "wellness" blue that inspires confidence and tranquility.

## Colors

The palette is anchored by **Medical Blue**, a bright, optimistic azure derived from the brand logo. This is supported by **Subtle Gold** accents used sparingly for high-value highlights, such as achievement badges or premium status indicators.

- **Primary (Medical Blue):** Used for primary actions, active states, and brand-heavy elements.
- **Secondary (Soft Gold):** Reserved for "premium" moments and subtle progress indicators.
- **Neutrals:** A range of cool-toned slates and soft whites to maintain a crisp, clean environment.
- **Semantic Colors:** Softened reds and greens for health alerts that inform without alarming.

In **Dark Mode**, the system shifts to deep navy surfaces (#0F172A) rather than pure black to maintain a sophisticated, "glass-like" depth where the Medical Blue glows softly against the dark backdrop.

## Typography

This design system utilizes **Manrope** for its universal application. Manrope offers a geometric yet warm character that feels approachable for health-related content while maintaining the precision of a technical font.

Large display headlines use a slightly tighter letter spacing and a heavy weight to establish a clear hierarchy. Body text is prioritized for legibility with a generous line height (1.6) to reduce cognitive load during long reading sessions. Labels use a semi-bold or bold weight to remain visible at smaller scales, ensuring that data points and metadata are easily scannable.

## Layout & Spacing

The layout philosophy follows a **fluid grid** model optimized for high-density medical data and serene white space. Elements are organized on an 8px rhythmic grid to ensure vertical consistency.

Layouts should favor high-padding containers to allow the "Glassmorphism" effect to breathe. Page margins are set to a generous 24px on mobile and scale to wider gutters on desktop to prevent the interface from feeling "cramped." Components should be grouped into logical clusters (stacks) with a 12px gap to maintain a clear visual relationship between related data points.

## Elevation & Depth

This design system rejects heavy, drop-shadow-laden interfaces in favor of **Glassmorphism** and **Ambient Depth**. 

1.  **Backdrop Blurs:** Surfaces use a 12px to 20px blur radius with a high-transparency white (or dark navy) fill. This creates a "frosted glass" effect that allows the underlying colors to peak through.
2.  **Soft Shadows:** When depth is required (e.g., a floating action button), shadows should be extremely diffused (20px - 40px blur) with a low opacity (5-8%) tinted with the primary Medical Blue color.
3.  **Inner Glows:** To simulate a premium "tech" feel, cards may use a 1px white inner border (0.1 opacity) to catch the light at the edges, giving the component a tactile, physical quality.

## Shapes

The shape language is strictly **Rounded (Level 2)** to align with iOS standards. This softens the "clinical" edge of the medical data, making the platform feel friendly and safe.

- **Standard Containers:** 16px (1rem) corner radius.
- **Large Cards/Modals:** 24px (1.5rem) corner radius.
- **Small Controls (Checkboxes):** 4px (0.25rem) corner radius to ensure they remain distinct from circular radio buttons.
- **Interactive Elements:** Buttons should use the standard 16px radius to maintain a consistent silhouette with cards.

## Components

- **Buttons:** Primary buttons are solid Medical Blue with white text. Secondary buttons use a glass-style background with a subtle 1px border.
- **Cards:** Cards are the primary vessel for data. They should use the glassmorphic style with a background blur and a very soft ambient shadow to appear as if they are floating above the base layer.
- **Chips & Tags:** Small, pill-shaped indicators with high-contrast text and a desaturated version of the primary blue as a background.
- **Input Fields:** Minimalist design with a 1px bottom border or a very light gray fill. On focus, the border transitions to Medical Blue with a subtle outer glow.
- **Selection Controls:** Radio buttons and checkboxes use the primary blue for the active state, utilizing smooth haptic-style transitions.
- **Data Visualizations:** Charts should use the primary blue as the main line/bar color, with gold used strictly for "target" or "goal" markers. Backgrounds of charts should remain transparent to leverage the underlying glass layers.