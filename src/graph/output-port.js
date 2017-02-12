"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var io_port_1 = require("./io-port");
var OutputPort = (function (_super) {
    __extends(OutputPort, _super);
    function OutputPort() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    OutputPort.prototype.drawTitle = function (content) {
        var _a = this.handle.getBBox(), height = _a.height, width = _a.width;
        return this.paper.text(width, height / 4, content);
    };
    return OutputPort;
}(io_port_1.IOPort));
exports.OutputPort = OutputPort;
