// Opens Daily Log in a tab. If one is already open, focuses it instead of creating a duplicate.
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('daily-log.html');
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find(t => t.url === url);
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
});
