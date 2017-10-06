import "../../../assets/styles/style.scss";
import "../port-drag.scss"

import {WorkflowFactory}   from "cwlts/models";
import {Workflow}          from "../../../";
import {SVGPortDragPlugin} from "../port-drag";

const model = WorkflowFactory.from(require(__dirname + "/app.json"));

const svgRoot = document.getElementById("svg") as any;


const wf = new Workflow({
    model: model,
    svgRoot: svgRoot,
    plugins: [
        new SVGPortDragPlugin()
    ]
});

wf.fitToViewport();