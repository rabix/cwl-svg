import "./assets/styles/style.scss";
import {WorkflowFactory} from "cwlts/models";
import {Workflow} from "./graph/workflow";
declare const samples: {
    fastQC: any,
    bcBio: any,
    rnaSeqAlignment: any
};

const wf = WorkflowFactory.from(samples.fastQC);
console.log("Model", wf);
const svgRoot      = document.getElementById("svg") as any;
const workflow     = new Workflow(svgRoot, wf);
window["workflow"] = workflow;