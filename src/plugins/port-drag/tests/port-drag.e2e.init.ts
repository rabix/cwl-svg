import "../../../assets/styles/style.scss";
import "../theme.dark.scss"

import {WorkflowFactory}    from "cwlts/models";
import {Workflow}           from "../../../";
import {SVGPortDragPlugin}  from "../port-drag";
import {SVGEdgeHoverPlugin} from "../../edge-hover/edge-hover";
import {SVGNodeMovePlugin}  from "../../node-move/node-move";

const model = WorkflowFactory.from(require(__dirname + "/app.json"));

const svgRoot = document.getElementById("svg") as any;


const wf = new Workflow({
    model: model,
    svgRoot: svgRoot,
    plugins: [
        new SVGPortDragPlugin(),
        new SVGEdgeHoverPlugin(),
        new SVGNodeMovePlugin()
    ]
});

wf.fitToViewport();
wf.enableEditing(true);
window["wf"] = wf;