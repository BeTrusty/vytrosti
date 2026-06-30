# Guía: Branding Shell Assets

## Objetivo

Documentar dónde viven el logo principal del shell, el favicon y los créditos del footer para que futuras actualizaciones de marca sean rápidas y consistentes.

## Assets Actuales

- Logo reutilizable del navbar: `public/brand/vytrosti-mark.png`
- Icono de aplicación de Next.js: `src/app/icon.png`
- Favicon raíz de Next.js: `src/app/favicon.ico`

## Dónde se usan

- `src/presentation/components/Navbar.tsx`
  - Renderiza el logo principal desde `public/brand/vytrosti-mark.png` con `next/image` y muestra el wordmark `BeTrustless` en el header.
- `src/app/layout.tsx`
  - Define el footer global con los créditos enlazados a Trustless y `betrusty.io`.
- `src/app/icon.png` y `src/app/favicon.ico`
  - Next.js App Router los expone automáticamente como icon assets del sitio.

## Cómo reemplazarlos

1. Reemplazar `public/brand/vytrosti-mark.png` por el nuevo logo base.
2. Regenerar `src/app/icon.png` en formato cuadrado de alta resolución.
3. Regenerar `src/app/favicon.ico` en formato pequeño para navegador.
4. Verificar navbar, tab del navegador y footer en una corrida local.

## Verificación

- Ejecutar `pnpm exec eslint src/app/layout.tsx src/presentation/components/Navbar.tsx`
- Abrir la app y revisar:
  - Navbar con el nuevo logo y el nombre `BeTrustless`
  - Tab del navegador con el nuevo favicon
  - Footer con links funcionales a Trustless y BeTrusty
