// ═══════════════════════════════════════════
// FINANCE.JS — Petty Cash & Accounts
// ═══════════════════════════════════════════

// ── PETTY CASH ────────────────────────────────────────────
var PC_IN=[], PC_EXP=[], PC_EMPS=[], PC_PROJS=[], PC_ACTIVE=null, PC_CAT='all';
var PC_SITE_TAB='all';
var PC_EMP_FILTER='all'; // 'all' or empId

var PC_CATS=['Fuel & Transport','Site Materials','Labour Wages','Food & Refreshment','Office Expenses','Equipment Repair','Safety Items','Utilities','Medical','Miscellaneous'];

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

  // Filter data by selected employee
  var pcInF  = PC_EMP_FILTER==='all' ? PC_IN  : PC_IN.filter(function(i){return i.emp_id===PC_EMP_FILTER;});
  var pcExpF = PC_EMP_FILTER==='all' ? PC_EXP : PC_EXP.filter(function(e){return e.emp_id===PC_EMP_FILTER;});
  var totalIn=pcInF.reduce(function(s,i){return s+(parseFloat(i.amount)||0);},0);
  var totalOut=pcExpF.reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
  var balance=totalIn-totalOut;

  // Employee dropdown options
  var empOpts='<option value="all">All Employees</option>'+
    PC_EMPS.filter(function(e){
      return PC_IN.some(function(i){return i.emp_id===e.empId||i.emp_id===e.id;})||
             PC_EXP.some(function(x){return x.emp_id===e.empId||x.emp_id===e.id;});
    }).map(function(e){
      return '<option value="'+e.empId+'"'+(PC_EMP_FILTER===e.empId?' selected':'')+'>'+e.name+'</option>';
    }).join('');

  var html=
    // Employee filter dropdown
    '<div style="background:white;border-radius:12px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;">'+
      '<label style="font-size:11px;font-weight:800;color:var(--navy);white-space:nowrap;">&#128101; Employee</label>'+
      '<select onchange="pcSetEmpFilter(this.value)" style="flex:1;border:1.5px solid var(--navy);border-radius:8px;padding:7px 10px;font-size:13px;font-weight:700;font-family:Nunito,sans-serif;color:var(--navy);outline:none;cursor:pointer;">'+
        empOpts+
      '</select>'+
      (PC_EMP_FILTER!=='all'?'<button onclick="pcSetEmpFilter(\'all\')" style="font-size:10px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:#F8FAFC;cursor:pointer;font-weight:700;">&#10005; Clear</button>':'')+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">'+
      '<div class="card" style="text-align:center;background:linear-gradient(135deg,#1B5E20,#2E7D32);border:none;">'+
        '<div style="font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.5px;">Total Funded</div>'+
        '<div style="font-size:20px;font-weight:900;color:white;margin-top:4px;">'+pcFmt(totalIn)+'</div></div>'+
      '<div class="card" style="text-align:center;background:linear-gradient(135deg,#B71C1C,#C62828);border:none;">'+
        '<div style="font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.5px;">Total Spent</div>'+
        '<div style="font-size:20px;font-weight:900;color:white;margin-top:4px;">'+pcFmt(totalOut)+'</div></div>'+
      '<div class="card" style="text-align:center;background:linear-gradient(135deg,#0D2137,#1A3A5C);border:none;">'+
        '<div style="font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.5px;">Balance</div>'+
        '<div style="font-size:20px;font-weight:900;color:'+(balance>=0?'#81C784':'#EF9A9A')+';margin-top:4px;">'+pcFmt(balance)+'</div></div>'+
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
  return '<div id="pc-tab-bar" style="display:flex;gap:4px;background:white;border:1px solid var(--border);border-radius:10px;padding:4px;margin-bottom:10px;width:fit-content;">'+
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
    return '<button onclick="pcFilterSite(\''+p+'\')" style="padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:'+(PC_SITE_TAB===p?'var(--navy)':'white')+';color:'+(PC_SITE_TAB===p?'white':'var(--text2)')+';font-family:Nunito;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">'+p+'</button>';
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
    return '<div style="background:white;border-radius:12px;border:1px solid var(--border);padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--shadow);">'+
      '<div style="display:flex;align-items:center;gap:10px;">'+
        '<div style="width:36px;height:36px;border-radius:10px;background:'+col+'20;display:flex;align-items:center;justify-content:center;font-size:16px;">'+(isIn?'💰':'🧾')+'</div>'+
        '<div>'+
          '<div style="font-size:13px;font-weight:800;">'+(item.category||item.description||'Entry')+'</div>'+
          '<div style="font-size:11px;color:var(--text3);">'+(pcEmpName(item.emp_id))+(item.project?' · '+item.project:'')+(item.date?' · '+fmtDate(item.date):'')+'</div>'+
        '</div>'+
      '</div>'+
      '<div style="text-align:right;">'+
        '<div style="font-size:15px;font-weight:900;color:'+col+';">'+(isIn?'+':'-')+pcFmt(item.amount)+'</div>'+
        '<button onclick="pcDeleteEntry(\''+item.id+'\',\''+(isIn?'in':'exp')+'\')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:0 4px;" title="Delete">&#215;</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

function pcOpenCashIn(){
  openSheet('ov-pc','sh-pc');
  document.getElementById('pc-sheet-body').innerHTML=
    '<div style="font-size:15px;font-weight:800;margin-bottom:14px;">Fund Employee</div>'+
    '<label class="flbl">Employee *</label><select class="fsel" id="pci-emp"><option value="">Select employee...</option>'+
      PC_EMPS.map(function(e){return '<option value="'+e.empId+'">'+e.name+(e.dept?' ('+e.dept+')':'')+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Amount (₹) *</label><input class="finp" id="pci-amount" type="number" placeholder="0">'+
    '<label class="flbl">Project</label><select class="fsel" id="pci-proj"><option value="">All Projects</option>'+PC_PROJS.map(function(p){return '<option value="'+p.name+'">'+p.name+'</option>';}).join('')+'</select>'+
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
  try{
    var today=new Date().toISOString().slice(0,10);
    var res=await sbInsert('petty_cash_in',{emp_id:emp,amount:amount,date:today,project:gv('pci-proj')||'All Projects',purpose:gv('pci-purpose'),remarks:gv('pci-remarks')});
    closeSheet('ov-pc','sh-pc');await initPettyCash();toast('Employee funded: '+pcFmt(amount),'success');

    // Auto-post to Accounts: Dr Petty Cash in Hand, Cr Bank
    if(res&&res[0]&&typeof accAutoPost==='function'){
      var empName=(PC_EMPS.find(function(x){return x.empId===emp;})||{}).name||emp;
      accAutoPost({type:'Contra', date:today, partyName:empName,
        debitCode:'1101', creditCode:'1002', amount:amount,
        narration:'Petty cash funded to '+empName+(gv('pci-purpose')?' — '+gv('pci-purpose'):''),
        sourceType:'petty_cash_in', sourceId:res[0].id});
    }
  }catch(e){toast('Error: '+e.message,'error');}
}

function pcOpenExpense(){
  openSheet('ov-pc','sh-pc');
  var projChecks=PC_PROJS.map(function(p){
    return '<label style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #F0F0F0;font-size:12.5px;font-weight:600;cursor:pointer;">'+
      '<input type="checkbox" class="pce-proj-chk" value="'+p.id+'" data-name="'+(p.name||'').replace(/"/g,'&quot;')+'" data-contract="'+(parseFloat(p.contract_value)||0)+'" style="width:16px;height:16px;" onchange="pcUpdateAllocPreview()">'+
      (p.name||'Unnamed')+
    '</label>';
  }).join('')||'<div style="font-size:11px;color:var(--text3);padding:6px 0;">No projects found</div>';
  document.getElementById('pc-sheet-body').innerHTML=
    '<div style="font-size:15px;font-weight:800;margin-bottom:14px;">Record Expense</div>'+
    '<label class="flbl">Employee *</label><select class="fsel" id="pce-emp"><option value="">Select employee...</option>'+
      PC_EMPS.map(function(e){return '<option value="'+e.empId+'">'+e.name+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Category *</label><select class="fsel" id="pce-cat"><option value="">Select...</option>'+
      PC_CATS.map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Amount (₹) *</label><input class="finp" id="pce-amount" type="number" placeholder="0" oninput="pcUpdateAllocPreview()">'+
    '<label class="flbl">Date</label><input class="finp" id="pce-date" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<label class="flbl">Project(s) *</label>'+
    '<div style="font-size:10.5px;color:var(--text3);margin-bottom:4px;">Select one or more projects this expense should be recorded against.</div>'+
    '<div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px 10px;margin-bottom:10px;">'+projChecks+'</div>'+
    '<div id="pce-dist-wrap" style="display:none;margin-bottom:10px;">'+
      '<label class="flbl">Distribute Expense Across Projects</label>'+
      '<div style="display:flex;gap:8px;margin-bottom:8px;">'+
        '<label style="flex:1;display:flex;align-items:center;gap:6px;background:#F8FAFC;border:1.5px solid var(--border);border-radius:8px;padding:8px 10px;font-size:11.5px;font-weight:700;cursor:pointer;">'+
          '<input type="radio" name="pce-dist" value="equal" checked onchange="pcUpdateAllocPreview()">Equal Split</label>'+
        '<label style="flex:1;display:flex;align-items:center;gap:6px;background:#F8FAFC;border:1.5px solid var(--border);border-radius:8px;padding:8px 10px;font-size:11.5px;font-weight:700;cursor:pointer;">'+
          '<input type="radio" name="pce-dist" value="contract" onchange="pcUpdateAllocPreview()">By Contract Value Ratio</label>'+
      '</div>'+
      '<div id="pce-alloc-preview" style="background:#F3E5F5;border-radius:8px;padding:8px 10px;font-size:11px;"></div>'+
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
  try{
    var res=await sbInsert('petty_cash_expenses',{
      emp_id:emp,category:cat,amount:amount,date:gv('pce-date'),
      project:allocations.map(function(p){return p.name;}).join(', '),
      project_ids:JSON.stringify(allocations.map(function(p){return p.id;})),
      project_allocations:JSON.stringify(allocations),
      distribution_method:allocations.length>1?method:null,
      description:desc,bill_no:gv('pce-bill'),remarks:gv('pce-remarks')
    });
    closeSheet('ov-pc','sh-pc');await initPettyCash();toast('Expense recorded: '+pcFmt(amount),'success');

    // Auto-post to Accounts: Dr [Category Expense], Cr Petty Cash in Hand
    if(res&&res[0]&&typeof accAutoPost==='function'&&typeof ACC_PETTY_CAT_CODES!=='undefined'){
      accAutoPost({type:'Journal', date:gv('pce-date'), partyName:desc,
        debitCode:ACC_PETTY_CAT_CODES[cat]||'4110', creditCode:'1101', amount:amount,
        narration:'Petty cash — '+cat+' — '+desc, sourceType:'petty_cash_expense', sourceId:res[0].id});
    }
  }catch(e){toast('Error: '+e.message,'error');}
}

async function pcDeleteEntry(id,type){
  if(!confirm('Delete this entry?'))return;
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
