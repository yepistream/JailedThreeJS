# JailedThreeJS

DOM‑first, CSS‑driven sugar on top of Three.js. Drop a `<cell>` on the page, nest a few custom tags like `<mesh>` or `<perspectivecamera>`, style them with CSS custom properties, and you’ve got a live WebGL scene.

> If you already speak HTML/CSS/JS, you shouldn’t have to learn a whole new ritual to get pixels moving. This library gives you a thin, readable layer over Three.js that embraces the platform: HTML for structure, CSS for state/animation, JS for logic.

---

## Table of contents

* [Features](#features)
* [Install](#install)
* [Quick start](#quick-start)
* [Core concepts](#core-concepts)

  * [`<cell>`](#cell--renderer--scene)[ → renderer + scene](#cell--renderer--scene)
  * [DOM→Three mapping](#domthree-mapping)
  * [Styling with CSS custom properties](#styling-with-css-custom-properties)
  * [Assets via ](#assets-via-rules)[`@rules`](#assets-via-rules)
  * [Events and pseudo‑classes](#events-and-pseudo-classes)
  * [Transitions & keyframes](#transitions--keyframes)
* [Scripting API](#scripting-api)

  * [`JThree`](#jthree)
  * [`Cell`](#cell)
* [Cheat sheet](#cheat-sheet)
* [FAQ / gotchas](#faq--gotchas)
* [License](#license)

---

## Features

* **Single tag to start**: a `<cell>` becomes a renderer + scene. Cameras are optional (a sensible default is created if you don’t provide one).
* **HTML for scene graph**: use tags like `<mesh>`, `<group>`, `<perspectivecamera>`, `<orthographiccamera>`, `<audio>` …the ones that correspond to `THREE.Object3D` types.
* **CSS as your scene “stylesheet”**: set `--position-x`, `--rotation-y`, `--scale`, `--geometry`, `--material-color`, etc.
* **Events out of the box**: `onclick`, `onmouseover`, `ondblclick`, `onmousedown`, `onmouseup`, `oncontextmenu` work on 3D objects; `:hover`, `:focus`, `:active` pseudo‑classes also style them.
* **Asset pipeline**: reference built‑ins (`@cube`, `@sphere`, `@plane`, `@torus`) or declare your own via CSS‐like `@rules` and load GLTF/GLB/FBX/images/audio/material JSON.
* **Keyframes, but for 3D**: drive object properties from CSS `@keyframes` using the same custom property vocabulary.
* **Zero‑config resize & DPR**: canvas sizes to its host; camera aspect updates automatically.

> This is deliberately thin—the point is not to hide Three.js, but to smooth the entry and keep your scenes declarative. When you need to drop to raw Three.js, you can.

---

## Install

You can import the modules directly (recommended while the package is evolving):

```html
<script type="module">
  import { JThree } from './index.js';
  // Optionally access Cell, utils, etc.
</script>
```

Or bundle with your tool of choice (Vite, Webpack, etc.) by pointing to this folder.

> Skeptical note: if you already have an app wiring up Three.js, start by migrating a single widget into a `<cell>`—don’t rewrite everything.

---

## Quick start

Create a cell, a camera, and a mesh. Style the mesh with CSS. Done.

```html
<div style="max-width: 560px">
  <cell id="demo" style="display:block; width:560px; height:320px; background:#111">
    <perspectivecamera render></perspectivecamera>
    <mesh id="box" class="box"></mesh>
  </cell>
</div>

<style>
  /* Base style for our mesh */
  .box {
    /* place it in front of the camera */
    --position-z: -5;
    /* spin setup */
    --rotation-y: 0;
    /* built‑in geometry + a visible material color */
    --geometry: @cube;
    --material-color: (0.9, 0.2, 0.2);
  }

  /* Pseudo‑classes work like you expect */
  .box:hover   { --material-color: (0.2, 0.9, 0.9); }
  .box:active  { --scale: (1.2, 1.2, 1.2); }
  .box:focus   { --rotation-y: 3.14159; }
</style>

<script type="module">
  import { JThree, Cell } from './index.js';

  // The library auto‑initializes on import and converts all <cell> tags.
  // If you inject cells later: JThree.init_convert();

  // Grab the Cell controller and add a per‑frame update (spin).
  const cell = Cell.getCell(document.getElementById('demo'));
  const box  = cell.getConvictById('box');
  cell.addUpdateFunction(function () {
    box.rotation.y += 0.01;
  });

  // Optional: tell the painter to interpolate property changes
  box.transition = { duration: 400, timing: { fun: 'ease-in-out' } };
</script>
```

That’s a complete scene without touching `THREE.WebGLRenderer` or manual raycasting.

---

## Core concepts

### `<cell>` → renderer + scene

Each `<cell>` becomes its own renderer + scene. A default `PerspectiveCamera` is created if you don’t declare one. The library watches for size/style changes and keeps the canvas and camera aspect in sync.

### DOM→Three mapping

Every child tag under a `<cell>` attempts to instantiate its uppercase, hyphen‑stripped name from the `THREE` namespace *if it’s an \*\*`Object3D`*. Examples:

* `<mesh>` → `new THREE.Mesh()`
* `<group>` → `new THREE.Group()`
* `<perspectivecamera>` → `new THREE.PerspectiveCamera()`
* `<orthographiccamera>` → `new THREE.OrthographicCamera()`

Unknown tags are ignored with a console warning. Geometries and materials are *assigned via CSS* (see below).

### Styling with CSS custom properties

Use CSS custom properties (vars) to set object properties. The name maps to a path on the object, dots become dashes.

| CSS var                          | Sets                              | Notes                            |
| -------------------------------- | --------------------------------- | -------------------------------- |
| `--position-x: 1;`               | `object.position.x = 1`           | numbers parsed as floats         |
| `--position: (0,1,-5);`          | `object.position.set(0,1,-5)`     | tuple uses parentheses           |
| `--rotation-y: 1.57;`            | `object.rotation.y`               | radians                          |
| `--scale: (2,2,2);`              | `object.scale.set(2,2,2)`         |                                  |
| `--geometry: @cube;`             | `object.geometry = <BoxGeometry>` | `@name` pulls from the asset map |
| `--material-color: (0.2,0.5,1);` | `object.material.color.set(...)`  | creates color if present         |
| `--visible: 0;`                  | `object.visible = 0`              | `0/1` falsy/truthy               |

**Reference another object’s property**: `--position: #otherId-position;` (copy `position` from `#otherId`).

> Pro‑tip: Because updates are idempotent, toggling classes or updating inline `style` on the DOM element is enough to restyle the 3D object.

### Assets via `@rules`

You can reference built‑ins (`@cube`, `@sphere`, `@plane`, `@torus`) or declare your own with CSS‑like blocks placed in any stylesheet:

```css
@bunny { url: "/models/bunny.glb"; }
@rock  { url: "/textures/rock.png"; }
@music { url: "/audio/theme.ogg"; }
@metal { url: "/materials/metal.json"; }
```

Then bind them via CSS:

```css
.mesh { --geometry: @bunny; }
.speaker { --audio-buffer: @music; }
```

Supported: `glb/gltf`, `fbx`, images (`png/jpg/jpeg/gif/webp`), audio (`mp3/wav/ogg/flac/aac`), `mtl`, and `json` (material JSON or generic JSON fallback). Unknown extensions resolve to `null` with a warning.

### Events and pseudo‑classes

Attach DOM event handlers directly on the element (set via JS or HTML). When present, the object is made *pickable*. Default handlers do one raycast per move and synthesize event payloads:

* `onclick`, `ondblclick`, `onmousedown`, `onmouseup`, `oncontextmenu`
* `onmouseenter`, `onmouseleave`, `onmouseover` (fires on every move over the target)

You can also style with `:hover`, `:focus`, `:active` pseudo‑classes (e.g., `.box:hover { --scale: (1.1,1.1,1.1) }`).

**Example:**

```js
const boxEl = document.getElementById('box');
boxEl.onclick = (e) => {
  console.log('3D click at', e.pointerPosition);
};
```

> Sanity check: only objects on the special “pickable” layer are tested for hits—this is done for you when you attach handlers or define pseudo‑class rules.

### Transitions & keyframes

* **Transitions**: set `object.transition = { duration: 300, timing: { fun: 'ease' } }` and subsequent CSS changes to that object’s custom properties will interpolate.
* **Keyframes**: define CSS `@keyframes` using the same custom properties (yes, you write `--rotation-y` inside keyframes), then attach an animation descriptor to the object:

```css
@keyframes wobble {
  0%   { --rotation-z: 0; }
  50%  { --rotation-z: 0.8; }
  100% { --rotation-z: 0; }
}
```

```js
box.animation = {
  name: 'wobble',
  duration: 1200,
  timing: { fun: 'ease-in-out' },
  iteration: { count: 'infinite' }
};
```

Animations run segment‑by‑segment using the easing you specify. You can also lerp arbitrary numbers/tuples in JS via the exported `animateLerp(from, to, ms, onUpdate, onComplete?, timing='linear')` helper.

---

## Scripting API

### `JThree`

* `JThree.init_convert()` → scan the document again for `<cell>`s (useful if you inject them dynamically).
* `JThree._convert_init_()` → legacy alias.

On module import, the library auto‑initializes and converts all existing `<cell>` nodes.

### `Cell`

Every `<cell>` has a controller. Grab it via `Cell.getCell(element)`.

**Properties:**

* `.threeRenderer` — the `THREE.WebGLRenderer` for this cell
* `.loadedScene` — the `THREE.Scene`
* `.focusedCamera` — the active camera

**Scene graph lookups:**

* `getConvictByDom(el)` → `Object3D`
* `getConvictById('id')` → `Object3D`
* `getConvictsByClass('className')` → `Object3D[]`

**Updates & lifecycle:**

* `addUpdateFunction(fn)` → run `fn` every frame (bound to the cell)
* `removeUpdateFunction(fn)`
* `dispose()` → stop rendering, remove listeners, and remove the canvas

---

## Cheat sheet

* Put a `<perspectivecamera render>` inside a `<cell>` to make it the active camera; otherwise a default perspective camera is created.
* Canvas is absolutely positioned over the cell, and the cell’s children are hidden (the 3D is the “view”).
* Only tags that map to `THREE.Object3D` are instantiated as objects; use CSS to assign geometry/materials/textures.
* Pseudo‑classes `:hover`, `:focus`, `:active` can reactively restyle 3D objects just like regular DOM.
* Built‑in assets: `@cube`, `@sphere`, `@plane`, `@torus`.

---

## FAQ / gotchas

**Why don’t **`** or **`** tags work?**  Because geometries and materials aren’t `Object3D`s. Use CSS vars instead: `--geometry: @cube; --material-color: (1,0,0);`.

**Where do I set easing for transitions?**  On the object: `object.transition = { duration: 200, timing: { fun: 'ease-in-out' } }`.

**Keyframes do nothing—what did I miss?**  Make sure your `@keyframes` use custom properties (e.g., `--position-x`) and the object has `object.animation = { name, duration, ... }`.

**How do I make something interactive?**  Add an event handler to the DOM element (`element.onclick = fn`) or define `:hover/:focus/:active` rules. That also opt‑in the object for picking.

**What about performance?**  There’s a single shared `Raycaster` and the pickable layer is opt‑in. Keep your eventable set lean.

**Multiple cells on a page?**  Totally fine. Each `<cell>` gets its own renderer/scene, and you can fetch each controller with `Cell.getCell(cellEl)`.

---

## License

MIT (or your preferred permissive license).
