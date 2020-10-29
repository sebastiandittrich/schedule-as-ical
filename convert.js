const fs = require('fs')
const moment = require('moment')
const ical = require('ical-generator');

const config = {
    duration: [3.25, 'hours'],
    names: {
        ma: 'Mathematik',
        we: 'Englisch',
        me: 'Methodik',
        rem: 'Requirements Engineering & Methoden',
        inf: 'Informatik und Digitaltechnik',
        prog: 'Programmierung',
        abwl: 'Allgemeine Betriebswirtschaftslehre',
        wert: 'Wertschöpfung',
        bsys: 'Betriebssysteme',
        cnglint: 'Computernetze',
        wissar: 'Wissenschaftliches Arbeiten',
        alg: 'Algorithmen und Datenstrukturen',
    }
}

const filepath = process.argv[2]
const resultpath = process.argv[3]

const lines = fs.readFileSync(filepath).toString().split('\n')

const times = lines[0].split('\t').slice(1)
const events = lines.slice(1).map(line => line.split('\t')).map(([date, ...slots]) => slots.map((slot, index) => (slot ? {
    summary: config.names[slot],
    start: moment(`${date} ${times[index]}`),
    end: moment(`${date} ${times[index]}`).add(...config.duration)
} : null)).filter(slot => slot)).reduce((all, current) => [...all, ...current], [])

const cal = ical({ events })
fs.writeFileSync(resultpath, cal.toString())