# Design system

The aesthetic posture is in `CLAUDE.md` §1: literary magazine, photographer's notebook, well-kept journal. This document is the implementation companion.

## Tokens

All tokens live in `apps/mobile/src/theme/index.ts`. Components import from the theme via Restyle's `useTheme` or via `createBox`/`createText`.

### Colors

```ts
{
  paper: '#FAF8F5',          // primary background — warm off-white
  ink: '#2C2C2A',            // primary text — soft black
  inkSecondary: '#5F5E5A',   // muted text
  inkTertiary: '#888780',    // hints, captions
  divider: '#E8E5DD',        // subtle dividers
  surface: '#FFFFFF',        // cards on paper
  accent: '#A8482F',         // terracotta — used <5% of pixels
  accentSoft: 'rgba(168, 72, 47, 0.08)',
}
```

### Typography

| Family | Weights | Use |
|---|---|---|
| Newsreader (serif) | regular, italic, medium | Trip titles, framing copy, friend voice quotes (always italic). |
| Inter (sans) | regular, medium | UI, labels, metadata, buttons. |

Loaded via `expo-font` in `apps/mobile/app/_layout.tsx`. Splash blocks until fonts resolve.

Variants exposed by the `Text` component:
- `title` — Newsreader medium, 24/30
- `body` — Inter regular, 16/24
- `caption` — Inter regular, 13/18, ink secondary
- `quote` — Newsreader italic, 17/26, ink primary
- `label` — Inter medium, 12/16, uppercase tracking

### Spacing

4px base. Theme exposes `s` (8), `m` (16), `l` (24), `xl` (32), `xxl` (48). No raw pixel values in feature code.

### Radius

`s` (4), `m` (8), `l` (12), `xl` (20). Cards use `m`. Pills use `xl`.

### Borders

1px hairline `divider` for cards and dividers. Photos get 4px paper-coloured padding inside a 1px hairline border (the framed-photo treatment).

## Components

Every primitive is in `apps/mobile/src/components/`. Components route every styled prop through Restyle so the theme is enforced at compile time.

| Component | Props (notable) |
|---|---|
| `Box` | Restyle primitive — layout, color, spacing. |
| `Text` | `variant: 'title' \| 'body' \| 'caption' \| 'quote' \| 'label'`, `color`, `numberOfLines`. |
| `Button` | `variant: 'primary' \| 'ghost' \| 'accent'`, `size: 'sm' \| 'md' \| 'lg'`, `loading`, `onPress`. |
| `Input` | Single-line text. Wraps a styled `TextInput`. |
| `Textarea` | Multi-line text. `minRows`, `maxRows`. |
| `Avatar` | `size: 'xs' \| 'sm' \| 'md' \| 'lg'`, `uri`, `fallback`. |
| `Pill` | `variant: 'default' \| 'on' \| 'accent'`, `onPress` (optional). |
| `Card` | Paper card with thin border. Children-only. |
| `PhotoFrame` | Aspect-preserving framed photo. `uri`, `aspect`, `maxWidth`. |

No raw `View` or `TextInput` in feature code. Everything routes through these.

## Photos

- Aspect ratios preserved.
- Framed (4px padding inside a thin border), not edge-to-edge.
- Cover photos max 220px wide on a card.
- `expo-image` everywhere — never `Image` from `react-native`.

## Dev preview

`/dev/components` (gated by `__DEV__`) renders every primitive in every variant. This is the QA surface for the design system. Update it whenever a primitive changes.

## Dark mode

Out of scope for v0. The theme is structured so dark mode is one additional theme file.
