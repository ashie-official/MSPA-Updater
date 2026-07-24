const promptSettings = document.getElementById('promptSettings');
  if (promptSettings) {
    promptSettings.addEventListener('click', (e) => {
      e.preventDefault();
      // if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      //   chrome.runtime.openOptionsPage();
      // } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.openOptionsPage) {
      //   browser.runtime.openOptionsPage();
      // } else {
      // }
      window.location.href = '/pages/settings/settings.html';
    });
  }