// NoScope.js
//
// Centralised event handling.
// Shared THREE.Raycaster + NDC pointer for all cells; all pickable
// objects live on layer 3.

import * as THREE from 'three';
import { paintExtraCell, paintSpecificMuse } from './artist.js';
import { fastRemove_arry } from './utils.js';

const raycaster = new THREE.Raycaster();
const ndcPointer = new THREE.Vector2();

// Only objects on layer 3 are considered pickable.
raycaster.layers.set(3);

/* Flag helpers */

function addFlag(arr, flag) {
  if (!arr.includes(flag)) arr.push(flag);
}

function delFlag(arr, flag) {
  fastRemove_arry(arr, flag);
}

/* Public handlers */

export function default_onCellClick_method(domEvt, cell) {
  const hit = cell._last_cast_caught;
  if (!hit) return;

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

export function default_onCellPointerMove_method(domEvt, cell) {
  if (!cell.focusedCamera) return;

  _raycast(domEvt, cell.focusedCamera, cell.cellElm);

  const hitResult = raycaster.intersectObjects(cell.loadedScene.children, true)[0];
  const lastHit = cell._last_cast_caught;

  if (hitResult) {
    const hitObject = hitResult.object;

    if (hitObject !== lastHit) {
      if (lastHit) {
        delFlag(lastHit.userData.extraParams, ':hover');
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

      cell._last_cast_caught = hitObject;

      hitObject.userData.domEl.onmouseenter?.call(hitObject.userData.domEl, {
        type: 'cellmouseenter',
        originalEvt: domEvt,
        target3d: hitObject,
        targetCell: cell,
        targetElement: hitObject.userData.domEl,
        pointerPosition: hitResult.point
      });
    }

    addFlag(hitObject.userData.extraParams, ':hover');
    cell._lastHitPosition = hitResult.point;

    hitObject.userData.domEl.onmouseover?.call(hitObject.userData.domEl, {
      type: 'cellhover',
      originalEvt: domEvt,
      target3d: hitObject,
      targetCell: cell,
      targetElement: hitObject.userData.domEl,
      pointerPosition: hitResult.point
    });

    paintExtraCell(cell);
  } else if (lastHit) {
    delFlag(lastHit.userData.extraParams, ':hover');
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
  paintExtraCell(cell);
}

/* Internal raycast helper */

/**
 * @param {MouseEvent} domEvt
 * @param {THREE.Camera} camera
 * @param {HTMLElement} referenceEl
 */
function _raycast(domEvt, camera, referenceEl) {
  if (!camera) return;

  const targetEl = referenceEl || domEvt.currentTarget || domEvt.target;
  const rect = targetEl.getBoundingClientRect();

  camera.updateMatrixWorld();

  ndcPointer.set(
    ((domEvt.clientX - rect.left) / rect.width) * 2 - 1,
    (-(domEvt.clientY - rect.top) / rect.height) * 2 + 1
  );

  raycaster.setFromCamera(ndcPointer, camera);
}
