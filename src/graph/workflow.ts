import {Edge, StepModel} from "cwlts/models";
import {EventHub, WorkflowEventType} from "../utils/event-hub";
import {AppNode} from "./app-node";
import {IOPort} from "./io-port";

export class Workflow {
    private paper: Snap.Paper;

    private group: Snap.Element;

    public readonly eventHub: EventHub;


    constructor(paper: Snap.Paper) {
        this.paper = paper;

        this.group = this.paper.group().addClass("workflow");

        this.eventHub = new EventHub();

        this.attachEvents();
    }

    command(event: WorkflowEventType, ...data: any[]) {
        this.eventHub.emit(event, ...data);
    }


    private attachEvents() {
        this.eventHub.on("app.create", (step: StepModel) => {
            const n = new AppNode({
                x: Math.random() * 1000,
                y: Math.random() * 1000
            }, step, this.paper);
            this.group.add(n.draw());
        });

        this.eventHub.on("connection.create", (connection: Edge) => {
            let [sourceSide, sourceStepId, sourcePort] = connection.source.id.split("/");
            let [destSide, destStepId, destPort]       = connection.destination.id.split("/");

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
        });

    }
}
