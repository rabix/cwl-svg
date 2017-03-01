import {IOPort} from "./io-port";

export class InputPort extends IOPort {

    protected getClass(){
        return "input";
    }
    protected drawTitle(content): Snap.Element {
        const {height, width} = this.handle.getBBox();

        return this.paper.text(-20, 4, content).attr({
            "text-anchor": "end"
        });
    }

}