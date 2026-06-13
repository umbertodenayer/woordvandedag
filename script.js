const wordEl = document.getElementById('word');
const posEl = document.getElementById('pos');
const definitionEl = document.getElementById('definition');
const etymologyEl = document.getElementById('etymology');
const exampleEl = document.getElementById('example');
const sourceEl = document.getElementById('source');
const dateEl = document.getElementById('date');
const imageEl = document.getElementById('word-image');

function todaySeed() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
}

function cacheKey() {
  return `wordOfTheDay:${todaySeed()}`;
}

function render(data) {
  definitionEl.className = 'definition';
  wordEl.textContent = data.word;
  posEl.textContent = data.partOfSpeech;
  definitionEl.textContent = data.definition;
  etymologyEl.textContent = data.etymology;
  exampleEl.textContent = data.exampleSentence;
  sourceEl.textContent = `— ${data.exampleSource}`;
}

function showError(msg) {
  wordEl.textContent = '';
  posEl.textContent = '';
  etymologyEl.textContent = '';
  exampleEl.textContent = '';
  sourceEl.textContent = '';
  definitionEl.className = 'definition error';
  definitionEl.textContent = msg;
}

function showLoading() {
  wordEl.textContent = '…';
  posEl.textContent = '';
  definitionEl.className = 'definition';
  definitionEl.textContent = 'Loading...';
  etymologyEl.textContent = '';
  exampleEl.textContent = '';
  sourceEl.textContent = '';
}

async function fetchWordOfTheDay() {
  const response = await fetch('/api/word');
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `API error ${response.status}`);
  }
  return response.json();
}

async function load(force = false) {
  const key = cacheKey();

  if (!force) {
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        render(JSON.parse(cached));
        return;
      } catch (e) {
        // fall through to refetch
      }
    }
  }

  showLoading();
  try {
    const data = await fetchWordOfTheDay();
    localStorage.setItem(key, JSON.stringify(data));
    render(data);
  } catch (e) {
    showError(`Failed to load word of the day: ${e.message}`);
  }
}

function imageCacheKey() {
  return `wordOfTheDay:image:${todaySeed()}`;
}

async function loadImage() {
  imageEl.classList.remove('loaded');
  const key = imageCacheKey();
  const cached = localStorage.getItem(key);
  if (cached) {
    imageEl.src = cached;
    imageEl.classList.add('loaded');
    return;
  }
  try {
    const response = await fetch('/api/image');
    if (!response.ok) return;
    const data = await response.json();
    const src = `data:${data.mimeType};base64,${data.data}`;
    localStorage.setItem(key, src);
    imageEl.src = src;
    imageEl.classList.add('loaded');
  } catch (e) {
    // image is optional, fail silently
  }
}

dateEl.textContent = new Date().toLocaleDateString(undefined, {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

load();
loadImage();
