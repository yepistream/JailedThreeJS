[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/yepistream/JailedThreeJS)


# JailedThreeJS

A CSS-first layer on top of Three.js.

Define a scene with HTML inside a `<cell>`, style objects with CSS custom properties, and attach behavior with plain JS. JailedThreeJS creates the renderer, scene, cameras, resize handling, and object mapping for you.

## What It Does

- Maps DOM tags to `THREE.Object3D` instances (`<mesh>`, `<group>`, `<perspectivecamera>`, etc.)
- Applies CSS custom properties to Three.js objects (`--position`, `--rotation`, `--scale`, `--material-*`, ...)
- Supports DOM-style interaction (`onclick`, `onmouseover`, `ondblclick`, `oncontextmenu`, ...)
- Supports CSS pseudo-classes on 3D objects (`:hover`, `:focus`, `:active`)
- Supports transitions and CSS `@keyframes`-driven animation of custom props
- Supports basic asset references (`@cube`, `@sphere`, `@plane`, `@torus`) plus CSS-defined asset rules

## Identity Mapping (Important)

Runtime object identity now maps like this:

- `DOM id` -> `Object3D.name`
- `DOM class list` -> `Object3D.classList` (compat alias) and `object.userData.classList`

Examples:

- `<mesh id="box" class="hero selected"></mesh>`
- `convict.name === "box"`
- `convict.classList` is `['hero', 'selected']`

Notes:

- `convict.classList` is a JailedThreeJS compatibility alias (not native Three.js API).
- `convict.userData.domId` and `convict.userData.classList` are also maintained.

## Install

Install with `three`:

```bash
npm install jailedthreejs three
```

Then import from the package:

```js
import { JThree, Cell } from 'jailedthreejs';
```

Package entrypoint notes:

- npm publishes the library build from `dist/lib/`

## Minimal Example

```html
<cell id="demo" style="display:block;width:640px;height:360px">
  <perspectivecamera id="cam" render></perspectivecamera>
  <directionallight id="sun"></directionallight>
  <mesh id="box" class="scene-object hero" onclick="spinBox()"></mesh>
</cell>

<style>
  #cam {
    --position: (0, 1.5, 5);
  }

  #sun {
    --position: (3, 6, 4);
    --intensity: 2;
  }

  .scene-object {
    --geometry: @cube;
    --position: (0, 0, 0);
    --material-color: (0.3, 0.7, 1.0);
    --transition: 200ms ease-out;
  }

  .scene-object:hover {
    --scale: (1.08, 1.08, 1.08);
  }

  .scene-object:active {
    --scale: (0.96, 0.96, 0.96);
  }
</style>

<script type="module">
  import './module/main.js';
  import Cell from './module/cell.js';

  const cellEl = document.getElementById('demo');
  const cell = Cell.getCell(cellEl);
  const box = cell.getConvictById('box');

  window.spinBox = () => {
    box.rotation.y += Math.PI * 0.25;
  };

  console.log(box.name);      // "box"
  console.log(box.classList); // ["scene-object", "hero"]
</script>
```

## How It Works

### 1. DOM -> Three.js conversion

Every supported child element inside a `<cell>` is converted into a matching Three.js object.

- Parent/child DOM nesting becomes scene graph nesting.
- Cameras can be declared in HTML.
- The first camera (or one with `render`) becomes the active render camera.

### 2. CSS painter

Custom properties (`--...`) are parsed and applied to object properties.

Examples:

- `--position: (x,y,z)`
- `--rotation: (rx,ry,rz)`
- `--scale: (sx,sy,sz)`
- `--material-color: (r,g,b)`
- `--geometry: @cube`
- `--transition: 250ms ease`
- `--animation: bob 1.5s infinite ease-in-out`

### 3. Interaction + pseudo-classes

JailedThreeJS raycasts the scene and updates pseudo-state flags so CSS selectors like these work:

- `.button:hover`
- `.button:active`
- `#hero:focus`

Supported DOM event attributes on scene elements include:

- `onclick`
- `onmouseover`
- `onmousedown`
- `onmouseup`
- `ondblclick`
- `oncontextmenu`

Handler functions receive a synthetic event object containing references to:

- `target3d`
- `targetCell`
- `targetElement`
- `pointerPosition`
- `originalEvt`

## Runtime API

### `JThree`

Imported from `src/module/main.js` (or re-exported by `src/module/index.js`).

- `JThree.init_convert()`
  - Scans the document for `<cell>` elements and converts any not already initialized.

### `Cell`

- `Cell.getCell(cellElement)`
  - Returns the `Cell` instance attached to a `<cell>` DOM element.

Instance methods:

- `cell.getConvictById(id)`
  - Returns the Three.js object for a DOM id inside that cell.
- `cell.getConvictByDom(domElement)`
  - Returns the mapped Three.js object for a DOM element.
- `cell.getConvictsByClass(className)`
  - Returns all mapped objects in that cell with the class.
- `cell.addUpdateFunction(fn)`
  - Registers a per-frame callback.
- `cell.removeUpdateFunction(fn)`
  - Removes a previously registered callback.
- `cell.removeConvict(object)`
  - Removes an object (and descendants) from the scene and mapping.
- `cell.dispose()`
  - Cleans up observers, handlers, and canvas.

## CSS Value Parsing Rules

JailedThreeJS parses custom property values with a best-effort mapper:

- `"(1,2,3)"` -> `[1,2,3]`
- `"1.25"` -> `1.25`
- `"@cube"` -> built-in asset/object from the asset cache
- `"#otherId-position-x"` -> property lookup from another object in the same cell

## Assets

Built-ins are available by default:

- `@cube`
- `@sphere`
- `@plane`
- `@torus`

Custom assets can be declared in CSS-like at-rules:

```css
@Ship {
  url: "./models/ship.glb";
}

.hero {
  --geometry: @Ship;
}
```

Supported loader types include GLTF/GLB, FBX, textures, audio, MTL, and material JSON.

## Build Outputs

- `npm run build:lib` -> builds the npm library package output to `dist/lib`

## Performance Notes (Current)

Recent runtime improvements in this repo include:

- cell-local ID/class lookup indexes (faster `getConvictById` / `getConvictsByClass`)
- cached CSS selector lookups with style-change invalidation
- cached keyframe and asset-rule scans with style-change invalidation
- requestAnimationFrame-throttled pointer-move raycasting
- targeted repaints for pseudo-state changes instead of full-cell pseudo repaint on each move

## Limitations / Gotchas

- The CSS painter is best-effort and will ignore unsupported custom props.
- Cross-origin stylesheets may not be readable (`cssRules` access restrictions); those rules are skipped.
- Async assets resolve later; properties may update after the loader completes.
- If you mutate object transforms directly in JS, any later CSS repaint can overwrite those values.

## Development Notes

This repo contains the runtime modules and a demo/test page.

- Source + demo live in `src/`
- npm package build output lives in `dist/lib/`
- demo build output lives in `dist/demo/`

## License

MIT
