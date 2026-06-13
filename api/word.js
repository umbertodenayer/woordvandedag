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

export default async function handler(req, res) {
  const lang = String(req.query.lang || 'en');
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

  try {
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
      res.status(502).json({ error: `Anthropic API error ${response.status}: ${errText}` });
      return;
    }

    const json = await response.json();
    const text = json.content[0].text.trim();
    const data = JSON.parse(text);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
