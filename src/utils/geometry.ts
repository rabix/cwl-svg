export class Geometry {
    static isColliding(a: Snap.Element, b: Snap.Element){
        const {x: aX, y: aY, width: aWidth, height: aHeight} = a.getBBox();
        const {x: bX, y: bY, width: bWidth, height: bHeight} = b.getBBox();

    }
}