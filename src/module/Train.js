import { exchange_rule, deep_searchParms,CSSValueTo3JSValue } from "./artist.js";
import { AllKeyFramesMap, gatherKeyFrame_MAP } from "./utils.js";

/*       TODO:
    ?   Add A Stop Function
    ?   Add A Pause Function
    ?   Add A Switch-Case For Type Of Formula For Transition.
    ?   Add Animation KeyFrame Support.
*/


function lerpNumber(a, b, t) {
    return a + (b - a) * t;
}


// cubic-bezier factory: returns a function f(t) implementing the curve
function cubicBezier(p0, p1, p2, p3) {
  // from https://github.com/gre/bezier-easing (simplified)
  const cx = 3 * p0;
  const bx = 3 * (p2 - p0) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1;
  const by = 3 * (p3 - p1) - cy;
  const ay = 1 - cy - by;

  function sampleCurveX(t) { return ((ax * t + bx) * t + cx) * t; }
  function sampleCurveY(t) { return ((ay * t + by) * t + cy) * t; }
  function sampleCurveDerivativeX(t) { return (3 * ax * t + 2 * bx) * t + cx; }

  // Given x, find t via Newton–Raphson.
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

function _get_Equation(timingFunction) {
  switch (timingFunction) {
    case "linear":
      return t => t;

    case "ease":
      // equivalent to cubic-bezier(0.25, 0.1, 0.25, 1.0)
      return cubicBezier(0.25, 0.1, 0.25, 1.0);

    case "ease-in":
      // cubic-bezier(0.42, 0, 1.0, 1.0)
      return cubicBezier(0.42, 0, 1.0, 1.0);

    case "ease-out":
      // cubic-bezier(0, 0, 0.58, 1.0)
      return cubicBezier(0, 0, 0.58, 1.0);

    case "ease-in-out":
      // cubic-bezier(0.42, 0, 0.58, 1.0)
      return cubicBezier(0.42, 0, 0.58, 1.0);

    default:
      // allow "cubic-bezier(x1, y1, x2, y2)" strings
      if (timingFunction.startsWith("cubic-bezier")) {
        const nums = timingFunction
          .match(/cubic-bezier\(([^)]+)\)/)[1]
          .split(/[, ]+/)
          .map(Number);
        if (nums.length === 4 && nums.every(n => !isNaN(n))) {
          return cubicBezier(nums[0], nums[1], nums[2], nums[3]);
        }
      }
      // Fallback: linear
      return t => t;
  }
}

// Usage example:
const easeFunc = _get_Equation("ease-in-out");
//console.log(easeFunc(0.5)); // ~0.5 but eased


function lerpValue(from, to, t, lerpMethod) {
    // Both numbers
    if (typeof from === 'number' && typeof to === 'number') {
        return lerpMethod(from, to, t);
    }
    // Both arrays
    if (Array.isArray(from) && Array.isArray(to)) {
        if (from.length !== to.length) throw new Error("Array sizes do not match.");
        return from.map((v, i) => lerpMethod(v, to[i], t));
    }
    throw `A Value ${from} to ${to} Is Not Supported By Transition `;
}




export function animateLerp(from, to, durationMs, onUpdate, onComplete, timingFunction = "linear") {
  if (typeof from === "number" || Array.isArray(from)) {
    const start = performance.now();
    const ease = _get_Equation(timingFunction);

    function step(now) {
      //if(og == null) og = now;
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


function parseTime(str, totalMs) {
  if (typeof str === 'number') return str;
  if (str.endsWith('%')) {
    return (parseFloat(str) / 100) * totalMs;
  }
  if (str.endsWith('ms')) {
    return parseFloat(str);
  }
  throw new Error(`Unsupported time format: ${str}`);
}

export async function KeyFrameAnimationLerp(object, animationObj) {
  // 1) grab the rule
  const keyFramesRule = AllKeyFramesMap.get(animationObj.name);
  if (!keyFramesRule) {
    throw new Error(`!${animationObj.name} not found : 404!`);
  }

  // 2) parse “0%” or “500ms” against animationObj.duration
  function parseTime(keyText) {
    if (keyText.endsWith('%')) {
      return (parseFloat(keyText) / 100) * animationObj.duration;
    }
    if (keyText.endsWith('ms')) {
      return parseFloat(keyText);
    }
    return Number(keyText);
  }

  // 3) pull & sort individual keyframe rules
  const rules = Array.from(keyFramesRule.cssRules);
  rules.sort((a, b) => parseTime(a.keyText) - parseTime(b.keyText));

  // 4) for each adjacent pair…
  for (let i = 0; i < rules.length - 1; i++) {
    const fromRule = rules[i];
    const toRule   = rules[i + 1];
    const t0 = parseTime(fromRule.keyText);
    const t1 = parseTime(toRule.keyText);
    const segmentMs = t1 - t0;

    // 5) extract start/end values via your CSSValueTo3JSValue
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
    // 6) only animate props that exist in both frames
    const keys = Object.keys(fromProps).filter(k => k in toProps);
    // 7) run all tweens in parallel, await them
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
            animationObj.timing.fun || 'linear'
          );
        })
      )
    );
  }
  if (animationObj.iteration.count === 'infinity') animationObj.iteration.count = Infinity;

  // 8) done—you can optionally loop by re-calling if animationObj.isLoop is truthy
  if (animationObj.iteration.count > 0) {
    animationObj.iteration.count--;
    return KeyFrameAnimationLerp(object, animationObj);
  }
}

