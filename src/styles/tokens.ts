/**
 * Design tokens — single source of truth, derived from DESIGN.md
 * Use these when you need values in JS (e.g. theme toggle persistence,
 * dynamic class generation). For everything else, prefer CSS variables.
 */

export const tokens = {
  color: {
    canvas: "var(--color-canvas)",
    canvasSoft: "var(--color-canvas-soft)",
    canvasSoft2: "var(--color-canvas-soft-2)",
    ink: "var(--color-ink)",
    body: "var(--color-body)",
    mute: "var(--color-mute)",
    hairline: "var(--color-hairline)",
    hairlineStrong: "var(--color-hairline-strong)",
    onPrimary: "var(--color-on-primary)",
    primary: "var(--color-primary-cta)",
    link: "var(--color-link)",
    linkDeep: "var(--color-link-deep)",
    success: "var(--color-success)",
    error: "var(--color-error)",
    errorSoft: "var(--color-error-soft)",
    warning: "var(--color-warning)",
    warningSoft: "var(--color-warning-soft)",
  },
  radius: {
    none: "var(--radius-none)",
    xs: "var(--radius-xs)",
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    xl: "var(--radius-xl)",
    pillSm: "var(--radius-pill-sm)",
    pill: "var(--radius-pill)",
    full: "var(--radius-full)",
  },
  space: {
    xxs: "var(--space-xxs)",
    xs: "var(--space-xs)",
    sm: "var(--space-sm)",
    md: "var(--space-md)",
    lg: "var(--space-lg)",
    xl: "var(--space-xl)",
    "2xl": "var(--space-2xl)",
    "3xl": "var(--space-3xl)",
    "4xl": "var(--space-4xl)",
    "5xl": "var(--space-5xl)",
    "6xl": "var(--space-6xl)",
  },
  shadow: {
    1: "var(--shadow-level-1)",
    2: "var(--shadow-level-2)",
    3: "var(--shadow-level-3)",
    4: "var(--shadow-level-4)",
    5: "var(--shadow-level-5)",
  },
} as const;

export type Tokens = typeof tokens;
