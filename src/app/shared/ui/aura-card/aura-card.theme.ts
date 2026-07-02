export const auraCardTokens = {
  radius: 'var(--card-radius, var(--aura-radius-lg, 10px))',
  padding: 'var(--card-padding, var(--aura-space-4, 16px))',
  shadow: 'var(--card-shadow, var(--aura-shadow-xs, 0 1px 2px rgba(75, 18, 56, 0.05)))',
  hoverShadow: 'var(--card-hover-shadow, var(--aura-shadow-card, 0 10px 26px rgba(75, 18, 56, 0.07)))',
  transition: 'var(--card-transition, var(--aura-transition-base, 180ms ease))',
  borderRadius: 'var(--card-border-radius, var(--aura-radius-lg, 10px))'
} as const;

export type AuraCardTokenName = keyof typeof auraCardTokens;