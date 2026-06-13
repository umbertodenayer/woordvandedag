const express = require('express');
const path = require('path');
const fs = require('fs');

function todaySeed() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
}

const app = express();
const cache = new Map();

const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'AyQGttFzg1EY7EIKkpHs';

const CACHE_FILE = fs.existsSync('/data') ? path.join('/data', '.cache.json') : path.join(__dirname, '.cache.json');

function loadCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const seed = todaySeed();
    for (const [key, value] of Object.entries(raw)) {
      if (key === `v3:${seed}` || key === `v3:image:${seed}` || key === `v3:audio:${seed}`) {
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
      max_tokens: 2048,
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

// Called once at midnight UTC. Never called on startup or by user requests.
async function refreshWord() {
  const seed = todaySeed();
  const cacheKey = `v3:${seed}`;
  const imageCacheKey = `v3:image:${seed}`;
  const audioCacheKey = `v3:audio:${seed}`;

  if (cache.has(cacheKey) && cache.has(imageCacheKey) && cache.has(audioCacheKey)) {
    console.log(`Already cached for seed ${seed}, skipping`);
    return;
  }

  console.log(`Midnight refresh: generating word for seed ${seed}`);

  let data = cache.get(cacheKey);
  if (!data) {
    try {
      data = await fetchWord();
      cache.set(cacheKey, data);
      saveCache();
      console.log(`Word cached: ${data.word}`);
    } catch (e) {
      console.error('fetchWord failed:', e.message);
      return;
    }
  }

  if (!cache.has(imageCacheKey)) {
    try {
      const image = await fetchImage(data.word, data.definition);
      cache.set(imageCacheKey, image);
      saveCache();
      console.log(`Image cached: ${data.word}`);
    } catch (e) {
      console.error('fetchImage failed:', e.message);
    }
  }

  if (!cache.has(audioCacheKey)) {
    try {
      const audio = await fetchAudio(data.word);
      cache.set(audioCacheKey, audio);
      saveCache();
      console.log(`Audio cached: ${data.word}`);
    } catch (e) {
      console.error('fetchAudio failed:', e.message);
    }
  }
}

function msUntilAmsterdamMidnight() {
  const now = new Date();
  // Get current date parts in Amsterdam time
  const fmt = new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, parseInt(p.value)]));
  // Next midnight Amsterdam = today+1 at 00:00:00 Amsterdam
  const nextMidnightAmsterdam = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  // Adjust: the date string gives us the Amsterdam calendar date, but we need to
  // find the UTC instant that corresponds to 00:00:00 Amsterdam on that date
  const nextMidnightStr = `${parts.year}-${String(parts.month).padStart(2,'0')}-${String(parts.day + 1).padStart(2,'0')}T00:00:00`;
  const nextMidnight = new Date(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(now.getTime() + 24 * 60 * 60 * 1000)).replace(/\//g, '-') + 'T00:00:00+00:00');
  // Simpler: use the offset trick
  const tzOffset = (new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })) - new Date(new Date().toLocaleString('en-US', { timeZone: 'UTC' })));
  const nowAmsterdam = new Date(now.getTime() + tzOffset);
  const tomorrowAmsterdam = new Date(Date.UTC(nowAmsterdam.getUTCFullYear(), nowAmsterdam.getUTCMonth(), nowAmsterdam.getUTCDate() + 1));
  return tomorrowAmsterdam.getTime() - tzOffset - now.getTime();
}

function scheduleMidnightRefresh() {
  const delay = msUntilAmsterdamMidnight();
  console.log(`Next refresh in ${Math.round(delay / 60000)} minutes (Amsterdam midnight)`);

  setTimeout(() => {
    refreshWord();
    // Re-schedule each day using Amsterdam midnight (handles DST shifts)
    function scheduleNext() {
      const nextDelay = msUntilAmsterdamMidnight();
      console.log(`Next refresh in ${Math.round(nextDelay / 60000)} minutes (Amsterdam midnight)`);
      setTimeout(() => { refreshWord(); scheduleNext(); }, nextDelay);
    }
    scheduleNext();
  }, delay);
}

// Endpoints serve from cache only — never call APIs
app.get('/api/word', (req, res) => {
  const data = cache.get(`v2:${todaySeed()}`);
  if (!data) {
    res.status(503).json({ error: 'Woord nog niet beschikbaar. Kom later terug.' });
    return;
  }
  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(data);
});

app.get('/api/image', (req, res) => {
  const image = cache.get(`v2:image:${todaySeed()}`);
  if (!image) {
    res.status(503).json({ error: 'Afbeelding nog niet beschikbaar.' });
    return;
  }
  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(image);
});

app.get('/api/pronunciation', (req, res) => {
  const audio = cache.get(`v2:audio:${todaySeed()}`);
  if (!audio) {
    res.status(503).json({ error: 'Audio nog niet beschikbaar.' });
    return;
  }
  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(audio);
});

// Manual trigger for artificial refreshes (e.g. forced by the owner)
app.post('/api/refresh', async (req, res) => {
  const secret = req.headers['x-refresh-secret'];
  if (!secret || secret !== process.env.REFRESH_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  // Clear today's cache so refreshWord() regenerates everything
  const seed = todaySeed();
  cache.delete(`v3:${seed}`);
  cache.delete(`v3:image:${seed}`);
  cache.delete(`v3:audio:${seed}`);
  res.json({ ok: true, message: 'Cache cleared, regenerating...' });
  refreshWord();
});

app.use(express.static(path.join(__dirname), {
  setHeaders: (res) => res.set('Cache-Control', 'no-cache')
}));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
  loadCache();
  // Generate today's word if not already cached (cold start / first deploy of the day)
  const seed = todaySeed();
  if (!cache.has(`v3:${seed}`) || !cache.has(`v3:image:${seed}`) || !cache.has(`v3:audio:${seed}`)) {
    console.log('Cold start: no cached data for today, generating now...');
    refreshWord();
  }
  scheduleMidnightRefresh();
});
