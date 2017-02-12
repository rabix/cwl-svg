"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var io_port_1 = require("./io-port");
var InputPort = (function (_super) {
    __extends(InputPort, _super);
    function InputPort() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    InputPort.prototype.drawTitle = function (content) {
        var _a = this.handle.getBBox(), height = _a.height, width = _a.width;
        var block = this.paper.text(width, height / 4, content);
        var bbox = block.getBBox();
        return block.attr({ x: bbox.x - bbox.width - width * 2 });
    };
    return InputPort;
}(io_port_1.IOPort));
exports.InputPort = InputPort;
