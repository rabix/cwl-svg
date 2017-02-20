import {Edge, StepModel, WorkflowModel, WorkflowStepInputModel, WorkflowStepOutputModel} from "cwlts/models";
import {EventHub} from "../utils/event-hub";
import {AppNode} from "./app-node";
import {IOPort} from "./io-port";

Snap.plugin(function (Snap, Element, Paper, glob) {
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

    public readonly eventHub: EventHub;


    constructor(paper: Snap.Paper, model?: WorkflowModel) {
        this.paper = paper;

        const dragRect = this.paper.rect(0, 0, "100%" as any, "100%" as any);
        this.group = this.paper.group().addClass("workflow");

        {

            let originalMatrix;
            dragRect.drag((dx, dy) => {
                this.group.transform(originalMatrix.clone().translate(dx, dy));
            }, () => {
                originalMatrix = this.group.transform().localMatrix;
            }, () => {

            });
        }


        this.eventHub = new EventHub([
            "connection.create",
            "app.create",
            "app.create.input",
            "app.create.output",
            "workflow.arrange",
            "workflow.scale",
            "workflow.fit",
            "workflow.make"
        ]);

        this.attachEvents();

        if (model) {
            this.renderModel(model);
        }
    }

    command(event: string, ...data: any[]) {
        this.eventHub.emit(event, ...data);
    }

    private renderModel(model: WorkflowModel) {
        model.steps.forEach(s => this.command("app.create", s));
        model.outputs.forEach(o => this.command("app.create.output", o);
        model.inputs.forEach(e => this.command("app.create.input", e);
        model.connections.forEach(c => this.command("connection.create", c));
        document.querySelectorAll(".node").forEach(e => Snap(e).toFront());
        this.command("workflow.fit");
    }

    private attachEvents() {

        this.eventHub.on("app.create.input", (input: WorkflowStepInputModel) => {
            this.command("app.create", Object.assign(input, {
                out: [{
                    connectionId: input.connectionId, isVisible: true
                }]
            }))
        });

        this.eventHub.on("app.create.output", (input: WorkflowStepOutputModel) => {
            this.command("app.create", Object.assign(input, {
                in: [{
                    connectionId: input.connectionId, isVisible: true
                }]
            }))
        });

        this.eventHub.on("app.create", (step: StepModel) => {
            const n = new AppNode({
                x: step.customProps["sbg:x"] || Math.random() * 1000,
                y: step.customProps["sbg:y"] || Math.random() * 1000
            }, step, this.paper);
            this.group.add(n.draw());
        });

        this.eventHub.on("connection.create", (connection: Edge) => {

            if (!connection.isVisible || connection.source.type === "Step" || connection.destination.type === "Step") {
                // console.warn("Skipping rendering of an invisible connection.", connection);
                return;
            }

            let [sourceSide, sourceStepId, sourcePort] = connection.source.id.split("/");
            let [destSide, destStepId, destPort] = connection.destination.id.split("/");

            const sourceVertex: Snap.Element = Snap(`.${sourceStepId} .output-port .${sourcePort}`);
            const destVertex: Snap.Element = Snap(`.${destStepId} .input-port .${destPort}`);

            const sourceNode = Snap(`.node.${sourceStepId}`);
            const destNode = Snap(`.node.${destStepId}`);

            if (connection.source.type === connection.destination.type) {
                console.error("Cant draw connection between nodes of the same type.", connection);
                return;
            }

            if (!sourceVertex.node) {
                console.error("Source vertex not found for edge " + connection.source.id, connection);
                return;
            }

            if (!destVertex.node) {
                console.error("Destination vertex not found for edge " + connection.destination.id, connection);
                return;
            }

            let sourceRect = sourceVertex.node.getBoundingClientRect();
            let destRect = destVertex.node.getBoundingClientRect();
            const pathStr = IOPort.makeConnectionPath(sourceRect.left, sourceRect.top, destRect.left, destRect.top);

            const outerPath = this.paper.path(pathStr).addClass(`outer sub-edge`);
            const innerPath = this.paper.path(pathStr).addClass("inner sub-edge");
            const pathGroup = this.paper.group(
                outerPath,
                innerPath
            ).addClass(`edge ${sourceSide}-${sourceStepId} ${destSide}-${destStepId}`);

            this.group.add(pathGroup);

            const hoverClass = "edge-hover";
            pathGroup.hover(() => {
                sourceNode.addClass(hoverClass);
                destNode.addClass(hoverClass);
            }, () => {
                sourceNode.removeClass(hoverClass);
                destNode.removeClass(hoverClass);
            });


        });

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

        this.eventHub.on("workflow.scale", (c) => {
            this.group.transform(new Snap.Matrix().scale(c, c));
            const labelScale = 1 + (1 - c) / (c * 1.5);

            this.paper.node.querySelectorAll(".node .label").forEach(el => {
                Snap(el).transform(`s${labelScale},${labelScale}`);
            });
        });

        this.eventHub.on("workflow.fit", () => {
            let {clientWidth: paperWidth, clientHeight: paperHeight} = this.paper.node;
            let wfBounds = this.group.node.getBoundingClientRect();
            const padding = 200;

            const verticalScale = (wfBounds.height + padding) / paperHeight;
            const horizontalScale = (wfBounds.width + padding) / paperWidth;

            const scaleFactor = Math.max(verticalScale, horizontalScale);

            this.command("workflow.scale", 1 / scaleFactor);

            const moveFactor = scaleFactor;
            let paperBounds = this.paper.node.getBoundingClientRect();
            wfBounds = this.group.node.getBoundingClientRect();

            const moveY = moveFactor * -wfBounds.top + moveFactor * Math.abs(paperBounds.height - wfBounds.height) / 2;
            const moveX = moveFactor * -wfBounds.left + moveFactor * Math.abs(paperBounds.width - wfBounds.width) / 2;

            this.group.transform(this.group.transform().localMatrix.clone().translate(moveX, moveY));
        });
    }
}
