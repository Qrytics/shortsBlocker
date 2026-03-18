/**
 * content.js
 *
 * Injected on every YouTube page. Hides Shorts and recommended-video
 * elements using CSS selectors. A MutationObserver watches for new nodes
 * added by YouTube's SPA router so blocking stays active after navigation.
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
  // Shorts items inside search results / shelves
  "ytd-reel-shelf-renderer",
  // Individual short video items
  "ytd-reel-item-renderer",
];

/** Selectors that target recommendation widgets */
const RECOMMENDATION_SELECTORS = [
  // "Up next" / sidebar recommendations on watch page
  "#secondary #related",
  // Individual video items inside the related panel
  "ytd-compact-video-renderer",
  // End-screen recommendation cards shown at video end
  ".ytp-endscreen-content",
  // Chips / topic filter bar on homepage (algorithm-driven)
  "ytd-feed-filter-chip-bar-renderer",
  // Recommended rows / cards on homepage
  "ytd-rich-item-renderer",
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

  for (const selector of ALL_SELECTORS) {
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
// Initialisation – honour the user's toggle setting from chrome.storage
// ---------------------------------------------------------------------------

/** In-memory cache of the current enabled state. Default true until loaded. */
let blockingEnabled = true;

/**
 * Starts the blocker: runs an initial pass and attaches the MutationObserver.
 */
function startBlocking() {
  blockingEnabled = true;
  blockAll();
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Stops the blocker: disconnects the observer but does NOT un-hide elements
 * (a page reload is the natural way to restore YouTube's default layout).
 */
function stopBlocking() {
  blockingEnabled = false;
  observer.disconnect();
}

/**
 * Reads the "enabled" flag from chrome.storage.local and starts or stops
 * blocking accordingly. Defaults to enabled if no value is stored yet.
 */
function initFromStorage() {
  chrome.storage.local.get({ enabled: true }, ({ enabled }) => {
    blockingEnabled = enabled;
    if (enabled) {
      startBlocking();
    }
  });
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
});

// Kick off on initial page load
initFromStorage();

// YouTube is a SPA – re-run a full block pass whenever the URL changes
// (yt-navigate-finish fires after each soft navigation)
document.addEventListener("yt-navigate-finish", () => {
  if (blockingEnabled) blockAll();
});
