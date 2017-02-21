import {InputPort} from "./input-port";
import {IOPort} from "./io-port";
import {OutputPort} from "./output-port";
import {Shape} from "./shape";
import Matrix = Snap.Matrix;
import {WorkflowInputParameterModel, WorkflowOutputParameterModel} from "cwlts/models";

export type NodePosition = { x: number, y: number };

export class GraphNode extends Shape {


    public position: NodePosition = {x: 0, y: 0};

    protected inputs: InputPort[] = [];

    protected outputs: OutputPort[] = [];

    protected paper: Snap.Paper;

    protected group;

    protected radius = 40;

    private circleGroup: Snap.Element;

    private dataModel: {
        id: string,
    };

    private name: Snap.Element;

    constructor(position: Partial<NodePosition>, dataModel: { id: string }, paper: Snap.Paper) {

        super();

        this.paper = paper;

        let nodeTypeClass = "step";
        if (dataModel instanceof WorkflowInputParameterModel) {
            nodeTypeClass = "input";
        } else if (dataModel instanceof WorkflowOutputParameterModel) {
            nodeTypeClass = "output";
        }

        this.group = this.paper.g().addClass(`node ${dataModel.id} ${nodeTypeClass}`).attr({
            "data-id": dataModel.id
        });
        this.dataModel = dataModel;

        Object.assign(this.position, position);
    }

    public draw(): Snap.Element {

        this.group.transform(new Snap.Matrix().translate(this.position.x, this.position.y));

        const outerCircle = this.paper.circle(0, 0, this.radius).addClass("outer");

        const innerCircle = this.paper.circle(0, 0, this.radius * .8).addClass("inner");

        this.name = this.paper.text(0, this.radius + 30, this.dataModel.id).addClass("label");


        this.circleGroup = this.paper.group(outerCircle, innerCircle).transform("").addClass("drag-handle");

        this.group.add(this.circleGroup, this.name);

        this.attachDragBehaviour(this.circleGroup);

        return this.group;
    }

    public scale(coef: number) {
        this.circleGroup.transform(this.circleGroup.matrix.clone().scale(coef, coef));
        this.radius = this.circleGroup.getBBox().width / 2;
        this.name.attr({
            y: this.radius + 30
        })

    }

    public create<T>(portType: new (...args: any[]) => T, options): T {
        switch (portType as any) {
            case InputPort:
            case OutputPort:
                return new portType(this.paper, options);
            default:
                throw new Error("Cannot create IOPort of type: " + portType);
        }

    }

    protected attachDragBehaviour(el) {

        let groupBBox;
        let localMatrix;
        let globalMatrix;
        let inputEdges = new Map<Snap.Element, any>();
        let outputEdges = new Map<Snap.Element, any>();
        let scaleReverse;

        el.drag((dx: number, dy: number) => {

            const moveX = dx * scaleReverse;
            const moveY = dy * scaleReverse;

            this.group.transform(localMatrix.clone().translate(moveX, moveY));
            inputEdges.forEach((path, edge) => {
                edge.attr({
                    d: IOPort.makeConnectionPath(path[0][1], path[0][2], path[1][5] + moveX, path[1][6] + moveY)
                })
            });
            outputEdges.forEach((path, edge) => {
                edge.attr({
                    d: IOPort.makeConnectionPath(path[0][1] + moveX, path[0][2] + moveY, path[1][5], path[1][6])
                })
            })
        }, (x, y, ev) => {
            groupBBox = this.group.getBBox();
            localMatrix = this.group.transform().localMatrix;
            globalMatrix = this.group.transform().globalMatrix;
            scaleReverse = 1 / globalMatrix.get(3);

            document.querySelectorAll(`.in-${this.dataModel.id} .sub-edge`)
                .forEach(edge => {
                    inputEdges.set(Snap(edge), Snap.parsePathString(edge.getAttribute("d")));
                });

            document.querySelectorAll(`.out-${this.dataModel.id} .sub-edge`)
                .forEach(edge => {
                    outputEdges.set(Snap(edge), Snap.parsePathString(edge.getAttribute("d")));
                });

            this.group.addClass("dragging");
            this.group.toFront();
        }, (ev) => {
            inputEdges.clear();
            outputEdges.clear();
            this.group.removeClass("dragging")
        });
    }

    public addPort(port: OutputPort | InputPort): void {

        let portClass = "input-port";
        let portStore: any[] = this.inputs;

        if (port instanceof OutputPort) {
            portClass = "output-port";
            portStore = this.outputs;
        }

        const drawn = port.draw().addClass(portClass);
        this.group.add(drawn);

        portStore.push(port);

        this.distributePorts();


        if (portStore.length > 6 && portStore.length <= 20) {

            const [a, b] = portStore.slice(-2).map(i => i.group.getBBox());
            const overlapping = a.y + a.height >= b.y;
            if (overlapping) {
                this.scale(1.08);
                this.distributePorts();
            }
        }
    }

    /**
     * Moves the element to the outer edge of the node given an angle and the node radius
     * @param el Element to move
     * @param angle Angle along which the element should be moved
     * @param radius Radius of the parent node
     */
    private static movePortToOuterEdge(el: Snap.Element, angle: number, radius: number) {
        el // Remove previous transformations, bring it to the center
            .transform(new Snap.Matrix()
                // Then rotate it to a necessary degree
                    .rotate(angle, 0, 0)
                    // And translate it to the border of the circle
                    .translate(radius, 0)
                    // Then rotate it back
                    .rotate(-angle, 0, 0)
            );
    }

    /**
     * Repositions input and output ports to their designated places on the outer edge
     * of the node and scales the node in the process if necessary.
     */
    private distributePorts() {
        const availableAngle = 140;
        let rotationAngle;

        // Distribute output ports
        for (let i = 0; i < this.outputs.length; i++) {
            rotationAngle =
                // Starting rotation angle
                (-availableAngle / 2) +
                (
                    // Angular offset by element index
                    (i + 1)
                    // Angle between elements
                    * availableAngle / (this.outputs.length + 1)
                );

            GraphNode.movePortToOuterEdge(this.outputs[i].group, rotationAngle, this.radius);
        }

        // Distribute input ports
        for (let i = 0; i < this.inputs.length; i++) {
            rotationAngle =
                // Determines the starting rotation angle
                180 - (availableAngle / -2)
                // Determines the angular offset modifier for the current index
                - (i + 1)
                // Determines the angular offset
                * availableAngle / (this.inputs.length + 1);

            GraphNode.movePortToOuterEdge(this.inputs[i].group, rotationAngle, this.radius);
        }
    }
}