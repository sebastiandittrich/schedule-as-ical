import { readFile } from 'xlsx'
import { excelToJson } from './excel-to-json'
import { planToIcal } from './json-to-ical'
import fetch from "node-fetch";
import { get as _get } from 'https';
import { pipeline } from 'stream/promises';
import { createWriteStream, existsSync, readFileSync, writeFile, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { DateTime } from 'luxon'

export async function main(args: Partial<{excludeNKL: unknown, exclude: unknown, onlynth: unknown}> = {}) {
    const excludeList = []
    const nthMap = new Map<string, number>()
    if(args.exclude && typeof args.exclude == 'string') {
        excludeList.push(...args.exclude.split(','))
    }
    if(args.onlynth && typeof args.onlynth == 'string') {
        args.onlynth.split(',').map(entry => {
            const splitted = entry.split(':')
            nthMap.set(splitted[0], parseInt(splitted[1]))
        })
    }
    const plan = await cache('plan', 60*60, async () => {
        await fetchFile('./__downloaded_plan.xlsx')

        return excelToJson(readFile('./__downloaded_plan.xlsx'))
    })
    const count = new Map<string, number>()
    const filteredPlan = plan.filter((event) => {
        if(args.excludeNKL) {
            if(event.name.startsWith('NKL')) return false
        }
        if(excludeList.includes(event.name)) return false
        if(nthMap.has(event.name)) {
            count.set(event.name, (count.get(event.name) || 0)+1)
            if(count.get(event.name) != nthMap.get(event.name)) return false
        }
        return true
    })
    const ical = planToIcal(filteredPlan)

    return { body: ical }
}

async function cache<T>(name: string, durationInSeconds: number, generator: () => T) {
    const filename = `./__cache.json`
    let cache = {}
    if(existsSync(filename)) {
        const content = readFileSync(filename).toString('utf-8')
        cache = JSON.parse(content)
    }
    if(cache[name]) {
        const {writtenAt, data} = cache[name]
        if(DateTime.fromISO(writtenAt).plus({seconds: durationInSeconds}) > DateTime.now()) {
            return data
        }
    }
    const data = await generator()
    const writtenAt = DateTime.now().toISO()
    writeFileSync(filename, JSON.stringify({ ...cache, [name]: { writtenAt, data } }))
    return data
}

async function fetchFile(filename: string) {
    const get = (url: string) => new Promise<IncomingMessage>((res) => _get(url, res));

    const cookieRes = await get(process.env.SHARE_URL as string)

    const cookies = (cookieRes.headers['set-cookie'] as string[]).map(cookie => cookie.split(';')[0]).join('; ')

    const res = await fetch("https://leibnizfh-my.sharepoint.com/personal/la_leibniz-fh_de/_api/files('Leibniz-FH/Stundenpl%C3%A4ne/IT-Security/dIT%202020-23/Stundenplanung_5Sem_dIT20.xlsx')/$value", {
        headers: {
            "Cookie": cookies
        }
    })

    if (!res.ok) throw new Error(`unexpected response ${res.statusText}`);

    await pipeline(res.body, createWriteStream(filename));
}
