/**
 * Theme Utility Classes
 *
 * Reusable, semantic class strings for consistent light/dark mode styling.
 * All values reference CSS custom properties defined in index.css,
 * ensuring both themes stay in sync.
 *
 * Usage:
 *   import { themeClasses } from "@/lib/theme-utils";
 *   <div className={cn(themeClasses.cardBase, "p-6")}>...</div>
 */

// ---------------------------------------------------------------------------
// Surface / Card
// ---------------------------------------------------------------------------

/** Standard card surface with border and shadow */
export const cardBase =
  "rounded-lg border border-border bg-card text-card-foreground shadow-sm";

/** Glass-style card surface (slightly transparent, blurred) */
export const cardGlass =
  "rounded-lg border border-border/50 bg-card/80 text-card-foreground shadow-sm backdrop-blur-sm";

/** Elevated card with stronger shadow */
export const cardElevated =
  "rounded-xl border border-border bg-card text-card-foreground shadow-md";

// ---------------------------------------------------------------------------
// Typography helpers
// ---------------------------------------------------------------------------

/** Primary heading / title inside a card or section */
export const cardTitle = "text-foreground font-semibold";

/** Secondary description text */
export const cardDescription = "text-sm text-muted-foreground";

/** Small label (e.g. stat card label) */
export const labelSmall =
  "text-xs font-medium uppercase tracking-wider text-muted-foreground";

/** Large value display */
export const valueLarge = "text-2xl font-bold text-foreground";

/** Helper / hint text */
export const helperText = "text-sm text-muted-foreground";

// ---------------------------------------------------------------------------
// Panel / Section Surfaces
// ---------------------------------------------------------------------------

/** Muted panel surface for secondary areas */
export const panelSurface =
  "rounded-lg border border-border bg-muted/50 text-foreground";

/** Inset surface inside cards */
export const panelInset =
  "rounded-md border border-border/60 bg-muted/30 text-foreground";

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

/** Stat / metric card wrapper */
export const statCard =
  "rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm";

// ---------------------------------------------------------------------------
// Badge / Chip / Pill
// ---------------------------------------------------------------------------

/** Soft neutral badge */
export const softBadge =
  "inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground";

// ---------------------------------------------------------------------------
// Colored Card Variants
// ---------------------------------------------------------------------------
// Each variant provides a light background tint with proper foreground
// contrast for both themes.

export const coloredCard = {
  blue: "rounded-lg border border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100",
  info: "rounded-lg border border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100",
  amber:
    "rounded-lg border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100",
  warning:
    "rounded-lg border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100",
  green:
    "rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100",
  success:
    "rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100",
  violet:
    "rounded-lg border border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100",
  purple:
    "rounded-lg border border-purple-200 bg-purple-50 text-purple-900 dark:border-purple-500/20 dark:bg-purple-500/10 dark:text-purple-100",
  red: "rounded-lg border border-red-200 bg-red-50 text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-100",
  destructive:
    "rounded-lg border border-red-200 bg-red-50 text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-100",
  fuchsia:
    "rounded-lg border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-100",
  cyan: "rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-100",
} as const;

// ---------------------------------------------------------------------------
// Colored Badge Variants
// ---------------------------------------------------------------------------

export const coloredBadge = {
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/25 dark:bg-blue-500/15 dark:text-blue-300",
  info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300",
  amber:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300",
  green:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300",
  violet:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/15 dark:text-violet-300",
  purple:
    "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/25 dark:bg-purple-500/15 dark:text-purple-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/15 dark:text-red-300",
  destructive:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/15 dark:text-red-300",
  fuchsia:
    "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/25 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/25 dark:bg-cyan-500/15 dark:text-cyan-300",
  gray: "border-border bg-muted text-foreground",
} as const;

export type ColoredCardVariant = keyof typeof coloredCard;
export type ColoredBadgeVariant = keyof typeof coloredBadge;

// ---------------------------------------------------------------------------
// Sidebar helpers  (light-safe alternatives to bg-white/*, border-white/*)
// ---------------------------------------------------------------------------

/** Sidebar subtle background overlay */
export const sidebarOverlay =
  "bg-sidebar-accent/50 dark:bg-white/5";

/** Sidebar subtle border */
export const sidebarBorder =
  "border-sidebar-border dark:border-white/10";

/** Sidebar hover state */
export const sidebarHover =
  "hover:bg-sidebar-accent dark:hover:bg-white/5";

// ---------------------------------------------------------------------------
// Input / Form surface
// ---------------------------------------------------------------------------

export const inputSurface =
  "border-input bg-background text-foreground placeholder:text-muted-foreground";

// ---------------------------------------------------------------------------
// Convenience re-export bundle
// ---------------------------------------------------------------------------

export const themeClasses = {
  cardBase,
  cardGlass,
  cardElevated,
  cardTitle,
  cardDescription,
  labelSmall,
  valueLarge,
  helperText,
  panelSurface,
  panelInset,
  statCard,
  softBadge,
  coloredCard,
  coloredBadge,
  sidebarOverlay,
  sidebarBorder,
  sidebarHover,
  inputSurface,
} as const;
