export class Geometry {
    static isColliding(a: Snap.Element, b: Snap.Element) {
        const {x: aX, y: aY, width: aWidth, height: aHeight} = a.getBBox();
        const {x: bX, y: bY, width: bWidth, height: bHeight} = b.getBBox();

    }

    static distance(x1, y1, x2, y2) {

        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    static getTransformToElement(from, to) {
        return to.getScreenCTM().inverse().multiply(from.getScreenCTM());
    }
}