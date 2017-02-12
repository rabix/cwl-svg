"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var input_port_1 = require("./input-port");
var shape_1 = require("./shape");
var IOPort = (function (_super) {
    __extends(IOPort, _super);
    function IOPort(paper, options) {
        var _this = _super.call(this) || this;
        _this.radius = 8;
        _this.connectionFormat = "M {x1} {y1}, C {bx1} {by1} {bx2} {by2} {x2} {y2}";
        _this.drawingElements = {
            circleGroup: null,
            innerCircle: null,
            outerCircle: null,
            title: null
        };
        _this.paper = paper;
        _this.options = options;
        return _this;
    }
    IOPort.prototype.drawHandle = function () {
        var outer = this.paper.circle(0, 0, this.radius).attr({
            fill: "whitesmoke",
            stroke: "rgb(204, 204, 204)"
        });
        var inner = this.paper.circle(0, 0, this.radius * .55).attr({
            fill: "#888",
            stroke: "none"
        });
        return this.paper.group(outer, inner).attr({
            id: this.constructor.name
        }).attr(this.options.attr || {});
    };
    IOPort.prototype.drawTitle = function (content) {
        return this.paper.text(0, 0, content);
    };
    IOPort.prototype.draw = function () {
        var _this = this;
        this.handle = this.drawHandle();
        this.title = this.drawTitle(this.options.name || "").addClass("io-port-label");
        this.drawingElements.circleGroup = this.handle;
        this.group = this.paper.group(this.drawingElements.circleGroup, this.title);
        this.group.hover(function () {
            _this.handle[0].animate({
                r: _this.radius * 1.2,
                fill: "#29567d"
            }, 150);
            _this.handle[1].animate({
                r: _this.radius * .45,
                fill: "whitesmoke"
            }, 150);
        }, function () {
            _this.handle[0].animate({
                r: _this.radius,
                fill: "whitesmoke"
            }, 150);
            _this.handle[1].animate({ r: _this.radius * .55, fill: "#888" }, 150);
        });
        this.attachDragBehaviour(this.drawingElements.circleGroup);
        this.attachDrop();
        return this.group;
    };
    IOPort.prototype.attachDragBehaviour = function (el) {
        var _this = this;
        var path;
        var rect;
        el.drag(function (dx, dy, mx, my, ev) {
            path.attr({
                path: Snap.format(_this.connectionFormat, {
                    x1: rect.left,
                    y1: rect.top,
                    bx1: (rect.left + mx) / 2,
                    by1: rect.top,
                    bx2: (rect.left + mx) / 2,
                    by2: my,
                    x2: mx,
                    y2: my
                })
            });
        }, function (x, y, ev) {
            rect = el.node.getBoundingClientRect();
            path = _this.paper.path(Snap.format(_this.connectionFormat, {
                x1: rect.left,
                y1: rect.top,
                bx1: rect.left,
                by1: rect.top,
                bx2: rect.left,
                by2: rect.top,
                x2: rect.left,
                y2: rect.top
            })).attr({
                fill: "none",
                stroke: "gray",
                strokeWidth: 2,
                id: (_this.constructor.name)
            });
        }, function (ev) {
            console.log("Path is now", path);
            // path.remove();
            // if (ev.composedPath().find(el => el.getAttribute("id") === "InputPort")) {
            //     console.log("Dropped on input port");
            //
            // } else {
            //     // path.remove();
            // }
        });
    };
    IOPort.prototype.attachDrop = function () {
        var _this = this;
        this.group.mouseup(function (ev) {
            if (_this instanceof input_port_1.InputPort) {
            }
            console.log("Mouse up", ev);
        });
    };
    IOPort.prototype.makePathStringBetween = function (x1, y1, x2, y2) {
        return Snap.format(this.connectionFormat, {
            x1: x1,
            y1: y1,
            bx1: (x1 + x2) / 2,
            by1: y1,
            bx2: (x1 + x2) / 2,
            by2: y2,
            x2: x2,
            y2: y2
        });
    };
    IOPort.prototype.connectTo = function (port) {
        if (this.connection) {
            this.connection.remove();
            this.connection = undefined;
        }
        var thisRect = this.group.node.getBoundingClientRect();
        var otherRect = port.group.node.getBoundingClientRect();
        console.log("Connecting", thisRect, "to", otherRect);
        this.connection = this.paper.path(this.makePathStringBetween(thisRect.left, thisRect.top, otherRect.left, otherRect.top)).attr({
            fill: "none",
            stroke: "gray",
            strokeWidth: 2
        });
    };
    return IOPort;
}(shape_1.Shape));
exports.IOPort = IOPort;
