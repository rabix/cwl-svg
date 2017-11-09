import "./assets/styles/style.scss";
import "./plugins/port-drag/port-drag.scss";
import "./plugins/selection/selection.scss";

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