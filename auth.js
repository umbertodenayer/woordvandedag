const SUPABASE_URL = 'https://lanmsexkozkrttiydsm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_c8SjUvXE8zTZIEgB6i9hYw_uJR_4i37';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const userBtn = document.getElementById('user-btn');
const authDot = document.getElementById('auth-dot');
const authDropdown = document.getElementById('auth-dropdown');
const signoutBtn = document.getElementById('signout-btn');

const overlay = document.getElementById('auth-modal-overlay');
const closeBtn = document.getElementById('auth-close');
const form = document.getElementById('auth-form');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const errorEl = document.getElementById('auth-error');
const titleEl = document.getElementById('auth-title');
const submitBtn = document.getElementById('auth-submit');
const toggleText = document.getElementById('auth-toggle-text');
const toggleLink = document.getElementById('auth-toggle-link');

let mode = 'login';
let session = null;

function setMode(newMode) {
  mode = newMode;
  errorEl.classList.add('hidden');
  form.reset();
  if (mode === 'login') {
    titleEl.textContent = 'Log In';
    submitBtn.textContent = 'Log In';
    toggleText.textContent = "Don't have an account?";
    toggleLink.textContent = 'Sign up';
  } else {
    titleEl.textContent = 'Sign Up';
    submitBtn.textContent = 'Sign Up';
    toggleText.textContent = 'Already have an account?';
    toggleLink.textContent = 'Log in';
  }
}

function openModal() {
  setMode('login');
  overlay.classList.remove('hidden');
}

function closeModal() {
  overlay.classList.add('hidden');
}

function updateAuthUI() {
  authDot.classList.toggle('hidden', !session);
  authDropdown.classList.add('hidden');
}

userBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (session) {
    authDropdown.classList.toggle('hidden');
  } else {
    openModal();
  }
});

document.addEventListener('click', (e) => {
  if (!authDropdown.contains(e.target) && e.target !== userBtn) {
    authDropdown.classList.add('hidden');
  }
});

closeBtn.addEventListener('click', closeModal);

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

toggleLink.addEventListener('click', (e) => {
  e.preventDefault();
  setMode(mode === 'login' ? 'signup' : 'login');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.classList.add('hidden');
  submitBtn.disabled = true;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  const { data, error } = mode === 'login'
    ? await supabaseClient.auth.signInWithPassword({ email, password })
    : await supabaseClient.auth.signUp({ email, password });

  submitBtn.disabled = false;

  if (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
    return;
  }

  if (mode === 'signup' && !data.session) {
    errorEl.textContent = 'Check your email to confirm your account.';
    errorEl.classList.remove('hidden');
    return;
  }

  session = data.session;
  updateAuthUI();
  closeModal();
});

signoutBtn.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  session = null;
  updateAuthUI();
});

supabaseClient.auth.getSession().then(({ data }) => {
  session = data.session;
  updateAuthUI();
});

supabaseClient.auth.onAuthStateChange((_event, newSession) => {
  session = newSession;
  updateAuthUI();
});
