// @deno-types="https://deno.land/x/sheetjs/types/index.d.ts"
import * as XLSX from 'https://deno.land/x/sheetjs/xlsx.mjs'
import { DateTime } from 'https://esm.sh/luxon';
import './polyfill.ts'
import {AutoMap, Event} from './lib.ts'

const xlsx = XLSX.readFile(Deno.args[0])

const sheet = xlsx.Sheets[xlsx.SheetNames[0]]

const cellnames = Object.keys(sheet).filter(key => !key.startsWith('!'))

const cellvalues = cellnames.reduce((values, cellname) => {
    const [colname, rowname] = cellname.match(/([A-Z]+)([0-9]+)/)!.slice(1)
    values.get(colname.charCodeAt(0) - "A".charCodeAt(0)).set(parseInt(rowname)-1, sheet[cellname].v)
    return values
}, new AutoMap((_: number) => new AutoMap((_: number) => '' as unknown)))

const entries: Event[] = []

function findmerge(col: number, row: number) {
    return sheet['!merges']!.find(({s, e}) => col >= s.c && col <= e.c && row >= s.r && row <= e.r)
}

function parseTime(time: string) {
    const [hour, minute] = time.split(':').map((value) => parseInt(value))
    return { hour, minute, }
}

let week = 0
for(const [rowname, cell] of cellvalues.get(1).entries()) {
    if(cell == 'KW') {
        week = cellvalues.get(1).get(rowname+1) as number
    } else if(typeof cell == 'string' && cell.match(/[0-9][0-9]?:[0-9][0-9]-[0-9][0-9]?:[0-9][0-9]/)) {
        const [starttime, endtime] = cell.split('-')
        for(const [colname, dayindex] of [[2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [7, 6]] as const) {
            const summary = (cellvalues.get(colname).get(rowname) as string).replaceAll('\r\n', ' ')
            if(summary == "") {
                continue
            }
            const merge = findmerge(colname, rowname)
            const day = DateTime.fromObject({ weekNumber: week, weekday: dayindex}, {zone: 'Europe/Berlin'})
            if(merge) {
                const lastrow = merge.e.r
                const endtime = (cellvalues.get(1).get(lastrow) as string).split('-')[1]
                const start = day.set(parseTime(starttime)).toISO()
                const end = day.set(parseTime(endtime)).toISO()
                entries.push({ start, end, summary })
            } else {
                const start = day.set(parseTime(starttime)).toISO()
                const end = day.set(parseTime(endtime)).toISO()
                entries.push({ start, end, summary })
            }
        }
    }
}

console.log(JSON.stringify(entries))
