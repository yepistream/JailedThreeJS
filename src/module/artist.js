// artist.js
//
// This module implements the logic that maps CSS custom properties
// and selectors onto Three.js objects.  When a cell is scanned the
// objects created from your DOM are painted according to matching CSS
// rules.  Custom properties prefixed with `--` are parsed into numbers,
// vectors or strings and assigned onto the object.  If the object has
// an `onmouseover`, `onclick`, `ondblclick`, `onmousedown`, `onmouseup` or
// `oncontextmenu` attribute then its render layer 3 is enabled to make
// it pickable by the raycaster.

import { getAsset } from './utils.js';
import Cell from './cell.js';
import { animateLerp, KeyFrameAnimationLerp } from './Train.js';
import * as THREE from 'three';

/**
 * Find the first rule whose selectorText tokens include a specific
 * selector.  Walk through all stylesheets attached to the document and
 * return the first matching CSSRule.  Returns `undefined` if nothing
 * matches.
 *
 * @param {string} selector The selector to look for (e.g. '.foo', '#bar').
 * @returns {CSSStyleRule|undefined} The matched rule or undefined.
 */
export function getCSSRule(selector) {
  for (let sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; }
    catch { continue; }
    for (let rule of rules) {
      if (!rule.selectorText) continue;
      for (let sel of rule.selectorText.split(',')) {
        if (sel.trim().split(/\s+/).includes(selector)) {
          return rule;
        }
      }
    }
  }
}

/**
 * Walk an object along a nested path and return the parent and final key.
 * Missing intermediate objects are created on the fly.  For example
 * `deep_searchParms(obj, ['position','x'])` returns `{ parent: obj.position,
 * key: 'x' }`.
 *
 * @param {Object} object The root object.
 * @param {string[]} path An array of property names.
 * @returns {{parent: Object, key: string}} The parent object and last key.
 */
export function deep_searchParms(object, path) {
  const key    = path[path.length - 1];
  const parent = path.slice(0, -1).reduce((o, k) => {
    if (o[k] == null) o[k] = {};
    return o[k];
  }, object);
  return { parent, key };
}

/**
 * Apply a CSS custom property rule to a Three.js object.  Custom
 * properties must be prefixed with `--`.  This function parses the
 * property into an appropriate JS value (number, vector, asset reference
 * or string) and assigns it to the target object.  If the object has
 * a `transition` defined then interpolation is performed via
 * `animateLerp`.  Otherwise the value is assigned immediately.
 *
 * @param {CSSStyleRule|HTMLElement} rule The CSS rule or inline style to apply.
 * @param {THREE.Object3D} object The target Three.js object.
 * @param {string|null} [_chosenOne=null] Optional selector that triggered the rule.
 */
function _apply_rule(rule, object, _chosenOne = null) {
  if (!rule || !rule.style) return;

  // enable picking layer when event handlers are present
  if (object.userData.domEl.hasAttribute('onclick') ||
      object.userData.domEl.hasAttribute('onmouseover') ||
      object.userData.domEl.hasAttribute('ondblclick') ||
      object.userData.domEl.hasAttribute('onmousedown') ||
      object.userData.domEl.hasAttribute('onmouseup') ||
      object.userData.domEl.hasAttribute('oncontextmenu')) {
    object.layers.enable(3);
  } else {
    object.layers.disable(3);
  }

  for (let i = 0; i < rule.style.length; i++) {
    const rawProp = rule.style[i];
    const value   = rule.style.getPropertyValue(rawProp).trim();
    const prop    = rawProp.slice(2);          // drop leading '--'
    const path    = prop.split('-');
    const parsed  = CSSValueTo3JSValue(value, object);
    const { parent, key } = deep_searchParms(object, path);
    if (object.transition != null) {
      animateLerp(
        parent[key].toArray instanceof Function ? parent[key].toArray() : parent[key],
        parsed,
        object.transition.duration || 0,
        (v, t) => {
          exchange_rule(parent, key, v);
        },
        () => {
          object.dispatchEvent({
            type: 'TransitionFinished',
            target: object,
            detail: {
              selector: _chosenOne,
              to: parent
            }
          });
        },
        object.transition.timing.fun || 'linear'
      );
    } else {
      exchange_rule(parent, key, parsed);
    }
  }
  if (object.animation) {
    KeyFrameAnimationLerp(object, object.animation).catch(console.error);
  }
}

/**
 * Convert a CSS value into a Three.js compatible value.  Strings are
 * stripped of surrounding quotes.  Comma‑separated values inside
 * parentheses are converted into arrays of numbers.  Plain numbers are
 * parsed into floats.  Strings beginning with `@` trigger an asset
 * lookup via `getAsset`.  Strings beginning with `#` copy a property
 * from another object within the same cell.
 *
 * @param {string} value The raw CSS value.
 * @param {THREE.Object3D|null} [__object=null] The reference object for lookups.
 * @returns {any} A number, array, asset, other object property or string.
 */
export function CSSValueTo3JSValue(value, __object = null) {
  let parsed;
  if (/^\(.+\)$/.test(value)) {
    parsed = value.slice(1, -1).split(',').map(v => parseFloat(v.trim()));
  } else if (!isNaN(parseFloat(value))) {
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
        if (__object) {
          try {
            const cellElement = __object.userData.domEl.closest('cell');
            const actualCellObject = Cell.getCell(cellElement);
            const path = parsed.split('-');
            if (path.length < 1) {
              throw new Error('Requesting empty paths using "#" is not allowed');
            }
            const targetObject = actualCellObject.getConvictById(path[0].slice(1));
            if (targetObject) {
              path.shift();
              const { parent, key } = deep_searchParms(targetObject, path);
              return parent[key];
            } else {
              throw new Error('Failed to find object with id ' + parsed);
            }
          } catch (err) {
            console.error(err);
          }
          return undefined;
        } else {
          console.error('CSSValueTo3JSValue: __object is null when resolving', parsed);
          return null;
        }
      }
      default:
        break;
    }
  }
  return parsed;
}

/**
 * Assign a value to a property, supporting vectors and setter functions.
 * This helper centralises the various ways of assigning into Three.js
 * objects.  If the property is a function then it is called with the
 * supplied array, otherwise if the property has a `.set` method that
 * accepts either an array or scalar then that is used.  Failing that the
 * value is assigned directly.  In case of error the assignment is
 * silently ignored.
 *
 * @param {Object} parent The object containing the property to set.
 * @param {string} key The property name.
 * @param {any} value A number, array or other assignable value.
 */
export function exchange_rule(parent, key, value) {
  if (Array.isArray(value) && typeof parent[key] === 'function') {
    const backup = parent?.clone?.();
    parent[key](...value);
    if (Number.isNaN(parent) || parent === undefined) {
      parent.copy(backup.add(new parent.constructor(...value)));
    }
    return;
  } else if (typeof parent[key]?.set === 'function') {
    if (Array.isArray(value)) {
      parent[key].set(...value);
    } else {
      parent[key].set(value);
    }
    return;
  } else {
    try {
      if (typeof parent[key] === 'function') {
        parent[key](value);
      } else {
        parent[key] = value;
      }
    } catch (err) {
      console.warn(`Failed to assign ${key} with`, value, err);
    }
    return;
  }
}

/**
 * Apply rules for a specific element inside a cell.  Internally this
 * looks up the Three.js object corresponding to the DOM element and
 * forwards the rule to `_apply_rule`.
 *
 * @param {HTMLElement} convictElm The DOM element whose styles should be applied.
 * @param {Cell} cell The cell owning the element.
 */
export function paintConvict(convictElm, cell) {
  _apply_rule(convictElm, cell._allConvictsByDom.get(convictElm));
}

/**
 * Apply any `:hover`, `:focus` or `:active` selectors to all objects in a cell.
 * This iterates over the cell’s `classyConvicts` and `namedConvicts` lists
 * and calls `_apply_rule` with the appropriate pseudo‑class.  It is
 * typically called after events are processed to update an object’s
 * appearance.
 *
 * @param {Cell} muse The cell instance to paint.
 */
export function paintExtraCell(muse) {
  for (let obj of muse.classyConvicts) {
    obj.userData.extraParams.forEach(param => {
      const rule = getCSSRule(`.${obj.name}${param}`);
      if (rule) _apply_rule(rule, obj);
    });
  }
  for (let obj of muse.namedConvicts) {
    if (!obj.userData.domId) continue;
    obj.userData.extraParams.forEach(param => {
      const rule = getCSSRule(`#${obj.userData.domId}${param}`);
      if (rule) _apply_rule(rule, obj);
    });
  }
}

/**
 * Paint all objects in a cell based on their class or id selectors.  This
 * does not apply pseudo‑classes.  It should be called after the initial
 * scan or whenever the underlying CSS rules change.
 *
 * @param {Cell} muse The cell instance to paint.
 */
export function paintCell(muse) {
  for (let obj of muse.classyConvicts) {
    const rule = getCSSRule(`.${obj.name}`);
    if (rule) _apply_rule(rule, obj, `.${obj.name}`);
  }
  for (let obj of muse.namedConvicts) {
    if (!obj.userData.domId) continue;
    const rule = getCSSRule(`#${obj.userData.domId}`);
    if (rule) _apply_rule(rule, obj, `#${obj.userData.domId}`);
  }
}

/**
 * Apply rules for a single object.  This helper paints the object’s
 * base styles, any pseudo‑class rules from `extraParams` and inline
 * styles declared directly on the DOM element.
 *
 * @param {THREE.Object3D} muse The Three.js object to paint.
 */
export function paintSpecificMuse(muse) {
  let rule = getCSSRule(`.${muse.name}`);
  if (rule) _apply_rule(rule, muse);
  rule = getCSSRule(`#${muse.userData.domId}`);
  if (rule) _apply_rule(rule, muse);
  muse.userData.extraParams.forEach(param => {
    const clsRule = getCSSRule(`.${muse.name}${param}`);
    if (clsRule) _apply_rule(clsRule, muse);
  });
  if (muse.userData.domId) {
    muse.userData.extraParams.forEach(param => {
      const idRule = getCSSRule(`#${muse.userData.domId}${param}`);
      if (idRule) _apply_rule(idRule, muse);
    });
  }
  if (muse.userData.domEl.hasAttribute('style')) {
    _apply_rule(muse.userData.domEl, muse);
  }
}

/**
 * Apply constant `:active` rules to an object.  Constant rules are
 * applied during each frame update to objects flagged as constant
 * convicts.  Only class and id selectors with the `:active` pseudo‑class
 * are considered.
 *
 * @param {THREE.Object3D} muse The Three.js object to paint.
 */
export function paintConstantMuse(muse) {
  let rule = getCSSRule(`.${muse.name}:active`);
  if (rule) _apply_rule(rule, muse);
  rule = getCSSRule(`#${muse.userData.domId}:active`);
  if (rule) _apply_rule(rule, muse);
}