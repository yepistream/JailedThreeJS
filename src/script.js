import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const EditorCameraElm = document.getElementById('EditorCamera');   // your <editor-camera> element
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

const sidePanel = document.getElementById("side-panel");

// Implement resizable panel behavior
const panelResizer = document.getElementById("panel-resizer");

let isResizing = false;

panelResizer.addEventListener('mousedown', (e) => {
  isResizing = true;
  document.body.style.cursor = "ew-resize";
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  // New width = distance from right edge to mouse X position
  let newWidth = window.innerWidth - e.clientX;
  // Clamp the width between a minimum of 5px (grab area) and, say, 500px maximum.
  newWidth = Math.min(Math.max(newWidth, 5), 500);
  sidePanel.style.width = newWidth + "px";
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    document.body.style.cursor = "default";
    isResizing = false;
  }
});

// Update textarea resize functionality
const resizeHandles = document.querySelectorAll('.resize-handle');
const textareas = document.querySelectorAll('.panel-textarea');
let isResizingTextarea = false;
let currentHandle = null;
let startY = 0;
let originalHeights = [];

// Store initial heights
textareas.forEach(textarea => {
    originalHeights.push(textarea.offsetHeight);
});

resizeHandles.forEach((handle, index) => {
    handle.addEventListener('mousedown', (e) => {
        isResizingTextarea = true;
        currentHandle = handle;
        startY = e.clientY;
        // Store current heights of affected textareas
        const prevTextarea = handle.previousElementSibling;
        const nextTextarea = handle.nextElementSibling;
        if (prevTextarea) originalHeights[index] = prevTextarea.offsetHeight;
        if (nextTextarea) originalHeights[index + 1] = nextTextarea.offsetHeight;
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    });
});

document.addEventListener('mousemove', (e) => {
    if (!isResizingTextarea || !currentHandle) return;
    
    const prevTextarea = currentHandle.previousElementSibling;
    const nextTextarea = currentHandle.nextElementSibling;
    
    if (prevTextarea && nextTextarea) {
        const delta = e.clientY - startY;
        const totalHeight = originalHeights[Array.from(resizeHandles).indexOf(currentHandle)] + 
                          originalHeights[Array.from(resizeHandles).indexOf(currentHandle) + 1];
        
        let newPrevHeight = Math.max(30, originalHeights[Array.from(resizeHandles).indexOf(currentHandle)] + delta);
        let newNextHeight = Math.max(30, totalHeight - newPrevHeight);
        
        // Hide textarea if it gets too small
        if (newPrevHeight <= 30) prevTextarea.style.display = 'none';
        else prevTextarea.style.display = 'block';
        
        if (newNextHeight <= 30) nextTextarea.style.display = 'none';
        else nextTextarea.style.display = 'block';
        
        prevTextarea.style.height = `${newPrevHeight}px`;
        nextTextarea.style.height = `${newNextHeight}px`;
        
        // Remove flex to maintain explicit heights
        prevTextarea.style.flex = 'none';
        nextTextarea.style.flex = 'none';
    }
});

document.addEventListener('mouseup', () => {
    isResizingTextarea = false;
    currentHandle = null;
    document.body.style.cursor = 'default';
});

document.addEventListener('mouseup', () => {
    isResizingTextarea = false;
    currentHandle = null;
    document.body.style.cursor = 'default';
});

const HTMLDiddle = document.getElementById("HTML_Doodles");
const JSDiddle = document.getElementById("JS_Doodles");
const CSSDiddle = document.getElementById("CSS_Doodles");

const DoodleZone_CSS = document.getElementById("doodle-zone");
let DoodleZone_JS = document.getElementById("logic-doodle-zone");

HTMLDiddle.value = `<mesh id="basic_White_Cube" onclick="shit(this)"></mesh>`;
CSSDiddle.value = `

#basic_White_Cube{
    --position: (0,0,-5);
    --geometry : @cube;
    --material-color : (1,1,1);
}


#basic_White_Cube:hover{
    --material-color: (0,0,0);
}

#basic_Purple_Cube{
    --position: (0,0,-5);
    --geometry : @cube;
    --material-color : (1,0,1);
}

    
`;
JSDiddle.value = `
function shit(it){
  it.id = "basic_Purple_Cube";
}
`;

CSSDiddle.addEventListener("input", ()=>{
  RefreshSTYLE();
})
HTMLDiddle.addEventListener("input", ()=>{
  RefreshHTML();
})

JSDiddle.addEventListener("input", ()=>{
  RefreshJS();
})

function RefreshSTYLE() {
  console.log("ass");
  const cssText = CSSDiddle.value;
  let styleTag = document.getElementById('dynamic-style');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'dynamic-style';
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = cssText;
}

function RefreshHTML() {
  console.log(cellElement.cell.loadedScene)
  DoodleZone_CSS.innerHTML = HTMLDiddle.value;
}

// Assuming this never changes:
const JSContainer = document.getElementById("logic-doodle-zone");

function RefreshJS() {
  // 1) Remove any previously injected doodle scripts
  const oldScripts = JSContainer.querySelectorAll("script[data-doodle]");
  oldScripts.forEach(s => s.remove());

  // 2) Create the new <script> and mark it
  const tempScript = document.createElement("script");
  tempScript.setAttribute("data-doodle", "true");
  tempScript.textContent = JSDiddle.value;

  // 3) Inject it into the container
  JSContainer.appendChild(tempScript);
}


RefreshHTML();
RefreshSTYLE();
RefreshJS();
