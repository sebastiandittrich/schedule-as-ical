import ical from 'ical-generator';
import { Event } from './lib';

export function planToIcal(entries: Event[]) {
    return ical({
        events: entries
            .map(({start, end, name}) => ({
                start,
                end,
                summary: name
            }))
    }).toString()
}
