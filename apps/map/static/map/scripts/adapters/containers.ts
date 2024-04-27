import { MapError } from "../core/errors.js";
import * as ports from "../core/ports.js";
import { Description } from "../core/types.js";

export class StorageContainer<Value> implements ports.Container<Value> {
    constructor(private value: Value | undefined = undefined) {}

    set(newValue: Value | undefined) {
        this.value = newValue;
    }

    get(): Value | undefined {
        return this.value;
    }
}

export type StorageHTMLElement = HTMLElement & {value: string}

export class HTMLElementValueContainer implements ports.Container<string> {
    constructor(private inputElement: StorageHTMLElement) {}

    set(outerValue: string | undefined) {
        this.inputElement.value = this._storedValueOf(outerValue);
    }

    get(): string | undefined {
        return this.inputElement.value;
    }

    private _storedValueOf(outerValue: string | undefined): string {
        return outerValue === undefined ? '' : outerValue;
    }
}

export class DescriptionAdapterContainer implements ports.Container<Description> {
    constructor(private _valueContainer: ports.Container<string>) {}

    set(description: Description) {
        this._valueContainer.set(description.value);
    }

    get(): Description | undefined {
        const value = this._valueContainer.get();

        if (value === undefined)
            return undefined;

        try {
            return new Description(value);
        }
        catch (MapError) {
            return undefined;
        }
    }
}
