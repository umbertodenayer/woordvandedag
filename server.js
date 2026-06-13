const express = require('express');
const path = require('path');

const LANG_NAMES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  nl: 'Dutch'
};

function todaySeed() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
}

const app = express();
const cache = new Map(); // key: `${seed}:${lang}` -> word data

async function fetchWord(lang) {
  const languageName = LANG_NAMES[lang] || LANG_NAMES.en;
  const seed = todaySeed();

  const prompt = `Today's date seed is ${seed} (days since epoch, UTC). Using this seed so the result is deterministic and identical for everyone asking on this date, pick one interesting, uncommon word in ${languageName}. Respond with ONLY a JSON object (no markdown, no code fences) with these exact keys:
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

async function refreshWord(lang) {
  const seed = todaySeed();
  const cacheKey = `${seed}:${lang}`;
  try {
    const data = await fetchWord(lang);
    cache.set(cacheKey, data);
    console.log(`Cached word of the day for ${lang} (seed ${seed}): ${data.word}`);
  } catch (e) {
    console.error(`Failed to fetch word of the day for ${lang}:`, e.message);
  }
}

async function refreshAllLanguages() {
  for (const lang of Object.keys(LANG_NAMES)) {
    await refreshWord(lang);
  }
}

function scheduleMidnightRefresh() {
  const now = new Date();
  const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const delay = nextMidnight - now.getTime();

  setTimeout(() => {
    refreshAllLanguages();
    setInterval(refreshAllLanguages, 24 * 60 * 60 * 1000);
  }, delay);
}

async function fetchImage(word, definition) {
  const prompt = `A clean, minimal, modern editorial illustration representing the word "${word}" (${definition}). No text or letters in the image. Soft warm color palette, flat design, lots of negative space.`;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  const parts = json.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData);
  if (!imagePart) throw new Error('No image returned from Gemini');
  return { mimeType: imagePart.inlineData.mimeType, data: imagePart.inlineData.data };
}

app.get('/api/image', async (req, res) => {
  const lang = String(req.query.lang || 'en');
  const seed = todaySeed();
  const cacheKey = `${seed}:${lang}`;
  const imageCacheKey = `image:${seed}`;

  let image = cache.get(imageCacheKey);
  if (!image) {
    let wordData = cache.get(cacheKey);
    if (!wordData) {
      try {
        wordData = await fetchWord(lang);
        cache.set(cacheKey, wordData);
      } catch (e) {
        res.status(500).json({ error: e.message });
        return;
      }
    }
    try {
      image = await fetchImage(wordData.word, wordData.definition);
      cache.set(imageCacheKey, image);
    } catch (e) {
      res.status(500).json({ error: e.message });
      return;
    }
  }

  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(image);
});

app.get('/api/word', async (req, res) => {
  const lang = String(req.query.lang || 'en');
  const seed = todaySeed();
  const cacheKey = `${seed}:${lang}`;

  let data = cache.get(cacheKey);
  if (!data) {
    try {
      data = await fetchWord(lang);
      cache.set(cacheKey, data);
    } catch (e) {
      res.status(500).json({ error: e.message });
      return;
    }
  }

  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(data);
});

app.use(express.static(path.join(__dirname)));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
  refreshAllLanguages();
  scheduleMidnightRefresh();
});
