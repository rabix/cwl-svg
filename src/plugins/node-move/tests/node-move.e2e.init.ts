import "../../../assets/styles/style.scss";
import {WorkflowFactory}   from "cwlts/models";
import {Workflow}          from "../../../";
import {SVGArrangePlugin}  from "../../arrange/arrange";
import {SVGNodeMovePlugin} from "../node-move";
import {SVGPortDragPlugin} from "../../port-drag/port-drag";

const wf = WorkflowFactory.from(require(__dirname + "/../../../../cwl-samples/rna-seq-alignment.json"));

const svgRoot = document.getElementById("svg") as any;


const workflow = new Workflow({
    model: wf,
    svgRoot: svgRoot,
    plugins: [
        new SVGArrangePlugin(),
        new SVGNodeMovePlugin({
            movementSpeed: 10
        }),
        new SVGPortDragPlugin()
    ]
});

workflow.getPlugin(SVGArrangePlugin).arrange();
