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
  var _observer = null;

  var SVG_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
      '<polyline points="7 10 12 15 17 10"/>' +
      '<line x1="12" y1="15" x2="12" y2="3"/>' +
    '</svg>';

  function generatePdf(btn) {
    btn.disabled = true;
    btn.innerHTML = SVG_ICON + ' Generating…';

    function restore() {
      btn.disabled = false;
      btn.innerHTML = SVG_ICON + ' Download PDF';
    }

    function run() {
      var content = document.querySelector('article') ||
                    document.querySelector('main') ||
                    document.body;

      // Temporarily hide chrome elements that shouldn't appear in the PDF
      var HIDE = [
        '#inbiot-pdf-btn',
        '#navbar', '#topbar', '#sidebar',
        '[id*="navbar"]', '[id*="topbar"]', '[id*="sidebar"]',
        '[data-component-part="sidebar"]',
        '[data-component-part="contextual-menu"]',
        '[class*="pagination"]', '[class*="prev-next"]',
        'footer', 'nav'
      ];
      var hidden = [];
      HIDE.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
          if (el.style.display !== 'none') {
            el.style.setProperty('display', 'none', 'important');
            hidden.push(el);
          }
        });
      });

      var opt = {
        margin: [15, 15, 15, 15],
        filename: (document.title || 'inbiot') + '.pdf',
        image: { type: 'jpeg', quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      function unhide() { hidden.forEach(function (el) { el.style.removeProperty('display'); }); }

      window.html2pdf().set(opt).from(content).save()
        .then(function () { unhide(); restore(); })
        .catch(function () { unhide(); restore(); });
    }

    if (window.html2pdf) {
      run();
      return;
    }

    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
    s.onload = function () { if (window.html2pdf) run(); else restore(); };
    s.onerror = restore;
    document.head.appendChild(s);
  }

  function tryInject() {
    if (document.getElementById(BTN_ID)) return true;
    if (window.location.pathname === '/' || window.location.pathname === '') return true;

    var h1 = document.querySelector('article h1') ||
             document.querySelector('main h1') ||
             document.querySelector('[class*="content"] h1') ||
             document.querySelector('h1');
    if (!h1) return false;

    var btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.innerHTML = SVG_ICON + ' Download PDF';
    btn.addEventListener('click', function () { generatePdf(btn); });
    h1.insertAdjacentElement('afterend', btn);
    return true;
  }

  function startObserver() {
    if (_observer) { _observer.disconnect(); _observer = null; }
    if (tryInject()) return;

    _observer = new MutationObserver(function () {
      if (tryInject()) { _observer.disconnect(); _observer = null; }
    });
    _observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(function () {
      if (_observer) { _observer.disconnect(); _observer = null; }
    }, 5000);
  }

  var HOME_TAB_PATHS = [
    '/mica-devices',
    '/bms-and-integrations',
    '/my-inbiot-platform',
    '/downloads',
    '/inbiot-api',
    '/faq'
  ];

  function suppressHomeTabs() {
    setTimeout(function () {
      HOME_TAB_PATHS.forEach(function (path) {
        document.querySelectorAll('a[href="' + path + '"]').forEach(function (el) {
          el.setAttribute('data-inbiot-home', 'true');
          el.style.setProperty('border-bottom-color', 'transparent', 'important');
          el.style.setProperty('border-bottom-width', '0', 'important');
          el.style.setProperty('font-weight', '400', 'important');
          el.style.setProperty('color', 'inherit', 'important');
        });
      });
    }, 300);
  }

  function clearHomeTabs() {
    document.querySelectorAll('[data-inbiot-home="true"]').forEach(function (el) {
      el.removeAttribute('data-inbiot-home');
      el.style.removeProperty('border-bottom-color');
      el.style.removeProperty('border-bottom-width');
      el.style.removeProperty('font-weight');
      el.style.removeProperty('color');
    });
  }

  function syncHomeClass() {
    var isHome = window.location.pathname === '/' || window.location.pathname === '';
    document.body.classList.toggle('inbiot-home', isHome);
    if (isHome) { suppressHomeTabs(); } else { clearHomeTabs(); }
  }

  function onNavigate() {
    var existing = document.getElementById(BTN_ID);
    if (existing) existing.remove();
    setTimeout(function () { syncHomeClass(); startObserver(); }, 100);
  }

  var _push = history.pushState;
  history.pushState = function () { _push.apply(history, arguments); onNavigate(); };

  var _replace = history.replaceState;
  history.replaceState = function () { _replace.apply(history, arguments); onNavigate(); };

  window.addEventListener('popstate', onNavigate);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { syncHomeClass(); startObserver(); });
  } else {
    syncHomeClass();
    startObserver();
  }
})();
