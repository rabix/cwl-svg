"use strict";
var EventHub = (function () {
    function EventHub() {
        this.handlers = {
            "app.create": [],
            "app.delete": [],
            "node.move": [],
            "connection.create": [],
            "connection.remove": []
        };
    }
    EventHub.prototype.on = function (event, handler) {
        var _this = this;
        this.guard(event, "subscribe to");
        this.handlers[event].push(handler);
        return function () { return _this.off(event, handler); };
    };
    EventHub.prototype.off = function (event, handler) {
        this.guard(event, "unsubscribe from");
        return this.handlers[event].splice(this.handlers[event].findIndex(function (h) { return handler === h; }), 1);
    };
    EventHub.prototype.emit = function (event) {
        var data = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            data[_i - 1] = arguments[_i];
        }
        this.guard(event, "emit");
        for (var i = 0; i < this.handlers[event].length; i++) {
            (_a = this.handlers[event])[i].apply(_a, data);
        }
        var _a;
    };
    EventHub.prototype.empty = function () {
        for (var event_1 in this.handlers) {
            this.handlers[event_1] = [];
        }
    };
    EventHub.prototype.guard = function (event, verb) {
        if (!this.handlers[event]) {
            throw new Error("Cannot " + verb + " a non-supported event \u201C" + event + "\u201D. \n            Supported events are: " + Object.keys(this.handlers).join(", ") + "\u201D");
        }
    };
    return EventHub;
}());
exports.EventHub = EventHub;
