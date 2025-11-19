// Train.js
//
// Interpolation / animation helpers used by JailedThreeJS.
// - Numeric lerping
// - Cubic-bezier easing
// - Generic value interpolation (numbers + arrays)
// - Time-based transitions over JS values
// - CSS keyframe-driven animation for custom props

import { exchange_rule, deep_searchParms, CSSValueTo3JSValue } from './artist.js';
import { getAnimationMap } from './utils.js';

/**
 * Linearly interpolate between two numbers.
 * @param {number} a
 * @param {number} b
 * @param {number} t in [0, 1]
 */
export function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Interpolate arrays with tolerant length handling.
 *
 * Length rule:
 * - For indices where both arrays have a value → lerp them.
 * - For indices that exist only in `from` → keep `from[i]`.
 * - For indices that exist only in `to`   → keep `to[i]`.
 *
 * Example:
 *   [x1,y1,z1,q1] → [x2,y2,z2]
 *   ==>
 *   [lerp(x1,x2), lerp(y1,y2), lerp(z1,z2), q1]
 *
 * @param {Array<number>} from
 * @param {Array<number>} to
 * @param {number} t
 * @param {(a:number,b:number,t:number)=>number} lerpMethod
 */
function lerpArray(from, to, t, lerpMethod) {
  const maxLen = Math.max(from.length, to.length);
  const out = new Array(maxLen);
  for (let i = 0; i < maxLen; i++) {
    const hasFrom = i < from.length;
    const hasTo = i < to.length;
    if (hasFrom && hasTo) {
      out[i] = lerpMethod(from[i], to[i], t);
    } else if (hasFrom) {
      out[i] = from[i];
    } else {
      out[i] = to[i];
    }
  }
  return out;
}

/**
 * Interpolate numbers or arrays using the provided lerp method.
 *
 * @param {number|Array<number>} from
 * @param {number|Array<number>} to
 * @param {number} t
 * @param {(a:number,b:number,t:number)=>number} lerpMethod
 */
export function lerpValue(from, to, t, lerpMethod = lerpNumber) {
  const isNum = v => typeof v === 'number';
  const isArr = Array.isArray;

  if (isNum(from) && isNum(to)) {
    return lerpMethod(from, to, t);
  }
  if (isArr(from) && isArr(to)) {
    return lerpArray(from, to, t, lerpMethod);
  }
  // Mixed or unsupported types: just return `to` instantly.
  return to;
}

/**
 * Create a cubic-bezier easing function.
 * Implementation adapted from https://github.com/gre/bezier-easing
 */
function cubicBezier(p0, p1, p2, p3) {
  const cx = 3 * p0;
  const bx = 3 * (p2 - p0) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1;
  const by = 3 * (p3 - p1) - cy;
  const ay = 1 - cy - by;

  function sampleCurveX(t) {
    return ((ax * t + bx) * t + cx) * t;
  }
  function sampleCurveY(t) {
    return ((ay * t + by) * t + cy) * t;
  }
  function sampleCurveDerivativeX(t) {
    return (3 * ax * t + 2 * bx) * t + cx;
  }
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
 * Resolve an easing function from a CSS timing function string.
 *
 * @param {string} timingFunction
 * @returns {(t:number)=>number}
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
      break;
  }

  if (typeof timingFunction === 'string' && timingFunction.startsWith('cubic-bezier')) {
    const match = timingFunction.match(/cubic-bezier\(([^)]+)\)/);
    if (match) {
      const nums = match[1]
        .split(/[, ]+/)
        .map(Number)
        .filter(n => !Number.isNaN(n));
      if (nums.length === 4) {
        return cubicBezier(nums[0], nums[1], nums[2], nums[3]);
      }
    }
  }

  // Fallback to linear on garbage.
  return t => t;
}

/**
 * Animate between two values over time.
 *
 * - Supports numbers and arrays (arrays follow the tolerant rule above).
 * - Non-animatable values resolve instantly (onUpdate + onComplete with `to`).
 *
 * @param {number|Array<number>} from
 * @param {number|Array<number>} to
 * @param {number} durationMs
 * @param {(value:any, easedT:number) => void} onUpdate
 * @param {(finalValue:any) => void} [onComplete]
 * @param {string} [timingFunction='linear']
 */
export function animateLerp(
  from,
  to,
  durationMs,
  onUpdate,
  onComplete,
  timingFunction = 'linear'
) {
  const isAnimatable = v =>
    typeof v === 'number' || Array.isArray(v);

  const finishInstant = () => {
    if (onUpdate) onUpdate(to, 1);
    if (onComplete) onComplete(to);
  };

  if (!isAnimatable(from) || !isAnimatable(to)) {
    finishInstant();
    return;
  }

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    finishInstant();
    return;
  }

  const start = performance.now();
  const ease = _get_Equation(timingFunction);

  function step(now) {
    let t = (now - start) / durationMs;
    if (t >= 1) t = 1;
    const easedT = ease(t);
    const value = lerpValue(from, to, easedT, lerpNumber);
    if (onUpdate) onUpdate(value, easedT);
    if (t < 1) {
      requestAnimationFrame(step);
    } else if (onComplete) {
      onComplete(value);
    }
  }

  requestAnimationFrame(step);
}

/**
 * Parse a keyframe time string into milliseconds.
 *
 * Supports:
 * - 'from' / 'to'
 * - percentages ('0%', '50%', '100%')
 * - '123ms'
 * - bare numbers treated as ms
 *
 * @param {string} keyText
 * @param {number} totalDuration
 */
function parseKeyframeTime(keyText, totalDuration) {
  if (!keyText) return 0;
  const text = String(keyText).trim().toLowerCase();

  if (text === 'from') return 0;
  if (text === 'to') return totalDuration;

  if (text.endsWith('%')) {
    const v = parseFloat(text);
    return Number.isFinite(v) ? (v / 100) * totalDuration : 0;
  }
  if (text.endsWith('ms')) {
    const v = parseFloat(text);
    return Number.isFinite(v) ? v : 0;
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Apply a CSS @keyframes animation to a Three.js object.
 *
 * @param {THREE.Object3D} object
 * @param {{
 *   name: string,
 *   duration: number,
 *   timing?: { fun?: string },
 *   iteration?: { count?: number | string }
 * }} animationObj
 */
export async function KeyFrameAnimationLerp(object, animationObj) {
  if (!object || !animationObj?.name || !animationObj?.duration) return;

  const keyFramesRule = getAnimationMap(animationObj.name);
  if (!keyFramesRule || !keyFramesRule.cssRules) {
    console.error(`Animation "${animationObj.name}" not found or has no rules.`);
    return;
  }

  const duration = animationObj.duration;

  const rules = Array.from(keyFramesRule.cssRules).slice();
  rules.sort(
    (a, b) =>
      parseKeyframeTime(a.keyText, duration) -
      parseKeyframeTime(b.keyText, duration)
  );

  const runOnce = async () => {
    for (let i = 0; i < rules.length - 1; i++) {
      const fromRule = rules[i];
      const toRule = rules[i + 1];
      const t0 = parseKeyframeTime(fromRule.keyText, duration);
      const t1 = parseKeyframeTime(toRule.keyText, duration);
      const segmentMs = t1 - t0;
      if (segmentMs <= 0) continue;

      const fromProps = {};
      const toProps = {};

      // Collect animatable custom props from "from" frame
      for (const propName of fromRule.style) {
        const raw = fromRule.style.getPropertyValue(propName);
        // custom props are expected to be `--foo-bar`
        if (!propName.startsWith('--')) continue;
        fromProps[propName.slice(2)] = CSSValueTo3JSValue(raw, object);
      }

      // Collect matching props from "to" frame
      for (const propName of toRule.style) {
        const raw = toRule.style.getPropertyValue(propName);
        if (!propName.startsWith('--')) continue;
        toProps[propName.slice(2)] = CSSValueTo3JSValue(raw, object);
      }

      const keys = Object.keys(fromProps).filter(k => k in toProps);
      if (!keys.length) continue;

      await Promise.all(
        keys.map(key => {
          const fromVal = fromProps[key];
          const toVal = toProps[key];

          // Resolve async assets before animating.
          const resolveValue = v =>
            (v && typeof v.then === 'function')
              ? v
              : Promise.resolve(v);

          return Promise.all([resolveValue(fromVal), resolveValue(toVal)])
            .then(([resolvedFrom, resolvedTo]) => new Promise(resolve => {
              animateLerp(
                resolvedFrom,
                resolvedTo,
                segmentMs,
                v => {
                  const { parent, key: finalKey } = deep_searchParms(object, key.split('-'));
                  exchange_rule(parent, finalKey, v);
                },
                resolve,
                animationObj.timing?.fun || 'linear'
              );
            }));
        })
      );
    }
  };

  let iterationCount = animationObj.iteration?.count ?? 1;
  if (iterationCount === 'infinity' || iterationCount === 'infinite') {
    iterationCount = Infinity;
  }

  if (iterationCount === Infinity) {
    // infinite loop – deliberately never resolves
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      await runOnce();
    }
  } else {
    const total = Number(iterationCount) || 1;
    for (let i = 0; i < total; i++) {
      // eslint-disable-next-line no-await-in-loop
      await runOnce();
    }
  }
}
