import {StepModel, WorkflowModel, WorkflowStepInputModel, WorkflowStepOutputModel} from "cwlts/models";
import {DomEvents}                                                                 from "../utils/dom-events";
import {EventHub}                                                                  from "../utils/event-hub";
import {Edge as GraphEdge}                                                         from "./edge";
import {GraphNode}                                                                 from "./graph-node";
import {TemplateParser}                                                            from "./template-parser";
import {SVGPlugin}                                                                 from "../plugins/plugin";
import {Connectable}                                                               from "./connectable";
import {WorkflowInputParameterModel}                                               from "cwlts/models/generic/WorkflowInputParameterModel";
import {WorkflowOutputParameterModel}                                              from "cwlts/models/generic/WorkflowOutputParameterModel";

/**
 * @FIXME validation states of old and newly created edges
 */
export class Workflow {

    readonly eventHub: EventHub;

    minScale = 0.2;
    maxScale = 2;

    domEvents: DomEvents;
    svgRoot: SVGSVGElement;
    workflow: SVGGElement;
    model: WorkflowModel;

    /** Current scale of the document */
    private _scale = 1;

    /** Scale of labels, they are different than scale of other elements in the workflow */
    labelScale = 1;

    private workflowBoundingClientRect;

    private isDragging = false;

    private plugins: SVGPlugin[] = [];

    /**
     * Disables dragging nodes, dragging from ports, arranging and deleting
     * @type {boolean}
     */
    private disableManipulations = false;

    private handlersThatCanBeDisabled = [];

    constructor(parameters: {
        svgRoot: SVGSVGElement,
        model: WorkflowModel,
        plugins?: SVGPlugin[]
    }) {
        let {svgRoot, model} = parameters;

        this.model     = model;
        this.svgRoot   = svgRoot;
        this.plugins   = parameters.plugins || [];
        this.domEvents = new DomEvents(this.svgRoot as any);

        this.hookPlugins();

        this.svgRoot.innerHTML = `
            <rect x="0" y="0" width="100%" height="100%" class="pan-handle" transform="matrix(1,0,0,1,0,0)"></rect>
            <g class="workflow" transform="matrix(1,0,0,1,0,0)"></g>
        `;

        this.workflow = this.svgRoot.querySelector(".workflow") as any;


        this.eventHub = new EventHub([
            /** @link connection.create */
            "connection.create",
            /** @link app.create.step */
            "app.create.step",
            /** @link app.create.input */
            "app.create.input",
            /** @link app.create.output */
            "app.create.output",
            /** @link workflow.fit */
            "beforeChange",
            "afterChange",
            "selectionChange"
        ]);

        this.attachEvents();

        if (model) {
            this.renderModel(model);
        }

        /**
         * Whenever user scrolls, take the scroll delta and scale the workflow.
         */
        this.svgRoot.addEventListener("mousewheel", (ev: MouseWheelEvent) => {
            if (this.isDragging) {
                return;
            }
            const scale = this.scale - ev.deltaY / 500;

            // Prevent scaling to unreasonable proportions.
            if (scale <= this.minScale || scale >= this.maxScale) {
                return;
            }

            this.scaleAtPoint(scale, ev.clientX, ev.clientY);
            ev.stopPropagation();
        }, true);


    }

    static canDrawIn(element: SVGElement): boolean {
        return element.getBoundingClientRect().width !== 0;
    }

    static findParentNode(el): SVGGElement | undefined {
        let parentNode = el;
        while (parentNode) {
            if (parentNode.classList.contains("node")) {
                return parentNode;
            }
            parentNode = parentNode.parentNode;
        }
    }

    static makeConnectionPath(x1, y1, x2, y2, forceDirection: "right" | "left" | string = "right"): string {

        if (!forceDirection) {
            return `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;
        } else if (forceDirection === "right") {
            const outDir = x1 + Math.abs(x1 - x2) / 2;
            const inDir  = x2 - Math.abs(x1 - x2) / 2;

            return `M ${x1} ${y1} C ${outDir} ${y1} ${inDir} ${y2} ${x2} ${y2}`;
        } else if (forceDirection === "left") {
            const outDir = x1 - Math.abs(x1 - x2) / 2;
            const inDir  = x2 + Math.abs(x1 - x2) / 2;

            return `M ${x1} ${y1} C ${outDir} ${y1} ${inDir} ${y2} ${x2} ${y2}`;
        }
    }

    findParentNode(el: Element): SVGGElement | undefined {
        return Workflow.findParentNode(el);
    }

    /**
     * Retrieves a plugin instance
     * @param {{new(...args: any[]) => T}} plugin
     * @returns {T}
     */
    getPlugin<T extends SVGPlugin>(plugin: { new(...args: any[]): T }): T {
        return this.plugins.find(p => p instanceof plugin) as T;
    }

    command(event: string, ...data: any[]) {
        this.eventHub.emit(event, ...data);
    }

    on(event: string, handler) {
        this.eventHub.on(event, handler);
    }

    off(event, handler) {
        this.eventHub.off(event, handler);
    }

    /**
     * Scales the workflow to fit the available viewport
     */
    fitToViewport(): void {

        this.scaleAtPoint(1);
        Object.assign(this.workflow.transform.baseVal.getItem(0).matrix, {
            e: 0,
            f: 0
        });

        let clientBounds = this.svgRoot.getBoundingClientRect();
        let wfBounds     = this.workflow.getBoundingClientRect();
        const padding    = 100;

        if (clientBounds.width === 0 || clientBounds.height === 0) {
            throw new Error("Cannot fit workflow to the area that has no visible viewport.");
        }

        const verticalScale   = (wfBounds.height) / (clientBounds.height - padding);
        const horizontalScale = (wfBounds.width) / (clientBounds.width - padding);

        const scaleFactor = Math.max(verticalScale, horizontalScale);

        // Cap the upscaling to 1, we don't want to zoom in workflows that would fit anyway
        const newScale = Math.min(this.scale / scaleFactor, 1);
        this.scaleAtPoint(newScale);

        const scaledWFBounds = this.workflow.getBoundingClientRect();

        const moveY = clientBounds.top - scaledWFBounds.top + Math.abs(clientBounds.height - scaledWFBounds.height) / 2;
        const moveX = clientBounds.left - scaledWFBounds.left + Math.abs(clientBounds.width - scaledWFBounds.width) / 2;

        const matrix = this.workflow.transform.baseVal.getItem(0).matrix;
        matrix.e += moveX;
        matrix.f += moveY;
    }

    redrawEdges() {

        const highlightedEdges = new Set();

        Array.from(this.workflow.querySelectorAll(".edge")).forEach((el) => {
            if (el.classList.contains("highlighted")) {
                const edgeID = el.attributes["data-source-connection"].value + el.attributes["data-destination-connection"].value;
                highlightedEdges.add(edgeID);
            }
            el.remove();
        });


        const edgesTpl = this.model.connections
            .map(c => {
                const edgeId     = c.source.id + c.destination.id;
                const edgeStates = highlightedEdges.has(edgeId) ? "highlighted" : "";
                return GraphEdge.makeTemplate(c, this.workflow, edgeStates);
            })
            .reduce((acc, tpl) => acc + tpl, "");

        this.workflow.innerHTML = edgesTpl + this.workflow.innerHTML;
    }

    // noinspection JSUnusedGlobalSymbols
    redraw(model?: WorkflowModel): void {
        if (model) {
            this.model = model;
        }
        this.renderModel(this.model);
    }

    get scale() {
        return this._scale;
    }

    // noinspection JSUnusedGlobalSymbols
    set scale(scale: number) {
        this.workflowBoundingClientRect = this.svgRoot.getBoundingClientRect();

        const x = (this.workflowBoundingClientRect.right + this.workflowBoundingClientRect.left) / 2;
        const y = (this.workflowBoundingClientRect.top + this.workflowBoundingClientRect.bottom) / 2;

        this.scaleAtPoint(scale, x, y);
    }


    /**
     * Scale the workflow by the scaleCoefficient (not compounded) over given coordinates
     */
    scaleAtPoint(scale = 1, x = 0, y = 0): void {

        this._scale     = scale;
        this.labelScale = 1 + (1 - this._scale) / (this._scale * 2);

        const transform         = this.workflow.transform.baseVal;
        const matrix: SVGMatrix = transform.getItem(0).matrix;

        const coords = this.transformScreenCTMtoCanvas(x, y);

        matrix.e += matrix.a * coords.x;
        matrix.f += matrix.a * coords.y;
        matrix.a = matrix.d = scale;
        matrix.e -= scale * coords.x;
        matrix.f -= scale * coords.y;

        const nodeLabels = this.workflow.querySelectorAll(".node .label") as  NodeListOf<SVGPathElement>;

        for (let el of nodeLabels) {
            const matrix = el.transform.baseVal.getItem(0).matrix;

            Object.assign(matrix, {
                a: this.labelScale,
                d: this.labelScale
            });
        }

    }

    public deselectEverything() {
        Array.from(this.workflow.querySelectorAll(".highlighted")).forEach(el => {
            el.classList.remove("highlighted");
        });
        this.workflow.classList.remove("has-selection");
        const selected = this.workflow.querySelector(".selected");
        if (selected) {
            selected.classList.remove("selected");
        }
        this.eventHub.emit("selectionChange", null);
    }

    public transformScreenCTMtoCanvas(x, y) {
        const svg   = this.svgRoot;
        const ctm   = this.workflow.getScreenCTM();
        const point = svg.createSVGPoint();
        point.x     = x;
        point.y     = y;

        const t = point.matrixTransform(ctm.inverse());
        return {
            x: t.x,
            y: t.y
        };
    }

    public deleteSelection() {

        const selection = Array.from(this.workflow.querySelectorAll(".selected"));
        if (selection.length == 0) {
            return;
        }

        const changeEventData = {
            type: "deletion",
            data: selection
        };
        this.eventHub.emit("beforeChange", changeEventData);

        selection.forEach(el => {
            if (el.classList.contains("step")) {

                this.model.removeStep(el.getAttribute("data-connection-id"));
                this.renderModel(this.model);
                (this.svgRoot as any).focus();
            } else if (el.classList.contains("edge")) {

                const sourcePortID      = el.getAttribute("data-source-connection");
                const destinationPortID = el.getAttribute("data-destination-connection");

                this.model.disconnect(sourcePortID, destinationPortID);
                this.renderModel(this.model);
                (this.svgRoot as any).focus();
            } else if (el.classList.contains("input")) {

                this.model.removeInput(el.getAttribute("data-connection-id"));
                this.renderModel(this.model);
                (this.svgRoot as any).focus();
            } else if (el.classList.contains("output")) {

                this.model.removeOutput(el.getAttribute("data-connection-id"));
                this.renderModel(this.model);
                (this.svgRoot as any).focus();
            }
        });

        this.eventHub.emit("selectionChange", null);

        this.eventHub.emit("afterChange", changeEventData);
    }


    enableEditing(enabled: boolean): void {
        this.invokePlugins("enableEditing", enabled);
    }

    // noinspection JSUnusedGlobalSymbols
    destroy() {
        this.model.off("connection.create", this.onConnectionCreate);

        this.clearCanvas();
        this.eventHub.empty();
    }

    resetTransform() {
        this.workflow.setAttribute("transform", "matrix(1,0,0,1,0,0)");
        this.scaleAtPoint();
    }

    private renderModel(model: WorkflowModel) {
        console.time("Graph Rendering");
        this.model = model;

        // We will need to restore the transformations when we redraw the model, so save the current state
        const oldTransform = this.workflow.getAttribute("transform");

        // We might have an active selection that we want to preserve upon redrawing, save it
        let selectedStuff            = this.workflow.querySelector(".selected");
        let selectedItemConnectionID = selectedStuff ? selectedStuff.getAttribute("data-connection-id") : undefined;

        this.clearCanvas();

        this.workflow.setAttribute("transform", "matrix(1,0,0,1,0,0)");

        // If there is a missing sbg:x or sbg:y property on any node model,
        // the graph should be arranged to avoid random placement
        let arrangeNecessary = false;

        const nodes    = [...model.steps, ...model.inputs, ...model.outputs].filter(n => n.isVisible);
        const nodesTpl = nodes.map(n => GraphNode.patchModelPorts(n))
            .reduce((tpl, nodeModel: any) => {

                if (isNaN(parseInt(nodeModel.customProps["sbg:x"]))) {
                    arrangeNecessary = true;
                }

                if (isNaN(parseInt(nodeModel.customProps["sbg:y"]))) {
                    arrangeNecessary = true;
                }

                return tpl + GraphNode.makeTemplate(nodeModel);

            }, "");

        this.workflow.innerHTML += nodesTpl;

        this.redrawEdges();
        console.timeEnd("Graph Rendering");
        console.time("Ordering");

        Array.from(this.workflow.querySelectorAll(".node")).forEach(e => {
            this.workflow.appendChild(e);
        });

        this.addEventListeners(this.svgRoot);

        this.workflow.setAttribute("transform", oldTransform);
        console.timeEnd("Ordering");

        if (arrangeNecessary) {
            // this.arrange();
        } else {
            this.scaleAtPoint(this.scale);
        }

        // If we had a selection before, restore it
        if (selectedItemConnectionID) {
            const newSelection = this.workflow.querySelector(`[data-connection-id='${selectedItemConnectionID}']`);
            // We need to check if the previously selected item still exist, since it might be deleted in the meantime
            if (newSelection) {
                this.activateSelection(newSelection as SVGGElement);
            }
        }

        this.invokePlugins("afterRender");


        // -- Newly added events for v0.1.0
        this.model.on("input.create", this.onInputCreate.bind(this));
        this.model.on("output.create", this.onOutputCreate.bind(this));
        this.model.on("connection.create", this.onConnectionCreate.bind(this));

    }

    private attachEvents() {

        this.model.on("step.change", (change: StepModel) => {
            const title = this.workflow.querySelector(`.node.step[data-id="${change.connectionId}"] .title`) as SVGTextElement;
            if (title) {
                title.textContent = change.label;
            }
        });

        /**
         * @name app.create.input
         */
        this.eventHub.on("app.create.input", (input: WorkflowStepInputModel) => {
            this.command("app.create.step", Object.assign(input, {
                out: [{
                    id: input.id,
                    connectionId: input.connectionId,
                    isVisible: true
                }]
            }))
        });

        /**
         * @name app.create.output
         */
        this.eventHub.on("app.create.output", (output: WorkflowStepOutputModel) => {
            this.command("app.create.step", Object.assign(output, {
                in: [{
                    id: output.id,
                    connectionId: output.connectionId,
                    isVisible: true
                }]
            }))
        });

        /**
         * @name app.create.step
         */
        this.eventHub.on("app.create.step", (step: StepModel) => {

            const changeEventData = {type: "step.create"};
            this.eventHub.emit("beforeChange", changeEventData);

            const tpl = GraphNode.makeTemplate(step);
            const el  = TemplateParser.parse(tpl);
            this.workflow.appendChild(el);

            // Labels on this new step will not be scaled properly since they are custom-adjusted during scaling
            // So let's trigger the scaling again
            this.scaleAtPoint(this.scale);

            this.eventHub.emit("afterChange", changeEventData);
        });

        this.model.on("connections.updated", (input: WorkflowStepInputModel) => {
            this.redrawEdges();
        });
    }

    private addEventListeners(root: SVGSVGElement): void {

        /**
         * Whenever a click happens on a blank space, remove selections
         */
        this.domEvents.on("click", "*", (ev, el, root) => {
            this.deselectEverything();
        });

        /**
         * Whenever a click happens on a node, select that node and
         * highlight all connecting edges and adjacent vertices
         * while shadowing others.
         */
        this.domEvents.on("click", ".node", (ev, el: SVGGElement) => {
            this.activateSelection(el);
        });

        /**
         * Attach canvas panning
         */
        {
            let pane: SVGGElement;
            let x;
            let y;
            let matrix: SVGMatrix;
            this.domEvents.drag(".pan-handle", (dx, dy, ev, el, root) => {

                matrix.e = x + dx;
                matrix.f = y + dy;

            }, (ev, el, root) => {
                pane   = root.querySelector(".workflow") as SVGGElement;
                matrix = pane.transform.baseVal.getItem(0).matrix;
                x      = matrix.e;
                y      = matrix.f;
            }, () => {
                pane   = undefined;
                matrix = undefined;
            });
        }

        /**
         * Edge Selection
         */
        this.domEvents.on("click", ".edge", (ev, target: SVGPathElement, root) => {
            this.highlightEdge(target);
            target.classList.add("selected");
        });

        /**
         * On mouse over node, bring it to the front
         */
        this.domEvents.on("mouseover", ".node", (ev, target, root) => {
            if (this.workflow.querySelector(".edge.dragged")) {
                return;
            }
            target.parentElement.appendChild(target);
        });

        if (!this.disableManipulations) {
            this.attachSelectionDeletionBehavior();
        }
    }

    private highlightEdge(el: SVGPathElement) {
        const sourceNode = el.getAttribute("data-source-node");
        const destNode   = el.getAttribute("data-destination-node");
        const sourcePort = el.getAttribute("data-source-port");
        const destPort   = el.getAttribute("data-destination-port");

        Array.from(this.workflow.querySelectorAll(
            `.node[data-id="${sourceNode}"] .output-port[data-port-id="${sourcePort}"], `
            + `.node[data-id="${destNode}"] .input-port[data-port-id="${destPort}"]`)).forEach(el => {
            el.classList.add("highlighted");
        });

        this.eventHub.emit("selectionChange", el);
    }

    private attachSelectionDeletionBehavior() {
        this.handlersThatCanBeDisabled.push(this.domEvents.on("keyup", (ev: KeyboardEvent) => {

            if (!(ev.target instanceof SVGElement)) {
                return;
            }

            if (ev.which !== 8) {
                return;
            }

            this.deleteSelection();
            // Only input elements can be focused, but we added tabindex to the svg so this works
        }, window));
    }

    private clearCanvas() {
        this.domEvents.detachAll();
        this.workflow.innerHTML = "";
        this.workflow.setAttribute("class", "workflow");
    }

    private activateSelection(el: SVGGElement) {
        this.deselectEverything();

        this.workflow.classList.add("has-selection");

        const nodeID = el.getAttribute("data-id");

        const firstNode = this.workflow.getElementsByClassName("node")[0];
        Array.from(this.workflow.querySelectorAll(`.edge[data-source-node="${nodeID}"], .edge[data-destination-node="${nodeID}"]`)).forEach((edge: HTMLElement) => {
            edge.classList.add("highlighted");
            const sourceNodeID      = edge.getAttribute("data-source-node");
            const destinationNodeID = edge.getAttribute("data-destination-node");

            Array.from(this.workflow.querySelectorAll(`.node[data-id="${sourceNodeID}"], .node[data-id="${destinationNodeID}"]`))
                .forEach((el: SVGGElement) => el.classList.add("highlighted"));

            this.workflow.insertBefore(edge, firstNode);
        });

        el.classList.add("selected");
        if (typeof (el as any).focus === "function") {
            (el as any).focus();
        }
        this.eventHub.emit("selectionChange", el);
    }

    private hookPlugins() {

        this.plugins.forEach(plugin => {
            plugin.registerWorkflowModel(this);

            plugin.registerOnBeforeChange(event => {
                this.eventHub.emit("beforeChange", event);
            });

            plugin.registerOnAfterChange(event => {
                this.eventHub.emit("afterChange", event);
            });
        });
    }

    private invokePlugins(methodName: keyof SVGPlugin, ...args: any[]) {
        this.plugins.forEach(plugin => {
            if (typeof plugin[methodName] === "function") {
                (plugin[methodName] as Function)(...args);
            }
        })
    }

    /**
     * Listener for “connection.create” event on model that renders new edges on canvas
     */
    private onConnectionCreate(source: Connectable, destination: Connectable): void {

        const sourceID      = source.connectionId;
        const destinationID = destination.connectionId;

        GraphEdge.spawnBetweenConnectionIDs(this.workflow, sourceID, destinationID);

    }

    /**
     * Listener for “input.create” event on model that renders workflow inputs
     */
    private onInputCreate(input: WorkflowInputParameterModel): void {

        const patched       = GraphNode.patchModelPorts(input);
        const graphTemplate = GraphNode.makeTemplate(patched, this.labelScale);

        const el = TemplateParser.parse(graphTemplate);
        this.workflow.appendChild(el);

    }

    /**
     * Listener for “output.create” event on model that renders workflow outputs
     */
    private onOutputCreate(output: WorkflowOutputParameterModel): void {

        const patched       = GraphNode.patchModelPorts(output);
        const graphTemplate = GraphNode.makeTemplate(patched, this.labelScale);

        const el = TemplateParser.parse(graphTemplate);
        this.workflow.appendChild(el);
    }

}