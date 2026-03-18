/**
 * popup.js
 *
 * Manages the enable/disable toggles in popup.html.
 *
 * State is persisted in chrome.storage.local so the setting survives
 * browser restarts. When a toggle changes the active YouTube tab is
 * notified via chrome.tabs.sendMessage so blocking starts/stops without
 * requiring a page reload (though a reload is still recommended for a
 * fully clean state).
 */

const toggle = document.getElementById("toggle");
const toggleSidebar = document.getElementById("toggle-sidebar");
const statusText = document.getElementById("status-text");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Updates the status label to reflect the current enabled state.
 * @param {boolean} enabled
 */
function updateStatusLabel(enabled) {
  if (enabled) {
    statusText.textContent = "Blocking active";
    statusText.className = "active";
  } else {
    statusText.textContent = "Blocking disabled";
    statusText.className = "inactive";
  }
}

/**
 * Sends a message to the content script running in the currently active
 * YouTube tab (if any). Errors (e.g. no content script loaded yet) are
 * silently swallowed – the persisted storage value ensures the correct state
 * is applied on the next page load.
 * @param {object} payload
 */
function notifyActiveTab(payload) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url) {
      // Use URL.hostname to avoid matching arbitrary hosts that contain
      // "youtube.com" as a substring (e.g. "evil-youtube.com").
      try {
        const { hostname } = new URL(tab.url);
        if (hostname === "www.youtube.com" || hostname === "youtube.com") {
          chrome.tabs.sendMessage(tab.id, payload, () => void chrome.runtime.lastError);
        }
      } catch {
        // Invalid URL – skip silently.
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Initialise toggles from stored values
// ---------------------------------------------------------------------------

chrome.storage.local.get({ enabled: true, blockSidebar: false }, ({ enabled, blockSidebar }) => {
  toggle.checked = enabled;
  toggleSidebar.checked = blockSidebar;
  updateStatusLabel(enabled);
});

// ---------------------------------------------------------------------------
// Persist and propagate changes when the user flips a toggle
// ---------------------------------------------------------------------------

toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ enabled });
  updateStatusLabel(enabled);
  notifyActiveTab({ type: "SET_ENABLED", enabled });
});

toggleSidebar.addEventListener("change", () => {
  const blockSidebar = toggleSidebar.checked;
  chrome.storage.local.set({ blockSidebar });
  notifyActiveTab({ type: "SET_BLOCK_SIDEBAR", blockSidebar });
});
