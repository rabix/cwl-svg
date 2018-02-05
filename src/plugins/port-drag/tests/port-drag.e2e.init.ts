import "../../../assets/styles/theme";
import "../theme";
import {WorkflowFactory}                                 from "cwlts/models";
import {SVGEdgeHoverPlugin, SVGNodeMovePlugin, Workflow} from "../../../";
import {SVGPortDragPlugin}                               from "../port-drag";

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