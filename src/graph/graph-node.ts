import {ParameterTypeModel, StepModel, WorkflowInputParameterModel, WorkflowOutputParameterModel} from "cwlts/models";
import {HtmlUtils} from "../utils/html-utils";
import {SVGUtils} from "../utils/svg-utils";
import {IOPort} from "./io-port";

export type NodePosition = { x: number, y: number };
export type NodeDataModel = WorkflowInputParameterModel | WorkflowOutputParameterModel | StepModel;

export class GraphNode {

    public position: NodePosition = {x: 0, y: 0};

    static radius = 30;

    constructor(position: Partial<NodePosition>,
                private dataModel: NodeDataModel) {

        this.dataModel = dataModel;

        Object.assign(this.position, position);
    }

    /**
     * @FIXME Making icons increases the rendering time by 50-100%. Try embedding the SVG directly.
     */

    private static workflowIconSvg: string   = "<svg class=\"node-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 500 500\" x=\"-9\" y=\"-9\" width=\"20\" height=\"20\"><title>workflow_new</title><circle cx=\"400.5\" cy=\"249.5\" r=\"99.5\"/><circle cx=\"99.5\" cy=\"99.5\" r=\"99.5\"/><circle cx=\"99.5\" cy=\"400.5\" r=\"99.5\"/><g id=\"Layer_4\" data-name=\"Layer 4\"><line x1=\"99\" y1=\"99\" x2=\"400\" y2=\"249\" style=\"fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:40px\"/><line x1=\"99\" y1=\"400\" x2=\"400\" y2=\"249\" style=\"fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:40px\"/></g></svg>";
    private static toolIconSvg: string       = "<svg class=\"node-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 500.07 500.24\" x=\"-10\" y=\"-10\" width=\"20\" height=\"20\"><title>tool_new</title><rect x=\"284.07\" y=\"450.07\" width=\"216\" height=\"50\"/><rect x=\"-34.14\" y=\"117.56\" width=\"353.4\" height=\"50\" transform=\"translate(142.62 -58.98) rotate(45)\"/><rect x=\"-34.15\" y=\"332.53\" width=\"353.47\" height=\"50\" transform=\"translate(496.28 509.58) rotate(135)\"/></svg>";
    private static fileInputIconSvg: string  = "<svg class=\"node-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 499 462.86\" y=\"-10\" x=\"-11\" width=\"20\" height=\"20\"><title>file_input</title><g id=\"Layer_16\" data-name=\"Layer 16\"><polygon points=\"386.06 0 386.06 0 175 0 175 58.29 225 108.29 225 50 365.35 50 449 133.65 449 412.86 225 412.86 225 353.71 175 403.71 175 462.86 499 462.86 499 112.94 386.06 0\"/></g><g id=\"Layer_7_copy\" data-name=\"Layer 7 copy\"><polyline points=\"498.78 138.76 362.93 138.38 362.81 138.38 362.81 1.06\" style=\"fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:50px\"/></g><g id=\"Layer_11_copy\" data-name=\"Layer 11 copy\"><polyline points=\"159 327 255 231 160 136\" style=\"fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:50px\"/><g id=\"Layer_9_copy_2\" data-name=\"Layer 9 copy 2\"><line y1=\"231\" x2=\"255\" y2=\"231\" style=\"fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:50px\"/></g></g></svg>";
    private static fileOutputIconSvg: string = "<svg class=\"node-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 507.36 462.86\" x=\"-9\" y=\"-10\" width=\"20\" height=\"20\"><title>file_output</title><g id=\"Layer_10\" data-name=\"Layer 10\"><g id=\"Layer_9_copy\" data-name=\"Layer 9 copy\"><polygon points=\"274 298.5 274 412.86 50 412.86 50 50 190.35 50 274 133.65 274 163.5 324 163.5 324 112.94 211.06 0 211.06 0 0 0 0 462.86 324 462.86 324 298.5 274 298.5\"/></g></g><g id=\"Layer_7\" data-name=\"Layer 7\"><polyline points=\"323.78 138.76 187.93 138.38 187.81 138.38 187.81 1.06\" style=\"fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:50px\"/></g><g id=\"Layer_11\" data-name=\"Layer 11\"><polyline points=\"376 327 472 231 377 136\" style=\"fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:50px\"/><g id=\"Layer_9\" data-name=\"Layer 9\"><line x1=\"217\" y1=\"231\" x2=\"472\" y2=\"231\" style=\"fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:50px\"/></g></g></svg>";
    private static inputIconSvg: string      = "<svg class=\"node-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 499 365\" x=\"-11\" y=\"-10\" width=\"20\" height=\"20\"><title>type_input</title><g id=\"input\"><path d=\"M316.5,68a181.72,181.72,0,0,0-114.12,40.09L238,143.72a132.5,132.5,0,1,1,1.16,214.39L203.48,393.8A182.5,182.5,0,1,0,316.5,68Z\" transform=\"translate(0 -68)\"/><g id=\"Layer_22\" data-name=\"Layer 22\"><g id=\"Layer_9_copy_4\" data-name=\"Layer 9 copy 4\"><polygon points=\"290.36 182 176.68 295.68 141.32 260.32 194.64 207 0 207 0 157 194.64 157 142.32 104.68 177.68 69.32 290.36 182\"/></g></g></g></svg>";
    private static outputIconSvg: string     = "<svg class=\"node-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 500.36 365\" x=\"-9\" y=\"-10\" width=\"20\" height=\"20\"><title>type_output</title><g id=\"output\"><path d=\"M291.95,325.23a134,134,0,0,1-15.76,19,132.5,132.5,0,1,1,0-187.38,133.9,133.9,0,0,1,16.16,19.55l35.81-35.81A182.5,182.5,0,1,0,327.73,361Z\" transform=\"translate(0 -68)\"/><g id=\"circle_source_copy\" data-name=\"circle source copy\"><g id=\"Layer_22_copy\" data-name=\"Layer 22 copy\"><g id=\"Layer_9_copy_5\" data-name=\"Layer 9 copy 5\"><polygon points=\"500.36 182 386.68 295.68 351.32 260.32 404.64 207 210 207 210 157 404.64 157 352.32 104.68 387.68 69.32 500.36 182\"/></g></g></g></g></svg>";

    private static makeIconFragment(model) {

        let iconStr = "";

        if (model instanceof StepModel && model.run) {

            if (model.run.class === "Workflow") {
                iconStr = this.workflowIconSvg;
            } else if (model.run.class === "CommandLineTool") {
                iconStr = this.toolIconSvg;
            }

        } else if (model instanceof WorkflowInputParameterModel && model.type) {
            if (model.type.type === "File" || (model.type.type === "array" && model.type.items === "File")) {
                iconStr = this.fileInputIconSvg;
            } else {
                iconStr = this.inputIconSvg;
            }
        } else if (model instanceof WorkflowOutputParameterModel && model.type) {
            if (model.type.type === "File" || (model.type.type === "array" && model.type.items === "File")) {
                iconStr = this.fileOutputIconSvg;
            } else {
                iconStr = this.outputIconSvg;
            }
        }

        return iconStr;
    }

    static makeTemplate(dataModel: {
        id: string,
        connectionId: string,
        label?: string,
        in?: any[],
        type?: ParameterTypeModel
        out?: any[],
        customProps?: {
            "sbg:x"?: number
            "sbg:y"?: number
        }
    }, labelScale = 1): string {

        const x = ~~(dataModel.customProps && dataModel.customProps["sbg:x"]);
        const y = ~~(dataModel.customProps && dataModel.customProps["sbg:y"]);

        let nodeTypeClass = "step";
        if (dataModel instanceof WorkflowInputParameterModel) {
            nodeTypeClass = "input";
        } else if (dataModel instanceof WorkflowOutputParameterModel) {
            nodeTypeClass = "output";
        }

        const inputs   = (dataModel["in"] || []).filter(p => p.isVisible);
        const outputs  = (dataModel["out"] || []).filter(p => p.isVisible);
        const maxPorts = Math.max(inputs.length, outputs.length);
        const radius   = GraphNode.radius + maxPorts * IOPort.radius;

        let typeClass = "";
        let itemsClass = "";

        if (dataModel.type) {
            typeClass = "type-" + dataModel.type.type;

            if(dataModel.type.items){
                itemsClass = "items-" + dataModel.type.items;
            }
        }






        const inputPortTemplates = inputs
            .sort((a, b) => -a.id.localeCompare(b.id))
            .map((p, i, arr) => GraphNode.makePortTemplate(
                p,
                "input",
                SVGUtils.matrixToTransformAttr(
                    GraphNode.createPortMatrix(arr.length, i, radius, "input")
                )
            ))
            .reduce((acc, tpl) => acc + tpl, "");

        const outputPortTemplates = outputs
            .sort((a, b) => -a.id.localeCompare(b.id))
            .map((p, i, arr) => GraphNode.makePortTemplate(
                p,
                "output",
                SVGUtils.matrixToTransformAttr(
                    GraphNode.createPortMatrix(arr.length, i, radius, "output")
                )
            ))
            .reduce((acc, tpl) => acc + tpl, "");

        return `
            <g tabindex="-1" class="node ${nodeTypeClass} ${typeClass} ${itemsClass}"
               data-connection-id="${dataModel.connectionId}"
               transform="matrix(1, 0, 0, 1, ${x}, ${y})"
               data-id="${dataModel.id}">
               
                <g class="core" transform="matrix(1, 0, 0, 1, 0, 0)">
                    <circle cx="0" cy="0" r="${radius}" class="outer"></circle>
                    <circle cx="0" cy="0" r="${radius * .75}" class="inner"></circle>
                    
                    ${GraphNode.makeIconFragment(dataModel)}
                </g>
                
                <text transform="matrix(${labelScale},0,0,${labelScale},0,${radius + 30})" class="title label">${HtmlUtils.escapeHTML(dataModel.label || dataModel.id)}</text>
                
                ${inputPortTemplates}
                ${outputPortTemplates}
            </g>
        `;
    }

    private static makePortTemplate(port: {
                                        label?: string,
                                        id: string,
                                        connectionId: string
                                    },
                                    type: "input" | "output",
                                    transform = "matrix(1, 0, 0, 1, 0, 0)"): string {

        const portClass = type === "input" ? "input-port" : "output-port";
        const label     = port.label || port.id;

        return `
            <g class="port ${portClass}" transform="${transform || "matrix(1, 0, 0, 1, 0, 0)"}"
               data-connection-id="${port.connectionId}"
               data-port-id="${port.id}"
            >
                <g class="io-port">
                    <circle cx="0" cy="0" r="7" class="port-handle"></circle>
                </g>
                <text x="0" y="0" transform="matrix(1,0,0,1,0,0)" class="label unselectable">${label}</text>
            </g>
            
        `;
    }

    public static createPortMatrix(totalPortLength: number,
                                   portIndex: number,
                                   radius: number,
                                   type: "input" | "output"): SVGMatrix {
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

        const matrix = SVGUtils.createMatrix();
        return matrix.rotate(rotationAngle).translate(radius, 0).rotate(-rotationAngle);
    }

    static patchModelPorts<T>(model: T & { connectionId: string, id: string }): T {
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