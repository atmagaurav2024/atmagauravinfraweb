// ════════════════════════════════════════════════════════════════════════
// SETTINGS.JS — Access Control + Company Details
// ════════════════════════════════════════════════════════════════════════

// ════ ACCESS CONTROL STATE ════════════════════════════════════════════
var AC_TAB = 'emp', AC_TARGET = null, AC_PERMISSIONS = {};
var AC_PCOL = { view:'#1565C0', add:'#2E7D32', edit:'#E65100', delete:'#C62828', cash_in:'#2E7D32', expense:'#E07820', mark:'#00838F' };
var AC_PLBL = { view:'View', add:'Add', edit:'Edit', delete:'Delete', cash_in:'Cash In', expense:'Expense', mark:'Mark Att.' };

var AC_MODS = [
  { key:'dashboard',      label:'Dashboard',          icon:'&#127968;', group:'Dashboard',     params:['view'] },
  { key:'proj-projects',  label:'Projects',           icon:'&#127959;', group:'Project Module', params:['view','add','edit','delete'] },
  { key:'proj-boq',       label:'BOQ Items',          icon:'&#128203;', group:'Project Module', params:['view','add','edit','delete'] },
  { key:'proj-jm',        label:'Joint Measurements', icon:'&#128208;', group:'Project Module', params:['view','add','edit','delete'] },
  { key:'proj-planning',  label:'Planning',           icon:'&#128230;', group:'Project Module', params:['view','add','edit','delete'] },
  { key:'proj-execution', label:'Work Allotment',     icon:'&#128221;', group:'Project Module', params:['view','add','edit','delete'] },
  { key:'emp-active',     label:'Active Employees',   icon:'&#128101;', group:'Employee',       params:['view','add','edit','delete'] },
  { key:'emp-pending',    label:'Pending Approvals',  icon:'&#9203;',   group:'Employee',       params:['view','edit','delete'] },
  { key:'emp-pay',        label:'Pay Fixation',       icon:'&#128178;', group:'Employee',       params:['view','add','edit','delete'] },
  { key:'emp-salary',     label:'Monthly Salary',     icon:'&#128200;', group:'Employee',       params:['view','add','edit','delete'] },
  { key:'emp-increment',  label:'Increment',          icon:'&#128308;', group:'Employee',       params:['view','add','edit','delete'] },
  { key:'emp-transfer',   label:'Transfer',           icon:'&#128260;', group:'Employee',       params:['view','add','edit','delete'] },
  { key:'emp-annual',     label:'Annual Statement',   icon:'&#128196;', group:'Employee',       params:['view','edit','delete'] },
  { key:'emp-downloads',  label:'Downloads',          icon:'&#128229;', group:'Employee',       params:['view'] },
  { key:'emp-resigned',   label:'Resigned Employees', icon:'&#128683;', group:'Employee',       params:['view','edit','delete'] },
  { key:'attendance',     label:'Attendance',         icon:'&#9200;',   group:'Employee',       params:['view','edit','delete'] },
  { key:'accounts',       label:'Accounts',           icon:'&#128176;', group:'Accounting',     params:['view','edit','delete'] },
  { key:'petty-cash',     label:'Petty Cash',         icon:'&#128181;', group:'Accounting',     params:['view','edit','delete'] },
  { key:'access',         label:'Access Control',     icon:'&#128274;', group:'Settings',       params:['view','edit','delete'] },
  { key:'company',        label:'Company Details',    icon:'&#127963;', group:'Settings',       params:['view','edit','delete'] },
  { key:'registry',       label:'Master Registry',    icon:'&#128218;', group:'Settings',       params:['view','edit','delete'] },
];

// ── Permission enforcement ────────────────────────────────────────────
var USER_PERMISSIONS = {};

async function loadUserPermissions() {
  if (!currentUser) return;
  try {
    var empFilter  = 'employee_id=eq.' + currentUser.id;
    var roleFilter = 'role=eq.' + (currentUser.access || currentUser.role || '');
    var results = await Promise.all([
      sbFetch('access_permissions', { select: '*', filter: empFilter }),
      sbFetch('access_permissions', { select: '*', filter: roleFilter }),
    ]);
    USER_PERMISSIONS = {};
    if (Array.isArray(results[1])) results[1].forEach(function(r) {
      if (!USER_PERMISSIONS[r.module]) USER_PERMISSIONS[r.module] = {};
      USER_PERMISSIONS[r.module][r.permission] = r.granted;
    });
    if (Array.isArray(results[0])) results[0].forEach(function(r) {
      if (!USER_PERMISSIONS[r.module]) USER_PERMISSIONS[r.module] = {};
      USER_PERMISSIONS[r.module][r.permission] = r.granted;
    });
  } catch (e) {
    USER_PERMISSIONS = {};
    console.warn('loadUserPermissions: table may not exist yet', e);
  }
  if (typeof applyDrawerPermissions === 'function') applyDrawerPermissions();
}

function canAccess(module, permission) {
  if (currentUser && currentUser.role === 'admin') return true;
  if (!Object.keys(USER_PERMISSIONS).length) return true;
  var mp = USER_PERMISSIONS[module];
  if (!mp) return false;
  return mp[permission || 'view'] === true;
}

function getEmpDataScope() {
  if (!currentUser || currentUser.role === 'admin') return 'all';
  if (!Object.keys(USER_PERMISSIONS).length) return 'all';
  var mp = USER_PERMISSIONS['emp-data-scope'];
  if (!mp) return 'all';
  if (mp['self'] === true) return 'self';
  if (mp['department'] === true) return 'department';
  return 'all';
}

// ════ ACCESS CONTROL MODULE ══════════════════════════════════════════
function initAccess() { acInitModule(); }

async function acInitModule() {
  if (!currentUser || currentUser.role !== 'admin') {
    var ml = document.getElementById('ac-modules-list');
    if (ml) ml.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:40px;">&#128274;</div><div style="font-weight:800;color:var(--navy);margin-top:10px;">Admin Only</div></div>';
    return;
  }
  AC_TAB = 'emp'; AC_TARGET = null; AC_PERMISSIONS = {};
  var eb = document.getElementById('ac-tab-emp'), rb = document.getElementById('ac-tab-role');
  if (eb) { eb.style.background = 'var(--navy)'; eb.style.color = 'white'; eb.style.border = 'none'; }
  if (rb) { rb.style.background = 'white'; rb.style.color = 'var(--text2)'; rb.style.border = '1.5px solid var(--border)'; }
  var sd  = document.getElementById('ac-selector');
  var sel = document.getElementById('ac-emp-sel');
  if (!sel && sd) {
    sd.innerHTML = '<select id="ac-emp-sel" class="fsel" style="width:100%;" onchange="acLoadPerms()"><option value="">&#9203; Loading employees...</option></select>';
  }
  var ml = document.getElementById('ac-modules-list');
  if (ml) ml.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">Select an employee to manage permissions</div>';
  await acEmpLoad();
}

async function acSwitchTab(tab) {
  AC_TAB = tab; AC_TARGET = null; AC_PERMISSIONS = {};
  var eb = document.getElementById('ac-tab-emp'), rb = document.getElementById('ac-tab-role');
  var sd = document.getElementById('ac-selector');
  var ml = document.getElementById('ac-modules-list');
  if (tab === 'emp') {
    if (eb) { eb.style.background = 'var(--navy)'; eb.style.color = 'white'; eb.style.border = 'none'; }
    if (rb) { rb.style.background = 'white'; rb.style.color = 'var(--text2)'; rb.style.border = '1.5px solid var(--border)'; }
    if (sd) sd.innerHTML = '<select id="ac-emp-sel" class="fsel" style="width:100%;" onchange="acLoadPerms()"><option value="">&#9203; Loading employees...</option></select>';
    if (ml) ml.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">Select an employee to manage permissions</div>';
    await acEmpLoad();
  } else {
    if (rb) { rb.style.background = 'var(--navy)'; rb.style.color = 'white'; rb.style.border = 'none'; }
    if (eb) { eb.style.background = 'white'; eb.style.color = 'var(--text2)'; eb.style.border = '1.5px solid var(--border)'; }
    if (sd) sd.innerHTML = '<select id="ac-role-sel" class="fsel" style="width:100%;" onchange="acLoadPerms()"><option value="">&#9203; Loading roles...</option></select>';
    if (ml) ml.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">Select a role to manage permissions</div>';
    await acRoleLoad();
  }
}

async function acEmpLoad() {
  var sel = document.getElementById('ac-emp-sel');
  if (!sel) return;
  sel.innerHTML = '<option value="">&#9203; Loading employees...</option>';
  try {
    var rows = await sbFetch('employees', {
      select: 'id,first_name,middle_name,last_name,emp_id,employee_code',
      filter: 'status=eq.active',
      order:  'first_name.asc',
    });
    if (!Array.isArray(rows) || !rows.length) {
      sel.innerHTML = '<option value="">— No active employees found —</option>';
      return;
    }
    sel.innerHTML = '<option value="">— Select Employee —</option>' +
      rows.map(function(e) {
        var n = ((e.first_name || '') + (e.middle_name ? ' ' + e.middle_name : '') + (e.last_name ? ' ' + e.last_name : '')).trim() || 'Unknown';
        var code = e.employee_code || e.emp_id || '';
        return '<option value="' + e.id + '">' + n + (code ? ' (' + code + ')' : '') + '</option>';
      }).join('');
  } catch (err) {
    console.error('acEmpLoad:', err);
    sel.innerHTML = '<option value="">— Error: ' + err.message + '—</option>';
  }
}

async function acRoleLoad() {
  var sel = document.getElementById('ac-role-sel');
  if (!sel) return;
  sel.innerHTML = '<option value="">&#9203; Loading roles...</option>';
  try {
    var rows  = await sbFetch('categories', { select: 'name', filter: 'type=eq.role&active=eq.true', order: 'name.asc' });
    var roles = Array.isArray(rows) ? rows.map(function(r) { return r.name; }) : [];
    if (!roles.length) {
      var emps = await sbFetch('employees', { select: 'designation', filter: 'status=eq.active' });
      if (Array.isArray(emps)) {
        var seen = {};
        emps.forEach(function(e) { if (e.designation) seen[e.designation] = true; });
        roles = Object.keys(seen).sort();
      }
    }
    sel.innerHTML = roles.length
      ? '<option value="">— Select Role —</option>' + roles.map(function(r) { return '<option value="' + r + '">' + r + '</option>'; }).join('')
      : '<option value="">— No roles found —</option>';
  } catch (err) {
    console.error('acRoleLoad:', err);
    sel.innerHTML = '<option value="">— Error loading roles —</option>';
  }
}

async function acLoadPerms() {
  var selId = AC_TAB === 'emp' ? 'ac-emp-sel' : 'ac-role-sel';
  var sel   = document.getElementById(selId);
  if (!sel || !sel.value) {
    document.getElementById('ac-modules-list').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">Select employee or role</div>';
    var defRadio = document.querySelector('input[name="ac-emp-scope"][value="all"]');
    if (defRadio) defRadio.checked = true;
    return;
  }
  AC_TARGET = sel.value;
  try {
    var filter = AC_TAB === 'emp' ? 'employee_id=eq.' + AC_TARGET : 'role=eq.' + AC_TARGET;
    var rows   = await sbFetch('access_permissions', { select: '*', filter: filter });
    AC_PERMISSIONS = {};
    if (Array.isArray(rows)) rows.forEach(function(r) {
      if (!AC_PERMISSIONS[r.module]) AC_PERMISSIONS[r.module] = {};
      AC_PERMISSIONS[r.module][r.permission] = r.granted;
      if (r.module === 'emp-data-scope') {
        var radio = document.querySelector('input[name="ac-emp-scope"][value="' + r.permission + '"]');
        if (radio) radio.checked = true;
      }
    });
    if (!AC_PERMISSIONS['emp-data-scope']) {
      var defR = document.querySelector('input[name="ac-emp-scope"][value="all"]');
      if (defR) defR.checked = true;
    }
  } catch (e) { AC_PERMISSIONS = {}; }
  acRenderMods();
}

function acLoadPermissions() { acLoadPerms(); }

function acRenderMods() {
  var el = document.getElementById('ac-modules-list');
  if (!el) return;
  var groups = {}, groupOrder = [];
  AC_MODS.forEach(function(mod) {
    var g = mod.group || 'Other';
    if (!groups[g]) { groups[g] = []; groupOrder.push(g); }
    groups[g].push(mod);
  });
  var gCol = { 'Dashboard':'#1565C0', 'Project Module':'#2E7D32', 'Employee':'#E65100', 'Accounting':'#880E4F', 'Settings':'#4A148C', 'Other':'#37474F' };
  el.innerHTML = groupOrder.map(function(grp) {
    var col = gCol[grp] || '#37474F';
    var modsHTML = groups[grp].map(function(mod) {
      var mp = AC_PERMISSIONS[mod.key] || {};
      var pBoxes = mod.params.map(function(p) {
        var chk = mp[p] === true;
        var pc  = AC_PCOL[p] || '#37474F';
        return '<label style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;cursor:pointer;border:1.5px solid ' + (chk ? pc : 'var(--border)') + ';background:' + (chk ? pc + '15' : 'transparent') + ';margin-bottom:4px;">' +
          '<input type="checkbox" ' + (chk ? 'checked' : '') + ' onchange="acToggle(\'' + mod.key + '\',\'' + p + '\',this)" style="width:16px;height:16px;accent-color:' + pc + ';">' +
          '<span style="font-size:12px;font-weight:700;color:' + (chk ? pc : 'var(--text3)') + ';">' + AC_PLBL[p] + '</span></label>';
      }).join('');
      return '<div style="background:white;border-radius:12px;border:1px solid var(--border);margin-bottom:8px;overflow:hidden;">' +
        '<div style="padding:10px 14px;background:#F8FAFC;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">' +
          '<span style="font-size:16px;">' + mod.icon + '</span>' +
          '<span style="font-size:13px;font-weight:800;color:var(--navy);">' + mod.label + '</span></div>' +
        '<div style="padding:10px 14px;display:flex;flex-wrap:wrap;gap:8px;">' + pBoxes + '</div></div>';
    }).join('');
    return '<div style="margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<div style="width:4px;height:20px;background:' + col + ';border-radius:2px;"></div>' +
        '<span style="font-size:11px;font-weight:900;color:' + col + ';text-transform:uppercase;letter-spacing:1px;">' + grp + '</span>' +
        '<div style="flex:1;height:1px;background:' + col + '25;"></div></div>' +
      modsHTML + '</div>';
  }).join('');
}

function acToggle(modKey, param, chk) {
  if (!AC_PERMISSIONS[modKey]) AC_PERMISSIONS[modKey] = {};
  AC_PERMISSIONS[modKey][param] = chk.checked;
}

async function acSavePermissions() {
  if (!AC_TARGET) { toast('Select employee or role first', 'warning'); return; }
  toast('Saving permissions...', 'info');
  try {
    var inserts = [];
    AC_MODS.forEach(function(mod) {
      var mp = AC_PERMISSIONS[mod.key] || {};
      mod.params.forEach(function(p) {
        inserts.push({
          target_type:  AC_TAB,
          employee_id:  AC_TAB === 'emp' ? AC_TARGET : null,
          role:         AC_TAB === 'role' ? AC_TARGET : null,
          module:       mod.key,
          permission:   p,
          granted:      mp[p] === true,
        });
      });
    });
    var scopeRadio = document.querySelector('input[name="ac-emp-scope"]:checked');
    var scope = scopeRadio ? scopeRadio.value : 'all';
    inserts.push({
      target_type: AC_TAB,
      employee_id: AC_TAB === 'emp' ? AC_TARGET : null,
      role:        AC_TAB === 'role' ? AC_TARGET : null,
      module:      'emp-data-scope',
      permission:  scope,
      granted:     true,
    });
    var filter = AC_TAB === 'emp' ? 'employee_id=eq.' + AC_TARGET : 'role=eq.' + AC_TARGET;
    await fetch(SUPABASE_URL + '/rest/v1/access_permissions?' + filter, {
      method:  'DELETE',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
    });
    var res = await fetch(SUPABASE_URL + '/rest/v1/access_permissions', {
      method:  'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body:    JSON.stringify(inserts),
    });
    if (!res.ok) {
      var err = await res.text();
      if (err.includes('relation') || err.includes('does not exist')) {
        toast('Table "access_permissions" not found. Run SQL to create it.', 'error');
        return;
      }
      throw new Error(err);
    }
    toast('\u2713 Permissions saved for ' + (AC_TAB === 'emp' ? 'employee' : 'role') + '!', 'success');
    if (AC_TAB === 'emp' && currentUser && AC_TARGET === currentUser.id) {
      await loadUserPermissions();
    }
  } catch (e) { toast('Error saving: ' + e.message, 'error'); console.error(e); }
}

// ════ COMPANY DETAILS ════════════════════════════════════════════════
var COMPANY_DATA = {};

async function initCompany() {
  var body = document.getElementById('company-body');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">Loading...</div>';
  try {
    var rows = await sbFetch('company_details', { select: '*', order: 'id.asc' });
    COMPANY_DATA = (Array.isArray(rows) && rows.length) ? rows[0] : {};
  } catch (e) { COMPANY_DATA = {}; }
  companyRender();
}

function companyRender() {
  var d    = COMPANY_DATA;
  var body = document.getElementById('company-body');

  function finp(id, label, val, placeholder, type) {
    type = type || 'text';
    return '<div><label class="flbl">' + label + '</label>' +
      '<input id="co-' + id + '" class="finp" type="' + type + '" placeholder="' + (placeholder || '') + '" value="' + (val || '') + '"></div>';
  }
  function sec(icon, label, color) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:10px 0 6px;border-bottom:2px solid ' + color + '20;margin:14px 0 10px;">' +
      '<div style="width:28px;height:28px;border-radius:8px;background:' + color + '20;display:flex;align-items:center;justify-content:center;font-size:14px;">' + icon + '</div>' +
      '<div style="font-size:12px;font-weight:800;color:' + color + ';text-transform:uppercase;letter-spacing:.7px;">' + label + '</div>' +
    '</div>';
  }
  function docBox(id, label, url, hint) {
    var hasDoc = !!url;
    return '<div style="margin-bottom:12px;">' +
      '<label class="flbl">' + label + '</label>' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div class="upload-box" style="flex:1;min-height:48px;padding:10px;" onclick="document.getElementById(\'co-file-' + id + '\').click()">' +
          '<input type="file" id="co-file-' + id + '" accept="image/*,application/pdf" style="display:none;" onchange="companyHandleDoc(\'' + id + '\',this)">' +
          (hasDoc
            ? '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:18px;">&#128196;</span><div><div style="font-size:12px;font-weight:700;color:#1B5E20;">Uploaded</div><div style="font-size:10px;color:var(--text3);">Tap to replace</div></div></div>'
            : '<div style="font-size:12px;color:var(--text3);">&#128206; ' + (hint || 'Tap to upload PDF or image') + '</div>'
          ) +
        '</div>' +
        (hasDoc ? '<a href="' + url + '" target="_blank" style="background:#E3F2FD;color:#1565C0;border-radius:8px;padding:10px 14px;font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap;">&#128065; View</a>' : '') +
      '</div>' +
      '<div id="co-doc-status-' + id + '" style="font-size:11px;color:#2E7D32;margin-top:3px;display:none;">&#10003; New file selected</div>' +
    '</div>';
  }

  body.innerHTML =
    sec('&#127968;', 'Company Information', '#1565C0') +
    '<div class="g2">' + finp('name','Company Name',d.name,'e.g. Atmagaurav Infra Pvt. Ltd.') + finp('type','Company Type',d.type,'e.g. Private Limited') + '</div>' +
    '<label class="flbl">Registered Address</label>' +
    '<textarea id="co-address" class="ftxt" rows="3" placeholder="Full registered address...">' + (d.address || '') + '</textarea>' +
    '<label class="flbl">Corporate / Office Address (if different)</label>' +
    '<textarea id="co-address2" class="ftxt" rows="2" placeholder="Corporate office address...">' + (d.address2 || '') + '</textarea>' +
    '<div class="g2">' + finp('email','Email',d.email,'','email') + finp('phone','Phone',d.phone,'+91 XXXXX XXXXX','tel') + '</div>' +
    finp('website','Website',d.website,'https://www.yourcompany.com') +

    sec('&#128203;', 'Registration Numbers', '#6A1B9A') +
    '<div class="g2">' + finp('cin','CIN Number',d.cin,'e.g. U45200MH2010PTC123456') + finp('pan','PAN Number',d.pan,'e.g. AAACC1234D') + '</div>' +
    '<div class="g2">' + finp('gstin','GST Number (GSTIN)',d.gstin,'e.g. 27AAACC1234D1ZV') + finp('tan','TAN Number',d.tan,'e.g. MUMX12345A') + '</div>' +
    '<div class="g2">' + finp('udyam','Udyam Registration No.',d.udyam,'e.g. UDYAM-MH-00-0000000') + finp('shop_act','Shop Act Certificate No.',d.shop_act,'e.g. MH/MUM/2023/XXXXX') + '</div>' +
    '<div class="g2">' + finp('esic_code','ESIC Code Number',d.esic_code,'e.g. 11001234560000101') + finp('pf_code','PF / EPF Code',d.pf_code,'e.g. MH/MUM/0123456/000') + '</div>' +
    finp('msme','MSME / Udyog Aadhaar',d.msme,'e.g. MH01E0000000') +

    sec('&#128206;', 'Statutory Documents', '#1B5E20') +
    docBox('cin_doc','Certificate of Incorporation',d.cin_doc_url) +
    docBox('pan_doc','PAN Card',d.pan_doc_url) +
    docBox('gst_doc','GST Registration Certificate',d.gst_doc_url) +
    docBox('tan_doc','TAN Allotment Letter',d.tan_doc_url) +
    docBox('udyam_doc','Udyam / MSME Certificate',d.udyam_doc_url) +
    docBox('shop_act_doc','Shop Act Certificate',d.shop_act_doc_url) +
    docBox('esic_doc','ESIC Registration Certificate',d.esic_doc_url) +
    docBox('pf_doc','PF Registration Certificate',d.pf_doc_url) +

    sec('&#127981;', 'Company Bank Details', '#C62828') +
    '<div class="g2">' + finp('bank_name','Bank Name',d.bank_name,'e.g. State Bank of India') + finp('bank_branch','Branch',d.bank_branch,'Branch name') + '</div>' +
    '<div class="g2">' + finp('bank_acc','Account Number',d.bank_acc,'Company bank account no.') + finp('bank_ifsc','IFSC Code',d.bank_ifsc,'e.g. SBIN0001234') + '</div>' +
    finp('bank_acc_name','Account Holder Name',d.bank_acc_name,'As per bank records') +
    docBox('cheque_doc','Cancelled Cheque',d.cheque_doc_url,'Upload Cancelled Cheque');
}

var COMPANY_PENDING_DOCS = {};

function companyHandleDoc(id, input) {
  if (!input.files || !input.files[0]) return;
  COMPANY_PENDING_DOCS[id] = input.files[0];
  var status = document.getElementById('co-doc-status-' + id);
  if (status) { status.style.display = 'block'; status.textContent = '\u2713 ' + input.files[0].name + ' \u2014 ready to upload'; }
}

async function companySave() {
  var btn = document.querySelector('#app-company button[onclick="companySave()"]');
  if (btn) { btn.textContent = '\u23f3 Saving...'; btn.disabled = true; }
  try {
    var data = {
      name:         (document.getElementById('co-name')        || {}).value || null,
      type:         (document.getElementById('co-type')        || {}).value || null,
      address:      (document.getElementById('co-address')     || {}).value || null,
      address2:     (document.getElementById('co-address2')    || {}).value || null,
      email:        (document.getElementById('co-email')       || {}).value || null,
      phone:        (document.getElementById('co-phone')       || {}).value || null,
      website:      (document.getElementById('co-website')     || {}).value || null,
      cin:          (document.getElementById('co-cin')         || {}).value || null,
      pan:          (document.getElementById('co-pan')         || {}).value || null,
      gstin:        (document.getElementById('co-gstin')       || {}).value || null,
      tan:          (document.getElementById('co-tan')         || {}).value || null,
      udyam:        (document.getElementById('co-udyam')       || {}).value || null,
      shop_act:     (document.getElementById('co-shop_act')    || {}).value || null,
      esic_code:    (document.getElementById('co-esic_code')   || {}).value || null,
      pf_code:      (document.getElementById('co-pf_code')     || {}).value || null,
      msme:         (document.getElementById('co-msme')        || {}).value || null,
      bank_name:    (document.getElementById('co-bank_name')   || {}).value || null,
      bank_branch:  (document.getElementById('co-bank_branch') || {}).value || null,
      bank_acc:     (document.getElementById('co-bank_acc')    || {}).value || null,
      bank_ifsc:    (document.getElementById('co-bank_ifsc')   || {}).value || null,
      bank_acc_name:(document.getElementById('co-bank_acc_name')|| {}).value || null,
    };
    var docFields = {
      cin_doc:'cin_doc_url', pan_doc:'pan_doc_url', gst_doc:'gst_doc_url',
      tan_doc:'tan_doc_url', udyam_doc:'udyam_doc_url', shop_act_doc:'shop_act_doc_url',
      esic_doc:'esic_doc_url', pf_doc:'pf_doc_url', cheque_doc:'cheque_doc_url',
    };
    var docKeys = Object.keys(COMPANY_PENDING_DOCS);
    if (docKeys.length) {
      toast('Uploading ' + docKeys.length + ' document(s)...', 'info');
      for (var i = 0; i < docKeys.length; i++) {
        var key   = docKeys[i];
        var field = docFields[key];
        if (field) {
          var url = await uploadToCloudinary(COMPANY_PENDING_DOCS[key], 'company_docs', 'co-file-' + key);
          if (url) data[field] = url;
        }
      }
    }
    if (COMPANY_DATA && COMPANY_DATA.id) {
      await sbUpdate('company_details', COMPANY_DATA.id, data);
      COMPANY_DATA = Object.assign(COMPANY_DATA, data);
    } else {
      var res = await sbInsert('company_details', data);
      if (res && res[0]) COMPANY_DATA = res[0];
    }
    COMPANY_PENDING_DOCS = {};
    toast('Company details saved!', 'success');
    companyRender();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    console.error(e);
  } finally {
    if (btn) { btn.textContent = '\u{1F4BE} Save'; btn.disabled = false; }
  }
}

// ── Company helper functions ─────────────────────────────────────────
function coGet(field, fallback)  { return (COMPANY_DATA && COMPANY_DATA[field]) || fallback || ''; }
function coName()  { return coGet('name',   'Atmagaurav Infra Pvt. Ltd.'); }
function coAddr()  { return coGet('address', ''); }
function coCIN()   { return coGet('cin',     ''); }
function coGST()   { return coGet('gstin',   ''); }
function coPAN()   { return coGet('pan',     ''); }
function coPhone() { return coGet('phone',   ''); }
function coEmail() { return coGet('email',   ''); }

async function preloadCompanyData() {
  try {
    var rows = await sbFetch('company_details', { select: '*', order: 'id.asc' });
    COMPANY_DATA = (Array.isArray(rows) && rows.length) ? rows[0] : {};
  } catch (e) { COMPANY_DATA = {}; }
}

function applyDrawerPermissions() {
  if (!currentUser || currentUser.role === 'admin' || !Object.keys(USER_PERMISSIONS).length) return;
  var checks = {
    dashboard:    function() { return canAccess('dashboard','view'); },
    projects:     function() { return ['projects','boq','jm','planning','execution'].some(function(t){return canAccess('proj-'+t,'view');}); },
    employees:    function() { return Object.keys(EMP_TAB_KEYS||{}).some(function(t){return canAccess((EMP_TAB_KEYS||{})[t],'view');}); },
    attendance:   function() { return canAccess('attendance','view'); },
    accounts:     function() { return canAccess('accounts','view'); },
    'petty-cash': function() { return canAccess('petty-cash','view'); },
    access:       function() { return canAccess('access','view'); },
    company:      function() { return canAccess('company','view'); },
    registry:     function() { return canAccess('registry','view'); },
  };
  document.querySelectorAll('.drawer-item[onclick]').forEach(function(item) {
    var match = (item.getAttribute('onclick') || '').match(/showApp\('([^']+)'\)/);
    if (!match) return;
    var mod    = match[1];
    var checkFn = checks[mod];
    if (checkFn) item.style.display = checkFn() ? '' : 'none';
  });
  document.querySelectorAll('.drawer-section').forEach(function(sec) {
    var next = sec.nextElementSibling;
    var hasVisible = false;
    while (next && !next.classList.contains('drawer-section')) {
      if (next.classList.contains('drawer-item') && next.style.display !== 'none') hasVisible = true;
      next = next.nextElementSibling;
    }
    sec.style.display = hasVisible ? '' : 'none';
  });
}
