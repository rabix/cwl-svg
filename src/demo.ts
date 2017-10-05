import "./assets/styles/style.scss";
import {WorkflowFactory}   from "cwlts/models";
import {Workflow}          from "./graph/workflow";
import {SVGArrangePlugin}  from "./plugins/arrange/arrange";
import {SVGNodeMovePlugin} from "./plugins/node-move/node-move";
import {SVGPortDragPlugin} from "./plugins/port-drag/port-drag";


declare const samples: {
    fastQC: any,
    bcBio: any,
    rnaSeqAlignment: any
};

const wf = WorkflowFactory.from(samples.rnaSeqAlignment);

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

