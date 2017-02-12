import {IOPort} from "./io-port";

export class OutputPort extends IOPort {

    protected getClass(){
        return "output";
    }

    protected drawTitle(content): Snap.Element {
        const {height, width} = this.handle.getBBox();
        return this.paper.text(width, height / 4, content);
    }
}