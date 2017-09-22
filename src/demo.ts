import "./assets/styles/style.scss";
import {WorkflowFactory}   from "cwlts/models";
import {Workflow}          from "./graph/workflow";
import {SVGArrangePlugin}  from "./plugins/arrange/arrange";
import {SVGNodeMovePlugin} from "./plugins/node-move/node-move";

declare const samples: {
    fastQC: any,
    bcBio: any,
    rnaSeqAlignment: any
};

const wf = WorkflowFactory.from(samples.bcBio);
console.log("Model", wf);
const svgRoot = document.getElementById("svg") as any;

const workflow = new Workflow({
    model: wf,
    svgRoot: svgRoot,
    plugins: [
        new SVGArrangePlugin(),
        new SVGNodeMovePlugin({
            movementSpeed: 20
        })
    ]
});


workflow.getPlugin(SVGArrangePlugin).arrange();


window["workflow"] = workflow;