"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var input_port_1 = require("./input-port");
var output_port_1 = require("./output-port");
var shape_1 = require("./shape");
var GraphNode = (function (_super) {
    __extends(GraphNode, _super);
    function GraphNode(position, attributes, paper) {
        var _this = _super.call(this) || this;
        _this.position = { x: 0, y: 0 };
        _this.attributes = {
            fill: "transparent",
            stroke: "red",
            strokeWidth: 1
        };
        _this.radius = 50;
        _this.paper = paper;
        _this.group = _this.paper.g();
        Object.assign(_this.position, position);
        Object.assign(_this.attributes, attributes);
        return _this;
    }
    GraphNode.prototype.draw = function () {
        this.group = this.paper.group();
        this.group.transform(new Snap.Matrix().translate(this.position.x, this.position.y));
        var outerCircle = this.paper.circle(0, 0, this.radius).attr({
            stroke: "#ddd",
            fill: "#fbfcfc",
        });
        var innerCircle = this.paper.circle(0, 0, this.radius * .8).attr({
            fill: "#29567d",
            stroke: "none",
        });
        this.circleGroup = this.paper.group(outerCircle, innerCircle).transform("");
        this.group.add(this.circleGroup);
        this.attachDragBehaviour(this.circleGroup);
        return this.group;
    };
    GraphNode.prototype.scale = function (coef) {
        this.circleGroup.transform(this.circleGroup.matrix.clone().scale(coef, coef));
        this.radius = this.circleGroup.getBBox().width / 2;
    };
    GraphNode.prototype.create = function (portType, options) {
        switch (portType) {
            case input_port_1.InputPort:
            case output_port_1.OutputPort:
                return new portType(this.paper, options);
            default:
                throw new Error("Cannot create IOPort of type: " + portType);
        }
    };
    GraphNode.prototype.attachDragBehaviour = function (el) {
        var _this = this;
        var groupBBox, originalMatrix;
        el.drag(function (dx, dy, mx, my, event) {
            _this.group.transform(originalMatrix.clone().translate(dx, dy));
        }, function (x, y, ev) {
            groupBBox = _this.group.getBBox();
            originalMatrix = _this.group.matrix;
        }, function (ev) {
        });
    };
    return GraphNode;
}(shape_1.Shape));
exports.GraphNode = GraphNode;
