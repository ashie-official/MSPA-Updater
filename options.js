const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// State Management
const STATE = {
  settings: {
    dateFormat: 'default',
    unreleasedBehavior: 'blur',
    passwordBehavior: 'hide'
  },
  homestuck: {
    startDate: null,
    customSchedule: false
  },
  problemSleuth: {
    startDate: null,
    customSchedule: false
  }
};

// Helper: Format Dates dynamically without timezone shift issues
function formatDate(dateString, format) {
  if (!dateString) return 'Not Started';
  
  // Split the YYYY-MM-DD string directly to avoid UTC timezone-shift bugs
  const parts = dateString.split('-');
  if (parts.length !== 3) return 'Not Started';
  
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1; // 0-indexed
  const day = parseInt(parts[2], 10);
  
  const date = new Date(year, monthIdx, day);
  if (isNaN(date.getTime())) return 'Not Started';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = date.getDate();
  const m = date.getMonth();
  const y = date.getFullYear().toString().slice(-2);
  const fullY = date.getFullYear();

  if (format === 'us-long') {
    return `${months[m]} ${d}, ${fullY}`;
  } else if (format === 'uk-long') {
    return `${d} ${months[m]}, ${fullY}`;
  } else {
    // Default: 4/13/09
    return `${m + 1}/${d}/${y}`;
  }
}

// Update UI display elements to match the current state
function updateUI() {
  const format = STATE.settings.dateFormat;
  console.log("Updating UI with State:", STATE);

  // --- HOMESTUCK ---
  const hsDateBubble = document.getElementById('hsDateBubble');
  const hsDateBtn = document.getElementById('hsDateBtn');
  if (STATE.homestuck.startDate) {
    hsDateBubble.textContent = `Started ${formatDate(STATE.homestuck.startDate, format)}`;
    hsDateBubble.className = 'status-bubble bubble-started m-auto';
    hsDateBtn.textContent = 'Delete Game Data';
    hsDateBtn.className = 'btn btn-danger btn-sm mt-2'; 
  } else {
    hsDateBubble.textContent = 'Not Started';
    hsDateBubble.className = 'status-bubble bubble-not-started m-auto';
    hsDateBtn.textContent = 'Enter Start Date';
    hsDateBtn.className = 'btn btn-outline-dark btn-sm mt-2'; 
  }

  const hsSchedBubble = document.getElementById('hsSchedBubble');
  const hsSchedBtn = document.getElementById('hsSchedBtn');
  if (STATE.homestuck.customSchedule) {
    hsSchedBubble.textContent = 'Using Custom Schedule';
    hsSchedBubble.className = 'status-bubble bubble-custom-sched m-auto';
    hsSchedBtn.textContent = 'Reset to Default';
    hsSchedBtn.className = 'btn btn-danger btn-sm mt-2'; 
  } else {
    hsSchedBubble.textContent = 'Using Default Schedule';
    hsSchedBubble.className = 'status-bubble bubble-default-sched m-auto';
    hsSchedBtn.textContent = 'Upload Custom (.json)';
    hsSchedBtn.className = 'btn btn-outline-dark btn-sm mt-2';
  }

  // --- PROBLEM SLEUTH ---
  const psDateBubble = document.getElementById('psDateBubble');
  const psDateBtn = document.getElementById('psDateBtn');
  if (STATE.problemSleuth.startDate) {
    psDateBubble.textContent = `Started ${formatDate(STATE.problemSleuth.startDate, format)}`;
    psDateBubble.className = 'status-bubble bubble-started m-auto';
    psDateBtn.textContent = 'Delete Game Data';
    psDateBtn.className = 'btn btn-danger btn-sm mt-2';
  } else {
    psDateBubble.textContent = 'Not Started';
    psDateBubble.className = 'status-bubble bubble-not-started m-auto';
    psDateBtn.textContent = 'Enter Start Date';
    psDateBtn.className = 'btn btn-outline-dark btn-sm mt-2';
  }

  const psSchedBubble = document.getElementById('psSchedBubble');
  const psSchedBtn = document.getElementById('psSchedBtn');
  if (STATE.problemSleuth.customSchedule) {
    psSchedBubble.textContent = 'Using Custom Schedule';
    psSchedBubble.className = 'status-bubble bubble-custom-sched m-auto';
    psSchedBtn.textContent = 'Reset to Default';
    psSchedBtn.className = 'btn btn-danger btn-sm mt-2';
  } else {
    psSchedBubble.textContent = 'Using Default Schedule';
    psSchedBubble.className = 'status-bubble bubble-default-sched m-auto';
    psSchedBtn.textContent = 'Upload Custom (.json)';
    psSchedBtn.className = 'btn btn-outline-dark btn-sm mt-2';
  }
}

// Robust Save Function
function saveToStorage() {
  if (typeof browserAPI !== 'undefined' && browserAPI.storage && browserAPI.storage.sync) {
    browserAPI.storage.sync.set({ mspaState: STATE }, () => {
      console.log('Saved to Sync Storage.');
    });
  } else {
    localStorage.setItem('mspaState', JSON.stringify(STATE));
    console.log('Saved to LocalStorage (Fallback).');
  }
}

// Robust Load Function with fallback execution
function loadFromStorage() {
  if (typeof browserAPI !== 'undefined' && browserAPI.storage && browserAPI.storage.sync) {
    browserAPI.storage.sync.get(['mspaState'], (result) => {
      if (result && result.mspaState) {
        Object.assign(STATE, result.mspaState);
        syncDropdowns();
      }
      updateUI();
    });
  } else {
    const saved = localStorage.getItem('mspaState');
    if (saved) {
      Object.assign(STATE, JSON.parse(saved));
      syncDropdowns();
    }
    updateUI();
  }
}

function syncDropdowns() {
  document.getElementById('dateFormat').value = STATE.settings.dateFormat;
  document.getElementById('unreleasedBehavior').value = STATE.settings.unreleasedBehavior;
  document.getElementById('passwordBehavior').value = STATE.settings.passwordBehavior;
}

// Event Listeners for global Dropdowns
document.getElementById('dateFormat').addEventListener('change', (e) => {
  STATE.settings.dateFormat = e.target.value;
  saveToStorage();
  updateUI();
});

document.getElementById('unreleasedBehavior').addEventListener('change', (e) => {
  STATE.settings.unreleasedBehavior = e.target.value;
  saveToStorage();
});

document.getElementById('passwordBehavior').addEventListener('change', (e) => {
  STATE.settings.passwordBehavior = e.target.value;
  saveToStorage();
});

// Controls binding (attached directly on execution)
function setupComicControls(prefix, comicKey) {
  const dateBtn = document.getElementById(`${prefix}DateBtn`);
  const dateInput = document.getElementById(`${prefix}DateInput`);
  const schedBtn = document.getElementById(`${prefix}SchedBtn`);
  const schedInput = document.getElementById(`${prefix}SchedInput`);

  // --- Date Handling ---
  const handleDateChange = (e) => {
    if (e.target.value) {
      console.log(`${prefix} date changed to:`, e.target.value);
      STATE[comicKey].startDate = e.target.value; 
      saveToStorage();
      updateUI();
    }
  };

  dateBtn.addEventListener('click', () => {
    if (STATE[comicKey].startDate) {
      STATE[comicKey].startDate = null;
      dateInput.value = ''; 
      saveToStorage();
      updateUI();
    } else {
      dateInput.showPicker(); 
    }
  });

  dateInput.addEventListener('change', handleDateChange);

  // --- Schedule Upload Handling ---
  schedBtn.addEventListener('click', () => {
    if (STATE[comicKey].customSchedule) {
      // If we are currently using a custom schedule, reset it back to default
      STATE[comicKey].customSchedule = false;
      schedInput.value = ''; // Clear out any selected file
      saveToStorage();
      updateUI();
    } else {
      // Otherwise, trigger the file selection dialog
      schedInput.click();
    }
  });

  schedInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = function(event) {
        try {
          // Parse file to ensure it's valid JSON before updating our state
          JSON.parse(event.target.result);
          STATE[comicKey].customSchedule = true;
          saveToStorage();
          updateUI();
        } catch (err) {
          alert("Error: File is not a valid JSON schedule format!");
        }
      };
      
      reader.readAsText(file);
    }
  });
}

function updateUnreleasedPreview() {
    const select = document.getElementById('unreleasedBehavior');
    const link = document.getElementById('previewLink');
    if (!select || !link) return;

    // Reset existing preview display classes on the link
    link.className = 'preview-link';

    if (select.value === 'blur') {
        link.classList.add('preview-blur');
    } else if (select.value === 'hide') {
        link.classList.add('preview-hide');
    }
}

// Bind both columns to our state transitions using keys instead of direct references
setupComicControls('hs', 'homestuck');
setupComicControls('ps', 'problemSleuth');

// Boot Up
document.addEventListener('DOMContentLoaded', loadFromStorage);

document.getElementById('unreleasedBehavior').addEventListener('change', updateUnreleasedPreview);

// Run once on boot-up inside your load storage handler
// (Add this call at the very end of your DOMContentLoaded / loadFromStorage sequence)
updateUnreleasedPreview();

// --- Example of what your initialization block should look like ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Your existing code that retrieves settings from storage...
    chrome.storage.sync.get(['unreleasedBehavior', 'dateFormat', 'passwordBehavior'], (items) => {
        
        // 2. Your existing code that sets the dropdown values...
        if (items.unreleasedBehavior) {
            document.getElementById('unreleasedBehavior').value = items.unreleasedBehavior;
        }
        
        // ... (other dropdown populations) ...

        // 3. ADD THIS LINE HERE:
        // This ensures the preview style is instantly calculated on load!
        updateUnreleasedPreview();
    });
});