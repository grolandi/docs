(function () {
  function getSearchEntryButton() {
    var desktop = document.getElementById('search-bar-entry');
    if (desktop instanceof HTMLElement && desktop.offsetParent !== null) {
      return desktop;
    }
    var mobile = document.getElementById('search-bar-entry-mobile');
    if (mobile instanceof HTMLElement) {
      return mobile;
    }
    return desktop instanceof HTMLElement ? desktop : null;
  }

  function getAssistantEntryButton() {
    var desktop = document.getElementById('assistant-entry');
    if (desktop instanceof HTMLElement && desktop.offsetParent !== null) {
      return desktop;
    }
    var mobile = document.getElementById('assistant-entry-mobile');
    if (mobile instanceof HTMLElement && mobile.offsetParent !== null) {
      return mobile;
    }
    if (desktop instanceof HTMLElement) {
      return desktop;
    }
    var m = document.getElementById('assistant-entry-mobile');
    return m instanceof HTMLElement ? m : null;
  }

  function openSearch() {
    getSearchEntryButton()?.click();
  }

  function openAssistant() {
    getAssistantEntryButton()?.click();
  }

  function setNativeInputValue(input, value) {
    var desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (desc && desc.set) {
      desc.set.call(input, value);
    } else {
      input.value = value;
    }
  }

  function fillSearchInput(term) {
    var maxAttempts = 40;

    function tryFill(attempt) {
      var el = document.getElementById('search-input');
      if (el instanceof HTMLInputElement) {
        setNativeInputValue(el, term);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.focus();
        return;
      }
      if (attempt < maxAttempts) {
        window.setTimeout(function () {
          tryFill(attempt + 1);
        }, 50);
      }
    }

    window.requestAnimationFrame(function () {
      tryFill(0);
    });
  }

  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!(target instanceof Element)) {
      return;
    }

    var trigger = target.closest('[data-search-trigger]');
    if (trigger) {
      e.preventDefault();
      openSearch();
      return;
    }

    var assistantTrigger = target.closest('[data-assistant-trigger]');
    if (assistantTrigger) {
      e.preventDefault();
      openAssistant();
      return;
    }

    var popular = target.closest('[data-popular-search]');
    if (popular) {
      e.preventDefault();
      var term = popular.getAttribute('data-term') || '';
      openSearch();
      if (term) {
        fillSearchInput(term);
      }
    }
  });
})();

// PDF Download button — injected on every doc page
(function () {
  var BTN_ID = 'inbiot-pdf-btn';

  function injectPdfButton() {
    if (document.getElementById(BTN_ID)) return;
    if (window.location.pathname === '/' || window.location.pathname === '') return;

    var article = document.querySelector('article');
    if (!article) return;

    var h1 = article.querySelector('h1');
    if (!h1) return;

    var btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
        '<polyline points="7 10 12 15 17 10"/>' +
        '<line x1="12" y1="15" x2="12" y2="3"/>' +
      '</svg> Download PDF';
    btn.addEventListener('click', function () { window.print(); });

    h1.insertAdjacentElement('afterend', btn);
  }

  function reinjectPdfButton() {
    var existing = document.getElementById(BTN_ID);
    if (existing) existing.remove();
    injectPdfButton();
  }

  // Intercept Next.js client-side navigation
  var _push = history.pushState;
  history.pushState = function () {
    _push.apply(history, arguments);
    setTimeout(reinjectPdfButton, 350);
  };

  var _replace = history.replaceState;
  history.replaceState = function () {
    _replace.apply(history, arguments);
    setTimeout(reinjectPdfButton, 350);
  };

  window.addEventListener('popstate', function () {
    setTimeout(reinjectPdfButton, 350);
  });

  // Initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(injectPdfButton, 500);
    });
  } else {
    setTimeout(injectPdfButton, 500);
  }
})();
