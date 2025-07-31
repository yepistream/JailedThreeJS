// NoScope.js
//
// Centralised event handling for JailedThreeJS.  A single shared
// `THREE.Raycaster` and NDC pointer are used for all cells to improve
// performance.  The module defines default handlers for hover, click,
// double click, mouse down, mouse up and context menu events.  These
// handlers compute the 3D intersection, update pseudo‑class flags on
// objects and invoke any user‑provided callbacks defined as
// HTML attributes (e.g. `onclick`, `onmouseover`, etc.).

import * as THREE from 'three';
import { paintExtraCell, paintSpecificMuse } from './artist.js';
import { fastRemove_arry } from './utils.js';

/* ------------------------------------------------------------------ */
/*  Single shared raycaster & pointer (perf)                          */
/* ------------------------------------------------------------------ */

const raycaster  = new THREE.Raycaster();
const ndcPointer = new THREE.Vector2();
// pickable objects live on layer 3
raycaster.layers.set(3);

/* ------------------------------------------------------------------ */
/*  Array-based flag helpers                                          */
/* ------------------------------------------------------------------ */

/**
 * Add a flag to an array if it is not already present.
 * Flags are used to represent pseudo‑classes (':hover', ':focus', ':active').
 *
 * @param {Array<string>} arr The array to modify.
 * @param {string} flag The flag to add.
 */
function addFlag(arr, flag) {
  if (!arr.includes(flag)) arr.push(flag);
}

/**
 * Remove a flag from an array.
 * @param {Array<string>} arr The array to modify.
 * @param {string} flag The flag to remove.
 */
function delFlag(arr, flag) {
  fastRemove_arry(arr, flag);
}

/* ------------------------------------------------------------------ */
/*  Public handlers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Handle click events inside a cell.  A click focuses the last hit object,
 * adds the `:focus` flag and invokes the object's `onclick` callback
 * (if defined on the DOM element).  After handling the callback the
 * cell’s extra painting pass is triggered.
 *
 * @param {MouseEvent} domEvt The browser click event.
 * @param {import('./cell.js').default} cell The cell instance that received the click.
 */
export function default_onCellClick_method(domEvt, cell) {
  const hit = cell._last_cast_caught;
  if (!hit) return;
  // focus the object
  addFlag(hit.userData.extraParams, ':focus');
  const synth = {
    type: 'cellclick',
    originalEvt: domEvt,
    target3d: hit,
    targetCell: cell,
    targetElement: hit.userData.domEl,
    pointerPosition: cell._lastHitPosition
  };
  hit.userData.domEl.onclick?.call(hit.userData.domEl, synth);
  paintExtraCell(cell);
}

/**
 * Handle pointer movement inside a cell.  Performs a raycast into the
 * scene and tracks the currently intersected object.  When the pointer
 * enters a new object the `:hover` flag is added; when it leaves all
 * objects the flag is removed.  Invokes the object's `onmouseover`
 * callback (if defined on the DOM element) and triggers a painting pass.
 *
 * @param {MouseEvent} domEvt The browser mousemove event.
 * @param {import('./cell.js').default} cell The cell instance to test against.
 */
export function default_onCellPointerMove_method(domEvt, cell) {
  _raycast(domEvt, cell.focusedCamera);
  const hit     = raycaster.intersectObjects(cell.loadedScene.children, true)[0];
  const lastHit = cell._last_cast_caught;
  if (hit) {
    if (hit.object !== lastHit) {
      // pointer moved onto a new object
      if (lastHit) {
        delFlag(lastHit.userData.extraParams, ':hover');
        // trigger mouseleave on previous object
        lastHit.userData.domEl.onmouseleave?.call(lastHit.userData.domEl, {
          type: 'cellmouseleave',
          originalEvt: domEvt,
          target3d: lastHit,
          targetCell: cell,
          targetElement: lastHit.userData.domEl,
          pointerPosition: cell._lastHitPosition
        });
        paintSpecificMuse(lastHit);
      }
      cell._last_cast_caught = hit.object;
      // trigger mouseenter on new object
      hit.object.userData.domEl.onmouseenter?.call(hit.object.userData.domEl, {
        type: 'cellmouseenter',
        originalEvt: domEvt,
        target3d: hit.object,
        targetCell: cell,
        targetElement: hit.object.userData.domEl,
        pointerPosition: hit.point
      });
    }
    addFlag(hit.object.userData.extraParams, ':hover');
    cell._lastHitPosition = hit.point;
    // trigger mouseover on every move
    hit.object.userData.domEl.onmouseover?.call(
      hit.object.userData.domEl,
      {
        type: 'cellhover',
        originalEvt: domEvt,
        target3d: hit.object,
        targetCell: cell,
        targetElement: hit.object.userData.domEl,
        pointerPosition: hit.point
      }
    );
    paintExtraCell(cell);
  } else if (lastHit) {
    // pointer left all objects
    delFlag(lastHit.userData.extraParams, ':hover');
    // trigger mouseleave on last object
    lastHit.userData.domEl.onmouseleave?.call(lastHit.userData.domEl, {
      type: 'cellmouseleave',
      originalEvt: domEvt,
      target3d: lastHit,
      targetCell: cell,
      targetElement: lastHit.userData.domEl,
      pointerPosition: cell._lastHitPosition
    });
    paintSpecificMuse(lastHit);
    cell._last_cast_caught = null;
  }
}

/**
 * Handle mouse down events inside a cell.  Adds the `:active` flag and
 * calls the element’s `onmousedown` handler if present.  A painting pass
 * is triggered afterwards.
 *
 * @param {MouseEvent} domEvt The browser mousedown event.
 * @param {import('./cell.js').default} cell The cell instance.
 */
export function default_onCellMouseDown_method(domEvt, cell) {
  const hit = cell._last_cast_caught;
  if (!hit) return;
  addFlag(hit.userData.extraParams, ':active');
  const synth = {
    type: 'celldown',
    originalEvt: domEvt,
    target3d: hit,
    targetCell: cell,
    targetElement: hit.userData.domEl,
    pointerPosition: cell._lastHitPosition
  };
  hit.userData.domEl.onmousedown?.call(hit.userData.domEl, synth);
  paintExtraCell(cell);
}

/**
 * Handle mouse up events inside a cell.  Removes the `:active` flag and
 * calls the element’s `onmouseup` handler if present.  A painting pass
 * is triggered afterwards.
 *
 * @param {MouseEvent} domEvt The browser mouseup event.
 * @param {import('./cell.js').default} cell The cell instance.
 */
export function default_onCellMouseUp_method(domEvt, cell) {
  const hit = cell._last_cast_caught;
  if (!hit) return;
  delFlag(hit.userData.extraParams, ':active');
  const synth = {
    type: 'cellup',
    originalEvt: domEvt,
    target3d: hit,
    targetCell: cell,
    targetElement: hit.userData.domEl,
    pointerPosition: cell._lastHitPosition
  };
  hit.userData.domEl.onmouseup?.call(hit.userData.domEl, synth);
  paintExtraCell(cell);
}

/**
 * Handle double click events inside a cell.  Adds the `:focus` flag and
 * calls the element’s `ondblclick` handler if present.  A painting pass
 * is triggered afterwards.
 *
 * @param {MouseEvent} domEvt The browser dblclick event.
 * @param {import('./cell.js').default} cell The cell instance.
 */
export function default_onCellDoubleClick_method(domEvt, cell) {
  const hit = cell._last_cast_caught;
  if (!hit) return;
  addFlag(hit.userData.extraParams, ':focus');
  const synth = {
    type: 'celldblclick',
    originalEvt: domEvt,
    target3d: hit,
    targetCell: cell,
    targetElement: hit.userData.domEl,
    pointerPosition: cell._lastHitPosition
  };
  hit.userData.domEl.ondblclick?.call(hit.userData.domEl, synth);
  paintExtraCell(cell);
}

/**
 * Handle context menu events inside a cell.  Calls the element’s
 * `oncontextmenu` handler if present.  The default browser context menu
 * is expected to be prevented by the caller (cell.js does this).
 *
 * @param {MouseEvent} domEvt The browser contextmenu event.
 * @param {import('./cell.js').default} cell The cell instance.
 */
export function default_onCellContextMenu_method(domEvt, cell) {
  const hit = cell._last_cast_caught;
  if (!hit) return;
  const synth = {
    type: 'cellcontextmenu',
    originalEvt: domEvt,
    target3d: hit,
    targetCell: cell,
    targetElement: hit.userData.domEl,
    pointerPosition: cell._lastHitPosition
  };
  hit.userData.domEl.oncontextmenu?.call(hit.userData.domEl, synth);
  // context menu does not change flags but we still repaint in case
  paintExtraCell(cell);
}

/* ------------------------------------------------------------------ */
/*  Internal: raycast helper                                          */
/* ------------------------------------------------------------------ */

/**
 * Internal helper to perform a raycast using event coordinates.  The
 * pointer is converted into normalised device coordinates and the
 * raycaster is updated accordingly.
 *
 * @param {MouseEvent} domEvt The browser pointer/mouse event.
 * @param {THREE.Camera} camera The camera used for the raycast.
 */
function _raycast(domEvt, camera) {
  const rect = domEvt.target.getBoundingClientRect();
  camera.updateMatrixWorld();
  ndcPointer.set(
    ((domEvt.clientX - rect.left) / rect.width) * 2 - 1,
    (-(domEvt.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndcPointer, camera);
}