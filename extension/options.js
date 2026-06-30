const helperUrl = document.getElementById('helperUrl');
const token = document.getElementById('token');
const saved = document.getElementById('saved');

chrome.storage.local.get({ helperUrl: 'http://127.0.0.1:41484', token: '' }).then((s) => {
  helperUrl.value = s.helperUrl;
  token.value = s.token;
});

document.getElementById('save').addEventListener('click', async () => {
  await chrome.storage.local.set({ helperUrl: helperUrl.value.trim(), token: token.value.trim() });
  saved.textContent = 'Saved.';
});
