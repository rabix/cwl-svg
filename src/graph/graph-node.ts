import {InputPort} from "./input-port";
import {OutputPort} from "./output-port";
import {Shape} from "./shape";
import {StepModel, WorkflowInputParameterModel, WorkflowOutputParameterModel} from "cwlts/models";
import Matrix = Snap.Matrix;

export type NodePosition = { x: number, y: number };
export type NodeDataModel = WorkflowInputParameterModel | WorkflowOutputParameterModel | StepModel;

export class GraphNode extends Shape {


    public position: NodePosition = {x: 0, y: 0};

    protected paper: Snap.Paper;

    protected group;

    protected static radius = 40;


    constructor(position: Partial<NodePosition>,
                private dataModel: NodeDataModel,
                paper: Snap.Paper) {

        super();

        this.paper = paper;

        this.dataModel = dataModel;

        Object.assign(this.position, position);
    }

    private makeIconFragment(model) {
        if (model instanceof StepModel) {

            if (model.run.class == "CommandLineTool") {

                return `
                    <g class="icon icon-tool">
                        <path d="M 0 10 h 15"></path>
                        <path d="M -10 10 L 0 0 L -10 -10"></path>
                    </g>
                `;

            } else if (model.run.class === "Workflow") {
                return `
                    <g class="icon icon-workflow">
                        <circle cx="-8" cy="10" r="3"></circle>
                        <circle cx="12" cy="0" r="3"></circle>
                        <circle cx="-8" cy="-10" r="3"></circle>
                        <line x1="-8" y1="10" x2="12" y2="0"></line>
                        <line x1="-8" y1="-10" x2="12" y2="0"></line>
                    </g>
                `;
            }
        }
        return "";
    }

    static makeTemplate(x: number, y: number, dataModel: NodeDataModel): string {

        let nodeTypeClass = "step";
        if (dataModel instanceof WorkflowInputParameterModel) {
            nodeTypeClass = "input";
        } else if (dataModel instanceof WorkflowOutputParameterModel) {
            nodeTypeClass = "output";
        }

        const inputPortTemplates = (dataModel.in || [])
            .filter(p => p.isVisible)
            .sort((a, b) => -a.id.localeCompare(b.id))
            .map((p, i, arr) => GraphNode.makePortTemplate(
                p,
                "input",
                GraphNode.createPortMatrix(arr.length, i, GraphNode.radius, "input").toString()
            ))
            .reduce((acc, tpl) => acc + tpl, "");

        const outputPortTemplates = (dataModel.out || [])
            .filter(p => p.isVisible)
            .sort((a, b) => -a.id.localeCompare(b.id))
            .map((p, i, arr) => GraphNode.makePortTemplate(
                p,
                "output",
                GraphNode.createPortMatrix(arr.length, i, GraphNode.radius, "output").toString()
            ))
            .reduce((acc, tpl) => acc + tpl, "");

        return `
            <g class="node ${dataModel.id} ${nodeTypeClass}"
               data-connection-id="${dataModel.connectionId}"
               transform="matrix(1, 0, 0, 1, ${x}, ${y})"
               data-id="${dataModel.id}">
        
                <g class="drag-handle" transform="matrix(1, 0, 0, 1, 0, 0)">
                    <circle cx="0" cy="0" r="${GraphNode.radius}" class="outer"></circle>
                    <circle cx="0" cy="0" r="${GraphNode.radius * .75}" class="inner"></circle>
                </g>
                <text transform="matrix(1,0,0,1,0,${GraphNode.radius + 30})" class="label">${dataModel.label || dataModel.id}</text>
                ${inputPortTemplates}
                ${outputPortTemplates}
            </g>
        `;
    }

    public draw(): Snap.Element {

        console.log("Drawing snap el");
        this.group.transform(new Snap.Matrix().translate(this.position.x, this.position.y));

        let iconFragment = ``;

        if (this.dataModel instanceof StepModel) {

            if (this.dataModel.run.class == "CommandLineTool") {

                iconFragment = `
                    <g class="icon icon-tool">
                        <path d="M 0 10 h 15"></path>
                        <path d="M -10 10 L 0 0 L -10 -10"></path>
                    </g>
                `;

            } else if (this.dataModel.run.class === "Workflow") {
                iconFragment = `
                    <g class="icon icon-workflow">
                        <circle cx="-8" cy="10" r="3"></circle>
                        <circle cx="12" cy="0" r="3"></circle>
                        <circle cx="-8" cy="-10" r="3"></circle>
                        <line x1="-8" y1="10" x2="12" y2="0"></line>
                        <line x1="-8" y1="-10" x2="12" y2="0"></line>
                    </g>
                `;
            }
        }

        this.group.add(Snap.parse(`
            <g class="drag-handle" transform="matrix(1, 0, 0, 1, 0, 0)">
                <circle cx="0" cy="0" r="${GraphNode.radius}" class="outer"></circle>
                <circle cx="0" cy="0" r="${GraphNode.radius * .8}" class="inner"></circle>
                ${iconFragment}
            </g>
            <text transform="matrix(1,0,0,1,0,${GraphNode.radius + 30})" class="label">${this.dataModel.label || this.dataModel.id}</text>
        `));

        // this.attachEventListeners(this.circleGroup);

        return this.group;
    }

    private static makePortTemplate(port: {
                                        label?: string,
                                        id: string,
                                        connectionId: string
                                    }, type: "input" | "output",
                                    transform = "matrix(1, 0, 0, 1, 0, 0)"): string {

        const portClass = type === "input" ? "input-port" : "output-port";
        const label = port.label || port.id;
        const template = `
            <g class="port ${portClass} ${port.id}" transform="${transform || 'matrix(1, 0, 0, 1, 0, 0)'}"
               data-connection-id="${port.connectionId}"
               data-port-id="${port.id}"
            >
                <g class="io-port ${port.id}">
                    <circle cx="0" cy="0" r="7" class="port-handle"></circle>
                </g>
                <text x="0" y="0" transform="matrix(1,0,0,1,0,0)" class="label unselectable">${label}</text>
            </g>
            
        `;

        return template;
    }

    public addPort(port: OutputPort | InputPort): void {

        const template = GraphNode.makePortTemplate(port);

        this.group.add(Snap.parse(template));

        // Ports should be sorted in reverse to comply with the SBG platform's coordinate positioning
        // portStore = portStore.sort((a, b) => -a.portModel.id.localeCompare(b.portModel.id));

        this.distributePorts();
        // if (portStore.length > 6 && portStore.length <= 20) {
        //
        //     const [a, b] = portStore.slice(-2).map(i => i.group.getBBox());
        //     const overlapping = a.y + a.height >= b.y;
        //     if (overlapping) {
        //         this.scale(1.08);
        //         this.distributePorts();
        //     }
        // }
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
    public distributePorts() {

        const outputs = Array.from(this.group.node.querySelectorAll(".output-port")).map(p => Snap(p));
        const inputs = Array.from(this.group.node.querySelectorAll(".input-port")).map(p => Snap(p));

        const availableAngle = 140;
        let rotationAngle;

        // Distribute output ports
        for (let i = 0; i < outputs.length; i++) {
            rotationAngle =
                // Starting rotation angle
                (-availableAngle / 2) +
                (
                    // Angular offset by element index
                    (i + 1)
                    // Angle between elements
                    * availableAngle / (outputs.length + 1)
                );

            GraphNode.movePortToOuterEdge(outputs[i], rotationAngle, GraphNode.radius);
        }

        // Distribute input ports
        for (let i = 0; i < inputs.length; i++) {
            rotationAngle =
                // Determines the starting rotation angle
                180 - (availableAngle / -2)
                // Determines the angular offset modifier for the current index
                - (i + 1)
                // Determines the angular offset
                * availableAngle / (inputs.length + 1);

            GraphNode.movePortToOuterEdge(inputs[i], rotationAngle, GraphNode.radius);
        }
    }

    public static createPortMatrix(totalPortLength: number,
                                   portIndex: number,
                                   radius: number,
                                   type: "input" | "output"): Snap.Matrix {
        const availableAngle = 140;

        let rotationAngle =
            // Starting rotation angle
            (-availableAngle / 2) +
            (
                // Angular offset by element index
                (portIndex + 1)
                // Angle between elements
                * availableAngle / (totalPortLength + 1)
            );

        if (type === "input") {
            rotationAngle =
                // Determines the starting rotation angle
                180 - (availableAngle / -2)
                // Determines the angular offset modifier for the current index
                - (portIndex + 1)
                // Determines the angular offset
                * availableAngle / (totalPortLength + 1);
        }

        return new Snap.Matrix()
            .rotate(rotationAngle, 0, 0)
            .translate(radius, 0)
            .rotate(-rotationAngle, 0, 0);
    }

    public static createGhostIO() {

        const ns = "http://www.w3.org/2000/svg";
        const node = document.createElementNS(ns, "g");
        node.setAttribute("transform", "matrix(1,0,0,1,0,0)");
        node.classList.add("ghost", "node");
        node.innerHTML = `
            <circle class="ghost-circle" cx="0" cy="0" r="${GraphNode.radius / 1.5}"></circle
        `;
        return node;
    }

    static patchModelPorts<T>(model: T): T {
        const patch = [{connectionId: model.connectionId, isVisible: true, id: model.id}];
        if (model instanceof WorkflowInputParameterModel) {
            const copy = Object.create(model);
            return Object.assign(copy, {out: patch});


        } else if (model instanceof WorkflowOutputParameterModel) {
            const copy = Object.create(model);
            return Object.assign(copy, {in: patch});
        }

        return model;
    }

}