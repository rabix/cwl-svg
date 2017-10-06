import {browser, by, element} from "protractor";
import {serveCompiled}        from "../../../utils/test-utils";

describe("Drag and drop", () => {

    let server;

    beforeAll(async function (done) {
        server = await serveCompiled();
        browser.takeScreenshot();
        done();
    });

    afterAll(() => {
        server.close();
    });

    it("move a node", async function (done) {

        const movement = 100;
        const actions = browser.actions();

        const hisatLocator = await element(by.css("[data-id='print'] .inner"));
        const location     = await hisatLocator.getLocation();

        await actions
            .mouseDown(hisatLocator)
            .mouseMove({x: movement, y: movement})
            .perform();

        await actions.mouseUp().perform();
        const newLocation = await hisatLocator.getLocation();

        expect(newLocation.x).toBeCloseTo(location.x + movement, 1);
        expect(newLocation.y).toBeCloseTo(location.y + movement, 1);

        done();
    });
});