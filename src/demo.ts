import "./assets/styles/style.scss";
import {WorkflowFactory, WorkflowModel} from "cwlts/models";
import {Workflow} from "./graph/workflow";
// import * as loaded from "/Users/ivanbatic/Documents/CWL/Whole Genome Analysis - BWA + GATK 2.3.9-Lite (with Metrics).json";
import * as loaded from "../cwl-samples/rna-seq-alignment.json";

declare const Snap: any;
const wf = WorkflowFactory.from(loaded as any);
console.log("Model", wf);
const workflow = new Workflow(new Snap("#svg"), wf);
