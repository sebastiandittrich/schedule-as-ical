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
async function main() {
    const ical = await cache('ical', 60 * 60, async () => {
        console.log('not cached');
        await fetchFile('./__downloaded_plan.xlsx');
        const plan = (0, excel_to_json_1.excelToJson)((0, xlsx_1.readFile)('./__downloaded_plan.xlsx'));
        const ical = (0, json_to_ical_1.planToIcal)(plan);
        return ical;
    });
    return { body: ical };
}
exports.main = main;
async function cache(name, durationInSeconds, generator) {
    const filename = `./__cache_${name}`;
    if ((0, fs_1.existsSync)(filename)) {
        const content = (0, fs_1.readFileSync)(filename).toString('utf-8');
        const { data, writtenAt } = JSON.parse(content);
        if (luxon_1.DateTime.fromISO(writtenAt).plus({ seconds: durationInSeconds }) > luxon_1.DateTime.now()) {
            return data;
        }
    }
    const data = await generator();
    const writtenAt = luxon_1.DateTime.now().toISO();
    (0, fs_1.writeFileSync)(filename, JSON.stringify({ writtenAt, data }));
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
