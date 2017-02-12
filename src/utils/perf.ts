export class Perf {

    static DEFAULT_THROTTLE = 1;

    public static throttle(fn, threshold = Perf.DEFAULT_THROTTLE, context?): Function {
        let last, deferTimer;

        return function () {
            const scope = context || this;

            let now  = +new Date,
                args = arguments;
            if (last && now < last + threshold) {
                clearTimeout(deferTimer);
                deferTimer = setTimeout(function () {
                    last = now;
                    fn.apply(scope, args);
                }, threshold);
            } else {
                last = now;
                fn.apply(scope, args);
            }
        };
    }

}