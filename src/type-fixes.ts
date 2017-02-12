declare namespace Snap {
    export interface Element {
        transform(matrix: Snap.Matrix): Snap.Element;

        toFront(): void;
        toBack(): void;
    }

}
// declare class Snap {
//     new(width: number | string, height: number | string): Snap.Paper;
//     new(query: string): Snap.Paper;
//     new(DOM: SVGElement): Snap.Paper;
// }
