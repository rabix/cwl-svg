export class SVGZoomPlugin {

    private svgRoot: SVGSVGElement;

    registerSVGRoot(svg: SVGSVGElement): void {
        this.svgRoot = svg;
    }

    onAfterRender() {
        this.svgRoot.addEventListener("mousewheel", (event: MouseWheelEvent) => {


        });
    }


}