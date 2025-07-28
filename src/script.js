import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const EditorCameraElm = document.getElementById('Editor-Camera');   // your <editor-camera> element
const cellElement     = document.querySelector('cell');             // the DOM surface that eats input

// 1 -> Orientation  (pointer-lock)
const controls = new PointerLockControls( EditorCameraElm.convict, cellElement );

// right-mouse  ->  lock / unlock
cellElement.addEventListener('mousedown', e => {
  if (e.button === 2) { controls.lock();   e.preventDefault(); }
});
document.addEventListener('mouseup',   e => {
  if (e.button === 2) { controls.unlock(); e.preventDefault(); }
});
// suppress the context-menu entirely
cellElement.addEventListener('contextmenu', e => e.preventDefault());

// 2 -> WASD state
const keys = { w:0, a:0, s:0, d:0 };

window.addEventListener('keydown', e=>{
  switch (e.code) {
    case 'KeyW': keys.w = 1; break;
    case 'KeyA': keys.a = 1; break;
    case 'KeyS': keys.s = 1; break;
    case 'KeyD': keys.d = 1; break;
  }
});
window.addEventListener('keyup', e=>{
  switch (e.code) {
    case 'KeyW': keys.w = 0; break;
    case 'KeyA': keys.a = 0; break;
    case 'KeyS': keys.s = 0; break;
    case 'KeyD': keys.d = 0; break;
  }
});

// 3 -> Manual translation using look-vectors
const SPEED   = 40;                                 // world-units / second
const clock   = new THREE.Clock();
const forward = new THREE.Vector3();
const right   = new THREE.Vector3();

function __editor_camera_control_update__ () {

  const dt = clock.getDelta();
  if ( !controls.isLocked ) return;                 // only move while locked

  // W/S) forward  =  camera’s −Z axis in world-space
  const cam = EditorCameraElm.convict;              // THREE.PerspectiveCamera
  cam.getWorldDirection( forward );
  forward.normalize();

  // A/D) right  =  forward × up
  right.copy( forward ).cross( cam.up ).normalize();

  // c) accumulate movement
  const move = new THREE.Vector3();
  if (keys.w) move.add( forward );
  if (keys.s) move.sub( forward );
  if (keys.a) move.sub( right   );
  if (keys.d) move.add( right   );

  if (move.lengthSq()) {
    move.normalize().multiplyScalar( SPEED * dt );
    
    const currentCamPos = EditorCameraElm.convict.position.clone();

    currentCamPos.add(move);

    EditorCameraElm.style.setProperty("--position",`(${currentCamPos.x},${currentCamPos.y},${currentCamPos.z})`);
  }
}

cellElement.cell.addUpdateFunction( __editor_camera_control_update__ );
