import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader }  from 'three/examples/jsm/loaders/FBXLoader.js';
import { MTLLoader }  from 'three/examples/jsm/loaders/MTLLoader.js';

/* ───────────────── KEYFRAME MAP ───────────────── */

// A global map of all `@keyframes` rules discovered in the page.  It is
// populated lazily by `gatherKeyFrame_MAP()` the first time
// `getClassMap()` is called.
export let AllKeyFramesMap = new Map();

/**
 * Collect all `@keyframes` rules from the loaded stylesheets.  Each
 * rule is stored in a map keyed by its name.  Sheets that cannot be
 * accessed due to CORS restrictions are silently skipped.  This helper is
 * called internally when building the class map.
 *
 * @returns {Map<string, CSSKeyframesRule>} A map from keyframe names to rules.
 */
export function gatherKeyFrame_MAP() {
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (rule.type === CSSRule.KEYFRAMES_RULE || rule.type === CSSRule.WEBKIT_KEYFRAMES_RULE) {
        AllKeyFramesMap.set(rule.name, rule);
      }
    }
  }
}

/* ───────────────── CLASS MAP ───────────────── */
let classMap = null;

/**
 * Build a map of available Three.js classes.  This enumerates all
 * properties on the imported `THREE` namespace and retains those whose
 * prototype inherits from `THREE.Object3D`.  The resulting object maps
 * upper‑case keys to constructors (e.g. `BOXGEOMETRY → THREE.BoxGeometry`).
 * On first invocation this also populates the global `AllKeyFramesMap`.
 *
 * @private
 */
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
  // include the base Object3D type explicitly
  classMap.OBJECT3D = THREE.Object3D;
}

/**
 * Get the cached class map, building it on the first call.  This helper
 * returns a mapping from upper‑case tag names to Three.js constructors.
 *
 * @returns {Object.<string, Function>} The class map.
 */
export function getClassMap() {
  if (!classMap) buildClassMap();
  return classMap;
}

export function getAnimationMap(AnimName){
  AllKeyFramesMap = new Map();
  gatherKeyFrame_MAP();
  console.log(AllKeyFramesMap);
  return AllKeyFramesMap.get(AnimName);
}

/* ───────────────── ASSET MAP ───────────────── */
const assetMap = new Map();
const gltfLoader = new GLTFLoader();
const fbxLoader  = new FBXLoader();
const textureLoader = new THREE.TextureLoader();
const audioLoader   = new THREE.AudioLoader();
// Loader for material libraries (.mtl files)
const mtlLoader    = new MTLLoader();

/**
 * Scan all stylesheets for custom at‑rules that declare external
 * assets.  Any at‑rule of the form `@identifier{ … }` (except for
 * standard CSS rules like `@media` or `@keyframes`) is treated as
 * an asset declaration.  Each block must contain a `url` property
 * pointing at the resource and may optionally contain a `name`
 * property to override the key used in `getAsset()`.  If no name
 * is provided then the identifier following the `@` symbol is used,
 * falling back to the filename if that identifier is empty.  Each
 * discovered asset is loaded via {@link loadAsset} and stored in
 * `assetMap` on first invocation of {@link getAsset}.
 */
function gatherAssetRules() {
  // Known at-rules that should be ignored when scanning for
  // custom assets.  These include CSS features and vendor rules
  // supported by browsers.  Anything else is considered a potential
  // asset declaration.
  const ignoreAtRules = new Set([
    'media', 'import', 'supports', 'keyframes', 'font-face', 'charset',
    'namespace', 'page', 'counter-style', 'font-feature-values',
    'viewport'
  ]);
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      const text = rule.cssText?.trim();
      if (!text) continue;
      // Match custom at-rules of the form @name{...} where name is not
      // in the ignore list.  `\w` matches letters, digits and
      // underscores; hyphens are also allowed in custom identifiers.
      const match = text.match(/^@([A-Za-z0-9_-]+)\s*\{([^}]*)\}/);
      if (!match) continue;
      const atName = match[1];
      if (ignoreAtRules.has(atName.toLowerCase())) continue;
      const body = match[2];
      const obj = {};
      body.split(';').forEach(line => {
        const parts = line.split(':').map(s => s && s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const key = parts[0].toLowerCase();
          // Remove surrounding quotes, parentheses or whitespace from the value
          let value = parts[1];
          value = value.replace(/^['"(]+|['")]+$/g, '');
          obj[key] = value;
        }
      });
      const url = obj.url;
      if (!url) continue;
      // Determine asset name: prefer explicit `name`, else use the
      // identifier after the @ symbol.  If `name` is empty or
      // whitespace then fallback to the filename sans extension.
      let name;
      if (obj.name && obj.name.trim()) {
        name = obj.name.trim();
      } else {
        // If at-rule has a meaningful identifier use that; otherwise
        // fallback to the filename portion of the URL.
        name = atName || (() => {
          const fname = url.split('/').pop() || '';
          const dot = fname.lastIndexOf('.');
          return dot >= 0 ? fname.slice(0, dot) : fname;
        })();
      }
      // Only register once; duplicates are ignored
      if (!assetMap.has(name)) {
        assetMap.set(name, loadAsset(url));
      }
    }
  }
}

/**
 * Retrieve or load an asset by name.  When called for the first time this
 * function preloads a few common geometries (cube, sphere, plane, torus).
 * Custom assets may be registered by calling this function with a path.
 *
 * @param {string} name Asset key, or one of the built‑in keywords.
 * @param {string|null} [path=null] Optional path if the asset needs loading.
 * @returns {any} The loaded asset or a promise resolving to it.
 */
export function getAsset(name, path = null) {
  if (assetMap.size === 0) {
    assetMap.set('cube',    new THREE.BoxGeometry());
    assetMap.set('sphere',  new THREE.SphereGeometry());
    assetMap.set('plane',   new THREE.PlaneGeometry());
    assetMap.set('torus',   new THREE.TorusGeometry());
  }
  // scan for @asset rules on first call
  gatherAssetRules();
  const key = name;
  if (!assetMap.has(key)) {
    if (!path) {
      console.warn(`Asset "${name}" missing and no path supplied.`);
      return null;
    }
    assetMap.set(key, loadAsset(path));
  }
  return assetMap.get(key);
}

/**
 * Load a 3D asset based on its file extension.  Currently GLTF/GLB and
 * FBX files are supported.  Other extensions log a warning and resolve
 * with `null`.
 *
 * @param {string} url The URL of the asset to load.
 * @returns {Promise<any>|null} A promise resolving to the loaded asset, or null.
 */
export function loadAsset(url) {
  const ext = url.split('.').pop().toLowerCase();
  switch (ext) {
    case 'gltf':
    case 'glb':
      return new Promise((res, rej) =>
        gltfLoader.load(url, d => res(d.scene || d), null, rej)
      );
    case 'fbx':
      return new Promise((res, rej) =>
        fbxLoader.load(url, res, null, rej)
      );
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return new Promise((res, rej) =>
        textureLoader.load(url, tex => res(tex), undefined, rej)
      );
    // Audio files are loaded using Three.js AudioLoader.  The
    // returned promise resolves to an AudioBuffer which can be used
    // with THREE.Audio or AudioListener.  Supported formats include
    // mp3, wav and ogg.
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'flac':
    case 'aac':
      return new Promise((res, rej) =>
        audioLoader.load(url, buffer => res(buffer), undefined, rej)
      );
    // Material libraries (.mtl) are loaded using the MTLLoader from
    // Three.js examples.  The returned value is an instance of
    // THREE.MaterialCreator which can be used with OBJLoader or
    // directly create materials via `.getMaterial()`.
    case 'mtl':
      return new Promise((res, rej) =>
        mtlLoader.load(url, mtl => {
          mtl.preload();
          res(mtl);
        }, undefined, rej)
      );
    // JSON files can describe materials for use with the
    // MaterialLoader.  Fetch the file and parse it before handing
    // it to the loader.  If the file does not contain valid
    // material definitions the returned promise resolves with the
    // parsed JSON.
    case 'json':
      return fetch(url)
        .then(response => response.json())
        .then(json => {
          try {
            const loader = new THREE.MaterialLoader();
            return loader.parse(json);
          } catch (err) {
            console.warn(`MaterialLoader failed to parse ${url}:`, err);
            return json;
          }
        });
    default:
      console.warn(`No loader for ".${ext}".`);
      return Promise.resolve(null);
  }
}

/**
 * Remove an item from an array without preserving its order.  The
 * implementation swaps the element to delete with the last element and
 * then pops from the array.  If the item is not found the array is
 * returned unchanged.
 *
 * @param {Array<any>} arry The array to modify.
 * @param {any} item The item to remove.
 */
export function fastRemove_arry(arry, item) {
  const index = arry.indexOf(item);
  if (index !== -1) {
    arry[index] = arry[arry.length - 1];
    arry.pop();
  }
}

// Alias for backwards compatibility.  Use `fastRemove_arry` in new code.
export const fastRemoveArray = fastRemove_arry;