import {InputPort} from "./input-port";
import {OutputPort} from "./output-port";
import {Shape} from "./shape";
import {StepModel, WorkflowInputParameterModel, WorkflowOutputParameterModel} from "cwlts/models";
import Matrix = Snap.Matrix;
import {IOPort} from "./io-port";

export type NodePosition = { x: number, y: number };
export type NodeDataModel = WorkflowInputParameterModel | WorkflowOutputParameterModel | StepModel;

export class GraphNode extends Shape {


    public position: NodePosition = {x: 0, y: 0};

    protected paper: Snap.Paper;

    protected group;

    protected static radius = 30;

    constructor(position: Partial<NodePosition>,
                private dataModel: NodeDataModel,
                paper: Snap.Paper) {

        super();

        this.paper = paper;

        this.dataModel = dataModel;

        Object.assign(this.position, position);
    }

    /**
     * @FIXME Making icons increases the rendering time by 50-100%. Try embedding the SVG directly.
     */

    private static workflowIconSvg: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" x="-9" y="-9" width="20" height="20"><title>workflow_new</title><circle cx="400.5" cy="249.5" r="99.5"/><circle cx="99.5" cy="99.5" r="99.5"/><circle cx="99.5" cy="400.5" r="99.5"/><g id="Layer_4" data-name="Layer 4"><line x1="99" y1="99" x2="400" y2="249" style="fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:40px"/><line x1="99" y1="400" x2="400" y2="249" style="fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:40px"/></g></svg>';
    private static toolIconSvg: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500.07 500.24" x="-10" y="-10" width="20" height="20"><title>tool_new</title><rect x="284.07" y="450.07" width="216" height="50"/><rect x="-34.14" y="117.56" width="353.4" height="50" transform="translate(142.62 -58.98) rotate(45)"/><rect x="-34.15" y="332.53" width="353.47" height="50" transform="translate(496.28 509.58) rotate(135)"/></svg>';
    private static fileInputIconSvg: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 499 462.86" y="-10" x="-11" width="20" height="20"><title>file_input</title><g id="Layer_16" data-name="Layer 16"><polygon points="386.06 0 386.06 0 175 0 175 58.29 225 108.29 225 50 365.35 50 449 133.65 449 412.86 225 412.86 225 353.71 175 403.71 175 462.86 499 462.86 499 112.94 386.06 0"/></g><g id="Layer_7_copy" data-name="Layer 7 copy"><polyline points="498.78 138.76 362.93 138.38 362.81 138.38 362.81 1.06" style="fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:50px"/></g><g id="Layer_11_copy" data-name="Layer 11 copy"><polyline points="159 327 255 231 160 136" style="fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:50px"/><g id="Layer_9_copy_2" data-name="Layer 9 copy 2"><line y1="231" x2="255" y2="231" style="fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:50px"/></g></g></svg>';
    private static fileOutputIconSvg: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 507.36 462.86" x="-9" y="-10" width="20" height="20"><title>file_output</title><g id="Layer_10" data-name="Layer 10"><g id="Layer_9_copy" data-name="Layer 9 copy"><polygon points="274 298.5 274 412.86 50 412.86 50 50 190.35 50 274 133.65 274 163.5 324 163.5 324 112.94 211.06 0 211.06 0 0 0 0 462.86 324 462.86 324 298.5 274 298.5"/></g></g><g id="Layer_7" data-name="Layer 7"><polyline points="323.78 138.76 187.93 138.38 187.81 138.38 187.81 1.06" style="fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:50px"/></g><g id="Layer_11" data-name="Layer 11"><polyline points="376 327 472 231 377 136" style="fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:50px"/><g id="Layer_9" data-name="Layer 9"><line x1="217" y1="231" x2="472" y2="231" style="fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:50px"/></g></g></svg>';
    private static inputIconSvg: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 499 365" x="-11" y="-10" width="20" height="20"><title>type_input</title><g id="input"><path d="M316.5,68a181.72,181.72,0,0,0-114.12,40.09L238,143.72a132.5,132.5,0,1,1,1.16,214.39L203.48,393.8A182.5,182.5,0,1,0,316.5,68Z" transform="translate(0 -68)"/><g id="Layer_22" data-name="Layer 22"><g id="Layer_9_copy_4" data-name="Layer 9 copy 4"><polygon points="290.36 182 176.68 295.68 141.32 260.32 194.64 207 0 207 0 157 194.64 157 142.32 104.68 177.68 69.32 290.36 182"/></g></g></g></svg>';
    private static outputIconSvg: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500.36 365" x="-9" y="-10" width="20" height="20"><title>type_output</title><g id="output"><path d="M291.95,325.23a134,134,0,0,1-15.76,19,132.5,132.5,0,1,1,0-187.38,133.9,133.9,0,0,1,16.16,19.55l35.81-35.81A182.5,182.5,0,1,0,327.73,361Z" transform="translate(0 -68)"/><g id="circle_source_copy" data-name="circle source copy"><g id="Layer_22_copy" data-name="Layer 22 copy"><g id="Layer_9_copy_5" data-name="Layer 9 copy 5"><polygon points="500.36 182 386.68 295.68 351.32 260.32 404.64 207 210 207 210 157 404.64 157 352.32 104.68 387.68 69.32 500.36 182"/></g></g></g></g></svg>';
    private static makeIconFragment(model) {
        const modelType = model instanceof StepModel ? "step" :
            model instanceof WorkflowInputParameterModel ? "output" :
                model instanceof WorkflowOutputParameterModel ? "input" : "";
        let iconStr;

        if (modelType === "step") {
            iconStr = model.run && model.run.class === "Workflow" ? this.workflowIconSvg :
                model.run && model.run.class === "CommandLineTool" ? this.toolIconSvg : "";

        }
        else if (modelType === "input") {
            iconStr = model.type && model.type.type === "File" ||
            model.type.type === "array" ? this.fileInputIconSvg :
                this.inputIconSvg;
        }
        else if (modelType === "output") {
            iconStr = model.type && model.type.type === "File" ||
            model.type.type === "array" ? this.fileOutputIconSvg :
                this.outputIconSvg;
        }

        if (!modelType.length || !iconStr.length) {
            return "";
        }

        return iconStr;
    }

    static makeTemplate(x: number, y: number, dataModel: NodeDataModel & { in: any[], out: any[] }): string {

        let nodeTypeClass = "step";
        if (dataModel instanceof WorkflowInputParameterModel) {
            nodeTypeClass = "input";
        } else if (dataModel instanceof WorkflowOutputParameterModel) {
            nodeTypeClass = "output";
        }

        const inputs   = (dataModel.in || []).filter(p => p.isVisible);
        const outputs  = (dataModel.out || []).filter(p => p.isVisible);
        const maxPorts = Math.max(inputs.length, outputs.length);
        const radius   = GraphNode.radius + maxPorts * IOPort.radius;


        const inputPortTemplates = inputs
            .sort((a, b) => -a.id.localeCompare(b.id))
            .map((p, i, arr) => GraphNode.makePortTemplate(
                p,
                "input",
                GraphNode.createPortMatrix(arr.length, i, radius, "input").toString()
            ))
            .reduce((acc, tpl) => acc + tpl, "");

        const outputPortTemplates = outputs
            .sort((a, b) => -a.id.localeCompare(b.id))
            .map((p, i, arr) => GraphNode.makePortTemplate(
                p,
                "output",
                GraphNode.createPortMatrix(arr.length, i, radius, "output").toString()
            ))
            .reduce((acc, tpl) => acc + tpl, "");


        return `
            <g tabindex="-1" class="node ${dataModel.id} ${nodeTypeClass}"
               data-connection-id="${dataModel.connectionId}"
               transform="matrix(1, 0, 0, 1, ${x}, ${y})"
               data-id="${dataModel.id}">
                <g class="drag-handle" transform="matrix(1, 0, 0, 1, 0, 0)">
                    <circle cx="0" cy="0" r="${radius}" class="outer"></circle>
                    <circle cx="0" cy="0" r="${radius * .75}" class="inner"></circle>
                    ${GraphNode.makeIconFragment(dataModel)}
                </g>
                <text transform="matrix(1,0,0,1,0,${radius + 30})" class="title label">${dataModel.label || dataModel.id}</text>
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
        const label     = port.label || port.id;
        const template  = `
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
        const inputs  = Array.from(this.group.node.querySelectorAll(".input-port")).map(p => Snap(p));

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

        const ns   = "http://www.w3.org/2000/svg";
        const node = document.createElementNS(ns, "g");
        node.setAttribute("transform", "matrix(1,0,0,1,0,0)");
        node.classList.add("ghost", "node");
        node.innerHTML = `
            <circle class="ghost-circle" cx="0" cy="0" r="${GraphNode.radius / 1.5}"></circle>
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