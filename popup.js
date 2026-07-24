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

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function calculateNonLeapElapsedDays(startDateStr) {
  if (!startDateStr) return null;
  const parts = startDateStr.split('-');
  if (parts.length !== 3) return null;

  const startYear = parseInt(parts[0], 10);
  const startMonth = parseInt(parts[1], 10) - 1;
  const startDay = parseInt(parts[2], 10);

  let start = new Date(startYear, startMonth, startDay);
  let today = new Date();
  today = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (start > today) return -1;

  let elapsedDays = 0;
  let curr = new Date(start.getTime());

  while (curr < today) {
    curr.setDate(curr.getDate() + 1);
    if (curr.getMonth() === 1 && curr.getDate() === 29 && isLeapYear(curr.getFullYear())) {
      continue;
    }
    elapsedDays++;
  }

  return elapsedDays;
}

function padPageNumber(pageNum) {
  return String(pageNum).padStart(6, '0');
}

function getUpdateFirstPage(scheduleData, daysElapsed, defaultMinPage) {
  if (!scheduleData || !Array.isArray(scheduleData.data) || daysElapsed === null || daysElapsed < 0) {
    return null;
  }

  const data = scheduleData.data;
  let currentTierIndex = -1;

  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    if (Array.isArray(entry) && entry.length === 2) {
      const [reqDays] = entry;
      if (daysElapsed >= reqDays) {
        currentTierIndex = i;
      } else {
        break;
      }
    }
  }

  if (currentTierIndex === -1) return null;

  if (currentTierIndex === 0) {
    return defaultMinPage;
  }

  const previousTierLastPage = data[currentTierIndex - 1][1];
  return previousTierLastPage + 1;
}

async function fetchDefaultSchedule(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error(`Failed to load default schedule at ${path}:`, err);
    return null;
  }
}

// ==========================================================================
// 3. UI Syncing Engine
// ==========================================================================
function adjustBubbleFontSize(bubbleEl, text) {
  bubbleEl.textContent = text;
  
  let fontSize = 0.8;
  bubbleEl.style.fontSize = `${fontSize}rem`;

  while (bubbleEl.scrollWidth > bubbleEl.clientWidth && fontSize > 0.5) {
    fontSize -= 0.03;
    bubbleEl.style.fontSize = `${fontSize}rem`;
  }
}

async function updateMiniView(state) {
  const comics = [
    { 
      prefix: 'hs', 
      key: 'homestuck', 
      titleText: 'Homestuck', 
      baseUrl: 'https://www.homestuck.com/story/',
      minPage: 1901,
      defaultSchedulePath: 'schedules/homestuck-default.json'
    },
    { 
      prefix: 'ps', 
      key: 'problemSleuth', 
      titleText: 'Problem Sleuth', 
      baseUrl: 'https://www.homestuck.com/problemsleuth/',
      minPage: 219,
      defaultSchedulePath: 'schedules/problemsleuth-default.json'
    }
  ];

  for (const { prefix, key, titleText, baseUrl, minPage, defaultSchedulePath } of comics) {
    const comicState = state[key] || {};
    const titleEl = document.getElementById(`${prefix}Title`);
    const dateBubble = document.getElementById(`${prefix}DateBubble`);
    const schedBubble = document.getElementById(`${prefix}SchedBubble`);

    // ----------------------------------------------------------------------
    // 1. Dynamic Title Link Logic
    // ----------------------------------------------------------------------
    if (titleEl) {
      const daysElapsed = calculateNonLeapElapsedDays(comicState.startDate);

      if (comicState.startDate && daysElapsed !== null && daysElapsed >= 0) {
        // Use custom schedule if stored in state, otherwise fetch default schedule JSON
        let schedule = comicState.scheduleData;
        if (!schedule) {
          schedule = await fetchDefaultSchedule(defaultSchedulePath);
        }

        const firstPage = getUpdateFirstPage(schedule, daysElapsed, minPage);

        if (firstPage) {
          const paddedPage = padPageNumber(firstPage);
          const targetUrl = `${baseUrl}${paddedPage}`;
          titleEl.innerHTML = `<a href="${targetUrl}" target="_blank" class="comic-title-link">${titleText}</a>`;
        } else {
          titleEl.textContent = titleText;
        }
      } else {
        titleEl.textContent = titleText;
      }
    }

    // ----------------------------------------------------------------------
    // 2. Sync Date Status & Scale Font
    // ----------------------------------------------------------------------
    if (dateBubble) {
      const dateText = comicState.startDate 
        ? `Started ${formatDate(comicState.startDate, state.settings?.dateFormat)}` 
        : 'Not Started';

      dateBubble.className = comicState.startDate 
        ? 'status-bubble bubble-started' 
        : 'status-bubble bubble-not-started';

      adjustBubbleFontSize(dateBubble, dateText);
    }

    // ----------------------------------------------------------------------
    // 3. Sync Schedule Status & Scale Font
    // ----------------------------------------------------------------------
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
  }

  updateUnreleasedPreview();
}

function updateUnreleasedPreview() {
  const behavior = STATE.settings.unreleasedBehavior || 'blur';
  const promptEl = document.querySelector('.preview-prompt');
  const arrowEl = document.querySelector('.preview-arrow');
  const linkEl = document.getElementById('previewLink');

  if (!promptEl || !arrowEl || !linkEl) return;

  // Reset display and filter
  linkEl.style.display = '';
  linkEl.style.filter = '';

  switch (behavior) {
    case 'blur':
      arrowEl.style.visibility = 'visible';
      linkEl.style.visibility = 'visible';
      linkEl.style.filter = 'blur(5px)';
      linkEl.style.pointerEvents = 'none';
      linkEl.style.userSelect = 'none';
      linkEl.setAttribute('tabindex', '-1');
      break;

    case 'hide':
      arrowEl.style.visibility = 'visible';
      linkEl.style.display = 'none';
      break;

    case 'hide-all':
      // Hides both arrow and link while preserving layout space
      arrowEl.style.visibility = 'hidden';
      linkEl.style.visibility = 'hidden';
      break;

    case 'none':
    default:
      arrowEl.style.visibility = 'visible';
      linkEl.style.visibility = 'visible';
      break;
  }
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
    
    if (typeof browser !== 'undefined' && browser.storage) {
      storage.get(keys).then(processStorage);
    } else {
      storage.get(keys, processStorage);
    }
  } else {
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
    STATE.homestuck.scheduleData = result.hsCustomSchedule;
  }
  if (result && result.psCustomSchedule) {
    STATE.problemSleuth.customSchedule = true;
    STATE.problemSleuth.scheduleData = result.psCustomSchedule;
  }

  updateMiniView(STATE);
}

// ==========================================================================
// 5. Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadSettingsAndRender();

  const unreleasedEl = document.getElementById('unreleasedBehavior');
  if (unreleasedEl) {
    unreleasedEl.addEventListener('change', (e) => {
      STATE.settings.unreleasedBehavior = e.target.value;
      saveToStorage();
      updateUnreleasedPreview();
    });
  }

  const passwordEl = document.getElementById('passwordBehavior');
  if (passwordEl) {
    passwordEl.addEventListener('change', (e) => {
      STATE.settings.passwordBehavior = e.target.value;
      saveToStorage();
    });
  }

  const previewLink = document.getElementById('previewLink');
  if (previewLink) {
    previewLink.addEventListener('click', (e) => e.preventDefault());
  }

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