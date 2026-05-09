// ═══════════════════════════════════════════
// CORE.JS — Supabase, navigation, shared utils
// ═══════════════════════════════════════════

const SUPABASE_URL = 'https://aywlauygsqkivdihbaut.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5d2xhdXlnc3FraXZkaWhiYXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODYxNjgsImV4cCI6MjA4OTY2MjE2OH0.NHMZTF6yCaZXW8bNw496Hd_t_NAIE__PUU4WsxZc3yw';
const SUPABASE_AUTH_URL = 'https://aywlauygsqkivdihbaut.supabase.co/auth/v1';
var CLOUDINARY_CLOUD = 'dlmezcwwu';
var CLOUDINARY_UPLOAD_PRESET = 'aipl_unsigned';

var currentUser = null;
var currentSession = null;

// ── SUPABASE CRUD ─────────────────────────────────────────
async function sbFetch(table, options={}) {
  var url = SUPABASE_URL + '/rest/v1/' + table;
  var params = [];
  if (options.select) params.push('select=' + options.select);
  if (options.filter) params.push(options.filter);
  if (options.order)  params.push('order=' + options.order);
  if (params.length)  url += '?' + params.join('&');
  var res = await fetch(url, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }
  });
  return res.json();
}

async function sbInsert(table, data) {
  var res = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function sbUpdate(table, id, data) {
  var res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function sbDelete(table, id) {
  var res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }
  });
  return res.ok;
}

// ── SUPABASE AUTH ─────────────────────────────────────────
async function authSignUp(mobile, password) {
  var email = mobile.replace(/[^0-9]/g, '') + '@aipl.internal';
  var res = await fetch(SUPABASE_AUTH_URL + '/signup', {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  });
  return res.json();
}

async function authSignIn(mobile, password) {
  var email = mobile.replace(/[^0-9]/g, '') + '@aipl.internal';
  var res = await fetch(SUPABASE_AUTH_URL + '/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  });
  return res.json();
}

async function authUpdatePassword(accessToken, newPassword) {
  var res = await fetch(SUPABASE_AUTH_URL + '/user', {
    method: 'PUT',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newPassword })
  });
  return res.json();
}

// ── CLOUDINARY UPLOAD ─────────────────────────────────────
async function uploadToCloudinary(file, folder, progressId) {
  if (!file) return null;
  var formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'aipl/' + folder);
  var progWrap = progressId ? document.getElementById(progressId + '-prog') : null;
  var progFill = progressId ? document.getElementById(progressId + '-prog-fill') : null;
  var progPct  = progressId ? document.getElementById(progressId + '-prog-pct') : null;
  var progName = progressId ? document.getElementById(progressId + '-prog-name') : null;
  if (progWrap) { progWrap.classList.add('on'); }
  if (progName) { progName.textContent = file.name; }
  if (progFill) { progFill.style.width = '0%'; progFill.className = 'upload-progress-fill'; }
  return new Promise(function(resolve) {
    var xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', function(e) {
      if (e.lengthComputable) {
        var pct = Math.round((e.loaded / e.total) * 100);
        if (progFill) progFill.style.width = pct + '%';
        if (progPct)  progPct.textContent  = pct + '%';
      }
    });
    xhr.addEventListener('load', function() {
      try {
        var data = JSON.parse(xhr.responseText);
        if (data.secure_url) {
          if (progFill) { progFill.style.width = '100%'; progFill.classList.add('done'); }
          if (progPct)  { progPct.textContent = '✅ Done'; }
          resolve(data.secure_url);
        } else {
          if (progFill) { progFill.classList.add('error'); }
          toast('Upload failed', 'error');
          resolve(null);
        }
      } catch(e) { resolve(null); }
    });
    xhr.addEventListener('error', function() { resolve(null); });
    xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/upload');
    xhr.send(formData);
  });
}

function handleFilePreview(inputId, previewId) {
  var inp  = document.getElementById(inputId);
  var prev = document.getElementById(previewId);
  if (!inp || !inp.files || !inp.files[0]) return;
  var file   = inp.files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    prev.innerHTML = file.type.startsWith('image/')
      ? '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">'
      : '<div style="text-align:center;padding:10px;font-size:11px;color:var(--text2);">📄 ' + file.name + '</div>';
    prev.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

// ── NAVIGATION ────────────────────────────────────────────
var currentApp = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('on'); });
  var el = document.getElementById(id);
  if (el) el.classList.add('on');
}

function showApp(name) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('on'); });
  document.querySelectorAll('.app-screen').forEach(function(s) { s.classList.remove('on'); });
  var target = document.getElementById('app-' + name);
  if (!target) { toast('Module coming soon', 'info'); return; }
  target.classList.add('on');
  document.body.setAttribute('data-app', name);
  currentApp = name;
  var nav = document.getElementById('app-nav');
  if (nav) nav.style.display = 'flex';
  ['home','attendance','registry','profile'].forEach(function(n) {
    var el = document.getElementById('an-' + n);
    if (el) el.classList.toggle('on', n === name || (n === 'home' && name === 'dashboard'));
  });
  if (name === 'attendance' && !window._attInit) { window._attInit = true; initAttendance(); }
  if (name === 'dashboard'  && !window._coLoaded) { window._coLoaded = true; preloadCompanyData(); }
  if (name === 'registry')  { initRegistry(); startSync(); }
  if (name === 'employees') { initEmpMgmt(); }
  if (name === 'projects')  { initProjects(); }
  if (name === 'petty-cash'){ initPettyCash(); }
  if (name === 'accounts')  { initAccounts(); }
  if (name === 'access')    { acInitModule(); }
  if (name === 'company')   { initCompany(); }
  if (name !== 'registry')  { stopSync(); }
}

function doLogout() {
  currentUser = null; currentSession = null;
  document.querySelectorAll('.app-screen').forEach(function(s) { s.classList.remove('on'); });
  var nav = document.getElementById('app-nav');
  if (nav) nav.style.display = 'none';
  showScreen('scr-login');
  toast('Signed out successfully', 'success');
}

// ── TOAST ─────────────────────────────────────────────────
function toast(msg, type) {
  var cols = { success:'#43A047', error:'#E53935', info:'#1565C0', warning:'#F57F17' };
  var wraps = document.querySelectorAll('.toast-wrap');
  wraps.forEach(function(w) {
    var d = document.createElement('div');
    d.className = 'toast-item';
    d.style.borderLeftColor = cols[type || 'success'];
    d.textContent = msg;
    w.appendChild(d);
    setTimeout(function() { d.style.opacity = '0'; setTimeout(function() { d.remove(); }, 300); }, 3200);
  });
}

// ── SHEET HELPERS ─────────────────────────────────────────
function openSheet(o, s) {
  var ov = document.getElementById(o), sh = document.getElementById(s);
  if (ov) ov.classList.add('on');
  if (sh) sh.classList.add('on');
}
function closeSheet(o, s) {
  var ov = document.getElementById(o), sh = document.getElementById(s);
  if (ov) ov.classList.remove('on');
  if (sh) sh.classList.remove('on');
}

// ── PROFILE ──────────────────────────────────────────────
function showProfile() {
  var u = currentUser;
  if (!u) { toast('Not logged in', 'warning'); return; }
  var col = (typeof ROLE_COLORS !== 'undefined' && ROLE_COLORS[u.role]) || '#37474F';
  var initials = (u.name || '?').split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  document.getElementById('profile-body').innerHTML =
    '<div style="background:' + col + '15;border:1px solid ' + col + '30;border-radius:16px;padding:16px;margin-bottom:14px;display:flex;align-items:center;gap:14px;">' +
      '<div style="width:68px;height:68px;border-radius:18px;background:' + col + ';display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:white;flex-shrink:0;overflow:hidden;">' +
        (u.photoUrl ? '<img src="' + u.photoUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:18px;">' : initials) +
      '</div>' +
      '<div><div style="font-size:18px;font-weight:900;">' + u.name + '</div>' +
      '<div style="font-size:12px;color:var(--text2);margin-top:2px;">' + (u.access || u.role) + ' &bull; ' + (u.dept || '—') + '</div></div>' +
    '</div>' +
    '<label class="flbl">Change Password</label>' +
    '<input class="finp" type="password" id="p-new-pass" placeholder="New password">' +
    '<input class="finp" type="password" id="p-conf-pass" placeholder="Confirm password">';
  document.getElementById('profile-foot').innerHTML =
    '<button class="btn btn-outline" onclick="closeSheet(\'ov-profile\',\'sh-profile\')">Close</button>' +
    '<button class="btn btn-navy" onclick="saveNewPassword()">🔐 Change Password</button>';
  openSheet('ov-profile', 'sh-profile');
}

async function saveNewPassword() {
  var nw = (document.getElementById('p-new-pass') || {}).value || '';
  var conf = (document.getElementById('p-conf-pass') || {}).value || '';
  if (!nw || nw.length < 6) { toast('Min 6 characters', 'warning'); return; }
  if (nw !== conf) { toast('Passwords do not match', 'warning'); return; }
  try {
    if (currentSession && currentSession.access_token) {
      var r = await authUpdatePassword(currentSession.access_token, nw);
      if (r.id || r.email) { toast('Password changed!', 'success'); closeSheet('ov-profile', 'sh-profile'); }
      else toast('Failed to update password', 'error');
    }
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ── DRAWER ────────────────────────────────────────────────
function openDrawer() {
  var u = currentUser;
  if (u) {
    var initials = (u.name || 'A').split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    var el = document.getElementById('drawer-avatar'); if (el) el.textContent = initials;
    var dn = document.getElementById('drawer-name');   if (dn) dn.textContent = u.name || '—';
    var dr = document.getElementById('drawer-role');   if (dr) dr.textContent = (u.access || u.role || '—') + ' · ' + (u.dept || '—');
  }
  var pendingItem  = document.getElementById('drawer-pending-item');
  var pendingBadge = document.getElementById('drawer-pending-badge');
  var count = (typeof pendingEmployees !== 'undefined' && pendingEmployees) ? pendingEmployees.length : 0;
  if (pendingItem && u && (u.role === 'admin' || u.role === 'pm')) {
    pendingItem.style.display = count > 0 ? 'flex' : 'none';
    if (pendingBadge) pendingBadge.textContent = count;
  }
  if (typeof applyDrawerPermissions === 'function') applyDrawerPermissions();
  document.getElementById('app-drawer').classList.add('on');
  document.getElementById('drawer-overlay').classList.add('on');
}

function closeDrawer() {
  document.getElementById('app-drawer').classList.remove('on');
  document.getElementById('drawer-overlay').classList.remove('on');
}

// ── SHARED UTILS ─────────────────────────────────────────
function gv(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
function esc(s) { return s ? String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;') : ''; }
function safeN(x) { var s = String(x || ''); var r = ''; for (var i = 0; i < s.length; i++) { r += s[i] === "'" ? '&#39;' : s[i]; } return r; }
function fmtDate(d) {
  if (!d || d === '—') return d || '—';
  var m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + '/' + m[2] + '/' + m[1];
  try { var dt = new Date(d); if (!isNaN(dt)) return String(dt.getDate()).padStart(2,'0') + '/' + String(dt.getMonth()+1).padStart(2,'0') + '/' + dt.getFullYear(); } catch(ex) {}
  return d;
}
function fmtINR(n) { if (!n && n !== 0) return '₹0'; return '₹' + parseFloat(n).toLocaleString('en-IN', {maximumFractionDigits:0}); }
function fmtV(n) { if (n >= 10000000) return '₹' + (n/10000000).toFixed(2) + 'Cr'; if (n >= 100000) return '₹' + (n/100000).toFixed(1) + 'L'; return '₹' + (n/1000).toFixed(0) + 'K'; }
function fmtA(n) { return '₹' + Math.abs(Number(n||0)).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtINR2(n) { return '₹' + Number(n||0).toLocaleString('en-IN', {maximumFractionDigits:0}); }
function ir(lbl, val, mono) {
  return '<div class="info-row"><div class="ir-lbl">' + lbl + '</div><div class="ir-val' + (mono ? ' style="font-family:\'JetBrains Mono\',monospace;font-size:12px;"' : '') + '">' + (mono ? '<span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;">' + val + '</span>' : val) + '</div></div>';
}

var ROLE_COLORS = { admin:'#6A1B9A', pm:'#1565C0', engineer:'#00838F', qhse:'#2E7D32', finance:'#E65100', viewer:'#37474F' };

// ── DATA MAPPERS ──────────────────────────────────────────
function mapEmployee(e) {
  return {
    id:e.id, empId:e.emp_id,
    name:((e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'')).trim()||'Unknown',
    role:e.role||'viewer', access:e.designation||e.role, dept:e.department||'',
    phone:e.phone, phone2:e.phone2, dob:e.dob||e.date_of_birth, gender:e.gender,
    blood:e.blood_group, marital:e.marital_status, doj:e.date_of_joining,
    empType:e.emp_type, location:e.work_location, project:e.work_location||'',
    address:e.address, permanent:e.permanent_address,
    aadhar:e.aadhar, pan:e.pan, pf:e.pf_no, esic:e.esic_no,
    bank:e.bank_name, accNo:e.account_no, ifsc:e.ifsc, accName:e.account_holder,
    ecName:e.emergency_name, ecRel:e.emergency_relation, ecPhone:e.emergency_phone,
    status:e.status||'active', joined:e.date_of_joining||e.created_at,
    email:'', col:ROLE_COLORS[e.role]||'#37474F',
    photoUrl:e.profile_photo||null, aadharUrl:e.aadhar_doc_url||null, panUrl:e.pan_doc_url||null,
    employee_code:e.employee_code||e.emp_id,
    designation:e.designation||e.role, department:e.department||'',
    emp_type:e.emp_type, work_location:e.work_location,
    profile_photo:e.profile_photo, photo_url:e.photo_url,
    aadhar_doc_url:e.aadhar_doc_url, pan_doc_url:e.pan_doc_url,
    resignation_date:e.resignation_date, last_working_day:e.last_working_day,
    resignation_reason:e.resignation_reason, rejection_reason:e.rejection_reason,
    date_of_joining:e.date_of_joining, emp_id:e.emp_id, id:e.id
  };
}

// ── PENDING APPROVALS (shared) ────────────────────────────
var pendingEmployees = [];

async function loadPendingApprovals() {
  try {
    var data = await sbFetch('employees', { select: '*', filter: 'status=eq.pending', order: 'created_at.asc' });
    pendingEmployees = data || [];
    var count = pendingEmployees.length;
    var card = document.getElementById('pending-approvals-card');
    var countEl = document.getElementById('pending-count');
    if (card && currentUser && (currentUser.role === 'admin' || currentUser.role === 'pm')) {
      card.style.display = count > 0 ? 'block' : 'none';
    }
    if (countEl) countEl.textContent = count;
  } catch(e) { console.error('Pending load error:', e); }
}

function openPendingApprovals() {
  var body = document.getElementById('pending-list-body');
  if (!pendingEmployees.length) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);"><div style="font-size:40px;margin-bottom:10px;">✅</div><div style="font-weight:700;">No pending approvals</div></div>';
  } else {
    body.innerHTML = pendingEmployees.map(function(e, i) {
      var name = ((e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'')).trim();
      return '<div style="padding:14px;border-bottom:1px solid var(--border);cursor:pointer;" onclick="openApprovalDetail(' + i + ')">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div style="width:42px;height:42px;border-radius:12px;background:#FFF3E0;display:flex;align-items:center;justify-content:center;font-size:18px;">👤</div>' +
            '<div><div style="font-size:14px;font-weight:800;">' + name + '</div>' +
            '<div style="font-size:12px;color:var(--text3);margin-top:2px;">' + (e.designation||e.role||'—') + ' · ' + (e.department||'—') + '</div></div>' +
          '</div>' +
          '<div><span class="badge b-amber">Pending</span><div style="font-size:11px;color:var(--blue2);font-weight:700;margin-top:4px;">' + (e.emp_id||'—') + '</div></div>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  openSheet('ov-pending', 'sh-pending');
}

function openApprovalDetail(idx) {
  var e = pendingEmployees[idx]; if (!e) return;
  var name = ((e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'')).trim();
  document.getElementById('approval-det-body').innerHTML =
    '<div style="background:#FFF3E020;border:1px solid #FFE08240;border-radius:14px;padding:14px;margin-bottom:14px;">' +
      '<div style="font-size:17px;font-weight:800;">' + name + '</div>' +
      '<div style="font-size:12px;color:var(--text2);margin-top:2px;">' + (e.designation||e.role||'—') + ' · ' + (e.department||'—') + '</div>' +
      '<div style="margin-top:6px;"><span class="badge b-amber">⏳ Pending</span></div>' +
    '</div>' +
    ir('Employee ID', e.emp_id||'—', true) + ir('Mobile', e.phone||'—') +
    ir('Department', e.department||'—') + ir('Role', e.designation||e.role||'—');
  document.getElementById('approval-det-foot').innerHTML =
    '<button class="btn btn-outline" onclick="closeSheet(\'ov-approval-det\',\'sh-approval-det\')">Cancel</button>' +
    '<button class="btn btn-red" onclick="rejectEmployee(\'' + e.id + '\',\'' + esc(name) + '\')">✗ Reject</button>' +
    '<button class="btn btn-green" onclick="approveEmployee(\'' + e.id + '\',\'' + esc(name) + '\')">✓ Approve</button>';
  openSheet('ov-approval-det', 'sh-approval-det');
}

async function approveEmployee(id, name) {
  try {
    toast('Approving...', 'info');
    await sbUpdate('employees', id, { status: 'active' });
    pendingEmployees = pendingEmployees.filter(function(e) { return e.id !== id; });
    closeSheet('ov-approval-det', 'sh-approval-det');
    loadPendingApprovals();
    openPendingApprovals();
    toast(name + ' approved!', 'success');
    if (typeof USERS !== 'undefined') {
      var emps = await sbFetch('employees', { select: '*', order: 'created_at.desc' });
      USERS = (emps||[]).map(mapEmployee);
      if (typeof renderUsers === 'function') renderUsers();
    }
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function rejectEmployee(id, name) {
  try {
    await sbUpdate('employees', id, { status: 'rejected' });
    pendingEmployees = pendingEmployees.filter(function(e) { return e.id !== id; });
    closeSheet('ov-approval-det', 'sh-approval-det');
    loadPendingApprovals();
    openPendingApprovals();
    toast(name + ' rejected', 'info');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function getNextAIPLId() {
  try {
    var data = await sbFetch('employees', { select: 'emp_id', order: 'created_at.desc' });
    if (!data || !data.length) return 'AIPL-001';
    var max = 0;
    data.forEach(function(e) {
      if (e.emp_id && e.emp_id.startsWith('AIPL-')) {
        var num = parseInt(e.emp_id.replace('AIPL-','')) || 0;
        if (num > max) max = num;
      }
    });
    return 'AIPL-' + String(max + 1).padStart(3, '0');
  } catch(e) { return 'AIPL-T' + String(Date.now()).slice(-6); }
}

// ── INIT ─────────────────────────────────────────────────
setTimeout(function() { showScreen('scr-login'); }, 2200);

function updateDashboardUser() {
  if (!currentUser) return;
  var name = currentUser.name || '—';
  var role = currentUser.access || currentUser.role || '—';
  document.querySelectorAll('#dash-name').forEach(function(el) { el.textContent = name; });
  document.querySelectorAll('#dash-role').forEach(function(el) { el.textContent = role; });
  var hr = new Date().getHours();
  var greeting = hr < 12 ? 'Good morning ☀️' : hr < 17 ? 'Good afternoon 🌤️' : 'Good evening 🌙';
  document.querySelectorAll('.dt-greeting').forEach(function(el) { el.textContent = greeting; });
  var initials = name.split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  document.querySelectorAll('#dash-avatar').forEach(function(el) {
    if (currentUser.photoUrl) {
      el.innerHTML = '<img src="' + currentUser.photoUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">';
    } else {
      el.textContent = initials;
    }
  });
}

// Real-time sync (registry)
var _syncInterval = null;
var _deletedIds = {};
function startSync() { if (typeof loadAllData === 'function') loadAllData(); }
function stopSync() { if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; } }
