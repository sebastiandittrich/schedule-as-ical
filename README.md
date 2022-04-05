# Converter for Leibniz FH Schedule into ical-file

## Usage

Turn the schedule into json:

```bash
deno run --allow-read excel-to-json.ts [path to xlsx file].xlsx > dist/semester[x].json
```

Turn the json into an ical:

```bash
deno run --allow-read json-to-ical.ts dist/semester[x].json > dist/semester[x].ical
```

## Show the progress of the current semester

```bash
deno run --allow-read json-to-progress.ts dist/semester[x].json
```
