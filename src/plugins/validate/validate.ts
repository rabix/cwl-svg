import {Edge}          from "cwlts/models";
import {PluginBase}    from "../plugin-base";
import {Workflow}      from "../../graph/workflow";
import {WorkflowModel} from "cwlts/models/generic/WorkflowModel";

export class SVGValidatePlugin extends PluginBase {

    private modelDisposers = [];

    /** Map of CSS classes attached by this plugin */
    private classes = {
        plugin: "__plugin-validate",
        invalid: "__validate-invalid"
    };
    private model: WorkflowModel;

    registerWorkflow(workflow: Workflow): void {
        super.registerWorkflow(workflow);

        this.model = workflow.model;


        // add plugin specific class to the svgRoot for scoping
        this.workflow.svgRoot.classList.add(this.classes.plugin);
    }

    afterModelChange(): void {

        this.disposeModelListeners();

        // add listener for all subsequent edge validation
        const dispose = this.workflow.model.on("connections.updated", () => {
            this.renderEdgeValidation();
        });

        this.modelDisposers.push(dispose.dispose);

    }

    destroy(): void {
        this.disposeModelListeners();
    }

    afterRender(): void {
        // do initial validation rendering for edges
        this.renderEdgeValidation();
    }

    enableEditing(enabled: boolean): void {

        if (enabled) {
            // only show validation if workflow is editable
            this.renderEdgeValidation();
        } else {
            this.removeClasses(this.workflow.workflow.querySelectorAll(".edge"))
        }
    }

    private disposeModelListeners(): void {
        for (let disposeListener of this.modelDisposers) {
            disposeListener();
        }
        this.modelDisposers = [];
    }

    private removeClasses(edges: NodeListOf<Element>): void {
        // remove validity class on all edges
        for (const e of edges) {
            e.classList.remove(this.classes.invalid);
        }
    }

    private renderEdgeValidation(): void {
        const graphEdges = this.workflow.workflow.querySelectorAll(".edge") as NodeListOf<Element>;

        this.removeClasses(graphEdges);

        // iterate through all modal connections
        this.workflow.model.connections.forEach((e: Edge) => {
            // if the connection isn't valid (should be colored on graph)
            if (!e.isValid) {

                // iterate through edges on the svg
                for (const ge of graphEdges) {
                    const sourceNodeID      = ge.getAttribute("data-source-connection");
                    const destinationNodeID = ge.getAttribute("data-destination-connection");

                    // compare invalid edge source/destination with svg edge
                    if (e.source.id === sourceNodeID && e.destination.id === destinationNodeID) {
                        // if its a match, tag it with the appropriate class and break from the loop
                        ge.classList.add(this.classes.invalid);
                        break;
                    }
                }
            }
        });
    }
}
