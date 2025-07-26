# JailedThreeJS

`JailedThreeJS` is a tiny framework on top of [Three.js](https://threejs.org/) that lets you
author declarative 3D scenes using plain HTML markup and CSS.  It converts
custom elements like `<cell>`, `<mesh>`, `<perspectivecamera>` and others into
fully fledged Three.js scenes, allowing designers and front‑end developers to
describe 3D interfaces without writing imperative JavaScript.  At runtime the
framework watches your DOM tree, builds Three.js objects, synchronises
attributes with CSS custom properties and dispatches high level events such as
click, hover, down, up, context menu and double‑click.

This document is divided into two parts:

1. **Using the framework** – a quick start guide for front‑end developers and
   designers who only need to write markup and CSS inside a page.  It covers
   installation, the available HTML elements, how to attach materials and
   geometries, how to animate via CSS and how to handle events.  No knowledge
   of the underlying implementation is required.
2. **Extending the framework** – deeper technical notes aimed at developers
   integrating `JailedThreeJS` into a larger code base or modifying its
   behaviour.  This section explains the module structure, public APIs,
   internal data structures and how you can add your own update loops,
   animations or Three.js classes.

---

## 1 Using the framework

### 1.1 Installation

Install the package from npm using your favourite package manager:

```bash
npm install jailedthreejs three
```

The only peer dependency is `three` itself.  The framework is published as an
ES module and exports everything under `src/module/index.js`.  If you are
using a bundler (Vite, Webpack, Rollup, etc.) you can import the `JThree`
object like this:

```js
import { JThree } from 'jailedthreejs';

// automatically convert all <cell> elements into Three.js scenes
JThree.init_convert();
```

When the module is imported it also calls `JThree.init_convert()` once on
load, so for most pages you do not need to call it explicitly.  The global
`window.JThree` is assigned for convenience.

### 1.2 Authoring cells

A *cell* is the root container for a 3D scene.  Define a cell using a custom
`<cell>` element in your HTML.  Any child elements of a cell are converted
into the corresponding Three.js objects.  A minimal example looks like this:

```html
<cell style="width: 400px; height: 300px; border: 1px solid gray;">
  <perspectivecamera id="mainCam" render></perspectivecamera>
  <scene>
    <mesh id="box" class="blue" geometry="@cube"></mesh>
    <mesh id="sphere" class="red" geometry="@sphere" position="(2,0,0)"></mesh>
  </scene>
</cell>
```

* The `render` attribute on `<perspectivecamera>` designates that camera as
  the current renderer target.  Without a camera, a default one is created
  with a 75° FOV.
* Geometry attributes like `geometry="@cube"` refer to built‑in assets
  exposed by the framework.  See the **Assets** table below for built‑in
  values.
* You can set any property of a Three.js object via CSS custom properties.  For
  example, in your stylesheet you can write:

  ```css
  #box {
    --position-y: 1;             /* move the box up */
    --rotation-y: 45;            /* rotate in degrees */
    --scale: (1.5, 1.5, 1.5);    /* uniform scaling */
    transition: all 400ms ease;  /* smooth interpolation on change */
  }
  .blue { --material-color: '#3366ff'; }
  .red  { --material-color: '#ff3366'; }
  ```

  Each `--property` corresponds to a property path on the underlying Three.js
  object.  The framework parses numbers, vectors and strings.  Prefix a value
  with `@` to reference a built‑in asset or `#otherObject-property` to copy
  a property from another object in the same cell.

#### Built‑in assets

| keyword | description          |
|--------:|----------------------|
| `@cube` | Box geometry         |
| `@sphere` | Sphere geometry     |
| `@plane` | Plane geometry       |
| `@torus` | Torus geometry       |

You can register your own assets using the `getAsset` function described in
the developer section.

### 1.3 Handling events

`JailedThreeJS` dispatches synthetic events that mirror DOM events but
include extra data about the 3D scene.  You can attach handlers directly on
the declarative elements using the standard HTML event attributes such as
`onclick`, `onmouseover`, `ondblclick`, `onmousedown`, `onmouseup` and
`oncontextmenu`.  When invoked, your callback receives a synthetic event
object with the following properties:

| property        | meaning                                                                           |
|----------------:|------------------------------------------------------------------------------------|
| `type`          | the high‑level event type (e.g. `cellclick`, `cellhover`, `celldown`)              |
| `originalEvt`   | the underlying browser `PointerEvent` or `MouseEvent`                              |
| `target3d`      | the Three.js `Object3D` that was intersected by the pointer                       |
| `targetCell`    | the `Cell` instance owning the event                                              |
| `targetElement` | the original DOM element that created the 3D object                               |
| `pointerPosition` | a `THREE.Vector3` representing the hit point within the scene (for hover/click) |

Example:

```html
<mesh geometry="@cube" onclick="handleClick(event)" onmouseover="handleHover(event)"></mesh>

<script type="module">
import { JThree } from 'jailedthreejs';

function handleClick(evt) {
  console.log('Clicked 3D object:', evt.target3d);
  console.log('Pointer in world coords:', evt.pointerPosition);
}

function handleHover(evt) {
  evt.targetElement.classList.add('highlight');
}

// optional: explicitly initialise cells
JThree.init_convert();
</script>
```

The framework also manages pseudo‑classes for hover, focus and active state.
When you hover over an object the flag `':hover'` is appended to its
`extraParams` array and you can target `.myObject:hover` or `#id:hover` in
your CSS.  Similarly a click adds the `':focus'` flag and pressing the
mouse button adds `':active'`.  These flags are removed when the pointer
leaves the object or the button is released.

### 1.4 Animating objects

Objects can be animated using CSS transitions or the more advanced keyframe
system.  Declaring a `transition` on a rule will cause property changes to
be interpolated by the `animateLerp` function.  To use keyframes, define a
standard CSS `@keyframes` block and reference it on the object via the
`animation` property.  The syntax and behaviour match the browser’s
implementation, with support for custom easing via cubic‑bezier functions.

```css
@keyframes spin {
  0%   { --rotation-y: 0deg; }
  100% { --rotation-y: 360deg; }
}

#box {
  animation: spin 3000ms infinite linear;
}
```

Behind the scenes the framework gathers all `@keyframes` rules into a map
and applies them to your objects via the `KeyFrameAnimationLerp` helper.

### 1.5 Adding custom update functions

Each cell runs an internal animation loop that repeatedly calls every
function stored in its `updateFunds` array and then renders the scene.  You
can register your own per‑frame callback using the `addUpdateFunction`
method on a `Cell` instance.  The callback will be invoked once per frame
with `this` bound to the cell.

```js
const cell = JThree.create_THREEJSRENDERER(myCellElement);

cell.addUpdateFunction(function () {
  // move camera slowly upwards
  this.focusedCamera.position.y += 0.01;
});
```

To stop your function from being called, either remove it manually from
`updateFunds` or implement your own logic inside the callback.  When a cell
is disposed (for example when its element is removed from the DOM) all
listeners and observers are cleaned up automatically.

---

## 2 Extending the framework

This section describes the internal modules and exposed APIs.  Use these
details if you intend to modify the framework itself or integrate it into a
larger application.  The code base is organised under `src/module` and
exports everything via `index.js`.

### 2.1 Module overview

| file                     | responsibility                                                                    |
|-------------------------:|------------------------------------------------------------------------------------|
| `cell.js`               | defines the `Cell` class.  It manages a DOM subtree, converts elements to
                          | `THREE.Object3D` instances, tracks named and classed objects, runs the
                          | update loop and handles resize and mutation observers.  It exposes helper
                          | methods like `getConvictByDom`, `getConvictById`, `getConvictsByClass`,
                          | `addUpdateFunction` and `dispose` for cleanup.                                      |
| `main.js`               | defines the `JTHREE` facade.  It scans the document for `<cell>` elements,
                          | constructs a renderer and scene for each and stores the resulting `Cell`
                          | instances.  It also creates a WebGL canvas overlay (`createWebGLOverlay`) and
                          | falls back to a default camera when none is supplied.                                |
| `artist.js`             | contains functions for mapping CSS rules to Three.js object properties.
                          | Important helpers include `getCSSRule`, `deep_searchParms`, `CSSValueTo3JSValue`,
                          | `exchange_rule`, `paintCell`, `paintSpecificMuse` and `paintConstantMuse`.  These
                          | handle CSS custom properties, asset lookups via `@foo`, references via `#id`,
                          | transitions and keyframe animations.                                                  |
| `Train.js`              | implements interpolation and animation helpers.  `animateLerp` animates numbers
                          | or arrays between two values with an easing function.  `KeyFrameAnimationLerp`
                          | executes CSS keyframe animations on Three.js objects, processing each segment
                          | sequentially.  Helper functions like `cubicBezier` and `lerpNumber` live here.       |
| `NoScope.js`            | centralises event handling.  It holds a shared `THREE.Raycaster`, tracks
                          | pointer state and dispatches high level events (`cellhover`, `cellclick`,
                          | `celldown`, `cellup`, `celldblclick`, `cellcontextmenu`).  It also manages
                          | pseudo‑class flags by adding or removing `:hover`, `:focus` and `:active` from
                          | each object’s `extraParams` array.                                                    |
| `utils.js`              | provides generic helpers.  `buildClassMap` lazily enumerates Three.js classes
                          | and caches them.  `getAsset` loads or returns built‑in geometries and external
                          | assets (GLTF, FBX).  `gatherKeyFrame_MAP` collects all `@keyframes` rules from
                          | your stylesheets.  `fastRemove_arry` removes items from arrays without preserving
                          | order.                                                                                |

### 2.2 Working with cells programmatically

Although most interaction happens via declarative markup, you can also work
with cells in code.  The `JThree` module exposes `create_THREEJSRENDERER` to
instantiate a cell manually.  It returns a `Cell` instance which offers the
following methods:

* `addUpdateFunction(fn)` – register a callback to be called each frame.  The
  callback’s `this` is bound to the cell.
* `dispose()` – clean up all observers, event listeners and Three.js
  resources attached to the cell.
* `getConvictByDom(element)` – return the Three.js object created from a
  specific DOM element.
* `getConvictById(id)` – shortcut for `getConvictByDom(document.getElementById(id))`.
* `getConvictsByClass(className)` – return all objects created from
  elements with the given class.

Cells also expose several public properties, including `focusedCamera` (the
active camera), `loadedScene` (the Three.js scene) and `updateFunds` (the
array of per‑frame callbacks).

### 2.3 Extending class and asset mappings

The framework automatically builds a map of available Three.js classes by
enumerating `THREE`’s exports.  When a DOM tag is encountered during a cell
scan the tag name is upper‑cased and used as a key into this map.  To add
support for a custom class you can assign it to `THREE.MyClassName` before
initialising `JThree`.  For example:

```js
import { MyCustomObject } from './MyCustomObject.js';
import * as THREE from 'three';

THREE.MYCUSTOMOBJECT = MyCustomObject;
// Now <mycustomobject> becomes new MyCustomObject()
JThree.init_convert();
```

Similarly, asset lookups are performed by the `getAsset` function.  On first
use it preloads a few geometries (cube, sphere, plane, torus) and then scans
all loaded stylesheets for custom asset declarations.  A custom asset is
declared via an at‑rule of the form `@name { url: (...); name: (...); }` where
`url` points at a file and `name` optionally overrides the registration key.
Supported file types include GLTF/GLB, FBX, PNG/JPG/GIF/WEBP (loaded as
textures), MTL (material libraries), JSON material descriptions and common
audio formats (mp3, wav, ogg, flac, aac).  When the module sees such a rule
it loads the referenced resource and stores it in the internal `assetMap`.
Once loaded you can refer to it in your CSS by prefixing the key with `@`:

```css
@wallTex {
  url: ('assets/textures/wall.jpg');
  /* name: 'wallTex' is implicit from the rule name */
}

.wall {
  --material-map: @wallTex;
}
```

You can also programmatically register assets by calling `getAsset(name, url)`
to load a resource on demand.  See `utils.js` for implementation details.

### 2.4 Understanding event dispatch and flags

The `NoScope.js` module performs a raycast on every pointer move and caches
the last intersected object.  When a click, double‑click, mouse down, mouse
up or context menu event occurs the corresponding handler reads that cached
object.  Flags are stored on each object in the `extraParams` array and
follow a simple convention:

* `':hover'` – added when the pointer is over the object; removed when
  leaving.
* `':focus'` – added on click; persists until another object is clicked.
* `':active'` – added on mouse down; removed on mouse up.

These flags allow you to write CSS rules such as `.button:hover` or
`#box:active` to animate objects while preserving separation of concerns.

### 2.5 Animation internals

Transitions are handled by the `animateLerp` function in `Train.js`, which
interpolates between scalar or vector values over a specified duration using
any CSS timing function.  Keyframe animations are powered by
`KeyFrameAnimationLerp`, which extracts keyframe rules from a `@keyframes`
block and animates each segment in sequence.  It supports looping via the
`iteration.count` property on the animation object.

Should you need more control over interpolation you can extend these
functions or write your own update functions and register them on the cell.

### 2.6 Contributing

Bug fixes and feature requests are welcome.  If you encounter unexpected
behaviour please inspect the implementation in `src/module/` and send a pull
request with a clear description of the change.  When adding new functions
please annotate parameters using JSDoc’s `@param` tag and write comments to
explain non‑obvious logic.  The repository includes mutation observers and
Raycaster logic that are subtle; comments are strongly encouraged around
these areas.
