import {WorkflowStepInputModel} from "cwlts/models";
import {WorkflowStepOutputModel} from "cwlts/models";
import {InputPort} from "./input-port";
import {Shape} from "./shape";

export class IOPort extends Shape {

    public group: Snap.Element;

    protected paper: Snap.Paper;

    private radius = 5;

    private connection: Snap.Element;
    private connectionFormat = "M {x1} {y1}, C {bx1} {by1} {bx2} {by2} {x2} {y2}";

    public portModel: WorkflowStepInputModel | WorkflowStepOutputModel;

    protected handle: Snap.Element;
    protected title: Snap.Element;

    protected drawingElements = {

        circleGroup: null,
        innerCircle: null,
        outerCircle: null,

        title: null
    };

    constructor(paper: Snap.Paper, portModel) {
        super();
        this.paper     = paper;
        this.portModel = portModel;
    }

    protected drawHandle(): Snap.Element {

        const [,,id] = this.portModel.connectionId.split("/");
        const outer = this.paper.circle(0, 0, this.radius).addClass("port-handle");

        return this.paper.group(outer).addClass(`io-port ${id}`);
    }

    protected drawTitle(content) {
        return this.paper.text(0, 0, content);
    }

    draw(): Snap.Element {
        this.handle = this.drawHandle();
        const [,,id] = this.portModel.connectionId.split("/");
        this.title = this.drawTitle(id).addClass("label unselectable");

        this.drawingElements.circleGroup = this.handle;

        this.group = this.paper.group(
            this.drawingElements.circleGroup,
            this.title
        ).addClass("port");

        // this.attachEventListeners(this.drawingElements.circleGroup);
        // this.attachDrop();

        return this.group;
    }

    private attachDragBehaviour(el: Snap.Element) {

        let path;
        let rect;

        el.drag((dx, dy, mx, my, ev) => {
            path.attr({
                path: Snap.format(this.connectionFormat, {
                    x1: rect.left,
                    y1: rect.top,
                    bx1: (rect.left + mx) / 2,
                    by1: rect.top,
                    bx2: (rect.left + mx) / 2,
                    by2: my,
                    x2: mx,
                    y2: my
                })
            });
        }, (x, y, ev) => {

            rect = el.node.getBoundingClientRect();
            path = this.paper.path(Snap.format(this.connectionFormat, {
                x1: rect.left,
                y1: rect.top,
                bx1: rect.left,
                by1: rect.top,
                bx2: rect.left,
                by2: rect.top,
                x2: rect.left,
                y2: rect.top
            })).attr({
                fill: "none",
                stroke: "gray",
                strokeWidth: 2,
                id: (this.constructor.name)
            });
        }, (ev: any) => {

            path.remove();
        });
    }

    private attachDrop() {
        this.group.mouseup((ev) => {
        });
    }

    public static makeConnectionPath(x1, y1, x2, y2, forceDirection = true): string {

        if (!forceDirection) {
            return `M ${x1} ${y1}, C ${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;
        }
        const outDir = x1 + Math.abs(x1 - x2) / 2;
        const inDir  = x2 - Math.abs(x1 - x2) / 2;


        return `M ${x1} ${y1}, C ${outDir} ${y1} ${inDir} ${y2} ${x2} ${y2}`;

    }

    private makePathStringBetween(x1, y1, x2, y2) {
        return Snap.format(this.connectionFormat, {
            x1,
            y1,
            bx1: (x1 + x2) / 2,
            by1: y1,
            bx2: (x1 + x2) / 2,
            by2: y2,
            x2,
            y2
        });
    }

    protected getClass() {
        return "port";
    }

    public connectTo(port: IOPort) {
        if (this.connection) {
            this.connection.remove();
            this.connection = undefined;
        }
        const thisRect  = this.group.node.getBoundingClientRect();
        const otherRect = port.group.node.getBoundingClientRect();

        this.connection = this.paper.path(this.makePathStringBetween(
            thisRect.left,
            thisRect.top,
            otherRect.left,
            otherRect.top
        )).attr({
            fill: "none",
            stroke: "gray",
            strokeWidth: 2
        });
    }
}