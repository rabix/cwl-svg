import {Edge, Graph, StepModel, WorkflowModel, WorkflowStepInputModel, WorkflowStepOutputModel} from "cwlts/models";
import {DomEvents} from "../utils/dom-events";
import {EventHub} from "../utils/event-hub";
import {Geometry} from "../utils/geometry";
import {SVGUtils} from "../utils/svg-utils";
import {Edge as GraphEdge} from "./edge";
import {GraphNode} from "./graph-node";
import {IOPort} from "./io-port";
import {TemplateParser} from "./template-parser";

export class Workflow {

    /** Current scale of the document */
    private scale = 1;

    private arrangeFlag = true;

    public get canArrange() : boolean {
        return this.arrangeFlag;
    }

    public static readonly minScale = 0.2;

    public static readonly maxScale = 2;

    public readonly eventHub: EventHub;

    private domEvents: DomEvents;

    private workflow: SVGGElement;

    private svgRoot: SVGSVGElement;

    private model: WorkflowModel;

    private workflowBoundingClientRect;

    private isDragging = false;

    /**
     * The size of the workflow boundary / padding that stops nodes from being dragged
     * outside the workflow viewport; drag "scroll" is activated when cursor hits a boundary
     * @type {number}
     */
    private dragBoundary = 50;

    /**
     * The amount which the workflow, node, and necessary paths will be translated
     * when mouse is dragged on boundary or outside workflow every time the interval runs
     * @type {number}
     */
    private dragBoundaryTranslation = 5;

    /**
     * The interval that is set when the cursor hits a boundary (or multiple boundaries)
     * x and y represent the axes on which the boundary is hit, the interval is the interval
     * function itself, and xOffset and yOffset represent the accumulated translations
     */
    private dragBoundaryInterval = {
        x: false,
        y: false,
        interval: null,
        xOffset: 0,
        yOffset: 0,
        highlightedPort: undefined
    };

    /**
     * Disables dragging nodes, dragging from ports, arranging and deleting
     * @type {boolean}
     */
    private disableManipulations = false;

    private handlersThatCanBeDisabled = [];

    constructor(svgRoot: SVGSVGElement, model: WorkflowModel) {

        this.svgRoot = svgRoot;

        this.model = model;

        this.domEvents = new DomEvents(this.svgRoot as any);

        this.svgRoot.innerHTML = `
            <rect x="0" y="0" width="100%" height="100%" class="pan-handle" transform="matrix(1,0,0,1,0,0)"></rect>
            <g class="workflow" transform="matrix(1,0,0,1,0,0)"></g>
        `;

        this.workflow = this.svgRoot.querySelector(".workflow") as any;

        /**
         * Whenever user scrolls, take the scroll delta and scale the workflow.
         */
        this.svgRoot.addEventListener("mousewheel", (ev: MouseWheelEvent) => {
            if (this.isDragging) {
                return;
            }
            const scale = this.scale + ev.deltaY / 500;

            // Prevent scaling to unreasonable proportions.
            if (scale <= Workflow.minScale || scale >= Workflow.maxScale) {
                return;
            }

            this.scaleWorkflow(scale, ev);
            ev.stopPropagation();
        }, true);

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

        this.on("beforeChange", () => {
            this.arrangeFlag = true;
        });
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

    getScale() {
        return this.scale;
    }

    arrange() {
        if (this.disableManipulations || !this.canArrange) {
            return;
        }

        const changeEventData = {type: "arrange"};
        this.eventHub.emit("beforeChange", changeEventData);

        this.resetTransform();

        type NodeIO = {
            inputs: string[],
            outputs: string[],
            connectionID: string,
            el: SVGGElement,
            rect: ClientRect,
            type: "step" | "input" | "output" | string
        };
        type NodeSet = { [connectionID: string]: NodeIO };

        // Edges are the main source of information from which we will distribute nodes
        const edges: SVGGElement[] = Array.from(this.workflow.querySelectorAll(".edge")) as SVGGElement[];

        // Make a graph representation where you can trace inputs and outputs from/to connection ids
        const nodeSet: NodeSet = {};

        const danglingNodes = Array.from(this.workflow.querySelectorAll(`.node`)).reduce((acc, el) => {
            return {...acc, [el.getAttribute("data-connection-id")]: el};
        }, {});

        edges.forEach(edge => {
            const sourceConnectionID      = edge.getAttribute("data-source-connection");
            const destinationConnectionID = edge.getAttribute("data-destination-connection");

            const [sourceSide, sourceNodeID, sourcePortID]                = sourceConnectionID.split("/");
            const [destinationSide, destinationNodeID, destinationPortID] = destinationConnectionID.split("/");

            let sourceType      = "step";
            let destinationType = "step";
            if (sourceNodeID === sourcePortID) {
                sourceType = sourceSide === "in" ? "output" : "input";
            }
            if (destinationNodeID === destinationPortID) {
                destinationType = destinationSide === "in" ? "output" : "input";
            }

            // Initialize keys on graph if they don't exist
            const sourceNode      = this.workflow.querySelector(`.node[data-id="${sourceNodeID}"]`) as SVGGElement;
            const destinationNode = this.workflow.querySelector(`.node[data-id="${destinationNodeID}"]`) as SVGGElement;

            const sourceNodeConnectionID      = sourceNode.getAttribute("data-connection-id");
            const destinationNodeConnectionID = destinationNode.getAttribute("data-connection-id");

            delete danglingNodes[sourceNodeConnectionID];
            delete danglingNodes[destinationNodeConnectionID];
            //
            (nodeSet[sourceNodeID] || (nodeSet[sourceNodeID] = {
                inputs: [],
                outputs: [],
                type: sourceType,
                connectionID: sourceNodeConnectionID,
                el: sourceNode,
                rect: sourceNode.getBoundingClientRect()
            }));

            (nodeSet[destinationNodeID] || (nodeSet[destinationNodeID] = {
                inputs: [],
                outputs: [],
                type: destinationType,
                connectionID: destinationNodeConnectionID,
                el: destinationNode,
                rect: destinationNode.getBoundingClientRect()
            }));

            nodeSet[sourceNodeID].outputs.push(destinationNodeID);
            nodeSet[destinationNodeID].inputs.push(sourceNodeID);


        });

        const traceLongestPath = (node: NodeIO, visited: Set<NodeIO>) => {
            visited.add(node);
            const ins = node.inputs.map(nid => nodeSet[nid]);
            return 1 + (ins.length ? Math.max(...ins.filter(e => !visited.has(e)).map(e => traceLongestPath(e, visited))) : 0);
        }

        const idToZoneMap = Object.keys(nodeSet).reduce((zoneMap, nid) => {

            const item = nodeSet[nid];
            let zone   = traceLongestPath(item, new Set<NodeIO>()) - 1;
            return {...zoneMap, [nid]: zone};
        }, {});

        for (const nid in nodeSet) {
            const node = nodeSet[nid];
            if (node.type === "input") {
                const newZone    = Math.min(...node.outputs.map(out => idToZoneMap[out])) - 1;
                idToZoneMap[nid] = newZone;
            }
        }


        const columns: NodeIO[][] = Object.keys(idToZoneMap)
            .sort((a, b) => -a.localeCompare(b))
            .reduce((acc, nid) => {
                const zone = idToZoneMap[nid];
                if (!acc[zone]) {
                    acc[zone] = [];
                }
                acc[zone].push(nodeSet[nid]);
                return acc;
            }, []);

        let distributionAreaHeight = 0;
        let distributionAreaWidth  = 0;

        const columnDimensions = Object.keys(columns).map(col => ({height: 0, width: 0}));

        columns.forEach((column, index) => {
            let width  = 0;
            let height = 0;
            column.forEach(entry => {
                height += entry.rect.height;
                if (width < entry.rect.width) {
                    width = entry.rect.width;
                }
            });

            columnDimensions[index] = {height, width};

            distributionAreaWidth += width;
            if (height > distributionAreaHeight) {
                distributionAreaHeight = height;
            }
        });

        let baseline   = distributionAreaHeight / 2;
        let xOffset    = 0;
        let maxYOffset = 0;

        columns.forEach((column, index) => {
            const rowCount = column.length + 1;
            const colSize  = columnDimensions[index];
            let yOffset    = baseline - (colSize.height / 2) - column[0].rect.height / 2;

            column.forEach(node => {
                yOffset += node.rect.height / 2;
                const matrix = SVGUtils.createMatrix().translate(xOffset, yOffset);
                yOffset += node.rect.height / 2;
                if (yOffset > maxYOffset) {
                    maxYOffset = yOffset;
                }

                node.el.setAttribute("transform", SVGUtils.matrixToTransformAttr(matrix));
                const modelEntry = this.model.findById(node.connectionID);
                this.setModelPosition(modelEntry, matrix.e, matrix.f, false);
            });

            xOffset += colSize.width;
        });

        let danglingNodeKeys = Object.keys(danglingNodes).sort((a, b) => {
            const aIsInput  = a.indexOf("out/") > -1;
            const aIsOutput = a.indexOf("in/") > -1;
            const bIsInput  = b.indexOf("out/") > -1;
            const bIsOutput = b.indexOf("in/") > -1;

            if (aIsOutput) {
                if (bIsOutput) {
                    return b.toLowerCase().localeCompare(a.toLowerCase());
                }
                else {
                    return 1;
                }
            }
            else if (aIsInput) {
                if (bIsOutput) {
                    return -1;
                }
                if (bIsInput) {
                    return b.toLowerCase().localeCompare(a.toLowerCase());
                }
                else {
                    return 1;
                }
            }
            else {
                if (!bIsOutput && !bIsInput) {
                    return b.toLowerCase().localeCompare(a.toLowerCase());
                }
                else {
                    return -1;
                }
            }
        });

        const danglingNodeMarginOffset = 30;
        const danglingNodeSideLength   = GraphNode.radius * 5;
        let maxNodeHeightInRow         = 0;
        let row                        = 0;
        let indexWidthMap              = new Map<number, number>();
        let rowMaxHeightMap            = new Map<number, number>();
        xOffset                        = 0;

        let danglingRowAreaWidth = Math.max(distributionAreaWidth, danglingNodeSideLength * 3);
        danglingNodeKeys.forEach((connectionID, index) => {
            const el   = danglingNodes[connectionID] as SVGGElement;
            const rect = el.firstElementChild.getBoundingClientRect();
            indexWidthMap.set(index, rect.width);

            if (xOffset === 0) {
                xOffset -= rect.width / 2;
            }
            if (rect.height > maxNodeHeightInRow) {
                maxNodeHeightInRow = rect.height;
            }
            xOffset += rect.width + danglingNodeMarginOffset + Math.max(150 - rect.width, 0);

            if (xOffset >= danglingRowAreaWidth && index < danglingNodeKeys.length - 1) {
                rowMaxHeightMap.set(row++, maxNodeHeightInRow);
                maxNodeHeightInRow = 0;
                xOffset            = 0;
            }
        });

        rowMaxHeightMap.set(row, maxNodeHeightInRow);
        let colYOffset                 = maxYOffset;
        xOffset                        = 0;
        row                            = 0;

        danglingNodeKeys.forEach((connectionID, index) => {
            const el        = danglingNodes[connectionID] as SVGGElement;
            const width     = indexWidthMap.get(index);
            const rowHeight = rowMaxHeightMap.get(row);
            let left        = xOffset + width / 2;
            let top         = colYOffset
                + danglingNodeMarginOffset
                + Math.ceil(rowHeight / 2)
                + ((xOffset === 0 ? 0 : left) / danglingRowAreaWidth) * danglingNodeSideLength;

            if (xOffset === 0) {
                left    -= width / 2;
                xOffset -= width / 2;
            }
            xOffset += width + danglingNodeMarginOffset + Math.max(150 - width, 0);

            const matrix     = SVGUtils.createMatrix().translate(left, top);
            const modelEntry = this.model.findById(el.getAttribute("data-connection-id"));
            el.setAttribute("transform", SVGUtils.matrixToTransformAttr(matrix));
            this.setModelPosition(modelEntry, matrix.e, matrix.f, false);

            if (xOffset >= danglingRowAreaWidth) {
                colYOffset += Math.ceil(rowHeight) + danglingNodeMarginOffset;
                xOffset            = 0;
                maxNodeHeightInRow = 0;
                row++
            }
        });

        this.redrawEdges();

        this.fitToViewport();

        this.arrangeFlag = false;

        this.eventHub.emit("afterChange", changeEventData);
    }

    /**
     * Scales the workflow to fit the available viewport
     */
    fitToViewport(): void {

        this.scaleWorkflow(1);
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
        this.scaleWorkflow(newScale);

        const scaledWFBounds = this.workflow.getBoundingClientRect();

        const moveY = clientBounds.top - scaledWFBounds.top + Math.abs(clientBounds.height - scaledWFBounds.height) / 2;
        const moveX = clientBounds.left - scaledWFBounds.left + Math.abs(clientBounds.width - scaledWFBounds.width) / 2;

        const matrix  = this.workflow.transform.baseVal.getItem(0).matrix;
        matrix.e     += moveX;
        matrix.f     += moveY;
    }

    private redrawEdges() {

        const edgeEls          = this.model.connections.filter(el => el.isVisible);
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

        Array.from(this.workflow.querySelectorAll(".edge")).forEach((el: SVGGElement) => {
            this.attachEdgeHoverBehavior(el);
        });
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
                let x, y;

                if (!isNaN(parseInt(nodeModel.customProps["sbg:x"]))) {
                    x = nodeModel.customProps["sbg:x"];
                } else {
                    x = 0;
                    arrangeNecessary = true;
                }

                if (!isNaN(parseInt(nodeModel.customProps["sbg:y"]))) {
                    y = nodeModel.customProps["sbg:y"];
                } else {
                    y = 0;
                    arrangeNecessary = true;
                }

                return tpl + GraphNode.makeTemplate(x, y, nodeModel);
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
            this.arrange();
        } else {
            this.scaleWorkflow(this.scale);
        }

        // If we had a selection before, restore it
        if (selectedItemConnectionID) {
            const newSelection = this.workflow.querySelector(`[data-connection-id='${selectedItemConnectionID}']`);
            // We need to check if the previously selected item still exist, since it might be deleted in the meantime
            if (newSelection) {
                this.activateSelection(newSelection as SVGGElement);
            }
        }
    }

    static canDrawIn(element: SVGElement): boolean {
        let clientBounds = element.getBoundingClientRect();
        return clientBounds.width !== 0;
    }

    redraw(model?: WorkflowModel) {
        if (model) {
            this.model = model;
        }
        this.renderModel(this.model);
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

            const x   = step.customProps["sbg:x"] || Math.random() * 1000;
            const y   = step.customProps["sbg:y"] || Math.random() * 1000;
            const tpl = GraphNode.makeTemplate(x, y, step);
            const el  = TemplateParser.parse(tpl);
            this.workflow.appendChild(el);

            // Labels on this new step will not be scaled properly since they are custom-adjusted during scaling
            // So let's trigger the scaling again
            this.scaleWorkflow(this.scale);

            this.eventHub.emit("afterChange", changeEventData);
        });

        /**
         * @name connection.create
         */
        this.eventHub.on("connection.create", (connection: Edge) => {

            // this.workflow.innerHTML += GraphEdge.makeTemplate(connection, this.paper);
        });

        /**
         * @name connection.create
         */
        this.model.on("connections.updated", (input: WorkflowStepInputModel) => {
            this.redrawEdges();
        });
    }

    /**
     * Scale the workflow by the scaleCoefficient over the center of the workflo
     * @param scaleCoefficient
     */
    scaleWorkflowCenter(scaleCoefficient = 1) {
        this.workflowBoundingClientRect = this.svgRoot.getBoundingClientRect();
        this.scaleWorkflow(scaleCoefficient, {
            clientX: (this.workflowBoundingClientRect.right + this.workflowBoundingClientRect.left) / 2,
            clientY: (this.workflowBoundingClientRect.top + this.workflowBoundingClientRect.bottom) / 2
        });
    }

    /**
     * Scale the workflow by the scaleCoefficient (not compounded) over given coordinates
     * @param scaleCoefficient
     * @param ev
     */
    scaleWorkflow(scaleCoefficient = 1, ev?: { clientX: number, clientY: number }) {
        this.scale              = scaleCoefficient;
        const transform         = this.workflow.transform.baseVal;
        const matrix: SVGMatrix = transform.getItem(0).matrix;

        const coords = this.transformScreenCTMtoCanvas(ev ? ev.clientX : 0, ev ? ev.clientY : 0);

        matrix.e += matrix.a * coords.x;
        matrix.f += matrix.a * coords.y;
        matrix.a = matrix.d = scaleCoefficient;
        matrix.e -= scaleCoefficient * coords.x;
        matrix.f -= scaleCoefficient * coords.y;

        const labelScale = 1 + (1 - this.scale) / (this.scale * 2);

        Array.from(this.workflow.querySelectorAll(".node .label"))
            .map((el: SVGTextElement) => el.transform.baseVal.getItem(0).matrix)
            .forEach(m => {
                m.a = labelScale;
                m.d = labelScale;
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
         * Manually wire up hovering on edges because mouseenters don't propagate
         */
        {
            Array.from(this.workflow.querySelectorAll(".edge")).forEach((el: SVGGElement) => {
                this.attachEdgeHoverBehavior(el);
            });
        }

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
            this.attachNodeDragBehavior();

            this.attachPortDragBehavior();

            this.attachSelectionDeletionBehavior();
        }
    }

    /**
     * Move nodes and edges on drag
     */
    private attachNodeDragBehavior()
    {
        let startX: number;
        let startY: number;
        let inputEdges: Map<SVGElement, number[]>;
        let outputEdges: Map<SVGElement, number[]>;
        let newX: number;
        let newY: number;

        this.handlersThatCanBeDisabled.push(this.domEvents.drag(".node .drag-handle", (dx: number, dy: number,
                                                                                  ev, handle: SVGGElement) => {
            const nodeEl = handle.parentNode as SVGGElement;
            let sdx, sdy;

            const boundary = this.getBoundaryZonesXYAxes(ev.clientX, ev.clientY);

            // if a workflow boundary has been hit, then call function which calls the interval
            if (boundary.x || boundary.y) {

                this.setDragBoundaryIntervalIfNecessary(nodeEl, {x: boundary.x, y: boundary.y},
                    {startX: startX, startY: startY, inputEdges: inputEdges, outputEdges: outputEdges});
            }

            // returns the delta x and y - change in node position - based on mouse position and
            // boundary offsets (if necessary)
            const scaledDeltas = this.getScaledDeltaXYForDrag(boundary, ev, startX, startY, dx, dy);
            sdx                = scaledDeltas.x;
            sdy                = scaledDeltas.y;
            newX               = startX + sdx;
            newY               = startY + sdy;
            nodeEl.transform.baseVal.getItem(0).setTranslate(newX, newY);

            this.setInputAndOutputEdges(inputEdges, outputEdges, sdx, sdy);
        }, (ev, handle, root) => {
            this.isDragging = true;
            const el                        = handle.parentNode as SVGGElement;
            const matrix                    = el.transform.baseVal.getItem(0).matrix;
            startX                          = matrix.e;
            startY                          = matrix.f;
            inputEdges                      = new Map<SVGElement, number[]>();
            outputEdges                     = new Map<SVGElement, number[]>();
            this.workflowBoundingClientRect = this.svgRoot.getBoundingClientRect();

            Array.from(root.querySelectorAll(`.edge[data-destination-node='${el.getAttribute("data-id")}'] .sub-edge`))
                .forEach((el: SVGElement) => {
                    inputEdges.set(el, el.getAttribute("d").split(" ").map(e => Number(e)).filter(e => !isNaN(e)))
                });

            Array.from(root.querySelectorAll(`.edge[data-source-node='${el.getAttribute("data-id")}'] .sub-edge`))
                .forEach((el: SVGElement) => {
                    outputEdges.set(el, el.getAttribute("d").split(" ").map(e => Number(e)).filter(e => !isNaN(e)))
                });
        }, (ev, target) => {
            this.isDragging = false;
            this.setDragBoundaryIntervalToDefault();

            const parentNode = Workflow.findParentNode(target);

            const model = this.model.findById(parentNode.getAttribute("data-connection-id"));
            if (model) {
                this.setModelPosition(model, newX, newY);
            }

            inputEdges  = undefined;
            outputEdges = undefined;
        }));
    }

    /**
     * Sets the interval for dragging within a boundary zone if a new
     * boundary zone has been hit. The interval function translates the workflow,
     * the dragging node, and the edges attached to that node.
     * @param el
     * @param boundary
     * @param pathInfo
     * @param ghostIO
     */
    private setDragBoundaryIntervalIfNecessary(el: SVGGElement,
                                               boundary: { x: 1 | 0 | -1, y: 1 | 0 | -1 },
                                               pathInfo?: {
                                                   startX: number, startY: number,
                                                   inputEdges: Map<SVGElement, number[]>,
                                                   outputEdges: Map<SVGElement, number[]> },
                                               ghostIO?: {
                                                   edge: SVGPathElement,
                                                   nodeToMouseDistance: number,
                                                   connectionPorts: SVGGElement[],
                                                   highlightedPort: SVGGElement,
                                                   origin: { x: number, y: number },
                                                   coords: { x: number, y: number },
                                                   portToOriginTransformation: WeakMap<SVGGElement, SVGMatrix>,
                                                   edgeDirection: "left" | "right"
                                               }): void {

        // If boundary areas overlap or if boundary areas take up half - or more - of the svg, resize dragBoundary
        while (this.workflowBoundingClientRect.right - this.dragBoundary <= this.workflowBoundingClientRect.left + this.dragBoundary ||
            this.workflowBoundingClientRect.right <= this.workflowBoundingClientRect.left + (this.dragBoundary * 4)) {
            this.dragBoundary = this.dragBoundary / 2;
        }

        const checkIfLeftBoundary: boolean   = boundary.x === -1;
        const checkIfRightBoundary: boolean  = boundary.x === 1;
        const checkIfTopBoundary: boolean    = boundary.y === -1;
        const checkIfBottomBoundary: boolean = boundary.y === 1;

        if (boundary.x || boundary.y) {
            // If mouse has hit a boundary but 'this.dragBoundaryInterval' has not registered it yet,
            // or if both are registered - which happens in corner case - but mouse has been moved to
            // hit only one boundary afterwards
            if (!this.dragBoundaryInterval.x && boundary.x ||
                !this.dragBoundaryInterval.y && boundary.y ||
                (this.dragBoundaryInterval.x && this.dragBoundaryInterval.y && !(boundary.x && boundary.y))) {
                this.dragBoundaryInterval.x = boundary.x !== 0;
                this.dragBoundaryInterval.y = boundary.y !== 0;

                const workflowMatrix: SVGMatrix = this.workflow.transform.baseVal.getItem(0).matrix;
                const mx: SVGMatrix             = el.transform.baseVal.getItem(0).matrix;

                if (ghostIO) {
                    this.dragBoundaryInterval.highlightedPort = ghostIO.highlightedPort;
                }

                // Create new interval every time mouse hits new edge
                clearInterval(this.dragBoundaryInterval.interval);
                this.dragBoundaryInterval.interval = setInterval(() => {
                    const moveX = checkIfRightBoundary ? this.dragBoundaryTranslation :
                        checkIfLeftBoundary ? -this.dragBoundaryTranslation : 0;
                    const moveY = checkIfBottomBoundary ? this.dragBoundaryTranslation :
                        checkIfTopBoundary ? -this.dragBoundaryTranslation : 0;

                    // Change matrix e and f values - these represent x and y translate, respectively -
                    // by 'this.dragBoundaryTranslation' every time this function is called. This translates the matrix
                    // when the mouse down held on an edge.
                    workflowMatrix.e -= moveX;
                    workflowMatrix.f -= moveY;

                    this.dragBoundaryInterval.xOffset += this.adaptToScale(moveX);
                    this.dragBoundaryInterval.yOffset += this.adaptToScale(moveY);

                    // Translates the node by scaled 'moveX' (and/or 'moveY') every time
                    // this interval function is called.
                    mx.e += this.adaptToScale(moveX);
                    mx.f += this.adaptToScale(moveY);

                    // If node has edges - i.e. if it is not a ghost node
                    if (pathInfo) {
                        // Sets the paths correctly for the input edges and the output edges where necessary
                        this.setInputAndOutputEdges(pathInfo.inputEdges, pathInfo.outputEdges,
                            mx.e - pathInfo.startX, mx.f - pathInfo.startY);
                    }
                    else if (ghostIO) {
                        // Creates the ghost node path
                        Array.from(ghostIO.edge.children).forEach((el: SVGPathElement) => {
                            el.setAttribute("d",
                                IOPort.makeConnectionPath(
                                    ghostIO.origin.x,
                                    ghostIO.origin.y,
                                    mx.e,
                                    mx.f,
                                    ghostIO.edgeDirection
                                )
                            );
                        });

                        const sorted = this.getSortedConnectionPorts(ghostIO.connectionPorts,
                            { x: mx.e, y: mx.f }, ghostIO.portToOriginTransformation);
                        this.removeHighlightedPort(this.dragBoundaryInterval.highlightedPort, ghostIO.edgeDirection);
                        this.dragBoundaryInterval.highlightedPort = this.setHighlightedPort(sorted, ghostIO.edgeDirection);
                        this.translateGhostNodeAndShowIfNecessary(el, ghostIO.nodeToMouseDistance,
                            this.dragBoundaryInterval.highlightedPort !== undefined, { x: mx.e, y: mx.f });
                    }
                }, 1000 / 60);
            }
        }
    }

    /**
     * Check all possible workflow boundaries to see if (x,y) is on edge(s)
     * -1 / 1 values are left / right and top / bottom depending on the axis,
     * and 0 means it has not hit a boundary on that axis
     * @param x
     * @param y
     * @returns {{x: number, y: number}}
     */
    private getBoundaryZonesXYAxes(x: number, y: number): { x: 1 | 0 | -1, y: 1 | 0 | -1 } {
        const isLeftBoundary   = x < this.workflowBoundingClientRect.left + this.dragBoundary;
        const isRightBoundary  = x > this.workflowBoundingClientRect.right - this.dragBoundary;
        const isTopBoundary    = y < this.workflowBoundingClientRect.top + this.dragBoundary;
        const isBottomBoundary = y > this.workflowBoundingClientRect.bottom - this.dragBoundary;

        // if cursor is not on a boundary, then clear interval if it exists
        if (!isLeftBoundary && !isRightBoundary &&
            !isTopBoundary && !isBottomBoundary) {
            if (this.dragBoundaryInterval.interval) {
                clearInterval(this.dragBoundaryInterval.interval);
                this.dragBoundaryInterval.x = this.dragBoundaryInterval.y = false;
                this.dragBoundaryInterval.interval = null;
                this.dragBoundaryInterval.highlightedPort = undefined;
            }
        }


        // return -1 if (x,y) is on left / top edge or outside the window on the left / top side,
        // return 1 if opposite, and 0 if cursor is in the main part of the canvas (standard), for each axis
        return {
            x: isLeftBoundary ? -1 : isRightBoundary ? 1 : 0,
            y: isTopBoundary ? -1 : isBottomBoundary ? 1 : 0
        };
    }

    /**
     * Calculates the change in x and y for drag, taking into account the starting x and y,
     * the cursor position, the boundary offsets, and the current scale coefficient.
     * @param boundary
     * @param ev
     * @param startX
     * @param startY
     * @param dx
     * @param dy
     * @returns {{x: number, y: number}}
     */
    private getScaledDeltaXYForDrag(boundary: { x: 1 | 0 | -1, y: 1 | 0 | -1 },
                                    ev: { clientX: number, clientY: number },
                                    startX: number, startY: number,
                                    dx: number, dy: number): { x: number, y: number } {
        const edgeIntervalOn = this.dragBoundaryInterval.interval !== null;
        let sdx, sdy;

        if (boundary.x !== 0 || boundary.y !== 0) {
            if (boundary.x !== 0) {
                const edgeX = this.transformScreenCTMtoCanvas(boundary.x === 1 ?
                    this.workflowBoundingClientRect.right - this.dragBoundary :
                    this.workflowBoundingClientRect.left + this.dragBoundary, 0).x; // CHANGE HERE
                sdx         = edgeX - startX;
            } else {
                sdx = this.adaptToScale(dx) + this.dragBoundaryInterval.xOffset;
            }
            if (boundary.y !== 0) {
                const edgeY = this.transformScreenCTMtoCanvas(0, boundary.y === 1 ?
                    this.workflowBoundingClientRect.bottom - this.dragBoundary :
                    this.workflowBoundingClientRect.top + this.dragBoundary).y; // CHANGE HERE
                sdy         = edgeY - startY;
            } else {
                sdy = this.adaptToScale(dy) + this.dragBoundaryInterval.yOffset;
            }

        } else {
            sdx = this.adaptToScale(dx) + this.dragBoundaryInterval.xOffset;
            sdy = this.adaptToScale(dy) + this.dragBoundaryInterval.yOffset;
        }
        return {
            x: sdx,
            y: sdy
        }
    }

    /**
     * Updates a node's input edges based on the node's output ports' locations,
     * and a node's output edges based on the node's input ports' locations
     * @param inputEdges
     * @param outputEdges
     * @param dx
     * @param dy
     */
    private setInputAndOutputEdges(inputEdges: Map<SVGElement, number[]>,
                                   outputEdges: Map<SVGElement, number[]>,
                                   dx: number,
                                   dy: number) {
        inputEdges.forEach((p: number[], el: SVGElement) => {
            el.setAttribute("d", IOPort.makeConnectionPath(p[0], p[1], p[6] + dx, p[7] + dy));
        });

        outputEdges.forEach((p, el) => {
            el.setAttribute("d", IOPort.makeConnectionPath(p[0] + dx, p[1] + dy, p[6], p[7]));
        });
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

    private adaptToScale(x) {
        return x * (1 / this.scale);
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

    private attachEdgeHoverBehavior(el: SVGGElement) {
        let tipEl;

        this.domEvents.hover(el, (ev, target) => {

            if (!tipEl) {
                return;
            }
            const coords = this.transformScreenCTMtoCanvas(ev.clientX, ev.clientY);
            tipEl.setAttribute("x", coords.x);
            tipEl.setAttribute("y", coords.y - 16);

        }, (ev, target, root) => {
            if (root.querySelector(".dragged")) {
                return;
            }

            const sourceNode = target.getAttribute("data-source-node");
            const destNode   = target.getAttribute("data-destination-node");
            const sourcePort = target.getAttribute("data-source-port");
            const destPort   = target.getAttribute("data-destination-port");

            const sourceLabel = sourceNode === sourcePort ? sourceNode : `${sourceNode} (${sourcePort})`;
            const destLabel   = destNode === destPort ? destNode : `${destNode} (${destPort})`;

            const coords = this.transformScreenCTMtoCanvas(ev.clientX, ev.clientY);

            const ns = "http://www.w3.org/2000/svg";
            tipEl    = document.createElementNS(ns, "text");
            tipEl.classList.add("label");
            tipEl.classList.add("label-edge");
            tipEl.setAttribute("x", coords.x);
            tipEl.setAttribute("y", coords.x - 16);
            tipEl.innerHTML = sourceLabel + " → " + destLabel;

            this.workflow.appendChild(tipEl);

        }, () => {
            if (tipEl) {
                tipEl.remove();
                tipEl = undefined;
            }
        });
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

                const sourcePort      = this.workflow.querySelector(`.port[data-connection-id="${sourcePortID}"]`);
                const destinationPort = this.workflow.querySelector(`.port[data-connection-id="${destinationPortID}"]`);

                const sourceNode      = Workflow.findParentNode(sourcePort);
                const destinationNode = Workflow.findParentNode(destinationPort);

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

    private attachPortDragBehavior() {
        let edge: SVGPathElement;
        let preferredConnectionPorts: SVGGElement[];
        let allOppositeConnectionPorts: SVGGElement[];
        let highlightedPort: SVGGElement;
        let edgeDirection: "left" | "right";
        let ghostIONode: SVGGElement;
        let originNodeCoords: { x: number, y: number };
        let portToOriginTransformation: WeakMap<SVGGElement, SVGMatrix>;

        this.handlersThatCanBeDisabled.push(this.domEvents.drag(".port", (dx: number, dy: number, ev, target: SVGGElement) => {
            // Gather the necessary positions that we need in order to draw a path
            const ctm                 = target.getScreenCTM();
            const coords              = this.transformScreenCTMtoCanvas(ev.clientX, ev.clientY);
            const origin              = this.transformScreenCTMtoCanvas(ctm.e, ctm.f);
            const nodeToMouseDistance = Geometry.distance(originNodeCoords.x, originNodeCoords.y, coords.x, coords.y);

            const boundary = this.getBoundaryZonesXYAxes(ev.clientX, ev.clientY);

            if (boundary.x || boundary.y) {
                this.setDragBoundaryIntervalIfNecessary(
                    ghostIONode,
                    {
                        x: boundary.x,
                        y: boundary.y
                    },
                    null,
                    {
                        edge,
                        nodeToMouseDistance,
                        connectionPorts: allOppositeConnectionPorts,
                        highlightedPort,
                        origin,
                        coords,
                        portToOriginTransformation,
                        edgeDirection
                    }
                );
            }

            const scaledDeltas = this.getScaledDeltaXYForDrag(boundary, ev, origin.x, origin.y, dx, dy);

            // Draw a path from the origin port to the cursor
            Array.from(edge.children).forEach((el: SVGPathElement) => {
                el.setAttribute("d",
                    IOPort.makeConnectionPath(
                        origin.x,
                        origin.y,
                        origin.x + scaledDeltas.x,
                        origin.y + scaledDeltas.y,
                        edgeDirection
                    )
                );
            });

            const sorted    = this.getSortedConnectionPorts(allOppositeConnectionPorts, coords, portToOriginTransformation);
            highlightedPort = this.dragBoundaryInterval.highlightedPort || highlightedPort;

            this.removeHighlightedPort(highlightedPort, edgeDirection);
            highlightedPort = this.setHighlightedPort(sorted, edgeDirection);

            this.translateGhostNodeAndShowIfNecessary(
                ghostIONode,
                nodeToMouseDistance,
                highlightedPort !== undefined,
                {
                    x: origin.x + scaledDeltas.x,
                    y: origin.y + scaledDeltas.y
                }
            );

        }, (ev, origin, root) => {
            this.isDragging = true;

            portToOriginTransformation = new WeakMap<SVGGElement, SVGMatrix>()

            this.workflowBoundingClientRect = this.svgRoot.getBoundingClientRect();

            const originNode    = Workflow.findParentNode(origin);
            const originNodeCTM = originNode.getScreenCTM();

            originNodeCoords = this.transformScreenCTMtoCanvas(originNodeCTM.e, originNodeCTM.f);

            const isInputPort = origin.classList.contains("input-port");

            ghostIONode = GraphNode.createGhostIO();
            this.workflow.appendChild(ghostIONode);


            // Based on the type of our origin port, determine the direction of the path to draw
            edgeDirection = isInputPort ? "left" : "right";

            // Draw the edge to the cursor and store the element's reference
            edge = <SVGPathElement>GraphEdge.spawn();
            edge.classList.add("dragged");
            this.workflow.appendChild(edge);

            // We need the origin connection ID so we can ask CWLTS for connection recommendations
            const targetConnectionId = origin.getAttribute("data-connection-id");

            // Have a set of all ports of the opposite type, they are all possible destinations.
            // Except the same node that we are dragging from.
            allOppositeConnectionPorts = Array.from(
                this.workflow.querySelectorAll(`.port.${isInputPort ? "output-port" : "input-port"}`)
            ).filter((el: SVGGElement) => Workflow.findParentNode(el) !== originNode) as SVGGElement[];


            allOppositeConnectionPorts.forEach((el: SVGGElement) => {
                // Find the position of the port relative to the canvas origin
                portToOriginTransformation.set(el, Geometry.getTransformToElement(el, this.workflow));
            });

            // Get all valid and visible connection destinations
            // Find them in the dom and mark them as connection candidates
            preferredConnectionPorts = (this.model.gatherValidConnectionPoints(targetConnectionId) || [])
                .filter(point => point.isVisible)
                .map(p => {
                    const el = this.workflow.querySelector(`.port[data-connection-id="${p.connectionId}"]`) as SVGGElement;
                    portToOriginTransformation.set(el, Geometry.getTransformToElement(el, this.workflow));
                    el.classList.add("connection-suggestion");
                    return el;
                });

            // For all of the valid connection destinations, find their parent node element
            // and mark it as a highlighted and a connection candidate
            preferredConnectionPorts.forEach(el => {
                const parentNode = Workflow.findParentNode(el);
                parentNode.classList.add("highlighted", "connection-suggestion");
            });

            // Then mark the workflow itself, so it knows to fade out other stuff
            this.workflow.classList.add("has-suggestion", "edge-dragging");

        }, (ev, origin) => {
            highlightedPort = this.dragBoundaryInterval.highlightedPort || highlightedPort;
            this.isDragging = false;
            this.setDragBoundaryIntervalToDefault();

            /**
             * If a port is highlighted, that means that we are supposed to snap the connection to that port
             */
            if (highlightedPort) {
                /**
                 * Find the connection ids of origin port and the highlighted port
                 */
                let sourceID      = origin.getAttribute("data-connection-id");
                let destinationID = highlightedPort.getAttribute("data-connection-id");

                /**
                 * Swap their places in case you dragged out from input to output
                 */
                if (sourceID.startsWith("in")) {
                    const tmp     = sourceID;
                    sourceID      = destinationID;
                    destinationID = tmp;
                }

                /**
                 * Maybe you tried to connect ports that are already connected.
                 * If an edge with these connection IDs doesn't already exist, create it.
                 * Otherwise, prevent creation.
                 */

                if (!GraphEdge.findEdge(this.workflow, sourceID, destinationID)) {

                    const changeEventData = {type: "connect"};
                    this.eventHub.emit("beforeChange", changeEventData);

                    const newEdge = GraphEdge.spawnBetweenConnectionIDs(this.workflow, sourceID, destinationID);
                    this.attachEdgeHoverBehavior(newEdge);
                    const isValid = this.model.connect(sourceID, destinationID);
                    if (isValid === false) {
                        newEdge.classList.add("not-valid");
                    }

                    this.eventHub.emit("afterChange", changeEventData);
                }

                // Deselect and cleanup
                highlightedPort.classList.remove("highlighted");
                highlightedPort = undefined;
            } else if (!ghostIONode.classList.contains("hidden")) {
                // If the ghost io node is not hidden, then we should create an input or an output


                // Take the port connection id, check if it's an input or an output and,
                // based on that, determine if we should create an input or an output.
                // Then create the i/o node.
                const portID    = origin.getAttribute("data-connection-id");
                const ioIsInput = portID.startsWith("in");

                const changeEventData = {
                    type: `${ioIsInput ? 'input' : 'output'}.create`
                };
                this.eventHub.emit("beforeChange", changeEventData);

                const newIO = GraphNode.patchModelPorts(ioIsInput
                    ? this.model.createInputFromPort(portID)
                    : this.model.createOutputFromPort(portID));


                // Check to see if cursor is on boundary (or boundaries)
                const boundary = this.getBoundaryZonesXYAxes(ev.clientX, ev.clientY);

                const mouseCoords = this.transformScreenCTMtoCanvas(ev.clientX, ev.clientY);
                let newX          = mouseCoords.x;
                let newY          = mouseCoords.y;
                if (boundary.x) {
                    newX = this.transformScreenCTMtoCanvas(boundary.x === -1 ? this.workflowBoundingClientRect.left + this.dragBoundary :
                        this.workflowBoundingClientRect.right - this.dragBoundary, 0).x;
                }
                if (boundary.y) {
                    newY = this.transformScreenCTMtoCanvas(0, boundary.y === -1 ? this.workflowBoundingClientRect.top + this.dragBoundary :
                        this.workflowBoundingClientRect.bottom - this.dragBoundary).y;
                }

                // Translate mouse coordinates to the canvas coordinates,
                // make a template for the graph node, create an element out of that,
                // and add that element to the dom
                const tpl = GraphNode.makeTemplate(newX, newY, newIO);
                const el  = TemplateParser.parse(tpl);
                this.workflow.appendChild(el);

                // Update the cwlts model with the new x and y coords for this node
                this.setModelPosition(newIO, mouseCoords.x, mouseCoords.y, false);

                // Spawn an edge between origin and destination ports
                const edge = GraphEdge.spawnBetweenConnectionIDs(this.workflow, portID, newIO.connectionId);

                // This edge still has no events bound to it, so fix that
                this.attachEdgeHoverBehavior(edge);

                // Re-scale the workflow so the label gets upscaled or downscaled properly

                this.scaleWorkflow(this.scale);

                this.eventHub.emit("afterChange", changeEventData);
            }

            this.workflow.classList.remove("has-suggestion", "edge-dragging");
            Array.from(this.workflow.querySelectorAll(".connection-suggestion, .preferred-node, .preferred-port")).forEach(el => {
                el.classList.remove("connection-suggestion", "highlighted", "preferred-node", "preferred-port", edgeDirection);
            });

            const selection = this.workflow.querySelector(".selected") as SVGGElement;
            if (selection) {
                this.activateSelection(selection);
            }

            edge.remove();
            ghostIONode.remove();

            edge                       = undefined;
            ghostIONode                = undefined;
            edgeDirection              = undefined;
            originNodeCoords           = undefined;
            preferredConnectionPorts   = undefined;
            portToOriginTransformation = undefined;
        }));
    }

    /**
     * Goes through all the potential connection ports for a new path,
     * and sorts them by distance in ascending order
     * @param connectionPorts
     * @param portToOriginTransformation
     * @param transformationDisplacement
     * @param coords
     * @returns {SVGGElement[]}
     */
    private getSortedConnectionPorts(connectionPorts: SVGGElement[],
                                     coords: { x: number, y: number },
                                     portToOriginTransformation: WeakMap<SVGGElement, SVGMatrix>): Map<SVGGElement, number> {

        const distances: Map<SVGGElement, number> = new Map();
        const ordered: Map<SVGGElement, number>   = new Map();

        connectionPorts.forEach(el => {
            const ctm = portToOriginTransformation.get(el);
            distances.set(el, Geometry.distance(coords.x, coords.y, ctm.e, ctm.f));
        });

        connectionPorts.sort((el1, el2) => distances.get(el1) - distances.get(el2)).forEach(el => {
            ordered.set(el, distances.get(el));
        });

        return ordered;
    }

    /**
     * Removes highlighted port if a highlighted port exists
     * @param highlightedPort
     * @param edgeDirection
     */
    private removeHighlightedPort(highlightedPort: SVGGElement, edgeDirection: "left" | "right"): void {
        if (highlightedPort) {
            const parentNode = Workflow.findParentNode(highlightedPort);
            // highlightedPort.classList.remove("highlighted", "preferred-port");
            highlightedPort.classList.remove("highlighted", "preferred-port");
            // parentNode.classList.remove("highlighted", "preferred-node", edgeDirection);
            parentNode.classList.remove("preferred-node", edgeDirection);
        }
    }

    /**
     * Check if the closest connection port is within a certain distance.
     * If it is, highlight it and return the highlightedPort
     * @param sortedMap
     * @param edgeDirection
     * @returns {any}
     */
    private setHighlightedPort(sortedMap: Map<SVGGElement, number>, edgeDirection: "left" | "right"): SVGGElement {
        let highlightedPort;

        const portElements = Array.from(sortedMap.keys());
        // If there is a port in close proximity, assume that we want to connect to it, so highlight it
        if (portElements.length && sortedMap.get(portElements[0]) < 100) {
            highlightedPort = portElements[0];
            highlightedPort.classList.add("highlighted", "preferred-port");
            const parentNode = Workflow.findParentNode(highlightedPort);
            this.workflow.appendChild(parentNode);
            parentNode.classList.add("highlighted", "preferred-node", edgeDirection);
        } else {
            highlightedPort = undefined;
        }
        return highlightedPort;
    }

    /**
     * Translate the ghost node and show it if the closest connection
     * port is farther than 120px
     * @param ghostIONode
     * @param nodeToMouseDistance
     * @param newCoords
     */
    private translateGhostNodeAndShowIfNecessary(ghostIONode: SVGGElement,
                                                 nodeToMouseDistance: number,
                                                 isCloseToPort: boolean,
                                                 newCoords: { x: number, y: number }): void {
        ghostIONode.classList.add("hidden");
        if (nodeToMouseDistance > 120 && !isCloseToPort) {
            ghostIONode.classList.remove("hidden");
            // Otherwise, we might create an input or an ooutput node
        }
        ghostIONode.transform.baseVal.getItem(0).setTranslate(newCoords.x, newCoords.y);
    }

    /**
     * Sets the dragBoundaryInterval object to its default values
     */
    private setDragBoundaryIntervalToDefault(): void {
        if (this.dragBoundaryInterval.interval) {
            clearInterval(this.dragBoundaryInterval.interval);
            this.dragBoundaryInterval.x = this.dragBoundaryInterval.y = false;
            this.dragBoundaryInterval.interval = null;
            this.dragBoundaryInterval.highlightedPort = undefined;
        }
        this.dragBoundaryInterval.xOffset = this.dragBoundaryInterval.yOffset = 0;
    }

    static findParentNode(el) {
        let parentNode = el;
        while (parentNode) {
            if (parentNode.classList.contains("node")) {
                return parentNode;
            }
            parentNode = parentNode.parentNode;
        }
    }

    setModelPosition(obj, x, y, emitEvents = true) {
        const update = {
            "sbg:x": x,
            "sbg:y": y
        };

        const changeEventData = {type: "move"};

        if (emitEvents) {
            this.eventHub.emit("beforeChange", changeEventData);
        }

        if (!obj.customProps) {
            obj.customProps = update;
            return;
        }

        Object.assign(obj.customProps, update);

        if (emitEvents) {
            this.eventHub.emit("afterChange", changeEventData);
        }
    }

    private clearCanvas() {
        this.domEvents.detachAll();
        this.workflow.innerHTML = "";
        this.workflow.setAttribute("class", "workflow");
    }

    private getOffsetFromCanvasCenter(x, y) {

        const abs = {
            x: x - this.svgRoot.clientWidth / 2,
            y: y - this.svgRoot.clientHeight / 2,
        };
        const pc  = {
            pcx: abs.x / this.svgRoot.clientWidth,
            pcy: abs.y / this.svgRoot.clientHeight
        };

        return {...abs, ...pc};
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

    disableGraphManipulations() {
        this.disableManipulations = true;
        for (let i = 0; i < this.handlersThatCanBeDisabled.length; i++) {
            this.handlersThatCanBeDisabled[i]();
        }
    }

    enableGraphManipulations() {
        this.disableManipulations = false;
        this.attachNodeDragBehavior();
        this.attachPortDragBehavior();
        this.attachSelectionDeletionBehavior();
    }

    destroy() {
        this.clearCanvas();
        this.eventHub.empty();
    }

    private resetTransform() {
        this.workflow.setAttribute("transform", "matrix(1,0,0,1,0,0)");
        this.scaleWorkflow();
    }
}