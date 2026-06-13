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

if (localStorage.getItem('wordOfTheDay:compactView') === 'true') {
  document.body.classList.add('compact-view');
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('wordOfTheDay:theme', next);
  applyTheme(next, true);
});

let currentWord = null;
let ygWidget = null;
let hearItTriggered = false;
let sbClient = null;
let sbSession = null;

if (window.supabase) {
  const SUPABASE_URL = 'https://lanmsexkozkrttiydtsm.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_c8SjUvXE8zTZIEgB6i9hYw_uJR_4i37';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  sbClient = supabase;

  const userIconBtn = document.getElementById('user-icon-btn');
  const userDot = document.getElementById('user-dot');
  const userDropdown = document.getElementById('user-dropdown');
  const dropdownSignedOut = document.getElementById('dropdown-signed-out');
  const dropdownSignedIn = document.getElementById('dropdown-signed-in');
  const userEmailEl = document.getElementById('user-email');
  const openSigninBtn = document.getElementById('open-signin-btn');
  const openSignupBtn = document.getElementById('open-signup-btn');
  const openChangePasswordBtn = document.getElementById('open-change-password-btn');
  const signOutBtn = document.getElementById('sign-out-btn');
  const myWordsBtn = document.getElementById('my-words-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const darkModeToggle = document.getElementById('setting-dark-mode');
  const weeklyEmailToggle = document.getElementById('setting-weekly-email');
  const compactViewToggle = document.getElementById('setting-compact-view');
  const myWordsModal = document.getElementById('my-words-modal');
  const myWordsList = document.getElementById('my-words-list');
  const authToast = document.getElementById('auth-toast');

  const signinModal = document.getElementById('signin-modal');
  const signupModal = document.getElementById('signup-modal');
  const changePasswordModal = document.getElementById('change-password-modal');
  const signinForm = document.getElementById('signin-form');
  const signupForm = document.getElementById('signup-form');
  const changePasswordForm = document.getElementById('change-password-form');

  const showToast = (message) => {
    authToast.textContent = message;
    authToast.classList.remove('hidden');
    requestAnimationFrame(() => authToast.classList.add('visible'));
    setTimeout(() => {
      authToast.classList.remove('visible');
      setTimeout(() => authToast.classList.add('hidden'), 300);
    }, 4000);
  };

  const closeDropdown = () => {
    userDropdown.classList.remove('visible');
    setTimeout(() => userDropdown.classList.add('hidden'), 200);
  };

  const openDropdown = () => {
    userDropdown.classList.remove('hidden');
    requestAnimationFrame(() => userDropdown.classList.add('visible'));
  };

  const openModal = (modal) => {
    modal.querySelector('form').reset();
    const error = modal.querySelector('.auth-error');
    error.classList.add('hidden');
    error.textContent = '';
    modal.querySelectorAll('.eye-open').forEach((icon) => icon.classList.remove('hidden'));
    modal.querySelectorAll('.eye-closed').forEach((icon) => icon.classList.add('hidden'));
    modal.querySelectorAll('input[type="text"]').forEach((input) => { input.type = 'password'; });
    modal.classList.remove('hidden');
  };

  const closeModal = (modal) => {
    modal.classList.add('hidden');
  };

  document.querySelectorAll('.auth-modal').forEach((modal) => {
    modal.querySelector('.auth-modal-backdrop').addEventListener('click', () => closeModal(modal));
    modal.querySelector('.auth-modal-close').addEventListener('click', () => closeModal(modal));
  });

  document.querySelectorAll('.auth-eye-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const input = toggle.parentElement.querySelector('.auth-input');
      const eyeOpen = toggle.querySelector('.eye-open');
      const eyeClosed = toggle.querySelector('.eye-closed');
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      eyeOpen.classList.toggle('hidden', reveal);
      eyeClosed.classList.toggle('hidden', !reveal);
    });
  });

  openSigninBtn.addEventListener('click', () => {
    closeDropdown();
    openModal(signinModal);
  });

  openSignupBtn.addEventListener('click', () => {
    closeDropdown();
    openModal(signupModal);
  });

  openChangePasswordBtn.addEventListener('click', () => {
    closeDropdown();
    openModal(changePasswordModal);
  });

  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const [emailInput, passwordInput] = signinForm.querySelectorAll('.auth-input');
    const errorEl = signinForm.querySelector('.auth-error');
    errorEl.classList.add('hidden');

    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput.value,
      password: passwordInput.value
    });

    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove('hidden');
      return;
    }

    closeModal(signinModal);
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const [emailInput, passwordInput] = signupForm.querySelectorAll('.auth-input');
    const errorEl = signupForm.querySelector('.auth-error');
    errorEl.classList.add('hidden');

    const { error } = await supabase.auth.signUp({
      email: emailInput.value,
      password: passwordInput.value
    });

    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove('hidden');
      return;
    }

    closeModal(signupModal);
    showToast('Controleer je e-mail om je account te bevestigen voor je inlogt.');
  });

  changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const [newPasswordInput, confirmPasswordInput] = changePasswordForm.querySelectorAll('.auth-input');
    const errorEl = changePasswordForm.querySelector('.auth-error');
    errorEl.classList.add('hidden');

    if (newPasswordInput.value !== confirmPasswordInput.value) {
      errorEl.textContent = 'Passwords do not match.';
      errorEl.classList.remove('hidden');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPasswordInput.value });

    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove('hidden');
      return;
    }

    closeModal(changePasswordModal);
    showToast('Password updated successfully.');
  });

  const updateUserUI = (session) => {
    sbSession = session;
    const signedIn = !!session;
    userDot.classList.toggle('hidden', !signedIn);
    dropdownSignedOut.classList.toggle('hidden', signedIn);
    dropdownSignedIn.classList.toggle('hidden', !signedIn);
    if (signedIn) {
      userEmailEl.textContent = session.user.email;
    }
  };

  userIconBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (userDropdown.classList.contains('hidden')) {
      openDropdown();
    } else {
      closeDropdown();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu') && !userDropdown.classList.contains('hidden')) {
      closeDropdown();
    }
  });

  signOutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    closeDropdown();
  });

  myWordsBtn.addEventListener('click', async () => {
    closeDropdown();
    myWordsList.innerHTML = '';
    myWordsModal.classList.remove('hidden');

    const { data, error } = await supabase
      .from('user_liked_words')
      .select('word, date')
      .eq('user_id', sbSession.user.id)
      .order('date', { ascending: false });

    if (error || !data || data.length === 0) {
      myWordsList.innerHTML = '<p class="my-words-empty">Words you like will appear here.</p>';
      return;
    }

    myWordsList.innerHTML = data.map((row) => `
      <div class="my-words-item">
        <span class="my-words-word">${row.word}</span>
        <span class="my-words-date">${row.date}</span>
      </div>
    `).join('');
  });

  settingsBtn.addEventListener('click', async () => {
    closeDropdown();

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    darkModeToggle.setAttribute('aria-checked', currentTheme === 'dark');

    compactViewToggle.setAttribute('aria-checked', document.body.classList.contains('compact-view'));

    let weeklyEmail = false;
    if (sbSession) {
      const { data } = await supabase
        .from('user_preferences')
        .select('weekly_email')
        .eq('user_id', sbSession.user.id)
        .maybeSingle();
      weeklyEmail = !!data?.weekly_email;
    }
    weeklyEmailToggle.setAttribute('aria-checked', weeklyEmail);

    settingsModal.classList.remove('hidden');
  });

  darkModeToggle.addEventListener('click', () => {
    const isDark = darkModeToggle.getAttribute('aria-checked') === 'true';
    const next = isDark ? 'light' : 'dark';
    darkModeToggle.setAttribute('aria-checked', !isDark);
    localStorage.setItem('wordOfTheDay:theme', next);
    applyTheme(next, true);
  });

  compactViewToggle.addEventListener('click', () => {
    const isCompact = compactViewToggle.getAttribute('aria-checked') === 'true';
    const next = !isCompact;
    compactViewToggle.setAttribute('aria-checked', next);
    document.body.classList.toggle('compact-view', next);
    localStorage.setItem('wordOfTheDay:compactView', next ? 'true' : 'false');
  });

  weeklyEmailToggle.addEventListener('click', async () => {
    if (!sbSession) return;
    const isOn = weeklyEmailToggle.getAttribute('aria-checked') === 'true';
    const next = !isOn;
    weeklyEmailToggle.setAttribute('aria-checked', next);
    await supabase
      .from('user_preferences')
      .upsert({ user_id: sbSession.user.id, weekly_email: next });
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    updateUserUI(session);
  });

  supabase.auth.getSession().then(({ data }) => updateUserUI(data.session));
} else {
  console.warn('Supabase failed to load; auth disabled.');
}

const CACHE_VERSION = 'v3';

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
  loadRatings();
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

const thumbUpBtn = document.getElementById('thumb-up-btn');
const thumbDownBtn = document.getElementById('thumb-down-btn');
const likeCountEl = document.getElementById('like-count');
const dislikeCountEl = document.getElementById('dislike-count');

function todayDateStr() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
}

function voteKey() {
  return `wordOfTheDay:${CACHE_VERSION}:vote:${todaySeed()}`;
}

async function loadRatings() {
  if (!sbClient || !currentWord) return;
  const today = todayDateStr();
  const { data } = await sbClient
    .from('word_ratings')
    .select('likes, dislikes')
    .eq('word', currentWord)
    .eq('date', today)
    .maybeSingle();

  likeCountEl.textContent = data?.likes ?? 0;
  dislikeCountEl.textContent = data?.dislikes ?? 0;

  const savedVote = localStorage.getItem(voteKey());
  thumbUpBtn.classList.toggle('active', savedVote === 'like');
  thumbDownBtn.classList.toggle('active', savedVote === 'dislike');
}

async function castVote(type) {
  if (!sbClient || !currentWord || localStorage.getItem(voteKey())) return;

  const today = todayDateStr();
  const { data: existing } = await sbClient
    .from('word_ratings')
    .select('likes, dislikes')
    .eq('word', currentWord)
    .eq('date', today)
    .maybeSingle();

  const likes = (existing?.likes ?? 0) + (type === 'like' ? 1 : 0);
  const dislikes = (existing?.dislikes ?? 0) + (type === 'dislike' ? 1 : 0);

  if (existing) {
    await sbClient.from('word_ratings').update({ likes, dislikes }).eq('word', currentWord).eq('date', today);
  } else {
    await sbClient.from('word_ratings').insert({ word: currentWord, date: today, likes, dislikes });
  }

  likeCountEl.textContent = likes;
  dislikeCountEl.textContent = dislikes;
  localStorage.setItem(voteKey(), type);
  thumbUpBtn.classList.toggle('active', type === 'like');
  thumbDownBtn.classList.toggle('active', type === 'dislike');

  if (type === 'like' && sbSession) {
    await sbClient.from('user_liked_words').insert({
      user_id: sbSession.user.id,
      word: currentWord,
      date: today
    });
  }
}

thumbUpBtn.addEventListener('click', () => castVote('like'));
thumbDownBtn.addEventListener('click', () => castVote('dislike'));

load();
loadImage();
