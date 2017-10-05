import * as Webpack          from "webpack"
import * as WebpackDevServer from "webpack-dev-server";
import {browser}             from "protractor";
import * as path             from "path";

const webpackConfig = require("../../webpack.config");

export function serveCompiled(entryPath = "", port = 9567) {

    let initFile = entryPath;

    if (!entryPath) {
        const caller   = getCallerFile();
        const dirname  = path.dirname(caller);
        const basename = path.basename(caller, ".js");
        initFile       = dirname + "/" + basename + ".init.js";
    }

    return new Promise(resolve => {

        const config = {
            ...webpackConfig,
            watch: false,
            entry: initFile
        };

        const compiler = Webpack(config, async () => {
            await browser.waitForAngularEnabled(false);
            await browser.get(`http://localhost:${port}`);
            resolve(listener);
        });

        const server   = new WebpackDevServer(compiler as any, {publicPath: ""});
        const listener = server.listen(port);
    });

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