// main.js
//
// The `JTHREE` class is a facade that scans the page for `<cell>`
// elements and constructs a Three.js renderer and scene for each.  It
// exposes a single static method, `init_convert()`, which you can call to
// (re)initialise your page.  Cells are created automatically when this
// module is imported.

import * as THREE from 'three';
import Cell from './cell.js';

class JTHREE {
  /**
   * Convert all `<cell>` elements in the document into Three.js cells.
   * This method queries the DOM for `cell` tags and calls
   * `create_THREEJSRENDERER` for each.  You can call it manually after
   * dynamically inserting new cell elements.
   *
   * @static
   */
  static init_convert() {
    document.querySelectorAll('cell').forEach(el => {
      JTHREE.create_THREEJSRENDERER(el);
    });
  }

  /**
   * Legacy alias for {@link init_convert}.  Older examples may still
   * reference `_convert_init_()` when initialising a page.  This
   * alias ensures backwards compatibility by delegating to
   * {@link init_convert}.  You should use {@link init_convert} in
   * new code.
   *
   * @static
   */
  static _convert_init_() {
    return JTHREE.init_convert();
  }

  /**
   * Initialise a WebGL renderer and scene for a cell element.
   * If the cell does not contain a camera element then a default
   * `PerspectiveCamera` is created.  The returned renderer and scene
   * are passed into the `Cell` constructor.  A `Cell` instance is
   * returned so that the caller can register update functions or access
   * its properties.
   *
   * @param {HTMLElement} cellEl The DOM element acting as the cell root.
   * @returns {Cell} The created cell instance.
   */
  static create_THREEJSRENDERER(cellEl) {
    const { canvas } = createWebGLOverlay(cellEl);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const dpr = window.devicePixelRatio || 1;
    renderer.setSize(canvas.width, canvas.height);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 1);

    // placeholder for supporting multiple scenes.  At present only one
    // `<scene>` element is used and all objects are added to it.
    const scene = new THREE.Scene();

    // Look for cameras defined inside the cell.  A camera is found if
    // its tag name, id or class contains the substring "camera".
    const regex = /camera/i;
    const foundCameraElms = Array.from(cellEl.children).filter(child =>
      regex.test(child.tagName) || regex.test(child.id) || regex.test(child.className)
    );

    let camera = null;
    if (foundCameraElms.length === 0) {
      camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      console.warn('No camera found for', cellEl, '. Creating a default camera.');
    }

    // create and track the cell
    const cell = new Cell(cellEl, renderer, scene, camera || null);
    return cell;
  }
}

/**
 * Create a WebGL canvas overlay on a host element.  This helper creates
 * an absolutely positioned `<canvas>` on top of the supplied host element
 * and returns both the canvas and its WebGL context.  The canvas is
 * automatically sized to match the host element.
 *
 * @param {HTMLElement} hostEl The element to attach the canvas to.
 * @param {Object} [glOptions={}] Optional WebGL context options.
 * @returns {{canvas: HTMLCanvasElement, gl: WebGLRenderingContext}} An
 *          object containing the canvas and its context.
 */
function createWebGLOverlay(hostEl, glOptions = {}) {
  const { width, height } = hostEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  if (getComputedStyle(hostEl).position === 'static') {
    hostEl.style.position = 'relative';
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  Object.assign(canvas.style, {
    position: 'absolute', top: '0', left: '0',
    width: `${width}px`, height: `${height}px`,
    pointerEvents: 'none', zIndex: '999'
  });
  hostEl.appendChild(canvas);
  const gl = canvas.getContext('webgl2', glOptions)
            || canvas.getContext('webgl', glOptions)
            || canvas.getContext('experimental-webgl', glOptions);
  if (!gl) throw new Error("Your browser doesn’t support WebGL.");
  gl.viewport(0, 0, canvas.width, canvas.height);
  return { canvas, gl };
}

// initialise on module load
//
// When this module is imported it automatically scans the DOM for
// `<cell>` elements and converts them into Three.js scenes.  This
// behaviour mimics the old `_convert_init_()` API which users
// previously had to call manually.  If additional cells are added to
// the DOM after load you can still call `JThree.init_convert()` to
// convert them.
JTHREE.init_convert();
window.JThree = JTHREE;

export { JTHREE };
export default JTHREE;