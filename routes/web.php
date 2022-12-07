<?php

use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Carbon\CarbonTimeZone;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Support\Stringable;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\RichText\RichText;
use Spatie\IcalendarGenerator\Components\Calendar;
use Spatie\IcalendarGenerator\Components\Event;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

function download_schedule(string $download_to)
{
    $share_url = config('app.share_url');
    $schedule_filename = "Leibniz-FH/Stundenpl%C3%A4ne/IT-Security/dIT%202020-23/Stundenplan%206%20Sem%20dIT20.xlsx";
    $schedule_url = "https://leibnizfh-my.sharepoint.com/personal/la_leibniz-fh_de/_api/files('$schedule_filename')/\$value";

    $response = Http::get($share_url);
    $cookie_string = collect($response->headers()['Set-Cookie'])->map(fn ($cookie) => Str::of($cookie)->explode(';')[0])->join(';');

    $download = Http::withHeaders([
        "Cookie" => $cookie_string,
    ])->get($schedule_url);

    file_put_contents($download_to, $download->body());
}

function get_name_from_cell(Cell $cell)
{
    $cell_value = $cell->isInMergeRange()
        ? $cell->getWorksheet()->getCell(explode(':', $cell->getMergeRange())[0])->getValue()
        : $cell->getValue();

    $name = "";
    if ($cell_value instanceof RichText) {
        // Remove parts that have been striked through
        foreach ($cell_value->getRichTextElements() as $element) {
            $font = $element->getFont();
            if (!$font || !$font->getStrikethrough()) {
                $name .= $element->getText();
            }
        }
    } else {
        if (!$cell->getStyle()->getFont()->getStrikethrough()) {
            // Nothing is striked through
            $name = (string)$cell_value;
        }
    }

    // Trim Newlines and trailing semicolons
    $name = normalize_name($name);

    return $name;
}

function parse_timerange(string $timerange)
{
    [$start, $end] = Str::of($timerange)
        ->explode('-', 2)
        ->map(fn ($time) => Str::of($time)->explode(':', 2)->map(fn ($value) => intval($value)));
    return [
        'start' => ['hour' => $start[0], 'minute' => $start[1]],
        'end' => ['hour' => $end[0], 'minute' => $end[1]],
    ];
}

function normalize_name(string $name)
{
    return Str::of($name)->replace('\n', ',')->trim()->trim(';')->trim()->trim(';')->toString();
}

function get_special_time_from_name(string $name)
{
    $timeRegex = "/[0-9][0-9]?:[0-9][0-9][ ]*-[ ]*[0-9][0-9]?:[0-9][0-9]/";

    $matches = Str::of($name)->matchAll($timeRegex);

    if ($matches->count() == 1) {
        return [
            'timerange' => parse_timerange((string)$matches[0]),
            'newname' => normalize_name(Str::of($name)->replaceMatches($timeRegex, '')->toString())
        ];
    }
    return false;
}

function get_tags_from_cell(Cell $cell)
{
    $color = $cell->getStyle()->getFill()->getStartColor()->getARGB();
    $color_prefixes = [
        'FFFFFF00' => 'online'
    ];
    return [
        ...(key_exists($color, $color_prefixes) ? [$color_prefixes[$color]] : [])
    ];
}

function filter_by_config(array $classes)
{
    return function ($value) use ($classes) {
        $name = str($value['name']);
        if ($name->contains($classes)) return true;
        return false;
    };
}

function get_ical_event_name(array $event)
{
    if ($event['tags']) {
        return "(" . collect($event['tags'])->join(', ') . ") " . $event['name'];
    }

    return $event['name'];
}

function set_time(CarbonImmutable $dateTime, array $time)
{
    return $dateTime->setHour($time['hour'])->setMinute($time['minute']);
}

function excel_to_calendar(string $filename): Collection
{
    $timeRegex = "/[0-9][0-9]?:[0-9][0-9][ ]*-[ ]*[0-9][0-9]?:[0-9][0-9]/";

    $reader = new \PhpOffice\PhpSpreadsheet\Reader\Xlsx();
    $spreadsheet = $reader->load($filename);
    $sheet = $spreadsheet->getSheet(0);

    $plan = collect();
    $weeknumber = null;
    foreach ($sheet->getRowIterator(0, 200) as $row) {
        $rowNumber = $row->getRowIndex() + 1;
        $colB = $sheet->getCell([2, $rowNumber])->getCalculatedValue();
        if (gettype($colB) == 'integer') {
            $weeknumber = $colB;
        } else if (gettype($colB) == 'string' && preg_grep($timeRegex, [$colB])) {
            if (!$weeknumber) throw new Error("No current Week detected");
            [$start, $end] = collect(explode('-', $colB))->map(function ($value) {
                [$hour, $minute] = explode(':', $value);
                return ['hour' => $hour, 'minute' => $minute];
            });
            foreach ([1, 2, 3, 4, 5, 6] as $weekday) {
                $day = CarbonImmutable::createMidnightDate(tz: CarbonTimeZone::create('Europe/Berlin'))->setISODate(2023, $weeknumber, $weekday);
                $cell = $sheet->getCell([2 + $weekday, $rowNumber]);

                $plan->push([
                    'tags' => get_tags_from_cell($cell),
                    'name' => get_name_from_cell($cell),
                    'start' => $day->setHour($start['hour'])->setMinute($start['minute']),
                    'end' => $day->setHour($end['hour'])->setMinute($end['minute']),
                ]);
            }
        }
    }
    return $plan
        ->filter(fn ($event) => $event['name'] != null)
        ->sortBy('start')
        ->reduce(function ($reduced, $current) {
            $filterfunc = fn ($event) => $event['end'] == $current['start'] && $current['name'] == $event['name'];
            $found = $reduced->first($filterfunc);
            if ($found) {
                $reduced = $reduced->filter(fn ($event) => !$filterfunc($event))->push([
                    ...$found,
                    'end' => $current['end']
                ]);
            } else {
                $reduced->push($current);
            }
            return $reduced;
        }, collect([]))
        ->map(function (array $event) {
            ['timerange' => $specialTime, 'newname' => $newName] = get_special_time_from_name($event['name']);

            if (!$specialTime) return $event;

            return [
                ...$event,
                'name' => $newName,
                'start' => set_time($event['start'], $specialTime['start']),
                'end' => set_time($event['end'], $specialTime['end']),
            ];
        })
        // Feiertage
        ->filter(fn ($value) => !in_array($value['name'], []))
        ->values();
}

function get_cached_calendar(): Collection
{
    return Cache::remember('download_schedule', App::isProduction() ? 60 * 60 : 0, function () {
        $excel_path = storage_path('downloaded_plan.xlsx');
        if (App::isProduction()) {
            download_schedule($excel_path);
        }
        return excel_to_calendar(
            $excel_path,
        );
    });
}

Route::get('/livecalendar', function (Request $request) {
    $request->validate([
        'classes' => ['array'],
    ]);

    $calendar = get_cached_calendar();

    return $calendar
        ->filter(filter_by_config(
            classes: $request->input('classes', []),
        ))
        // ->map(fn ($event) => $event['start']->toIsoString() . " " . get_ical_event_name($event))
        // ->join('<br>');
        ->reduce(
            fn ($calendar, $event) => $calendar->event(
                Event::create(get_ical_event_name($event))
                    ->startsAt($event['start'])
                    ->endsAt($event['end'])
            ),
            Calendar::create('Leibniz-FH dIT20 Sem 5')
        )
        ->toString();
})->name('calendar');

Route::post('/config', function (Request $request) {
    return route('calendar', [
        'classes' => $request->get('classes', [])
    ]);
})->name('config.generate');
Route::get('/config', function () {
    $classes = get_classes();
    return view('config', [
        'classes' => $classes
    ]);
});

function extract_information(string $raw)
{
    $name = str($raw);

    if ($name->startsWith('NKL') || $name->startsWith('Klausur')) {
        return [$name];
    }

    // Remove parentheses like "(12-15 Uhr)"
    $classes = $name
        ->replaceMatches("/\(.*\)/", '')
        ->split('/[\/\;\,\n]/')
        ->map(fn (string $name) => normalize_name($name))
        ->filter(fn (string $name) => $name != '');

    return $classes;
}

function get_classes(): Collection
{
    return get_cached_calendar()
        ->map(fn ($event) => Str::of(normalize_name($event['name'])))
        ->flatMap(fn ($name) => extract_information($name))
        ->unique()
        ->sort();
}
