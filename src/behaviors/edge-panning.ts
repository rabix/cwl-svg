import {Workflow} from "../";

export class EdgePanning {

    private movementSpeed = 10;

    private panAnimationFrame;
    private workflow: Workflow;

    private scrollMargin    = 100;
    private collision       = {x: 0, y: 0};
    private viewportClientRect: ClientRect;
    private handoff: { sdx: number, sdy: number };
    private panningCallback = (sdx: number, sdy: number) => void 0;

    constructor(workflow: Workflow, config = {
        scrollMargin: 100
    }) {
        this.workflow = workflow;
        Object.assign(this, config);

        this.viewportClientRect = this.workflow.svgRoot.getBoundingClientRect();
    }

    triggerCollisionDetection(x: number, y: number, sdx: number, sdy: number, callback) {
        const collision      = {x: 0, y: 0};
        this.handoff         = {sdx, sdy};
        this.panningCallback = callback;

        let {left, right, top, bottom} = this.viewportClientRect;

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
     * Triggered when {@link triggerCollisionDetection} determines that collision properties have changed.
     */
    private onBoundaryCollisionChange(current: { x: number, y: number }, previous: { x: number, y: number }): void {

        this.stop();

        if (current.x === 0 && current.y === 0) {
            return;
        }

        this.start(this.collision, this.handoff);
    }

    private start(direction: { x: number, y: number },
                  handoffDiff: { sdx: number, sdy: number }) {

        let startTimestamp: number;

        const scale    = this.workflow.scale;
        const matrix   = this.workflow.workflow.transform.baseVal.getItem(0).matrix;
        const sixtyFPS = 16.6666;

        const onFrame = (timestamp: number) => {

            const frameDeltaTime = timestamp - (startTimestamp || timestamp);
            startTimestamp       = timestamp;

            // We need to stop the animation at some point
            // It should be stopped when there is no animation frame ID anymore,
            // which means that stopScroll() was called
            // However, don't do that if we haven't made the first move yet, which is a situation when ∆t is 0
            if (frameDeltaTime !== 0 && !this.panAnimationFrame) {
                startTimestamp = undefined;
                return;
            }

            const moveX = Math.sign(direction.x) * this.movementSpeed * frameDeltaTime / sixtyFPS;
            const moveY = Math.sign(direction.y) * this.movementSpeed * frameDeltaTime / sixtyFPS;

            matrix.e -= moveX;
            matrix.f -= moveY;

            const xDiff = moveX / scale;
            const yDiff = moveY / scale;

            console.log("Handoff", handoffDiff);

            const sdx = handoffDiff.sdx + xDiff;
            const sdy = handoffDiff.sdy + yDiff;


            this.panningCallback(sdx, sdy);

            // this.translateNodeBy(this.movingNode, xDiff, yDiff);
            //
            // this.sdx += xDiff;
            // this.sdy += yDiff;
            //
            // this.redrawEdges(this.sdx, this.sdy);

            this.panAnimationFrame = window.requestAnimationFrame(onFrame);
        };

        this.panAnimationFrame = window.requestAnimationFrame(onFrame);
    }

    private stop() {
        window.cancelAnimationFrame(this.panAnimationFrame);
        this.panAnimationFrame = undefined;
    }

}