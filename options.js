// ==========================================================================
// 0. Cross-Browser API Initialization
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

const extensionStorage = getExtensionStorage();

// State Management Container
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

// ==========================================================================
// 1. Helper Functions & UI Formatters
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

function adjustBubbleFontSize(bubbleEl, text) {
  bubbleEl.textContent = text;
  
  let fontSize = 1.25;
  bubbleEl.style.fontSize = `${fontSize}rem`;

  while (bubbleEl.scrollWidth > bubbleEl.clientWidth && fontSize > 0.75) {
    fontSize -= 0.05;
    bubbleEl.style.fontSize = `${fontSize}rem`;
  }
}

function updateUI() {
  const format = STATE.settings.dateFormat;

  const comics = [
    { prefix: 'hs', key: 'homestuck' },
    { prefix: 'ps', key: 'problemSleuth' }
  ];

  comics.forEach(({ prefix, key }) => {
    const comicState = STATE[key];
    const dateBubble = document.getElementById(`${prefix}DateBubble`);
    const dateBtn = document.getElementById(`${prefix}DateBtn`);
    const dateControls = document.getElementById(`${prefix}DateControls`);
    const schedBubble = document.getElementById(`${prefix}SchedBubble`);
    const schedBtn = document.getElementById(`${prefix}SchedBtn`);

    if (comicState.startDate && dateBubble) {
      dateBubble.textContent = `Started ${formatDate(comicState.startDate, format)}`;
      dateBubble.className = 'status-bubble bubble-started m-auto';
      
      if (dateControls) dateControls.classList.add('d-none-important');
      if (dateBtn) dateBtn.style.display = 'inline-block';
    } else if (dateBubble) {
      dateBubble.textContent = 'Not Started';
      dateBubble.className = 'status-bubble bubble-not-started m-auto';
      
      if (dateControls) dateControls.classList.remove('d-none-important');
      if (dateBtn) dateBtn.style.display = 'none';

      const monthEl = document.getElementById(`${prefix}Month`);
      const dayEl = document.getElementById(`${prefix}Day`);
      const yearEl = document.getElementById(`${prefix}Year`);

      if (monthEl) monthEl.value = '';
      if (dayEl) dayEl.value = '';
      if (yearEl) yearEl.value = '';
    }

    if (schedBubble && schedBtn) {
      if (comicState.customSchedule) {
        const rawName = comicState.fileName || 'Custom';
        const cleanName = rawName.replace(/\.json$/i, '');
        const labelText = `Using ${cleanName}`;

        schedBubble.className = 'status-bubble bubble-custom-sched m-auto';
        adjustBubbleFontSize(schedBubble, labelText);

        schedBtn.textContent = 'Reset to Default';
        schedBtn.className = 'btn btn-danger btn-sm mt-2';
      } else {
        schedBubble.className = 'status-bubble bubble-default-sched m-auto';
        adjustBubbleFontSize(schedBubble, 'Using Default Schedule');

        schedBtn.textContent = 'Upload Custom (.json)';
        schedBtn.className = 'btn btn-outline-dark btn-sm mt-2';
      }
    }
  });

  updateDropdownOrder();
  updateUnreleasedPreview();
}

function updateUnreleasedPreview() {
  const select = document.getElementById('unreleasedBehavior');
  const link = document.getElementById('previewLink');
  if (!select || !link) return;

  link.className = 'preview-link';
  if (select.value === 'blur') link.classList.add('preview-blur');
  else if (select.value === 'hide') link.classList.add('preview-hide');
}

function syncDropdowns() {
  const df = document.getElementById('dateFormat');
  const ub = document.getElementById('unreleasedBehavior');
  const pb = document.getElementById('passwordBehavior');

  if (df) df.value = STATE.settings.dateFormat;
  if (ub) ub.value = STATE.settings.unreleasedBehavior;
  if (pb) pb.value = STATE.settings.passwordBehavior;
}

function updateDropdownOrder() {
  const isUK = STATE.settings.dateFormat === 'uk-long';
  const prefixes = ['hs', 'ps'];

  prefixes.forEach((prefix) => {
    const container = document.getElementById(`${prefix}DateControls`);
    const month = document.getElementById(`${prefix}Month`);
    const day = document.getElementById(`${prefix}Day`);
    const year = document.getElementById(`${prefix}Year`);

    if (!container || !month || !day || !year) return;

    if (isUK) {
      container.appendChild(day);
      container.appendChild(month);
      container.appendChild(year);
    } else {
      container.appendChild(month);
      container.appendChild(day);
      container.appendChild(year);
    }
  });
}

function populateDateDropdowns(prefix) {
  const daySelect = document.getElementById(`${prefix}Day`);
  const yearSelect = document.getElementById(`${prefix}Year`);
  if (!daySelect || !yearSelect) return;

  daySelect.innerHTML = '<option value="">Day</option>';
  yearSelect.innerHTML = '<option value="">Year</option>';

  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    daySelect.appendChild(opt);
  }

  const currentYear = new Date().getFullYear();
  for (let y = 2008; y <= currentYear + 2; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  }
}

// ==========================================================================
// 2. Storage Drivers
// ==========================================================================

function saveToStorage() {
  const storage = getExtensionStorage();
  if (storage) {
    storage.set({ mspaState: STATE });
  } else {
    localStorage.setItem('mspaState', JSON.stringify(STATE));
  }
}

function loadFromStorage() {
  const storage = getExtensionStorage();
  if (storage) {
    if (typeof browser !== 'undefined' && browser.storage) {
      storage.get(['mspaState', 'hsCustomSchedule', 'psCustomSchedule']).then(processStorageData);
    } else {
      storage.get(['mspaState', 'hsCustomSchedule', 'psCustomSchedule'], processStorageData);
    }
  } else {
    const saved = localStorage.getItem('mspaState');
    if (saved) {
      Object.assign(STATE, JSON.parse(saved));
      syncDropdowns();
    }
    updateUI();
  }
}

function processStorageData(result) {
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

  updateUI();
}

// ==========================================================================
// 3. Dynamic Schedule Downloader Module
// ==========================================================================

function triggerFileDownload(filename, contentString) {
  const blob = new Blob([contentString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchDefaultSchedule(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.text();
  } catch (err) {
    console.error(`Failed to fetch default schedule at ${path}:`, err);
    return null;
  }
}

async function downloadActiveSchedules() {
  const downloadTasks = [
    {
      key: 'homestuck',
      defaultPath: 'schedules/homestuck-default.json',
      fallbackName: 'homestuck-custom.json'
    },
    {
      key: 'problemSleuth',
      defaultPath: 'schedules/problemsleuth-default.json',
      fallbackName: 'problemsleuth-custom.json'
    }
  ];

  for (const task of downloadTasks) {
    const comicState = STATE[task.key];

    if (comicState.customSchedule && comicState.scheduleData) {
      // Download Custom Schedule from state memory
      const jsonStr = JSON.stringify(comicState.scheduleData, null, 2);
      const downloadName = comicState.fileName || task.fallbackName;
      triggerFileDownload(downloadName, jsonStr);
    } else {
      // Download Default Schedule from schedules/ directory
      const defaultContent = await fetchDefaultSchedule(task.defaultPath);
      if (defaultContent) {
        const defaultFilename = task.defaultPath.split('/').pop();
        triggerFileDownload(defaultFilename, defaultContent);
      }
    }
  }
}

// ==========================================================================
// 4. Schedule Validation Logic
// ==========================================================================

function validateScheduleSchema(json) {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { valid: false, error: "Root element must be a JSON object." };
  }

  if (!Number.isInteger(json.schedule_version) || json.schedule_version < 1) {
    return { valid: false, error: "'schedule_version' must be a positive integer." };
  }

  let minPage, maxPage;
  if (json.story === "homestuck") {
    minPage = 1901;
    maxPage = 10030;
  } else if (json.story === "problemsleuth") {
    minPage = 219;
    maxPage = 1892;
  } else {
    return { valid: false, error: "'story' must be 'homestuck' or 'problemsleuth'." };
  }

  if (!Array.isArray(json.data) || json.data.length === 0) {
    return { valid: false, error: "'data' must be a non-empty array." };
  }

  let lastDays = -1;

  for (let i = 0; i < json.data.length; i++) {
    const entry = json.data[i];

    if (!Array.isArray(entry) || entry.length !== 2) {
      return { valid: false, error: `Index ${i}: Entry must be an array pair [DAYS_ELAPSED, FINAL_PAGE].` };
    }

    const [days, page] = entry;

    if (!Number.isInteger(days) || days < 0) {
      return { valid: false, error: `Index ${i}: DAYS_ELAPSED must be a non-negative integer.` };
    }

    if (days <= lastDays) {
      return { valid: false, error: `Index ${i}: DAYS_ELAPSED (${days}) must be greater than previous (${lastDays}).` };
    }
    lastDays = days;

    if (!Number.isInteger(page) || page < minPage || page > maxPage) {
      return { valid: false, error: `Index ${i}: FINAL_PAGE (${page}) out of range (${minPage}-${maxPage}) for ${json.story}.` };
    }
  }

  return { valid: true };
}

// ==========================================================================
// 5. Control Bindings & Event Handlers
// ==========================================================================

function setupComicControls(prefix, comicKey) {
  populateDateDropdowns(prefix);

  const monthSel = document.getElementById(`${prefix}Month`);
  const daySel = document.getElementById(`${prefix}Day`);
  const yearSel = document.getElementById(`${prefix}Year`);
  const dateBtn = document.getElementById(`${prefix}DateBtn`);

  const checkAndSaveDate = () => {
    if (!monthSel || !daySel || !yearSel) return;
    const m = monthSel.value;
    const d = daySel.value;
    const y = yearSel.value;

    if (m && d && y) {
      const formattedMonth = m.padStart(2, '0');
      const formattedDay = d.padStart(2, '0');
      STATE[comicKey].startDate = `${y}-${formattedMonth}-${formattedDay}`;
      saveToStorage();
      updateUI();
    }
  };

  if (monthSel) monthSel.addEventListener('change', checkAndSaveDate);
  if (daySel) daySel.addEventListener('change', checkAndSaveDate);
  if (yearSel) yearSel.addEventListener('change', checkAndSaveDate);

  if (dateBtn) {
    dateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      STATE[comicKey].startDate = null;
      saveToStorage();
      updateUI();
    });
  }
}

function setupScheduleUploader(config) {
  const schedBtn = document.getElementById(config.btnId);
  const schedInput = document.getElementById(config.inputId);
  const schedMsg = document.getElementById(config.msgId);

  if (!schedBtn || !schedInput) return;

  schedBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    if (STATE[config.comicKey].customSchedule) {
      STATE[config.comicKey].customSchedule = false;
      STATE[config.comicKey].fileName = null;
      STATE[config.comicKey].scheduleData = null;
      schedInput.value = '';
      
      const storage = getExtensionStorage();
      if (storage) {
        storage.remove([config.storageKey]);
      }
      if (schedMsg) schedMsg.textContent = '';
      
      saveToStorage();
      updateUI();
    } else {
      schedInput.click();
    }
  });

  schedInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async function (e) {
      try {
        const json = JSON.parse(e.target.result);

        const validation = validateScheduleSchema(json);
        if (!validation.valid) {
          showError(validation.error);
          return;
        }

        if (json.story !== config.expectedStory) {
          showError(`Expected '${config.expectedStory}', but file is for '${json.story}'.`);
          return;
        }

        STATE[config.comicKey].customSchedule = true;
        STATE[config.comicKey].fileName = file.name;
        STATE[config.comicKey].scheduleData = json;

        const storage = getExtensionStorage();
        if (storage) {
          await storage.set({ 
            [config.storageKey]: json,
            mspaState: STATE 
          });
        } else {
          saveToStorage();
        }

        if (schedMsg) {
          schedMsg.textContent = `Loaded: ${file.name}`;
          schedMsg.className = "text-success mt-1";
        }
        updateUI();

      } catch (err) {
        showError("Invalid JSON syntax.");
      }
    };

    reader.onerror = () => showError("Error reading file from disk.");
    reader.readAsText(file);
  });

  function showError(msg) {
    if (schedMsg) {
      schedMsg.textContent = msg;
      schedMsg.className = "text-danger mt-1";
    }
    schedInput.value = "";
  }
}

// ==========================================================================
// 6. Boot Sequence
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  const previewLink = document.getElementById('previewLink');
  if (previewLink) {
    previewLink.addEventListener('click', (e) => e.preventDefault());
  }

  // Bind Download Schedules Link
  const downloadLink = document.getElementById('downloadSchedules');
  if (downloadLink) {
    downloadLink.addEventListener('click', (e) => {
      e.preventDefault();
      downloadActiveSchedules();
    });
  }

  // Bind global option listeners
  const dateFormatEl = document.getElementById('dateFormat');
  const unreleasedEl = document.getElementById('unreleasedBehavior');
  const passwordEl = document.getElementById('passwordBehavior');

  if (dateFormatEl) {
    dateFormatEl.addEventListener('change', (e) => {
      STATE.settings.dateFormat = e.target.value;
      saveToStorage();
      updateUI();
    });
  }

  if (unreleasedEl) {
    unreleasedEl.addEventListener('change', (e) => {
      STATE.settings.unreleasedBehavior = e.target.value;
      saveToStorage();
      updateUnreleasedPreview();
    });
  }

  if (passwordEl) {
    passwordEl.addEventListener('change', (e) => {
      STATE.settings.passwordBehavior = e.target.value;
      saveToStorage();
    });
  }

  // Bind date control fields
  setupComicControls('hs', 'homestuck');
  setupComicControls('ps', 'problemSleuth');

  // Bind schedule uploaders
  setupScheduleUploader({
    btnId: 'hsSchedBtn',
    inputId: 'hsSchedInput',
    bubbleId: 'hsSchedBubble',
    msgId: 'hsSchedMsg',
    expectedStory: 'homestuck',
    comicKey: 'homestuck',
    storageKey: 'hsCustomSchedule'
  });

  setupScheduleUploader({
    btnId: 'psSchedBtn',
    inputId: 'psSchedInput',
    bubbleId: 'psSchedBubble',
    msgId: 'psSchedMsg',
    expectedStory: 'problemsleuth',
    comicKey: 'problemSleuth',
    storageKey: 'psCustomSchedule'
  });

  // Load state and populate UI
  loadFromStorage();
});