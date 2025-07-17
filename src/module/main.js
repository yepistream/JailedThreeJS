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


    // TODO : Allow multiple scenes as elements of the 
    //    allScens = [...cellEl.querySelectorAll("scene")];


    const scene  = new THREE.Scene();

    //Finds Only Cameras From the Cell's Element lists.
    const regex = /camera/i;
    const foundCameraElms = Array.from(cellEl.children).filter(child =>
      regex.test(child.tagName) || regex.test(child.id) || regex.test(child.className)
    );

    let camera = null;

    if(foundCameraElms <= 0){
     camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      console.warn("No Found Camera For : ",cellEl,". Creating a Default Camera.");
    }


    // create and track the Cell
    const cell = new Cell(cellEl, renderer, scene, camera || null );
    this.allCells.set(cellEl,cell);
    //console.log('Cells:', this.allCells);
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
