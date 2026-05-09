// ═══════════════════════════════════════════
// AUTH.JS — Login, Registration, OTP
// ═══════════════════════════════════════════

var REGISTRATIONS = [];
var regStep = 1, regData = {}, otpSource = 'login';
var timer = 30, timerInt, showPass = false, remembered = true;

function togglePass() {
  showPass = !showPass;
  document.getElementById('inp-pass').type = showPass ? 'text' : 'password';
  document.getElementById('pass-ic').textContent = showPass ? '👁' : '👁';
}

function toggleRemember() {
  remembered = !remembered;
  var b = document.getElementById('remember-box');
  b.style.background = remembered ? 'var(--blue)' : 'transparent';
  b.style.borderColor = remembered ? 'var(--blue)' : 'var(--border)';
  b.textContent = remembered ? '✓' : '';
}

async function doLogin() {
  var pw = document.getElementById('inp-pass').value;
  var ph = document.getElementById('inp-phone').value.trim();
  if (!ph) { toast('Please enter your mobile number', 'warning'); return; }
  if (!pw) { toast('Please enter your password', 'warning'); return; }
  try {
    var splashMsg = document.getElementById('splash-msg');
    if (splashMsg) splashMsg.textContent = 'Signing in...';
    showScreen('scr-splash');
    var result = await authSignIn(ph, pw);
    if (result.access_token) {
      currentSession = result;
      var mobile = ph.replace(/[^0-9]/g, '');
      if (splashMsg) splashMsg.textContent = 'Loading your profile...';
      var emps = await sbFetch('employees', { select: '*', filter: 'phone=like.*' + mobile.slice(-10) + '*' });
      if (emps && emps.length) {
        var emp = emps[0];
        if (emp.status === 'pending') { showScreen('scr-pending'); document.getElementById('pending-ref-id').textContent = 'Ref: ' + (emp.emp_id||'—'); toast('Your account is pending approval', 'warning'); return; }
        if (emp.status === 'inactive' || emp.status === 'rejected') { toast('Your account is not active. Contact admin.', 'error'); showScreen('scr-login'); return; }
        currentUser = mapEmployee(emp);
        currentUser.accessToken = result.access_token;
      } else {
        currentUser = { name:'Admin', role:'admin', access:'Admin', dept:'Management', accessToken:result.access_token };
      }
      updateDashboardUser();
      showApp('dashboard');
      loadPendingApprovals();
      loadUserPermissions();
      toast('Welcome back, ' + currentUser.name + '!', 'success');
    } else {
      showScreen('scr-login');
      toast('Wrong mobile number or password', 'error');
    }
  } catch(e) { showScreen('scr-login'); toast('Connection error. Check internet.', 'error'); console.error(e); }
}

// ── REGISTRATION ──────────────────────────────────────────
function initRegister() { regStep = 1; regData = {}; renderRegStep(); showScreen('scr-register'); }

function renderRegStep() {
  var body = document.getElementById('reg-body');
  var foot = document.getElementById('reg-foot');
  if (regStep === 1) {
    body.innerHTML =
      '<div style="font-size:13px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px;">Step 1 of 3 — Select Category</div>' +
      '<div class="cat-grid" id="cat-grid">' +
        '<div class="cat-item" onclick="selCat(this,\'employee\')"><div class="cat-ic">👤</div><div class="cat-name">Employee</div><div class="cat-desc">AIPL Staff</div></div>' +
        '<div class="cat-item" onclick="selCat(this,\'subcontractor\')"><div class="cat-ic">🔧</div><div class="cat-name">Subcontractor</div><div class="cat-desc">SC Company</div></div>' +
        '<div class="cat-item" onclick="selCat(this,\'labour\')"><div class="cat-ic">👷</div><div class="cat-name">Labour</div><div class="cat-desc">Labour Contractor</div></div>' +
      '</div>';
    foot.innerHTML =
      '<button class="btn btn-outline" style="margin:0;flex:0 0 auto;width:auto;padding:14px 20px;" onclick="showScreen(\'scr-login\')">Cancel</button>' +
      '<button class="btn-primary" style="margin:0;flex:1;" onclick="nextRegStep()">Next →</button>';
  } else if (regStep === 2) {
    body.innerHTML =
      '<div class="g2"><div><label class="flbl">First Name</label><input id="r-fname" class="finp" placeholder="First name"></div>' +
      '<div><label class="flbl">Last Name</label><input id="r-lname" class="finp" placeholder="Last name"></div></div>' +
      '<label class="flbl">Mobile Number</label><input id="r-phone" class="finp" type="tel" placeholder="+91 XXXXX XXXXX">' +
      '<label class="flbl">Email Address</label><input id="r-email" class="finp" type="email" placeholder="email@company.com">' +
      (regData.category === 'employee' ?
        '<label class="flbl">Set Password</label><input id="r-password" class="finp" type="password" placeholder="Min 6 characters">' +
        '<label class="flbl">Confirm Password</label><input id="r-conf-pass" class="finp" type="password" placeholder="Re-enter password">' :
        '<label class="flbl">Company Name</label><input id="r-company" class="finp" placeholder="Registered company name">' +
        '<label class="flbl">GST Number</label><input id="r-gst" class="finp" placeholder="27XXXXX0000X1ZX">'
      ) +
      '<label class="flbl">Project</label><select id="r-project" class="fsel"><option value="All Projects">All Projects</option></select>';
    foot.innerHTML =
      '<button class="btn btn-outline" style="margin:0;flex:0 0 auto;width:auto;padding:14px 20px;" onclick="prevRegStep()">← Back</button>' +
      '<button class="btn-primary" style="margin:0;flex:1;" onclick="nextRegStep()">Next →</button>';
    regLoadDropdowns();
  } else if (regStep === 3) {
    body.innerHTML =
      '<div class="card"><div class="card-title">Confirm Your Details</div>' +
      reviewRow('Category', ({employee:'Employee',subcontractor:'Subcontractor',labour:'Labour Contractor'}[regData.category]||'')) +
      reviewRow('Name', regData.name) + reviewRow('Mobile', regData.phone) + reviewRow('Project', regData.project) +
      '</div>';
    foot.innerHTML =
      '<button class="btn btn-outline" style="margin:0;flex:0 0 auto;width:auto;padding:14px 20px;" onclick="prevRegStep()">← Back</button>' +
      '<button class="btn-primary" style="margin:0;flex:1;" onclick="submitReg()">📤 Submit & Verify OTP</button>';
  }
  document.getElementById('reg-foot').style.display = 'flex';
}

function reviewRow(label, val) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);">' +
    '<span style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">' + label + '</span>' +
    '<span style="font-size:13px;font-weight:800;">' + val + '</span></div>';
}

async function regLoadDropdowns() {
  try {
    var projs = await sbFetch('projects', { select: 'id,name', order: 'name.asc' });
    var ps = document.getElementById('r-project');
    if (ps && Array.isArray(projs)) {
      ps.innerHTML = '<option value="All Projects">All Projects</option>' +
        projs.map(function(p) { return '<option value="' + p.name + '">' + p.name + '</option>'; }).join('');
    }
  } catch(e) { console.warn('regLoadDropdowns:', e); }
}

function selCat(el, cat) {
  document.querySelectorAll('#cat-grid .cat-item').forEach(function(c) { c.classList.remove('on'); });
  el.classList.add('on'); regData.category = cat;
}

function nextRegStep() {
  if (regStep === 1) { if (!regData.category) { toast('Please select a category', 'warning'); return; } regStep = 2; }
  else if (regStep === 2) {
    var fname = gv('r-fname'), lname = gv('r-lname');
    if (!fname || !lname) { toast('Please enter your full name', 'warning'); return; }
    var phone = gv('r-phone'); if (!phone) { toast('Mobile number is required', 'warning'); return; }
    if (regData.category === 'employee') {
      var pw = gv('r-password');
      if (!pw || pw.length < 6) { toast('Password must be at least 6 characters', 'warning'); return; }
      if (pw !== gv('r-conf-pass')) { toast('Passwords do not match', 'warning'); return; }
      regData.password = pw;
    }
    regData.name = (fname + ' ' + lname).trim(); regData.phone = phone;
    regData.email = gv('r-email'); regData.company = gv('r-company') || 'AIPL';
    regData.gst = gv('r-gst') || ''; regData.project = gv('r-project') || 'All Projects';
    regStep = 3;
  } else { return; }
  renderRegStep();
}

function prevRegStep() { if (regStep > 1) { regStep--; renderRegStep(); } }

function submitReg() {
  otpSource = 'register';
  document.getElementById('otp-sub').textContent = 'OTP sent to ' + regData.phone;
  ['otp-1','otp-2','otp-3','otp-4','otp-5','otp-6'].forEach(function(id) { document.getElementById(id).value = ''; });
  startTimer(); showScreen('scr-otp');
}

async function verifyOTP() {
  var code = ['otp-1','otp-2','otp-3','otp-4','otp-5','otp-6'].map(function(id) { return document.getElementById(id).value; }).join('');
  if (code.length < 6) { toast('Enter all 6 digits', 'warning'); return; }
  if (otpSource === 'register') {
    var newEmpId = await getNextAIPLId();
    var data = {
      emp_id: newEmpId, badge_no: newEmpId,
      first_name: regData.name.split(' ')[0] || '', last_name: regData.name.split(' ').slice(1).join(' ') || '',
      phone: regData.phone, role: 'viewer', designation: 'Staff', department: '', status: 'pending'
    };
    try {
      toast('Creating account...', 'info');
      if (regData.password && regData.phone) {
        try { await authSignUp(regData.phone, regData.password); } catch(ae) { console.warn('auth signup:', ae); }
      }
      var result = await sbInsert('employees', data);
      if (result && result[0]) {
        document.getElementById('pending-ref-id').textContent = 'Ref: ' + (result[0].emp_id || newEmpId);
        showScreen('scr-pending');
        toast('Registration submitted! Awaiting admin approval.', 'success');
      } else { toast('Submission failed. Try again.', 'error'); }
    } catch(e) { toast('Error: ' + e.message, 'error'); console.error(e); }
  } else {
    showApp('dashboard');
    toast('Welcome back!', 'success');
  }
}

function otpNext(el, nxt) { if (el.value && document.getElementById(nxt)) document.getElementById(nxt).focus(); }

function startTimer() {
  clearInterval(timerInt); timer = 30;
  document.getElementById('resend-timer').textContent = 'Resend in 30s';
  timerInt = setInterval(function() {
    if (timer > 0) { timer--; document.getElementById('resend-timer').textContent = 'Resend in ' + timer + 's'; }
    else { document.getElementById('resend-timer').textContent = "Didn't receive it?"; clearInterval(timerInt); }
  }, 1000);
}
