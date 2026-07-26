// SPDX-License-Identifier: MIT

function patternForUrl(urlString) {
  const url = new URL(urlString);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  return `*://${url.hostname}/*`;
}

async function getSetting(url) {
  const result = await chrome.contentSettings.javascript.get({ primaryUrl: url });
  return result.setting;
}

async function refreshAction(tab) {
  if (!tab || !tab.id) return;
  const tabId = tab.id;

  if (!tab.url || !/^https?:/.test(tab.url)) {
    await chrome.action.disable(tabId);
    await chrome.action.setBadgeText({ tabId, text: "" });
    await chrome.action.setTitle({ tabId, title: "Block JavaScript (unavailable on this page)" });
    return;
  }

  await chrome.action.enable(tabId);
  const blocked = (await getSetting(tab.url)) === "block";
  const icon16 = blocked ? "icon-16-off.png" : "icon-16.png";
  const icon48 = blocked ? "icon-48-off.png" : "icon-48.png";
  await chrome.action.setIcon({ path: { '16': icon16, '48': icon48 } });
  await chrome.action.setTitle({
    tabId,
    title: blocked ? "JavaScript blocked — click to allow" : "Click to block JavaScript on this site",
  });
}

function notifyError(message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon-48.png",
    title: "Block JS Button",
    message,
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab.url) throw new Error("No URL on this tab.");
    const pattern = patternForUrl(tab.url);
    if (!pattern) throw new Error(`Unsupported scheme: ${new URL(tab.url).protocol}`);

    const next = (await getSetting(tab.url)) === "block" ? "allow" : "block";
    await chrome.contentSettings.javascript.set({ primaryPattern: pattern, setting: next });
    await chrome.tabs.reload(tab.id);
    // Tab reload triggers onUpdated, which refreshes the action.
  } catch (err) {
    notifyError(err instanceof Error ? err.message : String(err));
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await refreshAction(tab);
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" || changeInfo.url) {
    await refreshAction(tab);
  }
});
