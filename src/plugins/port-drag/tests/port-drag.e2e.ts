import {$$, browser, by, element, ElementFinder} from "protractor";
import {hasClass, serveCompiled}                 from "../../../utils/test-utils";

describe("Dragging from port", () => {

    let server;
    let ports: { [nodeID: string]: { [side: string]: { [portID: string]: ElementFinder } } } = {};

    beforeAll(async function (done) {
        server = await serveCompiled();
        done();
    });

    afterAll(() => {
        server.close();
    });

    function locatePorts(): Promise<any> {

        let ports = {};


        return new Promise(async (resolve, reject) => {

            const portQuery = $$(".port");

            portQuery.each(async finder => {
                const connectionID       = await finder.getAttribute("data-connection-id");
                const [side, node, port] = connectionID.split("/");

                ports[node]             = ports[node] || {};
                ports[node][side]       = ports[node][side] || {};
                ports[node][side][port] = finder;


            }).then(() => {
                resolve(ports)
            }).catch(err => {
                console.log("Got an error", err);
                reject(err);
            });

        });
    }

    beforeEach(async function (done) {
        ports = await locatePorts();
        done();
    });


    it("initially marks suggested ports", async function (done) {

        const actions    = browser.actions();
        const originPort = await element(by.css("[data-id=first] [data-port-id=first_out] .port-handle"));

        await actions.mouseDown(originPort)
            .mouseMove({x: 0, y: 30})
            .mouseMove({x: 0, y: 30})
            .mouseMove({x: 0, y: 30})
            .perform();

        const inputs            = ports.second.in;
        const suggestedPorts    = [inputs.nini, inputs.alpha, inputs.agode];
        const nonSuggestedPorts = [inputs.upato, inputs.egeba];

        for (let sp of suggestedPorts) {
            const isSuggestion = await hasClass(sp, "__port-drag-suggestion");
            const labelOpacity = await sp.$(".label").getCssValue("opacity");

            expect(isSuggestion).toBe(true, "Expected to have a drag suggestion class, but it doesn't");
            expect(Number(labelOpacity)).toBeCloseTo(1, 0.1, "Expected port label to be visible, but it is not");
        }

        for (let sp of nonSuggestedPorts) {
            const isSuggestion = await hasClass(sp, "__port-drag-suggestion");
            const labelOpacity = await sp.$(".label").getCssValue("opacity");
            expect(isSuggestion).toBe(false, "Expected to not have a drag suggestion class, but it does");
            expect(Number(labelOpacity)).toBeCloseTo(0, 0.1, "Expected port label to be invisible, but it is not");
        }

        done();
    });

    it("shows labels on all input ports, but not output ports when dragging close", async function (done) {
        const actions    = browser.actions();
        const originPort = await element(by.css("[data-id=first] [data-port-id=first_out] .port-handle"));

        await actions.mouseDown(originPort)
            .mouseMove({x: 15, y: -20})
            .mouseMove({x: 15, y: -20})
            .mouseMove({x: 15, y: -20})
            .perform();


        const {in: inputs, out: outputs} = ports.second;

        for (let portID in inputs) {
            const labelOpacity = await inputs[portID].$(".label").getCssValue("opacity");
            expect(Number(labelOpacity)).toBeCloseTo(1, 0.1, "Expected port label to be visible, but it is not");
        }

        for (let portID in outputs) {
            const labelOpacity = await outputs[portID].$(".label").getCssValue("opacity");
            expect(Number(labelOpacity)).toBeCloseTo(0, 0.1, "Expected port label to be invisible, but it is");
        }

        done();
    });

    xit("shows edge information when hovering over newly created edges");


});