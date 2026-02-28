// cell.js
//
// The Cell class drives a single <cell> element:
// - DOM → Three.js object conversion
// - Event wiring / raycasting integration
// - CSS → object painting
// - Mutation observers (DOM + <style> changes)
// - Per-frame update callbacks

import * as THREE from 'three';
import { gatherAssetRules, getClassMap } from './utils.js';
import {
  paintCell,
  paintConvict,
  paintSpecificMuse
} from './artist.js';
import { markGlobalStyleCacheDirty } from './styleCache.js';
import {
  default_onCellClick_method,
  default_onCellPointerMove_method,
  default_onCellMouseDown_method,
  default_onCellMouseUp_method,
  default_onCellDoubleClick_method,
  default_onCellContextMenu_method
} from './NoScope.js';

class Cell {
  static allCells = new WeakMap();

  /**
   * Retrieve an existing Cell for a <cell> element.
   *
   * @param {HTMLElement} element
   * @returns {Cell|null}
   */
  static getCell(element) {
    if (Cell.allCells.has(element)) {
      return Cell.allCells.get(element);
    }
    console.error('No Cell found with the element:', element);
    return null;
  }

  /**
   * @param {HTMLElement} cellElm
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera|null} [camera=null]
   * @param {Function|null} [_MainAnimMethod=null]
   */
  constructor(cellElm, renderer, scene, camera = null, _MainAnimMethod = null) {
    this.cellElm = cellElm;
    Object.defineProperty(cellElm, 'cell', {
      value: this,
      enumerable: false
    });

    this.threeRenderer = renderer;
    this.loadedScene = scene;
    this.focusedCamera = camera;

    this.classyConvicts = new Set();
    this.namedConvicts = new Set();
    this._allConvictsByDom = new WeakMap();
    this._convictsById = new Map();
    this._convictsByClass = new Map();

    this.updateFunds = [];
    this._observedStyleElements = new WeakSet();
    this._pendingStyleRepaint = false;
    this._pointerMoveRaf = 0;
    this._pendingPointerMoveEvt = null;

    this._last_cast_caught = null;
    this._lastHitPosition = null;
    Cell.allCells.set(cellElm, this);

    // initial scan
    this._ScanCell();

    // bind DOM event handlers
    this._boundPointerMove = evt => {
      default_onCellPointerMove_method(evt, this);
    };
    this._boundClick = evt => {
      default_onCellClick_method(evt, this);
    };
    this._boundMouseDown = evt => {
      default_onCellMouseDown_method(evt, this);
    };
    this._boundMouseUp = evt => {
      default_onCellMouseUp_method(evt, this);
    };
    this._boundDoubleClick = evt => {
      default_onCellDoubleClick_method(evt, this);
    };
    this._boundContextMenu = evt => {
      evt.preventDefault();
      default_onCellContextMenu_method(evt, this);
    };

    cellElm.addEventListener('mousemove', this._boundPointerMove);
    cellElm.addEventListener('click', this._boundClick);
    cellElm.addEventListener('mousedown', this._boundMouseDown);
    cellElm.addEventListener('mouseup', this._boundMouseUp);
    cellElm.addEventListener('dblclick', this._boundDoubleClick);
    cellElm.addEventListener('contextmenu', this._boundContextMenu);

    // prime CSS-declared assets before first style apply
    gatherAssetRules();

    // initial paint
    paintCell(this);

    // Observe <style> content so keyframes / rules updates repaint
    this._styleElemObserver = new MutationObserver(() => {
      if (this._pendingStyleRepaint) return;
      markGlobalStyleCacheDirty();
      this._pendingStyleRepaint = true;
      requestAnimationFrame(() => {
        this._pendingStyleRepaint = false;
        gatherAssetRules();
        paintCell(this);
        this._repaintKnownConvicts();
      });
    });

    this._observeStyleElements = root => {
      if (!root) return;
      const targets = [];
      if (root.nodeName === 'STYLE') {
        targets.push(root);
      } else if (typeof root.querySelectorAll === 'function') {
        targets.push(...root.querySelectorAll('style'));
      }
      targets.forEach(styleEl => {
        if (this._observedStyleElements.has(styleEl)) return;
        this._observedStyleElements.add(styleEl);
        this._styleElemObserver.observe(styleEl, {
          childList: true,
          characterData: true,
          subtree: true
        });
      });
    };

    this._styleHostObserver = new MutationObserver(mutationList => {
      mutationList.forEach(mutation => {
        let styleTreeChanged = false;
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'STYLE') {
            this._observeStyleElements(node);
            styleTreeChanged = true;
          } else if (node.nodeType === Node.ELEMENT_NODE && typeof node.querySelector === 'function' && node.querySelector('style')) {
            this._observeStyleElements(node);
            styleTreeChanged = true;
          }
        });
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && (node.nodeName === 'STYLE' || (typeof node.querySelector === 'function' && node.querySelector('style')))) {
            styleTreeChanged = true;
          }
        });
        if (styleTreeChanged) {
          markGlobalStyleCacheDirty();
          this._scheduleFullRepaint();
        }
      });
    });

    this._observeStyleElements(this.cellElm);
    if (document.head) {
      this._observeStyleElements(document.head);
      this._styleHostObserver.observe(document.head, {
        childList: true,
        subtree: true
      });
    }

    // Observe inline style/id/class changes and child mutations
    this._styleObserver = new MutationObserver(mutationList => {
      mutationList.forEach(mutation => {
        if (mutation.target.nodeName === 'CANVAS') return;

        switch (mutation.type) {
          case 'childList': {
            for (let i = 0; i < mutation.addedNodes.length; i++) {
              const node = mutation.addedNodes[i];
              if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== 'CANVAS') {
                if (node.nodeName === 'STYLE') {
                  this._observeStyleElements(node);
                  markGlobalStyleCacheDirty();
                  this._scheduleFullRepaint();
                } else {
                  this.ScanElement(node);
                  const convict = this.getConvictByDom(node);
                  if (convict) {
                    paintSpecificMuse(convict);
                  }
                }
              }
            }
            for (let i = 0; i < mutation.removedNodes.length; i++) {
              const node = mutation.removedNodes[i];
              if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== 'CANVAS') {
                if (node.nodeName === 'STYLE' || (typeof node.querySelector === 'function' && node.querySelector('style'))) {
                  markGlobalStyleCacheDirty();
                  this._scheduleFullRepaint();
                }
                this.removeConvict(this._allConvictsByDom.get(node));
              }
            }
            break;
          }
          case 'attributes': {
            const target = mutation.target;
            const convict = target.convict;
            if (!convict) break;

            if (mutation.attributeName === 'id') {
              this._syncConvictIdentity(convict, target);
              paintSpecificMuse(convict);
            } else if (mutation.attributeName === 'class') {
              this._syncConvictIdentity(convict, target);
              paintSpecificMuse(convict);
            } else if (mutation.attributeName === 'style') {
              // inline style changed; repaint this convict
              paintConvict(target, this);
            }
            break;
          }
        }
      });
    });

    this._styleObserver.observe(this.cellElm, {
      attributes: true,
      childList: true,
      attributeFilter: ['style', 'id', 'class'],
      subtree: true
    });

    // Animation loop
    this._running = true;
    this._anim = _MainAnimMethod
      ? _MainAnimMethod.bind(this)
      : () => {
          if (!this._running) return;
          this.updateFunds.forEach(update => update());
          requestAnimationFrame(this._anim);
          if (this.focusedCamera) {
            this.threeRenderer.render(this.loadedScene, this.focusedCamera);
          }
        };

    // Resize handling
    this._resizeObserver = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        const dpr = window.devicePixelRatio || 1;
        this.threeRenderer.setPixelRatio(dpr);

        const safeWidth = Math.max(width, 1);
        const safeHeight = Math.max(height, 1);
        this.threeRenderer.setSize(safeWidth, safeHeight, false);

        if (this.focusedCamera && this.focusedCamera.isPerspectiveCamera) {
          this.focusedCamera.aspect = safeWidth / safeHeight;
        }
        if (this.focusedCamera) {
          this.focusedCamera.updateProjectionMatrix();
        }
      }
    });
    this._resizeObserver.observe(this.cellElm);

    this._anim();
  }

  _scheduleFullRepaint() {
    if (this._pendingStyleRepaint) return;
    this._pendingStyleRepaint = true;
    requestAnimationFrame(() => {
      this._pendingStyleRepaint = false;
      gatherAssetRules();
      paintCell(this);
      this._repaintKnownConvicts();
    });
  }

  _repaintKnownConvicts() {
    const visited = new Set();
    for (const convict of this.classyConvicts) {
      if (!visited.has(convict)) {
        visited.add(convict);
        paintSpecificMuse(convict);
      }
    }
    for (const convict of this.namedConvicts) {
      if (!visited.has(convict)) {
        visited.add(convict);
        paintSpecificMuse(convict);
      }
    }
  }

  _normalizeClassList(input) {
    if (Array.isArray(input)) return input.filter(Boolean).map(String);
    if (typeof input === 'string') return input.split(/\s+/).filter(Boolean);
    if (input && typeof input[Symbol.iterator] === 'function') {
      return Array.from(input).filter(Boolean).map(String);
    }
    return [];
  }

  _ensureConvictClassAlias(convict) {
    if (Object.prototype.hasOwnProperty.call(convict, 'classList')) return;
    Object.defineProperty(convict, 'classList', {
      enumerable: false,
      configurable: true,
      get() {
        return this.userData.classList;
      },
      set(value) {
        let next = [];
        if (Array.isArray(value)) {
          next = value.filter(Boolean).map(String);
        } else if (typeof value === 'string') {
          next = value.split(/\s+/).filter(Boolean);
        } else if (value && typeof value[Symbol.iterator] === 'function') {
          next = Array.from(value).filter(Boolean).map(String);
        }
        const domEl = this.userData?.domEl;
        if (domEl && domEl.className !== next.join(' ')) {
          domEl.className = next.join(' ');
          return;
        }
        this.userData.classList = next;
      }
    });
  }

  _removeClassIndex(convict, className) {
    const bucket = this._convictsByClass.get(className);
    if (!bucket) return;
    bucket.delete(convict);
    if (bucket.size === 0) {
      this._convictsByClass.delete(className);
    }
  }

  _syncConvictIdentity(convict, elm) {
    if (!convict || !elm) return;

    const prevId = convict.userData.domId || '';
    const prevClasses = Array.isArray(convict.userData.classList)
      ? convict.userData.classList
      : [];

    const nextId = elm.id || '';
    const nextClasses = this._normalizeClassList(elm.classList);

    if (prevId && this._convictsById.get(prevId) === convict) {
      this._convictsById.delete(prevId);
    }
    for (const cls of prevClasses) {
      this._removeClassIndex(convict, cls);
    }

    convict.userData.domId = nextId;
    convict.userData.classList = nextClasses;
    if (nextId) {
      convict.name = nextId;
    } else if (convict.name === prevId) {
      convict.name = '';
    }

    if (nextId) {
      this._convictsById.set(nextId, convict);
      this.namedConvicts.add(convict);
    } else {
      this.namedConvicts.delete(convict);
    }

    if (nextClasses.length) {
      this.classyConvicts.add(convict);
      for (const cls of nextClasses) {
        let bucket = this._convictsByClass.get(cls);
        if (!bucket) {
          bucket = new Set();
          this._convictsByClass.set(cls, bucket);
        }
        bucket.add(convict);
      }
    } else {
      this.classyConvicts.delete(convict);
    }
  }

  /**
   * Initial scan of cell children.
   * @private
   */
  _ScanCell() {
    for (let i = 0; i < this.cellElm.children.length; i++) {
      const convictElm = this.cellElm.children[i];
      this.ScanElement(convictElm);
    }
  }

  /**
   * Convert a DOM element into a Three.js object and wire it up.
   *
   * @param {HTMLElement} elm
   */
  ScanElement(elm) {
    if (this._allConvictsByDom.has(elm)) return;

    const parentObj = this.getConvictByDom(elm.parentElement) || this.loadedScene;
    const instance = this.ConvertDomToObject(elm);

    if (instance === null) {
      // still recurse children
      for (let i = 0; i < elm.children.length; i++) {
        this.ScanElement(elm.children[i]);
      }
      return;
    }

    // Camera tags: configure projection
    if (elm.tagName.includes('CAMERA')) {
      const rect = this.cellElm.getBoundingClientRect();
      const aspect = rect.height ? rect.width / rect.height : 1;

      if (elm.tagName === 'PERSPECTIVECAMERA') {
        instance.fov = 75;
        instance.aspect = aspect;
        instance.far = 1000;
        instance.near = 0.1;
      } else {
        const frustumSize = 20;
        instance.frustumSize = frustumSize;
        instance.aspect = aspect;
        instance.left = (-frustumSize * aspect) / 2;
        instance.right = (frustumSize * aspect) / 2;
        instance.top = frustumSize / 2;
        instance.bottom = -frustumSize / 2;
        instance.refreshLook = fSize => {
          instance.frustumSize = fSize;
          instance.left = (-fSize * instance.aspect) / 2;
          instance.right = (fSize * instance.aspect) / 2;
          instance.top = fSize / 2;
          instance.bottom = -fSize / 2;
          instance.updateProjectionMatrix();
        };
      }

      const rectW = rect.width || 1;
      const rectH = rect.height || 1;

      if (elm.hasAttribute('render')) {
        this.focusedCamera = instance;
        this.focusedCamera.updateProjectionMatrix();
        this.threeRenderer.setPixelRatio(window.devicePixelRatio || 1);
        this.threeRenderer.setSize(rectW, rectH, false);
      } else if (!this.focusedCamera) {
        this.focusedCamera = instance;
        this.focusedCamera.updateProjectionMatrix();
      }
    }

    instance.userData.domEl = elm;
    instance.userData.extraParams = [];
    instance.userData.domId = '';
    instance.userData.classList = [];
    instance.transition = null;
    this._ensureConvictClassAlias(instance);

    parentObj.add(instance);

    this._allConvictsByDom.set(elm, instance);
    this._syncConvictIdentity(instance, elm);

    for (let i = 0; i < elm.children.length; i++) {
      this.ScanElement(elm.children[i]);
    }

    if (!Object.prototype.hasOwnProperty.call(elm, 'convict')) {
      Object.defineProperty(elm, 'convict', {
        value: this.getConvictByDom(elm),
        enumerable: false
      });
    }
  }

  /**
   * Tag → THREE.Object3D constructor.
   *
   * @param {HTMLElement} elm
   * @returns {THREE.Object3D|null}
   */
  ConvertDomToObject(elm) {
    if (elm.tagName === 'CANVAS') return null;

    const key = elm.tagName.replace(/-/g, '');
    const Ctor = getClassMap()[key];
    if (!Ctor) {
      console.warn(`Unknown THREE class for <${elm.tagName.toLowerCase()}>`);
      return null;
    }
    return new Ctor();
  }

  /**
   * Remove a convict and its children.
   *
   * @param {THREE.Object3D|null} convict
   */
  removeConvict(convict) {
    if (!convict) return;

    convict.children.slice().forEach(child => {
      const domNode = child.userData?.domEl;
      if (domNode) {
        this.removeConvict(this._allConvictsByDom.get(domNode));
      } else {
        this.removeConvict(child);
      }
    });

    const domId = convict.userData?.domId;
    if (domId && this._convictsById.get(domId) === convict) {
      this._convictsById.delete(domId);
    }
    const classes = Array.isArray(convict.userData?.classList) ? convict.userData.classList : [];
    for (const cls of classes) {
      this._removeClassIndex(convict, cls);
    }
    this.classyConvicts.delete(convict);
    this.namedConvicts.delete(convict);

    if (convict.userData.domEl) {
      this._allConvictsByDom.delete(convict.userData.domEl);
      convict.userData.domEl.remove();
    }

    if (convict.parent) {
      convict.parent.remove(convict);
    }
  }

  /**
   * Get convict by DOM element.
   *
   * @param {HTMLElement} element
   */
  getConvictByDom(element) {
    return this._allConvictsByDom.get(element);
  }

  /**
   * Get convict by DOM id (global document lookup).
   *
   * @param {string} id
   */
  getConvictById(id) {
    return this._convictsById.get(id);
  }

  /**
   * Get all convicts with a given class.
   *
   * @param {string} className
   * @returns {Array<THREE.Object3D>}
   */
  getConvictsByClass(className) {
    return Array.from(this._convictsByClass.get(className) || []);
  }

  /**
   * Register a per-frame callback.
   *
   * @param {Function} fn
   */
  addUpdateFunction(fn) {
    if (typeof fn === 'function') {
      const bound = fn.bind(this);
      bound.originalFn = fn;
      this.updateFunds.push(bound);
    }
  }

  /**
   * Remove a previously registered per-frame callback.
   *
   * @param {Function} fn
   */
  removeUpdateFunction(fn) {
    const idx = this.updateFunds.findIndex(item => item?.originalFn === fn);
    if (idx >= 0) {
      this.updateFunds.splice(idx, 1);
    }
  }

  /**
   * Tear down observers, handlers and canvas.
   */
  dispose() {
    this._running = false;

    this._resizeObserver.disconnect();
    this._styleObserver.disconnect();
    this._styleElemObserver.disconnect();
    this._styleHostObserver.disconnect();

    if (this._pointerMoveRaf) {
      cancelAnimationFrame(this._pointerMoveRaf);
      this._pointerMoveRaf = 0;
    }
    this._pendingPointerMoveEvt = null;

    this.cellElm.removeEventListener('mousemove', this._boundPointerMove);
    this.cellElm.removeEventListener('click', this._boundClick);
    this.cellElm.removeEventListener('mousedown', this._boundMouseDown);
    this.cellElm.removeEventListener('mouseup', this._boundMouseUp);
    this.cellElm.removeEventListener('dblclick', this._boundDoubleClick);
    this.cellElm.removeEventListener('contextmenu', this._boundContextMenu);

    const canvas = this.threeRenderer.domElement;
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }
}

export default Cell;
