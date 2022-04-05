import './polyfill.ts'
import ical from 'https://esm.sh/ical-generator?no-check';

const entries = (JSON.parse(new TextDecoder("utf-8").decode(Deno.readFileSync(Deno.args[0]))) as Event[])

const cal = ical({ events: entries })

console.log(cal.toString())
