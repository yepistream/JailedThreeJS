// cell.js
import * as THREE from '../../node_modules/three/build/three.module.js';
import { fastRemove_arry, getClassMap }  from './utils.js';
import { paintCell, paintConvict, deep_searchParms }    from './artist.js';
import { default_onCellClick_method, default_onCellPointerMove_method } from './NoScope.js';



export default class Cell {
  constructor(cellElm, renderer, scene, camera, _MainAnimMethod = null) {
    this.cellElm       = cellElm;
    this.threeRenderer = renderer;
    this.loadedScene   = scene;
    this.focusedCamera = camera;

    this.classyConvicts = [];
    this.namedConvicts  = [];

    this._allConvictsByDom = new WeakMap();

    this.updateFunds = [];

    this._last_cast_caught = null;

    this._head_count(this.loadedScene, cellElm);

    

    cellElm.addEventListener('mousemove',(event)=>{
      default_onCellPointerMove_method(event,this);
    });

    cellElm.addEventListener('mousedown',(event)=>{
      default_onCellClick_method(event,this);
    });

    paintCell(this);

  // inside your class/constructor where `this` is your cell-controller instance
  this._styleObserver = new MutationObserver((mutationList) => {
    // for each style‐change record, call paintCell(this, thatElement)
    mutationList.forEach(mutation => {
      switch(mutation.type)
      {
        case 'childList':

          console.log("ass");
          mutation.addedNodes.forEach(node => {
            if(node.nodeType === Node.ELEMENT_NODE){
              this._head_count(this._allConvictsByDom.get(node.parentElement));
            }
          });

          mutation.removedNodes.forEach(node => {
            if(node.nodeType === Node.ELEMENT_NODE){
              this.executeConvict(this._allConvictsByDom.get(node));
              console.log("Sucssefully Served His Sentence , " , node)
            }
          });

          break;
          
          case 'attributes':
          
            paintConvict(mutation.target,this);
            
            break;
      }
      
    });
  });

  // TODO : Add Observer For When Elements Get Added Then Run _head_count and add a _execute_ Function/Method For Deleting Unneded Convicts.


  // start observing style changes (including on children, because subtree:true)
  this._styleObserver.observe(this.cellElm, {
    attributes:       true,
    childList: true,
    attributeFilter: ['style'],
    subtree:          true,
  });


    this._running = true;
    this._anim = _MainAnimMethod
      ? _MainAnimMethod.bind(this)
      : () => {
          if (!this._running) return;
          this.updateFunds.forEach(update => {
            update();
          });
          requestAnimationFrame(this._anim);
          this.threeRenderer.render(this.loadedScene, this.focusedCamera);
        };

    this._resizeObserver = new ResizeObserver(entries => {
      for (let e of entries) {
        const { width, height } = e.contentRect;
        const dpr = window.devicePixelRatio || 1;
        this.threeRenderer.setSize(width * dpr, height * dpr);
        if (this.focusedCamera.isPerspectiveCamera) {
          this.focusedCamera.aspect = width / height;
          this.focusedCamera.updateProjectionMatrix();
        }
      }
    });
    this._resizeObserver.observe(this.cellElm);

    this._anim();
  }

  _head_count(owl /* Object/Scene, NOT DOM/ELEMENT */, parentElm = null) {
    /// ! DO A RE-WRITE ! //
    const parentElm_t = parentElm ? parentElm : owl.userData.domEl;
    // IF THERE IS NO PARENT, USE LOADED SCENE.
    for (let domEl of parentElm_t.children) {
      if(this._allConvictsByDom.get(domEl)){
        continue;
      }
      // TODO : Add Child Element True Parsing.
      const key  = domEl.tagName.replace(/-/g, '');
      const Ctor = getClassMap()[key];
      if (!Ctor) {
        if(domEl.tagName !== "CANVAS") console.warn(`Unknown THREE class for <${domEl.tagName.toLowerCase()}>`);
        continue;
      }
  
      // Generic instantiation
      const instance = new Ctor();
      instance.userData.domEl = domEl;
      instance.userData.extraParams = [];
      owl.add(instance);

      if (domEl.id) {
        instance.userData.domId = domEl.id;
        this.namedConvicts.push(instance);
      }
      const cls = domEl.getAttribute('class');
      if (cls) {
        instance.name = cls;
        this.classyConvicts.push(instance);
      }
      this._allConvictsByDom.set(domEl, instance);
      
      this._head_count(instance);
      ////console.log(instance);
    }
  }

  imprison(convict){
    for (let domEl of convict.userData.domEl.children) {
      // TODO : Add Child Element True Parsing.
      const key  = domEl.tagName.replace(/-/g, '');
      const Ctor = getClassMap()[key];
      if (!Ctor) {
        if(domEl.tagName !== "CANVAS") console.warn(`Unknown THREE class for <${domEl.tagName.toLowerCase()}>`);
        continue;
      }

      // Generic instantiation
      const instance = new Ctor();
      instance.userData.domEl = domEl;
      instance.userData.extraParams = [];
      convict.add(instance);

      if (domEl.id) {
        instance.userData.domId = domEl.id;
        this.namedConvicts.push(instance);
      }
      const cls = domEl.getAttribute('class');
      if (cls) {
        instance.name = cls;
        this.classyConvicts.push(instance);
      }
      this._allConvictsByDom.set(domEl, instance);

      
      console.log(instance, "Attached And Added to ", convict);

    }
  }

                // ! Not Optimized, Re-Check Later ! //
  executeConvict(convict){
    
    convict.children.forEach(element => {
      const childinstance = this._allConvictsByDom.get(element);
      if(element.children > 0) executeConvict(childinstance);
    });

    fastRemove_arry(this.classyConvicts, convict);
    fastRemove_arry(this.namedConvicts, convict);
    if(convict.userData.domEl) (convict.userData.domEl.remove());
    convict.parent.remove(convict);
  }
                // ! Not Optimized, Re-Check Later ! //


  getConvictByDom(element){
    return this._allConvictsByDom.get(element); 
  }
  getConvictById(id){
     return this._allConvictsByDom.get(document.getElementById(id));
  }
  getConvictsByClass(className){
    const cls_check_t = [...document.getElementsByClassName(className)];
    let return_value_t = [];
    cls_check_t.forEach(elm,()=>{
      return_value_t.push(elm);
    });
    return return_value_t;
  }

  dispose() {
    this._running = false;
    this._resizeObserver.disconnect();
    const canvas = this.threeRenderer.domElement;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
}

