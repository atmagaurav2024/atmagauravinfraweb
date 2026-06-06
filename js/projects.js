// ════ PROJECTS — Navigation ═════════════════════════════
// Global date formatter used throughout projects module
function fmtD(d){if(!d)return '—';var p=String(d).split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d;}

var PROJ_DATA=[], PROJ_EDIT_ID=null;
var PROJ_MOD_TAB = 'projects';      // current main tab
var PROJ_MOD_SUB = '';              // current sub-tab (for grouped tabs)
var PROJ_MOD_SEL_ID = '';           // selected project id

// ── Group map ─────────────────────────────────────────────
// Main tabs: projects | preconstruction | construction | bills | orders
// Sub-tabs of preconstruction: boq | jm | planning
// Sub-tabs of construction: rr | execution | allotted | daily | grn | store

var PMT_GROUPS = {
  preconstruction: ['boq','jm','planning'],
  construction:    ['rr','execution','allotted','daily','grn','store']
};

// ── Project selector (hidden, kept for compat) ────────────
async function projModLoadProjects(forceFetch){
  var sel = document.getElementById('proj-mod-sel');
  if(!sel) return;
  // Only fetch when forced (after add/edit) — loadProjData handles initial fetch
  if(forceFetch){
    try{
      var rows = await sbFetch('projects',{select:'*',order:'name.asc'});
      PROJ_DATA = Array.isArray(rows) ? rows : [];
    }catch(e){}
  }
  // Render dropdown from cache
  var prev = PROJ_MOD_SEL_ID;
  sel.innerHTML = '<option value="">— Select Project —</option>'+
    PROJ_DATA.map(function(p){
      return '<option value="'+p.id+'"'+(p.id===prev?' selected':'')+'>'+
        (p.name||'Unnamed')+(p.code?' ('+p.code+')':'')+
      '</option>';
    }).join('');
  if(prev) sel.value = prev;
}

function projModSelChange(){
  var sel = document.getElementById('proj-mod-sel');
  PROJ_MOD_SEL_ID = sel ? sel.value : '';
  WA_LOADED_PROJ = '';
  projModRenderNav();
  projModLoadTab();
}

// ── Main entry: called from showApp ───────────────────────
function initProjects(){
  projModRenderNav();
  projModLoadTab();
  if(PROJ_DATA.length) projModLoadProjects();
}

// ── Render the grouped tab nav bar ────────────────────────
function projModRenderNav(){
  var bar=document.getElementById('proj-mod-nav-bar');
  if(!bar) return;
  var hasProjId=!!PROJ_MOD_SEL_ID;
  var onProjects=PROJ_MOD_TAB==='projects';

  var subLabels={boq:'BOQ',jm:'JM',planning:'Planning',rr:'RR',execution:'Work Allotment',allotted:'Allotted',daily:'Daily Progress',grn:'GRN',store:'Store'};
  var activeGroup='';
  if(PMT_GROUPS.preconstruction.indexOf(PROJ_MOD_TAB)>-1) activeGroup='preconstruction';
  else if(PMT_GROUPS.construction.indexOf(PROJ_MOD_TAB)>-1) activeGroup='construction';

  var mainTabs=[
    {id:'projects',        label:'Projects'},
    {id:'preconstruction', label:'Pre-construction', group:true},
    {id:'construction',    label:'Construction',     group:true},
    {id:'bills',           label:'Bills & Payments'},
    {id:'orders',          label:'Orders'}
  ];

  // ── Main tab row ──
  // Non-project tabs only shown when a project is selected
  var mainRow='<div style="display:flex;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:6px 10px;gap:4px;background:white;">'+
    mainTabs.map(function(t){
      var isActive=(PROJ_MOD_TAB===t.id)||(t.group&&activeGroup===t.id);
      // Hide non-project tabs when no project selected OR when on Projects tab
      if(t.id!=='projects'&&(onProjects||!hasProjId)) return '';
      return '<button id="pmt-'+t.id+'" '+
        'onclick="projModTab(\''+t.id+'\')" '+
        'style="flex-shrink:0;padding:7px 14px;font-size:12px;font-weight:800;border:none;border-radius:8px;'+
        'font-family:Nunito,sans-serif;white-space:nowrap;cursor:pointer;transition:all .15s;'+
        'background:'+(isActive?'#111827':'transparent')+';'+
        'color:'+(isActive?'white':'#6B7280')+';'+
        '">'+t.label+'</button>';
    }).join('')+
  '</div>';

  // ── Sub-tab row ──
  var subRow='';
  if(hasProjId&&activeGroup&&!onProjects){
    subRow='<div style="display:flex;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;'+
      'padding:0 10px 8px;gap:4px;background:white;border-top:1px solid #F3F4F6;">'+
      PMT_GROUPS[activeGroup].map(function(s){
        var sa=PROJ_MOD_TAB===s;
        return '<button id="pmt-'+s+'" onclick="projModSubTab(\''+activeGroup+'\',\''+s+'\')" '+
          'style="flex-shrink:0;padding:5px 12px;font-size:11px;font-weight:800;border:none;border-radius:7px;'+
          'font-family:Nunito,sans-serif;white-space:nowrap;cursor:pointer;transition:all .15s;'+
          'background:'+(sa?'#111827':'transparent')+';'+
          'color:'+(sa?'white':'#9CA3AF')+';'+
          '">'+subLabels[s]+'</button>';
      }).join('')+
    '</div>';
  }

  bar.innerHTML=mainRow+subRow;

  // Badge
  var badge=document.getElementById('proj-mod-sel-badge');
  if(badge){
    if(hasProjId&&!onProjects){
      var pp=PROJ_DATA.find(function(p){return p.id===PROJ_MOD_SEL_ID;});
      var pname=pp?(pp.code||pp.name):'';
      badge.innerHTML='<span style="font-size:10px;background:rgba(255,255,255,.2);color:white;padding:3px 10px;border-radius:6px;font-weight:700;">'+pname+'</span>';
    }else{
      badge.innerHTML='';
    }
  }

  var addBtn=document.getElementById('proj-mod-add-btn');
  if(addBtn) addBtn.style.display=(PROJ_MOD_TAB==='projects'||PROJ_MOD_TAB==='boq')?'':'none';
}



// ── Switch main tab ───────────────────────────────────────
function projModTab(tab){
  PROJ_MOD_TAB = tab;

  // For group tabs: default to first sub-tab
  if(PMT_GROUPS[tab]){
    PROJ_MOD_TAB = PMT_GROUPS[tab][0];
  }

  // When going back to Projects tab, hide other tabs by clearing selection display
  // (PROJ_MOD_SEL_ID is kept so user can return to same project)

  projModRenderNav();
  projModLoadTab();
}

// ── Switch sub-tab within a group ─────────────────────────
function projModSubTab(group, sub){
  PROJ_MOD_TAB = sub;
  PROJ_MOD_SUB = sub;
  projModRenderNav();
  projModLoadTab();
}

// ── Select project from card click ───────────────────────
function projSelectAndGo(projId){
  PROJ_MOD_SEL_ID = projId;
  WA_LOADED_PROJ  = '';
  // Update hidden selector
  var sel = document.getElementById('proj-mod-sel');
  if(sel) sel.value = projId;
  // Go to BOQ (first pre-construction sub-tab)
  PROJ_MOD_TAB = 'boq';
  PROJ_MOD_SUB = 'boq';
  projModRenderNav();
  projModLoadTab();
}

// ── Load content for current tab ─────────────────────────
function projModLoadTab(){
  var el = document.getElementById('proj-mod-content');
  if(!el) return;
  var projId = PROJ_MOD_SEL_ID;
  var tab = PROJ_MOD_TAB;

  if(tab === 'projects'){
    el.innerHTML = '<div style="padding:0 0 6px;"><div class="search-bar"><span style="font-size:16px;color:var(--text3);">&#128269;</span><input type="text" id="proj-search" placeholder="Search projects..." oninput="searchProj(this.value)"></div></div><div id="proj-list"><div style="text-align:center;padding:40px;color:var(--text3);">&#9203; Loading...</div></div>';
    loadProjData();
    return;
  }

  if(!projId){
    el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text3);"><div style="font-size:40px;margin-bottom:12px;">&#128207;</div><div style="font-weight:800;font-size:14px;">No project selected</div><div style="font-size:12px;margin-top:6px;">Go to the <b>Projects</b> tab and click a project to begin</div></div>';
    return;
  }

  var configs = {
    boq:       {cont:'boq-content',   sel:'boq-proj-sel',   fn: function(){ boqLoadItems(); }},
    jm:        {cont:'jm-content',    sel:'jm-proj-sel',    fn: function(){ jmLoadItems(); }},
    planning:  {cont:'plan-content',  sel:'plan-proj-sel',  fn: function(){ planLoadItems(); }},
    rr:        {cont:'rr-content',    sel:'rr-proj-sel',    fn: function(){ rrLoadItems(); }},
    execution: {cont:'exec-content',  sel:'exec-proj-sel',  fn: function(){ WA_SUBTAB='allot';    execSwitchTab(); }},
    allotted:  {cont:'exec-content',  sel:'exec-proj-sel',  fn: function(){ WA_SUBTAB='allotted'; execSwitchTab(); }},
    daily:     {cont:'exec-content',  sel:'exec-proj-sel',  fn: function(){ WA_SUBTAB='daily';    execSwitchTab(); }},
    grn:       {cont:'grn-content',   sel:'grn-proj-sel',   fn: function(){ grnLoadItems(); }},
    store:     {cont:'store-content', sel:'store-proj-sel', fn: function(){ storeLoadItems(); }},
    bills:     {cont:'exec-content',  sel:'exec-proj-sel',  fn: function(){ WA_SUBTAB='bills';    execSwitchTab(); }},
    orders:    {cont:'exec-content',  sel:'exec-proj-sel',  fn: function(){ WA_SUBTAB='orders';   execSwitchTab(); }}
  };

  var cfg = configs[tab];
  if(!cfg){ el.innerHTML=''; return; }

  el.innerHTML = '<select id="'+cfg.sel+'" style="display:none;"><option value="'+projId+'" selected></option></select>'+
                 '<div id="'+cfg.cont+'"><div style="text-align:center;padding:40px;color:var(--text3);">&#9203; Loading...</div></div>';
  cfg.fn();
}

function projModAdd(){
  if(PROJ_MOD_TAB==='projects') openProjForm(null);
  else if(PROJ_MOD_TAB==='boq') boqOpenAddItem(null);
}


// ── PROJECT LIST ──────────────────────────────────────────────────────
async function loadProjData(forceFetch){
  var el = document.getElementById('proj-list'); if(!el) return;

  // Use cache if available and not forcing a refresh
  if(PROJ_DATA.length && !forceFetch){
    renderProjList();          // instant render from cache
    projModLoadProjects();     // populate selector from cache
    return;
  }

  // Need to fetch — show spinner
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">&#9203; Loading projects...</div>';
  try{
    var rows = await sbFetch('projects',{select:'*',order:'name.asc'});
    PROJ_DATA = Array.isArray(rows) ? rows : [];
    // Re-get el in case DOM changed during async fetch
    var el2 = document.getElementById('proj-list');
    if(el2) renderProjList();
    projModLoadProjects();
  }catch(e){
    var el2 = document.getElementById('proj-list');
    if(el2) el2.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">Error loading projects. Tap to retry.</div>';
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
    var inrFmt=function(n){return n?'\u20b9'+Number(n).toLocaleString('en-IN'):'';};
    var coords=[];try{coords=p.coordinates?JSON.parse(p.coordinates):[];}catch(e){}
    var files=[];try{files=p.attachments?JSON.parse(p.attachments):[];}catch(e){}
    return '<div style="background:white;border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">'+
      // ── Header row (click to select + go to BOQ) ──
      '<div style="padding:12px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="projSelectAndGo(\''+p.id+'\')" title="Click to open project">'+
        '<div style="width:44px;height:44px;border-radius:12px;background:'+st.col+'20;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">&#127959;</div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:14px;font-weight:800;color:var(--navy);">'+esc(p.name||'Unnamed')+'</div>'+
          '<div style="font-size:11px;color:var(--text3);margin-top:2px;">'+(p.code||'—')+
            (p.client?' &bull; '+esc(p.client):'')+
            (p.project_length?' &bull; '+p.project_length+' km':'')+
          '</div>'+
        '</div>'+
        '<span style="font-size:10px;font-weight:700;padding:4px 8px;border-radius:6px;background:'+st.col+'15;color:'+st.col+';">'+st.label+'</span>'+
      '</div>'+
      // ── Details row ──
      '<div style="padding:0 14px 8px;display:flex;flex-wrap:wrap;gap:10px;font-size:10px;color:var(--text3);">'+
        (p.location?'<span>&#128205; '+esc(p.location)+'</span>':'')+
        (p.contract_value?'<span>&#128200; '+inrFmt(p.contract_value)+'</span>':'')+
        (p.completion_date?'<span>&#128197; '+p.completion_date.split('-').reverse().join('/')+'</span>':'')+
        (coords.length?'<span>&#128204; '+coords.length+' GPS point'+(coords.length>1?'s':'')+'</span>':'')+
        (files.length?'<span>&#128206; '+files.length+' file'+(files.length>1?'s':'')+'</span>':'')+
      '</div>'+
      // ── Action buttons (Edit + Delete only, no Open Project) ──
      '<div style="padding:6px 14px 10px;display:flex;gap:6px;border-top:1px solid #F3F4F6;">'+
        '<button onclick="event.stopPropagation();openProjForm(\''+p.id+'\')" '+
          'style="background:#F3F4F6;color:#374151;border:none;border-radius:7px;padding:6px 14px;font-size:11px;font-weight:800;cursor:pointer;">'+
          '&#9998; Edit</button>'+
        '<button onclick="event.stopPropagation();if(confirm(\'Delete this project?\')) deleteProjItem(\''+p.id+'\')" '+
          'style="background:#FEE2E2;color:#C62828;border:none;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:800;cursor:pointer;">'+
          '&#128465;</button>'+
      '</div>'+
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

// ── Auto-generate project code ──────────────────────────────
function genProjCode(){
  var prefix='AIPL';
  var existing=PROJ_DATA.map(function(p){
    var m=(p.code||'').match(/^[A-Z]+-(\d+)$/);
    return m?parseInt(m[1]):0;
  });
  var next=existing.length?Math.max.apply(null,existing)+1:1;
  return prefix+'-'+String(next).padStart(3,'0');
}

// ── Coordinate helpers ───────────────────────────────────────
var PF_COORDS=[]; // [{lat,lng,label}]

function pfAddCoord(){
  var lat=(document.getElementById('pf-new-lat')||{value:''}).value.trim();
  var lng=(document.getElementById('pf-new-lng')||{value:''}).value.trim();
  var lbl=(document.getElementById('pf-new-lbl')||{value:''}).value.trim();
  if(!lat||!lng){toast('Enter latitude and longitude','warning');return;}
  if(isNaN(parseFloat(lat))||isNaN(parseFloat(lng))){toast('Invalid coordinates','warning');return;}
  PF_COORDS.push({lat:parseFloat(lat).toFixed(6),lng:parseFloat(lng).toFixed(6),label:lbl||'Point '+(PF_COORDS.length+1)});
  document.getElementById('pf-new-lat').value='';
  document.getElementById('pf-new-lng').value='';
  document.getElementById('pf-new-lbl').value='';
  pfRenderCoords();
}
function pfRemoveCoord(i){PF_COORDS.splice(i,1);pfRenderCoords();}
function pfRenderCoords(){
  var el=document.getElementById('pf-coord-list');if(!el)return;
  if(!PF_COORDS.length){el.innerHTML='<div style="font-size:10px;color:var(--text3);padding:4px 0;">No coordinates added yet</div>';return;}
  el.innerHTML=PF_COORDS.map(function(c,i){
    return '<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:#F0F4FF;border-radius:6px;margin-bottom:4px;font-size:10px;">'+
      '<span style="font-size:16px;">&#128205;</span>'+
      '<div style="flex:1;"><b>'+c.label+'</b><div style="color:var(--text3);">'+c.lat+', '+c.lng+'</div></div>'+
      '<button onclick="pfRemoveCoord('+i+')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:14px;">&#215;</button>'+
    '</div>';
  }).join('');
}

// ── Contract price auto-calc ─────────────────────────────────
function pfCalcContract(){
  var tender=parseFloat((document.getElementById('pf-tender')||{value:''}).value)||0;
  var pct=parseFloat((document.getElementById('pf-pct')||{value:''}).value)||0;
  var contract=Math.round(tender*(1+pct/100));
  var el=document.getElementById('pf-contract');
  if(el&&tender) el.value=contract;
}

// ── File attachments ─────────────────────────────────────────
var PF_FILES=[]; // [{name, file, url}] — url only for existing

function pfAddFile(){
  var nameEl=document.getElementById('pf-file-name');
  var fileEl=document.getElementById('pf-file-input');
  if(!nameEl||!fileEl)return;
  var name=(nameEl.value||'').trim();
  var file=fileEl.files&&fileEl.files[0];
  if(!name){toast('Enter file name/description','warning');return;}
  if(!file){toast('Select a file','warning');return;}
  PF_FILES.push({name:name,file:file,size:file.size,type:file.type});
  nameEl.value='';
  fileEl.value='';
  pfRenderFiles();
}
function pfRemoveFile(i){PF_FILES.splice(i,1);pfRenderFiles();}
function pfRenderFiles(){
  var el=document.getElementById('pf-file-list');if(!el)return;
  var allFiles=[...PF_FILES];
  if(!allFiles.length){el.innerHTML='<div style="font-size:10px;color:var(--text3);padding:4px 0;">No files attached yet</div>';return;}
  el.innerHTML=allFiles.map(function(f,i){
    var icon=f.type&&f.type.includes('pdf')?'&#128196;':f.type&&f.type.includes('image')?'&#128247;':'&#128196;';
    var sz=f.size?(f.size>1024*1024?(f.size/1024/1024).toFixed(1)+'MB':(f.size/1024).toFixed(0)+'KB'):'';
    return '<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:#F8FAFC;border:1px solid var(--border);border-radius:6px;margin-bottom:4px;font-size:10px;">'+
      '<span style="font-size:16px;">'+icon+'</span>'+
      '<div style="flex:1;min-width:0;"><b>'+f.name+'</b><div style="color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(f.file?f.file.name:'')+(sz?' ('+sz+')':'')+'</div></div>'+
      '<button onclick="pfRemoveFile('+i+')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:14px;">&#215;</button>'+
    '</div>';
  }).join('');
}

function openProjForm(id){
  var p = id ? (PROJ_DATA.find(function(x){return x.id===id;})||{}) : {};
  PF_COORDS = [];
  PF_FILES  = [];

  // Load existing coordinates
  if(p.coordinates){
    try{PF_COORDS=JSON.parse(p.coordinates);}catch(e){}
  }
  // Load existing files metadata
  var existFiles=[];
  if(p.attachments){try{existFiles=JSON.parse(p.attachments);}catch(e){}}
  existFiles.forEach(function(f){PF_FILES.push({name:f.name,file:null,url:f.url,size:0,type:''});});

  // Auto-generate code for new project
  var autoCode = id ? (p.code||'') : genProjCode();

  var statusOpts = ['in-progress','under-dlp','fully-completed','planning','active'].map(function(s){
    var labels={'in-progress':'In Progress','under-dlp':'Under DLP','fully-completed':'Completed','planning':'Planning','active':'Active'};
    return '<option value="'+s+'"'+(p.status===s?' selected':'')+'>'+labels[s]+'</option>';
  }).join('');

  var html =
    // ── Row 1: Code + Name ──
    '<div class="g2" style="margin-bottom:8px;">'+
      '<div><label class="flbl">Project Code</label>'+
        '<input id="pf-code" class="finp" value="'+esc(autoCode)+'" placeholder="Auto-generated">'+
      '</div>'+
      '<div><label class="flbl">Project Name *</label>'+
        '<input id="pf-name" class="finp" value="'+esc(p.name||'')+'">'+
      '</div>'+
    '</div>'+
    // ── Row 2: Length ──
    '<div class="g2" style="margin-bottom:8px;">'+
      '<div><label class="flbl">Project Length (km)</label>'+
        '<input id="pf-length" class="finp" type="number" step="0.001" value="'+(p.project_length||'')+'" placeholder="e.g. 42.5">'+
      '</div>'+
      '<div><label class="flbl">Project Location / Route</label>'+
        '<input id="pf-location" class="finp" value="'+esc(p.location||'')+'" placeholder="e.g. NH-48 Km 120 to 162">'+
      '</div>'+
    '</div>'+
    // ── Coordinates ──
    '<div style="margin-bottom:10px;">'+
      '<label class="flbl">GPS Coordinates <span style="font-size:9px;font-weight:400;color:var(--text3);">(for attendance geofencing — add multiple for highway)</span></label>'+
      '<div id="pf-coord-list" style="margin-bottom:6px;"></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px;align-items:center;">'+
        '<input id="pf-new-lat" class="finp" placeholder="Latitude (e.g. 22.5726)" style="margin:0;">'+
        '<input id="pf-new-lng" class="finp" placeholder="Longitude (e.g. 88.3639)" style="margin:0;">'+
        '<input id="pf-new-lbl" class="finp" placeholder="Label (e.g. Km 120)" style="margin:0;">'+
        '<button onclick="pfAddCoord()" style="background:#1565C0;color:white;border:none;border-radius:7px;padding:8px 12px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;">+ Add</button>'+
      '</div>'+
    '</div>'+
    // ── Cost section ──
    '<div style="background:#F8FAFC;border-radius:10px;padding:10px 12px;margin-bottom:10px;">'+
      '<div style="font-size:10px;font-weight:800;color:#1565C0;margin-bottom:8px;">CONTRACT FINANCIALS</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">'+
        '<div><label class="flbl">Cost Put to Tender (₹)</label>'+
          '<input id="pf-tender" class="finp" type="number" step="1" value="'+(p.tender_cost||'')+'" placeholder="0" oninput="pfCalcContract()"></div>'+
        '<div><label class="flbl">% Above / Below Tender</label>'+
          '<div style="display:flex;gap:6px;align-items:center;">'+
            '<input id="pf-pct" class="finp" type="number" step="0.01" value="'+(p.tender_pct||'0')+'" placeholder="e.g. -5 for 5% below" style="flex:1;" oninput="pfCalcContract()">'+
            '<span style="font-size:10px;color:var(--text3);white-space:nowrap;padding-top:2px;">%</span>'+
          '</div></div>'+
        '<div><label class="flbl">Contract Price (₹) <span style="font-size:9px;font-weight:400;">auto / editable</span></label>'+
          '<input id="pf-contract" class="finp" type="number" step="1" value="'+(p.contract_value||'')+'" placeholder="Auto-calculated"></div>'+
      '</div>'+
    '</div>'+
    // ── Status + Client ──
    '<div class="g2" style="margin-bottom:8px;">'+
      '<div><label class="flbl">Status</label><select id="pf-status" class="fsel">'+statusOpts+'</select></div>'+
      '<div><label class="flbl">Client / Owner</label><input id="pf-client" class="finp" value="'+esc(p.client||'')+'"></div>'+
    '</div>'+
    // ── Dates ──
    '<div style="background:#FFF3E0;border-radius:10px;padding:10px 12px;margin-bottom:10px;">'+
      '<div style="font-size:10px;font-weight:800;color:#E65100;margin-bottom:8px;">KEY DATES</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">'+
        '<div><label class="flbl">LOA Date</label><input id="pf-loa" class="finp" type="date" value="'+(p.loa_date||'')+'"></div>'+
        '<div><label class="flbl">Work Order Date</label><input id="pf-wo-date" class="finp" type="date" value="'+(p.wo_date||'')+'"></div>'+
        '<div><label class="flbl">Schedule Completion Date</label><input id="pf-completion" class="finp" type="date" value="'+(p.completion_date||'')+'"></div>'+
      '</div>'+
    '</div>'+
    // ── Description ──
    '<div style="margin-bottom:10px;"><label class="flbl">Description / Scope</label>'+
      '<textarea id="pf-desc" class="ftxt" rows="2">'+esc(p.description||'')+'</textarea></div>'+
    // ── File attachments ──
    '<div style="background:#F8FAFC;border-radius:10px;padding:10px 12px;margin-bottom:4px;">'+
      '<div style="font-size:10px;font-weight:800;color:#2E7D32;margin-bottom:8px;">&#128196; FILE ATTACHMENTS</div>'+
      '<div id="pf-file-list" style="margin-bottom:8px;"></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:center;">'+
        '<input id="pf-file-name" class="finp" placeholder="File description (e.g. LOA Letter)" style="margin:0;">'+
        '<input id="pf-file-input" class="finp" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" style="margin:0;padding:5px;">'+
        '<button onclick="pfAddFile()" style="background:#2E7D32;color:white;border:none;border-radius:7px;padding:8px 12px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;">+ Attach</button>'+
      '</div>'+
      '<div style="font-size:9px;color:var(--text3);margin-top:4px;">Accepts PDF, images, Word, Excel</div>'+
    '</div>';

  document.getElementById('proj-sheet-title').textContent = id ? 'Edit Project' : 'New Project';
  document.getElementById('proj-sheet-body').innerHTML = html;

  // Render existing coords and files
  pfRenderCoords();
  pfRenderFiles();
  // Auto-calc contract if values exist
  if(p.tender_cost) pfCalcContract();

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

  // File upload (base64 encode for storage — small files only)
  var attachments=[];
  PF_FILES.forEach(function(f){
    if(f.url) attachments.push({name:f.name,url:f.url});
  });
  var newFiles=PF_FILES.filter(function(f){return f.file;});
  if(newFiles.length){
    try{
      await Promise.all(newFiles.map(function(f){
        return new Promise(function(resolve){
          var reader=new FileReader();
          reader.onload=function(e){
            attachments.push({name:f.name,url:e.target.result,fileName:f.file.name,type:f.type});
            resolve();
          };
          reader.readAsDataURL(f.file);
        });
      }));
    }catch(e){console.warn('File encode:',e);}
  }

  // Only send columns that exist in the projects table
  // Fetch the project schema first to know which columns exist
  var data = {
    name:name,
    code:(document.getElementById('pf-code')||{value:''}).value.trim()||null,
    client:(document.getElementById('pf-client')||{value:''}).value.trim()||null,
    status:(document.getElementById('pf-status')||{value:'active'}).value||'active',
    location:(document.getElementById('pf-location')||{value:''}).value.trim()||null,
    description:(document.getElementById('pf-desc')||{value:''}).value.trim()||null
  };

  // Optional columns — only add if non-null (Supabase will 400 if column missing)
  function addCol(key, val){ if(val!==null&&val!==undefined&&val!=='') data[key]=val; }
  addCol('tender_cost',     parseFloat((document.getElementById('pf-tender')||{value:''}).value)||null);
  addCol('tender_pct',      parseFloat((document.getElementById('pf-pct')||{value:''}).value)||null);
  addCol('contract_value',  parseFloat((document.getElementById('pf-contract')||{value:''}).value)||null);
  addCol('loa_date',        (document.getElementById('pf-loa')||{value:''}).value||null);
  addCol('wo_date',         (document.getElementById('pf-wo-date')||{value:''}).value||null);
  addCol('completion_date', (document.getElementById('pf-completion')||{value:''}).value||null);
  addCol('attachments',     attachments.length?JSON.stringify(attachments):null);
  addCol('project_length',  parseFloat((document.getElementById('pf-length')||{value:''}).value)||null);
  addCol('coordinates',     PF_COORDS&&PF_COORDS.length?JSON.stringify(PF_COORDS):null);

  try{
    toast('Saving...','info');
    if(editId){
      // Use JWT fetch for update
      var baseUrl=typeof SUPABASE_URL!=='undefined'?SUPABASE_URL:'';
      var anonKey=typeof SUPABASE_ANON_KEY!=='undefined'?SUPABASE_ANON_KEY:'';
      var token=(typeof currentUser!=='undefined'&&currentUser&&currentUser.accessToken)?currentUser.accessToken:anonKey;
      var res=await fetch(baseUrl+'/rest/v1/projects?id=eq.'+editId,{
        method:'PATCH',
        headers:{'apikey':anonKey,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(data)
      });
      if(!res.ok){
        var errBody=await res.json().catch(function(){return{};});
        // If failed due to unknown columns, retry with safe columns only
        if(res.status===400){
          var optCols=['contract_value','tender_cost','tender_pct','loa_date','wo_date',
            'completion_date','attachments','project_length','coordinates'];
          optCols.forEach(function(k){delete data[k];});
          var res2=await fetch(baseUrl+'/rest/v1/projects?id=eq.'+editId,{
            method:'PATCH',
            headers:{'apikey':anonKey,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'return=representation'},
            body:JSON.stringify(data)
          });
          if(!res2.ok){
            var e2=await res2.json().catch(function(){return{};});
            throw new Error(e2.message||'Update failed: '+res2.status);
          }
        } else {
          throw new Error(errBody.message||'Update failed: '+res.status);
        }
      }
      var idx=PROJ_DATA.findIndex(function(p){return p.id===editId;});
      if(idx>-1) PROJ_DATA[idx]=Object.assign(PROJ_DATA[idx],data);
      toast('Project updated!','success');
    } else {
      // Insert with JWT
      var baseUrl=typeof SUPABASE_URL!=='undefined'?SUPABASE_URL:'';
      var anonKey=typeof SUPABASE_ANON_KEY!=='undefined'?SUPABASE_ANON_KEY:'';
      var token=(typeof currentUser!=='undefined'&&currentUser&&currentUser.accessToken)?currentUser.accessToken:anonKey;
      var res=await fetch(baseUrl+'/rest/v1/projects',{
        method:'POST',
        headers:{'apikey':anonKey,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(data)
      });
      if(!res.ok){
        var errBody=await res.json().catch(function(){return{};});
        // If 400 due to unknown columns, retry without optional ones
        if(res.status===400){
          // Strip optional columns one by one until insert succeeds
          var optCols=['contract_value','tender_cost','tender_pct','loa_date','wo_date',
            'completion_date','attachments','project_length','coordinates'];
          optCols.forEach(function(k){delete data[k];});
          var res2=await fetch(baseUrl+'/rest/v1/projects',{
            method:'POST',
            headers:{'apikey':anonKey,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'return=representation'},
            body:JSON.stringify(data)
          });
          if(!res2.ok){
            var e2=await res2.json().catch(function(){return{};});
            throw new Error(e2.message||'Insert failed: '+res2.status);
          }
          var saved=await res2.json();
          if(Array.isArray(saved)&&saved[0]) PROJ_DATA.push(saved[0]);
          await projModLoadProjects(true);
          toast('Project added! (some optional fields not saved — add missing columns to DB)','success');
        } else {
          throw new Error(errBody.message||'Insert failed: '+res.status);
        }
      } else {
        var saved=await res.json();
        if(Array.isArray(saved)&&saved[0]) PROJ_DATA.push(saved[0]);
        await projModLoadProjects(true); // force re-fetch so new project appears
      }
      toast('Project added! Select it from the dropdown above.','success');
    }
    closeProjSheet();
    loadProjData(true); // force refresh list + selector after save
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function deleteProjItem(id){
  try{
    await sbDelete('projects',id);
    PROJ_DATA=PROJ_DATA.filter(function(p){return p.id!==id;});
    closeProjSheet();
    loadProjData(true); // force refresh list + selector after save
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
var WA_DAILY=[],WA_BILLS=[],WA_PAYMENTS=[],WA_ORDERS=[],WA_JMS=[],WA_APPROVED_RRS=[],STORE_ISSUE_LOG=[],WA_ADVANCES=[];
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
  // Use global project selector first, then fallback to hidden exec-proj-sel
  var projId=PROJ_MOD_SEL_ID||(document.getElementById('exec-proj-sel')||{}).value||'';
  var el=document.getElementById('exec-content');
  if(!projId){
    if(el)el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">'+
      '<div style="font-size:32px;">&#128203;</div>'+
      '<div style="font-weight:700;margin-top:8px;">Select a project first</div>'+
      '<div style="font-size:11px;margin-top:6px;">Use the project dropdown at the top</div></div>';
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
async function execLoadItems(silent){
  var projId=PROJ_MOD_SEL_ID||(document.getElementById('exec-proj-sel')||{}).value||'';
  var el=document.getElementById('exec-content');
  if(!projId){if(el&&!silent)el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">Select a project</div>';return;}
  if(el&&!silent) el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">&#9203; Loading...</div>';
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
      safe(sbFetch('resource_requisitions',{select:'*',filter:'project_id=eq.'+projId+'&status=eq.approved',order:'created_at.desc'})),
      safe(sbFetch('store_inventory',{select:'*',filter:'project_id=eq.'+projId,order:'item_name.asc'})),
      safe(sbFetch('store_issue_log',{select:'*',filter:'project_id=eq.'+projId,order:'issue_date.desc'})),
      safe(sbFetch('work_advances',{select:'*',filter:'project_id=eq.'+projId,order:'date.desc'}))
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
    STORE_ITEMS=Array.isArray(r[9])?r[9]:[];
    STORE_ISSUE_LOG=Array.isArray(r[10])?r[10]:[];
    WA_ADVANCES=Array.isArray(r[11])?r[11]:[];
    STORE_PROJ_ID=projId;
    WA_LOADED_PROJ = projId; // mark this project as loaded
  }catch(e){WA_ITEMS=[];WA_LOADED_PROJ='';console.error(e);}
  if(!silent) execRenderSubTab();
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

  openPDF(html);
}


async function execRenderSubTab(){
  // Always refresh approved RRs before rendering allot tab — they change in RR tab
  if(WA_SUBTAB==='allot'){
    var projId=PROJ_MOD_SEL_ID||(document.getElementById('exec-proj-sel')||{}).value||'';
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
  else if(WA_SUBTAB==='grn') grnRender();
  else if(WA_SUBTAB==='store') storeRender();
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

  // Count total items with unallotted RRs
  var totalUnallotted=itemsWithRes.filter(function(item){
    return WA_PLANNED.filter(function(r){return r.boq_item_id===item.id;}).some(function(res){
      var rrApproved=WA_APPROVED_RRS.filter(function(rr){return rr.plan_res_id===res.id;}).reduce(function(s,rr){return s+(parseFloat(rr.qty)||0);},0);
      var totalAllotted=WA_ALLOT.filter(function(a){return a.boq_exec_resource_id===res.id;}).reduce(function(s,a){return s+(parseFloat(a.qty)||0);},0);
      return rrApproved>totalAllotted;
    });
  }).length;

  var multiBtn=totalUnallotted>1
    ? '<div style="margin-bottom:10px;"><button onclick="execOpenMultiAllot()" style="width:100%;padding:10px;background:#1B5E20;color:white;border:none;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;">&#10010; Allot Multiple BOQ Items at Once ('+totalUnallotted+' items available)</button></div>'
    : '';

  el.innerHTML=multiBtn+itemsHtml+orphanHtml;

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


// ══════════════════════════════════════════════════════════════════════
// MULTI-ITEM WORK ALLOTMENT
// ══════════════════════════════════════════════════════════════════════
async function execOpenMultiAllot(){
  await loadUomIfNeeded();
  var projId=PROJ_MOD_SEL_ID||(document.getElementById('exec-proj-sel')||{}).value||'';

  // Collect ALL pending RRs across ALL BOQ items (with balance > 0)
  var allPending=[];
  WA_ITEMS.forEach(function(item){
    var itemSubIds=WA_SUBS.filter(function(s){return s.boq_item_id===item.id;}).map(function(s){return s.id;});
    var itemRes=WA_PLANNED.filter(function(r){
      return r.boq_item_id===item.id||(r.boq_subitem_id&&itemSubIds.includes(r.boq_subitem_id));
    });
    itemRes.forEach(function(res){
      WA_APPROVED_RRS.filter(function(rr){return rr.plan_res_id===res.id;}).forEach(function(rr){
        var allottedForRR=WA_ALLOT.filter(function(a){return a.rr_id===rr.id;})
          .reduce(function(s,a){return s+(parseFloat(a.qty)||0);},0);
        var rrBalance=Math.max(0,(parseFloat(rr.qty)||0)-allottedForRR);
        if(rrBalance>0){
          allPending.push({
            item:item, res:res, rr:rr,
            rrApprovedQty:parseFloat(rr.qty)||0,
            allottedForRR:allottedForRR,
            rrBalance:rrBalance
          });
        }
      });
    });
  });

  if(!allPending.length){
    toast('No pending RR balance to allot across any BOQ item','warning');
    return;
  }

  // Sort by BOQ item_code natural sort
  allPending.sort(function(a,b){
    var ca=(a.item.item_code||'').split('.').map(function(n){return parseInt(n,10)||0;});
    var cb=(b.item.item_code||'').split('.').map(function(n){return parseInt(n,10)||0;});
    for(var i=0;i<Math.max(ca.length,cb.length);i++){var diff=(ca[i]||0)-(cb[i]||0);if(diff!==0)return diff;}
    return 0;
  });

  // ── Party section (same as single-item) ──────────────────────────────
  var partySection=
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
      '<div><label class="flbl">Scope / Terms</label>'+
        '<textarea id="wa-scope" class="ftxt" rows="2" placeholder="Common scope for all selected resources..."></textarea>'+
      '</div>'+
      '<div><label class="flbl">Document Type (optional)</label>'+
        '<div style="display:flex;gap:6px;margin-top:4px;">'+
          '<label style="display:flex;align-items:center;gap:5px;padding:6px 10px;border:1.5px solid var(--border);border-radius:7px;cursor:pointer;flex:1;">'+
            '<input type="radio" name="wa-doc-type" value="wo" style="accent-color:#E65100;">'+
            '<div><div style="font-size:10px;font-weight:800;">Work Order</div></div>'+
          '</label>'+
          '<label style="display:flex;align-items:center;gap:5px;padding:6px 10px;border:1.5px solid var(--border);border-radius:7px;cursor:pointer;flex:1;">'+
            '<input type="radio" name="wa-doc-type" value="po" style="accent-color:#1565C0;">'+
            '<div><div style="font-size:10px;font-weight:800;">Purchase Order</div></div>'+
          '</label>'+
          '<label style="display:flex;align-items:center;gap:5px;padding:6px 10px;border:1.5px solid var(--border);border-radius:7px;cursor:pointer;flex:1;">'+
            '<input type="radio" name="wa-doc-type" value="none" checked style="accent-color:#555;">'+
            '<div><div style="font-size:10px;font-weight:800;">None</div></div>'+
          '</label>'+
        '</div>'+
      '</div>'+
    '</div>';

  // ── Group pending by BOQ item for display ────────────────────────────
  var itemGroups={};var itemGroupOrder=[];
  allPending.forEach(function(x){
    var key=x.item.id;
    if(!itemGroups[key]){itemGroups[key]={item:x.item,rows:[]};itemGroupOrder.push(key);}
    itemGroups[key].rows.push(x);
  });

  var resRowsHtml=itemGroupOrder.map(function(itemId){
    var g=itemGroups[itemId];
    var item=g.item;
    var rowsHtml=g.rows.map(function(x){
      var res=x.res; var rr=x.rr; var bal=x.rrBalance;
      var uomOpts=buildUomOpts(res.unit||item.unit||'');
      return '<div class="wa-res-row" data-res-id="'+res.id+'" style="border:1px solid var(--border);border-radius:10px;margin-bottom:6px;overflow:hidden;">'+
        '<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:#FAFAFA;">'+
          '<input type="checkbox" class="wa-res-chk" data-res-id="'+res.id+'" data-rr-id="'+rr.id+'" data-rr-max="'+bal+'" data-item-id="'+item.id+'" style="width:16px;height:16px;accent-color:#E65100;flex-shrink:0;">'+
          '<div style="flex:1;">'+
            '<div style="font-size:12px;font-weight:800;">'+res.party_name+'</div>'+
            '<div style="font-size:10px;color:var(--text3);">'+
              'RR Approved: <b style="color:#2E7D32;">'+x.rrApprovedQty+' '+( res.unit||'')+'</b>'+
              ' | Available: <b style="color:#E65100;">'+bal.toFixed(3).replace(/\.?0+$/,'')+'</b>'+
              (rr.rr_number?' | RR: '+rr.rr_number:'')+
            '</div>'+
          '</div>'+
          '<div class="wa-res-inputs" style="display:none;align-items:center;gap:6px;">'+
            '<div style="text-align:center;">'+
              '<div style="font-size:9px;color:var(--text3);margin-bottom:2px;">Qty</div>'+
              '<input class="wa-qty-inp finp" data-res-id="'+res.id+'" type="number" step="0.001" max="'+bal+'" value="'+bal+'" style="width:80px;padding:4px 6px;font-size:12px;text-align:center;">'+
            '</div>'+
            '<div style="text-align:center;">'+
              '<div style="font-size:9px;color:var(--text3);margin-bottom:2px;">Unit</div>'+
              '<select class="wa-unit-sel fsel" data-res-id="'+res.id+'" style="width:70px;padding:4px;font-size:11px;">'+uomOpts+'</select>'+
            '</div>'+
            '<div style="text-align:center;">'+
              '<div style="font-size:9px;color:var(--text3);margin-bottom:2px;">Rate (₹)</div>'+
              '<input class="wa-rate-inp finp" data-res-id="'+res.id+'" type="number" step="0.01" value="'+( res.rate||'')+'" placeholder="0" style="width:90px;padding:4px 6px;font-size:12px;text-align:center;">'+
            '</div>'+
            '<div style="text-align:center;">'+
              '<div style="font-size:9px;color:var(--text3);margin-bottom:2px;">Amount</div>'+
              '<div class="wa-est-amt" data-res-id="'+res.id+'" style="font-size:12px;font-weight:800;color:#1565C0;">₹0</div>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<div class="wa-res-spec-row" style="display:none;padding:6px 12px 8px;border-top:1px solid #F0F0F0;background:white;">'+
          '<label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:4px;">Specification for this resource</label>'+
          '<textarea class="wa-spec-inp ftxt" data-res-id="'+res.id+'" rows="2"></textarea>'+
        '</div>'+
      '</div>';
    }).join('');

    return '<div style="margin-bottom:12px;">'+
      '<div style="background:#FFF3E0;border-radius:8px 8px 0 0;padding:8px 12px;display:flex;align-items:center;gap:8px;">'+
        '<input type="checkbox" id="wa-item-chk-'+itemId+'" onchange="waToggleItemRows(\''+itemId+'\',this.checked)" style="width:15px;height:15px;accent-color:#E65100;">'+
        '<span style="font-size:10px;font-family:monospace;background:#FFE0B2;color:#E65100;padding:2px 7px;border-radius:4px;">'+item.item_code+'</span>'+
        '<span style="font-size:12px;font-weight:800;">'+( item.short_name||item.description)+'</span>'+
        '<span style="font-size:10px;color:var(--text3);">(tick to select all)</span>'+
      '</div>'+
      '<div id="wa-item-rows-'+itemId+'" style="padding:6px 0 0;">'+rowsHtml+'</div>'+
    '</div>';
  }).join('');

  document.getElementById('exec-sheet-title').textContent='Allot Work — Multiple BOQ Items';
  document.getElementById('exec-sheet-body').innerHTML=
    partySection+
    '<div style="font-size:12px;font-weight:800;color:#E65100;margin-bottom:8px;">&#9313; Select Resources (across all BOQ items)</div>'+
    '<div style="font-size:10px;color:var(--text3);margin-bottom:10px;">Tick item header to select all its resources, or tick individual resources</div>'+
    resRowsHtml;

  var sf=document.getElementById('exec-sheet-foot');
  sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#E65100;color:white;';
  sb.innerHTML='&#10003; Save Allotment';
  sb.onclick=function(){execSaveMultiAllot(projId);};
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-exec','sh-exec');

  // Wire events same as single-item allot
  setTimeout(function(){
    var body=document.getElementById('exec-sheet-body');
    if(!body)return;

    // Party type → load party names
    var ptSel=document.getElementById('wa-party-type');
    if(ptSel) ptSel.addEventListener('change',function(){
      waLoadPartyNames(ptSel.value);
    });

    // Checkbox → show/hide qty+rate inputs
    body.querySelectorAll('.wa-res-chk').forEach(function(chk){
      chk.addEventListener('change',function(){
        var row=chk.closest('.wa-res-row');
        if(!row)return;
        var inp=row.querySelector('.wa-res-inputs');
        var spec=row.querySelector('.wa-res-spec-row');
        if(inp){inp.style.display=chk.checked?'flex':'none';}
        if(spec){spec.style.display=chk.checked?'block':'none';}
      });
    });

    // Qty/Rate → update amount
    body.querySelectorAll('.wa-qty-inp,.wa-rate-inp').forEach(function(inp){
      inp.addEventListener('input',function(){
        var resId=inp.getAttribute('data-res-id');
        var qty=parseFloat(body.querySelector('.wa-qty-inp[data-res-id="'+resId+'"]').value)||0;
        var rate=parseFloat(body.querySelector('.wa-rate-inp[data-res-id="'+resId+'"]').value)||0;
        var amtEl=body.querySelector('.wa-est-amt[data-res-id="'+resId+'"]');
        if(amtEl)amtEl.textContent='₹'+Math.round(qty*rate).toLocaleString('en-IN');
      });
    });
  },200);
}

// Toggle all resource rows under a BOQ item header checkbox
function waToggleItemRows(itemId,checked){
  var container=document.getElementById('wa-item-rows-'+itemId);
  if(!container)return;
  container.querySelectorAll('.wa-res-chk').forEach(function(chk){
    if(chk.checked!==checked){
      chk.checked=checked;
      chk.dispatchEvent(new Event('change'));
    }
  });
}

// Save multi-item allotment — same logic as execSaveAllot but across items
async function execSaveMultiAllot(projId){
  var partyType =(document.getElementById('wa-party-type')||{value:''}).value;
  var partyName =(document.getElementById('wa-party-name')||{value:''}).value;
  var startDate =(document.getElementById('wa-start-date')||{value:''}).value||null;
  var endDate   =(document.getElementById('wa-end-date')||{value:''}).value||null;
  var scope     =(document.getElementById('wa-scope')||{value:''}).value.trim()||null;
  var docType   = (document.querySelector('input[name="wa-doc-type"]:checked')||{value:'none'}).value;

  if(!partyType||!partyName){toast('Select party type and name','warning');return;}

  // Collect all checked rows
  var body=document.getElementById('exec-sheet-body');
  var checked=Array.from(body.querySelectorAll('.wa-res-chk:checked'));
  if(!checked.length){toast('Select at least one resource to allot','warning');return;}

  var toSave=checked.map(function(chk){
    var resId=chk.getAttribute('data-res-id');
    var rrId =chk.getAttribute('data-rr-id');
    var itemId=chk.getAttribute('data-item-id');
    var max  =parseFloat(chk.getAttribute('data-rr-max'))||0;
    var qty  =parseFloat((body.querySelector('.wa-qty-inp[data-res-id="'+resId+'"]')||{value:0}).value)||0;
    var unit =((body.querySelector('.wa-unit-sel[data-res-id="'+resId+'"]'))||{value:''}).value;
    var rate =parseFloat((body.querySelector('.wa-rate-inp[data-res-id="'+resId+'"]')||{value:0}).value)||0;
    var spec =((body.querySelector('.wa-spec-inp[data-res-id="'+resId+'"]'))||{value:''}).value.trim()||null;
    if(qty<=0||qty>max){toast('Invalid qty for '+resId+' (max '+max+')','warning');return null;}
    return {resId:resId,rrId:rrId,itemId:itemId,qty:qty,unit:unit,rate:rate,spec:spec};
  }).filter(Boolean);

  if(toSave.length!==checked.length)return; // validation failed

  toast('Saving '+toSave.length+' allotment(s)...','info');

  var baseUrl=typeof SUPABASE_URL!=='undefined'?SUPABASE_URL:'';
  var anonKey=typeof SUPABASE_ANON_KEY!=='undefined'?SUPABASE_ANON_KEY:'';
  var token=(typeof currentUser!=='undefined'&&currentUser&&currentUser.accessToken)?currentUser.accessToken:anonKey;

  // Use same table and columns as single-item execSaveAllot
  var batchId='batch-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
  var savedCount=0;
  var errors=0;
  for(var i=0;i<toSave.length;i++){
    var s=toSave[i];
    var planRes=WA_PLANNED.find(function(r){return r.id===s.resId;})||{};
    try{
      var res=await sbInsert('boq_exec_resources',{
        project_id:projId,
        boq_item_id:planRes.boq_item_id||s.itemId||null,
        boq_subitem_id:planRes.boq_subitem_id||null,
        boq_exec_resource_id:s.resId,
        date:new Date().toISOString().slice(0,10),
        exec_type:partyType,
        party_name:partyName,
        qty:s.qty,
        unit:s.unit||null,
        rate:s.rate,
        scope:scope||null,
        start_date:startDate,
        end_date:endDate,
        doc_type:docType==='none'?null:docType,
        specification:s.spec||null,
        batch_id:batchId,
        rr_id:s.rrId||null
      });
      if(res&&res[0]) WA_ALLOT.push(res[0]);
      savedCount++;
    }catch(e){errors++;console.error('Multi-allot save error:',e);}
  }

  if(errors) toast(errors+' allotment(s) failed','error');
  if(savedCount) toast(savedCount+' allotment(s) saved!','success');

  closeSheet('ov-exec','sh-exec');

  // Generate document if selected
  if(docType!=='none'&&savedCount>0&&WA_ALLOT.length){
    var lastSaved=WA_ALLOT.slice(-savedCount);
    if(lastSaved.length){
      if(docType==='wo') generateCombinedDoc(lastSaved,'WORK ORDER','#E65100','#FFF3E0');
      else if(docType==='po') generateCombinedDoc(lastSaved,'PURCHASE ORDER','#1565C0','#E3F2FD');
    }
  }

  execRender();
}

async function execOpenAllot(itemId){
  await loadUomIfNeeded();
  var projId=PROJ_MOD_SEL_ID||(document.getElementById('exec-proj-sel')||{}).value||'';
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
  var projId=PROJ_MOD_SEL_ID||(document.getElementById('exec-proj-sel')||{}).value||'';
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
function generateCombinedDoc(allots,title,col,tbg){
  var proj=PROJ_DATA.find(function(p){return p.id===allots[0].project_id;})||{};
  // Fallback: get project name from global selector if PROJ_DATA lookup fails
  if(!proj.name){
    var projSel=document.getElementById('proj-mod-sel');
    if(projSel&&projSel.selectedIndex>=0) proj={name:projSel.options[projSel.selectedIndex].text};
  }
  var co=COMPANY_DATA||{};var inr=function(n){return "\u20b9"+Number(n||0).toLocaleString("en-IN");};var fmtD=function(d){if(!d)return "";var p=d.split("-");return p.length===3?p[2]+"/"+p[1]+"/"+p[0]:d;};var tot=allots.reduce(function(s,a){return s+Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));},0);var dn=(title==="WORK ORDER"?"WO":"PO")+"-"+new Date().getFullYear()+"-"+String(Date.now()).slice(-4);var rows=allots.map(function(a,i){var amt=Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));return "<tr><td>"+(i+1)+"</td><td>"+a.party_name+(a.scope?"<br><small>"+a.scope+"</small>":"")+"</td><td>"+(a.qty||0)+" "+(a.unit||"")+"</td><td>"+inr(a.rate)+"</td><td>"+inr(amt)+"</td></tr>";}).join("");var html="<!DOCTYPE html><html><head><meta charset=UTF-8><title>"+title+"</title><style>body{font-family:Arial,sans-serif;margin:0;padding:20px;font-size:12px;}.hdr{display:flex;justify-content:space-between;border-bottom:3px solid "+col+";padding-bottom:10px;margin-bottom:12px;}.cn{font-size:17px;font-weight:900;color:"+col+";}table{width:100%;border-collapse:collapse;margin:10px 0;}th{background:"+col+";color:white;padding:7px 10px;text-align:left;font-size:11px;}td{padding:7px 10px;border-bottom:1px solid #EEE;}.tr td{font-weight:900;background:"+tbg+";}.ft{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:30px;}.sg{border-top:1.5px solid #333;padding-top:6px;font-size:11px;color:#666;margin-top:40px;}@media print{button{display:none;}}</style></head><body><button onclick=\"window.print()\" style=\"background:"+col+";color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;margin-bottom:16px;\">Print/Save PDF</button><div class=hdr><div><div class=cn>"+(co.name||"Company")+"</div><div style=\"font-size:10px;color:#666\">"+(co.address||"")+"</div><div style=\"font-size:10px;color:#666\">"+(co.gstin?"GSTIN: "+co.gstin:"")+"</div></div><div style=\"text-align:right\"><div style=\"font-size:19px;font-weight:900;\">"+title+"</div><div style=\"color:#666\">"+dn+"</div><div style=\"color:#666\">Date: "+fmtD(new Date().toISOString().slice(0,10))+"</div><div style=\"color:#666\">Project: "+(proj.name||"")+"</div></div></div><table><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>"+rows+"<tr class=tr><td colspan=4 style=\"text-align:right\">Total</td><td>"+inr(tot)+"</td></tr></table><div class=ft><div><div class=sg>Issued By<br><br>"+(co.name||"")+"</div></div><div><div class=sg>Authorized Signatory</div></div></div></body></html>";openPDF(html);}

function generateWorkOrder(allot){
  var allots=Array.isArray(allot)?allot:[allot];
  allot=allots[0];
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
      allots.map(function(a){
        var rowAmt=Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));
        return '<tr><td>'+(a.scope||a.party_name||'Work')+'</td>'+
          '<td>'+(a.qty||0)+'</td><td>'+(a.unit||'')+'</td>'+
          '<td>'+inr(a.rate)+'</td><td>'+inr(rowAmt)+'</td></tr>';
      }).join('')+
      (allots.length>1?'<tr class="total-row"><td colspan="4" style="text-align:right;">Total Amount</td><td>'+inr(allots.reduce(function(s,a){return s+Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));},0))+'</td></tr>':'<tr class="total-row"><td colspan="4" style="text-align:right;">Total Amount</td><td>'+inr(amt)+'</td></tr>')+
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
  openPDF(html);
}

function generatePurchaseOrder(allot){
  var allots=Array.isArray(allot)?allot:[allot];
  allot=allots[0];
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
      allots.map(function(a){
        var rowAmt=Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));
        return '<tr><td>'+(a.scope||a.party_name||'Material')+'</td>'+
          '<td>'+(a.qty||0)+'</td><td>'+(a.unit||'')+'</td>'+
          '<td>'+inr(a.rate)+'</td><td>'+inr(rowAmt)+'</td></tr>';
      }).join('')+
      (allots.length>1?'<tr class="total-row"><td colspan="4" style="text-align:right;">Total Amount</td><td>'+inr(allots.reduce(function(s,a){return s+Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));},0))+'</td></tr>':'<tr class="total-row"><td colspan="4" style="text-align:right;">Total Amount</td><td>'+inr(amt)+'</td></tr>')+
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
  openPDF(html);
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
  var fmtD=function(d){if(!d)return '';var p=String(d).split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d;};

  // Group by doc_type + doc_number (one card per unique order number)
  var byNum={wo:{},po:{}};
  WA_ORDERS.forEach(function(o){
    var type=o.doc_type==='wo'?'wo':'po';
    var num=o.doc_number||'?';
    if(!byNum[type][num]) byNum[type][num]={num:num,party_name:o.party_name,party_type:o.party_type,doc_date:o.doc_date,items:[],totalAmt:0};
    byNum[type][num].items.push(o);
    byNum[type][num].totalAmt+=parseFloat(o.amount)||0;
  });

  var renderGroup=function(numMap, label, col, docPrefix){
    var keys=Object.keys(numMap).sort(function(a,b){return a.localeCompare(b,undefined,{numeric:true});});
    if(!keys.length) return '';
    return '<div style="margin-bottom:16px;">'+
      '<div style="font-size:11px;font-weight:800;color:'+col+';padding:6px 0;margin-bottom:6px;border-bottom:2px solid '+col+'20;">'+label+' ('+keys.length+')</div>'+
      keys.map(function(num){
        var g=numMap[num];
        var docNo=docPrefix+'-'+num;
        var collapseId='ord-'+docPrefix+'-'+num.replace(/[^a-z0-9]/gi,'-');
        return '<div style="background:white;border-radius:12px;border:1px solid var(--border);margin-bottom:8px;overflow:hidden;">'+
          // Header — clickable to expand
          '<div style="padding:12px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;" '+
            'onclick="var b=document.getElementById(\''+collapseId+'\');if(b){var open=b.style.display!==\'none\';b.style.display=open?\'none\':\'block\';this.querySelector(\'.ord-arrow\').textContent=open?\'\u25b6\':\'\u25bc\';}"'+
          '>'+
            '<div style="width:42px;height:42px;border-radius:10px;background:'+col+'15;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">&#128196;</div>'+
            '<div style="flex:1;min-width:0;">'+
              '<div style="display:flex;align-items:center;gap:6px;">'+
                '<span class="ord-arrow" style="color:'+col+';font-size:11px;">&#9654;</span>'+
                '<span style="font-size:13px;font-weight:800;">'+docNo+'</span>'+
                '<span style="font-size:10px;background:'+col+'15;color:'+col+';padding:1px 6px;border-radius:4px;font-weight:700;">'+g.items.length+' item'+(g.items.length>1?'s':'')+'</span>'+
              '</div>'+
              '<div style="font-size:11px;font-weight:700;color:var(--navy);margin-top:2px;">'+g.party_name+'</div>'+
              '<div style="font-size:10px;color:var(--text3);">'+(tLbl[g.party_type]||g.party_type)+' &bull; '+fmtD(g.doc_date)+'</div>'+
            '</div>'+
            '<div style="text-align:right;flex-shrink:0;">'+
              '<div style="font-size:15px;font-weight:900;color:'+col+';">&#8377;'+Math.round(g.totalAmt).toLocaleString('en-IN')+'</div>'+
              '<button onclick="event.stopPropagation();execPrintOrderCombined(\''+docPrefix.toLowerCase()+'\',\''+num+'\')" style="background:'+col+';color:white;border:none;border-radius:6px;padding:3px 12px;font-size:10px;font-weight:800;cursor:pointer;margin-top:5px;">&#128438; Print All</button>'+
            '</div>'+
          '</div>'+
          // Collapsed items list
          '<div id="'+collapseId+'" style="display:none;border-top:1px solid var(--border);">'+
            '<table style="width:100%;border-collapse:collapse;font-size:10px;">'+
              '<thead><tr style="background:#F8FAFC;">'+
                '<th style="padding:6px 10px;text-align:left;color:var(--text3);">RESOURCE / ITEM</th>'+
                '<th style="padding:6px 10px;text-align:right;color:var(--text3);">QTY</th>'+
                '<th style="padding:6px 10px;text-align:right;color:var(--text3);">UNIT</th>'+
                '<th style="padding:6px 10px;text-align:right;color:var(--text3);">RATE</th>'+
                '<th style="padding:6px 10px;text-align:right;color:var(--text3);">AMOUNT</th>'+
                '<th style="padding:6px 10px;"></th>'+
              '</tr></thead>'+
              '<tbody>'+
              g.items.map(function(o){
                var allot=WA_ALLOT.find(function(a){return a.id===o.allot_id;})||{};
                var resName=allot.scope||o.resource_name||o.party_name||'';
                return '<tr style="border-bottom:1px solid #F0F0F0;">'+
                  '<td style="padding:6px 10px;font-weight:700;">'+resName+'</td>'+
                  '<td style="padding:6px 10px;text-align:right;">'+(o.qty||0)+'</td>'+
                  '<td style="padding:6px 10px;text-align:right;color:var(--text3);">'+(o.unit||'')+'</td>'+
                  '<td style="padding:6px 10px;text-align:right;">&#8377;'+(o.rate||0)+'</td>'+
                  '<td style="padding:6px 10px;text-align:right;font-weight:800;color:'+col+';">&#8377;'+Math.round(o.amount||0).toLocaleString('en-IN')+'</td>'+
                  '<td style="padding:6px 10px;text-align:right;">'+
                    '<button onclick="event.stopPropagation();execDeleteOrder(\''+o.id+'\')" style="background:#FEE2E2;color:#C62828;border:none;border-radius:5px;padding:2px 6px;font-size:9px;font-weight:800;cursor:pointer;">&#215;</button>'+
                  '</td>'+
                '</tr>';
              }).join('')+
              '<tr style="background:#F8FAFC;font-weight:900;">'+
                '<td colspan="4" style="padding:6px 10px;font-size:11px;">Total</td>'+
                '<td style="padding:6px 10px;text-align:right;font-size:12px;color:'+col+';">&#8377;'+Math.round(g.totalAmt).toLocaleString('en-IN')+'</td>'+
                '<td></td>'+
              '</tr>'+
              '</tbody>'+
            '</table>'+
          '</div>'+
        '</div>';
      }).join('')+
    '</div>';
  };

  el.innerHTML='<div style="padding:8px;">'+
    renderGroup(byNum.wo,'Work Orders','#E65100','WO')+
    renderGroup(byNum.po,'Purchase Orders','#1565C0','PO')+
  '</div>';
}

function execPrintOrder(orderId){
  var o=WA_ORDERS.find(function(x){return x.id===orderId;});
  if(!o){toast('Order not found','warning');return;}
  var allot=WA_ALLOT.find(function(a){return a.id===o.allot_id;})||{};
  var merged=Object.assign({},allot,{qty:o.qty,rate:o.rate,unit:o.unit,party_name:o.party_name,exec_type:o.party_type,project_id:o.project_id,scope:allot.scope||''});
  if(o.doc_type==='wo') generateWorkOrder(merged);
  else generatePurchaseOrder(merged);
}

function execPrintOrderCombined(docType, docNum){
  var orders=WA_ORDERS.filter(function(o){return o.doc_type===docType&&(o.doc_number||'?')===String(docNum);});
  if(!orders.length){toast('No orders found','warning');return;}
  var allots=orders.map(function(o){
    var allot=WA_ALLOT.find(function(a){return a.id===o.allot_id;})||{};
    return Object.assign({},allot,{qty:o.qty,rate:o.rate,unit:o.unit,party_name:o.party_name,exec_type:o.party_type,project_id:o.project_id,scope:allot.scope||''});
  });
  if(docType==='wo') generateWorkOrder(allots);
  else generatePurchaseOrder(allots);
}
