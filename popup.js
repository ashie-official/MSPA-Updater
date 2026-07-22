// ==========================================================================
// 1. Storage API & State Management
// ==========================================================================
function getExtensionStorage() {
  if (typeof browser !== 'undefined' && browser.storage) {
    return browser.storage.local;
  }
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return chrome.storage.local;
  }
  return null;
}

const STATE = {
  settings: {
    dateFormat: 'default',
    unreleasedBehavior: 'blur',
    passwordBehavior: 'hide'
  },
  homestuck: {
    startDate: null,
    customSchedule: false,
    fileName: null,
    scheduleData: null
  },
  problemSleuth: {
    startDate: null,
    customSchedule: false,
    fileName: null,
    scheduleData: null
  }
};

function saveToStorage() {
  const storage = getExtensionStorage();
  if (storage) {
    storage.set({ mspaState: STATE });
  } else {
    localStorage.setItem('mspaState', JSON.stringify(STATE));
  }
}

// ==========================================================================
// 2. Helper Functions
// ==========================================================================
function formatDate(dateString, format) {
  if (!dateString) return 'Not Started';
  
  const parts = dateString.split('-');
  if (parts.length !== 3) return 'Not Started';
  
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const date = new Date(year, monthIdx, day);
  if (isNaN(date.getTime())) return 'Not Started';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = date.getDate();
  const m = date.getMonth();
  const y = date.getFullYear().toString().slice(-2);
  const fullY = date.getFullYear();

  switch (format) {
    case 'us-long': return `${months[m]} ${d}, ${fullY}`;
    case 'uk-long': return `${d} ${months[m]}, ${fullY}`;
    default:        return `${m + 1}/${d}/${y}`;
  }
}

// ==========================================================================
// 3. UI Syncing Engine
// ==========================================================================
// Dynamic font resizing helper to prevent text wrapping inside fixed-width bubbles
function adjustBubbleFontSize(bubbleEl, text) {
  bubbleEl.textContent = text;
  
  // Start at standard font size (0.8rem matches options menu)
  let fontSize = 0.8;
  bubbleEl.style.fontSize = `${fontSize}rem`;

  // Scale down font size incrementally if scroll width exceeds client width
  while (bubbleEl.scrollWidth > bubbleEl.clientWidth && fontSize > 0.5) {
    fontSize -= 0.03;
    bubbleEl.style.fontSize = `${fontSize}rem`;
  }
}

function updateMiniView(state) {
  const comics = [
    { prefix: 'hs', key: 'homestuck' },
    { prefix: 'ps', key: 'problemSleuth' }
  ];

  comics.forEach(({ prefix, key }) => {
    const comicState = state[key] || {};
    const dateBubble = document.getElementById(`${prefix}DateBubble`);
    const schedBubble = document.getElementById(`${prefix}SchedBubble`);

    // 1. Sync Date Status & Scale Font
    if (dateBubble) {
      const dateText = comicState.startDate 
        ? `Started ${formatDate(comicState.startDate, state.settings?.dateFormat)}` 
        : 'Not Started';

      dateBubble.className = comicState.startDate 
        ? 'status-bubble bubble-started' 
        : 'status-bubble bubble-not-started';

      adjustBubbleFontSize(dateBubble, dateText);
    }

    // 2. Sync Schedule Status & Scale Font
    if (schedBubble) {
      let schedText = 'Using Default Schedule';
      if (comicState.customSchedule) {
        const rawName = comicState.fileName || 'Custom';
        const cleanName = rawName.replace(/\.json$/i, '');
        schedText = `Using ${cleanName}`;
        schedBubble.className = 'status-bubble bubble-custom-sched';
      } else {
        schedBubble.className = 'status-bubble bubble-default-sched';
      }

      adjustBubbleFontSize(schedBubble, schedText);
    }
  });

  // Re-run unreleased preview update whenever view updates
  updateUnreleasedPreview();
}

// Reused exact logic from options.js for unreleased updates behavior preview
function updateUnreleasedPreview() {
  const select = document.getElementById('unreleasedBehavior');
  const link = document.getElementById('previewLink');
  if (!select || !link) return;

  link.className = 'preview-link';
  if (select.value === 'blur') link.classList.add('preview-blur');
  else if (select.value === 'hide') link.classList.add('preview-hide');
}

function syncDropdowns() {
  const ub = document.getElementById('unreleasedBehavior');
  if (ub && STATE.settings.unreleasedBehavior) {
    ub.value = STATE.settings.unreleasedBehavior;
  }

  const pb = document.getElementById('passwordBehavior');
  if (pb && STATE.settings.passwordBehavior) {
    pb.value = STATE.settings.passwordBehavior;
  }
}

// ==========================================================================
// 4. Data Loader
// ==========================================================================
function loadSettingsAndRender() {
  const storage = getExtensionStorage();

  if (storage) {
    const keys = ['mspaState', 'hsCustomSchedule', 'psCustomSchedule'];
    
    // Support Firefox (Promises) and Chrome (Callbacks)
    if (typeof browser !== 'undefined' && browser.storage) {
      storage.get(keys).then(processStorage);
    } else {
      storage.get(keys, processStorage);
    }
  } else {
    // LocalStorage Fallback
    const saved = localStorage.getItem('mspaState');
    if (saved) {
      Object.assign(STATE, JSON.parse(saved));
      syncDropdowns();
    }
    updateMiniView(STATE);
  }
}

function processStorage(result) {
  if (result && result.mspaState) {
    Object.assign(STATE, result.mspaState);
    syncDropdowns();
  }

  if (result && result.hsCustomSchedule) {
    STATE.homestuck.customSchedule = true;
  }
  if (result && result.psCustomSchedule) {
    STATE.problemSleuth.customSchedule = true;
  }

  updateMiniView(STATE);
}

// ==========================================================================
// 5. Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Load state and populate popup UI
  loadSettingsAndRender();

  // Bind unreleased updates dropdown if present
  const unreleasedEl = document.getElementById('unreleasedBehavior');
  if (unreleasedEl) {
    unreleasedEl.addEventListener('change', (e) => {
      STATE.settings.unreleasedBehavior = e.target.value;
      saveToStorage();
      updateUnreleasedPreview();
    });
  }

  // Bind password prompts dropdown
  const passwordEl = document.getElementById('passwordBehavior');
  if (passwordEl) {
    passwordEl.addEventListener('change', (e) => {
      STATE.settings.passwordBehavior = e.target.value;
      saveToStorage();
    });
  }

  // Safely prevent preview link click navigation if present
  const previewLink = document.getElementById('previewLink');
  if (previewLink) {
    previewLink.addEventListener('click', (e) => e.preventDefault());
  }

  // Bind Open Settings Button
  const openBtn = document.getElementById('openOptionsBtn');
  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.openOptionsPage) {
        browser.runtime.openOptionsPage();
      } else {
        window.open('options.html');
      }
    });
  }
});