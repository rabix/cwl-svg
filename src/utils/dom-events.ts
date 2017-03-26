export class DomEvents {

    private handlers = new Map<{ removeEventListener: Function }, { [key: string]: Function[] }>();

    constructor(private root: HTMLElement) {

    }

    public on(event: string, selector: string, handler: (UIEvent, target?: HTMLElement, root?: HTMLElement) => any, root?) {
        if (typeof selector === "function") {
            root     = handler;
            handler  = selector;
            selector = undefined;
        }

        const eventHolder = root || this.root;

        if (!this.handlers.has(eventHolder)) {
            this.handlers.set(eventHolder, {});
        }
        if (!this.handlers.get(eventHolder)[event]) {
            this.handlers.get(eventHolder)[event] = [];
        }

        const evListener = (ev: UIEvent) => {
            let target;
            if (selector) {
                const selected = Array.from(this.root.querySelectorAll(selector));
                target         = ev.target as HTMLElement;
                while (target) {
                    if (selected.find(el => el === target)) {
                        break;
                    }
                    target = target.parentNode;
                }

                if (!target) {
                    return;
                }
            }

            const handlerOutput = handler(ev, target || ev.target, this.root);
            if (handlerOutput === false) {
                return false;
            }

            return false;
        };

        eventHolder.addEventListener(event, evListener);

        this.handlers.get(eventHolder)[event].push(evListener);

        return function off() {
            eventHolder.removeEventListener(event, evListener);
        }
    }


    public keyup() {

    }

    public drag(selector,
                move: (dx: number, dy: number, UIEvent, target?: HTMLElement, root?: HTMLElement) => any,
                start: (UIEvent, target?: HTMLElement, root?: HTMLElement) => any,
                end: (UIEvent, target?: HTMLElement, root?: HTMLElement) => any) {

        let dragging       = false;
        let lastMove: MouseEvent;
        let draggedEl: HTMLElement;
        let moveEventCount = 0;
        let mouseDownEv;
        let threshold      = 3;

        this.on("mousedown", selector, (ev, el, root) => {
            dragging    = true;
            lastMove    = ev;
            draggedEl   = el;
            mouseDownEv = ev;

            document.addEventListener("mousemove", moveHandler);
            document.addEventListener("mouseup", upHandler);

            return false;
        });

        const moveHandler = (ev) => {
            if (!dragging) {
                return;
            }

            const dx = ev.screenX - lastMove.screenX;
            const dy = ev.screenY - lastMove.screenY;
            moveEventCount++;
            if (moveEventCount === threshold && typeof start === "function") {
                start(mouseDownEv, draggedEl, this.root);

            }

            if (moveEventCount >= threshold && typeof move === "function") {
                move(dx, dy, ev, draggedEl, this.root);

            }
        };
        const upHandler   = (ev) => {
            if (moveEventCount >= threshold) {
                if (dragging) {
                    if (typeof end === "function") {
                        end(ev, draggedEl, this.root)
                    }
                }

                const parentNode        = draggedEl.parentNode;
                const clickCancellation = (ev) => {
                    ev.stopPropagation();
                    parentNode.removeEventListener("click", clickCancellation, true);
                };
                parentNode.addEventListener("click", clickCancellation, true);
            }


            dragging       = false;
            draggedEl      = undefined;
            lastMove       = undefined;
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
        this.handlers.forEach((handlers: { [event: string]: EventListener[] }, listenerRoot: Element) => {
            for (let eventName in handlers) {
                handlers[eventName].forEach(handler => listenerRoot.removeEventListener(eventName, handler));
            }
        });

        this.handlers.clear();
    }
}