# JailedThreeJS

CSS-first scaffolding for Three.js. Drop a `<cell>` on the page, describe your scene in HTML, tweak it with CSS custom properties, sprinkle behaviour with plain JS. The engine does the wiring (renderer, cameras, raycasters, resize handling) so you can stay inside web platform muscle memory.

---

## TL;DR

- **Structure**: Every tag under a `<cell>` becomes its matching `THREE.Object3D` (`<mesh>`, `<group>`, `<perspectivecamera>`, `<axeshelper>`, …).
- **Style**: Custom properties map to object state: `--position`, `--rotation`, `--scale`, `--geometry`, `--material-color`, `--transition`, etc.
- **Interact**: Native DOM events (`onclick`, `onmouseover`, `ondblclick`, `oncontextmenu`, …) and pseudo-classes (`:hover`, `:focus`, `:active`) work on meshes.
- **Animate**: Declare transitions or CSS `@keyframes` and the painter lerps the underlying Three.js values.
- **Assets**: Reference built-ins (`@cube`, `@plane`, `@sphere`, `@torus`) or define custom `@asset` rules that fetch GLTF/GLB/FBX/textures/audio.
- **API access**: You can always grab the underlying `Cell`/`THREE.Object3D` to run imperative code when needed.

> Philosophy: embrace HTML for structure, CSS for look, JS for intent. No DSLs, no scene JSON. When you want raw Three.js, it’s still there.

---

## Installation

The repo ships as ES modules. Point your bundler (or `<script type="module">`) to the `src/module` folder.

```html
<script type="module">
  import { JThree } from './module/index.js';
  // All <cell> elements are converted on import.
</script>
```

If you add cells later (e.g. via a framework), call `JThree.init_convert()` to rescan the DOM.

---

## Quick start

```html
<cell id="demo" style="display:block;width:560px;height:320px;background:#05070f">
  <perspectivecamera render></perspectivecamera>
  <mesh id="box" class="box" onclick="spin(this)"></mesh>
</cell>

<style>
  .box {
    --geometry: @cube;
    --position: (0,0,-5);
    --scale: (1,1,1);
    --material-color: (0.8,0.2,0.2);
    --transition: 400ms ease-in-out;
  }
  .box:hover  { --material-color: (0.2,0.8,0.9); }
  .box:active { --scale: (1.2,1.2,1.2); }
</style>

<script type="module">
  import { Cell } from './module/index.js';
  const cell = Cell.getCell(document.getElementById('demo'));
  const box  = cell.getConvictById('box');

  cell.addUpdateFunction(function () { box.rotation.y += 0.01; });
  window.spin = (mesh) => mesh.style.setProperty('--rotation-y', box.rotation.y + Math.PI);
</script>
```

That is the entire scene: no manual `WebGLRenderer`, no raycaster setup, no resize bookkeeping.

---

## Styling cheat sheet

| Purpose            | Custom property examples                                                       |
|--------------------|--------------------------------------------------------------------------------|
| Transform          | `--position: (x,y,z)` · `--rotation: (radX,radY,radZ)` · `--scale: (sx,sy,sz)` |
| Geometry/material  | `--geometry: @cube` · `--material-color: (r,g,b)` · `--material-roughness: 0.5` |
| Cameras            | `--fov` · `--near` · `--far` · `--aspect` (auto-updated unless overridden)     |
| Lights             | `--intensity` · `--distance` · `--color` · `--decay`                          |
| Transitions        | `--transition: 300ms ease` (or set `object.transition = { duration, timing }`) |
| Animations         | Use CSS `@keyframes` where frames set the same custom props.                   |
| Assets             | `--geometry: @MySpaceship` (load via `@MySpaceship { url: './ship.glb'; }`)   |

> Any custom property prefixed with `--` is forwarded to the object through a best-effort parser (numbers/arrays/assets/refs). Unknown props are ignored with a console warning.

---

## Runtime API

| API                 | Description                                                                                                       |
|---------------------|-------------------------------------------------------------------------------------------------------------------|
| `JThree.init_convert()` | Rescan the DOM for `<cell>` tags and boot them. Automatically run once on import.                            |
| `Cell.getCell(element)` | Retrieve the `Cell` controller attached to a `<cell>` DOM node.                                                |
| `cell.addUpdateFunction(fn)` | Register a per-frame callback (runs inside the render loop).                                            |
| `cell.getConvictById(id)` / `getConvictByDom(dom)` | Fetch the underlying `THREE.Object3D` created for a DOM element.               |
| `cell.getConvictsByClass(cls)` | Batch lookup by class name (mirrors `document.getElementsByClassName`).                                 |
| `cell.removeConvict(object)` | Remove an object and clean up book-keeping.                                                              |
| `object.transition = { duration, timing }` | Enable JS-driven interpolation for subsequent style changes.                           |
| `object.animation = { name, duration, iteration }` | Apply a CSS `@keyframes` animation to an object’s custom props.                 |

You always have access to the raw `THREE.Object3D` instance (`convict`). Use it for low-level operations, loaders, shaders, etc.

---

## Events & pseudo-classes

- Add DOM event attributes (`onclick`, `onmouseover`, `ondblclick`, `onmousedown`, `onmouseup`, `oncontextmenu`). They receive a synthetic event with `{ target3d, targetCell, pointerPosition, originalEvt }`.
- Use CSS pseudo-classes (`:hover`, `:focus`, `:active`). The runtime keeps class flags in sync with pointer/click states and repaints affected objects.
- `object.layers` is managed automatically: pickable meshes are moved to layer 3 only when they need interaction, saving raycast cost.

---

## Assets & `@rules`

Declare assets in CSS alongside the rest of your styles:

```css
@MySpaceship {
  url: "./models/ship.glb";
}

.hero {
  --geometry: @MySpaceship;
  --position: (0,0,-10);
}
```

First time the painter sees `@MySpaceship`, it loads the GLB (or FBX, texture, audio, material JSON), caches it, and applies it wherever referenced. Built-ins `@cube`, `@sphere`, `@plane`, and `@torus` ship for quick sketches.

---


## Tips & gotchas

- **Inline styles vs stylesheet rules**: inline `style=""` attributes on `<mesh>` nodes work the same as CSS rules. The painter merges them in the order: base class → id → pseudo-class → inline.
- **Transitions**: if you define `object.transition`, only numeric/array props are animated. Non-numeric values (like `@asset` references) swap instantly.
- **Async assets**: `--geometry: @MyGLTF` assigns a promise until the loader resolves. The painter applies final values when the promise settles; don’t mutate those props synchronously.
- **Cleanup**: If you inject scripts that schedule loops/intervals, register a cleanup handler via `registerSceneCleanup(fn)` so the editor or export can dispose them reliably.

---

## License

MIT © 2025. Use it in games, demos, dashboards, art toys, education—wherever CSS-driven 3D makes sense. Contributions welcome! 
