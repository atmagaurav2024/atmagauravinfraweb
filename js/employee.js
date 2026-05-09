// ═══════════════════════════════════════════
// EMPLOYEE.JS — Employee Management
// ═══════════════════════════════════════════

var EMP_LIST=[], EMP_PAY=[], EMP_TAB='active', EMP_EDIT_ID=null;
var EMP_ORDERS=[], SALARY_RECORDS=[];
var PAY_EARNINGS=[], PAY_DEDUCTIONS=[], PAY_EARN_ID=0, PAY_DED_ID=0;

var EMP_DEPTS=['Site','Finance','HR/Admin','QC/Safety','Procurement','Planning','Management','Other'];
var EMP_GRADES=['Grade-1','Grade-2','Grade-3','Grade-4','Grade-5','Manager','Sr. Manager','DGM','GM','Other'];
var EMP_CATS=['Permanent','Contract','Probation','Daily Wage','Consultant'];
var EMP_ROLES=['Admin','Project Manager','Site Engineer','Junior Engineer','QC Engineer','Safety Officer','Finance / Accounts','HR / Admin','Viewer (Read Only)','Surveyor','Store Keeper','Driver','Labour','Other'];

var EMP_TAB_KEYS={active:'emp-active',pending:'emp-pending',pay:'emp-pay',salary:'emp-salary',increment:'emp-increment',transfer:'emp-transfer',annual:'emp-annual',downloads:'emp-downloads',resigned:'emp-resigned'};

function openEmpSheet(){openSheet('ov-emp','sh-emp');}
function closeEmpSheet(){closeSheet('ov-emp','sh-emp');}

async function initEmpMgmt(){
  var el=document.getElementById('emp-content');if(el)el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">⏳ Loading...</div>';
  try{
    var[emps,pays]=await Promise.all([
      sbFetch('employees',{select:'*',order:'created_at.desc'}),
      sbFetch('employee_pay',{select:'*',order:'created_at.desc'}),
    ]);
    EMP_LIST=(Array.isArray(emps)?emps:[]).map(mapEmployee);
    EMP_PAY=Array.isArray(pays)?pays:[];
    if(typeof USERS!=='undefined')USERS=EMP_LIST;
    empRender();
  }catch(e){
    var el=document.getElementById('emp-content');
    if(el)el.innerHTML='<div style="text-align:center;padding:40px;color:var(--red);">Error loading employees</div>';
    console.error(e);
  }
}

function empTab(tab){
  EMP_TAB=tab;
  var bar=document.getElementById('emp-tab-bar');
  if(bar)bar.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('active',t.dataset.tab===tab);});
  empRender();
}

function empTabAllowed(tab){
  if(typeof canAccess==='function'){var key=EMP_TAB_KEYS[tab];return !key||canAccess(key,'view');}return true;
}
function empHideForbiddenTabs(){
  Object.keys(EMP_TAB_KEYS).forEach(function(tab){
    var btn=document.querySelector('[data-tab="'+tab+'"]');
    if(btn)btn.style.display=empTabAllowed(tab)?'':'none';
  });
}

function empRender(){
  var cont=document.getElementById('emp-content');if(!cont)return;
  if(EMP_TAB==='active')cont.innerHTML=empListHTML(EMP_LIST.filter(function(e){return e.status==='active';}));
  else if(EMP_TAB==='pending')cont.innerHTML=empListHTML(EMP_LIST.filter(function(e){return e.status==='pending';}),'pending');
  else if(EMP_TAB==='resigned')cont.innerHTML=empListHTML(EMP_LIST.filter(function(e){return e.status==='inactive'||e.status==='resigned';}),'resigned');
  else if(EMP_TAB==='pay')cont.innerHTML=empPayHTML();
  else if(EMP_TAB==='salary')cont.innerHTML=empSalaryHTML();
  else if(EMP_TAB==='increment')cont.innerHTML=empIncrementHTML();
  else if(EMP_TAB==='transfer')cont.innerHTML=empTransferHTML();
  else if(EMP_TAB==='downloads')cont.innerHTML=empDownloadHTML();
  else cont.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">Coming soon</div>';
}

function empListHTML(list, mode){
  var isAdmin=currentUser&&(currentUser.role==='admin'||currentUser.role==='pm');
  var addBtn=isAdmin&&mode!=='resigned'?'<button class="btn btn-navy" onclick="empOpenForm()">+ Add Employee</button>':'';
  var header='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'+
    '<div style="font-size:15px;font-weight:800;">'+
      (mode==='pending'?'⏳ Pending Approval':mode==='resigned'?'🚪 Resigned':'👥 Active Employees')+
      ' <span style="font-size:13px;color:var(--text3);">('+list.length+')</span></div>'+addBtn+'</div>';
  if(!list.length)return header+'<div style="text-align:center;padding:40px;color:var(--text3);"><div style="font-size:40px;margin-bottom:10px;">'+(mode==='pending'?'✅':'👥')+'</div><div style="font-weight:700;">No '+(mode||'active')+' employees</div></div>';
  return header+list.map(function(emp){
    var col=ROLE_COLORS[emp.role]||'#37474F';
    var initials=(emp.name||'?').split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase();
    return '<div class="card" style="margin-bottom:10px;cursor:pointer;" onclick="empViewDetail(\''+emp.id+'\')">' +
      '<div style="display:flex;align-items:center;gap:12px;">'+
        '<div style="width:48px;height:48px;border-radius:14px;background:'+col+';display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:900;color:white;flex-shrink:0;overflow:hidden;">'+
          (emp.photoUrl?'<img src="'+emp.photoUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">':initials)+'</div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:14px;font-weight:800;">'+emp.name+'</div>'+
          '<div style="font-size:11px;color:var(--text2);margin-top:1px;">'+(emp.access||emp.designation||'—')+' · '+(emp.dept||'—')+'</div>'+
          '<div style="display:flex;gap:6px;margin-top:5px;">'+
            '<span class="badge" style="background:'+col+'20;color:'+col+';border-color:'+col+'40;">'+(emp.empId||'—')+'</span>'+
            '<span class="badge '+(emp.status==='active'?'b-green':emp.status==='pending'?'b-amber':'b-red')+'">'+(emp.status||'—')+'</span>'+
          '</div></div>'+
        '<div style="text-align:right;flex-shrink:0;">'+
          '<div style="font-size:10px;color:var(--text3);">DOJ</div>'+
          '<div style="font-size:11px;font-weight:700;">'+fmtDate(emp.doj||emp.date_of_joining||'—')+'</div>'+
        '</div></div>'+
      (isAdmin?'<div style="display:flex;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">'+
        (mode==='pending'?
          '<button class="btn btn-sm btn-green" onclick="event.stopPropagation();empApprove(\''+emp.id+'\')">✓ Approve</button>'+
          '<button class="btn btn-sm btn-red" onclick="event.stopPropagation();empReject(\''+emp.id+'\')">✗ Reject</button>':
          '<button class="btn btn-sm btn-navy" onclick="event.stopPropagation();empOpenEditForm(\''+emp.id+'\')">✏ Edit</button>'+
          '<button class="btn btn-sm btn-red" onclick="event.stopPropagation();empDeleteEmployee(\''+emp.id+'\',\''+esc(emp.name)+'\')">🗑</button>')+
      '</div>':'')+'</div>';
  }).join('');
}

function empPayHTML(){
  if(!EMP_PAY.length){
    sbFetch('employee_pay',{select:'*',order:'created_at.desc'}).then(function(data){
      EMP_PAY=Array.isArray(data)?data:[];
      var cont=document.getElementById('emp-content');
      if(cont&&EMP_TAB==='pay')cont.innerHTML=empPayHTML();
    }).catch(function(){});
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'+
      '<div style="font-size:15px;font-weight:800;">Pay Structures</div>'+
      '<button class="btn btn-navy" onclick="empOpenPay()">+ Pay Structure</button></div>'+
      '<div style="text-align:center;padding:40px;color:var(--text3);">⏳ Loading pay structures...</div>';
  }
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'+
    '<div style="font-size:15px;font-weight:800;">Pay Structures <span style="font-size:13px;color:var(--text3);">('+EMP_PAY.length+')</span></div>'+
    '<div style="display:flex;gap:6px;"><button class="btn btn-sm btn-outline" onclick="empReloadPay()">🔄 Refresh</button>'+
    '<button class="btn btn-navy" onclick="empOpenPay()">+ Pay Structure</button></div></div>'+
  '<div class="table-card"><table class="att-table"><thead><tr>'+
    '<th>Employee</th><th>Emp ID</th><th>Basic</th><th>HRA</th><th>DA</th><th>Gross</th><th>Net</th><th>Actions</th>'+
  '</tr></thead><tbody>'+
    EMP_PAY.map(function(p){
      var emp=EMP_LIST.find(function(e){return e.id===p.emp_id||e.empId===p.emp_id||e.employee_code===p.emp_id;});
      var earnings=[];try{earnings=JSON.parse(p.earnings||'[]');}catch(ex){}
      var deductions=[];try{deductions=JSON.parse(p.deductions||'[]');}catch(ex){}
      var gross=earnings.length?earnings.reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0):
                (parseFloat(p.gross)||0)||((p.basic||0)+(p.hra||0)+(p.da||0)+(p.conveyance||0)+(p.medical||0)+(p.special||0));
      var ded=deductions.length?deductions.reduce(function(s,d){return s+(parseFloat(d.amount)||0);},0):0;
      var net=gross-ded;
      return '<tr>'+
        '<td><strong>'+(emp?emp.name:(p.emp_name||p.emp_id||'—'))+'</strong></td>'+
        '<td><code style="font-size:11px;">'+(emp?emp.empId||'—':p.emp_id||'—')+'</code></td>'+
        '<td>'+fmtINR(p.basic||0)+'</td>'+
        '<td>'+fmtINR(p.hra||0)+'</td>'+
        '<td>'+fmtINR(p.da||0)+'</td>'+
        '<td>'+fmtINR(gross)+'</td>'+
        '<td><strong style="color:var(--green);">'+fmtINR(net)+'</strong></td>'+
        '<td><button class="btn btn-sm btn-navy" onclick="empOpenPay(\''+p.id+'\')">✏ Edit</button></td></tr>';
    }).join('')+
  '</tbody></table></div>';
}

async function empReloadPay(){
  var cont=document.getElementById('emp-content');
  if(cont)cont.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">⏳ Loading...</div>';
  try{
    var data=await sbFetch('employee_pay',{select:'*',order:'created_at.desc'});
    EMP_PAY=Array.isArray(data)?data:[];
    if(cont)cont.innerHTML=empPayHTML();
    toast('Pay structures refreshed ('+EMP_PAY.length+' records)','success');
  }catch(e){toast('Error loading pay data','error');}
}
function empSalaryHTML(){
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'+
    '<div style="font-size:15px;font-weight:800;">Salary Processing</div>'+
    '<div style="display:flex;gap:6px;">'+
    '<button class="btn btn-navy" onclick="salLoadRecords()">🔄 Load</button>'+
    '<button class="btn btn-green" onclick="salFinalise()">✓ Finalise</button></div></div>'+
    '<div id="sal-body"><div style="text-align:center;padding:30px;color:var(--text3);">Click Load to view this month\'s salary</div></div>';
}

function empIncrementHTML(){
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'+
    '<div style="font-size:15px;font-weight:800;">Increment / Revision</div>'+
    '<button class="btn btn-navy" onclick="empOpenIncrement()">+ Increment</button></div>'+
    '<div style="text-align:center;padding:40px;color:var(--text3);">Select employee for increment processing</div>';
}

function empTransferHTML(){
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'+
    '<div style="font-size:15px;font-weight:800;">Transfer / Resignation</div>'+
    '<button class="btn btn-navy" onclick="empOpenTransfer()">+ Transfer / Resign</button></div>'+
    '<div style="text-align:center;padding:40px;color:var(--text3);">Manage employee transfers and resignations</div>';
}

function empDownloadHTML(){
  return '<div style="font-size:15px;font-weight:800;margin-bottom:14px;">HR Documents</div>'+
  EMP_LIST.filter(function(e){return e.status==='active';}).slice(0,20).map(function(emp){
    return '<div class="card" style="margin-bottom:8px;"><div style="display:flex;align-items:center;justify-content:space-between;">'+
      '<div><div style="font-weight:800;">'+emp.name+'</div><div style="font-size:11px;color:var(--text3);">'+(emp.empId||'—')+' · '+(emp.designation||'—')+'</div></div>'+
      '<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">'+
        '<button class="btn btn-sm" onclick="downloadPayslipPDF(\''+emp.id+'\')" style="font-size:10px;">📋 Payslip</button>'+
        '<button class="btn btn-sm" onclick="downloadIDCard(\''+emp.id+'\')" style="font-size:10px;">🪪 ID Card</button>'+
      '</div></div></div>';
  }).join('')||'<div style="text-align:center;padding:30px;color:var(--text3);">No employees</div>';
}

function empOpenForm(editId){
  EMP_EDIT_ID=editId||null;
  var emp=editId?EMP_LIST.find(function(e){return e.id===editId;}):null;
  document.getElementById('emp-sheet-title').textContent=editId?'Edit Employee':'Add Employee';
  document.getElementById('emp-sheet-body').innerHTML=
    '<div class="g2">'+
      '<div><label class="flbl">First Name *</label><input class="finp" id="ef-fname" value="'+(emp?(emp.name||'').split(' ')[0]:'')+'"></div>'+
      '<div><label class="flbl">Last Name</label><input class="finp" id="ef-lname" value="'+(emp?(emp.name||'').split(' ').slice(1).join(' '):'')+'"></div></div>'+
    '<label class="flbl">Mobile *</label><input class="finp" id="ef-phone" value="'+(emp?emp.phone||'':'')+'" type="tel">'+
    '<label class="flbl">Designation</label><input class="finp" id="ef-desig" value="'+(emp?esc(emp.designation||''):'')+'">'+
    '<label class="flbl">Department</label><select class="fsel" id="ef-dept">'+EMP_DEPTS.map(function(d){return '<option value="'+d+'"'+(emp&&emp.dept===d?' selected':'')+'>'+d+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Role (System Access)</label><select class="fsel" id="ef-role">'+['admin','pm','engineer','qhse','finance','viewer'].map(function(r){return '<option value="'+r+'"'+(emp&&emp.role===r?' selected':'')+'>'+r+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Employee Type</label><select class="fsel" id="ef-type">'+EMP_CATS.map(function(c){return '<option value="'+c+'"'+(emp&&emp.empType===c?' selected':'')+'>'+c+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Date of Joining</label><input class="finp" id="ef-doj" type="date" value="'+(emp?emp.doj||emp.date_of_joining||'':'')+'">' +
    '<label class="flbl">Project / Work Location</label><select class="fsel" id="ef-loc"><option value="">Select project...</option>'+PROJECTS.map(function(p){return '<option value="'+p.name+'"'+(emp&&emp.project===p.name?' selected':'')+'>'+p.name+'</option>';}).join('')+'</select>';
  document.getElementById('emp-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeEmpSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="empFormSave()">💾 Save</button>';
  openEmpSheet();
}

function empOpenEditForm(id){empOpenForm(id);}

async function empFormSave(){
  var fname=gv('ef-fname');if(!fname){toast('First name required','warning');return;}
  var phone=gv('ef-phone');if(!phone){toast('Mobile required','warning');return;}
  var payload={first_name:fname,last_name:gv('ef-lname'),phone:phone,designation:gv('ef-desig'),department:gv('ef-dept'),role:gv('ef-role'),emp_type:gv('ef-type'),date_of_joining:gv('ef-doj')||null,work_location:gv('ef-loc')};
  try{
    if(EMP_EDIT_ID){
      await sbUpdate('employees',EMP_EDIT_ID,payload);
      var idx=EMP_LIST.findIndex(function(e){return e.id===EMP_EDIT_ID;});
      if(idx>-1)EMP_LIST[idx]=Object.assign(EMP_LIST[idx],mapEmployee(Object.assign({id:EMP_EDIT_ID},payload)));
    } else {
      var newId=await getNextAIPLId();
      payload.emp_id=newId;payload.status='active';
      var r=await sbInsert('employees',payload);
      if(r&&r[0])EMP_LIST.unshift(mapEmployee(r[0]));
    }
    closeEmpSheet();empRender();toast('Employee saved','success');
    if(typeof USERS!=='undefined')USERS=EMP_LIST;
    if(typeof renderUsers==='function')renderUsers();
  }catch(e){toast('Error: '+e.message,'error');}
}

function empViewDetail(id){
  var emp=EMP_LIST.find(function(e){return e.id===id;});if(!emp)return;
  var col=ROLE_COLORS[emp.role]||'#37474F';
  var initials=(emp.name||'?').split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase();
  document.getElementById('emp-sheet-title').textContent='Employee Detail';
  document.getElementById('emp-sheet-body').innerHTML=
    '<div style="background:'+col+'15;border:1px solid '+col+'30;border-radius:16px;padding:16px;margin-bottom:14px;display:flex;align-items:center;gap:14px;">'+
      '<div style="width:60px;height:60px;border-radius:16px;background:'+col+';display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:white;flex-shrink:0;overflow:hidden;">'+
        (emp.photoUrl?'<img src="'+emp.photoUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">':initials)+'</div>'+
      '<div>'+
        '<div style="font-size:17px;font-weight:900;">'+emp.name+'</div>'+
        '<div style="font-size:12px;color:var(--text2);margin-top:2px;">'+(emp.designation||'—')+' · '+(emp.dept||'—')+'</div>'+
        '<div style="margin-top:6px;"><span class="badge" style="background:'+col+'20;color:'+col+';border-color:'+col+'40;">'+(emp.empId||'—')+'</span></div>'+
      '</div></div>'+
    '<div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">Personal Info</div>'+
    ir('Mobile',emp.phone||'—')+ir('Date of Joining',fmtDate(emp.doj||emp.date_of_joining||'—'))+ir('Employee Type',emp.empType||'—')+ir('Blood Group',emp.blood||'—')+ir('Gender',emp.gender||'—')+
    '<div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin:12px 0 8px;">Bank Details</div>'+
    ir('Bank',emp.bank||'—')+ir('Account No',emp.accNo||'—',true)+ir('IFSC',emp.ifsc||'—',true)+
    '<div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin:12px 0 8px;">IDs</div>'+
    ir('Aadhar',emp.aadhar||'—',true)+ir('PAN',emp.pan||'—',true)+ir('PF No',emp.pf||'—',true)+ir('ESIC No',emp.esic||'—',true);
  document.getElementById('emp-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeEmpSheet()">Close</button>'+
    (currentUser&&(currentUser.role==='admin'||currentUser.role==='pm')?
      '<button class="btn btn-navy" onclick="empOpenEditForm(\''+id+'\')">✏ Edit</button>':'');
  openEmpSheet();
}

async function empDeleteEmployee(id,name){
  if(!confirm('Delete employee '+name+'?'))return;
  try{
    await sbDelete('employees',id);EMP_LIST=EMP_LIST.filter(function(e){return e.id!==id;});
    if(typeof USERS!=='undefined')USERS=EMP_LIST;empRender();toast(name+' deleted','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

async function empApprove(id){
  try{
    await sbUpdate('employees',id,{status:'active'});
    var idx=EMP_LIST.findIndex(function(e){return e.id===id;});if(idx>-1)EMP_LIST[idx].status='active';
    empRender();toast('Employee approved!','success');loadPendingApprovals();
    if(typeof USERS!=='undefined')USERS=EMP_LIST;if(typeof renderUsers==='function')renderUsers();
  }catch(e){toast('Error: '+e.message,'error');}
}

async function empReject(id){
  try{
    await sbUpdate('employees',id,{status:'rejected'});
    var idx=EMP_LIST.findIndex(function(e){return e.id===id;});if(idx>-1)EMP_LIST[idx].status='rejected';
    empRender();toast('Employee rejected','info');loadPendingApprovals();
  }catch(e){toast('Error: '+e.message,'error');}
}

// ── PAY STRUCTURE ─────────────────────────────────────────
function empOpenPay(payId){
  var pay=payId?EMP_PAY.find(function(p){return p.id===payId;}):null;
  PAY_EARNINGS=pay&&pay.earnings?JSON.parse(pay.earnings||'[]'):[{id:'e1',name:'Basic',amount:0,taxable:true},{id:'e2',name:'HRA',amount:0,taxable:false},{id:'e3',name:'DA',amount:0,taxable:true}];
  PAY_DEDUCTIONS=pay&&pay.deductions?JSON.parse(pay.deductions||'[]'):[{id:'d1',name:'PF',amount:0},{id:'d2',name:'ESI',amount:0},{id:'d3',name:'PT',amount:0}];
  document.getElementById('emp-sheet-title').textContent='Pay Structure';
  document.getElementById('emp-sheet-body').innerHTML=
    '<label class="flbl">Employee *</label><select class="fsel" id="pay-emp-sel">'+
      '<option value="">Select employee...</option>'+
      EMP_LIST.filter(function(e){return e.status==='active';}).map(function(e){return '<option value="'+e.id+'"'+(pay&&pay.emp_id===e.id?' selected':'')+'>'+e.name+' ('+e.empId+')</option>';}).join('')+'</select>'+
    '<label class="flbl">Effective Date</label><input class="finp" id="pay-eff-date" type="date" value="'+(pay?pay.effective_date||'':new Date().toISOString().slice(0,10))+'">'+
    '<div style="font-size:12px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin:10px 0 6px;">Earnings</div>'+
    '<div id="pay-earn-list">'+payRenderEarnings()+'</div>'+
    '<button class="btn btn-sm btn-teal" onclick="payAddEarning()" style="margin-bottom:12px;">+ Earning</button>'+
    '<div style="font-size:12px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin:10px 0 6px;">Deductions</div>'+
    '<div id="pay-ded-list">'+payRenderDeductions()+'</div>'+
    '<button class="btn btn-sm btn-red" onclick="payAddDeduction()" style="margin-bottom:12px;">+ Deduction</button>'+
    '<div id="pay-totals" style="background:var(--bg);border-radius:10px;padding:12px;">' + payCalc()+'</div>';
  document.getElementById('emp-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeEmpSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="empSavePay(\''+payId+'\')">💾 Save</button>';
  openEmpSheet();
}

function payRenderEarnings(){
  return PAY_EARNINGS.map(function(e){
    return '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:6px;align-items:center;">'+
      '<div style="display:flex;gap:6px;">'+
        '<input class="finput" style="flex:1;" value="'+esc(e.name)+'" onchange="PAY_EARNINGS.find(x=>x.id===\''+e.id+'\').name=this.value;payAutoCalc()">'+
        '<input class="finput" style="width:100px;text-align:right;" type="number" value="'+(e.amount||0)+'" onchange="PAY_EARNINGS.find(x=>x.id===\''+e.id+'\').amount=parseFloat(this.value)||0;payAutoCalc()">'+
      '</div>'+
      '<button onclick="PAY_EARNINGS=PAY_EARNINGS.filter(x=>x.id!==\''+e.id+'\');document.getElementById(\'pay-earn-list\').innerHTML=payRenderEarnings();payAutoCalc();" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:16px;">✕</button>'+
    '</div>';
  }).join('');
}

function payRenderDeductions(){
  return PAY_DEDUCTIONS.map(function(d){
    return '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:6px;align-items:center;">'+
      '<div style="display:flex;gap:6px;">'+
        '<input class="finput" style="flex:1;" value="'+esc(d.name)+'" onchange="PAY_DEDUCTIONS.find(x=>x.id===\''+d.id+'\').name=this.value;payAutoCalc()">'+
        '<input class="finput" style="width:100px;text-align:right;" type="number" value="'+(d.amount||0)+'" onchange="PAY_DEDUCTIONS.find(x=>x.id===\''+d.id+'\').amount=parseFloat(this.value)||0;payAutoCalc()">'+
      '</div>'+
      '<button onclick="PAY_DEDUCTIONS=PAY_DEDUCTIONS.filter(x=>x.id!==\''+d.id+'\');document.getElementById(\'pay-ded-list\').innerHTML=payRenderDeductions();payAutoCalc();" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:16px;">✕</button>'+
    '</div>';
  }).join('');
}

function payCalc(){
  var gross=PAY_EARNINGS.reduce(function(s,e){return s+(e.amount||0);},0);
  var deductions=PAY_DEDUCTIONS.reduce(function(s,d){return s+(d.amount||0);},0);
  var net=gross-deductions;
  return ir('Gross',fmtINR(gross))+ir('Deductions',fmtINR(deductions))+
    '<div style="font-size:15px;font-weight:900;color:var(--green);border-top:2px solid var(--border);padding-top:8px;margin-top:8px;display:flex;justify-content:space-between;">'+
    '<span>Net Pay</span><span>'+fmtINR(net)+'</span></div>';
}

function payAutoCalc(){var t=document.getElementById('pay-totals');if(t)t.innerHTML=payCalc();}

function payAddEarning(){
  PAY_EARN_ID++;
  PAY_EARNINGS.push({id:'e_'+PAY_EARN_ID,name:'Allowance',amount:0,taxable:true});
  var el=document.getElementById('pay-earn-list');if(el)el.innerHTML=payRenderEarnings();payAutoCalc();
}
function payAddDeduction(){
  PAY_DED_ID++;
  PAY_DEDUCTIONS.push({id:'d_'+PAY_DED_ID,name:'Deduction',amount:0});
  var el=document.getElementById('pay-ded-list');if(el)el.innerHTML=payRenderDeductions();payAutoCalc();
}

async function empSavePay(payId){
  var empSel=gv('pay-emp-sel');if(!empSel){toast('Select employee','warning');return;}
  var gross=PAY_EARNINGS.reduce(function(s,e){return s+(e.amount||0);},0);
  var payload={emp_id:empSel,effective_date:gv('pay-eff-date')||null,earnings:JSON.stringify(PAY_EARNINGS),deductions:JSON.stringify(PAY_DEDUCTIONS),gross:gross,basic:PAY_EARNINGS.find(function(e){return e.name==='Basic';})?PAY_EARNINGS.find(function(e){return e.name==='Basic';}).amount:0,hra:PAY_EARNINGS.find(function(e){return e.name==='HRA';})?PAY_EARNINGS.find(function(e){return e.name==='HRA';}).amount:0,da:PAY_EARNINGS.find(function(e){return e.name==='DA';})?PAY_EARNINGS.find(function(e){return e.name==='DA';}).amount:0};
  try{
    if(payId){await sbUpdate('employee_pay',payId,payload);}else{await sbInsert('employee_pay',payload);}
    closeEmpSheet();
    var pays=await sbFetch('employee_pay',{select:'*',order:'created_at.desc'});
    EMP_PAY=Array.isArray(pays)?pays:[];
    empTab('pay');toast('Pay structure saved','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

// ── SALARY ────────────────────────────────────────────────
async function salLoadRecords(){
  var body=document.getElementById('sal-body');if(!body)return;
  var now=new Date(), month=String(now.getMonth()+1).padStart(2,'0'), year=now.getFullYear();
  body.innerHTML='<div style="text-align:center;padding:20px;color:var(--text3);">Processing...</div>';
  var emps=EMP_LIST.filter(function(e){return e.status==='active';});
  body.innerHTML='<div style="text-align:center;font-size:13px;font-weight:700;margin-bottom:12px;">Salary for '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()]+' '+year+'</div>'+
  '<div class="table-card"><table class="att-table"><thead><tr><th><input type="checkbox" onclick="salSelectAll(this)"></th><th>Employee</th><th>Days</th><th>Gross</th><th>Deductions</th><th>Net</th></tr></thead><tbody>'+
  emps.map(function(emp){
    var pay=EMP_PAY.find(function(p){return p.emp_id===emp.id;});
    var gross=pay?parseFloat(pay.gross||0):0;
    var ded=pay&&pay.deductions?JSON.parse(pay.deductions||'[]').reduce(function(s,d){return s+(d.amount||0);},0):0;
    var net=gross-ded;
    return '<tr>'+
      '<td><input type="checkbox" class="sal-chk" value="'+emp.id+'"></td>'+
      '<td><strong>'+emp.name+'</strong><br><small>'+emp.empId+'</small></td>'+
      '<td><input type="number" class="time-in" style="width:50px;" value="26" id="sal-days-'+emp.id+'"></td>'+
      '<td>'+fmtINR(gross)+'</td><td>'+fmtINR(ded)+'</td>'+
      '<td><strong id="sal-net-'+emp.id+'">'+fmtINR(net)+'</strong></td>'+
    '</tr>';
  }).join('')+'</tbody></table></div>'+
  '<div style="display:flex;gap:8px;margin-top:12px;">'+
    '<button class="btn btn-green" onclick="salFinalise()">✓ Finalise Selected</button>'+
    '<button class="btn btn-navy" onclick="salDownloadExcel()">📥 Excel</button>'+
    '<button class="btn btn-navy" onclick="salDownloadPDF()">📄 PDF</button></div>';
}

function salSelectAll(cb){document.querySelectorAll('.sal-chk').forEach(function(c){c.checked=cb.checked;});}

async function salFinalise(){
  var selected=[];document.querySelectorAll('.sal-chk:checked').forEach(function(c){selected.push(c.value);});
  if(!selected.length){toast('Select employees to finalise','warning');return;}
  toast('Salary finalised for '+selected.length+' employees','success');
}

function salDownloadExcel(){toast('Excel download — requires SheetJS library','info');}
function salDownloadPDF(){toast('PDF download — requires PDF library','info');}
function salRecalc(){salLoadRecords();}
function salAddExtraRow(){toast('Add extra row','info');}
function salToggleRow(id){}
function salBuildLogSection(){return '';}
function salWireLogButtons(){}
function salWireInputs(){}
function salOpenPayment(id){toast('Open payment for '+id,'info');}
function salSavePayment(){toast('Save payment','info');}
function salClearPayment(){toast('Clear payment','info');}

// ── INCREMENT ─────────────────────────────────────────────
function empOpenIncrement(){
  document.getElementById('emp-sheet-title').textContent='Salary Increment';
  document.getElementById('emp-sheet-body').innerHTML=
    '<label class="flbl">Employee *</label><select class="fsel" id="inc-emp"><option value="">Select...</option>'+
      EMP_LIST.filter(function(e){return e.status==='active';}).map(function(e){return '<option value="'+e.id+'">'+e.name+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Effective Date *</label><input class="finp" id="inc-date" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<div class="g2"><div><label class="flbl">Current CTC (₹)</label><input class="finp" id="inc-current" type="number" placeholder="0" onchange="incCalcFromPct()"></div>'+
    '<div><label class="flbl">Increment %</label><input class="finp" id="inc-pct" type="number" placeholder="10" onchange="incCalcFromPct()"></div></div>'+
    '<label class="flbl">New CTC (₹)</label><input class="finp" id="inc-new" type="number" placeholder="0" onchange="incCalcFromAmt()">'+
    '<label class="flbl">Remarks</label><input class="finp" id="inc-remarks" placeholder="Reason for increment">';
  document.getElementById('emp-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeEmpSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="empSaveIncrement()">💾 Save</button>';
  openEmpSheet();
}

function incCalcFromPct(){
  var curr=parseFloat(document.getElementById('inc-current').value)||0;
  var pct=parseFloat(document.getElementById('inc-pct').value)||0;
  var newCtc=curr*(1+pct/100);
  document.getElementById('inc-new').value=Math.round(newCtc);
}
function incCalcFromAmt(){
  var curr=parseFloat(document.getElementById('inc-current').value)||0;
  var newCtc=parseFloat(document.getElementById('inc-new').value)||0;
  if(curr>0)document.getElementById('inc-pct').value=Math.round(((newCtc-curr)/curr)*100);
}

async function empSaveIncrement(){
  var empId=gv('inc-emp');if(!empId){toast('Select employee','warning');return;}
  try{
    await sbInsert('salary_increments',{emp_id:empId,effective_date:gv('inc-date'),current_ctc:parseFloat(gv('inc-current'))||0,new_ctc:parseFloat(gv('inc-new'))||0,increment_pct:parseFloat(gv('inc-pct'))||0,remarks:gv('inc-remarks')});
    closeEmpSheet();toast('Increment saved','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

// ── TRANSFER / RESIGNATION ────────────────────────────────
function empOpenTransfer(){
  document.getElementById('emp-sheet-title').textContent='Transfer / Promotion / Resignation';
  document.getElementById('emp-sheet-body').innerHTML=
    '<label class="flbl">Employee *</label><select class="fsel" id="tr-emp"><option value="">Select...</option>'+
      EMP_LIST.filter(function(e){return e.status==='active';}).map(function(e){return '<option value="'+e.id+'">'+e.name+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Action Type</label><select class="fsel" id="tr-type"><option>Transfer</option><option>Promotion</option><option>Resignation</option></select>'+
    '<label class="flbl">Effective Date</label><input class="finp" id="tr-date" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<label class="flbl">Details</label><input class="finp" id="tr-details" placeholder="New location / new designation / reason">'+
    '<label class="flbl">Remarks</label><textarea class="ftxt" id="tr-remarks" placeholder="Remarks"></textarea>';
  document.getElementById('emp-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeEmpSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="empSaveTransfer()">💾 Save</button>';
  openEmpSheet();
}

async function empSaveTransfer(){
  var empId=gv('tr-emp'),type=gv('tr-type');if(!empId){toast('Select employee','warning');return;}
  try{
    await sbInsert('hr_orders',{emp_id:empId,order_type:type,effective_date:gv('tr-date'),details:gv('tr-details'),remarks:gv('tr-remarks')});
    if(type==='Resignation'){await sbUpdate('employees',empId,{status:'inactive',resignation_date:gv('tr-date'),resignation_reason:gv('tr-details')});var idx=EMP_LIST.findIndex(function(e){return e.id===empId;});if(idx>-1)EMP_LIST[idx].status='inactive';}
    closeEmpSheet();empRender();toast(type+' saved','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

function empOpenPromotion(){empOpenTransfer();}
async function empSavePromotion(){await empSaveTransfer();}
function empOpenResignation(){empOpenTransfer();}
async function empSaveResignation(){await empSaveTransfer();}

// ── HR ORDERS ─────────────────────────────────────────────
async function hrLoadOrders(){
  try{var data=await sbFetch('hr_orders',{select:'*',order:'created_at.desc'});EMP_ORDERS=Array.isArray(data)?data:[];}
  catch(e){console.error(e);}
}
async function hrSaveOrder(payload){try{await sbInsert('hr_orders',payload);toast('Order saved','success');}catch(e){toast('Error','error');}}
async function hrDeleteOrder(id){try{await sbDelete('hr_orders',id);toast('Deleted','success');}catch(e){toast('Error','error');}}
function hrOrdersForEmp(empId){return EMP_ORDERS.filter(function(o){return o.emp_id===empId;});}
function hrWireOrderButtons(){}
function hrPayLogForEmp(empId){return [];}
function hrWireDownloadButtons(){}

// ── ANNUAL STATEMENT ──────────────────────────────────────
function empAnnualHTMLAsync(){return '<div style="text-align:center;padding:40px;color:var(--text3);">Annual statement generation</div>';}
function annToggleDates(){}
function annGenerate(){toast('Annual statement — requires employee selection','info');}
function annBuildStatement(emp,year){return {};}
function annDownloadExcel(stmt){toast('Downloading Excel...','info');}
function annDownloadPDF(stmt){toast('Downloading PDF...','info');}

// ── DOCUMENT DOWNLOADS ────────────────────────────────────
function empDocList(id){var emp=EMP_LIST.find(function(e){return e.id===id;});return emp?[{name:'Payslip',key:'payslip'},{name:'ID Card',key:'idcard'}]:[];}
function empToggleDocList(id){toast('Toggle doc list','info');}

function downloadPayslipPDF(id){
  var emp=EMP_LIST.find(function(e){return e.id===id;});if(!emp){toast('Employee not found','error');return;}
  var pay=EMP_PAY.find(function(p){return p.emp_id===id;});
  var gross=pay?parseFloat(pay.gross||0):0;
  var ded=pay&&pay.deductions?JSON.parse(pay.deductions||'[]').reduce(function(s,d){return s+(d.amount||0);},0):0;
  var now=new Date();
  var html='<html><head><title>Payslip - '+emp.name+'</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto;}h2{text-align:center;}table{width:100%;border-collapse:collapse;margin-top:16px;}td{padding:8px 12px;border:1px solid #ccc;}</style></head>'+
    '<body><h2>SALARY SLIP</h2><p style="text-align:center;">For the month of '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()]+' '+now.getFullYear()+'</p>'+
    '<table><tr><td><strong>Name</strong></td><td>'+emp.name+'</td><td><strong>Employee ID</strong></td><td>'+emp.empId+'</td></tr>'+
    '<tr><td><strong>Designation</strong></td><td>'+(emp.designation||'—')+'</td><td><strong>Department</strong></td><td>'+(emp.dept||'—')+'</td></tr></table>'+
    '<table style="margin-top:20px;"><tr><th>Earnings</th><th>Amount</th><th>Deductions</th><th>Amount</th></tr>'+
    '<tr><td>Gross Salary</td><td>'+fmtINR(gross)+'</td><td>Total Deductions</td><td>'+fmtINR(ded)+'</td></tr>'+
    '<tr><td colspan="2"></td><td><strong>Net Pay</strong></td><td><strong>'+fmtINR(gross-ded)+'</strong></td></tr></table>'+
    '<p style="margin-top:30px;font-size:11px;color:#999;text-align:center;">This is a computer-generated payslip</p></body></html>';
  var w=window.open('','_blank');if(w){w.document.write(html);w.document.close();}else toast('Allow popups','warning');
}

function downloadIDCard(id){
  var emp=EMP_LIST.find(function(e){return e.id===id;});if(!emp)return;
  var col=ROLE_COLORS[emp.role]||'#37474F';
  var html='<html><head><title>ID Card - '+emp.name+'</title><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0f0f0;font-family:Arial,sans-serif;}.card{width:320px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.15);}.card-top{background:'+col+';padding:24px;text-align:center;}.avatar{width:80px;height:80px;border-radius:50%;border:3px solid white;margin:0 auto 12px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:white;}.name{font-size:18px;font-weight:900;color:white;}.desig{font-size:12px;color:rgba(255,255,255,.7);margin-top:4px;}.card-body{padding:16px;}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:12px;}.label{color:#999;}.value{font-weight:700;}</style></head>'+
    '<body><div class="card"><div class="card-top">'+
      '<div class="avatar">'+(emp.name||'?').split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase()+'</div>'+
      '<div class="name">'+emp.name+'</div><div class="desig">'+(emp.designation||'—')+'</div></div>'+
    '<div class="card-body">'+
      '<div class="row"><span class="label">Employee ID</span><span class="value">'+(emp.empId||'—')+'</span></div>'+
      '<div class="row"><span class="label">Department</span><span class="value">'+(emp.dept||'—')+'</span></div>'+
      '<div class="row"><span class="label">Blood Group</span><span class="value">'+(emp.blood||'—')+'</span></div>'+
      '<div class="row"><span class="label">Mobile</span><span class="value">'+(emp.phone||'—')+'</span></div>'+
    '</div></div></body></html>';
  var w=window.open('','_blank');if(w){w.document.write(html);w.document.close();}else toast('Allow popups','warning');
}

function downloadPayFixationOrder(id){toast('Pay Fixation Order — implement with template','info');}
function downloadIncrementLetter(id){toast('Increment Letter — implement with template','info');}
function downloadTransferOrder(id){toast('Transfer Order — implement with template','info');}
function downloadResignationLetter(id){toast('Resignation Letter — implement with template','info');}
function downloadSalaryPDF(empId,month,year){downloadPayslipPDF(empId);}
function downloadSalaryExcel(empId,month,year){toast('Excel download','info');}
