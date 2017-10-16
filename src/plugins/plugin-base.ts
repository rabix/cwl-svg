import {GraphChange, SVGPlugin} from "./plugin";
import {Workflow}               from "../graph/workflow";

export abstract class PluginBase implements SVGPlugin {

    protected workflow: Workflow;
    protected onBeforeChange: (change: GraphChange) => void;
    protected onAfterChange: (change: GraphChange) => void;

    registerWorkflow(workflow: Workflow): void {
        this.workflow = workflow;
    }

    registerOnBeforeChange(fn: (change: GraphChange) => void): void {
        this.onBeforeChange = fn;
    }

    registerOnAfterChange(fn: (change: GraphChange) => void): void {
        this.onAfterChange = fn;
    }

}