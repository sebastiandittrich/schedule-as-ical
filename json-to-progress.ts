import { DateTime } from 'https://esm.sh/luxon';
import {AutoMap, Event} from './lib.ts'

const entries = (JSON.parse(new TextDecoder("utf-8").decode(Deno.readFileSync(Deno.args[0]))) as Event[])
    .filter(event => !event.summary.startsWith('NKL'))
    .filter(event => !event.summary.startsWith('Klausur'))
    .filter(event => !['Himmelfahrt', 'Pfingsten', 'Ostermontag', 'Karfreitag'].includes(event.summary))

const sorted = new AutoMap((_: string) => [] as Event[])

for(const entry of entries) {
    sorted.get(entry.summary).push(entry)
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
