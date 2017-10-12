import {GraphChange, SVGPlugin} from "./plugin";
import {Workflow}               from "../graph/workflow";

export abstract class SVGPluginBase implements SVGPlugin {

    protected workflow: Workflow;
    protected onBeforeChange: (change: GraphChange) => void;
    protected onAfterChange: (change: GraphChange) => void;

    registerWorkflowModel(workflow: Workflow): void {
        this.workflow = workflow;
    }

    registerOnBeforeChange(fn: (change: GraphChange) => void): void {
        this.onBeforeChange = fn;
    }

    registerOnAfterChange(fn: (change: GraphChange) => void): void {
        this.onAfterChange = fn;
    }

    abstract afterRender(): void;

}