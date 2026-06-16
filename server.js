const express = require('express');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
const cache = new Map();

// Adam — ElevenLabs built-in premade voice, available on all plans including free
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
const CACHE_FILE = fs.existsSync('/data') ? path.join('/data', '.cache.json') : path.join(__dirname, '.cache.json');
const CACHE_VERSION = 'v7';

// ── CEFR levels config ─────────────────────────────────────────────────────────
const LEVELS = [
  { id: 'A1',     label: 'A1',
    instruction: 'a very high-frequency everyday word a beginner learns first — concrete nouns or basic verbs (e.g. fiets, eten, groot, gaan, hond, boek, spelen, huis, kind, mooi).' },
  { id: 'A2',     label: 'A2',
    instruction: 'a common everyday word just beyond survival level — still concrete but slightly less frequent (e.g. bezoeken, agenda, trein, winkel, koken, liefst, lopen, samen, vriend).' },
  { id: 'B1',     label: 'B1',
    instruction: 'standard vocabulary known from conversation and media, not known to beginners — moderately abstract (e.g. betrouwbaar, overtuigen, gevolg, beleven, gewoon, mening, afspraak, ondersteunen).' },
  { id: 'B2',     label: 'B2',
    instruction: 'a more nuanced or abstract word, lower frequency, commonly found in newspapers or professional contexts (e.g. uitdaging, beschikbaar, benadering, aanpassen, verband, consequentie, bewustzijn).' },
  { id: 'C1',     label: 'C1',
    instruction: 'a sophisticated, lower-frequency, often formal or literary Dutch word (e.g. ontluikend, verguizen, toewijding, welsprekend, bedachtzaam, onverbloemd, tegenstrijdig).' },
  { id: 'Native', label: 'Moedertaal',
    instruction: 'a rare, interesting or untranslatable word that native Dutch speakers find delightful — archaic, regionally flavoured, idiomatic, or impossible to translate neatly (e.g. gezelligheid, uitwaaien, treuzelen, betuttelen, kneuterig, doezelen, dagdromen).' },
];
const LEVEL_IDS = LEVELS.map(l => l.id);

// Supabase client for persistent cache (survives container restarts/redeploys)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lanmsexkozkrttiydtsm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } }) : null;
if (!sb) console.warn('SUPABASE_SERVICE_ROLE_KEY not set — cache will not persist across deploys.');

function todaySeed() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const p = {};
  parts.forEach(({ type, value }) => { p[type] = parseInt(value, 10); });
  return Date.UTC(p.year, p.month - 1, p.day) / 86400000;
}

function seedToDate(seed) { return new Date(seed * 86400000).toISOString().slice(0, 10); }
function todayDateStr()   { return seedToDate(todaySeed()); }

// Per-level cache keys (word, image, audio)
function wordCacheKey(level)  { return `${CACHE_VERSION}:${todaySeed()}:${level}`; }
function imageCacheKey(level) { return `${CACHE_VERSION}:image:${todaySeed()}:${level}`; }
function audioCacheKey(level) { return `${CACHE_VERSION}:audio:${todaySeed()}:${level}`; }

function allTodayKeys() {
  return LEVEL_IDS.flatMap(id => [wordCacheKey(id), imageCacheKey(id), audioCacheKey(id)]);
}

const ARCHIVE_BUCKET = 'word-images';

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
  const todayKeys = allTodayKeys();

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
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache)));
  } catch (e) {}

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

async function ensureBucket() {
  if (!sb) return;
  try {
    const { error } = await sb.storage.createBucket(ARCHIVE_BUCKET, { public: true });
    if (error && !/already exists/i.test(error.message)) {
      console.error('createBucket failed:', error.message);
    }
  } catch (e) {
    console.error('ensureBucket failed:', e.message);
  }
}

// Upload a base64 PNG to Storage and return its public URL (null on failure).
// level is included in the filename so each level's image has a unique path.
async function uploadImage(dateStr, imageObj, level) {
  if (!sb || !imageObj?.data) return null;
  try {
    const buffer = Buffer.from(imageObj.data, 'base64');
    const filePath = level ? `${dateStr}-${level}.png` : `${dateStr}.png`;
    const { error } = await sb.storage
      .from(ARCHIVE_BUCKET)
      .upload(filePath, buffer, { contentType: imageObj.mimeType || 'image/png', upsert: true });
    if (error) { console.error('image upload failed:', error.message); return null; }
    const { data } = sb.storage.from(ARCHIVE_BUCKET).getPublicUrl(filePath);
    return data?.publicUrl || null;
  } catch (e) {
    console.error('uploadImage failed:', e.message);
    return null;
  }
}

// Append a word to the permanent archive — deduplicated case-insensitively across
// ALL levels. Returns { added, reason, imageUrl }.
async function archiveWord(wordData, imageObj, dateStr, level) {
  if (!sb) return { added: false, reason: 'no-supabase' };
  const word = (wordData?.word || '').trim();
  if (!word) return { added: false, reason: 'no-word' };
  const target = word.toLowerCase();

  try {
    const { data: existing, error: selErr } = await sb
      .from('word_archive')
      .select('word');
    if (selErr) throw selErr;
    if ((existing || []).some(r => (r.word || '').trim().toLowerCase() === target)) {
      console.log(`Archive: "${word}" already exists — skipping.`);
      return { added: false, reason: 'duplicate' };
    }

    const imageUrl = await uploadImage(dateStr, imageObj, level);
    const row = {
      word,
      date: dateStr,
      level: level || null,
      pos: wordData.partOfSpeech || null,
      definition: wordData.definition || null,
      etymology: wordData.etymology || null,
      example: wordData.exampleSentence || null,
      source: wordData.exampleSource || null,
      in_de_praktijk: wordData.inDePraktijk || null,
      image_url: imageUrl,
    };
    const { error: insErr } = await sb.from('word_archive').insert(row);
    if (insErr) {
      if (insErr.code === '23505') {
        console.log(`Archive: "${word}" raced a duplicate — skipping.`);
        return { added: false, reason: 'duplicate' };
      }
      throw insErr;
    }
    console.log(`Archive: added "${word}" level=${level} (${dateStr})${imageUrl ? ' with image' : ''}.`);
    return { added: true, imageUrl };
  } catch (e) {
    console.error('archiveWord failed:', e.message);
    return { added: false, reason: e.message };
  }
}

// Get all words currently in the archive for dedup (case-insensitive).
async function getUsedWords() {
  if (!sb) return [];
  try {
    const { data } = await sb.from('word_archive').select('word');
    return (data || []).map(r => (r.word || '').trim().toLowerCase()).filter(Boolean);
  } catch (e) {
    console.error('getUsedWords failed:', e.message);
    return [];
  }
}

// Replay every word ever cached in daily_cache into the archive (idempotent).
async function backfillArchive() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('daily_cache').select('key, value');
    if (error) throw error;
    const rows = data || [];

    // v6 word keys: "v6:20250"  (version:seed — no level)
    // v7 word keys: "v7:20250:A1" (version:seed:level)
    const isWordKey = key => /^v\d+:\d+$/.test(key) || /^v\d+:\d+:[A-Za-z0-9]+$/.test(key);
    const wordRows = rows
      .filter(r => isWordKey(r.key))
      .sort((a, b) => {
        const sa = parseInt(a.key.split(':')[1], 10);
        const sb2 = parseInt(b.key.split(':')[1], 10);
        return sa - sb2;
      });

    let added = 0;
    for (const r of wordRows) {
      const parts = r.key.split(':');
      const seed  = parseInt(parts[1], 10);
      const level = parts[2] || null;
      const dateStr = seedToDate(seed);
      let wordData;
      try { wordData = JSON.parse(r.value); } catch { continue; }
      if (!wordData?.word) continue;

      // Find the matching image key
      const imgKey = level
        ? `${parts[0]}:image:${parts[1]}:${level}`
        : r.key.replace(/^(v\d+):(\d+)$/, '$1:image:$2');
      const imgRow = rows.find(x => x.key === imgKey);
      let imageObj = null;
      if (imgRow) { try { imageObj = JSON.parse(imgRow.value); } catch {} }

      const res = await archiveWord(wordData, imageObj, dateStr, level);
      if (res.added) added++;
    }
    console.log(`backfillArchive: scanned ${wordRows.length} cached words, added ${added} new.`);
  } catch (e) {
    console.error('backfillArchive failed:', e.message);
  }
}

async function fetchWord(level, instruction, usedWords = []) {
  const seed = todaySeed();
  const avoidClause = usedWords.length > 0
    ? `\n\nDo NOT pick any of these already-used words: ${usedWords.slice(-150).join(', ')}.`
    : '';
  const prompt = `Today's date seed is ${seed} (days since epoch, UTC). Using this seed for determinism, pick one Dutch word for CEFR level ${level}. Level requirement: ${instruction}${avoidClause}

Respond with ONLY a JSON object (no markdown, no code fences) with these exact keys:
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
      model: 'claude-sonnet-4-6',
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
  const prompt = `A clean, minimal, modern editorial illustration representing the Dutch word "${word}" (${definition}). No text or letters in the image. Soft warm color palette — creams, terracottas, muted greens. Flat design, generous negative space. Consistent illustration style throughout.`;

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

async function fetchAudio(word) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: word,
      model_id: 'eleven_turbo_v2_5',
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

// Generate all six levels' words (sequentially for dedup), then their images and
// audio. Only generates levels whose caches are missing.
async function refreshWord() {
  const missingLevels = LEVELS.filter(l => !cache.has(wordCacheKey(l.id)));
  if (missingLevels.length === 0) {
    console.log('All levels cached, skipping refresh.');
    return;
  }

  console.log(`Generating words for ${missingLevels.length} level(s)...`);

  // Build the used-words list for dedup across levels
  const usedWords = await getUsedWords();
  // Also add words from levels already cached today (don't duplicate within a day)
  for (const { id } of LEVELS) {
    const cached = cache.get(wordCacheKey(id));
    if (cached?.word) usedWords.push(cached.word.trim().toLowerCase());
  }

  for (const { id: levelId, instruction } of missingLevels) {
    console.log(`[${levelId}] Generating word...`);

    // ── Word ──────────────────────────────────────────────────
    let wordData;
    try {
      wordData = await fetchWord(levelId, instruction, usedWords);
    } catch (e) {
      console.error(`[${levelId}] fetchWord failed:`, e.message);
      continue;
    }
    cache.set(wordCacheKey(levelId), wordData);
    usedWords.push(wordData.word.trim().toLowerCase());
    console.log(`[${levelId}] Word: ${wordData.word}`);

    // ── Image + Audio in parallel ─────────────────────────────
    await Promise.all([
      cache.has(imageCacheKey(levelId)) ? null : fetchImage(wordData.word, wordData.definition)
        .then(img => { cache.set(imageCacheKey(levelId), img); console.log(`[${levelId}] Image cached.`); })
        .catch(e => console.error(`[${levelId}] fetchImage failed:`, e.message)),
      cache.has(audioCacheKey(levelId)) ? null : fetchAudio(wordData.word)
        .then(aud => { cache.set(audioCacheKey(levelId), aud); console.log(`[${levelId}] Audio cached.`); })
        .catch(e => console.error(`[${levelId}] fetchAudio failed:`, e.message)),
    ]);

    await saveCache();

    // ── Archive ───────────────────────────────────────────────
    await archiveWord(wordData, cache.get(imageCacheKey(levelId)), todayDateStr(), levelId);
  }
}

function scheduleMidnightRefresh() {
  const delay = msUntilAmsterdamMidnight();
  console.log(`Next word refresh in ${Math.round(delay / 60000)} min (Amsterdam midnight)`);
  setTimeout(async () => {
    await refreshWord();
    scheduleMidnightRefresh();
  }, delay);
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

// Resolve and validate a ?level= query param; fall back to B1
function resolveLevel(req) {
  const id = req.query.level;
  return LEVEL_IDS.includes(id) ? id : 'B1';
}

app.get('/api/word', (req, res) => {
  const levelId = resolveLevel(req);
  const data = cache.get(wordCacheKey(levelId));
  if (!data) { res.status(503).json({ error: 'Woord nog niet beschikbaar. Kom later terug.' }); return; }
  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json({ ...data, level: levelId, date: todayDateStr() });
});

app.get('/api/image', (req, res) => {
  const levelId = resolveLevel(req);
  const image = cache.get(imageCacheKey(levelId));
  if (!image) { res.status(503).json({ error: 'Afbeelding nog niet beschikbaar.' }); return; }
  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(image);
});

app.get('/api/pronunciation', (req, res) => {
  const levelId = resolveLevel(req);
  const audio = cache.get(audioCacheKey(levelId));
  if (!audio) { res.status(503).json({ error: 'Audio nog niet beschikbaar.' }); return; }
  res.set('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(audio);
});

// Image manifest — every archived word that has an image, newest first.
// Includes the level tag so clients can filter if needed.
app.get('/api/manifest', async (req, res) => {
  if (!sb) { res.json({ images: [] }); return; }
  try {
    const { data, error } = await sb
      .from('word_archive')
      .select('word, date, image_url, level')
      .not('image_url', 'is', null)
      .order('date', { ascending: false });
    if (error) throw error;
    res.set('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.json({ images: data || [] });
  } catch (e) {
    console.error('manifest failed:', e.message);
    res.json({ images: [] });
  }
});

// Manual trigger — clears all level caches and regenerates
app.post('/api/refresh', async (req, res) => {
  if (!process.env.REFRESH_SECRET || req.headers['x-refresh-secret'] !== process.env.REFRESH_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }
  for (const id of LEVEL_IDS) {
    cache.delete(wordCacheKey(id));
    cache.delete(imageCacheKey(id));
    cache.delete(audioCacheKey(id));
  }
  res.json({ ok: true });
  refreshWord();
});

app.post('/api/check-email', async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Missing email' });
  }
  if (!sb) {
    return res.status(503).json({ error: 'Auth check unavailable' });
  }
  const target = email.trim().toLowerCase();
  try {
    const perPage = 1000;
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
      if (error) return res.status(500).json({ error: error.message });
      const users = data?.users || [];
      if (users.some(u => (u.email || '').toLowerCase() === target)) {
        return res.json({ exists: true });
      }
      if (users.length < perPage) break;
    }
    return res.json({ exists: false });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/save-profile', async (req, res) => {
  if (!sb) return res.status(503).json({ error: 'Auth unavailable' });

  const auth  = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let userId;
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });
    userId = data.user.id;
  } catch (e) {
    return res.status(401).json({ error: 'Token verification failed' });
  }

  const { niveau, leerdoelen } = req.body || {};
  const profileData = { niveau: niveau || null, leerdoelen: leerdoelen || [] };

  try {
    const { error } = await sb
      .from('user_profiles')
      .upsert({ user_id: userId, ...profileData }, { onConflict: 'user_id' });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error('[save-profile]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Community sentences ──────────────────────────────────────────────────────
const COMMUNITY_MAX_LEN = 200;
const COMMUNITY_CHECK_MODEL = 'claude-sonnet-4-6';

// Single place to extend the profanity filter (Dutch + English, lowercase).
// Whole-token matching, so innocent words that merely contain these are safe.
const PROFANITY = [
  // Dutch
  'kut', 'kutwijf', 'klootzak', 'klootzakken', 'lul', 'lullen', 'hoer', 'hoeren',
  'kanker', 'kankerlijer', 'tering', 'tyfus', 'godverdomme', 'godver', 'verdomme',
  'neuk', 'neuken', 'slet', 'sletten', 'teef', 'flikker', 'mongool', 'debiel',
  'kech', 'klote', 'rotzak',
  // English
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bitch', 'bastard', 'asshole',
  'dick', 'cunt', 'whore', 'slut', 'retard', 'nigger', 'nigga', 'faggot', 'fag',
  'cock', 'pussy', 'wanker', 'twat', 'bollocks',
];

function hasProfanity(text) {
  const tokens = text.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  return tokens.some(tok => PROFANITY.includes(tok));
}

// Cheap, instant, free: whole-word case-insensitive match on letter boundaries.
function usesWordExact(sentence, word) {
  const esc = (word || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!esc) return false;
  return new RegExp(`(?:^|[^\\p{L}])${esc}(?:[^\\p{L}]|$)`, 'iu').test(sentence);
}

// Fallback only when the exact check fails: ask Claude for a strict ja/nee on
// whether the sentence uses the word or an inflected form of it.
async function usesWordInflected(sentence, word) {
  const prompt = `Je bent een strikte Nederlandse taalcontroleur.
Doelwoord: "${word}"
Zin: "${sentence}"

Gebruikt de zin het doelwoord, OF een correcte verbogen of vervoegde vorm ervan (meervoud, verkleinwoord, vervoegd werkwoord, of verbogen bijvoeglijk naamwoord)? Antwoord met EXACT één woord: ja of nee.`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: COMMUNITY_CHECK_MODEL,
      max_tokens: 5,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}`);
  const j = await r.json();
  const ans = (j.content?.[0]?.text || '').trim().toLowerCase();
  return ans.startsWith('ja');
}

// Real, server-controlled display name (never trust a client-supplied name).
function deriveDisplayName(user) {
  const m = user.user_metadata || {};
  const explicit = m.display_name || m.full_name || m.name || m.user_name;
  if (explicit && String(explicit).trim()) return String(explicit).trim().slice(0, 40);
  const local = (user.email || '').split('@')[0] || 'Anoniem';
  const pretty = local.replace(/[._-]+/g, ' ').replace(/\b\p{L}/gu, c => c.toUpperCase());
  return (pretty.trim() || 'Anoniem').slice(0, 40);
}

app.post('/api/community/submit', async (req, res) => {
  if (!sb) return res.status(503).json({ error: 'server', message: 'Server niet beschikbaar.' });

  // Verify the user's JWT
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'auth', message: 'Log in om een zin te plaatsen.' });

  let user;
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'auth', message: 'Log in om een zin te plaatsen.' });
    user = data.user;
  } catch (e) {
    return res.status(401).json({ error: 'auth', message: 'Log in om een zin te plaatsen.' });
  }

  // Server is authoritative on which word/level/date the sentence belongs to.
  const levelId  = resolveLevel(req);
  const wordData = cache.get(wordCacheKey(levelId));
  if (!wordData?.word) return res.status(503).json({ error: 'server', message: 'Het woord is nog niet beschikbaar.' });
  const word     = wordData.word;
  const wordDate = todayDateStr();

  const sentence = String((req.body && req.body.sentence) || '').replace(/\s+/g, ' ').trim();

  // ── Validation (don't save unless every check passes) ──
  if (!sentence) {
    return res.status(400).json({ error: 'empty', message: 'Schrijf eerst een zin.' });
  }
  if (sentence.length > COMMUNITY_MAX_LEN) {
    return res.status(400).json({ error: 'length', message: 'Je zin is te lang — houd het kort.' });
  }
  if (hasProfanity(sentence)) {
    return res.status(400).json({ error: 'profanity', message: 'Houd het netjes, alsjeblieft.' });
  }
  if (!usesWordExact(sentence, word)) {
    let ok = false;
    try {
      ok = await usesWordInflected(sentence, word);   // only hits the API when the cheap check failed
    } catch (e) {
      console.error('[community] inflection check failed:', e.message);
      return res.status(503).json({ error: 'server', message: 'Kon je zin niet controleren. Probeer het zo opnieuw.' });
    }
    if (!ok) {
      return res.status(400).json({ error: 'word', message: 'Gebruik het woord van vandaag (of een vorm ervan) in je zin.' });
    }
  }

  // ── Insert via service role; display name comes from the verified profile ──
  const displayName = deriveDisplayName(user);
  try {
    const { data, error } = await sb
      .from('sentences')
      .insert({
        word,
        word_date: wordDate,
        level: levelId,
        user_id: user.id,
        display_name: displayName,
        text: sentence,
      })
      .select('id, word, word_date, level, display_name, text, created_at')
      .single();
    if (error) throw error;
    return res.json({ ok: true, sentence: data });
  } catch (e) {
    console.error('[community] insert failed:', e.message);
    return res.status(500).json({ error: 'server', message: 'Opslaan mislukt. Probeer het opnieuw.' });
  }
});

app.use(express.static(path.join(__dirname), {
  setHeaders: (res) => res.set('Cache-Control', 'no-cache')
}));

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  console.log(`Listening on port ${port}`);
  await ensureBucket();
  await loadCache();
  const missingAny = LEVEL_IDS.some(id =>
    !cache.has(wordCacheKey(id)) ||
    !cache.has(imageCacheKey(id)) ||
    !cache.has(audioCacheKey(id))
  );
  if (missingAny) {
    await refreshWord();
  }
  scheduleMidnightRefresh();
  backfillArchive();
});
