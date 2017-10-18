import {PluginBase} from "../plugin-base";
import {Workflow}   from "../../";

export class ZoomPlugin extends PluginBase {
    private svg: SVGSVGElement;
    private dispose: () => void;

    registerWorkflow(workflow: Workflow): void {
        super.registerWorkflow(workflow);
        this.svg = workflow.svgRoot;

        this.dispose = this.attachWheelListener();
    }

    attachWheelListener(): () => void {
        const handler = this.onMouseWheel.bind(this);
        this.svg.addEventListener("mousewheel", handler, true);
        return () => this.svg.removeEventListener("mousewheel", handler, true);
    }

    onMouseWheel(event: MouseWheelEvent) {
        const scale = this.workflow.scale - event.deltaY / 500;

        if (scale <= this.workflow.minScale || scale >= this.workflow.maxScale) {
            return;
        }

        this.workflow.scaleAtPoint(scale, event.clientX, event.clientY);
        event.stopPropagation();
    }

    destroy(): void {
        this.dispose();
        this.dispose = undefined;
    }
}