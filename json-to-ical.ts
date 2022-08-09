import './polyfill.ts'
import ical from 'https://esm.sh/ical-generator@3.5.1?no-check';
import { Event } from './lib.ts';

const entries = (JSON.parse(new TextDecoder("utf-8").decode(Deno.readFileSync(Deno.args[0]))) as Event[])

const cal = ical({
    events: entries.map(({start, end, name}) => ({
        start,
        end,
        summary: name
    }))
})

console.log(cal.toString())
