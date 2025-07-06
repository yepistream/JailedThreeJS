import * as THREE from '../../node_modules/three/build/three.module.js';
import { paintConvict, paintExtraCell, paintSpecificMuse } from './artist.js';
import { fastRemove_arry } from './utils.js';


/*
    TODO :
    //// First Thing First : Every Cell Will Contain A Hover And Click Element (Added in Cell.JS) that will run the Next Functions :
    ////   RayCaster Check's If it Hit Anything ---> Changes Both Name And userData.DomId To Contain a :hover -- MutantObserver Checks For Style Attribute Update --> Update Thru _apply_rules.
    ////   If Raycaster is Hovering Over An Object ---> On Click Event Changes Both Name and userData.domID to Contain :click(-ing/(retard-)-ed) -- Same Shit --> Updates Thru _apply_rules 
    //// Implement Compatibility With Calls To Native Event Listeners For Mouse/Pointer Movmenet And Actions.
*/



export function default_onCellClick_method(event,cell){
    if(cell._last_cast_caught){
        cell._last_cast_caught.userData.extraParams.push(":active");
        event.target3d = cell._last_cast_caught;
        event.targetCell = cell;
        event.targetElement = cell._last_cast_caught.userData.domEl
        cell._last_cast_caught.userData.domEl.onclick.call(cell._last_cast_caught.userData.domEl,event);
        paintExtraCell(cell);
    }
}

export function default_onCellPointerMove_method(event,cell){
    const intersects = _raycast(event,cell.focusedCamera, cell.loadedScene.children);

    if(intersects[0] && cell._last_cast_caught!= intersects[0].object){
        cell._last_cast_caught = intersects[0].object;
        //console.log("Caught in ray ", intersects[0].object);
        intersects[0].object.userData.extraParams.push(":hover"); 
        event.target3d = cell._last_cast_caught;
        event.targetCell = cell;
        event.targetElement = cell._last_cast_caught.userData.domEl
        cell._last_cast_caught.userData.domEl.onmouseover.call(cell._last_cast_caught.userData.domEl,event);
        paintExtraCell(cell);
    }
    else if(intersects.length == 0){
        if(cell._last_cast_caught != null){
            //console.log(intersects ,"Escaped The Ray : " , cell._last_cast_caught);
            fastRemove_arry(cell._last_cast_caught.userData.extraParams, ':hover');
            paintSpecificMuse(cell._last_cast_caught);
        }
        cell._last_cast_caught = null;
    }
}


// Pass the mouse event, camera, and an array of target objects (meshes, groups, etc)
function _raycast(event, camera, targets) {
    // Calculate normalized device coordinates (-1 to +1) for both axes
    const rect = event.target.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Set up raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Compute intersections (returns sorted array: closest first)
    const intersects = raycaster.intersectObjects(targets, true); // true = recursive search (children too)

    // Return the array of intersections, or null if nothing hit
    return intersects;
}
