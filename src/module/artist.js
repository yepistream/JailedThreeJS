// artist.js
import { getAsset } from './utils.js';
import Cell from './cell.js';
import { animateLerp, KeyFrameAnimationLerp } from './Train.js';
import * as THREE from '../../node_modules/three/build/three.module.js';


/** Find first rule whose selectorText tokens include `selector` */
function _getCSSRule(selector) {
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

/** Walk `object` along `path` array, returning parent + final key */
export function deep_searchParms(object, path) {
  const key    = path[path.length - 1];
  const parent = path.slice(0, -1).reduce((o, k) => {
    if (o[k] == null) o[k] = {};
    return o[k];
  }, object);
  return { parent, key };
}

/**
 * Apply a CSS custom-prop rule to a THREE object.
 * Supports `--foo-bar: value;` → object.foo.bar = parsedValues
 */
function _apply_rule(rule, object, _chosenOne = null) {
  if (!rule || !rule.style) return;
  

  for (let i = 0; i < rule.style.length; i++) {
    const rawProp = rule.style[i];                   // e.g. "--rotation-x"
    const value   = rule.style.getPropertyValue(rawProp).trim();
    const prop    = rawProp.slice(2);                // "rotation-x"
    const path    = prop.split('-');                 // ["rotation","x"]
    let parsed;

    parsed = CSSValueTo3JSValue(value);
    
    const { parent, key } = deep_searchParms(object, path);

    // Apply logic TODO : Add Disable Transition Logic.
    if(object.transition && !rawProp.includes('transition'))
      {
        animateLerp(
          parent[key].toArray instanceof Function ? parent[key].toArray() : parent[key],
          parsed,
          object.transition.duration || 0,
          (value, t) => {
              //console.log(`t=${t.toFixed(2)}: ${value}`);
              exchange_rule(parent,key,value);
              //TODO : Add Event Dispatch For A Finished Transition.
              
          },
          (og) => {
              object.dispatchEvent(
                {
                  type: "TransitionFinished",
                  target : object,
                  detail : {
                    Selector : _chosenOne,
                    isHover : object.userData.extraParams.includes(":hover"),
                    isClicked : object.userData.extraParams.includes(":active"),
                    from : og,
                    to : parent
                  }
                }
              );
          },
          object.transition.timing.fun || 'linear'
        );
      } 
    else exchange_rule(parent,key,parsed);
  }
  if(object.animation){
    KeyFrameAnimationLerp(object,object.animation);
  }
}

export function CSSValueTo3JSValue(value){
  // Parse values: (x,y,z), number, or string
  let parsed;
    if (/^\(.+\)$/.test(value)) {
      parsed = value.slice(1, -1).split(',').map(v => parseFloat(v.trim()));
    } else if (!isNaN(parseFloat(value))) {
      parsed = parseFloat(value);
    } else {
      parsed = value.replace(/^['"]|['"]$/g, '');
    }

    // Support @cube or other assets
    if (typeof parsed === "string" && parsed.includes("@")) {
      const p_t = parsed.replace("@", '');
      parsed = getAsset(p_t);
    }
  return parsed
}

export function exchange_rule(parent,key,value){
  // TODO: In Case Of Performance Issues, Start Caching the stuff that passes thru when transitioning so that it dosen't need to run thru this if check hell, otherwise go fuck yourself.
  if (Array.isArray(value) && typeof parent[key] === 'function') {
    const inCaseIFuckUp = parent?.clone();
    parent[key](...value); // function like lookAt()
    if(parent !== NaN || parent === undefined) {
      console.log(new parent.constructor(value[0],value[1],value[2]))
      parent.copy(inCaseIFuckUp.add(new parent.constructor(value[0],value[1],value[2])))
    }
  } else if (typeof parent[key]?.set === 'function') {
    if (Array.isArray(value)) {
      parent[key].set(...value); // Vector3.set(x, y, z)
      
    } else {
      parent[key].set(value);    // Color.set("white")
    }
  }
  else {
      try {
        if(typeof parent[key] === 'function'){ 
          parent[key](value)
        }
        else{parent[key] = value}
      } catch (err) {
        console.warn(`Failed to assign "${path.join('.')}" with`, value, err);
      }
    }
  }

export function paintConvict(convictElm,cell){
  _apply_rule(convictElm,cell._allConvictsByDom.get(convictElm))
}

export function paintExtraCell(muse){
  for (let obj of muse.classyConvicts) {
    obj.userData.extraParams.forEach(param => {
      const rule = _getCSSRule(`.${obj.name}${param}`);
      if (rule) _apply_rule(rule, obj);
    });
  }
  for (let obj of muse.namedConvicts) {
    if (!obj.userData.domId) continue;
    obj.userData.extraParams.forEach(param => {
      const rule = _getCSSRule(`#${obj.userData.domId}${param}`);
      if (rule) _apply_rule(rule, obj);
    });
  }
}

export function paintCell(muse) { 
  for (let obj of muse.classyConvicts) {
    const rule = _getCSSRule(`.${obj.name}`);
    if (rule) _apply_rule(rule, obj, `.${obj.name}`);
  }
  for (let obj of muse.namedConvicts) {
    if (!obj.userData.domId) continue;
    const rule = _getCSSRule(`#${obj.userData.domId}`);
    if (rule) _apply_rule(rule, obj,`#${obj.userData.domId}`);
  }
}

export function paintSpecificMuse(muse){

    let rule = _getCSSRule(`.${muse.name}`);
    if (rule) _apply_rule(rule, muse);
    rule = _getCSSRule(`#${muse.userData.domId}`);
    if (rule) _apply_rule(rule, muse);

    muse.userData.extraParams.forEach(param => {
      const rule = _getCSSRule(`.${muse.name}${param}`);
      if (rule) _apply_rule(rule, muse);
    });
  
    if (muse.userData.domId){
    muse.userData.extraParams.forEach(param => {
      const rule = _getCSSRule(`#${muse.userData.domId}${param}`);
      if (rule) _apply_rule(rule, muse);
    });
  }  
}
