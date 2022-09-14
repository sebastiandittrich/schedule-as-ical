"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planToIcal = void 0;
const ical_generator_1 = require("ical-generator");
function planToIcal(entries) {
    return (0, ical_generator_1.default)({
        events: entries
            .map(({ start, end, name }) => ({
            start,
            end,
            summary: name
        }))
    }).toString();
}
exports.planToIcal = planToIcal;
