import * as THREE from '../../node_modules/three/build/three.module.js';
import { GLTFLoader } from '../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader  } from '../../node_modules/three/examples/jsm/loaders/FBXLoader.js';


/* ───────────────── KEYFRAME MAP ───────────────── */

export let AllKeyFramesMap = new Map();

export function gatherKeyFrame_MAP() {
  const keyframesMap = new Map();

  // Walk through every stylesheet on the page
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      // May throw if stylesheet is cross-origin
      rules = sheet.cssRules;
    } catch (e) {
      // Skip CORS-protected sheets
      continue;
    }

    // Examine each rule
    for (const rule of rules) {
      // Standard API: CSSRule.KEYFRAMES_RULE === 7
      // WebKit prefix: CSSRule.WEBKIT_KEYFRAMES_RULE === 8
      if (
        rule.type === CSSRule.KEYFRAMES_RULE ||
        rule.type === CSSRule.WEBKIT_KEYFRAMES_RULE
      ) {
        // rule.name is the identifier after @keyframes
        keyframesMap.set(rule.name, rule);
      }
    }
  }

  return keyframesMap;
}


/* ───────────────── CLASS MAP ───────────────── */
let classMap = null;

function buildClassMap() {
  classMap = Object.getOwnPropertyNames(THREE)
    .filter(key => {
      const C = THREE[key];
      return typeof C === 'function' && C.prototype instanceof THREE.Object3D;
    })
    .reduce((m, key) => {
      m[key.toUpperCase()] = THREE[key];
      return m;
    }, Object.create(null));

  AllKeyFramesMap = gatherKeyFrame_MAP();

  classMap.OBJECT3D = THREE.Object3D;   // base type
}
export function getClassMap() {
  if (!classMap) buildClassMap();
  return classMap;
}

/* ───────────────── ASSET MAP ───────────────── */
let assetMap = new Map();



export function getAsset(name, path = null) {
  //console.log(assetMap);
  if(assetMap.size == 0){
    // preload a few geometries
    assetMap.set('cube',    new THREE.BoxGeometry());
    assetMap.set('sphere', new THREE.SphereGeometry());
    assetMap.set('plane',  new THREE.PlaneGeometry());
    assetMap.set('torus',  new THREE.TorusGeometry());
  }

  const key = name;
  //console.log("attempting to grab : " + key);
  if (!assetMap.has(key)) {
    if (!path) {
      console.warn(`Asset "${name}" missing and no path supplied.`);
      return null;
    }
    assetMap.set(key, loadAsset(path));           // store the Promise
  }
  return assetMap.get(key);                       // value or Promise
}

/* ───────────────── LOAD ASSET ───────────────── */
const gltfLoader = new GLTFLoader();
const fbxLoader  = new FBXLoader();

export function loadAsset(url) {
  const ext = url.split('.').pop().toLowerCase();
  switch (ext) {
    case 'gltf': case 'glb':
      return new Promise((res, rej) =>
        gltfLoader.load(url, d => res(d.scene || d), null, rej));
    case 'fbx':
      return new Promise((res, rej) =>
        fbxLoader.load(url, res, null, rej));
    default:
      console.warn(`No loader for ".${ext}".`);
      return Promise.resolve(null);
  }
}

export function fastRemove_arry(arry,item){
  const index = arry.indexOf(item);
  if(index !== -1){
    arry[index] = arry[arry.length-1];
  }
  arry.pop();
}

