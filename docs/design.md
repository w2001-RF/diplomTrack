# Design system

DiplomTrack follows the visual identity of Université Ibn Tofaïl (Kénitra) and ENSA Kénitra, presented with Apple-style restraint. Tokens live in `frontend/src/index.css` and `frontend/tailwind.config.ts`. Brand components live in `frontend/src/components/brand/Brand.tsx`.

## Principles

- **Neutral first, one accent at a time.** Surfaces are white and soft grey. Colour marks what matters: the primary action, the current page, a status.
- **Hairlines and soft shadows,** not heavy borders. Cards use `rounded-2xl`, a 1px `border-border/70` and `shadow-sm`, and lift to `shadow-md` on hover.
- **Generous space.** Pages sit in a centred `max-w-[1400px]` column with `px-8 py-8`. Inputs and buttons are 40 to 44 px tall.
- **Moroccan craft, in small doses.** The zellige star (khatam) and the arch (bab) appear only on brand surfaces: the sidebar, the login panel and the logo. Data screens stay plain.

## Colour

The brand values come from the CSS of uit.ac.ma and ensa.uit.ac.ma.

| Token | Value | Use |
|---|---|---|
| `--brand-blue` / `bg-brand-blue` | `#002c84` (HSL 222 100% 26%) | Primary buttons, links, the brand mark, chart series 1 |
| `--brand-blue-deep` / `bg-brand-deep` | HSL 224 85% 14% | Sidebar and login panel (night navy) |
| `--brand-crimson` / `bg-brand-crimson` | `#ae152d` (HSL 351 79% 38%) | The heart of the mark, the current-page marker, destructive actions, rejected status |
| `--brand-sand` | HSL 36 45% 92% | A warm neutral, kept for illustrations |
| `--background` | `#f5f5f7` | Page background |
| `--foreground` | `#1d1d1f` | Text |
| `--muted-foreground` | `#6e6e73` | Secondary text |

Status colours (`--status-*`) are tuned to sit beside the brand blue: pending is amber, in progress is blue, validated is green, blocked is orange, and rejected is crimson. Charts read `--chart-1` to `--chart-5` and never hard-coded hex values. Dark mode (`.dark`) redefines every token.

## Type

| Family | Tailwind | Use |
|---|---|---|
| Inter Variable | `font-sans` (default) | All UI text. It is the closest open font to SF Pro; `cv11` and `ss01` are on |
| Playfair Display | `font-display` | Rare display headings, such as the login headline. It echoes the Butler serif used on uit.ac.ma |
| Noto Kufi Arabic | `font-arabic`, or automatic via `lang="ar"` / `dir="rtl"` | The university's Arabic name and Arabic taglines |

The fonts are self-hosted through `@fontsource`; nothing is loaded from a CDN. Headings use tighter tracking (`-0.022em`).

## Components

- **Buttons** are pills (`rounded-full`) and press in slightly (`active:scale-[0.97]`). Use one `default` (blue) button per area. `outline` and `ghost` are for secondary actions. The `accent` variant is crimson; keep it rare.
- **Fields** (inputs, selects, textareas) are softly filled (`bg-secondary/60`). On focus they turn white and show a blue halo (`ring-4 ring-primary/15`).
- **Tabs** are a segmented control: a grey pill track with a white raised thumb.
- **Dialogs and menus** have a frosted, blurred backdrop and large radius (`rounded-3xl` for dialogs, `rounded-xl` for menus).
- **The top bar** uses the `.glass` utility (translucent, `saturate(180%) blur(20px)`), as in macOS toolbars.
- **Stat cards** are white; only the round icon chip carries the colour.
- **The sidebar** is night navy with a 4% zellige lattice and a crimson glow. The current page gets a white 10% fill and a crimson bar on the left. It collapses to icons, and the choice is remembered (`localStorage.sidebar_collapsed`).

### Brand components

```tsx
import { BrandMark, BrandLockup, ZelligePanel, ArchWindow } from '@/components/brand/Brand';

<BrandLockup />                       // mark + "DiplomTrack" + "Université Ibn Tofaïl · Kénitra"
<BrandLockup inverted showArabic />   // on navy, with جامعة ابن طفيل · القنيطرة
<ZelligePanel className="p-12">…</ZelligePanel>   // navy brand surface with the lattice
<ArchWindow className="h-72 w-48">…</ArchWindow>   // content framed by a Moroccan arch
```

The `.bg-zellige` utility draws the khatam lattice in white. Use it at 4 to 7% opacity on navy, never on content areas.

## Next steps

The shell, the login page, the base components and the dashboards follow this system. The pages still carry older, page-specific classes (status badges built from `bg-[hsl(var(--status-…))]`, `text-2xl font-bold` titles, mixed English milestone labels from the backend). Move them to shared components page by page:

1. A `StatusBadge` component, so each milestone has one label and one tone everywhere.
2. A `PageHeader` component (title, subtitle, actions) to replace the per-page headers.
3. The dossier timeline as a vertical stepper using the brand blue.
4. A mobile layout: today the sidebar is fixed at every width.
