"use strict";
var event_hub_1 = require("../utils/event-hub");
var app_node_1 = require("./app-node");
var Workflow = (function () {
    function Workflow(paper) {
        this.nodes = [];
        this.paper = paper;
        this.group = this.paper.group();
        this.eventHub = new event_hub_1.EventHub();
        this.attachEvents();
    }
    Workflow.prototype.command = function (event) {
        var data = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            data[_i - 1] = arguments[_i];
        }
        (_a = this.eventHub).emit.apply(_a, [event].concat(data));
        var _a;
    };
    Workflow.prototype.attachEvents = function () {
        var _this = this;
        this.eventHub.on("app.create", function (step) {
            var n = new app_node_1.AppNode({
                x: Math.random() * 1000,
                y: Math.random() * 1000
            }, step, _this.paper);
            n.draw();
            _this.nodes.push(n);
        });
    };
    Workflow.prototype.create = function (node, pos, attr) {
        switch (node) {
            case app_node_1.AppNode:
                var appNode = new app_node_1.AppNode(pos, attr, [], [], this.paper);
                this.group.add(appNode.draw());
                this.nodes.push(appNode);
                return appNode;
            default:
                throw new Error("Unknown shape: " + node);
        }
    };
    return Workflow;
}());
exports.Workflow = Workflow;
