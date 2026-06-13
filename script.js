function getDayIndex() {
  const now = new Date();
  const utcMidnight = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dayNumber = Math.floor(utcMidnight / 86400000);
  return dayNumber % WORDS.length;
}

const entry = WORDS[getDayIndex()];

document.getElementById('word').textContent = entry.word;
document.getElementById('pos').textContent = entry.pos;
document.getElementById('definition').textContent = entry.definition;
document.getElementById('example').textContent = entry.example;
document.getElementById('date').textContent = new Date().toLocaleDateString(undefined, {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});
