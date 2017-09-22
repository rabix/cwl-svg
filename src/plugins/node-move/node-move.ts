import {Workflow}      from "../../graph/workflow";
import {SVGPluginBase} from "../plugin-base";

export interface ConstructorParams {
    movementSpeed?: number,
    scrollMargin?: number
}

export class SVGNodeMovePlugin extends SVGPluginBase {

    private sdx: number;
    private sdy: number;
    private startX: number;
    private startY: number;

    private scrollMargin  = 50;
    private movementSpeed = 10;
    private movingNode: SVGGElement;
    private scrollAnimationFrame: number;
    private boundingClientRect: ClientRect;

    private inputEdges: Map<SVGPathElement, number[]>;
    private outputEdges: Map<SVGPathElement, number[]>;
    private startWorkflowTranslation: { x: number, y: number };
    private collision = {x: 0, y: 0};

    constructor(parameters: ConstructorParams = {}) {
        super();
        Object.assign(this, parameters);
    }

    getName(): string {
        return "node-move";
    }

    afterRender() {
        this.attachDrag();
    }

    private attachDrag() {

        this.workflow.domEvents.drag(
            ".node .core",
            this.onMove.bind(this),
            this.onMoveStart.bind(this),
            this.onMoveEnd.bind(this)
        );
    }

    private getWorkflowMatrix(): SVGMatrix {
        return this.workflow.workflow.transform.baseVal.getItem(0).matrix;
    }


    private onMove(dx: number, dy: number, ev: MouseEvent): void {
        /** We will use workflow scale to determine how our mouse movement translate to svg proportions */
        const scale = this.workflow.getScale();

        /** Need to know how far did the workflow itself move since when we started dragging */
        const matrixMovement = {
            x: this.getWorkflowMatrix().e - this.startWorkflowTranslation.x,
            y: this.getWorkflowMatrix().f - this.startWorkflowTranslation.y
        };

        /** We might have hit the boundary and need to start panning */
        this.triggerCollisionDetection(ev.clientX, ev.clientY);

        /**
         * We need to store scaled ∆x and ∆y because this is not the only place from which node is being moved.
         * If mouse is outside the viewport, and the workflow is panning, {@link startScroll} will continue moving
         * this node, so it needs to know where to start from and update it in the same we, so this method can take
         * over when mouse gets back to the viewport.
         *
         * If there was no handoff, node would jump back and forth to
         * last positions for each movement initiator separately.
         */
        this.sdx = (dx - matrixMovement.x) / scale;
        this.sdy = (dy - matrixMovement.y) / scale;

        const moveX = this.sdx + this.startX;
        const moveY = this.sdy + this.startY;

        this.translateNodeTo(this.movingNode, moveX, moveY);
        this.redrawEdges(this.sdx, this.sdy);
    }

    /**
     * Triggered from {@link attachDrag} when drag starts.
     * This method initializes properties that are needed for calculations during movement.
     */
    private onMoveStart(event: MouseEvent, handle: SVGGElement): void {

        /** We will query the SVG dom for edges that we need to move, so store svg element for easy access */
        const svg = this.workflow.svgRoot;

        /** Our drag handle is not the whole node because that would include ports and labels, but a child of it*/
        const node = handle.parentNode as SVGGElement;

        /** Store initial transform values so we know how much we've moved relative from the starting position */
        const nodeMatrix = node.transform.baseVal.getItem(0).matrix;
        this.startX      = nodeMatrix.e;
        this.startY      = nodeMatrix.f;

        /** We have to query for edges that are attached to this node because we will move them as well */
        const nodeID = node.getAttribute("data-id");

        /**
         * When user drags the node to the edge and waits while workflow pans to the side,
         * mouse movement stops, but workflow movement starts.
         * We then utilize this to get movement ∆ of the workflow, and use that for translation instead.
         */
        this.startWorkflowTranslation = {
            x: this.getWorkflowMatrix().e,
            y: this.getWorkflowMatrix().f
        };

        /** Used to determine whether dragged node is hitting the edge, so we can pan the Workflow*/
        this.boundingClientRect = svg.getBoundingClientRect();

        /** Node movement can be initiated from both mouse events and animationFrame, so make it accessible */
        this.movingNode = handle.parentNode as SVGGElement;

        /**
         * While node is being moved, incoming and outgoing edges also need to be moved in order to stay attached.
         * We don't want to query them all the time, so we cache them in maps that point from their dom elements
         * to an array of numbers that represent their bezier curves, since we will update those curves.
         */
        this.inputEdges = new Map();
        this.outputEdges = new Map();

        const outputsSelector = `.edge[data-source-node='${nodeID}'] .sub-edge`;
        const inputsSelector  = `.edge[data-destination-node='${nodeID}'] .sub-edge`;

        const query = svg.querySelectorAll([inputsSelector, outputsSelector].join(", ")) as NodeListOf<SVGPathElement>;

        for (let subEdge of query) {
            const isInput = subEdge.parentElement.getAttribute("data-destination-node") === nodeID;
            const path    = subEdge.getAttribute("d").split(" ").map(Number).filter(e => !isNaN(e));
            isInput ? this.inputEdges.set(subEdge, path) : this.outputEdges.set(subEdge, path);
        }
    }

    private translateNodeBy(node: SVGGElement, x?: number, y?: number): void {
        const matrix = node.transform.baseVal.getItem(0).matrix;
        this.translateNodeTo(node, matrix.e + x, matrix.f + y);
    }

    private translateNodeTo(node: SVGGElement, x?: number, y?: number): void {
        node.transform.baseVal.getItem(0).setTranslate(x, y);
    }

    /**
     * Redraws stored input and output edges so as to transform them with respect to
     * scaled transformation differences, sdx and sdy.
     */
    private redrawEdges(sdx: number, sdy: number): void {
        this.inputEdges.forEach((p, el) => {
            const path = Workflow.makeConnectionPath(p[0], p[1], p[6] + sdx, p[7] + sdy);
            el.setAttribute("d", path);
        });

        this.outputEdges.forEach((p, el) => {
            const path = Workflow.makeConnectionPath(p[0] + sdx, p[1] + sdy, p[6], p[7]);
            el.setAttribute("d", path);
        });
    }


    private triggerCollisionDetection(x: number, y: number) {
        const collision = {x: 0, y: 0};

        let {left, right, top, bottom} = this.boundingClientRect;

        left   = left + this.scrollMargin;
        right  = right - this.scrollMargin;
        top    = top + this.scrollMargin;
        bottom = bottom - this.scrollMargin;

        if (x < left) {
            collision.x = x - left
        } else if (x > right) {
            collision.x = x - right;
        }

        if (y < top) {
            collision.y = y - top;
        } else if (y > bottom) {
            collision.y = y - bottom;
        }

        if (
            Math.sign(collision.x) !== Math.sign(this.collision.x)
            || Math.sign(collision.y) !== Math.sign(this.collision.y)
        ) {
            const previous = this.collision;
            this.collision = collision;
            this.onBoundaryCollisionChange(collision, previous);
        }
    }

    /**
     * Triggered from {@link attachDrag} after move event ends
     */
    private onMoveEnd(): void {
        this.stopScroll();
    }

    private stopScroll() {
        window.cancelAnimationFrame(this.scrollAnimationFrame);
        this.scrollAnimationFrame = undefined;
    }

    private onBoundaryCollisionChange(current: { x: number, y: number }, previous: { x: number, y: number }): void {

        this.stopScroll();

        if (current.x === 0 && current.y === 0) {
            return;
        }

        this.startScroll(this.collision);
    }

    private startScroll(direction: { x: number, y: number }) {

        let startTimestamp: number;

        const scale  = this.workflow.getScale();
        const matrix = this.getWorkflowMatrix();

        const onFrame = (timestamp: number) => {

            startTimestamp  = startTimestamp || timestamp;
            const deltaTime = timestamp - startTimestamp;

            // We need to stop the animation at some point
            // It should be stopped when there is no animation frame ID anymore, which means that stopScroll() was called
            // However, don't do that if we haven't made the first move yet, which is a situation when ∆t is 0
            if (deltaTime !== 0 && !this.scrollAnimationFrame) {
                startTimestamp = undefined;
                return;
            }

            const moveX = Math.sign(direction.x) * this.movementSpeed;
            const moveY = Math.sign(direction.y) * this.movementSpeed;

            matrix.e -= moveX;
            matrix.f -= moveY;

            const xDiff = moveX / scale;
            const yDiff = moveY / scale;

            this.translateNodeBy(this.movingNode, xDiff, yDiff);

            this.sdx += xDiff;
            this.sdy += yDiff;

            this.redrawEdges(this.sdx, this.sdy);

            this.scrollAnimationFrame = window.requestAnimationFrame(onFrame);
        };

        this.scrollAnimationFrame = window.requestAnimationFrame(onFrame);

    }
}
