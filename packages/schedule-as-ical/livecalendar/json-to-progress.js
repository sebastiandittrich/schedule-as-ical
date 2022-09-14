"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const luxon_3_0_1_1 = require("https://esm.sh/luxon@3.0.1");
const lib_ts_1 = require("./lib.ts");
const entries = JSON.parse(new TextDecoder("utf-8").decode(Deno.readFileSync(Deno.args[0])))
    .filter(event => !event.name.startsWith('NKL'))
    .filter(event => !event.name.startsWith('Klausur'));
const sorted = new lib_ts_1.AutoMap((_) => []);
for (const entry of entries) {
    sorted.get(entry.name).push(entry);
}
const progressbar = (num) => `[${'='.repeat(num * 10).padEnd(10, ' ')}]`;
const progressline = (summary, entries) => {
    const past = entries.filter(entry => luxon_3_0_1_1.DateTime.fromISO(entry.start).diffNow().as('minutes') <= 0).reduce((sum, current) => sum + luxon_3_0_1_1.DateTime.fromISO(current.end).diff(luxon_3_0_1_1.DateTime.fromISO(current.start)).as('minutes'), 0);
    const future = entries.filter(entry => luxon_3_0_1_1.DateTime.fromISO(entry.start).diffNow().as('minutes') > 0).reduce((sum, current) => sum + luxon_3_0_1_1.DateTime.fromISO(current.end).diff(luxon_3_0_1_1.DateTime.fromISO(current.start)).as('minutes'), 0);
    const total = past + future;
    return `${progressbar(past / total)} ${Math.round((past / total) * 100).toString().padStart(3, ' ')}% ${summary} (${past}min/${total}min)`;
};
for (const [summary, entries] of sorted.entries()) {
    console.log(progressline(summary, entries));
}
console.log('------------------------------------------');
console.log(progressline('Total', entries));
