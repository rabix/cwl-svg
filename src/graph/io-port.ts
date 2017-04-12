import {WorkflowStepInputModel, WorkflowStepOutputModel} from "cwlts/models";
import {Shape} from "./shape";

export class IOPort extends Shape {

    static radius = 7;
    
    public static makeConnectionPath(x1, y1, x2, y2, forceDirection: "right" | "left" | string = "right"): string {

        if (!forceDirection) {
            return `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;
        } else if (forceDirection === "right") {
            const outDir = x1 + Math.abs(x1 - x2) / 2;
            const inDir  = x2 - Math.abs(x1 - x2) / 2;

            return `M ${x1} ${y1} C ${outDir} ${y1} ${inDir} ${y2} ${x2} ${y2}`;
        } else if (forceDirection === "left") {
            const outDir = x1 - Math.abs(x1 - x2) / 2;
            const inDir  = x2 + Math.abs(x1 - x2) / 2;

            return `M ${x1} ${y1} C ${outDir} ${y1} ${inDir} ${y2} ${x2} ${y2}`;
        }


    }
}