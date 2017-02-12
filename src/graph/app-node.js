"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var graph_node_1 = require("./graph-node");
var input_port_1 = require("./input-port");
var output_port_1 = require("./output-port");
var AppNode = (function (_super) {
    __extends(AppNode, _super);
    function AppNode(position, step, paper) {
        var _this = _super.call(this, position, {}, paper) || this;
        _this.inputs = [];
        _this.outputs = [];
        _this.step = step;
        _this.inputs = _this.step.in.map(function (i) { return new input_port_1.InputPort(_this.paper, i); });
        _this.outputs = _this.step.out.map(function (o) { return new output_port_1.OutputPort(_this.paper, o); });
        return _this;
    }
    AppNode.prototype.addPort = function (port) {
        var drawn = port.draw();
        this.group.add(drawn);
        var portStore = port instanceof input_port_1.InputPort ? this.inputs : this.outputs;
        portStore.push(port);
        this.distributePorts();
        if (portStore.length > 1 && portStore.length <= 12) {
            var _a = portStore.slice(-2).map(function (i) { return i.group.getBBox(); }), a = _a[0], b = _a[1];
            var overlapping = a.y + a.height >= b.y;
            if (overlapping) {
                this.scale(1.08);
                this.distributePorts();
            }
        }
    };
    /**
     * Moves the element to the outer edge of the node given an angle and the node radius
     * @param el Element to move
     * @param angle Angle along which the element should be moved
     * @param radius Radius of the parent node
     */
    AppNode.movePortToOuterEdge = function (el, angle, radius) {
        el.transform("") // Remove previous transformations, bring it to the center
            .transform(new Snap.Matrix()
            .rotate(angle, 0, 0)
            .translate(radius, 0)
            .rotate(-angle, 0, 0)
            .toTransformString());
    };
    /**
     * Repositions input and output ports to their designated places on the outer edge
     * of the node and scales the node in the process if necessary.
     */
    AppNode.prototype.distributePorts = function () {
        var availableAngle = 140;
        var rotationAngle;
        // Distribute output ports
        for (var i = 0; i < this.outputs.length; i++) {
            rotationAngle =
                // Starting rotation angle
                (-availableAngle / 2) +
                    (
                    // Angular offset by element index
                    (i + 1)
                        * availableAngle / (this.outputs.length + 1));
            AppNode.movePortToOuterEdge(this.outputs[i].group, rotationAngle, this.radius);
        }
        // Distribute input ports
        for (var i = 0; i < this.inputs.length; i++) {
            rotationAngle =
                // Determines the starting rotation angle
                180 - (availableAngle / -2)
                    - (i + 1)
                        * availableAngle / (this.inputs.length + 1);
            AppNode.movePortToOuterEdge(this.inputs[i].group, rotationAngle, this.radius);
        }
    };
    return AppNode;
}(graph_node_1.GraphNode));
exports.AppNode = AppNode;
