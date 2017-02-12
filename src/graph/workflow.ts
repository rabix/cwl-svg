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

            const sourceVertex: Snap.Element = new Snap(`.${sourceStepId} .output-port .${sourcePort}`);
            const destVertex: Snap.Element   = new Snap(`.${destStepId} .input-port .${destPort}`);

            if (connection.source.type === connection.destination.type) {
                console.error("Cant draw connection between nodes of the same type.", connection);
                return;
            }

            if (!sourceVertex.node) {
                console.error("Source vertex not found for edge.", connection);
                return;
            }

            if (!destVertex.node) {
                console.error("Destination vertex not found for edge", connection);
                return;
            }

            let sourceRect = sourceVertex.node.getBoundingClientRect();
            let destRect   = destVertex.node.getBoundingClientRect();
            const pathStr  = IOPort.makeConnectionPath(sourceRect.left, sourceRect.top, destRect.left, destRect.top);


            const outerPath = this.paper.path(pathStr).addClass(`outer sub-edge`);
            const innerPath = this.paper.path(pathStr).addClass("inner sub-edge");

            this.group.add(
                this.paper.group(
                    outerPath,
                    innerPath
                ).addClass(`edge ${sourceSide}-${sourceStepId} ${destSide}-${destStepId}`)
            );

        });

        this.eventHub.on("workflow.arrange", (connections: Edge[]) => {
            const tracker = {};
            const zones   = {};
            const width   = this.paper.node.clientWidth;
            const height  = this.paper.node.clientHeight;

            connections.forEach(c => {

                const [, sName] = c.source.id.split("/");
                const [, dName] = c.destination.id.split("/");

                tracker[sName] || (tracker[sName] = []);
                (tracker[dName] || (tracker[dName] = [])).push(tracker[sName]);
            });

            const trace = arr => 1 + ( arr.length ? Math.max(...arr.map(trace)) : 0);

            for (let k in tracker) {
                const zone = trace(tracker[k]) - 1;
                (zones[zone] || (zones[zone] = [])).push(Snap(`.node.${k}`));
            }

            const columnCount = Object.keys(zones).length + 1;
            const columnWidth = (width / columnCount);

            for (let z in zones) {
                const rowCount  = zones[z].length + 1;
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
