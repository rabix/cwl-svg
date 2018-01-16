# CWL-SVG

CWL-SVG is a Typescript library for visualization of Common Workflow Language workflows

## Installation
```
npm install cwl-svg
```

## Standalone Demo
```
git clone https://github.com/rabix/cwl-svg
cd cwl-svg
npm install
npm start
// Point browser to http://localhost:8080
```

 
## Integration

```typescript
// Content of src/demo.ts

// Dark theme
import "./assets/styles/themes/rabix-dark/theme";
import "./plugins/port-drag/theme.dark.scss";
import "./plugins/selection/theme.dark.scss";

// Light theme
// import "./assets/styles/theme";
// import "./plugins/port-drag/theme.scss";
// import "./plugins/selection/theme.scss";

import {WorkflowFactory}    from "cwlts/models";
import {Workflow}           from "./graph/workflow";
import {SVGArrangePlugin}   from "./plugins/arrange/arrange";
import {SVGNodeMovePlugin}  from "./plugins/node-move/node-move";
import {SVGPortDragPlugin}  from "./plugins/port-drag/port-drag";
import {SelectionPlugin}    from "./plugins/selection/selection";
import {SVGEdgeHoverPlugin} from "./plugins/edge-hover/edge-hover";
import {ZoomPlugin}         from "./plugins/zoom/zoom";

const sample = require(__dirname + "/../cwl-samples/rna-seq-alignment.json");

const wf = WorkflowFactory.from(sample);

const svgRoot = document.getElementById("svg") as any;

const workflow = new Workflow({
    model: wf,
    svgRoot: svgRoot,
    plugins: [
        new SVGArrangePlugin(),
        new SVGEdgeHoverPlugin(),
        new SVGNodeMovePlugin({
            movementSpeed: 10
        }),
        new SVGPortDragPlugin(),
        new SelectionPlugin(),
        new ZoomPlugin(),
    ]
});

// workflow.getPlugin(SVGArrangePlugin).arrange();
window["wf"] = workflow;

```

## Preview

### Overview
![Arranged and scaled BCBio workflow](./docs/images/bcbio.png)


### Selection
![Selection and Highlighting](./docs/images/bcbio-selection.gif)

### Movement
![Movement](./docs/images/bcbio-movement.gif)

### Connection
![Connecting Nodesd](./docs/images/bcbio-connection.gif)
