/**
 * content.js
 *
 * Injected on every YouTube page. Hides Shorts-related elements using CSS
 * selectors and redirects away from /shorts/* pages. A MutationObserver
 * watches for new nodes added by YouTube's SPA router so blocking stays
 * active after navigation.
 *
 * Blocking can be toggled from popup.html via chrome.storage.local.
 */

// ---------------------------------------------------------------------------
// CSS selectors for elements we want to remove
// ---------------------------------------------------------------------------

/** Selectors that target Shorts-related elements */
const SHORTS_SELECTORS = [
  // Shorts shelf on homepage / subscriptions feed
  "ytd-rich-shelf-renderer[is-shorts]",
  // Fallback: any shelf whose title contains "Shorts"
  "ytd-rich-shelf-renderer[shelf-style='shorts']",
  // Shorts entry in the left-side guide / mini-guide
  "ytd-guide-entry-renderer a[title='Shorts']",
  "ytd-mini-guide-entry-renderer a[title='Shorts']",
  // Shorts shelf in search results and other feeds (legacy and newer element names)
  "ytd-reel-shelf-renderer",
  "ytd-shorts-shelf-renderer",
  // Individual short video items
  "ytd-reel-item-renderer",
  // Shorts player component (on /shorts/* pages)
  "ytd-shorts",
  // Entire search-result section that wraps a Shorts shelf (prevents empty divider)
  "ytd-item-section-renderer:has(ytd-reel-shelf-renderer)",
];

/** Selectors that target recommendation widgets (but NOT regular video items) */
const RECOMMENDATION_SELECTORS = [
  // End-screen recommendation cards shown at video end
  ".ytp-endscreen-content",
  // Chips / topic filter bar on homepage (algorithm-driven)
  "ytd-feed-filter-chip-bar-renderer",
];

/** Selectors that target the right-sidebar "Up Next" recommendations on watch pages */
const SIDEBAR_SELECTORS = [
  // Secondary column on the watch page (contains "Up Next" / related videos)
  "ytd-watch-flexy #secondary",
];

// Combined selector list, built once for use in processAddedNode
const ALL_SELECTORS = [...SHORTS_SELECTORS, ...RECOMMENDATION_SELECTORS];

// ---------------------------------------------------------------------------
// Core hide/remove logic
// ---------------------------------------------------------------------------

/**
 * Hides a single DOM element by setting display:none.
 * @param {Element} el
 */
function hideElement(el) {
  el.style.setProperty("display", "none", "important");
}

/**
 * Applies CSS hiding to all elements matching the given selectors
 * within the provided root node.
 * @param {Element|Document} root
 * @param {string[]} selectors
 */
function applySelectors(root, selectors) {
  for (const selector of selectors) {
    root.querySelectorAll(selector).forEach(hideElement);
  }
}

/**
 * Runs a full blocking pass on the whole document.
 * Called on initial load and after SPA navigation events.
 */
function blockAll() {
  applySelectors(document, SHORTS_SELECTORS);
  applySelectors(document, RECOMMENDATION_SELECTORS);
}

/** Applies sidebar blocking to the whole document. */
function blockSidebarNow() {
  applySelectors(document, SIDEBAR_SELECTORS);
}

/**
 * Redirects away from the YouTube Shorts player page (/shorts/*) to the
 * homepage, preventing users from scrolling through Shorts.
 */
function redirectShortsPage() {
  if (window.location.pathname.startsWith("/shorts/")) {
    window.location.replace("https://www.youtube.com/");
  }
}

/**
 * Injects a <style> element that fixes the layout clipping issue on the
 * YouTube home feed when the Shorts shelf and chip-filter bar are hidden.
 * Without this, the grid's overflow clipping can cut off the top of the
 * first row of regular videos.
 */
function injectFixStyles() {
  if (document.getElementById("shorts-blocker-fix")) return;
  const style = document.createElement("style");
  style.id = "shorts-blocker-fix";
  style.textContent =
    // Prevent browser scroll-anchoring from jumping when elements are hidden
    "html { overflow-anchor: none; }\n" +
    // Ensure the home-feed grid does not clip overflowing content
    "ytd-rich-grid-renderer { overflow: visible !important; }";
  (document.head || document.documentElement).appendChild(style);
}

// ---------------------------------------------------------------------------
// MutationObserver – handles YouTube's dynamic / SPA loading
// ---------------------------------------------------------------------------

/**
 * Processes a single added node: hides it directly if it matches a selector,
 * then walks its subtree for nested matches.
 * @param {Node} node
 */
function processAddedNode(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const selectorsToCheck = blockingEnabled
    ? [...ALL_SELECTORS, ...(blockSidebarEnabled ? SIDEBAR_SELECTORS : [])]
    : blockSidebarEnabled
    ? SIDEBAR_SELECTORS
    : [];

  for (const selector of selectorsToCheck) {
    // Hide the node itself if it matches
    if (node.matches && node.matches(selector)) {
      hideElement(node);
    }
    // Hide any descendants that match
    node.querySelectorAll(selector).forEach(hideElement);
  }
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      processAddedNode(node);
    }
  }
});

// ---------------------------------------------------------------------------
// Initialisation – honour the user's toggle settings from chrome.storage
// ---------------------------------------------------------------------------

/** In-memory cache of the current enabled state. Default true until loaded. */
let blockingEnabled = true;

/** In-memory cache of the sidebar-blocking state. Default false until loaded. */
let blockSidebarEnabled = false;

/**
 * (Re-)starts the observer when at least one blocking feature is active.
 * Safe to call multiple times – observing an already-observed root is a no-op.
 */
function ensureObserving() {
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Stops the observer only when ALL blocking features are disabled.
 */
function maybeStopObserving() {
  if (!blockingEnabled && !blockSidebarEnabled) {
    observer.disconnect();
  }
}

/**
 * Starts the blocker: redirects Shorts pages, runs an initial pass, and
 * attaches the MutationObserver.
 */
function startBlocking() {
  blockingEnabled = true;
  redirectShortsPage();
  blockAll();
  ensureObserving();
}

/**
 * Stops the blocker: disconnects the observer but does NOT un-hide elements
 * (a page reload is the natural way to restore YouTube's default layout).
 */
function stopBlocking() {
  blockingEnabled = false;
  maybeStopObserving();
}

/** Activates sidebar blocking and runs an immediate pass. */
function startSidebarBlocking() {
  blockSidebarEnabled = true;
  blockSidebarNow();
  ensureObserving();
}

/** Deactivates sidebar blocking (hidden elements remain until page reload). */
function stopSidebarBlocking() {
  blockSidebarEnabled = false;
  maybeStopObserving();
}

/**
 * Reads the "enabled" and "blockSidebar" flags from chrome.storage.local and
 * starts or stops blocking accordingly. Defaults to enabled/false if no value
 * is stored yet.
 */
function initFromStorage() {
  chrome.storage.local.get(
    { enabled: true, blockSidebar: false },
    ({ enabled, blockSidebar }) => {
      blockingEnabled = enabled;
      blockSidebarEnabled = blockSidebar;

      if (enabled) {
        injectFixStyles();
        redirectShortsPage();
        blockAll();
      }
      if (blockSidebar) {
        injectFixStyles();
        blockSidebarNow();
      }
      if (enabled || blockSidebar) {
        ensureObserving();
      }
    }
  );
}

// Listen for toggle messages sent by popup.js
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SET_ENABLED") {
    if (message.enabled) {
      startBlocking();
    } else {
      stopBlocking();
    }
  }
  if (message.type === "SET_BLOCK_SIDEBAR") {
    if (message.blockSidebar) {
      startSidebarBlocking();
    } else {
      stopSidebarBlocking();
    }
  }
});

// Kick off on initial page load
initFromStorage();

// YouTube is a SPA – re-run a full block pass whenever the URL changes
// (yt-navigate-finish fires after each soft navigation)
document.addEventListener("yt-navigate-finish", () => {
  if (blockingEnabled) {
    redirectShortsPage();
    blockAll();
  }
  if (blockSidebarEnabled) {
    blockSidebarNow();
  }
});
