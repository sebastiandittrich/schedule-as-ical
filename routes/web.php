<?php

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
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
    $schedule_filename = "Leibniz-FH/Stundenpl%C3%A4ne/IT-Security/dIT%202020-23/Stundenplan%205%20Sem_dIT20.xlsx";
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
    $name = Str::of($name)->replace('\n', '')->trim()->trim(';')->trim()->trim(';')->toString();

    return $name;
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

function filter_by_config(array $exclude, bool $excludeNKL, array $onlyNth)
{
    $count = [];
    return function ($value) use ($exclude, $excludeNKL, $onlyNth, &$count) {
        $name = $value['name'];
        if (in_array($name, $exclude)) return false;
        if ($excludeNKL && str_starts_with($name, 'NKL')) return false;
        if (isset($onlyNth[$name])) {
            $count[$name] ??= 0;
            $count[$name]++;
            if ($count[$name] == $onlyNth[$name]) return true;
            return false;
        }
        return true;
    };
}

function get_ical_event_name(array $event)
{
    if ($event['tags']) {
        return "(" . collect($event['tags'])->join(', ') . ") " . $event['name'];
    }

    return $event['name'];
}

function excel_to_calendar(string $filename): Collection
{
    $timeRegex = "/[0-9][0-9]?:[0-9][0-9]-[0-9][0-9]?:[0-9][0-9]/";

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
                $day = CarbonImmutable::createMidnightDate()->setISODate(CarbonImmutable::now()->year, $weeknumber, $weekday);
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
        ->filter(fn ($value) => !in_array($value['name'], ['Tag der deutschen Einheit', 'Reformationstag']))
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
        'excludeNKL' => ['nullable', 'boolean'],
        'exclude' => ['array'],
        'onlyNth' => ['array']
    ]);

    $calendar = get_cached_calendar();

    return $calendar
        ->filter(filter_by_config(
            exclude: $request->input('exclude', []),
            excludeNKL: $request->boolean('excludeNKL', false),
            onlyNth: array_map(fn ($value) => intval($value), $request->input('onlyNth', []))
        ))
        ->reduce(
            fn ($calendar, $event) => $calendar->event(
                Event::create(get_ical_event_name($event))
                    ->startsAt($event['start'])
                    ->endsAt($event['end'])
            ),
            Calendar::create('Leibniz-FH dIT20 Sem 5')->withoutTimezone()
        )
        ->toString();
})->name('calendar');

Route::post('/config', function (Request $request) {
    return route('calendar', $request->only([
        'excludeNKL', 'exclude', 'onlyNth'
    ]));
})->name('config.generate');
Route::get('/config', function () {
    $classes = get_cached_calendar()->map(fn ($event) => $event['name'])->unique()->sort();
    return view('config', [
        'classes' => $classes
    ]);
});
Route::get('/config/sebastian', function () {
    return route('calendar', [
        'excludeNKL' => true,
        'exclude' => ['TE3', 'WF KI', 'PrITAA A', 'IT-Risk'],
        'onlyNth' => ['PR-Vorträge (Ahlers)' => 2],
    ]);
});
