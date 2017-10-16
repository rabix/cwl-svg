import {Workflow} from '../graph/workflow';

export interface GraphChange {
    type: string;

}

export interface SVGPlugin {

    registerWorkflow?(workflow: Workflow): void;

    registerOnBeforeChange?(fn: (change: GraphChange) => void): void;

    registerOnAfterChange?(fn: (change: GraphChange) => void): void;

    registerOnAfterRender?(fn: (change: GraphChange) => void): void;

    afterRender?(): void;

    afterModelChange?(): void;

    enableEditing?(enabled: boolean): void;

    destroy?(): void;
}