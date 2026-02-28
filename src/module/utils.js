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

const pendingStylesheetAssetParses = new Set();

function trackStylesheetParse(promise) {
  if (!promise || typeof promise.then !== 'function') return;
  pendingStylesheetAssetParses.add(promise);
  promise.finally(() => {
    pendingStylesheetAssetParses.delete(promise);
  });
}

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

function parseAssetRulesFromText(cssText) {
  if (!cssText || typeof cssText !== 'string') return [];

  const ignoreAtRules = new Set([
    'media', 'import', 'supports', 'keyframes', 'font-face', 'charset',
    'namespace', 'page', 'counter-style', 'font-feature-values', 'viewport'
  ]);

  const assets = [];
  const atRuleRegex = /@([A-Za-z0-9_-]+)\s*\{([\s\S]*?)\}/g;
  let match;
  while ((match = atRuleRegex.exec(cssText)) !== null) {
    const atName = match[1];
    if (ignoreAtRules.has(atName.toLowerCase())) continue;

    const body = match[2] || '';
    const obj = {};
    body.split(';').forEach(line => {
      const idx = line.indexOf(':');
      if (idx <= 0) return;
      const key = line.slice(0, idx).trim().toLowerCase();
      const rawValue = line.slice(idx + 1).trim();
      if (!key || !rawValue) return;
      obj[key] = rawValue.replace(/^['"(]+|['")]+$/g, '');
    });

    const url = obj.url;
    if (!url) continue;

    const name = (obj.name && obj.name.trim())
      ? obj.name.trim()
      : atName;

    assets.push({ name, url });
  }

  return assets;
}

function registerParsedAssetRuleEntries(entries) {
  if (!Array.isArray(entries)) return;
  for (const entry of entries) {
    if (!entry?.name || !entry?.url) continue;
    if (!assetMap.has(entry.name)) {
      storeAssetValue(entry.name, loadAsset(entry.url));
    }
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

  const linkSheetsToParse = [];
  for (const sheet of document.styleSheets) {
    const owner = sheet.ownerNode;
    if (owner?.nodeName === 'STYLE') {
      registerParsedAssetRuleEntries(parseAssetRulesFromText(owner.textContent || ''));
      continue;
    }

    if (owner?.nodeName === 'LINK' && sheet.href) {
      linkSheetsToParse.push(sheet.href);
    }
  }

  const uniqueLinks = [...new Set(linkSheetsToParse)];
  if (!gatherAssetRules._linkFetchByVersion) {
    gatherAssetRules._linkFetchByVersion = new Map();
  }

  const cacheKeyPrefix = `${styleVersion}|`;
  for (const key of [...gatherAssetRules._linkFetchByVersion.keys()]) {
    if (!key.startsWith(cacheKeyPrefix)) {
      gatherAssetRules._linkFetchByVersion.delete(key);
    }
  }

  if (uniqueLinks.length) {
    for (const href of uniqueLinks) {
      const fetchKey = `${styleVersion}|${href}`;
      if (gatherAssetRules._linkFetchByVersion.has(fetchKey)) continue;

      const parsePromise = fetch(href)
        .then(resp => (resp.ok ? resp.text() : ''))
        .then(cssText => {
          registerParsedAssetRuleEntries(parseAssetRulesFromText(cssText));
        })
        .catch(err => {
          console.warn(`Failed to parse stylesheet text for asset rules: ${href}`, err);
        });

      gatherAssetRules._linkFetchByVersion.set(fetchKey, parsePromise);
      trackStylesheetParse(parsePromise);
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
      if (pendingStylesheetAssetParses.size > 0) {
        const pending = Promise.allSettled([...pendingStylesheetAssetParses]).then(() => {
          const resolved = assetMap.get(key);
          if (resolved !== undefined) return resolved;
          console.warn(`Asset "${name}" missing and no path supplied.`);
          return null;
        });
        return pending;
      }

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
