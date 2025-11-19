// cell.js
//
// The Cell class drives a single <cell> element:
// - DOM → Three.js object conversion
// - Event wiring / raycasting integration
// - CSS → object painting
// - Mutation observers (DOM + <style> changes)
// - Per-frame update callbacks

import * as THREE from 'three';
import { fastRemove_arry, getClassMap } from './utils.js';
import {
  paintCell,
  paintConvict,
  deep_searchParms,
  paintSpecificMuse,
  paintConstantMuse,
  getCSSRule
} from './artist.js';
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

    this.constantConvicts = [];
    this.classyConvicts = [];
    this.namedConvicts = [];
    this._allConvictsByDom = new WeakMap();

    this.updateFunds = [];
    this._observedStyleElements = new WeakSet();
    this._pendingStyleRepaint = false;

    // paint constant :active rules each frame
    this.updateFunds.push(() => {
      this.constantConvicts.forEach(cC => {
        paintConstantMuse(cC);
      });
    });

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

    // initial paint
    paintCell(this);

    // Observe <style> content so keyframes / rules updates repaint
    this._styleElemObserver = new MutationObserver(() => {
      if (this._pendingStyleRepaint) return;
      this._pendingStyleRepaint = true;
      requestAnimationFrame(() => {
        this._pendingStyleRepaint = false;
        paintCell(this);
        this.classyConvicts.concat(this.namedConvicts).forEach(paintSpecificMuse);
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
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'STYLE') {
            this._observeStyleElements(node);
          }
        });
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
                  paintCell(this);
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
              convict.userData.domId = target.id;
            } else if (mutation.attributeName === 'class') {
              const nextClasses = Array.from(target.classList).filter(Boolean);
              convict.userData.classList = nextClasses;
              convict.name = nextClasses[0] || '';
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
    instance.userData.classList = [];
    instance.transition = null;

    parentObj.add(instance);

    if (elm.id) {
      instance.userData.domId = elm.id;
      this.namedConvicts.push(instance);
      if (!this.constantConvicts.includes(instance) && getCSSRule(`#${elm.id}:active`)) {
        this.constantConvicts.push(instance);
      }
    }

    const classList = Array.from(elm.classList || []).filter(Boolean);
    if (classList.length) {
      instance.userData.classList = classList;
      instance.name = classList[0];
      this.classyConvicts.push(instance);
      const hasActiveRule = classList.some(cls => getCSSRule(`.${cls}:active`));
      if (hasActiveRule && !this.constantConvicts.includes(instance)) {
        this.constantConvicts.push(instance);
      }
    }

    this._allConvictsByDom.set(elm, instance);

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

    fastRemove_arry(this.classyConvicts, convict);
    fastRemove_arry(this.namedConvicts, convict);
    fastRemove_arry(this.constantConvicts, convict);

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
    const el = document.getElementById(id);
    return el ? this._allConvictsByDom.get(el) : undefined;
  }

  /**
   * Get all convicts with a given class.
   *
   * @param {string} className
   * @returns {Array<THREE.Object3D>}
   */
  getConvictsByClass(className) {
    const elements = Array.from(document.getElementsByClassName(className));
    const out = [];
    elements.forEach(elm => {
      const convict = this.getConvictByDom(elm);
      if (convict) out.push(convict);
    });
    return out;
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
