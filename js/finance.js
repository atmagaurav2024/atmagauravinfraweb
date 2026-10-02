// ═══════════════════════════════════════════
// FINANCE.JS — Petty Cash & Accounts
// ═══════════════════════════════════════════

// ── PETTY CASH ────────────────────────────────────────────
var PC_IN=[], PC_EXP=[], PC_EMPS=[], PC_PROJS=[], PC_ACTIVE=null, PC_CAT='all';
var PC_SITE_TAB='all';
var PC_EMP_FILTER='all'; // 'all' or empId

// Holds the in-progress "Scan & Pay" expense (see dashScanAndPay below)
// between the moment the person is sent to their UPI app and the
// moment they come back to confirm the UTR — nothing is saved to the
// database until that confirmation, so a plain JS variable is enough.
var PC_PENDING_PAY=null;
var PC_PAYOUT_BADGE={
  pending:   ['#FEF3C7','#B45309','⏳ Tap to add UTR'],
  processing:['#DBEAFE','#1D4ED8','⏳ Processing'],
  success:   ['#D1FAE5','#047857','✓ Paid via UPI'],
  failed:    ['#FFE4E6','#E11D48','✕ Payout failed']
};

// Seed list only — live categories come from the Master Registry via
// pcCats(), so a new head can be added without a code change.
var PC_CATS=['Fuel & Transport','Site Materials','Labour Wages','Food & Refreshment','Office Expenses','Equipment Repair','Safety Items','Utilities','Medical','Miscellaneous'];
function pcCats(){
  if(typeof CAT_DATA!=='undefined' && CAT_DATA && Array.isArray(CAT_DATA.pettycash)){
    var live=CAT_DATA.pettycash.filter(function(c){return c.active;}).map(function(c){return c.name;});
    if(live.length) return live;
  }
  return PC_CATS;
}

async function initPettyCash(){
  var cont=document.getElementById('pc-main');if(!cont)return;
  cont.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">⏳ Loading...</div>';
  try{
    var[cashIn,expenses,emps,projs]=await Promise.all([
      sbFetch('petty_cash_in',{select:'*',order:'created_at.desc'}),
      sbFetch('petty_cash_expenses',{select:'*',order:'date.desc'}),
      sbFetch('employees',{select:'id,emp_id,first_name,last_name,department',filter:'status=eq.active',order:'first_name.asc'}),
      sbFetch('projects',{select:'id,name,contract_value',order:'name.asc'}),
    ]);
    PC_IN=Array.isArray(cashIn)?cashIn:[];
    PC_EXP=Array.isArray(expenses)?expenses:[];
    PC_EMPS=Array.isArray(emps)?emps.map(function(e){return {id:e.id,empId:e.emp_id,name:((e.first_name||'')+' '+(e.last_name||'')).trim(),dept:e.department||''};}):[];
    PC_PROJS=Array.isArray(projs)?projs:[];
    // Petty cash follows the same project scope as everything else — both
    // the site list and the expense rows, so totals match what is listed.
    if(typeof scopeProjects==='function') PC_PROJS=scopeProjects(PC_PROJS);
    if(typeof scopeRows==='function' && typeof userProjectIds==='function' && userProjectIds()){
      PC_EXP=scopeRows(PC_EXP,{nameField:'project'});
    }
    // Employee Data Visibility ("Self"/"Department"/"All", set per
    // employee or role in Access Control) previously had no effect here —
    // Site Cash Manager fetched and showed every active employee's name
    // and funding/expense records regardless of that setting. Scope the
    // employee list driving the picker/"By Employee" view AND the
    // underlying cash-in/expense rows together, the same way Salary and
    // Attendance already do via empScoped/salScoped, so a "Self Only"
    // employee only ever sees their own petty cash records here.
    if(typeof empScoped==='function' && Array.isArray(emps)){
      var pcAllowedIds={};
      empScoped(emps).forEach(function(e){ pcAllowedIds[e.id]=1; if(e.emp_id) pcAllowedIds[e.emp_id]=1; });
      PC_EMPS=PC_EMPS.filter(function(e){ return pcAllowedIds[e.id]||pcAllowedIds[e.empId]; });
      PC_IN=PC_IN.filter(function(i){ return pcAllowedIds[i.emp_id]; });
      PC_EXP=PC_EXP.filter(function(e){ return pcAllowedIds[e.emp_id]; });
    }
    pcRefresh();
  }catch(e){console.error('initPettyCash:',e);if(cont)cont.innerHTML='<div style="text-align:center;padding:40px;color:var(--red);">Error loading petty cash data</div>';}
}

function pcEmpName(empId){var e=PC_EMPS.find(function(x){return x.empId===empId||x.id===empId;});return e?e.name:empId||'—';}
function pcEmpBal(empId){
  var funded=PC_IN.filter(function(i){return i.emp_id===empId;}).reduce(function(s,i){return s+(i.amount||0);},0);
  var spent=PC_EXP.filter(function(e){return e.emp_id===empId;}).reduce(function(s,e){return s+(e.amount||0);},0);
  return funded-spent;
}
function pcFmt(n){return '₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0});}

function pcRefresh(){
  var cont=document.getElementById('pc-main');if(!cont)return;
  // Who is allowed a blanket "see everyone" choice at all — the SAME
  // Employee Data Visibility control Access Control already exposes
  // (emp-data-scope: All/Department/Self). Self/Department-scoped
  // PC_EMPS/PC_IN/PC_EXP only ever hold what that viewer is allowed to
  // see to begin with (initPettyCash already scoped them), so offering a
  // literal "All Employees" choice to them was misleading even though it
  // could never actually surface anyone else's records.
  var pcScope=(typeof getEmpDataScope==='function')?getEmpDataScope():'all';

  // Filter data by selected employee
  var pcInF  = PC_EMP_FILTER==='all' ? PC_IN  : PC_IN.filter(function(i){return i.emp_id===PC_EMP_FILTER;});
  var pcExpF = PC_EMP_FILTER==='all' ? PC_EXP : PC_EXP.filter(function(e){return e.emp_id===PC_EMP_FILTER;});
  var totalIn=pcInF.reduce(function(s,i){return s+(parseFloat(i.amount)||0);},0);
  var totalOut=pcExpF.reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
  var balance=totalIn-totalOut;

  // Employee dropdown options
  var pcPickable=PC_EMPS.filter(function(e){
    return PC_IN.some(function(i){return i.emp_id===e.empId||i.emp_id===e.id;})||
           PC_EXP.some(function(x){return x.emp_id===e.empId||x.emp_id===e.id;});
  });
  var allOptLabel=pcScope==='all'?'All Employees':'All (My Department)';
  var empOpts=(pcScope==='all'||pcPickable.length>1?'<option value="all">'+allOptLabel+'</option>':'')+
    pcPickable.map(function(e){
      return '<option value="'+e.empId+'"'+(PC_EMP_FILTER===e.empId?' selected':'')+'>'+e.name+'</option>';
    }).join('');
  // Nothing to pick between when a Self-scoped viewer can only ever see
  // their own single record — the whole filter bar is just noise then.
  var showEmpFilterBar = pcScope!=='self' && (pcScope==='all' || pcPickable.length>1);

  var html=
    // Employee filter dropdown — admins/"All"-scoped viewers only; see
    // pcScope above. Access Control's Employee Data Visibility setting
    // (per employee or per role) is what grants this.
    (!showEmpFilterBar ? '' :
    '<div style="background:var(--card-bg);border-radius:12px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;">'+
      '<label style="font-size:11px;font-weight:800;color:var(--navy);white-space:nowrap;">&#128101; Employee</label>'+
      '<select onchange="pcSetEmpFilter(this.value)" style="flex:1;border:1.5px solid var(--navy);border-radius:8px;padding:7px 10px;font-size:13px;font-weight:700;font-family:Nunito,sans-serif;color:var(--navy);outline:none;cursor:pointer;">'+
        empOpts+
      '</select>'+
      (PC_EMP_FILTER!=='all'?'<button onclick="pcSetEmpFilter(\'all\')" style="font-size:10px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);cursor:pointer;font-weight:700;">&#10005; Clear</button>':'')+
    '</div>')+
    // grid-template-columns:repeat(3,1fr) alone isn't enough on narrow
    // phone widths: a grid item's default min-width is auto (its content's
    // min-content size), so a wide amount string like pcFmt() can force a
    // column past its 1fr share and push the row wider than the screen
    // instead of shrinking to fit. min-width:0 on each card lets it shrink,
    // and the amount/label get overflow:hidden + ellipsis as a backstop
    // plus smaller, screen-scaled font sizes so three cards reliably sit
    // in one row on a phone.
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:16px;">'+
      '<div class="card" style="text-align:center;background:linear-gradient(135deg,#1B5E20,#2E7D32);border:none;min-width:0;padding:10px 6px;">'+
        '<div style="font-size:9.5px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Total Funded</div>'+
        '<div style="font-size:clamp(13px,4vw,18px);font-weight:900;color:white;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+pcFmt(totalIn)+'</div></div>'+
      '<div class="card" style="text-align:center;background:linear-gradient(135deg,#B71C1C,#C62828);border:none;min-width:0;padding:10px 6px;">'+
        '<div style="font-size:9.5px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Total Spent</div>'+
        '<div style="font-size:clamp(13px,4vw,18px);font-weight:900;color:white;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+pcFmt(totalOut)+'</div></div>'+
      '<div class="card" style="text-align:center;background:linear-gradient(135deg,#0D2137,#1A3A5C);border:none;min-width:0;padding:10px 6px;">'+
        '<div style="font-size:9.5px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Balance</div>'+
        '<div style="font-size:clamp(13px,4vw,18px);font-weight:900;color:'+(balance>=0?'#81C784':'#EF9A9A')+';margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+pcFmt(balance)+'</div></div>'+
    '</div>'+
    '<div style="display:flex;gap:8px;margin-bottom:12px;">'+
      '<button class="btn btn-green" onclick="pcOpenCashIn()">+ Fund Employee</button>'+
      '<button class="btn btn-navy" onclick="pcOpenExpense()">− Record Expense</button>'+
    '</div>'+
    pcRenderTabs()+
    '<div id="pc-list"></div>';
  cont.innerHTML=html;
  pcRenderList();
  pcRenderSiteTabs();
}

function pcRenderTabs(){
  return '<div id="pc-tab-bar" style="display:flex;gap:4px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:4px;margin-bottom:10px;width:fit-content;">'+
    pcRenderTabButtons()+
  '</div>';
}

function pcSwitchTab(tab){
  PC_CAT=tab;
  // Re-render tab bar so active tab gets correct background
  var tabBar=document.getElementById('pc-tab-bar');
  if(tabBar) tabBar.innerHTML=pcRenderTabButtons();
  var list=document.getElementById('pc-list');
  if(list) pcRenderList();
}

function pcRenderTabButtons(){
  return ['all','cash-in','expenses','by-emp'].map(function(t){
    var active=PC_CAT===t;
    return '<button onclick="pcSwitchTab(\''+t+'\')" style="padding:7px 14px;border-radius:6px;border:none;font-family:Nunito;font-size:12px;font-weight:700;cursor:pointer;'+
      'background:'+(active?'var(--navy)':'transparent')+';color:'+(active?'white':'var(--text2)')+';transition:background .2s;">'+
      {all:'All','cash-in':'Cash In',expenses:'Expenses','by-emp':'By Employee'}[t]+'</button>';
  }).join('');
}

function pcRenderSiteTabs(){
  var wrap=document.getElementById('pc-site-tabs');if(!wrap)return;
  var projects=['all'].concat(PC_PROJS.map(function(p){return p.name;}));
  wrap.innerHTML=projects.map(function(p){
    return '<button onclick="pcFilterSite(\''+p+'\')" style="padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:'+(PC_SITE_TAB===p?'var(--navy)':'var(--card-bg)')+';color:'+(PC_SITE_TAB===p?'white':'var(--text2)')+';font-family:Nunito;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">'+p+'</button>';
  }).join('');
}

function pcFilterSite(proj){PC_SITE_TAB=proj;pcRenderSiteTabs();pcRenderList();}

function pcSetEmpFilter(empId){PC_EMP_FILTER=empId;pcRefresh();}

function pcRenderList(){
  var cont=document.getElementById('pc-list');if(!cont)return;
  var tab=PC_CAT;
  if(tab==='by-emp'){
    var allEmpIds;
    if(PC_EMP_FILTER!=='all'){
      allEmpIds=[PC_EMP_FILTER];
    } else {
      allEmpIds=[...new Set([
        ...PC_IN.map(function(i){return i.emp_id;}).filter(Boolean),
        ...PC_EXP.map(function(e){return e.emp_id;}).filter(Boolean)
      ])];
      PC_EMPS.forEach(function(e){if(e.empId&&!allEmpIds.includes(e.empId))allEmpIds.push(e.empId);});
    }

    cont.innerHTML=allEmpIds.map(function(empId){
      var funded=PC_IN.filter(function(i){return i.emp_id===empId;}).reduce(function(s,i){return s+(parseFloat(i.amount)||0);},0);
      var spent=PC_EXP.filter(function(e){return e.emp_id===empId;}).reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
      var bal=funded-spent;
      if(funded===0&&spent===0) return ''; // skip employees with no transactions
      return '<div class="card" style="margin-bottom:8px;">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;">'+
          '<div style="font-weight:800;font-size:13px;">'+pcEmpName(empId)+'</div>'+
          '<div style="font-weight:900;color:'+(bal>=0?'var(--green)':'var(--red)')+';font-size:16px;">'+pcFmt(bal)+'</div>'+
        '</div>'+
        '<div style="display:flex;gap:16px;font-size:11px;color:var(--text3);margin-top:5px;">'+
          '<span style="color:#2E7D32;font-weight:700;">&#8593; Funded: '+pcFmt(funded)+'</span>'+
          '<span style="color:#C62828;font-weight:700;">&#8595; Spent: '+pcFmt(spent)+'</span>'+
          '<span style="color:'+(bal>=0?'#1565C0':'#C62828')+';font-weight:800;">Balance: '+pcFmt(bal)+'</span>'+
        '</div>'+
      '</div>';
    }).filter(Boolean).join('')||'<div style="text-align:center;padding:30px;color:var(--text3);">No transactions yet</div>';
    return;
  }
  var pcInSrc  = PC_EMP_FILTER==='all'?PC_IN :PC_IN.filter(function(i){return i.emp_id===PC_EMP_FILTER;});
  var pcExpSrc = PC_EMP_FILTER==='all'?PC_EXP:PC_EXP.filter(function(e){return e.emp_id===PC_EMP_FILTER;});
  var list=tab==='cash-in'?pcInSrc:tab==='expenses'?pcExpSrc:[...pcInSrc.map(function(i){return Object.assign({},i,{_type:'in'});}),...pcExpSrc.map(function(e){return Object.assign({},e,{_type:'exp'});})];
  list=list.sort(function(a,b){return new Date(b.created_at||b.date||0)-new Date(a.created_at||a.date||0);});
  if(PC_SITE_TAB!=='all')list=list.filter(function(i){return (i.project||'').toLowerCase().includes(PC_SITE_TAB.toLowerCase());});
  if(!list.length){cont.innerHTML='<div style="text-align:center;padding:30px;color:var(--text3);">No records</div>';return;}
  cont.innerHTML=list.slice(0,50).map(function(item){
    var isIn=item._type==='in'||tab==='cash-in';
    var col=isIn?'#2E7D32':'#C62828';
    return '<div style="background:var(--card-bg);border-radius:12px;border:1px solid var(--border);padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--shadow);">'+
      '<div style="display:flex;align-items:center;gap:10px;">'+
        '<div style="width:36px;height:36px;border-radius:10px;background:'+col+'20;display:flex;align-items:center;justify-content:center;font-size:16px;">'+(isIn?'💰':'🧾')+'</div>'+
        '<div>'+
          '<div style="font-size:13px;font-weight:800;color:var(--text);">'+(item.category||item.description||item.purpose||'Entry')+'</div>'+
          '<div style="font-size:11px;color:var(--text3);">'+(pcEmpName(item.emp_id))+((!isIn&&item.project)?' · '+item.project:'')+(item.date?' · '+fmtDate(item.date):'')+'</div>'+
          (isIn&&item.funded_by?'<div style="font-size:10px;color:#1565C0;font-weight:700;">'+(item.funded_by_type==='transfer_out'?'&#8594; to '+pcEmpName(item.funded_by_emp):'&#8592; from '+item.funded_by)+'</div>':'')+
          (!isIn&&item.payout_status&&item.payout_status!=='not_applicable'?(function(){
            var b=PC_PAYOUT_BADGE[item.payout_status]||PC_PAYOUT_BADGE.pending;
            var clickable=item.payout_status==='pending'||item.payout_status==='failed';
            return '<div style="margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'+
              '<span '+(clickable?'onclick="pcAddUtr(\''+item.id+'\')"':'')+' style="font-size:9.5px;font-weight:800;background:'+b[0]+';color:'+b[1]+';padding:2px 8px;border-radius:10px;'+(clickable?'cursor:pointer;':'')+'">'+b[2]+'</span>'+
              (item.payout_utr?'<span style="font-size:9.5px;color:var(--text3);font-weight:700;">UTR '+item.payout_utr+'</span>':'')+
            '</div>';
          })():'')+
        '</div>'+
      '</div>'+
      '<div style="text-align:right;">'+
        '<div style="font-size:15px;font-weight:900;color:'+col+';">'+(isIn?'+':'-')+pcFmt(item.amount)+'</div>'+
        '<button onclick="pcDeleteEntry(\''+item.id+'\',\''+(isIn?'in':'exp')+'\')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:0 4px;" title="Delete">&#215;</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

function pcToggleSrcEmp(){
  var v=(document.getElementById('pci-src')||{}).value;
  var w=document.getElementById('pci-src-emp-wrap');
  if(w) w.style.display=(v==='emp')?'':'none';
}

function pcOpenCashIn(){
  openSheet('ov-pc','sh-pc');
  document.getElementById('pc-sheet-body').innerHTML=
    '<div style="font-size:15px;font-weight:800;margin-bottom:14px;">Fund Employee</div>'+
    '<label class="flbl">Employee *</label><select class="fsel" id="pci-emp"><option value="">Select employee...</option>'+
      PC_EMPS.map(function(e){return '<option value="'+e.empId+'">'+e.name+(e.dept?' ('+e.dept+')':'')+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Amount (₹) *</label><input class="finp" id="pci-amount" type="number" placeholder="0">'+
    '<label class="flbl">Funded By *</label><select class="fsel" id="pci-src" onchange="pcToggleSrcEmp()">'+
      '<option value="bank">Company — Bank</option>'+
      '<option value="cash">Company — Cash in Hand</option>'+
      '<option value="emp">Another Employee (transfer)</option>'+
    '</select>'+
    '<div id="pci-src-emp-wrap" style="display:none;">'+
      '<label class="flbl">Transferred From *</label><select class="fsel" id="pci-src-emp"><option value="">Select employee...</option>'+
        PC_EMPS.map(function(e){return '<option value="'+e.empId+'">'+e.name+(e.dept?' ('+e.dept+')':'')+'</option>';}).join('')+'</select>'+
      '<div style="font-size:10px;color:var(--text3);margin:-6px 0 8px;">The sender\'s petty cash balance will be reduced by the same amount.</div>'+
    '</div>'+
    '<label class="flbl">Date</label><input class="finp" id="pci-date" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<label class="flbl">Purpose</label><input class="finp" id="pci-purpose" placeholder="Purpose of funding">'+
    '<label class="flbl">Remarks</label><input class="finp" id="pci-remarks" placeholder="Remarks">';
  document.getElementById('pc-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeSheet(\'ov-pc\',\'sh-pc\')">Cancel</button>'+
    '<button class="btn btn-green" onclick="pcSaveCashIn()">💰 Fund</button>';
}

async function pcSaveCashIn(){
  var emp=gv('pci-emp'), amount=parseFloat(gv('pci-amount'));
  if(!emp){toast('Select employee','warning');return;}
  if(!amount||amount<=0){toast('Enter valid amount','warning');return;}
  var src=gv('pci-src')||'bank';
  var srcEmp=gv('pci-src-emp');
  if(src==='emp'){
    if(!srcEmp){toast('Select the employee transferring the funds','warning');return;}
    if(srcEmp===emp){toast('Cannot transfer to the same employee','warning');return;}
  }
  var nameOf=function(id){ return (PC_EMPS.find(function(x){return x.empId===id;})||{}).name||id; };
  var empName=nameOf(emp);
  var srcLabel = src==='bank' ? 'Company — Bank' : src==='cash' ? 'Company — Cash in Hand' : nameOf(srcEmp);
  try{
    var when=gv('pci-date')||new Date().toISOString().slice(0,10);
    // No project on funding: money handed to an employee can be spent across
    // any site. Project allocation happens on the expense entry, which already
    // supports splitting one expense across multiple projects.
    var res=await sbInsert('petty_cash_in',{emp_id:emp,amount:amount,date:when,
      project:'All Projects',purpose:gv('pci-purpose'),remarks:gv('pci-remarks'),
      funded_by:srcLabel, funded_by_type:src, funded_by_emp:(src==='emp'?srcEmp:null)});

    // Employee-to-employee transfer: the company's total petty cash is
    // unchanged, so the sender must be debited by the same amount —
    // otherwise the money would appear twice across the two balances.
    if(src==='emp'){
      await sbInsert('petty_cash_in',{emp_id:srcEmp,amount:-amount,date:when,
        project:'All Projects',
        purpose:'Transfer to '+empName+(gv('pci-purpose')?' — '+gv('pci-purpose'):''),
        remarks:gv('pci-remarks'), funded_by:'Transfer out', funded_by_type:'transfer_out', funded_by_emp:emp});
    }

    closeSheet('ov-pc','sh-pc');await initPettyCash();
    toast(src==='emp'?('Transferred '+pcFmt(amount)+' from '+srcLabel+' to '+empName):('Employee funded: '+pcFmt(amount)),'success');

    // GL: Dr Petty Cash in Hand / Cr Bank or Cash. An employee-to-employee
    // transfer moves cash within Petty Cash in Hand, so there is nothing to
    // post at company level — the ledger balance is unchanged.
    if(src!=='emp' && res&&res[0]&&typeof accAutoPost==='function'){
      accAutoPost({type:'Contra', date:when, partyName:empName,
        debitCode:'1101', creditCode:(src==='cash'?'1001':'1002'), amount:amount,
        narration:'Petty cash funded to '+empName+' from '+srcLabel+(gv('pci-purpose')?' — '+gv('pci-purpose'):''),
        sourceType:'petty_cash_in', sourceId:res[0].id});
    }
  }catch(e){toast('Error: '+e.message,'error');}
}

function pcOpenExpense(){
  openSheet('ov-pc','sh-pc');
  var projChecks=PC_PROJS.map(function(p){
    return '<label style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:12.5px;font-weight:600;cursor:pointer;">'+
      '<input type="checkbox" class="pce-proj-chk" value="'+p.id+'" data-name="'+(p.name||'').replace(/"/g,'&quot;')+'" data-contract="'+(parseFloat(p.contract_value)||0)+'" style="width:16px;height:16px;" onchange="pcUpdateAllocPreview()">'+
      (p.name||'Unnamed')+
    '</label>';
  }).join('')||'<div style="font-size:11px;color:var(--text3);padding:6px 0;">No projects found</div>';
  document.getElementById('pc-sheet-body').innerHTML=
    '<div style="font-size:15px;font-weight:800;margin-bottom:14px;">Record Expense</div>'+
    '<label class="flbl">Employee *</label><select class="fsel" id="pce-emp"><option value="">Select employee...</option>'+
      PC_EMPS.map(function(e){return '<option value="'+e.empId+'">'+e.name+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Category *</label><select class="fsel" id="pce-cat"><option value="">Select...</option>'+
      pcCats().map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Amount (₹) *</label><input class="finp" id="pce-amount" type="number" placeholder="0" oninput="pcUpdateAllocPreview()">'+
    '<label class="flbl">Date</label><input class="finp" id="pce-date" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<label class="flbl">Payment Method</label>'+
    '<div style="display:flex;gap:8px;margin-bottom:10px;">'+
      '<label style="flex:1;display:flex;align-items:center;gap:6px;background:var(--bg);color:var(--text);border:1.5px solid var(--border);border-radius:8px;padding:8px 10px;font-size:11.5px;font-weight:700;cursor:pointer;">'+
        '<input type="radio" name="pce-paymethod" value="cash" checked onchange="pcTogglePayMethod()">Cash</label>'+
      '<label style="flex:1;display:flex;align-items:center;gap:6px;background:var(--bg);color:var(--text);border:1.5px solid var(--border);border-radius:8px;padding:8px 10px;font-size:11.5px;font-weight:700;cursor:pointer;">'+
        '<input type="radio" name="pce-paymethod" value="upi" onchange="pcTogglePayMethod()">UPI</label>'+
    '</div>'+
    '<div id="pce-upi-wrap" style="display:none;margin-bottom:10px;">'+
      '<label class="flbl">Pay To</label>'+
      '<button type="button" onclick="pcOpenQRScanner()" style="width:100%;background:var(--navy);color:white;border:none;border-radius:8px;padding:10px;font-size:12px;font-weight:800;cursor:pointer;margin-bottom:8px;">&#128247; Scan UPI QR Code</button>'+
      '<div id="pce-upi-scanned" style="display:none;background:#E8F5E9;border:1px solid #A5D6A7;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:11.5px;color:#2E7D32;font-weight:700;"></div>'+
      '<div style="font-size:10.5px;color:var(--text3);margin:2px 0 4px;">or type UPI ID / mobile number directly</div>'+
      '<input class="finp" id="pce-upi-id" placeholder="vendor@upi or 9876543210" oninput="pcClearScannedUPI()">'+
      '<input class="finp" id="pce-upi-name" placeholder="Payee name (optional)" style="margin-top:8px;">'+
    '</div>'+
    '<label class="flbl">Project(s) *</label>'+
    '<div style="font-size:10.5px;color:var(--text3);margin-bottom:4px;">Select one or more projects this expense should be recorded against.</div>'+
    '<div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px 10px;margin-bottom:10px;">'+projChecks+'</div>'+
    '<div id="pce-dist-wrap" style="display:none;margin-bottom:10px;">'+
      '<label class="flbl">Distribute Expense Across Projects</label>'+
      '<div style="display:flex;gap:8px;margin-bottom:8px;">'+
        '<label style="flex:1;display:flex;align-items:center;gap:6px;background:var(--bg);color:var(--text);border:1.5px solid var(--border);border-radius:8px;padding:8px 10px;font-size:11.5px;font-weight:700;cursor:pointer;">'+
          '<input type="radio" name="pce-dist" value="equal" checked onchange="pcUpdateAllocPreview()">Equal Split</label>'+
        '<label style="flex:1;display:flex;align-items:center;gap:6px;background:var(--bg);color:var(--text);border:1.5px solid var(--border);border-radius:8px;padding:8px 10px;font-size:11.5px;font-weight:700;cursor:pointer;">'+
          '<input type="radio" name="pce-dist" value="contract" onchange="pcUpdateAllocPreview()">By Contract Value Ratio</label>'+
      '</div>'+
      '<div id="pce-alloc-preview" style="background:var(--bg);color:var(--text);border-radius:8px;padding:8px 10px;font-size:11px;"></div>'+
    '</div>'+
    '<label class="flbl">Description *</label><input class="finp" id="pce-desc" placeholder="What was purchased?">'+
    '<label class="flbl">Bill/Receipt No</label><input class="finp" id="pce-bill" placeholder="Receipt number">'+
    '<label class="flbl">Remarks</label><input class="finp" id="pce-remarks" placeholder="Remarks">';
  document.getElementById('pc-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeSheet(\'ov-pc\',\'sh-pc\')">Cancel</button>'+
    '<button class="btn btn-navy" onclick="pcSaveExpense()">🧾 Save</button>';
}

// Compute the per-project split for the currently checked projects + amount,
// using the selected distribution method. Returns [{id,name,amount}, ...].
function pcComputeAllocations(){
  var amount=parseFloat((document.getElementById('pce-amount')||{value:0}).value)||0;
  var method=(document.querySelector('input[name="pce-dist"]:checked')||{value:'equal'}).value;
  var chosen=Array.prototype.slice.call(document.querySelectorAll('.pce-proj-chk:checked')).map(function(chk){
    return {id:chk.value,name:chk.getAttribute('data-name'),contract:parseFloat(chk.getAttribute('data-contract'))||0};
  });
  if(!chosen.length) return [];
  if(chosen.length===1) return [{id:chosen[0].id,name:chosen[0].name,amount:amount}];
  if(method==='contract'){
    var totalContract=chosen.reduce(function(s,p){return s+p.contract;},0);
    if(totalContract>0){
      return chosen.map(function(p){return {id:p.id,name:p.name,amount:Math.round(amount*(p.contract/totalContract)*100)/100};});
    }
    // No contract values available — fall back to equal split
  }
  var share=Math.round((amount/chosen.length)*100)/100;
  return chosen.map(function(p){return {id:p.id,name:p.name,amount:share};});
}

function pcUpdateAllocPreview(){
  var chosenCount=document.querySelectorAll('.pce-proj-chk:checked').length;
  var wrap=document.getElementById('pce-dist-wrap');
  if(!wrap) return;
  wrap.style.display=chosenCount>1?'block':'none';
  if(chosenCount<=1) return;
  var pcFmtLocal=function(n){return '₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0});};
  var allocs=pcComputeAllocations();
  var prev=document.getElementById('pce-alloc-preview');
  if(prev) prev.innerHTML=allocs.map(function(a){
    return '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>'+a.name+'</span><span style="font-weight:800;color:#4A148C;">'+pcFmtLocal(a.amount)+'</span></div>';
  }).join('');
}

async function pcSaveExpense(){
  var emp=gv('pce-emp'), cat=gv('pce-cat'), amount=parseFloat(gv('pce-amount')), desc=gv('pce-desc');
  if(!emp){toast('Select employee','warning');return;}
  if(!cat){toast('Select category','warning');return;}
  if(!amount||amount<=0){toast('Enter valid amount','warning');return;}
  if(!desc){toast('Description required','warning');return;}
  var allocations=pcComputeAllocations();
  if(!allocations.length){toast('Select at least one project','warning');return;}
  var method=(document.querySelector('input[name="pce-dist"]:checked')||{value:'equal'}).value;
  var bal=pcEmpBal(emp);
  if(amount>bal){toast('Insufficient balance. Available: '+pcFmt(bal),'warning');}

  var payMethod=(document.querySelector('input[name="pce-paymethod"]:checked')||{value:'cash'}).value;
  var upiId = payMethod==='upi' ? gv('pce-upi-id') : '';
  if(payMethod==='upi' && !upiId){ toast('Scan a QR code or enter a UPI ID / mobile number','warning'); return; }

  try{
    var res=await sbInsert('petty_cash_expenses',{
      emp_id:emp,category:cat,amount:amount,date:gv('pce-date'),
      project:allocations.map(function(p){return p.name;}).join(', '),
      project_ids:JSON.stringify(allocations.map(function(p){return p.id;})),
      project_allocations:JSON.stringify(allocations),
      distribution_method:allocations.length>1?method:null,
      description:desc,bill_no:gv('pce-bill'),remarks:gv('pce-remarks'),
      payout_status: payMethod==='upi' ? 'pending' : 'not_applicable',
      payee_upi_id: upiId||null,
      payee_name: payMethod==='upi' ? (gv('pce-upi-name')||null) : null
    });
    closeSheet('ov-pc','sh-pc');await initPettyCash();
    if(payMethod==='upi'){
      toast('Expense recorded — initiating UPI payout...','info');
      if(res&&res[0]&&typeof pcInitiateUpiPayout==='function') await pcInitiateUpiPayout(res[0].id);
    } else {
      toast('Expense recorded: '+pcFmt(amount),'success');
    }

    // Auto-post to Accounts: Dr [Category Expense], Cr Petty Cash in Hand
    if(res&&res[0]&&typeof accAutoPost==='function'&&typeof ACC_PETTY_CAT_CODES!=='undefined'){
      // Payment, not Journal: cash genuinely leaves the petty cash float.
      // Journal is for entries where no money moves, such as provisions.
      accAutoPost({type:'Payment', date:gv('pce-date'), partyName:desc,
        debitCode:ACC_PETTY_CAT_CODES[cat]||'4110', creditCode:'1101', amount:amount,
        narration:'Petty cash — '+cat+' — '+desc, sourceType:'petty_cash_expense', sourceId:res[0].id});
    }
  }catch(e){toast('Error: '+e.message,'error');}
}

// ── SCAN & PAY (dashboard QR button) ───────────────────────
// Lets someone scan a vendor's UPI QR straight from the dashboard,
// pay them from their own phone's UPI app (no RazorpayX account
// needed — that's the separate automatic-payout flow above), and
// record the petty cash expense with the UTR once they're back.
// Opens the normal "Record Expense" sheet, preselects UPI, and swaps
// its Save button for the pay-then-confirm flow below.
async function dashScanAndPay(){
  if(typeof showApp==='function') showApp('petty-cash');
  try{ await initPettyCash(); }catch(e){}
  if(typeof pcOpenExpense!=='function') return;
  pcOpenExpense();
  var upiRadio=document.querySelector('input[name="pce-paymethod"][value="upi"]');
  if(upiRadio) upiRadio.checked=true;
  if(typeof pcTogglePayMethod==='function') pcTogglePayMethod();
  var foot=document.getElementById('pc-sheet-foot');
  if(foot) foot.innerHTML=
    '<button class="btn btn-outline" onclick="closeSheet(\'ov-pc\',\'sh-pc\')">Cancel</button>'+
    '<button class="btn btn-navy" onclick="pcPayAndSave()">&#128241; Pay &amp; Save</button>';
  if(typeof pcOpenQRScanner==='function') pcOpenQRScanner();
}

// Validates the form exactly like pcSaveExpense, then shows the
// pay-manually-and-confirm screen (see pcShowUtrConfirm). Nothing is
// saved yet; that happens once the UTR step is confirmed, so a payment
// that never happens never creates a stray expense record.
function pcPayAndSave(){
  var emp=gv('pce-emp'), cat=gv('pce-cat'), amount=parseFloat(gv('pce-amount')), desc=gv('pce-desc');
  if(!emp){toast('Select employee','warning');return;}
  if(!cat){toast('Select category','warning');return;}
  if(!amount||amount<=0){toast('Enter valid amount','warning');return;}
  if(!desc){toast('Description required','warning');return;}
  var allocations=pcComputeAllocations();
  if(!allocations.length){toast('Select at least one project','warning');return;}
  var dist=(document.querySelector('input[name="pce-dist"]:checked')||{value:'equal'}).value;
  var upiId=gv('pce-upi-id');
  if(!upiId){toast('Scan a QR code or enter a UPI ID / mobile number','warning');return;}
  var bal=pcEmpBal(emp);
  if(amount>bal){toast('Insufficient balance. Available: '+pcFmt(bal),'warning');}

  PC_PENDING_PAY={
    emp:emp, cat:cat, amount:amount, desc:desc, allocations:allocations, method:dist,
    date:gv('pce-date'), bill:gv('pce-bill'), remarks:gv('pce-remarks'),
    upiId:upiId, payeeName:gv('pce-upi-name')||''
  };

  // Goes straight to the manual pay-and-confirm screen rather than
  // trying a upi://pay deep link first. That was tried three ways
  // (full prefill, with a transaction reference, amount left for the
  // person to type themselves) and every version got the same "declined
  // for security reasons" response from the UPI app — strong evidence
  // this isn't about which parameters the link carries at all, but that
  // UPI apps don't treat a browser-triggered payment intent as a
  // trusted source in the first place (matches Google's own UPI-for-web
  // docs: a plain upi://pay link isn't the sanctioned integration route
  // without being a verified NPCI merchant). Opening a specific app is
  // still offered from the confirm screen as a secondary "worth a try"
  // option, since it may still work in less strict apps.
  pcShowUtrConfirm();
}

// Scheme prefixes for each app's own UPI deep link, each followed by
// the same ?pa=&pn=&am=&cu=INR&tn= query string built in pcLaunchUpiApp.
// "Other UPI App" falls back to the generic upi://pay scheme, which
// still works standalone (e.g. for apps not listed here) and is where
// the OS's own picker — if the phone shows one — takes over.
var PC_UPI_APPS=[
  {label:'Google Pay', icon:'Ⓘ', scheme:'gpay://upi/pay'},
  {label:'PhonePe',    icon:'📱', scheme:'phonepe://pay'},
  {label:'Paytm',      icon:'💠', scheme:'paytmmp://pay'},
  {label:'BHIM',       icon:'🇮🇳', scheme:'bhim://pay'},
  {label:'Other UPI App', icon:'🏦', scheme:'upi://pay'}
];

function pcShowUpiAppChooser(){
  var p=PC_PENDING_PAY; if(!p) return;
  var title=document.getElementById('pc-sheet-title'); if(title) title.textContent='Try a UPI App';
  var body=document.getElementById('pc-sheet-body');
  var foot=document.getElementById('pc-sheet-foot');
  if(!body||!foot) return;
  body.innerHTML=
    '<div style="text-align:center;padding:4px 0 14px;">'+
      '<div style="font-size:15px;font-weight:800;margin-bottom:4px;">Pay '+pcFmt(p.amount)+' to '+(p.payeeName||p.upiId)+'</div>'+
      '<div style="font-size:12px;color:var(--text3);">These often get blocked (see previous screen) but are worth a try — pick an app</div>'+
    '</div>'+
    PC_UPI_APPS.map(function(a,i){
      return '<button type="button" onclick="pcOpenChosenUpiApp('+i+')" style="width:100%;display:flex;align-items:center;gap:10px;background:var(--bg);color:var(--text);border:1.5px solid var(--border);border-radius:10px;padding:12px 14px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;">'+
        '<span style="font-size:18px;">'+a.icon+'</span>'+a.label+
      '</button>';
    }).join('');
  foot.innerHTML='<button class="btn btn-outline" onclick="pcShowUtrConfirm()">Back</button>';
}

function pcOpenChosenUpiApp(i){
  var p=PC_PENDING_PAY; if(!p) return;
  var app=PC_UPI_APPS[i]; if(!app) return;
  p.upiScheme=app.scheme;
  pcLaunchUpiApp(p);
  // The tab is about to lose focus to the chosen app; show the
  // confirm-and-enter-UTR step right away so it's waiting when the
  // person comes back (a blocked/failed app launch just leaves this
  // step showing, with a button to try opening the app again).
  pcShowUtrConfirm();
}

// Deliberately omits "am" (amount) and "tr" (transaction reference).
// UPI apps' fraud filters treat a pre-filled-amount request to a
// personal/non-merchant VPA, launched from a website, as the exact
// shape of a fake-invoice scam — that's what was triggering "declined
// for security reasons" even with a valid tr, per Google's own
// developer docs (a raw upi://pay link isn't the sanctioned way to
// collect payment from a website without being a verified NPCI
// merchant). Opening with just who to pay, and letting the amount be
// typed inside the app, reads as an ordinary person-initiated payment
// instead and isn't blocked the same way.
function pcLaunchUpiApp(p){
  var uri=(p.upiScheme||'upi://pay')+'?pa='+encodeURIComponent(p.upiId)+
    '&pn='+encodeURIComponent(p.payeeName||'Vendor')+
    '&cu=INR&tn='+encodeURIComponent((p.desc||'').slice(0,50));
  window.location.href=uri;
}

function pcShowUtrConfirm(){
  var p=PC_PENDING_PAY; if(!p) return;
  var title=document.getElementById('pc-sheet-title'); if(title) title.textContent='Pay & Confirm';
  var body=document.getElementById('pc-sheet-body');
  var foot=document.getElementById('pc-sheet-foot');
  if(!body||!foot) return;
  body.innerHTML=
    '<div style="text-align:center;padding:6px 0 14px;">'+
      '<div style="font-size:15px;font-weight:800;margin-bottom:4px;">Pay '+pcFmt(p.amount)+' to '+(p.payeeName||p.upiId)+'</div>'+
      '<div style="font-size:12px;color:var(--text3);">UPI apps block payment links coming from a website, so open your own UPI app and pay using these details</div>'+
    '</div>'+
    '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:14px;">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">'+
        '<div style="font-size:12.5px;"><span style="color:var(--text3);">Amount</span> <b style="font-size:14px;">'+pcFmt(p.amount)+'</b></div>'+
        '<button type="button" onclick="pcCopyAmount()" style="flex-shrink:0;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;cursor:pointer;color:var(--text);">Copy</button>'+
      '</div>'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">'+
        '<div style="font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><span style="color:var(--text3);">UPI ID</span> <b>'+p.upiId+'</b></div>'+
        '<button type="button" onclick="pcCopyUpiId()" style="flex-shrink:0;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;cursor:pointer;color:var(--text);">Copy</button>'+
      '</div>'+
    '</div>'+
    '<button type="button" onclick="pcShowUpiAppChooser()" style="width:100%;background:none;color:var(--navy);border:1px solid var(--border);border-radius:8px;padding:9px;font-size:11.5px;font-weight:700;cursor:pointer;margin-bottom:14px;">&#128241; Try Opening a UPI App (may not work)</button>'+
    '<label class="flbl">UTR / Transaction Reference No.</label>'+
    '<input class="finp" id="pc-pay-utr" placeholder="e.g. 309812345678" autocomplete="off">'+
    '<div style="font-size:10.5px;color:var(--text3);margin-top:4px;">Find this on your UPI app\'s payment success screen or SMS, after you\'ve paid. No UTR yet? Save now and add it later from the list.</div>';
  foot.innerHTML=
    '<button class="btn btn-outline" onclick="pcCancelPendingPay()">Cancel</button>'+
    '<button class="btn btn-green" onclick="pcConfirmUtrAndSave()">&#10003; Confirm &amp; Save</button>';
}

function pcCopyUpiId(){
  var p=PC_PENDING_PAY; if(!p) return;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(p.upiId)
      .then(function(){ toast('UPI ID copied','success'); })
      .catch(function(){ toast('Could not copy — the UPI ID is '+p.upiId,'warning'); });
  } else {
    toast('Could not copy — the UPI ID is '+p.upiId,'warning');
  }
}

function pcCopyAmount(){
  var p=PC_PENDING_PAY; if(!p) return;
  var val=p.amount.toFixed(2);
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(val)
      .then(function(){ toast('Amount copied','success'); })
      .catch(function(){ toast('Could not copy — the amount is '+pcFmt(p.amount),'warning'); });
  } else {
    toast('Could not copy — the amount is '+pcFmt(p.amount),'warning');
  }
}

function pcCancelPendingPay(){
  PC_PENDING_PAY=null;
  closeSheet('ov-pc','sh-pc');
}

async function pcConfirmUtrAndSave(){
  var p=PC_PENDING_PAY; if(!p) return;
  var utr=gv('pc-pay-utr');
  try{
    var res=await sbInsert('petty_cash_expenses',{
      emp_id:p.emp,category:p.cat,amount:p.amount,date:p.date,
      project:p.allocations.map(function(a){return a.name;}).join(', '),
      project_ids:JSON.stringify(p.allocations.map(function(a){return a.id;})),
      project_allocations:JSON.stringify(p.allocations),
      distribution_method:p.allocations.length>1?p.method:null,
      description:p.desc,bill_no:p.bill,remarks:p.remarks,
      payout_status: utr ? 'success' : 'pending',
      payout_utr: utr||null,
      payee_upi_id:p.upiId, payee_name:p.payeeName||null
    });
    PC_PENDING_PAY=null;
    closeSheet('ov-pc','sh-pc');await initPettyCash();
    toast(utr ? ('Payment confirmed — expense recorded: '+pcFmt(p.amount)) : ('Expense recorded — add the UTR later from the list once you have it'),'success');

    if(res&&res[0]&&typeof accAutoPost==='function'&&typeof ACC_PETTY_CAT_CODES!=='undefined'){
      accAutoPost({type:'Payment', date:p.date, partyName:p.desc,
        debitCode:ACC_PETTY_CAT_CODES[p.cat]||'4110', creditCode:'1101', amount:p.amount,
        narration:'Petty cash — '+p.cat+' — '+p.desc+(utr?' · UPI UTR '+utr:''), sourceType:'petty_cash_expense', sourceId:res[0].id});
    }
  }catch(e){toast('Error: '+e.message,'error');}
}

// Lets a pending (or failed) UPI expense pick up its UTR after the
// fact — used both as the follow-up to "save now, add later" above
// and for entries that came through the automatic RazorpayX payout
// flow if its webhook never reported back.
async function pcAddUtr(id){
  var row=PC_EXP.find(function(e){return e.id===id;});
  if(!row) return;
  var utr=prompt('Enter the UTR / transaction reference number for this payment:', row.payout_utr||'');
  if(utr===null) return;
  utr=utr.trim();
  if(!utr){toast('UTR cannot be empty','warning');return;}
  try{
    await sbUpdate('petty_cash_expenses', id, {payout_status:'success', payout_utr:utr});
    row.payout_status='success'; row.payout_utr=utr;
    pcRenderList();
    toast('UTR saved','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

async function pcDeleteEntry(id,type){
  // Warn if this funding came from a loan — deleting it here leaves the
  // loan itself in place, so the two records would disagree.
  var row=(type==='in'?PC_IN:PC_EXP).find(function(x){return x.id===id;});
  if(row&&row.funded_by_type==='loan'){
    if(!confirm('This funding entry was created automatically from a loan.\n\nDeleting it here removes the petty cash credit but keeps the loan record. To remove both, delete the loan in the Loans module instead.\n\nDelete anyway?'))return;
  } else {
    if(!confirm('Delete this entry?'))return;
  }
  var table=type==='in'?'petty_cash_in':'petty_cash_expenses';
  try{
    await sbDelete(table,id);
    if(typeof accCleanupVouchersForSource==='function')accCleanupVouchersForSource(id);
    if(type==='in')PC_IN=PC_IN.filter(function(i){return i.id!==id;});
    else PC_EXP=PC_EXP.filter(function(e){return e.id!==id;});
    pcRefresh();toast('Deleted','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

// ── ACCOUNTS ──────────────────────────────────────────────
// The Accounts module (initAccounts, accSwitchTab, accDash, accCoa,
// vouchers, Chart of Accounts, auto-posting, backfill, default COA
// seeding, etc.) is defined inline in index.html. It was previously
// duplicated here, and because this file loads AFTER index.html's
// inline scripts, the stale copies here silently overrode every newer
// fix (tab bar rendering, Setup Default Accounts, Backfill from
// History). Do not re-add Accounts functions to this file.
