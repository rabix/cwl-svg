import {Edge as ModelEdge} from "cwlts/models";
import {IOPort} from "./io-port";
import {Geometry} from "../utils/geometry";
export class Edge {
    static makeTemplate(edge: ModelEdge, paper: Snap.Paper): string {
        if (!edge.isVisible || edge.source.type === "Step" || edge.destination.type === "Step") {
            return "";
        }

        let [sourceSide, sourceStepId, sourcePort] = edge.source.id.split("/");
        let [destSide, destStepId, destPort] = edge.destination.id.split("/");

        const sourceVertex = paper.node.querySelector(`.${sourceStepId} .output-port .${sourcePort}`) as SVGGElement;
        const destVertex = paper.node.querySelector(`.${destStepId} .input-port .${destPort}`) as SVGGElement;

        if (edge.source.type === edge.destination.type) {
            console.error("Cant draw edge between nodes of the same type.", edge);
            return;
        }

        if (!sourceVertex) {
            console.error("Source vertex not found for edge " + edge.source.id, edge);
            return;
        }

        if (!destVertex) {
            console.error("Destination vertex not found for edge " + edge.destination.id, edge);
            return;
        }

        const sourceCTM = sourceVertex.getCTM() as SVGMatrix;
        const destCTM = destVertex.getCTM() as SVGMatrix;

        const pathStr = IOPort.makeConnectionPath(
            sourceCTM.e,
            sourceCTM.f,
            destCTM.e,
            destCTM.f,
        );

        return `
            <g class="edge ${sourceStepId} ${destStepId}"
               data-source-port="${sourcePort}"
               data-destination-port="${destPort}"
               data-source-node="${sourceStepId}"
               data-destination-node="${destStepId}">
                <path class="sub-edge outer" d="${pathStr}"></path>
                <path class="sub-edge inner" d="${pathStr}"></path>
            </g>
        `
    }

    static spawn(pathStr = "", connectionIDs: {
                     source?: string,
                     destination?: string,
                 } = {}) {

        const ns = "http://www.w3.org/2000/svg";
        const edge = document.createElementNS(ns, "g");

        let [sourceSide, sourceStepId, sourcePort] = (connectionIDs.source || "//").split("/");
        let [destSide, destStepId, destPort] = (connectionIDs.destination || "//").split("/");

        edge.classList.add("edge");
        if (sourceStepId) {
            edge.classList.add(sourceStepId);
        }
        if (destStepId) {
            edge.classList.add(destStepId);
        }

        edge.setAttribute("data-destination-node", destStepId);
        edge.setAttribute("data-destination-port", destPort);
        edge.setAttribute("data-source-port", sourcePort);
        edge.setAttribute("data-source-node", sourceStepId);

        edge.innerHTML = `
            <path class="sub-edge outer" d="${pathStr}"></path>
            <path class="sub-edge inner" d="${pathStr}"></path>
        `;

        return edge;
    }

    static spawnBetweenConnectionIDs(root: SVGElement, source, destination) {

        if(source.startsWith("in")){
            const tmp = source;
            source = destination;
            destination = tmp;
        }

        let sourceNode = root.querySelector(`[data-connection-id="${source}"]`);
        let destinationNode = root.querySelector(`[data-connection-id="${destination}"]`);

        const sourceCTM = Geometry.getTransformToElement(sourceNode, root);
        const destCTM = Geometry.getTransformToElement(destinationNode, root);
        const path = IOPort.makeConnectionPath(sourceCTM.e, sourceCTM.f, destCTM.e, destCTM.f);

        const edge = Edge.spawn(path, {
            source,
            destination
        });

        const allEdges = root.querySelectorAll(".edge");
        const lastEdge = allEdges.item(allEdges.length - 1);
        root.insertBefore(edge, lastEdge.nextSibling);
        return edge;
    };

    static findEdge(root, sourceConnectionID, destinationConnectionID) {
        const source = Edge.parseConnectionID(sourceConnectionID);
        const dest = Edge.parseConnectionID(destinationConnectionID);

        return root.querySelector(`[data-destination-node="${dest.stepID}"][data-destination-port="${dest.portID}"][data-source-node="${source.stepID}"][data-source-port="${source.portID}"]`);
    }

    static parseConnectionID(cid) {
        let [side, stepID, portID] = (cid || "//").split("/");
        return {side, stepID, portID};
    }

}