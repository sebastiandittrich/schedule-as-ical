import { DateTime } from 'https://esm.sh/luxon@3.0.1';
import {AutoMap, Event} from './lib.ts'

const entries = (JSON.parse(new TextDecoder("utf-8").decode(Deno.readFileSync(Deno.args[0]))) as Event[])
    .filter(event => !event.name.startsWith('NKL'))
    .filter(event => !event.name.startsWith('Klausur'))

const sorted = new AutoMap((_: string) => [] as Event[])

for(const entry of entries) {
    sorted.get(entry.name).push(entry)
}

const progressbar = (num: number) => `[${'='.repeat(num * 10).padEnd(10, ' ')}]`
const progressline = (summary: string, entries: Event[]) => {
    const past = entries.filter(entry => DateTime.fromISO(entry.start).diffNow().as('minutes') <= 0).reduce((sum, current) => sum + DateTime.fromISO(current.end).diff(DateTime.fromISO(current.start)).as('minutes'), 0)
    const future = entries.filter(entry => DateTime.fromISO(entry.start).diffNow().as('minutes') > 0).reduce((sum, current) => sum + DateTime.fromISO(current.end).diff(DateTime.fromISO(current.start)).as('minutes'), 0)
    const total = past + future
    return `${progressbar(past / total)} ${Math.round((past / total)*100).toString().padStart(3, ' ')}% ${summary} (${past}min/${total}min)`
}

for(const [summary, entries] of sorted.entries()) {
    console.log(progressline(summary, entries))
}
console.log('------------------------------------------')
console.log(progressline('Total', entries))
