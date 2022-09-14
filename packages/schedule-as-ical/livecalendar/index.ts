import { readFile } from 'xlsx'
import { excelToJson } from './excel-to-json'
import { planToIcal } from './json-to-ical'
import fetch from "node-fetch";
import { get as _get } from 'https';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { IncomingMessage } from 'http';

export async function main() {
    const get = (url: string) => new Promise<IncomingMessage>((res) => _get(url, res));

    const cookieRes = await get(process.env.SHARE_URL as string)

    const cookies = (cookieRes.headers['set-cookie'] as string[]).map(cookie => cookie.split(';')[0]).join('; ')

    const res = await fetch("https://leibnizfh-my.sharepoint.com/personal/la_leibniz-fh_de/_api/files('Leibniz-FH/Stundenpl%C3%A4ne/IT-Security/dIT%202020-23/Stundenplanung_5Sem_dIT20.xlsx')/$value", {
        headers: {
            "Cookie": cookies
        }
    })

    if (!res.ok) throw new Error(`unexpected response ${res.statusText}`);

    await pipeline(res.body, createWriteStream('./__downloaded_plan.xlsx'));

    const plan = excelToJson(readFile('./__downloaded_plan.xlsx'))
    const ical = planToIcal(plan)

    return { body: ical }
}

function test() {


}
