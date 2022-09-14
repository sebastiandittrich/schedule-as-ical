export interface Event {
    start: string,
    end: string,
    name: string
}

export class AutoMap<K, V> extends Map<K, V> {
    constructor(public generator: (key: K) => V) {
        super()
    }

    get(key: K): V {
        if(!this.has(key)) {
            this.set(key, this.generator(key))
        }
        return super.get(key)!
    }

    toMap() {
        return new Map(this)
    }
}
