// Application State
let state = {
    mode: 'flashcard-view',
    deckIndex: 0,
    cardIndex: 0,
    memory: JSON.parse(localStorage.getItem('nihongo_minimal_memory')) || {}
};

// Derived Data Processing
const CHUNK_SIZE = 100;
const decks = [{ id: 0, name: 'All Vocabulary', data: vocabData }];
for (let i = 0; i < vocabData.length; i += CHUNK_SIZE) {
    decks.push({
        id: Math.floor(i / CHUNK_SIZE) + 1,
        name: `Deck ${Math.floor(i / CHUNK_SIZE) + 1} (${i + 1}-${Math.min(i + CHUNK_SIZE, vocabData.length)})`,
        data: vocabData.slice(i, i + CHUNK_SIZE)
    });
}

// Map for quick kanji lookup
const kanjiMap = {};
kanjiData.forEach(k => { kanjiMap[k.kanji] = k; });

// DOM Elements
const els = {
    navLinks: document.querySelectorAll('.nav-links a'),
    views: document.querySelectorAll('.view'),
    deckSelect: document.getElementById('deck-select'),
    cardCounter: document.getElementById('card-counter'),
    flashcard: document.getElementById('flashcard'),
    fWord: document.getElementById('front-word'),
    bRuby: document.getElementById('back-ruby'),
    bMeaning: document.getElementById('back-meaning'),
    bKanji: document.getElementById('back-kanji'),
    statLearned: document.querySelector('.stat-learned'),
    statTotal: document.querySelector('.stat-total'),
    kanjiGrid: document.getElementById('kanji-grid'),
    vocabGrid: document.getElementById('vocab-grid'),
    kanjiSearch: document.getElementById('kanji-search'),
    vocabSearch: document.getElementById('vocab-search'),
    vocabFilter: document.getElementById('vocab-filter'),
};

// Initialization
function init() {
    // 1. Setup Navigation
    els.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchMode(e.target.dataset.target);
        });
    });

    // 2. Setup Deck Selection
    els.deckSelect.innerHTML = decks.map((d, i) => `<option value="${i}">${d.name}</option>`).join('');
    els.deckSelect.addEventListener('change', (e) => {
        state.deckIndex = parseInt(e.target.value);
        state.cardIndex = 0;
        loadCard();
    });

    // 3. Setup Flashcard Flip
    els.flashcard.addEventListener('click', () => {
        els.flashcard.classList.toggle('flipped');
    });

    // 4. Setup Input Listeners
    els.kanjiSearch.addEventListener('input', renderKanji);
    els.vocabSearch.addEventListener('input', renderVocab);
    els.vocabFilter.addEventListener('change', renderVocab);

    // Initial Renders
    updateStats();
    loadCard();
    renderKanji();
    renderVocab();
}

// Logic: Switch Tabs
function switchMode(targetId) {
    els.navLinks.forEach(l => l.classList.toggle('active', l.dataset.target === targetId));
    els.views.forEach(v => v.classList.toggle('active', v.id === targetId));
    state.mode = targetId;
}

// Logic: Generate Ruby Tag
function getRubyHtml(word, furigana) {
    if (!furigana || furigana === '') return word;
    return `<ruby>${word}<rt>${furigana}</rt></ruby>`;
}

// Logic: Load Flashcard
function loadCard() {
    const deck = decks[state.deckIndex].data;
    if (!deck || deck.length === 0) return;

    const card = deck[state.cardIndex];
    
    // Reset flip state silently
    els.flashcard.classList.remove('flipped');
    
    // Wait for flip animation to finish before swapping text
    setTimeout(() => {
        els.cardCounter.textContent = `${state.cardIndex + 1} / ${deck.length}`;
        els.fWord.textContent = card.word;
        els.bRuby.innerHTML = getRubyHtml(card.word, card.furigana);
        els.bMeaning.innerHTML = card.meaning.replace(/\n/g, '<br>');
        
        // Render Kanji Breakdown
        els.bKanji.innerHTML = '';
        if (card.kanji_related && card.kanji_related !== 'None' && card.kanji_related !== '') {
            const kanjis = card.kanji_related.split(',').map(s => s.trim());
            let html = '';
            kanjis.forEach(k => {
                const kd = kanjiMap[k];
                if (kd) {
                    html += `
                    <div class="kanji-item">
                        <div class="kanji-char">${kd.kanji}</div>
                        <div class="kanji-details">
                            <div>ON: ${kd.onyomi} &nbsp;&nbsp; KUN: ${kd.kunyomi}</div>
                            <div class="kanji-meaning">${kd.meaning}</div>
                        </div>
                    </div>`;
                }
            });
            els.bKanji.innerHTML = html;
        }
    }, 150);
}

// Logic: Record Progress
window.markCard = function(status) {
    const deck = decks[state.deckIndex].data;
    const card = deck[state.cardIndex];
    
    // Save to memory
    state.memory[card.id] = status;
    localStorage.setItem('nihongo_minimal_memory', JSON.stringify(state.memory));
    
    // Update UI
    updateStats();
    if (state.mode === 'vocab-view') renderVocab();

    // Proceed to next card
    state.cardIndex = (state.cardIndex + 1) % deck.length;
    loadCard();
};

// Logic: Update Top Stats
function updateStats() {
    const learnedCount = Object.values(state.memory).filter(v => v === 'easy').length;
    els.statLearned.textContent = learnedCount;
    els.statTotal.textContent = vocabData.length;
}

// Logic: Render Kanji Grid
function renderKanji() {
    const term = els.kanjiSearch.value.toLowerCase();
    const filtered = kanjiData.filter(k => 
        k.kanji.toLowerCase().includes(term) ||
        k.onyomi.toLowerCase().includes(term) ||
        k.kunyomi.toLowerCase().includes(term) ||
        k.meaning.toLowerCase().includes(term)
    );

    els.kanjiGrid.innerHTML = filtered.map(k => `
        <div class="grid-item">
            <div class="gi-main">${k.kanji}</div>
            <div class="gi-sub">ON: ${k.onyomi}</div>
            <div class="gi-sub">KUN: ${k.kunyomi}</div>
            <div class="gi-meaning">${k.meaning}</div>
        </div>
    `).join('');
}

// Logic: Render Vocab Grid
function renderVocab() {
    const term = els.vocabSearch.value.toLowerCase();
    const filter = els.vocabFilter.value;
    
    const filtered = vocabData.filter(v => {
        const status = state.memory[v.id] || 'none';
        const matchTerm = v.word.toLowerCase().includes(term) || 
                          v.furigana.toLowerCase().includes(term) || 
                          v.meaning.toLowerCase().includes(term);
        const matchFilter = filter === 'all' || status === filter;
        return matchTerm && matchFilter;
    });

    els.vocabGrid.innerHTML = filtered.map(v => {
        const status = state.memory[v.id] || 'none';
        let label = status === 'easy' ? 'Remembered' : 
                    status === 'hard' ? 'Almost' : 
                    status === 'fail' ? 'Forgot' : 'Not learned';

        return `
        <div class="grid-item">
            <span class="status-badge status-${status}">${label}</span>
            <div class="gi-main" style="font-size: 1.5rem; margin-bottom: 0.2rem;">
                ${getRubyHtml(v.word, v.furigana)}
            </div>
            <div class="gi-meaning" style="margin-top: 0.25rem;">
                ${v.meaning.replace(/\n/g, '<br>')}
            </div>
        </div>`;
    }).join('');
}

// Execute Application
init();
