import {SVGPluginBase} from "../plugin-base";

export class SVGEdgeHoverPlugin extends SVGPluginBase {

    private boundEdgeEnterFunction = this.onEdgeEnter.bind(this);

    afterRender(): void {
        this.attachEdgeHoverBehavior();
    }

    private attachEdgeHoverBehavior() {

        this.workflow.workflow.removeEventListener("mouseenter", this.boundEdgeEnterFunction);
        this.workflow.workflow.addEventListener("mouseenter", this.boundEdgeEnterFunction, true);
    }

    private onEdgeEnter(ev: MouseEvent) {


        // Ignore if we did not enter an edge
        if (!ev.srcElement.classList.contains("edge")) return;

        const target = ev.srcElement as SVGGElement;
        let tipEl: SVGGElement;

        const onMouseMove = ((ev: MouseEvent) => {
            const coords = this.workflow.transformScreenCTMtoCanvas(ev.clientX, ev.clientY);
            tipEl.setAttribute("x", String(coords.x));
            tipEl.setAttribute("y", String(coords.y - 16));
        }).bind(this);

        const onMouseLeave = ((ev: MouseEvent) => {
            tipEl.remove();
            target.removeEventListener("mousemove", onMouseMove);
            target.removeEventListener("mouseleave", onMouseLeave)
        }).bind(this);

        const sourceNode = target.getAttribute("data-source-node");
        const destNode   = target.getAttribute("data-destination-node");
        const sourcePort = target.getAttribute("data-source-port");
        const destPort   = target.getAttribute("data-destination-port");

        const sourceLabel = sourceNode === sourcePort ? sourceNode : `${sourceNode} (${sourcePort})`;
        const destLabel   = destNode === destPort ? destNode : `${destNode} (${destPort})`;

        const coords = this.workflow.transformScreenCTMtoCanvas(ev.clientX, ev.clientY);

        const ns = "http://www.w3.org/2000/svg";
        tipEl    = document.createElementNS(ns, "text");
        tipEl.classList.add("label");
        tipEl.classList.add("label-edge");
        tipEl.setAttribute("x", String(coords.x));
        tipEl.setAttribute("y", String(coords.y));
        tipEl.innerHTML = sourceLabel + " → " + destLabel;

        this.workflow.workflow.appendChild(tipEl);

        target.addEventListener("mousemove", onMouseMove);
        target.addEventListener("mouseleave", onMouseLeave);

    }

}