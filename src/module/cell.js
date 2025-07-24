// cell.js
import * as THREE from 'three';
import { fastRemove_arry, getClassMap }  from './utils.js';
import { paintCell, paintConvict, deep_searchParms, paintSpecificMuse, paintConstantMuse, getCSSRule }    from './artist.js';
import { default_onCellClick_method, default_onCellPointerMove_method } from './NoScope.js';



export default class Cell {

  static allCells = new WeakMap();

  // Retrieve an existing Cell instance from an element
  // #param element - DOM element hosting the cell
  static getCell(element) {
    if(Cell.allCells.has(element)){
      return Cell.allCells.get(element);
    }
    else{
      console.error("No Cell Found With The Element : ", element);
      return null;
    }
  }

  // Create a new Cell controller
  // #param cellElm - root cell element
  // #param renderer - THREE renderer
  // #param scene - THREE scene to control
  // #param camera - initial camera
  // #param _MainAnimMethod - optional animation loop
  constructor(cellElm, renderer, scene, camera = null, _MainAnimMethod = null) {
    this.cellElm       = cellElm;
    this.threeRenderer = renderer;
    this.loadedScene   = scene;
    this.focusedCamera = camera;

    this.constantConvicts = [];
    this.classyConvicts = [];
    this.namedConvicts  = [];

    this._allConvictsByDom = new WeakMap();

    this.updateFunds = [];
    this.updateFunds.push(()=>{
      this.constantConvicts.forEach(cC => {
        paintConstantMuse(cC);
      });
    });

    this._last_cast_caught = null;

    Cell.allCells.set(cellElm, this);
    
    // * Load The Scene
      

    this._ScanCell();

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
              this.ScanElement(node)
              paintSpecificMuse(this.getConvictByDom(node));
              //console.log(this.getConvictByDom(node), " got added");
            }
          });

          mutation.removedNodes.forEach(node => {
            if(node.nodeType === Node.ELEMENT_NODE){
              this.removeConvict(this._allConvictsByDom.get(node));
              //console.log("Sucssefully Served His Sentence , " , node)
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

  


  // Initial scan converting child elements to THREE objects
  // #param none
  _ScanCell(){
    for (let i = 0; i < this.cellElm.children.length; i++) {
      const convictElm = this.cellElm.children[i];
      this.ScanElement(convictElm);
    }
  }


  

  // Convert a DOM element into a THREE object and attach it
  // #param elm - DOM element to convert
  ScanElement(elm){
    const parentObj = this.getConvictByDom(elm.parent) || this.loadedScene;
      const instance = this.ConvertDomToObject(elm);
      if(this._allConvictsByDom.has(elm) || instance === null ){
        return;
      }

      // (IF) Camera Instantation
      if(elm.tagName.includes("CAMERA")) {
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
          instance.frustumSize = 20;
          instance.aspect = aspect;
          instance.left = (-frustumSize * aspect) / 2;
          instance.right = (frustumSize * aspect) / 2;
          instance.top = frustumSize / 2;
          instance.bottom = -frustumSize / 2;
          instance.refreshLook = (fSize)=>{
            instance.frustumSize = fSize;
            instance.left = (-fSize * instance.aspect) / 2;
            instance.right = (fSize * instance.aspect) / 2;
            instance.top = fSize / 2;
            instance.bottom = -fSize / 2;
            instance.updateProjectionMatrix();
          }
        }
        if(elm.hasAttribute("render")) {
          this.focusedCamera = instance;
          this.focusedCamera.updateProjectionMatrix();
          this.threeRenderer.setSize(rect.width, rect.height);
          this.threeRenderer.setPixelRatio(window.devicePixelRatio);
        }
      }

      instance.userData.domEl = elm;
      instance.userData.extraParams = [];
      instance.transition = null;
      
      parentObj.add(instance);

      if (elm.id) {
        instance.userData.domId = elm.id;
        this.namedConvicts.push(instance);
        console.log(getCSSRule(`#${elm.id}:constant`));
        if(getCSSRule(`#${elm.id}:active`)) this.constantConvicts.push(instance);
      }
      const cls = elm.getAttribute('class');
      if (cls) {
        instance.name = cls;
        this.classyConvicts.push(instance); 
        if(!this.constantConvicts.includes(instance) && getCSSRule(`.${cls}:active`)) this.constantConvicts.push(instance);
      }
      this._allConvictsByDom.set(elm, instance);
      for (let i = 0; i < elm.children.length; i++) {
        const element = elm.children[i];
        this.ScanElement(element);
      }
  }

  
  // Instantiate a THREE object from a DOM tag
  // #param elm - DOM element
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

  // Remove a THREE object created from a DOM element
  // #param convict - object to remove
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


  // Retrieve object by its originating DOM element
  // #param element - DOM element used to create the object
  getConvictByDom(element){
    return this._allConvictsByDom.get(element);
  }
  // Retrieve object using DOM id
  // #param id - element id
  getConvictById(id){
     return this._allConvictsByDom.get(document.getElementById(id));
  }
  // Get all objects that share a class name
  // #param className - CSS class
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

  // Clean up observers and event listeners
  // #param none
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

