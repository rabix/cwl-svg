import {WorkflowFactory} from "cwlts/models";
// import * as loaded from "/Users/ivanbatic/Documents/CWL/Whole Genome Analysis - BWA + GATK 2.3.9-Lite (with Metrics).json";
import * as loaded from "../cwl-samples/rna-seq-alignment.json";
import "./assets/styles/style.scss";
import {Workflow} from "./graph/workflow";

const wf = WorkflowFactory.from(loaded as any);
console.log("Model", wf);
const svgRoot  = document.getElementById("svg") as any;
const workflow = new Workflow(svgRoot, wf);