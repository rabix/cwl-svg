import * as Webpack             from "webpack"
import * as WebpackDevServer    from "webpack-dev-server";
import {browser, ElementFinder} from "protractor";
import * as path                from "path";

const webpackConfig = require("../../webpack.config");

function getDefaultInitPath() {
    const caller   = getCallerFile();
    const dirname  = path.dirname(caller);
    const basename = path.basename(caller, ".js");
    return dirname + "/" + basename + ".init.js";
}

export function serveCompiled(entryPath = getDefaultInitPath(), port = 9567) {

    return new Promise(resolve => {

        const config = {
            ...webpackConfig,
            watch: false,
            entry: entryPath,
        };

        const compiler = Webpack(config, async () => {

            await browser.restart();
            await browser.waitForAngularEnabled(false);
            await browser.get(`http://localhost:${port}`);

            resolve(listener);
        });

        const server   = new WebpackDevServer(compiler as any, {publicPath: ""});
        const listener = server.listen(port);
    });

}

export function hasClass(element: ElementFinder, cls: string): Promise<boolean> {

    return element.getAttribute("class").then(classes => {
        return classes.split(" ").indexOf(cls) !== -1;
    }) as any;
}

/**
 *
 * @returns {string}
 */
function getCallerFile(): string {

    const originalFunc = Error["prepareStackTrace"];

    let callerFilePath: string;

    try {
        const err = new Error();

        Error["prepareStackTrace"] = (err, stack) => stack;

        const stack: any[] = err.stack as any;
        const currentfile  = stack.shift().getFileName();

        while (err.stack.length) {
            callerFilePath = stack.shift().getFileName();

            if (currentfile !== callerFilePath) break;
        }
    } catch (e) {
    }

    Error["prepareStackTrace"] = originalFunc;

    return callerFilePath;
}