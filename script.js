let db;
let currentWords = [];
let studyQueue = [];
let currentWordIndex = 0;
let correctCount = 0;
let incorrectCount = 0;
let wordRepeatTracker = {};

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    initDatabase();
    setupEventListeners();
    initTheme();
}

function initDatabase() {
    const request = indexedDB.open('ChineseSpellingDB', 1);
    
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('words')) {
            const store = db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
            store.createIndex('chapter', 'chapter', { unique: false });
            store.createIndex('unit', 'unit', { unique: false });
        }
    };
    
    request.onsuccess = (event) => {
        db = event.target.result;
        loadWordList();
        updateFilters();
    };
    
    request.onerror = (event) => {
        console.error('Database error:', event.target.error);
    };
}

function setupEventListeners() {
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('add-word').addEventListener('click', addWord);
    document.getElementById('bulk-add-btn').addEventListener('click', bulkAddWords);
    document.getElementById('chapter-filter').addEventListener('change', filterWords);
    document.getElementById('unit-filter').addEventListener('change', filterWords);
    document.getElementById('start-study').addEventListener('click', startStudySession);
    document.getElementById('check-word').addEventListener('click', checkWord);
    document.getElementById('mark-correct').addEventListener('click', () => markWord(true));
    document.getElementById('mark-wrong').addEventListener('click', () => markWord(false));
    document.getElementById('next-word').addEventListener('click', nextWord);
    document.getElementById('exit-study').addEventListener('click', exitStudySession);
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.className = savedTheme + '-mode';
    document.getElementById('theme-toggle').textContent = savedTheme === 'light' ? '🌙' : '☀️';
}

function toggleTheme() {
    const currentTheme = document.body.className.includes('light') ? 'light' : 'dark';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.body.className = newTheme + '-mode';
    document.getElementById('theme-toggle').textContent = newTheme === 'light' ? '🌙' : '☀️';
    localStorage.setItem('theme', newTheme);
}

function addWord() {
    const chapterInput = document.getElementById('chapter-input');
    const unitInput = document.getElementById('unit-input');
    const wordInput = document.getElementById('word-input');
    const pinyinInput = document.getElementById('pinyin-input');
    
    if (!wordInput.value.trim() || !pinyinInput.value.trim()) {
        alert('Please enter both the Chinese word and pinyin.');
        return;
    }
    
    const word = {
        chinese: wordInput.value.trim(),
        pinyin: pinyinInput.value.trim(),
        chapter: chapterInput.value.trim() || 'Uncategorized',
        unit: unitInput.value.trim() || 'Uncategorized',
        dateAdded: new Date().toISOString()
    };
    
    const transaction = db.transaction(['words'], 'readwrite');
    const store = transaction.objectStore('words');
    const request = store.add(word);
    
    request.onsuccess = () => {
        wordInput.value = '';
        pinyinInput.value = '';
        loadWordList();
        updateFilters();
    };
    
    request.onerror = (event) => {
        console.error('Error adding word:', event.target.error);
    };
}

function bulkAddWords() {
    const bulkText = document.getElementById('bulk-words').value.trim();
    const chapter = document.getElementById('bulk-chapter').value.trim() || 'Uncategorized';
    const unit = document.getElementById('bulk-unit').value.trim() || 'Uncategorized';
    
    if (!bulkText) {
        alert('Please enter words to add.');
        return;
    }
    
    const lines = bulkText.split('\n');
    const transaction = db.transaction(['words'], 'readwrite');
    const store = transaction.objectStore('words');
    
    lines.forEach(line => {
        const parts = line.split('|');
        if (parts.length === 2) {
            const word = {
                chinese: parts[0].trim(),
                pinyin: parts[1].trim(),
                chapter,
                unit,
                dateAdded: new Date().toISOString()
            };
            store.add(word);
        }
    });
    
    transaction.oncomplete = () => {
        document.getElementById('bulk-words').value = '';
        loadWordList();
        updateFilters();
    };
    
    transaction.onerror = (event) => {
        console.error('Error with bulk add:', event.target.error);
    };
}

function loadWordList() {
    const transaction = db.transaction(['words'], 'readonly');
    const store = transaction.objectStore('words');
    const request = store.getAll();
    
    request.onsuccess = (event) => {
        currentWords = event.target.result;
        displayWords(currentWords);
    };
    
    request.onerror = (event) => {
        console.error('Error loading words:', event.target.error);
    };
}

function displayWords(words) {
    const wordList = document.getElementById('word-list');
    wordList.innerHTML = '';
    
    const chapterFilter = document.getElementById('chapter-filter').value;
    const unitFilter = document.getElementById('unit-filter').value;
    
    const filteredWords = words.filter(word => {
        return (chapterFilter === 'all' || word.chapter === chapterFilter) && 
               (unitFilter === 'all' || word.unit === unitFilter);
    });
    
    if (filteredWords.length === 0) {
        wordList.innerHTML = '<p>No words found. Add some words to get started!</p>';
        return;
    }
    
    filteredWords.forEach(word => {
        const wordCard = document.createElement('div');
        wordCard.className = 'word-card';
        wordCard.innerHTML = `
            <div class="hanzi">${word.chinese}</div>
            <div class="pinyin">${word.pinyin}</div>
            <div class="meta">${word.chapter} - ${word.unit}</div>
            <button class="remove-btn" data-id="${word.id}">×</button>
        `;
        
        const removeBtn = wordCard.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => removeWord(word.id));
        
        wordList.appendChild(wordCard);
    });
}

function removeWord(id) {
    if (confirm('Are you sure you want to delete this word?')) {
        const transaction = db.transaction(['words'], 'readwrite');
        const store = transaction.objectStore('words');
        const request = store.delete(id);
        
        request.onsuccess = () => {
            loadWordList();
        };
        
        request.onerror = (event) => {
            console.error('Error removing word:', event.target.error);
        };
    }
}

function updateFilters() {
    const transaction = db.transaction(['words'], 'readonly');
    const store = transaction.objectStore('words');
    const request = store.getAll();
    
    request.onsuccess = (event) => {
        const words = event.target.result;
        const chapters = [...new Set(words.map(word => word.chapter))];
        const units = [...new Set(words.map(word => word.unit))];
        
        const chapterFilter = document.getElementById('chapter-filter');
        const unitFilter = document.getElementById('unit-filter');
        
        chapterFilter.innerHTML = '<option value="all">All Chapters</option>';
        unitFilter.innerHTML = '<option value="all">All Units</option>';
        
        chapters.forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter;
            option.textContent = chapter;
            chapterFilter.appendChild(option);
        });
        
        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit;
            unitFilter.appendChild(option);
        });
    };
}

function filterWords() {
    displayWords(currentWords);
}
function startStudySession() {
  const chapterFilter = document.getElementById('chapter-filter').value;
  const unitFilter = document.getElementById('unit-filter').value;
  
  const wordsToStudy = currentWords.filter(word => {
    return (chapterFilter === 'all' || word.chapter === chapterFilter) && 
           (unitFilter === 'all' || word.unit === unitFilter);
  });
  
  if (wordsToStudy.length === 0) {
    alert('No words available to study. Please add some words first.');
    return;
  }
  
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('study-mode').classList.remove('hidden');
  
  correctCount = 0;
  incorrectCount = 0;
  document.getElementById('correct-count').textContent = correctCount;
  document.getElementById('incorrect-count').textContent = incorrectCount;
  
  const uniqueWordsMap = new Map();
  wordsToStudy.forEach(word => {
    if (!uniqueWordsMap.has(word.id)) {
      uniqueWordsMap.set(word.id, word);
    }
  });
  
  studyQueue = Array.from(uniqueWordsMap.values());
  wordRepeatTracker = {};
  
  studyQueue.forEach(word => {
    wordRepeatTracker[word.id] = {
      correctStreak: 0,
      totalAttempts: 0,
      attemptHistory: []
    };
  });
  
  shuffleArray(studyQueue);
  currentWordIndex = 0;
  showCurrentWord();
}

function showCurrentWord() {
  const word = studyQueue[currentWordIndex];
  document.getElementById('pinyin-display').textContent = word.pinyin;
  document.getElementById('word-result').textContent = '';
  document.getElementById('word-result').classList.add('hidden');
  document.getElementById('check-word').classList.remove('hidden');
  document.getElementById('marking-buttons').classList.add('hidden');
  document.getElementById('next-word').classList.add('hidden');
  
  renderAttemptHistory(word.id);
  
  const progressPercent = (currentWordIndex / studyQueue.length) * 100;
  document.getElementById('progress-fill').style.width = `${progressPercent}%`;
}

function checkWord() {
    const word = studyQueue[currentWordIndex];
    document.getElementById('word-result').textContent = word.chinese;
    document.getElementById('word-result').classList.remove('hidden');
    document.getElementById('check-word').classList.add('hidden');
    document.getElementById('marking-buttons').classList.remove('hidden');
    document.getElementById('next-word').classList.add('hidden');
}

function markWord(isCorrect) {
  const word = studyQueue[currentWordIndex];
  wordRepeatTracker[word.id].totalAttempts++;
  wordRepeatTracker[word.id].attemptHistory.push(isCorrect);
  
  renderAttemptHistory(word.id); 
  
  if (isCorrect) {
    correctCount++;
    document.getElementById('correct-count').textContent = correctCount;
    wordRepeatTracker[word.id].correctStreak++;
  } else {
    incorrectCount++;
    document.getElementById('incorrect-count').textContent = incorrectCount;
    wordRepeatTracker[word.id].correctStreak = 0;
    
    if (wordRepeatTracker[word.id].correctStreak < 3) {
      const existsInQueue = studyQueue.slice(currentWordIndex + 1).some(queueWord => queueWord.id === word.id);
      
      if (!existsInQueue) {
        const wordCopy = { ...word };
        studyQueue.push(wordCopy);
      }
    }
  }
  
  document.getElementById('marking-buttons').classList.add('hidden');
  document.getElementById('next-word').classList.remove('hidden');
}
function nextWord() {
  currentWordIndex++;
  
  if (currentWordIndex >= studyQueue.length) {
    const remainingWords = studyQueue.filter(word => 
      wordRepeatTracker[word.id].correctStreak < 3);
    
    const uniqueRemainingMap = new Map();
    remainingWords.forEach(word => {
      if (!uniqueRemainingMap.has(word.id)) {
        uniqueRemainingMap.set(word.id, word);
      }
    });
    
    const uniqueRemaining = Array.from(uniqueRemainingMap.values());
    
    if (uniqueRemaining.length > 0) {
      alert('Round complete! Starting next round with words that need more practice.');
      studyQueue = uniqueRemaining;
      shuffleArray(studyQueue);
      currentWordIndex = 0;
    } else {
      alert('Congratulations! You have completed the study session.');
      exitStudySession();
      return;
    }
  }
  
  showCurrentWord();
}

function exitStudySession() {
    document.getElementById('study-mode').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
  
  function renderAttemptHistory(wordId) {
  const history = wordRepeatTracker[wordId].attemptHistory;
  const historyContainer = document.getElementById('attempt-history');
  historyContainer.innerHTML = '';
  
  history.forEach(wasCorrect => {
    const circle = document.createElement('span');
    circle.className = `history-circle ${wasCorrect ? 'correct' : 'incorrect'}`;
    historyContainer.appendChild(circle);
  });
  
  if (history.length < 3) {
    const currentCircle = document.createElement('span');
    currentCircle.className = 'history-circle pending';
    historyContainer.appendChild(currentCircle);
  }
}
