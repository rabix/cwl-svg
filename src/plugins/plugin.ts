import {Workflow} from '../graph/workflow';

export interface GraphChange {
    type: string;

}

export interface SVGPlugin {

    registerWorkflowModel?(workflow: Workflow): void;

    registerOnBeforeChange?(fn: (change: GraphChange) => void): void;

    registerOnAfterChange?(fn: (change: GraphChange) => void): void;

    registerOnAfterRender?(fn: (change: GraphChange) => void): void;

    afterRender?(): void;

    enableEditing?(enabled: boolean): void;

    destroy?(): void;
}