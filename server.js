const express = require('express');
const path = require('path');
const fs = require('fs');

function todaySeed() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
}

const app = express();
const cache = new Map(); // key: `${seed}` or `image:${seed}` -> data

// Native Dutch ElevenLabs voice so Dutch words are pronounced with a Dutch
// accent. The multilingual model applies the *voice's* native accent, so an
// English voice (e.g. "George") reads Dutch words with an English accent.
// Default: "Rick" (native Dutch). Override with ELEVENLABS_VOICE_ID.
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'AyQGttFzg1EY7EIKkpHs';

const CACHE_FILE = fs.existsSync('/data') ? path.join('/data', '.cache.json') : path.join(__dirname, '.cache.json');

function loadCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const seed = todaySeed();
    for (const [key, value] of Object.entries(raw)) {
      if (key === `v2:${seed}` || key === `v2:image:${seed}` || key === `v2:audio:${seed}`) {
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

  const prompt = `Today's date seed is ${seed} (days since epoch, UTC). Using this seed so the result is deterministic and identical for everyone asking on this date, pick one Dutch word suitable for A0–B2 learners — everyday, concrete words like common nouns, verbs, or adjectives (for example: bezem, sprinten, prinses, woordenboek, fiets, koken, vrolijk). Respond with ONLY a JSON object (no markdown, no code fences) with these exact keys:
{
  "word": "het Nederlandse woord",
  "ipa": "the IPA phonetic transcription of the Dutch word, e.g. /ˈbeː.zəm/",
  "partOfSpeech": "het woordsoort in het Nederlands (bijv. zelfstandig naamwoord, werkwoord, bijvoeglijk naamwoord)",
  "definition": "een duidelijke definitie in het Nederlands",
  "etymology": "de etymologie van het woord in het Nederlands",
  "exampleSentence": "een natuurlijke voorbeeldzin in het Nederlands met het woord",
  "exampleSource": "de bron of auteur van de voorbeeldzin, of 'Eigen voorbeeld' als zelfgemaakt",
  "inDePraktijk": [
    {
      "pub": "naam van een echte Nederlandse publicatie (bijv. de Volkskrant, NRC Handelsblad, Trouw, Het Parool, De Groene Amsterdammer, Vrij Nederland, VPRO Gids)",
      "excerpt": "een natuurlijke, overtuigende zin uit die publicatie met het woord cursief gemarkeerd als <em>woord</em>, passend bij de toon en stijl van die publicatie",
      "source": "de rubriek of editie (bijv. '— Weekendbijlage', '— Opinie, donderdag', '— Cultuur')"
    },
    {
      "pub": "een andere echte Nederlandse publicatie",
      "excerpt": "een andere overtuigende zin met het woord als <em>woord</em>, ander register (bijv. journalistiek, literair, of informatief)",
      "source": "de rubriek of editie"
    },
    {
      "pub": "een derde echte Nederlandse publicatie",
      "excerpt": "nog een overtuigende zin met het woord als <em>woord</em>, weer een andere context of toon",
      "source": "de rubriek of editie"
    }
  ]
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

async function fetchAudio(word) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: word,
      model_id: 'eleven_multilingual_v2',
      language_code: 'nl'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${errText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return { mimeType: 'audio/mpeg', data: buffer.toString('base64') };
}

async function refreshWord() {
  const seed = todaySeed();
  const cacheKey = `v2:${seed}`;
  const imageCacheKey = `v2:image:${seed}`;
  const audioCacheKey = `v2:audio:${seed}`;

  if (cache.has(cacheKey) && cache.has(imageCacheKey) && cache.has(audioCacheKey) && cache.get(cacheKey).ipa) {
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

  if (!cache.has(imageCacheKey)) {
    try {
      const image = await fetchImage(data.word, data.definition);
      cache.set(imageCacheKey, image);
      saveCache();
      console.log(`Cached image (seed ${seed}): ${data.word}`);
    } catch (e) {
      console.error('Failed to fetch image:', e.message);
    }
  }

  if (!cache.has(audioCacheKey)) {
    try {
      const audio = await fetchAudio(data.word);
      cache.set(audioCacheKey, audio);
      saveCache();
      console.log(`Cached audio (seed ${seed}): ${data.word}`);
    } catch (e) {
      console.error('Failed to fetch audio:', e.message);
    }
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
  const cacheKey = `v2:${seed}`;
  const imageCacheKey = `v2:image:${seed}`;

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

app.get('/api/pronunciation', async (req, res) => {
  const seed = todaySeed();
  const cacheKey = `v2:${seed}`;
  const audioCacheKey = `v2:audio:${seed}`;

  let audio = cache.get(audioCacheKey);
  if (!audio) {
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
      audio = await fetchAudio(wordData.word);
      cache.set(audioCacheKey, audio);
      saveCache();
    } catch (e) {
      res.status(500).json({ error: e.message });
      return;
    }
  }

  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(audio);
});

app.get('/api/word', async (req, res) => {
  const seed = todaySeed();
  const cacheKey = `v2:${seed}`;

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
  scheduleMidnightRefresh();
});
