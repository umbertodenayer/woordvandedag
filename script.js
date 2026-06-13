const wordEl = document.getElementById('word');
const ipaEl = document.getElementById('ipa');
const posEl = document.getElementById('pos');
const definitionEl = document.getElementById('definition');
const etymologyEl = document.getElementById('etymology');
const exampleEl = document.getElementById('example');
const sourceEl = document.getElementById('source');
const dateEl = document.getElementById('date');
const imageEl = document.getElementById('word-image');

const themeToggle = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');

function applyTheme(theme, animate) {
  document.documentElement.setAttribute('data-theme', theme);
  const showIcon = theme === 'dark' ? moonIcon : sunIcon;
  const hideIcon = theme === 'dark' ? sunIcon : moonIcon;

  if (animate) {
    hideIcon.classList.add('spin-out');
    setTimeout(() => {
      hideIcon.classList.add('hidden');
      hideIcon.classList.remove('spin-out');
      showIcon.classList.remove('hidden');
      showIcon.classList.add('spin-out');
      requestAnimationFrame(() => {
        showIcon.classList.remove('spin-out');
      });
    }, 300);
  } else {
    hideIcon.classList.add('hidden');
    showIcon.classList.remove('hidden');
  }
}

const savedTheme = localStorage.getItem('wordOfTheDay:theme') || 'light';
applyTheme(savedTheme, false);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('wordOfTheDay:theme', next);
  applyTheme(next, true);
});

let currentWord = null;
let ygWidget = null;
let hearItTriggered = false;

if (window.supabase) {
  const SUPABASE_URL = 'https://lanmsexkozkrttiydsm.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_c8SjUvXE8zTZIEgB6i9hYw_uJR_4i37';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const userIconBtn = document.getElementById('user-icon-btn');
  const userDot = document.getElementById('user-dot');
  const userDropdown = document.getElementById('user-dropdown');
  const signOutBtn = document.getElementById('sign-out-btn');
  const authModal = document.getElementById('auth-modal');
  const authModalBackdrop = authModal.querySelector('.auth-modal-backdrop');
  const authModalClose = document.getElementById('auth-modal-close');
  const authTabs = document.querySelectorAll('.auth-tab');
  const authForm = document.getElementById('auth-form');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authError = document.getElementById('auth-error');
  const authSubmit = document.getElementById('auth-submit');

  let authMode = 'sign-in';

  const setAuthMode = (mode) => {
    authMode = mode;
    authTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === mode));
    authSubmit.textContent = mode === 'sign-in' ? 'Sign In' : 'Sign Up';
    authError.classList.add('hidden');
    authError.textContent = '';
  };

  const openAuthModal = () => {
    setAuthMode('sign-in');
    authForm.reset();
    authModal.classList.remove('hidden');
  };

  const closeAuthModal = () => {
    authModal.classList.add('hidden');
  };

  authTabs.forEach((tab) => {
    tab.addEventListener('click', () => setAuthMode(tab.dataset.tab));
  });

  authModalBackdrop.addEventListener('click', closeAuthModal);
  authModalClose.addEventListener('click', closeAuthModal);

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    const email = authEmail.value;
    const password = authPassword.value;

    const { error } = authMode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      authError.textContent = error.message;
      authError.classList.remove('hidden');
      return;
    }

    closeAuthModal();
  });

  const updateUserUI = (session) => {
    userDot.classList.toggle('hidden', !session);
  };

  userIconBtn.addEventListener('click', async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      userDropdown.classList.toggle('hidden');
    } else {
      userDropdown.classList.add('hidden');
      openAuthModal();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
      userDropdown.classList.add('hidden');
    }
  });

  signOutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    userDropdown.classList.add('hidden');
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    updateUserUI(session);
  });

  supabase.auth.getSession().then(({ data }) => updateUserUI(data.session));
} else {
  console.warn('Supabase failed to load; auth disabled.');
}

const CACHE_VERSION = 'v2';

function todaySeed() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
}

function cacheKey() {
  return `wordOfTheDay:${CACHE_VERSION}:${todaySeed()}`;
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
  return `wordOfTheDay:${CACHE_VERSION}:image:${todaySeed()}`;
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

const hearItSection = document.getElementById('hear-it-section');
const youglishWidgetEl = document.getElementById('youglish-widget');

function onYouglishAPIReady() {
  ygWidget = new YG.Widget('youglish-widget', {
    width: 800,
    components: 51,
    events: {
      onFetchDone: (e) => {
        if (e.totalResult === 0) {
          hearItSection.classList.add('hidden');
        } else {
          hearItSection.classList.remove('hidden');
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

const pronunciationSectionEl = document.getElementById('pronunciation-section');
hearItObserver.observe(pronunciationSectionEl);

const pronunciationSection = document.getElementById('pronunciation-section');
const pronunciationBtn = document.getElementById('pronunciation-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const waveformEl = document.getElementById('waveform');
let pronunciationAudio = null;
let waveformBars = [];

const WAVEFORM_BAR_COUNT = 40;

function buildWaveform() {
  waveformEl.innerHTML = '';
  waveformBars = [];
  for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    const height = 8 + Math.random() * 24;
    bar.style.height = `${height}px`;
    waveformEl.appendChild(bar);
    waveformBars.push(bar);
  }
}

let waveformRAF = null;

function updateWaveformProgress() {
  if (!pronunciationAudio || !pronunciationAudio.duration) return;
  const progress = pronunciationAudio.currentTime / pronunciationAudio.duration;
  const exact = progress * waveformBars.length;
  waveformBars.forEach((bar, i) => {
    let fill;
    if (i < Math.floor(exact)) fill = 1;
    else if (i === Math.floor(exact)) fill = exact - i;
    else fill = 0;
    bar.style.setProperty('--fill', fill);
  });
}

function animateWaveform() {
  updateWaveformProgress();
  if (pronunciationAudio && !pronunciationAudio.paused && !pronunciationAudio.ended) {
    waveformRAF = requestAnimationFrame(animateWaveform);
  }
}

function resetWaveform() {
  waveformBars.forEach((bar) => bar.style.setProperty('--fill', 0));
}

function audioCacheKey() {
  return `wordOfTheDay:${CACHE_VERSION}:audio:${todaySeed()}`;
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
  buildWaveform();

  pronunciationAudio.addEventListener('ended', () => {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    cancelAnimationFrame(waveformRAF);
    resetWaveform();
  });
}

pronunciationBtn.addEventListener('click', () => {
  if (!pronunciationAudio) return;
  if (pronunciationAudio.paused) {
    pronunciationAudio.play();
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    cancelAnimationFrame(waveformRAF);
    waveformRAF = requestAnimationFrame(animateWaveform);
  } else {
    pronunciationAudio.pause();
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    cancelAnimationFrame(waveformRAF);
  }
});

load();
loadImage();
