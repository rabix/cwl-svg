export class DomEvents {

    private handlers = {};

    constructor(private root: HTMLElement) {

    }

    public on(event: string, selector: string, handler: (UIEvent, target?: HTMLElement, root?: HTMLElement) => any) {

        if (!this.handlers[event]) {
            this.handlers[event] = [];
        }

        const evListener = (ev: UIEvent) => {
            const selected = Array.from(this.root.querySelectorAll(selector));
            let target = ev.target as HTMLElement;
            while (target) {
                if (selected.find(el => el === target)) {
                    break;
                }
                target = target.parentNode;
            }


            if (!target) {
                return;
            }
            const handlerOutput = handler(ev, target, this.root);
            if (handlerOutput === false) {
                return false;
            }

            return false;
        };

        this.root.addEventListener(event, evListener);
        this.handlers[event].push(evListener);

        return function off() {
            this.root.removeEventListener(event, evListener);
        }
    }

    public drag(selector,
                move: (dx: number, dy: number, UIEvent, target?: HTMLElement, root?: HTMLElement) => any,
                start: (UIEvent, target?: HTMLElement, root?: HTMLElement) => any,
                end: (UIEvent, target?: HTMLElement, root?: HTMLElement) => any) {

        let dragging = false;
        let lastMove: MouseEvent;
        let draggedEl: HTMLElement;
        let moveEventCount = 0;

        this.on("mousedown", selector, (ev, el, root) => {
            dragging = true;
            lastMove = ev;
            draggedEl = el;

            if (typeof start === "function") {
                start(ev, el, root);
            }

            document.addEventListener("mouseup", upHandler);
            document.addEventListener("mousemove", moveHandler);

            return false;
        });

        const moveHandler = (ev) => {
            if (!dragging) {
                return;
            }

            const dx = event.screenX - lastMove.screenX;
            const dy = event.screenY - lastMove.screenY;
            moveEventCount++;

            if (typeof move === "function") {
                move(dx, dy, ev, draggedEl, this.root);
            }
        };
        const upHandler = (ev) => {
            if (moveEventCount > 2) {
                if (dragging) {
                    if (typeof end === "function") {
                        end(ev, draggedEl, this.root)
                    }
                }

                const parentNode = draggedEl.parentNode;
                const clickCancellation = (ev) => {
                    ev.stopPropagation();
                    parentNode.removeEventListener("click", clickCancellation, true);
                };
                parentNode.addEventListener("click", clickCancellation, true);
            }


            dragging = false;
            draggedEl = undefined;
            lastMove = undefined;
            moveEventCount = 0;
            document.removeEventListener("mouseup", upHandler);
            document.removeEventListener("mousemove", moveHandler);
        };
    }

    public hover(element,
                 hover: (UIEvent, target?: HTMLElement, root?: HTMLElement) => any = () => {
                 },
                 enter: (UIEvent, target?: HTMLElement, root?: HTMLElement) => any = () => {
                 },
                 leave: (UIEvent, target?: HTMLElement, root?: HTMLElement) => any = () => {

                 }) {

        let hovering = false;

        element.addEventListener("mouseenter", (ev) => {
            hovering = true;
            enter(ev, element, this.root);

        });

        element.addEventListener("mouseleave", (ev) => {
            hovering = false;
            leave(ev, element, this.root);
        });

        element.addEventListener("mousemove", (ev) => {
            if (!hovering) {
                return;
            }
            hover(ev, element, this.root);
        });
    }

    public detachAll() {
        for (let k in this.handlers) {
            this.handlers[k].forEach(handler => {
                this.root.removeEventListener(k, handler);
            })
        }

        this.handlers = {};
    }
}