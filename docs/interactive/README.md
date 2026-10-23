# Inside Tuck

Interactive lessons on the codebase, read from the bottom up: the model, then
the store, then rendering. Each lesson runs the app's real code and quotes it
from the source as it is now.

```bash
cd docs/interactive
npm install
npm run dev
```

It opens at http://localhost:5180 (the `docs` launch configuration in
`.claude/launch.json` starts the same server).

## Adding a lesson

1. Write a component in `src/lessons/<chapter>/` and give it to its entry in
   `src/lessons.ts` (an entry without a component shows as "soon").
2. Import what it explains from `@model/…` rather than copying it, and quote
   code with `<SourceView file="src/model/geometry.ts" name="toLayerSpace" />`,
   which reads the declaration by name from the file. A file a lesson quotes
   needs an entry in `src/source/sources.ts`.
3. Steps the reader works through go in a `<Flow>`: each step says what to try
   and checks the lesson's live state for when it's done.

`npm run build` type-checks the lessons against `src/` and bundles them. CI runs
it, so a change to something a lesson covers fails until the lesson is updated.
