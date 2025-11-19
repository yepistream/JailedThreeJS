import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const cellElement = document.querySelector('cell');
const previewCameraEl = document.getElementById('EditorCamera');

const htmlEditor = document.getElementById('HTML_Doodles');
const cssEditor = document.getElementById('CSS_Doodles');
const jsEditor = document.getElementById('JS_Doodles');
const sidePanel = document.getElementById('side-panel');
const panelResizer = document.getElementById('panel-resizer');
const sceneNameInput = document.getElementById('scene-name');
const resetEditorsBtn = document.getElementById('reset-editors');
const saveBtn = document.getElementById('save-project');
const doodleZone = document.getElementById('doodle-zone');
const scriptHost = document.getElementById('logic-doodle-zone');

window.__JailedSceneCleanup = window.__JailedSceneCleanup || [];
window.registerSceneCleanup = function registerSceneCleanup(fn) {
  if (typeof fn === 'function') {
    window.__JailedSceneCleanup.push(fn);
  }
};

function runSceneCleanup() {
  const cleaners = window.__JailedSceneCleanup;
  while (cleaners.length) {
    const cleaner = cleaners.pop();
    try { cleaner(); }
    catch (err) { console.warn('Scene cleanup failed:', err); }
  }
}

const pointerControls = new PointerLockControls(previewCameraEl.convict, cellElement);
const movementKeys = { w: 0, a: 0, s: 0, d: 0 };
const keyMap = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' };
const clock = new THREE.Clock();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();

function updateCameraControls() {
  const dt = clock.getDelta();
  if (!pointerControls.isLocked) return;
  const cam = previewCameraEl.convict;
  cam.getWorldDirection(forward).normalize();
  right.copy(forward).cross(cam.up).normalize();
  const move = new THREE.Vector3();
  if (movementKeys.w) move.add(forward);
  if (movementKeys.s) move.sub(forward);
  if (movementKeys.a) move.sub(right);
  if (movementKeys.d) move.add(right);
  if (move.lengthSq()) {
    move.normalize().multiplyScalar(30 * dt);
    const next = cam.position.clone().add(move);
    previewCameraEl.style.setProperty('--position', `(${next.x},${next.y},${next.z})`);
  }
}

cellElement.cell.addUpdateFunction(updateCameraControls);
cellElement.addEventListener('contextmenu', e => e.preventDefault());
cellElement.addEventListener('mousedown', e => {
  if (e.button === 2) {
    pointerControls.lock();
    e.preventDefault();
  }
});
document.addEventListener('mouseup', e => {
  if (e.button === 2) {
    pointerControls.unlock();
    e.preventDefault();
  }
});

window.addEventListener('keydown', e => {
  const key = keyMap[e.code];
  if (key) movementKeys[key] = 1;
});
window.addEventListener('keyup', e => {
  const key = keyMap[e.code];
  if (key) movementKeys[key] = 0;
});

const DEFAULT_SCENE = {
  name: 'Workbench',
  html: `
<mesh id="demo-cube"></mesh>
<axesHelper id="axis"></axesHelper>
`.trim(),
  css: `
#demo-cube {
  --geometry: @cube;
  --position: (0,0,-4);
  --material-color: (0.8,0.8,0.85);
  --material-roughness: 0.5;
  --material-metalness: 0.15;
}

#demo-cube:hover {
  --material-color: (0.4,0.7,1);
}

#axis {
  --scale: (2,2,2);
  --position: (0,-0.5,-4);
}`.trim(),
  js: `// Write custom behaviour here.
`
};

function RefreshHTML() {
  doodleZone.innerHTML = htmlEditor.value;
}

function RefreshSTYLE() {
  let styleTag = document.getElementById('dynamic-style');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'dynamic-style';
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = cssEditor.value;
}

function RefreshJS() {
  runSceneCleanup();
  scriptHost.querySelectorAll('script[data-doodle]').forEach(node => node.remove());
  if (!jsEditor.value.trim()) return;
  const script = document.createElement('script');
  script.setAttribute('data-doodle', 'true');
  script.textContent = jsEditor.value;
  scriptHost.appendChild(script);
}

function setEditors(html, css, js) {
  htmlEditor.value = html;
  cssEditor.value = css;
  jsEditor.value = js;
}

function loadDefaultScene() {
  sceneNameInput.value = DEFAULT_SCENE.name;
  setEditors(DEFAULT_SCENE.html, DEFAULT_SCENE.css, DEFAULT_SCENE.js);
  RefreshHTML();
  RefreshSTYLE();
  RefreshJS();
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'jailedthree-scene';
}

function sanitizeScript(contents) {
  return contents.replace(/<\/script/gi, '<\\/script');
}

function buildExportMarkup(title) {
  const safeTitle = escapeHtml(title || 'JailedThreeJS Scene');
  const userCss = cssEditor.value;
  const userHtml = htmlEditor.value;
  const userJs = jsEditor.value;
  const baseCss = `
*{box-sizing:border-box;}
html,body{margin:0;height:100%;background:#02060f;color:#fefefe;}
cell{display:block;width:100%;height:100%;}
.global_light{--color:(1,1,1);--intensity:(10);--position-set:(1,10,1);}`.trim();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
${baseCss}
${userCss}
  </style>
</head>
<body>
  <cell>
    <DirectionalLight class="global_light"></DirectionalLight>
    <PerspectiveCamera render id="ExportCamera"></PerspectiveCamera>
    <div id="doodle-zone">
${userHtml}
    </div>
  </cell>
  <script type="module" src="./module/main.js"></script>
  <script>
    window.__JailedSceneCleanup = window.__JailedSceneCleanup || [];
    window.registerSceneCleanup = function(fn){ if(typeof fn === 'function'){ window.__JailedSceneCleanup.push(fn); } };
  </script>
  ${userJs.trim() ? `<script>
${sanitizeScript(userJs)}
  </script>` : ''}
</body>
</html>`;
}

function downloadScene() {
  const markup = buildExportMarkup(sceneNameInput.value.trim());
  const blob = new Blob([markup], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(sceneNameInput.value.trim())}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

htmlEditor.addEventListener('input', RefreshHTML);
cssEditor.addEventListener('input', RefreshSTYLE);
jsEditor.addEventListener('input', RefreshJS);
resetEditorsBtn.addEventListener('click', loadDefaultScene);
saveBtn.addEventListener('click', downloadScene);

let resizingPanel = false;
panelResizer.addEventListener('mousedown', e => {
  resizingPanel = true;
  document.body.style.cursor = 'ew-resize';
  e.preventDefault();
});

document.addEventListener('mousemove', e => {
  if (!resizingPanel) return;
  const width = Math.min(Math.max(window.innerWidth - e.clientX, 280), 640);
  sidePanel.style.width = `${width}px`;
});

document.addEventListener('mouseup', () => {
  if (resizingPanel) {
    document.body.style.cursor = 'default';
    resizingPanel = false;
  }
  if (activeHandle) {
    document.body.style.cursor = 'default';
    activeHandle = null;
  }
});

let activeHandle = null;
let handleStartY = 0;

document.querySelectorAll('.resize-handle').forEach(handle => {
  handle.addEventListener('mousedown', e => {
    const prev = document.getElementById(handle.dataset.prev);
    const next = document.getElementById(handle.dataset.next);
    if (!prev || !next) return;
    activeHandle = {
      prev,
      next,
      prevStart: prev.offsetHeight,
      nextStart: next.offsetHeight
    };
    handleStartY = e.clientY;
    document.body.style.cursor = 'row-resize';
    e.preventDefault();
  });
});

document.addEventListener('mousemove', e => {
  if (!activeHandle) return;
  const delta = e.clientY - handleStartY;
  const prevHeight = Math.max(120, activeHandle.prevStart + delta);
  const nextHeight = Math.max(120, activeHandle.nextStart - delta);
  activeHandle.prev.style.height = `${prevHeight}px`;
  activeHandle.next.style.height = `${nextHeight}px`;
  activeHandle.prev.style.flex = 'none';
  activeHandle.next.style.flex = 'none';
});

loadDefaultScene();
