function getDayIndex() {
  const now = new Date();
  const utcMidnight = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dayNumber = Math.floor(utcMidnight / 86400000);
  return dayNumber % WORDS.length;
}

const entry = WORDS[getDayIndex()];

const wordEl = document.getElementById('word');
const posEl = document.getElementById('pos');
const definitionEl = document.getElementById('definition');
const exampleEl = document.getElementById('example');

function render(lang) {
  const data = lang === 'nl' ? entry.nl : entry;
  wordEl.textContent = data.word;
  posEl.textContent = data.pos;
  definitionEl.textContent = data.definition;
  exampleEl.textContent = data.example;

  document.getElementById('lang-en').classList.toggle('active', lang === 'en');
  document.getElementById('lang-nl').classList.toggle('active', lang === 'nl');
}

document.getElementById('lang-en').addEventListener('click', () => render('en'));
document.getElementById('lang-nl').addEventListener('click', () => render('nl'));

render('en');

document.getElementById('date').textContent = new Date().toLocaleDateString(undefined, {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});
