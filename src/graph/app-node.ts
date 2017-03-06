import {StepModel} from "cwlts/models";
import {GraphNode, NodePosition} from "./graph-node";
import {InputPort} from "./input-port";
import {OutputPort} from "./output-port";
import Matrix = Snap.Matrix;


export class AppNode extends GraphNode {

    private step: StepModel;

    constructor(position: Partial<NodePosition>,
                step: StepModel,
                paper: Snap.Paper) {

        super(position, step, paper);
        this.step = step;
    }



    public draw(): Snap.Element {
        const drawing = super.draw();

        const comparator = (a, b) => {
            return a.id.localeCompare(b.id);
        }
        (this.step.in || []).filter(s => s.isVisible).sort(comparator).map(s => new InputPort(this.paper, s)).forEach(p => this.addPort(p));
        (this.step.out || []).filter(s => s.isVisible).sort(comparator).map(s => new OutputPort(this.paper, s)).forEach(p => this.addPort(p));

        return drawing;
    }
}