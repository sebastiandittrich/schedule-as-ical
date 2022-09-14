"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoMap = void 0;
class AutoMap extends Map {
    constructor(generator) {
        super();
        this.generator = generator;
    }
    get(key) {
        if (!this.has(key)) {
            this.set(key, this.generator(key));
        }
        return super.get(key);
    }
    toMap() {
        return new Map(this);
    }
}
exports.AutoMap = AutoMap;
