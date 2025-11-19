// main.js
//
// JThree facade: finds <cell> elements, bootstraps renderer/scene/cell
// for each, and keeps a WeakMap of created Cell instances.

import * as THREE from 'three';
import Cell from './cell.js';

class JTHREE {
  static __Loaded_Cells__ = new WeakMap();
  static __StyleTag__ = null;

  /**
   * Convert all <cell> elements in the document.
   */
  static init_convert() {
    if (!JTHREE.__StyleTag__ && document.head) {
      const styleSheet = document.createElement('style');
      styleSheet.textContent = `
        cell > :not(canvas) {
          display: none;
        }
      `;
      document.head.appendChild(styleSheet);
      JTHREE.__StyleTag__ = styleSheet;
    }

    document.querySelectorAll('cell').forEach(el => {
      if (JTHREE.__Loaded_Cells__.has(el)) return;
      JTHREE.create_THREEJSRENDERER(el);
    });
  }

  /**
   * Legacy alias.
   */
  static _convert_init_() {
    return JTHREE.init_convert();
  }

  /**
   * Create renderer + scene for a given <cell> element.
   *
   * @param {HTMLElement} cellEl
   * @returns {Cell}
   */
  static create_THREEJSRENDERER(cellEl) {
    if (JTHREE.__Loaded_Cells__.has(cellEl)) {
      return JTHREE.__Loaded_Cells__.get(cellEl);
    }

    const { canvas, width, height, dpr } = createWebGLOverlay(cellEl);
    const safeWidth = width || 1;
    const safeHeight = height || 1;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(dpr);
    renderer.setSize(safeWidth, safeHeight, false);
    renderer.setClearColor(0x000000, 1);

    const scene = new THREE.Scene();

    // Find explicit cameras
    const regex = /camera/i;
    const foundCameraElms = Array.from(cellEl.children).filter(child =>
      regex.test(child.tagName) ||
      regex.test(child.id) ||
      regex.test(child.className)
    );

    let camera = null;
    if (foundCameraElms.length === 0) {
      camera = new THREE.PerspectiveCamera(75, safeWidth / safeHeight, 0.1, 1000);
      console.warn('No camera found for', cellEl, '. Creating a default camera.');
    }

    const cell = new Cell(cellEl, renderer, scene, camera || null);
    JTHREE.__Loaded_Cells__.set(cellEl, cell);

    cellEl.dispatchEvent(
      new CustomEvent('OnStart', { detail: { cell, CellEl: cellEl } })
    );

    return cell;
  }
}

/**
 * Create a WebGL canvas overlay on a host element.
 *
 * @param {HTMLElement} hostEl
 * @param {Object} [glOptions={}]
 * @returns {{canvas:HTMLCanvasElement, gl:WebGLRenderingContext, width:number, height:number, dpr:number}}
 */
function createWebGLOverlay(hostEl, glOptions = {}) {
  const { width, height } = hostEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  if (getComputedStyle(hostEl).position === 'static') {
    hostEl.style.position = 'relative';
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  Object.assign(canvas.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: `${width}px`,
    height: `${height}px`,
    pointerEvents: 'none',
    //zIndex: '-999'
  });

  hostEl.appendChild(canvas);

  const gl =
    canvas.getContext('webgl2', glOptions) ||
    canvas.getContext('webgl', glOptions) ||
    canvas.getContext('experimental-webgl', glOptions);

  if (!gl) {
    throw new Error('Your browser doesn’t support WebGL.');
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  return { canvas, gl, width, height, dpr };
}

// Auto-initialise on import.
JTHREE.init_convert();
window.JThree = JTHREE;

export { JTHREE };
export default JTHREE;
