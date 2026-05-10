// 🔒 EMPLOYEE MANAGEMENT MODULE — LOCKED
// Do NOT modify any code in this section without explicit user approval.
// Any changes require user confirmation before implementation.
// ════════════════════════════════════════════════════════════════
var EMP_LIST=[], EMP_PAY=[], EMP_TAB='active', EMP_EDIT_ID=null;

var EMP_DEPTS=['Site','Finance','HR/Admin','QC/Safety','Procurement','Planning','Management','Other'];
var EMP_GRADES=['Grade-1','Grade-2','Grade-3','Grade-4','Grade-5','Manager','Sr. Manager','DGM','GM','Other'];
var EMP_CATS=['Permanent','Contract','Probation','Daily Wage','Consultant'];
var EMP_ROLES=['Admin','Project Manager','Site Engineer','Junior Engineer','QC Engineer','Safety Officer','Finance / Accounts','HR / Admin','Viewer (Read Only)','Surveyor','Store Keeper','Driver','Labour','Other'];

function openEmpSheet(){openSheet('ov-emp','sh-emp');}
function closeEmpSheet(){closeSheet('ov-emp','sh-emp');}


// Global date formatter: YYYY-MM-DD -> DD/MM/YYYY
function fmtDate(d){
  if(!d||d==='\u2014') return d||'\u2014';
  var m=String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[3]+'/'+m[2]+'/'+m[1];
  try{
    var dt=new Date(d);
    if(!isNaN(dt)){
      return String(dt.getDate()).padStart(2,'0')+'/'+
             String(dt.getMonth()+1).padStart(2,'0')+'/'+dt.getFullYear();
    }
  }catch(ex){}
  return d;
}

async function initEmpMgmt(){
  var el=document.getElementById('emp-content');
  if(el)el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">&#9203; Loading...</div>';

  try{
    // Smart caching — skip DB fetch if already loaded
    var needEmps = !EMP_LIST.length;
    // Always re-fetch EMP_PAY to avoid stale cache hiding existing records
    var needPay  = true;

    if(needEmps || needPay){
      var fetches = [
        needEmps
          ? sbFetch('employees',{select:'*', order:'created_at.desc'})
          : Promise.resolve(null),
        needPay
          ? sbFetch('employee_pay',{select:'*',order:'effective_date.desc'})
          : Promise.resolve(null)
      ];
      var r = await Promise.all(fetches);
      if(r[0]!==null) EMP_LIST = Array.isArray(r[0]) ? r[0] : [];
      if(r[1]!==null){
        if(Array.isArray(r[1])){
          EMP_PAY = r[1];
          console.log('[EMP_PAY] Loaded', EMP_PAY.length, 'records. Sample employee_id:', EMP_PAY[0]&&EMP_PAY[0].employee_id);
        } else {
          console.error('[EMP_PAY] Fetch error:', r[1]);
          EMP_PAY = [];
        }
      }
      // Debug: log employee IDs to compare
      console.log('[EMP_LIST] Loaded', EMP_LIST.length, 'employees. Sample id:', EMP_LIST[0]&&EMP_LIST[0].id, 'status:', EMP_LIST[0]&&EMP_LIST[0].status);
    }

    // Load orders + salary records in background (non-blocking)
    if(!EMP_ORDERS.length)     hrLoadOrders();
    if(!SALARY_RECORDS.length) salLoadRecords();

  }catch(e){ EMP_LIST=[]; console.error(e); }

  // Hide tabs user cannot access
  empHideForbiddenTabs();
  // Open first accessible tab
  var allTabs = ['active','pending','pay','salary','increment','transfer','annual','downloads','resigned'];
  var firstTab = allTabs.find(function(t){ return empTabAllowed(t); }) || 'active';
  empTab(firstTab, document.getElementById('emp-t-'+firstTab));
}

// Tab → AC_MODS key mapping
var EMP_TAB_KEYS = {
  active:'emp-active', pending:'emp-pending', pay:'emp-pay',
  salary:'emp-salary', increment:'emp-increment', transfer:'emp-transfer',
  annual:'emp-annual', downloads:'emp-downloads', resigned:'emp-resigned'
};

function empTabAllowed(tab){
  if(!currentUser || currentUser.role==='admin') return true;
  if(!Object.keys(USER_PERMISSIONS).length) return true;
  var key = EMP_TAB_KEYS[tab];
  return key ? canAccess(key,'view') : true;
}

function empHideForbiddenTabs(){
  Object.keys(EMP_TAB_KEYS).forEach(function(tab){
    var btn = document.getElementById('emp-t-'+tab);
    if(btn) btn.style.display = empTabAllowed(tab) ? '' : 'none';
  });
}

function empTab(tab,btn){
  if(!empTabAllowed(tab)){
    toast('Access denied — no permission for this tab','warning');
    return;
  }
  EMP_TAB=tab;
  var tb=document.getElementById('emp-tab-bar');
  if(tb)Array.from(tb.children).forEach(function(b){b.style.background='transparent';b.style.color='rgba(255,255,255,.6)';});
  if(btn){btn.style.background='rgba(255,255,255,.2)';btn.style.color='white';}
  var addBtn=document.getElementById('emp-add-btn');
  if(addBtn)addBtn.style.display=(tab==='active'||tab==='pending')?'':'none';
  empRender();
}

function empRender(){
  var el=document.getElementById('emp-content');if(!el)return;
  if(EMP_TAB==='active')   el.innerHTML=empListHTML('active');
  else if(EMP_TAB==='pending') el.innerHTML=empListHTML('pending');
  else if(EMP_TAB==='pay')       el.innerHTML=empPayHTML();
  else if(EMP_TAB==='resigned')  el.innerHTML=empListHTML('resigned');
  else if(EMP_TAB==='salary'){el.innerHTML=empSalaryHTML();salWireLogButtons();setTimeout(salWireInputs,100);}
  else if(EMP_TAB==='increment') el.innerHTML=empIncrementHTML();
  else if(EMP_TAB==='transfer'){el.innerHTML=empTransferHTML();hrWireOrderButtons();}
  // Wire pay fixation delete buttons
  if(EMP_TAB==='pay'){
    setTimeout(function(){
      document.querySelectorAll('[data-pay-del-id]').forEach(function(btn){
        btn.addEventListener('click',function(){
          var payId   = btn.getAttribute('data-pay-del-id');
          var empName = btn.getAttribute('data-pay-del-name')||'this employee';
          if(!confirm('Delete pay record for '+empName+'? This cannot be undone.')) return;
          sbDelete('employee_pay',payId).then(function(){
            EMP_PAY = EMP_PAY.filter(function(p){return p.id!==payId;});
            var matchOrder = EMP_ORDERS.find(function(o){
              try{var d=JSON.parse(o.details||'{}');return d.pay_record_id===payId;}catch(ex){return false;}
            });
            if(matchOrder){
              sbDelete('employee_orders',matchOrder.id).catch(function(){});
              EMP_ORDERS=EMP_ORDERS.filter(function(o){return o.id!==matchOrder.id;});
            }
            toast('Pay record deleted','info');
            empRender();
          }).catch(function(e){toast('Error: '+e.message,'error');});
        });
      });
    },200);
  }
  else if(EMP_TAB==='annual'){empAnnualHTML();}
  else if(EMP_TAB==='downloads'){el.innerHTML=empDownloadHTML();}
  // Wire up increment history download + delete buttons
  setTimeout(function(){
    // Download buttons
    document.querySelectorAll('[id^="dl-inc-"][data-eid]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var eid  = btn.getAttribute('data-eid');
        var nb   = parseFloat(btn.getAttribute('data-nb')||0);
        var ob   = parseFloat(btn.getAttribute('data-ob')||0);
        var dt   = btn.getAttribute('data-dt')||'';
        var rm   = btn.getAttribute('data-rm')||'';
        var op={}; try{op=JSON.parse(decodeURIComponent(btn.getAttribute('data-pobj')||'{}'));}catch(ex){}
        var np={}; try{np=JSON.parse(decodeURIComponent(btn.getAttribute('data-nobj')||'{}'));}catch(ex){}
        downloadIncrementLetter(eid,nb,ob,dt,rm,op,np);
      });
    });
    // Delete buttons (employee_pay records for increment)
    document.querySelectorAll('[data-inc-del-payid]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var payId = btn.getAttribute('data-inc-del-payid');
        var empName = btn.getAttribute('data-inc-del-name')||'this entry';
        if(!confirm('Delete increment entry for '+empName+'? This will also remove the pay record.')) return;
        // Delete from employee_pay
        sbDelete('employee_pay', payId).then(function(){
          EMP_PAY = EMP_PAY.filter(function(p){return p.id!==payId;});
          // Also delete matching order record
          var matchOrder = EMP_ORDERS.find(function(o){
            try{ var d=JSON.parse(o.details||'{}'); return d.pay_record_id===payId||(d.newPay&&d.newPay.id===payId); }catch(ex){return false;}
          });
          if(matchOrder){
            sbDelete('employee_orders',matchOrder.id).catch(function(){});
            EMP_ORDERS = EMP_ORDERS.filter(function(o){return o.id!==matchOrder.id;});
          }
          toast('Increment entry deleted','info');
          empRender();
        }).catch(function(e){toast('Error: '+e.message,'error');});
      });
    });
    // Delete buttons for pay fixation / revision orders (employee_orders table)
    document.querySelectorAll('[data-del-pay-ord-id]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var orderId = btn.getAttribute('data-del-pay-ord-id');
        var label   = btn.getAttribute('data-del-pay-ord-label')||'this entry';
        hrDeleteOrder(orderId, label, function(){ empRender(); });
      });
    });
    // Download buttons for pay fixation orders in Pay tab
    document.querySelectorAll('[data-ord-id][data-ord-type]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var orderId  = btn.getAttribute('data-ord-id');
        var ordType  = btn.getAttribute('data-ord-type');
        var order    = EMP_ORDERS.find(function(o){return o.id===orderId;});
        if(!order){toast('Order not found','warning');return;}
        var d={}; try{d=JSON.parse(order.details||'{}');}catch(ex){}
        var empId = order.employee_id;
        var dt    = order.effective_date;
        if(ordType==='pay_fixation'||ordType==='revision'){
          downloadPayFixationOrder(empId, dt, d);
        } else if(ordType==='increment'){
          downloadIncrementLetter(empId, d.newBasic||0, d.oldBasic||0, dt, d.remarks||'', d.oldPay||{}, d.newPay||{});
        }
      });
    });
  },200);
}

// ── EMPLOYEE LIST ────────────────────────────────────
// ════ MONTHLY SALARY FINALISATION ════════════════════
var SALARY_RECORDS = [];

// ════════════════════════════════════════════════════════════════════════
// SALARY FINALISATION SYSTEM
// Table: salary_records
//   id, month, year, month_label, employee_id, employee_name, employee_code,
//   designation, department, days_worked, ot_hours, advance_deduct,
//   basic, gross, earned, ot_pay, pf_employee, esic_employee, tds,
//   profession_tax, net_payable, pay_structure_id, finalised_by, finalised_at
// ════════════════════════════════════════════════════════════════════════

async function salLoadRecords(){
  try{
    var rows = await sbFetch('salary_records',{select:'*',order:'year.desc,month.desc'});
    SALARY_RECORDS = Array.isArray(rows)?rows:[];
  }catch(e){ SALARY_RECORDS=[]; }
}

// ── Finalise salary: save all employee records for the month ─────────────

async function salFinalise(){
  var month = parseInt((document.getElementById('sal-month')||{}).value)||0;
  var year  = parseInt((document.getElementById('sal-year')||{}).value)||0;
  if(!month||!year){toast('Select month and year','warning');return;}

  var MONTHS=['','January','February','March','April','May','June','July','August','September','October','November','December'];
  var monthLabel = MONTHS[month]+' '+year;

  // Collect only checked/selected employees
  var active = EMP_LIST.filter(function(e){return e.status==='active';});
  var selected = active.filter(function(e){
    var chk = document.getElementById('sal-sel-'+e.id);
    return chk && chk.checked;
  });
  if(!selected.length){toast('Select at least one employee to finalise','warning');return;}

  // Check already finalised for selected employees
  var already = SALARY_RECORDS.filter(function(r){
    return r.month===month && r.year===year &&
           selected.some(function(e){return e.id===r.employee_id;});
  });
  if(already.length){
    if(!confirm('Salary for '+already.length+' of these employees already finalised for '+monthLabel+'.\n\nOverwrite?')) return;
    try{
      for(var i=0;i<already.length;i++) await sbDelete('salary_records',already[i].id);
      SALARY_RECORDS = SALARY_RECORDS.filter(function(r){
        return !(r.month===month&&r.year===year&&selected.some(function(e){return e.id===r.employee_id;}));
      });
    }catch(ex){console.warn('delete old:',ex);}
  }

  var toSave = [];
  selected.forEach(function(e){
    var name = ((e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'')).trim();
    var pays = EMP_PAY.filter(function(p){return p.employee_id===e.id;})
                      .sort(function(a,b){return b.effective_date.localeCompare(a.effective_date);});
    var pay = pays[0];
    if(!pay) return;

    var lwp  = parseFloat((document.getElementById('sal-days-'+e.id)||{value:0}).value)||0;
    var days = Math.max(0, 26 - lwp);
    var ot   = parseFloat((document.getElementById('sal-ot-'+e.id)||{value:0}).value)||0;
    var ratio = days/26;

    // Sum all visible earning component inputs (same logic as salRecalc)
    var compTotal = 0;
    document.querySelectorAll('[data-sal^="earn-"][data-eid="'+e.id+'"]').forEach(function(el){
      if(el.type==='hidden') return;
      compTotal += parseFloat(el.value)||0;
    });
    var basic  = parseFloat((document.getElementById('sal-earn-basic-'+e.id)||{value:pay.basic||0}).value)||0;
    var gross  = parseFloat((document.getElementById('sal-earn-gross-'+e.id)||{value:pay.gross||0}).value)||pay.gross||0;
    var earned = Math.round(compTotal * ratio);
    var otPay  = Math.round(gross/26/8*1.5*ot);

    // Read deductions from DOM (editable)
    var pfEmp = parseFloat((document.getElementById('sal-ded-pf-'+e.id)||{value:0}).value)||0;
    var esic  = parseFloat((document.getElementById('sal-ded-esic-'+e.id)||{value:0}).value)||0;
    var tds   = parseFloat((document.getElementById('sal-ded-tds-'+e.id)||{value:0}).value)||0;
    var pt    = parseFloat((document.getElementById('sal-ded-pt-'+e.id)||{value:0}).value)||0;
    var adv   = parseFloat((document.getElementById('sal-ded-adv-'+e.id)||{value:0}).value)||0;
    // Extra custom deductions
    var extraDeds = [];
    var extraDedEls = document.querySelectorAll('[data-extra-ded-emp="'+e.id+'"]');
    var extraDedTotal = 0;
    extraDedEls.forEach(function(el){
      var amt = parseFloat(el.value)||0;
      var lbl = el.getAttribute('data-extra-ded-label')||'Other';
      if(amt) { extraDeds.push({label:lbl,amount:amt}); extraDedTotal+=amt; }
    });
    // Extra custom earnings
    var extraEarns = [];
    var extraEarnEls = document.querySelectorAll('[data-extra-earn-emp="'+e.id+'"]');
    var extraEarnTotal = 0;
    extraEarnEls.forEach(function(el){
      var amt = parseFloat(el.value)||0;
      var lbl = el.getAttribute('data-extra-earn-label')||'Other';
      if(amt) { extraEarns.push({label:lbl,amount:amt}); extraEarnTotal+=amt; }
    });

    var totalDed = pfEmp+esic+tds+pt+adv+extraDedTotal;
    var payable  = Math.max(0, earned+otPay+extraEarnTotal-totalDed);

    toSave.push({
      month:month, year:year, month_label:monthLabel,
      employee_id:e.id, employee_name:name,
      employee_code:e.employee_code||e.emp_id||'',
      designation:e.designation||e.role||'',
      department:e.department||'',
      days_worked:days, ot_hours:ot, advance_deduct:adv,
      basic:basic, gross:gross, earned:earned, ot_pay:otPay,
      pf_employee:pfEmp, esic_employee:esic, tds:tds,
      profession_tax:pt, net_payable:payable,
      pay_structure_id:pay.id||null,
      extra_earnings:extraEarns.length?JSON.stringify(extraEarns):null,
      extra_deductions:extraDeds.length?JSON.stringify(extraDeds):null,
      finalised_by:currentUser?currentUser.name:null,
      finalised_at:new Date().toISOString()
    });
  });

  if(!toSave.length){toast('No employees with pay structure selected','warning');return;}
  toast('Finalising '+toSave.length+' employees for '+monthLabel+'...','info');
  try{
    var inserted=[];
    for(var j=0;j<toSave.length;j++){
      var res=await sbInsert('salary_records',toSave[j]);
      if(res&&res[0]) inserted.push(res[0]);
    }
    SALARY_RECORDS=inserted.concat(SALARY_RECORDS);
    toast('Salary finalised for '+monthLabel+' — '+inserted.length+' employees','success');
    window._salRows=[]; window._salMonth='';
    empRender();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

function salRecalc(empId){
  var lwp   = parseFloat((document.getElementById('sal-days-'+empId)||{value:0}).value)||0;
  var days  = Math.max(0, 26-lwp);
  var ratio = days / 26;
  var ot    = parseFloat((document.getElementById('sal-ot-'+empId)||{value:0}).value)||0;

  // Sum all visible earning component inputs (exclude hidden gross field)
  var compTotal = 0;
  document.querySelectorAll('[data-sal^="earn-"][data-eid="'+empId+'"]').forEach(function(el){
    if(el.type === 'hidden') return; // skip hidden gross
    compTotal += parseFloat(el.value)||0;
  });

  // Pro-rate by days worked
  var earned = Math.round(compTotal * ratio);

  // OT pay — based on gross (full month) / 26 / 8 * 1.5
  var grossEl = document.getElementById('sal-earn-gross-'+empId);
  var gross   = parseFloat(grossEl ? grossEl.value : compTotal) || compTotal;
  var otPay   = ot > 0 ? Math.round(gross / 26 / 8 * 1.5 * ot) : 0;

  // Custom extra earnings (added via + Add button)
  var extraE = 0;
  document.querySelectorAll('[data-extra-earn-emp="'+empId+'"]').forEach(function(el){
    extraE += parseFloat(el.value)||0;
  });

  var totalEarned = earned + otPay + extraE;

  // Deductions
  var pf   = parseFloat((document.getElementById('sal-ded-pf-'+empId)  ||{value:0}).value)||0;
  var esic = parseFloat((document.getElementById('sal-ded-esic-'+empId)||{value:0}).value)||0;
  var tds  = parseFloat((document.getElementById('sal-ded-tds-'+empId) ||{value:0}).value)||0;
  var pt   = parseFloat((document.getElementById('sal-ded-pt-'+empId)  ||{value:0}).value)||0;
  var adv  = parseFloat((document.getElementById('sal-ded-adv-'+empId) ||{value:0}).value)||0;
  var extraD = 0;
  document.querySelectorAll('[data-extra-ded-emp="'+empId+'"]').forEach(function(el){
    extraD += parseFloat(el.value)||0;
  });
  var totalDed = pf + esic + tds + pt + adv + extraD;
  var net = Math.max(0, totalEarned - totalDed);

  var inr = function(n){ return '₹' + Math.round(n||0).toLocaleString('en-IN'); };
  var pel  = document.getElementById('sal-payable-'+empId);   if(pel)  pel.textContent  = inr(net);
  var eel  = document.getElementById('sal-earned-'+empId);    if(eel)  eel.textContent  = inr(totalEarned);
  var del2 = document.getElementById('sal-deducted-'+empId);  if(del2) del2.textContent = inr(totalDed);
}

function salAddExtraRow(empId, type){
  var containerId = 'sal-extra-'+type+'-'+empId;
  var container = document.getElementById(containerId);
  if(!container) return;
  var row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 80px auto;gap:4px;margin-top:4px;align-items:center;';
  // Label input
  var lblEl = document.createElement('input');
  lblEl.className = 'finp';
  lblEl.placeholder = type==='earn' ? 'e.g. Bonus, Arrears' : 'e.g. Loan, Fine';
  lblEl.style.cssText = 'margin-bottom:0;font-size:11px;';
  lblEl.setAttribute('data-extra-'+type+'-emp', empId);
  lblEl.setAttribute('data-extra-'+type+'-label', '');
  lblEl.addEventListener('input', function(){ lblEl.setAttribute('data-extra-'+type+'-label', lblEl.value); });
  // Amount input
  var amtEl = document.createElement('input');
  amtEl.className = 'finp';
  amtEl.type = 'number';
  amtEl.min = '0';
  amtEl.placeholder = '0';
  amtEl.style.cssText = 'margin-bottom:0;font-size:11px;text-align:right;';
  amtEl.setAttribute('data-extra-'+type+'-emp', empId);
  amtEl.setAttribute('data-extra-'+type+'-label', 'Custom');
  amtEl.addEventListener('input', function(){ salRecalc(empId); });
  // Delete button
  var delBtn = document.createElement('button');
  delBtn.textContent = '✕';
  delBtn.style.cssText = 'background:#F5F5F5;color:#555;border:1px solid #DDD;border-radius:5px;padding:3px 7px;font-size:11px;cursor:pointer;';
  delBtn.addEventListener('click', function(){ row.remove(); salRecalc(empId); });
  row.appendChild(lblEl);
  row.appendChild(amtEl);
  row.appendChild(delBtn);
  container.appendChild(row);
}

function empSalaryHTML(){
  var active = EMP_LIST.filter(function(e){return e.status==='active';});
  window._salRows=[]; window._salMonth='';
  if(!SALARY_RECORDS.length) salLoadRecords();

  var now=new Date();
  var MONTHS=['','January','February','March','April','May','June','July','August','September','October','November','December'];
  var monthOpts=MONTHS.slice(1).map(function(m,i){return '<option value="'+(i+1)+'"'+((i+1)===now.getMonth()+1?' selected':'')+'>'+m+'</option>';}).join('');
  var yearOpts=[now.getFullYear()-1,now.getFullYear(),now.getFullYear()+1].map(function(y){return '<option value="'+y+'"'+(y===now.getFullYear()?' selected':'')+'>'+y+'</option>';}).join('');

  var header =
    '<div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;">'+
      '<div style="font-size:12px;font-weight:800;color:#1B5E20;margin-bottom:4px;">&#128200; Monthly Salary Finalisation</div>'+
      '<div style="font-size:11px;color:var(--text3);margin-bottom:10px;">Select employees, edit earnings/deductions, then click <b>Finalise Selected</b>.</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">'+
        '<div><label class="flbl">Month</label><select id="sal-month" class="fsel">'+monthOpts+'</select></div>'+
        '<div><label class="flbl">Year</label><select id="sal-year" class="fsel">'+yearOpts+'</select></div>'+
      '</div>'+
      '<div style="display:flex;gap:8px;">'+
        '<button onclick="salSelectAll(true)" style="flex:1;padding:8px;background:#E8F5E9;color:#1B5E20;border:1px solid #A5D6A7;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer;">&#9989; Select All</button>'+
        '<button onclick="salSelectAll(false)" style="flex:1;padding:8px;background:#F5F5F5;color:var(--text2);border:1px solid var(--border);border-radius:8px;font-size:11px;font-weight:800;cursor:pointer;">&#9645; Deselect All</button>'+
        '<button onclick="salFinalise()" style="flex:2;padding:8px 14px;background:#1B5E20;color:white;border:none;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;">&#10003; Finalise Selected</button>'+
      '</div>'+
    '</div>';

  var rows='';
  if(!active.length){
    rows='<div style="text-align:center;padding:20px;color:var(--text3);">No active employees.</div>';
  } else {
    rows = active.map(function(e){
      var name=((e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'')).trim();
      var pays=EMP_PAY.filter(function(p){return p.employee_id===e.id;}).sort(function(a,b){return b.effective_date.localeCompare(a.effective_date);});
      var pay=pays[0];
      if(!pay) return (
        '<div style="background:white;border-radius:12px;padding:12px 14px;margin-bottom:8px;border-left:3px solid #E65100;">'+
          '<div style="font-size:13px;font-weight:800;">'+name+'</div>'+
          '<div style="font-size:11px;color:#E65100;margin-top:4px;">&#9888; No pay structure. <span style="cursor:pointer;text-decoration:underline;" onclick="empTab(\'pay\',document.getElementById(\'emp-t-pay\'))">Fix now</span></div>'+
        '</div>'
      );

      var ratio = 1; // default full month
      var b  = pay.basic||0;
      var g  = pay.gross||0;
      var pf = pay.pf_employee||0;
      var es = pay.esic_employee||0;
      var td = pay.tds||0;
      var pt = pay.profession_tax||0;
      var net= pay.net_salary||0;

      return (
        '<div style="background:white;border-radius:12px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;" id="sal-row-'+e.id+'">'+

          // ── Header row with checkbox + collapse toggle ────────────────
          '<div style="padding:10px 14px;background:#F8FAFC;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="salToggleRow(\''+e.id+'\',event)">'+
            '<input type="checkbox" id="sal-sel-'+e.id+'" checked style="width:18px;height:18px;accent-color:#1B5E20;cursor:pointer;flex-shrink:0;" onclick="event.stopPropagation()">'+
            '<div style="flex:1;">'+
              '<div style="font-size:13px;font-weight:800;">'+name+'</div>'+
              '<div style="font-size:11px;color:var(--text3);">'+(e.employee_code||e.emp_id||'—')+' &bull; '+(e.designation||e.role||'—')+'</div>'+
            '</div>'+
            '<div style="text-align:right;">'+
              '<div id="sal-payable-'+e.id+'" style="font-size:15px;font-weight:900;color:#1B5E20;">&#8377;'+Number(net).toLocaleString('en-IN')+'</div>'+
              '<div style="font-size:9px;color:var(--text3);">Net Payable</div>'+
            '</div>'+
            '<div id="sal-arr-'+e.id+'" style="font-size:16px;color:var(--text3);margin-left:6px;transition:transform .2s;">&#8250;</div>'+
          '</div>'+
          '<div id="sal-body-'+e.id+'" style="display:none;">'+

          // attendance + earnings/deductions - payslip style
          '<div style="padding:8px 12px;display:grid;grid-template-columns:1fr 1fr;gap:6px;border-bottom:1px solid #EEE;background:#FAFAFA;">'+
            '<div><label style="font-size:9px;font-weight:700;color:#555;display:block;margin-bottom:2px;">LWP Days</label>'+
              '<input data-sal="days" data-eid="'+e.id+'" id="sal-days-'+e.id+'" class="finp" type="number" min="0" max="26" value="0" style="margin-bottom:0;"></div>'+
            '<div><label style="font-size:9px;font-weight:700;color:#555;display:block;margin-bottom:2px;">OT Hours</label>'+
              '<input data-sal="ot" data-eid="'+e.id+'" id="sal-ot-'+e.id+'" class="finp" type="number" min="0" value="0" style="margin-bottom:0;"></div>'+
          '</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;min-height:160px;">'+
            '<div style="padding:8px 10px;border-right:1px solid #EEE;">'+
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;padding-bottom:4px;border-bottom:1.5px solid #333;">'+
              '<span style="font-size:9px;font-weight:900;color:#333;text-transform:uppercase;letter-spacing:.5px;">Earnings</span>'+
              '<button data-addearn="'+e.id+'" style="background:#F0F0F0;color:#333;border:1px solid #CCC;border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;cursor:pointer;">+ Add</button>'+
              '</div>'+
              // Basic
              '<div style="font-size:10px;display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #F0F0F0;">'+
                '<span style="color:#444;">Basic</span>'+
                '<input data-sal="earn-basic" data-eid="'+e.id+'" id="sal-earn-basic-'+e.id+'" type="number" value="'+b+'" style="width:70px;border:1px solid #DDD;border-radius:4px;padding:2px 4px;font-size:10px;text-align:right;font-family:Nunito,sans-serif;">'+
              '</div>'+
              // All pay components - read from extra_earnings JSON (same as pay fixation stores)
              (function(){
                var xhtml='';
                var comps=[];
                try{comps=pay.extra_earnings?JSON.parse(pay.extra_earnings):[];}catch(ex){}
                // If extra_earnings empty, build from individual columns
                if(!comps.length){
                  if(pay.da)         comps.push({label:'DA',amount:pay.da});
                  if(pay.hra)        comps.push({label:'HRA',amount:pay.hra});
                  if(pay.conveyance) comps.push({label:'Conveyance',amount:pay.conveyance});
                  if(pay.special_allowance) comps.push({label:'Special Allowance',amount:pay.special_allowance});
                  if(pay.medical_allowance) comps.push({label:'Medical Allowance',amount:pay.medical_allowance});
                  if(pay.other_allowance)   comps.push({label:'Other Allowance',amount:pay.other_allowance});
                }
                comps.forEach(function(c,ci){
                  if(!c.label||!c.amount) return;
                  xhtml+='<div style="font-size:10px;display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #F0F0F0;">'+
                    '<span style="color:#444;">'+c.label+'</span>'+
                    '<input data-sal="earn-c'+ci+'" data-eid="'+e.id+'" id="sal-earn-c'+ci+'-'+e.id+'" type="number" value="'+(c.amount||0)+'" style="width:70px;border:1px solid #DDD;border-radius:4px;padding:2px 4px;font-size:10px;text-align:right;font-family:Nunito,sans-serif;">'+
                  '</div>';
                });
                return xhtml;
              })()+
              // Gross (hidden, auto-calc)
              '<input data-sal="earn-gross" data-eid="'+e.id+'" id="sal-earn-gross-'+e.id+'" type="hidden" value="'+g+'">'+
              '<div id="sal-extra-earn-'+e.id+'"></div>'+
              '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:10px;font-weight:800;border-top:1.5px solid #333;margin-top:4px;">'+
                '<span>Total Earned</span><span id="sal-earned-'+e.id+'">&#8377;'+Number(g).toLocaleString('en-IN')+'</span>'+
              '</div>'+
            '</div>'+
            '<div style="padding:8px 10px;">'+
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;padding-bottom:4px;border-bottom:1.5px solid #333;">'+
              '<span style="font-size:9px;font-weight:900;color:#333;text-transform:uppercase;letter-spacing:.5px;">Deductions</span>'+
              '<button data-addded="'+e.id+'" style="background:#F0F0F0;color:#333;border:1px solid #CCC;border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;cursor:pointer;">+ Add</button>'+
              '</div>'+
              '<div style="font-size:10px;display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #F0F0F0;">'+
                '<span style="color:#444;">PF (Emp)</span>'+
                '<input data-sal="ded-pf" data-eid="'+e.id+'" id="sal-ded-pf-'+e.id+'" type="number" value="'+pf+'" style="width:65px;border:1px solid #DDD;border-radius:4px;padding:2px 4px;font-size:10px;text-align:right;font-family:Nunito,sans-serif;">'+
              '</div>'+
              '<div style="font-size:10px;display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #F0F0F0;">'+
                '<span style="color:#444;">ESIC (Emp)</span>'+
                '<input data-sal="ded-esic" data-eid="'+e.id+'" id="sal-ded-esic-'+e.id+'" type="number" value="'+es+'" style="width:65px;border:1px solid #DDD;border-radius:4px;padding:2px 4px;font-size:10px;text-align:right;font-family:Nunito,sans-serif;">'+
              '</div>'+
              '<div style="font-size:10px;display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #F0F0F0;">'+
                '<span style="color:#444;">TDS</span>'+
                '<input data-sal="ded-tds" data-eid="'+e.id+'" id="sal-ded-tds-'+e.id+'" type="number" value="'+td+'" style="width:65px;border:1px solid #DDD;border-radius:4px;padding:2px 4px;font-size:10px;text-align:right;font-family:Nunito,sans-serif;">'+
              '</div>'+
              '<div style="font-size:10px;display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #F0F0F0;">'+
                '<span style="color:#444;">Prof. Tax</span>'+
                '<input data-sal="ded-pt" data-eid="'+e.id+'" id="sal-ded-pt-'+e.id+'" type="number" value="'+pt+'" style="width:65px;border:1px solid #DDD;border-radius:4px;padding:2px 4px;font-size:10px;text-align:right;font-family:Nunito,sans-serif;">'+
              '</div>'+
              '<div style="font-size:10px;display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #F0F0F0;">'+
                '<span style="color:#444;">Advance</span>'+
                '<input data-sal="ded-adv" data-eid="'+e.id+'" id="sal-ded-adv-'+e.id+'" type="number" value="0" style="width:65px;border:1px solid #DDD;border-radius:4px;padding:2px 4px;font-size:10px;text-align:right;font-family:Nunito,sans-serif;">'+
              '</div>'+
              '<div id="sal-extra-ded-'+e.id+'"></div>'+
              '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:10px;font-weight:800;border-top:1.5px solid #333;margin-top:4px;">'+
                '<span>Total Deducted</span><span id="sal-deducted-'+e.id+'">&#8377;'+Number(pf+es+td+pt).toLocaleString('en-IN')+'</span>'+
              '</div>'+
            '</div>'+
          '</div>'+

          '</div>'+
        '</div>'
      );
    }).join('');
  }

  var logMap={};
  SALARY_RECORDS.forEach(function(r){
    var key=r.year+'-'+String(r.month).padStart(2,'0');
    if(!logMap[key]) logMap[key]={label:r.month_label,month:r.month,year:r.year,records:[],total:0};
    logMap[key].records.push(r); logMap[key].total+=Number(r.net_payable||0);
  });
  var logKeys=Object.keys(logMap).sort().reverse();
  var logSection=salBuildLogSection(logMap,logKeys);

  return header+rows+logSection;
}

function salToggleRow(empId, event){
  var body = document.getElementById('sal-body-'+empId);
  var arr  = document.getElementById('sal-arr-'+empId);
  if(!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if(arr) arr.style.transform = open ? '' : 'rotate(90deg)';
}

function salSelectAll(checked){
  EMP_LIST.filter(function(e){return e.status==='active';}).forEach(function(e){
    var chk=document.getElementById('sal-sel-'+e.id);
    if(chk) chk.checked=checked;
  });
}

function salWireInputs(){
  // Wire all salary inputs to salRecalc via data-eid
  document.querySelectorAll('[data-sal][data-eid]').forEach(function(el){
    el.addEventListener('input',function(){
      salRecalc(el.getAttribute('data-eid'));
    });
  });
  // Wire + Add Earning buttons
  document.querySelectorAll('[data-addearn]').forEach(function(btn){
    btn.addEventListener('click',function(){
      salAddExtraRow(btn.getAttribute('data-addearn'),'earn');
    });
  });
  // Wire + Add Deduction buttons
  document.querySelectorAll('[data-addded]').forEach(function(btn){
    btn.addEventListener('click',function(){
      salAddExtraRow(btn.getAttribute('data-addded'),'ded');
    });
  });
}


function salToggleLog(divId){
  var el  = document.getElementById(divId);
  var arr = document.getElementById(divId.replace('sal-log-','sal-arr-'));
  if(!el) return;
  var open = el.style.display!=='none';
  el.style.display = open?'none':'block';
  if(arr) arr.style.transform = open?'':'rotate(90deg)';
}

// Wire salary log buttons after render
function salWireLogButtons(){
  setTimeout(function(){
    // PDF buttons
    document.querySelectorAll('[data-sal-pdf-month]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var m = parseInt(btn.getAttribute('data-sal-pdf-month'));
        var y = parseInt(btn.getAttribute('data-sal-pdf-year'));
        var label = btn.getAttribute('data-sal-pdf-label')||'';
        salDownloadPDF(m, y, label);
      });
    });
    // Excel buttons
    document.querySelectorAll('[data-sal-xls-month]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var m = parseInt(btn.getAttribute('data-sal-xls-month'));
        var y = parseInt(btn.getAttribute('data-sal-xls-year'));
        var label = btn.getAttribute('data-sal-xls-label')||'';
        salDownloadExcel(m, y, label);
      });
    });
    // Delete month
    document.querySelectorAll('[data-sal-del-month]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var m = parseInt(btn.getAttribute('data-sal-del-month'));
        var y = parseInt(btn.getAttribute('data-sal-del-year'));
        var label = btn.getAttribute('data-sal-del-label')||'';
        salDeleteMonth(m, y, label);
      });
    });
    // Payment entry buttons
    document.querySelectorAll('[data-sal-pay-rid]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var rid  = btn.getAttribute('data-sal-pay-rid');
        var name = btn.getAttribute('data-sal-pay-name')||'';
        var amt  = parseFloat(btn.getAttribute('data-sal-pay-amt')||0);
        salOpenPayment(rid, name, amt);
      });
    });
    // Individual payslip from record
    document.querySelectorAll('[data-sal-slip-rid]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var rid = btn.getAttribute('data-sal-slip-rid');
        var eid = btn.getAttribute('data-sal-slip-eid');
        salShowRecordPayslip(rid, eid);
      });
    });
  },200);
}

async function salDeleteMonth(month, year, label){
  if(!confirm('Delete finalised salary for '+label+'?\nThis will permanently remove all '+label+' salary records.')) return;
  var toDelete = SALARY_RECORDS.filter(function(r){return r.month===month&&r.year===year;});
  try{
    toast('Deleting...','info');
    for(var i=0;i<toDelete.length;i++){
      await sbDelete('salary_records', toDelete[i].id);
    }
    SALARY_RECORDS = SALARY_RECORDS.filter(function(r){return !(r.month===month&&r.year===year);});
    toast(label+' salary records deleted','info');
    empRender();
  }catch(e){toast('Error: '+e.message,'error');}
}

function salShowRecordPayslip(recordId, empId){
  var rec = SALARY_RECORDS.find(function(r){return r.id===recordId;});
  if(!rec){toast('Record not found','warning');return;}
  var pay = EMP_PAY.find(function(p){return p.id===rec.pay_structure_id;})||
            EMP_PAY.filter(function(p){return p.employee_id===empId;})
                   .sort(function(a,b){return b.effective_date.localeCompare(a.effective_date);})[0]||{};

  // Store for PDF button
  window._curPayslipEmpId = empId;
  window._curPayslipMonth = rec.month_label;
  // Build a synthetic row matching empShowPayslip format
  window._salRows = [{
    id:empId, name:rec.employee_name, code:rec.employee_code,
    days:rec.days_worked, ot:rec.ot_hours||0,
    gross:rec.gross, earned:rec.earned, otPay:rec.ot_pay||0,
    pfEmp:rec.pf_employee||0, esic:rec.esic_employee||0,
    tds:rec.tds||0, pt:rec.profession_tax||0, adv:rec.advance_deduct||0,
    payable:rec.net_payable, pay:pay
  }];
  window._salMonth = rec.month_label;
  empShowPayslip(empId, rec.month_label);
}

function salDownloadExcel(month, year, label){
  var records = SALARY_RECORDS.filter(function(r){return r.month===month&&r.year===year;});
  if(!records.length){toast('No records for '+label,'warning');return;}

  var lines = [
    [coName()],
    ['Salary Sheet - '+label],
    [''],
    ['Code','Employee','Designation','Department','Days','OT Hrs',
     'Basic','Gross Earnings','PF (Emp)','ESIC (Emp)','TDS','Prof Tax','Advance',
     'Total Deductions','Net Payable','Finalised By','Finalised On']
  ];
  records.forEach(function(r){
    lines.push([
      r.employee_code, r.employee_name, r.designation, r.department,
      r.days_worked, r.ot_hours||0, r.basic||0,
      r.earned+(r.ot_pay||0),
      r.pf_employee||0, r.esic_employee||0, r.tds||0, r.profession_tax||0, r.advance_deduct||0,
      (r.pf_employee||0)+(r.esic_employee||0)+(r.tds||0)+(r.profession_tax||0)+(r.advance_deduct||0),
      r.net_payable,
      r.finalised_by||'', r.finalised_at?r.finalised_at.slice(0,10):''
    ]);
  });
  var total = records.reduce(function(s,r){return s+Number(r.net_payable||0);},0);
  lines.push(['','','','','','','','','','','','','','TOTAL',total,'','']);

  var csv = lines.map(function(row){
    return row.map(function(cell){
      var s=String(cell==null?'':cell);
      if(s.indexOf(',')>-1||s.indexOf('"')>-1) s='"'+s.replace(/"/g,'""')+'"';
      return s;
    }).join(',');
  }).join('\n');

  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='Salary_'+label.replace(/\s+/g,'_')+'.csv';
  a.click();
  toast('Excel downloaded: '+label,'success');
}

function salDownloadPDF(month, year, label){
  var records = SALARY_RECORDS.filter(function(r){return r.month===month&&r.year===year;});
  if(!records.length){toast('No records for '+label,'warning');return;}

  var total = records.reduce(function(s,r){return s+Number(r.net_payable||0);},0);
  var compName = typeof coName==='function'?coName():'Atmagaurav Infra Pvt. Ltd.';
  var compAddr = typeof coAddr==='function'?coAddr():'';
  var compGST  = typeof coGST==='function'?coGST():'';
  var today    = fmtDate(new Date());

  var trs = records.map(function(r,i){
    var ded=(r.pf_employee||0)+(r.esic_employee||0)+(r.tds||0)+(r.profession_tax||0)+(r.advance_deduct||0);
    return '<tr style="background:'+(i%2?'#F9FFF9':'white')+'">'+
      '<td style="padding:5px 7px;">'+(i+1)+'</td>'+
      '<td style="padding:5px 7px;text-align:left;font-weight:700;">'+r.employee_name+'<br><span style="font-size:9px;color:#666;">'+r.employee_code+'</span></td>'+
      '<td style="padding:5px 7px;text-align:left;font-size:10px;">'+r.designation+'</td>'+
      '<td style="padding:5px 7px;text-align:center;">'+r.days_worked+(r.ot_hours?'+'+r.ot_hours+'h':'')+'</td>'+
      '<td style="padding:5px 7px;text-align:right;">&#8377;'+Number(r.basic||0).toLocaleString('en-IN')+'</td>'+
      '<td style="padding:5px 7px;text-align:right;">&#8377;'+Number(r.earned+(r.ot_pay||0)).toLocaleString('en-IN')+'</td>'+
      '<td style="padding:5px 7px;text-align:right;color:#C62828;">&#8377;'+Number(ded).toLocaleString('en-IN')+'</td>'+
      '<td style="padding:5px 7px;text-align:right;font-weight:700;color:#1B5E20;">&#8377;'+Number(r.net_payable||0).toLocaleString('en-IN')+'</td>'+
    '</tr>';
  }).join('');

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8">'+
    '<title>Salary Sheet - '+label+'</title>'+
    '<style>body{font-family:Arial,sans-serif;font-size:11px;color:#222;margin:0;padding:16px;}'+
    '.hdr{text-align:center;border-bottom:3px double #1B5E20;padding-bottom:10px;margin-bottom:14px;}'+
    '.logo{font-size:18px;font-weight:900;color:#1B5E20;}.sub{font-size:9px;color:#555;margin-top:2px;}'+
    'table{width:100%;border-collapse:collapse;}'+
    'th{background:#1B5E20;color:white;padding:6px 7px;font-size:10px;}'+
    'td{border-bottom:1px solid #eee;}'+
    '.tot{background:#E8F5E9;font-weight:900;}'+
    '@media print{@page{size:A4 landscape;margin:8mm;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body>'+
    '<div class="hdr"><div class="logo">'+compName+'</div>'+(compAddr?'<div class="sub">'+compAddr+'</div>':'')+(compGST?'<div class="sub">GSTIN: '+compGST+'</div>':'')+'</div>'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:11px;">'+
      '<b>Salary Sheet &mdash; '+label+'</b>'+
      '<span>Generated: '+today+'</span>'+
    '</div>'+
    '<table>'+
      '<thead><tr>'+
        '<th>#</th><th style="text-align:left;">Employee</th><th style="text-align:left;">Designation</th>'+
        '<th>Days</th><th>Basic</th><th>Gross</th><th>Deductions</th><th>Net Pay</th>'+
      '</tr></thead>'+
      '<tbody>'+trs+'</tbody>'+
      '<tfoot><tr class="tot">'+
        '<td colspan="7" style="padding:7px;text-align:right;font-size:11px;">TOTAL PAYROLL</td>'+
        '<td style="padding:7px;text-align:right;font-size:13px;">&#8377;'+Number(total).toLocaleString('en-IN')+'</td>'+
      '</tr></tfoot>'+
    '</table>'+
    '<p style="font-size:9px;color:#888;text-align:center;margin-top:12px;border-top:1px solid #eee;padding-top:6px;">'+
      compName+' | '+label+' | Generated on '+today+
    '</p>'+
    '<script>window.onload=function(){window.print();}<\/script>'+
    '</body></html>';

  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else{toast('Allow popups to download PDF','warning');}
}

function empCalcSalary(empId, gross, netBase, pfEmp, esicEmp, tds){
  var lwp  = parseFloat((document.getElementById('sal-days-'+empId)||{value:0}).value)||0;
  var days = Math.max(0, 26 - lwp); // days worked = 26 - LWP
  var ot   = parseFloat((document.getElementById('sal-ot-'+empId)||{value:0}).value)||0;
  var adv  = parseFloat((document.getElementById('sal-adv-'+empId)||{value:0}).value)||0;
  var dailyRate = gross/26;
  var otRate    = (gross/26/8)*1.5;
  var earned    = Math.round(dailyRate*days);
  var otPay     = Math.round(otRate*ot);
  var deductions= Math.round((pfEmp+esicEmp+tds)*days/26) + adv;
  var payable   = Math.max(0, earned + otPay - deductions);
  var el = document.getElementById('sal-payable-'+empId);
  if(el) el.innerHTML = '&#8377;' + payable.toLocaleString('en-IN');
}

function empShowPayslip(empId, monthLabel){
  var rows = window._salRows||[];
  var r = rows.find(function(x){return x.id===empId;});
  if(!r){toast('Generate salary sheet first','warning');return;}
  var e = EMP_LIST.find(function(x){return x.id===empId;})||{};
  var pay = r.pay||{};
  var days = r.days||26;
  var ratio = days/26; // pro-ration factor
  var extraEarnings=[];
  try{extraEarnings=pay.extra_earnings?JSON.parse(pay.extra_earnings):[];}catch(ex){}

  function drow(l,v,col){
    return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #F5F5F5;font-size:12px;">'+
      '<span style="color:var(--text3);">'+l+'</span>'+
      '<span style="font-weight:700;color:'+(col||'var(--text)')+';">&#8377;'+Number(v||0).toLocaleString('en-IN')+'</span>'+
    '</div>';
  }

  // Pro-rate each component by days/26
  var pBasic = Math.round((pay.basic||0)*ratio);
  var earnRows = drow('Basic ('+days+'/26 days)',pBasic,'#1565C0');
  if(extraEarnings.length){
    extraEarnings.forEach(function(ex){
      if(ex.amount>0){
        var amt = ex.pct>0 ? Math.round(pBasic*ex.pct/100) : Math.round(ex.amount*ratio);
        earnRows+=drow(ex.label,amt,'#2E7D32');
      }
    });
  } else {
    if(pay.da)                earnRows+=drow('DA',               Math.round((pay.da||0)*ratio),'#2E7D32');
    if(pay.hra)               earnRows+=drow('HRA',              Math.round((pay.hra||0)*ratio),'#2E7D32');
    if(pay.conveyance)        earnRows+=drow('Conveyance',        Math.round((pay.conveyance||0)*ratio),'#2E7D32');
    if(pay.special_allowance) earnRows+=drow('Special Allowance', Math.round((pay.special_allowance||0)*ratio),'#2E7D32');
    if(pay.medical_allowance) earnRows+=drow('Medical Allowance', Math.round((pay.medical_allowance||0)*ratio),'#2E7D32');
    if(pay.other_allowance)   earnRows+=drow('Other Allowance',   Math.round((pay.other_allowance||0)*ratio),'#2E7D32');
  }
  if(r.otPay>0) earnRows+=drow('OT Allowance ('+r.ot+' hrs)',r.otPay,'#F57F17');

  document.getElementById('emp-sheet-title').textContent='Payslip — '+r.name;
  document.getElementById('emp-sheet-body').innerHTML=
    '<div style="border:2px solid #1B5E20;border-radius:14px;overflow:hidden;">'+
      '<div style="background:#1B5E20;padding:14px 16px;color:white;">'+
        '<div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">'+coName()+'</div>'+
        '<div style="font-size:16px;font-weight:900;">Salary Payslip</div>'+
        '<div style="font-size:12px;opacity:.8;margin-top:2px;">'+monthLabel+'</div>'+
      '</div>'+
      '<div style="padding:10px 14px;background:#F8FFF8;border-bottom:1px solid #E0E0E0;display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">'+
        '<div style="font-size:11px;"><span style="color:var(--text3);">Name: </span><b>'+r.name+'</b></div>'+
        '<div style="font-size:11px;"><span style="color:var(--text3);">Code: </span><b>'+r.code+'</b></div>'+
        '<div style="font-size:11px;"><span style="color:var(--text3);">Designation: </span><b>'+(e.designation||e.role||'—')+'</b></div>'+
        '<div style="font-size:11px;"><span style="color:var(--text3);">Department: </span><b>'+(e.department||'—')+'</b></div>'+
        '<div style="font-size:11px;"><span style="color:var(--text3);">Days Worked: </span><b>'+r.days+' days</b></div>'+
        '<div style="font-size:11px;"><span style="color:var(--text3);">LWP: </span><b>'+(26-r.days)+' days</b></div>'+
        '<div style="font-size:11px;"><span style="color:var(--text3);">OT Hours: </span><b>'+(r.ot||0)+'</b></div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:2px solid #1B5E20;">'+
        '<div style="padding:10px 14px;border-right:1px solid #E0E0E0;">'+
          '<div style="font-size:10px;font-weight:800;color:#2E7D32;text-transform:uppercase;margin-bottom:6px;">Earnings</div>'+
          earnRows+
          '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;font-weight:900;border-top:2px solid #2E7D32;margin-top:4px;color:#2E7D32;">'+
            '<span>Total Earned</span><span>&#8377;'+Number(r.earned+r.otPay).toLocaleString('en-IN')+'</span>'+
          '</div>'+
        '</div>'+
        '<div style="padding:10px 14px;">'+
          '<div style="font-size:10px;font-weight:800;color:#C62828;text-transform:uppercase;margin-bottom:6px;">Deductions</div>'+
          (r.pfEmp>0?drow('PF (Employee)',r.pfEmp,'#C62828'):'')+
          (r.esic>0?drow('ESIC (Employee)',r.esic,'#C62828'):'')+
          (r.tds>0?drow('TDS',r.tds,'#E65100'):'')+
          (r.pt>0?drow('Profession Tax',r.pt,'#880E4F'):'')+
          (r.adv>0?drow('Advance Recovery',r.adv,'#C62828'):'')+
          '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;font-weight:900;border-top:2px solid #C62828;margin-top:4px;color:#C62828;">'+
            '<span>Total Deducted</span><span>&#8377;'+Number(r.pfEmp+r.esic+r.tds+r.pt+r.adv).toLocaleString('en-IN')+'</span>'+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div style="padding:12px 16px;background:#1B5E2015;display:flex;justify-content:space-between;align-items:center;">'+
        '<div style="font-size:14px;font-weight:800;color:#1B5E20;">Net Take Home</div>'+
        '<div style="font-size:22px;font-weight:900;color:#1B5E20;">&#8377;'+Number(r.payable).toLocaleString('en-IN')+'</div>'+
      '</div>'+
      '<div style="padding:8px 14px;font-size:10px;color:var(--text3);text-align:center;background:white;">'+
        'This is a computer-generated payslip. It does not require a signature.'+
      '</div>'+
    '</div>';

  window._curPayslipEmpId = empId;
  window._curPayslipMonth = monthLabel;
  document.getElementById('emp-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="empShowSalarySheet()">&#8592; Back</button>'+
    '<button class="btn" id="payslip-pdf-btn" style="background:#C62828;color:white;">&#128196; PDF</button>';
  var pdfBtn = document.getElementById('payslip-pdf-btn');
  if(pdfBtn) pdfBtn.addEventListener('click', function(){
    downloadPayslipPDF(window._curPayslipEmpId, window._curPayslipMonth);
  });
  openEmpSheet();
}

function empShowSalarySheet(){
  var rows = window._salRows||[];
  if(!rows.length||!window._salMonth){ closeEmpSheet(); return; }
  empFinaliseSalary();
}

function downloadSalaryExcel(){
  var rows = window._salRows||[];
  var month = window._salMonth||'Salary';
  if(!rows.length){toast('Generate salary sheet first','warning');return;}
  var lines = [
    [coName()],['Salary Sheet - '+month],[''],
    ['Emp Code','Employee Name','Designation','Department','Days Worked','OT Hrs',
     'Basic','Gross Earnings','PF (Emp)','ESIC (Emp)','TDS','Prof Tax','Advance',
     'Total Deductions','Net Payable']
  ];
  rows.forEach(function(r){
    var e=EMP_LIST.find(function(x){return x.id===r.id;})||{};
    lines.push([r.code,r.name,e.designation||e.role||'',e.department||'',
      r.days,r.ot||0,r.pay.basic||0,r.earned+(r.otPay||0),
      r.pfEmp||0,r.esic||0,r.tds||0,r.pt||0,r.adv||0,
      (r.pfEmp||0)+(r.esic||0)+(r.tds||0)+(r.pt||0)+(r.adv||0),r.payable]);
  });
  var total=rows.reduce(function(s,r){return s+r.payable;},0);
  lines.push(['','','','','','','','','','','','','','TOTAL',total]);
  var csv=lines.map(function(row){
    return row.map(function(cell){
      var s=String(cell==null?'':cell);
      if(s.indexOf(',')>-1||s.indexOf('"')>-1) s='"'+s.replace(/"/g,'""')+'"';
      return s;
    }).join(',');
  }).join('\n');
  var blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='SalarySheet_'+month.replace(/\s+/g,'_')+'.csv';a.click();
  toast('Downloaded','success');
}

function downloadSalaryPDF(){
  var rows=window._salRows||[];
  var month=window._salMonth||'Salary';
  if(!rows.length){toast('Generate salary sheet first','warning');return;}
  var total=rows.reduce(function(s,r){return s+r.payable;},0);
  var compName=typeof coName==='function'?coName():'';
  var compAddr=typeof coAddr==='function'?coAddr():'';
  var today=fmtDate(new Date());
  var trs=rows.map(function(r,i){
    var e=EMP_LIST.find(function(x){return x.id===r.id;})||{};
    return '<tr style="background:'+(i%2?'#F9FFF9':'white')+'">' +
      '<td>'+r.name+'<br><small style="color:#666;">'+r.code+'</small></td>'+
      '<td style="text-align:center;">'+r.days+(r.ot?'+'+r.ot+'h':'')+'</td>'+
      '<td style="text-align:right;">&#8377;'+Number(r.earned+(r.otPay||0)).toLocaleString('en-IN')+'</td>'+
      '<td style="text-align:right;color:#C62828;">&#8377;'+Number((r.pfEmp||0)+(r.esic||0)+(r.tds||0)+(r.pt||0)+(r.adv||0)).toLocaleString('en-IN')+'</td>'+
      '<td style="text-align:right;font-weight:700;color:#1B5E20;">&#8377;'+Number(r.payable).toLocaleString('en-IN')+'</td>'+
    '</tr>';
  }).join('');
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Salary Sheet - '+month+'</title>'+
    '<style>body{font-family:Arial,sans-serif;font-size:11px;}.hdr{text-align:center;border-bottom:3px double #1B5E20;padding-bottom:10px;margin-bottom:14px;}.logo{font-size:18px;font-weight:900;color:#1B5E20;}table{width:100%;border-collapse:collapse;}th{background:#1B5E20;color:white;padding:6px 8px;}td{padding:5px 8px;border-bottom:1px solid #eee;}.tot{background:#E8F5E9;font-weight:900;}@media print{@page{size:A4 landscape;margin:8mm;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body>'+
    '<div class="hdr"><div class="logo">'+compName+'</div>'+(compAddr?'<div style="font-size:9px;color:#555;">'+compAddr+'</div>':'')+'</div>'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:10px;"><b>Salary Sheet &mdash; '+month+'</b><span>'+today+'</span></div>'+
    '<table><thead><tr><th style="text-align:left;">Employee</th><th>Days</th><th>Earnings</th><th>Deductions</th><th>Net Pay</th></tr></thead>'+
    '<tbody>'+trs+'</tbody>'+
    '<tfoot><tr class="tot"><td colspan="4" style="text-align:right;padding:7px;">TOTAL</td><td style="padding:7px;text-align:right;">&#8377;'+Number(total).toLocaleString('en-IN')+'</td></tr></tfoot></table>'+
    '<script>window.onload=function(){window.print();}<\/script></body></html>';
  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else{toast('Allow popups','warning');}
}


function empFinaliseSalary(){
  // Use cached rows if available (e.g. called from payslip Back button)
  var rows = window._salRows||[];
  var monthLabel = window._salMonth||'';

  // If no cache, rebuild from DOM
  if(!rows.length){
    var month = parseInt((document.getElementById('sal-month')||{}).value)||0;
    var year  = (document.getElementById('sal-year')||{}).value||'';
    if(!month||!year){toast('Select month and year','warning');return;}
    var MONTHS=['','January','February','March','April','May','June','July','August','September','October','November','December'];
    monthLabel = MONTHS[month]+' '+year;

    var active=EMP_LIST.filter(function(e){return e.status==='active';});
    rows=active.map(function(e){
      var name=(e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'');
      var pays=EMP_PAY.filter(function(p){return p.employee_id===e.id;}).sort(function(a,b){return b.effective_date.localeCompare(a.effective_date);});
      var pay=pays[0];
      if(!pay) return null;
      var lwp=parseFloat((document.getElementById('sal-days-'+e.id)||{value:0}).value)||0;
      var days=Math.max(0,26-lwp); // days worked = 26 - LWP
      var ot  =parseFloat((document.getElementById('sal-ot-'+e.id)||{value:0}).value)||0;
      var adv =parseFloat((document.getElementById('sal-adv-'+e.id)||{value:0}).value)||0;
      var gross=parseFloat(pay.gross)||0;
      var earned=Math.round(gross/26*days);
      var otPay =Math.round(gross/26/8*1.5*ot);
      var pfEmp =Math.round((pay.pf_employee||0)*days/26);
      var esic  =Math.round((pay.esic_employee||0)*days/26);
      var tds=pay.tds||0; var pt=pay.profession_tax||0;
      var payable=Math.max(0,earned+otPay-pfEmp-esic-tds-pt-adv);
      return {id:e.id,name:name,code:e.employee_code||e.emp_id||'—',
        days:days,ot:ot,gross:gross,earned:earned,otPay:otPay,
        pfEmp:pfEmp,esic:esic,tds:tds,pt:pt,adv:adv,payable:payable,pay:pay};
    }).filter(Boolean);

    if(!rows.length){toast('No employees with pay structure. Go to Pay Fixation tab first.','warning');return;}
    window._salRows=rows;
    window._salMonth=monthLabel;
  }

  var total=rows.reduce(function(s,r){return s+r.payable;},0);
  var tableRows=rows.map(function(r){
    return '<tr style="border-bottom:1px solid #F0F4F8;">'+
      '<td style="padding:8px 6px;font-size:12px;font-weight:700;">'+r.name+'<div style="font-size:10px;color:var(--text3);">'+r.code+'</div></td>'+
      '<td style="padding:8px 6px;font-size:11px;text-align:center;">'+r.days+'d'+(26-r.days>0?' ('+( 26-r.days)+'L)':'')+(r.ot?'+'+r.ot+'h':'')+'</td>'+
      '<td style="padding:8px 6px;font-size:11px;text-align:right;">&#8377;'+Number(r.earned+r.otPay).toLocaleString('en-IN')+'</td>'+
      '<td style="padding:8px 6px;font-size:11px;text-align:right;color:#C62828;">&#8377;'+Number(r.pfEmp+r.esic+r.tds+r.pt+r.adv).toLocaleString('en-IN')+'</td>'+
      '<td style="padding:8px 6px;font-size:13px;font-weight:900;text-align:right;color:#1B5E20;">&#8377;'+Number(r.payable).toLocaleString('en-IN')+'</td>'+
      '<td style="padding:8px 6px;text-align:center;">'+
        '<button onclick="empShowPayslip(\''+r.id+'\',\''+monthLabel+'\')" style="background:#1B5E20;color:white;border:none;border-radius:6px;padding:5px 10px;font-size:10px;font-weight:800;cursor:pointer;">Payslip</button>'+
      '</td>'+
    '</tr>';
  }).join('');

  document.getElementById('emp-sheet-title').textContent='Salary Sheet — '+monthLabel;
  document.getElementById('emp-sheet-body').innerHTML=
    '<div style="background:#1B5E20;border-radius:12px;padding:12px 16px;margin-bottom:12px;color:white;display:flex;justify-content:space-between;align-items:center;">'+
      '<div><div style="font-size:11px;opacity:.7;">Total Payroll</div><div style="font-size:24px;font-weight:900;">&#8377;'+Number(total).toLocaleString('en-IN')+'</div></div>'+
      '<div style="text-align:right;"><div style="font-size:11px;opacity:.7;">Employees</div><div style="font-size:24px;font-weight:900;">'+rows.length+'</div></div>'+
    '</div>'+
    '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">'+
    '<table style="width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;">'+
      '<thead><tr style="background:#F8FFF8;border-bottom:2px solid #1B5E20;">'+
        '<th style="padding:8px 6px;font-size:10px;font-weight:800;color:var(--text3);text-align:left;text-transform:uppercase;white-space:nowrap;">Employee</th>'+
        '<th style="padding:8px 6px;font-size:10px;font-weight:800;color:var(--text3);text-align:center;white-space:nowrap;">Days / LWP</th>'+
        '<th style="padding:8px 6px;font-size:10px;font-weight:800;color:#2E7D32;text-align:right;white-space:nowrap;">Earnings</th>'+
        '<th style="padding:8px 6px;font-size:10px;font-weight:800;color:#C62828;text-align:right;white-space:nowrap;">Deductions</th>'+
        '<th style="padding:8px 6px;font-size:10px;font-weight:800;color:#1B5E20;text-align:right;white-space:nowrap;">Net Pay</th>'+
        '<th style="padding:8px 6px;"></th>'+
      '</tr></thead>'+
      '<tbody>'+tableRows+'</tbody>'+
      '<tfoot><tr style="border-top:2px solid #1B5E20;background:#F8FFF8;">'+
        '<td colspan="4" style="padding:10px 6px;font-size:12px;font-weight:800;color:#1B5E20;">TOTAL PAYROLL</td>'+
        '<td style="padding:10px 6px;font-size:15px;font-weight:900;color:#1B5E20;text-align:right;">&#8377;'+Number(total).toLocaleString('en-IN')+'</td>'+
        '<td></td>'+
      '</tr></tfoot>'+
    '</table></div>';

  document.getElementById('emp-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeEmpSheet()">Close</button>'+
    '<button class="btn" style="background:#2E7D32;color:white;" onclick="downloadSalaryExcel()">&#128202; Excel</button>'+
    '<button class="btn" style="background:#C62828;color:white;" onclick="downloadSalaryPDF()">&#128196; PDF</button>';
  openEmpSheet();
  toast('Salary sheet ready — tap Payslip to view individual slips','success');
}

// ════ INCREMENT ══════════════════════════════════════
function empIncrementHTML(){
  var active = EMP_LIST.filter(function(e){ return e.status==='active'; });
  if(!active.length) return '<div style="text-align:center;padding:40px;color:var(--text3);">No active employees.</div>';

  return '<div style="background:white;border-radius:14px;padding:12px 14px;margin-bottom:12px;">'+
    '<div style="font-size:12px;font-weight:800;color:#1565C0;margin-bottom:4px;">&#128640; Increment / Revision</div>'+
    '<div style="font-size:11px;color:var(--text3);">Click + Increment to apply a revision. Full pay history is shown below each employee.</div>'+
  '</div>'+
  active.map(function(e){
    var name = (e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'');
    var pays = EMP_PAY.filter(function(p){return p.employee_id===e.id;})
                      .sort(function(a,b){return a.effective_date.localeCompare(b.effective_date);});
    var cur = pays[pays.length-1];
    var curBasic = cur?Number(cur.basic||0):0;

    // Build history log
    var logRows = '';
    if(pays.length){
      logRows = pays.map(function(p,i){
        var typeLabel = {initial:'Initial Fixation',increment:'Increment',revision:'Revision'}[p.pay_type]||'Pay Record';
        var typeColor = {initial:'#1565C0',increment:'#2E7D32',revision:'#E65100'}[p.pay_type]||'#37474F';
        var prevPay   = i>0?pays[i-1]:null;
        var prevBasic = prevPay?Number(prevPay.basic||0):0;
        var diff      = i>0?(Number(p.basic||0)-prevBasic):0;
        var pct       = prevBasic>0?((diff/prevBasic)*100).toFixed(1):'';
        var inc       = i>0?'<span style="color:#2E7D32;font-size:10px;font-weight:700;">+&#8377;'+diff.toLocaleString('en-IN')+(pct?' ('+pct+'%)':'')+'</span>':'';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;'+(i>0?'border-top:1px solid #F0F4F8;':'')+'">'+
          '<div>'+
            '<div style="font-size:11px;font-weight:800;color:'+typeColor+';">'+typeLabel+'</div>'+
            '<div style="font-size:10px;color:var(--text3);">w.e.f. '+p.effective_date+(p.remarks?' &bull; '+p.remarks.replace('Increment: ',''):'')+'</div>'+
            inc+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:8px;">'+
            '<div style="text-align:right;">'+
              '<div style="font-size:12px;font-weight:900;">&#8377;'+Number(p.basic||0).toLocaleString('en-IN')+'</div>'+
              '<div style="font-size:10px;color:var(--text3);">Net &#8377;'+Number(p.net_salary||0).toLocaleString('en-IN')+'</div>'+
            '</div>'+
            (i>0?'<button data-inc-del-payid="'+p.id+'" data-inc-del-name="'+name+'" style="background:#FEE2E2;color:#C62828;border:none;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:800;cursor:pointer;">&#128465;</button>'+'<button id="dl-inc-'+e.id+'-'+i+'" data-eid="'+e.id+'" data-nb="'+p.basic+'" data-ob="'+prevBasic+'" data-dt="'+fmtDate(p.effective_date)+'" data-rm="'+(p.remarks||'')+'" data-pobj="'+encodeURIComponent(JSON.stringify(prevPay||{}))+'" data-nobj="'+encodeURIComponent(JSON.stringify(p))+'" style="background:#E3F2FD;color:#1565C0;border:none;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:800;cursor:pointer;flex-shrink:0;">&#128196;</button>':'<span style="font-size:10px;color:var(--text3);padding:0 4px;">First</span>')+
          '</div>'+
        '</div>';
      }).join('');
    } else {
      logRows = '<div style="font-size:11px;color:#E65100;padding:4px 0;">&#9888; No pay structure fixed yet.</div>';
    }

    return '<div style="background:white;border-radius:12px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">'+
      '<div style="padding:10px 14px;background:#E3F2FD;display:flex;align-items:center;gap:10px;">'+
        '<div style="flex:1;">'+
          '<div style="font-size:13px;font-weight:800;">'+name+'</div>'+
          '<div style="font-size:11px;color:var(--text3);">'+(e.employee_code||e.emp_id||'—')+' &bull; '+
            (curBasic?'Current Basic: <b>&#8377;'+curBasic.toLocaleString('en-IN')+'</b>':'No Pay Fixed')+
          '</div>'+
        '</div>'+
        '<button onclick="empOpenIncrement(\''+e.id+'\',\''+safeN(name)+'\','+curBasic+')" style="background:#1565C0;color:white;border:none;border-radius:8px;padding:7px 14px;font-size:11px;font-weight:800;cursor:pointer;">+ Increment</button>'+
      '</div>'+
      (pays.length?'<div style="padding:8px 14px 10px;border-top:1px solid #F0F4F8;">'+logRows+'</div>':'')+
    '</div>';
  }).join('');
}

function empOpenIncrement(empId, empName, curBasic){
  document.getElementById('emp-sheet-title').textContent = 'Increment — '+empName;
  document.getElementById('emp-sheet-body').innerHTML =
    '<div style="background:#E3F2FD;border-radius:12px;padding:12px 14px;margin-bottom:14px;">'+
      '<div style="font-size:12px;color:var(--text3);">Current Basic</div>'+
      '<div style="font-size:22px;font-weight:900;color:#1565C0;">₹'+Number(curBasic).toLocaleString('en-IN')+'</div>'+
    '</div>'+
    '<label class="flbl">Effective Date *</label>'+
    '<input id="inc-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'+
      '<div><label class="flbl">% Increment</label>'+
        '<input id="inc-pct" class="finp" type="number" step="0.1" placeholder="e.g. 10" oninput="incCalcFromPct()">'+
      '</div>'+
      '<div><label class="flbl">New Basic (₹)</label>'+
        '<input id="inc-new-basic" class="finp" type="number" step="1" value="'+curBasic+'" oninput="incCalcFromAmt()">'+
      '</div>'+
    '</div>'+
    '<div id="inc-diff" style="font-size:13px;font-weight:800;color:#2E7D32;margin:6px 0 12px;"></div>'+
    '<label class="flbl">Reason / Remarks</label>'+
    '<input id="inc-remarks" class="finp" placeholder="e.g. Annual increment, Performance based...">'+
    '<input type="hidden" id="inc-emp-id" value="'+empId+'">'+
    '<input type="hidden" id="inc-cur-basic" value="'+curBasic+'">';

  document.getElementById('emp-sheet-foot').innerHTML =
    '<button class="btn btn-outline" onclick="closeEmpSheet()">Cancel</button>'+
    '<button class="btn" style="background:#1565C0;color:white;" onclick="empSaveIncrement()">&#128640; Apply Increment</button>';
  openEmpSheet();
}

function incCalcFromPct(){
  var curBasic=parseFloat((document.getElementById('inc-cur-basic')||{value:0}).value)||0;
  var p=parseFloat((document.getElementById('inc-pct')||{}).value)||0;
  var nb=Math.round(curBasic*(1+p/100));
  var nel=document.getElementById('inc-new-basic');if(nel)nel.value=nb;
  var dn=document.getElementById('inc-diff');
  if(dn)dn.textContent='+ ₹'+(nb-curBasic).toLocaleString('en-IN');
}
function incCalcFromAmt(){
  var curBasic=parseFloat((document.getElementById('inc-cur-basic')||{value:0}).value)||0;
  var nb=parseFloat((document.getElementById('inc-new-basic')||{}).value)||0;
  var p=curBasic>0?((nb-curBasic)/curBasic*100).toFixed(1):0;
  var pe=document.getElementById('inc-pct');if(pe)pe.value=p;
  var dn=document.getElementById('inc-diff');
  if(dn)dn.textContent='+ ₹'+(nb-curBasic).toLocaleString('en-IN');
}
async function empSaveIncrement(){
  var empId = (document.getElementById('inc-emp-id')||{}).value||'';
  var date  = (document.getElementById('inc-date')||{}).value||'';
  var newBasic = parseFloat((document.getElementById('inc-new-basic')||{value:0}).value)||0;
  var remarks  = (document.getElementById('inc-remarks')||{}).value||'';
  if(!empId||!date||!newBasic){toast('Fill all required fields','warning');return;}

  // Get latest pay record to copy other fields
  var pays = EMP_PAY.filter(function(p){return p.employee_id===empId;}).sort(function(a,b){return b.effective_date.localeCompare(a.effective_date);});
  var cur = pays[0]||{};

  var basic = newBasic;
  var da    = cur.da||0; var hra = cur.hra||0; var conv = cur.conveyance||0;
  var spec  = cur.special_allowance||0; var med = cur.medical_allowance||0; var other = cur.other_allowance||0;
  var gross = basic+da+hra+conv+spec+med+other;
  var pfOn  = cur.pf_applicable!==false;
  var pfEmp = pfOn?Math.round(basic*0.12):0;
  var pfEmr = pfOn?Math.round(basic*0.12):0;
  var esicOn = cur.esic_applicable!==false;
  var esicEmp = esicOn&&gross<=21000?Math.round(gross*0.0075):0;
  var esicEmr = esicOn&&gross<=21000?Math.round(gross*0.0325):0;
  var tds = cur.tds||0;
  var pt  = cur.profession_tax||200;
  var net = Math.max(0,gross-pfEmp-esicEmp-tds-pt);

  var data = {
    employee_id:empId, effective_date:date, basic:basic,
    da:da, hra:hra, conveyance:conv, special_allowance:spec, medical_allowance:med, other_allowance:other,
    gross:gross, pf_employee:pfEmp, pf_employer:pfEmr, esic_employee:esicEmp, esic_employer:esicEmr,
    tds:tds, profession_tax:pt, net_salary:net, pay_type:'increment',
    pf_applicable:pfOn, esic_applicable:esicOn,
    extra_earnings:cur.extra_earnings||null, extra_deductions:cur.extra_deductions||null,
    remarks:'Increment: '+remarks,
    created_by:currentUser?currentUser.name:null
  };

  try{
    toast('Saving increment...','info');
    var res = await sbInsert('employee_pay',data);
    if(res&&res[0]) EMP_PAY.unshift(res[0]);
    window._lastIncrement = {empId:empId, newBasic:newBasic, oldBasic:cur.basic||0, date:date, remarks:remarks};
        toast('Increment applied! ₹'+newBasic.toLocaleString('en-IN'),'success');
    // Show download option in sheet
    document.getElementById('emp-sheet-title').textContent = 'Increment Applied';
    document.getElementById('emp-sheet-body').innerHTML =
      '<div style="background:#E8F5E9;border-radius:14px;padding:20px;text-align:center;">'+
        '<div style="font-size:36px;margin-bottom:10px;">&#128640;</div>'+
        '<div style="font-size:16px;font-weight:900;color:#1B5E20;margin-bottom:6px;">Increment Applied!</div>'+
        '<div style="font-size:13px;color:var(--text3);">New Basic: <b style="color:#1B5E20;">&#8377;'+newBasic.toLocaleString('en-IN')+'</b></div>'+
        '<div style="font-size:12px;color:var(--text3);margin-top:4px;">w.e.f. '+date+'</div>'+
      '</div>';
    document.getElementById('emp-sheet-foot').innerHTML =
      '<button class="btn btn-outline" onclick="closeEmpSheet();empRender();">Close</button>'+
      '<button class="btn" id="inc-letter-btn" style="background:#1565C0;color:white;">&#128196; Download Letter</button>';
    // Store new pay record for letter download
    var _newPayRec = (res&&res[0])?res[0]:Object.assign({},data);
    var _incBtn = document.getElementById('inc-letter-btn');
    if(_incBtn)(function(eid,nb,ob,dt,rm,op,np){
      _incBtn.addEventListener('click',function(){downloadIncrementLetter(eid,nb,ob,dt,rm,op,np);});
    })(empId,newBasic,cur.basic||0,date,remarks,cur,_newPayRec);
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

// ════════════════════════════════════════════════════════════════════════
// HR ORDERS — unified history for Pay Fixation, Increment, Transfer, Promotion
// Table: employee_orders (id, employee_id, order_type, order_date, effective_date,
//         details jsonb, order_ref, created_by, created_at)
// ════════════════════════════════════════════════════════════════════════

var EMP_ORDERS = []; // loaded once per session

async function hrLoadOrders(){
  try{
    var rows = await sbFetch('employee_orders',{select:'*',order:'effective_date.desc'});
    EMP_ORDERS = Array.isArray(rows)?rows:[];
  }catch(e){ EMP_ORDERS=[]; }
}

async function hrSaveOrder(empId, orderType, effectiveDate, details, orderRef){
  var data = {
    employee_id: empId,
    order_type:  orderType,           // 'pay_fixation' | 'increment' | 'transfer' | 'promotion'
    order_date:  new Date().toISOString().slice(0,10),
    effective_date: effectiveDate,
    details:     JSON.stringify(details),
    order_ref:   orderRef||null,
    created_by:  currentUser?currentUser.name:null
  };
  try{
    var res = await sbInsert('employee_orders', data);
    if(res&&res[0]) EMP_ORDERS.unshift(res[0]);
    return res&&res[0];
  }catch(e){ console.warn('hrSaveOrder error:',e); return null; }
}


async function hrDeleteOrder(orderId, label, refreshFn){
  if(!confirm('Delete "'+label+'"?\n\nThis will permanently remove this record and cannot be undone.')) return;
  try{
    var order = EMP_ORDERS.find(function(o){return o.id===orderId;});
    var details = {};
    if(order){ try{details=JSON.parse(order.details||'{}');}catch(ex){} }

    await sbDelete('employee_orders', orderId);
    EMP_ORDERS = EMP_ORDERS.filter(function(o){return o.id!==orderId;});

    var empId = order ? order.employee_id : null;
    var idx = empId ? EMP_LIST.findIndex(function(e){return e.id===empId;}) : -1;

    // INCREMENT: delete pay record, show old basic
    if(order && order.order_type==='increment'){
      var payId = details.pay_record_id || (details.newPay&&details.newPay.id) || null;
      if(payId){ try{ await sbDelete('employee_pay',payId); EMP_PAY=EMP_PAY.filter(function(p){return p.id!==payId;}); }catch(ex){} }
      var oldBasic = details.oldBasic || (details.oldPay&&details.oldPay.basic) || null;
      toast(label+' deleted'+(oldBasic?' \u2014 reverted to \u20b9'+Number(oldBasic).toLocaleString('en-IN'):''),'info');
      if(typeof refreshFn==='function') refreshFn();
      return;
    }

    // PAY FIXATION / REVISION: delete linked pay record
    if(order && (order.order_type==='pay_fixation'||order.order_type==='revision')){
      var payId = details.pay_record_id || (details.newPay&&details.newPay.id) || null;
      if(payId){ try{ await sbDelete('employee_pay',payId); EMP_PAY=EMP_PAY.filter(function(p){return p.id!==payId;}); }catch(ex){} }
      toast(label+' deleted','info');
      if(typeof refreshFn==='function') refreshFn();
      return;
    }

    // PROMOTION: revert designation to previous role
    if(order && order.order_type==='promotion' && empId){
      var prevRole = details.prevRole||null;
      if(prevRole){
        try{
          await sbUpdate('employees',empId,{designation:prevRole});
          if(idx>-1) EMP_LIST[idx].designation=prevRole;
          toast(label+' deleted \u2014 designation reverted to "'+prevRole+'"','info');
        }catch(ex){ toast(label+' deleted (could not revert designation \u2014 update manually)','warning'); }
      } else {
        toast(label+' deleted \u2014 no previous role stored, update manually','info');
      }
      if(typeof refreshFn==='function') refreshFn();
      return;
    }

    // TRANSFER: revert department to previous dept
    if(order && order.order_type==='transfer' && empId){
      var prevDept = details.prevDept||null;
      if(prevDept){
        try{
          await sbUpdate('employees',empId,{department:prevDept});
          if(idx>-1) EMP_LIST[idx].department=prevDept;
          toast(label+' deleted \u2014 department reverted to "'+prevDept+'"','info');
        }catch(ex){ toast(label+' deleted (could not revert department \u2014 update manually)','warning'); }
      } else {
        toast(label+' deleted','info');
      }
      if(typeof refreshFn==='function') refreshFn();
      return;
    }

    // RESIGNATION: reinstate employee as active
    if(order && order.order_type==='resignation' && empId){
      try{
        await sbUpdate('employees',empId,{
          status:'active',
          resignation_date:null,
          last_working_day:null,
          resignation_reason:null,
          rejection_reason:null
        });
        if(idx>-1){
          EMP_LIST[idx].status='active';
          EMP_LIST[idx].resignation_date=null;
          EMP_LIST[idx].last_working_day=null;
        }
        toast(label+' deleted \u2014 employee reinstated as Active','success');
      }catch(ex){ toast(label+' deleted (could not reinstate \u2014 update manually)','warning'); }
      if(typeof refreshFn==='function') refreshFn();
      return;
    }

    toast(label+' deleted','info');
    if(typeof refreshFn==='function') refreshFn();
  }catch(e){toast('Error: '+e.message,'error');}
}

function hrOrdersForEmp(empId){
  return EMP_ORDERS.filter(function(o){return o.employee_id===empId;})
                   .sort(function(a,b){return b.effective_date.localeCompare(a.effective_date);});
}

// ─── HR History Tab in Transfer module ───────────────────────────────────
function empTransferHTML(){
  var active = EMP_LIST.filter(function(e){ return e.status==='active'; });
  if(!active.length) return '<div style="text-align:center;padding:40px;color:var(--text3);">No active employees.</div>';

  // Ensure orders loaded
  if(!EMP_ORDERS.length) hrLoadOrders();

  return '<div style="background:white;border-radius:14px;padding:12px 14px;margin-bottom:12px;">'+
    '<div style="font-size:12px;font-weight:800;color:#6A1B9A;margin-bottom:4px;">&#128260; Transfer / Promotion / Resignation</div>'+
    '<div style="font-size:11px;color:var(--text3);">All HR orders are recorded with date and can be downloaded anytime.</div>'+
  '</div>'+
  active.map(function(e){
    var name = (e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'');
    var orders = hrOrdersForEmp(e.id).filter(function(o){return o.order_type==='transfer'||o.order_type==='promotion';});
    var orderLog = '';
    if(orders.length){
      orderLog = '<div style="padding:8px 14px 10px;border-top:1px solid #F0F4F8;">'+
        orders.map(function(o,i){
          var d = {}; try{d=JSON.parse(o.details||'{}');}catch(ex){}
          var isPromo = o.order_type==='promotion';
          var typeCol = isPromo?'#1565C0':'#6A1B9A';
          var typeLabel = isPromo?'Promotion':'Transfer';
          var summary = isPromo
            ? ('To: '+(d.newRole||'—')+(d.grade?' · Grade: '+d.grade:''))
            : ('Dept: '+(d.newDept||'—')+(d.newProject?' · '+d.newProject:''));
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;'+(i>0?'border-top:1px solid #F0F4F8;':'')+'">'+
            '<div style="flex:1;min-width:0;">'+
              '<div style="font-size:11px;font-weight:800;color:'+typeCol+';">'+typeLabel+'</div>'+
              '<div style="font-size:10px;color:var(--text3);">w.e.f. '+fmtDate(o.effective_date)+' · '+summary+(o.order_ref?' · '+o.order_ref:'')+'</div>'+
            '</div>'+
            '<div style="display:flex;gap:6px;flex-shrink:0;">'+
              '<button data-del-ord-id="'+o.id+'" data-del-ord-label="'+typeLabel+' '+fmtDate(o.effective_date)+'" style="background:#FEE2E2;color:#C62828;border:none;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:800;cursor:pointer;">&#128465;</button>'+
              '<button id="hr-ord-'+o.id+'" data-type="'+o.order_type+'" data-eid="'+e.id+'" data-det="'+encodeURIComponent(o.details||'{}')+'" data-dt="'+fmtDate(o.effective_date)+'" style="background:#E8EAF6;color:#3949AB;border:none;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:800;cursor:pointer;">&#128196;</button>'+
            '</div>'+
          '</div>';
        }).join('')+
      '</div>';
    }
    return '<div style="background:white;border-radius:12px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">'+
      '<div style="padding:10px 14px;background:#F3E5F5;display:flex;align-items:center;gap:8px;">'+
        '<div style="flex:1;">'+
          '<div style="font-size:13px;font-weight:800;">'+name+'</div>'+
          '<div style="font-size:11px;color:var(--text3);">'+(e.designation||e.role||'—')+' · '+(e.department||'—')+'</div>'+
        '</div>'+
        '<button data-trf-emp="'+e.id+'" data-trf-name="'+safeN(name)+'" style="background:#6A1B9A;color:white;border:none;border-radius:8px;padding:6px 10px;font-size:10px;font-weight:800;cursor:pointer;">&#128260; Transfer</button>'+
        '<button data-pro-emp="'+e.id+'" data-pro-name="'+safeN(name)+'" style="background:#1565C0;color:white;border:none;border-radius:8px;padding:6px 10px;font-size:10px;font-weight:800;cursor:pointer;">&#11014; Promote</button>'+
        '<button data-res-emp="'+e.id+'" data-res-name="'+safeN(name)+'" style="background:#C62828;color:white;border:none;border-radius:8px;padding:6px 10px;font-size:10px;font-weight:800;cursor:pointer;">&#128683; Resign</button>'+
      '</div>'+
      orderLog+
    '</div>';
  }).join('');
}

// Wire download buttons in transfer tab after render
function hrWireOrderButtons(){
  setTimeout(function(){
    // ── Transfer / Promote / Resign action buttons ──────────────────────
    document.querySelectorAll('[data-trf-emp]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var eid  = btn.getAttribute('data-trf-emp');
        var name = btn.getAttribute('data-trf-name')||'';
        empOpenTransfer(eid, name);
      });
    });
    document.querySelectorAll('[data-pro-emp]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var eid  = btn.getAttribute('data-pro-emp');
        var name = btn.getAttribute('data-pro-name')||'';
        empOpenPromotion(eid, name);
      });
    });
    document.querySelectorAll('[data-res-emp]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var eid  = btn.getAttribute('data-res-emp');
        var name = btn.getAttribute('data-res-name')||'';
        empOpenResignation(eid, name);
      });
    });
    // ── Download/letter buttons ──────────────────────────────────────────
    document.querySelectorAll('[id^="hr-ord-"]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var type = btn.getAttribute('data-type');
        var eid  = btn.getAttribute('data-eid');
        var dt   = btn.getAttribute('data-dt');
        var det  = {}; try{det=JSON.parse(decodeURIComponent(btn.getAttribute('data-det')||'{}'));}catch(ex){}
        downloadTransferOrder(eid, type, Object.assign({date:dt},det));
      });
    });
    // ── Delete buttons for transfer/promotion orders ─────────────────────
    document.querySelectorAll('[data-del-ord-id]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var orderId = btn.getAttribute('data-del-ord-id');
        var label   = btn.getAttribute('data-del-ord-label')||'this entry';
        hrDeleteOrder(orderId, label, function(){
          empTab('transfer', document.getElementById('emp-t-transfer'));
        });
      });
    });
  },200);
}

// ─── Updated Save Functions ───────────────────────────────────────────────

async function empSaveTransfer(){
  var empId    = (document.getElementById('tr-emp-id')||{}).value||'';
  var date     = (document.getElementById('tr-date')||{}).value||'';
  var dept     = (document.getElementById('tr-dept')||{}).value||'';
  var proj     = (document.getElementById('tr-proj')||{}).value||'';
  var reporting= (document.getElementById('tr-reporting')||{}).value||'';
  var reason   = (document.getElementById('tr-reason')||{}).value||'';
  if(!empId||!date){toast('Effective date required','warning');return;}
  try{
    toast('Saving...','info');
    // Update employee current state
    var upd = {department:dept||null, reporting_to:reporting||null};
    if(proj) upd.project_id=proj;
    await sbUpdate('employees',empId,upd);
    var idx=EMP_LIST.findIndex(function(e){return e.id===empId;});
    if(idx>-1) EMP_LIST[idx]=Object.assign(EMP_LIST[idx],upd,{department:dept});

    // Save order record
    var details = {newDept:dept,newProject:proj,reportingTo:reporting,remarks:reason};
    var emp = EMP_LIST[idx]||{};
    var prevDept = emp.department||'';
    details.prevDept = prevDept;
    details.prevRole = emp.designation||emp.role||'';
    await hrSaveOrder(empId,'transfer',date,details,reason||null);

    toast('Transfer recorded!','success');
    var _det = {date:date,newDept:dept,newProject:proj,remarks:reason};
    document.getElementById('emp-sheet-title').textContent='Transfer Recorded';
    document.getElementById('emp-sheet-body').innerHTML=
      '<div style="background:#F3E5F5;border-radius:14px;padding:20px;text-align:center;">'+
        '<div style="font-size:36px;margin-bottom:10px;">&#128260;</div>'+
        '<div style="font-size:16px;font-weight:900;color:#6A1B9A;">Transfer Recorded</div>'+
        (dept?'<div style="font-size:13px;color:var(--text3);margin-top:6px;">New Dept: <b>'+dept+'</b></div>':'')+
        '<div style="font-size:11px;color:var(--text3);margin-top:4px;">Effective: '+date+'</div>'+
      '</div>';
    document.getElementById('emp-sheet-foot').innerHTML=
      '<button class="btn btn-outline" onclick="closeEmpSheet();empRender();">Close</button>'+
      '<button class="btn" id="trf-order-btn" style="background:#6A1B9A;color:white;">&#128196; Transfer Order</button>';
    var _trfBtn=document.getElementById('trf-order-btn');
    if(_trfBtn)(function(eid,dt,dp,pj,rm){
      _trfBtn.addEventListener('click',function(){downloadTransferOrder(eid,'transfer',{date:dt,newDept:dp,newProject:pj,remarks:rm});});
    })(empId,date,dept,proj,reason);
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

function empOpenTransfer(empId, empName){
  document.getElementById('emp-sheet-title').textContent = 'Transfer — '+empName;
  document.getElementById('emp-sheet-body').innerHTML =
    '<label class="flbl">Effective Date *</label><input id="tr-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<label class="flbl">New Department</label><select id="tr-dept" class="fsel"><option value="">Loading...</option></select>'+
    '<label class="flbl">New Project</label><select id="tr-proj" class="fsel"><option value="">Loading...</option></select>'+
    '<label class="flbl">New Reporting To</label><input id="tr-reporting" class="finp" placeholder="Manager name">'+
    '<label class="flbl">Reason / Order No.</label><input id="tr-reason" class="finp" placeholder="Transfer order reference">'+
    '<input type="hidden" id="tr-emp-id" value="'+empId+'">';
  document.getElementById('emp-sheet-foot').innerHTML =
    '<button class="btn btn-outline" onclick="closeEmpSheet()">Cancel</button>'+
    '<button class="btn" style="background:#6A1B9A;color:white;" onclick="empSaveTransfer()">&#128260; Confirm Transfer</button>';
  openEmpSheet();
  Promise.all([
    sbFetch('categories',{select:'name',filter:'type=eq.dept&active=eq.true',order:'name.asc'}),
    sbFetch('projects',{select:'id,name',order:'name.asc'})
  ]).then(function(r){
    var depts=Array.isArray(r[0])?r[0]:[];
    var projs=Array.isArray(r[1])?r[1]:[];
    var ds=document.getElementById('tr-dept');
    if(ds) ds.innerHTML='<option value="">-- Select --</option>'+depts.map(function(d){return '<option value="'+d.name+'">'+d.name+'</option>';}).join('');
    var ps=document.getElementById('tr-proj');
    if(ps) ps.innerHTML='<option value="">All Projects</option>'+projs.map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>';}).join('');
  }).catch(function(){});
}

function empOpenPromotion(empId, empName){
  document.getElementById('emp-sheet-title').textContent = 'Promotion — '+empName;
  document.getElementById('emp-sheet-body').innerHTML =
    '<label class="flbl">Effective Date *</label><input id="pro-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<label class="flbl">New Designation / Role</label><select id="pro-role" class="fsel"><option value="">Loading...</option></select>'+
    '<label class="flbl">Remarks / Order Reference</label><input id="pro-remarks" class="finp" placeholder="Promotion order reference...">'+
    '<input type="hidden" id="pro-emp-id" value="'+empId+'">';
  document.getElementById('emp-sheet-foot').innerHTML =
    '<button class="btn btn-outline" onclick="closeEmpSheet()">Cancel</button>'+
    '<button class="btn" style="background:#1565C0;color:white;" onclick="empSavePromotion()">&#11014; Confirm Promotion</button>';
  openEmpSheet();
  sbFetch('categories',{select:'name',filter:'type=eq.role&active=eq.true',order:'name.asc'}).then(function(d){
    var rs=document.getElementById('pro-role');
    if(rs&&Array.isArray(d)) rs.innerHTML='<option value="">-- Select --</option>'+d.map(function(r){return '<option value="'+r.name+'">'+r.name+'</option>';}).join('');
  }).catch(function(){});
}

async function empSavePromotion(){
  var empId  = (document.getElementById('pro-emp-id')||{}).value||'';
  var date   = (document.getElementById('pro-date')||{}).value||'';
  var role   = (document.getElementById('pro-role')||{}).value||'';
  var grade  = '';
  var remarks= (document.getElementById('pro-remarks')||{}).value||'';
  if(!empId){toast('Error: no employee','error');return;}
  if(!date){toast('Effective date required','warning');return;}
  try{
    toast('Saving...','info');
    var emp = EMP_LIST.find(function(e){return e.id===empId;})||{};
    var prevRole = emp.designation||emp.role||'';
    var prevGrade= emp.grade||'';
    var upd = {designation:role||null, grade:grade||null};
    await sbUpdate('employees',empId,upd);
    var idx=EMP_LIST.findIndex(function(e){return e.id===empId;});
    if(idx>-1) EMP_LIST[idx]=Object.assign(EMP_LIST[idx],upd);

    // Save order record
    var details = {newRole:role,grade:grade,remarks:remarks,prevRole:prevRole,prevGrade:prevGrade};
    await hrSaveOrder(empId,'promotion',date,details,remarks||null);

    toast('Promotion recorded!','success');
    document.getElementById('emp-sheet-title').textContent='Promotion Recorded';
    document.getElementById('emp-sheet-body').innerHTML=
      '<div style="background:#E3F2FD;border-radius:14px;padding:20px;text-align:center;">'+
        '<div style="font-size:36px;margin-bottom:10px;">&#11014;</div>'+
        '<div style="font-size:16px;font-weight:900;color:#1565C0;">Promotion Recorded</div>'+
        (role?'<div style="font-size:13px;color:var(--text3);margin-top:6px;">New Role: <b>'+role+'</b></div>':'')+
        '<div style="font-size:11px;color:var(--text3);margin-top:4px;">Effective: '+date+'</div>'+
      '</div>';
    document.getElementById('emp-sheet-foot').innerHTML=
      '<button class="btn btn-outline" onclick="closeEmpSheet();empRender();">Close</button>'+
      '<button class="btn" id="promo-order-btn" style="background:#1565C0;color:white;">&#128196; Promotion Order</button>';
    var _promoBtn=document.getElementById('promo-order-btn');
    if(_promoBtn)(function(eid,dt,nr,gr,rm){
      _promoBtn.addEventListener('click',function(){downloadTransferOrder(eid,'promotion',{date:dt,newRole:nr,grade:gr,remarks:rm});});
    })(empId,date,role,grade,remarks);
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

// Also save order record in empSavePay (pay fixation) — patch
var _origSavePay = empSavePay;
empSavePay = async function(){
  // Get values before calling original (it will clear the form)
  var empId   = (document.getElementById('pf-emp-id')||{}).value||'';
  var date    = (document.getElementById('pf-date')||{}).value||'';
  var remarks = (document.getElementById('pf-remarks')||{}).value||'';
  await _origSavePay();
  // After save, record the order
  if(empId&&date){
    var pays = EMP_PAY.filter(function(p){return p.employee_id===empId;})
                      .sort(function(a,b){return b.effective_date.localeCompare(a.effective_date);});
    var latest = pays[0];
    if(latest){
      var type = pays.length<=1?'pay_fixation':'revision';
      var details = {
        basic:latest.basic, gross:latest.gross, net_salary:latest.net_salary,
        pf_employee:latest.pf_employee, esic_employee:latest.esic_employee,
        tds:latest.tds, profession_tax:latest.profession_tax,
        extra_earnings:latest.extra_earnings, remarks:remarks,
        pay_record_id: latest.id
      };
      hrSaveOrder(empId,type,date,details,remarks||null);
    }
  }
};

// Hook into empSaveIncrement to also save order
var _origSaveIncrement = empSaveIncrement;
empSaveIncrement = async function(){
  await _origSaveIncrement();
  // _lastIncrement is set inside empSaveIncrement after success
  var li = window._lastIncrement;
  if(li&&li.empId){
    var pays = EMP_PAY.filter(function(p){return p.employee_id===li.empId;})
                      .sort(function(a,b){return b.effective_date.localeCompare(a.effective_date);});
    var latest = pays[0];
    var prev   = pays[1];
    var details = {
      newBasic:li.newBasic, oldBasic:li.oldBasic,
      newPay: latest?{basic:latest.basic,gross:latest.gross,net_salary:latest.net_salary,
                     pf_employee:latest.pf_employee,esic_employee:latest.esic_employee,
                     tds:latest.tds,profession_tax:latest.profession_tax,
                     extra_earnings:latest.extra_earnings,id:latest.id}:null,
      oldPay: prev?{basic:prev.basic,gross:prev.gross,net_salary:prev.net_salary,
                   pf_employee:prev.pf_employee,esic_employee:prev.esic_employee,
                   tds:prev.tds,profession_tax:prev.profession_tax,
                   extra_earnings:prev.extra_earnings,id:prev.id}:null,
      remarks:li.remarks
    };
    hrSaveOrder(li.empId,'increment',li.date,details,li.remarks||null);
  }
};

// ─── Pay Fixation History Log per Employee in empPayHTML ────────────────
// Show Pay + Increment orders in the pay fixation list
function hrPayLogForEmp(empId){
  var orders = EMP_ORDERS.filter(function(o){
    return o.employee_id===empId && (o.order_type==='pay_fixation'||o.order_type==='increment'||o.order_type==='revision');
  }).sort(function(a,b){return a.effective_date.localeCompare(b.effective_date);});
  if(!orders.length) return '';

  return '<div style="margin:8px 0 0;border-top:1px solid #F0F4F8;padding-top:8px;">'+
    '<div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;margin-bottom:6px;">Order History</div>'+
    orders.map(function(o,i){
      var d={}; try{d=JSON.parse(o.details||'{}');}catch(ex){}
      var typeLabel={'pay_fixation':'Initial Fixation','increment':'Increment','revision':'Revision'}[o.order_type]||o.order_type;
      var typeColor={'pay_fixation':'#1565C0','increment':'#2E7D32','revision':'#E65100'}[o.order_type]||'#37474F';
      var hasFullData = d.newPay||d.oldPay||(d.gross&&d.net_salary);
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;'+(i>0?'border-top:1px solid #F9F9F9;':'')+'">'+
        '<div style="flex:1;min-width:0;">'+
          '<span style="font-size:10px;font-weight:800;color:'+typeColor+';">'+typeLabel+'</span>'+
          '<span style="font-size:10px;color:var(--text3);margin-left:6px;">'+fmtDate(o.effective_date)+'</span>'+
          (d.remarks?' <span style="font-size:10px;color:var(--text3);">· '+d.remarks.replace('Increment: ','')+'</span>':'')+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">'+
          (d.net_salary||d.newPay?'<span style="font-size:11px;font-weight:800;">Net &#8377;'+(d.net_salary||(d.newPay?d.newPay.net_salary:0)||0).toLocaleString('en-IN')+'</span>':'')+
          '<button data-del-pay-ord-id="'+o.id+'" data-del-pay-ord-label="'+typeLabel+' '+fmtDate(o.effective_date)+'" style="background:#FEE2E2;color:#C62828;border:none;border-radius:6px;padding:3px 7px;font-size:10px;font-weight:800;cursor:pointer;">&#128465;</button>'+
          (hasFullData?'<button data-ord-id="'+o.id+'" data-ord-type="'+o.order_type+'" style="background:#E3F2FD;color:#1565C0;border:none;border-radius:6px;padding:3px 7px;font-size:10px;font-weight:800;cursor:pointer;">&#128196;</button>':'')+
        '</div>'+
      '</div>';
    }).join('')+
  '</div>';
}

function empOpenResignation(empId, empName){
  document.getElementById('emp-sheet-title').textContent = 'Resignation — '+empName;
  document.getElementById('emp-sheet-body').innerHTML =
    '<div style="background:#FFEBEE;border-radius:12px;padding:12px 14px;margin-bottom:14px;">'+
      '<div style="font-size:13px;font-weight:800;color:#C62828;">&#9888; This will mark '+empName+' as Resigned</div>'+
      '<div style="font-size:11px;color:var(--text3);margin-top:4px;">Employee will be moved to the Resigned tab. All records will be preserved.</div>'+
    '</div>'+
    '<label class="flbl">Resignation Date *</label><input id="res-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<label class="flbl">Last Working Day *</label><input id="res-lwd" class="finp" type="date" value="'+new Date(Date.now()+30*24*60*60*1000).toISOString().slice(0,10)+'">'+
    '<label class="flbl">Reason</label><select id="res-reason" class="fsel">'+
      '<option>Personal reasons</option><option>Better opportunity</option><option>Health reasons</option>'+
      '<option>Relocation</option><option>Retirement</option><option>Termination</option><option>Other</option>'+
    '</select>'+
    '<label class="flbl">Remarks / Exit interview notes</label>'+
    '<textarea id="res-remarks" class="ftxt" placeholder="Exit interview notes..." style="min-height:60px;"></textarea>'+
    '<input type="hidden" id="res-emp-id" value="'+empId+'">';
  document.getElementById('emp-sheet-foot').innerHTML =
    '<button class="btn btn-outline" onclick="closeEmpSheet()">Cancel</button>'+
    '<button class="btn" style="background:#C62828;color:white;" onclick="empSaveResignation()">&#128683; Confirm Resignation</button>';
  openEmpSheet();
}

async function empSaveResignation(){
  var empId = (document.getElementById('res-emp-id')||{}).value||'';
  var resDate = (document.getElementById('res-date')||{}).value||'';
  var lwd     = (document.getElementById('res-lwd')||{}).value||'';
  var reason  = (document.getElementById('res-reason')||{}).value||'';
  var remarks = (document.getElementById('res-remarks')||{}).value||'';
  if(!empId||!resDate||!lwd){toast('Fill all required fields','warning');return;}
  try{
    // Store resignation info in fields that exist; extra info in rejection_reason
    var resInfo = 'Resigned: '+resDate+' | LWD: '+lwd+' | '+reason+(remarks?' | '+remarks:'');
    var updateData = {status:'resigned', rejection_reason:resInfo};
    // Try with extra columns (run SQL to add them if missing)
    try{
      updateData.resignation_date = resDate;
      updateData.last_working_day = lwd;
      updateData.resignation_reason = reason+(remarks?' | '+remarks:'');
    }catch(ex){}
    await sbUpdate('employees',empId,updateData);
    var idx=EMP_LIST.findIndex(function(e){return e.id===empId;});
    if(idx>-1) EMP_LIST[idx].status='resigned';
    // Save order record so deletion can reinstate the employee
    await hrSaveOrder(empId,'resignation',resDate,{
      resDate:resDate, lwd:lwd, reason:reason, remarks:remarks
    },null);
    toast('Resignation recorded','info');
    closeEmpSheet(); empRender();
  }catch(e){toast('Error: '+e.message,'error');}
}


// empViewDetail — opens a read-only detail sheet for pending/resigned employees
function empViewDetail(id){
  var e=EMP_LIST.find(function(x){return x.id===id;});
  if(!e)return;
  var name=((e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'')).trim()||'Unknown';
  var statusCol={active:'#2E7D32',pending:'#F57F17',resigned:'#C62828',rejected:'#C62828'}[e.status]||'#37474F';

  function row(l,v){
    if(!v)return '';
    return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid #F0F4F8;gap:8px;">'+
      '<span style="font-size:11px;color:var(--text3);font-weight:700;flex-shrink:0;min-width:110px;">'+l+'</span>'+
      '<span style="font-size:12px;font-weight:700;text-align:right;word-break:break-all;">'+v+'</span>'+
    '</div>';
  }
  function sec(icon,label,color){
    return '<div style="font-size:10px;font-weight:800;color:'+color+';text-transform:uppercase;letter-spacing:.5px;padding:10px 0 6px;">'+icon+' '+label+'</div>';
  }
  function docLink(url,label){
    if(!url)return '';
    return '<div style="margin-bottom:8px;"><div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px;">'+label+'</div>'+
      '<a href="'+url+'" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#E3F2FD;color:#1565C0;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;text-decoration:none;">&#128196; View</a></div>';
  }

  var photoUrl=e.profile_photo||e.photo_url||e.photoUrl||'';
  var init=name.split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase()||'?';

  document.getElementById('emp-sheet-title').textContent=name;
  document.getElementById('emp-sheet-body').innerHTML=
    '<div style="background:'+statusCol+';border-radius:14px;padding:14px;margin-bottom:14px;color:white;display:flex;align-items:center;gap:14px;">'+
      '<div style="width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;flex-shrink:0;overflow:hidden;">'+
        (photoUrl?'<img src="'+photoUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">':init)+
      '</div>'+
      '<div style="flex:1;">'+
        '<div style="font-size:18px;font-weight:900;">'+name+'</div>'+
        '<div style="font-size:12px;opacity:.8;margin-top:3px;">'+(e.designation||e.role||'—')+' • '+(e.department||e.dept||'—')+'</div>'+
        '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">'+
          '<span style="background:rgba(255,255,255,.2);border-radius:5px;padding:2px 10px;font-size:11px;font-weight:800;">'+((e.status||'pending').toUpperCase())+'</span>'+
          (e.employee_code||e.emp_id?'<span style="background:rgba(255,255,255,.15);border-radius:5px;padding:2px 10px;font-size:11px;font-weight:700;">'+(e.employee_code||e.emp_id)+'</span>':'')+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div style="background:white;border-radius:12px;padding:4px 14px;margin-bottom:10px;">'+
      sec('&#128100;','Personal Details','#1565C0')+
      row('Mobile',e.phone||e.mobile||null)+
      row('Email',e.email||null)+
      row('Date of Birth',e.date_of_birth||e.dob||null)+
      row('Gender',e.gender||null)+
      row('Blood Group',e.blood_group||e.blood||null)+
      row('Marital Status',e.marital_status||e.marital||null)+
      row('Address',e.address||null)+
      row('Emergency Contact',e.emergency_name||e.ecName||e.emergency_contact||null)+
      row('Emergency Mobile',e.emergency_phone||e.ecPhone||null)+
    '</div>'+
    '<div style="background:white;border-radius:12px;padding:4px 14px;margin-bottom:10px;">'+
      sec('&#127959;','Employment Details','#2E7D32')+
      row('Date of Joining',e.date_of_joining||e.doj||null)+
      row('Designation',e.designation||e.access||null)+
      row('Department',e.department||e.dept||null)+
      row('Grade',e.grade||null)+
      row('Category',e.category||e.empType||null)+
      row('Employment Type',e.emp_type||null)+
      row('Work Location',e.work_location||e.location||null)+
      row('Reporting To',e.reporting_to||null)+
    '</div>'+
    '<div style="background:white;border-radius:12px;padding:4px 14px;margin-bottom:10px;">'+
      sec('&#128203;','KYC / Documents','#6A1B9A')+
      row('Aadhaar No.',e.aadhar||e.aadhar_no||null)+
      row('PAN No.',e.pan||e.pan_no||null)+
      row('UAN (PF)',e.pf_no||e.pf||e.uan_no||null)+
      row('ESIC No.',e.esic_no||e.esic||null)+
    '</div>'+
    '<div style="background:white;border-radius:12px;padding:4px 14px;margin-bottom:10px;">'+
      sec('&#127981;','Bank Details','#C62828')+
      row('Bank Name',e.bank_name||e.bank||null)+
      row('Account No.',e.account_no||e.accNo||null)+
      row('IFSC Code',e.ifsc||null)+
      row('Account Holder',e.account_holder||e.accName||null)+
    '</div>'+
    ((e.aadhar_doc_url||e.pan_doc_url)?
      '<div style="background:white;border-radius:12px;padding:12px 14px;margin-bottom:10px;">'+
        sec('&#128206;','Uploaded Documents','#1565C0')+
        docLink(e.aadhar_doc_url,'Aadhaar Card')+
        docLink(e.pan_doc_url,'PAN Card')+
      '</div>':'')+
    (e.rejection_reason?
      '<div style="background:#FFF3E0;border-radius:12px;padding:12px 14px;margin-bottom:10px;">'+
        '<div style="font-size:11px;font-weight:800;color:#E65100;margin-bottom:4px;">Notes</div>'+
        '<div style="font-size:12px;color:var(--text);">'+e.rejection_reason+'</div>'+
      '</div>':'')+
    '<input type="hidden" id="vd-emp-id" value="'+e.id+'">';

  var foot='<button class="btn btn-outline" onclick="closeEmpSheet()">Close</button>';
  if(e.status==='pending'||!e.status){
    foot+='<button class="btn" style="background:#C62828;color:white;" onclick="empReject(\''+e.id+'\')">✕ Reject</button>';
    foot+='<button class="btn" style="background:#2E7D32;color:white;" onclick="empApprove(\''+e.id+'\')">✓ Approve</button>';
  } else {
    foot+='<button class="btn btn-navy" onclick="closeEmpSheet();setTimeout(function(){empOpenForm(EMP_LIST.find(function(x){return x.id===\''+e.id+'\';}))||empOpenForm({id:\''+e.id+'\'});},300);">&#9998; Edit</button>';
  }
  document.getElementById('emp-sheet-foot').innerHTML=foot;
  openEmpSheet();
}

async function empApprove(id){
  var e=EMP_LIST.find(function(x){return x.id===id;});
  if(!e)return;
  var name=((e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'')).trim();
  if(!confirm('Approve "'+name+'" as active employee?'))return;
  try{
    await sbUpdate('employees',id,{status:'active'});
    var idx=EMP_LIST.findIndex(function(x){return x.id===id;});
    if(idx>-1)EMP_LIST[idx].status='active';
    toast(name+' approved!','success');
    closeEmpSheet();
    empRender();
    setTimeout(function(){
      if(confirm('Fix salary for '+name+' now?')){
        empTab('pay',document.getElementById('emp-t-pay'));
        setTimeout(function(){empOpenPay(id,name);},400);
      }
    },500);
  }catch(e){toast('Error: '+e.message,'error');}
}

async function empReject(id){
  var e=EMP_LIST.find(function(x){return x.id===id;});
  if(!e)return;
  var name=((e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'')).trim();
  var reason=prompt('Rejection reason (optional):');
  if(reason===null)return;
  try{
    await sbUpdate('employees',id,{status:'rejected',rejection_reason:reason||null});
    var idx=EMP_LIST.findIndex(function(x){return x.id===id;});
    if(idx>-1)EMP_LIST[idx].status='rejected';
    toast(name+' rejected','info');
    closeEmpSheet();
    empRender();
  }catch(e){toast('Error: '+e.message,'error');}
}

function empOpenEditForm(id){
  var e=EMP_LIST.find(function(x){return x.id===id;});
  if(!e)return;
  empOpenForm(e);
}

function empListHTML(status){
  var statusMap={active:'active',pending:'pending',resigned:'resigned',inactive:'inactive'};
  var list=EMP_LIST.filter(function(e){
    if(status==='pending') return e.status==='pending'||!e.status;
    return e.status===status;
  });

  // Apply data scope filter
  var scope = getEmpDataScope();
  if(scope==='self' && currentUser){
    list = list.filter(function(e){ return e.id===currentUser.id; });
  } else if(scope==='department' && currentUser && currentUser.dept){
    list = list.filter(function(e){ return (e.department||e.dept||'')===(currentUser.dept||''); });
  }
  var col={active:'#2E7D32',pending:'#F57F17',resigned:'#C62828'}[status]||'#37474F';

  // Stats
  var total=EMP_LIST.length;
  var active=EMP_LIST.filter(function(e){return e.status==='active';}).length;
  var pending=EMP_LIST.filter(function(e){return e.status==='pending'||!e.status;}).length;

  var stats='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">'+
    '<div style="background:white;border-radius:12px;padding:12px;border-left:3px solid #2E7D32;"><div style="font-size:10px;color:var(--text3);font-weight:700;">ACTIVE</div><div style="font-size:20px;font-weight:900;color:#2E7D32;">'+active+'</div></div>'+
    '<div style="background:white;border-radius:12px;padding:12px;border-left:3px solid #F57F17;cursor:pointer;" onclick="empTab(\'pending\',document.getElementById(\'emp-t-pending\'))"><div style="font-size:10px;color:var(--text3);font-weight:700;">PENDING</div><div style="font-size:20px;font-weight:900;color:#F57F17;">'+pending+'</div></div>'+
    '<div style="background:white;border-radius:12px;padding:12px;border-left:3px solid #37474F;"><div style="font-size:10px;color:var(--text3);font-weight:700;">TOTAL</div><div style="font-size:20px;font-weight:900;color:#37474F;">'+total+'</div></div>'+
  '</div>';

  if(!list.length){
    return (status==='active'?stats:'')+
      '<div style="text-align:center;padding:40px;color:var(--text3);">'+
        '<div style="font-size:36px;margin-bottom:10px;">&#128101;</div>'+
        '<div style="font-weight:700;">No '+status+' employees</div>'+
        (status==='pending'?'<div style="font-size:12px;margin-top:6px;">New registrations will appear here for approval</div>':'')+
      '</div>';
  }

  var rows=list.map(function(e){
    var name=(e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'');
    var init=name.split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase()||'?';
    var hasPay=EMP_PAY.some(function(p){return p.employee_id===e.id;});
    var roleColors={'Admin':'#C62828','Project Manager':'#1565C0','Site Engineer':'#2E7D32','Finance / Accounts':'#6A1B9A'};
    var rc=roleColors[e.role||e.designation]||'#37474F';
    var clickFn=status==='active'?'empOpenEditForm(\''+e.id+'\')'  :'empViewDetail(\''+e.id+'\')';
return '<div style="background:white;border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;" onclick="'+clickFn+'">'+
      '<div style="padding:12px 14px;display:flex;align-items:center;gap:12px;">'+
        '<div style="width:44px;height:44px;border-radius:12px;background:'+col+';display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:white;flex-shrink:0;overflow:hidden;">'+
          (e.photo_url?'<img src="'+e.photo_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">':init)+
        '</div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:14px;font-weight:800;color:var(--text);">'+name+'</div>'+
          '<div style="font-size:11px;color:var(--text3);margin-top:2px;">'+(e.employee_code||e.emp_id||'—')+' &bull; '+(e.designation||e.role||'—')+'</div>'+
          '<div style="display:flex;gap:6px;margin-top:5px;flex-wrap:wrap;">'+
            (e.department?'<span style="background:#F0F4F8;color:var(--text2);border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;">'+e.department+'</span>':'')+
            (e.project_name||e.project?'<span style="background:#E3F2FD;color:#1565C0;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;">&#127959; '+(e.project_name||e.project)+'</span>':'')+
            (hasPay?'<span style="background:#E8F5E9;color:#2E7D32;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;">&#128178; Pay Fixed</span>':'<span style="background:#FFF3E0;color:#E65100;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;">&#9888; No Pay</span>')+
          '</div>'+
        '</div>'+
        (status==='pending'?
          '<div style="display:flex;flex-direction:column;gap:6px;" onclick="event.stopPropagation()">'+
            '<button onclick="empApprove(\''+e.id+'\')" style="background:#2E7D32;color:white;border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:800;cursor:pointer;">&#10003; Approve</button>'+
            '<button onclick="empOpenForm(EMP_LIST.find(function(x){return x.id===\''+e.id+'\';}))" style="background:#1565C0;color:white;border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:800;cursor:pointer;">&#9998; Edit</button>'+
            '<button onclick="empReject(\''+e.id+'\')" style="background:#C62828;color:white;border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:800;cursor:pointer;">&#10005; Reject</button>'+
          '</div>':
          status==='active'?
          '<div style="display:flex;flex-direction:column;gap:6px;align-items:center;" onclick="event.stopPropagation()">'+
            '<button onclick="downloadIDCard(\''+e.id+'\')" style="background:#1B5E20;color:white;border:none;border-radius:8px;padding:5px 10px;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap;">&#127891; ID Card</button>'+
            '<div style="font-size:18px;color:var(--text3);">&#8250;</div>'+
          '</div>':
          '<div style="font-size:20px;color:var(--text3);">&#8250;</div>'
        )+
      '</div>'+
    '</div>';
  }).join('');

  return (status==='active'?stats:'')+rows;
}

// ── PAY FIXATION LIST ─────────────────────────────────
function empPayHTML(){
  // Debug: log what we have
  console.log('[empPayHTML] EMP_LIST:', EMP_LIST.length, 'EMP_PAY:', EMP_PAY.length);
  var allStatuses = EMP_LIST.map(function(e){return e.status;});
  console.log('[empPayHTML] Employee statuses:', JSON.stringify(allStatuses));
  if(EMP_PAY.length){
    console.log('[empPayHTML] Sample EMP_PAY record:', JSON.stringify(EMP_PAY[0]));
    console.log('[empPayHTML] Sample EMP_LIST id:', EMP_LIST[0]&&EMP_LIST[0].id, ' type:', typeof (EMP_LIST[0]&&EMP_LIST[0].id));
    console.log('[empPayHTML] Sample EMP_PAY employee_id:', EMP_PAY[0]&&EMP_PAY[0].employee_id, ' type:', typeof (EMP_PAY[0]&&EMP_PAY[0].employee_id));
  }

  var active=EMP_LIST.filter(function(e){return e.status==='active';});
  if(!active.length){
    // Show all employees regardless of status if none are 'active'
    var all=EMP_LIST;
    if(!all.length) return '<div style="text-align:center;padding:40px;color:var(--text3);">No employees found. Add employees first.</div>';
    console.warn('[empPayHTML] No active employees — showing all', all.length, 'employees instead');
    active = all;
  }

  return active.map(function(e){
    var name=(e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'');
    var pays=EMP_PAY.filter(function(p){
      return String(p.employee_id) === String(e.id);  // String() cast ensures UUID type mismatch doesn't break match
    }).sort(function(a,b){return b.effective_date.localeCompare(a.effective_date);});
    var latest=pays[0];

    var detailHTML='';
    if(latest){
      var extraEarnings=[];try{extraEarnings=latest.extra_earnings?JSON.parse(latest.extra_earnings):[];}catch(ex){}
      var extraDeductions=[];try{extraDeductions=latest.extra_deductions?JSON.parse(latest.extra_deductions):[];}catch(ex){}
      var earnings=extraEarnings.length?extraEarnings:[
        {label:'DA',amount:latest.da||0},{label:'HRA',amount:latest.hra||0},
        {label:'Conveyance',amount:latest.conveyance||0},{label:'Special Allowance',amount:latest.special_allowance||0},
        {label:'Medical Allowance',amount:latest.medical_allowance||0},{label:'Other Allowance',amount:latest.other_allowance||0}
      ].filter(function(x){return x.amount>0;});

      function pr(l,v,col){
        return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #F5F5F5;font-size:12px;">'+
          '<span style="color:var(--text3);">'+l+'</span>'+
          '<span style="font-weight:700;color:'+col+';">&#8377;'+Number(v||0).toLocaleString('en-IN')+'</span>'+
        '</div>';
      }

      // Earnings column
      var earnHTML = pr('Basic',latest.basic,'#1565C0');
      earnings.forEach(function(ex){ earnHTML+=pr(ex.label,ex.amount,'#2E7D32'); });

      // Deductions column
      var dedHTML='';
      if(latest.pf_employee>0) dedHTML+=pr('PF (Employee 12%)',latest.pf_employee,'#C62828');
      if(latest.pf_employer>0) dedHTML+=pr('PF (Employer 12%)',latest.pf_employer,'#880E4F');
      if(latest.esic_employee>0) dedHTML+=pr('ESIC (Emp 0.75%)',latest.esic_employee,'#C62828');
      if(latest.esic_employer>0) dedHTML+=pr('ESIC (Empr 3.25%)',latest.esic_employer,'#880E4F');
      if(latest.tds>0) dedHTML+=pr('TDS',latest.tds,'#E65100');
      if(latest.profession_tax>0) dedHTML+=pr('Profession Tax',latest.profession_tax,'#880E4F');
      extraDeductions.forEach(function(d){ dedHTML+=pr(d.label,d.amount,'#C62828'); });
      var totalDed=(latest.pf_employee||0)+(latest.pf_employer||0)+(latest.esic_employee||0)+(latest.esic_employer||0)+(latest.tds||0)+(latest.profession_tax||0)+extraDeductions.reduce(function(s,d){return s+(d.amount||0);},0);

      detailHTML=
        '<div style="border:2px solid #E0E0E0;border-radius:12px;margin:0 14px 12px;overflow:hidden;">'+
          // Two-col header
          '<div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:2px solid #E0E0E0;">'+
            '<div style="padding:6px 10px;background:#2E7D32;text-align:center;"><span style="font-size:10px;font-weight:800;color:white;text-transform:uppercase;">Earnings</span></div>'+
            '<div style="padding:6px 10px;background:#C62828;text-align:center;"><span style="font-size:10px;font-weight:800;color:white;text-transform:uppercase;">Deductions</span></div>'+
          '</div>'+
          // Two-col body
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">'+
            '<div style="padding:8px 10px;border-right:1px solid #F0F0F0;">'+
              earnHTML+
              '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;font-weight:900;border-top:2px solid #2E7D32;margin-top:4px;color:#2E7D32;">'+
                '<span>Gross</span><span>&#8377;'+Number(latest.gross||0).toLocaleString('en-IN')+'</span>'+
              '</div>'+
            '</div>'+
            '<div style="padding:8px 10px;">'+
              (dedHTML||'<div style="font-size:11px;color:var(--text3);padding:4px 0;">No deductions</div>')+
              '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;font-weight:900;border-top:2px solid #C62828;margin-top:4px;color:#C62828;">'+
                '<span>Total</span><span>&#8377;'+Number(totalDed).toLocaleString('en-IN')+'</span>'+
              '</div>'+
            '</div>'+
          '</div>'+
          // Net Take Home footer
          '<div style="background:#1B5E20;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">'+
            '<div style="font-size:12px;font-weight:800;color:white;">Net Take Home</div>'+
            '<div style="font-size:18px;font-weight:900;color:white;">&#8377;'+Number(latest.net_salary||0).toLocaleString('en-IN')+'</div>'+
          '</div>'+
          // Footer: date + delete
          '<div style="padding:8px 10px;background:#F8FAFC;display:flex;justify-content:space-between;align-items:center;">'+
            '<div style="font-size:10px;color:var(--text3);">w.e.f. '+latest.effective_date+(latest.remarks?' &bull; '+latest.remarks.replace('Increment: ',''):'')+'</div>'+
            '<button data-pay-del-id="'+latest.id+'" data-pay-del-name="'+safeN(name)+'" style="background:#FEE2E2;color:#C62828;border:none;border-radius:6px;padding:3px 10px;font-size:10px;font-weight:800;cursor:pointer;">&#128465; Delete</button>'+
          '</div>'+
        '</div>';
    } else {
      detailHTML='<div style="padding:12px 14px;font-size:12px;color:var(--text3);">No pay structure fixed yet</div>';
    }

    return '<div style="background:white;border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">'+
      '<div style="padding:12px 14px;background:#F8FAFC;display:flex;align-items:center;gap:8px;">'+
        '<div style="flex:1;">'+
          '<div style="font-size:14px;font-weight:800;">'+name+'</div>'+
          '<div style="font-size:11px;color:var(--text3);">'+(e.employee_code||e.emp_id||'—')+' &bull; '+(e.designation||e.role||'—')+' &bull; '+(e.department||'—')+'</div>'+
        '</div>'+
        (latest?'<button onclick="empGenerateOfferLetter(\''+e.id+'\')" style="background:#1565C0;color:white;border:none;border-radius:8px;padding:7px 12px;font-size:11px;font-weight:800;cursor:pointer;">&#128196; Offer Letter</button>':'')+
        '<button onclick="empOpenPay(\''+e.id+'\',\''+safeN(name)+'\')" style="background:#1B5E20;color:white;border:none;border-radius:8px;padding:7px 14px;font-size:11px;font-weight:800;cursor:pointer;">'+
          (latest?'&#9998; Revise':'+ Fix Pay')+
        '</button>'+
      '</div>'+
      detailHTML+
    '</div>';
  }).join('');
}

function payMini(lbl,val,col){
  return '<div style="background:'+col+'10;border-radius:8px;padding:7px 8px;text-align:center;">'+
    '<div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase;">'+lbl+'</div>'+
    '<div style="font-size:12px;font-weight:900;color:'+col+';">&#8377;'+Number(val||0).toLocaleString('en-IN')+'</div>'+
  '</div>';
}

// ── EMPLOYEE FORM ─────────────────────────────────────
function empOpenForm(emp){
  var isEdit=!!emp;
  var e=emp||{};

  document.getElementById('emp-sheet-title').textContent=isEdit?'Edit Employee':'Register New Employee';

  var fname=isEdit?(e.first_name||''):'';
  var mname=isEdit?(e.middle_name||''):'';
  var lname=isEdit?(e.last_name||''):'';
  var dob=isEdit?(e.date_of_birth||e.dob||''):'';
  var doj=isEdit?(e.date_of_joining||e.doj||''):'';
  var gender=isEdit?(e.gender||''):'';
  var blood=isEdit?(e.blood_group||e.blood||''):'';
  var marital=isEdit?(e.marital_status||e.marital||''):'';
  var empType=isEdit?(e.emp_type||e.empType||''):'';
  var workLoc=isEdit?(e.work_location||e.location||''):'';
  var phone=isEdit?(e.phone||e.mobile||''):'';
  var phone2=isEdit?(e.phone2||''):'';
  var email=isEdit?(e.email||''):'';
  var address=isEdit?(e.address||''):'';
  var permanent=isEdit?(e.permanent_address||e.permanent||''):'';
  var aadhar=isEdit?(e.aadhar||e.aadhar_no||''):'';
  var pan=isEdit?(e.pan||e.pan_no||''):'';
  var pf=isEdit?(e.pf_no||e.pf||''):'';
  var esic=isEdit?(e.esic_no||e.esic||''):'';
  var bankName=isEdit?(e.bank_name||e.bank||''):'';
  var accNo=isEdit?(e.account_no||e.accNo||''):'';
  var ifsc=isEdit?(e.ifsc||''):'';
  var accHolder=isEdit?(e.account_holder||e.accName||''):'';
  var ecName=isEdit?(e.emergency_name||e.ecName||''):'';
  var ecRel=isEdit?(e.emergency_relation||e.ecRel||''):'';
  var ecPhone=isEdit?(e.emergency_phone||e.ecPhone||''):'';
  var photoUrl=isEdit?(e.profile_photo||e.photo_url||e.photoUrl||''):'';

  function sel(val,options){
    return options.map(function(o){
      return '<option value="'+o+'"'+(o===val?' selected':'')+'>'+o+'</option>';
    }).join('');
  }
  function hdr(icon,label,color){
    return '<div style="display:flex;align-items:center;gap:8px;padding:10px 0 6px;border-bottom:2px solid '+color+'20;margin:14px 0 10px;">'+
      '<div style="width:28px;height:28px;border-radius:8px;background:'+color+'20;display:flex;align-items:center;justify-content:center;font-size:14px;">'+icon+'</div>'+
      '<div style="font-size:12px;font-weight:800;color:'+color+';text-transform:uppercase;letter-spacing:.7px;">'+label+'</div>'+
    '</div>';
  }

  var html=
    hdr('👤','Personal Details','#1565C0')+
    '<div class="g3">'+
      '<div><label class="flbl">First Name *</label><input id="f-ufname" class="finp" placeholder="First name" value="'+safeN(fname)+'"></div>'+
      '<div><label class="flbl">Middle Name</label><input id="f-umname" class="finp" placeholder="Middle name (optional)" value="'+safeN(mname)+'"></div>'+
      '<div><label class="flbl">Last Name</label><input id="f-ulname" class="finp" placeholder="Last name" value="'+safeN(lname)+'"></div>'+
    '</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">Date of Birth</label><input class="finp" type="date" id="f-udob" value="'+dob+'"></div>'+
      '<div><label class="flbl">Gender</label><select id="f-ugender" class="fsel"><option value="">-- Select --</option>'+sel(gender,['Male','Female','Other'])+'</select></div>'+
    '</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">Blood Group</label><select id="f-ublood" class="fsel"><option value="">-- Select --</option>'+sel(blood,['A+','A-','B+','B-','O+','O-','AB+','AB-'])+'</select></div>'+
      '<div><label class="flbl">Marital Status</label><select id="f-umarital" class="fsel"><option value="">-- Select --</option>'+sel(marital,['Single','Married','Other'])+'</select></div>'+
    '</div>'+
    hdr('🏗️','Employment Details','#2E7D32')+
    '<label class="flbl">Date of Joining</label><input class="finp" type="date" id="f-udoj" value="'+doj+'">'+
    '<div class="g2">'+
      '<div><label class="flbl">Role / Designation</label><select id="f-urole" class="fsel"><option value="">Loading...</option></select></div>'+
      '<div><label class="flbl">Department</label><select id="f-udept" class="fsel"><option value="">Loading...</option></select></div>'+
    '</div>'+
    '<label class="flbl">Project Assignment</label><select id="f-uproject" class="fsel"><option value="">Loading...</option></select>'+
    '<div class="g2">'+
      '<div><label class="flbl">Employment Type</label><select id="f-uemptype" class="fsel"><option value="">-- Select --</option>'+sel(empType,['Full Time','Part Time','Contract','Daily Wage'])+'</select></div>'+
      '<div><label class="flbl">Work Location / Project</label><select id="f-ulocation" class="fsel"><option value="">&#9203; Loading...</option></select></div>'+
    '</div>'+
    hdr('📞','Contact Details','#E65100')+
    '<div class="g2">'+
      '<div><label class="flbl">Mobile Number</label><input id="f-uphone" class="finp" type="tel" placeholder="10-digit mobile" value="'+safeN(phone)+'"></div>'+
      '<div><label class="flbl">Alternate Mobile</label><input id="f-uphone2" class="finp" type="tel" placeholder="Optional" value="'+safeN(phone2)+'"></div>'+
    '</div>'+
    '<label class="flbl">Email Address</label><input id="f-uemail" class="finp" type="email" placeholder="e.g. name@company.com" value="'+safeN(email)+'">'+
    '<label class="flbl">Residential Address</label><textarea id="f-uaddress" class="ftxt" rows="2" placeholder="Current residential address...">'+safeN(address)+'</textarea>'+
    '<label class="flbl">Permanent Address</label><textarea id="f-upermanent" class="ftxt" rows="2" placeholder="Permanent / native address (if different)...">'+safeN(permanent)+'</textarea>'+
    // Login credentials for NEW employees
    (!isEdit?
      hdr('\uD83D\uDD10','Login Credentials','#1565C0')+
      '<div style="background:#E3F2FD;border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:11px;color:#1565C0;">'+
        '&#8505; Mobile number above will be the username for login.'+
      '</div>'+
      '<label class="flbl">Login Password *</label>'+
      '<div class="inp-wrap">'+
        '<input id="f-upassword" class="finp" type="password" placeholder="Min 6 characters" style="margin-bottom:0;padding-right:44px;">'+
        '<span class="inp-ic" onclick="var el=document.getElementById(\'f-upassword\');el.type=el.type===\'password\'?\'text\':\'password\';" style="cursor:pointer;">&#128065;</span>'+
      '</div>'+
      '<label class="flbl" style="margin-top:8px;">Confirm Password *</label>'+
      '<div class="inp-wrap">'+
        '<input id="f-upassword2" class="finp" type="password" placeholder="Re-enter password" style="margin-bottom:0;padding-right:44px;">'+
        '<span class="inp-ic" onclick="var el=document.getElementById(\'f-upassword2\');el.type=el.type===\'password\'?\'text\':\'password\';" style="cursor:pointer;">&#128065;</span>'+
      '</div>'
    :'')+
    hdr('🪪','KYC Details','#6A1B9A')+
    '<div class="g2">'+
      '<div><label class="flbl">Aadhar Number</label><input id="f-uaadhar" class="finp" placeholder="XXXX XXXX XXXX" value="'+safeN(aadhar)+'"></div>'+
      '<div><label class="flbl">PAN Number</label><input id="f-upan" class="finp" placeholder="ABCDE1234F" value="'+safeN(pan)+'"></div>'+
    '</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">PF Number</label><input id="f-upf" class="finp" placeholder="Optional" value="'+safeN(pf)+'"></div>'+
      '<div><label class="flbl">ESIC Number</label><input id="f-uesic" class="finp" placeholder="Optional" value="'+safeN(esic)+'"></div>'+
    '</div>'+
    hdr('🏦','Bank Details','#C62828')+
    '<label class="flbl">Bank Name</label><input id="f-ubank" class="finp" placeholder="e.g. State Bank of India" value="'+safeN(bankName)+'">'+
    '<div class="g2">'+
      '<div><label class="flbl">Account Number</label><input id="f-uaccno" class="finp" placeholder="Bank account number" value="'+safeN(accNo)+'"></div>'+
      '<div><label class="flbl">IFSC Code</label><input id="f-uifsc" class="finp" placeholder="e.g. SBIN0001234" value="'+safeN(ifsc)+'"></div>'+
    '</div>'+
    '<label class="flbl">Account Holder Name</label><input id="f-uaccname" class="finp" placeholder="As per bank records" value="'+safeN(accHolder)+'">'+
    hdr('🚨','Emergency Contact','#C62828')+
    '<div class="g2">'+
      '<div><label class="flbl">Contact Name</label><input id="f-uecname" class="finp" placeholder="Full name" value="'+safeN(ecName)+'"></div>'+
      '<div><label class="flbl">Relationship</label><select id="f-uecrel" class="fsel"><option value="">-- Select --</option>'+sel(ecRel,['Spouse','Father','Mother','Sibling','Other'])+'</select></div>'+
    '</div>'+
    '<label class="flbl">Emergency Mobile</label><input id="f-uecphone" class="finp" type="tel" placeholder="10-digit mobile" value="'+safeN(ecPhone)+'">'+
    hdr('📎','Documents & Photo','#1565C0')+
    '<label class="flbl">Passport Photo</label>'+
    '<div class="upload-box" onclick="document.getElementById(\'f-uphoto\').click()">'+
      '<div class="photo-preview" id="f-uphoto-prev">'+(photoUrl?'<img src="'+photoUrl+'" style="width:100%;height:100%;object-fit:cover;">':'📷')+'</div>'+
      '<input type="file" id="f-uphoto" accept="image/*" onchange="handleFilePreview(\'f-uphoto\',\'f-uphoto-prev\')">'+
      '<div class="upload-label">Tap to upload passport photo</div>'+
      '<div class="upload-progress-wrap" id="f-uphoto-prog"><div class="upload-progress-label"><span class="upload-progress-name" id="f-uphoto-prog-name"></span><span class="upload-progress-pct" id="f-uphoto-prog-pct">0%</span></div><div class="upload-progress-bar"><div class="upload-progress-fill" id="f-uphoto-prog-fill"></div></div></div>'+
    '</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">Aadhar Card</label>'+
      '<div class="upload-box" onclick="document.getElementById(\'f-uaadhar-doc\').click()">'+
        '<div id="f-uaadhar-doc-prev" class="upload-preview"></div>'+
        '<input type="file" id="f-uaadhar-doc" accept="image/*,application/pdf" onchange="handleFilePreview(\'f-uaadhar-doc\',\'f-uaadhar-doc-prev\')">'+
        '<div class="upload-label">📄 Upload Aadhar</div>'+
        '<div class="upload-progress-wrap" id="f-uaadhar-doc-prog"><div class="upload-progress-label"><span class="upload-progress-name" id="f-uaadhar-doc-prog-name"></span><span class="upload-progress-pct" id="f-uaadhar-doc-prog-pct">0%</span></div><div class="upload-progress-bar"><div class="upload-progress-fill" id="f-uaadhar-doc-prog-fill"></div></div></div>'+
      '</div></div>'+
      '<div><label class="flbl">PAN Card</label>'+
      '<div class="upload-box" onclick="document.getElementById(\'f-upan-doc\').click()">'+
        '<div id="f-upan-doc-prev" class="upload-preview"></div>'+
        '<input type="file" id="f-upan-doc" accept="image/*,application/pdf" onchange="handleFilePreview(\'f-upan-doc\',\'f-upan-doc-prev\')">'+
        '<div class="upload-label">📄 Upload PAN</div>'+
        '<div class="upload-progress-wrap" id="f-upan-doc-prog"><div class="upload-progress-label"><span class="upload-progress-name" id="f-upan-doc-prog-name"></span><span class="upload-progress-pct" id="f-upan-doc-prog-pct">0%</span></div><div class="upload-progress-bar"><div class="upload-progress-fill" id="f-upan-doc-prog-fill"></div></div></div>'+
      '</div></div>'+
    '</div>'+
    '<input type="hidden" id="f-uedit-id" value="'+(isEdit?e.id:'')+'">'+
    // Password reset section for existing employees
    (isEdit?
      hdr('\uD83D\uDD10','Reset Login Password','#E65100')+
      '<div style="background:#FFF3E0;border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:11px;color:#E65100;">'+
        '&#8505; Leave blank to keep current password. Enter new password to change it.'+
      '</div>'+
      '<label class="flbl">New Password</label>'+
      '<div class="inp-wrap">'+
        '<input id="f-upassword" class="finp" type="password" placeholder="Leave blank to keep current" style="margin-bottom:0;padding-right:44px;">'+
        '<span class="inp-ic" onclick="var el=document.getElementById(\'f-upassword\');el.type=el.type===\'password\'?\'text\':\'password\';" style="cursor:pointer;">&#128065;</span>'+
      '</div>'+
      '<label class="flbl" style="margin-top:8px;">Confirm New Password</label>'+
      '<div class="inp-wrap">'+
        '<input id="f-upassword2" class="finp" type="password" placeholder="Re-enter new password" style="margin-bottom:0;padding-right:44px;">'+
        '<span class="inp-ic" onclick="var el=document.getElementById(\'f-upassword2\');el.type=el.type===\'password\'?\'text\':\'password\';" style="cursor:pointer;">&#128065;</span>'+
      '</div>'
    :'');
  document.getElementById('emp-sheet-body').innerHTML=html;

  document.getElementById('emp-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeEmpSheet()">Cancel</button>'+
    (isEdit&&e.status!=='resigned'?'<button class="btn" style="background:#C62828;color:white;" onclick="empDeleteEmployee(\''+e.id+'\',\''+safeN([fname,mname,lname].filter(Boolean).join(' '))+'\')">🗑 Delete</button>':'')+
    (isEdit?'<button class="btn" style="background:#1565C0;color:white;" onclick="empResetPassword(\''+e.id+'\',\''+safeN([fname,mname,lname].filter(Boolean).join(' '))+'\',\''+safeN(phone)+'\')">🔑 Reset Password</button>':'')+
    '<button class="btn btn-indigo" onclick="empFormSave()" style="flex:1;">'+(isEdit?'✓ Save Changes':'✓ Register Employee')+'</button>';

  openEmpSheet();

  // Load work location from projects immediately
  loadLocationDropdown('f-ulocation', workLoc);

  // Load Role, Dept, Project dropdowns from Supabase
  var roleVal=isEdit?(e.designation||e.role||''):'';
  var deptVal=isEdit?(e.department||e.dept||''):'';
  var projVal=isEdit?(e.project_id||e.project||''):'';

  Promise.all([
    sbFetch('categories',{select:'name,icon',filter:'type=eq.role&active=eq.true',order:'name.asc'}),
    sbFetch('categories',{select:'name,icon',filter:'type=eq.dept&active=eq.true',order:'name.asc'}),
    sbFetch('projects',{select:'id,name',order:'name.asc'})
  ]).then(function(results){
    var roles=Array.isArray(results[0])?results[0]:[];
    var depts=Array.isArray(results[1])?results[1]:[];
    var projs=Array.isArray(results[2])?results[2]:[];

    var rs=document.getElementById('f-urole');
    if(rs){
      rs.innerHTML='<option value="">-- Select Role --</option>'+
        roles.map(function(r){return '<option value="'+r.name+'"'+(r.name===roleVal?' selected':'')+'>'+r.name+'</option>';}).join('');
    }
    var ds=document.getElementById('f-udept');
    if(ds){
      ds.innerHTML='<option value="">-- Select Department --</option>'+
        depts.map(function(d){return '<option value="'+d.name+'"'+(d.name===deptVal?' selected':'')+'>'+d.name+'</option>';}).join('');
    }
    var ps=document.getElementById('f-uproject');
    if(ps){
      ps.innerHTML='<option value="">All Projects</option>'+
        projs.map(function(p){return '<option value="'+p.id+'"'+(p.id===projVal||p.name===projVal?' selected':'')+'>'+p.name+'</option>';}).join('');
    }
    // Also populate work location from projects + Head Office
    var ls=document.getElementById('f-ulocation');
    if(ls){
      var locOpts=['Head Office'].concat(projs.map(function(p){return p.name;}));
      ls.innerHTML='<option value="">-- Select --</option>'+
        locOpts.map(function(l){return '<option value="'+l+'"'+(l===workLoc?' selected':'')+'>'+l+'</option>';}).join('');
    }
  }).catch(function(err){
    var rs=document.getElementById('f-urole');
    if(rs) rs.innerHTML='<option value="">-- Select Role --</option>'+catOptions('role');
    var ds=document.getElementById('f-udept');
    if(ds) ds.innerHTML='<option value="">-- Select Dept --</option>'+catOptions('dept');
    var ls=document.getElementById('f-ulocation');
    if(ls) ls.innerHTML='<option value="">Head Office</option>';
    console.warn('Dropdown load error:',err);
  });
}

async function empDeleteEmployee(id,name){
  if(!confirm('Delete "'+name+'"? This cannot be undone.'))return;
  try{
    toast('Deleting...','info');
    await sbDelete('employees',id);
    EMP_LIST       = EMP_LIST.filter(function(e){return e.id!==id;});
    USERS          = USERS.filter(function(u){return u.id!==id;});
    EMP_PAY        = EMP_PAY.filter(function(p){return p.employee_id!==id;});
    EMP_ORDERS     = EMP_ORDERS.filter(function(o){return o.employee_id!==id;});
    SALARY_RECORDS = SALARY_RECORDS.filter(function(r){return r.employee_id!==id;});
    closeEmpSheet();
    empRender();
    toast(name+' deleted','success');
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function empResetPassword(empId, empName, phone){
  if(!phone){toast('No mobile number on file — cannot reset password','error');return;}
  document.getElementById('emp-sheet-title').textContent = '\uD83D\uDD10 Reset Password — '+empName;
  document.getElementById('emp-sheet-body').innerHTML =
    '<div style="background:#FFF3E0;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:12px;color:#E65100;">'+
      '&#8505; Login username is the mobile number: <b>'+phone+'</b>'+
    '</div>'+
    '<label class="flbl">New Password *</label>'+
    '<div class="inp-wrap">'+
      '<input id="reset-pw1" class="finp" type="password" placeholder="Min 6 characters" style="margin-bottom:0;padding-right:44px;">'+
      '<span class="inp-ic" onclick="var el=document.getElementById(\'reset-pw1\');el.type=el.type===\'password\'?\'text\':\'password\';" style="cursor:pointer;">&#128065;</span>'+
    '</div>'+
    '<label class="flbl" style="margin-top:8px;">Confirm Password *</label>'+
    '<div class="inp-wrap">'+
      '<input id="reset-pw2" class="finp" type="password" placeholder="Re-enter password" style="margin-bottom:0;padding-right:44px;">'+
      '<span class="inp-ic" onclick="var el=document.getElementById(\'reset-pw2\');el.type=el.type===\'password\'?\'text\':\'password\';" style="cursor:pointer;">&#128065;</span>'+
    '</div>';
  document.getElementById('emp-sheet-foot').innerHTML =
    '<button class="btn btn-outline" onclick="closeEmpSheet()">Cancel</button>'+
    '<button class="btn" style="background:#1B5E20;color:white;" id="reset-pw-btn">\uD83D\uDD10 Set Password</button>';
  var btn = document.getElementById('reset-pw-btn');
  if(btn) btn.addEventListener('click', async function(){
    var pw1 = (document.getElementById('reset-pw1')||{}).value||'';
    var pw2 = (document.getElementById('reset-pw2')||{}).value||'';
    if(!pw1){toast('Enter new password','warning');return;}
    if(pw1.length<6){toast('Min 6 characters','warning');return;}
    if(pw1!==pw2){toast('Passwords do not match','warning');return;}
    try{
      toast('Updating password...','info');
      var authResult = await authSignUp(phone, pw1);
      if(authResult && authResult.error){
        var msg = authResult.error.message||'';
        if(msg.toLowerCase().includes('already')){
          toast('Account already exists. Use Supabase Auth dashboard to reset, or employee can use Forgot Password on login.','info');
        } else {
          toast('Auth error: '+msg,'warning');
        }
      } else {
        toast(empName+'\'s password updated successfully!','success');
        closeEmpSheet();
      }
    }catch(e){toast('Error: '+e.message,'error');}
  });
  openEmpSheet();
}

async function empFormSave(){
  var editId=(document.getElementById('f-uedit-id')||{}).value||'';
  var fname=gv('f-ufname'), mname=gv('f-umname')||'', lname=gv('f-ulname');
  var name=[fname,mname,lname].filter(Boolean).join(' ').trim();
  if(!name){toast('Name is required','warning');return;}
  var phone=gv('f-uphone');
  if(!editId&&!phone){toast('Mobile number is required','warning');return;}

  // Password validation
  var pw1 = (document.getElementById('f-upassword')||{}).value||'';
  var pw2 = (document.getElementById('f-upassword2')||{}).value||'';
  if(!editId){
    // New employee: password required
    if(!pw1){toast('Login password is required','warning');return;}
    if(pw1.length<6){toast('Password must be at least 6 characters','warning');return;}
    if(pw1!==pw2){toast('Passwords do not match','warning');return;}
  } else if(pw1){
    // Edit: password optional, validate only if entered
    if(pw1.length<6){toast('New password must be at least 6 characters','warning');return;}
    if(pw1!==pw2){toast('Passwords do not match','warning');return;}
  }

  var roleRaw=gv('f-urole');
  var roleMap={'Admin':'admin','Project Manager':'pm','Site Engineer':'engineer','Junior Engineer':'engineer','QC Engineer':'qhse','Safety Officer':'qhse','Finance / Accounts':'finance','HR / Admin':'admin','Viewer (Read Only)':'viewer','Client Viewer':'viewer'};
  var role=roleMap[roleRaw]||'viewer';

  var data={
    first_name:fname, middle_name:mname||null, last_name:lname||null,
    email:gv('f-uemail')||null,
    phone:phone||null, phone2:gv('f-uphone2')||null,
    date_of_birth:gv('f-udob')||null, gender:gv('f-ugender')||null,
    blood_group:gv('f-ublood')||null, marital_status:gv('f-umarital')||null,
    date_of_joining:gv('f-udoj')||null,
    role:role, designation:roleRaw, department:gv('f-udept')||null,
    emp_type:gv('f-uemptype')||null, work_location:gv('f-ulocation')||null,
    address:gv('f-uaddress')||null, permanent_address:gv('f-upermanent')||null,
    aadhar:gv('f-uaadhar')||null, pan:gv('f-upan')||null,
    pf_no:gv('f-upf')||null, esic_no:gv('f-uesic')||null,
    bank_name:gv('f-ubank')||null, account_no:gv('f-uaccno')||null,
    ifsc:gv('f-uifsc')||null, account_holder:gv('f-uaccname')||null,
    emergency_name:gv('f-uecname')||null, emergency_relation:gv('f-uecrel')||null,
    emergency_phone:gv('f-uecphone')||null
  };

  try{
    toast('Uploading documents...','info');
    var photoFile=document.getElementById('f-uphoto')&&document.getElementById('f-uphoto').files[0];
    var aadharFile=document.getElementById('f-uaadhar-doc')&&document.getElementById('f-uaadhar-doc').files[0];
    var panFile=document.getElementById('f-upan-doc')&&document.getElementById('f-upan-doc').files[0];
    if(photoFile)data.profile_photo=await uploadToCloudinary(photoFile,'photos','f-uphoto');
    if(aadharFile)data.aadhar_doc_url=await uploadToCloudinary(aadharFile,'kyc','f-uaadhar-doc');
    if(panFile)data.pan_doc_url=await uploadToCloudinary(panFile,'kyc','f-upan-doc');
    toast('Saving...','info');

    if(editId){
      // Update
      await sbUpdate('employees',editId,data);
      // Sync USERS and EMP_LIST
      var ui=USERS.findIndex(function(x){return x.id===editId;});
      if(ui>-1)USERS[ui]=Object.assign(USERS[ui],{name:name,role:role,access:roleRaw,dept:data.department||'',phone:data.phone||''});
      var ei=EMP_LIST.findIndex(function(x){return x.id===editId;});
      if(ei>-1)EMP_LIST[ei]=Object.assign(EMP_LIST[ei],data,{first_name:fname,middle_name:mname||null,last_name:lname});
      // Reset password if entered
      if(pw1 && phone){
        try{
          toast('Updating login password...','info');
          var empPhone = phone||gv('f-uphone');
          var authRes = await authSignUp(empPhone, pw1);
          if(authRes && authRes.error && authRes.error.message && authRes.error.message.toLowerCase().includes('already')){
            // User exists in auth — we cannot reset via anon key, inform admin
            toast(name+' updated. To reset login password, use Supabase Auth dashboard or ask employee to use Forgot Password.','info');
          } else {
            toast(name+' updated and password reset!','success');
          }
        }catch(authErr){
          console.warn('Password reset error:', authErr);
          toast(name+' updated. Password reset failed — try from Supabase dashboard.','warning');
        }
      } else {
        toast(name+' updated!','success');
      }
    } else {
      // New — get next ID
      var newEmpId=await getNextAIPLId();
      data.emp_id=newEmpId; data.badge_no=newEmpId; data.status='pending';

      // Create Supabase Auth account with entered password
      var pw = (document.getElementById('f-upassword')||{}).value||'';
      if(pw && phone){
        try{
          toast('Creating login account...','info');
          var authResult = await authSignUp(phone, pw);
          if(authResult && !authResult.error && (authResult.user||authResult.id)){
            data.auth_id = authResult.user ? authResult.user.id : authResult.id;
          } else if(authResult && authResult.error){
            // Auth user may already exist — try to continue without blocking
            console.warn('Auth signup note:', authResult.error.message||authResult.error);
          }
        }catch(authErr){ console.warn('Auth signup (non-fatal):', authErr); }
      }

      // Retry with unique emp_id if duplicate conflict
      toast('Saving employee...','info');
      var result;
      try{
        result=await sbInsert('employees',data);
      }catch(insErr){
        if(insErr.message&&(insErr.message.includes('duplicate')||insErr.message.includes('23505'))){
          data.emp_id='AIPL-T'+String(Date.now()).slice(-6);
          data.badge_no=data.emp_id;
          result=await sbInsert('employees',data);
        } else { throw insErr; }
      }
      if(result&&result[0]){
        var mapped=mapEmployee(result[0]);
        USERS.unshift(mapped);
        EMP_LIST.unshift(result[0]);
        toast(name+' added — visible in Pending tab for approval.','success');
      }
    }
    closeEmpSheet();
    // For new employee → go to pending tab; for edit → stay on current tab
    if(editId){
      empRender();
    } else {
      empTab('pending', document.getElementById('emp-t-pending'));
    }
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

function empOpenPay(empId, empName){
  var existing=EMP_PAY.filter(function(p){return p.employee_id===empId;}).sort(function(a,b){return b.effective_date.localeCompare(a.effective_date);});
  var v=existing[0]||{};
  var emp=EMP_LIST.find(function(e){return e.id===empId;})||{};

  // Load extra_earnings and extra_deductions from previous record if any
  var extraEarnings=v.extra_earnings?JSON.parse(v.extra_earnings):[];
  var extraDeductions=v.extra_deductions?JSON.parse(v.extra_deductions):[];

  var pfApplicable=v.pf_employee>0||extraEarnings.length===0?true:v.pf_applicable!==false;
  var esicApplicable=v.esic_employee>0||extraEarnings.length===0?true:v.esic_applicable!==false;

  // Default effective date: DOJ for first fixation, today for revision
  var defaultDate = existing.length
    ? new Date().toISOString().slice(0,10)
    : (emp.date_of_joining||emp.doj||new Date().toISOString().slice(0,10));

  document.getElementById('pay-sheet-title').textContent='\u{1F4B8} Pay Fixation \u2014 '+empName;

  document.getElementById('pay-sheet-body').innerHTML=
    // ── Header: Date + Employee info ──────────────────────────────────────
    '<div style="background:#1B5E20;border-radius:12px;padding:12px 14px;margin-bottom:12px;color:white;display:flex;align-items:center;gap:10px;">'+
      '<div style="flex:1;">'+
        '<div style="font-size:15px;font-weight:900;">'+empName+'</div>'+
        '<div style="font-size:11px;opacity:.75;margin-top:2px;">Pay Fixation / Revision</div>'+
      '</div>'+
      '<div>'+
        '<label style="font-size:10px;opacity:.7;display:block;margin-bottom:4px;">Effective Date *</label>'+
        '<input id="pf-date" type="date" value="'+defaultDate+'" style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);border-radius:7px;padding:6px 10px;color:white;font-size:12px;font-weight:700;font-family:Nunito,sans-serif;outline:none;">'+
      '</div>'+
    '</div>'+

    // ── Two-column: Earnings | Deductions ─────────────────────────────────
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'+

      // LEFT: Earnings
      '<div style="background:white;border-radius:12px;border:1px solid var(--border);overflow:hidden;">'+
        '<div style="background:#2E7D32;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;">'+
          '<div style="font-size:11px;font-weight:800;color:white;text-transform:uppercase;letter-spacing:.5px;">Earnings</div>'+
          '<button onclick="payAddEarning()" style="background:rgba(255,255,255,.25);color:white;border:none;border-radius:6px;padding:3px 10px;font-size:10px;font-weight:800;cursor:pointer;">+ Add</button>'+
        '</div>'+
        '<div style="padding:8px 10px;">'+
          // Basic
          '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #F5F5F5;">'+
            '<div style="flex:1;font-size:12px;font-weight:800;color:#2E7D32;">Basic <span style="font-size:9px;color:var(--text3);">(Required)</span></div>'+
            '<input id="pf-basic" type="number" step="1" placeholder="0" value="'+(v.basic||'')+'" oninput="payCalc()" style="width:80px;text-align:right;border:1px solid var(--border);border-radius:6px;padding:4px 7px;font-size:12px;font-weight:900;font-family:Nunito,sans-serif;outline:none;">'+
          '</div>'+
          // Dynamic earnings
          '<div id="pay-earnings-list"></div>'+
          // Gross
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 8px;background:#E8F5E9;border-radius:7px;margin-top:6px;">'+
            '<span style="font-size:11px;font-weight:800;color:#2E7D32;">Gross</span>'+
            '<span id="pf-gross-display" style="font-size:14px;font-weight:900;color:#2E7D32;">₹0</span>'+
          '</div>'+
        '</div>'+
      '</div>'+

      // RIGHT: Deductions
      '<div style="background:white;border-radius:12px;border:1px solid var(--border);overflow:hidden;">'+
        '<div style="background:#C62828;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;">'+
          '<div style="font-size:11px;font-weight:800;color:white;text-transform:uppercase;letter-spacing:.5px;">Deductions</div>'+
          '<button onclick="payAddDeduction()" style="background:rgba(255,255,255,.25);color:white;border:none;border-radius:6px;padding:3px 10px;font-size:10px;font-weight:800;cursor:pointer;">+ Add</button>'+
        '</div>'+
        '<div style="padding:8px 10px;">'+

          // PF row
          '<div style="padding:4px 0;border-bottom:1px solid #F5F5F5;">'+
            '<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">'+
              '<div style="flex:1;font-size:11px;font-weight:800;color:#1565C0;">PF</div>'+
              '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px;font-weight:700;">'+
                '<input type="checkbox" id="pf-applicable" onchange="payCalc()" style="width:13px;height:13px;"'+(pfApplicable?' checked':'')+'>Apply'+
              '</label>'+
            '</div>'+
            '<div id="pf-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">'+
              '<div><div style="font-size:9px;color:var(--text3);margin-bottom:2px;">Emp (12%)</div><input id="pf-pfe" type="number" step="1" value="'+(v.pf_employee||0)+'" oninput="payCalc()" style="width:100%;text-align:right;border:1px solid var(--border);border-radius:6px;padding:4px 6px;font-size:11px;font-family:Nunito,sans-serif;outline:none;box-sizing:border-box;"></div>'+
              '<div><div style="font-size:9px;color:var(--text3);margin-bottom:2px;">Empr (12%)</div><input id="pf-pfr" type="number" step="1" value="'+(v.pf_employer||0)+'" readonly style="width:100%;text-align:right;border:1px solid #eee;border-radius:6px;padding:4px 6px;font-size:11px;font-family:Nunito,sans-serif;outline:none;opacity:.6;box-sizing:border-box;background:#F8F8F8;"></div>'+
            '</div>'+
          '</div>'+

          // ESIC row
          '<div style="padding:4px 0;border-bottom:1px solid #F5F5F5;">'+
            '<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">'+
              '<div style="flex:1;font-size:11px;font-weight:800;color:#6A1B9A;">ESIC</div>'+
              '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px;font-weight:700;">'+
                '<input type="checkbox" id="esic-applicable" onchange="payCalc()" style="width:13px;height:13px;"'+(esicApplicable?' checked':'')+'>Apply'+
              '</label>'+
            '</div>'+
            '<div id="esic-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">'+
              '<div><div style="font-size:9px;color:var(--text3);margin-bottom:2px;">Emp (0.75%)</div><input id="pf-esice" type="number" step="1" value="'+(v.esic_employee||0)+'" oninput="payCalc()" style="width:100%;text-align:right;border:1px solid var(--border);border-radius:6px;padding:4px 6px;font-size:11px;font-family:Nunito,sans-serif;outline:none;box-sizing:border-box;"></div>'+
              '<div><div style="font-size:9px;color:var(--text3);margin-bottom:2px;">Empr (3.25%)</div><input id="pf-esicr" type="number" step="1" value="'+(v.esic_employer||0)+'" readonly style="width:100%;text-align:right;border:1px solid #eee;border-radius:6px;padding:4px 6px;font-size:11px;font-family:Nunito,sans-serif;outline:none;opacity:.6;box-sizing:border-box;background:#F8F8F8;"></div>'+
            '</div>'+
          '</div>'+

          // TDS
          '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #F5F5F5;">'+
            '<div style="flex:1;font-size:11px;font-weight:800;color:#E65100;">TDS</div>'+
            '<input id="pf-tds" type="number" step="1" value="'+(v.tds||0)+'" oninput="payCalc()" style="width:70px;text-align:right;border:1px solid var(--border);border-radius:6px;padding:4px 6px;font-size:11px;font-family:Nunito,sans-serif;outline:none;">'+
          '</div>'+

          // Profession Tax
          '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #F5F5F5;">'+
            '<div style="flex:1;"><div style="font-size:11px;font-weight:800;color:#880E4F;">Prof. Tax</div><div style="font-size:9px;color:var(--text3);">Compulsory</div></div>'+
            '<input id="pf-pt" type="number" step="1" value="'+(v.profession_tax||200)+'" oninput="payCalc()" style="width:70px;text-align:right;border:1px solid var(--border);border-radius:6px;padding:4px 6px;font-size:11px;font-family:Nunito,sans-serif;outline:none;">'+
          '</div>'+

          // Dynamic deductions
          '<div id="pay-deductions-list"></div>'+

          // Total deductions
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 8px;background:#FFEBEE;border-radius:7px;margin-top:6px;">'+
            '<span style="font-size:11px;font-weight:800;color:#C62828;">Total Ded.</span>'+
            '<span id="pf-ded-display" style="font-size:14px;font-weight:900;color:#C62828;">₹0</span>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>'+

    // ── Net Take Home ──────────────────────────────────────────────────────
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:#1B5E20;border-radius:12px;margin-bottom:10px;">'+
      '<div style="color:white;font-size:13px;font-weight:800;">Net Take Home</div>'+
      '<div id="pf-net-display" style="font-size:22px;font-weight:900;color:white;">₹0</div>'+
    '</div>'+

    '<label class="flbl">Remarks / Order Reference</label>'+
    '<input id="pf-remarks" class="finp" placeholder="e.g. Pay fixation as on date of joining" value="'+(v.remarks||'')+'">'+

    // ── Pay History Log with editable effective dates ──────────────────────
    (existing.length?
      '<div style="background:#F8FAFC;border-radius:10px;border:1px solid var(--border);padding:10px 12px;margin-top:10px;">'+
        '<div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Pay History — tap date to edit</div>'+
        existing.sort(function(a,b){return a.effective_date.localeCompare(b.effective_date);}).map(function(p,i){
          var typeLabel={initial:'Initial Fixation',increment:'Increment',revision:'Revision'}[p.pay_type]||'Pay Record';
          var typeColor={initial:'#1565C0',increment:'#2E7D32',revision:'#E65100'}[p.pay_type]||'#37474F';
          return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;'+(i>0?'border-top:1px solid #F0F4F8;':'')+'">'+
            '<div style="flex:1;">'+
              '<div style="font-size:11px;font-weight:800;color:'+typeColor+';">'+typeLabel+'</div>'+
              '<div style="font-size:10px;color:var(--text3);">Basic ₹'+Number(p.basic||0).toLocaleString('en-IN')+' &bull; Net ₹'+Number(p.net_salary||0).toLocaleString('en-IN')+'</div>'+
            '</div>'+
            '<div style="display:flex;align-items:center;gap:4px;">'+
              '<input type="date" value="'+fmtDate(p.effective_date)+'" data-payid="'+p.id+'" '+
                'style="border:1px solid var(--border);border-radius:6px;padding:3px 6px;font-size:11px;font-family:Nunito,sans-serif;outline:none;color:#333;" '+
                'onchange="payUpdateEffectiveDate(\''+p.id+'\',this.value)">'+
            '</div>'+
          '</div>';
        }).join('')+
      '</div>'
    :'')+

    '<input type="hidden" id="pf-emp-id" value="'+empId+'">';

  document.getElementById('pay-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeSheet(\'ov-pay\',\'sh-pay\')">Cancel</button>'+
    '<button class="btn" style="background:#1B5E20;color:white;" onclick="empSavePay()">\u{1F4BE} Save Pay Structure</button>';

  openSheet('ov-pay','sh-pay');

  // Restore extra earnings and deductions
  PAY_EARNINGS=[];PAY_DEDUCTIONS=[];
  if(extraEarnings.length){
    extraEarnings.forEach(function(e){payAddEarning(e.label,e.amount,e.pct||0);});
  } else {
    // Default earnings
    payAddEarning('DA',v.da||0);
    payAddEarning('HRA',v.hra||0);
    payAddEarning('Conveyance',v.conveyance||0);
    payAddEarning('Special Allowance',v.special_allowance||0);
  }
  if(extraDeductions.length){
    extraDeductions.forEach(function(d){payAddDeduction(d.label,d.amount);});
  }

  payCalc();
}

// ── Dynamic earnings/deductions ──────────────────────
var PAY_EARNINGS=[], PAY_DEDUCTIONS=[];
var PAY_EARN_ID=0, PAY_DED_ID=0;

function payAddEarning(label,amount,pct){
  var id='pe_'+(++PAY_EARN_ID);
  // pct: % of Basic. amount: flat ₹. Both stored; % takes priority if set.
  PAY_EARNINGS.push({id:id,label:label||'',amount:parseFloat(amount)||0,pct:parseFloat(pct)||0});
  payRenderEarnings();
  payCalc();
}
function payAddDeduction(label,amount){
  var id='pd_'+(++PAY_DED_ID);
  PAY_DEDUCTIONS.push({id:id,label:label||'',amount:parseFloat(amount)||0});
  payRenderDeductions();
  payCalc();
}
function payRemoveEarning(id){
  PAY_EARNINGS=PAY_EARNINGS.filter(function(e){return e.id!==id;});
  payRenderEarnings();payCalc();
}
function payRemoveDeduction(id){
  PAY_DEDUCTIONS=PAY_DEDUCTIONS.filter(function(d){return d.id!==id;});
  payRenderDeductions();payCalc();
}

function payRenderEarnings(){
  var el=document.getElementById('pay-earnings-list');if(!el)return;
  var basic=gn('pf-basic');
  el.innerHTML=PAY_EARNINGS.map(function(e){
    var dispAmt=e.pct>0?Math.round(basic*e.pct/100):e.amount;
    return '<div style="padding:4px 0;border-bottom:1px solid #F0F4F8;">'+
      '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;">'+
        '<input value="'+e.label+'" oninput="payUpdateEarning(\''+e.id+'\',\'label\',this.value)" placeholder="Label..." style="flex:1;border:1px solid var(--border);border-radius:5px;padding:3px 6px;font-size:11px;font-weight:700;font-family:Nunito,sans-serif;outline:none;">'+
        '<button onclick="payRemoveEarning(\''+e.id+'\')" style="background:#FFEBEE;border:none;border-radius:5px;color:#C62828;width:22px;height:22px;cursor:pointer;font-size:13px;flex-shrink:0;">\u00d7</button>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;">'+
        '<div style="position:relative;">'+
          '<input id="earn-pct-'+e.id+'" value="'+(e.pct||'')+'" oninput="payUpdateEarnPct(\''+e.id+'\',this.value)" placeholder="% Basic" type="number" step="0.01" min="0" max="100" style="width:100%;border:1px solid var(--border);border-radius:5px;padding:3px 20px 3px 6px;font-size:11px;font-family:Nunito,sans-serif;outline:none;box-sizing:border-box;text-align:right;">'+
          '<span style="position:absolute;right:5px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--text3);">%</span>'+
        '</div>'+
        '<div style="position:relative;">'+
          '<input id="earn-amt-'+e.id+'" value="'+dispAmt+'" oninput="payUpdateEarnAmt(\''+e.id+'\',this.value)" placeholder="\u20b9 Amt" type="number" step="1" style="width:100%;border:1px solid var(--border);border-radius:5px;padding:3px 6px 3px 16px;font-size:11px;font-weight:800;font-family:Nunito,sans-serif;outline:none;box-sizing:border-box;text-align:right;">'+
          '<span style="position:absolute;left:5px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--text3);">\u20b9</span>'+
        '</div>'+
      '</div>'+
      '<div id="earn-note-'+e.id+'" style="font-size:9px;color:#2E7D32;margin-top:1px;">'+(e.pct>0?e.pct+'% = \u20b9'+dispAmt.toLocaleString('en-IN'):'')+'</div>'+
    '</div>';
  }).join('');
}

function payRenderDeductions(){
  var el=document.getElementById('pay-deductions-list');if(!el)return;
  el.innerHTML=PAY_DEDUCTIONS.map(function(d){
    return '<div style="padding:4px 0;border-bottom:1px solid #F5F5F5;">'+
      '<div style="display:flex;align-items:center;gap:4px;">'+
        '<input value="'+d.label+'" oninput="payUpdateDeduction(\''+d.id+'\',\'label\',this.value)" placeholder="Label..." style="flex:1;border:1px solid var(--border);border-radius:5px;padding:3px 6px;font-size:11px;font-family:Nunito,sans-serif;outline:none;">'+
        '<div style="position:relative;width:80px;">'+
          '<input id="ded-amt-'+d.id+'" value="'+(d.amount||0)+'" oninput="payUpdateDeduction(\''+d.id+'\',\'amount\',this.value);payCalc()" type="number" step="1" style="width:100%;border:1px solid var(--border);border-radius:5px;padding:3px 6px 3px 16px;font-size:11px;font-weight:800;font-family:Nunito,sans-serif;outline:none;box-sizing:border-box;text-align:right;">'+
          '<span style="position:absolute;left:5px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--text3);">\u20b9</span>'+
        '</div>'+
        '<button onclick="payRemoveDeduction(\''+d.id+'\')" style="background:#FFEBEE;border:none;border-radius:5px;color:#C62828;width:22px;height:22px;cursor:pointer;font-size:13px;flex-shrink:0;">\u00d7</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

// When % changes → update amount field directly (NO re-render → no cursor jump)
function payUpdateEarnPct(id,val){
  var e=PAY_EARNINGS.find(function(x){return x.id===id;});
  if(!e)return;
  e.pct=parseFloat(val)||0;
  var basic=gn('pf-basic');
  if(e.pct>0){
    e.amount=Math.round(basic*e.pct/100);
  } else {
    e.amount=0;
  }
  // Update linked ₹ field without re-rendering
  var amtEl=document.getElementById('earn-amt-'+id);
  if(amtEl)amtEl.value=e.amount||'';
  // Update note label
  var noteEl=document.getElementById('earn-note-'+id);
  if(noteEl){
    noteEl.textContent=e.pct>0?(e.pct+'% of Basic = \u20b9'+e.amount.toLocaleString('en-IN')):'';
  }
  payCalc();
}

// When ₹ amount changes → clear % (manual override, NO re-render)
function payUpdateEarnAmt(id,val){
  var e=PAY_EARNINGS.find(function(x){return x.id===id;});
  if(!e)return;
  e.amount=parseFloat(val)||0;
  e.pct=0;
  // Clear % field without re-rendering
  var pctEl=document.getElementById('earn-pct-'+id);
  if(pctEl)pctEl.value='';
  var noteEl=document.getElementById('earn-note-'+id);
  if(noteEl)noteEl.textContent='';
  payCalc();
}

// When Basic changes, update all pct-based earning amounts
function payUpdateAllPctEarnings(){
  var basic=gn('pf-basic');
  PAY_EARNINGS.forEach(function(e){
    if(e.pct>0){
      e.amount=Math.round(basic*e.pct/100);
      var amtEl=document.getElementById('earn-amt-'+e.id);
      if(amtEl)amtEl.value=e.amount;
      var noteEl=document.getElementById('earn-note-'+e.id);
      if(noteEl)noteEl.textContent=e.pct+'% of Basic = \u20b9'+e.amount.toLocaleString('en-IN');
    }
  });
}

function payUpdateEarning(id,key,val){
  var e=PAY_EARNINGS.find(function(x){return x.id===id;});
  if(e)e[key]=(key==='amount'?parseFloat(val)||0:val);
}
function payUpdateDeduction(id,key,val){
  var d=PAY_DEDUCTIONS.find(function(x){return x.id===id;});
  if(d)d[key]=(key==='amount'?parseFloat(val)||0:val);
}

function gn(id){var el=document.getElementById(id);return parseFloat(el?el.value:0)||0;}

function payCalc(){
  var basic=gn('pf-basic');
  payUpdateAllPctEarnings();
  var extraTotal=PAY_EARNINGS.reduce(function(s,e){
    var amt=e.pct>0?Math.round(basic*e.pct/100):(parseFloat(e.amount)||0);
    return s+amt;
  },0);
  var gross=basic+extraTotal;

  var pfOn=document.getElementById('pf-applicable')&&document.getElementById('pf-applicable').checked;
  var esicOn=document.getElementById('esic-applicable')&&document.getElementById('esic-applicable').checked;

  // PF
  var pfEmp=pfOn?Math.round(basic*0.12):0;
  var pfEmr=pfOn?Math.round(basic*0.12):0;
  var pfPF=document.getElementById('pf-fields');
  if(pfPF)pfPF.style.display=pfOn?'block':'none';
  var pfEEl=document.getElementById('pf-pfe');if(pfEEl&&pfOn)pfEEl.value=pfEmp;
  var pfREl=document.getElementById('pf-pfr');if(pfREl)pfREl.value=pfOn?pfEmr:0;
  if(!pfOn&&pfEEl)pfEEl.value=0;

  // ESIC
  var esicEmp=esicOn&&gross<=21000?Math.round(gross*0.0075):0;
  var esicEmr=esicOn&&gross<=21000?Math.round(gross*0.0325):0;
  var esicF=document.getElementById('esic-fields');
  if(esicF)esicF.style.display=esicOn?'block':'none';
  var esicEEl=document.getElementById('pf-esice');if(esicEEl&&esicOn)esicEEl.value=esicEmp;
  var esicREl=document.getElementById('pf-esicr');if(esicREl)esicREl.value=esicOn?esicEmr:0;
  if(!esicOn&&esicEEl)esicEEl.value=0;

  // ESIC note if gross > 21000
  if(esicOn&&gross>21000){
    var esicF2=document.getElementById('esic-fields');
    if(esicF2&&!document.getElementById('esic-note')){
      var note=document.createElement('div');note.id='esic-note';
      note.style.cssText='font-size:11px;color:#6A1B9A;margin-top:4px;';
      note.textContent='Gross > \u20b921,000 \u2014 ESIC not applicable';
      esicF2.appendChild(note);
    }
  } else {
    var n=document.getElementById('esic-note');if(n)n.remove();
  }

  var extraDedTotal=PAY_DEDUCTIONS.reduce(function(s,d){return s+(parseFloat(d.amount)||0);},0);
  var tds=gn('pf-tds');
  var pt=gn('pf-pt');
  var totalDed=pfEmp+esicEmp+extraDedTotal+tds+pt;
  var net=Math.max(0,gross-totalDed);

  var gDisp=document.getElementById('pf-gross-display');if(gDisp)gDisp.innerHTML='\u20b9'+gross.toLocaleString('en-IN');
  var dDisp=document.getElementById('pf-ded-display');if(dDisp)dDisp.innerHTML='\u20b9'+totalDed.toLocaleString('en-IN');
  var nDisp=document.getElementById('pf-net-display');if(nDisp)nDisp.innerHTML='\u20b9'+net.toLocaleString('en-IN');
}

// Old name kept for compatibility
function payAutoCalc(){payCalc();}

async function payUpdateEffectiveDate(payId, newDate){
  if(!payId||!newDate){toast('Invalid date','warning');return;}
  try{
    await sbUpdate('employee_pay', payId, {effective_date:newDate});
    var rec = EMP_PAY.find(function(p){return p.id===payId;});
    if(rec) rec.effective_date = newDate;
    toast('Effective date updated to '+newDate,'success');
  }catch(e){toast('Error: '+e.message,'error');}
}
function payNetCalc(){payCalc();}


function empGenerateOfferLetter(empId){
  // Find employee and latest pay record
  var emp=EMP_LIST.find(function(e){return e.id===empId;});
  if(!emp){toast('Employee not found','error');return;}
  var pays=EMP_PAY.filter(function(p){return p.employee_id===empId;}).sort(function(a,b){return b.effective_date.localeCompare(a.effective_date);});
  var pay=pays[0];
  if(!pay){toast('No pay structure found. Save pay first.','warning');return;}

  var name=((emp.first_name||'')+(emp.last_name?' '+emp.last_name:'')).trim()||'—';
  var designation=emp.designation||emp.role||'—';
  var dept=emp.department||'—';
  var doj=emp.date_of_joining||emp.doj||pay.effective_date||'—';
  var empCode=emp.employee_code||emp.emp_id||'—';
  var today=fmtDate(new Date());
  var dojFmt=doj&&doj!=='—'?fmtDate(doj):doj;
  var wef=pay.effective_date?fmtDate(pay.effective_date):today;

  // Parse earnings
  var extraEarnings=[];
  try{extraEarnings=pay.extra_earnings?JSON.parse(pay.extra_earnings):[];}catch(ex){}
  var earnings=extraEarnings.length?extraEarnings:[
    {label:'DA',amount:pay.da||0},{label:'HRA',amount:pay.hra||0},
    {label:'Conveyance',amount:pay.conveyance||0},{label:'Special Allowance',amount:pay.special_allowance||0}
  ].filter(function(x){return x.amount>0;});

  var extraDeductions=[];
  try{extraDeductions=pay.extra_deductions?JSON.parse(pay.extra_deductions):[];}catch(ex){}

  function inr(n){return '\u20b9'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function row(label,amount,bold){
    return '<tr style="'+(bold?'font-weight:700;border-top:1px solid #ccc;':'')+'">'+
      '<td style="padding:5px 10px;border:1px solid #e0e0e0;">'+label+'</td>'+
      '<td style="padding:5px 10px;border:1px solid #e0e0e0;text-align:right;">'+inr(amount)+'</td>'+
    '</tr>';
  }

  var earningRows=row('Basic Salary',pay.basic);
  earnings.forEach(function(e){
    var amt=e.pct>0?Math.round((pay.basic||0)*e.pct/100):(e.amount||0);
    if(amt>0)earningRows+=row(e.label,amt);
  });

  var dedRows='';
  if(pay.pf_employee>0)dedRows+=row('PF - Employee Contribution (12%)',pay.pf_employee);
  if(pay.esic_employee>0)dedRows+=row('ESIC - Employee Contribution (0.75%)',pay.esic_employee);
  if(pay.profession_tax>0)dedRows+=row('Profession Tax',pay.profession_tax);
  if(pay.tds>0)dedRows+=row('TDS',pay.tds);
  extraDeductions.forEach(function(d){if(d.amount>0)dedRows+=row(d.label,d.amount);});

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8">'+
  '<title>Offer Letter - '+name+'</title>'+
  '<style>'+
    'body{font-family:Arial,sans-serif;font-size:13px;color:#222;margin:0;padding:0;}'+
    '.page{max-width:780px;margin:0 auto;padding:40px 50px;}'+
    '.header{text-align:center;border-bottom:3px solid #1B5E20;padding-bottom:16px;margin-bottom:24px;}'+
    '.logo{font-size:22px;font-weight:900;color:#1B5E20;letter-spacing:1px;}'+
    '.sub{font-size:11px;color:#555;margin-top:4px;}'+
    '.title{font-size:17px;font-weight:700;text-align:center;text-decoration:underline;margin:20px 0 16px;}'+
    '.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px;}'+
    '.info-row{display:flex;gap:6px;font-size:12px;padding:3px 0;}'+
    '.info-label{color:#555;min-width:130px;flex-shrink:0;}'+
    '.info-val{font-weight:600;}'+
    'table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px;}'+
    'th{background:#1B5E20;color:white;padding:7px 10px;text-align:left;}'+
    'th:last-child{text-align:right;}'+
    '.section-title{font-size:13px;font-weight:700;color:#1B5E20;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.5px;}'+
    '.net-row{background:#E8F5E9;font-weight:900;font-size:14px;}'+
    '.net-row td{padding:8px 10px;border:2px solid #1B5E20;}'+
    '.clause{font-size:11.5px;line-height:1.7;margin-bottom:10px;text-align:justify;}'+
    '.sign-section{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}'+
    '.sign-box{border-top:1px solid #999;padding-top:8px;font-size:12px;}'+
    '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}'+
  '</style></head><body><div class="page">'+

  '<div class="header">'+
    '<div class="logo">'+coName().toUpperCase()+'</div>'+
    (coAddr()?'<div class="sub">'+coAddr()+'</div>':'')+
    '<div class="sub">'+(coCIN()?'CIN: '+coCIN()+' &nbsp;|&nbsp; ':'')+
      (coGST()?'GSTIN: '+coGST():'')+'</div>'+
  '</div>'+

  '<div class="title">APPOINTMENT LETTER</div>'+

  '<p style="font-size:12px;margin-bottom:14px;">Date: <strong>'+today+'</strong></p>'+
  '<p style="font-size:12px;margin-bottom:14px;">To,<br><strong>'+name+'</strong><br>'+(emp.address?emp.address+'<br>':'')+(emp.mobile||emp.phone?'Mobile: '+(emp.mobile||emp.phone):'')+'</p>'+

  '<p class="clause">Dear <strong>'+name+'</strong>,</p>'+
  '<p class="clause">We are pleased to appoint you as <strong>'+designation+'</strong> in the <strong>'+dept+'</strong> department of '+coName()+', with effect from <strong>'+dojFmt+'</strong>, subject to the terms and conditions mentioned herein.</p>'+

  '<div class="section-title">Employment Details</div>'+
  '<div class="info-grid">'+
    '<div>'+
      '<div class="info-row"><span class="info-label">Employee Code</span><span class="info-val">'+empCode+'</span></div>'+
      '<div class="info-row"><span class="info-label">Designation</span><span class="info-val">'+designation+'</span></div>'+
      '<div class="info-row"><span class="info-label">Department</span><span class="info-val">'+dept+'</span></div>'+
    '</div>'+
    '<div>'+
      '<div class="info-row"><span class="info-label">Date of Joining</span><span class="info-val">'+dojFmt+'</span></div>'+
      '<div class="info-row"><span class="info-label">Employment Type</span><span class="info-val">'+(emp.emp_type||emp.empType||'Permanent')+'</span></div>'+
      '<div class="info-row"><span class="info-label">Work Location</span><span class="info-val">'+(emp.work_location||emp.location||'Head Office')+'</span></div>'+
    '</div>'+
  '</div>'+

  '<div class="section-title">Compensation Structure (w.e.f. '+wef+')</div>'+
  '<table>'+
    '<tr><th style="width:70%">Earnings</th><th>Monthly Amount</th></tr>'+
    earningRows+
    '<tr style="font-weight:700;background:#f5f5f5;">'+
      '<td style="padding:6px 10px;border:1px solid #e0e0e0;">Gross Monthly Salary</td>'+
      '<td style="padding:6px 10px;border:1px solid #e0e0e0;text-align:right;">'+inr(pay.gross)+'</td>'+
    '</tr>'+
  '</table>'+

  (dedRows?
    '<table>'+
      '<tr><th style="width:70%">Statutory Deductions</th><th>Monthly Amount</th></tr>'+
      dedRows+
    '</table>':'')+

  '<table>'+
    '<tr class="net-row">'+
      '<td style="width:70%">NET TAKE HOME (Monthly)</td>'+
      '<td style="text-align:right;">'+inr(pay.net_salary)+'</td>'+
    '</tr>'+
    '<tr style="font-size:11px;color:#555;">'+
      '<td colspan="2" style="padding:4px 10px;border:1px solid #e0e0e0;">'+
        'Annual CTC: '+inr((pay.gross+(pay.pf_employer||0)+(pay.esic_employer||0))*12)+
        ' &nbsp;|&nbsp; Annual Gross: '+inr((pay.gross||0)*12)+
      '</td>'+
    '</tr>'+
  '</table>'+

  '<div class="section-title">Terms & Conditions</div>'+
  '<p class="clause">1. <strong>Probation Period:</strong> You will be on probation for a period of 6 (six) months from the date of joining. During probation, either party may terminate the employment with 7 days\' notice.</p>'+
  '<p class="clause">2. <strong>Working Hours:</strong> Normal working hours are 9:00 AM to 6:00 PM, Monday to Saturday. You may be required to work beyond these hours as per project requirements.</p>'+
  '<p class="clause">3. <strong>Leave Entitlement:</strong> You shall be entitled to leave as per the Company\' Leave Policy, which includes Casual Leave, Sick Leave, and Earned Leave.</p>'+
  '<p class="clause">4. <strong>Confidentiality:</strong> You shall maintain strict confidentiality of all company information, client data, project details, and business operations during and after your employment.</p>'+
  '<p class="clause">5. <strong>Notice Period:</strong> After successful completion of probation, the notice period for resignation or termination shall be 30 days.</p>'+
  '<p class="clause">6. <strong>Code of Conduct:</strong> You are expected to adhere to the Company\' Code of Conduct and policies as amended from time to time.</p>'+

  '<p class="clause" style="margin-top:16px;">Please sign and return a copy of this letter as your acceptance of the above terms and conditions. We look forward to your contribution to the growth of '+coName()+'.</p>'+

  '<div class="sign-section">'+
    '<div class="sign-box">'+
      '<div style="margin-top:50px;border-top:1px solid #999;padding-top:8px;">'+
        '<div style="font-weight:700;">'+name+'</div>'+
        '<div style="color:#555;font-size:11px;">Signature &amp; Date of Acceptance</div>'+
      '</div>'+
    '</div>'+
    '<div class="sign-box" style="text-align:right;">'+
      '<div style="margin-top:50px;border-top:1px solid #999;padding-top:8px;">'+
        '<div style="font-weight:700;">Authorised Signatory</div>'+
        '<div style="font-weight:600;">'+coName()+'</div>'+
        '<div style="color:#555;font-size:11px;">Name &amp; Designation</div>'+
      '</div>'+
    '</div>'+
  '</div>'+

  '<p style="font-size:10px;color:#888;text-align:center;margin-top:30px;border-top:1px solid #eee;padding-top:10px;">'+
    'This is a computer-generated document. | '+coName()+' | Generated on '+today+
  '</p>'+
  '</div></body></html>';

  // Open in new tab for print/save as PDF
  var win=window.open('','_blank');
  if(win){
    win.document.write(html);
    win.document.close();
    setTimeout(function(){win.print();},800);
  } else {
    // Fallback: download as HTML
    var blob=new Blob([html],{type:'text/html'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='OfferLetter_'+name.replace(/\s+/g,'_')+'.html';
    a.click();
  }
}

async function empSavePay(){
  var empId=document.getElementById('pf-emp-id')?document.getElementById('pf-emp-id').value:'';
  var date=document.getElementById('pf-date')?document.getElementById('pf-date').value:'';
  var basic=gn('pf-basic');
  if(!empId||!date){toast('Missing data','error');return;}
  if(!basic){toast('Basic salary is required','warning');return;}

  var pfOn=document.getElementById('pf-applicable')&&document.getElementById('pf-applicable').checked;
  var esicOn=document.getElementById('esic-applicable')&&document.getElementById('esic-applicable').checked;

  var basic=gn('pf-basic');
  var extraTotal=PAY_EARNINGS.reduce(function(s,e){
    var amt=e.pct>0?Math.round(basic*e.pct/100):(parseFloat(e.amount)||0);
    return s+amt;
  },0);
  var gross=basic+extraTotal;
  var pfEmp=pfOn?gn('pf-pfe'):0;
  var pfEmr=pfOn?gn('pf-pfr'):0;
  var esicEmp=esicOn?gn('pf-esice'):0;
  var esicEmr=esicOn?gn('pf-esicr'):0;
  var extraDedTotal=PAY_DEDUCTIONS.reduce(function(s,d){return s+(parseFloat(d.amount)||0);},0);
  var tds=gn('pf-tds');
  var pt=gn('pf-pt');
  var net=Math.max(0,gross-pfEmp-esicEmp-extraDedTotal-tds-pt);

  // Build da/hra/etc from extra earnings for backward compat
  var da=0,hra=0,conv=0,spec=0,med=0,other=0;
  PAY_EARNINGS.forEach(function(e){
    var l=(e.label||'').toLowerCase();
    if(l==='da')da=e.amount;
    else if(l==='hra')hra=e.amount;
    else if(l==='conveyance')conv=e.amount;
    else if(l==='special allowance'||l==='special')spec=e.amount;
    else if(l==='medical allowance'||l==='medical')med=e.amount;
    else other+=parseFloat(e.amount)||0;
  });

  var remarks=document.getElementById('pf-remarks')?document.getElementById('pf-remarks').value.trim():'';
  var data={
    employee_id:empId, effective_date:date,
    basic:basic, da:da, hra:hra, conveyance:conv,
    special_allowance:spec, medical_allowance:med, other_allowance:other,
    gross:gross, pf_employee:pfEmp, pf_employer:pfEmr,
    esic_employee:esicEmp, esic_employer:esicEmr,
    tds:tds, profession_tax:pt, net_salary:net, pay_type:'fixed',
    pf_applicable:pfOn, esic_applicable:esicOn,
    extra_earnings:JSON.stringify(PAY_EARNINGS.map(function(e){
      return {id:e.id,label:e.label,pct:e.pct||0,amount:e.pct>0?Math.round(basic*e.pct/100):(e.amount||0)};
    })),
    extra_deductions:JSON.stringify(PAY_DEDUCTIONS),
    remarks:remarks||null,
    created_by:currentUser?currentUser.name:null
  };

  try{
    toast('Saving pay structure...','info');
    // Remove columns that may not exist in DB yet
    var safeData={
      employee_id:data.employee_id, effective_date:data.effective_date,
      basic:data.basic, da:data.da, hra:data.hra, conveyance:data.conveyance,
      special_allowance:data.special_allowance, medical_allowance:data.medical_allowance, other_allowance:data.other_allowance,
      gross:data.gross, pf_employee:data.pf_employee, pf_employer:data.pf_employer,
      esic_employee:data.esic_employee, esic_employer:data.esic_employer,
      tds:data.tds, profession_tax:data.profession_tax||0, net_salary:data.net_salary, pay_type:data.pay_type,
      remarks:data.remarks, created_by:data.created_by
    };
    // Try with extra columns first, fallback without
    var res;
    try{
      res=await sbInsert('employee_pay',data);
    }catch(e2){
      console.warn('Retrying without extra columns:',e2.message);
      res=await sbInsert('employee_pay',safeData);
    }
    if(res&&res[0])EMP_PAY.unshift(res[0]);
    toast('Pay structure saved!','success');
    closeSheet('ov-pay','sh-pay');
    empRender();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

// ════ EMPLOYEE DOWNLOADS, ANNUAL & SALARY PAYMENT ════════════════
function downloadPayslipPDF(empId, monthLabel){
  var rows = window._salRows||[];
  var r = rows.find(function(x){return x.id===empId;});
  if(!r){toast('Generate salary sheet first','warning');return;}
  var e = EMP_LIST.find(function(x){return x.id===empId;})||{};
  var pay = r.pay;
  var days = r.days||26;
  var ratio = days/26;
  var extraEarnings=[];
  try{extraEarnings=pay.extra_earnings?JSON.parse(pay.extra_earnings):[];}catch(ex){}

  var compName = coName();
  var compAddr = coAddr();
  var compGST  = coGST();
  var compCIN  = coCIN();

  function erow(l,v){ return v>0?'<tr><td>'+l+'</td><td style="text-align:right;">\u20b9'+Number(v).toLocaleString('en-IN')+'</td></tr>':''; }

  var pBasic = Math.round((pay.basic||0)*ratio);
  var earnRows = erow('Basic Salary ('+days+'/26 days)',pBasic);
  if(extraEarnings.length){
    extraEarnings.forEach(function(ex){
      if(ex.amount>0){
        var amt = ex.pct>0 ? Math.round(pBasic*ex.pct/100) : Math.round(ex.amount*ratio);
        earnRows+=erow(ex.label,amt);
      }
    });
  } else {
    if(pay.da)                earnRows+=erow('Dearness Allowance',        Math.round((pay.da||0)*ratio));
    if(pay.hra)               earnRows+=erow('House Rent Allowance',       Math.round((pay.hra||0)*ratio));
    if(pay.conveyance)        earnRows+=erow('Conveyance Allowance',       Math.round((pay.conveyance||0)*ratio));
    if(pay.special_allowance) earnRows+=erow('Special Allowance',          Math.round((pay.special_allowance||0)*ratio));
    if(pay.medical_allowance) earnRows+=erow('Medical Allowance',          Math.round((pay.medical_allowance||0)*ratio));
    if(pay.other_allowance)   earnRows+=erow('Other Allowance',            Math.round((pay.other_allowance||0)*ratio));
  }
  if(r.otPay>0) earnRows+=erow('OT Allowance ('+r.ot+' hrs)',r.otPay);

  var dedRows='';
  if(r.pfEmp>0) dedRows+=erow('PF (Employee 12%)',r.pfEmp);
  if(r.esic>0)  dedRows+=erow('ESIC (Employee 0.75%)',r.esic);
  if(r.tds>0)   dedRows+=erow('TDS',r.tds);
  if(r.pt>0)    dedRows+=erow('Profession Tax',r.pt);
  if(r.adv>0)   dedRows+=erow('Advance Recovery',r.adv);

  var today = fmtDate(new Date());

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'+
    '<title>Payslip - '+r.name+' - '+monthLabel+'</title>'+
    '<style>'+
    'body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:0;padding:20px;}'+
    '.page{max-width:700px;margin:0 auto;border:2px solid #1B5E20;border-radius:8px;overflow:hidden;}'+
    '.header{background:#1B5E20;color:white;padding:16px 20px;text-align:center;}'+
    '.co-name{font-size:16px;font-weight:900;letter-spacing:1px;}'+
    '.co-sub{font-size:10px;opacity:.8;margin-top:3px;}'+
    '.slip-title{font-size:13px;font-weight:700;text-decoration:underline;margin-top:6px;}'+
    '.emp-info{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:12px 20px;background:#F8FFF8;border-bottom:1px solid #E0E0E0;font-size:11px;}'+
    '.emp-info span{color:#555;}'+
    '.emp-info b{color:#222;}'+
    '.tables{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #ddd;}'+
    '.t-section{padding:12px 16px;}'+
    '.t-section:first-child{border-right:1px solid #ddd;}'+
    '.t-head{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid;}'+
    '.earn .t-head{color:#2E7D32;border-color:#2E7D32;}'+
    '.ded .t-head{color:#C62828;border-color:#C62828;}'+
    'table{width:100%;border-collapse:collapse;font-size:11px;}'+
    'td{padding:4px 0;border-bottom:1px solid #F5F5F5;}'+
    'td:last-child{text-align:right;}'+
    '.sub-total td{font-weight:700;border-top:2px solid;padding-top:5px;}'+
    '.earn .sub-total td{color:#2E7D32;border-color:#2E7D32;}'+
    '.ded .sub-total td{color:#C62828;border-color:#C62828;}'+
    '.net-box{background:#1B5E2015;border-top:2px solid #1B5E20;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;}'+
    '.net-label{font-size:13px;font-weight:800;color:#1B5E20;}'+
    '.net-amt{font-size:20px;font-weight:900;color:#1B5E20;}'+
    '.footer{padding:8px 20px;text-align:center;font-size:10px;color:#888;border-top:1px solid #eee;}'+
    '@media print{@page{size:A4;margin:10mm;}.page{border:1pt solid #1B5E20;}}'+
    '</style></head><body>'+
    '<div class="page">'+
      '<div class="header">'+
        '<div class="co-name">'+compName.toUpperCase()+'</div>'+
        (compAddr?'<div class="co-sub">'+compAddr+'</div>':'')+
        (compGST?'<div class="co-sub">GSTIN: '+compGST+(compCIN?' &nbsp;|&nbsp; CIN: '+compCIN:'')+'</div>':'')+
        '<div class="slip-title">SALARY PAYSLIP</div>'+
        '<div style="font-size:11px;opacity:.8;margin-top:2px;">'+monthLabel+'</div>'+
      '</div>'+
      '<div class="emp-info">'+
        '<div><span>Employee Name: </span><b>'+r.name+'</b></div>'+
        '<div><span>Employee Code: </span><b>'+r.code+'</b></div>'+
        '<div><span>Designation: </span><b>'+(e.designation||e.role||'\u2014')+'</b></div>'+
        '<div><span>Department: </span><b>'+(e.department||'\u2014')+'</b></div>'+
        '<div><span>Days Worked: </span><b>'+r.days+' / 26</b></div>'+
        '<div><span>OT Hours: </span><b>'+(r.ot||0)+'</b></div>'+
        (pay.pf_applicable?'<div><span>UAN: </span><b>'+(e.pf_no||e.pf||e.uan_no||'\u2014')+'</b></div>':'')+
        (pay.esic_applicable?'<div><span>ESIC No: </span><b>'+(e.esic_no||e.esic||'\u2014')+'</b></div>':'')+
      '</div>'+
      '<div class="tables">'+
        '<div class="t-section earn">'+
          '<div class="t-head">Earnings</div>'+
          '<table><tbody>'+earnRows+
            '<tr class="sub-total"><td>Total Earned</td><td>\u20b9'+Number(r.earned+(r.otPay||0)).toLocaleString('en-IN')+'</td></tr>'+
          '</tbody></table>'+
        '</div>'+
        '<div class="t-section ded">'+
          '<div class="t-head">Deductions</div>'+
          '<table><tbody>'+dedRows+
            '<tr class="sub-total"><td>Total Deducted</td><td>\u20b9'+Number((r.pfEmp||0)+(r.esic||0)+(r.tds||0)+(r.pt||0)+(r.adv||0)).toLocaleString('en-IN')+'</td></tr>'+
          '</tbody></table>'+
        '</div>'+
      '</div>'+
      '<div class="net-box"><span class="net-label">NET TAKE HOME</span><span class="net-amt">\u20b9'+Number(r.payable).toLocaleString('en-IN')+'</span></div>'+
      '<div class="footer">This is a computer-generated payslip and does not require a signature. &nbsp;|&nbsp; Generated on '+today+'</div>'+
    '</div>'+
    '<script>window.onload=function(){window.print();}<\/script>'+
    '</body></html>';

  var w = window.open('','_blank');
  if(w){ w.document.write(html); w.document.close(); }
  else { toast('Allow popups to download PDF','warning'); }
}


// ════ PATCH: empOpenPay — default effective date to DOJ, remarks shows pay history log ════


// ════ INCREMENT APPROVAL LETTER ═════════════════════════════════════════

function downloadIncrementLetter(empId, newBasic, oldBasic, effectiveDate, remarks, oldPayObj, newPayObj){
  var emp = EMP_LIST.find(function(e){return e.id===empId;})||{};
  var name = ((emp.first_name||'')+(emp.last_name?' '+emp.last_name:'')).trim()||'—';
  var code  = emp.employee_code||emp.emp_id||'—';
  var desig = emp.designation||emp.role||'—';
  var dept  = emp.department||'—';
  var today = fmtDate(new Date());
  var wefFmt = effectiveDate ? fmtDate(effectiveDate) : today;
  var increment = Number(newBasic) - Number(oldBasic);
  var pct = Number(oldBasic)>0 ? ((increment/Number(oldBasic))*100).toFixed(1) : '0';
  var compName = typeof coName==='function'?coName():'Atmagaurav Infra Pvt. Ltd.';
  var compAddr = typeof coAddr==='function'?coAddr():'';
  var compGST  = typeof coGST==='function'?coGST():'';
  var compCIN  = typeof coCIN==='function'?coCIN():'';

  // Parse pay objects
  var op = oldPayObj||{};
  var np = newPayObj||{};
  if(typeof op==='string'){try{op=JSON.parse(decodeURIComponent(op));}catch(ex){op={};}}
  if(typeof np==='string'){try{np=JSON.parse(decodeURIComponent(np));}catch(ex){np={};}}

  // Parse extra earnings for old and new
  var opExtra=[];try{opExtra=op.extra_earnings?JSON.parse(op.extra_earnings):[];}catch(ex){}
  var npExtra=[];try{npExtra=np.extra_earnings?JSON.parse(np.extra_earnings):[];}catch(ex){}

  function inr(n){return '&#8377;'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});}

  // Build earnings rows for a pay record
  function buildEarnings(pay, extraEarns, basic){
    var rows = '<tr><td style="padding:5px 10px;border:1px solid #e0e0e0;">Basic Salary</td><td style="padding:5px 10px;border:1px solid #e0e0e0;text-align:right;">'+inr(basic||pay.basic)+'</td></tr>';
    if(extraEarns.length){
      extraEarns.forEach(function(ex){
        var amt = ex.pct>0?Math.round((basic||pay.basic||0)*ex.pct/100):(ex.amount||0);
        if(amt>0) rows+='<tr><td style="padding:5px 10px;border:1px solid #e0e0e0;">'+ex.label+'</td><td style="padding:5px 10px;border:1px solid #e0e0e0;text-align:right;">'+inr(amt)+'</td></tr>';
      });
    } else {
      if(pay.da)                rows+='<tr><td style="padding:5px 10px;border:1px solid #e0e0e0;">Dearness Allowance</td><td style="padding:5px 10px;border:1px solid #e0e0e0;text-align:right;">'+inr(pay.da)+'</td></tr>';
      if(pay.hra)               rows+='<tr><td style="padding:5px 10px;border:1px solid #e0e0e0;">House Rent Allowance</td><td style="padding:5px 10px;border:1px solid #e0e0e0;text-align:right;">'+inr(pay.hra)+'</td></tr>';
      if(pay.conveyance)        rows+='<tr><td style="padding:5px 10px;border:1px solid #e0e0e0;">Conveyance</td><td style="padding:5px 10px;border:1px solid #e0e0e0;text-align:right;">'+inr(pay.conveyance)+'</td></tr>';
      if(pay.special_allowance) rows+='<tr><td style="padding:5px 10px;border:1px solid #e0e0e0;">Special Allowance</td><td style="padding:5px 10px;border:1px solid #e0e0e0;text-align:right;">'+inr(pay.special_allowance)+'</td></tr>';
      if(pay.medical_allowance) rows+='<tr><td style="padding:5px 10px;border:1px solid #e0e0e0;">Medical Allowance</td><td style="padding:5px 10px;border:1px solid #e0e0e0;text-align:right;">'+inr(pay.medical_allowance)+'</td></tr>';
      if(pay.other_allowance)   rows+='<tr><td style="padding:5px 10px;border:1px solid #e0e0e0;">Other Allowance</td><td style="padding:5px 10px;border:1px solid #e0e0e0;text-align:right;">'+inr(pay.other_allowance)+'</td></tr>';
    }
    return rows;
  }

  // Calculate gross for old and new (handle extra earnings with pct)
  function calcGross(pay, extraEarns, basic){
    basic = basic||pay.basic||0;
    if(extraEarns.length){
      return extraEarns.reduce(function(s,ex){
        return s+(ex.pct>0?Math.round(basic*ex.pct/100):(ex.amount||0));
      }, basic);
    }
    return basic+(pay.da||0)+(pay.hra||0)+(pay.conveyance||0)+(pay.special_allowance||0)+(pay.medical_allowance||0)+(pay.other_allowance||0);
  }

  var oldGross = op.gross || calcGross(op, opExtra, oldBasic);
  var newGross = np.gross || calcGross(np, npExtra, newBasic);
  var oldNet   = op.net_salary||0;
  var newNet   = np.net_salary||0;

  var oldEarnings = buildEarnings(op, opExtra, oldBasic);
  var newEarnings = buildEarnings(np, npExtra, newBasic);

  function dedRows(pay){
    var rows='';
    if(pay.pf_employee>0) rows+='<tr><td style="padding:5px 10px;border:1px solid #e0e0e0;">PF (Employee 12%)</td><td style="padding:5px 10px;border:1px solid #e0e0e0;text-align:right;color:#C62828;">'+inr(pay.pf_employee)+'</td></tr>';
    if(pay.esic_employee>0) rows+='<tr><td style="padding:5px 10px;border:1px solid #e0e0e0;">ESIC (Employee 0.75%)</td><td style="padding:5px 10px;border:1px solid #e0e0e0;text-align:right;color:#C62828;">'+inr(pay.esic_employee)+'</td></tr>';
    if(pay.tds>0) rows+='<tr><td style="padding:5px 10px;border:1px solid #e0e0e0;">TDS</td><td style="padding:5px 10px;border:1px solid #e0e0e0;text-align:right;color:#C62828;">'+inr(pay.tds)+'</td></tr>';
    if(pay.profession_tax>0) rows+='<tr><td style="padding:5px 10px;border:1px solid #e0e0e0;">Profession Tax</td><td style="padding:5px 10px;border:1px solid #e0e0e0;text-align:right;color:#C62828;">'+inr(pay.profession_tax)+'</td></tr>';
    return rows;
  }

  var tblStyle = 'width:100%;border-collapse:collapse;font-size:12px;';
  var thStyle  = 'background:#F0F0F0;font-weight:700;padding:6px 10px;border:1px solid #ddd;text-align:left;';
  var tfStyle  = 'font-weight:900;padding:7px 10px;border:2px solid #999;';

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'+
    '<title>Increment Letter - '+name+'</title>'+
    '<style>'+
    'body{font-family:Arial,sans-serif;font-size:13px;color:#222;margin:0;padding:0;}'+
    '.page{max-width:780px;margin:0 auto;padding:36px 48px;}'+
    '.header{text-align:center;border-bottom:3px double #1B5E20;padding-bottom:14px;margin-bottom:20px;}'+
    '.logo{font-size:20px;font-weight:900;color:#1B5E20;letter-spacing:1px;}'+
    '.sub{font-size:10px;color:#555;margin-top:3px;}'+
    '.ref{display:flex;justify-content:space-between;margin-bottom:16px;font-size:12px;}'+
    '.title{font-size:15px;font-weight:700;text-align:center;text-decoration:underline;margin:0 0 16px;color:#1B5E20;}'+
    '.emp-table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;}'+
    '.emp-table td{padding:5px 10px;border:1px solid #ddd;}'+
    '.emp-table td:first-child{background:#F8F9FA;font-weight:600;width:35%;}'+
    '.salary-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:16px 0;}'+
    '.sal-box{border:1px solid #ddd;border-radius:6px;overflow:hidden;}'+
    '.sal-head{padding:8px 10px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;text-align:center;}'+
    '.old-head{background:#FFF3E0;color:#E65100;}'+
    '.new-head{background:#E8F5E9;color:#1B5E20;}'+
    '.summary-box{background:#E8F5E9;border:2px solid #1B5E20;border-radius:6px;padding:12px 16px;margin:16px 0;font-size:13px;}'+
    '.clause{font-size:12px;line-height:1.8;margin-bottom:10px;text-align:justify;}'+
    '.sign{margin-top:50px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}'+
    '.sign-box{text-align:center;}.sign-line{border-top:1px solid #999;padding-top:6px;font-size:11px;color:#555;}'+
    '@media print{@page{size:A4;margin:10mm;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}'+
    '</style></head><body><div class="page">'+

    '<div class="header">'+
      '<div class="logo">'+compName.toUpperCase()+'</div>'+
      (compAddr?'<div class="sub">'+compAddr+'</div>':'')+
      '<div class="sub">'+(compCIN?'CIN: '+compCIN+' &nbsp;|&nbsp; ':'')+( compGST?'GSTIN: '+compGST:'')+'</div>'+
    '</div>'+

    '<div class="ref">'+
      '<div><b>Ref No.:</b> AIPL/INC/'+code+'/'+new Date().getFullYear()+'</div>'+
      '<div><b>Date:</b> '+today+'</div>'+
    '</div>'+

    '<p style="font-size:12px;margin-bottom:14px;">To,<br><b>'+name+'</b><br>'+desig+' — '+dept+'<br>Employee Code: '+code+'</p>'+

    '<div class="title">LETTER OF SALARY INCREMENT / REVISION</div>'+

    '<p class="clause">Dear <b>'+name+'</b>,</p>'+
    '<p class="clause">We are pleased to inform you that the Management of <b>'+compName+'</b> has decided to revise your salary with effect from <b>'+wefFmt+'</b>, based on your performance and contribution to the organisation.</p>'+

    '<table class="emp-table">'+
      '<tr><td>Employee Name</td><td><b>'+name+'</b></td></tr>'+
      '<tr><td>Employee Code</td><td>'+code+'</td></tr>'+
      '<tr><td>Designation</td><td>'+desig+'</td></tr>'+
      '<tr><td>Department</td><td>'+dept+'</td></tr>'+
      '<tr><td>Effective Date</td><td><b>'+wefFmt+'</b></td></tr>'+
    '</table>'+

    // Summary highlight
    '<div class="summary-box">'+
      '<table style="width:100%;font-size:13px;border-collapse:collapse;">'+
        '<tr><td style="padding:3px 0;width:50%;"><b>Previous Basic Salary:</b></td><td>'+inr(oldBasic)+'</td>'+
            '<td style="padding:3px 0;width:50%;padding-left:20px;"><b>Previous Gross Salary:</b></td><td>'+inr(oldGross)+'</td></tr>'+
        '<tr><td style="padding:3px 0;"><b>Revised Basic Salary:</b></td><td style="color:#1B5E20;font-size:15px;font-weight:900;">'+inr(newBasic)+'</td>'+
            '<td style="padding:3px 0;padding-left:20px;"><b>Revised Gross Salary:</b></td><td style="color:#1B5E20;font-size:15px;font-weight:900;">'+inr(newGross)+'</td></tr>'+
        '<tr><td colspan="4" style="padding-top:6px;font-size:12px;color:#1B5E20;font-weight:700;">'+
          'Increment: '+inr(increment)+' on Basic ('+pct+'%) &nbsp;|&nbsp; Gross increase: '+inr(Number(newGross)-Number(oldGross))+
        '</td></tr>'+
      '</table>'+
    '</div>'+

    // Side by side salary breakdown
    '<p style="font-size:12px;font-weight:700;margin:14px 0 8px;">Detailed Salary Structure:</p>'+
    '<div class="salary-grid">'+
      '<div class="sal-box">'+
        '<div class="sal-head old-head">Previous Salary Structure</div>'+
        '<table style="'+tblStyle+'">'+
          '<tr><th style="'+thStyle+'">Component</th><th style="'+thStyle+'text-align:right;">Amount</th></tr>'+
          oldEarnings+
          '<tr style="background:#FFF3E0;"><td style="'+tfStyle+'">Gross Salary</td><td style="'+tfStyle+'text-align:right;color:#E65100;">'+inr(oldGross)+'</td></tr>'+
          (dedRows(op)?'<tr><td colspan="2" style="padding:5px 10px;font-size:10px;color:#666;font-weight:700;border:1px solid #ddd;background:#FFF8F8;">Deductions</td></tr>'+dedRows(op):'')+'<tr style="background:#FFEBEE;"><td style="'+tfStyle+'">Net Salary</td><td style="'+tfStyle+'text-align:right;color:#C62828;">'+inr(oldNet)+'</td></tr>'+
        '</table>'+
      '</div>'+
      '<div class="sal-box">'+
        '<div class="sal-head new-head">Revised Salary Structure</div>'+
        '<table style="'+tblStyle+'">'+
          '<tr><th style="'+thStyle+'">Component</th><th style="'+thStyle+'text-align:right;">Amount</th></tr>'+
          newEarnings+
          '<tr style="background:#E8F5E9;"><td style="'+tfStyle+'">Gross Salary</td><td style="'+tfStyle+'text-align:right;color:#1B5E20;">'+inr(newGross)+'</td></tr>'+
          (dedRows(np)?'<tr><td colspan="2" style="padding:5px 10px;font-size:10px;color:#666;font-weight:700;border:1px solid #ddd;background:#F5FFF5;">Deductions</td></tr>'+dedRows(np):'')+'<tr style="background:#E8F5E9;"><td style="'+tfStyle+'color:#1B5E20;font-size:14px;">Net Salary</td><td style="'+tfStyle+'text-align:right;color:#1B5E20;font-size:14px;">'+inr(newNet)+'</td></tr>'+
        '</table>'+
      '</div>'+
    '</div>'+

    (remarks?'<p class="clause"><b>Remarks / Order Reference:</b> '+remarks.replace('Increment: ','')+'</p>':'')+

    '<p class="clause">All other terms and conditions of your appointment shall remain unchanged. Please sign and return a copy of this letter as acknowledgment of the above terms.</p>'+
    '<p class="clause">We appreciate your continued dedication and look forward to your valuable contributions to the growth of '+compName+'.</p>'+

    '<div class="sign">'+
      '<div class="sign-box"><br><br><br><div class="sign-line">Employee Signature &amp; Date<br>'+name+'</div></div>'+
      '<div class="sign-box"><br><br><br><div class="sign-line">Authorised Signatory<br>'+compName+'</div></div>'+
    '</div>'+

    '<p style="font-size:10px;color:#888;text-align:center;margin-top:24px;border-top:1px solid #eee;padding-top:8px;">'+
      'Computer generated letter. | '+compName+' | Generated on '+today+
    '</p>'+
    '</div>'+
    '<script>window.onload=function(){window.print();}<\/script>'+
    '</body></html>';

  var w = window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else{toast('Allow popups to download PDF','warning');}
}


// ════ TRANSFER ORDER DOWNLOAD ════════════════════════════════════════════

function downloadTransferOrder(empId, type, details){
  // type: 'transfer' | 'promotion'
  var emp = EMP_LIST.find(function(e){return e.id===empId;})||{};
  var name = ((emp.first_name||'')+(emp.last_name?' '+emp.last_name:'')).trim()||'—';
  var code  = emp.employee_code||emp.emp_id||'—';
  var today = fmtDate(new Date());
  var compName = typeof coName==='function'?coName():'Atmagaurav Infra Pvt. Ltd.';
  var compAddr = typeof coAddr==='function'?coAddr():'';
  var compCIN  = typeof coCIN==='function'?coCIN():'';
  var compGST  = typeof coGST==='function'?coGST():'';
  var isPromo  = type==='promotion';
  var titleStr = isPromo ? 'PROMOTION ORDER' : 'TRANSFER ORDER';
  var effectiveDate = details.date || today;
  var wefFmt = effectiveDate&&effectiveDate!==today ?
    fmtDate(effectiveDate) : effectiveDate;

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'+
    '<title>'+titleStr+' - '+name+'</title>'+
    '<style>'+
    'body{font-family:Arial,sans-serif;font-size:13px;color:#222;margin:0;padding:0;}'+
    '.page{max-width:720px;margin:0 auto;padding:40px 50px;}'+
    '.header{text-align:center;border-bottom:3px double '+(isPromo?'#1565C0':'#6A1B9A')+';padding-bottom:14px;margin-bottom:20px;}'+
    '.logo{font-size:20px;font-weight:900;color:'+(isPromo?'#1565C0':'#6A1B9A')+';letter-spacing:1px;}'+
    '.sub{font-size:10px;color:#555;margin-top:3px;}'+
    '.ref{display:flex;justify-content:space-between;margin-bottom:18px;font-size:12px;}'+
    '.title{font-size:15px;font-weight:700;text-align:center;text-decoration:underline;margin:0 0 18px;color:'+(isPromo?'#1565C0':'#6A1B9A')+'}'+
    '.info-table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;}'+
    '.info-table td{padding:6px 10px;border:1px solid #ddd;}'+
    '.info-table td:first-child{background:#F8F9FA;font-weight:600;width:40%;}'+
    '.clause{font-size:12px;line-height:1.8;margin-bottom:10px;text-align:justify;}'+
    '.sign{margin-top:50px;display:flex;justify-content:space-between;}'+
    '.sign-box{text-align:center;min-width:180px;}'+
    '.sign-line{border-top:1px solid #999;padding-top:6px;font-size:11px;color:#555;}'+
    '@media print{@page{size:A4;margin:12mm;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}'+
    '</style></head><body><div class="page">'+

    '<div class="header">'+
      '<div class="logo">'+compName.toUpperCase()+'</div>'+
      (compAddr?'<div class="sub">'+compAddr+'</div>':'')+
      '<div class="sub">'+(compCIN?'CIN: '+compCIN+' | ':'')+( compGST?'GSTIN: '+compGST:'')+'</div>'+
    '</div>'+

    '<div class="ref">'+
      '<div><b>Order No.:</b> AIPL/'+(isPromo?'PRO':'TRF')+'/'+code+'/'+new Date().getFullYear()+'</div>'+
      '<div><b>Date:</b> '+today+'</div>'+
    '</div>'+

    '<div class="title">'+titleStr+'</div>'+

    '<table class="info-table">'+
      '<tr><td>Employee Name</td><td><b>'+name+'</b></td></tr>'+
      '<tr><td>Employee Code</td><td>'+code+'</td></tr>'+
      '<tr><td>Current Designation</td><td>'+(emp.designation||emp.role||'—')+'</td></tr>'+
      '<tr><td>Department</td><td>'+(emp.department||'—')+'</td></tr>'+
      '<tr><td>Effective Date</td><td>'+wefFmt+'</td></tr>'+
      (isPromo
        ? '<tr><td>Promoted To</td><td><b>'+( details.newRole||'—')+'</b></td></tr>'+
          (details.grade?'<tr><td>New Grade</td><td>'+details.grade+'</td></tr>':'')
        : '<tr><td>Transferred To (Dept)</td><td><b>'+(details.newDept||'—')+'</b></td></tr>'+
          '<tr><td>New Project</td><td>'+(details.newProject||'—')+'</td></tr>'
      )+
      (details.remarks?'<tr><td>Remarks / Order Ref.</td><td>'+details.remarks+'</td></tr>':'')+
    '</table>'+

    '<p class="clause">Dear <b>'+name+'</b>,</p>'+
    (isPromo
      ? '<p class="clause">We are pleased to inform you that the Management of <b>'+compName+'</b> has decided to promote you to the position of <b>'+(details.newRole||'—')+'</b> with effect from <b>'+wefFmt+'</b>, in recognition of your dedicated service and performance.</p>'
      : '<p class="clause">This is to inform you that the Management of <b>'+compName+'</b> has decided to transfer you to the <b>'+(details.newDept||'—')+'</b> department'+(details.newProject?' at <b>'+details.newProject+'</b>':'')+' with effect from <b>'+wefFmt+'</b>.</p>'
    )+
    '<p class="clause">You are requested to report to your new assignment on the effective date. All other terms and conditions of your appointment shall remain unchanged.</p>'+
    '<p class="clause">Please sign and return a copy of this order as acknowledgment.</p>'+

    '<div class="sign">'+
      '<div class="sign-box"><br><br><br><div class="sign-line">Employee Signature<br>'+name+'</div></div>'+
      '<div class="sign-box"><br><br><br><div class="sign-line">Authorised Signatory<br>'+compName+'</div></div>'+
    '</div>'+

    '<p style="font-size:10px;color:#888;text-align:center;margin-top:30px;border-top:1px solid #eee;padding-top:8px;">'+
      'This is a computer-generated order. | '+compName+' | Generated on '+today+
    '</p>'+
    '</div>'+
    '<script>window.onload=function(){window.print();}<\/script>'+
    '</body></html>';

  var w = window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else{toast('Allow popups to download PDF','warning');}
}


// ════════════════════════════════════════════════════════════════════════
// DOWNLOAD TAB — all letters and orders per employee
// ════════════════════════════════════════════════════════════════════════

function empDownloadHTML(){
  // Only show employees who were actually employed (active or resigned)
  var active   = EMP_LIST.filter(function(e){ return e.status==='active'; });
  var resigned = EMP_LIST.filter(function(e){ return e.status==='resigned'; });

  if(!active.length && !resigned.length)
    return '<div style="text-align:center;padding:40px;color:var(--text3);">No employees found.</div>';

  if(!EMP_ORDERS.length) hrLoadOrders().then(function(){ empRender(); });

  function empCard(e){
    var name = ((e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'')).trim();
    var statusCol = e.status==='resigned' ? '#C62828' : '#2E7D32';
    var initials  = name.split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase();
    return '<div style="background:white;border-radius:12px;border:1px solid var(--border);margin-bottom:8px;overflow:hidden;">'+
      '<div onclick="empToggleDocList(\'doc-'+e.id+'\')" style="padding:11px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;">'+
        '<div style="width:38px;height:38px;border-radius:10px;background:'+statusCol+';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:white;flex-shrink:0;overflow:hidden;">'+
          (e.profile_photo||e.photo_url
            ? '<img src="'+(e.profile_photo||e.photo_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">'
            : initials)+
        '</div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:13px;font-weight:800;">'+name+
            (e.status==='resigned'
              ? '<span style="background:#FFEBEE;color:#C62828;border-radius:5px;padding:1px 7px;font-size:9px;font-weight:800;margin-left:6px;">RESIGNED</span>'
              : '')+
          '</div>'+
          '<div style="font-size:11px;color:var(--text3);">'+(e.employee_code||e.emp_id||'—')+' &bull; '+(e.designation||e.role||'—')+
            (e.last_working_day ? ' &bull; LWD: '+e.last_working_day : '')+
          '</div>'+
        '</div>'+
        '<div style="font-size:18px;color:var(--text3);" id="doc-arr-'+e.id+'">&#8250;</div>'+
      '</div>'+
      '<div id="doc-'+e.id+'" data-emp-idx="'+e.id+'" style="display:none;border-top:1px solid #F0F4F8;padding:10px 14px 12px;">'+
        '<div style="text-align:center;padding:12px;color:var(--text3);font-size:12px;">&#9203; Loading...</div>'+
      '</div>'+
    '</div>';
  }

  var html =
    '<div style="background:white;border-radius:14px;padding:12px 14px;margin-bottom:12px;">'+
      '<div style="font-size:12px;font-weight:800;color:#1565C0;margin-bottom:4px;">&#128196; Document Downloads</div>'+
      '<div style="font-size:11px;color:var(--text3);">Click any employee to view and download all HR letters and orders.</div>'+
    '</div>';

  // Active employees
  if(active.length){
    html += active.map(empCard).join('');
  }

  // Resigned employees — separated with a header
  if(resigned.length){
    html +=
      '<div style="display:flex;align-items:center;gap:10px;margin:16px 0 10px;">'+
        '<div style="flex:1;height:1px;background:var(--border);"></div>'+
        '<div style="background:#FFEBEE;color:#C62828;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:800;white-space:nowrap;">'+
          '&#128683; Resigned Employees ('+resigned.length+')'+
        '</div>'+
        '<div style="flex:1;height:1px;background:var(--border);"></div>'+
      '</div>'+
      resigned.map(empCard).join('');
  }

  return html;
}

function empToggleDocList(divId){
  var el = document.getElementById(divId);
  var arr = document.getElementById(divId.replace('doc-','doc-arr-'));
  if(!el) return;
  var open = el.style.display!=='none';
  el.style.display = open?'none':'block';
  if(arr) arr.style.transform = open?'':'rotate(90deg)';
  if(!open){
    // Build doc list now (orders should be loaded by now, or load them)
    var empId = el.getAttribute('data-emp-idx')||divId.replace('doc-','');
    var e = EMP_LIST.find(function(x){return x.id===empId;});
    if(!e) return;
    function renderDocs(){
      el.innerHTML = empDocList(e);
      setTimeout(function(){ hrWireDownloadButtons(divId); }, 100);
    }
    if(EMP_ORDERS.length){
      renderDocs();
    } else {
      hrLoadOrders().then(renderDocs).catch(renderDocs);
    }
  }
}

function empDocList(e){
  var empId = e.id;
  var name  = ((e.first_name||'')+(e.middle_name?' '+e.middle_name:'')+(e.last_name?' '+e.last_name:'')).trim();
  var orders = hrOrdersForEmp(empId);
  var pays   = EMP_PAY.filter(function(p){return p.employee_id===empId;})
                      .sort(function(a,b){return a.effective_date.localeCompare(b.effective_date);});

  function docBtn(id, icon, label, color, data){
    var attrs = Object.keys(data||{}).map(function(k){
      return 'data-'+k+'="'+encodeURIComponent(String(data[k]||''))+'"';
    }).join(' ');
    var delBtn = data.orderId
      ? '<button data-del-id="'+data.orderId+'" data-del-label="'+label+'" style="background:#FEE2E2;color:#C62828;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer;">&#128465;</button>'
      : '';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #F9F9F9;">'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-size:12px;font-weight:700;">'+label+'</div>'+
        (data.sub?'<div style="font-size:10px;color:var(--text3);">'+data.sub+'</div>':'')+
      '</div>'+
      '<div style="display:flex;gap:6px;flex-shrink:0;">'+
        delBtn+
        '<button id="'+id+'" '+attrs+' style="background:'+color+';color:white;border:none;border-radius:8px;padding:5px 12px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;">'+icon+' PDF</button>'+
      '</div>'+
    '</div>';
  }

  var html = '';

  // ── Appointment / Offer Letter ───────────────────────────────────────
  if(pays.length){
    var firstPay = pays[0];
    html += '<div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;padding:6px 0 4px;letter-spacing:.5px;">Appointment</div>';
    html += docBtn('dl-offer-'+empId,'&#128196;','Appointment / Offer Letter',
      '#1B5E20',{
        action:'offer', empId:empId,
        sub:'w.e.f. '+(e.date_of_joining||e.doj||firstPay.effective_date||'—')
      });
  }

  // ── Pay Fixation & Revision Orders ───────────────────────────────────
  var payOrders = orders.filter(function(o){
    return o.order_type==='pay_fixation'||o.order_type==='revision';
  });
  if(payOrders.length){
    html += '<div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;padding:8px 0 4px;letter-spacing:.5px;">Pay Fixation Orders</div>';
    payOrders.forEach(function(o,i){
      var d={}; try{d=JSON.parse(o.details||'{}');}catch(ex){}
      html += docBtn('dl-pay-'+o.id,'&#128196;',
        (o.order_type==='pay_fixation'?'Initial Pay Fixation Order':'Pay Revision Order')+' — '+o.effective_date,
        '#1565C0',{action:'pay_order', orderId:o.id, empId:empId,
          sub:'Effective: '+o.effective_date+(d.net_salary?' · Net ₹'+Number(d.net_salary).toLocaleString('en-IN'):'')}
      );
    });
  }

  // ── Increment Letters ─────────────────────────────────────────────────
  var incOrders = orders.filter(function(o){ return o.order_type==='increment'; });
  if(incOrders.length){
    html += '<div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;padding:8px 0 4px;letter-spacing:.5px;">Increment Letters</div>';
    incOrders.forEach(function(o){
      var d={}; try{d=JSON.parse(o.details||'{}');}catch(ex){}
      html += docBtn('dl-inc-ord-'+o.id,'&#128196;',
        'Increment Letter — '+o.effective_date,
        '#2E7D32',{action:'increment', orderId:o.id, empId:empId,
          sub:'Basic: ₹'+Number(d.oldBasic||0).toLocaleString('en-IN')+' → ₹'+Number(d.newBasic||0).toLocaleString('en-IN')}
      );
    });
  }

  // ── Transfer Orders ───────────────────────────────────────────────────
  var trfOrders = orders.filter(function(o){ return o.order_type==='transfer'; });
  if(trfOrders.length){
    html += '<div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;padding:8px 0 4px;letter-spacing:.5px;">Transfer Orders</div>';
    trfOrders.forEach(function(o){
      var d={}; try{d=JSON.parse(o.details||'{}');}catch(ex){}
      html += docBtn('dl-trf-'+o.id,'&#128196;',
        'Transfer Order — '+o.effective_date,
        '#6A1B9A',{action:'transfer', orderId:o.id, empId:empId,
          sub:'To: '+(d.newDept||'—')+(d.newProject?' · '+d.newProject:'')}
      );
    });
  }

  // ── Promotion Orders ──────────────────────────────────────────────────
  var promoOrders = orders.filter(function(o){ return o.order_type==='promotion'; });
  if(promoOrders.length){
    html += '<div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;padding:8px 0 4px;letter-spacing:.5px;">Promotion Orders</div>';
    promoOrders.forEach(function(o){
      var d={}; try{d=JSON.parse(o.details||'{}');}catch(ex){}
      html += docBtn('dl-pro-'+o.id,'&#128196;',
        'Promotion Order — '+o.effective_date,
        '#1565C0',{action:'promotion', orderId:o.id, empId:empId,
          sub:'To: '+(d.newRole||'—')+(d.grade?' · '+d.grade:'')}
      );
    });
  }

  // ── Resignation Letter ────────────────────────────────────────────────
  if(e.status==='resigned'||e.resignation_date||e.last_working_day){
    html += '<div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;padding:8px 0 4px;letter-spacing:.5px;">Resignation</div>';
    html += docBtn('dl-res-'+empId,'&#128196;',
      'Resignation Acceptance Letter',
      '#C62828',{action:'resignation', empId:empId,
        sub:'LWD: '+(e.last_working_day||'—')}
    );
  }

  // ── Salary Payslips ───────────────────────────────────────────────────
  // Get unique months from SALARY_RECORDS for this employee
  var empSalRecs = SALARY_RECORDS.filter(function(r){return r.employee_id===empId && r.payment_date;})
                                  .sort(function(a,b){
                                    if(b.year!==a.year) return b.year-a.year;
                                    return b.month-a.month;
                                  });
  var now2 = new Date();
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var monthOpts = months.map(function(m,i){
    return '<option value="'+(i+1)+'"'+((i+1)===now2.getMonth()+1?' selected':'')+'>'+m+'</option>';
  }).join('');
  var yearOpts = [now2.getFullYear()-1, now2.getFullYear()].map(function(y){
    return '<option value="'+y+'"'+(y===now2.getFullYear()?' selected':'')+'>'+y+'</option>';
  }).join('');

  html += '<div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;padding:8px 0 4px;letter-spacing:.5px;">Salary Payslip</div>';

  // Quick links for paid months
  if(empSalRecs.length){
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">';
    empSalRecs.slice(0,6).forEach(function(r){
      html += '<button data-slip-rid="'+r.id+'" data-slip-eid="'+empId+'" '+
        'style="background:#E8F5E9;color:#1B5E20;border:none;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:800;cursor:pointer;">'+
        r.month_label+'</button>';
    });
    html += '</div>';
  }

  // Month/Year selector for any month
  html += '<div style="background:#F8FAFC;border-radius:10px;padding:10px 12px;margin-bottom:4px;">'+
    '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:end;">'+
      '<div><label style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;display:block;margin-bottom:3px;">Month</label>'+
        '<select id="slip-month-'+empId+'" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:7px;font-size:11px;font-family:Nunito,sans-serif;">'+monthOpts+'</select></div>'+
      '<div><label style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;display:block;margin-bottom:3px;">Year</label>'+
        '<select id="slip-year-'+empId+'" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:7px;font-size:11px;font-family:Nunito,sans-serif;">'+yearOpts+'</select></div>'+
      '<button data-slip-custom-eid="'+empId+'" style="background:#1565C0;color:white;border:none;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;">&#128196; Get Slip</button>'+
    '</div>'+
    '<div id="slip-msg-'+empId+'" style="font-size:10px;color:var(--text3);margin-top:5px;"></div>'+
  '</div>';

  if(!html){
    html = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px;">No documents yet. Add pay fixation, increment or transfer to generate letters.</div>';
  }

  return html;
}

function hrWireDownloadButtons(containerId){
  var container = document.getElementById(containerId);
  if(!container) return;
  // Wire delete buttons
  container.querySelectorAll('button[data-del-id]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var orderId = btn.getAttribute('data-del-id');
      var label   = btn.getAttribute('data-del-label')||'this entry';
      hrDeleteOrder(orderId, label, function(){
        // Re-render this employee's doc list
        var empId = containerId.replace('doc-','');
        var e = EMP_LIST.find(function(x){return x.id===empId;});
        if(e){
          var el = document.getElementById(containerId);
          if(el){ el.innerHTML = empDocList(e); hrWireDownloadButtons(containerId); }
        }
      });
    });
  });
  container.querySelectorAll('button[data-action]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var action  = decodeURIComponent(btn.getAttribute('data-action')||'');
      var empId   = decodeURIComponent(btn.getAttribute('data-empId')||btn.getAttribute('data-empid')||'');
      var orderId = decodeURIComponent(btn.getAttribute('data-orderId')||btn.getAttribute('data-orderid')||'');

      if(action==='offer'){
        empGenerateOfferLetter(empId);
        return;
      }

      // Find order record
      var order = EMP_ORDERS.find(function(o){return o.id===orderId;});
      var d = {}; if(order){try{d=JSON.parse(order.details||'{}');}catch(ex){}}
      var dt = order?order.effective_date:'';

      if(action==='pay_order'){
        downloadPayFixationOrder(empId, dt, d);
      } else if(action==='increment'){
        var op = d.oldPay||{}; var np = d.newPay||{};
        downloadIncrementLetter(empId, d.newBasic||0, d.oldBasic||0, dt, d.remarks||'', op, np);
      } else if(action==='transfer'){
        downloadTransferOrder(empId,'transfer',Object.assign({date:dt},d));
      } else if(action==='promotion'){
        downloadTransferOrder(empId,'promotion',Object.assign({date:dt},d));
      } else if(action==='resignation'){
        downloadResignationLetter(empId);
      }
    });
  });

  // Wire payslip quick-month buttons (paid months)
  container.querySelectorAll('button[data-slip-rid]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var rid=btn.getAttribute('data-slip-rid');
      var eid=btn.getAttribute('data-slip-eid');
      salShowRecordPayslip(rid,eid);
    });
  });

  // Wire custom month/year payslip selector
  container.querySelectorAll('button[data-slip-custom-eid]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var empId=btn.getAttribute('data-slip-custom-eid');
      var monthEl=document.getElementById('slip-month-'+empId);
      var yearEl =document.getElementById('slip-year-'+empId);
      var msgEl  =document.getElementById('slip-msg-'+empId);
      if(!monthEl||!yearEl) return;
      var month=parseInt(monthEl.value);
      var year =parseInt(yearEl.value);
      var MTHS=['','January','February','March','April','May','June','July','August','September','October','November','December'];
      var label=MTHS[month]+' '+year;
      var rec=SALARY_RECORDS.find(function(r){
        return r.employee_id===empId&&r.month===month&&r.year===year;
      });
      if(!rec){
        if(msgEl) msgEl.innerHTML='<span style="color:#E65100;">&#9888; No finalised salary record for '+label+'. Finalise salary first.</span>';
        return;
      }
      if(!rec.payment_date){
        if(msgEl) msgEl.innerHTML='<span style="color:#E65100;">&#9888; '+label+' salary not yet marked as paid. Mark payment first.</span>';
        return;
      }
      if(msgEl) msgEl.innerHTML='';
      salShowRecordPayslip(rec.id,empId);
    });
  });
}

// ─── Pay Fixation Order PDF ──────────────────────────────────────────────
function downloadPayFixationOrder(empId, effectiveDate, details){
  var emp = EMP_LIST.find(function(e){return e.id===empId;})||{};
  var pays= EMP_PAY.filter(function(p){return p.employee_id===empId;})
                   .sort(function(a,b){return a.effective_date.localeCompare(b.effective_date);});
  // find closest pay record to effectiveDate
  var pay = pays.find(function(p){return p.effective_date===effectiveDate;})||pays[0]||{};
  var name = ((emp.first_name||'')+(emp.last_name?' '+emp.last_name:'')).trim()||'—';
  var code  = emp.employee_code||emp.emp_id||'—';
  var desig = emp.designation||emp.role||'—';
  var dept  = emp.department||'—';
  var today = fmtDate(new Date());
  var wefFmt= effectiveDate?fmtDate(effectiveDate):today;
  var compName = typeof coName==='function'?coName():'Atmagaurav Infra Pvt. Ltd.';
  var compAddr = typeof coAddr==='function'?coAddr():'';
  var compCIN  = typeof coCIN==='function'?coCIN():'';
  var compGST  = typeof coGST==='function'?coGST():'';

  function inr(n){return '&#8377;'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});}

  var extraEarnings=[];try{extraEarnings=pay.extra_earnings?JSON.parse(pay.extra_earnings):[];}catch(ex){}

  var earnRows='<tr><td style="padding:6px 10px;border:1px solid #ddd;">Basic Salary</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">'+inr(pay.basic)+'</td></tr>';
  if(extraEarnings.length){
    extraEarnings.forEach(function(ex){
      var amt=ex.pct>0?Math.round((pay.basic||0)*ex.pct/100):(ex.amount||0);
      if(amt>0) earnRows+='<tr><td style="padding:6px 10px;border:1px solid #ddd;">'+ex.label+'</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">'+inr(amt)+'</td></tr>';
    });
  } else {
    if(pay.da)                earnRows+='<tr><td style="padding:6px 10px;border:1px solid #ddd;">Dearness Allowance</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">'+inr(pay.da)+'</td></tr>';
    if(pay.hra)               earnRows+='<tr><td style="padding:6px 10px;border:1px solid #ddd;">House Rent Allowance</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">'+inr(pay.hra)+'</td></tr>';
    if(pay.conveyance)        earnRows+='<tr><td style="padding:6px 10px;border:1px solid #ddd;">Conveyance Allowance</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">'+inr(pay.conveyance)+'</td></tr>';
    if(pay.special_allowance) earnRows+='<tr><td style="padding:6px 10px;border:1px solid #ddd;">Special Allowance</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">'+inr(pay.special_allowance)+'</td></tr>';
    if(pay.medical_allowance) earnRows+='<tr><td style="padding:6px 10px;border:1px solid #ddd;">Medical Allowance</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">'+inr(pay.medical_allowance)+'</td></tr>';
    if(pay.other_allowance)   earnRows+='<tr><td style="padding:6px 10px;border:1px solid #ddd;">Other Allowance</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">'+inr(pay.other_allowance)+'</td></tr>';
  }

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pay Fixation Order - '+name+'</title>'+
    '<style>body{font-family:Arial,sans-serif;font-size:13px;color:#222;margin:0;padding:0;}.page{max-width:720px;margin:0 auto;padding:40px 50px;}'+
    '.header{text-align:center;border-bottom:3px double #1565C0;padding-bottom:14px;margin-bottom:20px;}'+
    '.logo{font-size:20px;font-weight:900;color:#1565C0;}.sub{font-size:10px;color:#555;margin-top:3px;}'+
    '.title{font-size:15px;font-weight:700;text-align:center;text-decoration:underline;margin:0 0 18px;color:#1565C0;}'+
    '.info td{padding:5px 10px;border:1px solid #ddd;font-size:12px;}.info td:first-child{background:#F5F8FF;font-weight:600;width:35%;}'+
    'table{width:100%;border-collapse:collapse;}.th{background:#1565C0;color:white;padding:7px 10px;text-align:left;font-size:12px;}'+
    '.th:last-child{text-align:right;}.gross{background:#E8F0FE;font-weight:900;}.net{background:#E8F5E9;font-weight:900;font-size:14px;}'+
    '.clause{font-size:12px;line-height:1.8;margin-bottom:10px;text-align:justify;}'+
    '.sign{margin-top:50px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}'+
    '.sign-box{text-align:center;}.sign-line{border-top:1px solid #999;padding-top:6px;font-size:11px;color:#555;}'+
    '@media print{@page{size:A4;margin:12mm;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body>'+
    '<div class="page">'+
    '<div class="header"><div class="logo">'+compName.toUpperCase()+'</div>'+(compAddr?'<div class="sub">'+compAddr+'</div>':'')+
    '<div class="sub">'+(compCIN?'CIN: '+compCIN+' | ':'')+( compGST?'GSTIN: '+compGST:'')+'</div></div>'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:16px;font-size:12px;">'+
      '<div><b>Ref No.:</b> AIPL/PAY/'+code+'/'+new Date().getFullYear()+'</div><div><b>Date:</b> '+today+'</div>'+
    '</div>'+
    '<p style="font-size:12px;">To,<br><b>'+name+'</b><br>'+desig+', '+dept+'<br>Employee Code: '+code+'</p>'+
    '<div class="title">PAY FIXATION ORDER</div>'+
    '<table class="info" style="margin-bottom:16px;">'+
      '<tr><td>Employee Name</td><td><b>'+name+'</b></td></tr>'+
      '<tr><td>Employee Code</td><td>'+code+'</td></tr>'+
      '<tr><td>Designation</td><td>'+desig+'</td></tr>'+
      '<tr><td>Department</td><td>'+dept+'</td></tr>'+
      '<tr><td>Date of Joining</td><td>'+(emp.date_of_joining||emp.doj||'—')+'</td></tr>'+
      '<tr><td>Effective Date</td><td><b>'+wefFmt+'</b></td></tr>'+
    '</table>'+
    '<p class="clause">This is to inform that your pay has been fixed as under, effective from <b>'+wefFmt+'</b>:</p>'+
    '<table style="margin-bottom:16px;font-size:12px;">'+
      '<tr><th class="th">Pay Component</th><th class="th" style="text-align:right;">Monthly Amount</th></tr>'+
      earnRows+
      '<tr class="gross"><td style="padding:7px 10px;border:2px solid #9E9E9E;">Gross Salary</td><td style="padding:7px 10px;border:2px solid #9E9E9E;text-align:right;color:#1565C0;">'+inr(pay.gross||0)+'</td></tr>'+
      (pay.pf_employee>0?'<tr><td style="padding:5px 10px;border:1px solid #ddd;color:#C62828;">(-) PF Contribution (12%)</td><td style="padding:5px 10px;border:1px solid #ddd;text-align:right;color:#C62828;">'+inr(pay.pf_employee)+'</td></tr>':'')+
      (pay.esic_employee>0?'<tr><td style="padding:5px 10px;border:1px solid #ddd;color:#C62828;">(-) ESIC Contribution (0.75%)</td><td style="padding:5px 10px;border:1px solid #ddd;text-align:right;color:#C62828;">'+inr(pay.esic_employee)+'</td></tr>':'')+
      (pay.tds>0?'<tr><td style="padding:5px 10px;border:1px solid #ddd;color:#C62828;">(-) TDS</td><td style="padding:5px 10px;border:1px solid #ddd;text-align:right;color:#C62828;">'+inr(pay.tds)+'</td></tr>':'')+
      (pay.profession_tax>0?'<tr><td style="padding:5px 10px;border:1px solid #ddd;color:#C62828;">(-) Profession Tax</td><td style="padding:5px 10px;border:1px solid #ddd;text-align:right;color:#C62828;">'+inr(pay.profession_tax)+'</td></tr>':'')+
      '<tr class="net"><td style="padding:8px 10px;border:2px solid #1B5E20;color:#1B5E20;">Net Take Home Salary</td><td style="padding:8px 10px;border:2px solid #1B5E20;text-align:right;color:#1B5E20;font-size:15px;">'+inr(pay.net_salary||0)+'</td></tr>'+
    '</table>'+
    '<p class="clause">All other terms and conditions of your appointment remain as per the appointment letter. This order supersedes any previous pay order.</p>'+
    '<p class="clause">Please sign and return a copy as acknowledgment.</p>'+
    '<div class="sign">'+
      '<div class="sign-box"><br><br><br><div class="sign-line">Employee Signature<br>'+name+'</div></div>'+
      '<div class="sign-box"><br><br><br><div class="sign-line">Authorised Signatory<br>'+compName+'</div></div>'+
    '</div>'+
    '<p style="font-size:10px;color:#888;text-align:center;margin-top:24px;border-top:1px solid #eee;padding-top:8px;">Computer generated order. | '+compName+' | Generated on '+today+'</p>'+
    '</div><script>window.onload=function(){window.print();}<\/script></body></html>';

  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else{toast('Allow popups to download PDF','warning');}
}

// ─── Resignation Acceptance Letter PDF ───────────────────────────────────


function downloadIDCard(empId){
  var emp   = EMP_LIST.find(function(e){return e.id===empId;})||{};
  var name  = ((emp.first_name||'')+(emp.middle_name?' '+emp.middle_name:'')+(emp.last_name?' '+emp.last_name:'')).trim()||'—';
  var code  = emp.employee_code||emp.emp_id||'—';
  var desig = emp.designation||emp.role||'—';
  var dept  = emp.department||'—';
  var doj   = emp.date_of_joining||emp.doj||'';
  var blood = emp.blood_group||emp.blood||'—';
  var phone = emp.phone||emp.mobile||'—';
  var email = emp.email||'—';
  var addr  = emp.address||'';
  var photo = emp.profile_photo||emp.photo_url||'';
  var dojFmt= doj ? fmtDate(doj) : '—';
  var initials = name.split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase();

  var compName  = typeof coName==='function'?coName():'Atmagaurav Infra Pvt. Ltd.';
  var compAddr  = typeof coAddr==='function'?coAddr():'';
  var compEmail = typeof coEmail==='function'?coEmail():'';

  // Proper barcode: encode each character as fixed pattern of narrow(1)/wide(2) bars
  function barcodeStripes(txt){
    // Code 39 narrow=1px wide=3px, alternating bar/space
    var C39 = {
      '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn',
      '4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw',
      '8':'wnnwnnwnn','9':'nnwwnnwnn','A':'wnnnnwnnw','B':'nnwnnwnnw',
      'C':'wnwnnwnnn','D':'nnnnnwnnw','E':'wnnnnwnnn','F':'nnwnnwnnn',
      'G':'nnnnnwwnw','H':'wnnnnwwnn','I':'nnwnnwwnn','J':'nnnnnwwnn',
      'K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnnwnnww',
      'P':'wnnnnnnwn','Q':'nnwnnnnwn','-':'nnnnnnnww','*':'nnnnnnnwn'
    };
    var N=1, W=3, G=1; // narrow bar, wide bar, gap
    var bars = [];
    var str = ('*'+txt.toUpperCase()+'*').replace(/[^0-9A-Z\-\*]/g,'');
    for(var i=0;i<str.length;i++){
      var pat = C39[str[i]]||C39['*'];
      for(var j=0;j<9;j++){
        var w = pat[j]==='w'?W:N;
        bars.push({w:w, filled: j%2===0}); // even=bar, odd=space
      }
      if(i<str.length-1) bars.push({w:G, filled:false}); // inter-char gap
    }
    // Build SVG
    var totalW = bars.reduce(function(s,b){return s+b.w;},0);
    var rects = '';
    var x = 0;
    bars.forEach(function(b){
      if(b.filled) rects += '<rect x="'+x+'" y="0" width="'+b.w+'" height="32" fill="rgba(255,255,255,0.85)"/>';
      x += b.w;
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="32" viewBox="0 0 '+totalW+' 32" preserveAspectRatio="none">'+
      rects+
    '</svg>';
  }

  var photoHTML = photo
    ? '<img src="'+photo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
    : '<span style="font-family:Montserrat,sans-serif;font-size:38px;font-weight:900;color:white;letter-spacing:-1px;">'+initials+'</span>';

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'+
    '<title>ID Card \u2014 '+name+'</title>'+
    '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">'+
    '<style>'+
    '*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}'+
    'body{font-family:"Nunito",sans-serif;background:#CBD5E0;min-height:100vh;display:flex;justify-content:center;align-items:center;padding:40px 20px;gap:30px;flex-wrap:wrap;}'+

    /* Each card is 54×86mm — vertical CR80 */
    '.card{width:54mm;height:86mm;border-radius:14px;overflow:hidden;position:relative;box-shadow:0 12px 40px rgba(0,0,0,0.25),0 3px 10px rgba(0,0,0,0.12);display:flex;flex-direction:column;flex-shrink:0;}'+

    /* ── FRONT ── */
    '.front{background:#0d1f3c;}'+

    /* top wave header */
    '.f-top{background:linear-gradient(135deg,#1B5E20 0%,#2E7D32 45%,#1565C0 100%);padding:14px 12px 40px;text-align:center;position:relative;}'+
    '.f-co-logo{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:16px;margin:0 auto 5px;}'+
    '.f-co-name{font-family:"Montserrat",sans-serif;font-size:7px;font-weight:800;color:white;letter-spacing:0.5px;text-transform:uppercase;line-height:1.3;opacity:0.95;}'+
    '.f-wave{position:absolute;bottom:-1px;left:0;right:0;height:28px;}'+

    /* photo bubble */
    '.f-photo-wrap{position:relative;display:flex;justify-content:center;margin-top:-28px;z-index:2;flex-shrink:0;}'+
    '.f-photo{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#1B5E20,#1565C0);display:flex;align-items:center;justify-content:center;overflow:hidden;border:3px solid #0d1f3c;box-shadow:0 4px 16px rgba(0,0,0,0.4);}'+
    '.f-photo-ring{position:absolute;inset:-5px;border-radius:50%;border:2px dashed rgba(67,160,71,0.5);pointer-events:none;animation:spin 12s linear infinite;}'+
    '@keyframes spin{to{transform:rotate(360deg);}}'+

    /* name block */
    '.f-name-block{text-align:center;padding:8px 10px 6px;flex-shrink:0;}'+
    '.f-name{font-family:"Montserrat",sans-serif;font-size:11px;font-weight:900;color:white;line-height:1.25;letter-spacing:-0.2px;}'+
    '.f-desig{font-size:7.5px;font-weight:700;color:#4CAF50;letter-spacing:0.5px;text-transform:uppercase;margin-top:3px;}'+
    '.f-dept{font-size:7px;color:rgba(255,255,255,0.5);margin-top:2px;font-weight:600;}'+

    /* divider */
    '.f-divider{height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent);margin:0 14px;}'+

    /* emp id row */
    '.f-id-row{display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 12px;flex-shrink:0;}'+
    '.f-id-label{font-size:6px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;}'+
    '.f-id-val{font-family:"Montserrat",sans-serif;font-size:10px;font-weight:800;color:white;letter-spacing:1.5px;background:rgba(255,255,255,0.07);padding:2px 10px;border-radius:20px;border:1px solid rgba(255,255,255,0.12);}'+

    /* barcode */
    '.f-barcode{padding:6px 12px 8px;flex-shrink:0;}'+
    '.f-barcode-inner{padding:0 8px 4px;text-align:center;}'+
    '.f-barcode-txt{font-family:"Montserrat",sans-serif;font-size:6px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:3px;margin-top:3px;}'+

    /* validity strip */
    '.f-bottom{margin-top:auto;background:linear-gradient(90deg,#1B5E20,#1565C0);padding:4px 12px;text-align:center;flex-shrink:0;}'+
    '.f-validity{font-size:6px;font-weight:600;color:rgba(255,255,255,0.8);letter-spacing:0.5px;}'+

    /* ── BACK ── */
    '.back{background:white;}'+
    '.b-top{height:6px;background:linear-gradient(90deg,#1B5E20 0%,#43A047 50%,#1565C0 100%);}'+
    '.b-header{background:#0d1f3c;padding:8px 12px;text-align:center;}'+
    '.b-header-title{font-family:"Montserrat",sans-serif;font-size:8px;font-weight:800;color:white;letter-spacing:2px;text-transform:uppercase;}'+
    '.b-header-sub{font-size:6px;color:rgba(255,255,255,0.5);margin-top:1px;letter-spacing:0.5px;}'+

    /* fields */
    '.b-fields{padding:10px 12px;flex:1;display:flex;flex-direction:column;gap:6px;}'+
    '.b-row{display:flex;align-items:flex-start;gap:8px;}'+
    '.b-icon{width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;margin-top:1px;}'+
    '.b-icon-green{background:#E8F5E9;}'+
    '.b-icon-blue{background:#E3F2FD;}'+
    '.b-icon-red{background:#FFEBEE;}'+
    '.b-icon-orange{background:#FFF3E0;}'+
    '.b-field-txt{display:flex;flex-direction:column;gap:1px;min-width:0;}'+
    '.b-label{font-size:6px;font-weight:700;color:#9E9E9E;text-transform:uppercase;letter-spacing:0.8px;}'+
    '.b-val{font-size:8.5px;font-weight:700;color:#1a1a1a;line-height:1.3;word-break:break-word;}'+
    '.b-val-blood{font-size:12px;font-weight:900;color:#C62828;}'+

    /* divider */
    '.b-sep{height:1px;background:#f0f0f0;margin:0 12px;}'+

    /* company footer */
    '.b-footer{background:#0d1f3c;padding:8px 12px;margin-top:auto;}'+
    '.b-footer-co{font-family:"Montserrat",sans-serif;font-size:7px;font-weight:800;color:white;margin-bottom:3px;}'+
    '.b-footer-detail{font-size:6px;color:rgba(255,255,255,0.55);line-height:1.6;}'+
    '.b-footer-accent{width:24px;height:2px;background:linear-gradient(90deg,#1B5E20,#1565C0);border-radius:2px;margin-bottom:4px;}'+

    '@media print{'+
      'body{background:white;min-height:unset;padding:10mm;gap:8mm;align-items:flex-start;justify-content:flex-start;-webkit-print-color-adjust:exact;print-color-adjust:exact;}'+
      '*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}'+
      '.card{box-shadow:none;page-break-inside:avoid;}'+
      '@page{size:A4 portrait;margin:10mm;}'+
      '@keyframes spin{}'+
      '.f-photo-ring{animation:none;}'+
    '}'+
    '</style></head><body>'+

    // ── FRONT ──────────────────────────────────────────────────────────
    '<div class="card front">'+
      '<div class="f-top">'+
        '<div class="f-co-logo">&#127959;</div>'+
        '<div class="f-co-name">'+compName+'</div>'+
        // wave SVG
        '<svg class="f-wave" viewBox="0 0 216 28" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">'+
          '<path d="M0,14 C36,28 72,0 108,14 C144,28 180,0 216,14 L216,28 L0,28 Z" fill="#0d1f3c"/>'+
        '</svg>'+
      '</div>'+

      '<div class="f-photo-wrap">'+
        '<div class="f-photo">'+photoHTML+'</div>'+
        '<div class="f-photo-ring"></div>'+
      '</div>'+

      '<div class="f-name-block">'+
        '<div class="f-name">'+name+'</div>'+
        '<div class="f-desig">'+desig+'</div>'+
        '<div class="f-dept">'+dept+'</div>'+
      '</div>'+

      '<div class="f-divider"></div>'+

      '<div class="f-id-row">'+
        '<span class="f-id-label">Employee ID</span>'+
        '<span class="f-id-val">'+code+'</span>'+
      '</div>'+

      '<div class="f-barcode">'+
        '<div class="f-barcode-inner">'+
          barcodeStripes(code)+
          '<div class="f-barcode-txt">'+code+'</div>'+
        '</div>'+
      '</div>'+

      '<div class="f-bottom">'+
        '<div class="f-validity">DOJ: '+dojFmt+'&nbsp;&nbsp;&#9679;&nbsp;&nbsp;VALID WHILE EMPLOYED</div>'+
      '</div>'+
    '</div>'+

    // ── BACK ───────────────────────────────────────────────────────────
    '<div class="card back">'+
      '<div class="b-top"></div>'+
      '<div class="b-header">'+
        '<div class="b-header-title">Employee Details</div>'+
        '<div class="b-header-sub">'+compName+'</div>'+
      '</div>'+

      '<div class="b-fields">'+

        (addr?
          '<div class="b-row">'+
            '<div class="b-icon b-icon-orange">&#128205;</div>'+
            '<div class="b-field-txt">'+
              '<div class="b-label">Address</div>'+
              '<div class="b-val">'+addr+'</div>'+
            '</div>'+
          '</div>':'')+

        '<div class="b-row">'+
          '<div class="b-icon b-icon-green">&#128222;</div>'+
          '<div class="b-field-txt">'+
            '<div class="b-label">Mobile</div>'+
            '<div class="b-val">'+phone+'</div>'+
          '</div>'+
        '</div>'+

        '<div class="b-row">'+
          '<div class="b-icon b-icon-blue">&#9993;</div>'+
          '<div class="b-field-txt">'+
            '<div class="b-label">Email</div>'+
            '<div class="b-val" style="font-size:7.5px;">'+email+'</div>'+
          '</div>'+
        '</div>'+

        '<div class="b-row">'+
          '<div class="b-icon b-icon-red">&#128147;</div>'+
          '<div class="b-field-txt">'+
            '<div class="b-label">Blood Group</div>'+
            '<div class="b-val b-val-blood">'+blood+'</div>'+
          '</div>'+
        '</div>'+

      '</div>'+

      '<div class="b-sep"></div>'+

      '<div class="b-footer">'+
        '<div class="b-footer-accent"></div>'+
        '<div class="b-footer-co">'+compName+'</div>'+
        '<div class="b-footer-detail">'+
          (compAddr?compAddr+'<br>':'')+
          (compEmail?'&#9993; '+compEmail:'')+
        '</div>'+
      '</div>'+
    '</div>'+

    '<script>window.onload=function(){window.print();}<\/script>'+
    '</body></html>';

  var w = window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else{toast('Allow popups to print ID card','warning');}
}

function downloadResignationLetter(empId){
  var emp = EMP_LIST.find(function(e){return e.id===empId;})||{};
  var name = ((emp.first_name||'')+(emp.last_name?' '+emp.last_name:'')).trim()||'—';
  var code  = emp.employee_code||emp.emp_id||'—';
  var desig = emp.designation||emp.role||'—';
  var dept  = emp.department||'—';
  var today = fmtDate(new Date());
  var resDate = emp.resignation_date||'—';
  var lwd     = emp.last_working_day||'—';
  var reason  = emp.resignation_reason||emp.rejection_reason||'Personal reasons';
  var compName= typeof coName==='function'?coName():'Atmagaurav Infra Pvt. Ltd.';
  var compAddr= typeof coAddr==='function'?coAddr():'';
  var compCIN = typeof coCIN==='function'?coCIN():'';
  var compGST = typeof coGST==='function'?coGST():'';

  var resDateFmt = resDate&&resDate!=='—'?fmtDate(resDate):resDate;
  var lwdFmt     = lwd&&lwd!=='—'?fmtDate(lwd):lwd;

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Resignation Acceptance - '+name+'</title>'+
    '<style>body{font-family:Arial,sans-serif;font-size:13px;color:#222;margin:0;padding:0;}.page{max-width:720px;margin:0 auto;padding:40px 50px;}'+
    '.header{text-align:center;border-bottom:3px double #C62828;padding-bottom:14px;margin-bottom:20px;}'+
    '.logo{font-size:20px;font-weight:900;color:#C62828;}.sub{font-size:10px;color:#555;margin-top:3px;}'+
    '.title{font-size:15px;font-weight:700;text-align:center;text-decoration:underline;margin:0 0 18px;color:#C62828;}'+
    '.info td{padding:5px 10px;border:1px solid #ddd;font-size:12px;}.info td:first-child{background:#FFF5F5;font-weight:600;width:35%;}'+
    '.clause{font-size:12px;line-height:1.8;margin-bottom:10px;text-align:justify;}'+
    '.sign{margin-top:50px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}'+
    '.sign-box{text-align:center;}.sign-line{border-top:1px solid #999;padding-top:6px;font-size:11px;color:#555;}'+
    '@media print{@page{size:A4;margin:12mm;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body>'+
    '<div class="page">'+
    '<div class="header"><div class="logo">'+compName.toUpperCase()+'</div>'+(compAddr?'<div class="sub">'+compAddr+'</div>':'')+
    '<div class="sub">'+(compCIN?'CIN: '+compCIN+' | ':'')+( compGST?'GSTIN: '+compGST:'')+'</div></div>'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:16px;font-size:12px;">'+
      '<div><b>Ref No.:</b> AIPL/RES/'+code+'/'+new Date().getFullYear()+'</div><div><b>Date:</b> '+today+'</div>'+
    '</div>'+
    '<p style="font-size:12px;">To,<br><b>'+name+'</b><br>'+desig+', '+dept+'<br>Employee Code: '+code+'</p>'+
    '<div class="title">ACCEPTANCE OF RESIGNATION</div>'+
    '<table class="info" style="margin-bottom:16px;width:100%;border-collapse:collapse;">'+
      '<tr><td>Employee Name</td><td><b>'+name+'</b></td></tr>'+
      '<tr><td>Employee Code</td><td>'+code+'</td></tr>'+
      '<tr><td>Designation</td><td>'+desig+'</td></tr>'+
      '<tr><td>Department</td><td>'+dept+'</td></tr>'+
      '<tr><td>Date of Joining</td><td>'+(emp.date_of_joining||emp.doj||'—')+'</td></tr>'+
      '<tr><td>Resignation Date</td><td>'+resDateFmt+'</td></tr>'+
      '<tr><td>Last Working Day</td><td><b>'+lwdFmt+'</b></td></tr>'+
    '</table>'+
    '<p class="clause">Dear <b>'+name+'</b>,</p>'+
    '<p class="clause">This is to acknowledge receipt of your resignation letter dated <b>'+resDateFmt+'</b>. The Management of <b>'+compName+'</b> has reviewed your resignation and hereby accepts the same.</p>'+
    '<p class="clause">Your last working day with the organisation will be <b>'+lwdFmt+'</b>. You are requested to complete the following formalities before your last working day:</p>'+
    '<ol style="font-size:12px;line-height:2;">'+
      '<li>Handover of duties, responsibilities and documents to your reporting manager</li>'+
      '<li>Return of all company assets, ID cards, access cards and equipment</li>'+
      '<li>Clearance from Finance, Admin and IT departments</li>'+
      '<li>Completion of exit interview as scheduled by HR</li>'+
    '</ol>'+
    '<p class="clause">Your Full & Final settlement will be processed after completion of the above formalities and will be credited to your registered bank account within 30 working days of your last working day.</p>'+
    '<p class="clause">We appreciate your contributions to <b>'+compName+'</b> during your tenure and wish you all the best in your future endeavours.</p>'+
    '<div class="sign">'+
      '<div class="sign-box"><br><br><br><div class="sign-line">Employee Signature<br>'+name+'</div></div>'+
      '<div class="sign-box"><br><br><br><div class="sign-line">HR / Authorised Signatory<br>'+compName+'</div></div>'+
    '</div>'+
    '<p style="font-size:10px;color:#888;text-align:center;margin-top:24px;border-top:1px solid #eee;padding-top:8px;">Computer generated letter. | '+compName+' | Generated on '+today+'</p>'+
    '</div><script>window.onload=function(){window.print();}<\/script></body></html>';

  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else{toast('Allow popups to download PDF','warning');}
}

// ════ SALARY PAYMENT TRACKING ════════════════════════════════════════════
// Adds payment_date + payment_ref to salary_records
// SQL: ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS payment_date date;
//      ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS payment_ref text;

// Open payment entry sheet for one employee record
function salOpenPayment(recordId, empName, netPayable){
  var rec = SALARY_RECORDS.find(function(r){return r.id===recordId;})||{};
  var already = rec.payment_date;
  document.getElementById('emp-sheet-title').textContent = '\u{1F4B8} Mark Payment — '+empName;
  document.getElementById('emp-sheet-body').innerHTML =
    '<div style="background:#E8F5E9;border-radius:12px;padding:14px;margin-bottom:12px;text-align:center;">'+
      '<div style="font-size:11px;color:var(--text3);">Net Payable</div>'+
      '<div style="font-size:28px;font-weight:900;color:#1B5E20;">\u20b9'+Number(netPayable||0).toLocaleString('en-IN')+'</div>'+
      '<div style="font-size:11px;color:var(--text3);margin-top:2px;">'+rec.month_label+' &bull; '+empName+'</div>'+
    '</div>'+
    (already?
      '<div style="background:#FFF3E0;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:12px;">'+
        '<b>Already marked paid:</b> '+already+(rec.payment_ref?' &bull; Ref: '+rec.payment_ref:'')+''+
      '</div>'
    :'')+
    '<label class="flbl">Payment Date *</label>'+
    '<input id="sal-pay-date" class="finp" type="date" value="'+(already||new Date().toISOString().slice(0,10))+'">'+
    '<label class="flbl">Payment Reference / UTR No.</label>'+
    '<input id="sal-pay-ref" class="finp" placeholder="e.g. UTR123456, NEFT/001..." value="'+(rec.payment_ref||'')+'">'+
    '<input type="hidden" id="sal-pay-rid" value="'+recordId+'">';
  document.getElementById('emp-sheet-foot').innerHTML =
    '<button class="btn btn-outline" onclick="closeEmpSheet()">Cancel</button>'+
    (already?'<button class="btn" style="background:#E65100;color:white;" onclick="salClearPayment()">Clear Payment</button>':'')+
    '<button class="btn" style="background:#1B5E20;color:white;" onclick="salSavePayment()">\u2714 Mark Paid</button>';
  openEmpSheet();
}

async function salSavePayment(){
  var rid   = (document.getElementById('sal-pay-rid')||{}).value||'';
  var date  = (document.getElementById('sal-pay-date')||{}).value||'';
  var ref   = (document.getElementById('sal-pay-ref')||{}).value||'';
  if(!rid||!date){toast('Payment date required','warning');return;}
  try{
    await sbUpdate('salary_records', rid, {payment_date:date, payment_ref:ref||null});
    var rec = SALARY_RECORDS.find(function(r){return r.id===rid;});
    if(rec){rec.payment_date=date; rec.payment_ref=ref||null;}
    toast('Payment recorded!','success');
    closeEmpSheet();
    empRender();
  }catch(e){toast('Error: '+e.message,'error');}
}

async function salClearPayment(){
  var rid = (document.getElementById('sal-pay-rid')||{}).value||'';
  if(!rid||!confirm('Clear payment record for this employee?')) return;
  try{
    await sbUpdate('salary_records', rid, {payment_date:null, payment_ref:null});
    var rec = SALARY_RECORDS.find(function(r){return r.id===rid;});
    if(rec){rec.payment_date=null; rec.payment_ref=null;}
    toast('Payment cleared','info');
    closeEmpSheet();
    empRender();
  }catch(e){toast('Error: '+e.message,'error');}
}

// ── Rewrite empSalaryHTML log section with payment tracking ──────────────
function salBuildLogSection(logMap, logKeys){
  if(!logKeys.length) return '';

  return '<div style="background:white;border-radius:14px;padding:12px 14px;margin-top:16px;">'+
    '<div style="font-size:12px;font-weight:800;color:#1565C0;margin-bottom:10px;">&#128196; Finalised Salary Log</div>'+
    logKeys.map(function(key){
      var g = logMap[key];
      var paid   = g.records.filter(function(r){return r.payment_date;});
      var unpaid = g.records.filter(function(r){return !r.payment_date;});
      var paidTotal   = paid.reduce(function(s,r){return s+Number(r.net_payable||0);},0);
      var unpaidTotal = unpaid.reduce(function(s,r){return s+Number(r.net_payable||0);},0);
      var allPaid = unpaid.length===0;

      return '<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:8px;overflow:hidden;">'+

        // Month header row
        '<div onclick="salToggleLog(\'sal-log-'+key+'\')" style="padding:10px 14px;display:flex;align-items:center;gap:8px;cursor:pointer;background:#F8FAFC;">'+
          '<div style="flex:1;min-width:0;">'+
            '<div style="font-size:13px;font-weight:800;">'+g.label+'</div>'+
            '<div style="font-size:11px;color:var(--text3);">'+
              g.records.length+' employees &bull; Total &#8377;'+Number(g.total).toLocaleString('en-IN')+
            '</div>'+
          '</div>'+
          // Payment status pill
          '<div style="flex-shrink:0;">'+
            (allPaid
              ? '<span style="background:#E8F5E9;color:#1B5E20;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:800;">&#10003; All Paid</span>'
              : '<span style="background:#FFF3E0;color:#E65100;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:800;">'+
                  unpaid.length+' Pending</span>'
            )+
          '</div>'+
          '<div style="display:flex;gap:5px;align-items:center;flex-shrink:0;">'+
            '<button data-sal-pdf-month="'+g.month+'" data-sal-pdf-year="'+g.year+'" data-sal-pdf-label="'+g.label+'" style="background:#C62828;color:white;border:none;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:800;cursor:pointer;" onclick="event.stopPropagation()">&#128196; PDF</button>'+
            '<button data-sal-xls-month="'+g.month+'" data-sal-xls-year="'+g.year+'" data-sal-xls-label="'+g.label+'" style="background:#2E7D32;color:white;border:none;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:800;cursor:pointer;" onclick="event.stopPropagation()">&#128202; Excel</button>'+
            '<button data-sal-del-month="'+g.month+'" data-sal-del-year="'+g.year+'" data-sal-del-label="'+g.label+'" style="background:#FEE2E2;color:#C62828;border:none;border-radius:6px;padding:4px 6px;font-size:10px;font-weight:800;cursor:pointer;" onclick="event.stopPropagation()">&#128465;</button>'+
            '<span id="sal-arr-'+key+'" style="font-size:18px;color:var(--text3);">&#8250;</span>'+
          '</div>'+
        '</div>'+

        // Expanded detail
        '<div id="sal-log-'+key+'" style="display:none;">'+

          // Payment summary bar
          (paid.length||unpaid.length?
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #F0F4F8;">'+
              '<div style="padding:8px 12px;background:#E8F5E9;border-right:1px solid #F0F4F8;text-align:center;">'+
                '<div style="font-size:10px;font-weight:800;color:#1B5E20;">&#10003; Paid ('+paid.length+')</div>'+
                '<div style="font-size:13px;font-weight:900;color:#1B5E20;">&#8377;'+Number(paidTotal).toLocaleString('en-IN')+'</div>'+
              '</div>'+
              '<div style="padding:8px 12px;background:#FFF3E0;text-align:center;">'+
                '<div style="font-size:10px;font-weight:800;color:#E65100;">&#9679; Pending ('+unpaid.length+')</div>'+
                '<div style="font-size:13px;font-weight:900;color:#E65100;">&#8377;'+Number(unpaidTotal).toLocaleString('en-IN')+'</div>'+
              '</div>'+
            '</div>'
          :'')+

          // Employee table
          '<div style="overflow-x:auto;">'+
          '<table style="width:100%;border-collapse:collapse;font-size:11px;">'+
            '<thead><tr style="background:#F8FFF8;border-bottom:1px solid #E0E0E0;">'+
              '<th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--text3);text-transform:uppercase;white-space:nowrap;">Employee</th>'+
              '<th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text3);">Days</th>'+
              '<th style="padding:6px 8px;text-align:right;font-size:10px;color:var(--text3);">Net Pay</th>'+
              '<th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text3);">Payment</th>'+
              '<th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text3);">Action</th>'+
            '</tr></thead>'+
            '<tbody>'+
              g.records.map(function(r){
                var isPaid = !!r.payment_date;
                return '<tr style="border-bottom:1px solid #F5F5F5;background:'+(isPaid?'#FAFFFE':'white')+';">'+
                  '<td style="padding:7px 8px;font-weight:700;">'+r.employee_name+
                    '<div style="font-size:10px;color:var(--text3);">'+r.employee_code+'</div>'+
                  '</td>'+
                  '<td style="padding:7px 8px;text-align:center;">'+r.days_worked+'d'+
                    (26-r.days_worked>0?' ('+( 26-r.days_worked)+'L)':'')+
                    (r.ot_hours?'+'+r.ot_hours+'h':'')+
                  '</td>'+
                  '<td style="padding:7px 8px;text-align:right;font-weight:900;color:#1B5E20;">&#8377;'+Number(r.net_payable||0).toLocaleString('en-IN')+'</td>'+
                  '<td style="padding:7px 8px;text-align:center;">'+
                    (isPaid
                      ? '<div style="font-size:10px;color:#1B5E20;font-weight:700;">'+fmtDate(r.payment_date)+'</div>'+
                        (r.payment_ref?'<div style="font-size:9px;color:var(--text3);">'+r.payment_ref+'</div>':'')
                      : '<span style="font-size:10px;color:#E65100;font-weight:700;">Pending</span>'
                    )+
                  '</td>'+
                  '<td style="padding:7px 8px;text-align:center;white-space:nowrap;">'+
                    '<button data-sal-pay-rid="'+r.id+'" data-sal-pay-name="'+r.employee_name+'" data-sal-pay-amt="'+r.net_payable+'" '+
                      'style="background:'+(isPaid?'#E8F5E9':'#1B5E20')+';color:'+(isPaid?'#1B5E20':'white')+';border:none;border-radius:5px;padding:3px 8px;font-size:10px;font-weight:800;cursor:pointer;margin-right:3px;">'+
                      (isPaid?'&#9998; Edit':'&#128176; Pay')+
                    '</button>'+
                    (isPaid?
                      '<button data-sal-slip-eid="'+r.employee_id+'" data-sal-slip-rid="'+r.id+'" style="background:#1565C0;color:white;border:none;border-radius:5px;padding:3px 8px;font-size:10px;font-weight:800;cursor:pointer;">Slip</button>'
                    : '<span style="font-size:10px;color:var(--text3);">Pay first</span>')+
                  '</td>'+
                '</tr>';
              }).join('')+
              '<tr style="border-top:2px solid #1B5E20;background:#F8FFF8;">'+
                '<td colspan="2" style="padding:8px;font-size:11px;font-weight:800;color:#1B5E20;">Total</td>'+
                '<td style="padding:8px;text-align:right;font-size:13px;font-weight:900;color:#1B5E20;">&#8377;'+Number(g.total).toLocaleString('en-IN')+'</td>'+
                '<td colspan="2" style="padding:8px;font-size:10px;color:'+(allPaid?'#1B5E20':'#E65100')+';font-weight:700;text-align:center;">'+
                  (allPaid?'&#10003; Fully Paid':paid.length+'/'+g.records.length+' paid')+
                '</td>'+
              '</tr>'+
            '</tbody>'+
          '</table>'+
          '</div>'+
        '</div>'+
      '</div>';
    }).join('')+
  '</div>';
}
// ════════════════════════════════════════════════════════════════════════
// ANNUAL SALARY STATEMENT TAB
// ════════════════════════════════════════════════════════════════════════

async function empAnnualHTMLAsync(){
  // Always reload salary records from DB to get all FYs
  await salLoadRecords();

  var now = new Date();
  var curFYStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1;
  var curFYEnd   = curFYStart + 1;

  // Only show FYs that have actual salary records
  var fySet = {};
  SALARY_RECORDS.forEach(function(r){
    var fy = r.month >= 4 ? r.year : r.year - 1;
    fySet[fy] = true;
  });
  var fyList = Object.keys(fySet).map(Number).sort().reverse();

  var fyOpts = fyList.length
    ? fyList.map(function(fy){
        var label = 'FY '+fy+'-'+(fy+1).toString().slice(-2);
        var sel = (fy === curFYStart) ? ' selected' : '';
        return '<option value="'+fy+'"'+sel+'>'+label+'</option>';
      }).join('')
    : '<option value="">— No salary records found —</option>';

  var html =
    '<div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;">'+
    '<div style="font-size:12px;font-weight:800;color:#1565C0;margin-bottom:10px;">&#128200; Annual Salary Statement</div>'+
    '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin-bottom:10px;">'+
      '<div>'+
        '<label class="flbl">Financial Year</label>'+
        '<select id="ann-fy" class="fsel" onchange="annToggleDates()">'+
          fyOpts+
          '<option value="custom">&#128197; Custom Date Range</option>'+
        '</select>'+
      '</div>'+
      '<button onclick="annGenerate()" style="padding:10px 16px;background:#1565C0;color:white;border:none;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;">&#128200; Generate</button>'+
    '</div>'+
    '<div id="ann-custom" style="display:none;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">'+
      '<div><label class="flbl">From Date</label><input id="ann-from" class="finp" type="date" value="'+curFYStart+'-04-01"></div>'+
      '<div><label class="flbl">To Date</label><input id="ann-to" class="finp" type="date" value="'+curFYEnd+'-03-31"></div>'+
    '</div>'+
    '</div>'+
    '<div id="ann-results">'+
      '<div style="text-align:center;padding:40px;color:var(--text3);">'+
        '<div style="font-size:36px;margin-bottom:10px;">&#128200;</div>'+
        '<div style="font-weight:700;">Select a period and click Generate</div>'+
        '<div style="font-size:11px;margin-top:6px;">'+fyList.length+' financial year(s) with data found</div>'+
      '</div>'+
    '</div>';

  var el = document.getElementById('emp-content');
  if(el) el.innerHTML = html;
}

function empAnnualHTML(){
  var el = document.getElementById('emp-content');
  if(el) el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">&#9203; Loading salary data...</div>';
  empAnnualHTMLAsync();
  return ''; // content set async above
}

function annToggleDates(){
  var fy = (document.getElementById('ann-fy')||{}).value||'';
  var custom = document.getElementById('ann-custom');
  if(custom) custom.style.display = (fy==='custom') ? 'grid' : 'none';
}

async function annGenerate(){
  var fy = (document.getElementById('ann-fy')||{}).value||'';
  var fromDate, toDate, label;

  // Always reload salary records to ensure fresh data
  if(!SALARY_RECORDS.length){
    toast('Loading salary data...','info');
    await salLoadRecords();
  }

  if(fy==='custom'){
    fromDate = (document.getElementById('ann-from')||{}).value||'';
    toDate   = (document.getElementById('ann-to')||{}).value||'';
    if(!fromDate||!toDate){toast('Select from and to dates','warning');return;}
    label = fromDate+' to '+toDate;
    var from = new Date(fromDate), to = new Date(toDate);
    var filtered = SALARY_RECORDS.filter(function(r){
      var d = new Date(r.year+'-'+String(r.month).padStart(2,'0')+'-01');
      return d >= from && d <= to;
    });
    annBuildStatement(filtered, label);
  } else {
    var fyYear = parseInt(fy);
    label = 'FY '+fyYear+'-'+(fyYear+1).toString().slice(-2)+' (Apr '+fyYear+' \u2013 Mar '+(fyYear+1)+')';
    var filtered = SALARY_RECORDS.filter(function(r){
      if(r.month >= 4 && r.year === fyYear) return true;
      if(r.month <= 3 && r.year === fyYear+1) return true;
      return false;
    });
    annBuildStatement(filtered, label);
  }
}

function annBuildStatement(records, periodLabel){
  var el = document.getElementById('ann-results');
  if(!el) return;

  if(!records.length){
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3);background:white;border-radius:12px;">No salary records found for this period.</div>';
    return;
  }

  // Aggregate by employee
  var empMap = {};
  records.forEach(function(r){
    var key = r.employee_id||r.employee_name;
    if(!empMap[key]){
      // Get pay structure for component breakdown
      var pay = EMP_PAY.filter(function(p){return p.employee_id===r.employee_id;})
                       .sort(function(a,b){return b.effective_date.localeCompare(a.effective_date);})[0]||{};
      var extraEarnings=[];try{extraEarnings=pay.extra_earnings?JSON.parse(pay.extra_earnings):[];}catch(ex){}

      empMap[key]={
        id:r.employee_id, name:r.employee_name, code:r.employee_code||'—',
        desig:r.designation||'—', dept:r.department||'—',
        months:0, days:0, ot:0,
        basic:0, extra:{}, ot_pay:0, gross:0,
        pf:0, esic:0, tds:0, pt:0, adv:0,
        total_ded:0, net:0,
        pay:pay, extraEarnings:extraEarnings
      };
    }
    var e = empMap[key];
    e.months++;
    e.days   += Number(r.days_worked||0);
    e.ot     += Number(r.ot_hours||0);
    e.basic  += Number(r.basic||0);
    e.ot_pay += Number(r.ot_pay||0);
    e.gross  += Number(r.gross||0);
    e.pf     += Number(r.pf_employee||0);
    e.esic   += Number(r.esic_employee||0);
    e.tds    += Number(r.tds||0);
    e.pt     += Number(r.profession_tax||0);
    e.adv    += Number(r.advance_deduct||0);
    e.net    += Number(r.net_payable||0);

    // Compute allowance components from pay structure, pro-rated by days
    var days = Number(r.days_worked||26);
    var ratio = days/26;
    var gross = Number(r.gross||0);
    var basic = Number(r.basic||0);

    if(e.extraEarnings.length){
      e.extraEarnings.forEach(function(ex){
        var amt = ex.pct>0 ? Math.round(basic*ex.pct/100*ratio) : Math.round((ex.amount||0)*ratio);
        e.extra[ex.label] = (e.extra[ex.label]||0) + amt;
      });
    } else {
      var p = e.pay;
      if(p.da)                e.extra['DA']               = (e.extra['DA']||0)               + Math.round((p.da||0)*ratio);
      if(p.hra)               e.extra['HRA']              = (e.extra['HRA']||0)              + Math.round((p.hra||0)*ratio);
      if(p.conveyance)        e.extra['Conveyance']       = (e.extra['Conveyance']||0)       + Math.round((p.conveyance||0)*ratio);
      if(p.special_allowance) e.extra['Special Allowance']= (e.extra['Special Allowance']||0)+ Math.round((p.special_allowance||0)*ratio);
      if(p.medical_allowance) e.extra['Medical Allowance']= (e.extra['Medical Allowance']||0)+ Math.round((p.medical_allowance||0)*ratio);
      if(p.other_allowance)   e.extra['Other Allowance']  = (e.extra['Other Allowance']||0)  + Math.round((p.other_allowance||0)*ratio);
    }
    e.total_ded = e.pf + e.esic + e.tds + e.pt + e.adv;
  });

  var empList = Object.values(empMap).sort(function(a,b){return a.name.localeCompare(b.name);});

  // Collect all unique earning components across all employees
  var allComponents = {};
  empList.forEach(function(e){ Object.keys(e.extra).forEach(function(k){ allComponents[k]=true; }); });
  var compKeys = Object.keys(allComponents);

  // Store for download
  window._annData = {empList:empList, compKeys:compKeys, label:periodLabel};

  // Build totals row
  var totals = {basic:0, ot_pay:0, gross:0, pf:0, esic:0, tds:0, pt:0, adv:0, total_ded:0, net:0, extra:{}};
  compKeys.forEach(function(k){totals.extra[k]=0;});
  empList.forEach(function(e){
    totals.basic+=e.basic; totals.ot_pay+=e.ot_pay; totals.gross+=e.gross;
    totals.pf+=e.pf; totals.esic+=e.esic; totals.tds+=e.tds; totals.pt+=e.pt;
    totals.adv+=e.adv; totals.total_ded+=e.total_ded; totals.net+=e.net;
    compKeys.forEach(function(k){ totals.extra[k]=(totals.extra[k]||0)+(e.extra[k]||0); });
  });

  function inr(n){ return '\u20b9'+Number(n||0).toLocaleString('en-IN'); }
  function th(txt,right){
    return '<th style="padding:7px 8px;font-size:9px;font-weight:800;color:var(--text3);text-transform:uppercase;white-space:nowrap;text-align:'+(right?'right':'left')+';">'+txt+'</th>';
  }
  function td(val,bold,color){
    return '<td style="padding:6px 8px;font-size:11px;text-align:right;white-space:nowrap;'+(bold?'font-weight:800;':'')+( color?'color:'+color+';':'')+'">'+(typeof val==='number'?inr(val):val)+'</td>';
  }

  var thead = '<tr style="background:#F8FAFC;border-bottom:2px solid #E0E0E0;">'+
    th('#')+th('Employee')+th('Code')+th('Dept')+
    // Earnings
    th('Basic',true)+
    compKeys.map(function(k){return th(k,true);}).join('')+
    (empList.some(function(e){return e.ot_pay>0;})?th('OT Pay',true):'')+
    '<th style="padding:7px 8px;font-size:9px;font-weight:800;color:#2E7D32;text-align:right;white-space:nowrap;background:#E8F5E9;">Gross</th>'+
    // Deductions
    th('PF',true)+th('ESIC',true)+th('TDS',true)+th('Prof Tax',true)+th('Advance',true)+
    '<th style="padding:7px 8px;font-size:9px;font-weight:800;color:#C62828;text-align:right;white-space:nowrap;background:#FFEBEE;">Total Ded.</th>'+
    // Net
    '<th style="padding:7px 8px;font-size:9px;font-weight:800;color:#1B5E20;text-align:right;white-space:nowrap;background:#E8F5E9;">Net Salary</th>'+
  '</tr>';

  var hasOT = empList.some(function(e){return e.ot_pay>0;});

  var tbody = empList.map(function(e,i){
    return '<tr style="border-bottom:1px solid #F5F5F5;'+(i%2===0?'':'background:#FAFAFA')+'">'+
      '<td style="padding:6px 8px;font-size:11px;">'+( i+1)+'</td>'+
      '<td style="padding:6px 8px;font-size:11px;font-weight:700;white-space:nowrap;">'+e.name+'<div style="font-size:9px;color:var(--text3);">'+e.desig+'</div></td>'+
      '<td style="padding:6px 8px;font-size:10px;color:var(--text3);">'+e.code+'</td>'+
      '<td style="padding:6px 8px;font-size:10px;color:var(--text3);white-space:nowrap;">'+e.dept+'</td>'+
      td(e.basic)+
      compKeys.map(function(k){return td(e.extra[k]||0);}).join('')+
      (hasOT?td(e.ot_pay):'')+
      '<td style="padding:6px 8px;font-size:11px;text-align:right;font-weight:800;color:#2E7D32;background:#F1FBF4;white-space:nowrap;">'+inr(e.gross)+'</td>'+
      td(e.pf,'','#C62828')+td(e.esic,'','#C62828')+td(e.tds,'','#E65100')+td(e.pt,'','#880E4F')+td(e.adv,'','#C62828')+
      '<td style="padding:6px 8px;font-size:11px;text-align:right;font-weight:800;color:#C62828;background:#FFF5F5;white-space:nowrap;">'+inr(e.total_ded)+'</td>'+
      '<td style="padding:6px 8px;font-size:12px;text-align:right;font-weight:900;color:#1B5E20;background:#F1FBF4;white-space:nowrap;">'+inr(e.net)+'</td>'+
    '</tr>';
  }).join('');

  var tfoot = '<tr style="border-top:2px solid #1B5E20;background:#E8F5E9;font-weight:900;">'+
    '<td colspan="4" style="padding:8px;font-size:11px;font-weight:800;color:#1B5E20;">TOTAL ('+empList.length+' employees)</td>'+
    '<td style="padding:8px;text-align:right;font-size:11px;font-weight:900;">'+inr(totals.basic)+'</td>'+
    compKeys.map(function(k){return '<td style="padding:8px;text-align:right;font-size:11px;font-weight:900;">'+inr(totals.extra[k]||0)+'</td>';}).join('')+
    (hasOT?'<td style="padding:8px;text-align:right;font-size:11px;font-weight:900;">'+inr(totals.ot_pay)+'</td>':'')+
    '<td style="padding:8px;text-align:right;font-size:12px;font-weight:900;color:#2E7D32;">'+inr(totals.gross)+'</td>'+
    '<td style="padding:8px;text-align:right;font-size:11px;font-weight:900;">'+inr(totals.pf)+'</td>'+
    '<td style="padding:8px;text-align:right;font-size:11px;font-weight:900;">'+inr(totals.esic)+'</td>'+
    '<td style="padding:8px;text-align:right;font-size:11px;font-weight:900;">'+inr(totals.tds)+'</td>'+
    '<td style="padding:8px;text-align:right;font-size:11px;font-weight:900;">'+inr(totals.pt)+'</td>'+
    '<td style="padding:8px;text-align:right;font-size:11px;font-weight:900;">'+inr(totals.adv)+'</td>'+
    '<td style="padding:8px;text-align:right;font-size:12px;font-weight:900;color:#C62828;">'+inr(totals.total_ded)+'</td>'+
    '<td style="padding:8px;text-align:right;font-size:13px;font-weight:900;color:#1B5E20;">'+inr(totals.net)+'</td>'+
  '</tr>';

  el.innerHTML =
    '<div style="background:white;border-radius:14px;overflow:hidden;">'+
      '<div style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);">'+
        '<div>'+
          '<div style="font-size:13px;font-weight:800;">Annual Statement — '+periodLabel+'</div>'+
          '<div style="font-size:11px;color:var(--text3);">'+empList.length+' employees &bull; Total Payroll: '+inr(totals.net)+'</div>'+
        '</div>'+
        '<div style="display:flex;gap:6px;">'+
          '<button onclick="annDownloadExcel()" style="background:#2E7D32;color:white;border:none;border-radius:8px;padding:7px 12px;font-size:11px;font-weight:800;cursor:pointer;">&#128202; Excel</button>'+
          '<button onclick="annDownloadPDF()" style="background:#C62828;color:white;border:none;border-radius:8px;padding:7px 12px;font-size:11px;font-weight:800;cursor:pointer;">&#128196; PDF</button>'+
        '</div>'+
      '</div>'+
      '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">'+
        '<table style="width:100%;border-collapse:collapse;min-width:800px;">'+
          '<thead>'+thead+'</thead>'+
          '<tbody>'+tbody+'</tbody>'+
          '<tfoot>'+tfoot+'</tfoot>'+
        '</table>'+
      '</div>'+
    '</div>';
}

function annDownloadExcel(){
  var data = window._annData;
  if(!data||!data.empList){toast('Generate statement first','warning');return;}
  var empList=data.empList, compKeys=data.compKeys, label=data.label;
  var compName = typeof coName==='function'?coName():'AIPL';

  var header = ['Sr No','Employee Name','Employee Code','Designation','Department',
    'Basic Salary'].concat(compKeys);
  if(empList.some(function(e){return e.ot_pay>0;})) header.push('OT Pay');
  header = header.concat(['Gross Salary','PF (Employee)','ESIC (Employee)','TDS','Profession Tax','Advance Deduction','Total Deductions','Net Salary']);

  var lines = [
    [compName],
    ['Annual Salary Statement — '+label],
    [''],
    header
  ];

  empList.forEach(function(e,i){
    var row = [i+1, e.name, e.code, e.desig, e.dept, e.basic];
    compKeys.forEach(function(k){ row.push(e.extra[k]||0); });
    if(empList.some(function(x){return x.ot_pay>0;})) row.push(e.ot_pay);
    row = row.concat([e.gross, e.pf, e.esic, e.tds, e.pt, e.adv, e.total_ded, e.net]);
    lines.push(row);
  });

  // Totals row
  var totals = ['','','','','TOTAL', empList.reduce(function(s,e){return s+e.basic;},0)];
  compKeys.forEach(function(k){ totals.push(empList.reduce(function(s,e){return s+(e.extra[k]||0);},0)); });
  if(empList.some(function(e){return e.ot_pay>0;})) totals.push(empList.reduce(function(s,e){return s+e.ot_pay;},0));
  totals = totals.concat([
    empList.reduce(function(s,e){return s+e.gross;},0),
    empList.reduce(function(s,e){return s+e.pf;},0),
    empList.reduce(function(s,e){return s+e.esic;},0),
    empList.reduce(function(s,e){return s+e.tds;},0),
    empList.reduce(function(s,e){return s+e.pt;},0),
    empList.reduce(function(s,e){return s+e.adv;},0),
    empList.reduce(function(s,e){return s+e.total_ded;},0),
    empList.reduce(function(s,e){return s+e.net;},0)
  ]);
  lines.push(totals);

  var csv = lines.map(function(row){
    return row.map(function(cell){
      var s = String(cell==null?'':cell);
      if(s.indexOf(',')>-1||s.indexOf('"')>-1) s='"'+s.replace(/"/g,'""')+'"';
      return s;
    }).join(',');
  }).join('\n');

  var blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Annual_Statement_'+label.replace(/[^a-z0-9]/gi,'_')+'.csv';
  a.click();
  toast('Excel downloaded','success');
}

function annDownloadPDF(){
  var data = window._annData;
  if(!data||!data.empList){toast('Generate statement first','warning');return;}
  var empList=data.empList, compKeys=data.compKeys, label=data.label;
  var compName  = typeof coName==='function'?coName():'AIPL';
  var compAddr  = typeof coAddr==='function'?coAddr():'';
  var compGST   = typeof coGST==='function'?coGST():'';
  var today     = fmtDate(new Date());
  var hasOT     = empList.some(function(e){return e.ot_pay>0;});

  function inr(n){ return '\u20b9'+Number(n||0).toLocaleString('en-IN'); }

  var totals = {basic:0,ot_pay:0,gross:0,pf:0,esic:0,tds:0,pt:0,adv:0,total_ded:0,net:0,extra:{}};
  compKeys.forEach(function(k){totals.extra[k]=0;});
  empList.forEach(function(e){
    totals.basic+=e.basic; totals.ot_pay+=e.ot_pay; totals.gross+=e.gross;
    totals.pf+=e.pf; totals.esic+=e.esic; totals.tds+=e.tds; totals.pt+=e.pt;
    totals.adv+=e.adv; totals.total_ded+=e.total_ded; totals.net+=e.net;
    compKeys.forEach(function(k){ totals.extra[k]=(totals.extra[k]||0)+(e.extra[k]||0); });
  });

  var th2 = function(t,grn,red){
    return '<th style="padding:5px 6px;font-size:8px;font-weight:700;white-space:nowrap;text-align:right;'+(grn?'color:#1B5E20;background:#E8F5E9;':red?'color:#C62828;background:#FFEBEE;':'color:#555;')+'">'+t+'</th>';
  };
  var td2 = function(v,grn,red,bold){
    return '<td style="padding:5px 6px;font-size:9px;text-align:right;white-space:nowrap;'+(bold?'font-weight:700;':'')+(grn?'color:#1B5E20;background:#F5FFF5;':red?'color:#C62828;':'')+'">'+inr(v)+'</td>';
  };

  var thead = '<tr style="background:#F5F5F5;border-bottom:2px solid #1B5E20;">'+
    '<th style="padding:5px 6px;font-size:8px;font-weight:700;text-align:left;white-space:nowrap;">#</th>'+
    '<th style="padding:5px 6px;font-size:8px;font-weight:700;text-align:left;white-space:nowrap;">Employee</th>'+
    '<th style="padding:5px 6px;font-size:8px;font-weight:700;text-align:left;white-space:nowrap;">Dept</th>'+
    th2('Basic')+
    compKeys.map(function(k){return th2(k);}).join('')+
    (hasOT?th2('OT Pay'):'')+
    th2('Gross',true)+
    th2('PF','',true)+th2('ESIC','',true)+th2('TDS','',true)+th2('Prof Tax','',true)+th2('Advance','',true)+
    th2('Total Ded','',true)+
    th2('Net Salary',true)+
  '</tr>';

  var tbody = empList.map(function(e,i){
    return '<tr style="border-bottom:1px solid #F0F0F0;background:'+(i%2===0?'white':'#FAFAFA')+'">'+
      '<td style="padding:5px 6px;font-size:9px;">'+( i+1)+'</td>'+
      '<td style="padding:5px 6px;font-size:9px;font-weight:700;white-space:nowrap;">'+e.name+'<div style="font-size:7.5px;color:#888;">'+e.code+'</div></td>'+
      '<td style="padding:5px 6px;font-size:8px;color:#666;white-space:nowrap;">'+e.dept+'</td>'+
      td2(e.basic)+
      compKeys.map(function(k){return td2(e.extra[k]||0);}).join('')+
      (hasOT?td2(e.ot_pay):'')+
      td2(e.gross,true,'',true)+
      td2(e.pf,'',true)+td2(e.esic,'',true)+td2(e.tds,'',true)+td2(e.pt,'',true)+td2(e.adv,'',true)+
      td2(e.total_ded,'',true,true)+
      td2(e.net,true,'',true)+
    '</tr>';
  }).join('');

  var tfoot = '<tr style="border-top:2px solid #1B5E20;background:#E8F5E9;font-weight:800;">'+
    '<td colspan="3" style="padding:6px;font-size:9px;font-weight:800;color:#1B5E20;">TOTAL ('+empList.length+' employees)</td>'+
    '<td style="padding:6px;text-align:right;font-size:9px;font-weight:800;">'+inr(totals.basic)+'</td>'+
    compKeys.map(function(k){return '<td style="padding:6px;text-align:right;font-size:9px;font-weight:800;">'+inr(totals.extra[k]||0)+'</td>';}).join('')+
    (hasOT?'<td style="padding:6px;text-align:right;font-size:9px;font-weight:800;">'+inr(totals.ot_pay)+'</td>':'')+
    '<td style="padding:6px;text-align:right;font-size:10px;font-weight:900;color:#2E7D32;">'+inr(totals.gross)+'</td>'+
    '<td style="padding:6px;text-align:right;font-size:9px;font-weight:800;">'+inr(totals.pf)+'</td>'+
    '<td style="padding:6px;text-align:right;font-size:9px;font-weight:800;">'+inr(totals.esic)+'</td>'+
    '<td style="padding:6px;text-align:right;font-size:9px;font-weight:800;">'+inr(totals.tds)+'</td>'+
    '<td style="padding:6px;text-align:right;font-size:9px;font-weight:800;">'+inr(totals.pt)+'</td>'+
    '<td style="padding:6px;text-align:right;font-size:9px;font-weight:800;">'+inr(totals.adv)+'</td>'+
    '<td style="padding:6px;text-align:right;font-size:10px;font-weight:900;color:#C62828;">'+inr(totals.total_ded)+'</td>'+
    '<td style="padding:6px;text-align:right;font-size:11px;font-weight:900;color:#1B5E20;">'+inr(totals.net)+'</td>'+
  '</tr>';

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Annual Statement - '+label+'</title>'+
    '<style>'+
    'body{font-family:Arial,sans-serif;font-size:10px;color:#222;margin:0;padding:16px;}'+
    '.hdr{text-align:center;border-bottom:3px double #1B5E20;padding-bottom:10px;margin-bottom:14px;}'+
    '.logo{font-size:16px;font-weight:900;color:#1B5E20;}.sub{font-size:9px;color:#555;margin-top:2px;}'+
    'table{width:100%;border-collapse:collapse;}'+
    '.meta{display:flex;justify-content:space-between;margin-bottom:10px;font-size:9px;}'+
    '@media print{@page{size:A3 landscape;margin:8mm;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}'+
    '</style></head><body>'+
    '<div class="hdr"><div class="logo">'+compName+'</div>'+(compAddr?'<div class="sub">'+compAddr+'</div>':'')+(compGST?'<div class="sub">GSTIN: '+compGST+'</div>':'')+'</div>'+
    '<div class="meta"><b>Annual Salary Statement &mdash; '+label+'</b><span>Generated: '+today+'</span></div>'+
    '<table><thead>'+thead+'</thead><tbody>'+tbody+'</tbody><tfoot>'+tfoot+'</tfoot></table>'+
    '<p style="font-size:8px;color:#888;text-align:center;margin-top:10px;border-top:1px solid #eee;padding-top:6px;">'+compName+' | Annual Salary Statement | Generated on '+today+'</p>'+
    '<script>window.onload=function(){window.print();}<\/script>'+
    '</body></html>';

  var w = window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else{toast('Allow popups to download PDF','warning');}
}
