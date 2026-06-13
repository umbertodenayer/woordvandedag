# Word of the Day

A minimal, no-framework word-of-the-day site. Pure HTML, CSS, and JavaScript.

The word changes daily (based on UTC date) so every visitor sees the same word on a given day. The word list and rotation logic live in `words.js` and `script.js`.

## Run locally

Just open `index.html` in a browser, or serve the folder:

```
npx serve .
```

## Deploy on Railway

1. Push this repo to GitHub.
2. In Railway, create a new project from this GitHub repo.
3. Railway will detect `package.json` and run `npm install && npm start`, which serves the static files on the assigned `$PORT`.

No further configuration needed.
