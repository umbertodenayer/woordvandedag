const express = require('express');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const cache = new Map();

let elevenlabsVoiceId = null;
const CACHE_FILE = fs.existsSync('/data') ? path.join('/data', '.cache.json') : path.join(__dirname, '.cache.json');
const CACHE_VERSION = 'v4';

// Supabase client for persistent cache (survives container restarts/redeploys)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lanmsexkozkrttiydtsm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } }) : null;
if (!sb) console.warn('SUPABASE_SERVICE_ROLE_KEY not set — cache will not persist across deploys.');

function todaySeed() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
}

function cacheKey()      { return `${CACHE_VERSION}:${todaySeed()}`; }
function imageCacheKey() { return `${CACHE_VERSION}:image:${todaySeed()}`; }
function audioCacheKey() { return `${CACHE_VERSION}:audio:${todaySeed()}`; }

// Milliseconds until 00:00:00 Amsterdam time
function msUntilAmsterdamMidnight() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  }).formatToParts(now);
  const p = {};
  parts.forEach(({ type, value }) => { p[type] = parseInt(value, 10); });
  const secondsElapsed = (p.hour % 24) * 3600 + p.minute * 60 + p.second;
  return (86400 - secondsElapsed) * 1000;
}

async function loadCache() {
  const todayKeys = [cacheKey(), imageCacheKey(), audioCacheKey()];

  // 1. Try local file first (fast, works in dev)
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    for (const [key, value] of Object.entries(raw)) {
      if (todayKeys.includes(key)) cache.set(key, value);
    }
    if (cache.size > 0) {
      console.log(`Loaded ${cache.size} cached entries from file`);
      return;
    }
  } catch (e) {}

  // 2. Fall back to Supabase (persists across deploys)
  if (sb) {
    try {
      const { data, error } = await sb
        .from('daily_cache')
        .select('key, value')
        .in('key', todayKeys);

      if (error) throw error;

      for (const row of (data || [])) {
        try { cache.set(row.key, JSON.parse(row.value)); } catch {}
      }

      if (cache.size > 0) {
        console.log(`Loaded ${cache.size} cached entries from Supabase`);
        return;
      }
    } catch (e) {
      console.error('Supabase cache load failed:', e.message);
    }
  }

  console.log('No usable cache found, starting fresh.');
}

async function saveCache() {
  // Write to local file (best-effort)
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache)));
  } catch (e) {}

  // Persist to Supabase so the next deploy doesn't re-fetch
  if (sb) {
    const rows = Array.from(cache.entries()).map(([key, value]) => ({
      key,
      value: JSON.stringify(value)
    }));
    if (rows.length === 0) return;
    try {
      const { error } = await sb
        .from('daily_cache')
        .upsert(rows, { onConflict: 'key' });
      if (error) throw error;
    } catch (e) {
      console.error('Supabase cache save failed:', e.message);
    }
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
  const prompt = `A clean, minimal, modern editorial illustration representing the Dutch word "${word}" (${definition}). No text or letters in the image. Soft warm color palette, flat design, lots of negative space.`;

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024' })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data returned');
  return { mimeType: 'image/png', data: b64 };
}

async function getElevenlabsVoiceId() {
  if (elevenlabsVoiceId) return elevenlabsVoiceId;
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
  });
  if (!response.ok) throw new Error(`Could not fetch voices: ${response.status}`);
  const { voices } = await response.json();
  if (!voices || voices.length === 0) throw new Error('No voices available');
  elevenlabsVoiceId = voices[0].voice_id;
  console.log(`Using ElevenLabs voice: ${voices[0].name} (${elevenlabsVoiceId})`);
  return elevenlabsVoiceId;
}

async function fetchAudio(word) {
  const voiceId = await getElevenlabsVoiceId();
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: word,
      model_id: 'eleven_monolingual_v1'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${errText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return { mimeType: 'audio/mpeg', data: buffer.toString('base64') };
}

// The ONLY function that calls external APIs.
// Triggered once at Amsterdam midnight, and on cold start if cache is empty.
async function refreshWord() {
  if (cache.has(cacheKey()) && cache.has(imageCacheKey()) && cache.has(audioCacheKey())) {
    console.log('Already fully cached, skipping refresh.');
    return;
  }

  console.log('Generating word of the day...');

  if (!cache.has(cacheKey())) {
    try {
      const data = await fetchWord();
      cache.set(cacheKey(), data);
      await saveCache();
      console.log(`Word cached: ${data.word}`);
    } catch (e) {
      console.error('fetchWord failed:', e.message);
      return;
    }
  }

  const wordData = cache.get(cacheKey());

  if (!cache.has(imageCacheKey())) {
    try {
      const image = await fetchImage(wordData.word, wordData.definition);
      cache.set(imageCacheKey(), image);
      await saveCache();
      console.log('Image cached.');
    } catch (e) {
      console.error('fetchImage failed:', e.message);
    }
  }

  if (!cache.has(audioCacheKey())) {
    try {
      const audio = await fetchAudio(wordData.word);
      cache.set(audioCacheKey(), audio);
      await saveCache();
      console.log('Audio cached.');
    } catch (e) {
      console.error('fetchAudio failed:', e.message);
    }
  }
}

function scheduleMidnightRefresh() {
  const delay = msUntilAmsterdamMidnight();
  console.log(`Next word refresh in ${Math.round(delay / 60000)} min (Amsterdam midnight)`);
  setTimeout(async () => {
    await refreshWord();
    scheduleMidnightRefresh(); // re-schedule for next day (handles DST correctly)
  }, delay);
}

// Endpoints — serve from cache only, never call APIs
app.get('/api/word', (req, res) => {
  const data = cache.get(cacheKey());
  if (!data) { res.status(503).json({ error: 'Woord nog niet beschikbaar. Kom later terug.' }); return; }
  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(data);
});

app.get('/api/image', (req, res) => {
  const image = cache.get(imageCacheKey());
  if (!image) { res.status(503).json({ error: 'Afbeelding nog niet beschikbaar.' }); return; }
  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(image);
});

app.get('/api/pronunciation', (req, res) => {
  const audio = cache.get(audioCacheKey());
  if (!audio) { res.status(503).json({ error: 'Audio nog niet beschikbaar.' }); return; }
  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(audio);
});

// Manual trigger — requires REFRESH_SECRET header
app.post('/api/refresh', async (req, res) => {
  if (!process.env.REFRESH_SECRET || req.headers['x-refresh-secret'] !== process.env.REFRESH_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }
  cache.delete(cacheKey());
  cache.delete(imageCacheKey());
  cache.delete(audioCacheKey());
  res.json({ ok: true });
  refreshWord();
});

app.use(express.static(path.join(__dirname), {
  setHeaders: (res) => res.set('Cache-Control', 'no-cache')
}));

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  console.log(`Listening on port ${port}`);
  await loadCache();
  // Cold start: generate now if today's content isn't cached yet
  if (!cache.has(cacheKey()) || !cache.has(imageCacheKey()) || !cache.has(audioCacheKey())) {
    await refreshWord();
  }
  scheduleMidnightRefresh();
});
