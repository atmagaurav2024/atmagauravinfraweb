// ═══════════════════════════════════════════
// FINANCE.JS — Petty Cash & Accounts
// ═══════════════════════════════════════════

// ── PETTY CASH ────────────────────────────────────────────
var PC_IN=[], PC_EXP=[], PC_EMPS=[], PC_PROJS=[], PC_ACTIVE=null, PC_CAT='all';
var PC_SITE_TAB='all';

var PC_CATS=['Fuel & Transport','Site Materials','Labour Wages','Food & Refreshment','Office Expenses','Equipment Repair','Safety Items','Utilities','Medical','Miscellaneous'];

async function initPettyCash(){
  var cont=document.getElementById('pc-main');if(!cont)return;
  cont.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">⏳ Loading...</div>';
  try{
    var[cashIn,expenses,emps,projs]=await Promise.all([
      sbFetch('petty_cash_in',{select:'*',order:'created_at.desc'}),
      sbFetch('petty_cash_expenses',{select:'*',order:'date.desc'}),
      sbFetch('employees',{select:'id,emp_id,first_name,last_name,department',filter:'status=eq.active',order:'first_name.asc'}),
      sbFetch('projects',{select:'id,name',order:'name.asc'}),
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
  var totalIn=PC_IN.reduce(function(s,i){return s+(i.amount||0);},0);
  var totalOut=PC_EXP.reduce(function(s,e){return s+(e.amount||0);},0);
  var balance=totalIn-totalOut;
  var html=
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
  return '<div style="display:flex;gap:4px;background:white;border:1px solid var(--border);border-radius:10px;padding:4px;margin-bottom:10px;width:fit-content;">'+
    ['all','cash-in','expenses','by-emp'].map(function(t){
      return '<button onclick="pcSwitchTab(\''+t+'\')" style="padding:7px 14px;border-radius:6px;border:none;font-family:Nunito;font-size:12px;font-weight:700;cursor:pointer;background:'+(PC_CAT===t?'var(--navy)':'transparent')+';color:'+(PC_CAT===t?'white':'var(--text2)')+';">'+
        {all:'All',cashin:'Cash In','cash-in':'Cash In',expenses:'Expenses','by-emp':'By Employee'}[t]+'</button>';
    }).join('')+'</div>';
}

function pcSwitchTab(tab){PC_CAT=tab;var list=document.getElementById('pc-list');if(list)pcRenderList();}

function pcRenderSiteTabs(){
  var wrap=document.getElementById('pc-site-tabs');if(!wrap)return;
  var projects=['all'].concat(PC_PROJS.map(function(p){return p.name;}));
  wrap.innerHTML=projects.map(function(p){
    return '<button onclick="pcFilterSite(\''+p+'\')" style="padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:'+(PC_SITE_TAB===p?'var(--navy)':'white')+';color:'+(PC_SITE_TAB===p?'white':'var(--text2)')+';font-family:Nunito;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">'+p+'</button>';
  }).join('');
}

function pcFilterSite(proj){PC_SITE_TAB=proj;pcRenderList();}

function pcRenderList(){
  var cont=document.getElementById('pc-list');if(!cont)return;
  var tab=PC_CAT;
  if(tab==='by-emp'){
    var empIds=[...new Set(PC_EXP.map(function(e){return e.emp_id;}).filter(Boolean))];
    cont.innerHTML=empIds.map(function(empId){
      var bal=pcEmpBal(empId);
      return '<div class="card">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;">'+
          '<div style="font-weight:800;">'+pcEmpName(empId)+'</div>'+
          '<div style="font-weight:900;color:'+(bal>=0?'var(--green)':'var(--red)')+';font-size:15px;">'+pcFmt(bal)+'</div>'+
        '</div>'+
        '<div style="font-size:11px;color:var(--text3);margin-top:4px;">'+
          'Funded: '+pcFmt(PC_IN.filter(function(i){return i.emp_id===empId;}).reduce(function(s,i){return s+(i.amount||0);},0))+' · '+
          'Spent: '+pcFmt(PC_EXP.filter(function(e){return e.emp_id===empId;}).reduce(function(s,e){return s+(e.amount||0);},0))+
        '</div></div>';
    }).join('')||'<div style="text-align:center;padding:30px;color:var(--text3);">No data</div>';
    return;
  }
  var list=tab==='cash-in'?PC_IN:tab==='expenses'?PC_EXP:[...PC_IN.map(function(i){return Object.assign({},i,{_type:'in'});}),...PC_EXP.map(function(e){return Object.assign({},e,{_type:'exp'});})];
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
        (currentUser&&(currentUser.role==='admin'||currentUser.role==='pm')?
          '<button onclick="pcDeleteEntry(\''+item.id+'\',\''+(isIn?'in':'exp')+'\')" style="font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:5px;background:transparent;cursor:pointer;color:var(--red);margin-top:3px;">Delete</button>':'') +
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
    await sbInsert('petty_cash_in',{emp_id:emp,amount:amount,project:gv('pci-proj')||'All Projects',purpose:gv('pci-purpose'),remarks:gv('pci-remarks')});
    closeSheet('ov-pc','sh-pc');await initPettyCash();toast('Employee funded: '+pcFmt(amount),'success');
  }catch(e){toast('Error: '+e.message,'error');}
}

function pcOpenExpense(){
  openSheet('ov-pc','sh-pc');
  document.getElementById('pc-sheet-body').innerHTML=
    '<div style="font-size:15px;font-weight:800;margin-bottom:14px;">Record Expense</div>'+
    '<label class="flbl">Employee *</label><select class="fsel" id="pce-emp"><option value="">Select employee...</option>'+
      PC_EMPS.map(function(e){return '<option value="'+e.empId+'">'+e.name+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Category *</label><select class="fsel" id="pce-cat"><option value="">Select...</option>'+
      PC_CATS.map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Amount (₹) *</label><input class="finp" id="pce-amount" type="number" placeholder="0">'+
    '<label class="flbl">Date</label><input class="finp" id="pce-date" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<label class="flbl">Project</label><select class="fsel" id="pce-proj"><option value="">All Projects</option>'+PC_PROJS.map(function(p){return '<option value="'+p.name+'">'+p.name+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Description *</label><input class="finp" id="pce-desc" placeholder="What was purchased?">'+
    '<label class="flbl">Bill/Receipt No</label><input class="finp" id="pce-bill" placeholder="Receipt number">'+
    '<label class="flbl">Remarks</label><input class="finp" id="pce-remarks" placeholder="Remarks">';
  document.getElementById('pc-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeSheet(\'ov-pc\',\'sh-pc\')">Cancel</button>'+
    '<button class="btn btn-navy" onclick="pcSaveExpense()">🧾 Save</button>';
}

async function pcSaveExpense(){
  var emp=gv('pce-emp'), cat=gv('pce-cat'), amount=parseFloat(gv('pce-amount')), desc=gv('pce-desc');
  if(!emp){toast('Select employee','warning');return;}
  if(!cat){toast('Select category','warning');return;}
  if(!amount||amount<=0){toast('Enter valid amount','warning');return;}
  if(!desc){toast('Description required','warning');return;}
  var bal=pcEmpBal(emp);
  if(amount>bal){toast('Insufficient balance. Available: '+pcFmt(bal),'warning');}
  try{
    await sbInsert('petty_cash_expenses',{emp_id:emp,category:cat,amount:amount,date:gv('pce-date'),project:gv('pce-proj')||'All Projects',description:desc,bill_no:gv('pce-bill'),remarks:gv('pce-remarks')});
    closeSheet('ov-pc','sh-pc');await initPettyCash();toast('Expense recorded: '+pcFmt(amount),'success');
  }catch(e){toast('Error: '+e.message,'error');}
}

async function pcDeleteEntry(id,type){
  if(!confirm('Delete this entry?'))return;
  var table=type==='in'?'petty_cash_in':'petty_cash_expenses';
  try{
    await sbDelete(table,id);
    if(type==='in')PC_IN=PC_IN.filter(function(i){return i.id!==id;});
    else PC_EXP=PC_EXP.filter(function(e){return e.id!==id;});
    pcRefresh();toast('Deleted','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

// ── ACCOUNTS ──────────────────────────────────────────────
var ACC_ACCOUNTS=[], ACC_VOUCHERS=[], ACC_VOU_ITEMS=[], ACC_GST=[];
var ACC_PARTY_CACHE={};
var ACC_TAB='dashboard';
var VOU_TYPES=['Payment','Receipt','Journal','Contra','Purchase','Sales'];

async function initAccounts(){
  var cont=document.getElementById('acc-content');if(!cont)return;
  cont.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">⏳ Loading accounts...</div>';
  try{
    var[accounts,vouchers]=await Promise.all([
      sbFetch('chart_of_accounts',{select:'*',order:'code.asc'}),
      sbFetch('vouchers',{select:'*',order:'created_at.desc'}),
    ]);
    ACC_ACCOUNTS=Array.isArray(accounts)?accounts:[];
    ACC_VOUCHERS=Array.isArray(vouchers)?vouchers:[];
    avLoadPartyNames();
    accSwitchTab('dashboard');
  }catch(e){console.error('initAccounts:',e);if(cont)cont.innerHTML='<div style="text-align:center;padding:40px;color:var(--red);">Error loading accounts</div>';}
}

function avLoadPartyNames(){
  ACC_PARTY_CACHE={};
  VENDORS.forEach(function(v){ACC_PARTY_CACHE['vendor:'+v.id]=v.name;});
  SUBCONTRACTORS.forEach(function(s){ACC_PARTY_CACHE['sc:'+s.id]=s.name;});
  USERS.forEach(function(u){ACC_PARTY_CACHE['emp:'+u.id]=u.name;});
}

function accSwitchTab(tab){
  ACC_TAB=tab;
  var tabs=document.getElementById('acc-tab-bar');
  if(tabs){
    tabs.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('active',t.dataset.tab===tab);});
  }
  if(tab==='dashboard')accDash();
  if(tab==='entry')accEntry();
  if(tab==='ledger')accLedger();
  if(tab==='reports')accReports();
  if(tab==='gst')accGstTab();
  if(tab==='coa')accCoa();
}

function accDash(){
  var cont=document.getElementById('acc-content');if(!cont)return;
  var totalVouchers=ACC_VOUCHERS.length;
  var totalPayments=ACC_VOUCHERS.filter(function(v){return v.type==='Payment';}).reduce(function(s,v){return s+(v.amount||0);},0);
  var totalReceipts=ACC_VOUCHERS.filter(function(v){return v.type==='Receipt';}).reduce(function(s,v){return s+(v.amount||0);},0);
  cont.innerHTML=
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">'+
      '<div class="card" style="text-align:center;">'+
        '<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">Total Vouchers</div>'+
        '<div style="font-size:24px;font-weight:900;color:var(--navy);margin-top:4px;">'+totalVouchers+'</div></div>'+
      '<div class="card" style="text-align:center;">'+
        '<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">Payments</div>'+
        '<div style="font-size:20px;font-weight:900;color:var(--red);margin-top:4px;">'+fmtINR(totalPayments)+'</div></div>'+
      '<div class="card" style="text-align:center;">'+
        '<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">Receipts</div>'+
        '<div style="font-size:20px;font-weight:900;color:var(--green);margin-top:4px;">'+fmtINR(totalReceipts)+'</div></div>'+
    '</div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'+
      '<div style="font-size:14px;font-weight:800;">Recent Vouchers</div>'+
      '<button class="btn btn-navy btn-sm" onclick="accOpenVoucher()">+ Voucher</button></div>'+
    (!ACC_VOUCHERS.length?'<div style="text-align:center;padding:30px;color:var(--text3);">No vouchers yet</div>':
    '<div class="table-card"><table class="att-table"><thead><tr><th>Vou No</th><th>Date</th><th>Type</th><th>Party</th><th>Amount</th><th>Actions</th></tr></thead><tbody>'+
      ACC_VOUCHERS.slice(0,20).map(function(v){
        var typeColors={Payment:'vou-payment',Receipt:'vou-receipt',Purchase:'vou-purchase',Journal:'vou-journal',Contra:'vou-contra',Sales:'vou-receipt'};
        return '<tr><td><strong>'+v.vou_no+'</strong></td><td>'+fmtDate(v.date)+'</td>'+
          '<td><span class="vou-badge '+(typeColors[v.type]||'vou-journal')+'">'+v.type+'</span></td>'+
          '<td>'+(v.party_name||'—')+'</td><td>'+fmtINR(v.amount||0)+'</td>'+
          '<td><button class="btn btn-sm" onclick="accViewVoucher(\''+v.id+'\')">👁</button> '+
          '<button class="btn btn-sm btn-red" onclick="accDelVoucher(\''+v.id+'\')">🗑</button></td></tr>';
      }).join('')+'</tbody></table></div>');
}

function accEntry(){
  var cont=document.getElementById('acc-content');if(!cont)return;
  cont.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'+
    '<div style="font-size:16px;font-weight:800;">Voucher Entry</div>'+
    '<button class="btn btn-navy" onclick="accOpenVoucher()">+ New Voucher</button></div>'+
    '<div style="text-align:center;padding:40px;color:var(--text3);">Select a voucher type above to begin entry</div>';
}

function accLedger(){
  var cont=document.getElementById('acc-content');if(!cont)return;
  cont.innerHTML='<div style="font-size:16px;font-weight:800;margin-bottom:14px;">Account Ledger</div>'+
    '<select class="fsel" style="max-width:300px;margin-bottom:14px;" onchange="accLoadLedger(this.value)">'+
      '<option value="">Select account...</option>'+
      ACC_ACCOUNTS.map(function(a){return '<option value="'+a.id+'">'+a.code+' - '+a.name+'</option>';}).join('')+'</select>'+
    '<div id="ledger-body"><div style="text-align:center;padding:30px;color:var(--text3);">Select account to view ledger</div></div>';
}

function accReports(){
  var cont=document.getElementById('acc-content');if(!cont)return;
  cont.innerHTML='<div style="font-size:16px;font-weight:800;margin-bottom:14px;">Reports</div>'+
    '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">'+
      ['Trial Balance','P&L Statement','Balance Sheet','Cash Flow'].map(function(r){
        return '<div class="card" style="cursor:pointer;text-align:center;padding:20px;">'+
          '<div style="font-size:24px;margin-bottom:8px;">📊</div>'+
          '<div style="font-size:13px;font-weight:800;">'+r+'</div>'+
        '</div>';
      }).join('')+'</div>';
}

function accGstTab(){
  var cont=document.getElementById('acc-content');if(!cont)return;
  cont.innerHTML='<div style="font-size:16px;font-weight:800;margin-bottom:14px;">GST Returns</div>'+
    '<div style="text-align:center;padding:40px;color:var(--text3);">GSTR-1 / GSTR-3B Summary<br><br>Connect to GST portal for filing</div>';
}

function accCoa(){
  var cont=document.getElementById('acc-content');if(!cont)return;
  cont.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'+
    '<div style="font-size:16px;font-weight:800;">Chart of Accounts</div>'+
    '<button class="btn btn-navy" onclick="accNewAccount()">+ Account</button></div>'+
  (!ACC_ACCOUNTS.length?'<div style="text-align:center;padding:30px;color:var(--text3);">No accounts defined yet</div>':
  '<div class="table-card"><table class="att-table"><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Group</th><th>Actions</th></tr></thead><tbody>'+
    ACC_ACCOUNTS.map(function(a){
      return '<tr><td><code>'+a.code+'</code></td><td><strong>'+a.name+'</strong></td><td>'+a.type+'</td><td>'+(a.group||'—')+'</td>'+
        '<td><button class="btn btn-sm btn-navy" onclick="accEditAccount(\''+a.id+'\')">✏</button> '+
        '<button class="btn btn-sm btn-red" onclick="accDelAccount(\''+a.id+'\')">🗑</button></td></tr>';
    }).join('')+'</tbody></table></div>');
}

function accNewAccount(){
  openSheet('ov-acc','sh-acc');
  document.getElementById('acc-sheet-title').textContent='New Account';
  document.getElementById('acc-sheet-body').innerHTML=
    '<label class="flbl">Account Code *</label><input class="finp" id="ac-code" placeholder="e.g. 4001">'+
    '<label class="flbl">Account Name *</label><input class="finp" id="ac-name" placeholder="e.g. Cash on Hand">'+
    '<label class="flbl">Type *</label><select class="fsel" id="ac-type"><option>Asset</option><option>Liability</option><option>Income</option><option>Expense</option><option>Equity</option></select>'+
    '<label class="flbl">Group</label><input class="finp" id="ac-group" placeholder="e.g. Current Assets">'+
    '<label class="flbl">Opening Balance (₹)</label><input class="finp" id="ac-opening" type="number" placeholder="0">';
  var foot=document.getElementById('acc-sheet-foot');if(foot)foot.innerHTML='<button class="btn btn-outline" onclick="closeSheet(\'ov-acc\',\'sh-acc\')">Cancel</button><button class="btn btn-navy" onclick="accSaveAccount()">💾 Save</button>';
}

async function accSaveAccount(editId){
  var code=gv('ac-code'), name=gv('ac-name');
  if(!code||!name){toast('Code and name required','warning');return;}
  var payload={code:code,name:name,type:gv('ac-type'),group:gv('ac-group'),opening_balance:parseFloat(gv('ac-opening'))||0};
  try{
    if(editId){await sbUpdate('chart_of_accounts',editId,payload);}else{await sbInsert('chart_of_accounts',payload);}
    closeSheet('ov-acc','sh-acc');await initAccounts();toast('Account saved','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

function accEditAccount(id){
  var a=ACC_ACCOUNTS.find(function(x){return x.id===id;});if(!a)return;
  accNewAccount();
  document.getElementById('acc-sheet-title').textContent='Edit Account';
  setTimeout(function(){
    var code=document.getElementById('ac-code'),name=document.getElementById('ac-name'),type=document.getElementById('ac-type'),group=document.getElementById('ac-group'),opening=document.getElementById('ac-opening');
    if(code)code.value=a.code||'';if(name)name.value=a.name||'';if(type)type.value=a.type||'Asset';if(group)group.value=a.group||'';if(opening)opening.value=a.opening_balance||0;
    var foot=document.getElementById('acc-sheet-foot');if(foot)foot.innerHTML='<button class="btn btn-outline" onclick="closeSheet(\'ov-acc\',\'sh-acc\')">Cancel</button><button class="btn btn-navy" onclick="accSaveAccount(\''+id+'\')">💾 Save</button>';
  },50);
}

async function accDelAccount(id){
  if(!confirm('Delete this account?'))return;
  try{await sbDelete('chart_of_accounts',id);ACC_ACCOUNTS=ACC_ACCOUNTS.filter(function(a){return a.id!==id;});accCoa();toast('Deleted','success');}
  catch(e){toast('Error','error');}
}

function accOpenVoucher(){
  openSheet('ov-acc','sh-acc');
  document.getElementById('acc-sheet-title').textContent='New Voucher';
  document.getElementById('acc-sheet-body').innerHTML=
    '<label class="flbl">Voucher Type *</label><select class="fsel" id="vou-type">'+VOU_TYPES.map(function(t){return '<option>'+t+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Voucher Date *</label><input class="finp" id="vou-date" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<label class="flbl">Party Name</label><input class="finp" id="vou-party" placeholder="Party / vendor name">'+
    '<label class="flbl">Debit Account</label><select class="fsel" id="vou-debit"><option value="">Select account...</option>'+ACC_ACCOUNTS.map(function(a){return '<option value="'+a.id+'">'+a.code+' - '+a.name+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Credit Account</label><select class="fsel" id="vou-credit"><option value="">Select account...</option>'+ACC_ACCOUNTS.map(function(a){return '<option value="'+a.id+'">'+a.code+' - '+a.name+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Amount (₹) *</label><input class="finp" id="vou-amount" type="number" placeholder="0">'+
    '<label class="flbl">Narration</label><textarea class="ftxt" id="vou-narration" placeholder="Brief narration"></textarea>';
  var foot=document.getElementById('acc-sheet-foot');if(foot)foot.innerHTML='<button class="btn btn-outline" onclick="closeSheet(\'ov-acc\',\'sh-acc\')">Cancel</button><button class="btn btn-navy" onclick="accSaveVoucher()">💾 Save Voucher</button>';
}

async function accSaveVoucher(){
  var amount=parseFloat(gv('vou-amount'));
  if(!amount||amount<=0){toast('Enter valid amount','warning');return;}
  var type=gv('vou-type');
  var prefix={Payment:'PV',Receipt:'RV',Journal:'JV',Contra:'CV',Purchase:'PUR',Sales:'SAL'}[type]||'VOU';
  var vou_no=prefix+'-'+String(Date.now()).slice(-6);
  try{
    await sbInsert('vouchers',{vou_no:vou_no,type:type,date:gv('vou-date'),party_name:gv('vou-party'),debit_account:gv('vou-debit')||null,credit_account:gv('vou-credit')||null,amount:amount,narration:gv('vou-narration')});
    closeSheet('ov-acc','sh-acc');await initAccounts();toast('Voucher saved: '+vou_no,'success');
  }catch(e){toast('Error: '+e.message,'error');}
}

function accViewVoucher(id){
  var v=ACC_VOUCHERS.find(function(x){return x.id===id;});if(!v)return;
  openSheet('ov-acc','sh-acc');
  document.getElementById('acc-sheet-title').textContent='Voucher — '+v.vou_no;
  document.getElementById('acc-sheet-body').innerHTML=
    '<div style="background:#f7fafc;border-radius:12px;padding:14px;margin-bottom:14px;">'+
    ir('Voucher No',v.vou_no,true)+ir('Type','<span class="vou-badge vou-'+v.type.toLowerCase()+'">'+v.type+'</span>')+
    ir('Date',fmtDate(v.date))+ir('Party',v.party_name||'—')+ir('Amount','<strong>'+fmtINR(v.amount||0)+'</strong>')+
    (v.narration?ir('Narration',v.narration):'')+
    '</div>';
  var foot=document.getElementById('acc-sheet-foot');if(foot)foot.innerHTML='<button class="btn btn-outline" onclick="closeSheet(\'ov-acc\',\'sh-acc\')">Close</button><button class="btn btn-red" onclick="accDelVoucher(\''+id+'\')">🗑 Delete</button>';
}

async function accDelVoucher(id){
  if(!confirm('Delete this voucher?'))return;
  try{await sbDelete('vouchers',id);ACC_VOUCHERS=ACC_VOUCHERS.filter(function(v){return v.id!==id;});closeSheet('ov-acc','sh-acc');accDash();toast('Voucher deleted','success');}
  catch(e){toast('Error','error');}
}

function accQuickAdd(){accOpenVoucher();}
