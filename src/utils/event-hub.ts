export type WorkflowEventType =
    "app.create" |
    "app.delete" |
    "node.move" |
    "workflow.arrange" |
    "connection.create" |
    "workflow.scale" |
    "output.create" |
    "input.create" |
    "connection.remove";

export class EventHub {
    public readonly handlers: { [event: string]: Function[] } = {
        "app.create": [],
        "app.delete": [],
        "workflow.scale": [],
        "input.create": [],
        "output.create": [],
        "node.move": [],
        "connection.create": [],
        "connection.remove": [],
        "workflow.arrange": []
    };

    on(event: WorkflowEventType, handler) {
        this.guard(event, "subscribe to");
        this.handlers[event].push(handler);

        return () => this.off(event, handler);
    }

    off(event, handler) {
        this.guard(event, "unsubscribe from");
        return this.handlers[event].splice(this.handlers[event].findIndex(h => handler === h), 1);
    }

    emit(event, ...data: any[]) {
        this.guard(event, "emit");
        for (let i = 0; i < this.handlers[event].length; i++) {
            this.handlers[event][i](...data);
        }
    }

    empty() {
        for (let event in this.handlers) {
            this.handlers[event] = [];
        }
    }

    private guard(event, verb) {
        if (!this.handlers[event]) {
            throw new Error(`Cannot ${verb} a non-supported event “${event}”. 
            Supported events are: ${Object.keys(this.handlers).join(", ")}”`);
        }
    }
}