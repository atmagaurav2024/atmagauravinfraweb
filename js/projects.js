// ════ PROJECTS ════════════════════════════════════════════
var PROJ_DATA=[],PROJ_EDIT_ID=null;
var PROJ_MOD_TAB = 'projects';
var PROJ_MOD_SEL_ID = '';

function projModSelChange(){
  var sel = document.getElementById('proj-mod-sel');
  PROJ_MOD_SEL_ID = sel ? sel.value : '';
  WA_LOADED_PROJ = ''; // clear cache so next exec tab switch fetches fresh
  projModLoadTab();
}

async function projModLoadProjects(){
  var sel = document.getElementById('proj-mod-sel');
  if(!sel) return;
  if(!PROJ_DATA || !PROJ_DATA.length){
    try{
      var rows = await sbFetch('projects',{select:'*',order:'name.asc'});
      PROJ_DATA = Array.isArray(rows) ? rows : [];
    }catch(e){ PROJ_DATA = []; }
  }
  var prev = PROJ_MOD_SEL_ID;
  sel.innerHTML = '<option value="">— Select Project —</option>'+
    PROJ_DATA.map(function(p){
      return '<option value="'+p.id+'"'+(p.id===prev?' selected':'')+'>'+
        (p.name||'Unnamed')+(p.code?' ('+p.code+')':'')+
      '</option>';
    }).join('');
}

function projModLoadTab(){
  var el = document.getElementById('proj-mod-content');
  if(!el) return;
  var projId = PROJ_MOD_SEL_ID;

  if(PROJ_MOD_TAB === 'projects'){
    el.innerHTML = '<div style="padding:0 0 6px;"><div class="search-bar"><span style="font-size:16px;color:var(--text3);">&#128269;</span><input type="text" id="proj-search" placeholder="Search projects..." oninput="searchProj(this.value)"></div></div><div id="proj-list"><div style="text-align:center;padding:40px;color:var(--text3);">&#9203; Loading...</div></div>';
    loadProjData(); return;
  }
  if(!projId){
    el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text3);"><div style="font-size:36px;margin-bottom:10px;">&#128207;</div><div style="font-weight:700;font-size:14px;">Select a project above</div></div>';
    return;
  }

  // Inject hidden selector then call load function
  var configs = {
    boq:      {cont:'boq-content',  sel:'boq-proj-sel',  fn: function(){ boqLoadItems(); }},
    jm:       {cont:'jm-content',   sel:'jm-proj-sel',   fn: function(){ jmLoadItems(); }},
    planning: {cont:'plan-content', sel:'plan-proj-sel',  fn: function(){ planLoadItems(); }},
    rr:       {cont:'rr-content',   sel:'rr-proj-sel',    fn: function(){ rrLoadItems(); }},
    execution:{cont:'exec-content', sel:'exec-proj-sel',  fn: function(){ WA_SUBTAB='allot'; execSwitchTab(); }},
    allotted: {cont:'exec-content', sel:'exec-proj-sel',  fn: function(){ WA_SUBTAB='allotted'; execSwitchTab(); }},
    daily:    {cont:'exec-content', sel:'exec-proj-sel',  fn: function(){ WA_SUBTAB='daily'; execSwitchTab(); }},
    bills:    {cont:'exec-content', sel:'exec-proj-sel',  fn: function(){ WA_SUBTAB='bills'; execSwitchTab(); }},
    orders:   {cont:'exec-content', sel:'exec-proj-sel',  fn: function(){ WA_SUBTAB='orders'; execSwitchTab(); }}
  };
  var cfg = configs[PROJ_MOD_TAB];
  if(!cfg) return;
  el.innerHTML = '<select id="'+cfg.sel+'" style="display:none;"><option value="'+projId+'" selected></option></select>'+
                 '<div id="'+cfg.cont+'"><div style="text-align:center;padding:40px;color:var(--text3);">&#9203; Loading...</div></div>';
  cfg.fn();
}

function projModTab(tab, btn){
  // Permission check
  if(currentUser && currentUser.role!=='admin'){
    var key = (tab==='daily'||tab==='bills') ? 'proj-'+tab : 'proj-'+tab;
    if(!canAccess(key,'view') && !canAccess('proj-execution','view')){
      toast('Access denied — no permission for '+tab,'warning');
      return;
    }
  }
  PROJ_MOD_TAB = tab;
  ['projects','boq','jm','planning','execution','allotted','daily','bills','orders'].forEach(function(t){
    var b = document.getElementById('pmt-'+t);
    if(b){ b.style.background = t===tab?'rgba(255,255,255,.2)':'transparent'; b.style.color = t===tab?'white':'rgba(255,255,255,.6)'; }
  });
  var addBtn = document.getElementById('proj-mod-add-btn');
  if(addBtn) addBtn.style.display = (tab==='projects'||tab==='boq') ? '' : 'none';
  var selRow = document.getElementById('proj-mod-sel-row');
  if(selRow) selRow.style.display = tab==='projects' ? 'none' : '';
  projModLoadTab();
}

function projModAdd(){
  if(PROJ_MOD_TAB==='projects') openProjForm(null);
  else if(PROJ_MOD_TAB==='boq') boqOpenAddItem(null);
}

function initProjects(){
  // Inject RR tab button after Planning if not already present
  if(!document.getElementById('pmt-rr')){
    var planBtn=document.getElementById('pmt-planning');
    if(planBtn){
      var rrBtn=document.createElement('button');
      rrBtn.id='pmt-rr';
      rrBtn.onclick=function(){projModTab('rr',rrBtn);};
      rrBtn.style.cssText='padding:6px 12px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;border:none;font-family:Nunito,sans-serif;border-radius:8px;background:transparent;color:rgba(255,255,255,.6);';
      rrBtn.innerHTML='&#128203; RR';
      planBtn.parentNode.insertBefore(rrBtn, planBtn.nextSibling);
    }
  }
  ['projects','boq','jm','planning','execution','allotted','daily','bills','orders'].forEach(function(t){
    var b = document.getElementById('pmt-'+t);
    if(!b) return;
    var hasAccess = (currentUser && currentUser.role==='admin') ||
                    !Object.keys(USER_PERMISSIONS).length ||
                    canAccess('proj-'+t,'view') ||
                    canAccess('proj-execution','view'); // daily & bills share execution permission
    b.style.display = hasAccess ? '' : 'none';
  });
  var tabs = ['projects','boq','jm','planning','rr','execution','allotted','daily','bills','orders'];
  var firstTab = tabs.find(function(t){
    return (currentUser && currentUser.role==='admin') ||
           !Object.keys(USER_PERMISSIONS).length ||
           canAccess('proj-'+t,'view') ||
           (t==='daily'||t==='bills') && canAccess('proj-execution','view') ||
           t==='rr' && (canAccess('proj-planning','view')||canAccess('proj-execution','view'));
  }) || 'projects';
  projModTab(firstTab, document.getElementById('pmt-'+firstTab));
  projModLoadProjects();
}

// ── PROJECT LIST ──────────────────────────────────────────────────────
async function loadProjData(){
  var el = document.getElementById('proj-list'); if(!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">&#9203; Loading...</div>';
  try{
    var rows = await sbFetch('projects',{select:'*',order:'name.asc'});
    PROJ_DATA = Array.isArray(rows) ? rows : [];
    renderProjList();
    // Also refresh shared selector
    projModLoadProjects();
  }catch(e){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">Error loading projects</div>';
    console.error(e);
  }
}

function renderProjList(list){
  var el = document.getElementById('proj-list'); if(!el) return;
  list = list || PROJ_DATA;
  if(!list.length){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);"><div style="font-size:36px;">&#127959;</div><div style="font-weight:700;margin-top:10px;">No projects yet</div><div style="font-size:12px;margin-top:6px;">Tap + to add</div></div>';
    return;
  }
  var statusMap = {
    'in-progress':{label:'In Progress',col:'#1565C0'},
    'under-dlp':{label:'Under DLP',col:'#F57F17'},
    'fully-completed':{label:'Completed',col:'#2E7D32'},
    'planning':{label:'Planning',col:'#6A1B9A'},
    'rr':      {label:'RR',col:'#00838F'},
    'active':{label:'Active',col:'#1565C0'}
  };
  el.innerHTML = list.map(function(p){
    var st = statusMap[p.status]||{label:p.status||'Active',col:'#1565C0'};
    return '<div style="background:white;border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;cursor:pointer;" onclick="openProjForm(\''+p.id+'\')">'+
      '<div style="padding:12px 14px;display:flex;align-items:center;gap:12px;">'+
        '<div style="width:44px;height:44px;border-radius:12px;background:'+st.col+'20;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">&#127959;</div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:14px;font-weight:800;color:var(--navy);">'+esc(p.name||'Unnamed')+'</div>'+
          '<div style="font-size:11px;color:var(--text3);margin-top:2px;">'+(p.code||'—')+' &bull; '+(p.client||'—')+'</div>'+
        '</div>'+
        '<span style="font-size:10px;font-weight:700;padding:4px 8px;border-radius:6px;background:'+st.col+'15;color:'+st.col+';">'+st.label+'</span>'+
      '</div>'+
      (p.location?'<div style="padding:0 14px 10px;font-size:11px;color:var(--text3);">&#128205; '+esc(p.location)+'</div>':'')+
    '</div>';
  }).join('');
}

function searchProj(q){
  if(!q.trim()){renderProjList();return;}
  q=q.toLowerCase();
  renderProjList(PROJ_DATA.filter(function(p){
    return (p.name||'').toLowerCase().includes(q)||
           (p.client||'').toLowerCase().includes(q)||
           (p.code||'').toLowerCase().includes(q)||
           (p.location||'').toLowerCase().includes(q);
  }));
}

function openProjForm(id){
  var p = id ? (PROJ_DATA.find(function(x){return x.id===id;})||{}) : {};
  var statusOpts = ['in-progress','under-dlp','fully-completed','planning','active'].map(function(s){
    var labels={'in-progress':'In Progress','under-dlp':'Under DLP','fully-completed':'Completed','planning':'Planning','active':'Active'};
    return '<option value="'+s+'"'+(p.status===s?' selected':'')+'>'+labels[s]+'</option>';
  }).join('');
  var html =
    '<div class="g2"><div><label class="flbl">Project Name *</label><input id="pf-name" class="finp" value="'+esc(p.name||'')+'"></div>'+
    '<div><label class="flbl">Project Code</label><input id="pf-code" class="finp" value="'+esc(p.code||'')+'"></div></div>'+
    '<div class="g2"><div><label class="flbl">Client / Owner</label><input id="pf-client" class="finp" value="'+esc(p.client||'')+'"></div>'+
    '<div><label class="flbl">Status</label><select id="pf-status" class="fsel">'+statusOpts+'</select></div></div>'+
    '<label class="flbl">Location / Site</label><input id="pf-location" class="finp" value="'+esc(p.location||'')+'">'+
    '<div class="g2"><div><label class="flbl">Start Date</label><input id="pf-start" class="finp" type="date" value="'+esc(p.start_date||'')+'"></div>'+
    '<div><label class="flbl">End Date</label><input id="pf-end" class="finp" type="date" value="'+esc(p.end_date||'')+'"></div></div>'+
    '<label class="flbl">Contract Value (₹)</label><input id="pf-value" class="finp" type="number" value="'+(p.contract_value||'')+'">'+
    '<label class="flbl">Description</label><textarea id="pf-desc" class="ftxt">'+esc(p.description||'')+'</textarea>';
  document.getElementById('proj-sheet-title').textContent = id ? 'Edit Project' : 'New Project';
  document.getElementById('proj-sheet-body').innerHTML = html;
  var foot = document.getElementById('proj-sheet-foot');
  foot.innerHTML = '';
  if(id){
    var delBtn = document.createElement('button');
    delBtn.className='btn btn-outline'; delBtn.style.color='#C62828'; delBtn.textContent='Delete';
    delBtn.onclick = function(){ if(confirm('Delete this project?')) deleteProjItem(id); };
    foot.appendChild(delBtn);
  }
  var saveBtn = document.createElement('button');
  saveBtn.className='btn btn-navy'; saveBtn.innerHTML='&#10003; Save Project';
  saveBtn.onclick = function(){ saveProjForm(id||null); };
  foot.appendChild(saveBtn);
  openSheet('ov-proj','sh-proj');
}

function closeProjSheet(){ closeSheet('ov-proj','sh-proj'); }

async function saveProjForm(editId){
  var name = (document.getElementById('pf-name')||{value:''}).value.trim();
  if(!name){toast('Project name required','warning');return;}
  var data = {
    name:name,
    code:(document.getElementById('pf-code')||{value:''}).value.trim()||null,
    client:(document.getElementById('pf-client')||{value:''}).value.trim()||null,
    status:(document.getElementById('pf-status')||{value:'active'}).value||'active',
    location:(document.getElementById('pf-location')||{value:''}).value.trim()||null,
    start_date:(document.getElementById('pf-start')||{value:''}).value||null,
    end_date:(document.getElementById('pf-end')||{value:''}).value||null,
    contract_value:parseFloat((document.getElementById('pf-value')||{value:''}).value)||null,
    description:(document.getElementById('pf-desc')||{value:''}).value.trim()||null
  };
  try{
    if(editId){
      await sbUpdate('projects',editId,data);
      var idx=PROJ_DATA.findIndex(function(p){return p.id===editId;});
      if(idx>-1) PROJ_DATA[idx]=Object.assign(PROJ_DATA[idx],data);
      toast('Project updated!','success');
    } else {
      var res=await sbInsert('projects',data);
      if(res&&res[0]) PROJ_DATA.push(res[0]);
      toast('Project added!','success');
    }
    closeProjSheet();
    renderProjList();
    projModLoadProjects();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function deleteProjItem(id){
  try{
    await sbDelete('projects',id);
    PROJ_DATA=PROJ_DATA.filter(function(p){return p.id!==id;});
    closeProjSheet();
    renderProjList();
    projModLoadProjects();
    toast('Project deleted','success');
  }catch(e){toast('Error: '+e.message,'error');}
}


function openBOQSheet(){openSheet('ov-boq','sh-boq');}
function closeBOQSheet(){closeSheet('ov-boq','sh-boq');}
async function boqLoadProjs(){var sel=document.getElementById('boq-proj-sel');if(!sel)return;try{var d=await sbFetch('projects',{select:'id,name',order:'name.asc'});sel.innerHTML='<option value="">— Select Project —</option>'+(Array.isArray(d)?d:[]).map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>';}).join('');}catch(e){}}
async function boqLoadItems(){
  var projId=(document.getElementById('boq-proj-sel')||{}).value||'';
  var el=document.getElementById('boq-content');
  if(!projId){if(el)el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">Select a project</div>';BOQ_ITEMS=[];return;}
  if(el)el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text3);">&#9203; Loading...</div>';
  try{var r=await Promise.all([sbFetch('boq_items',{select:'*',filter:'project_id=eq.'+projId,order:'item_code.asc'}),sbFetch('boq_subitems',{select:'*',filter:'project_id=eq.'+projId,order:'sort_order.asc'})]);BOQ_ITEMS=Array.isArray(r[0])?r[0]:[];BOQ_SUBITEMS=Array.isArray(r[1])?r[1]:[];}catch(e){BOQ_ITEMS=[];console.error(e);}
  boqRender();
}
function boqRender(){
  var el=document.getElementById('boq-content');if(!el)return;
  if(!BOQ_ITEMS.length){el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);"><div style="font-size:36px;">&#128203;</div><div style="font-weight:700;margin-top:10px;">No BOQ items yet</div><div style="font-size:12px;margin-top:6px;">Tap + to add</div></div>';return;}
  var total=BOQ_ITEMS.reduce(function(s,i){return s+(parseFloat(i.boq_qty)||0)*(parseFloat(i.rate)||0);},0);
  el.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;"><div style="background:white;border-radius:12px;padding:12px;border-left:3px solid #4A148C;"><div style="font-size:10px;color:var(--text3);font-weight:700;">ITEMS</div><div style="font-size:20px;font-weight:900;color:#4A148C;">'+BOQ_ITEMS.length+'</div></div><div style="background:white;border-radius:12px;padding:12px;border-left:3px solid #2E7D32;"><div style="font-size:10px;color:var(--text3);font-weight:700;">TOTAL</div><div style="font-size:16px;font-weight:900;color:#2E7D32;">'+fmtINR(total)+'</div></div></div>'+
    BOQ_ITEMS.map(function(item){var bq=parseFloat(item.boq_qty)||0,rate=parseFloat(item.rate)||0;var subs=BOQ_SUBITEMS.filter(function(s){return s.boq_item_id===item.id;});
      return '<div style="background:white;border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;"><div style="padding:10px 14px;background:#F3E5F5;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;"><div style="flex:1;"><span style="font-size:10px;font-family:monospace;background:#EDE7F6;color:#7B1FA2;padding:2px 7px;border-radius:6px;font-weight:700;">'+item.item_code+'</span><div style="font-size:13px;font-weight:800;margin-top:4px;">'+(item.short_name||item.description)+'</div>'+(item.short_name?'<div style="font-size:10px;color:var(--text3);">'+item.description+'</div>':'')+'</div><div style="text-align:right;flex-shrink:0;"><div style="font-size:13px;font-weight:900;color:#4A148C;">'+fmtINR(bq*rate)+'</div><div style="font-size:10px;color:var(--text3);">'+bq+' '+item.unit+' x \u20b9'+rate+'</div></div></div>'+(subs.length?'<div style="padding:8px 14px;font-size:11px;border-bottom:1px solid var(--border);">'+subs.map(function(s){return '<span style="background:#F3E5F5;color:#7B1FA2;border-radius:4px;padding:2px 7px;margin-right:4px;display:inline-block;margin-bottom:2px;">'+s.name+'</span>';}).join('')+'</div>':'')+'<div style="padding:8px 14px;display:flex;gap:8px;justify-content:flex-end;"><button onclick="boqEditItem(\''+item.id+'\')" style="background:none;border:1px solid var(--border);border-radius:8px;color:var(--navy);font-size:11px;font-weight:800;cursor:pointer;padding:4px 12px;">&#9998; Edit</button><button onclick="boqDeleteItem(\''+item.id+'\')" style="background:none;border:1px solid #FFCDD2;border-radius:8px;color:#C62828;font-size:11px;font-weight:800;cursor:pointer;padding:4px 12px;">&#128465;</button></div></div>';
    }).join('');
}
async function boqOpenAddItem(editItem){
  var v=editItem||{};var uomOpts='';
  try{var uoms=await sbFetch('categories',{select:'name',filter:'active=eq.true&type=eq.uom',order:'name.asc'});if(Array.isArray(uoms))uomOpts=uoms.map(function(u){return '<option value="'+u.name+'"'+(u.name===v.unit?' selected':'')+'>'+u.name+'</option>';}).join('');}catch(e){}
  if(!uomOpts)uomOpts='<option>Nos</option><option>Rmt</option><option>Sqm</option><option>Cum</option><option>MT</option><option>Kg</option><option>LS</option>';
  document.getElementById('boq-sheet-title').textContent=editItem?'Edit BOQ Item':'New BOQ Item';
  document.getElementById('boq-sheet-body').innerHTML='<label class="flbl">Item Code *</label><input id="bi-code" class="finp" value="'+(v.item_code||'')+'"><label class="flbl">Description *</label><input id="bi-desc" class="finp" value="'+(v.description||'')+'"><label class="flbl">Short Name</label><input id="bi-short" class="finp" value="'+(v.short_name||'')+'"><div class="g2"><div><label class="flbl">Unit</label><select id="bi-unit" class="fsel">'+uomOpts+'</select></div><div><label class="flbl">BOQ Qty *</label><input id="bi-qty" class="finp" type="number" step="0.001" value="'+(v.boq_qty||'')+'"></div></div><label class="flbl">Rate (\u20b9)</label><input id="bi-rate" class="finp" type="number" step="0.01" value="'+(v.rate||'')+'"><label class="flbl">Remarks</label><textarea id="bi-remarks" class="ftxt">'+(v.remarks||'')+'</textarea>';
  document.getElementById('boq-sheet-foot').innerHTML='<button class="btn btn-outline" onclick="closeBOQSheet()">Cancel</button><button class="btn" style="background:#7B1FA2;color:white;" onclick="boqSaveItem(\''+(editItem?editItem.id:'')+'\')">&#10003; '+(editItem?'Save':'Add')+'</button>';
  openBOQSheet();
}
function boqEditItem(id){var item=BOQ_ITEMS.find(function(i){return i.id===id;});if(!item)return;closeBOQSheet();setTimeout(function(){boqOpenAddItem(item);},320);}
async function boqSaveItem(editId){
  var code=gv('bi-code'),desc=gv('bi-desc'),qty=parseFloat(gv('bi-qty'))||0;
  if(!code||!desc||!qty){toast('Code, description and qty required','warning');return;}
  var projId=(document.getElementById('boq-proj-sel')||{}).value||'';
  var data={project_id:projId,item_code:code,description:desc,short_name:gv('bi-short')||null,unit:(document.getElementById('bi-unit')||{value:'Nos'}).value,boq_qty:qty,rate:parseFloat(gv('bi-rate'))||0,remarks:gv('bi-remarks')||null};
  try{toast('Saving...','info');
    if(editId){await sbUpdate('boq_items',editId,data);var idx=BOQ_ITEMS.findIndex(function(i){return i.id===editId;});if(idx>-1)BOQ_ITEMS[idx]=Object.assign(BOQ_ITEMS[idx],data);toast('Updated!','success');}
    else{var res=await sbInsert('boq_items',data);if(res&&res[0])BOQ_ITEMS.push(res[0]);toast('Added!','success');}
    closeBOQSheet();boqRender();
  }catch(e){toast('Error: '+e.message,'error');}
}
async function boqDeleteItem(id){
  if(!confirm('Delete this BOQ item?\nThis will also delete all planned resources, allotments and WO/POs under it.'))return;
  // Delete WO/POs for resources under this item
  var relOrders=WA_ORDERS.filter(function(o){return o.boq_item_id===id;});
  for(var i=0;i<relOrders.length;i++) try{await sbDelete('work_orders',relOrders[i].id);}catch(e){}
  WA_ORDERS=WA_ORDERS.filter(function(o){return o.boq_item_id!==id;});
  // Delete allotments
  var relAllot=WA_ALLOT.filter(function(a){return a.boq_item_id===id;});
  for(var j=0;j<relAllot.length;j++) try{await sbDelete('boq_exec_resources',relAllot[j].id);}catch(e){}
  WA_ALLOT=WA_ALLOT.filter(function(a){return a.boq_item_id!==id;});
  // Delete planned resources
  var relPlan=WA_PLANNED.filter(function(r){return r.boq_item_id===id;});
  for(var k=0;k<relPlan.length;k++) try{await sbDelete('boq_exec_resources',relPlan[k].id);}catch(e){}
  WA_PLANNED=WA_PLANNED.filter(function(r){return r.boq_item_id!==id;});
  BOQ_ITEMS=BOQ_ITEMS.filter(function(i){return i.id!==id;});
  boqRender();
  try{await sbDelete('boq_items',id);}catch(e){console.error(e);}
  toast('BOQ item and all related records deleted','success');
}

// ════ JM ════════════════════════════════════════════════
var JM_ITEMS=[],JM_JMS=[];
function initJM(){jmLoadProjs();}
async function jmLoadProjs(){var sel=document.getElementById('jm-proj-sel');if(!sel)return;try{var d=await sbFetch('projects',{select:'id,name',order:'name.asc'});sel.innerHTML='<option value="">— Select Project —</option>'+(Array.isArray(d)?d:[]).map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>';}).join('');}catch(e){}}
async function jmLoadItems(){
  var projId=(document.getElementById('jm-proj-sel')||{}).value||'';var el=document.getElementById('jm-content');
  if(!projId){if(el)el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">Select a project</div>';return;}
  if(el)el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text3);">&#9203; Loading...</div>';
  try{var r=await Promise.all([sbFetch('boq_items',{select:'*',filter:'project_id=eq.'+projId,order:'item_code.asc'}),sbFetch('boq_jm',{select:'*',filter:'project_id=eq.'+projId,order:'created_at.asc'})]);JM_ITEMS=Array.isArray(r[0])?r[0]:[];JM_JMS=Array.isArray(r[1])?r[1]:[];}catch(e){JM_ITEMS=[];console.error(e);}
  jmRender();
}
function jmRender(){
  var el=document.getElementById('jm-content');if(!el)return;
  if(!JM_ITEMS.length){el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">No BOQ items. Add BOQ items first.</div>';return;}
  el.innerHTML=JM_ITEMS.map(function(item){
    var boqQty=parseFloat(item.boq_qty)||0;var iJMs=JM_JMS.filter(function(j){return j.boq_item_id===item.id;});
    var totalJM=iJMs.reduce(function(s,j){return s+(parseFloat(j.jm_qty)||0);},0);
    var balance=boqQty-totalJM;var pct=boqQty>0?Math.min(100,Math.round(totalJM/boqQty*100)):0;
    return '<div style="background:white;border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;"><div style="padding:10px 14px;background:#E8EAF6;display:flex;align-items:center;gap:8px;"><div style="flex:1;"><span style="font-size:10px;font-family:monospace;background:#C5CAE9;color:#283593;padding:2px 7px;border-radius:4px;">'+item.item_code+'</span><div style="font-size:13px;font-weight:800;margin-top:3px;">'+(item.short_name||item.description)+'</div></div><button onclick="jmOpenAdd(\''+item.id+'\','+boqQty+',\''+item.unit+'\')" style="background:#283593;color:white;border:none;border-radius:8px;padding:5px 12px;font-size:11px;font-weight:800;cursor:pointer;">+ JM</button></div><div style="padding:4px 14px;font-size:10px;color:var(--text3);background:#F3F4F6;display:flex;justify-content:space-between;"><span>BOQ: '+boqQty+' '+item.unit+' | JM: '+totalJM+' | Balance: <b style="color:'+(balance<0?'#C62828':'#283593')+'">'+balance.toFixed(3).replace(/\.?0+$/,'')+'</b></span><span>'+pct+'%</span></div><div style="height:4px;background:#E8EAF6;"><div style="height:100%;width:'+pct+'%;background:#283593;"></div></div><div style="padding:8px 14px;">'+(iJMs.length?iJMs.map(function(jm){return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);"><span style="background:#283593;color:white;font-size:10px;font-weight:800;padding:2px 7px;border-radius:5px;">JM-'+jm.jm_number+'</span><div style="flex:1;"><div style="font-size:12px;font-weight:700;">'+jm.jm_qty+' '+item.unit+'</div><div style="font-size:10px;color:var(--text3);">'+jm.date+(jm.reference?' \u00b7 '+jm.reference:'')+'</div></div><button onclick="jmDelete(\''+jm.id+'\')" style="background:none;border:none;color:#C62828;font-size:16px;cursor:pointer;">\u00d7</button></div>';}).join(''):'<div style="font-size:11px;color:var(--text3);padding:6px 0;">No JMs yet</div>')+'</div></div>';
  }).join('');
}
function jmOpenAdd(itemId,boqQty,unit,editJM){
  var iJMs=JM_JMS.filter(function(j){return j.boq_item_id===itemId;});
  var usedQty=iJMs.reduce(function(s,j){return s+(parseFloat(j.jm_qty)||0);},0);
  if(editJM)usedQty-=parseFloat(editJM.jm_qty)||0;
  var remaining=(boqQty||0)-usedQty;var jmNum=editJM?editJM.jm_number:iJMs.length+1;
  document.getElementById('jm-sheet-title').textContent=editJM?'Edit JM-'+jmNum:'New JM-'+jmNum;
  document.getElementById('jm-sheet-body').innerHTML='<div style="background:#E8EAF6;border-radius:12px;padding:10px 14px;margin-bottom:12px;"><div style="font-size:11px;font-weight:800;color:#283593;">JM-'+jmNum+'</div><div style="font-size:18px;font-weight:900;color:#283593;">Balance: '+remaining.toFixed(3).replace(/\.?0+$/,'')+' '+unit+'</div></div><div class="g2"><div><label class="flbl">Date *</label><input id="jm-f-date" class="finp" type="date" value="'+(editJM?editJM.date:new Date().toISOString().slice(0,10))+'"></div><div><label class="flbl">Qty *</label><input id="jm-f-qty" class="finp" type="number" step="0.001" value="'+(editJM?editJM.jm_qty:'')+'"></div></div><label class="flbl">Reference</label><input id="jm-f-ref" class="finp" value="'+(editJM&&editJM.reference?editJM.reference:'')+'">';
  document.getElementById('jm-sheet-foot').innerHTML='<button class="btn btn-outline" onclick="closeSheet(\'ov-jm\',\'sh-jm\')">Cancel</button><button class="btn" style="background:#283593;color:white;" onclick="jmSave(\''+itemId+'\','+boqQty+',\''+unit+'\','+(editJM?'\''+editJM.id+'\'':'null')+','+jmNum+')">&#10003; '+(editJM?'Save':'Add')+'</button>';
  openSheet('ov-jm','sh-jm');
}
async function jmSave(itemId,boqQty,unit,editId,jmNum){
  var date=gv('jm-f-date'),qty=parseFloat(gv('jm-f-qty'))||0,ref=gv('jm-f-ref')||null;
  if(!date||!qty){toast('Date and qty required','warning');return;}
  var iJMs=JM_JMS.filter(function(j){return j.boq_item_id===itemId;});
  var usedQty=iJMs.reduce(function(s,j){return s+(parseFloat(j.jm_qty)||0);},0);
  if(editId){var old=JM_JMS.find(function(j){return j.id===editId;});if(old)usedQty-=parseFloat(old.jm_qty)||0;}
  if(usedQty+qty>boqQty){toast('Exceeds BOQ balance!','error');return;}
  var projId=(document.getElementById('jm-proj-sel')||{}).value||'';
  try{toast('Saving...','info');
    if(editId){await sbUpdate('boq_jm',editId,{date:date,jm_qty:qty,reference:ref});var j=JM_JMS.find(function(x){return x.id===editId;});if(j){j.date=date;j.jm_qty=qty;j.reference=ref;}toast('Updated!','success');}
    else{var res=await sbInsert('boq_jm',{project_id:projId,boq_item_id:itemId,jm_number:jmNum,date:date,jm_qty:qty,reference:ref});if(res&&res[0])JM_JMS.push(res[0]);toast('JM-'+jmNum+' added!','success');}
    closeSheet('ov-jm','sh-jm');jmRender();
  }catch(e){toast('Error: '+e.message,'error');}
}
async function jmDelete(id){if(!confirm('Delete?'))return;JM_JMS=JM_JMS.filter(function(j){return j.id!==id;});jmRender();try{await sbDelete('boq_jm',id);}catch(e){console.error(e);}}

// ════ PLANNING ════════════════════════════════════════════
var PLAN_ITEMS=[],PLAN_SUBS=[],PLAN_RES=[];
function initPlanning(){planLoadProjs();}
async function planLoadProjs(){var sel=document.getElementById('plan-proj-sel');if(!sel)return;try{var d=await sbFetch('projects',{select:'id,name',order:'name.asc'});sel.innerHTML='<option value="">— Select Project —</option>'+(Array.isArray(d)?d:[]).map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>';}).join('');}catch(e){}}
async function planLoadItems(){
  var projId=(document.getElementById('plan-proj-sel')||{}).value||'';var el=document.getElementById('plan-content');
  if(!projId){if(el)el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">Select a project</div>';return;}
  if(el)el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text3);">&#9203; Loading...</div>';
  try{var r=await Promise.all([sbFetch('boq_items',{select:'*',filter:'project_id=eq.'+projId,order:'item_code.asc'}),sbFetch('boq_subitems',{select:'*',filter:'project_id=eq.'+projId,order:'sort_order.asc'}),sbFetch('boq_exec_resources',{select:'*',filter:'project_id=eq.'+projId+'&exec_type=eq.planned',order:'created_at.asc'})]);PLAN_ITEMS=Array.isArray(r[0])?r[0]:[];PLAN_SUBS=Array.isArray(r[1])?r[1]:[];PLAN_RES=Array.isArray(r[2])?r[2]:[];}catch(e){PLAN_ITEMS=[];console.error(e);}
  planRender();
}
function planRender(){
  var el=document.getElementById('plan-content');if(!el)return;
  if(!PLAN_ITEMS.length){el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">No BOQ items found</div>';return;}
  el.innerHTML=PLAN_ITEMS.map(function(item){
    var iSubs=PLAN_SUBS.filter(function(s){return s.boq_item_id===item.id;});
    var iRes=PLAN_RES.filter(function(r){return r.boq_item_id===item.id;});
    var totalPlan=iRes.reduce(function(s,r){return s+(parseFloat(r.qty)||0)*(parseFloat(r.rate)||0);},0);
    var subsHtml=iSubs.length?iSubs.map(function(sub){var sRes=iRes.filter(function(r){return r.boq_subitem_id===sub.id;});
      return '<div style="margin-bottom:6px;"><div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#E3F2FD;border-radius:8px;"><div style="font-size:11px;font-weight:800;color:#1565C0;">'+sub.name+'</div><div style="display:flex;gap:4px;"><button onclick="planAddRes(\''+sub.id+'\',\''+item.id+'\',\''+item.unit+'\')" style="background:#1565C0;color:white;border:none;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:800;cursor:pointer;">+ Resource</button><button onclick="planEditSub(\''+sub.id+'\')" style="background:#BBDEFB;border:none;color:#1565C0;font-size:11px;border-radius:5px;padding:2px 7px;cursor:pointer;font-weight:800;">&#9998;</button><button onclick="planDelSub(\''+sub.id+'\')" style="background:none;border:none;color:#C62828;font-size:13px;cursor:pointer;">\u00d7</button></div></div>'+sRes.map(function(r){return (function(){
  var links=[];
  if(r.jm_links) try{links=typeof r.jm_links==='string'?JSON.parse(r.jm_links):r.jm_links;}catch(ex){}
  var jmTotal=links.reduce(function(s,l){return s+(parseFloat(l.plan_qty)||0);},0);
  var jmTotalBoqQty=links.reduce(function(s,l){return s+(parseFloat(l.jm_qty||l.plan_qty)||0);},0);
  var jmBal=jmTotalBoqQty>0?Math.max(0,jmTotalBoqQty-jmTotal):null;
  var jmLine=links.length?'<div style="font-size:9px;margin-top:2px;color:#1565C0;">'+
    links.map(function(l){return 'JM-'+(l.jm_number||'?')+': '+l.plan_qty;}).join(' | ')+
    ' | <b>Total: '+jmTotal+'</b>'+(jmBal!==null?' | Bal: '+jmBal.toFixed(2).replace(/\.?0+$/, ''):'')+'</div>':'';
  return '<div style="padding:5px 10px;background:#F8F9FF;border-radius:8px;margin-top:3px;">'+
    '<div style="display:flex;align-items:center;gap:6px;">'+
      '<div style="flex:1;font-size:11px;font-weight:600;">'+r.party_name+(r.resource_category?'<span style="font-size:9px;background:#E3F2FD;color:#1565C0;padding:1px 5px;border-radius:3px;margin-left:4px;">'+r.resource_category+'</span>':'')+
        jmLine+
      '</div>'+
      '<div style="text-align:right;flex-shrink:0;">'+
        '<div style="font-size:10px;color:var(--text3);">'+r.qty+' '+(r.unit||'')+' @ ₹'+r.rate+'</div>'+
        '<div style="font-size:11px;font-weight:800;color:#1565C0;">'+fmtINR((r.qty||0)*(r.rate||0))+'</div>'+
      '</div>'+
      '<button onclick="planEditRes(\''+r.id+'\',\''+r.boq_subitem_id+'\',\''+r.boq_item_id+'\')" style="background:#E3F2FD;border:none;color:#1565C0;font-size:11px;border-radius:5px;padding:2px 7px;cursor:pointer;font-weight:800;">&#9998;</button>'+
      '<button onclick="planDelRes(\''+r.id+'\')" style="background:none;border:none;color:#C62828;font-size:13px;cursor:pointer;">×</button>'+
    '</div>'+
  '</div>';
})();}).join('')+'</div>';
    }).join(''):'<div style="font-size:11px;color:var(--text3);padding:6px 0;">No activities yet</div>';
    var noSubRes=iRes.filter(function(r){return !r.boq_subitem_id;});
    var noSubHtml=noSubRes.length?noSubRes.map(function(r){return (function(){
  var links=[];if(r.jm_links)try{links=typeof r.jm_links==="string"?JSON.parse(r.jm_links):r.jm_links;}catch(ex){}
  var jmTotal=links.reduce(function(s,l){return s+(parseFloat(l.plan_qty)||0);},0);
  var jmTBQ=links.reduce(function(s,l){return s+(parseFloat(l.jm_qty||l.plan_qty)||0);},0);
  var jmBal=jmTBQ>0?Math.max(0,jmTBQ-jmTotal):null;
  var jmLine=links.length?'<div style="font-size:9px;margin-top:2px;color:#1565C0;">'+links.map(function(l){return 'JM-'+(l.jm_number||'?')+': '+l.plan_qty;}).join(' | ')+' | <b>Total: '+jmTotal+'</b>'+(jmBal!==null?' | Bal: '+jmBal.toFixed(2).replace(/\.?0+$/,''):'')+'</div>':'';
  return '<div style="padding:5px 10px;background:#F8F9FF;border-radius:8px;margin-top:3px;"><div style="display:flex;align-items:center;gap:6px;"><div style="flex:1;font-size:11px;font-weight:600;">'+r.party_name+(r.resource_category?'<span style="font-size:9px;background:#E3F2FD;color:#1565C0;padding:1px 5px;border-radius:3px;margin-left:4px;">'+r.resource_category+'</span>':'')+jmLine+'</div><div style="text-align:right;flex-shrink:0;"><div style="font-size:10px;color:var(--text3);">'+r.qty+' '+(r.unit||'')+' @ \u20b9'+r.rate+'</div><div style="font-size:11px;font-weight:800;color:#1565C0;">'+fmtINR((r.qty||0)*(r.rate||0))+'</div></div><button onclick="planEditRes(\''+r.id+'\',\''+r.boq_subitem_id+'\',\''+r.boq_item_id+'\')" style="background:#E3F2FD;border:none;color:#1565C0;font-size:11px;border-radius:5px;padding:2px 7px;cursor:pointer;font-weight:800;">&#9998;</button><button onclick="planDelRes(\''+r.id+'\')" style="background:none;border:none;color:#C62828;font-size:13px;cursor:pointer;">\u00d7</button></div></div>';
})();}).join(''):'';
    return '<div style="background:white;border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;"><div style="padding:10px 14px;background:#E3F2FD;display:flex;align-items:center;justify-content:space-between;"><div><span style="font-size:10px;font-family:monospace;background:#BBDEFB;color:#1565C0;padding:2px 7px;border-radius:4px;">'+item.item_code+'</span><span style="font-size:13px;font-weight:800;margin-left:8px;">'+(item.short_name||item.description)+'</span><div style="font-size:10px;color:var(--text3);margin-top:2px;">BOQ: '+item.boq_qty+' '+item.unit+'</div></div><div style="display:flex;align-items:center;gap:6px;">'+(totalPlan?'<span style="font-size:12px;font-weight:900;color:#1565C0;">'+fmtINR(totalPlan)+'</span>':'')+'<button onclick="planAddSub(\''+item.id+'\')" style="background:#1565C0;color:white;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer;">+ Activity</button></div></div><div style="padding:10px 14px;">'+(subsHtml+noSubHtml||'<div style="font-size:11px;color:var(--text3);">No resources yet</div>')+'</div></div>';
  }).join('');
}
function planAddSub(itemId){document.getElementById('plan-sheet-title').textContent='Add Work Activity';document.getElementById('plan-sheet-body').innerHTML='<label class="flbl">Activity Name *</label><input id="ps-name" class="finp" placeholder="e.g. Bar Bending, Shuttering...">';document.getElementById('plan-sheet-foot').innerHTML='<button class="btn btn-outline" onclick="closeSheet(\'ov-plan\',\'sh-plan\')">Cancel</button><button class="btn" style="background:#1565C0;color:white;" onclick="planSaveSub(\''+itemId+'\')">+ Add</button>';openSheet('ov-plan','sh-plan');}
async function planSaveSub(itemId){var name=(document.getElementById('ps-name')||{value:''}).value.trim();if(!name){toast('Name required','warning');return;}var projId=(document.getElementById('plan-proj-sel')||{}).value||'';var sortOrder=PLAN_SUBS.filter(function(s){return s.boq_item_id===itemId;}).length+1;try{var res=await sbInsert('boq_subitems',{project_id:projId,boq_item_id:itemId,name:name,sort_order:sortOrder});if(res&&res[0])PLAN_SUBS.push(res[0]);toast(name+' added','success');closeSheet('ov-plan','sh-plan');planRender();}catch(e){toast('Error: '+e.message,'error');}}

function planEditSub(id){
  var sub=PLAN_SUBS.find(function(s){return s.id===id;});
  if(!sub){toast('Activity not found','warning');return;}
  document.getElementById('plan-sheet-title').textContent='Edit Activity';
  document.getElementById('plan-sheet-body').innerHTML=
    '<label class="flbl">Activity Name *</label>'+
    '<input id="ps-name-edit" class="finp" value="'+esc(sub.name||'')+'" placeholder="Activity name">';
  var sf=document.getElementById('plan-sheet-foot');
  sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-plan','sh-plan');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#1565C0;color:white;';
  sb.innerHTML='&#10003; Update';
  sb.onclick=function(){planUpdateSub(id);};
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-plan','sh-plan');
}

async function planUpdateSub(id){
  var name=(document.getElementById('ps-name-edit')||{value:''}).value.trim();
  if(!name){toast('Activity name required','warning');return;}
  try{
    await sbUpdate('boq_subitems',id,{name:name});
    var idx=PLAN_SUBS.findIndex(function(s){return s.id===id;});
    if(idx>-1) PLAN_SUBS[idx].name=name;
    toast('Activity updated!','success');
    closeSheet('ov-plan','sh-plan');
    planRender();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}


async function loadUomIfNeeded(){
  try{
    var rows=await Promise.all([
      sbFetch('categories',{select:'id,name,icon,active',filter:'type=eq.uom&active=eq.true',order:'name.asc'}),
      sbFetch('categories',{select:'id,name,icon,active',filter:'type=eq.resource&active=eq.true',order:'name.asc'})
    ]);
    if(Array.isArray(rows[0])&&rows[0].length)
      CAT_DATA['uom']=rows[0].map(function(r){return {id:r.id,name:r.name,icon:r.icon||'',active:r.active!==false,count:0,desc:'',color:'#37474F'};});
    if(Array.isArray(rows[1])&&rows[1].length)
      CAT_DATA['resource']=rows[1].map(function(r){return {id:r.id,name:r.name,icon:r.icon||'',active:r.active!==false,count:0,desc:'',color:'#37474F'};});
  }catch(e){console.warn('loadUomIfNeeded:',e);}
}

function buildResourceCatOpts(sel){
  return '<option value="">\u2014 Select Category \u2014</option>'+
    (CAT_DATA['resource']||[]).filter(function(u){return u.active;}).map(function(u){
      return '<option value="'+u.name+'"'+(u.name===sel?' selected':'')+'>'+u.name+'</option>';
    }).join('');
}

function buildUomOpts(sel){
  return '<option value="">\u2014 Select Unit \u2014</option>'+
    (CAT_DATA['uom']||[]).filter(function(u){return u.active;}).map(function(u){
      return '<option value="'+u.name+'"'+(u.name===sel?' selected':'')+'>'+u.name+'</option>';
    }).join('');
}


async function planAddRes(subId,itemId,unit){
  await loadUomIfNeeded();
  var uomOpts = buildUomOpts(unit);

  // Fetch JMs for this BOQ item
  var projId = (document.getElementById('plan-proj-sel')||{}).value||'';
  var itemJMs = [];
  try{
    var jmRows = await sbFetch('boq_jm',{select:'*',filter:'project_id=eq.'+projId+'&boq_item_id=eq.'+itemId,order:'jm_number.asc'});
    itemJMs = Array.isArray(jmRows) ? jmRows : [];
  }catch(e){}

  // jmPlanned will be recalculated when user types resource name
  // Initially show full balance (no resource name yet)
  var jmPlanned = {};

  // Helper to recalc balances for a given resource name
  function recalcJmBalances(resName){
    var planned = {};
    if(resName){
      PLAN_RES.filter(function(r){
        return r.boq_item_id===itemId &&
               r.party_name &&
               r.party_name.toLowerCase()===resName.toLowerCase();
      }).forEach(function(r){
        if(r.jm_links){
          var links=[];try{links=JSON.parse(r.jm_links);}catch(ex){}
          links.forEach(function(l){planned[l.jm_id]=(planned[l.jm_id]||0)+(parseFloat(l.plan_qty)||0);});
        }
      });
    }
    // Update each JM row's balance display and max
    itemJMs.forEach(function(j){
      var jmQty=parseFloat(j.jm_qty)||0;
      var p=planned[j.id]||0;
      var bal=Math.max(0,jmQty-p);
      var balStr=bal.toFixed(3).replace(/\.?0+$/,'');
      var pct=jmQty>0?Math.round(p/jmQty*100):0;
      var lbl=document.getElementById('jm-lbl-'+j.id);
      if(lbl) lbl.textContent='Total: '+jmQty+' '+unit+' | Planned: '+p.toFixed(3).replace(/\.?0+$/,'')+' | Bal: '+balStr+' ('+pct+'%)';
      var inp=document.getElementById('jm-qty-'+j.id);
      if(inp){inp.max=bal;if(parseFloat(inp.value)>bal) inp.value=balStr;}
      var planLbl=document.getElementById('jm-plan-lbl-'+j.id);
      if(planLbl) planLbl.textContent='Plan Qty for JM-'+j.jm_number+' (max '+balStr+' '+unit+')';
    });
  }

  // Build JM checkboxes
  var jmSection = itemJMs.length
    ? '<label class="flbl" style="margin-top:10px;">Link to JM(s) <span style="font-size:9px;color:var(--text3);">(select which JMs this resource covers)</span></label>'+
      '<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:8px;">'+
      itemJMs.map(function(j,i){
        var jmQty=parseFloat(j.jm_qty)||0;
        var planned=jmPlanned[j.id]||0;
        var bal=Math.max(0,jmQty-planned);
        var balStr=bal.toFixed(3).replace(/\.?0+$/,'');
        var pct=jmQty>0?Math.round(planned/jmQty*100):0;
        return '<div style="padding:8px 12px;'+(i>0?'border-top:1px solid var(--border);':'')+'" id="jm-row-'+j.id+'">'+
          '<div style="display:flex;align-items:center;gap:8px;">'+
            '<input type="checkbox" id="jm-chk-'+j.id+'" data-jmid="'+j.id+'" data-jmqty="'+jmQty+'" data-jmno="'+j.jm_number+'" data-jmbal="'+bal+'" class="jm-plan-chk" style="width:16px;height:16px;accent-color:#1565C0;flex-shrink:0;">'+

            '<label for="jm-chk-'+j.id+'" style="flex:1;cursor:pointer;">'+
              '<div style="font-size:12px;font-weight:800;">JM-'+j.jm_number+'</div>'+
              '<div id="jm-lbl-'+j.id+'" style="font-size:10px;color:var(--text3);">Total: '+jmQty+' '+unit+' | Bal: <b style="color:#1565C0">'+balStr+'</b></div>'+
            '</label>'+
          '</div>'+
          '<div id="jm-qty-row-'+j.id+'" style="display:none;padding-top:6px;display:none;">'+
            '<label id="jm-plan-lbl-'+j.id+'" style="font-size:10px;font-weight:700;color:#555;">Plan Qty for JM-'+j.jm_number+' (max '+balStr+' '+unit+')</label>'+
            '<input id="jm-qty-'+j.id+'" data-jmbal="'+bal+'" class="finp" type="number" step="0.001" max="'+bal+'" value="'+balStr+'" style="margin-bottom:0;">'+
          '</div>'+
        '</div>';
      }).join('')+
      '</div>'
    : '<div style="font-size:11px;color:var(--text3);padding:6px 0 10px;">No JMs found for this item. Add JMs first.</div>';

  document.getElementById('plan-sheet-title').textContent='Add Resource';
  document.getElementById('plan-sheet-body').innerHTML=
    '<label class="flbl">Resource Name *</label>'+
    '<input id="pr-name" class="finp" placeholder="e.g. Cement, Steel, Labour...">'+
    '<label class="flbl">Resource Category</label>'+
    '<select id="pr-cat" class="fsel">'+buildResourceCatOpts('')+'</select>'+
    jmSection+
    '<div class="g2">'+
      '<div><label class="flbl">Resource Qty *</label>'+
        '<input id="pr-qty" class="finp" type="number" step="0.001" placeholder="e.g. 10 bags"></div>'+
      '<div><label class="flbl">Unit</label>'+
        '<select id="pr-unit-sel" class="fsel">'+uomOpts+'</select>'+
      '</div>'+
    '</div>'+
    '<label class="flbl">Rate (\u20b9)</label>'+
    '<input id="pr-rate" class="finp" type="number" step="0.01" placeholder="0">';

  var sf=document.getElementById('plan-sheet-foot');
  sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-plan','sh-plan');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#1565C0;color:white;';
  sb.innerHTML='&#128230; Save Resource';
  sb.onclick=function(){planSaveRes(subId,itemId);};
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-plan','sh-plan');
  // Wire after DOM renders
  setTimeout(function(){
    // Wire name input to recalculate JM balances per resource
    var nameInp = document.getElementById('pr-name');
    if(nameInp) nameInp.addEventListener('input', function(){ recalcJmBalances(nameInp.value.trim()); });
    // Wire JM checkboxes
    document.querySelectorAll('.jm-plan-chk').forEach(function(chk){
      chk.addEventListener('change', function(){
        var jmId = chk.getAttribute('data-jmid');
        var row = document.getElementById('jm-qty-row-'+jmId);
        if(row) row.style.display = chk.checked ? 'block' : 'none';
      });
      // Wire qty input max check
      var qtyInp = document.getElementById('jm-qty-'+chk.getAttribute('data-jmid'));
      if(qtyInp){
        var maxBal = parseFloat(chk.getAttribute('data-jmbal'))||0;
        qtyInp.addEventListener('input', function(){
          var v = parseFloat(qtyInp.value)||0;
          if(v > maxBal){ qtyInp.value = maxBal; toast('Cannot exceed balance qty ('+maxBal+')','warning'); }
        });
      }
    });
  }, 100);
}

function prJmCheck(){}  // kept for compat, logic moved to addEventListener
function prJmQtyCheck(){}


async function planEditRes(resId, subId, itemId){
  await loadUomIfNeeded();
  var r=PLAN_RES.find(function(x){return x.id===resId;});
  if(!r){toast('Resource not found','warning');return;}
  var uomOpts=buildUomOpts(r.unit||'');
  var catOpts=buildResourceCatOpts(r.resource_category||'');

  // Parse existing jm_links
  var existingLinks={};
  if(r.jm_links){
    try{
      var links=typeof r.jm_links==='string'?JSON.parse(r.jm_links):r.jm_links;
      (Array.isArray(links)?links:[]).forEach(function(l){ existingLinks[l.jm_id]=l.plan_qty; });
    }catch(e){}
  } else if(r.jm_id){
    existingLinks[r.jm_id]=r.qty||0;
  }

  // Fetch JMs for this BOQ item
  var projId=(document.getElementById('plan-proj-sel')||{}).value||'';
  var itemJMs=[];
  try{
    var jmRows=await sbFetch('boq_jm',{select:'*',filter:'project_id=eq.'+projId+'&boq_item_id=eq.'+itemId,order:'jm_number.asc'});
    itemJMs=Array.isArray(jmRows)?jmRows:[];
  }catch(e){}

  // Calculate already-planned qty per JM for this resource (excluding self)
  var jmPlannedOthers={};
  PLAN_RES.filter(function(x){
    return x.id!==resId && x.boq_item_id===itemId &&
           x.party_name && r.party_name &&
           x.party_name.toLowerCase()===r.party_name.toLowerCase();
  }).forEach(function(x){
    var links=[];
    if(x.jm_links) try{links=typeof x.jm_links==='string'?JSON.parse(x.jm_links):x.jm_links;}catch(e){}
    links.forEach(function(l){ jmPlannedOthers[l.jm_id]=(jmPlannedOthers[l.jm_id]||0)+(parseFloat(l.plan_qty)||0); });
  });

  var totalExisting=Object.values(existingLinks).reduce(function(s,v){return s+(parseFloat(v)||0);},0);

  var jmSection=itemJMs.length
    ? '<label class="flbl" style="margin-top:10px;">JM Links <span style="font-size:9px;color:var(--text3);">(previously planned: '+totalExisting+')</span></label>'+
      '<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:8px;">'+
      itemJMs.map(function(j,i){
        var jmQty=parseFloat(j.jm_qty)||0;
        var othersPlanned=jmPlannedOthers[j.id]||0;
        var myPlanned=parseFloat(existingLinks[j.id])||0;
        var bal=Math.max(0,jmQty-othersPlanned); // balance available for this resource
        var balStr=bal.toFixed(3).replace(/\.?0+$/,'');
        var isChecked=existingLinks.hasOwnProperty(j.id);
        var pct=jmQty>0?Math.round((othersPlanned+myPlanned)/jmQty*100):0;
        return '<div style="padding:8px 12px;'+(i>0?'border-top:1px solid var(--border);':'')+'">'+
          '<div style="display:flex;align-items:center;gap:8px;">'+
            '<input type="checkbox" id="jm-chk-'+j.id+'" data-jmid="'+j.id+'" data-jmqty="'+jmQty+'" data-jmno="'+j.jm_number+'" data-jmbal="'+bal+'" class="jm-plan-chk"'+(isChecked?' checked':'')+' style="width:16px;height:16px;accent-color:#1565C0;flex-shrink:0;">'+
            '<label for="jm-chk-'+j.id+'" style="flex:1;cursor:pointer;">'+
              '<div style="font-size:12px;font-weight:800;">JM-'+j.jm_number+'</div>'+
              '<div id="jm-lbl-'+j.id+'" style="font-size:10px;color:var(--text3);">Total: '+jmQty+' | My prev: '+myPlanned+' | Bal: <b style="color:#1565C0">'+balStr+'</b> ('+pct+'%)</div>'+
            '</label>'+
          '</div>'+
          '<div id="jm-qty-row-'+j.id+'" style="padding-top:6px;'+(isChecked?'':'display:none;')+'">'+
            '<label id="jm-plan-lbl-'+j.id+'" style="font-size:10px;font-weight:700;color:#555;">Plan Qty for JM-'+j.jm_number+' (max '+balStr+')</label>'+
            '<input id="jm-qty-'+j.id+'" data-jmbal="'+bal+'" class="finp" type="number" step="0.001" max="'+bal+'" value="'+(myPlanned||balStr)+'" style="margin-bottom:0;">'+
          '</div>'+
        '</div>';
      }).join('')+
      '</div>'
    : '<div style="font-size:11px;color:var(--text3);padding:6px 0 10px;">No JMs for this item</div>';

  document.getElementById('plan-sheet-title').textContent='Edit Resource';
  document.getElementById('plan-sheet-body').innerHTML=
    '<label class="flbl">Resource Name *</label>'+
    '<input id="pr-name" class="finp" value="'+esc(r.party_name||'')+'" placeholder="Resource name">'+
    '<label class="flbl">Resource Category</label>'+
    '<select id="pr-cat" class="fsel">'+catOpts+'</select>'+
    jmSection+
    '<div class="g2">'+
      '<div><label class="flbl">Resource Qty *</label><input id="pr-qty" class="finp" type="number" step="0.001" value="'+(r.qty||0)+'"></div>'+
      '<div><label class="flbl">Unit</label><select id="pr-unit-sel" class="fsel">'+uomOpts+'</select></div>'+
    '</div>'+
    '<label class="flbl">Rate (₹)</label>'+
    '<input id="pr-rate" class="finp" type="number" step="0.01" value="'+(r.rate||0)+'">';

  var sf=document.getElementById('plan-sheet-foot');
  sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-plan','sh-plan');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#1565C0;color:white;';
  sb.innerHTML='&#10003; Update Resource';
  sb.onclick=function(){planUpdateRes(resId);};
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-plan','sh-plan');

  // Wire checkboxes and qty max after render
  setTimeout(function(){
    document.querySelectorAll('.jm-plan-chk').forEach(function(chk){
      chk.addEventListener('change',function(){
        var row=document.getElementById('jm-qty-row-'+chk.getAttribute('data-jmid'));
        if(row) row.style.display=chk.checked?'block':'none';
      });
      var qtyInp=document.getElementById('jm-qty-'+chk.getAttribute('data-jmid'));
      if(qtyInp){
        var maxBal=parseFloat(chk.getAttribute('data-jmbal'))||0;
        qtyInp.addEventListener('input',function(){
          var v=parseFloat(qtyInp.value)||0;
          if(v>maxBal){qtyInp.value=maxBal;toast('Cannot exceed balance qty ('+maxBal+')','warning');}
        });
      }
    });
  },100);
}

async function planSaveRes(subId,itemId){
  var name=gv('pr-name'),qty=parseFloat(gv('pr-qty'))||0,rate=parseFloat(gv('pr-rate'))||0;
  var unitSel=document.getElementById('pr-unit-sel');
  var unit=(unitSel&&unitSel.value)?unitSel.value:null;
  var cat=(document.getElementById('pr-cat')||{value:''}).value||null;
  if(!name){toast('Resource name required','warning');return;}
  if(!qty){toast('Resource qty required','warning');return;}
  // Collect checked JM links
  var jmLinks=[];
  document.querySelectorAll('[id^="jm-chk-"]').forEach(function(chk){
    if(!chk.checked)return;
    var jmId=chk.id.replace('jm-chk-','');
    var planQtyInp=document.getElementById('jm-qty-'+jmId);
    var planQty=planQtyInp?parseFloat(planQtyInp.value)||0:0;
    if(planQty>0){
      // Store jm_qty and jm_number for display without re-fetch
      var jmQty=parseFloat(chk.getAttribute('data-jmqty'))||0;
      var jmNo=chk.getAttribute('data-jmno')||'';
      jmLinks.push({jm_id:jmId,plan_qty:planQty,jm_qty:jmQty,jm_number:jmNo});
    }
  });
  var projId=(document.getElementById('plan-proj-sel')||{}).value||'';
  var primaryJmId=jmLinks.length?jmLinks[0].jm_id:null;
  try{
    var res=await sbInsert('boq_exec_resources',{
      project_id:projId,boq_item_id:itemId,
      boq_subitem_id:subId||null,
      jm_id:primaryJmId,
      jm_links:jmLinks.length?JSON.stringify(jmLinks):null,
      date:new Date().toISOString().slice(0,10),
      exec_type:'planned',
      party_name:name,qty:qty,unit:unit,rate:rate,
      resource_category:cat
    });
    if(res&&res[0])PLAN_RES.push(res[0]);
    toast(name+' saved!','success');
    closeSheet('ov-plan','sh-plan');
    planRender();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function planUpdateRes(resId){
  var name=gv('pr-name'),qty=parseFloat(gv('pr-qty'))||0,rate=parseFloat(gv('pr-rate'))||0;
  var unitSel=document.getElementById('pr-unit-sel');
  var unit=(unitSel&&unitSel.value)?unitSel.value:null;
  var cat=(document.getElementById('pr-cat')||{value:''}).value||null;
  if(!name){toast('Name required','warning');return;}
  // Collect JM links from checkboxes
  var jmLinks=[];
  document.querySelectorAll('[id^="jm-chk-"]').forEach(function(chk){
    if(!chk.checked) return;
    var jmId=chk.id.replace('jm-chk-','');
    var planQtyInp=document.getElementById('jm-qty-'+jmId);
    var planQty=planQtyInp?parseFloat(planQtyInp.value)||0:0;
    if(planQty>0){
      var jmQty=parseFloat(chk.getAttribute('data-jmqty'))||0;
      var jmNo=chk.getAttribute('data-jmno')||'';
      jmLinks.push({jm_id:jmId,plan_qty:planQty,jm_qty:jmQty,jm_number:jmNo});
    }
  });
  var primaryJmId=jmLinks.length?jmLinks[0].jm_id:null;
  var updates={
    party_name:name, qty:qty, unit:unit, rate:rate,
    resource_category:cat,
    jm_id:primaryJmId,
    jm_links:jmLinks.length?JSON.stringify(jmLinks):null
  };
  try{
    await sbUpdate('boq_exec_resources',resId,updates);
    var idx=PLAN_RES.findIndex(function(r){return r.id===resId;});
    if(idx>-1) Object.assign(PLAN_RES[idx],updates);
    toast('Resource updated!','success');
    closeSheet('ov-plan','sh-plan');
    planRender();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function planDelSub(id){
  if(!confirm('Delete this activity?\nThis will also delete all resources, allotments and WO/POs under it.'))return;
  // Delete WO/POs for allotments under this sub-activity
  var subAllots=WA_ALLOT.filter(function(a){return a.boq_subitem_id===id;});
  for(var i=0;i<subAllots.length;i++){
    var relOrds=WA_ORDERS.filter(function(o){return o.allot_id===subAllots[i].id;});
    for(var j=0;j<relOrds.length;j++) try{await sbDelete('work_orders',relOrds[j].id);}catch(e){}
    WA_ORDERS=WA_ORDERS.filter(function(o){return o.allot_id!==subAllots[i].id;});
    try{await sbDelete('boq_exec_resources',subAllots[i].id);}catch(e){}
  }
  WA_ALLOT=WA_ALLOT.filter(function(a){return a.boq_subitem_id!==id;});
  // Delete planned resources
  var subRes=PLAN_RES.filter(function(r){return r.boq_subitem_id===id;});
  for(var k=0;k<subRes.length;k++) try{await sbDelete('boq_exec_resources',subRes[k].id);}catch(e){}
  PLAN_RES=PLAN_RES.filter(function(r){return r.boq_subitem_id!==id;});
  PLAN_SUBS=PLAN_SUBS.filter(function(s){return s.id!==id;});
  planRender();
  try{await sbDelete('boq_subitems',id);}catch(e){console.error(e);}
  toast('Activity and all related records deleted','success');
}
async function planDelRes(id){
  if(!confirm('Delete this resource?\nThis will also delete related allotments and WO/POs.'))return;
  // Delete WO/POs for allotments linked to this planned resource
  var relAllots=WA_ALLOT.filter(function(a){return a.boq_exec_resource_id===id;});
  for(var i=0;i<relAllots.length;i++){
    var relOrds=WA_ORDERS.filter(function(o){return o.allot_id===relAllots[i].id;});
    for(var j=0;j<relOrds.length;j++) try{await sbDelete('work_orders',relOrds[j].id);}catch(e){}
    WA_ORDERS=WA_ORDERS.filter(function(o){return o.allot_id!==relAllots[i].id;});
    try{await sbDelete('boq_exec_resources',relAllots[i].id);}catch(e){}
  }
  WA_ALLOT=WA_ALLOT.filter(function(a){return a.boq_exec_resource_id!==id;});
  PLAN_RES=PLAN_RES.filter(function(r){return r.id!==id;});
  planRender();
  try{await sbDelete('boq_exec_resources',id);}catch(e){console.error(e);}
  toast('Resource and related allotments/orders deleted','success');
}

// ════ WORK ALLOTMENT ════════════════════════════════════
var WA_ITEMS=[],WA_JMS=[],WA_SUBS=[],WA_PLANNED=[],WA_ALLOT=[];
var WA_DAILY=[],WA_BILLS=[],WA_PAYMENTS=[],WA_ORDERS=[],WA_JMS=[],WA_APPROVED_RRS=[];
var WA_DAILY_DATE=new Date().toISOString().slice(0,10); // selected date for daily progress view
var WA_SUBTAB='allot'; // allot | allotted | daily | bills

var WA_LOADED_PROJ = ''; // track which project data is currently loaded

function initExecution(){execLoadProjs();}
async function execLoadProjs(){
  var sel=document.getElementById('exec-proj-sel');
  if(!sel)return;
  try{
    var d=await sbFetch('projects',{select:'id,name',order:'name.asc'});
    sel.innerHTML='<option value="">— Select Project —</option>'+(Array.isArray(d)?d:[]).map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>';}).join('');
  }catch(e){}
}

// Called on tab switch — only fetch if project changed, otherwise just re-render
function execSwitchTab(){
  var projId=(document.getElementById('exec-proj-sel')||{}).value||'';
  var el=document.getElementById('exec-content');
  if(!projId){
    if(el)el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">Select a project</div>';
    return;
  }
  if(projId === WA_LOADED_PROJ){
    // Data cached — re-render instantly
    // But always ensure approved RRs are loaded (they may have been approved since last load)
    if(!WA_APPROVED_RRS.length){
      sbFetch('resource_requisitions',{select:'*',filter:'project_id=eq.'+projId+'&status=eq.approved',order:'created_at.desc'})
        .then(function(r){WA_APPROVED_RRS=Array.isArray(r)?r:[];execRenderSubTab();})
        .catch(function(){execRenderSubTab();});
    } else {
      execRenderSubTab();
    }
  } else {
    // Different project — full fetch
    execLoadItems();
  }
}

// Full fetch — called on project change or after save/delete to refresh data
async function execLoadItems(){
  var projId=(document.getElementById('exec-proj-sel')||{}).value||'';
  var el=document.getElementById('exec-content');
  if(!projId){if(el)el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">Select a project</div>';return;}
  if(el) el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">&#9203; Loading...</div>';
  var safe=function(p){return p.catch(function(){return [];});};
  try{
    var r=await Promise.all([
      safe(sbFetch('boq_items',{select:'*',filter:'project_id=eq.'+projId,order:'item_code.asc'})),
      safe(sbFetch('boq_subitems',{select:'*',filter:'project_id=eq.'+projId,order:'sort_order.asc'})),
      safe(sbFetch('boq_exec_resources',{select:'*',filter:'project_id=eq.'+projId,order:'created_at.asc'})),
      safe(sbFetch('work_daily_progress',{select:'*',filter:'project_id=eq.'+projId,order:'date.desc'})),
      safe(sbFetch('work_bills',{select:'*',filter:'project_id=eq.'+projId,order:'created_at.desc'})),
      safe(sbFetch('work_payments',{select:'*',filter:'project_id=eq.'+projId,order:'payment_date.desc'})),
      safe(sbFetch('work_orders',{select:'*',filter:'project_id=eq.'+projId,order:'created_at.desc'})),
      safe(sbFetch('boq_jm',{select:'*',filter:'project_id=eq.'+projId,order:'created_at.asc'})),
      safe(sbFetch('resource_requisitions',{select:'*',filter:'project_id=eq.'+projId+'&status=eq.approved',order:'created_at.desc'}))
    ]);
    WA_ITEMS=Array.isArray(r[0])?r[0]:[];
    WA_SUBS=Array.isArray(r[1])?r[1]:[];
    var allRes=Array.isArray(r[2])?r[2]:[];
    WA_PLANNED=allRes.filter(function(r){return r.exec_type==='planned';});
    WA_ALLOT=allRes.filter(function(r){return r.exec_type!=='planned';});
    WA_DAILY=Array.isArray(r[3])?r[3]:[];
    WA_BILLS=Array.isArray(r[4])?r[4]:[];
    WA_PAYMENTS=Array.isArray(r[5])?r[5]:[];
    WA_ORDERS=Array.isArray(r[6])?r[6]:[];
    WA_JMS=Array.isArray(r[7])?r[7]:[];
    WA_APPROVED_RRS=Array.isArray(r[8])?r[8]:[];
    WA_LOADED_PROJ = projId; // mark this project as loaded
  }catch(e){WA_ITEMS=[];WA_LOADED_PROJ='';console.error(e);}
  execRenderSubTab();
}

function execRenderShell(){ execRenderSubTab(); }

function waSubTab(tab){ WA_SUBTAB=tab; execRenderSubTab(); }


// ════════════════════════════════════════════════════════════════
// RESOURCE REQUISITION (RR) MODULE
// ════════════════════════════════════════════════════════════════
var RR_ITEMS=[], RR_PLAN_ITEMS=[], RR_PLAN_SUBS=[], RR_PLAN_RES=[];

function rrEnsureContainer(){
  if(!document.getElementById('rr-content')){
    var div=document.createElement('div');
    div.id='rr-content';
    div.style.cssText='padding:12px;';
    var appProj=document.getElementById('app-projects');
    if(appProj) appProj.appendChild(div);
  }
}

async function rrLoadItems(){
  rrEnsureContainer();
  var el=document.getElementById('rr-content'); if(!el)return;

  var projId=PROJ_MOD_SEL_ID||'';
  if(!projId){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);background:white;border-radius:12px;">Select a project from the dropdown above</div>';
    return;
  }

  el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text3);">&#9203; Loading...</div>';

  try{
    var r=await Promise.all([
      sbFetch('boq_items',{select:'*',filter:'project_id=eq.'+projId,order:'item_code.asc'}),
      sbFetch('boq_subitems',{select:'*',filter:'project_id=eq.'+projId,order:'sort_order.asc'}),
      sbFetch('boq_exec_resources',{select:'*',filter:'project_id=eq.'+projId+'&exec_type=eq.planned',order:'created_at.asc'}),
      sbFetch('resource_requisitions',{select:'*',filter:'project_id=eq.'+projId,order:'created_at.desc'})
    ]);
    RR_PLAN_ITEMS=Array.isArray(r[0])?r[0]:[];
    RR_PLAN_SUBS =Array.isArray(r[1])?r[1]:[];
    RR_PLAN_RES  =Array.isArray(r[2])?r[2]:[];
    RR_ITEMS     =Array.isArray(r[3])?r[3]:[];
  }catch(e){
    RR_PLAN_ITEMS=[]; RR_PLAN_SUBS=[]; RR_PLAN_RES=[]; RR_ITEMS=[];
    el.innerHTML='<div style="text-align:center;padding:30px;color:#C62828;">Error: '+e.message+'</div>';
    return;
  }
  rrRender();
}

function rrRender(){
  var el=document.getElementById('rr-content'); if(!el)return;
  var projId=PROJ_MOD_SEL_ID||'';
  var projSel=document.getElementById('proj-mod-sel');
  var projName=(projSel&&projSel.options&&projSel.selectedIndex>=0?projSel.options[projSel.selectedIndex].text:'');

  var statusColors={pending:'#F57F17',approved:'#2E7D32',rejected:'#C62828',allotted:'#1565C0'};
  var statusLabels={pending:'Pending',approved:'Approved',rejected:'Rejected',allotted:'Allotted'};

  // Summary counts
  var counts={pending:0,approved:0,rejected:0,allotted:0};
  RR_ITEMS.forEach(function(r){counts[r.status]=(counts[r.status]||0)+1;});

  var summaryBar=
    '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">'+
      Object.keys(counts).filter(function(k){return counts[k]>0;}).map(function(k){
        return '<div style="background:white;border-radius:10px;padding:8px 14px;border-left:4px solid '+statusColors[k]+';flex:1;min-width:80px;">'+
          '<div style="font-size:18px;font-weight:900;color:'+statusColors[k]+';">'+counts[k]+'</div>'+
          '<div style="font-size:10px;color:var(--text3);font-weight:700;">'+statusLabels[k]+'</div>'+
        '</div>';
      }).join('')+
    '</div>';

  // Group RR by BOQ item
  var rrByItem={};
  RR_ITEMS.forEach(function(r){
    var key=r.boq_item_id||'misc';
    if(!rrByItem[key]) rrByItem[key]=[];
    rrByItem[key].push(r);
  });

  // BOQ item cards with their planned resources and RRs
  var itemCards=RR_PLAN_ITEMS.map(function(item){
    var iSubs=RR_PLAN_SUBS.filter(function(s){return s.boq_item_id===item.id;});
    var iRes=RR_PLAN_RES.filter(function(r){return r.boq_item_id===item.id;});
    var itemRRs=rrByItem[item.id]||[];

    if(!iRes.length) return ''; // skip items with no planned resources

    var resRows=iRes.map(function(res){
      // How much already raised for this planned resource
      var raised=RR_ITEMS.filter(function(r){return r.plan_res_id===res.id;})
        .reduce(function(s,r){return s+(parseFloat(r.qty)||0);},0);
      var planQty=parseFloat(res.qty)||0;
      var remaining=Math.max(0,planQty-raised);
      var tCol={vendor:'#1565C0',sc:'#6A1B9A',labour_contractor:'#2E7D32',labour:'#37474F',machinery:'#E65100'};
      var tLbl={vendor:'Vendor',sc:'SC',labour_contractor:'Labour Contr.',labour:'Labour',machinery:'Machinery'};
      var col=tCol[res.exec_type]||'#555';

      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid #F5F5F5;">'+
        '<div style="flex:1;">'+
          '<span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:3px;background:'+col+'15;color:'+col+';">'+(tLbl[res.exec_type]||res.exec_type)+'</span>'+
          '<span style="font-size:12px;font-weight:800;margin-left:6px;">'+res.party_name+'</span>'+
          '<div style="font-size:10px;color:var(--text3);">Planned: '+planQty+' '+(res.unit||'')+' | Raised: '+raised.toFixed(2)+' | Available: '+remaining.toFixed(2)+'</div>'+
        '</div>'+
        (remaining>0
          ? '<button onclick="rrOpenForm(\''+item.id+'\',\''+res.id+'\',\''+res.party_name+'\',\''+res.exec_type+'\','+remaining+',\''+( res.unit||'')+'\',\''+projId+'\',\''+projName+'\')" '+
              'style="background:#00838F;color:white;border:none;border-radius:7px;padding:5px 12px;font-size:11px;font-weight:800;cursor:pointer;flex-shrink:0;">+ Raise RR</button>'
          : '<span style="font-size:10px;background:#E8F5E9;color:#2E7D32;padding:3px 8px;border-radius:5px;font-weight:700;">Fully Raised</span>')+
      '</div>';
    }).join('');

    // RR list for this item
    var rrList=itemRRs.length
      ? itemRRs.map(function(r){
          var sc=statusColors[r.status]||'#555';
          var sl=statusLabels[r.status]||r.status;
          return '<div style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid #F0F0F0;background:#FAFAFA;">'+
            '<span style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:4px;background:'+sc+'20;color:'+sc+';">'+sl+'</span>'+
            '<div style="flex:1;font-size:11px;">'+
              '<b>'+r.party_name+'</b> — '+r.qty+' '+(r.unit||'')+
              '<div style="font-size:9px;color:var(--text3);">'+r.rr_number+' | '+( r.remarks||'')+'</div>'+
            '</div>'+
            '<div style="display:flex;gap:4px;flex-shrink:0;">'+
              '<button onclick="rrDownloadPDF(\''+r.id+'\',\''+projName+'\')" title="Download PDF" style="background:#00838F;color:white;border:none;border-radius:5px;padding:3px 8px;font-size:10px;cursor:pointer;">&#11015; PDF</button>'+
              (r.status==='pending'
                ? '<button onclick="rrApprove(\''+r.id+'\')" style="background:#2E7D32;color:white;border:none;border-radius:5px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;">&#10003; Approve</button>'+
                  '<button onclick="rrReject(\''+r.id+'\')" style="background:#C62828;color:white;border:none;border-radius:5px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;">&#10005; Reject</button>'
                : r.status==='approved'
                  ? '<span style="font-size:9px;background:#E3F2FD;color:#1565C0;padding:3px 8px;border-radius:4px;font-weight:700;">&#128203; Go to Work Allotment tab to allot</span>'
                  : '')+
              '<button onclick="rrDelete(\''+r.id+'\')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:14px;">&#215;</button>'+
            '</div>'+
          '</div>';
        }).join('')
      : '';

    return '<div style="background:white;border-radius:12px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">'+
      '<div style="padding:9px 14px;background:#E0F7FA;border-bottom:1px solid var(--border);">'+
        '<span style="font-size:10px;font-family:monospace;background:#B2EBF2;color:#00838F;padding:2px 7px;border-radius:4px;">'+item.item_code+'</span>'+
        '<span style="font-size:13px;font-weight:800;margin-left:8px;">'+(item.short_name||item.description)+'</span>'+
      '</div>'+
      '<div style="padding:4px 0;border-bottom:1px solid var(--border);">'+
        '<div style="padding:4px 12px;font-size:9px;font-weight:800;color:var(--text3);">PLANNED RESOURCES</div>'+
        resRows+
      '</div>'+
      (rrList?
        '<div>'+
          '<div style="padding:4px 12px;font-size:9px;font-weight:800;color:var(--text3);">REQUISITIONS</div>'+
          rrList+
        '</div>':'')
    +'</div>';
  }).filter(Boolean).join('');

  el.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'+
      '<div style="font-size:13px;font-weight:800;color:#00838F;">&#128203; Resource Requisitions</div>'+
      '<div style="font-size:11px;color:var(--text3);font-weight:700;">'+projName+'</div>'+
    '</div>'+
    (Object.values(counts).some(function(v){return v>0;})?summaryBar:'')+
    (itemCards||'<div style="text-align:center;padding:40px;color:var(--text3);background:white;border-radius:12px;">No planned resources found. Add resources in Planning tab first.</div>');
}

// Open RR form
function rrOpenForm(itemId, planResId, partyName, partyType, maxQty, unit, projId, projName){
  rrEnsureContainer();
  var shTitle=document.getElementById('exec-sheet-title');
  var shBody =document.getElementById('exec-sheet-body');
  var shFoot =document.getElementById('exec-sheet-foot');
  if(!shTitle||!shBody||!shFoot) return;

  shTitle.textContent='Raise Resource Requisition';
  shBody.innerHTML=
    '<div style="background:#E0F7FA;border-radius:10px;padding:12px;margin-bottom:12px;">'+
      '<div style="font-size:11px;font-weight:800;color:#00838F;margin-bottom:8px;">Resource Details</div>'+
      '<div style="font-size:12px;font-weight:800;">'+partyName+'</div>'+
      '<div style="font-size:10px;color:var(--text3);">Max qty available: '+maxQty+' '+(unit||'')+'</div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">'+
      '<div><label class="flbl">Required Date *</label><input id="rr-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
      '<div><label class="flbl">Qty Required *</label>'+
        '<div style="display:flex;gap:6px;align-items:center;">'+
          '<input id="rr-qty" class="finp" type="number" step="0.001" max="'+maxQty+'" placeholder="max '+maxQty+'" style="flex:1;">'+
          '<span style="font-size:12px;font-weight:700;color:var(--text3);">'+(unit||'')+'</span>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div style="margin-bottom:8px;"><label class="flbl">Purpose / Remarks</label>'+
      '<textarea id="rr-remarks" class="ftxt" rows="2" placeholder="Purpose of requisition, special requirements..."></textarea>'+
    '</div>'+
    '<div><label class="flbl">Requested By</label><input id="rr-by" class="finp" placeholder="Name of requester" value="'+(typeof currentUser!=='undefined'&&currentUser?currentUser.name||'':'')+'"></div>';

  shFoot.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#00838F;color:white;';
  sb.innerHTML='&#10003; Submit RR';
  sb.onclick=function(){rrSave(itemId,planResId,partyName,partyType,maxQty,unit,projId);};
  shFoot.appendChild(cb); shFoot.appendChild(sb);
  openSheet('ov-exec','sh-exec');
}

async function rrSave(itemId, planResId, partyName, partyType, maxQty, unit, projId){
  var date=gv('rr-date'), qty=parseFloat(gv('rr-qty'))||0;
  var remarks=gv('rr-remarks'), reqBy=gv('rr-by');
  if(!date){toast('Required date is needed','warning');return;}
  if(!qty||qty<=0){toast('Enter qty required','warning');return;}
  if(qty>maxQty){toast('Qty exceeds available limit ('+maxQty+')','warning');return;}

  // Generate RR number
  var rrNo='RR/'+projId.slice(-4).toUpperCase()+'/'+new Date().getFullYear()+'/'+
    String((RR_ITEMS.length+1)).padStart(4,'0');

  try{
    var res=await sbInsert('resource_requisitions',{
      project_id:projId,
      boq_item_id:itemId,
      plan_res_id:planResId,
      party_name:partyName,
      party_type:partyType,
      qty:qty,
      unit:unit||null,
      required_date:date,
      remarks:remarks||null,
      requested_by:reqBy||null,
      rr_number:rrNo,
      status:'pending'
    });
    if(res&&res[0]) RR_ITEMS.push(res[0]);
    toast('RR '+rrNo+' submitted!','success');
    closeSheet('ov-exec','sh-exec');
    rrRender();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function rrApprove(rrId){
  try{
    await sbUpdate('resource_requisitions',rrId,{status:'approved'});
    var idx=RR_ITEMS.findIndex(function(r){return r.id===rrId;});
    if(idx>-1){
      RR_ITEMS[idx].status='approved';
      // Also add to WA_APPROVED_RRS so work allotment tab sees it immediately
      var approvedRR = RR_ITEMS[idx];
      var already = WA_APPROVED_RRS.some(function(r){return r.id===rrId;});
      if(!already) WA_APPROVED_RRS.push(approvedRR);
    }
    // Force exec tab to reload from DB next open
    WA_LOADED_PROJ='';
    toast('RR approved — Work Allotment tab updated','success');
    rrRender();
  }catch(e){toast('Error: '+e.message,'error');}
}

async function rrReject(rrId){
  var reason=prompt('Reason for rejection (optional):');
  if(reason===null) return; // cancelled
  try{
    var res=await sbUpdate('resource_requisitions',rrId,{status:'rejected',rejection_reason:reason||null});
    var idx=RR_ITEMS.findIndex(function(r){return r.id===rrId;});
    if(idx>-1){RR_ITEMS[idx].status='rejected';RR_ITEMS[idx].rejection_reason=reason||null;}
    // Remove from WA_APPROVED_RRS if it was previously approved
    WA_APPROVED_RRS=WA_APPROVED_RRS.filter(function(r){return r.id!==rrId;});
    WA_LOADED_PROJ='';
    toast('RR rejected','info');
    rrRender();
  }catch(e){toast('Error: '+e.message,'error');}
}

async function rrAllot(rrId, projId){
  // Approved RR → create actual work allotment (adds to boq_exec_resources)
  var rr=RR_ITEMS.find(function(r){return r.id===rrId;});
  if(!rr){toast('RR not found','error');return;}
  if(!confirm('Allot work for this RR? This will create an allotment entry.')) return;

  var batchId='rr-batch-'+Date.now();
  try{
    var res=await sbInsert('boq_exec_resources',{
      project_id:projId,
      boq_item_id:rr.boq_item_id,
      boq_exec_resource_id:rr.plan_res_id,
      date:new Date().toISOString().slice(0,10),
      exec_type:rr.party_type,
      party_name:rr.party_name,
      qty:rr.qty,
      unit:rr.unit||null,
      scope:rr.remarks||null,
      batch_id:batchId,
      rr_id:rrId
    });
    // Mark RR as allotted
    await sbUpdate('resource_requisitions',rrId,{status:'allotted',allotment_id:res&&res[0]?res[0].id:null});
    var idx=RR_ITEMS.findIndex(function(r){return r.id===rrId;});
    if(idx>-1) RR_ITEMS[idx].status='allotted';
    // Add to WA_ALLOT so work allotment tab picks it up immediately
    if(res&&res[0]) WA_ALLOT.push(res[0]);
    // Remove from WA_APPROVED_RRS since it's now allotted
    WA_APPROVED_RRS=WA_APPROVED_RRS.filter(function(r){return r.id!==rrId;});
    WA_LOADED_PROJ=''; // force full reload next time exec tab opens
    toast('Work allotted successfully!','success');
    rrRender();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function rrDelete(rrId){
  var rr=RR_ITEMS.find(function(r){return r.id===rrId;});
  if(!rr) return;
  if(rr.status==='allotted'){
    if(!confirm('This RR has been allotted. Deleting will NOT remove the allotment from Work Allotment tab.\nDelete RR record only?')) return;
  } else {
    if(!confirm('Delete this RR?')) return;
  }
  RR_ITEMS=RR_ITEMS.filter(function(r){return r.id!==rrId;});
  WA_APPROVED_RRS=WA_APPROVED_RRS.filter(function(r){return r.id!==rrId;});
  rrRender();
  try{await sbDelete('resource_requisitions',rrId);}catch(e){console.error(e);}
}

function rrDownloadPDF(rrId, projName){
  var rr=RR_ITEMS.find(function(r){return r.id===rrId;});
  if(!rr){toast('RR not found','error');return;}
  var co=typeof COMPANY_DATA!=='undefined'?COMPANY_DATA:{};
  var item=RR_PLAN_ITEMS.find(function(i){return i.id===rr.boq_item_id;})||{};
  var planRes=RR_PLAN_RES.find(function(r){return r.id===rr.plan_res_id;})||{};
  function fmtD(d){if(!d)return '—';if(/^\d{4}-\d{2}-\d{2}/.test(d)){var p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0];}return d;}
  var tLbl={vendor:'Vendor',sc:'Subcontractor',labour_contractor:'Labour Contractor',labour:'Labour',machinery:'Machinery'};
  var stCol={pending:'#F57F17',approved:'#2E7D32',rejected:'#C62828',allotted:'#1565C0'};
  var stLbl={pending:'PENDING',approved:'APPROVED',rejected:'REJECTED',allotted:'ALLOTTED'};
  var sc=stCol[rr.status]||'#555';

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Resource Requisition — '+rr.rr_number+'</title>'+
    '<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:28px;}'+
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #00838F;padding-bottom:12px;margin-bottom:16px;}'+
    '.co-name{font-size:16px;font-weight:900;color:#00838F;}.co-info{font-size:10px;color:#555;margin-top:3px;}'+
    '.rr-title{font-size:20px;font-weight:900;color:#00838F;}.rr-no{font-size:12px;color:#555;margin-top:4px;}'+
    '.status-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-weight:900;font-size:11px;color:white;background:'+sc+';}'+
    '.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #DDD;border-radius:8px;overflow:hidden;margin-bottom:16px;}'+
    '.info-cell{padding:10px 14px;}.info-cell+.info-cell{border-left:1px solid #DDD;}.info-cell.full{grid-column:span 2;border-top:1px solid #DDD;}'+
    '.lbl{font-size:9px;font-weight:800;text-transform:uppercase;color:#888;letter-spacing:.5px;margin-bottom:3px;}'+
    '.val{font-size:13px;font-weight:800;}.val-sub{font-size:10px;color:#555;margin-top:2px;}'+
    '.detail-box{background:#E0F7FA;border-radius:8px;padding:14px;margin-bottom:16px;border-left:4px solid #00838F;}'+
    '.sig-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:40px;}'+
    '.sig-box{border-top:1.5px solid #333;padding-top:6px;text-align:center;font-size:10px;color:#555;}'+
    '@media print{button{display:none;}}</style></head><body>'+
    '<button onclick="window.print()" style="background:#00838F;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;margin-bottom:18px;font-family:Arial;font-weight:700;font-size:12px;">&#128438; Print / Save PDF</button>'+

    '<div class="hdr">'+
      '<div>'+
        '<div class="co-name">'+(co.name||'Company Name')+'</div>'+
        '<div class="co-info">'+(co.address||'')+(co.gstin?'<br>GSTIN: '+co.gstin:'')+'</div>'+
      '</div>'+
      '<div style="text-align:right;">'+
        '<div class="rr-title">RESOURCE REQUISITION</div>'+
        '<div class="rr-no">'+rr.rr_number+'</div>'+
        '<div style="margin-top:6px;"><span class="status-badge">'+(stLbl[rr.status]||rr.status)+'</span></div>'+
      '</div>'+
    '</div>'+

    '<div class="info-grid">'+
      '<div class="info-cell"><div class="lbl">Project</div><div class="val">'+projName+'</div></div>'+
      '<div class="info-cell"><div class="lbl">Date of Requisition</div><div class="val">'+fmtD(rr.created_at?rr.created_at.slice(0,10):'')+'</div></div>'+
      '<div class="info-cell"><div class="lbl">Required By Date</div><div class="val" style="color:#E65100;">'+fmtD(rr.required_date)+'</div></div>'+
      '<div class="info-cell"><div class="lbl">Requested By</div><div class="val">'+(rr.requested_by||'—')+'</div></div>'+
    '</div>'+

    '<div class="detail-box">'+
      '<div style="font-size:12px;font-weight:800;color:#00838F;margin-bottom:10px;">Resource Details</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">'+
        '<div><div class="lbl">BOQ Item</div><div class="val" style="font-size:12px;">'+(item.item_code?'['+item.item_code+'] ':'')+( item.short_name||item.description||'—')+'</div></div>'+
        '<div><div class="lbl">Party Name</div><div class="val" style="font-size:12px;">'+rr.party_name+'</div><div class="val-sub">'+(tLbl[rr.party_type]||rr.party_type||'')+'</div></div>'+
        '<div><div class="lbl">Quantity Required</div><div class="val" style="font-size:18px;color:#00838F;">'+rr.qty+' <span style="font-size:12px;font-weight:400;">'+(rr.unit||'')+'</span></div>'+
          '<div class="val-sub">Planned: '+(planRes.qty||'—')+' '+(planRes.unit||'')+'</div></div>'+
      '</div>'+
      (rr.remarks?'<div style="margin-top:10px;"><div class="lbl">Purpose / Remarks</div><div style="font-size:11px;color:#333;margin-top:3px;">'+rr.remarks+'</div></div>':'')+
    '</div>'+

    (rr.rejection_reason?'<div style="background:#FFEBEE;border-radius:8px;padding:12px 14px;margin-bottom:16px;border-left:4px solid #C62828;"><div class="lbl" style="color:#C62828;">Rejection Reason</div><div style="font-size:11px;margin-top:3px;">'+rr.rejection_reason+'</div></div>':'')+

    '<div class="sig-grid">'+
      '<div class="sig-box"><div style="height:40px;"></div><div style="font-weight:800;">'+(rr.requested_by||'Requester')+'</div><div>Requested By</div></div>'+
      '<div class="sig-box"><div style="height:40px;"></div><div style="font-weight:800;">Site Engineer / PM</div><div>Verified By</div></div>'+
      '<div class="sig-box"><div style="height:40px;"></div><div style="font-weight:800;">'+(co.name||'Management')+'</div><div>Approved By</div></div>'+
    '</div>'+

    '</body></html>';

  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else toast('Allow popups to open PDF','warning');
}


async function execRenderSubTab(){
  // Always refresh approved RRs before rendering allot tab — they change in RR tab
  if(WA_SUBTAB==='allot'){
    var projId=(document.getElementById('exec-proj-sel')||{}).value||'';
    if(projId){
      try{
        var rrs=await sbFetch('resource_requisitions',{select:'*',filter:'project_id=eq.'+projId+'&status=eq.approved',order:'created_at.desc'});
        WA_APPROVED_RRS=Array.isArray(rrs)?rrs:[];
      }catch(e){ console.warn('RR fetch:',e.message); }
    }
    execRender();
  }
  else if(WA_SUBTAB==='allotted') execRenderAllotted();
  else if(WA_SUBTAB==='daily') execRenderDaily();
  else if(WA_SUBTAB==='bills') execRenderBills();
  else if(WA_SUBTAB==='orders') execRenderOrders();
}


function execRender(){
  var el=document.getElementById('exec-content');if(!el)return;
  if(!WA_ITEMS.length){el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">No BOQ items</div>';return;}

  var tCol={vendor:'#1565C0',sc:'#6A1B9A',labour_contractor:'#2E7D32',labour:'#37474F',machinery:'#E65100'};
  var tLbl={vendor:'Vendor',sc:'SC',labour_contractor:'Labour Contr.',labour:'Labour',machinery:'Machinery'};

  // Wire allot buttons via event delegation (no once:true — content re-renders on each save)
  if(!el._execClickWired){
    el._execClickWired = true;
    el.addEventListener('click',function(e){
      var btn=e.target.closest('.wa-allot-btn');
      if(btn) execOpenAllot(btn.getAttribute('data-item-id'));
      var delbtn=e.target.closest('.wa-del-btn');
      if(delbtn) execDelAllot(delbtn.getAttribute('data-del-id'));
      var editbtn=e.target.closest('[data-edit-allot-id]');
      if(editbtn) execEditAllotted(editbtn.getAttribute('data-edit-allot-id'));
      var wobtn=e.target.closest('[data-wo-id]');
      if(wobtn) execRegenDoc(wobtn.getAttribute('data-wo-id'),'wo');
      var pobtn=e.target.closest('[data-po-id]');
      if(pobtn) execRegenDoc(pobtn.getAttribute('data-po-id'),'po');
    });
  }
  if(!WA_PLANNED.length){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);"><div style="font-size:32px;">&#128230;</div><div style="font-weight:700;margin-top:8px;">No planned resources</div><div style="font-size:12px;margin-top:4px;">Add resources in the Planning tab first</div></div>';
    return;
  }

  // Collect BOQ item IDs that have planned resources
  var itemsWithRes = WA_ITEMS.filter(function(item){
    return WA_PLANNED.some(function(r){ return r.boq_item_id===item.id; });
  });
  // Also collect resources with no matching BOQ item (orphaned / uncategorized)
  var knownItemIds = WA_ITEMS.map(function(i){ return i.id; });
  var orphanRes = WA_PLANNED.filter(function(r){ return !knownItemIds.includes(r.boq_item_id); });

  var itemsHtml = itemsWithRes.map(function(item){
    var iSubs=WA_SUBS.filter(function(s){return s.boq_item_id===item.id;});
    var iRes=WA_PLANNED.filter(function(r){return r.boq_item_id===item.id;});
    var subsHtml=iSubs.map(function(sub){
      var sRes=iRes.filter(function(r){return r.boq_subitem_id===sub.id;});
      if(!sRes.length) return '';
      return '<div style="margin-bottom:8px;"><div style="font-size:10px;font-weight:800;color:#1565C0;padding:5px 8px;background:#E3F2FD;border-radius:6px;margin-bottom:4px;">'+sub.name+'</div>'+sRes.map(function(res){return resRow(res,item.unit,tCol,tLbl);}).join('')+'</div>';
    }).join('');
    var noSubRes=iRes.filter(function(r){return !r.boq_subitem_id;});
    var noSubHtml=noSubRes.map(function(res){return resRow(res,item.unit,tCol,tLbl);}).join('');
    var itemHasUnallotted = iRes.some(function(res){
      // Only show Allot Work button if there's an approved RR with remaining balance
      var rrApproved = WA_APPROVED_RRS.filter(function(rr){return rr.plan_res_id===res.id;})
        .reduce(function(s,rr){return s+(parseFloat(rr.qty)||0);},0);
      if(rrApproved<=0) return false; // no approved RR
      var totalAllotted=WA_ALLOT.filter(function(a){return a.boq_exec_resource_id===res.id;})
        .reduce(function(s,a){return s+(parseFloat(a.qty)||0);},0);
      return rrApproved > totalAllotted;
    });
    return '<div style="background:white;border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">'+
      '<div style="padding:10px 14px;background:#FFF3E0;display:flex;align-items:center;justify-content:space-between;">'+
        '<div><span style="font-size:10px;font-family:monospace;background:#FFE0B2;color:#E65100;padding:2px 7px;border-radius:4px;">'+item.item_code+'</span><span style="font-size:13px;font-weight:800;margin-left:8px;">'+(item.short_name||item.description)+'</span></div>'+
        (itemHasUnallotted?'<button class="wa-allot-btn" data-item-id="'+item.id+'" style="background:#E65100;color:white;border:none;border-radius:7px;padding:5px 14px;font-size:11px;font-weight:800;cursor:pointer;">+ Allot Work</button>':'')+
      '</div>'+
      '<div style="padding:8px 14px;">'+(subsHtml+noSubHtml||'<div style="font-size:11px;color:var(--text3);">No planned resources</div>')+'</div></div>';
  }).join('');

  var orphanHtml=orphanRes.length?
    '<div style="background:white;border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">'+
      '<div style="padding:10px 14px;background:#FFF8E1;"><span style="font-size:11px;font-weight:800;color:#E65100;">&#9888; Uncategorized Resources</span></div>'+
      '<div style="padding:8px 14px;">'+orphanRes.map(function(r){return resRow(r,'',tCol,tLbl);}).join('')+'</div></div>':'';

  el.innerHTML=itemsHtml+orphanHtml;

  function resRow(res,itemUnit,tCol,tLbl){
    var resUnit=res.unit||itemUnit;
    var rAllot=WA_ALLOT.filter(function(a){
      return a.boq_exec_resource_id===res.id;
    });
    var totalAllotted=rAllot.reduce(function(s,a){return s+(parseFloat(a.qty)||0);},0);
    var bal=Math.max(0,(parseFloat(res.qty)||0)-totalAllotted);
    return (
      '<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:6px;overflow:hidden;">'+
        '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#FAFAFA;">'+
          '<div style="flex:1;">'+
            '<div style="font-size:12px;font-weight:800;">'+res.party_name+'</div>'+
            '<div style="font-size:10px;color:var(--text3);">'+
              (function(){
                var rrApproved = WA_APPROVED_RRS.filter(function(rr){return rr.plan_res_id===res.id;})
                  .reduce(function(s,rr){return s+(parseFloat(rr.qty)||0);},0);
                var rrBal = Math.max(0, rrApproved - totalAllotted);
                return 'Planned: '+(res.qty||0)+' '+(res.unit||itemUnit)+
                  (res.rate?' @ ₹'+res.rate:'')+
                  '  |  RR Approved: <b style="color:#2E7D32;">'+rrApproved+'</b>'+
                  '  |  Allotted: '+totalAllotted+
                  '  |  <b style="color:'+(rrBal>0?'#E65100':'#2E7D32')+'">RR Bal: '+rrBal.toFixed(3).replace(/\.?0+$/,'')+'</b>';
              })()+
            '</div>'+
          '</div>'+
          (bal<=0?'<span style="font-size:10px;background:#E8F5E9;color:#2E7D32;padding:3px 8px;border-radius:5px;font-weight:700;">&#10003; Done</span>':'')+
        '</div>'+
        (rAllot.length?
          '<div style="padding:4px 12px 8px;">'+
            rAllot.map(function(a){
              var col=tCol[a.exec_type]||'#37474F';var lbl=tLbl[a.exec_type]||a.exec_type;
              return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #F5F5F5;">'+'<span style="font-size:9px;font-weight:800;padding:1px 5px;border-radius:3px;background:'+col+'20;color:'+col+';">'+lbl+'</span>'+
                '<div style="flex:1;font-size:11px;font-weight:700;">'+a.party_name+'</div>'+
                '<div style="font-size:10px;color:var(--text3);">'+a.qty+' '+(a.unit||'')+(a.rate?' @ ₹'+a.rate:'')+'</div>'+
                '<button data-edit-allot-id="'+a.id+'" title="Edit" style="background:#E3F2FD;border:none;color:#1565C0;font-size:11px;border-radius:5px;padding:2px 7px;cursor:pointer;font-weight:800;">&#9998;</button>'+
                '<button data-del-id="'+a.id+'" class="wa-del-btn" title="Delete" style="background:none;border:none;color:#C62828;font-size:14px;cursor:pointer;">&#215;</button>'+
              '</div>';
            }).join('')+
          '</div>':'')+
      '</div>'
    );
  }
}

async function execOpenAllot(itemId){
  await loadUomIfNeeded();
  var projId=(document.getElementById('exec-proj-sel')||{}).value||'';
  var item = WA_ITEMS.find(function(i){return i.id===itemId;})||{};
  var itemSubIds = WA_SUBS.filter(function(s){return s.boq_item_id===itemId;}).map(function(s){return s.id;});
  var itemRes = WA_PLANNED.filter(function(r){
    return r.boq_item_id===itemId || (r.boq_subitem_id && itemSubIds.includes(r.boq_subitem_id));
  });

  // Build one row per INDIVIDUAL approved RR (not per planned resource)
  // Each RR can only be allotted up to its own approved qty
  var pendingRes = [];
  itemRes.forEach(function(res){
    var approvedRRs = WA_APPROVED_RRS.filter(function(rr){return rr.plan_res_id===res.id;});
    approvedRRs.forEach(function(rr){
      // How much already allotted against THIS specific RR
      var allottedForRR = WA_ALLOT.filter(function(a){return a.rr_id===rr.id;})
        .reduce(function(s,a){return s+(parseFloat(a.qty)||0);},0);
      var rrBalance = Math.max(0,(parseFloat(rr.qty)||0) - allottedForRR);
      if(rrBalance > 0){
        pendingRes.push({
          res:res,
          rr:rr,
          rrApprovedQty:parseFloat(rr.qty)||0,
          allottedForRR:allottedForRR,
          rrBalance:rrBalance
        });
      }
    });
  });

  if(!pendingRes.length){
    var hasAnyRR = itemRes.some(function(res){
      return WA_APPROVED_RRS.some(function(rr){return rr.plan_res_id===res.id;});
    });
    toast(hasAnyRR
      ? 'All approved RR qty has been allotted for this item'
      : 'No approved Resource Requisitions. Raise and approve an RR first.',
      hasAnyRR?'info':'warning');
    return;
  }

  // ── STEP 1: Party details (shared for all selected resources) ──
  var partySection =
    '<div style="background:#FFF3E0;border-radius:12px;padding:14px;margin-bottom:14px;">'+
      '<div style="font-size:12px;font-weight:800;color:#E65100;margin-bottom:10px;">&#9312; Party Details</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">'+
        '<div><label class="flbl">Party Type *</label>'+
          '<select id="wa-party-type" class="fsel">'+
            '<option value="">— Select Type —</option>'+
            '<option value="sc">Subcontractor</option>'+
            '<option value="vendor">Vendor</option>'+
            '<option value="labour_contractor">Labour Contractor</option>'+
            '<option value="labour">Labour</option>'+
            '<option value="machinery">Machinery</option>'+
          '</select>'+
        '</div>'+
        '<div><label class="flbl">Party Name *</label>'+
          '<select id="wa-party-name" class="fsel"><option value="">— Select type first —</option></select>'+
        '</div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">'+
        '<div><label class="flbl">Start Date</label><input id="wa-start-date" class="finp" type="date"></div>'+
        '<div><label class="flbl">End Date</label><input id="wa-end-date" class="finp" type="date"></div>'+
      '</div>'+
      '<div style="margin-bottom:8px;"><label class="flbl">Scope / Terms</label>'+
        '<textarea id="wa-scope" class="ftxt" rows="2" placeholder="Common scope for all selected resources..."></textarea>'+
      '</div>'+
      '<div><label class="flbl">Document Type (optional)</label>'+
        '<div style="display:flex;gap:6px;margin-top:4px;">'+
          '<label style="display:flex;align-items:center;gap:5px;padding:6px 10px;border:1.5px solid var(--border);border-radius:7px;cursor:pointer;flex:1;">'+
            '<input type="radio" name="wa-doc-type" value="wo" style="accent-color:#E65100;">'+
            '<div><div style="font-size:10px;font-weight:800;">Work Order</div><div style="font-size:9px;color:var(--text3);">SC / Labour</div></div>'+
          '</label>'+
          '<label style="display:flex;align-items:center;gap:5px;padding:6px 10px;border:1.5px solid var(--border);border-radius:7px;cursor:pointer;flex:1;">'+
            '<input type="radio" name="wa-doc-type" value="po" style="accent-color:#1565C0;">'+
            '<div><div style="font-size:10px;font-weight:800;">Purchase Order</div><div style="font-size:9px;color:var(--text3);">Vendor</div></div>'+
          '</label>'+
          '<label style="display:flex;align-items:center;gap:5px;padding:6px 10px;border:1.5px solid var(--border);border-radius:7px;cursor:pointer;flex:1;">'+
            '<input type="radio" name="wa-doc-type" value="none" checked style="accent-color:#555;">'+
            '<div><div style="font-size:10px;font-weight:800;">None</div><div style="font-size:9px;color:var(--text3);">Save only</div></div>'+
          '</label>'+
        '</div>'+
      '</div>'+
    '</div>';

  // ── STEP 2: One checkbox row per individual approved RR ──
  var resRowsHtml = pendingRes.map(function(x){
    var res = x.res;
    var rr  = x.rr;
    var bal = x.rrBalance; // max = this RR's remaining qty only
    var rrApprovedQty = x.rrApprovedQty;
    var alreadyAllotted = x.allottedForRR;
    var rrNums = rr.rr_number;
    var uomOpts = buildUomOpts(res.unit||item.unit||'');
    return '<div class="wa-res-row" data-res-id="'+res.id+'" style="border:1px solid var(--border);border-radius:10px;margin-bottom:6px;overflow:hidden;">'+
      '<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:#FAFAFA;">'+
        '<input type="checkbox" class="wa-res-chk" data-res-id="'+res.id+'" data-rr-id="'+rr.id+'" data-rr-max="'+bal+'" style="width:16px;height:16px;accent-color:#E65100;flex-shrink:0;">'+
        '<div style="flex:1;">'+
          '<div style="font-size:12px;font-weight:800;">'+res.party_name+'</div>'+
          '<div style="font-size:10px;color:var(--text3);">'+
            'RR Approved: <b style="color:#2E7D32;">'+rrApprovedQty+' '+(res.unit||'')+'</b>'+
            ' &nbsp;|&nbsp; Already Allotted: '+alreadyAllotted+
            ' &nbsp;|&nbsp; Available: <b style="color:#E65100;">'+bal.toFixed(3).replace(/\.?0+$/,'')+'</b>'+
          '</div>'+
          (rrNums?'<div style="font-size:9px;color:#00838F;font-weight:700;">RR: '+rrNums+'</div>':'')+
        '</div>'+
        '<div class="wa-res-inputs" style="display:none;align-items:center;gap:6px;">'+
          '<div style="text-align:center;">'+
            '<div style="font-size:9px;color:var(--text3);margin-bottom:2px;">Qty</div>'+
            '<input class="wa-qty-inp finp" data-res-id="'+res.id+'" type="number" step="0.001" max="'+bal+'" value="'+bal+'" placeholder="'+bal+'" style="width:80px;padding:4px 6px;font-size:12px;text-align:center;">'+
          '</div>'+
          '<div style="text-align:center;">'+
            '<div style="font-size:9px;color:var(--text3);margin-bottom:2px;">Unit</div>'+
            '<select class="wa-unit-sel fsel" data-res-id="'+res.id+'" style="width:70px;padding:4px 4px;font-size:11px;">'+uomOpts+'</select>'+
          '</div>'+
          '<div style="text-align:center;">'+
            '<div style="font-size:9px;color:var(--text3);margin-bottom:2px;">Rate (₹)</div>'+
            '<input class="wa-rate-inp finp" data-res-id="'+res.id+'" type="number" step="0.01" value="'+(res.rate||'')+'" placeholder="0" style="width:90px;padding:4px 6px;font-size:12px;text-align:center;">'+
          '</div>'+
          '<div style="text-align:center;">'+
            '<div style="font-size:9px;color:var(--text3);margin-bottom:2px;">Amount</div>'+
            '<div class="wa-est-amt" data-res-id="'+res.id+'" style="font-size:12px;font-weight:800;color:#1565C0;white-space:nowrap;">₹0</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
      // Specification — shown when checkbox is checked
      '<div class="wa-res-spec-row" style="display:none;padding:6px 12px 8px;border-top:1px solid #F0F0F0;background:white;">'+
        '<label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:4px;">Specification / Description for this item</label>'+
        '<textarea class="wa-spec-inp ftxt" data-res-id="'+res.id+'" rows="2" placeholder="Material grade, size, brand, make, model or any specific requirement..."></textarea>'+
      '</div>'+
    '</div>';
  }).join('');

  document.getElementById('exec-sheet-title').textContent='Allot Work — '+(item.short_name||item.description||'');
  document.getElementById('exec-sheet-body').innerHTML=
    partySection+
    '<div style="font-size:12px;font-weight:800;color:#E65100;margin-bottom:8px;">&#9313; Select Resources</div>'+
    '<div style="font-size:10px;color:var(--text3);margin-bottom:8px;">Check resources to include — enter qty and rate for each</div>'+
    resRowsHtml;

  var sf=document.getElementById('exec-sheet-foot');
  sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#E65100;color:white;';
  sb.innerHTML='&#10003; Save Allotment';
  sb.onclick=function(){execSaveAllot(itemId,projId);};
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-exec','sh-exec');

  // Wire events after render
  setTimeout(function(){
    var body = document.getElementById('exec-sheet-body');
    if(!body) return;

    // Party type → load party names
    var typesel = document.getElementById('wa-party-type');
    if(typesel) typesel.addEventListener('change', function(){
      waLoadPartyNames(this.value);
    });

    // WO/PO mutual exclusion
    body.querySelectorAll('input[name="wa-doc-type"]').forEach(function(r){
      r.addEventListener('change', function(){
        var val = this.value;
        body.querySelectorAll('input[name="wa-doc-type"]').forEach(function(x){
          var lbl = x.closest('label');
          if(val==='none'){ x.disabled=false; if(lbl){lbl.style.opacity='1';lbl.style.cursor='pointer';} }
          else if(x.value!==val && x.value!=='none'){ x.disabled=true; if(lbl){lbl.style.opacity='0.4';lbl.style.cursor='not-allowed';} }
          else { x.disabled=false; if(lbl){lbl.style.opacity='1';lbl.style.cursor='pointer';} }
        });
      });
    });

    // Checkbox → show/hide inline inputs + wire qty/rate calc
    body.addEventListener('change', function(e){
      var chk = e.target;
      if(chk.classList && chk.classList.contains('wa-res-chk')){
        var row = chk.closest('.wa-res-row');
        if(!row) return;
        var inputs = row.querySelector('.wa-res-inputs');
        if(inputs) inputs.style.display = chk.checked ? 'flex' : 'none';
        var specRow = row.querySelector('.wa-res-spec-row');
        if(specRow) specRow.style.display = chk.checked ? 'block' : 'none';
        if(chk.checked && !chk._wired){
          chk._wired = true;
          var qInp = row.querySelector('.wa-qty-inp');
          var rInp = row.querySelector('.wa-rate-inp');
          var amtEl = row.querySelector('.wa-est-amt');
          function updAmt(){
            if(qInp&&rInp&&amtEl)
              amtEl.textContent='\u20b9'+Math.round((parseFloat(qInp.value)||0)*(parseFloat(rInp.value)||0)).toLocaleString('en-IN');
          }
          if(qInp) qInp.addEventListener('input',updAmt);
          if(rInp) rInp.addEventListener('input',updAmt);
          updAmt();
        }
      }
    });
  },100);
}

// Load party names dropdown when type changes
async function waLoadPartyNames(type){
  var sel = document.getElementById('wa-party-name');
  if(!sel||!type){if(sel)sel.innerHTML='<option value="">— Select type first —</option>';return;}
  sel.innerHTML='<option value="">&#9203; Loading...</option>';
  try{
    var rows=[];
    if(type==='sc'||type==='labour_contractor') rows=await sbFetch('subcontractors',{select:'id,name',filter:'status=eq.active',order:'name.asc'});
    else if(type==='vendor') rows=await sbFetch('vendors',{select:'id,name',filter:'status=eq.active',order:'name.asc'});
    else if(type==='labour') rows=await sbFetch('labourers',{select:'id,name',filter:'status=eq.active',order:'name.asc'});
    else if(type==='machinery'){
      try{rows=await sbFetch('equipment',{select:'id,name',order:'name.asc'});}catch(e){rows=[];}
      if(!Array.isArray(rows)||!rows.length) rows=await sbFetch('vendors',{select:'id,name',filter:'status=eq.active',order:'name.asc'});
    }
    var list=Array.isArray(rows)?rows:[];
    sel.innerHTML='<option value="">— Select —</option>'+list.map(function(r){return '<option value="'+r.name+'">'+r.name+'</option>';}).join('');
  }catch(e){sel.innerHTML='<option value="">— Error loading —</option>';console.error(e);}
}

// WO/PO mutual exclusion per resource
function waDocToggle(label, docType){
  var radio = label.querySelector('input[type="radio"]');
  if(!radio) return;
  var name = radio.getAttribute('name');
  // If WO selected, disable PO; if PO selected, disable WO
  setTimeout(function(){
    var radios = document.querySelectorAll('input[name="'+name+'"]');
    radios.forEach(function(r){
      var parentLabel = r.closest('label');
      if(!parentLabel) return;
      if(docType==='wo' && r.value==='po') { r.disabled=true; parentLabel.style.opacity='0.4'; parentLabel.style.cursor='not-allowed'; }
      else if(docType==='po' && r.value==='wo') { r.disabled=true; parentLabel.style.opacity='0.4'; parentLabel.style.cursor='not-allowed'; }
      else { r.disabled=false; parentLabel.style.opacity='1'; parentLabel.style.cursor='pointer'; }
      // If "none" selected, re-enable all
      if(docType==='none'){ r.disabled=false; parentLabel.style.opacity='1'; parentLabel.style.cursor='pointer'; }
    });
  },0);
}

async function waTypeChangeFor(resId, type){
  var row=document.querySelector('.wa-res-row[data-res-id="'+resId+'"]');
  var sel=row&&row.querySelector('.wa-party-sel');
  if(!sel||!type){if(sel)sel.innerHTML='<option value="">— Select type first —</option>';return;}
  sel.innerHTML='<option value="">&#9203; Loading...</option>';
  try{
    var rows=[];
    if(type==='sc'||type==='labour_contractor') rows=await sbFetch('subcontractors',{select:'id,name',filter:'status=eq.active',order:'name.asc'});
    else if(type==='vendor') rows=await sbFetch('vendors',{select:'id,name',filter:'status=eq.active',order:'name.asc'});
    else if(type==='labour') rows=await sbFetch('labourers',{select:'id,name',filter:'status=eq.active',order:'name.asc'});
    else if(type==='machinery'){
      try{rows=await sbFetch('equipment',{select:'id,name',order:'name.asc'});}catch(e){rows=[];}
      if(!Array.isArray(rows)||!rows.length) rows=await sbFetch('vendors',{select:'id,name',filter:'status=eq.active',order:'name.asc'});
    }
    var list=Array.isArray(rows)?rows:[];
    sel.innerHTML='<option value="">— Select —</option>'+list.map(function(r){return '<option value="'+r.name+'">'+r.name+'</option>';}).join('');
  }catch(e){sel.innerHTML='<option value="">— Error —</option>';console.error(e);}
}

async function waTypeChange(){
  var type = gv('wa-type');
  var sel  = document.getElementById('wa-party-sel');
  if(!sel||!type){ if(sel) sel.innerHTML='<option value="">— Select party type first —</option>'; return; }
  sel.innerHTML='<option value="">&#9203; Loading...</option>';
  try{
    var rows=[];
    if(type==='sc'){
      rows = await sbFetch('subcontractors',{select:'id,name',filter:'status=eq.active',order:'name.asc'});
    } else if(type==='vendor'){
      rows = await sbFetch('vendors',{select:'id,name',filter:'status=eq.active',order:'name.asc'});
    } else if(type==='labour_contractor'){
      rows = await sbFetch('subcontractors',{select:'id,name',filter:'status=eq.active',order:'name.asc'});
    } else if(type==='labour'){
      rows = await sbFetch('labourers',{select:'id,name',filter:'status=eq.active',order:'name.asc'});
    } else if(type==='machinery'){
      try{ rows = await sbFetch('equipment',{select:'id,name',order:'name.asc'}); }catch(e){ rows=[]; }
      if(!Array.isArray(rows)||!rows.length){
        rows = await sbFetch('vendors',{select:'id,name',filter:'status=eq.active',order:'name.asc'});
      }
    }
    var list = Array.isArray(rows)?rows:[];
    if(!list.length){
      sel.innerHTML='<option value="">— No '+type+' found in Registry —</option>';return;
    }
    sel.innerHTML='<option value="">— Select —</option>'+
      list.map(function(r){return '<option value="'+r.name+'">'+r.name+'</option>';}).join('');
  }catch(e){
    console.error('waTypeChange:',e);
    sel.innerHTML='<option value="">— Error loading —</option>';
  }
}


async function execSaveAllot(itemId, projId){
  // Read shared party details from Step 1
  var type  = (document.getElementById('wa-party-type')||{}).value||'';
  var party = ((document.getElementById('wa-party-name')||{}).value||'').trim();
  var start = (document.getElementById('wa-start-date')||{}).value||'';
  var end   = (document.getElementById('wa-end-date')||{}).value||'';
  var scope = ((document.getElementById('wa-scope')||{}).value||'').trim();
  var docRadio = document.querySelector('input[name="wa-doc-type"]:checked');
  var docType  = docRadio ? docRadio.value : 'none';

  if(!type){toast('Select party type','warning');return;}
  if(!party){toast('Select party name','warning');return;}

  // Collect checked resources from Step 2
  var checkedRows = Array.from(document.querySelectorAll('.wa-res-chk:checked'));
  if(!checkedRows.length){toast('Select at least one resource','warning');return;}

  var allValid = true;
  var toSave = [];

  checkedRows.forEach(function(chk){
    var resId = chk.getAttribute('data-res-id');
    var row = chk.closest('.wa-res-row');
    var rrId = chk.getAttribute('data-rr-id')||null;
    var rrMax = parseFloat(chk.getAttribute('data-rr-max'))||0;
    var qty  = parseFloat(row&&row.querySelector('.wa-qty-inp')?row.querySelector('.wa-qty-inp').value:0)||0;
    var rate = parseFloat(row&&row.querySelector('.wa-rate-inp')?row.querySelector('.wa-rate-inp').value:0)||0;
    var unit = row&&row.querySelector('.wa-unit-sel')?row.querySelector('.wa-unit-sel').value:null;
    var spec = row&&row.querySelector('.wa-spec-inp')?(row.querySelector('.wa-spec-inp').value||'').trim():'';

    if(!qty){toast('Enter qty for all selected resources','warning');allValid=false;return;}
    if(!rate){toast('Enter rate for all selected resources','warning');allValid=false;return;}
    if(qty > rrMax){
      toast('Qty ('+qty+') exceeds this RR approved qty ('+rrMax+')','warning');
      allValid=false; return;
    }

    var planRes = WA_PLANNED.find(function(r){return r.id===resId;})||{};
    toSave.push({resId:resId, planRes:planRes, type:type, party:party, qty:qty, rate:rate,
      unit:unit||null, scope:scope||null, spec:spec||null, start:start||null, end:end||null,
      docType:docType, rrId:rrId});
  });

  if(!allValid) return;

  // Generate one batch_id for all resources saved together
  var batchId = 'batch-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);

  var saved = 0;
  var errors = 0;
  for(var i=0;i<toSave.length;i++){
    var s = toSave[i];
    try{
      var res = await sbInsert('boq_exec_resources',{
        project_id: projId,
        boq_item_id: s.planRes.boq_item_id||null,
        boq_subitem_id: s.planRes.boq_subitem_id||null,
        boq_exec_resource_id: s.resId,
        date: new Date().toISOString().slice(0,10),
        exec_type: s.type,
        party_name: s.party,
        qty: s.qty, unit: s.unit, rate: s.rate,
        scope: s.scope, start_date: s.start, end_date: s.end,
        doc_type: s.docType==='none'?null:s.docType,
        specification: s.spec||null,
        batch_id: batchId,
        rr_id: s.rrId||null
      });
      if(res&&res[0]) WA_ALLOT.push(res[0]);
      saved++;
    }catch(e){
      console.error('Save allotment error for '+s.party+':',e);
      errors++;
    }
  }

  closeSheet('ov-exec','sh-exec');
  if(saved>0) toast(saved+' allotment'+(saved>1?'s':'')+' saved successfully','success');
  if(errors>0) toast(errors+' allotment'+(errors>1?'s':'')+' failed to save','error');
  execRender();
}

async function execEditAllotted(id){
  var a=WA_ALLOT.find(function(x){return x.id===id;});
  if(!a){toast('Allotment not found','warning');return;}
  await loadUomIfNeeded();
  var uomOpts=buildUomOpts(a.unit||'');
  var projId=(document.getElementById('exec-proj-sel')||{}).value||'';
  var planRes=WA_PLANNED.find(function(r){return r.id===a.boq_exec_resource_id;})||{};

  document.getElementById('exec-sheet-title').textContent='Edit Allotment — '+a.party_name;
  document.getElementById('exec-sheet-body').innerHTML=
    '<div style="background:#FFF3E0;border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:11px;">'+
      '<div style="font-weight:800;color:#E65100;">'+a.party_name+'</div>'+
      '<div style="color:var(--text3);">Party type: '+(a.exec_type||'—')+'</div>'+
    '</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">Qty *</label><input id="ea-qty" class="finp" type="number" step="0.001" value="'+(a.qty||0)+'"></div>'+
      '<div><label class="flbl">Unit</label><select id="ea-unit-sel" class="fsel">'+uomOpts+'</select></div>'+
    '</div>'+
    '<label class="flbl">Allotment Rate (₹) *</label>'+
    '<input id="ea-rate" class="finp" type="number" step="0.01" value="'+(a.rate||0)+'">'+
    '<label class="flbl">Scope / Terms</label>'+
    '<textarea id="ea-scope" class="ftxt" rows="2" style="margin-bottom:8px;">'+esc(a.scope||'')+'</textarea>'+
    '<div class="g2">'+
      '<div><label class="flbl">Start Date</label><input id="ea-start" class="finp" type="date" value="'+(a.start_date||'')+'"></div>'+
      '<div><label class="flbl">End Date</label><input id="ea-end" class="finp" type="date" value="'+(a.end_date||'')+'"></div>'+
    '</div>';

  var sf=document.getElementById('exec-sheet-foot');
  sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#E65100;color:white;';
  sb.innerHTML='&#10003; Update Allotment';
  sb.onclick=function(){execUpdateAllotted(id);};
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-exec','sh-exec');
}

async function execUpdateAllotted(id){
  var qty=parseFloat(gv('ea-qty'))||0;
  var rate=parseFloat(gv('ea-rate'))||0;
  var unitSel=document.getElementById('ea-unit-sel');
  var unit=(unitSel&&unitSel.value)?unitSel.value:null;
  if(!qty||!rate){toast('Qty and rate required','warning');return;}
  var updates={qty:qty,rate:rate,unit:unit,scope:gv('ea-scope')||null,start_date:gv('ea-start')||null,end_date:gv('ea-end')||null};
  try{
    await sbUpdate('boq_exec_resources',id,updates);
    var idx=WA_ALLOT.findIndex(function(a){return a.id===id;});
    if(idx>-1) Object.assign(WA_ALLOT[idx],updates);
    toast('Allotment updated!','success');
    closeSheet('ov-exec','sh-exec');
    execRenderAllotted();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function execDelAllotted(id){
  var allot=WA_ALLOT.find(function(a){return a.id===id;})||{};
  var hasOrder=WA_ORDERS.some(function(o){return o.allot_id===id;});
  var msg=hasOrder
    ? 'This allotment has WO/PO(s) generated.\nDeleting will also delete those order records.\n\nDelete allotment and related orders?'
    : 'Delete this allotment?';
  if(!confirm(msg)) return;
  var relOrds=WA_ORDERS.filter(function(o){return o.allot_id===id;});
  for(var i=0;i<relOrds.length;i++) try{await sbDelete('work_orders',relOrds[i].id);}catch(e){}
  WA_ORDERS=WA_ORDERS.filter(function(o){return o.allot_id!==id;});
  WA_ALLOT=WA_ALLOT.filter(function(a){return a.id!==id;});
  // Reset linked RR back to approved so it can be re-allotted
  if(allot.rr_id){
    try{await sbUpdate('resource_requisitions',allot.rr_id,{status:'approved',allotment_id:null});}catch(e){}
    var rrIdx=RR_ITEMS.findIndex(function(r){return r.id===allot.rr_id;});
    if(rrIdx>-1){RR_ITEMS[rrIdx].status='approved';RR_ITEMS[rrIdx].allotment_id=null;}
    // Add back to WA_APPROVED_RRS
    var rr=RR_ITEMS[rrIdx];
    if(rr&&!WA_APPROVED_RRS.some(function(r){return r.id===rr.id;})) WA_APPROVED_RRS.push(rr);
  }
  if(WA_SUBTAB==='allotted') execRenderAllotted();
  else if(WA_SUBTAB==='allot') execRender();
  else execRenderSubTab();
  try{await sbDelete('boq_exec_resources',id);}catch(e){console.error(e);}
  toast('Allotment deleted','success');
}

async function execDelAllot(id){
  var allot=WA_ALLOT.find(function(a){return a.id===id;})||{};
  if(!confirm('Delete this allotment?\n'+(WA_ORDERS.some(function(o){return o.allot_id===id;})
    ?'Related WO/PO records will also be deleted.':'')
  )) return;
  var relOrds=WA_ORDERS.filter(function(o){return o.allot_id===id;});
  for(var i=0;i<relOrds.length;i++) try{await sbDelete('work_orders',relOrds[i].id);}catch(e){}
  WA_ORDERS=WA_ORDERS.filter(function(o){return o.allot_id!==id;});
  WA_ALLOT=WA_ALLOT.filter(function(a){return a.id!==id;});
  // Reset linked RR back to approved
  if(allot.rr_id){
    try{await sbUpdate('resource_requisitions',allot.rr_id,{status:'approved',allotment_id:null});}catch(e){}
    var rrIdx=RR_ITEMS.findIndex(function(r){return r.id===allot.rr_id;});
    if(rrIdx>-1){RR_ITEMS[rrIdx].status='approved';RR_ITEMS[rrIdx].allotment_id=null;}
    var rr=RR_ITEMS[rrIdx];
    if(rr&&!WA_APPROVED_RRS.some(function(r){return r.id===rr.id;})) WA_APPROVED_RRS.push(rr);
  }
  execRenderSubTab();
  try{await sbDelete('boq_exec_resources',id);}catch(e){console.error(e);}
  toast('Allotment deleted','success');
}

function execGenCombinedDoc(t){var cc=Array.from(document.querySelectorAll(".wa-sel-chk:checked")).map(function(c){return c.getAttribute("data-allot-id");});if(!cc.length){toast("Check at least one resource row","warning");return;}var aa=cc.map(function(id){return WA_ALLOT.find(function(a){return a.id===id;});}).filter(Boolean);if(!aa.length)return;if(t==="wo")generateCombinedDoc(aa,"WORK ORDER","#E65100","#FFF3E0");else generateCombinedDoc(aa,"PURCHASE ORDER","#1565C0","#E3F2FD");}
function generateCombinedDoc(allots,title,col,tbg){var proj=PROJ_DATA.find(function(p){return p.id===allots[0].project_id;})||{};var co=COMPANY_DATA||{};var inr=function(n){return "\u20b9"+Number(n||0).toLocaleString("en-IN");};var fmtD=function(d){if(!d)return "";var p=d.split("-");return p.length===3?p[2]+"/"+p[1]+"/"+p[0]:d;};var tot=allots.reduce(function(s,a){return s+Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));},0);var dn=(title==="WORK ORDER"?"WO":"PO")+"-"+new Date().getFullYear()+"-"+String(Date.now()).slice(-4);var rows=allots.map(function(a,i){var amt=Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));return "<tr><td>"+(i+1)+"</td><td>"+a.party_name+(a.scope?"<br><small>"+a.scope+"</small>":"")+"</td><td>"+(a.qty||0)+" "+(a.unit||"")+"</td><td>"+inr(a.rate)+"</td><td>"+inr(amt)+"</td></tr>";}).join("");var html="<!DOCTYPE html><html><head><meta charset=UTF-8><title>"+title+"</title><style>body{font-family:Arial,sans-serif;margin:0;padding:20px;font-size:12px;}.hdr{display:flex;justify-content:space-between;border-bottom:3px solid "+col+";padding-bottom:10px;margin-bottom:12px;}.cn{font-size:17px;font-weight:900;color:"+col+";}table{width:100%;border-collapse:collapse;margin:10px 0;}th{background:"+col+";color:white;padding:7px 10px;text-align:left;font-size:11px;}td{padding:7px 10px;border-bottom:1px solid #EEE;}.tr td{font-weight:900;background:"+tbg+";}.ft{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:30px;}.sg{border-top:1.5px solid #333;padding-top:6px;font-size:11px;color:#666;margin-top:40px;}@media print{button{display:none;}}</style></head><body><button onclick=\"window.print()\" style=\"background:"+col+";color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;margin-bottom:16px;\">Print/Save PDF</button><div class=hdr><div><div class=cn>"+(co.name||"Company")+"</div><div style=\"font-size:10px;color:#666\">"+(co.address||"")+"</div><div style=\"font-size:10px;color:#666\">"+(co.gstin?"GSTIN: "+co.gstin:"")+"</div></div><div style=\"text-align:right\"><div style=\"font-size:19px;font-weight:900;\">"+title+"</div><div style=\"color:#666\">"+dn+"</div><div style=\"color:#666\">Date: "+fmtD(new Date().toISOString().slice(0,10))+"</div><div style=\"color:#666\">Project: "+(proj.name||"")+"</div></div></div><table><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>"+rows+"<tr class=tr><td colspan=4 style=\"text-align:right\">Total</td><td>"+inr(tot)+"</td></tr></table><div class=ft><div><div class=sg>Issued By<br><br>"+(co.name||"")+"</div></div><div><div class=sg>Authorized Signatory</div></div></div></body></html>";var w=window.open("","_blank");if(w){w.document.write(html);w.document.close();}else toast("Allow popups","warning");}

function generateWorkOrder(allot){
  var proj=PROJ_DATA.find(function(p){return p.id===allot.project_id;})||{};
  var co=COMPANY_DATA||{};
  var inr=function(n){return '₹'+Number(n||0).toLocaleString('en-IN');};
  var fmtD=function(d){if(!d)return '';var p=d.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d;};
  var amt=Math.round((parseFloat(allot.qty)||0)*(parseFloat(allot.rate)||0));
  var woNo='WO-'+new Date().getFullYear()+'-'+String(Date.now()).slice(-4);
  var html=
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Work Order</title><style>'+
    'body{font-family:Arial,sans-serif;margin:0;padding:20px;font-size:12px;color:#222;}'+
    '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #E65100;padding-bottom:12px;margin-bottom:12px;}'+
    '.co-name{font-size:18px;font-weight:900;color:#E65100;}'+
    '.doc-title{font-size:20px;font-weight:900;color:#333;text-align:right;}'+
    '.doc-no{font-size:12px;color:#666;text-align:right;}'+
    'table{width:100%;border-collapse:collapse;margin:10px 0;}'+
    'th{background:#E65100;color:white;padding:7px 10px;text-align:left;font-size:11px;}'+
    'td{padding:7px 10px;border-bottom:1px solid #EEE;}'+
    '.total-row td{font-weight:900;background:#FFF3E0;font-size:13px;}'+
    '.footer{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}'+
    '.sig{border-top:1.5px solid #333;padding-top:6px;font-size:11px;color:#666;margin-top:40px;}'+
    '@media print{button{display:none;}}'+
    '</style></head><body>'+
    '<button onclick="window.print()" style="background:#E65100;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;margin-bottom:16px;font-size:13px;">🖨 Print / Save PDF</button>'+
    '<div class="header">'+
      '<div><div class="co-name">'+(co.name||'Company Name')+'</div>'+
        '<div style="font-size:10px;color:#666;margin-top:4px;">'+(co.address||'')+'</div>'+
        '<div style="font-size:10px;color:#666;">'+(co.gstin?'GSTIN: '+co.gstin:'')+'</div></div>'+
      '<div><div class="doc-title">WORK ORDER</div>'+
        '<div class="doc-no">'+woNo+'</div>'+
        '<div class="doc-no">Date: '+fmtD(new Date().toISOString().slice(0,10))+'</div></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px;">'+
      '<div style="background:#F8FAFC;border-radius:8px;padding:10px;">'+
        '<div style="font-size:10px;color:#666;font-weight:700;margin-bottom:4px;">TO</div>'+
        '<div style="font-weight:800;font-size:13px;">'+(allot.party_name||'')+'</div>'+
        '<div style="font-size:10px;color:#666;text-transform:uppercase;">'+allot.exec_type+'</div>'+
      '</div>'+
      '<div style="background:#F8FAFC;border-radius:8px;padding:10px;">'+
        '<div style="font-size:10px;color:#666;font-weight:700;margin-bottom:4px;">PROJECT</div>'+
        '<div style="font-weight:800;font-size:13px;">'+(proj.name||'')+'</div>'+
        '<div style="font-size:10px;color:#666;">'+(proj.location||proj.code||'')+'</div>'+
      '</div>'+
    '</div>'+
    '<table>'+
      '<tr><th>Description</th><th>Qty</th><th>Unit</th><th>Rate (₹)</th><th>Amount (₹)</th></tr>'+
      '<tr><td>'+(allot.party_name||'Work')+(allot.scope?'<br><small style="color:#666;">'+allot.scope+'</small>':'')+'</td>'+
        '<td>'+(allot.qty||0)+'</td><td>'+(allot.unit||'')+'</td>'+
        '<td>'+inr(allot.rate)+'</td><td>'+inr(amt)+'</td></tr>'+
      '<tr class="total-row"><td colspan="4" style="text-align:right;">Total Amount</td><td>'+inr(amt)+'</td></tr>'+
    '</table>'+
    (allot.start_date||allot.end_date?
      '<div style="background:#F8FAFC;border-radius:8px;padding:10px;margin:10px 0;font-size:11px;">'+
        (allot.start_date?'Start Date: <b>'+fmtD(allot.start_date)+'</b>  ':'')+
        (allot.end_date?'End Date: <b>'+fmtD(allot.end_date)+'</b>':'')+
      '</div>':'')+
    (allot.scope?'<div style="background:#FFFDE7;border-radius:8px;padding:10px;margin:10px 0;font-size:11px;"><b>Scope of Work / Terms:</b><br>'+allot.scope+'</div>':'')+
    '<div class="footer">'+
      '<div><div class="sig">Issued By<br><br>'+(co.name||'')+'</div></div>'+
      '<div><div class="sig">Accepted By<br><br>'+(allot.party_name||'')+'</div></div>'+
    '</div>'+
    '</body></html>';
  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else toast('Allow popups to open document','warning');
}

function generatePurchaseOrder(allot){
  var proj=PROJ_DATA.find(function(p){return p.id===allot.project_id;})||{};
  var co=COMPANY_DATA||{};
  var inr=function(n){return '₹'+Number(n||0).toLocaleString('en-IN');};
  var fmtD=function(d){if(!d)return '';var p=d.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d;};
  var amt=Math.round((parseFloat(allot.qty)||0)*(parseFloat(allot.rate)||0));
  var poNo='PO-'+new Date().getFullYear()+'-'+String(Date.now()).slice(-4);
  var html=
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Purchase Order</title><style>'+
    'body{font-family:Arial,sans-serif;margin:0;padding:20px;font-size:12px;color:#222;}'+
    '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1565C0;padding-bottom:12px;margin-bottom:12px;}'+
    '.co-name{font-size:18px;font-weight:900;color:#1565C0;}'+
    '.doc-title{font-size:20px;font-weight:900;color:#333;text-align:right;}'+
    'table{width:100%;border-collapse:collapse;margin:10px 0;}'+
    'th{background:#1565C0;color:white;padding:7px 10px;text-align:left;font-size:11px;}'+
    'td{padding:7px 10px;border-bottom:1px solid #EEE;}'+
    '.total-row td{font-weight:900;background:#E3F2FD;font-size:13px;}'+
    '.footer{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}'+
    '.sig{border-top:1.5px solid #333;padding-top:6px;font-size:11px;color:#666;margin-top:40px;}'+
    '@media print{button{display:none;}}'+
    '</style></head><body>'+
    '<button onclick="window.print()" style="background:#1565C0;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;margin-bottom:16px;font-size:13px;">🖨 Print / Save PDF</button>'+
    '<div class="header">'+
      '<div><div class="co-name">'+(co.name||'Company Name')+'</div>'+
        '<div style="font-size:10px;color:#666;margin-top:4px;">'+(co.address||'')+'</div>'+
        '<div style="font-size:10px;color:#666;">'+(co.gstin?'GSTIN: '+co.gstin:'')+'</div></div>'+
      '<div><div class="doc-title">PURCHASE ORDER</div>'+
        '<div style="font-size:12px;color:#666;text-align:right;">'+poNo+'</div>'+
        '<div style="font-size:12px;color:#666;text-align:right;">Date: '+fmtD(new Date().toISOString().slice(0,10))+'</div></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px;">'+
      '<div style="background:#F8FAFC;border-radius:8px;padding:10px;">'+
        '<div style="font-size:10px;color:#666;font-weight:700;margin-bottom:4px;">VENDOR / SUPPLIER</div>'+
        '<div style="font-weight:800;font-size:13px;">'+(allot.party_name||'')+'</div>'+
        '<div style="font-size:10px;color:#666;text-transform:uppercase;">'+allot.exec_type+'</div>'+
      '</div>'+
      '<div style="background:#F8FAFC;border-radius:8px;padding:10px;">'+
        '<div style="font-size:10px;color:#666;font-weight:700;margin-bottom:4px;">DELIVERY / SITE</div>'+
        '<div style="font-weight:800;font-size:13px;">'+(proj.name||'')+'</div>'+
        '<div style="font-size:10px;color:#666;">'+(proj.location||proj.code||'')+'</div>'+
      '</div>'+
    '</div>'+
    '<table>'+
      '<tr><th>Item / Material</th><th>Qty</th><th>Unit</th><th>Rate (₹)</th><th>Amount (₹)</th></tr>'+
      '<tr><td>'+(allot.party_name||'Material')+(allot.scope?'<br><small style="color:#666;">'+allot.scope+'</small>':'')+'</td>'+
        '<td>'+(allot.qty||0)+'</td><td>'+(allot.unit||'')+'</td>'+
        '<td>'+inr(allot.rate)+'</td><td>'+inr(amt)+'</td></tr>'+
      '<tr class="total-row"><td colspan="4" style="text-align:right;">Total Amount</td><td>'+inr(amt)+'</td></tr>'+
    '</table>'+
    (allot.start_date||allot.end_date?
      '<div style="background:#F8FAFC;border-radius:8px;padding:10px;margin:10px 0;font-size:11px;">'+
        (allot.start_date?'Delivery From: <b>'+fmtD(allot.start_date)+'</b>  ':'')+
        (allot.end_date?'Delivery By: <b>'+fmtD(allot.end_date)+'</b>':'')+
      '</div>':'')+
    (allot.scope?'<div style="background:#E8F5E9;border-radius:8px;padding:10px;margin:10px 0;font-size:11px;"><b>Terms / Specifications:</b><br>'+allot.scope+'</div>':'')+
    '<div style="background:#FFFDE7;border-radius:8px;padding:10px;margin:10px 0;font-size:10px;color:#666;">'+
      'Please supply the above items as per specifications. Delivery receipt (GRN) required at site.'+
    '</div>'+
    '<div class="footer">'+
      '<div><div class="sig">Authorized Signatory<br><br>'+(co.name||'')+'</div></div>'+
      '<div><div class="sig">Vendor Acknowledgement<br><br>'+(allot.party_name||'')+'</div></div>'+
    '</div>'+
    '</body></html>';
  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else toast('Allow popups to open document','warning');
}

// Option to regenerate WO/PO from existing allotment row
function execRegenDoc(allotId, docType){
  var allot=WA_ALLOT.find(function(a){return a.id===allotId;});
  if(!allot){toast('Allotment not found','warning');return;}
  if(docType==='wo') generateWorkOrder(allot);
  else generatePurchaseOrder(allot);
}


// ── Daily Progress ─────────────────────────────────────────────────────
// ── Orders Tab ─────────────────────────────────────────────────────────
function execRenderOrders(){
  var el=document.getElementById('exec-content');if(!el)return;
  if(!WA_ORDERS.length){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);"><div style="font-size:36px;">&#128196;</div><div style="font-weight:700;margin-top:8px;">No orders yet</div><div style="font-size:12px;margin-top:4px;">Generate WO/PO from the Allotted Work tab</div></div>';
    return;
  }
  var tLbl={vendor:'Vendor',sc:'SC',labour_contractor:'Labour Contr.',labour:'Labour',machinery:'Machinery'};
  var tCol={vendor:'#1565C0',sc:'#6A1B9A',labour_contractor:'#2E7D32',labour:'#37474F',machinery:'#E65100'};

  // Group by doc_type then sort by doc_number
  var grouped={wo:[],po:[]};
  WA_ORDERS.forEach(function(o){ if(o.doc_type==='wo') grouped.wo.push(o); else grouped.po.push(o); });
  grouped.wo.sort(function(a,b){return (a.doc_number||'').localeCompare(b.doc_number||'');});
  grouped.po.sort(function(a,b){return (a.doc_number||'').localeCompare(b.doc_number||'');});

  var renderGroup=function(orders, label, col){
    if(!orders.length) return '';
    return '<div style="margin-bottom:16px;">'+
      '<div style="font-size:11px;font-weight:800;color:'+col+';padding:6px 0;margin-bottom:6px;border-bottom:2px solid '+col+'20;">'+label+' ('+orders.length+')</div>'+
      orders.map(function(o){
        var docNo=(o.doc_type==='wo'?'WO':'PO')+'-'+(o.doc_number||'?');
        var fmtD=function(d){if(!d)return '';var p=d.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d;};
        var col2=tCol[o.party_type]||'#37474F';
        return '<div style="background:white;border-radius:12px;border:1px solid var(--border);margin-bottom:8px;padding:12px 14px;display:flex;align-items:center;gap:10px;">'+
          '<div style="width:42px;height:42px;border-radius:10px;background:'+col+'15;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">&#128196;</div>'+
          '<div style="flex:1;min-width:0;">'+
            '<div style="font-size:13px;font-weight:800;">'+docNo+'</div>'+
            '<div style="font-size:11px;font-weight:700;color:var(--navy);">'+o.party_name+'</div>'+
            '<div style="font-size:10px;color:var(--text3);">'+(tLbl[o.party_type]||o.party_type)+' &bull; '+(o.qty||0)+' '+(o.unit||'')+' @ &#8377;'+(o.rate||0)+' &bull; '+fmtD(o.doc_date)+'</div>'+
          '</div>'+
          '<div style="text-align:right;flex-shrink:0;">'+
            '<div style="font-size:15px;font-weight:900;color:'+col+';">&#8377;'+Math.round(o.amount||0).toLocaleString('en-IN')+'</div>'+
            '<button onclick="execPrintOrder(\''+o.id+'\')" style="background:'+col+';color:white;border:none;border-radius:6px;padding:3px 10px;font-size:10px;font-weight:800;cursor:pointer;margin-top:4px;">&#128438; Print</button>'+
            '<button onclick="execDeleteOrder(\''+o.id+'\')" style="background:#FEE2E2;color:#C62828;border:none;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:800;cursor:pointer;margin-top:4px;margin-left:4px;">&#215;</button>'+
          '</div>'+
        '</div>';
      }).join('')+
    '</div>';
  };

  el.innerHTML=
    renderGroup(grouped.wo,'Work Orders','#E65100')+
    renderGroup(grouped.po,'Purchase Orders','#1565C0');
}

function execPrintOrder(orderId){
  var o=WA_ORDERS.find(function(x){return x.id===orderId;});
  if(!o){toast('Order not found','warning');return;}
  var allot=WA_ALLOT.find(function(a){return a.id===o.allot_id;})||{};
  var merged=Object.assign({},allot,{qty:o.qty,rate:o.rate,unit:o.unit,party_name:o.party_name,exec_type:o.party_type,project_id:o.project_id,scope:allot.scope||''});
  if(o.doc_type==='wo') generateWorkOrder(merged);
  else generatePurchaseOrder(merged);
}

async function execDeleteOrder(id){
  if(!confirm('Delete this order record?\n(The printed document is not affected)'))return;
  WA_ORDERS=WA_ORDERS.filter(function(o){return o.id!==id;});
  execRenderOrders();
  try{await sbDelete('work_orders',id);}catch(e){console.error(e);}
  toast('Order deleted','success');
}


function execRenderAllotted(){
  var el=document.getElementById('exec-content');if(!el)return;
  if(!WA_ALLOT.length){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);"><div style="font-size:32px;">&#128221;</div><div style="font-weight:700;margin-top:8px;">No allotments yet</div><div style="font-size:12px;margin-top:4px;">Allot work in the Work Allotment tab first</div></div>';
    return;
  }

  var tLbl={vendor:'Vendor',sc:'SC',labour_contractor:'Labour Contr.',labour:'Labour',machinery:'Machinery'};
  var tCol={vendor:'#1565C0',sc:'#6A1B9A',labour_contractor:'#2E7D32',labour:'#37474F',machinery:'#E65100'};
  var inr=function(n){return '&#8377;'+Math.round(Number(n||0)).toLocaleString('en-IN');};

  // Group by batch_id — allotments saved together appear as one group
  // Allotments without batch_id (old data) each get their own group
  var batches={};
  var batchOrder=[];
  WA_ALLOT.forEach(function(a){
    var key = a.batch_id || ('solo-'+a.id);
    if(!batches[key]){
      batches[key]={batchId:key, items:[], date:a.date||a.created_at};
      batchOrder.push(key);
    }
    batches[key].items.push(a);
  });

  el.innerHTML = batchOrder.map(function(batchKey){
    var batch = batches[batchKey];
    var items = batch.items;

    // Determine doc type for this batch (all items in a batch share same doc_type)
    var docType = items.reduce(function(dt,a){ return a.doc_type||dt; }, null);
    var hasWO = docType==='wo';
    var hasPO = docType==='po';

    var totalAmt = items.reduce(function(s,a){return s+Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));},0);
    var batchDate = items[0].date||'';

    // Get existing orders for this entire batch
    var batchOrders = WA_ORDERS.filter(function(o){
      return items.some(function(a){return a.id===o.allot_id;});
    });
    var hasOrder = batchOrders.length>0;

    // Batch header — show all party names if multiple
    var partyNames = items.map(function(a){return a.party_name;}).filter(function(v,i,arr){return arr.indexOf(v)===i;});
    var headerLabel = partyNames.length===1
      ? partyNames[0]
      : partyNames.length+' parties';
    var firstType = items[0].exec_type||'';
    var col = tCol[firstType]||'#37474F';

    // Resource rows
    var itemRows = items.map(function(a){
      var aCol = tCol[a.exec_type]||'#37474F';
      var itemOrders = WA_ORDERS.filter(function(o){return o.allot_id===a.id;});
      var planRes = WA_PLANNED.find(function(r){return r.id===a.boq_exec_resource_id;})||{};
      var boqItem = WA_ITEMS.find(function(i){return i.id===(a.boq_item_id||planRes.boq_item_id);})||{};
      return '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid #F5F5F5;">'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">'+
            '<span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:3px;background:'+aCol+'20;color:'+aCol+';">'+( tLbl[a.exec_type]||a.exec_type)+'</span>'+
            '<span style="font-size:12px;font-weight:800;">'+a.party_name+'</span>'+
          '</div>'+
          (boqItem.item_code?'<div style="font-size:9px;color:var(--text3);">BOQ: '+boqItem.item_code+' '+(boqItem.short_name||boqItem.description||'')+'</div>':'')+
          '<div style="font-size:10px;color:var(--text3);">'+a.qty+' '+(a.unit||'')+(a.rate?' @ '+inr(a.rate):'')+(a.scope?' | '+a.scope:'')+'</div>'+
        '</div>'+
        '<div style="text-align:right;flex-shrink:0;">'+
          '<div style="font-size:12px;font-weight:800;">'+inr((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0))+'</div>'+
          (itemOrders.length?'<div style="font-size:9px;color:#2E7D32;font-weight:700;">&#10003; Doc issued</div>':'<div style="font-size:9px;color:var(--text3);">Pending</div>')+
        '</div>'+
        '<button onclick="execEditAllotted(\''+a.id+'\')" title="Edit" style="background:#E3F2FD;border:none;color:#1565C0;font-size:11px;border-radius:5px;padding:2px 7px;cursor:pointer;font-weight:800;flex-shrink:0;">&#9998;</button>'+
        '<button onclick="execDelAllotted(\''+a.id+'\')" title="Delete" style="background:none;border:none;color:#C62828;font-size:16px;cursor:pointer;flex-shrink:0;">&#215;</button>'+
      '</div>';
    }).join('');

    // Batch order download row
    var orderRow = hasOrder
      ? '<div style="padding:6px 14px;background:#E8F5E9;border-top:1px solid #C8E6C9;display:flex;align-items:center;gap:8px;">'+
          '<span style="font-size:11px;color:#2E7D32;font-weight:800;">&#10003; Document issued</span>'+
          batchOrders.filter(function(o,i,arr){return arr.findIndex(function(x){return x.doc_number===o.doc_number&&x.doc_type===o.doc_type;})===i;}).map(function(o){
            return '<span style="font-size:10px;background:#2E7D32;color:white;padding:2px 8px;border-radius:4px;font-weight:700;cursor:pointer;" onclick="execViewOrder(\''+o.id+'\')">'+(o.doc_type||'').toUpperCase()+'-'+o.doc_number+'</span>';
          }).join('')+
        '</div>'
      : '';

    // Download footer — always shown when doc_type was selected (WO or PO)
    // After order issued: shows as re-download; before: shows as generate
    var downloadRow = (hasWO||hasPO)
      ? '<div style="padding:10px 14px;background:#FAFAFA;border-top:1px solid var(--border);display:flex;gap:8px;align-items:center;">'+
          '<div style="flex:1;font-size:10px;color:var(--text3);">'+(hasOrder?'Re-download document':'Generate document for this allotment')+'</div>'+
          (hasWO?'<button onclick="execGenBatchDoc(\''+batchKey+'\',\'wo\')" style="background:#E65100;color:white;border:none;border-radius:7px;padding:6px 14px;font-size:11px;font-weight:800;cursor:pointer;">&#11015; Work Order</button>':'')+
          (hasPO?'<button onclick="execGenBatchDoc(\''+batchKey+'\',\'po\')" style="background:#1565C0;color:white;border:none;border-radius:7px;padding:6px 14px;font-size:11px;font-weight:800;cursor:pointer;">&#11015; Purchase Order</button>':'')+
        '</div>'
      : '';

    return '<div style="background:white;border-radius:14px;border:1px solid var(--border);margin-bottom:12px;overflow:hidden;">'+
      '<div style="padding:10px 14px;background:'+col+'10;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">'+
        '<div style="flex:1;">'+
          '<div style="font-size:13px;font-weight:800;">'+headerLabel+'</div>'+
          '<div style="font-size:10px;color:var(--text3);">'+items.length+' resource'+(items.length>1?'s':'')+' | Allotted: '+(batchDate?batchDate.slice(0,10):'')+'</div>'+
        '</div>'+
        '<div style="font-size:13px;font-weight:800;color:'+col+';">'+inr(totalAmt)+'</div>'+
      '</div>'+
      itemRows+
      orderRow+
      downloadRow+
    '</div>';
  }).join('');
}

async function execGenPartyDoc(partyKey, docType){
  var tLbl={vendor:'Vendor',sc:'SC',labour_contractor:'Labour Contr.',labour:'Labour',machinery:'Machinery'};
  var parts=partyKey.split('::');
  var partyType=parts[0], partyName=parts.slice(1).join('::');
  var projId=(document.getElementById('exec-proj-sel')||{}).value||'';
  // Collect checked allotments for this party
  var container=document.getElementById('allotted-'+partyKey.replace(/[^a-z0-9]/gi,'-'));
  if(!container){toast('Party card not found','warning');return;}
  var checked=Array.from(container.querySelectorAll('.allot-chk:checked:not(:disabled)'));
  if(!checked.length){toast('Select at least one item','warning');return;}

  var items=checked.map(function(chk){
    var allotId=chk.getAttribute('data-allot-id');
    var allot=WA_ALLOT.find(function(a){return a.id===allotId;})||{};
    var bal=parseFloat(chk.getAttribute('data-bal'))||0;
    return {allot:allot, qty:bal, rate:parseFloat(chk.getAttribute('data-rate'))||0, unit:chk.getAttribute('data-unit')||''};
  });

  var total=items.reduce(function(s,i){return s+Math.round(i.qty*i.rate);},0);
  var proj=PROJ_DATA.find(function(p){return p.id===projId;})||{};
  var co=COMPANY_DATA||{};
  var inr=function(n){return '&#8377;'+Number(n||0).toLocaleString('en-IN');};
  var fmtD=function(d){if(!d)return '';var p=d.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d;};
  var today=new Date().toISOString().slice(0,10);

  // Generate doc number
  var prefix=docType==='wo'?'WO':'PO';
  var existingNos=WA_ORDERS.filter(function(o){return o.doc_type===docType;}).map(function(o){return parseInt(o.doc_number)||0;});
  var nextNo=(existingNos.length?Math.max.apply(null,existingNos):0)+1;
  var docNumber=String(nextNo).padStart(4,'0');
  var fullDocNo=prefix+'-'+new Date().getFullYear()+'-'+docNumber;

  // Save to DB first
  try{
    toast('Generating '+fullDocNo+'...','info');
    var orderRows=[];
    for(var i=0;i<items.length;i++){
      var it=items[i];
      var res=await sbInsert('work_orders',{
        project_id:projId, party_type:partyType, party_name:partyName,
        allot_id:it.allot.id, doc_type:docType, doc_number:docNumber,
        doc_date:today, qty:it.qty, rate:it.rate, unit:it.unit,
        amount:Math.round(it.qty*it.rate),
        boq_item_id:it.allot.boq_item_id||null
      });
      if(res&&res[0]){WA_ORDERS.push(res[0]);orderRows.push(res[0]);}
    }
    toast(fullDocNo+' saved!','success');
  }catch(e){toast('Error saving: '+e.message,'error');console.error(e);return;}

  // Build and open document
  var rows=items.map(function(it,idx){
    var amt=Math.round(it.qty*it.rate);
    return '<tr><td>'+(idx+1)+'</td><td>'+(it.allot.party_name||'Work')+(it.allot.scope?'<br><small style="color:#666">'+it.allot.scope+'</small>':'')+'</td>'+
      '<td>'+it.qty+' '+it.unit+'</td><td>'+inr(it.rate)+'</td><td>'+inr(amt)+'</td></tr>';
  }).join('');
  var titleStr=docType==='wo'?'WORK ORDER':'PURCHASE ORDER';
  var col=docType==='wo'?'#E65100':'#1565C0';
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+titleStr+'</title>'+
    '<style>body{font-family:Arial,sans-serif;margin:0;padding:20px;font-size:12px;color:#222;}'+
    'table{width:100%;border-collapse:collapse;margin:10px 0;}th{background:'+col+';color:white;padding:7px 10px;text-align:left;font-size:11px;}'+
    'td{padding:7px 10px;border-bottom:1px solid #EEE;}.tr td{font-weight:900;background:'+(docType==='wo'?'#FFF3E0':'#E3F2FD')+';}'+
    '.hdr{display:flex;justify-content:space-between;border-bottom:3px solid '+col+';padding-bottom:10px;margin-bottom:14px;}'+
    '.cn{font-size:18px;font-weight:900;color:'+col+';}'+
    '.ft{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:30px;}'+
    '.sg{border-top:1.5px solid #333;padding-top:6px;font-size:11px;color:#666;margin-top:40px;}'+
    '@media print{button{display:none;}}</style></head><body>'+
    '<button onclick="window.print()" style="background:'+col+';color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;margin-bottom:16px;">&#128438; Print / Save PDF</button>'+
    '<div class="hdr"><div><div class="cn">'+(co.name||'Company Name')+'</div>'+
      '<div style="font-size:10px;color:#666;">'+(co.address||'')+'</div>'+
      '<div style="font-size:10px;color:#666;">'+(co.gstin?'GSTIN: '+co.gstin:'')+'</div></div>'+
      '<div style="text-align:right"><div style="font-size:20px;font-weight:900;">'+titleStr+'</div>'+
        '<div style="color:#666;">'+fullDocNo+'</div>'+
        '<div style="color:#666;">Date: '+fmtD(today)+'</div>'+
        '<div style="color:#666;">Project: '+(proj.name||'')+'</div></div></div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px;">'+
      '<div style="background:#F8FAFC;border-radius:8px;padding:10px;">'+
        '<div style="font-size:10px;color:#666;font-weight:700;margin-bottom:4px;">'+(docType==='wo'?'CONTRACTOR / PARTY':'VENDOR / SUPPLIER')+'</div>'+
        '<div style="font-weight:800;font-size:14px;">'+partyName+'</div>'+
        '<div style="font-size:10px;color:#666;text-transform:uppercase;">'+(tLbl[partyType]||partyType)+'</div></div>'+
      '<div style="background:#F8FAFC;border-radius:8px;padding:10px;">'+
        '<div style="font-size:10px;color:#666;font-weight:700;margin-bottom:4px;">PROJECT / SITE</div>'+
        '<div style="font-weight:800;font-size:14px;">'+(proj.name||'')+'</div>'+
        '<div style="font-size:10px;color:#666;">'+(proj.location||proj.code||'')+'</div></div></div>'+
    '<table><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>'+
    rows+'<tr class="tr"><td colspan="4" style="text-align:right;font-weight:900;">Total Amount</td><td>'+inr(total)+'</td></tr></table>'+
    '<div class="ft"><div><div class="sg">Issued By<br><br>'+(co.name||'')+'<br>Authorized Signatory</div></div>'+
    '<div><div class="sg">Accepted By<br><br>'+partyName+'</div></div></div>'+
    '</body></html>';

  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else toast('Allow popups to open document','warning');

  // Refresh view
  setTimeout(function(){execRenderAllotted();},500);
}


async function execGenBatchDoc(batchKey, docType){
  var projId=(document.getElementById('exec-proj-sel')||{}).value||'';
  var proj=PROJ_DATA.find(function(p){return p.id===projId;})||{};
  var co=COMPANY_DATA||{};
  var inr=function(n){return '&#8377;'+Math.round(Number(n||0)).toLocaleString('en-IN');};
  var fmtD=function(d){if(!d)return '';var p=d.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d;};
  var today=new Date().toISOString().slice(0,10);
  var tLbl={vendor:'Vendor',sc:'SC',labour_contractor:'Labour Contr.',labour:'Labour',machinery:'Machinery'};

  // Get all allotments in this batch
  var batchItems = WA_ALLOT.filter(function(a){
    return (a.batch_id||('solo-'+a.id)) === batchKey;
  });
  if(!batchItems.length){toast('Allotment not found','warning');return;}

  // Check if order already exists for this batch
  var prefix = docType==='wo'?'WO':'PO';
  var existingBatchOrders = WA_ORDERS.filter(function(o){
    return o.doc_type===docType && batchItems.some(function(a){return a.id===o.allot_id;});
  });

  var docNumber, fullDocNo;
  if(existingBatchOrders.length){
    // Already generated — re-download using existing doc number
    docNumber = existingBatchOrders[0].doc_number;
    fullDocNo = prefix+'-'+new Date().getFullYear()+'-'+docNumber;
    toast('Re-downloading '+fullDocNo,'info');
  } else {
    // First time — generate new doc number and save to DB
    var existingNos = WA_ORDERS.filter(function(o){return o.doc_type===docType;}).map(function(o){return parseInt(o.doc_number)||0;});
    var nextNo = (existingNos.length?Math.max.apply(null,existingNos):0)+1;
    docNumber = String(nextNo).padStart(4,'0');
    fullDocNo = prefix+'-'+new Date().getFullYear()+'-'+docNumber;
    try{
      toast('Generating '+fullDocNo+'...','info');
      for(var i=0;i<batchItems.length;i++){
        var a=batchItems[i];
        var res=await sbInsert('work_orders',{
          project_id:projId,
          party_type:a.exec_type,
          party_name:a.party_name,
          allot_id:a.id,
          batch_id:batchKey,
          doc_type:docType,
          doc_number:docNumber,
          doc_date:today,
          qty:a.qty, rate:a.rate, unit:a.unit||null,
          amount:Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0)),
          boq_item_id:a.boq_item_id||null
        });
        if(res&&res[0]) WA_ORDERS.push(res[0]);
      }
      toast(fullDocNo+' saved!','success');
    }catch(e){toast('Error: '+e.message,'error');console.error(e);return;}
  }

  // Build combined document
  var total = batchItems.reduce(function(s,a){return s+Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));},0);
  var isPO  = docType==='po';
  var titleStr = isPO ? 'PURCHASE ORDER' : 'WORK ORDER';
  var accentCol = isPO ? '#1565C0' : '#E65100';
  var lightBg   = isPO ? '#E3F2FD' : '#FFF3E0';
  var partyLabel = batchItems.map(function(a){return a.party_name;}).filter(function(v,i,arr){return arr.indexOf(v)===i;}).join(', ');

  // Common scope/terms from first item
  var commonScope = batchItems[0].scope||'';
  var commonStart = batchItems[0].start_date||'';
  var commonEnd   = batchItems[0].end_date||'';

  // Table rows
  var rows = batchItems.map(function(a,idx){
    var planRes = WA_PLANNED.find(function(r){return r.id===a.boq_exec_resource_id;})||{};
    var boqItem = WA_ITEMS.find(function(i){return i.id===(a.boq_item_id||planRes.boq_item_id);})||{};
    var itemCode = boqItem.item_code?'<div style="font-size:9px;color:#888;margin-bottom:2px;">BOQ: '+boqItem.item_code+' — '+(boqItem.short_name||boqItem.description||'')+'</div>':'';
    var specText = a.specification?'<div style="font-size:9px;color:#555;margin-top:3px;font-style:italic;">Spec: '+a.specification+'</div>':'';
    var descText = planRes.party_name||a.party_name||'Item '+(idx+1);
    var amt = Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));
    var inrFull = function(n){return '₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});};
    return '<tr>'+
      '<td style="text-align:center;color:#888;">'+(idx+1)+'</td>'+
      '<td>'+itemCode+'<span style="font-weight:700;">'+descText+'</span>'+specText+'</td>'+
      '<td style="text-align:center;">'+a.qty+' '+(a.unit||'')+'</td>'+
      '<td style="text-align:right;">'+inrFull(a.rate)+'</td>'+
      '<td style="text-align:right;font-weight:700;">'+inrFull(amt)+'</td>'+
    '</tr>';
  }).join('');

  var inrFull = function(n){return '₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});};
  var amtWords = (function(n){
    // simple number to words for totals up to crores
    var a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    var b=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    function t(n){if(n<20)return a[n];var r=b[Math.floor(n/10)];return n%10?r+' '+a[n%10]:r;}
    function h(n){return n>99?a[Math.floor(n/100)]+' Hundred'+(n%100?' '+t(n%100):''):t(n);}
    if(n===0)return 'Zero';
    var cr=Math.floor(n/10000000),lac=Math.floor((n%10000000)/100000),th=Math.floor((n%100000)/1000),rem=n%1000;
    var s='';
    if(cr)s+=h(cr)+' Crore ';
    if(lac)s+=h(lac)+' Lakh ';
    if(th)s+=h(th)+' Thousand ';
    if(rem)s+=h(rem);
    return s.trim()+' Only';
  })(Math.round(total));

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'+
    '<title>'+titleStr+' — '+fullDocNo+'</title>'+
    '<style>'+
      '*{box-sizing:border-box;margin:0;padding:0;}'+
      'body{font-family:"Arial",sans-serif;font-size:12px;color:#1a1a1a;background:#fff;}'+
      '.page{max-width:800px;margin:0 auto;padding:32px 36px;}'+
      // Header strip
      '.top-strip{background:'+accentCol+';color:white;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-radius:8px 8px 0 0;}'+
      '.top-strip .doc-type{font-size:22px;font-weight:900;letter-spacing:1px;}'+
      '.top-strip .doc-no{font-size:13px;font-weight:700;opacity:.9;}'+
      // Company header
      '.co-bar{background:'+lightBg+';padding:12px 16px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid '+accentCol+';}'+
      '.co-name{font-size:17px;font-weight:900;color:'+accentCol+';}'+
      '.co-info{font-size:10px;color:#555;margin-top:3px;line-height:1.5;}'+
      '.doc-meta{text-align:right;font-size:11px;color:#444;line-height:1.8;}'+
      // Party + Project cards
      '.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #DDD;border-radius:6px;overflow:hidden;margin:14px 0;}'+
      '.info-card{padding:10px 14px;}.info-card+.info-card{border-left:1px solid #DDD;}'+
      '.info-card .lbl{font-size:9px;font-weight:800;text-transform:uppercase;color:'+accentCol+';letter-spacing:.5px;margin-bottom:4px;}'+
      '.info-card .val{font-size:13px;font-weight:800;color:#111;}'+
      '.info-card .sub{font-size:10px;color:#666;margin-top:2px;}'+
      // Terms row
      '.terms-bar{background:#F8FAFC;border:1px solid #DDD;border-radius:6px;padding:8px 14px;margin-bottom:14px;display:flex;gap:24px;flex-wrap:wrap;}'+
      '.terms-bar .t-item{font-size:10px;color:#555;}<br>'+
      '.terms-bar .t-item b{color:#111;}'+
      // Table
      'table{width:100%;border-collapse:collapse;margin-bottom:0;font-size:11.5px;}'+
      'thead tr{background:'+accentCol+';color:white;}'+
      'thead th{padding:8px 10px;text-align:left;font-size:11px;font-weight:700;}'+
      'tbody tr{border-bottom:1px solid #EEE;}'+
      'tbody tr:nth-child(even){background:#FAFAFA;}'+
      'tbody td{padding:7px 10px;vertical-align:top;}'+
      '.total-row td{background:'+lightBg+';font-weight:900;font-size:13px;border-top:2px solid '+accentCol+';}'+
      '.amt-words{background:#F0F4FF;border:1px dashed '+accentCol+';border-radius:6px;padding:8px 14px;margin:12px 0;font-size:11px;color:#333;}'+
      '.amt-words b{color:'+accentCol+';}'+
      // Terms & conditions
      '.tnc{margin-top:14px;padding:12px 14px;border:1px solid #DDD;border-radius:6px;font-size:10px;color:#555;}'+
      '.tnc .tnc-title{font-size:11px;font-weight:800;color:#333;margin-bottom:6px;}'+
      '.tnc ol{padding-left:16px;line-height:2;}'+
      // Signatures
      '.sig-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:32px;}'+
      '.sig-box{border-top:1.5px solid #333;padding-top:8px;text-align:center;}'+
      '.sig-box .sig-name{font-size:11px;font-weight:800;color:#333;margin-top:4px;}'+
      '.sig-box .sig-role{font-size:9px;color:#888;margin-top:2px;}'+
      '.sig-space{height:48px;}'+
      '@media print{button{display:none!important;}.page{padding:20px 24px;}}'+
    '</style></head><body>'+
    '<div class="page">'+

    // Print button
    '<button onclick="window.print()" style="background:'+accentCol+';color:white;border:none;padding:9px 22px;border-radius:6px;cursor:pointer;margin-bottom:16px;font-size:13px;font-weight:700;font-family:Arial,sans-serif;">&#128438; Print / Save as PDF</button>'+

    // Top strip
    '<div class="top-strip">'+
      '<div class="doc-type">'+titleStr+'</div>'+
      '<div class="doc-no">'+fullDocNo+'</div>'+
    '</div>'+

    // Company bar
    '<div class="co-bar">'+
      '<div>'+
        '<div class="co-name">'+(co.name||'Company Name')+'</div>'+
        '<div class="co-info">'+(co.address?co.address+'<br>':'')+(co.gstin?'GSTIN: '+co.gstin:'')+
          (co.cin?'&nbsp;&nbsp;|&nbsp;&nbsp;CIN: '+co.cin:'')+'</div>'+
      '</div>'+
      '<div class="doc-meta">'+
        '<div><b>Date:</b> '+fmtD(today)+'</div>'+
        '<div><b>Project:</b> '+(proj.name||'—')+'</div>'+
        (proj.location?'<div><b>Site:</b> '+proj.location+'</div>':'')+
      '</div>'+
    '</div>'+

    // Party + Project info
    '<div class="info-grid">'+
      '<div class="info-card">'+
        '<div class="lbl">'+(isPO?'Vendor / Supplier':'Contractor / Party')+'</div>'+
        '<div class="val">'+partyLabel+'</div>'+
        '<div class="sub">'+(tLbl[batchItems[0].exec_type]||batchItems[0].exec_type)+'</div>'+
      '</div>'+
      '<div class="info-card">'+
        '<div class="lbl">Delivery / Work Location</div>'+
        '<div class="val">'+(proj.name||'—')+'</div>'+
        '<div class="sub">'+(proj.location||proj.code||'As per project site')+'</div>'+
      '</div>'+
    '</div>'+

    // Terms bar (dates + scope)
    ((commonStart||commonEnd||commonScope)?
      '<div class="terms-bar">'+
        (commonStart?'<div class="t-item"><b>Start Date:</b> '+fmtD(commonStart)+'</div>':'')+
        (commonEnd?'<div class="t-item"><b>Completion Date:</b> '+fmtD(commonEnd)+'</div>':'')+
        (commonScope?'<div class="t-item" style="flex:1;"><b>Scope:</b> '+commonScope+'</div>':'')+
      '</div>':'<br>')+

    // Items table
    '<table>'+
      '<thead><tr>'+
        '<th style="width:36px;text-align:center;">#</th>'+
        '<th>'+(isPO?'Item / Material Description':'Work Description')+'</th>'+
        '<th style="width:90px;text-align:center;">Qty</th>'+
        '<th style="width:100px;text-align:right;">Rate</th>'+
        '<th style="width:110px;text-align:right;">Amount</th>'+
      '</tr></thead>'+
      '<tbody>'+rows+
        '<tr class="total-row">'+
          '<td colspan="4" style="text-align:right;padding:10px;">TOTAL ORDER VALUE</td>'+
          '<td style="text-align:right;padding:10px;">'+inrFull(total)+'</td>'+
        '</tr>'+
      '</tbody>'+
    '</table>'+

    // Amount in words
    '<div class="amt-words"><b>Amount in Words:</b> '+amtWords+'</div>'+

    // Terms & conditions
    '<div class="tnc">'+
      '<div class="tnc-title">Terms &amp; Conditions</div>'+
      '<ol>'+
        (isPO?
          '<li>Payment will be made within 30 days of receipt of material and invoice.</li>'+
          '<li>Materials must conform to the specifications mentioned above and applicable IS standards.</li>'+
          '<li>Vendor shall provide delivery challan / invoice with each consignment.</li>'+
          '<li>Any defective or non-conforming material will be returned at vendor&apos;s cost.</li>'+
          '<li>This PO is valid for 90 days from the date of issue unless extended in writing.</li>'+
          '<li>GST as applicable shall be charged separately and mentioned clearly on invoice.</li>'
          :
          '<li>Work shall be executed as per approved drawings, specifications and instructions of site engineer.</li>'+
          '<li>Contractor shall deploy adequate skilled manpower and maintain quality standards.</li>'+
          '<li>Payment will be processed after measurement and certification of completed work.</li>'+
          '<li>Contractor shall comply with all safety norms and labour laws applicable at site.</li>'+
          '<li>Any damage to existing structures or utilities will be rectified at contractor&apos;s cost.</li>'+
          '<li>This order is valid only when countersigned by authorized representative of '+( co.name||'the company')+' .</li>'
        )+
      '</ol>'+
    '</div>'+

    // Signature block
    '<div class="sig-grid">'+
      '<div class="sig-box"><div class="sig-space"></div><div class="sig-name">'+(co.name||'Company')+'</div><div class="sig-role">Prepared By</div></div>'+
      '<div class="sig-box"><div class="sig-space"></div><div class="sig-name">'+(co.name||'Company')+'</div><div class="sig-role">Authorized Signatory</div></div>'+
      '<div class="sig-box"><div class="sig-space"></div><div class="sig-name">'+partyLabel+'</div><div class="sig-role">'+(isPO?'Vendor Acceptance':'Contractor Acceptance')+'</div></div>'+
    '</div>'+

    '</div></body></html>';

  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else toast('Allow popups to open document','warning');

  setTimeout(function(){execRenderAllotted();},400);
}

function execViewOrder(orderId){
  var o=WA_ORDERS.find(function(x){return x.id===orderId;});
  if(!o){toast('Order not found','warning');return;}
  toast((o.doc_type==='wo'?'WO':'PO')+'-'+o.doc_number+': &#8377;'+Math.round(o.amount).toLocaleString('en-IN')+' | '+o.doc_date,'info');
}

function execDailyDateChange(){
  var inp=document.getElementById('dp-view-date');
  if(inp) WA_DAILY_DATE=inp.value;
  execRenderDailyContent();
}

function execRenderDaily(){
  var el=document.getElementById('exec-content');if(!el)return;

  if(!WA_ITEMS.length){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);"><div style="font-size:32px;">&#128197;</div><div style="font-weight:700;margin-top:8px;">No BOQ items found</div></div>';
    return;
  }

  // Render the date picker shell, then fill content
  el.innerHTML=
    '<div style="background:white;border-radius:12px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;">'+
      '<div style="font-size:12px;font-weight:800;color:#1565C0;">&#128197; View Date</div>'+
      '<input id="dp-view-date" type="date" value="'+WA_DAILY_DATE+'" '+
        'style="border:1.5px solid #1565C0;border-radius:8px;padding:6px 10px;font-size:13px;font-weight:700;font-family:Nunito,sans-serif;color:#1565C0;outline:none;cursor:pointer;" '+
        'onchange="execDailyDateChange()">'+
      '<div style="flex:1;font-size:10px;color:var(--text3);">Showing entries for selected date &amp; cumulative upto that date</div>'+
      '<button onclick="WA_DAILY_DATE=new Date().toISOString().slice(0,10);document.getElementById(\'dp-view-date\').value=WA_DAILY_DATE;execRenderDailyContent();" '+
        'style="font-size:10px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:#F8FAFC;cursor:pointer;font-weight:700;">Today</button>'+
    '</div>'+
    '<div id="dp-daily-content"></div>';

  execRenderDailyContent();
}

function execRenderDailyContent(){
  var el=document.getElementById('dp-daily-content');if(!el)return;
  var selDate=WA_DAILY_DATE;

  var tCol={vendor:'#1565C0',sc:'#6A1B9A',labour_contractor:'#2E7D32',labour:'#37474F',machinery:'#E65100'};
  var tLbl={vendor:'Vendor',sc:'SC',labour_contractor:'Labour Contr.',labour:'Labour',machinery:'Machinery'};
  function pColor(pct){return pct>=100?'#2E7D32':pct>=60?'#1565C0':pct>=30?'#F57F17':'#E65100';}
  function fmt(n){var v=parseFloat(n)||0;return v%1===0?String(v):v.toFixed(2).replace(/\.?0+$/,'');}

  // Filter: today's entries = exact date, cumulative = upto and including selDate
  var todayEntries = WA_DAILY.filter(function(d){return d.date===selDate;});
  var cumulEntries = WA_DAILY.filter(function(d){return d.date<=selDate;});

  // ── 1. BOQ ITEM PROGRESS SUMMARY ───────────────────────────────────────
  var summaryRows=WA_ITEMS.map(function(item){
    var boqQty  = parseFloat(item.boq_qty||item.qty)||0;
    var jmQty   = WA_JMS.filter(function(j){return j.boq_item_id===item.id;}).reduce(function(s,j){return s+(parseFloat(j.jm_qty)||0);},0);
    var doneToday  = todayEntries.filter(function(d){return d.boq_item_id===item.id;}).reduce(function(s,d){return s+(parseFloat(d.qty_done)||0);},0);
    var doneCumul  = cumulEntries.filter(function(d){return d.boq_item_id===item.id;}).reduce(function(s,d){return s+(parseFloat(d.qty_done)||0);},0);
    var doneQty = doneCumul;
    var jmPct    = boqQty>0?Math.round(jmQty/boqQty*100):0;
    var cumulPct = jmQty>0?Math.round(doneCumul/jmQty*100):(boqQty>0?Math.round(doneCumul/boqQty*100):0);
    var jmBal    = Math.max(0,jmQty-doneCumul);
    var unit     = item.unit||'';
    var td='padding:7px 10px;font-size:11px;text-align:right;white-space:nowrap;vertical-align:middle;';
    return '<tr style="border-bottom:1px solid #F0F0F0;">'+
      '<td style="'+td+';font-family:monospace;color:#E65100;font-weight:800;">'+item.item_code+'</td>'+
      '<td style="padding:7px 10px;font-size:11px;font-weight:700;vertical-align:middle;">'+( item.short_name||item.description)+'</td>'+
      '<td style="'+td+'">'+fmt(boqQty)+' <span style="font-size:9px;color:var(--text3);">'+unit+'</span></td>'+
      '<td style="'+td+';color:#283593;font-weight:800;">'+fmt(jmQty)+' <span style="font-size:9px;font-weight:400;color:var(--text3);">'+unit+'</span> <span style="font-size:9px;color:#283593;">('+jmPct+'%)</span></td>'+
      '<td style="'+td+';color:#E65100;font-weight:800;background:#FFF8F5;">'+
        (doneToday>0?fmt(doneToday)+' <span style="font-size:9px;font-weight:400;color:var(--text3);">'+unit+'</span>':'<span style="color:#CCC;font-size:11px;">—</span>')+
      '</td>'+
      '<td style="'+td+';color:'+pColor(cumulPct)+';font-weight:800;">'+fmt(doneCumul)+' <span style="font-size:9px;font-weight:400;color:var(--text3);">'+unit+'</span> <span style="font-size:9px;color:'+pColor(cumulPct)+';">('+cumulPct+'%)</span></td>'+
      '<td style="'+td+';font-weight:800;color:'+(jmBal>0?'#E65100':'#2E7D32')+';">'+fmt(jmBal)+' <span style="font-size:9px;font-weight:400;color:var(--text3);">'+unit+'</span></td>'+
    '</tr>';
  }).join('');

  var summaryTable=
    '<div style="background:white;border-radius:14px;overflow:hidden;margin-bottom:12px;">'+
      '<div style="padding:10px 14px;background:#F8FAFC;border-bottom:2px solid #E8EAF6;">'+
        '<div style="font-size:12px;font-weight:800;color:#1565C0;">&#128202; BOQ Item Progress — Completed vs JM vs BOQ</div>'+
        '<div style="display:flex;gap:12px;margin-top:5px;font-size:9px;font-weight:700;">'+
          '<span style="color:#283593;">&#9632; JM Qty (issued)</span>'+
          '<span style="color:#1565C0;">&#9632; Completed (daily progress)</span>'+
          '<span style="color:#E65100;">JM Bal = JM Qty &#8722; Completed</span>'+
        '</div>'+
      '</div>'+
      '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">'+
        '<table style="width:100%;border-collapse:collapse;min-width:600px;">'+
          '<thead><tr style="background:#F0F4FF;">'+
            '<th style="padding:6px 10px;font-size:9px;text-align:right;color:var(--text3);white-space:nowrap;">CODE</th>'+
            '<th style="padding:6px 10px;font-size:9px;text-align:left;color:var(--text3);">ITEM</th>'+
            '<th style="padding:6px 10px;font-size:9px;text-align:right;color:var(--text3);white-space:nowrap;">BOQ QTY</th>'+
            '<th style="padding:6px 10px;font-size:9px;text-align:right;color:#283593;white-space:nowrap;">JM QTY</th>'+
            '<th style="padding:6px 10px;font-size:9px;text-align:right;color:#E65100;white-space:nowrap;background:#FFF8F5;">TODAY</th>'+
            '<th style="padding:6px 10px;font-size:9px;text-align:right;color:#1565C0;white-space:nowrap;">CUMULATIVE</th>'+
            '<th style="padding:6px 10px;font-size:9px;text-align:right;color:#E65100;white-space:nowrap;">JM BALANCE</th>'+
          '</tr></thead>'+
          '<tbody>'+summaryRows+'</tbody>'+
        '</table>'+
      '</div>'+
    '</div>';

  // ── 2. RESOURCE UTILISATION TABLE — one row per allotment ───────────────
  // Build cumulative used qty per allot_id from daily entries
  var usedByAllot={};
  cumulEntries.forEach(function(d){
    var resources=[];try{resources=d.resources_used?JSON.parse(d.resources_used):[];}catch(ex){}
    resources.forEach(function(r){
      if(!r.allot_id||!r.qty) return;
      usedByAllot[r.allot_id]=(usedByAllot[r.allot_id]||0)+(parseFloat(r.qty)||0);
    });
  });

  // One row per allotment — keeps each resource separate
  var resRows=WA_ALLOT.map(function(a){
    var allotQty = parseFloat(a.qty)||0;
    var usedQty  = usedByAllot[a.id]||0;
    var pct      = allotQty>0?Math.round(usedQty/allotQty*100):0;
    var col      = tCol[a.exec_type]||'#555';
    var bal      = Math.max(0,allotQty-usedQty);
    var overused = usedQty>allotQty;
    // Get BOQ item for this allotment
    var boqItem  = WA_ITEMS.find(function(i){return i.id===a.boq_item_id;})||{};
    var itemLabel= boqItem.item_code?'['+boqItem.item_code+']':'';

    var td2='padding:7px 10px;font-size:11px;text-align:right;white-space:nowrap;';
    return '<tr style="border-bottom:1px solid #F0F0F0;">'+
      '<td style="padding:7px 10px;">'+
        '<span style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:4px;background:'+col+'15;color:'+col+';">'+( tLbl[a.exec_type]||a.exec_type)+'</span>'+
      '</td>'+
      '<td style="padding:7px 10px;font-size:11px;font-weight:800;">'+a.party_name+
        (itemLabel?' <span style="font-size:9px;font-weight:400;color:var(--text3);">'+itemLabel+'</span>':'')+
        (a.scope?'<div style="font-size:9px;color:var(--text3);font-style:italic;">'+a.scope+'</div>':'')+
      '</td>'+
      '<td style="'+td2+'">'+fmt(allotQty)+' <span style="font-size:9px;color:var(--text3);">'+(a.unit||'')+'</span></td>'+
      '<td style="'+td2+';color:'+(overused?'#C62828':col)+';font-weight:800;">'+fmt(usedQty)+' <span style="font-size:9px;font-weight:400;color:var(--text3);">'+(a.unit||'')+'</span><span style="font-size:9px;color:'+(overused?'#C62828':col)+';"> ('+pct+'%)</span></td>'+
      '<td style="'+td2+';font-weight:800;color:'+(overused?'#C62828':bal<0.01?'#2E7D32':'#555')+';">'+
        (overused?'+'+fmt(usedQty-allotQty)+' over':fmt(bal))+' <span style="font-size:9px;font-weight:400;color:var(--text3);">'+(a.unit||'')+'</span>'+
      '</td>'+
    '</tr>';
  }).join('');

  var resTable=resRows?
    '<div style="background:white;border-radius:14px;overflow:hidden;margin-bottom:12px;">'+
      '<div style="padding:10px 14px;background:#F8FAFC;border-bottom:2px solid #E8F5E9;">'+
        '<div style="font-size:12px;font-weight:800;color:#2E7D32;">&#128101; Resource Utilisation vs Allotted</div>'+
        '<div style="font-size:9px;color:var(--text3);margin-top:3px;">Based on qty recorded in daily entries</div>'+
      '</div>'+
      '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">'+
        '<table style="width:100%;border-collapse:collapse;min-width:480px;">'+
          '<thead><tr style="background:#F1FBF4;">'+
            '<th style="padding:6px 10px;font-size:9px;text-align:left;color:var(--text3);white-space:nowrap;">TYPE</th>'+
            '<th style="padding:6px 10px;font-size:9px;text-align:left;color:var(--text3);">PARTY / ITEM</th>'+
            '<th style="padding:6px 10px;font-size:9px;text-align:right;color:var(--text3);white-space:nowrap;">ALLOTTED</th>'+
            '<th style="padding:6px 10px;font-size:9px;text-align:right;color:#2E7D32;white-space:nowrap;">UTILISED</th>'+
            '<th style="padding:6px 10px;font-size:9px;text-align:right;color:var(--text3);white-space:nowrap;">BALANCE</th>'+
          '</tr></thead>'+
          '<tbody>'+resRows+'</tbody>'+
        '</table>'+
      '</div>'+
    '</div>':
    '';

  // ── 3. DAILY ENTRIES FOR SELECTED DATE ────────────────────────────────
  // Show today's entries prominently; cumul entries collapsible
  var todayByItem={};
  todayEntries.forEach(function(d){
    var key=d.boq_item_id||'misc';
    if(!todayByItem[key]) todayByItem[key]=[];
    todayByItem[key].push(d);
  });

  // Only show items that have any entry on selected date OR cumulative entries
  var cumulByItem={};
  cumulEntries.forEach(function(d){
    var key=d.boq_item_id||'misc';
    if(!cumulByItem[key]) cumulByItem[key]=[];
    cumulByItem[key].push(d);
  });

  var itemCards=WA_ITEMS.map(function(item){  // show ALL items so + Entry is always available
    var todayItemEntries=(todayByItem[item.id]||[]).slice().sort(function(a,b){return b.date.localeCompare(a.date);});
    var cumulItemEntries=(cumulByItem[item.id]||[]).slice().sort(function(a,b){return b.date.localeCompare(a.date);});
    var doneToday2=todayItemEntries.reduce(function(s,d){return s+(parseFloat(d.qty_done)||0);},0);
    var doneCumul2=cumulItemEntries.reduce(function(s,d){return s+(parseFloat(d.qty_done)||0);},0);
    var jmQty   =WA_JMS.filter(function(j){return j.boq_item_id===item.id;}).reduce(function(s,j){return s+(parseFloat(j.jm_qty)||0);},0);
    var refQty  =jmQty||parseFloat(item.boq_qty||item.qty)||0;
    var pct     =refQty>0?Math.min(100,Math.round(doneCumul2/refQty*100)):0;
    var pc      =pColor(pct);
    var doneQty =doneCumul2;

    function makeEntryRow(d){
      var resources=[];try{resources=d.resources_used?JSON.parse(d.resources_used):[];}catch(ex){}
      return '<div style="padding:7px 12px;border-bottom:1px solid #F5F5F5;">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:'+(resources.length?'5':'0')+'px;">'+
          '<span style="font-size:10px;color:var(--text3);flex-shrink:0;">&#128197; '+(d.date?d.date.split('-').reverse().join('/'):'-')+'</span>'+
          '<span style="font-size:12px;font-weight:800;color:#E65100;">'+d.qty_done+' '+(d.unit||item.unit||'')+'</span>'+
          (d.remarks?'<span style="font-size:10px;color:var(--text3);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+d.remarks+'</span>':'<span style="flex:1;"></span>')+
          '<button onclick="execDelDaily(\''+d.id+'\')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:14px;flex-shrink:0;">&#215;</button>'+
        '</div>'+
        (resources.length?
          '<div style="display:flex;flex-wrap:wrap;gap:4px;">'+
            resources.map(function(r){var col=tCol[r.type]||'#555';return '<span style="font-size:9px;background:'+col+'15;color:'+col+';border:1px solid '+col+'30;border-radius:4px;padding:2px 6px;font-weight:700;">'+(tLbl[r.type]||r.type)+': '+r.name+(r.qty?' \u00d7 '+fmt(r.qty)+(r.unit?' '+r.unit:''):'')+  '</span>';}).join('')+
          '</div>':'')+
      '</div>';
    }

    // Today's entries — shown with orange header
    var todayRowsHtml = todayItemEntries.length
      ? '<div style="background:#FFF3E0;padding:4px 12px;font-size:9px;font-weight:800;color:#E65100;">'+
          '&#128197; Today ('+selDate.split('-').reverse().join('/')+') — '+fmt(doneToday2)+' '+(item.unit||'')+
        '</div>'+
        todayItemEntries.map(makeEntryRow).join('')
      : '<div style="padding:6px 14px;font-size:11px;color:var(--text3);background:#FFF8F5;">No entry for selected date</div>';

    // Previous entries (cumul excluding today)
    var prevEntries = cumulItemEntries.filter(function(d){return d.date!==selDate;});
    var prevRowsHtml = prevEntries.length
      ? '<div style="background:#F8FAFC;padding:4px 12px;font-size:9px;font-weight:800;color:var(--text3);">'+
          'Previous entries (cumulative: '+fmt(doneCumul2)+' '+(item.unit||'')+')'+
        '</div>'+
        prevEntries.map(makeEntryRow).join('')
      : '';

    return '<div style="background:white;border-radius:12px;border:1px solid var(--border);margin-bottom:8px;overflow:hidden;">'+
      '<div style="padding:9px 14px;background:#FFF3E0;border-bottom:1px solid var(--border);">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">'+
          '<div style="flex:1;min-width:0;">'+
            '<span style="font-size:10px;font-family:monospace;background:#FFE0B2;color:#E65100;padding:2px 7px;border-radius:4px;">'+item.item_code+'</span>'+
            '<span style="font-size:12px;font-weight:800;margin-left:8px;">'+(item.short_name||item.description)+'</span>'+
          '</div>'+
          '<button onclick="execOpenDailyEntry(\''+item.id+'\')" style="background:#E65100;color:white;border:none;border-radius:7px;padding:4px 11px;font-size:11px;font-weight:800;cursor:pointer;flex-shrink:0;">+ Entry</button>'+
        '</div>'+
        '<div style="font-size:10px;color:var(--text3);">'+
          'Today: <b style="color:#E65100;">'+(doneToday2>0?fmt(doneToday2)+' '+(item.unit||''):'nil')+'</b>'+
          ' &nbsp;|&nbsp; Cumulative: <b style="color:'+pc+';">'+fmt(doneCumul2)+' '+(item.unit||'')+' ('+pct+'%)</b>'+
          (jmQty?' &nbsp;|&nbsp; JM: <b style="color:#283593;">'+fmt(jmQty)+'</b>':'')+
        '</div>'+
      '</div>'+
      todayRowsHtml+
      prevRowsHtml+
    '</div>';
  }).join('');

  el.innerHTML=
    summaryTable+
    resTable+
    '<div style="font-size:11px;font-weight:800;color:var(--text3);margin-bottom:8px;">'+
      '&#128203; Entries for '+(selDate.split('-').reverse().join('/'))+
      ' &nbsp;<span style="font-size:9px;font-weight:400;">and cumulative upto this date &nbsp;|&nbsp; Click <b>+ Entry</b> to record progress</span>'+
    '</div>'+
    itemCards;
}
async function execOpenDailyEntry(itemId){
  var projId=(document.getElementById('exec-proj-sel')||{}).value||'';
  var item=WA_ITEMS.find(function(i){return i.id===itemId;})||{};

  // Get allotted resources for this item (via boq_item_id or sub-item)
  var itemSubIds=WA_SUBS.filter(function(s){return s.boq_item_id===itemId;}).map(function(s){return s.id;});
  var itemAllots=WA_ALLOT.filter(function(a){
    return a.boq_item_id===itemId||(a.boq_subitem_id&&itemSubIds.includes(a.boq_subitem_id));
  });

  var tLbl={vendor:'Vendor',sc:'SC',labour_contractor:'Labour Contr.',labour:'Labour',machinery:'Machinery'};
  var tCol={vendor:'#1565C0',sc:'#6A1B9A',labour_contractor:'#2E7D32',labour:'#37474F',machinery:'#E65100'};

  var resourceRows=itemAllots.length
    ? itemAllots.map(function(a){
        var col=tCol[a.exec_type]||'#37474F';
        return '<div class="dp-res-row" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:#FAFAFA;">'+
          '<input type="checkbox" class="dp-res-chk" '+
            'data-allot-id="'+a.id+'" '+
            'data-name="'+a.party_name+'" '+
            'data-type="'+a.exec_type+'" '+
            'data-unit="'+(a.unit||'')+'" '+
            'style="width:15px;height:15px;accent-color:'+col+';flex-shrink:0;">'+
          '<div style="flex:1;min-width:0;">'+
            '<span style="font-size:9px;font-weight:800;padding:1px 6px;background:'+col+'15;color:'+col+';border-radius:3px;margin-right:4px;">'+(tLbl[a.exec_type]||a.exec_type)+'</span>'+
            '<span style="font-size:12px;font-weight:800;">'+a.party_name+'</span>'+
            (a.scope?'<div style="font-size:9px;color:var(--text3);margin-top:1px;">'+a.scope+'</div>':'')+
          '</div>'+
          '<div class="dp-res-qty-wrap" style="display:none;align-items:center;gap:4px;">'+
            '<div>'+
              '<div style="font-size:9px;color:var(--text3);margin-bottom:2px;">Qty Used</div>'+
              '<input class="dp-res-qty finp" data-allot-id="'+a.id+'" type="number" step="0.001" placeholder="qty" style="width:80px;padding:4px 6px;font-size:12px;text-align:center;">'+
            '</div>'+
            '<div style="font-size:11px;font-weight:700;color:var(--text3);padding-top:16px;">'+(a.unit||'')+'</div>'+
          '</div>'+
        '</div>';
      }).join('')
    : '<div style="font-size:11px;color:var(--text3);padding:8px 0;font-style:italic;">No resources allotted for this item yet.</div>';

  document.getElementById('exec-sheet-title').textContent='Daily Progress — '+(item.item_code?item.item_code+' ':'')+(item.short_name||item.description||'');
  document.getElementById('exec-sheet-body').innerHTML=
    '<div style="background:#FFF3E0;border-radius:10px;padding:12px;margin-bottom:12px;">'+
      '<div style="font-size:11px;font-weight:800;color:#E65100;margin-bottom:10px;">&#9312; Quantity Completed</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">'+
        '<div><label class="flbl">Date *</label><input id="dp-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
        '<div><label class="flbl">Qty Completed *</label>'+
          '<div style="display:flex;gap:6px;align-items:center;">'+
            '<input id="dp-qty" class="finp" type="number" step="0.001" placeholder="0" style="flex:1;">'+
            '<span style="font-size:12px;font-weight:700;color:var(--text3);padding-top:2px;">'+(item.unit||'')+'</span>'+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div><label class="flbl">Remarks / Observations</label><input id="dp-remarks" class="finp" placeholder="Weather, issues, notes..."></div>'+
    '</div>'+
    '<div style="font-size:11px;font-weight:800;color:#1565C0;margin-bottom:8px;">'+
      '&#9313; Resources Utilised Today '+
      '<span style="font-size:9px;font-weight:500;color:var(--text3);">(check all that worked — enter qty used if applicable)</span>'+
    '</div>'+
    resourceRows;

  var sf=document.getElementById('exec-sheet-foot');sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#E65100;color:white;';
  sb.innerHTML='&#10003; Save Entry';
  sb.onclick=function(){execSaveDailyEntry(projId,itemId);};
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-exec','sh-exec');

  // Wire checkboxes → show qty input
  setTimeout(function(){
    var body=document.getElementById('exec-sheet-body');
    if(!body)return;
    body.addEventListener('change',function(e){
      var chk=e.target;
      if(chk.classList&&chk.classList.contains('dp-res-chk')){
        var row=chk.closest('.dp-res-row');
        if(!row)return;
        var qw=row.querySelector('.dp-res-qty-wrap');
        if(qw)qw.style.display=chk.checked?'flex':'none';
      }
    });
  },100);
}

function dpPartyChange(){} // kept for compatibility

async function execSaveDailyEntry(projId,itemId){
  var date=gv('dp-date'),qty=parseFloat(gv('dp-qty'))||0;
  if(!date){toast('Date required','warning');return;}
  if(!qty){toast('Enter qty completed','warning');return;}

  // Collect checked resources with qty
  var resources=[];
  document.querySelectorAll('.dp-res-chk:checked').forEach(function(chk){
    var row=chk.closest('.dp-res-row');
    var qtyInp=row&&row.querySelector('.dp-res-qty');
    resources.push({
      allot_id:chk.getAttribute('data-allot-id'),
      name:chk.getAttribute('data-name'),
      type:chk.getAttribute('data-type'),
      unit:chk.getAttribute('data-unit')||null,
      qty:parseFloat(qtyInp&&qtyInp.value)||null
    });
  });

  var item=WA_ITEMS.find(function(i){return i.id===itemId;})||{};
  try{
    var res=await sbInsert('work_daily_progress',{
      project_id:projId,
      boq_item_id:itemId,
      date:date,
      qty_done:qty,
      unit:item.unit||null,
      remarks:gv('dp-remarks')||null,
      resources_used:resources.length?JSON.stringify(resources):null
    });
    if(res&&res[0]) WA_DAILY.push(res[0]);
    toast('Entry saved!','success');
    closeSheet('ov-exec','sh-exec');
    execRenderDaily();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function execDelDaily(id){
  if(!confirm('Delete this entry?'))return;
  WA_DAILY=WA_DAILY.filter(function(d){return d.id!==id;});
  execRenderDaily();
  try{await sbDelete('work_daily_progress',id);}catch(e){console.error(e);}
}
// ── Bills & Payments ────────────────────────────────────────────────────
function execRenderBills(){
  var el=document.getElementById('exec-content');if(!el)return;
  var projId=(document.getElementById('exec-proj-sel')||{}).value||'';

  // Group by party
  var parties={};
  WA_ALLOT.forEach(function(a){
    var key=a.exec_type+'::'+a.party_name;
    if(!parties[key]) parties[key]={type:a.exec_type,name:a.party_name,totalAllot:0,totalRate:0,count:0};
    var qty=parseFloat(a.qty)||0, rate=parseFloat(a.rate)||0;
    parties[key].totalAllot+=qty;
    parties[key].totalRate+=qty*rate;
    parties[key].count++;
  });

  var tLbl={vendor:'Vendor',sc:'SC',labour_contractor:'Labour Contr.',labour:'Labour',machinery:'Machinery'};
  var tCol={vendor:'#1565C0',sc:'#6A1B9A',labour_contractor:'#2E7D32',labour:'#37474F',machinery:'#E65100'};

  var partyKeys=Object.keys(parties);
  if(!partyKeys.length){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">No allotments yet</div>';
    return;
  }

  el.innerHTML=partyKeys.map(function(key){
    var p=parties[key];
    var col=tCol[p.type]||'#37474F';
    var pDone=WA_DAILY.filter(function(d){return d.party_name===p.name&&d.party_type===p.type;});
    var totalDone=pDone.reduce(function(s,d){return s+(parseFloat(d.qty_done)||0);},0);
    // Bills for this party
    var pBills=WA_BILLS.filter(function(b){return b.party_name===p.name&&b.party_type===p.type;});
    var totalBilled=pBills.reduce(function(s,b){return s+(parseFloat(b.bill_amount)||0);},0);
    // Payments for this party
    var pPaid=WA_PAYMENTS.filter(function(py){return py.party_name===p.name&&py.party_type===p.type;});
    var totalPaid=pPaid.reduce(function(s,py){return s+(parseFloat(py.amount)||0);},0);
    var balPayable=Math.max(0,totalBilled-totalPaid);

    return '<div style="background:white;border-radius:14px;border:1px solid var(--border);margin-bottom:12px;overflow:hidden;">'+
      // Party header
      '<div style="padding:10px 14px;background:'+col+'10;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">'+
        '<span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:5px;background:'+col+'20;color:'+col+';">'+(tLbl[p.type]||p.type)+'</span>'+
        '<div style="flex:1;font-size:13px;font-weight:800;">'+p.name+'</div>'+
        '<button onclick="execOpenBill(\''+key+'\',\''+projId+'\')" style="background:'+col+';color:white;border:none;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:800;cursor:pointer;">&#128203; Generate Bill</button>'+
      '</div>'+
      // Summary row
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0;border-bottom:1px solid var(--border);">'+
        '<div style="padding:8px 12px;text-align:center;border-right:1px solid var(--border);"><div style="font-size:9px;color:var(--text3);font-weight:700;">DONE QTY</div><div style="font-size:14px;font-weight:900;color:#333;">'+totalDone.toFixed(2)+'</div></div>'+
        '<div style="padding:8px 12px;text-align:center;border-right:1px solid var(--border);"><div style="font-size:9px;color:var(--text3);font-weight:700;">BILLED</div><div style="font-size:14px;font-weight:900;color:#1565C0;">&#8377;'+Math.round(totalBilled).toLocaleString('en-IN')+'</div></div>'+
        '<div style="padding:8px 12px;text-align:center;border-right:1px solid var(--border);"><div style="font-size:9px;color:var(--text3);font-weight:700;">PAID</div><div style="font-size:14px;font-weight:900;color:#2E7D32;">&#8377;'+Math.round(totalPaid).toLocaleString('en-IN')+'</div></div>'+
        '<div style="padding:8px 12px;text-align:center;"><div style="font-size:9px;color:var(--text3);font-weight:700;">BAL PAYABLE</div><div style="font-size:14px;font-weight:900;color:'+(balPayable>0?'#C62828':'#2E7D32')+';">&#8377;'+Math.round(balPayable).toLocaleString('en-IN')+'</div></div>'+
      '</div>'+
      // Bills list
      (pBills.length?
        '<div style="padding:8px 14px;border-bottom:1px solid #F0F0F0;">'+
          '<div style="font-size:10px;font-weight:800;color:var(--text3);margin-bottom:6px;">BILLS</div>'+
          pBills.map(function(b){
            var bPaid=WA_PAYMENTS.filter(function(py){return py.bill_id===b.id;});
            var bPaidAmt=bPaid.reduce(function(s,py){return s+(parseFloat(py.amount)||0);},0);
            var bBal=Math.max(0,(parseFloat(b.bill_amount)||0)-bPaidAmt);
            return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #F8F8F8;font-size:11px;">'+
              '<span style="background:#E3F2FD;color:#1565C0;font-weight:800;padding:2px 7px;border-radius:4px;font-size:10px;">Bill #'+b.bill_number+'</span>'+
              '<div style="flex:1;">'+
                '<div style="font-weight:700;">&#8377;'+Number(b.bill_amount).toLocaleString('en-IN')+'</div>'+
                '<div style="font-size:10px;color:var(--text3);">'+b.bill_date+(b.description?' · '+b.description:'')+'</div>'+
              '</div>'+
              '<div style="text-align:right;">'+
                '<div style="font-size:10px;color:#2E7D32;">Paid: &#8377;'+Math.round(bPaidAmt).toLocaleString('en-IN')+'</div>'+
                '<div style="font-size:10px;color:'+(bBal>0?'#C62828':'#2E7D32')+';">Bal: &#8377;'+Math.round(bBal).toLocaleString('en-IN')+'</div>'+
              '</div>'+
              '<button onclick="execOpenPayment(\''+b.id+'\',\''+key+'\',\''+projId+'\','+bBal+')" style="background:#2E7D32;color:white;border:none;border-radius:5px;padding:3px 7px;font-size:9px;font-weight:800;cursor:pointer;">+ Pay</button>'+
            '</div>';
          }).join('')+
        '</div>':'')+
      // Payments list
      (pPaid.length?
        '<div style="padding:8px 14px;">'+
          '<div style="font-size:10px;font-weight:800;color:var(--text3);margin-bottom:6px;">PAYMENT HISTORY</div>'+
          pPaid.map(function(py){
            return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #F8F8F8;font-size:11px;">'+
              '<span style="font-size:10px;color:var(--text3);">'+py.payment_date+'</span>'+
              '<div style="flex:1;font-weight:700;">&#8377;'+Number(py.amount).toLocaleString('en-IN')+'</div>'+
              '<span style="font-size:10px;color:var(--text3);">'+(py.payment_mode||'')+(py.reference?' · '+py.reference:'')+'</span>'+
              '<button onclick="execDelPayment(\''+py.id+'\')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:13px;">&#215;</button>'+
            '</div>';
          }).join('')+
        '</div>':'')+
    '</div>';
  }).join('');
}

async function execOpenBill(partyKey,projId){
  var parts=partyKey.split('::');
  var partyType=parts[0],partyName=parts[1];
  // Get done qty for this party
  var pDone=WA_DAILY.filter(function(d){return d.party_name===partyName&&d.party_type===partyType;});
  var totalDone=pDone.reduce(function(s,d){return s+(parseFloat(d.qty_done)||0);},0);
  // Get allotted rate
  var aRes=WA_ALLOT.filter(function(a){return a.party_name===partyName&&a.exec_type===partyType;});
  var avgRate=aRes.length?aRes.reduce(function(s,a){return s+(parseFloat(a.rate)||0);},0)/aRes.length:0;
  var suggestedAmt=Math.round(totalDone*avgRate);
  var nextBillNo=(WA_BILLS.filter(function(b){return b.party_name===partyName&&b.party_type===partyType;}).length)+1;

  document.getElementById('exec-sheet-title').textContent='Generate Bill — '+partyName;
  document.getElementById('exec-sheet-body').innerHTML=
    '<div style="background:#E3F2FD;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:11px;">'+
      '<div style="font-weight:800;color:#1565C0;margin-bottom:4px;">Bill #'+nextBillNo+' for '+partyName+'</div>'+
      '<div style="color:var(--text3);">Total Done: '+totalDone.toFixed(3)+' | Avg Rate: &#8377;'+avgRate.toFixed(2)+' | Suggested: &#8377;'+suggestedAmt.toLocaleString('en-IN')+'</div>'+
    '</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">Bill Date *</label><input id="bl-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
      '<div><label class="flbl">Bill Number</label><input id="bl-no" class="finp" value="'+nextBillNo+'" placeholder="Auto"></div>'+
    '</div>'+
    '<label class="flbl">Bill Amount (₹) *</label>'+
    '<input id="bl-amount" class="finp" type="number" value="'+suggestedAmt+'">'+
    '<div class="g2">'+
      '<div><label class="flbl">Qty for this Bill</label><input id="bl-qty" class="finp" type="number" step="0.001" placeholder="'+totalDone+'"></div>'+
      '<div><label class="flbl">Rate (₹)</label><input id="bl-rate" class="finp" type="number" step="0.01" placeholder="'+avgRate.toFixed(2)+'"></div>'+
    '</div>'+
    '<label class="flbl">Description</label>'+
    '<input id="bl-desc" class="finp" placeholder="e.g. Work done upto 30-06-2025...">';

  var sf=document.getElementById('exec-sheet-foot');sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#1565C0;color:white;';
  sb.innerHTML='&#128203; Generate Bill';
  sb.onclick=function(){execSaveBill(partyType,partyName,projId,nextBillNo);};
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-exec','sh-exec');
}

async function execSaveBill(partyType,partyName,projId,billNo){
  var date=gv('bl-date'),amount=parseFloat(gv('bl-amount'))||0;
  if(!date||!amount){toast('Date and amount required','warning');return;}
  try{
    var res=await sbInsert('work_bills',{
      project_id:projId,party_type:partyType,party_name:partyName,
      bill_number:parseInt(gv('bl-no'))||billNo,
      bill_date:date,bill_amount:amount,
      bill_qty:parseFloat(gv('bl-qty'))||null,
      rate:parseFloat(gv('bl-rate'))||null,
      description:gv('bl-desc')||null
    });
    if(res&&res[0]) WA_BILLS.push(res[0]);
    toast('Bill generated!','success');
    closeSheet('ov-exec','sh-exec');
    execRenderBills();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function execOpenPayment(billId,partyKey,projId,balAmount){
  var parts=partyKey.split('::');
  var partyType=parts[0],partyName=parts[1];
  document.getElementById('exec-sheet-title').textContent='Record Payment — '+partyName;
  document.getElementById('exec-sheet-body').innerHTML=
    '<div style="background:#E8F5E9;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:11px;font-weight:700;color:#2E7D32;">Balance Payable: &#8377;'+Math.round(balAmount).toLocaleString('en-IN')+'</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">Payment Date *</label><input id="py-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
      '<div><label class="flbl">Amount (₹) *</label><input id="py-amount" class="finp" type="number" value="'+Math.round(balAmount)+'"></div>'+
    '</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">Payment Mode</label>'+
        '<select id="py-mode" class="fsel">'+
          '<option>Cash</option><option>NEFT</option><option>RTGS</option><option>Cheque</option><option>UPI</option>'+
        '</select>'+
      '</div>'+
      '<div><label class="flbl">Reference / Cheque No.</label><input id="py-ref" class="finp" placeholder="UTR / Cheque no."></div>'+
    '</div>'+
    '<label class="flbl">Remarks</label>'+
    '<input id="py-remarks" class="finp" placeholder="Any notes...">';

  var sf=document.getElementById('exec-sheet-foot');sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#2E7D32;color:white;';
  sb.innerHTML='&#10003; Record Payment';
  sb.onclick=function(){execSavePayment(billId,partyType,partyName,projId);};
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-exec','sh-exec');
}

async function execSavePayment(billId,partyType,partyName,projId){
  var date=gv('py-date'),amount=parseFloat(gv('py-amount'))||0;
  if(!date||!amount){toast('Date and amount required','warning');return;}
  try{
    var res=await sbInsert('work_payments',{
      project_id:projId,bill_id:billId,
      party_type:partyType,party_name:partyName,
      payment_date:date,amount:amount,
      payment_mode:gv('py-mode')||'Cash',
      reference:gv('py-ref')||null,
      remarks:gv('py-remarks')||null
    });
    if(res&&res[0]) WA_PAYMENTS.push(res[0]);
    toast('Payment recorded!','success');
    closeSheet('ov-exec','sh-exec');
    execRenderBills();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function execDelPayment(id){
  if(!confirm('Delete this payment record?'))return;
  WA_PAYMENTS=WA_PAYMENTS.filter(function(p){return p.id!==id;});
  execRenderBills();
  try{await sbDelete('work_payments',id);}catch(e){console.error(e);}
}

