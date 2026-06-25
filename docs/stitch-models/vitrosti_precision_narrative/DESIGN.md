---
name: Vitrosti Precision Narrative
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#404944'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#707974'
  outline-variant: '#bfc9c3'
  surface-tint: '#2b6954'
  primary: '#003527'
  on-primary: '#ffffff'
  primary-container: '#064e3b'
  on-primary-container: '#80bea6'
  inverse-primary: '#95d3ba'
  secondary: '#5c5f61'
  on-secondary: '#ffffff'
  secondary-container: '#e0e3e5'
  on-secondary-container: '#626567'
  tertiary: '#1f2f43'
  on-tertiary: '#ffffff'
  tertiary-container: '#35455a'
  on-tertiary-container: '#a2b2cb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b0f0d6'
  primary-fixed-dim: '#95d3ba'
  on-primary-fixed: '#002117'
  on-primary-fixed-variant: '#0b513d'
  secondary-fixed: '#e0e3e5'
  secondary-fixed-dim: '#c4c7c9'
  on-secondary-fixed: '#191c1e'
  on-secondary-fixed-variant: '#444749'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  display-lg-mobile:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.03em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: -0.02em
  body-base:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: -0.01em
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  section-gap: 80px
---

## Brand & Style

The design system is engineered for a high-end, stablecoin-based vacation rental platform where trust and modern engineering intersect. The brand personality is rooted in "Digital Permanence"—combining the security of blockchain technology with the tactile luxury of a premium physical estate.

The design style utilizes **Modern Minimalism** with a focus on structural clarity. Drawing inspiration from industry leaders like Linear and Vercel, the UI employs generous whitespace to reduce cognitive load and sharp, high-contrast typography to establish authority. The aesthetic is defined by "The Soft Precision" approach: mathematically precise layouts tempered by soft-focus shadows and refined border treatments.

**Emotional Response:**
- **Secure:** Users feel their assets are protected by rigorous engineering.
- **Sophisticated:** A departure from the "loud" aesthetics of typical crypto projects in favor of understated luxury.
- **Efficient:** Every interaction feels fast, purposeful, and frictionless.

## Colors

The palette is anchored by **Deep Emerald (#064E3B)**, chosen to evoke the dual concepts of "Forest Privacy" and "Financial Growth." This primary color is used sparingly for key actions and brand moments to maintain its impact.

**Surface Strategy:**
- **Light Mode:** Uses a "Snow & Slate" approach. Backgrounds remain pure white (#FFFFFF), while secondary surfaces and containers use a very soft cream-slated wash (#F8FAFC) to create subtle separation.
- **Dark Mode:** Utilizes a "Deep Ink" (#020617) foundation. Surfaces are tiered using slight shifts in luminosity rather than pure gray scales, ensuring the interface feels rich and expansive.

**Functional Colors:** 
Functional states (Success, Warning, Error) are desaturated by 10-15% from standard web-safe values to ensure they do not clash with the premium aesthetic while maintaining accessibility and clarity.

## Typography

This design system utilizes **Geist** for its systematic, developer-centric precision and clean geometric construction. The typography strategy relies on "Tight Tracking"—reducing letter spacing on larger headings to create a dense, editorial feel.

**Scale & Rhythm:**
- **Display Levels:** Reserved for property names and key financial metrics. Use semi-bold weights with aggressive negative letter spacing.
- **Body Text:** Set with generous line height (1.6) to ensure readability during long-form contract reviews or property descriptions.
- **Labels:** Small, uppercase labels are used for metadata and status indicators to provide a secondary information layer without cluttering the visual hierarchy.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid with Fixed Constraints**. Content is centered within a 1280px container on desktop, while internal elements scale fluidly within a 12-column system.

**Spacing Principles:**
- **8px Base Unit:** All margins, paddings, and component heights must be multiples of 4px, with 8px being the preferred incremental step.
- **Section Breathing:** Use large vertical gaps (80px - 120px) between major content sections to reinforce the premium, minimalist feel.
- **Mobile Reflow:** On mobile, the 12-column grid collapses to a single column with 16px side margins. Horizontal scrolling "peek" cards are preferred for property galleries to maintain momentum.

## Elevation & Depth

Hierarchy in this design system is achieved through **Tonal Layering** and **Subtle Elevation**. We avoid heavy dropshadows in favor of "Ambient Lifts."

- **Layers:** Surface elevations are defined by 1px borders in a slightly lighter or darker shade than the background.
- **Shadows:** Use a "Triple-Layer Shadow" for high-elevation components like modals or floating filters:
    1. A sharp 1px stroke.
    2. A tight, low-opacity shadow (4px blur, 2px Y-offset, 5% opacity).
    3. A broad, diffused ambient shadow (20px blur, 10px Y-offset, 3% opacity).
- **Glassmorphism:** Navigation bars and sticky headers should use a 12px backdrop blur with 80% opacity to maintain a sense of depth and context.

## Shapes

The shape language is "Calculated Softness." We use **Rounded (0.5rem)** as the default for standard UI elements like buttons and inputs, while larger containers like cards and property images use **Rounded-XL (1.5rem)** to create a welcoming, high-end feel.

- **Buttons/Inputs:** 8px (0.5rem)
- **Cards/Modals:** 24px (1.5rem)
- **Badges/Chips:** Full pill (999px) to contrast against the structured grid.

## Components

**Buttons:**
- **Primary:** Solid Deep Emerald (#064E3B) with white text. No gradient. 
- **Secondary:** Ghost style with a 1px border (#E2E8F0 in light / #1E293B in dark) and subtle hover lift.
- **Tertiary:** Text-only with an underline appearing on hover.

**Input Fields:**
Inputs should feel like a physical "slot." Use a light gray background (#F1F5F9) in light mode and a deep slate (#0F172A) in dark mode. Borders should be invisible until focus, where they transition to a 1px Primary color stroke.

**Cards:**
Property cards use a "Border-First" approach. A thin, low-contrast border defines the shape. On hover, the card should gain a subtle ambient shadow and the image should scale slightly (1.05x).

**Badges & Status Indicators:**
Badges use the "Soft Tint" pattern: a desaturated background (10% opacity of the status color) with high-contrast text (100% opacity of the status color).

**Lists:**
Financial transaction lists should be "Hyper-Clean." Use thin horizontal dividers (1px) and monospaced Geist numbers for currency amounts to ensure decimal alignment.