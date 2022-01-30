/*! cacheonhover v1.1.0 - (C) 2022 Yurin Doctrine */

let mouseoverTimer
let lastTouchTimestamp
const prefetches = new Set()
const prefetchElement = document.createElement('link')
const isSupported = prefetchElement.relList && prefetchElement.relList.supports && prefetchElement.relList.supports('prefetch') &&
  window.IntersectionObserver && 'isIntersecting' in IntersectionObserverEntry.prototype
const allowQueryString = 'cohAllowQueryString' in document.body.dataset
const allowExternalLinks = 'cohAllowExternalLinks' in document.body.dataset
const useWhitelist = 'cohWhitelist' in document.body.dataset
const mousedownShortcut = 'cohMousedownShortcut' in document.body.dataset
const DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION = 1111

let delayOnHover = 55
let useMousedown = false
let useMousedownOnly = false
let useViewport = false

if ('cohIntensity' in document.body.dataset) {
  const intensity = document.body.dataset.cohIntensity

  if (intensity.substr(0, 'mousedown'.length) == 'mousedown') {
    useMousedown = true
    if (intensity == 'mousedown-only') {
      useMousedownOnly = true
    }
  } else if (intensity.substr(0, 'viewport'.length) == 'viewport') {
    if (!(navigator.connection && (navigator.connection.saveData || (navigator.connection.effectiveType && navigator.connection.effectiveType.includes('2g'))))) {
      if (intensity == "viewport") {
        /* Biggest iPhone resolution (which we want): 414 × 896 = 370944
         * Small 7" tablet resolution (which we don’t want): 600 × 1024 = 614400
         * Note that the viewport (which we check here) is smaller than the resolution due to the UI’s chrome */
        if (document.documentElement.clientWidth * document.documentElement.clientHeight < 450000) {
          useViewport = true
        }
      } else if (intensity == "viewport-all") {
        useViewport = true
      }
    }
  } else {
    const milliseconds = parseInt(intensity)
    if (!isNaN(milliseconds)) {
      delayOnHover = milliseconds
    }
  }
}

if (isSupported) {
  const eventListenersOptions = {
    capture: true,
    passive: true,
  }

  if (!useMousedownOnly) {
    document.addEventListener('touchstart', touchstartListener, eventListenersOptions)
  }

  if (!useMousedown) {
    document.addEventListener('mouseover', mouseoverListener, eventListenersOptions)
  } else if (!mousedownShortcut) {
    document.addEventListener('mousedown', mousedownListener, eventListenersOptions)
  }

  if (mousedownShortcut) {
    document.addEventListener('mousedown', mousedownShortcutListener, eventListenersOptions)
  }

  if (useViewport) {
    let triggeringFunction
    if (window.requestIdleCallback) {
      triggeringFunction = (callback) => {
        requestIdleCallback(callback, {
          timeout: 1500,
        })
      }
    } else {
      triggeringFunction = (callback) => {
        callback()
      }
    }

    triggeringFunction(() => {
      const intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const linkElement = entry.target
            intersectionObserver.unobserve(linkElement)
            preload(linkElement.href)
          }
        })
      })

      document.querySelectorAll('a').forEach((linkElement) => {
        if (isPreloadable(linkElement)) {
          intersectionObserver.observe(linkElement)
        }
      })
    })
  }
}

function touchstartListener(event) {
  /* Chrome on Android calls mouseover before touchcancel so `lastTouchTimestamp`
   * must be assigned on touchstart to be measured on mouseover. */
  lastTouchTimestamp = performance.now()

  const linkElement = event.target.closest('a')

  if (!isPreloadable(linkElement)) {
    return
  }

  preload(linkElement.href)
}

function mouseoverListener(event) {
  if (performance.now() - lastTouchTimestamp < DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION) {
    return
  }

  const linkElement = event.target.closest('a')

  if (!isPreloadable(linkElement)) {
    return
  }

  linkElement.addEventListener('mouseout', mouseoutListener, {
    passive: true
  })

  mouseoverTimer = setTimeout(() => {
    preload(linkElement.href)
    mouseoverTimer = undefined
  }, delayOnHover)
}

function mousedownListener(event) {
  const linkElement = event.target.closest('a')

  if (!isPreloadable(linkElement)) {
    return
  }

  preload(linkElement.href)
}

function mouseoutListener(event) {
  if (event.relatedTarget && event.target.closest('a') == event.relatedTarget.closest('a')) {
    return
  }

  if (mouseoverTimer) {
    clearTimeout(mouseoverTimer)
    mouseoverTimer = undefined
  }
}

function mousedownShortcutListener(event) {
  if (performance.now() - lastTouchTimestamp < DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION) {
    return
  }

  const linkElement = event.target.closest('a')

  if (event.which > 1 || event.metaKey || event.ctrlKey) {
    return
  }

  if (!linkElement) {
    return
  }

  linkElement.addEventListener('click', function (event) {
    if (event.detail == 1337) {
      return
    }

    event.preventDefault()
  }, {
    capture: true,
    passive: false,
    once: true
  })

  const customEvent = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: false,
    detail: 1337
  })
  linkElement.dispatchEvent(customEvent)
}

function isPreloadable(linkElement) {
  if (!linkElement || !linkElement.href) {
    return
  }

  if (useWhitelist && !('coh' in linkElement.dataset)) {
    return
  }

  if (!allowExternalLinks && linkElement.origin != location.origin && !('coh' in linkElement.dataset)) {
    return
  }

  if (!['http:', 'https:'].includes(linkElement.protocol)) {
    return
  }

  if (linkElement.protocol == 'http:' && location.protocol == 'https:') {
    return
  }

  if (!allowQueryString && linkElement.search && !('coh' in linkElement.dataset)) {
    return
  }

  if (linkElement.hash && linkElement.pathname + linkElement.search == location.pathname + location.search) {
    return
  }

  if ('noCoh' in linkElement.dataset) {
    return
  }

  return true
}

function preload(url) {
  if (prefetches.has(url)) {
    return
  }

  const prefetcher = document.createElement('link')
  prefetcher.rel = 'prefetch'
  prefetcher.href = url
  document.head.appendChild(prefetcher)

  prefetches.add(url)
}

// the object of active tabs
var activeTabs = {};

// add the currently selected tab
chrome.tabs.query({
  active: true,
  currentWindow: true
}, function (tab) {
  activeTabs[tab.id] = 1;
});

// body-check every webrequest make sure they're authorized
// Google seems to do things in the background with tab id -1 so let those go
chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    return {
      cancel: details.tabId != -1 &&
        activeTabs[details.tabId] == null
    };
  }, {
    urls: ["<all_urls>"]
  },
  ["blocking"]
);

// when a tab is selected, add it to activeTabs if it is not already there
chrome.tabs.onActivated.addListener(function (activeInfo) {
  if (activeTabs[activeInfo.tabId] == null) {
    activeTabs[activeInfo.tabId] = 1;
    chrome.tabs.reload(activeInfo.tabId);
  }
});

// remove any tab from activeTabs that is closed
chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
  delete activeTabs[tabId];
});

// add any tab that is created
chrome.tabs.onCreated.addListener(function (tab) {
  activeTabs[tab.tabId] = 1;
});