import { readFile } from 'xlsx'
import { excelToJson } from './excel-to-json'
import { planToIcal } from './json-to-ical'
import fetch from "node-fetch";
import { get as _get } from 'https';
import { pipeline } from 'stream/promises';
import { createWriteStream, existsSync, readFileSync, writeFile, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { DateTime } from 'luxon'

export async function main() {
    const ical = cache('ical', 60*60, async () => {
        console.log('not cached')
        await fetchFile('./__downloaded_plan.xlsx')

        const plan = excelToJson(readFile('./__downloaded_plan.xlsx'))
        const ical = planToIcal(plan)
        return ical
    })

    return { body: ical }
}

async function cache<T>(name: string, durationInSeconds: number, generator: () => T) {
    const filename = `./__cache_${name}`
    if(existsSync(filename)) {
        const content = readFileSync(filename).toString('utf-8')
        const {data, writtenAt} = JSON.parse(content)
        if(DateTime.fromISO(writtenAt).plus({seconds: durationInSeconds}) > DateTime.now()) {
            return data
        }
    }
    const data = await generator()
    const writtenAt = DateTime.now().toISO()
    writeFileSync(filename, JSON.stringify({ writtenAt, data }))
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
