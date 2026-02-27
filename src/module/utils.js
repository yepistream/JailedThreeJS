// utils.js
//
// - Keyframe rule collection
// - Class map for tag → THREE constructor
// - Asset loading / caching
// - Small array utilities

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { getGlobalStyleCacheVersion } from './styleCache.js';

export let AllKeyFramesMap = new Map();
let keyframesCacheVersion = -1;

/**
 * Collect all @keyframes rules from loaded stylesheets.
 *
 * @returns {Map<string, CSSKeyframesRule>}
 */
export function gatherKeyFrame_MAP() {
  const styleVersion = getGlobalStyleCacheVersion();
  if (keyframesCacheVersion === styleVersion) {
    return AllKeyFramesMap;
  }

  AllKeyFramesMap.clear();

  const KEYFRAMES_TYPES = new Set();
  if (typeof CSSRule !== 'undefined') {
    if ('KEYFRAMES_RULE' in CSSRule) KEYFRAMES_TYPES.add(CSSRule.KEYFRAMES_RULE);
    if ('WEBKIT_KEYFRAMES_RULE' in CSSRule) KEYFRAMES_TYPES.add(CSSRule.WEBKIT_KEYFRAMES_RULE);
  }

  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (KEYFRAMES_TYPES.has(rule.type)) {
        AllKeyFramesMap.set(rule.name, rule);
      }
    }
  }

  keyframesCacheVersion = styleVersion;
  return AllKeyFramesMap;
}

/**
 * Get a CSSKeyframesRule by name, rescanning stylesheets each call.
 *
 * @param {string} AnimName
 */
export function getAnimationMap(AnimName) {
  if (!AnimName) return undefined;
  gatherKeyFrame_MAP();
  return AllKeyFramesMap.get(AnimName);
}

/* ───────────────── CLASS MAP ───────────────── */

let classMap = null;

/**
 * Build a map of tag-name-like keys → THREE.Object3D constructors.
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

  // include base Object3D explicitly
  classMap.OBJECT3D = THREE.Object3D;
}

/**
 * Get the cached class map, building it on first call.
 *
 * @returns {Object.<string,Function>}
 */
export function getClassMap() {
  if (!classMap) buildClassMap();
  return classMap;
}

/* ───────────────── ASSET MAP ───────────────── */

const assetMap = new Map();
const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const textureLoader = new THREE.TextureLoader();
const audioLoader = new THREE.AudioLoader();
const mtlLoader = new MTLLoader();
const objLoader = new OBJLoader();

function getUrlBasePath(url) {
  const slash = url.lastIndexOf('/');
  return slash >= 0 ? url.slice(0, slash + 1) : '';
}

function storeAssetValue(key, value) {
  if (value && typeof value.then === 'function') {
    const pending = value
      .then(resolved => {
        assetMap.set(key, resolved);
        return resolved;
      })
      .catch(err => {
        console.error(`Failed to load asset "${key}":`, err);
        assetMap.delete(key);
        return null;
      });
    assetMap.set(key, pending);
  } else {
    assetMap.set(key, value);
  }
}

/**
 * Scan stylesheets for custom @rules that declare external assets.
 *
 * Syntax:
 *   @MyShip {
 *     url: "./ship.glb";
 *     name: "Spaceship";   // optional, overrides @ identifier
 *   }
 */
function gatherAssetRules() {
  const styleVersion = getGlobalStyleCacheVersion();
  if (gatherAssetRules._cacheVersion === styleVersion) {
    return;
  }

  const ignoreAtRules = new Set([
    'media', 'import', 'supports', 'keyframes', 'font-face', 'charset',
    'namespace', 'page', 'counter-style', 'font-feature-values', 'viewport'
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

      const match = text.match(/^@([A-Za-z0-9_-]+)\s*\{([^}]*)\}/);
      if (!match) continue;

      const atName = match[1];
      if (ignoreAtRules.has(atName.toLowerCase())) continue;

      const body = match[2];
      const obj = {};
      body.split(';').forEach(line => {
        const parts = line
          .split(':')
          .map(s => s && s.trim())
          .filter(Boolean);
        if (parts.length >= 2) {
          const key = parts[0].toLowerCase();
          let value = parts[1];
          value = value.replace(/^['"(]+|['")]+$/g, '');
          obj[key] = value;
        }
      });

      const url = obj.url;
      if (!url) continue;

      let name;
      if (obj.name && obj.name.trim()) {
        name = obj.name.trim();
      } else {
        name = atName || (() => {
          const fname = url.split('/').pop() || '';
          const dot = fname.lastIndexOf('.');
          return dot >= 0 ? fname.slice(0, dot) : fname;
        })();
      }

      if (!assetMap.has(name)) {
        storeAssetValue(name, loadAsset(url));
      }
    }
  }

  gatherAssetRules._cacheVersion = styleVersion;
}

/**
 * Get or load an asset by name.
 *
 * Built-ins (auto-registered on first use):
 *   - cube   → BoxGeometry
 *   - sphere → SphereGeometry
 *   - plane  → PlaneGeometry
 *   - torus  → TorusGeometry
 *
 * @param {string} name
 * @param {string|null} [path=null]
 * @returns {any}
 */
export function getAsset(name, path = null) {
  if (assetMap.size === 0) {
    storeAssetValue('cube', new THREE.BoxGeometry());
    storeAssetValue('sphere', new THREE.SphereGeometry());
    storeAssetValue('plane', new THREE.PlaneGeometry());
    storeAssetValue('torus', new THREE.TorusGeometry());
  }

  // read CSS-defined assets
  gatherAssetRules();

  const key = name;
  if (!assetMap.has(key)) {
    if (!path) {
      console.warn(`Asset "${name}" missing and no path supplied.`);
      return null;
    }
    storeAssetValue(key, loadAsset(path));
  }

  return assetMap.get(key);
}

/**
 * Load a 3D / texture / audio / material asset based on file extension.
 *
 * @param {string} url
 * @returns {Promise<any>|null}
 */
export function loadAsset(url) {
  const ext = (url.split('.').pop() || '').toLowerCase();
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
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'flac':
    case 'aac':
      return new Promise((res, rej) =>
        audioLoader.load(url, buffer => res(buffer), undefined, rej)
      );
    case 'mtl':
      return new Promise((res, rej) => {
        const basePath = getUrlBasePath(url);
        mtlLoader.setPath(basePath);
        mtlLoader.setResourcePath(basePath);
        mtlLoader.load(
          url,
          mtl => {
            mtl.preload();
            res(mtl);
          },
          undefined,
          rej
        );
      });
    case 'obj':
      return new Promise((res, rej) => {
        const basePath = getUrlBasePath(url);
        const mtlUrl = url.replace(/\.obj$/i, '.mtl');

        mtlLoader.setPath(basePath);
        mtlLoader.setResourcePath(basePath);
        mtlLoader.load(
          mtlUrl,
          mtl => {
            mtl.preload();
            objLoader.setMaterials(mtl);
            objLoader.load(url, res, null, rej);
          },
          undefined,
          () => {
            // If no companion MTL exists, still load the OBJ geometry.
            objLoader.load(url, res, null, rej);
          }
        );
      });
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
 * Remove an item from an array without preserving order.
 *
 * @param {Array<any>} arry
 * @param {any} item
 */
export function fastRemove_arry(arry, item) {
  const index = arry.indexOf(item);
  if (index !== -1) {
    arry[index] = arry[arry.length - 1];
    arry.pop();
  }
}

// Alias for older code.
export const fastRemoveArray = fastRemove_arry;
