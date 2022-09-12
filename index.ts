import { readFile } from 'xlsx'
import { excelToJson } from './excel-to-json'
import { planToIcal } from './json-to-ical'

const plan = excelToJson(readFile('./sem5.xlsx'))
const ical = planToIcal(plan)

console.log(ical)
