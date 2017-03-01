import "./assets/styles/style.scss";
import {WorkflowFactory} from "cwlts/models";
import {Workflow} from "./graph/workflow";

declare const Snap: any;
import * as loaded from "../cwl-samples/rna-seq-alignment.json";
console.log("loaded", loaded);
const wf = WorkflowFactory.from(loaded as any);
const workflow = new Workflow(new Snap("#svg"), wf);

console.log("Model", wf);
