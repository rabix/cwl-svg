import "../../../assets/styles/theme";
import {WorkflowFactory}      from "cwlts/models";
import {Workflow, ZoomPlugin} from "../../../";

const app   = require(__dirname + "/app.json");
const model = WorkflowFactory.from(app);

const svgRoot = document.getElementById("svg") as any;

const graph = new Workflow({
    model: model,
    svgRoot: svgRoot,
    plugins: [new ZoomPlugin()],
    editingEnabled: true
});

graph.fitToViewport();
Object.assign(window, {
    graph,
    app,
    model
});
