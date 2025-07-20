import * as THREE from '../../node_modules/three/build/three.module.js';
import { paintConvict, paintExtraCell, paintSpecificMuse } from './artist.js';
import { fastRemove_arry } from './utils.js';

/* ------------------------------------------------------------------ */
/*  Single shared raycaster & pointer (perf)                          */
/* ------------------------------------------------------------------ */
const raycaster  = new THREE.Raycaster();
const ndcPointer = new THREE.Vector2();

raycaster.layers.set(3);

/* ------------------------------------------------------------------ */
/*  Array-based flag helpers                                          */
/* ------------------------------------------------------------------ */
function addFlag(arr, flag) {
    if (!arr.includes(flag)) arr.push(flag);      // no dupes
}
function delFlag(arr, flag) {
    fastRemove_arry(arr, flag);                   // your util
}

/* ------------------------------------------------------------------ */
/*  Public handlers                                                   */
/* ------------------------------------------------------------------ */
export function default_onCellClick_method(domEvt, cell) {
    const hit = cell._last_cast_caught;
    if (!hit) return;

    addFlag(hit.userData.extraParams, ':active');

    const synth = {
        type:            'cellclick',
        originalEvt:     domEvt,
        target3d:        hit,
        targetCell:      cell,
        targetElement:   hit.userData.domEl,
        pointerPosition: cell._lastHitPosition
    };

    hit.userData.domEl.onclick?.call(hit.userData.domEl, synth);
    paintExtraCell(cell);
}

export function default_onCellPointerMove_method(domEvt, cell) {
    _raycast(domEvt, cell.focusedCamera);

    const hit     = raycaster.intersectObjects(cell.loadedScene.children, true)[0];
    const lastHit = cell._last_cast_caught;
    

    if (hit) {
        if (hit.object !== lastHit) {
            // transitioned to a new object
            if (lastHit) {
                delFlag(lastHit.userData.extraParams, ':hover');
                paintSpecificMuse(lastHit);
            }
            cell._last_cast_caught = hit.object;
        }

        addFlag(hit.object.userData.extraParams, ':hover');
        cell._lastHitPosition = hit.point;

        hit.object.userData.domEl.onmouseover?.call(
            hit.object.userData.domEl,
            {
                type:            'cellhover',
                originalEvt:     domEvt,
                target3d:        hit.object,
                targetCell:      cell,
                targetElement:   hit.object.userData.domEl,
                pointerPosition: hit.point
            }
        );

        paintExtraCell(cell);
    } else if (lastHit) {
        // ray left all objects
        delFlag(lastHit.userData.extraParams, ':hover');
        paintSpecificMuse(lastHit);
        cell._last_cast_caught = null;
    }
}

/* ------------------------------------------------------------------ */
/*  Internal: raycast helper                                          */
/* ------------------------------------------------------------------ */
function _raycast(domEvt, camera) {
    const rect = domEvt.target.getBoundingClientRect();

    ndcPointer.set(
        ((domEvt.clientX - rect.left) / rect.width) * 2 - 1,
        (-(domEvt.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.setFromCamera(ndcPointer, camera);
}
