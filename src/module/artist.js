// artist.js
//
// Maps CSS custom properties + selectors to Three.js objects.
// Handles:
// - CSS → Three value conversion
// - Transition interpolation
// - Keyframe-driven animations
// - Pseudo-class painting (:hover, :focus, :active)

import { getAsset } from './utils.js';
import Cell from './cell.js';
import { animateLerp, KeyFrameAnimationLerp } from './Train.js';
import * as THREE from 'three';

function getObjectClassSelectors(object) {
  const list = object?.userData?.classList;
  if (Array.isArray(list) && list.length > 0) return list;
  return object?.name ? [object.name] : [];
}

function hasClassPseudoRule(object, pseudo) {
  return getObjectClassSelectors(object).some(cls => getCSSRule(`.${cls}${pseudo}`));
}

function parseAnimationCSS(value) {
  if (!value) return null;

  const lower = value.trim().toLowerCase();
  if (!lower || lower === 'none') return null;

  const parts = lower.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;

  // First token = name (keep original case for the keyframe name)
  const nameToken = parts.shift();
  if (!nameToken) return null;

  let durationMs = 1000;     // default 1s
  let timingFun = 'linear';  // default timing
  let iterationCount = 1;    // default once

  // Duration
  if (parts.length) {
    const timeToken = parts[0];
    if (/\d/.test(timeToken)) {
      parts.shift();
      if (timeToken.endsWith('ms')) {
        durationMs = parseFloat(timeToken);
      } else if (timeToken.endsWith('s')) {
        durationMs = parseFloat(timeToken) * 1000;
      } else {
        durationMs = parseFloat(timeToken);
      }
    }
  }

  // Look for "infinite"/"infinity" in the remaining tokens
  const infIndex = parts.findIndex(t => t === 'infinite' || t === 'infinity');
  if (infIndex !== -1) {
    iterationCount = 'infinite';
    parts.splice(infIndex, 1);
  } else if (parts.length) {
    const maybeCount = parseInt(parts[parts.length - 1], 10);
    if (Number.isFinite(maybeCount) && maybeCount > 0) {
      iterationCount = maybeCount;
      parts.pop();
    }
  }

  // Whatever is left becomes the timing function string
  if (parts.length) {
    timingFun = parts.join(' ');
  }

  return {
    name: nameToken,
    duration: durationMs,
    iteration: { count: iterationCount },
    timing: { fun: timingFun }
  };
}



function parseTransitionCSS(value) {
  if (!value) return null;

  const lower = value.trim().toLowerCase();
  if (!lower || lower === 'none') return null;

  const parts = lower.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;

  const timeToken = parts.shift();
  let durationMs;

  if (timeToken.endsWith('ms')) {
    durationMs = parseFloat(timeToken);
  } else if (timeToken.endsWith('s')) {
    durationMs = parseFloat(timeToken) * 1000;
  } else {
    durationMs = parseFloat(timeToken);
  }

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }

  const timingFun = parts.join(' ') || 'linear';

  return {
    duration: durationMs,
    timing: { fun: timingFun }
  };
}


/**
 * Find first CSS rule whose selector list contains `selector` token.
 *
 * @param {string} selector
 * @returns {CSSStyleRule|undefined}
 */
export function getCSSRule(selector) {
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      // cross-origin stylesheet
      continue;
    }
    for (const rule of rules) {
      if (!rule.selectorText) continue;
      const selectors = rule.selectorText.split(',');
      for (const sel of selectors) {
        if (sel.trim().split(/\s+/).includes(selector)) {
          return rule;
        }
      }
    }
  }
}

/**
 * Walk an object path and return parent + final key.
 *
 * @param {Object} object
 * @param {string[]} path
 * @returns {{parent:Object, key:string}}
 */
export function deep_searchParms(object, path) {
  const key = path[path.length - 1];
  const parent = path.slice(0, -1).reduce((o, k) => {
    if (o[k] == null) o[k] = {};
    return o[k];
  }, object);
  return { parent, key };
}

/**
 * Convert CSS value → Three.js friendly value.
 *
 * - "(1,2,3)" → [1,2,3]
 * - "1.25"     → 1.25
 * - "@foo"     → asset from getAsset('foo')
 * - "#id-..."  → property copied from another convict in the same cell
 *
 * @param {string} value
 * @param {THREE.Object3D|null} [__object=null]
 * @returns {any}
 */
export function CSSValueTo3JSValue(value, __object = null) {
  let parsed;

  if (/^\(.+\)$/.test(value)) {
    parsed = value.slice(1, -1).split(',').map(v => parseFloat(v.trim()));
  } else if (!Number.isNaN(parseFloat(value))) {
    parsed = parseFloat(value);
  } else {
    parsed = value.replace(/^['"]|['"]$/g, '');
  }

  if (typeof parsed === 'string') {
    switch (parsed[0]) {
      case '@': {
        const p = parsed.slice(1);
        return getAsset(p);
      }
      case '#': {
        if (!__object) {
          console.error('CSSValueTo3JSValue: __object is null when resolving', parsed);
          return null;
        }
        try {
          const cellElement = __object.userData.domEl.closest('cell');
          const actualCellObject = Cell.getCell(cellElement);
          const path = parsed.split('-');
          if (path.length < 1) {
            throw new Error('Requesting empty paths using "#" is not allowed');
          }
          const targetObject = actualCellObject.getConvictById(path[0].slice(1));
          if (!targetObject) {
            throw new Error('Failed to find object with id ' + parsed);
          }
          path.shift();
          const { parent, key } = deep_searchParms(targetObject, path);
          return parent[key];
        } catch (err) {
          console.error(err);
          return undefined;
        }
      }
      default:
        break;
    }
  }

  return parsed;
}

/**
 * Assign a value to a property, handling vectors / setters / plain fields.
 *
 * @param {Object} parent
 * @param {string} key
 * @param {any} value
 */
export function exchange_rule(parent, key, value) {
  if (!parent) return;
  const target = parent[key];

  try {
    if (Array.isArray(value)) {
      if (target && typeof target.set === 'function') {
        target.set(...value);
      } else if (typeof target === 'function') {
        target(...value);
      } else {
        parent[key] = value;
      }
      return;
    }

    // scalar or non-array
    if (target && typeof target.set === 'function') {
      target.set(value);
    } else if (typeof target === 'function') {
      target(value);
    } else {
      parent[key] = value;
    }
  } catch (err) {
    console.warn(`Failed to assign ${key} with`, value, err);
  }
}

/**
 * Core rule application.
 *
 * @param {CSSStyleRule|HTMLElement} rule
 * @param {THREE.Object3D} object
 * @param {string|null} [_chosenOne=null] selector that caused this rule
 */
function _apply_rule(rule, object, _chosenOne = null) {
  if (!rule || !rule.style || !object) return;

  const domEl = object.userData.domEl;
  object.userData._lastCSS = object.userData._lastCSS || Object.create(null);

  // enable picking layer when interactive / pseudo-rules exist
  if (
    domEl?.hasAttribute('onclick') ||
    domEl?.hasAttribute('onmouseover') ||
    domEl?.hasAttribute('ondblclick') ||
    domEl?.hasAttribute('onmousedown') ||
    domEl?.hasAttribute('onmouseup') ||
    domEl?.hasAttribute('oncontextmenu') ||
    hasClassPseudoRule(object, ':hover') ||
    hasClassPseudoRule(object, ':focus') ||
    (object.userData.domId && getCSSRule(`#${object.userData.domId}:focus`)) ||
    (object.userData.domId && getCSSRule(`#${object.userData.domId}:hover`))
  ) {
    object.layers.enable(3);
  } else {
    object.layers.disable(3);
  }

  for (let i = 0; i < rule.style.length; i++) {
  const rawProp = rule.style[i];
  const value = rule.style.getPropertyValue(rawProp).trim();

  if (!rawProp.startsWith('--')) continue;

  // CSS-driven transition config
  if (rawProp === '--transition') {
    const cfg = parseTransitionCSS(value);
    object.transition = cfg;       // may be null if "none"
    continue;
  }

  // CSS-driven animation config
  if (rawProp === '--animation') {
    const animCfg = parseAnimationCSS(value);
    object.animation = animCfg;    // may be null if "none"
    continue;
  }

  // Normal custom property flow (position, rotation, etc.)
  const prop = rawProp.slice(2);
  const path = prop.split('-');
  const parsed = CSSValueTo3JSValue(value, object);
  const { parent, key } = deep_searchParms(object, path);

  const assignValue = (resolvedValue) => {
    if (resolvedValue === undefined) return;

    const transition = object.transition;
    const currentRaw = parent[key];
    const currentValue =
      currentRaw && typeof currentRaw.toArray === 'function'
        ? currentRaw.toArray()
        : currentRaw;

    const duration = transition?.duration ?? 0;
    const timingFn = transition?.timing?.fun ?? 'linear';
    const isAnimatable =
      transition &&
      duration > 0 &&
      (typeof currentValue === 'number' || Array.isArray(currentValue)) &&
      (typeof resolvedValue === 'number' || Array.isArray(resolvedValue));

    if (isAnimatable) {
      animateLerp(
        currentValue,
        resolvedValue,
        duration,
        v => exchange_rule(parent, key, v),
        () => {
          object.dispatchEvent({
            type: 'TransitionFinished',
            target: object,
            detail: { selector: _chosenOne, to: parent }
          });
        },
        timingFn
      );
    } else {
      exchange_rule(parent, key, resolvedValue);
    }
  };

  if (parsed && typeof parsed.then === 'function') {
    parsed.then(assignValue).catch(err =>
      console.error('Failed to resolve asset for', rawProp, err)
    );
  } else {
    assignValue(parsed);
  }
}
  


 if (object.animation) {
    // Don't restart the animation every repaint
    if (!object.userData._animationRunning) {
      object.userData._animationRunning = true;

      (async () => {
        try {
          await KeyFrameAnimationLerp(object, object.animation);
        } catch (err) {
          console.error(err);
        } finally {
          // For infinite animations this never runs, which is fine:
          // we keep the flag true and never restart.
          object.userData._animationRunning = false;
        }
      })();
    }
  }
}

/**
 * Apply rules for a specific element inside a cell (inline style changes).
 *
 * @param {HTMLElement} convictElm
 * @param {Cell} cell
 */
export function paintConvict(convictElm, cell) {
  const convict = cell._allConvictsByDom.get(convictElm);
  if (convict) {
    _apply_rule(convictElm, convict);
  }
}

/**
 * Paint :hover / :focus / :active selectors for all convicts in a cell.
 *
 * @param {Cell} muse
 */
export function paintExtraCell(muse) {
  for (const obj of muse.classyConvicts) {
    const classes = getObjectClassSelectors(obj);
    (obj.userData.extraParams || []).forEach(param => {
      classes.forEach(cls => {
        const rule = getCSSRule(`.${cls}${param}`);
        if (rule) _apply_rule(rule, obj);
      });
    });
  }

  for (const obj of muse.namedConvicts) {
    if (!obj.userData.domId) continue;
    (obj.userData.extraParams || []).forEach(param => {
      const rule = getCSSRule(`#${obj.userData.domId}${param}`);
      if (rule) _apply_rule(rule, obj);
    });
  }
}

/**
 * Paint base class/id rules for an entire cell.
 *
 * @param {Cell} muse
 */
export function paintCell(muse) {
  for (const obj of muse.classyConvicts) {
    for (const cls of getObjectClassSelectors(obj)) {
      const rule = getCSSRule(`.${cls}`);
      if (rule) _apply_rule(rule, obj, `.${cls}`);
    }
  }
  for (const obj of muse.namedConvicts) {
    if (!obj.userData.domId) continue;
    const rule = getCSSRule(`#${obj.userData.domId}`);
    if (rule) _apply_rule(rule, obj, `#${obj.userData.domId}`);
  }
}

/**
 * Paint a single object: base rules, pseudo-rules, inline style.
 *
 * @param {THREE.Object3D} muse
 */
export function paintSpecificMuse(muse) {
  const extra = muse.userData.extraParams || [];

  getObjectClassSelectors(muse).forEach(cls => {
    const rule = getCSSRule(`.${cls}`);
    if (rule) _apply_rule(rule, muse);
  });

  if (muse.userData.domId) {
    const baseIdRule = getCSSRule(`#${muse.userData.domId}`);
    if (baseIdRule) _apply_rule(baseIdRule, muse);
  }

  extra.forEach(param => {
    getObjectClassSelectors(muse).forEach(cls => {
      const clsRule = getCSSRule(`.${cls}${param}`);
      if (clsRule) _apply_rule(clsRule, muse);
    });
  });

  if (muse.userData.domId) {
    extra.forEach(param => {
      const idRule = getCSSRule(`#${muse.userData.domId}${param}`);
      if (idRule) _apply_rule(idRule, muse);
    });
  }

  if (muse.userData.domEl?.hasAttribute('style')) {
    _apply_rule(muse.userData.domEl, muse);
  }
}

/**
 * Apply constant :active rules each frame for flagged convicts.
 *
 * @param {THREE.Object3D} muse
 */
export function paintConstantMuse(muse) {
  getObjectClassSelectors(muse).forEach(cls => {
    const rule = getCSSRule(`.${cls}:active`);
    if (rule) _apply_rule(rule, muse);
  });
  if (muse.userData.domId) {
    const rule = getCSSRule(`#${muse.userData.domId}:active`);
    if (rule) _apply_rule(rule, muse);
  }
}
