import * as ports from "../core/ports.js";
import * as types from "../core/types.js";

export type MapSurface = HTMLDivElement;
export type TaskSurface = HTMLDivElement;
export type TaskPrototypeSurface = HTMLDivElement;

export type TaskDescriptionSurface = HTMLTextAreaElement;
export type InteractionModeSurface = HTMLDivElement;
export type Animation = HTMLImageElement;

export const staticDrawing: ports.StaticDrawing<MapSurface, HTMLElement> = {
    drawOn(mapSurface: MapSurface, surface: HTMLElement) {
        mapSurface.appendChild(surface);
    },

    eraseFrom(mapSurface: MapSurface, surface: HTMLElement) {
        try {
            mapSurface.removeChild(surface);
        }
        catch (NotFoundError) {} 
    },
}

export class LazyStaticDrawing implements ports.StaticDrawing<MapSurface, HTMLElement> {
    private _drawnSurfacesInDOM: Set<HTMLElement>;

    constructor() {
        this._drawnSurfacesInDOM = new Set();
    }

    drawOn(mapSurface: MapSurface, surface: HTMLElement) {
        if (this._drawnSurfacesInDOM.has(surface)) {
            surface.hidden = false;
            return;
        }

        mapSurface.appendChild(surface);
        this._drawnSurfacesInDOM.add(surface);
    }

    eraseFrom(_: any, surface: HTMLElement) {
        surface.hidden = true;
    }
}

const _baseSurfaces = {
    sizeOf(element: HTMLElement): types.Vector {
        const rect = element.getBoundingClientRect()

        return new types.Vector(rect.width, rect.height);
    }
}

export namespace taskAdding {
    export function createReadinessAnimation(): Animation {
        const element = document.createElement("img");
        element.id = "readiness-animation-of-task-adding";
        element.src = "/static/map/animations/ready-to-add.gif";

        element.addEventListener('dragstart', event => event.preventDefault());

        return element;
    }
}

export namespace tasks {
    const _descriptionSurfaceClassName = "task-description";
    const _interactionModeSurfaceClassName = "task-interaction-mode";

    export const surfaces = {
        sizeOf(_: any): types.Vector {
            return new types.Vector(255, 124);
        },

        taskSurfaceOn(mapSurface: MapSurface, task_id: number): TaskSurface | undefined {
            let taskSurface = mapSurface.querySelector(`#${_surfaceIdOf(task_id)}`);

            return taskSurface instanceof HTMLDivElement ? taskSurface : undefined
        },

        getEmpty(): TaskSurface {
            let surface = document.createElement('div');
            surface.appendChild(this._getEmptyTaskDescriptionSurface());
            surface.appendChild(this._getEmptyInteractionModeSurface());

            surface.className = "block";
            surface.style.position = "absolute";

            return surface;
        },

        _getEmptyTaskDescriptionSurface(): TaskDescriptionSurface {
            let descriptionSurface = document.createElement("textarea");

            descriptionSurface.className = _descriptionSurfaceClassName;
            descriptionSurface.maxLength = 128;
            descriptionSurface.rows = 4;
            descriptionSurface.cols = 32;

            return descriptionSurface;
        },

        _getEmptyInteractionModeSurface(): InteractionModeSurface {
            const surface = document.createElement("div");
            surface.className = _interactionModeSurfaceClassName;

            surface.appendChild(document.createElement("img"));

            return surface;
        },
    }

    export const drawing: ports.Drawing<MapSurface, TaskSurface, types.Task> = {
        ...staticDrawing,

        redraw(surface: TaskSurface, task: types.Task) {
            surface.id = _surfaceIdOf(task.id);
            surface.style.left = _styleCoordinateOf(task.x);
            surface.style.top = _styleCoordinateOf(task.y);

            const descriptionSurface = surface.querySelector(
                `.${_descriptionSurfaceClassName}`
            );

            const interactionModeSurface = surface.querySelector(
                `.${_interactionModeSurfaceClassName}`
            );

            if (descriptionSurface instanceof HTMLTextAreaElement)
                _redrawDescriptionSurface(descriptionSurface, task);

            if (interactionModeSurface instanceof HTMLDivElement)
                _redrawInteractionModeSurface(interactionModeSurface, task);
        }
    }

    export function taskSurfaceCursorFor(taskSurface: TaskSurface): LocalCursor | undefined {
        let query = `.${_descriptionSurfaceClassName}`;
        const descriptionSurface = taskSurface.querySelector(query);

        if (descriptionSurface instanceof HTMLElement)
            return new LocalCursor(taskSurface, descriptionSurface);
    }

    function _surfaceIdOf(id: number): string {
        return `task-${id}`;
    }

    function _redrawDescriptionSurface(
        descriptionSurface: HTMLTextAreaElement,
        task: types.Task,
    ): void {
        descriptionSurface.value = task.description.value;
        descriptionSurface.disabled = task.mode !== types.InteractionMode.editing;
    }

    function _redrawInteractionModeSurface(
        interactionModeSurface: InteractionModeSurface,
        task: types.Task,
    ): void {
        const imageElement = interactionModeSurface.querySelector("img");

        if (imageElement === null)
            return;

        if (task.mode === types.InteractionMode.editing) {
            imageElement.src = "/static/map/images/editing-mode.png";
            imageElement.width = 10;
            imageElement.height = 10;
        }
        else if (task.mode === types.InteractionMode.moving) {
            imageElement.src = "/static/map/images/moving-mode.png";
            imageElement.width = 12;
            imageElement.height = 12;
        }
    }
}

export namespace taskPrototypes {
    export const surfaces: ports.TaskPrototypeSurfaces<TaskPrototypeSurface> = {
        ..._baseSurfaces,

        getEmpty(): TaskPrototypeSurface {
            const surface = document.createElement('div');
            surface.className = "task-prototype";

            return surface;
        },
    }

    export const drawing: ports.Drawing<MapSurface, TaskPrototypeSurface, types.TaskPrototype> = {
        ...staticDrawing,

        redraw(surface: TaskPrototypeSurface, taskPrototype: types.TaskPrototype) {
            surface.style.left = _styleCoordinateOf(taskPrototype.x);
            surface.style.top = _styleCoordinateOf(taskPrototype.y);
        },
    }
}

export const maps = {
    surfacesOf(mapSurface: MapSurface): ports.MapSurfaces<MapSurface> {
        return {mapSurfaceOf: _ => mapSurface};
    },
}

export const globalCursor: ports.Cursor = {
    setDefault(): void {
        _setGlobalStyleProperty("cursor", '', '');
    },

    setToGrab(): void {
        _setGlobalStyleProperty("cursor", "grab", "important");
    },

    setGrabbed(): void {
        _setGlobalStyleProperty("cursor", "grabbing", "important");
    },
}

export class LocalCursor implements ports.Cursor {
    private _elements: HTMLElement[];

    constructor(...elements: HTMLElement[]) {
        this._elements = elements;
    }

    setDefault(): void {
        this._elements.forEach(element => {
            element.style.setProperty("cursor", '', '');
        });
    }

    setToGrab(): void {
        this._elements.forEach(element => {
            element.style.setProperty("cursor", "grab", "important");
        });
    }

    setGrabbed(): void {
        this._elements.forEach(element => {
            element.style.setProperty("cursor", "grabbing", "important");
        });
    }
}

function _setGlobalStyleProperty(property: string, value: string | null, priority?: string): void {
    document.querySelectorAll('*').forEach(element => {
        if (!(element instanceof HTMLElement))
            return;

        element.style.setProperty(property, value, priority);
    })
}

function _styleCoordinateOf(coordinate: number): string {
    return `${coordinate}px`;
}
