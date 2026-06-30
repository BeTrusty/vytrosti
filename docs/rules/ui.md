# UI and Presentation Rules

This document outlines styling, typography, and component guidelines. We prioritize HeroUI and Tailwind CSS.

## Styling & Theme
- **Vibrant & Dark-Mode Centered**: A clean, premium aesthetic. Deep slate/blue backgrounds, subtle HSL gradients, glassmorphism (`backdrop-blur`).
- **Standard Palette**: Slate/Zinc for neutrality, Violet/Indigo for primary highlights, Amber/Orange for warnings/escrow status, Emerald for completed payments.
- **Typography**: Modern typography (Inter or Outfit). No system default serif/sans-serif fallbacks.

## HeroUI First (No Custom Wrappers)
- We use HeroUI out-of-the-box (e.g. `Button`, `Card`, `Input`, `Navbar`, `Modal`, `Select`).
- **Rule**: Do not create generic components like `CustomButton` or `MyInput`.
- Create components only to encapsulate domain structures, such as:
  - `ReservationStatusBadge`
  - `PaymentIntentCard`
  - `WalletStatusChip`
  - `MoneyAmount`
- For emphasized explanatory surfaces, prefer the shared `precision-callout*` utility classes in `src/app/globals.css` before inventing new one-off gradient cards.

## Responsive & Accessible Layouts
- **Mobile First**: All layouts must render perfectly on mobile viewports as well as desktops.
- **Micro-Animations**: Hover states, smooth page transitions, and loading skeletons to make the application feel responsive and premium.
