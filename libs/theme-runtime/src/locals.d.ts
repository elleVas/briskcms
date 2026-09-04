/**
 * Ambient augmentation of Astro's `App.Locals` with what Brisk core
 * provides — referenced, not imported, so a theme gets the typing by
 * adding this one line to its own `env.d.ts`:
 *
 * ```ts
 * /// <reference types="@brisk/theme-runtime/locals" />
 * ```
 *
 * Members are listed here one by one rather than by extending
 * `BriskThemeLocals` wholesale: an interface that only extends a supertype
 * is empty, which lint rejects, and naming them keeps this file an honest
 * inventory of what core actually puts on locals. The signatures stay
 * single-sourced from ./lib/locals.ts, which is where the documentation
 * lives.
 */
import type { BriskThemeLocals } from './lib/locals';

declare global {
  namespace App {
    interface Locals {
      resolveIcon: BriskThemeLocals['resolveIcon'];
    }
  }
}

export {};
