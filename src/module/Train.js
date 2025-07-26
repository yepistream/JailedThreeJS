// Train.js
//
// This module contains interpolation and animation helpers used by
// JailedThreeJS.  It implements numeric lerping, cubic‑bezier easing
// functions, generic value interpolation (`lerpValue`), a transition
// animator (`animateLerp`) and a CSS keyframe animator
// (`KeyFrameAnimationLerp`).  These helpers are independent of Three.js
// and may be reused for your own custom animations.

import { exchange_rule, deep_searchParms, CSSValueTo3JSValue } from './artist.js';
import { AllKeyFramesMap } from './utils.js';

/* TODO:
 *   - Add a stop function
 *   - Add a pause function
 *   - Add support for custom formulas for transition
 *   - Add animation keyframe support for other property types
 */

/**
 * Linearly interpolate between two numbers.
 * @param {number} a Starting value.
 * @param {number} b Ending value.
 * @param {number} t Interpolation factor in [0, 1].
 * @returns {number} The interpolated value.
 */
function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Create a cubic‑Bezier easing function.  Returns a function of `x`
 * that computes the corresponding y value.  See
 * https://github.com/gre/bezier-easing for the original implementation.
 *
 * @param {number} p0 Start control point x.
 * @param {number} p1 Start control point y.
 * @param {number} p2 End control point x.
 * @param {number} p3 End control point y.
 * @returns {(x: number) => number} A function computing y from x.
 */
function cubicBezier(p0, p1, p2, p3) {
  const cx = 3 * p0;
  const bx = 3 * (p2 - p0) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1;
  const by = 3 * (p3 - p1) - cy;
  const ay = 1 - cy - by;
  function sampleCurveX(t) { return ((ax * t + bx) * t + cx) * t; }
  function sampleCurveY(t) { return ((ay * t + by) * t + cy) * t; }
  function sampleCurveDerivativeX(t) { return (3 * ax * t + 2 * bx) * t + cx; }
  function solveTforX(x) {
    let t = x;
    for (let i = 0; i < 4; i++) {
      const dx = sampleCurveX(t) - x;
      if (Math.abs(dx) < 1e-6) return t;
      t -= dx / sampleCurveDerivativeX(t);
    }
    return t;
  }
  return x => sampleCurveY(solveTforX(x));
}

/**
 * Resolve the easing function from a CSS timing function string.
 * Supports standard keywords (`linear`, `ease`, `ease-in`, `ease-out`,
 * `ease-in-out`) as well as cubic‑Bezier specifications of the form
 * `cubic-bezier(x1, y1, x2, y2)`.
 *
 * @param {string} timingFunction The CSS timing function name.
 * @returns {(t: number) => number} An easing function of t.
 */
function _get_Equation(timingFunction) {
  switch (timingFunction) {
    case 'linear':
      return t => t;
    case 'ease':
      return cubicBezier(0.25, 0.1, 0.25, 1.0);
    case 'ease-in':
      return cubicBezier(0.42, 0, 1.0, 1.0);
    case 'ease-out':
      return cubicBezier(0, 0, 0.58, 1.0);
    case 'ease-in-out':
      return cubicBezier(0.42, 0, 0.58, 1.0);
    default:
      if (timingFunction.startsWith('cubic-bezier')) {
        const nums = timingFunction
          .match(/cubic-bezier\(([^)]+)\)/)[1]
          .split(/[, ]+/)
          .map(Number);
        if (nums.length === 4 && nums.every(n => !isNaN(n))) {
          return cubicBezier(nums[0], nums[1], nums[2], nums[3]);
        }
      }
      return t => t;
  }
}

/**
 * Interpolate numbers or arrays using the provided lerp method.
 * Both arguments must be of the same type (number or array).  Arrays
 * must be of equal length.  Throws if the types do not match.
 *
 * @param {number|Array<number>} from Starting value.
 * @param {number|Array<number>} to Ending value.
 * @param {number} t Interpolation factor.
 * @param {(a: number, b: number, t: number) => number} lerpMethod Function to lerp individual numbers.
 * @returns {number|Array<number>} The interpolated value.
 */
function lerpValue(from, to, t, lerpMethod) {
  if (typeof from === 'number' && typeof to === 'number') {
    return lerpMethod(from, to, t);
  }
  if (Array.isArray(from) && Array.isArray(to)) {
    if (from.length !== to.length) throw new Error('Array sizes do not match.');
    return from.map((v, i) => lerpMethod(v, to[i], t));
  }
  throw new Error(`Value ${from} to ${to} is not supported by transition`);
}

/**
 * Animate between two values over time.  Primitive numbers or arrays
 * are interpolated via `lerpValue` and the supplied easing function.
 * When the animation completes the optional `onComplete` callback is
 * invoked.  The returned promise resolves when the animation finishes.
 *
 * @param {number|Array<number>} from Starting number or array.
 * @param {number|Array<number>} to Ending number or array.
 * @param {number} durationMs Duration in milliseconds.
 * @param {(value: any, easedT: number) => void} onUpdate Callback for each frame.
 * @param {() => void} [onComplete] Callback when complete.
 * @param {string} [timingFunction='linear'] CSS timing function name.
 */
export function animateLerp(from, to, durationMs, onUpdate, onComplete, timingFunction = 'linear') {
  if (typeof from === 'number' || Array.isArray(from)) {
    const start = performance.now();
    const ease = _get_Equation(timingFunction);
    function step(now) {
      let t = (now - start) / durationMs;
      if (t > 1) t = 1;
      const easedT = ease(t);
      const value = lerpValue(from, to, easedT, lerpNumber);
      onUpdate(value, easedT);
      if (t < 1) {
        requestAnimationFrame(step);
      } else if (onComplete) {
        onComplete(value);
      }
    }
    requestAnimationFrame(step);
  }
}

/**
 * Apply a CSS keyframe animation to a Three.js object.  The
 * `animationObj` must contain at least a `name` referring to a
 * `@keyframes` rule present in the document and a `duration` in
 * milliseconds.  The optional `iteration` field controls looping.  When
 * `iteration.count` is `'infinity'` the animation repeats indefinitely.
 *
 * @param {THREE.Object3D} object The Three.js object to animate.
 * @param {{name: string, duration: number, timing?: {fun?: string}, iteration?: {count: number|string}}} animationObj Animation settings.
 */
export async function KeyFrameAnimationLerp(object, animationObj) {
  const keyFramesRule = AllKeyFramesMap.get(animationObj.name);
  if (!keyFramesRule) {
    throw new Error(`Animation ${animationObj.name} not found`);
  }
  function parseTime(keyText) {
    if (keyText.endsWith('%')) {
      return (parseFloat(keyText) / 100) * animationObj.duration;
    }
    if (keyText.endsWith('ms')) {
      return parseFloat(keyText);
    }
    return Number(keyText);
  }
  const rules = Array.from(keyFramesRule.cssRules);
  rules.sort((a, b) => parseTime(a.keyText) - parseTime(b.keyText));
  for (let i = 0; i < rules.length - 1; i++) {
    const fromRule = rules[i];
    const toRule   = rules[i + 1];
    const t0 = parseTime(fromRule.keyText);
    const t1 = parseTime(toRule.keyText);
    const segmentMs = t1 - t0;
    const fromProps = {};
    const toProps   = {};
    for (const propName of fromRule.style) {
      const raw = fromRule.style.getPropertyValue(propName);
      fromProps[propName.slice(2)] = CSSValueTo3JSValue(raw);
    }
    for (const propName of toRule.style) {
      const raw = toRule.style.getPropertyValue(propName);
      toProps[propName.slice(2)] = CSSValueTo3JSValue(raw);
    }
    const keys = Object.keys(fromProps).filter(k => k in toProps);
    await Promise.all(
      keys.map(key =>
        new Promise(resolve => {
          animateLerp(
            fromProps[key],
            toProps[key],
            segmentMs,
            (v) => {
              const { parent, key: finalKey } = deep_searchParms(object, key.split('-'));
              exchange_rule(parent, finalKey, v);
            },
            resolve,
            animationObj.timing?.fun || 'linear'
          );
        })
      )
    );
  }
  if (animationObj.iteration?.count === 'infinity') animationObj.iteration.count = Infinity;
  if (animationObj.iteration?.count > 0) {
    animationObj.iteration.count--;
    return KeyFrameAnimationLerp(object, animationObj);
  }
}