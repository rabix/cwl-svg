import {
    Edge,
    StepModel,
    WorkflowInputParameterModel,
    WorkflowModel,
    WorkflowOutputParameterModel,
    WorkflowStepInputModel,
    WorkflowStepOutputModel
} from "cwlts/models";
import "snapsvg-cjs";
import {EventHub} from "../utils/event-hub";
import {AppNode} from "./app-node";
import {GraphNode} from "./graph-node";
import {Edge as GraphEdge} from "./edge";
import {DomEvents} from "../utils/dom-events";
import {IOPort} from "./io-port";
import {Geometry} from "../utils/geometry";

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

    private domEvents;

    private workflow: SVGElement;

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

            this.command("workflow.scale", newScale);
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

        const nodes = [...model.steps, ...model.inputs, ...model.outputs].filter(n => n.isVisible);
        const graphNodes = nodes.map(n => {
            const patch = [{connectionId: n.connectionId, isVisible: true, id: n.id}];

            if (n instanceof WorkflowInputParameterModel) {
                const copy = Object.create(n);
                return Object.assign(copy, {out: patch});


            } else if (n instanceof WorkflowOutputParameterModel) {
                const copy = Object.create(n);
                return Object.assign(copy, {in: patch});
            }

            return n;
        }).map((node) => new GraphNode({
                x: node.customProps["sbg:x"] || Math.random() * 500,
                y: node.customProps["sbg:y"] || Math.random() * 500
            }, node, this.paper)
        );

        const nodesTpl = graphNodes.reduce((tpl, node) => tpl + node.makeTemplate(), "");
        this.workflow.innerHTML += nodesTpl;

        const edgesTpl = model.connections.map(c => GraphEdge.makeTemplate(c, this.paper)).reduce((acc, tpl) => acc + tpl, "");
        this.workflow.innerHTML += edgesTpl;
        console.timeEnd("Graph Rendering");
        console.time("Ordering");
        document.querySelectorAll(".node").forEach(e => Snap(e).toFront());
        console.timeEnd("Ordering");
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
            const n = new AppNode({
                x: step.customProps["sbg:x"] || Math.random() * 1000,
                y: step.customProps["sbg:y"] || Math.random() * 1000
            }, step, this.paper);

            this.workflow.innerHTML += n.makeTemplate();
        });

        /**
         * @name connection.create
         */
        this.eventHub.on("connection.create", (connection: Edge) => {

            this.workflow.innerHTML += GraphEdge.makeTemplate(connection, this.paper);
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
        this.eventHub.on("workflow.scale", (c) => {

            this.scale = c;
            const oldMatrix = this.group.transform().localMatrix.split();

            this.group.transform(new Snap.Matrix().add(c, 0, 0, c, oldMatrix.dx, oldMatrix.dy));
            const labelScale = 1 + (1 - c) / (c * 2);

            this.paper.node.querySelectorAll(".node .label").forEach(el => {
                Snap(el).transform(`s${labelScale},${labelScale}`);
            });
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
        this.domEvents.on("click", ".node", (ev, el, root) => {
            this.deselectEverything();

            this.workflow.classList.add("has-selection");

            const nodeID = el.getAttribute("data-id");
            Array.from(root.querySelectorAll(`.edge.${nodeID}`)).forEach((edge: HTMLElement) => {
                edge.classList.add("highlighted");
                const sourceNodeID = edge.getAttribute("data-source-node");
                const destinationNodeID = edge.getAttribute("data-destination-node");

                Array.from(root.querySelectorAll(`.node.${sourceNodeID}, .node.${destinationNodeID}`)).forEach(el => {
                    el.classList.add("highlighted");
                });

            });

            el.classList.add("selected");
        });


        /**
         * Move nodes and edges on drag
         */
        {
            let startX: number;
            let startY: number;
            let inputEdges: Map<SVGElement, number[]>;
            let outputEdges: Map<SVGElement, number[]>;

            this.domEvents.drag(".node .drag-handle", (dx, dy, ev, handle: SVGElement) => {
                const el = handle.parentNode;
                const sdx = this.adaptToScale(dx);
                const sdy = this.adaptToScale(dy);
                el.transform.baseVal.getItem(0).setTranslate(
                    startX + sdx,
                    startY + sdy
                );

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
            }, () => {
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
                pane.transform.baseVal.getItem(0).setMatrix(matrix);

            }, (ev, el, root) => {
                pane = root.querySelector(".workflow") as SVGElement;
                matrix = pane.transform.baseVal.getItem(0).matrix.scale(1);
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

        /**
         * Drag a path from the port
         */
        {
            let edge;
            let subEdges;
            let connectionPorts;
            let highlightedNode;
            let edgeDirection;

            this.domEvents.drag(".port", (dx, dy, ev, target) => {
                const ctm = target.getScreenCTM();
                const coords = this.translateMouseCoords(ev.clientX, ev.clientY);
                const origin = this.translateMouseCoords(ctm.e, ctm.f);
                subEdges.forEach(el => {
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

                const sorted = connectionPorts.map(el => {
                    const ctm = el.wfCTM;
                    el.distance = Geometry.distance(coords.x, coords.y, ctm.e, ctm.f);
                    return el;
                }).sort((el1, el2) => {
                    return el1.distance - el2.distance
                });

                if (highlightedNode) {
                    highlightedNode.classList.remove("highlighted");
                }
                if (sorted.length && sorted[0].distance < 150) {
                    highlightedNode = sorted[0];
                    highlightedNode.classList.add("highlighted");
                }

            }, (ev, target, root) => {
                edgeDirection = target.classList.contains("input-port") ? "left" : "right";
                edge = GraphEdge.spawn();
                edge.classList.add("eventless", "dragged");
                this.workflow.appendChild(edge);
                subEdges = Array.from(edge.querySelectorAll(".sub-edge"));

                const targetConnectionId = target.getAttribute("data-connection-id");
                connectionPorts = (this.model.gatherValidConnectionPoints(targetConnectionId) || [])
                    .filter(point => point.isVisible)
                    .map(p => {
                        const el = this.workflow.querySelector(`[data-connection-id="${p.connectionId}"]`);
                        el.wfCTM = Geometry.getTransformToElement(el, this.workflow);
                        el.classList.add("connection-candidate");
                        return el;
                    });

                connectionPorts.forEach(el => {
                    let parentNode;
                    while ((parentNode = el.parentNode) && !parentNode.classList.contains("node"));
                    parentNode.classList.add("highlighted", "connection-candidate");
                });
                this.workflow.classList.add("has-selection", "edge-dragging");

            }, (ev, target) => {


                if (highlightedNode) {
                    const sourceID = target.getAttribute("data-connection-id");
                    const destID = highlightedNode.getAttribute("data-connection-id");

                    /**
                     * If an edge with these connection IDs doesn't already exist, create it,
                     * Otherwise, prevent creation.
                     */
                    if (!GraphEdge.findEdge(this.workflow, sourceID, destID)) {
                        const newEdge = GraphEdge.spawnBetweenConnectionIDs(this.workflow, sourceID, destID);
                        this.attachEdgeHoverBehavior(newEdge);
                    }

                    highlightedNode.classList.remove("highlighted");
                    highlightedNode = undefined;
                }

                Array.from(this.workflow.querySelectorAll(".connection-candidate")).forEach(el => {
                    el.classList.remove("connection-candidate", "highlighted");
                });
                this.workflow.classList.remove("has-selection", "edge-dragging");

                edgeDirection = undefined;
                edge.remove();
                edge = undefined;
                subEdges = undefined;
                connectionPorts = undefined;
            });

        }

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
            const coords = this.translateMouseCoords(ev.clientX, ev.clientY);
            tipEl.setAttribute("x", coords.x);
            tipEl.setAttribute("y", coords.y - 16);

        }, (ev, target) => {
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
}
