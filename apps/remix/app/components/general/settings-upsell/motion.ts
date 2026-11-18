/**
 * Shared motion vocabulary for the settings upsell previews. Values ported
 * from the design prototype (`design/SSO Upsell.dc.html`).
 */
export const SPRING = { type: 'spring', stiffness: 280, damping: 22 } as const;

export const POP = { type: 'spring', stiffness: 420, damping: 16 } as const;

export const EASE = [0.22, 0.61, 0.36, 1] as const;
