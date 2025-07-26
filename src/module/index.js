// Entry point for the JailedThreeJS module.
//
// This file re‑exports all public classes and helpers from the
// individual modules so that consumers can import from a single path.
//
// Example:
//   import { JThree, Cell } from 'jailedthreejs';
//
// The order of exports is intentional: `Cell` and `JThree` come first,
// followed by named exports from other modules.  If you add a new
// module exporting public helpers, be sure to re‑export it here.

export { default as Cell } from './cell.js';
export { default as JThree } from './main.js';
export * from './artist.js';
export * from './NoScope.js';
export * from './Train.js';
export * from './utils.js';