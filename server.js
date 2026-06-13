const express = require('express');
const path = require('path');
const fs = require('fs');

function todaySeed() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
}

const app = express();
const cache = new Map(); // key: `${seed}` or `image:${seed}` -> data

const CACHE_FILE = path.join(__dirname, '.cache.json');

function loadCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const seed = todaySeed();
    for (const [key, value] of Object.entries(raw)) {
      if (key === `${seed}` || key === `image:${seed}`) {
        cache.set(key, value);
      }
    }
    console.log(`Loaded ${cache.size} cached entries for seed ${seed}`);
  } catch (e) {
    console.log('No usable cache file found, starting fresh.');
  }
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache)));
  } catch (e) {
    console.error('Failed to persist cache:', e.message);
  }
}

async function fetchWord() {
  const seed = todaySeed();

  const prompt = `Today's date seed is ${seed} (days since epoch, UTC). Using this seed so the result is deterministic and identical for everyone asking on this date, pick one interesting, uncommon word in English. Respond with ONLY a JSON object (no markdown, no code fences) with these exact keys:
{
  "word": "the word",
  "partOfSpeech": "its part of speech",
  "definition": "a clear definition",
  "etymology": "the word's etymology",
  "exampleSentence": "a real example sentence using the word, quoted from literature or journalism",
  "exampleSource": "the title/author or publication the example sentence is from"
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  let text = json.content[0].text.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(text);
}

async function fetchImage(word, definition) {
  const prompt = `A clean, minimal, modern editorial illustration representing the word "${word}" (${definition}). No text or letters in the image. Soft warm color palette, flat design, lots of negative space.`;

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image returned from OpenAI');
  return { mimeType: 'image/png', data: b64 };
}

async function refreshWord() {
  const seed = todaySeed();
  const cacheKey = `${seed}`;
  const imageCacheKey = `image:${seed}`;

  if (cache.has(cacheKey) && cache.has(imageCacheKey)) {
    console.log(`Already cached for seed ${seed}, skipping regeneration`);
    return;
  }

  let data = cache.get(cacheKey);
  if (!data) {
    try {
      data = await fetchWord();
      cache.set(cacheKey, data);
      saveCache();
      console.log(`Cached word of the day (seed ${seed}): ${data.word}`);
    } catch (e) {
      console.error('Failed to fetch word of the day:', e.message);
      return;
    }
  }

  try {
    const image = await fetchImage(data.word, data.definition);
    cache.set(imageCacheKey, image);
    saveCache();
    console.log(`Cached image (seed ${seed}): ${data.word}`);
  } catch (e) {
    console.error('Failed to fetch image:', e.message);
  }
}

function scheduleMidnightRefresh() {
  const now = new Date();
  const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const delay = nextMidnight - now.getTime();

  setTimeout(() => {
    refreshWord();
    setInterval(refreshWord, 24 * 60 * 60 * 1000);
  }, delay);
}

app.get('/api/image', async (req, res) => {
  const seed = todaySeed();
  const cacheKey = `${seed}`;
  const imageCacheKey = `image:${seed}`;

  let image = cache.get(imageCacheKey);
  if (!image) {
    let wordData = cache.get(cacheKey);
    if (!wordData) {
      try {
        wordData = await fetchWord();
        cache.set(cacheKey, wordData);
        saveCache();
      } catch (e) {
        res.status(500).json({ error: e.message });
        return;
      }
    }
    try {
      image = await fetchImage(wordData.word, wordData.definition);
      cache.set(imageCacheKey, image);
      saveCache();
    } catch (e) {
      res.status(500).json({ error: e.message });
      return;
    }
  }

  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(image);
});

app.get('/api/word', async (req, res) => {
  const seed = todaySeed();
  const cacheKey = `${seed}`;

  let data = cache.get(cacheKey);
  if (!data) {
    try {
      data = await fetchWord();
      cache.set(cacheKey, data);
      saveCache();
    } catch (e) {
      res.status(500).json({ error: e.message });
      return;
    }
  }

  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(data);
});

app.use(express.static(path.join(__dirname), {
  setHeaders: (res) => res.set('Cache-Control', 'no-cache')
}));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
  loadCache();
  refreshWord();
  scheduleMidnightRefresh();
});
