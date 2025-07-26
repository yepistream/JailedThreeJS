// cell.js
//
// The `Cell` class controls a single `<cell>` element in the DOM.  It
// converts nested custom elements into Three.js objects, tracks
// references to them, runs an animation loop and responds to DOM
// mutations and pointer events.  A cell holds lists of named and classed
// objects (convicts), an array of per‑frame update callbacks and
// observers for style and size changes.  See the README for usage
// examples.

import * as THREE from 'three';
import { fastRemove_arry, getClassMap }  from './utils.js';
import { paintCell, paintConvict, deep_searchParms, paintSpecificMuse, paintConstantMuse, getCSSRule } from './artist.js';
import {
  default_onCellClick_method,
  default_onCellPointerMove_method,
  default_onCellMouseDown_method,
  default_onCellMouseUp_method,
  default_onCellDoubleClick_method,
  default_onCellContextMenu_method
} from './NoScope.js';

export default class Cell {
  /**
   * A WeakMap associating DOM elements with their corresponding Cell
   * instances.  Use `Cell.getCell(element)` to retrieve the cell for a
   * given DOM node.
   * @type {WeakMap<HTMLElement, Cell>}
   */
  static allCells = new WeakMap();

  /**
   * Retrieve an existing Cell instance from an element.
   * @param {HTMLElement} element The DOM element hosting the cell.
   * @returns {Cell|null} The cell instance or null if none exists.
   */
  static getCell(element) {
    if (Cell.allCells.has(element)) {
      return Cell.allCells.get(element);
    } else {
      console.error('No Cell found with the element:', element);
      return null;
    }
  }

  /**
   * Create a new Cell controller.  This will scan the DOM subtree,
   * convert elements into Three.js objects, set up event listeners
   * and start the animation loop.
   *
   * @param {HTMLElement} cellElm Root cell element.
   * @param {THREE.WebGLRenderer} renderer The renderer used for this cell.
   * @param {THREE.Scene} scene The scene to control.
   * @param {THREE.Camera|null} [camera=null] The initial camera.  If null
   *        then the first camera element found will become active.
   * @param {Function|null} [_MainAnimMethod=null] Optional animation loop
   *        override.  If supplied it is bound to this and called
   *        instead of the default loop.
   */
  constructor(cellElm, renderer, scene, camera = null, _MainAnimMethod = null) {
    this.cellElm       = cellElm;
    this.threeRenderer = renderer;
    this.loadedScene   = scene;
    this.focusedCamera = camera;
    this.constantConvicts = [];
    this.classyConvicts = [];
    this.namedConvicts  = [];
    this._allConvictsByDom = new WeakMap();
    this.updateFunds = [];
    // call paintConstantMuse on constant convicts each frame
    this.updateFunds.push(() => {
      this.constantConvicts.forEach(cC => {
        paintConstantMuse(cC);
      });
    });
    this._last_cast_caught = null;
    Cell.allCells.set(cellElm, this);
    // scan cell contents and build objects
    this._ScanCell();
    this._lastHitPosition = null;
    // bind event handlers
    this._boundPointerMove  = (event) => { default_onCellPointerMove_method(event, this); };
    this._boundClick        = (event) => { default_onCellClick_method(event, this); };
    this._boundMouseDown    = (event) => { default_onCellMouseDown_method(event, this); };
    this._boundMouseUp      = (event) => { default_onCellMouseUp_method(event, this); };
    this._boundDoubleClick  = (event) => { default_onCellDoubleClick_method(event, this); };
    this._boundContextMenu  = (event) => {
      event.preventDefault();
      default_onCellContextMenu_method(event, this);
    };
    cellElm.addEventListener('mousemove', this._boundPointerMove);
    cellElm.addEventListener('click',    this._boundClick);
    cellElm.addEventListener('mousedown', this._boundMouseDown);
    cellElm.addEventListener('mouseup',   this._boundMouseUp);
    cellElm.addEventListener('dblclick',  this._boundDoubleClick);
    cellElm.addEventListener('contextmenu', this._boundContextMenu);
    // paint initial state
    paintCell(this);
    // observe inline style changes and child mutations
    this._styleObserver = new MutationObserver((mutationList) => {
      mutationList.forEach(mutation => {
        switch (mutation.type) {
          case 'childList':
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                this.ScanElement(node);
                paintSpecificMuse(this.getConvictByDom(node));
              }
            });
            mutation.removedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                this.removeConvict(this._allConvictsByDom.get(node));
              }
            });
            break;
          case 'attributes':
            paintConvict(mutation.target, this);
            break;
        }
      });
    });
    // TODO: add observer for head count and cleanup unused convicts
    this._styleObserver.observe(this.cellElm, {
      attributes: true,
      childList: true,
      attributeFilter: ['style'],
      subtree: true,
    });
    this._running = true;
    this._anim = _MainAnimMethod
      ? _MainAnimMethod.bind(this)
      : () => {
          if (!this._running) return;
          this.updateFunds.forEach(update => {
            update();
          });
          requestAnimationFrame(this._anim);
          this.threeRenderer.render(this.loadedScene, this.focusedCamera);
        };
    // handle resizing
    this._resizeObserver = new ResizeObserver(entries => {
      for (let e of entries) {
        const { width, height } = e.contentRect;
        const dpr = window.devicePixelRatio || 1;
        this.threeRenderer.setSize(width * dpr, height * dpr);
        if (this.focusedCamera && this.focusedCamera.isPerspectiveCamera) {
          this.focusedCamera.aspect = width / height;
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
   * Perform the initial scan converting child elements to Three.js objects.
   * Called once by the constructor.
   * @private
   */
  _ScanCell() {
    for (let i = 0; i < this.cellElm.children.length; i++) {
      const convictElm = this.cellElm.children[i];
      this.ScanElement(convictElm);
    }
  }

  /**
   * Convert a DOM element into a Three.js object and attach it to its
   * parent.  If the element's tag name is unknown a warning is logged
   * and null is returned.  Nested elements are scanned recursively.
   *
   * @param {HTMLElement} elm The DOM element to convert.
   * @returns {void}
   */
  ScanElement(elm) {
    const parentObj = this.getConvictByDom(elm.parentElement) || this.loadedScene;
    const instance = this.ConvertDomToObject(elm);
    if (this._allConvictsByDom.has(elm) || instance === null) {
      return;
    }
    // camera instantiation
    if (elm.tagName.includes('CAMERA')) {
      const rect = this.cellElm.getBoundingClientRect();
      const aspect = rect.width / rect.height;
      if (elm.tagName === 'PERSPECTIVECAMERA') {
        instance.fov = 75;
        instance.aspect = aspect;
        instance.far = 1000;
        instance.near = 0.1;
      } else {
        const frustumSize = 20;
        instance.frustumSize = frustumSize;
        instance.aspect = aspect;
        instance.left   = (-frustumSize * aspect) / 2;
        instance.right  = (frustumSize * aspect) / 2;
        instance.top    = frustumSize / 2;
        instance.bottom = -frustumSize / 2;
        instance.refreshLook = (fSize) => {
          instance.frustumSize = fSize;
          instance.left   = (-fSize * instance.aspect) / 2;
          instance.right  = (fSize * instance.aspect) / 2;
          instance.top    = fSize / 2;
          instance.bottom = -fSize / 2;
          instance.updateProjectionMatrix();
        };
      }
      if (elm.hasAttribute('render')) {
        this.focusedCamera = instance;
        this.focusedCamera.updateProjectionMatrix();
        this.threeRenderer.setSize(rect.width, rect.height);
        this.threeRenderer.setPixelRatio(window.devicePixelRatio);
      }
    }
    instance.userData.domEl = elm;
    instance.userData.extraParams = [];
    instance.transition = null;
    parentObj.add(instance);
    if (elm.id) {
      instance.userData.domId = elm.id;
      this.namedConvicts.push(instance);
      if (getCSSRule(`#${elm.id}:active`)) this.constantConvicts.push(instance);
    }
    const cls = elm.getAttribute('class');
    if (cls) {
      instance.name = cls;
      this.classyConvicts.push(instance);
      if (!this.constantConvicts.includes(instance) && getCSSRule(`.${cls}:active`)) {
        this.constantConvicts.push(instance);
      }
    }
    this._allConvictsByDom.set(elm, instance);
    for (let i = 0; i < elm.children.length; i++) {
      const element = elm.children[i];
      this.ScanElement(element);
    }
  }

  /**
   * Instantiate a Three.js object from a DOM tag.  Tag names are
   * upper‑cased, hyphens removed and looked up in the class map.  If the
   * tag is unknown or is `<canvas>` then null is returned.
   *
   * @param {HTMLElement} elm The DOM element.
   * @returns {THREE.Object3D|null} The new instance or null.
   */
  ConvertDomToObject(elm) {
    const key  = elm.tagName.replace(/-/g, '');
    const Ctor = getClassMap()[key];
    if (!Ctor) {
      if (elm.tagName !== 'CANVAS') {
        console.warn(`Unknown THREE class for <${elm.tagName.toLowerCase()}>`);
      }
      return null;
    }
    return new Ctor();
  }

  /**
   * Remove a Three.js object created from a DOM element.  Child objects
   * are removed recursively.  References are removed from tracking arrays
   * and the DOM element is removed from the page.  If the convict or
   * its parent is null nothing happens.
   *
   * @param {THREE.Object3D|null} convict The object to remove.
   */
  removeConvict(convict) {
    if (!convict) return;
    convict.children.forEach(element => {
      const childInstance = this._allConvictsByDom.get(element);
      if (element.children.length > 0) this.removeConvict(childInstance);
    });
    fastRemove_arry(this.classyConvicts, convict);
    fastRemove_arry(this.namedConvicts, convict);
    if (convict.userData.domEl) {
      convict.userData.domEl.remove();
      this._allConvictsByDom.delete(convict.userData.domEl);
    }
    if (convict.parent) {
      convict.parent.remove(convict);
    }
  }

  /**
   * Retrieve the Three.js object associated with a DOM element.
   * @param {HTMLElement} element The DOM element.
   * @returns {THREE.Object3D|undefined} The corresponding object or undefined.
   */
  getConvictByDom(element) {
    return this._allConvictsByDom.get(element);
  }

  /**
   * Retrieve an object using its DOM id.
   * @param {string} id The element id.
   * @returns {THREE.Object3D|undefined} The corresponding object or undefined.
   */
  getConvictById(id) {
    return this._allConvictsByDom.get(document.getElementById(id));
  }

  /**
   * Get all objects that share a class name.
   * @param {string} className The CSS class name.
   * @returns {Array<THREE.Object3D>} All matching objects.
   */
  getConvictsByClass(className) {
    const elements = Array.from(document.getElementsByClassName(className));
    const out = [];
    elements.forEach(elm => {
      const convict = this.getConvictByDom(elm);
      if (convict) {
        out.push(convict);
      }
    });
    return out;
  }

  /**
   * Register a per‑frame callback on this cell.  The callback will be
   * invoked on every animation frame with `this` bound to the cell.
   *
   * @param {Function} fn The callback to register.
   */
  addUpdateFunction(fn) {
    if (typeof fn === 'function') {
      const bound = fn.bind(this);
      // store the original unbound function for removal
      bound.originalFn = fn;
      this.updateFunds.push(bound);
    }
  }

  /**
   * Remove a previously registered per‑frame callback from this cell.
   * If the provided function has been bound using `addUpdateFunction`
   * this method will remove it from the `updateFunds` array.  Note
   * that you must provide the same function reference that was
   * originally registered.
   *
   * @param {Function} fn The callback to remove.
   */
  removeUpdateFunction(fn) {
    const idx = this.updateFunds.findIndex(item => item?.originalFn === fn);
    if (idx >= 0) {
      this.updateFunds.splice(idx, 1);
    }
  }

  /**
   * Clean up observers and event listeners and remove the canvas from
   * the DOM.  After calling this method the cell is effectively
   * destroyed and should not be used again.
   */
  dispose() {
    this._running = false;
    this._resizeObserver.disconnect();
    this._styleObserver.disconnect();
    this.cellElm.removeEventListener('mousemove', this._boundPointerMove);
    this.cellElm.removeEventListener('click', this._boundClick);
    this.cellElm.removeEventListener('mousedown', this._boundMouseDown);
    this.cellElm.removeEventListener('mouseup', this._boundMouseUp);
    this.cellElm.removeEventListener('dblclick', this._boundDoubleClick);
    this.cellElm.removeEventListener('contextmenu', this._boundContextMenu);
    const canvas = this.threeRenderer.domElement;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
}