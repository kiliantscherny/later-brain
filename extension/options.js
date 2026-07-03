const DEFAULTS = {
  helperUrl: 'http://127.0.0.1:41484',
  token: '',
  saveSubdir: 'Clippings/YouTube',
  includeTags: true,
};

const helperUrl = document.getElementById('helperUrl');
const token = document.getElementById('token');
const saveSubdir = document.getElementById('saveSubdir');
const includeTags = document.getElementById('includeTags');
const saved = document.getElementById('saved');

chrome.storage.local.get(DEFAULTS).then((s) => {
  helperUrl.value = s.helperUrl;
  token.value = s.token;
  saveSubdir.value = s.saveSubdir;
  includeTags.checked = s.includeTags !== false;
});

document.getElementById('save').addEventListener('click', async () => {
  await chrome.storage.local.set({
    helperUrl: helperUrl.value.trim(),
    token: token.value.trim(),
    saveSubdir: saveSubdir.value.trim() || DEFAULTS.saveSubdir,
    includeTags: includeTags.checked,
  });
  saved.textContent = 'Saved.';
});
