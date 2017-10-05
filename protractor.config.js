exports.config = {

    capabilities: {
        browserName: "chrome",
        maxInstances: 1,
    },
    baseUrl: "http://localhost:8080",
    specs: ["src/**/*.e2e.js"],
    chromeOptions: {
        args: ["show-fps-counter=true"]
    },


    onPrepare() {


        jasmine.getEnv().beforeEach(function () {
            browser.waitForAngularEnabled(false);
        });

    }
};


