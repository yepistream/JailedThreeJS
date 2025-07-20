// cell.js
import * as THREE from 'three';
import { fastRemove_arry, getClassMap }  from './utils.js';
import { paintCell, paintConvict, deep_searchParms, paintSpecificMuse }    from './artist.js';
import { default_onCellClick_method, default_onCellPointerMove_method } from './NoScope.js';



export default class Cell {
  constructor(cellElm, renderer, scene, camera = null, _MainAnimMethod = null) {
    this.cellElm       = cellElm;
    this.threeRenderer = renderer;
    this.loadedScene   = scene;
    this.focusedCamera = camera;

    this.classyConvicts = [];
    this.namedConvicts  = [];

    this._allConvictsByDom = new WeakMap();

    this.updateFunds = [];

    this._last_cast_caught = null;
    
    // * Load The Scene
      

    this.ScanCell();

    this._lastHitPosition = null;

    this._boundMouseMove = (event) => {
      default_onCellPointerMove_method(event, this);
    };
    this._boundMouseDown = (event) => {
      default_onCellClick_method(event, this);
    };
    
    cellElm.addEventListener('mousemove', this._boundMouseMove);
    cellElm.addEventListener('mousedown', this._boundMouseDown);

    paintCell(this);

  // inside your class/constructor where `this` is your cell-controller instance
  this._styleObserver = new MutationObserver((mutationList) => {
    // for each style‐change record, call paintCell(this, thatElement)
    mutationList.forEach(mutation => {
      switch(mutation.type)
      {
        case 'childList':

          mutation.addedNodes.forEach(node => {
            if(node.nodeType === Node.ELEMENT_NODE){
              this._ScanElement(node)
              paintSpecificMuse(this.getConvictByDom(node));
              console.log(this.getConvictByDom(node), " got added");
            }
          });

          mutation.removedNodes.forEach(node => {
            if(node.nodeType === Node.ELEMENT_NODE){
              this.removeConvict(this._allConvictsByDom.get(node));
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
        }
        this.focusedCamera.updateProjectionMatrix();
      }
    });
    this._resizeObserver.observe(this.cellElm);
    this._anim();
  }

  ScanCell(){
    for (let i = 0; i < this.cellElm.children.length; i++) {
      const convictElm = this.cellElm.children[i];
      this._ScanElement(convictElm);
    }
  }


  _ScanAllDom(parentObj /* Object/Scene, NOT DOM/ELEMENT */, parentElm = null) {
    // Don't Touch Not Sure What's Happening Really Here .
    const parentElm_t = parentElm ? parentElm : parentObj.userData.domEl;
    // IF THERE IS NO PARENT, USE LOADED SCENE.
    for (let domEl of parentElm_t.children) {
      if(this._allConvictsByDom.has(domEl)){
        continue;
      }     
  
      // Generic instantiation
      const instance = this.ConvertDomToObject(domEl);

      // (IF) Camera Instantation
      if(domEl.tagName.includes("CAMERA") && domEl.hasAttribute("active")) {
        const rect = this.cellElm.getBoundingClientRect();
        const aspect = rect.width / rect.height;
        if(domEl.tagName == "PERSPECTIVECAMERA"){
          instance.fov = 75;
          instance.aspect = aspect
          instance.far = 1000;
          instance.near = 0.1;
        }
        else{
          const frustumSize = 20;
          instance.left = (-frustumSize * aspect) / 2;
          instance.right = (frustumSize * aspect) / 2;
          instance.top = frustumSize / 2;
          instance.bottom = -frustumSize / 2;
        }
        if(domEl.hasAttribute("active")) this.focusedCamera = instance;
        this.focusedCamera.updateProjectionMatrix();
        this.threeRenderer.setSize(rect.width, rect.height);
        this.threeRenderer.setPixelRatio(window.devicePixelRatio);
      }

      instance.userData.domEl = domEl;
      instance.userData.extraParams = [];
      instance.transition = null;
      parentObj.add(instance);

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
      
      this._ScanAllDom(instance);
      ////console.log(instance);
    }
  }

  _ScanElement(elm){
    const parentObj = this.getConvictByDom(elm.parent) || this.loadedScene;
      const instance = this.ConvertDomToObject(elm);
      if(this._allConvictsByDom.has(elm) || instance === null ){
        return;
      }

      // (IF) Camera Instantation
      if(elm.tagName.includes("CAMERA") && elm.hasAttribute("active")) {
        const rect = this.cellElm.getBoundingClientRect();
        const aspect = rect.width / rect.height;
        if(elm.tagName == "PERSPECTIVECAMERA"){
          instance.fov = 75;
          instance.aspect = aspect
          instance.far = 1000;
          instance.near = 0.1;
        }
        else{
          const frustumSize = 20;
          instance.left = (-frustumSize * aspect) / 2;
          instance.right = (frustumSize * aspect) / 2;
          instance.top = frustumSize / 2;
          instance.bottom = -frustumSize / 2;
        }
        if(elm.hasAttribute("active")) this.focusedCamera = instance;
        this.focusedCamera.updateProjectionMatrix();
        this.threeRenderer.setSize(rect.width, rect.height);
        this.threeRenderer.setPixelRatio(window.devicePixelRatio);
      }

      instance.userData.domEl = elm;
      instance.userData.extraParams = [];
      instance.transition = null;
      parentObj.add(instance);

      if (elm.id) {
        instance.userData.domId = elm.id;
        this.namedConvicts.push(instance);
      }
      const cls = elm.getAttribute('class');
      if (cls) {
        instance.name = cls;
        this.classyConvicts.push(instance);
      }
      this._allConvictsByDom.set(elm, instance);
      for (let i = 0; i < elm.children.length; i++) {
        const element = elm.children[i];
        this._ScanElement(element);
      }
  }

  
  ConvertDomToObject(elm){
    const key  = elm.tagName.replace(/-/g, '');
    const Ctor = getClassMap()[key];
    if (!Ctor) {
      if(elm.tagName !== "CANVAS")
      {
        console.warn(`Unknown THREE class for <${elm.tagName.toLowerCase()}>`);
      }
      return null;
    }
    return new Ctor();
  }

  removeConvict(convict){
    
    convict.children.forEach(element => {
      const childinstance = this._allConvictsByDom.get(element);
      if (element.children.length > 0) this.removeConvict(childinstance);
    });

    fastRemove_arry(this.classyConvicts, convict);
    fastRemove_arry(this.namedConvicts, convict);
    if(convict.userData.domEl) (convict.userData.domEl.remove());
    convict.parent.remove(convict);
  }


  getConvictByDom(element){
    return this._allConvictsByDom.get(element); 
  }
  getConvictById(id){
     return this._allConvictsByDom.get(document.getElementById(id));
  }
  getConvictsByClass(className){
    const cls_check_t = [...document.getElementsByClassName(className)];
    let return_value_t = [];
    cls_check_t.forEach(elm => {
      const convict = this.getConvictByDom(elm);
      if(convict){
        return_value_t.push(convict);
      }
    });
    return return_value_t;
  }

  dispose() {
    this._running = false;
    this._resizeObserver.disconnect();
    this._styleObserver.disconnect();
    this.cellElm.removeEventListener('mousemove', this._boundMouseMove);
    this.cellElm.removeEventListener('mousedown', this._boundMouseDown);
    const canvas = this.threeRenderer.domElement;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
}

