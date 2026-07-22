// ==========================================================================
// 1. Constants & Target Arrays
// ==========================================================================
const PASSWORD_PAGES = [9058, 9109, 9135, 9150, 9188, 9204, 9222, 9263];

// ==========================================================================
// 2. Storage Helper
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

// ==========================================================================
// 3. Non-Leap Elapsed Days Logic
// ==========================================================================
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

  if (start > today) return -1; // Not started yet

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

// ==========================================================================
// 4. Story Context Detector
// ==========================================================================
function getStoryContext() {
  const url = window.location.href;

  if (url.includes('problemsleuth')) {
    return {
      storyKey: 'problemSleuth',
      defaultSchedulePath: 'schedules/problemsleuth-default.json',
      customStorageKey: 'psCustomSchedule'
    };
  }

  if (url.includes('homestuck.com')) {
    return {
      storyKey: 'homestuck',
      defaultSchedulePath: 'schedules/homestuck-default.json',
      customStorageKey: 'hsCustomSchedule'
    };
  }

  return null;
}

// ==========================================================================
// 5. Schedule Processor
// ==========================================================================
function getMaxAllowedPage(scheduleData, daysElapsed) {
  if (!scheduleData || !Array.isArray(scheduleData.data) || daysElapsed === null) {
    return Infinity; 
  }

  if (daysElapsed < 0) return 0;

  let maxPage = 0;
  for (const entry of scheduleData.data) {
    if (Array.isArray(entry) && entry.length === 2) {
      const [reqDays, finalPage] = entry;
      if (daysElapsed >= reqDays) {
        maxPage = Math.max(maxPage, finalPage);
      }
    }
  }

  return maxPage;
}

async function loadActiveSchedule(ctx, customScheduleData) {
  if (customScheduleData) return customScheduleData;

  try {
    const fileUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) 
      ? chrome.runtime.getURL(ctx.defaultSchedulePath)
      : (typeof browser !== 'undefined' && browser.runtime ? browser.runtime.getURL(ctx.defaultSchedulePath) : ctx.defaultSchedulePath);

    const res = await fetch(fileUrl);
    if (res.ok) return await res.json();
  } catch (err) {
    console.error('MSPA Updater: Schedule load error:', err);
  }

  return null;
}

// ==========================================================================
// 6. DOM Element Locators & Modifiers
// ==========================================================================
function findNextPromptLink() {
  const currentUrl = window.location.href;
  const currentMatch = currentUrl.match(/(\d{4,6})/);
  if (!currentMatch) return null;

  const currentPageNum = parseInt(currentMatch[1], 10);
  const links = document.querySelectorAll('a[href]');

  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const match = href.match(/(\d{4,6})/);
    if (match) {
      const pageNum = parseInt(match[1], 10);
      if (pageNum === currentPageNum + 1) {
        return link;
      }
    }
  }

  return null;
}

function waitForNextPromptLink(maxRetries = 20, delay = 100) {
  return new Promise((resolve) => {
    let attempts = 0;

    const check = () => {
      const link = findNextPromptLink();
      if (link) {
        resolve(link);
      } else if (attempts < maxRetries) {
        attempts++;
        setTimeout(check, delay);
      } else {
        resolve(null);
      }
    };

    check();
  });
}

function applyUnreleasedBehavior(targetLink, behavior) {
  if (!targetLink) return;

  if (behavior === 'blur') {
    targetLink.style.filter = 'blur(6px)';
    targetLink.style.transition = 'filter 0.2s ease';
    targetLink.style.pointerEvents = 'none';
    targetLink.style.userSelect = 'none';
  } else if (behavior === 'hide') {
    targetLink.style.opacity = '0';
    targetLink.style.visibility = 'hidden';
    targetLink.style.pointerEvents = 'none';
  }
}

// ==========================================================================
// 7. Main Orchestrator
// ==========================================================================
// ==========================================================================
// 7. Main Orchestrator
// ==========================================================================
async function runMSPAUpdater() {
  const ctx = getStoryContext();
  if (!ctx) return;

  const storage = getExtensionStorage();
  if (!storage) return;

  const storageKeys = ['mspaState', ctx.customStorageKey];

  const processCheck = async (result) => {
    const state = result?.mspaState || {};
    const settings = state.settings || { unreleasedBehavior: 'blur', passwordBehavior: 'hide' };
    const comicState = state[ctx.storyKey] || {};

    if (!comicState.startDate) return;

    const daysElapsed = calculateNonLeapElapsedDays(comicState.startDate);
    const scheduleData = await loadActiveSchedule(ctx, result[ctx.customStorageKey]);
    const maxAllowedPage = getMaxAllowedPage(scheduleData, daysElapsed);

    // Wait for Vue DOM mounting to complete
    const nextLink = await waitForNextPromptLink();

    // ----------------------------------------------------------------------
    // Password Prompt Handling (Homestuck specific)
    // Runs AFTER DOM links mount
    // ----------------------------------------------------------------------
    if (ctx.storyKey === 'homestuck' && (settings.passwordBehavior || 'hide') === 'hide') {
      const links = document.querySelectorAll('a[href]');

      for (const link of links) {
        const href = link.getAttribute('href') || '';
        // Matches /009058, /9058, or https://homestuck.com/009058
        const match = href.match(/(\d{4,6})/);

        if (match) {
          const targetPageNum = parseInt(match[1], 10);

          if (PASSWORD_PAGES.includes(targetPageNum) && targetPageNum > maxAllowedPage) {
            const parentDiv = link.closest('div');
            if (parentDiv) {
              parentDiv.style.display = 'none';
            } else {
              link.style.display = 'none';
            }
          }
        }
      }
    }

    // ----------------------------------------------------------------------
    // Next Prompt Link Handling
    // ----------------------------------------------------------------------
    if (!nextLink) return;

    const match = (nextLink.getAttribute('href') || '').match(/(\d{4,6})/);
    const nextPageNum = match ? parseInt(match[1], 10) : null;

    if (nextPageNum !== null && nextPageNum > maxAllowedPage) {
      applyUnreleasedBehavior(nextLink, settings.unreleasedBehavior || 'blur');
    }
  };

  if (typeof browser !== 'undefined' && browser.storage) {
    storage.get(storageKeys).then(processCheck);
  } else {
    storage.get(storageKeys, processCheck);
  }
}

// ==========================================================================
// 8. Observer & Boot Sequence
// ==========================================================================
const observer = new MutationObserver(() => {
  if (currentHref !== location.href) {
    currentHref = location.href;
    runMSPAUpdater();
  }
});

let currentHref = location.href;

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

runMSPAUpdater();