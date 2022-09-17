"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const xlsx_1 = require("xlsx");
const excel_to_json_1 = require("./excel-to-json");
const json_to_ical_1 = require("./json-to-ical");
const node_fetch_1 = require("node-fetch");
const https_1 = require("https");
const promises_1 = require("stream/promises");
const fs_1 = require("fs");
const luxon_1 = require("luxon");
async function main(args = {}) {
    console.log(args);
    const excludeList = [];
    const nthMap = new Map();
    if (args.exclude && typeof args.exclude == 'string') {
        excludeList.push(...args.exclude.split(','));
    }
    if (args.onlynth && typeof args.onlynth == 'string') {
        args.onlynth.split(',').map(entry => {
            const splitted = entry.split(':');
            nthMap.set(splitted[0], parseInt(splitted[1]));
        });
    }
    const plan = await cache('plan', 60 * 60, async () => {
        await fetchFile('./__downloaded_plan.xlsx');
        return (0, excel_to_json_1.excelToJson)((0, xlsx_1.readFile)('./__downloaded_plan.xlsx'));
    });
    const count = new Map();
    const filteredPlan = plan.sort((a, b) => a.start < b.start ? -1 : 1).filter((event) => {
        if (args.excludeNKL) {
            if (event.name.startsWith('NKL'))
                return false;
        }
        if (excludeList.includes(event.name))
            return false;
        if (nthMap.has(event.name)) {
            count.set(event.name, (count.get(event.name) || 0) + 1);
            if (count.get(event.name) != nthMap.get(event.name))
                return false;
        }
        return true;
    });
    const ical = (0, json_to_ical_1.planToIcal)(filteredPlan);
    return { body: ical };
}
exports.main = main;
async function cache(name, durationInSeconds, generator) {
    const filename = `./__cache.json`;
    let cache = {};
    if ((0, fs_1.existsSync)(filename)) {
        const content = (0, fs_1.readFileSync)(filename).toString('utf-8');
        cache = JSON.parse(content);
    }
    if (cache[name]) {
        const { writtenAt, data } = cache[name];
        if (luxon_1.DateTime.fromISO(writtenAt).plus({ seconds: durationInSeconds }) > luxon_1.DateTime.now()) {
            return data;
        }
    }
    const data = await generator();
    const writtenAt = luxon_1.DateTime.now().toISO();
    (0, fs_1.writeFileSync)(filename, JSON.stringify({ ...cache, [name]: { writtenAt, data } }));
    return data;
}
async function fetchFile(filename) {
    const get = (url) => new Promise((res) => (0, https_1.get)(url, res));
    const cookieRes = await get(process.env.SHARE_URL);
    const cookies = cookieRes.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
    const res = await (0, node_fetch_1.default)("https://leibnizfh-my.sharepoint.com/personal/la_leibniz-fh_de/_api/files('Leibniz-FH/Stundenpl%C3%A4ne/IT-Security/dIT%202020-23/Stundenplanung_5Sem_dIT20.xlsx')/$value", {
        headers: {
            "Cookie": cookies
        }
    });
    if (!res.ok)
        throw new Error(`unexpected response ${res.statusText}`);
    await (0, promises_1.pipeline)(res.body, (0, fs_1.createWriteStream)(filename));
}
