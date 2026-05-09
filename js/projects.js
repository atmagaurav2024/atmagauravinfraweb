// ═══════════════════════════════════════════
// PROJECTS.JS — Projects, BOQ, Planning, Execution
// ═══════════════════════════════════════════

var PROJ_DATA=[], BOQ_ITEMS=[], BOQ_SUBITEMS=[], JM_ITEMS=[], JM_JMS=[];
var PLAN_ITEMS=[], PLAN_SUBS=[], PLAN_RES=[];
var WA_ITEMS=[], WA_SUBS=[], WA_PLANNED=[], WA_ALLOT=[], WA_DAILY=[], WA_BILLS=[], WA_PAYMENTS=[], WA_ORDERS=[];
var PROJ_MOD='projects', PROJ_MOD_SEL=null;
var BOQ_EDIT_ID=null, JM_EDIT_ID=null, EXEC_EDIT_ID=null;
var WA_SUB_TAB='allotted', WA_TYPE='work-order';

function initProjects(){
  projModLoadProjects();
  renderProjList();
}

async function projModLoadProjects(){
  try{
    var data=await sbFetch('projects',{select:'*',order:'name.asc'});
    PROJ_DATA=Array.isArray(data)?data:[];
    var sel=document.getElementById('proj-mod-sel');
    if(sel){
      sel.innerHTML='<option value="">Select Project...</option>'+PROJ_DATA.map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>';}).join('');
    }
    renderProjList();
  }catch(e){console.error('projModLoadProjects:',e);}
}

function projModTab(tab){
  PROJ_MOD=tab;
  ['projects','boq','jm','planning','execution'].forEach(function(t){
    var el=document.getElementById('proj-tab-'+t);if(el)el.classList.toggle('active',t===tab);
    var cont=document.getElementById('proj-cont-'+t);if(cont)cont.style.display=t===tab?'block':'none';
  });
  // sync global selector → local
  var globalSel=document.getElementById('proj-mod-sel');
  if(globalSel&&globalSel.value)PROJ_MOD_SEL=globalSel.value;
  projModLoadTab();
}

function projModLoadTab(){
  // always re-read the global selector
  var sel=document.getElementById('proj-mod-sel');
  if(sel&&sel.value)PROJ_MOD_SEL=sel.value;

  if(PROJ_MOD==='projects'){renderProjList();return;}

  // For non-projects tabs inject an inline project picker if no project selected
  var cont=document.getElementById('proj-mod-content');if(!cont)return;

  if(!PROJ_MOD_SEL){
    // Show inline project picker
    var opts='<option value="">-- Select Project --</option>'+PROJ_DATA.map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>';}).join('');
    cont.innerHTML=
      '<div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:12px;padding:16px;margin-bottom:14px;">'+
        '<div style="font-size:13px;font-weight:800;color:#F57F17;margin-bottom:10px;">⚠️ Select a project first</div>'+
        '<select id="proj-inline-sel" class="fsel" style="margin-bottom:0;">'+opts+'</select>'+
      '</div>';
    // Wire inline picker after render — no inline onchange to avoid loops
    setTimeout(function(){
      var s=document.getElementById('proj-inline-sel');
      if(s) s.addEventListener('change',function(){
        if(!this.value) return;
        PROJ_MOD_SEL=this.value;
        var gs=document.getElementById('proj-mod-sel');
        if(gs) gs.value=this.value;
        // call specific loader, not projModLoadTab (avoids re-render loop)
        if(PROJ_MOD==='boq') boqLoadItems();
        else if(PROJ_MOD==='jm') jmLoadItems();
        else if(PROJ_MOD==='planning') planLoadItems();
        else if(PROJ_MOD==='execution') execLoadItems();
      });
    }, 50);
    return;
  }

  if(PROJ_MOD==='boq')boqLoadItems();
  if(PROJ_MOD==='jm')jmLoadItems();
  if(PROJ_MOD==='planning')planLoadItems();
  if(PROJ_MOD==='execution')execLoadItems();
}

function projModSelChange(){
  var sel=document.getElementById('proj-mod-sel');
  PROJ_MOD_SEL=sel?sel.value:null;
  projModLoadTab();
}

async function renderProjList(){
  var cont=document.getElementById('proj-mod-content');if(!cont)return;
  var html='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'+
    '<div style="font-size:16px;font-weight:800;">Projects</div>'+
    '<button class="btn btn-navy" onclick="openProjForm()">+ Add Project</button></div>';
  if(!PROJ_DATA.length){html+='<div style="text-align:center;padding:40px;color:var(--text3);">No projects found.<br><br><button class="btn btn-navy" onclick="openProjForm()">+ Add Project</button></div>';cont.innerHTML=html;return;}
  html+=PROJ_DATA.map(function(p){
    var statusColor={active:'#2E7D32','on-hold':'#F57F17',completed:'#1565C0',cancelled:'#C62828'}[p.status]||'#37474F';
    return '<div class="card" style="cursor:pointer;" onclick="projModSelProj(\''+p.id+'\')">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'+
        '<div style="font-size:15px;font-weight:800;">'+p.name+'</div>'+
        '<span class="badge" style="background:'+statusColor+'20;color:'+statusColor+';border-color:'+statusColor+'40;">'+(p.status||'active')+'</span>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;">'+
        '<div style="text-align:center;background:var(--bg);border-radius:8px;padding:8px;"><div style="font-size:12px;font-weight:800;color:#1565C0;">'+fmtINR(p.contract_value||0)+'</div><div style="font-size:9px;color:var(--text3);">Contract Value</div></div>'+
        '<div style="text-align:center;background:var(--bg);border-radius:8px;padding:8px;"><div style="font-size:12px;font-weight:800;color:#2E7D32;">'+(p.progress||0)+'%</div><div style="font-size:9px;color:var(--text3);">Progress</div></div>'+
        '<div style="text-align:center;background:var(--bg);border-radius:8px;padding:8px;"><div style="font-size:12px;font-weight:800;color:#E65100;">'+(p.location||'—')+'</div><div style="font-size:9px;color:var(--text3);">Location</div></div>'+
      '</div>'+
      '<div style="display:flex;gap:6px;margin-top:10px;">'+
        '<button class="btn btn-sm btn-navy" onclick="event.stopPropagation();openProjForm(\''+p.id+'\')">✏ Edit</button>'+
        '<button class="btn btn-sm btn-red" onclick="event.stopPropagation();deleteProjItem(\''+p.id+'\',\''+esc(p.name)+'\')">🗑</button>'+
      '</div></div>';
  }).join('');
  cont.innerHTML=html;
}

function projModSelProj(id){
  var sel=document.getElementById('proj-mod-sel');if(sel)sel.value=id;
  PROJ_MOD_SEL=id; projModTab('boq');
}

function openProjForm(editId){
  var proj=editId?PROJ_DATA.find(function(p){return p.id===editId;}):null;
  document.getElementById('proj-sheet-title').textContent=editId?'Edit Project':'Add Project';
  document.getElementById('proj-sheet-body').innerHTML=
    '<label class="flbl">Project Name *</label><input class="finp" id="pf-name" value="'+(proj?esc(proj.name):'')+'" placeholder="e.g. Residential Tower A">'+
    '<label class="flbl">Location</label><input class="finp" id="pf-location" value="'+(proj?esc(proj.location||''):'')+'" placeholder="City, State">'+
    '<label class="flbl">Client Name</label><input class="finp" id="pf-client" value="'+(proj?esc(proj.client_name||''):'')+'" placeholder="Client name">'+
    '<label class="flbl">Contract Value (₹)</label><input class="finp" id="pf-value" type="number" value="'+(proj?proj.contract_value||'':'')+'" placeholder="0">'+
    '<div class="g2"><div><label class="flbl">Start Date</label><input class="finp" id="pf-start" type="date" value="'+(proj?proj.start_date||'':'')+'"></div>'+
    '<div><label class="flbl">End Date</label><input class="finp" id="pf-end" type="date" value="'+(proj?proj.end_date||'':'')+'"></div></div>'+
    '<label class="flbl">Status</label><select class="fsel" id="pf-status"><option value="active" '+(proj&&proj.status==='active'?'selected':'')+'>Active</option><option value="on-hold" '+(proj&&proj.status==='on-hold'?'selected':'')+'>On Hold</option><option value="completed" '+(proj&&proj.status==='completed'?'selected':'')+'>Completed</option><option value="cancelled" '+(proj&&proj.status==='cancelled'?'selected':'')+'>Cancelled</option></select>'+
    '<label class="flbl">Description</label><textarea class="ftxt" id="pf-desc" placeholder="Project scope...">'+(proj?proj.description||'':'')+'</textarea>';
  document.getElementById('proj-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeProjSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="saveProjForm(\''+editId+'\')">💾 Save</button>';
  openSheet('ov-proj','sh-proj');
}
function closeProjSheet(){closeSheet('ov-proj','sh-proj');}

async function saveProjForm(editId){
  var name=gv('pf-name');if(!name){toast('Project name required','warning');return;}
  var payload={name:name,location:gv('pf-location'),client_name:gv('pf-client'),contract_value:parseFloat(gv('pf-value'))||0,start_date:gv('pf-start')||null,end_date:gv('pf-end')||null,status:gv('pf-status')||'active',description:gv('pf-desc')};
  try{
    if(editId){await sbUpdate('projects',editId,payload);}else{await sbInsert('projects',payload);}
    await projModLoadProjects();closeProjSheet();toast((editId?'Project updated':'Project added'),'success');
  }catch(e){toast('Error: '+e.message,'error');}
}

async function deleteProjItem(id,name){
  if(!confirm('Delete project "'+name+'"?'))return;
  try{await sbDelete('projects',id);PROJ_DATA=PROJ_DATA.filter(function(p){return p.id!==id;});renderProjList();toast('Project deleted','success');}
  catch(e){toast('Error: '+e.message,'error');}
}

function searchProj(q){
  var ql=q.toLowerCase();
  var filtered=PROJ_DATA.filter(function(p){return p.name.toLowerCase().includes(ql)||(p.location||'').toLowerCase().includes(ql)||(p.client_name||'').toLowerCase().includes(ql);});
  var cont=document.getElementById('proj-mod-content');if(!cont)return;
  renderProjList();
}

// ── BOQ ──────────────────────────────────────────────────
async function boqLoadItems(){
  try{
    var filter=PROJ_MOD_SEL?'project_id=eq.'+PROJ_MOD_SEL:'';
    var data=await sbFetch('boq_items',{select:'*',filter:filter,order:'created_at.asc'});
    BOQ_ITEMS=Array.isArray(data)?data:[];
    boqRender();
  }catch(e){console.error('boqLoadItems:',e);}
}


function projPickerHTML(onChangeTab){
  var opts='<option value="">-- Select Project --</option>'+
    PROJ_DATA.map(function(p){
      return '<option value="'+p.id+'"'+(p.id===PROJ_MOD_SEL?' selected':'')+'>'+p.name+'</option>';
    }).join('');
  return '<div style="margin-bottom:14px;"><label class="flbl">Project</label>'+
    '<select id="proj-tab-picker" class="fsel" style="margin-bottom:0;">'+opts+'</select></div>';
}

function wireProjPicker(){
  setTimeout(function(){
    var s=document.getElementById('proj-tab-picker');
    if(!s) return;
    s.addEventListener('change',function(){
      if(!this.value) return;
      PROJ_MOD_SEL=this.value;
      var gs=document.getElementById('proj-mod-sel');
      if(gs) gs.value=this.value;
      if(PROJ_MOD==='boq') boqLoadItems();
      else if(PROJ_MOD==='jm') jmLoadItems();
      else if(PROJ_MOD==='planning') planLoadItems();
      else if(PROJ_MOD==='execution') execLoadItems();
    });
  }, 50);
}

function boqRender(){
  var cont=document.getElementById('proj-mod-content');
  if(!cont)return;
  var total=BOQ_ITEMS.reduce(function(s,i){return s+((i.qty||0)*(i.rate||0));},0);
  var proj=PROJ_DATA.find(function(p){return p.id===PROJ_MOD_SEL;});
  var html=projPickerHTML()+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'+
    '<div><div style="font-size:16px;font-weight:800;">Bill of Quantities</div>'+
    '<div style="font-size:12px;color:var(--text2);">'+(proj?proj.name+' &middot; ':'')+' Total: '+fmtINR(total)+'</div></div>'+
    '<button class="btn btn-navy" onclick="boqOpenAddItem()">+ Add Item</button></div>';
  if(!BOQ_ITEMS.length){
    html+='<div style="text-align:center;padding:40px;color:var(--text3);">No BOQ items for this project. Click + Add Item.</div>';
    cont.innerHTML=html;
    wireProjPicker();
    return;
  }
  html+=
    '<div class="table-card"><table class="att-table">'+
    '<thead><tr><th>#</th><th>Description</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Actions</th></tr></thead>'+
    '<tbody>'+
    BOQ_ITEMS.map(function(item){
      var amt=(item.qty||0)*(item.rate||0);
      return '<tr>'+
        '<td>'+(item.item_no||'')+'</td>'+
        '<td>'+item.description+'<br><small style="color:var(--text3);">'+(item.specification||'')+'</small></td>'+
        '<td>'+(item.unit||'')+'</td>'+
        '<td>'+(item.qty||0)+'</td>'+
        '<td>'+fmtINR(item.rate||0)+'</td>'+
        '<td><strong>'+fmtINR(amt)+'</strong></td>'+
        '<td>'+
          '<button class="btn btn-sm btn-navy" onclick="boqEditItem(\x27'+item.id+'\x27)">✏</button> '+
          '<button class="btn btn-sm btn-red" onclick="boqDeleteItem(\x27'+item.id+'\x27)">🗑</button>'+
        '</td>'+
      '</tr>';
    }).join('')+
    '</tbody></table></div>';
  cont.innerHTML=html;
  wireProjPicker();
}
function boqOpenAddItem(editId){
  var item=editId?BOQ_ITEMS.find(function(i){return i.id===editId;}):null;
  BOQ_EDIT_ID=editId||null;
  document.getElementById('boq-sheet-title').textContent=editId?'Edit BOQ Item':'Add BOQ Item';
  document.getElementById('boq-sheet-body').innerHTML=
    '<label class="flbl">Item No</label><input class="finp" id="bq-no" value="'+(item?item.item_no:BOQ_ITEMS.length+1)+'" placeholder="1.1">'+
    '<label class="flbl">Description *</label><input class="finp" id="bq-desc" value="'+(item?esc(item.description||''):'')+'" placeholder="Item description">'+
    '<label class="flbl">Specification</label><input class="finp" id="bq-spec" value="'+(item?esc(item.specification||''):'')+'" placeholder="Technical spec">'+
    '<div class="g2"><div><label class="flbl">Unit</label><input class="finp" id="bq-unit" value="'+(item?item.unit||'':'m³')+'" placeholder="m³"></div>'+
    '<div><label class="flbl">Qty</label><input class="finp" id="bq-qty" type="number" value="'+(item?item.qty||'':'')+'"></div></div>'+
    '<label class="flbl">Rate (₹)</label><input class="finp" id="bq-rate" type="number" value="'+(item?item.rate||'':'')+'">'+
    '<label class="flbl">Category</label><input class="finp" id="bq-cat" value="'+(item?esc(item.category||''):'')+'">';
  document.getElementById('boq-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeBOQSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="boqSaveItem()">💾 Save</button>';
  openSheet('ov-boq','sh-boq');
}

function openBOQSheet(){boqOpenAddItem();}
function closeBOQSheet(){closeSheet('ov-boq','sh-boq');}

async function boqSaveItem(){
  var desc=gv('bq-desc');if(!desc){toast('Description required','warning');return;}
  var payload={project_id:PROJ_MOD_SEL,item_no:gv('bq-no'),description:desc,specification:gv('bq-spec'),unit:gv('bq-unit'),qty:parseFloat(gv('bq-qty'))||0,rate:parseFloat(gv('bq-rate'))||0,category:gv('bq-cat')};
  try{
    if(BOQ_EDIT_ID){await sbUpdate('boq_items',BOQ_EDIT_ID,payload);}else{await sbInsert('boq_items',payload);}
    await boqLoadItems();closeBOQSheet();toast('BOQ item saved','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

function boqEditItem(id){boqOpenAddItem(id);}
async function boqDeleteItem(id){
  if(!confirm('Delete this BOQ item?'))return;
  try{await sbDelete('boq_items',id);BOQ_ITEMS=BOQ_ITEMS.filter(function(i){return i.id!==id;});boqRender();toast('Deleted','success');}
  catch(e){toast('Error','error');}
}

// ── JM (Joint Measurements) ───────────────────────────────
async function jmLoadItems(){
  try{
    var filter=PROJ_MOD_SEL?'project_id=eq.'+PROJ_MOD_SEL:'';
    var data=await sbFetch('jm_records',{select:'*',filter:filter,order:'created_at.desc'});
    JM_JMS=Array.isArray(data)?data:[];
    jmRender();
  }catch(e){console.error('jmLoadItems:',e);}
}

function jmRender(){
  var cont=document.getElementById('proj-mod-content');if(!cont)return;
  var proj=PROJ_DATA.find(function(p){return p.id===PROJ_MOD_SEL;});
  var html=projPickerHTML()+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'+
    '<div><div style="font-size:16px;font-weight:800;">Joint Measurements</div>'+(proj?'<div style="font-size:12px;color:var(--text2);">'+proj.name+'</div>':'')+
    '</div><button class="btn btn-navy" onclick="jmOpenAdd()">+ Add JM</button></div>';
  if(!JM_JMS.length){html+='<div style="text-align:center;padding:40px;color:var(--text3);">No joint measurements found.</div>';cont.innerHTML=html;wireProjPicker();return;}
  html+=JM_JMS.map(function(jm){
    return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;">'+
      '<div><div style="font-size:14px;font-weight:800;">'+(jm.work_description||'JM Entry')+'</div>'+
      '<div style="font-size:12px;color:var(--text3);">'+(jm.jm_no||'—')+' · '+fmtDate(jm.jm_date)+'</div></div>'+
      '<div><strong>'+fmtINR(jm.total_amount||0)+'</strong></div></div>'+
      '<div style="display:flex;gap:6px;margin-top:8px;">'+
      '<button class="btn btn-sm btn-navy" onclick="jmDelete(\''+jm.id+'\')">🗑 Delete</button></div></div>';
  }).join('');
  cont.innerHTML=html;
}

function jmOpenAdd(){
  document.getElementById('proj-sheet-title').textContent='Add Joint Measurement';
  document.getElementById('proj-sheet-body').innerHTML=
    '<label class="flbl">JM Number</label><input class="finp" id="jm-no" placeholder="JM-001">'+
    '<label class="flbl">JM Date</label><input class="finp" id="jm-date" type="date">'+
    '<label class="flbl">Work Description *</label><input class="finp" id="jm-desc" placeholder="Work description">'+
    '<label class="flbl">Subcontractor</label><select class="fsel" id="jm-sc"><option value="">Select...</option>'+SUBCONTRACTORS.map(function(s){return '<option value="'+s.id+'">'+s.name+'</option>';}).join('')+'</select>'+
    '<label class="flbl">Total Amount (₹)</label><input class="finp" id="jm-total" type="number" placeholder="0">';
  document.getElementById('proj-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeProjSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="jmSave()">💾 Save JM</button>';
  openSheet('ov-proj','sh-proj');
}

async function jmSave(){
  var desc=gv('jm-desc');if(!desc){toast('Description required','warning');return;}
  try{
    await sbInsert('jm_records',{project_id:PROJ_MOD_SEL,jm_no:gv('jm-no'),jm_date:gv('jm-date')||null,work_description:desc,subcontractor_id:gv('jm-sc')||null,total_amount:parseFloat(gv('jm-total'))||0});
    await jmLoadItems();closeProjSheet();toast('JM saved','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

async function jmDelete(id){
  if(!confirm('Delete this JM?'))return;
  try{await sbDelete('jm_records',id);JM_JMS=JM_JMS.filter(function(j){return j.id!==id;});jmRender();toast('Deleted','success');}
  catch(e){toast('Error','error');}
}

// ── PLANNING ──────────────────────────────────────────────
async function planLoadItems(){
  try{
    var filter=PROJ_MOD_SEL?'project_id=eq.'+PROJ_MOD_SEL:'';
    var data=await sbFetch('project_activities',{select:'*',filter:filter,order:'start_date.asc'});
    PLAN_ITEMS=Array.isArray(data)?data:[];
    planRender();
  }catch(e){console.error('planLoadItems:',e);}
}

function planRender(){
  var cont=document.getElementById('proj-mod-content');if(!cont)return;
  var proj=PROJ_DATA.find(function(p){return p.id===PROJ_MOD_SEL;});
  var html=projPickerHTML()+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'+
    '<div><div style="font-size:16px;font-weight:800;">Project Planning</div>'+(proj?'<div style="font-size:12px;color:var(--text2);">'+proj.name+'</div>':'')+
    '</div><button class="btn btn-navy" onclick="planAddSub()">+ Add Activity</button></div>';
  if(!PLAN_ITEMS.length){html+='<div style="text-align:center;padding:40px;color:var(--text3);">No activities planned.</div>';cont.innerHTML=html;wireProjPicker();return;}
  html+='<div class="table-card"><table class="att-table"><thead><tr><th>Activity</th><th>Start</th><th>End</th><th>Progress</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+
    PLAN_ITEMS.map(function(act){
      var pct=act.progress||0;
      return '<tr>'+
        '<td><strong>'+act.name+'</strong><br><small style="color:var(--text3);">'+(act.category||'—')+'</small></td>'+
        '<td>'+fmtDate(act.start_date)+'</td>'+
        '<td>'+fmtDate(act.end_date)+'</td>'+
        '<td><div style="display:flex;align-items:center;gap:8px;"><div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:var(--green2);border-radius:4px;"></div></div>'+pct+'%</div></td>'+
        '<td><span class="badge '+(pct>=100?'b-green':pct>0?'b-amber':'b-navy')+'">'+(pct>=100?'Done':pct>0?'In Progress':'Not Started')+'</span></td>'+
        '<td><button class="btn btn-sm btn-navy" onclick="planEditSub(\''+act.id+'\')">✏</button> <button class="btn btn-sm btn-red" onclick="planDelSub(\''+act.id+'\')">🗑</button></td>'+
      '</tr>';
    }).join('')+'</tbody></table></div>';
  cont.innerHTML=html;
}

function planAddSub(){
  document.getElementById('proj-sheet-title').textContent='Add Activity';
  document.getElementById('proj-sheet-body').innerHTML=
    '<label class="flbl">Activity Name *</label><input class="finp" id="pa-name" placeholder="e.g. Foundation Work">'+
    '<label class="flbl">Category</label><input class="finp" id="pa-cat" placeholder="e.g. Civil">'+
    '<div class="g2"><div><label class="flbl">Start Date</label><input class="finp" id="pa-start" type="date"></div>'+
    '<div><label class="flbl">End Date</label><input class="finp" id="pa-end" type="date"></div></div>'+
    '<label class="flbl">Progress (%)</label><input class="finp" id="pa-prog" type="number" min="0" max="100" placeholder="0">';
  document.getElementById('proj-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeProjSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="planSaveSub()">💾 Save</button>';
  openSheet('ov-proj','sh-proj');
}

async function planSaveSub(editId){
  var name=gv('pa-name');if(!name){toast('Activity name required','warning');return;}
  var payload={project_id:PROJ_MOD_SEL,name:name,category:gv('pa-cat'),start_date:gv('pa-start')||null,end_date:gv('pa-end')||null,progress:parseInt(gv('pa-prog'))||0};
  try{
    if(editId){await sbUpdate('project_activities',editId,payload);}else{await sbInsert('project_activities',payload);}
    await planLoadItems();closeProjSheet();toast('Activity saved','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

function planEditSub(id){
  var act=PLAN_ITEMS.find(function(a){return a.id===id;});if(!act)return;
  document.getElementById('proj-sheet-title').textContent='Edit Activity';
  document.getElementById('proj-sheet-body').innerHTML=
    '<label class="flbl">Activity Name *</label><input class="finp" id="pa-name" value="'+esc(act.name)+'">'+
    '<label class="flbl">Category</label><input class="finp" id="pa-cat" value="'+esc(act.category||'')+'">'+
    '<div class="g2"><div><label class="flbl">Start Date</label><input class="finp" id="pa-start" type="date" value="'+(act.start_date||'')+'"></div>'+
    '<div><label class="flbl">End Date</label><input class="finp" id="pa-end" type="date" value="'+(act.end_date||'')+'"></div></div>'+
    '<label class="flbl">Progress (%)</label><input class="finp" id="pa-prog" type="number" min="0" max="100" value="'+(act.progress||0)+'">';
  document.getElementById('proj-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeProjSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="planSaveSub(\''+id+'\')">💾 Save</button>';
  openSheet('ov-proj','sh-proj');
}

async function planUpdateSub(id){await planSaveSub(id);}
async function planDelSub(id){
  if(!confirm('Delete this activity?'))return;
  try{await sbDelete('project_activities',id);PLAN_ITEMS=PLAN_ITEMS.filter(function(a){return a.id!==id;});planRender();toast('Deleted','success');}
  catch(e){toast('Error','error');}
}

// Stub planning resource functions
function planAddRes(){toast('Add resource — implement in projects.js','info');}
async function planSaveRes(){toast('Save resource','info');}
function planEditRes(id){toast('Edit resource','info');}
async function planUpdateRes(id){toast('Update resource','info');}
async function planDelRes(id){toast('Delete resource','info');}

// ── EXECUTION / WORK ALLOTMENT ────────────────────────────
async function execLoadItems(){
  try{
    var filter=PROJ_MOD_SEL?'project_id=eq.'+PROJ_MOD_SEL:'';
    var[allot,daily,bills,orders]=await Promise.all([
      sbFetch('work_allotments',{select:'*',filter:filter,order:'created_at.desc'}),
      sbFetch('daily_progress',{select:'*',filter:filter,order:'date.desc'}),
      sbFetch('bills',{select:'*',filter:filter,order:'created_at.desc'}),
      sbFetch('work_orders',{select:'*',filter:filter,order:'created_at.desc'}),
    ]);
    WA_ALLOT=Array.isArray(allot)?allot:[];
    WA_DAILY=Array.isArray(daily)?daily:[];
    WA_BILLS=Array.isArray(bills)?bills:[];
    WA_ORDERS=Array.isArray(orders)?orders:[];
    execRender();
  }catch(e){console.error('execLoadItems:',e);}
}

function execRender(){
  var cont=document.getElementById('proj-mod-content');if(!cont)return;
  var proj=PROJ_DATA.find(function(p){return p.id===PROJ_MOD_SEL;});
  var tabHtml=projPickerHTML()+
    (proj?'<div style="font-size:12px;color:var(--text2);margin-bottom:8px;font-weight:700;">'+proj.name+'</div>':'')+
    '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">'+
    ['allotted','daily','bills','orders'].map(function(t){
      return '<button class="btn '+(WA_SUB_TAB===t?'btn-navy':'')+'" onclick="waSubTab(\''+t+'\')" style="'+(WA_SUB_TAB===t?'':'border:1px solid var(--border);background:white;color:var(--text2);')+' font-size:12px;">'+t.charAt(0).toUpperCase()+t.slice(1)+'</button>';
    }).join('')+'</div>';
  cont.innerHTML=tabHtml+'<div id="exec-sub-cont"></div>';
  wireProjPicker();
  execRenderSubTab();
}

function waSubTab(tab){WA_SUB_TAB=tab;execRender();}
function waTypeChange(v){WA_TYPE=v;}

function execRenderSubTab(){
  var cont=document.getElementById('exec-sub-cont');if(!cont)return;
  if(WA_SUB_TAB==='allotted')execRenderAllotted();
  if(WA_SUB_TAB==='daily')execRenderDaily();
  if(WA_SUB_TAB==='bills')execRenderBills();
  if(WA_SUB_TAB==='orders')execRenderOrders();
}

function execRenderAllotted(){
  var cont=document.getElementById('exec-sub-cont');if(!cont)return;
  cont.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'+
    '<div style="font-size:14px;font-weight:800;">Work Allotments</div>'+
    '<div style="display:flex;gap:6px;align-items:center;">'+
    '<select class="finput" style="font-size:12px;" onchange="waTypeChange(this.value)">'+
      '<option value="work-order">Work Order</option><option value="purchase-order">Purchase Order</option></select>'+
    '<button class="btn btn-navy btn-sm" onclick="execOpenAllot()">+ Allot</button></div></div>'+
  (!WA_ALLOT.length?'<div style="text-align:center;padding:30px;color:var(--text3);">No allotments</div>':
  '<div class="table-card"><table class="att-table"><thead><tr><th>Party</th><th>Work</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+
    WA_ALLOT.map(function(a){
      var amt=(a.qty||0)*(a.rate||0);
      return '<tr><td><strong>'+(a.party_name||'—')+'</strong></td><td>'+(a.work_description||'—')+'<br><small>'+(a.scope||'')+'</small></td>'+
        '<td>'+(a.qty||0)+'</td><td>'+fmtINR(a.rate||0)+'</td><td><strong>'+fmtINR(amt)+'</strong></td>'+
        '<td><span class="badge '+(a.status==='approved'?'b-green':'b-amber')+'">'+(a.status||'draft')+'</span></td>'+
        '<td><button class="btn btn-sm" onclick="execGenPartyDoc(\''+a.id+'\')">📄</button>'+
        ' <button class="btn btn-sm btn-red" onclick="execDelAllot(\''+a.id+'\')">🗑</button></td></tr>';
    }).join('')+'</tbody></table></div>');
}

function execRenderDaily(){
  var cont=document.getElementById('exec-sub-cont');if(!cont)return;
  cont.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'+
    '<div style="font-size:14px;font-weight:800;">Daily Progress</div>'+
    '<button class="btn btn-navy btn-sm" onclick="execOpenDailyEntry()">+ Entry</button></div>'+
  (!WA_DAILY.length?'<div style="text-align:center;padding:30px;color:var(--text3);">No daily entries</div>':
  WA_DAILY.slice(0,20).map(function(d){
    return '<div class="card"><div style="display:flex;justify-content:space-between;"><strong>'+fmtDate(d.date)+'</strong><span class="badge b-blue">'+d.category+'</span></div>'+
      '<div style="font-size:13px;margin-top:6px;">'+(d.description||'—')+'</div>'+
      '<div style="font-size:11px;color:var(--text3);margin-top:4px;">Qty: '+d.qty+' '+d.unit+'</div></div>';
  }).join(''));
}

function execRenderBills(){
  var cont=document.getElementById('exec-sub-cont');if(!cont)return;
  cont.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'+
    '<div style="font-size:14px;font-weight:800;">Bills & Payments</div>'+
    '<button class="btn btn-navy btn-sm" onclick="execOpenBill()">+ Bill</button></div>'+
  (!WA_BILLS.length?'<div style="text-align:center;padding:30px;color:var(--text3);">No bills</div>':
  '<div class="table-card"><table class="att-table"><thead><tr><th>Bill No</th><th>Party</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+
    WA_BILLS.map(function(b){
      return '<tr><td>'+b.bill_no+'</td><td>'+(b.party_name||'—')+'</td><td><strong>'+fmtINR(b.bill_amount||0)+'</strong></td>'+
        '<td><span class="badge '+(b.status==='paid'?'b-green':'b-amber')+'">'+(b.status||'pending')+'</span></td>'+
        '<td><button class="btn btn-sm btn-green" onclick="execOpenPayment(\''+b.id+'\')">Pay</button></td></tr>';
    }).join('')+'</tbody></table></div>');
}

function execRenderOrders(){
  var cont=document.getElementById('exec-sub-cont');if(!cont)return;
  cont.innerHTML='<div style="font-size:14px;font-weight:800;margin-bottom:12px;">Work / Purchase Orders</div>'+
  (!WA_ORDERS.length?'<div style="text-align:center;padding:30px;color:var(--text3);">No orders generated</div>':
  WA_ORDERS.map(function(o){
    return '<div class="card"><div style="display:flex;justify-content:space-between;"><strong>'+o.order_no+'</strong><span class="badge b-blue">'+(o.order_type||'WO')+'</span></div>'+
      '<div style="font-size:13px;margin-top:4px;">'+(o.party_name||'—')+'</div>'+
      '<div style="display:flex;gap:6px;margin-top:8px;">'+
      '<button class="btn btn-sm btn-navy" onclick="execPrintOrder(\''+o.id+'\')">🖨 Print</button>'+
      '<button class="btn btn-sm btn-red" onclick="execDeleteOrder(\''+o.id+'\')">🗑</button></div></div>';
  }).join(''));
}

function execOpenAllot(){
  document.getElementById('proj-sheet-title').textContent='Allot Work';
  document.getElementById('proj-sheet-body').innerHTML=
    '<label class="flbl">Party Name *</label><input class="finp" id="ea-party" placeholder="Subcontractor / Vendor name">'+
    '<label class="flbl">Work Description *</label><input class="finp" id="ea-desc" placeholder="Work description">'+
    '<label class="flbl">Scope</label><input class="finp" id="ea-scope" placeholder="Scope of work">'+
    '<div class="g2"><div><label class="flbl">Qty</label><input class="finp" id="ea-qty" type="number" placeholder="0"></div>'+
    '<div><label class="flbl">Unit</label><input class="finp" id="ea-unit" placeholder="m³"></div></div>'+
    '<label class="flbl">Rate (₹)</label><input class="finp" id="ea-rate" type="number" placeholder="0">';
  document.getElementById('proj-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeProjSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="execSaveAllot()">💾 Save</button>';
  openSheet('ov-proj','sh-proj');
}

async function execSaveAllot(editId){
  var party=gv('ea-party'), desc=gv('ea-desc');
  if(!party||!desc){toast('Party and description required','warning');return;}
  var payload={project_id:PROJ_MOD_SEL,party_name:party,work_description:desc,scope:gv('ea-scope'),qty:parseFloat(gv('ea-qty'))||0,unit:gv('ea-unit'),rate:parseFloat(gv('ea-rate'))||0,order_type:WA_TYPE,status:'draft'};
  try{
    if(editId){await sbUpdate('work_allotments',editId,payload);}else{var r=await sbInsert('work_allotments',payload);if(r&&r[0])payload.id=r[0].id;}
    await execLoadItems();closeProjSheet();toast('Work allotted','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

function execEditAllotted(id){
  var a=WA_ALLOT.find(function(x){return x.id===id;});if(!a)return;
  document.getElementById('proj-sheet-title').textContent='Edit Allotment';
  document.getElementById('proj-sheet-body').innerHTML=
    '<label class="flbl">Party Name *</label><input class="finp" id="ea-party" value="'+esc(a.party_name||'')+'">'+
    '<label class="flbl">Work Description *</label><input class="finp" id="ea-desc" value="'+esc(a.work_description||'')+'">'+
    '<label class="flbl">Scope</label><input class="finp" id="ea-scope" value="'+esc(a.scope||'')+'">'+
    '<div class="g2"><div><label class="flbl">Qty</label><input class="finp" id="ea-qty" type="number" value="'+(a.qty||'')+'"></div>'+
    '<div><label class="flbl">Unit</label><input class="finp" id="ea-unit" value="'+(a.unit||'')+'"></div></div>'+
    '<label class="flbl">Rate (₹)</label><input class="finp" id="ea-rate" type="number" value="'+(a.rate||'')+'">';
  document.getElementById('proj-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeProjSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="execSaveAllot(\''+id+'\')">💾 Save</button>';
  openSheet('ov-proj','sh-proj');
}

async function execUpdateAllotted(id){await execSaveAllot(id);}
async function execDelAllot(id){
  if(!confirm('Delete this allotment?'))return;
  try{await sbDelete('work_allotments',id);WA_ALLOT=WA_ALLOT.filter(function(a){return a.id!==id;});execRenderAllotted();toast('Deleted','success');}
  catch(e){toast('Error','error');}
}
async function execDelAllotted(id){await execDelAllot(id);}

function execGenPartyDoc(id){
  var a=WA_ALLOT.find(function(x){return x.id===id;});if(!a)return;
  generateWorkOrder(a);
}

function execOpenDailyEntry(){
  document.getElementById('proj-sheet-title').textContent='Daily Progress Entry';
  document.getElementById('proj-sheet-body').innerHTML=
    '<label class="flbl">Date</label><input class="finp" id="dp-date" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<label class="flbl">Category</label><input class="finp" id="dp-cat" placeholder="e.g. RCC, Masonry">'+
    '<label class="flbl">Description *</label><input class="finp" id="dp-desc" placeholder="Work done today">'+
    '<div class="g2"><div><label class="flbl">Qty</label><input class="finp" id="dp-qty" type="number" placeholder="0"></div>'+
    '<div><label class="flbl">Unit</label><input class="finp" id="dp-unit" placeholder="m³"></div></div>'+
    '<label class="flbl">Remarks</label><textarea class="ftxt" id="dp-remarks" placeholder="Additional notes"></textarea>';
  document.getElementById('proj-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeProjSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="execSaveDailyEntry()">💾 Save</button>';
  openSheet('ov-proj','sh-proj');
}

async function execSaveDailyEntry(){
  var desc=gv('dp-desc');if(!desc){toast('Description required','warning');return;}
  try{
    await sbInsert('daily_progress',{project_id:PROJ_MOD_SEL,date:gv('dp-date'),category:gv('dp-cat'),description:desc,qty:parseFloat(gv('dp-qty'))||0,unit:gv('dp-unit'),remarks:gv('dp-remarks')});
    await execLoadItems();closeProjSheet();toast('Entry saved','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

async function execDelDaily(id){
  if(!confirm('Delete this entry?'))return;
  try{await sbDelete('daily_progress',id);WA_DAILY=WA_DAILY.filter(function(d){return d.id!==id;});execRenderDaily();toast('Deleted','success');}
  catch(e){toast('Error','error');}
}

function execOpenBill(editId){
  document.getElementById('proj-sheet-title').textContent='Add Bill';
  document.getElementById('proj-sheet-body').innerHTML=
    '<label class="flbl">Bill No *</label><input class="finp" id="bl-no" placeholder="BILL-001">'+
    '<label class="flbl">Party Name</label><input class="finp" id="bl-party" placeholder="Party name">'+
    '<label class="flbl">Bill Date</label><input class="finp" id="bl-date" type="date">'+
    '<label class="flbl">Bill Amount (₹) *</label><input class="finp" id="bl-amount" type="number" placeholder="0">'+
    '<label class="flbl">Remarks</label><input class="finp" id="bl-remarks" placeholder="Remarks">';
  document.getElementById('proj-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeProjSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="execSaveBill()">💾 Save</button>';
  openSheet('ov-proj','sh-proj');
}

async function execSaveBill(){
  var no=gv('bl-no');if(!no){toast('Bill number required','warning');return;}
  try{
    await sbInsert('bills',{project_id:PROJ_MOD_SEL,bill_no:no,party_name:gv('bl-party'),bill_date:gv('bl-date')||null,bill_amount:parseFloat(gv('bl-amount'))||0,remarks:gv('bl-remarks'),status:'pending'});
    await execLoadItems();closeProjSheet();toast('Bill saved','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

function execOpenPayment(billId){
  var bill=WA_BILLS.find(function(b){return b.id===billId;});if(!bill)return;
  document.getElementById('proj-sheet-title').textContent='Record Payment';
  document.getElementById('proj-sheet-body').innerHTML=
    '<div class="card"><div class="card-title">Bill: '+bill.bill_no+'</div>'+
    ir('Party',bill.party_name||'—')+ir('Bill Amount',fmtINR(bill.bill_amount||0))+ir('Status',bill.status||'pending')+'</div>'+
    '<label class="flbl">Payment Amount (₹) *</label><input class="finp" id="py-amount" type="number" value="'+(bill.bill_amount||'')+'">'+
    '<label class="flbl">Payment Date</label><input class="finp" id="py-date" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<label class="flbl">Payment Mode</label><select class="fsel" id="py-mode"><option>NEFT</option><option>RTGS</option><option>Cheque</option><option>Cash</option></select>';
  document.getElementById('proj-sheet-foot').innerHTML=
    '<button class="btn btn-outline" onclick="closeProjSheet()">Cancel</button>'+
    '<button class="btn btn-navy" onclick="execSavePayment(\''+billId+'\')">💾 Save Payment</button>';
  openSheet('ov-proj','sh-proj');
}

async function execSavePayment(billId){
  try{
    await sbInsert('bill_payments',{bill_id:billId,project_id:PROJ_MOD_SEL,amount:parseFloat(gv('py-amount'))||0,payment_date:gv('py-date')||null,payment_mode:gv('py-mode')});
    await sbUpdate('bills',billId,{status:'paid'});
    await execLoadItems();closeProjSheet();toast('Payment recorded','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

async function execDelPayment(id){
  if(!confirm('Delete payment?'))return;
  try{await sbDelete('bill_payments',id);toast('Deleted','success');}catch(e){toast('Error','error');}
}

// ── DOCUMENT GENERATION ───────────────────────────────────
function generateWorkOrder(allot){
  var co=typeof COMPANY_DATA!=='undefined'?COMPANY_DATA:{};
  var amt=(allot.qty||0)*(allot.rate||0);
  var html='<html><head><title>Work Order</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto;}h1{font-size:24px;font-weight:900;}table{width:100%;border-collapse:collapse;margin:16px 0;}th,td{border:1px solid #ccc;padding:8px 12px;text-align:left;}th{background:#f0f0f0;font-weight:700;}.ft{display:flex;justify-content:space-between;margin-top:60px;}.sg{border-top:1px solid #333;padding-top:8px;font-size:12px;color:#555;min-width:180px;}</style></head>'+
    '<body><div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:20px;"><h1>WORK ORDER</h1><div style="font-size:13px;color:#555;">'+(co.name||'AIPL Construction')+'</div><div style="font-size:11px;color:#777;">'+(co.address||'')+'</div></div>'+
    '<table><tr><td><strong>Work Order No:</strong> WO-'+Date.now().toString().slice(-6)+'</td><td><strong>Date:</strong> '+new Date().toLocaleDateString('en-IN')+'</td></tr>'+
    '<tr><td colspan="2"><strong>Party:</strong> '+(allot.party_name||'—')+'</td></tr>'+
    '<tr><td colspan="2"><strong>Work:</strong> '+(allot.work_description||'—')+'</td></tr></table>'+
    '<table><tr><th>Description</th><th>Scope</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr>'+
    '<tr><td>'+(allot.work_description||'—')+'</td><td>'+(allot.scope||'—')+'</td><td>'+(allot.qty||0)+'</td><td>'+(allot.unit||'LS')+'</td><td>'+fmtINR(allot.rate||0)+'</td><td>'+fmtINR(amt)+'</td></tr>'+
    '<tr><td colspan="5" style="text-align:right;font-weight:700;">Total</td><td><strong>'+fmtINR(amt)+'</strong></td></tr></table>'+
    '<div class="ft"><div class="sg">Authorized Signatory<br><br>'+(co.name||'AIPL')+'</div><div class="sg">Party Acknowledgement<br><br>'+(allot.party_name||'')+'</div></div></body></html>';
  var w=window.open('','_blank');if(w){w.document.write(html);w.document.close();}else toast('Allow popups','warning');
}

function generatePurchaseOrder(allot){generateWorkOrder(allot);}
function generateCombinedDoc(allot){generateWorkOrder(allot);}
function execRegenDoc(id){var a=WA_ALLOT.find(function(x){return x.id===id;});if(a)generateWorkOrder(a);}
function execGenCombinedDoc(id){var a=WA_ALLOT.find(function(x){return x.id===id;});if(a)generateCombinedDoc(a);}

function execPrintOrder(id){var o=WA_ORDERS.find(function(x){return x.id===id;});if(o)toast('Print order '+o.order_no,'info');}
async function execDeleteOrder(id){
  if(!confirm('Delete order?'))return;
  try{await sbDelete('work_orders',id);WA_ORDERS=WA_ORDERS.filter(function(o){return o.id!==id;});execRenderOrders();toast('Deleted','success');}
  catch(e){toast('Error','error');}
}
function execViewOrder(id){toast('View order','info');}
