const $ = selector => document.querySelector(selector);
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
const date = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }) + ' ICT' : 'Nguồn không cung cấp';
const short = value => value ? value.slice(0, 12) : '—';
let selected;
let busy = false;
let expiryTimer;
let displayedDeadline = 0;
function expire() { if (displayedDeadline && Date.now() >= displayedDeadline) { $('#content').replaceChildren(); $('#content').hidden = true; $('#notice').textContent = 'EXPIRED · Đã hết hạn hiển thị evidence; làm mới để kiểm tra lại quyền.'; } }
document.addEventListener('visibilitychange', expire);
async function api(url) { const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw new Error(response.status === 401 ? 'Phiên chưa được cấp quyền hoặc đã hết hạn. Khởi động lại bằng --open.' : 'Không thể xác minh quyền hoặc đọc evidence.'); return response.json(); }
function detailList(entries) { const list = el('dl'); for (const [key, value] of entries) { list.append(el('dt', key), el('dd', value ?? '—')); } return list; }
function panel(title) { const section = el('section', undefined, 'panel'); section.append(el('h2', title)); return section; }
function renderFactory(data) {
  const content = $('#content'); content.replaceChildren(); content.hidden = false;
  $('#notice').textContent = `${data.state} · Evidence: ${data.validation} · Execution: ${data.executionOutcome ?? 'Nguồn chưa xác định'}.`;
  const identity = panel('Factory run');
  identity.append(detailList([['taskId', data.taskId], ['factoryRunId', data.factoryRunId], ['Source revision', data.baseline], ['Execution outcome', data.executionOutcome], ['Evidence validation', data.validation], ['Lý do HELD', data.reason], ['Commit', data.commit?.sha], ['Candidate–commit', data.commit?.comparison]])); content.append(identity);
  if (data.state === 'EXPIRED') { content.hidden = true; return; }
  displayedDeadline = data.expiresAt ? Math.min(Date.now() + 3600000, Date.parse(data.expiresAt)) : 0;
  if (displayedDeadline) expiryTimer = setTimeout(expire, Math.max(0, displayedDeadline - Date.now()));
  const stages = panel('Stage từ native receipts');
  for (const stage of data.stages || []) {
    const card = el('article', undefined, 'panel'); card.append(el('h3', `${stage.role} · ${stage.activity}`));
    card.append(detailList([['Decision', stage.decision], ['Native runId', stage.binding.runId], ['threadId', stage.binding.threadId], ['turnId', stage.binding.turnId], ['Candidate', stage.candidate], ['Persistence', `${stage.liveFacts} live / ${stage.historyMatches} matches`], ['Test', stage.test ? `${stage.test.counters.pass}/${stage.test.counters.tests} · exit ${stage.test.exitCode}` : 'Không có test execution ở stage này']])); stages.append(card);
  }
  content.append(stages);
  const artifacts = panel('Artifact đã kiểm tra'); const list = el('ul');
  for (const a of data.artifacts || []) list.append(el('li', `${a.packageId}/${a.file} · ${a.sha256}`));
  artifacts.append(list, el('p', data.proofLimit || 'Evidence chưa đầy đủ; không suy diễn thành PASS.', 'muted')); content.append(artifacts);
}
function render(data) {
  clearTimeout(expiryTimer);
  if (data.kind === 'FACTORY') return renderFactory(data);
  const content = $('#content'); content.replaceChildren(); content.hidden = true;
  if (data.state !== 'AVAILABLE') { $('#notice').textContent = `${data.state} · Không hiển thị nội dung chưa xác minh hoặc đã hết hạn.${data.expiresAt ? ' Hạn: ' + date(data.expiresAt) : ''}`; return; }
  $('#notice').textContent = `HASH MATCH · ${data.integrity.artifacts} artifact được kiểm tra lúc ${date(data.checkedAt)}. Hash chỉ xác nhận byte khớp manifest, không chứng minh runtime đã xảy ra.`;
  content.hidden = false;
  displayedDeadline = Math.min(Date.now() + 3600000, Date.parse(data.expiresAt));
  expiryTimer = setTimeout(expire, Math.max(0, displayedDeadline - Date.now()));
  const heading = el('div', undefined, 'section-head'); heading.append(el('h2', 'Một task lập trình · RED → GREEN'), el('span', 'HISTORICAL EVIDENCE', 'badge')); content.append(heading);
  const metrics = el('div', undefined, 'metrics');
  const greenPass = data.tests.green.exitCode === 0 && data.tests.green.counters.fail === 0 && data.tests.green.counters.pass === data.tests.green.counters.tests && data.tests.green.counters.skipped === 0 && data.tests.green.counters.cancelled === 0 && data.tests.green.counters.todo === 0;
  for (const [label, value, detail, cls] of [['REGRESSION · RED', `${data.tests.red.counters.fail} failures`, `${data.tests.red.counters.pass}/${data.tests.red.counters.tests} pass · exit ${data.tests.red.exitCode}`, 'red'], ['AFTER FIX', `${data.tests.green.counters.pass}/${data.tests.green.counters.tests} ${greenPass ? 'PASS' : 'NOT_PASS'}`, `${data.tests.green.counters.fail} failures · exit ${data.tests.green.exitCode}`, greenPass ? 'green' : 'red'], ['NATIVE HISTORY', `${data.reconciliation.matches}/${data.reconciliation.total} MATCH`, 'Theo independent reader đã lưu', ''], ['PERSISTENCE', `${data.liveCount} live facts`, `${data.acks ?? '—'} ack · ${data.historyCount} history facts`, '']]) { const card = el('article', undefined, `metric ${cls}`); card.append(el('div', label, 'eyebrow'), el('strong', value), el('p', detail, 'muted')); metrics.append(card); } content.append(metrics);
  const grid = el('div', undefined, 'grid'); const left = el('div'); const right = el('div'); grid.append(left, right); content.append(grid);
  const timeline = panel('Lifecycle đã lưu'); timeline.append(el('p', 'Thứ tự record trong store. History snapshot là nguồn đối chiếu, không được tái tạo thành live event.', 'muted'));
  const scroll = el('div', undefined, 'table-scroll'); const table = el('table'); const head = el('thead'); const hr = el('tr'); for (const title of ['# / Nguồn', 'Sự kiện / Item', 'Trạng thái', 'Thời gian']) hr.append(el('th', title)); head.append(hr); table.append(head); const body = el('tbody');
  for (const row of data.timeline) { const tr = el('tr'); const source = el('td'); source.append(el('strong', String(row.index + 1).padStart(2, '0')), el('small', row.source === 'live_notification' ? 'LIVE (đã lưu)' : 'HISTORY')); const event = el('td'); event.append(el('code', row.method), el('small', `${row.type || 'turn / thread'} · ${short(row.itemId)}`)); event.title = row.itemId || ''; const status = el('td'); status.append(el('span', row.status, 'badge'), el('small', row.exitCode === null ? '' : `exit ${row.exitCode}`)); const time = el('td'); time.append(el('small', 'Nhận: ' + date(row.receivedAt)), el('small', 'Nguồn: ' + date(row.sourceAt))); tr.append(source, event, status, time); body.append(tr); } table.append(body); scroll.append(table); timeline.append(scroll); left.append(timeline);
  const provenance = panel('Định danh & nguồn'); provenance.append(detailList(Object.entries(data.binding).map(([key, value]) => [key, String(value)])), detailList([['Source revision (đã lưu)', data.baseline], ['Package', data.id], ['Manifest SHA-256', data.integrity.manifestSha256]])); right.append(provenance);
  const review = panel('Review & giới hạn'); review.append(detailList([['Code review', data.reviews.code], ['Runtime review', data.reviews.runtime], ['Task workflow', data.reviews.workflow], ['Reader / Writer PID (lịch sử)', `${data.readerPid} / ${data.writerPid}`], ['Production', data.production], ['Hạn truy cập evidence', date(data.expiresAt)]])); review.append(el('p', 'Đây là kết luận review đã lưu. Lần tải này không chạy lại workflow, test hoặc truy vấn Codex history.', 'muted')); right.append(review);
  const files = panel('File agent đã sửa'); const list = el('ul'); for (const file of data.files) list.append(el('li', file)); files.append(list, el('p', 'Không hiển thị source code, prompt, reasoning hoặc output thô.', 'muted')); right.append(files);
}
async function load(packageId) {
  if (busy) return;
  busy = true; $('#refresh').disabled = true; $('#content').hidden = true; $('#notice').textContent = 'Đang kiểm tra quyền và tính toàn vẹn…';
  try {
    const data = await api('/api/packages'); $('#access').textContent = `GitHub: ${data.actor} · Quyền development được xác minh tại server`;
    selected = packageId || selected || data.packages.find(entry => entry.state === 'AVAILABLE')?.id || data.packages[0]?.id;
    $('#packages').replaceChildren();
    for (const item of data.packages) { const button = el('button', undefined, item.id === selected ? 'selected' : ''); button.append(el('span', item.id.replace('bella-agent-flow-', 'Run · ')), el('small', item.state)); button.setAttribute('aria-pressed', String(item.id === selected)); button.addEventListener('click', () => load(item.id)); $('#packages').append(button); }
    if (!selected) { $('#notice').textContent = 'Chưa có task package đã seal. Không tạo dữ liệu mẫu.'; return; }
    render(await api(`/api/packages/${selected}`));
  } catch (error) { $('#notice').textContent = error.message; $('#content').hidden = true; }
  finally { busy = false; $('#refresh').disabled = false; }
}
$('#refresh').addEventListener('click', () => load());
const token = location.hash.slice(1); history.replaceState(null, '', '/');
if (token) {
  try { const result = await fetch('/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }); if (!result.ok) throw new Error(); await load(); }
  catch { $('#notice').textContent = 'Không thể cấp phiên truy cập. Khởi động lại bằng --open.'; }
} else await load();
