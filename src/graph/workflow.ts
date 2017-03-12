import {Edge, StepModel, WorkflowModel, WorkflowStepInputModel, WorkflowStepOutputModel} from "cwlts/models";
import "snapsvg-cjs";
import {EventHub} from "../utils/event-hub";
import {GraphNode} from "./graph-node";
import {Edge as GraphEdge} from "./edge";
import {DomEvents} from "../utils/dom-events";
import {IOPort} from "./io-port";
import {Geometry} from "../utils/geometry";
import {TemplateParser} from "./template-parser";

Snap.plugin(function (Snap, Element) {
    const proto = Element.prototype;

    proto.toFront = function () {
        this.appendTo(this.node.parentNode);
    };
    proto.toBack = function () {
        this.prependTo(this.node.parentNode);
    };
});

export class Workflow {
    private paper: Snap.Paper;

    private group: Snap.Element;

    private scale = 1;

    public readonly eventHub: EventHub;

    private domEvents: DomEvents;

    private workflow: SVGGElement;

    private svgRoot: SVGSVGElement;

    private model: WorkflowModel;

    constructor(paper: Snap.Paper, model: WorkflowModel) {
        this.paper = paper;

        this.svgRoot = paper.node;

        this.model = model;

        this.domEvents = new DomEvents(this.paper.node as HTMLElement);

        this.paper.node.innerHTML = `
            <rect x="0" y="0" width="100%" height="100%" class="pan-handle" transform="matrix(1,0,0,1,0,0)"></rect>
            <g class="workflow" transform="matrix(1,0,0,1,0,0)"></g>
        `;
        this.workflow = this.paper.node.querySelector(".workflow") as any;

        this.group = Snap(this.workflow);

        this.paper.node.addEventListener("mousewheel", ev => {
            const newScale = this.getScale() + ev.deltaY / 500;

            // Prevent scaling to unreasonable proportions.
            if (newScale <= 0.15 || newScale > 3) {
                return;
            }

            this.command("workflow.scale", newScale, ev);
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
            /** @link workflow.arrange */
            "workflow.arrange",
            /** @link workflow.scale */
            "workflow.scale",
            /** @link workflow.fit */
            "workflow.fit",
        ]);

        this.attachEvents();

        if (model) {
            this.renderModel(model);
        }
        console.time("Event Listeners");
        this.addEventListeners(this.paper.node);
        console.timeEnd("Event Listeners");
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

    private renderModel(model: WorkflowModel) {
        console.time("Graph Rendering");
        const oldTransform = this.workflow.getAttribute("transform");
        this.clearCanvas();
        this.workflow.setAttribute("transform", "matrix(1,0,0,1,0,0)");

        const nodes = [...model.steps, ...model.inputs, ...model.outputs].filter(n => n.isVisible);
        const nodesTpl = nodes.map(n => GraphNode.patchModelPorts(n))
            .reduce((tpl, nodeModel) => {
                const x = nodeModel.customProps["sbg:x"] || Math.random() * 500;
                const y = nodeModel.customProps["sbg:y"] || Math.random() * 500;
                return tpl + GraphNode.makeTemplate(x, y, nodeModel);
            }, "");

        this.workflow.innerHTML += nodesTpl;

        const edgesTpl = model.connections.map(c => GraphEdge.makeTemplate(c, this.paper)).reduce((acc, tpl) => acc + tpl, "");
        this.workflow.innerHTML += edgesTpl;
        console.timeEnd("Graph Rendering");
        console.time("Ordering");

        this.workflow.querySelectorAll(".node").forEach(e => {
            this.workflow.appendChild(e);
        });

        this.workflow.setAttribute("transform", oldTransform);
        this.command("workflow.scale", this.scale);
        console.timeEnd("Ordering");
    }

    public redraw(){
        this.renderModel(this.model);
    }


    private attachEvents() {

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

            const x = step.customProps["sbg:x"] || Math.random() * 1000;
            const y = step.customProps["sbg:y"] || Math.random() * 1000;
            const tpl = GraphNode.makeTemplate(x, y, step);
            const el = TemplateParser.parse(tpl);
            this.workflow.appendChild(el);

            // Labels on this new step will not be scaled properly since they are custom-adjusted during scaling
            // So let's trigger the scaling again
            this.command("workflow.scale", this.scale);
        });

        /**
         * @name connection.create
         */
        this.eventHub.on("connection.create", (connection: Edge) => {

            // this.workflow.innerHTML += GraphEdge.makeTemplate(connection, this.paper);
        });

        /**
         * @name workflow.arrange
         */
        this.eventHub.on("workflow.arrange", (connections: Edge[]) => {
            const tracker = {};
            const zones = {};
            const width = this.paper.node.clientWidth;
            const height = this.paper.node.clientHeight;

            const workflowIns = new Map<any[], string>();

            connections.forEach(c => {

                let [, sName, spName] = c.source.id.split("/");
                let [, dName, dpName] = c.destination.id.split("/");

                tracker[sName] || (tracker[sName] = []);
                (tracker[dName] || (tracker[dName] = [])).push(tracker[sName]);
                if (sName === spName) {
                    workflowIns.set(tracker[sName], sName);
                }
            });

            const trace = (arr, visited: Set<any>) => {
                visited.add(arr);
                return 1 + ( arr.length ? Math.max(...arr.filter(e => !visited.has(e)).map((e) => trace(e, visited))) : 0);
            };


            const trackerKeys = Object.keys(tracker);
            const idToZoneMap = trackerKeys.reduce(
                (acc, k) => Object.assign(acc, {[k]: trace(tracker[k], new Set()) - 1}), {}
            );

            trackerKeys.forEach(k => {
                tracker[k].filter(p => workflowIns.has(p)).forEach(pre => {
                    idToZoneMap[workflowIns.get(pre)] = idToZoneMap[k] - 1;
                });
            });

            trackerKeys.forEach(k => {

                try {
                    const snap = Snap(`.node.${k}`);
                    const zone = idToZoneMap[k];
                    if (!snap) {
                        throw new Error("Cant find node " + k);
                    }
                    (zones[zone] || (zones[zone] = [])).push(snap);
                } catch (ex) {
                    console.error("ERROR", k, ex, tracker);
                }
            });

            const columnCount = Object.keys(zones).length + 1;
            const columnWidth = (width / columnCount);

            for (let z in zones) {
                const rowCount = zones[z].length + 1;
                const rowHeight = height / rowCount;

                zones[z].forEach((el: Snap.Element, i) => {
                    el.transform(new Snap.Matrix()
                        .translate(columnWidth * (~~z + 1), (i + 1) * rowHeight));
                });
            }
        });

        /**
         * @name workflow.scale
         */
        this.eventHub.on("workflow.scale", (c, ev?: { clientX: number, clientY: number }) => {

            this.scale = c;
            const transform = this.workflow.transform.baseVal;
            const matrix: SVGMatrix = transform.getItem(0).matrix;

            matrix.a = c;
            matrix.d = c;

            const labelScale = 1 + (1 - c) / (c * 2);

            Array.from(this.workflow.querySelectorAll(".node .label"))
                .map(el => el.transform.baseVal.getItem(0).matrix)
                .forEach(m => {
                    m.a = labelScale;
                    m.d = labelScale;
                })
        });

        /**
         * @name workflow.fit
         */
        this.eventHub.on("workflow.fit", () => {

            this.group.transform(new Snap.Matrix());

            let {clientWidth: paperWidth, clientHeight: paperHeight} = this.paper.node;
            let clientBounds = this.paper.node.getBoundingClientRect();
            let wfBounds = this.group.node.getBoundingClientRect();

            const padding = 200;

            const verticalScale = (wfBounds.height + padding) / paperHeight;
            const horizontalScale = (wfBounds.width + padding) / paperWidth;

            const scaleFactor = Math.max(verticalScale, horizontalScale);

            this.command("workflow.scale", 1 / scaleFactor);

            let paperBounds = this.paper.node.getBoundingClientRect();
            wfBounds = this.group.node.getBoundingClientRect();

            const moveY = scaleFactor * -wfBounds.top + scaleFactor * clientBounds.top + scaleFactor * Math.abs(paperBounds.height - wfBounds.height) / 2;
            const moveX = scaleFactor * -wfBounds.left + scaleFactor * clientBounds.left + scaleFactor * Math.abs(paperBounds.width - wfBounds.width) / 2;

            this.group.transform(this.group.transform().localMatrix.clone().translate(moveX, moveY));
        });
    }

    private addEventListeners(root: HTMLElement): void {

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
        this.domEvents.on("click", ".node", (ev, el) => {
            this.activateSelection(el);
        });


        /**
         * Move nodes and edges on drag
         */
        {
            let startX: number;
            let startY: number;
            let inputEdges: Map<SVGElement, number[]>;
            let outputEdges: Map<SVGElement, number[]>;
            let newX;
            let newY;

            this.domEvents.drag(".node .drag-handle", (dx, dy, ev, handle: SVGGElement) => {
                const el = handle.parentNode;
                const sdx = this.adaptToScale(dx);
                const sdy = this.adaptToScale(dy);

                newX = startX + sdx;
                newY = startY + sdy;
                el.transform.baseVal.getItem(0).setTranslate(newX, newY);

                inputEdges.forEach((p: number[], el: SVGElement) => {
                    el.setAttribute("d", IOPort.makeConnectionPath(p[0], p[1], p[6] + sdx, p[7] + sdy));
                });

                outputEdges.forEach((p, el) => {
                    el.setAttribute("d", IOPort.makeConnectionPath(p[0] + sdx, p[1] + sdy, p[6], p[7]));
                });

            }, (ev, handle, root) => {
                const el = handle.parentNode;
                const matrix = el.transform.baseVal.getItem(0).matrix;
                startX = matrix.e;
                startY = matrix.f;
                inputEdges = new Map();
                outputEdges = new Map();

                Array.from(root.querySelectorAll(`.edge[data-destination-node='${el.getAttribute("data-id")}'] .sub-edge`))
                    .forEach((el: SVGElement) => {
                        inputEdges.set(el, el.getAttribute("d").split(" ").map(e => Number(e)).filter(e => !isNaN(e)))
                    });

                Array.from(root.querySelectorAll(`.edge[data-source-node='${el.getAttribute("data-id")}'] .sub-edge`))
                    .forEach((el: SVGElement) => {
                        outputEdges.set(el, el.getAttribute("d").split(" ").map(e => Number(e)).filter(e => !isNaN(e)))
                    });
            }, (ev, target) => {
                const parentNode = Workflow.findParentNode(target);

                const model = this.model.findById(parentNode.getAttribute("data-connection-id"));
                Workflow.setModelPosition(model, newX, newY);

                inputEdges = undefined;
                outputEdges = undefined;
            });
        }

        /**
         * Attach canvas panning
         */
        {
            let pane: SVGElement;
            let x;
            let y;
            let matrix: SVGMatrix;
            this.domEvents.drag(".pan-handle", (dx, dy, ev, el, root) => {

                matrix.e = x + dx;
                matrix.f = y + dy;

            }, (ev, el, root) => {
                pane = root.querySelector(".workflow") as SVGElement;
                matrix = pane.transform.baseVal.getItem(0).matrix;
                x = matrix.e;
                y = matrix.f;
            }, () => {
                pane = undefined;
                matrix = undefined;
            });
        }

        /**
         * Edge Selection
         */
        this.domEvents.on("click", ".edge", (ev, target, root) => {
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
            target.parentElement.append(target);
        });

        this.attachPortDragBehavior();

        this.attachSelectionDeletionBehavior();


    }

    private highlightEdge(el) {
        const sourceNode = el.getAttribute("data-source-node");
        const destNode = el.getAttribute("data-destination-node");
        const sourcePort = el.getAttribute("data-source-port");
        const destPort = el.getAttribute("data-destination-port");

        Array.from(this.workflow.querySelectorAll(
            `.node.${sourceNode} .output-port.${sourcePort}, `
            + `.node.${destNode} .input-port.${destPort}`)).forEach(el => {
            el.classList.add("highlighted");
        });
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
    }

    public translateMouseCoords(x, y) {
        const svg = this.paper.node;
        const wf = svg.querySelector(".workflow");
        const ctm = wf.getScreenCTM();
        const point = svg.createSVGPoint();
        point.x = x;
        point.y = y;

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
            const coords = this.translateMouseCoords(ev.clientX, ev.clientY);
            tipEl.setAttribute("x", coords.x);
            tipEl.setAttribute("y", coords.y - 16);

        }, (ev, target, root) => {
            if (root.querySelector(".dragged")) {
                return;
            }

            const sourceNode = target.getAttribute("data-source-node");
            const destNode = target.getAttribute("data-destination-node");
            const sourcePort = target.getAttribute("data-source-port");
            const destPort = target.getAttribute("data-destination-port");

            const sourceLabel = sourceNode === sourcePort ? sourceNode : `${sourceNode} (${sourcePort})`;
            const destLabel = destNode === destPort ? destNode : `${destNode} (${destPort})`;

            const coords = this.translateMouseCoords(ev.clientX, ev.clientY);

            const ns = "http://www.w3.org/2000/svg";
            tipEl = document.createElementNS(ns, "text");
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
        this.domEvents.on("keyup", (ev: KeyboardEvent) => {
            const selection = Array.from(this.workflow.querySelectorAll(".selected"));
            if (ev.which !== 8 || selection.length === 0) {
                return;
            }

            selection.forEach(el => {
                if (el.classList.contains("step")) {
                    this.model.removeStep(el.getAttribute("data-connection-id"));
                    this.renderModel(this.model);
                } else if (el.classList.contains("edge")) {

                    const sourcePortID = el.getAttribute("data-source-connection");
                    const destinationPortID = el.getAttribute("data-destination-connection");

                    const sourcePort = this.workflow.querySelector(`.port[data-connection-id="${sourcePortID}"]`);
                    const destinationPort = this.workflow.querySelector(`.port[data-connection-id="${destinationPortID}"]`);

                    const sourceNode = Workflow.findParentNode(sourcePort);
                    const destinationNode = Workflow.findParentNode(destinationPort);

                    this.model.disconnect(sourcePortID, destinationPortID);
                    this.renderModel(this.model);
                } else if (el.classList.contains("input"){
                    this.model.removeInput(el.getAttribute("data-connection-id"));
                    this.renderModel(this.model);
                } else if (el.classList.contains("output"){
                    this.model.removeOutput(el.getAttribute("data-connection-id"));
                    this.renderModel(this.model);
                }
            });
        }, window);
    }

    private attachPortDragBehavior() {
        let edge;
        let preferredConnectionPorts;
        let allConnectionPorts;
        let highlightedPort: SVGGElement;
        let edgeDirection: "left" | "right";
        let ioNode: SVGGElement;
        let originNodeCoords;

        this.domEvents.drag(".port", (dx, dy, ev, target) => {
            // Gather the necessary positions that we need in order to draw a path
            const ctm = target.getScreenCTM();
            const coords = this.translateMouseCoords(ev.clientX, ev.clientY);
            const origin = this.translateMouseCoords(ctm.e, ctm.f);
            const nodeToMouseDistance = Geometry.distance(originNodeCoords.x, originNodeCoords.y, coords.x, coords.y);


            // Draw a path from the origin port to the cursor
            Array.from(edge.children).forEach((el: SVGPathElement) => {
                el.setAttribute("d",
                    IOPort.makeConnectionPath(
                        origin.x,
                        origin.y,
                        coords.x,
                        coords.y,
                        edgeDirection
                    )
                );
            });

            const sorted = allConnectionPorts.map(el => {
                const ctm = el.wfCTM;
                el.distance = Geometry.distance(coords.x, coords.y, ctm.e, ctm.f);
                return el;
            }).sort((el1, el2) => {
                return el1.distance - el2.distance
            });

            if (highlightedPort) {
                const parentNode = Workflow.findParentNode(highlightedPort);
                highlightedPort.classList.remove("highlighted", "preferred-port");
                parentNode.classList.remove("highlighted", "preferred-node", edgeDirection);
            }

            ioNode.classList.add("hidden");
            // If there is a port in close proximity, assume that we want to connect to it, so highlight it
            if (sorted.length && sorted[0].distance < 100) {
                highlightedPort = sorted[0];
                highlightedPort.classList.add("highlighted", "preferred-port");
                const parentNode = Workflow.findParentNode(highlightedPort);
                this.workflow.appendChild(parentNode);
                parentNode.classList.add("highlighted", "preferred-node", edgeDirection);
            } else {

                highlightedPort = undefined;

                if (nodeToMouseDistance > 120) {
                    ioNode.classList.remove("hidden");
                    // Otherwise, we might create an input or an ooutput node
                    ioNode.transform.baseVal.getItem(0).setTranslate(coords.x, coords.y);
                } else {
                }
            }
        }, (ev, origin, root) => {
            const originNode = Workflow.findParentNode(origin);
            const originNodeCTM = originNode.getScreenCTM();

            originNodeCoords = this.translateMouseCoords(originNodeCTM.e, originNodeCTM.f);

            const isInputPort = origin.classList.contains("input-port");
            ioNode = GraphNode.createGhostIO();
            this.workflow.appendChild(ioNode);


            // Based on the type of our origin port, determine the direction of the path to draw
            edgeDirection = isInputPort ? "left" : "right";

            // Draw the edge to the cursor and store the element's reference
            edge = GraphEdge.spawn();
            edge.classList.add("dragged");
            this.workflow.appendChild(edge);

            // We need the origin connection ID so we can ask CWLTS for connection recommendations
            const targetConnectionId = origin.getAttribute("data-connection-id");

            // Have a set of all ports of the opposite type, they are all possible destinations
            allConnectionPorts = Array.from(
                this.workflow.querySelectorAll(`.port.${isInputPort ? "output-port" : "input-port"}`)
            ).filter(el => {
                // Except the same node that we are dragging from
                return Workflow.findParentNode(el) !== originNode;
            }).map(el => {

                // Find the position of the port relative to the canvas origin
                el.wfCTM = Geometry.getTransformToElement(el, this.workflow);
                return el;
            });


            // Get all valid connection destinations
            preferredConnectionPorts = (this.model.gatherValidConnectionPoints(targetConnectionId) || [])
            // Take out just the visible ones
                .filter(point => point.isVisible)
                // Find them in the DOM and mark them as connection candidates
                .map(p => {
                    const el = this.workflow.querySelector(`.port[data-connection-id="${p.connectionId}"]`);
                    el.wfCTM = Geometry.getTransformToElement(el, this.workflow);
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
            if (highlightedPort) {
                let sourceID = origin.getAttribute("data-connection-id");
                let destID = highlightedPort.getAttribute("data-connection-id");
                if (sourceID.startsWith("in")) {
                    const tmp = sourceID;
                    sourceID = destID;
                    destID = tmp;
                }

                /**
                 * If an edge with these connection IDs doesn't already exist, create it,
                 * Otherwise, prevent creation.
                 */
                if (!GraphEdge.findEdge(this.workflow, sourceID, destID)) {
                    const newEdge = GraphEdge.spawnBetweenConnectionIDs(this.workflow, sourceID, destID);
                    this.attachEdgeHoverBehavior(newEdge);
                    this.model.connect(sourceID, destID);

                }

                highlightedPort.classList.remove("highlighted");
                highlightedPort = undefined;
            } else if (!ioNode.classList.contains("hidden")) {

                const portID = origin.getAttribute("data-connection-id");
                const newIO = GraphNode.patchModelPorts(portID.startsWith("in")
                    ? this.model.createInputFromPort(portID)
                    : this.model.createOutputFromPort(portID)
                );

                const mouseCoords = this.translateMouseCoords(ev.clientX, ev.clientY);
                const tpl = GraphNode.makeTemplate(mouseCoords.x, mouseCoords.y, newIO);
                const el = TemplateParser.parse(tpl);
                this.workflow.appendChild(el);

                Workflow.setModelPosition(newIO, mouseCoords.x, mouseCoords.y);
                const edge = GraphEdge.spawnBetweenConnectionIDs(this.workflow, portID, newIO.connectionId);
                this.attachEdgeHoverBehavior(edge);
            }

            this.workflow.classList.remove("has-suggestion", "edge-dragging");
            Array.from(this.workflow.querySelectorAll(".connection-suggestion, .preferred-node, .preferred-port")).forEach(el => {
                el.classList.remove("connection-suggestion", "highlighted", "preferred-node", "preferred-port", edgeDirection);
            });

            const selection = this.workflow.querySelector(".selected") as SVGGElement;
            if(selection){
                this.activateSelection(selection);
            }

            edge.remove();
            ioNode.remove();
            edge = undefined;
            ioNode = undefined;
            originNodeCoords = undefined;
            edgeDirection = undefined;
            preferredConnectionPorts = undefined;
        });
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


    static setModelPosition(obj, x, y) {
        const update = {
            "sbg:x": x,
            "sbg:y": y
        };
        if (!obj.customProps) {
            obj.customProps = update;
            return;
        }

        Object.assign(obj.customProps, update);
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
        const pc = {
            pcx: abs.x / this.svgRoot.clientWidth,
            pcy: abs.y / this.svgRoot.clientHeight
        }

        return {...abs, ...pc};
    }

    private activateSelection(el: SVGGElement) {
        this.deselectEverything();

        this.workflow.classList.add("has-selection");

        const nodeID = el.getAttribute("data-id");
        Array.from(this.workflow.querySelectorAll(`.edge.${nodeID}`)).forEach((edge: HTMLElement) => {
            edge.classList.add("highlighted");
            const sourceNodeID = edge.getAttribute("data-source-node");
            const destinationNodeID = edge.getAttribute("data-destination-node");

            Array.from(this.workflow.querySelectorAll(`.node.${sourceNodeID}, .node.${destinationNodeID}`))
                .forEach((el: SVGGElement) => el.classList.add("highlighted"));
        });

        el.classList.add("selected");
    }
}
