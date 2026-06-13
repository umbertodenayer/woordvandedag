const wordEl = document.getElementById('word');
const ipaEl = document.getElementById('ipa');
const posEl = document.getElementById('pos');
const definitionEl = document.getElementById('definition');
const etymologyEl = document.getElementById('etymology');
const exampleEl = document.getElementById('example');
const sourceEl = document.getElementById('source');
const dateEl = document.getElementById('date');
const imageEl = document.getElementById('word-image');

let currentWord = null;
let ygWidget = null;
let hearItTriggered = false;

function todaySeed() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
}

function cacheKey() {
  return `wordOfTheDay:${todaySeed()}`;
}

function render(data) {
  definitionEl.className = 'definition';
  currentWord = data.word;
  loadPronunciation();
  if (ygWidget && hearItTriggered) {
    ygWidget.fetch(currentWord, 'english');
  }
  wordEl.textContent = data.word;
  ipaEl.textContent = data.ipa;
  posEl.textContent = data.partOfSpeech;
  definitionEl.textContent = data.definition;
  etymologyEl.textContent = data.etymology;
  exampleEl.textContent = data.exampleSentence;
  sourceEl.textContent = `— ${data.exampleSource}`;
}

function showError(msg) {
  wordEl.textContent = '';
  ipaEl.textContent = '';
  posEl.textContent = '';
  etymologyEl.textContent = '';
  exampleEl.textContent = '';
  sourceEl.textContent = '';
  definitionEl.className = 'definition error';
  definitionEl.textContent = msg;
}

function showLoading() {
  wordEl.textContent = '…';
  ipaEl.textContent = '';
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

dateEl.textContent = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

load();
loadImage();

const hero = document.getElementById('hero');

function updateHeroOnScroll() {
  const heroHeight = hero.offsetHeight || window.innerHeight;
  const progress = Math.min(1, Math.max(0, window.scrollY / heroHeight));
  const scale = 1 - progress * 0.15;
  const opacity = 1 - progress;
  hero.style.transform = `scale(${scale})`;
  hero.style.opacity = opacity;
}

let heroTicking = false;
window.addEventListener('scroll', () => {
  if (!heroTicking) {
    requestAnimationFrame(() => {
      updateHeroOnScroll();
      heroTicking = false;
    });
    heroTicking = true;
  }
});
updateHeroOnScroll();

const wildCards = document.querySelectorAll('.wild-card');
const cardObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const index = Array.from(wildCards).indexOf(entry.target);
      entry.target.style.transitionDelay = `${index * 0.15}s`;
      entry.target.classList.add('visible');
      cardObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.2 });

wildCards.forEach((card) => cardObserver.observe(card));

const hearItSection = document.querySelector('.hear-it');
const youglishWidgetEl = document.getElementById('youglish-widget');
const hearItFallback = document.getElementById('hear-it-fallback');

function onYouglishAPIReady() {
  ygWidget = new YG.Widget('youglish-widget', {
    width: 800,
    components: 51,
    events: {
      onFetchDone: (e) => {
        if (e.totalResult === 0) {
          youglishWidgetEl.classList.add('hidden');
          hearItFallback.classList.add('visible');
        } else {
          youglishWidgetEl.classList.remove('hidden');
          hearItFallback.classList.remove('visible');
        }
      }
    }
  });

  if (currentWord && hearItTriggered) {
    ygWidget.fetch(currentWord, 'english');
  }
}

window.onYouglishAPIReady = onYouglishAPIReady;

const hearItObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting && !hearItTriggered) {
      hearItTriggered = true;
      if (ygWidget && currentWord) {
        ygWidget.fetch(currentWord, 'english');
      }
      hearItObserver.disconnect();
    }
  });
}, { threshold: 0.3 });

hearItObserver.observe(hearItSection);

const pronunciationSection = document.getElementById('pronunciation-section');
const pronunciationBtn = document.getElementById('pronunciation-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
let pronunciationAudio = null;

function audioCacheKey() {
  return `wordOfTheDay:audio:${todaySeed()}`;
}

async function loadPronunciation() {
  const key = audioCacheKey();
  const cached = localStorage.getItem(key);
  if (cached) {
    setupAudio(cached);
    return;
  }

  try {
    const response = await fetch('/api/pronunciation');
    if (!response.ok) {
      pronunciationSection.classList.add('hidden');
      return;
    }
    const data = await response.json();
    const src = `data:${data.mimeType};base64,${data.data}`;
    localStorage.setItem(key, src);
    setupAudio(src);
  } catch (e) {
    pronunciationSection.classList.add('hidden');
  }
}

function setupAudio(src) {
  pronunciationAudio = new Audio(src);
  pronunciationSection.classList.remove('hidden');

  pronunciationAudio.addEventListener('ended', () => {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  });
}

pronunciationBtn.addEventListener('click', () => {
  if (!pronunciationAudio) return;
  if (pronunciationAudio.paused) {
    pronunciationAudio.play();
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
  } else {
    pronunciationAudio.pause();
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  }
});
