
// @deno-types="https://deno.land/x/sheetjs@v0.18.3/types/index.d.ts"
import * as XLSX from 'https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs'
import { DateTime } from 'https://esm.sh/luxon@3.0.1';
import './polyfill.ts'
import {AutoMap, Event} from './lib.ts'

const timeRegex = /[0-9][0-9]?:[0-9][0-9]-[0-9][0-9]?:[0-9][0-9]/


const xlsx = XLSX.readFile(Deno.args[0])
const sheet = xlsx.Sheets[xlsx.SheetNames[0]]
const sheetMap = sheetToMap(sheet)
const plan = mapToPlan(sheetMap)

console.log(JSON.stringify(plan))

// Read time from string like "14:00" into { hour: 14, minute: 0 }
function parseTime(time: string) {
    const [hour, minute] = time.split(':').map((value) => parseInt(value))
    return { hour, minute, }
}

// Turn column and row into a cell name in excel like A1 or B2
function colrowToA1(col: number, row: number) {
    const colnames = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    const colname = colnames[col]
    if(colname === undefined) {
        throw new Error('Column number out of range.')
    }
    return `${colname}${row+1}`
}

// Returns map with row -> column schema
function sheetToMap(sheet: XLSX.WorkSheet) {

    const cellnames = Object.keys(sheet).filter(key => !key.startsWith('!'))

    const table = cellnames.reduce((values, cellname) => {
        const [colname, rowname] = cellname.match(/([A-Z]+)([0-9]+)/)!.slice(1)
        const [colnumber, rownumber] = [colname.charCodeAt(0) - "A".charCodeAt(0), parseInt(rowname)-1]
        const value = sheet[cellname].v
        values.get(rownumber).set(colnumber, value)
        return values
    }, new AutoMap((_: number) => new Map<number, unknown>()))

    // Insert values into merged cells
    for(const merge of sheet['!merges'] || []) {
        const cellname = colrowToA1(merge.s.c, merge.s.r)
        const value = sheet[cellname]?.v

        if(value) {
            for(let r = merge.s.r; r <= merge.e.r; r++) {
                for(let c = merge.s.c; c <= merge.e.c; c++) {
                    table.get(r).set(c, value)
                }
            }
        }
    }

    return table.toMap()
}

function mapToPlan(map: Map<number, Map<number, unknown>>) {
    const plan: Event[] = []

    let weekNumber: number|null = null
    for(const [rownumber, cols] of map) {
        const colB = cols.get(1)
        if(typeof colB == 'number') {
            weekNumber = colB
        } else if(typeof colB == 'string' && colB.match(timeRegex)) {
            if(!weekNumber) throw new Error("No current Week detected");

            const [starttime, endtime] = colB.split('-').map((time) => parseTime(time))

            for(const weekday of [1,2,3,4,5,6]) {
                const day = DateTime.fromObject({ weekNumber, weekday}, {zone: 'Europe/Berlin'})
                const name = cols.get(1+weekday)
                if(name === undefined) continue // No event on this day
                if(!(typeof name == 'string')) throw new Error('Event name must be a string')

                plan.push({
                    start: day.set(starttime).toISO(),
                    end: day.set(endtime).toISO(),
                    name
                })
            }
        }
    }

    return plan.reduce((merged, event) => {
        // Find events starting at the end date and the other way around with the same name. Merge them together
        const after = merged.find(otherevent => otherevent.start == event.end && otherevent.name == event.name)
        if(after) after.start = event.start
        const previous = merged.find(otherevent => otherevent.end == event.start && otherevent.name == event.name)
        if(previous) previous.end = event.end

        if(!previous && !after) merged.push({start: event.start, end: event.end, name: event.name})

        return merged
    }, [] as Event[]).map(event => ({ ...event, name: event.name.replaceAll('\r\n', ' ').trim().replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('Ä', 'Ae').replaceAll('Ö', 'Oe').replaceAll('Ü', 'Ue'), })).filter(event => !["Reformationstag", "Tag der deutschen Einheit"].includes(event.name))
}
