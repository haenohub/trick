const status = (id, message, state) => {
  const element = document.getElementById(id);
  element.textContent = message;
  element.dataset.state = state;
};

status('script-status', '정상', 'ok');

try {
  const response = await fetch('./deployment.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest.kind !== 'pages-smoke' || !manifest.commit || !Number.isFinite(Date.parse(manifest.builtAt))) {
    throw new Error('Invalid deployment metadata');
  }
  document.getElementById('commit').textContent = manifest.commit === 'local' ? '로컬 테스트' : manifest.commit.slice(0, 12);
  document.getElementById('built-at').textContent = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'medium'
  }).format(new Date(manifest.builtAt)) + ' (한국 시간)';
  status('manifest-status', '정상', 'ok');
} catch {
  status('manifest-status', '불러오기 실패', 'error');
}

document.getElementById('check-storage').addEventListener('click', () => {
  const key = `leaves-beyond:smoke:${crypto.randomUUID()}`;
  try {
    localStorage.setItem(key, 'ok');
    if (localStorage.getItem(key) !== 'ok') throw new Error('Storage check failed');
    localStorage.removeItem(key);
    status('storage-status', '정상 · 검사 데이터 삭제됨', 'ok');
  } catch {
    try { localStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
    status('storage-status', '저장 권한을 확인해 주세요', 'error');
  }
});
