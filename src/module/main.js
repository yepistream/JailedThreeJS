// main.js
import * as THREE from 'three';
import Cell from './cell.js';


window.addEventListener("DOMContentLoaded", ()=>{
  window.JThree = new goballs_main_warden();
});

class goballs_main_warden {
  constructor() {
    this.allCells = new WeakMap();
    this._init_convert();

  }

  getCell(element){
    return this.allCells.get(element);
  }

  _init_convert() {
    document.querySelectorAll('cell').forEach(el => {
      this._create_THREEJSRENDERER(el);
    });
  }

  _create_THREEJSRENDERER(cellEl) {
    const { canvas } = createWebGLOverlay(cellEl);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const dpr = window.devicePixelRatio || 1;
    renderer.setSize(canvas.width, canvas.height);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 1);

    // basic scene + camera
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
    camera.position.z = 5;
    scene.add(camera);

    // lights
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(1, 1, 1).normalize();
    scene.add(dir, new THREE.AmbientLight(0x404040));

    // create and track the Cell
    const cell = new Cell(cellEl, renderer, scene, camera);
    this.allCells.set(cellEl,cell);
    console.log('Cells:', this.allCells);
  }
}

function createWebGLOverlay(hostEl, glOptions = {}) {
  console.log(hostEl);
  const { width, height } = hostEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  if (getComputedStyle(hostEl).position === 'static') {
    hostEl.style.position = 'relative';
  }
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(width  * dpr);
  canvas.height = Math.round(height * dpr);
  Object.assign(canvas.style, {
    position: 'absolute', top: '0', left: '0',
    width: `${width}px`, height: `${height}px`,
    pointerEvents: 'none', zIndex: '999'
  });
  hostEl.appendChild(canvas);
  const gl = canvas.getContext('webgl2', glOptions)
          || canvas.getContext('webgl',  glOptions)
          || canvas.getContext('experimental-webgl', glOptions);
  if (!gl) throw new Error('Your browser doesn’t support WebGL.');
  gl.viewport(0, 0, canvas.width, canvas.height);
  return { canvas, gl };
}

export default goballs_main_warden;
