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
function main() {
    return { body: 'Done.' };
}
exports.main = main;
function test() {
    const get = (url) => new Promise((res) => (0, https_1.get)(url, res));
    (async () => {
        const cookieRes = await get(process.env.SHARE_URL);
        const cookies = cookieRes.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
        const res = await (0, node_fetch_1.default)("https://leibnizfh-my.sharepoint.com/personal/la_leibniz-fh_de/_api/files('Leibniz-FH/Stundenpl%C3%A4ne/IT-Security/dIT%202020-23/Stundenplanung_5Sem_dIT20.xlsx')/$value", {
            headers: {
                "Cookie": cookies
            }
        });
        if (!res.ok)
            throw new Error(`unexpected response ${res.statusText}`);
        await (0, promises_1.pipeline)(res.body, (0, fs_1.createWriteStream)('./__downloaded_plan.xlsx'));
        const plan = (0, excel_to_json_1.excelToJson)((0, xlsx_1.readFile)('./__downloaded_plan.xlsx'));
        const ical = (0, json_to_ical_1.planToIcal)(plan);
        console.log(ical);
    })();
}
