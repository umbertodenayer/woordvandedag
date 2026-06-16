const wordEl = document.getElementById('word');
const ipaEl = document.getElementById('ipa');
const posEl = document.getElementById('pos');
const definitionEl = document.getElementById('definition');
const etymologyEl = document.getElementById('etymology');
const exampleEl = document.getElementById('example');
const sourceEl = document.getElementById('source');
const dateEl = document.getElementById('date');
const imageEl = document.getElementById('word-image');

if (localStorage.getItem('wordOfTheDay:compactView') === 'true') {
  document.body.classList.add('compact-view');
}

let currentWord = null;
let ygWidget = null;
let hearItTriggered = false;
let sbClient = null;
let sbSession = null;

// Welcome toast after login redirect
if (sessionStorage.getItem('just_logged_in') === '1') {
  sessionStorage.removeItem('just_logged_in');
  window.addEventListener('load', () => {
    setTimeout(() => showPremiumToast('Welkom terug 👋', 3000), 600);
  });
}

// === Premium auth helpers ===

let premiumToastTimer = null;

function showPremiumToast(message, duration) {
  const toast = document.getElementById('premium-toast');
  if (!toast) return;
  clearTimeout(premiumToastTimer);
  toast.textContent = message;
  toast.classList.remove('visible');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    toast.classList.add('visible');
    premiumToastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
  }));
}

function setButtonLoading(btn) {
  btn.classList.add('loading');
}

function setButtonNormal(btn) {
  btn.classList.remove('loading');
}

function showModalError(card, errorEl, btn, message) {
  setButtonNormal(btn);
  errorEl.classList.remove('fade-in');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
  requestAnimationFrame(() => errorEl.classList.add('fade-in'));
  card.classList.remove('shake');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    card.classList.add('shake');
    card.addEventListener('animationend', () => card.classList.remove('shake'), { once: true });
  }));
}

function showSuccessAndClose(modal, toastMessage, toastDuration) {
  const card = modal.querySelector('.auth-modal-card');
  const title = modal.querySelector('.auth-modal-title');
  const form = modal.querySelector('form');

  title.style.opacity = '0';
  form.style.opacity = '0';

  setTimeout(() => {
    const icon = document.createElement('div');
    icon.className = 'auth-success-icon';
    icon.innerHTML = `<svg class="checkmark-svg" viewBox="0 0 52 52">
      <circle class="checkmark-fill" cx="26" cy="26" r="25" fill="var(--terracotta)"/>
      <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none" stroke="var(--terracotta)" stroke-width="2"/>
      <polyline class="checkmark-tick" points="13,27 22,35 39,17" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    card.appendChild(icon);

    requestAnimationFrame(() => {
      icon.classList.add('visible');
      requestAnimationFrame(() => {
        icon.querySelector('.checkmark-fill').classList.add('animate');
        icon.querySelector('.checkmark-circle').classList.add('animate');
        icon.querySelector('.checkmark-tick').classList.add('animate');
      });
    });

    setTimeout(() => {
      modal.style.transition = 'opacity 0.4s ease';
      requestAnimationFrame(() => {
        modal.style.opacity = '0';
        setTimeout(() => {
          modal.classList.add('hidden');
          modal.style.opacity = '';
          modal.style.transition = '';
          title.style.opacity = '';
          form.style.opacity = '';
          if (icon.parentNode) icon.parentNode.removeChild(icon);
          showPremiumToast(toastMessage, toastDuration);
        }, 420);
      });
    }, 1650);
  }, 300);
}

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
  const weeklyEmailToggle = document.getElementById('setting-weekly-email');
  const compactViewToggle = document.getElementById('setting-compact-view');
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
    const existingIcon = modal.querySelector('.auth-success-icon');
    if (existingIcon) existingIcon.remove();
    const title = modal.querySelector('.auth-modal-title');
    const form = modal.querySelector('form');
    if (title) title.style.opacity = '';
    if (form) form.style.opacity = '';
    const btn = modal.querySelector('.auth-submit');
    if (btn) setButtonNormal(btn);
    modal.querySelector('form').reset();
    const error = modal.querySelector('.auth-error');
    error.classList.add('hidden');
    error.classList.remove('fade-in');
    error.textContent = '';
    modal.querySelectorAll('.eye-open').forEach((icon) => icon.classList.remove('hidden'));
    modal.querySelectorAll('.eye-closed').forEach((icon) => icon.classList.add('hidden'));
    modal.querySelectorAll('input[type="text"]').forEach((input) => { input.type = 'password'; });
    modal.style.opacity = '0';
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      modal.style.transition = 'opacity 0.3s ease';
      modal.style.opacity = '1';
      setTimeout(() => { modal.style.opacity = ''; modal.style.transition = ''; }, 320);
    });
  };

  const closeModal = (modal) => {
    const existingIcon = modal.querySelector('.auth-success-icon');
    if (existingIcon) existingIcon.remove();
    const title = modal.querySelector('.auth-modal-title');
    const form = modal.querySelector('form');
    if (title) title.style.opacity = '';
    if (form) form.style.opacity = '';
    modal.style.transition = 'opacity 0.3s ease';
    requestAnimationFrame(() => {
      modal.style.opacity = '0';
      setTimeout(() => {
        modal.classList.add('hidden');
        modal.style.opacity = '';
        modal.style.transition = '';
      }, 320);
    });
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
    window.location.href = 'login.html';
  });

  openSignupBtn.addEventListener('click', () => {
    closeDropdown();
    window.location.href = 'signup.html';
  });

  openChangePasswordBtn.addEventListener('click', () => {
    closeDropdown();
    openModal(changePasswordModal);
  });

  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const [emailInput, passwordInput] = signinForm.querySelectorAll('.auth-input');
    const errorEl = signinForm.querySelector('.auth-error');
    const btn = signinForm.querySelector('.auth-submit');
    const card = signinModal.querySelector('.auth-modal-card');

    errorEl.classList.add('hidden');
    errorEl.classList.remove('fade-in');
    setButtonLoading(btn);

    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput.value,
      password: passwordInput.value
    });

    if (error) {
      showModalError(card, errorEl, btn, error.message);
      return;
    }

    showSuccessAndClose(signinModal, 'Welkom terug.', 3000);
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const [emailInput, passwordInput] = signupForm.querySelectorAll('.auth-input');
    const errorEl = signupForm.querySelector('.auth-error');
    const btn = signupForm.querySelector('.auth-submit');
    const card = signupModal.querySelector('.auth-modal-card');

    errorEl.classList.add('hidden');
    errorEl.classList.remove('fade-in');
    setButtonLoading(btn);

    const { data, error } = await supabase.auth.signUp({
      email: emailInput.value,
      password: passwordInput.value
    });

    if (error) {
      const msg = error.message.toLowerCase().includes('already registered')
        ? 'Er bestaat al een account met dit e-mailadres.'
        : error.message;
      showModalError(card, errorEl, btn, msg);
      return;
    }

    // Supabase silently returns success with empty identities when email enumeration protection is on
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      showModalError(card, errorEl, btn, 'Er bestaat al een account met dit e-mailadres.');
      return;
    }

    showSuccessAndClose(signupModal, 'Account aangemaakt — controleer je e-mail om te bevestigen.', 5000);
  });

  changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const [newPasswordInput, confirmPasswordInput] = changePasswordForm.querySelectorAll('.auth-input');
    const errorEl = changePasswordForm.querySelector('.auth-error');
    const btn = changePasswordForm.querySelector('.auth-submit');
    const card = changePasswordModal.querySelector('.auth-modal-card');

    errorEl.classList.add('hidden');
    errorEl.classList.remove('fade-in');
    setButtonLoading(btn);

    if (newPasswordInput.value !== confirmPasswordInput.value) {
      showModalError(card, errorEl, btn, 'Wachtwoorden komen niet overeen.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPasswordInput.value });

    if (error) {
      showModalError(card, errorEl, btn, error.message);
      return;
    }

    showSuccessAndClose(changePasswordModal, 'Wachtwoord succesvol bijgewerkt.', 3000);
  });

  const ctaBanner = document.getElementById('cta-banner');
  let ctaBannerDismissed = false;

  const updateUserUI = (session) => {
    sbSession = session;
    const signedIn = !!session;
    userDot.classList.toggle('hidden', !signedIn);
    dropdownSignedOut.classList.toggle('hidden', signedIn);
    dropdownSignedIn.classList.toggle('hidden', !signedIn);
    if (signedIn) {
      userEmailEl.textContent = session.user.email;
    }

    if (ctaBanner) {
      if (signedIn) {
        ctaBannerDismissed = true;
        ctaBanner.classList.remove('visible');
        setTimeout(() => ctaBanner.classList.add('hidden'), 520);
      } else if (!ctaBannerDismissed && ctaBanner.classList.contains('hidden')) {
        ctaBanner.classList.remove('hidden');
        requestAnimationFrame(() => requestAnimationFrame(() => ctaBanner.classList.add('visible')));
      }
    }

    if (signedIn) {
      supabase.from('user_profiles')
        .select('niveau')
        .eq('user_id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data?.niveau) return;
          const mapped = NIVEAU_MAP[data.niveau] || (CEFR_LEVELS.includes(data.niveau) ? data.niveau : null);
          if (mapped && mapped !== getCurrentLevel()) {
            setCurrentLevel(mapped);
            updateLevelBar();
            load(true);
            loadImage();
          }
        });
    }

    communityRenderAuth();
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

  supabase.auth.getSession().then(({ data }) => {
    updateUserUI(data.session);
    if (!data.session && window.location.hash === '#signin') {
      history.replaceState(null, '', window.location.pathname);
      window.location.href = 'login.html';
    }
  });
} else {
  console.warn('Supabase failed to load; auth disabled.');
}

// === Settings subpage routing ===
// (Mijn Profiel and Mijn Woorden are now standalone pages: profiel.html / mijn-woorden.html)

const mainContent  = document.getElementById('main-content');
const pageSettings = document.getElementById('page-settings');

const showPage = (page) => {
  if (mainContent)  mainContent.classList.toggle('hidden', !!page);
  if (pageSettings) pageSettings.classList.toggle('hidden', page !== 'settings');
};

const loadSettingsPage = async () => {
  const weeklyEmailToggle = document.getElementById('setting-weekly-email');
  const compactViewToggle = document.getElementById('setting-compact-view');
  if (!weeklyEmailToggle || !compactViewToggle) return;

  compactViewToggle.setAttribute('aria-checked', document.body.classList.contains('compact-view'));

  let weeklyEmail = false;
  if (sbClient && sbSession) {
    const { data } = await sbClient
      .from('user_preferences')
      .select('weekly_email')
      .eq('user_id', sbSession.user.id)
      .maybeSingle();
    weeklyEmail = !!data?.weekly_email;
  }
  weeklyEmailToggle.setAttribute('aria-checked', weeklyEmail);
};

const handleRoute = async () => {
  if (window.location.hash === '#settings') {
    showPage('settings');
    await loadSettingsPage();
  } else {
    showPage(null);
  }
};

window.addEventListener('hashchange', handleRoute);
handleRoute();

document.getElementById('settings-btn')?.addEventListener('click', () => {
  window.location.hash = '#settings';
});

document.getElementById('settings-back-btn')?.addEventListener('click', () => {
  window.location.hash = '';
});

// (Profile editing now lives on the standalone profiel.html page.)

const CACHE_VERSION = 'v4';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'Native'];
const CEFR_LABELS = { A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', Native: 'Moedertaal' };
const NIVEAU_MAP  = { Beginner: 'A1', Basis: 'A2', Gevorderd: 'B2', Moedertaal: 'Native' };
const LEVEL_STORAGE_KEY = 'woordvandedag:niveau';
const DEFAULT_LEVEL = 'B1';

function getCurrentLevel() {
  const v = localStorage.getItem(LEVEL_STORAGE_KEY);
  return CEFR_LEVELS.includes(v) ? v : DEFAULT_LEVEL;
}

function setCurrentLevel(level) {
  if (!CEFR_LEVELS.includes(level)) return;
  localStorage.setItem(LEVEL_STORAGE_KEY, level);
}

function todaySeed() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
}

function cacheKey() {
  return `wordOfTheDay:${CACHE_VERSION}:${todaySeed()}:${getCurrentLevel()}`;
}

function renderWildCards(examples) {
  const container = document.getElementById('wild-cards-container');
  if (!container || !Array.isArray(examples) || examples.length === 0) return;
  container.innerHTML = examples.map((ex, i) => `
    <article class="wild-card">
      <p class="wild-pub">${ex.pub}</p>
      <p class="wild-excerpt">${ex.excerpt}</p>
      <p class="wild-source">${ex.source}</p>
    </article>
  `).join('');
  const cards = [...container.querySelectorAll('.wild-card')];
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.style.transitionDelay = `${cards.indexOf(entry.target) * 0.15}s`;
      entry.target.classList.add('visible');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.2 });
  cards.forEach(card => obs.observe(card));
}

function render(data) {
  definitionEl.className = 'definition';
  currentWord = data.word;
  loadPronunciation();
  loadRatings();
  loadSaveState();
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
  renderWildCards(data.inDePraktijk);
  communityOnWord(data);
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
  const response = await fetch(`/api/word?level=${getCurrentLevel()}`);
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
  return `wordOfTheDay:${CACHE_VERSION}:image:${todaySeed()}:${getCurrentLevel()}`;
}

async function loadImage(attempt = 0) {
  imageEl.classList.remove('loaded');
  const key = imageCacheKey();
  const cached = localStorage.getItem(key);
  if (cached) {
    imageEl.src = cached;
    imageEl.classList.add('loaded');
    return;
  }
  try {
    const response = await fetch(`/api/image?level=${getCurrentLevel()}`);
    if (response.status === 503 && attempt < 10) {
      setTimeout(() => loadImage(attempt + 1), 8000);
      return;
    }
    if (!response.ok) return;
    const data = await response.json();
    const src = `data:${data.mimeType};base64,${data.data}`;
    imageEl.src = src;
    imageEl.classList.add('loaded');
    // best-effort cache — large base64 images can exceed the 5 MB localStorage quota
    try { localStorage.setItem(key, src); } catch (e) {}
  } catch (e) {
    // image is optional, fail silently
  }
}

dateEl.textContent = new Date().toLocaleDateString('nl-NL', {
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
  return `wordOfTheDay:${CACHE_VERSION}:audio:${todaySeed()}:${getCurrentLevel()}`;
}

async function loadPronunciation(attempt = 0) {
  const key = audioCacheKey();
  const cached = localStorage.getItem(key);
  if (cached) {
    setupAudio(cached);
    return;
  }

  try {
    const response = await fetch(`/api/pronunciation?level=${getCurrentLevel()}`);
    if (response.status === 503 && attempt < 10) {
      setTimeout(() => loadPronunciation(attempt + 1), 8000);
      return;
    }
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
  return `wordOfTheDay:${CACHE_VERSION}:vote:${todaySeed()}:${getCurrentLevel()}`;
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
  const { data: row } = await sbClient
    .from('word_ratings')
    .select('likes, dislikes')
    .eq('word', currentWord)
    .eq('date', today)
    .maybeSingle();

  const likes    = (row?.likes    ?? 0) + (type === 'like'    ? 1 : 0);
  const dislikes = (row?.dislikes ?? 0) + (type === 'dislike' ? 1 : 0);

  if (row) {
    await sbClient.from('word_ratings')
      .update({ likes, dislikes })
      .eq('word', currentWord)
      .eq('date', today);
  } else {
    await sbClient.from('word_ratings')
      .insert({ word: currentWord, date: today, likes, dislikes });
  }

  likeCountEl.textContent    = likes;
  dislikeCountEl.textContent = dislikes;
  localStorage.setItem(voteKey(), type);
  thumbUpBtn.classList.toggle('active',   type === 'like');
  thumbDownBtn.classList.toggle('active', type === 'dislike');

  if (type === 'like' && sbSession) {
    await sbClient.from('user_liked_words')
      .insert({ user_id: sbSession.user.id, word: currentWord, date: today });
  }
}

thumbUpBtn.addEventListener('click', () => castVote('like'));
thumbDownBtn.addEventListener('click', () => castVote('dislike'));

// === Save / bookmark the current word (writes user_liked_words) ===
const saveWordBtn = document.getElementById('save-word-btn');
let wordIsSaved = false;

function setSavedUI(saved) {
  wordIsSaved = saved;
  if (!saveWordBtn) return;
  saveWordBtn.classList.toggle('saved', saved);
  saveWordBtn.setAttribute('aria-pressed', saved ? 'true' : 'false');
  const label = saveWordBtn.querySelector('.save-word-label');
  if (label) label.textContent = saved ? 'Opgeslagen' : 'Bewaar woord';
}

async function loadSaveState() {
  setSavedUI(false);
  if (!saveWordBtn || !sbClient || !sbSession || !currentWord) return;
  try {
    const { data } = await sbClient
      .from('user_liked_words')
      .select('word')
      .eq('user_id', sbSession.user.id)
      .eq('word', currentWord)
      .limit(1);
    setSavedUI(!!(data && data.length));
  } catch (e) { /* ignore */ }
}

async function toggleSaveWord() {
  if (!currentWord) return;
  if (!sbClient || !sbSession) {
    showPremiumToast('Log in om woorden te bewaren', 3000);
    return;
  }
  const wasSaved = wordIsSaved;
  setSavedUI(!wasSaved); // optimistic
  try {
    if (wasSaved) {
      await sbClient.from('user_liked_words')
        .delete()
        .eq('user_id', sbSession.user.id)
        .eq('word', currentWord);
    } else {
      await sbClient.from('user_liked_words')
        .insert({ user_id: sbSession.user.id, word: currentWord, date: todayDateStr() });
    }
  } catch (e) {
    setSavedUI(wasSaved); // revert on failure
    showPremiumToast('Er ging iets mis. Probeer opnieuw.', 3000);
  }
}

if (saveWordBtn) saveWordBtn.addEventListener('click', toggleSaveWord);

function updateLevelBar() {
  const bar = document.getElementById('level-bar');
  if (!bar) return;
  const current = getCurrentLevel();
  bar.innerHTML = CEFR_LEVELS.map(id => {
    const label = CEFR_LABELS[id];
    return `<button class="level-pill${id === current ? ' active' : ''}" data-level="${id}" onclick="window.switchLevel('${id}')">${label}</button>`;
  }).join('');
}

// Persist a level change back to the shared Supabase field (user_profiles.niveau)
// so the word feature and the profile page stay in sync. Fire-and-forget;
// preserves existing leerdoelen so they aren't wiped.
async function persistLevelToProfile(level) {
  if (!sbClient || !sbSession) return;
  try {
    const { data } = await sbClient
      .from('user_profiles')
      .select('leerdoelen')
      .eq('user_id', sbSession.user.id)
      .maybeSingle();
    await fetch('/api/save-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sbSession.access_token}` },
      body: JSON.stringify({ niveau: level, leerdoelen: Array.isArray(data?.leerdoelen) ? data.leerdoelen : [] })
    });
  } catch (e) {
    console.error('[persist level]', e);
  }
}

window.switchLevel = function(level) {
  if (!CEFR_LEVELS.includes(level) || level === getCurrentLevel()) return;
  setCurrentLevel(level);
  updateLevelBar();
  load(true);
  loadImage();
  persistLevelToProfile(level);
};

// ════════ Community sentences ════════════════════════════════════════════════
let communityWord  = null;
let communityDate  = null;
let communityLevel = null;

function communityEsc(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function amsterdamDateStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function communityRelTime(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 45) return 'zojuist';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} ${min === 1 ? 'minuut' : 'minuten'} geleden`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} uur geleden`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} ${day === 1 ? 'dag' : 'dagen'} geleden`;
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function communityCardHtml(row) {
  return `
    <article class="community-card">
      <p class="community-card-text">${communityEsc(row.text)}</p>
      <div class="community-card-meta">
        <span class="community-card-author">${communityEsc(row.display_name || 'Anoniem')}</span>
        <span class="community-card-dot">·</span>
        <span class="community-card-time">${communityEsc(communityRelTime(row.created_at))}</span>
      </div>
    </article>`;
}

function communityRenderFeed(rows) {
  const feed = document.getElementById('community-feed');
  if (!feed) return;
  if (!rows || rows.length === 0) {
    feed.innerHTML = '<p class="community-empty">Nog geen zinnen — wees de eerste!</p>';
    return;
  }
  feed.innerHTML = rows.map(communityCardHtml).join('');
}

async function communityLoadFeed() {
  const feed = document.getElementById('community-feed');
  if (!feed || !sbClient || !communityDate || !communityLevel) return;
  const { data, error } = await sbClient
    .from('sentences')
    .select('id, display_name, text, created_at')
    .eq('word_date', communityDate)
    .eq('level', communityLevel)
    .order('created_at', { ascending: false })
    .limit(200);
  communityRenderFeed(error ? [] : data);
}

function communityRenderAuth() {
  const composer = document.getElementById('community-composer');
  const login    = document.getElementById('community-login');
  if (!composer || !login) return;
  const signedIn = !!sbSession;
  composer.hidden = !signedIn;
  login.hidden    = signedIn;
}

function communityOnWord(data) {
  communityWord  = data.word;
  communityDate  = data.date || amsterdamDateStr();
  communityLevel = data.level || getCurrentLevel();
  const wordSpan = document.getElementById('community-word');
  if (wordSpan) wordSpan.textContent = `"${data.word}"`;
  communityRenderAuth();
  communityLoadFeed();
}

(function communityInit() {
  const input    = document.getElementById('community-input');
  const counter  = document.getElementById('community-counter');
  const submit   = document.getElementById('community-submit');
  const feedback = document.getElementById('community-feedback');
  if (!input || !submit) return;

  const MAX = 200;
  const WARN = MAX - 20;

  function setFeedback(msg, kind) {
    if (!feedback) return;
    if (!msg) {
      feedback.hidden = true;
      feedback.textContent = '';
      feedback.className = 'community-feedback';
      return;
    }
    feedback.hidden = false;
    feedback.textContent = msg;
    feedback.className = `community-feedback community-feedback--${kind || 'error'}`;
  }

  function updateCounter() {
    const len = input.value.trim().length;
    counter.textContent = `${len} / ${MAX}`;
    counter.classList.toggle('community-counter--warn', len > WARN);
  }

  input.addEventListener('input', () => { updateCounter(); setFeedback(''); });
  updateCounter();

  async function submitSentence() {
    if (!sbSession) { setFeedback('Log in om je zin te delen.', 'error'); return; }
    const sentence = input.value.replace(/\s+/g, ' ').trim();
    if (!sentence) { setFeedback('Schrijf eerst een zin.', 'error'); return; }
    if (sentence.length > MAX) { setFeedback('Je zin is te lang — houd het kort.', 'error'); return; }

    submit.disabled = true;
    submit.classList.add('is-loading');
    setFeedback('Controleren…', 'pending');
    try {
      const r = await fetch(`/api/community/submit?level=${getCurrentLevel()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sbSession.access_token}`,
        },
        body: JSON.stringify({ sentence }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.ok) {
        setFeedback(body.message || 'Er ging iets mis. Probeer het opnieuw.', 'error');
        return;
      }
      input.value = '';
      updateCounter();
      setFeedback('Geplaatst! Bedankt voor je bijdrage.', 'success');
      setTimeout(() => setFeedback(''), 3000);
      const feed = document.getElementById('community-feed');
      if (feed) {
        const empty = feed.querySelector('.community-empty');
        if (empty) feed.innerHTML = '';
        feed.insertAdjacentHTML('afterbegin', communityCardHtml(body.sentence));
        const firstCard = feed.querySelector('.community-card');
        if (firstCard) firstCard.classList.add('community-card--new');
      }
    } catch (e) {
      setFeedback('Geen verbinding. Probeer het opnieuw.', 'error');
    } finally {
      submit.disabled = false;
      submit.classList.remove('is-loading');
    }
  }

  submit.addEventListener('click', submitSentence);
  input.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submitSentence(); }
  });

  communityRenderAuth();
})();

updateLevelBar();
load();
loadImage();
