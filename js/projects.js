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
  // Load projects data
  if(!PROJ_DATA.length){
    sbFetch('projects',{select:'*',order:'name.asc'})
      .then(function(rows){
        PROJ_DATA = Array.isArray(rows) ? rows : [];
        projModLoadProjects();
        projModRenderNav();
        projModLoadTab();
      }).catch(function(){ projModRenderNav(); projModLoadTab(); });
  } else {
    projModLoadProjects();
    projModRenderNav();
    projModLoadTab();
  }
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
  // Existing files (from edit)
  PF_FILES.forEach(function(f){
    if(f.url) attachments.push({name:f.name,url:f.url}); // already stored
  });
  // New files — encode as base64 data URLs
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

  var data = {
    name:name,
    code:(document.getElementById('pf-code')||{value:''}).value.trim()||null,
    client:(document.getElementById('pf-client')||{value:''}).value.trim()||null,
    status:(document.getElementById('pf-status')||{value:'active'}).value||'active',
    location:(document.getElementById('pf-location')||{value:''}).value.trim()||null,
    project_length:parseFloat((document.getElementById('pf-length')||{value:''}).value)||null,
    coordinates:PF_COORDS.length?JSON.stringify(PF_COORDS):null,
    tender_cost:parseFloat((document.getElementById('pf-tender')||{value:''}).value)||null,
    tender_pct:parseFloat((document.getElementById('pf-pct')||{value:'0'}).value)||0,
    contract_value:parseFloat((document.getElementById('pf-contract')||{value:''}).value)||null,
    loa_date:(document.getElementById('pf-loa')||{value:''}).value||null,
    wo_date:(document.getElementById('pf-wo-date')||{value:''}).value||null,
    completion_date:(document.getElementById('pf-completion')||{value:''}).value||null,
    description:(document.getElementById('pf-desc')||{value:''}).value.trim()||null,
    attachments:attachments.length?JSON.stringify(attachments):null
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
async function execLoadItems(){
  var projId=PROJ_MOD_SEL_ID||(document.getElementById('exec-proj-sel')||{}).value||'';
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
  var co=COMPANY_DATA||{};var inr=function(n){return "\u20b9"+Number(n||0).toLocaleString("en-IN");};var fmtD=function(d){if(!d)return "";var p=d.split("-");return p.length===3?p[2]+"/"+p[1]+"/"+p[0]:d;};var tot=allots.reduce(function(s,a){return s+Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));},0);var dn=(title==="WORK ORDER"?"WO":"PO")+"-"+new Date().getFullYear()+"-"+String(Date.now()).slice(-4);var rows=allots.map(function(a,i){var amt=Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));return "<tr><td>"+(i+1)+"</td><td>"+a.party_name+(a.scope?"<br><small>"+a.scope+"</small>":"")+"</td><td>"+(a.qty||0)+" "+(a.unit||"")+"</td><td>"+inr(a.rate)+"</td><td>"+inr(amt)+"</td></tr>";}).join("");var html="<!DOCTYPE html><html><head><meta charset=UTF-8><title>"+title+"</title><style>body{font-family:Arial,sans-serif;margin:0;padding:20px;font-size:12px;}.hdr{display:flex;justify-content:space-between;border-bottom:3px solid "+col+";padding-bottom:10px;margin-bottom:12px;}.cn{font-size:17px;font-weight:900;color:"+col+";}table{width:100%;border-collapse:collapse;margin:10px 0;}th{background:"+col+";color:white;padding:7px 10px;text-align:left;font-size:11px;}td{padding:7px 10px;border-bottom:1px solid #EEE;}.tr td{font-weight:900;background:"+tbg+";}.ft{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:30px;}.sg{border-top:1.5px solid #333;padding-top:6px;font-size:11px;color:#666;margin-top:40px;}@media print{button{display:none;}}</style></head><body><button onclick=\"window.print()\" style=\"background:"+col+";color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;margin-bottom:16px;\">Print/Save PDF</button><div class=hdr><div><div class=cn>"+(co.name||"Company")+"</div><div style=\"font-size:10px;color:#666\">"+(co.address||"")+"</div><div style=\"font-size:10px;color:#666\">"+(co.gstin?"GSTIN: "+co.gstin:"")+"</div></div><div style=\"text-align:right\"><div style=\"font-size:19px;font-weight:900;\">"+title+"</div><div style=\"color:#666\">"+dn+"</div><div style=\"color:#666\">Date: "+fmtD(new Date().toISOString().slice(0,10))+"</div><div style=\"color:#666\">Project: "+(proj.name||"")+"</div></div></div><table><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>"+rows+"<tr class=tr><td colspan=4 style=\"text-align:right\">Total</td><td>"+inr(tot)+"</td></tr></table><div class=ft><div><div class=sg>Issued By<br><br>"+(co.name||"")+"</div></div><div><div class=sg>Authorized Signatory</div></div></div></body></html>";var w=window.open("","_blank");if(w){w.document.write(html);w.document.close();}else toast("Allow popups","warning");}

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

    // Batch header — show resource names as primary, vendor as secondary
    var firstType = items[0].exec_type||'';
    var col = tCol[firstType]||'#37474F';
    var resNames = items.map(function(a){
      var pl=WA_PLANNED.find(function(p){return p.id===a.boq_exec_resource_id;})||{};
      return pl.party_name||pl.resource_category||'';
    }).filter(function(v,i,arr){return v&&arr.indexOf(v)===i;});
    var partyNames = items.map(function(a){return a.party_name;}).filter(function(v,i,arr){return arr.indexOf(v)===i;});
    var headerLabel = resNames.length ? resNames.join(', ') : (partyNames[0]||'');
    var headerVendor = partyNames.join(', ');

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
            (planRes.party_name||planRes.resource_category?'<span style="font-size:12px;font-weight:800;color:#1B5E20;">'+( planRes.party_name||planRes.resource_category)+'</span>':'')+
            '<span style="font-size:11px;font-weight:600;color:#555;margin-left:3px;">&#8594; '+a.party_name+'</span>'+
          '</div>'+
          (boqItem.item_code?'<div style="font-size:9px;color:var(--text3);">BOQ: '+boqItem.item_code+' '+(boqItem.short_name||boqItem.description||'')+'</div>':'')+
          '<div style="font-size:10px;color:var(--text3);">'+a.qty+' '+(a.unit||'')+(a.rate?' @ '+inr(a.rate):'')+(a.scope?' | '+a.scope:'')+'</div>'+
        '</div>'+
        '<div style="text-align:right;flex-shrink:0;">'+
          '<div style="font-size:12px;font-weight:800;">'+inr((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0))+'</div>'+
          (itemOrders.length?'<div style="font-size:9px;color:#2E7D32;font-weight:700;">&#10003; Doc issued</div>':'<div style="font-size:9px;color:var(--text3);">Pending</div>')+
          (function(){var advs=WA_ADVANCES.filter(function(x){return x.allot_id===a.id;});if(!advs.length)return '';var tot=advs.reduce(function(s,x){return s+(parseFloat(x.amount)||0);},0);return '<div style="font-size:9px;color:#F57F17;font-weight:700;">&#128181; Advance: ₹'+tot.toLocaleString('en-IN')+'</div>';})()+
        '</div>'+
        '<button onclick="execOpenAdvanceAllot(\''+a.id+'\')" title="Advance Payment" style="background:#F57F17;color:white;border:none;border-radius:5px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer;flex-shrink:0;">&#128181; Advance</button>'+
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

    // Advances for this batch
    var batchAdvances=WA_ADVANCES.filter(function(adv){
      return items.some(function(a){return a.id===adv.allot_id;});
    });
    var totalBatchAdv=batchAdvances.reduce(function(s,adv){return s+(parseFloat(adv.amount)||0);},0);
    var inrFmt=function(n){return '\u20b9'+Math.round(Number(n||0)).toLocaleString('en-IN');};

    var advRow=batchAdvances.length?
      '<div style="padding:8px 14px;background:#FFF8E1;border-top:1px solid #FFE0B2;">'+
        '<div style="font-size:9px;font-weight:800;color:#F57F17;margin-bottom:4px;">ADVANCES PAID</div>'+
        batchAdvances.map(function(adv){
          return '<div style="display:flex;align-items:center;gap:6px;font-size:10px;padding:3px 0;border-bottom:1px solid #FFF3E0;">'+
            '<span style="color:var(--text3);">'+adv.date+'</span>'+
            '<span style="flex:1;font-weight:700;">'+inrFmt(adv.amount)+'</span>'+
            '<span style="color:var(--text3);">'+(adv.payment_mode||'')+(adv.reference?' · '+adv.reference:'')+'</span>'+
            '<span style="color:#555;font-size:9px;">'+( adv.purpose||'')+'</span>'+
            '<button onclick="execAdvanceReceipt(\''+adv.id+'\',\'\',0)" style="background:#F57F17;color:white;border:none;border-radius:4px;padding:2px 6px;font-size:9px;cursor:pointer;font-weight:700;">PDF</button>'+
            '<button onclick="execDelAdvance(\''+adv.id+'\')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:13px;">&#215;</button>'+
          '</div>';
        }).join('')+
        '<div style="display:flex;justify-content:flex-end;font-size:10px;font-weight:800;color:#F57F17;padding-top:4px;">Total Advance: '+inrFmt(totalBatchAdv)+'</div>'+
      '</div>':'';

    return '<div style="background:white;border-radius:14px;border:1px solid var(--border);margin-bottom:12px;overflow:hidden;">'+
      '<div style="padding:10px 14px;background:'+col+'10;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">'+
        '<div style="flex:1;">'+
          '<div style="font-size:13px;font-weight:800;">'+headerLabel+'</div>'+
          '<div style="font-size:10px;color:var(--text3);">Vendor: <b>'+headerVendor+'</b> | '+items.length+' resource'+(items.length>1?'s':'')+' | Allotted: '+(batchDate?batchDate.slice(0,10):'')+'</div>'+
        '</div>'+
        '<div style="font-size:13px;font-weight:800;color:'+col+';">'+inr(totalAmt)+'</div>'+
      '</div>'+
      itemRows+
      orderRow+
      advRow+
      downloadRow+
    '</div>';
  }).join('');
}

async function execGenPartyDoc(partyKey, docType){
  var tLbl={vendor:'Vendor',sc:'SC',labour_contractor:'Labour Contr.',labour:'Labour',machinery:'Machinery'};
  var parts=partyKey.split('::');
  var partyType=parts[0], partyName=parts.slice(1).join('::');
  var projId=PROJ_MOD_SEL_ID||(document.getElementById('exec-proj-sel')||{}).value||'';
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
  var projId=PROJ_MOD_SEL_ID||(document.getElementById('exec-proj-sel')||{}).value||'';
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
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);"><div style="font-size:32px;">&#128197;</div><div style="font-weight:700;margin-top:8px;">No BOQ items found</div><div style="font-size:11px;margin-top:6px;">Add BOQ items first, then come back to record daily progress</div></div>';
    return;
  }

  // Render date picker + New Entry button at top
  el.innerHTML=
    '<div style="background:white;border-radius:12px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'+
      '<div style="font-size:12px;font-weight:800;color:#1565C0;">&#128197;</div>'+
      '<input id="dp-view-date" type="date" value="'+WA_DAILY_DATE+'" '+
        'style="border:1.5px solid #1565C0;border-radius:8px;padding:6px 10px;font-size:13px;font-weight:700;font-family:Nunito,sans-serif;color:#1565C0;outline:none;cursor:pointer;" '+
        'onchange="execDailyDateChange()">'+
      '<button onclick="WA_DAILY_DATE=new Date().toISOString().slice(0,10);document.getElementById(\'dp-view-date\').value=WA_DAILY_DATE;execRenderDailyContent();" '+
        'style="font-size:10px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:#F8FAFC;cursor:pointer;font-weight:700;">Today</button>'+
      '<div style="flex:1;"></div>'+
      '<button onclick="execOpenDailyEntryPicker()" style="background:#E65100;color:white;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:800;cursor:pointer;">+ New Entry</button>'+
    '</div>'+
    '<div id="dp-daily-content"></div>';

  execRenderDailyContent();
}

// Show BOQ item picker then open entry form
function execOpenDailyEntryPicker(){
  if(!WA_ITEMS.length){toast('No BOQ items found','warning');return;}
  var opts=WA_ITEMS.map(function(item){
    return '<option value="'+item.id+'">['+item.item_code+'] '+(item.short_name||item.description)+'</option>';
  }).join('');
  document.getElementById('exec-sheet-title').textContent='Select BOQ Item';
  document.getElementById('exec-sheet-body').innerHTML=
    '<label class="flbl">BOQ Item *</label>'+
    '<select id="dp-item-pick" class="fsel" style="margin-bottom:0;">'+
      '<option value="">— Select Item —</option>'+opts+
    '</select>';
  var sf=document.getElementById('exec-sheet-foot');sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#E65100;color:white;';
  sb.innerHTML='Next &#8594;';
  sb.onclick=function(){
    var itemId=document.getElementById('dp-item-pick').value;
    if(!itemId){toast('Select a BOQ item','warning');return;}
    closeSheet('ov-exec','sh-exec');
    setTimeout(function(){execOpenDailyEntry(itemId);},200);
  };
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-exec','sh-exec');
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

  // ── 2. RESOURCE UTILISATION TABLE — grouped by resource name+vendor+unit ───
  // Build cumulative used qty per allot_id from daily entries
  var usedByAllot={};
  cumulEntries.forEach(function(d){
    var resources=[];try{resources=d.resources_used?JSON.parse(d.resources_used):[];}catch(ex){}
    resources.forEach(function(r){
      if(!r.allot_id||!r.qty) return;
      usedByAllot[r.allot_id]=(usedByAllot[r.allot_id]||0)+(parseFloat(r.qty)||0);
    });
  });

  // Group allotments by resName+partyName+unit so same resource shows once
  var resGroups={};
  var resGroupOrder=[];
  WA_ALLOT.forEach(function(a){
    var planRes=WA_PLANNED.find(function(r){return r.id===a.boq_exec_resource_id;})||{};
    var resName=planRes.party_name||planRes.resource_category||'';
    var key=(resName||a.party_name)+'__'+(a.unit||'')+'__'+a.exec_type;
    if(!resGroups[key]){
      resGroups[key]={resName:resName,partyName:a.party_name,unit:a.unit||'',execType:a.exec_type,allotQty:0,usedQty:0};
      resGroupOrder.push(key);
    }
    resGroups[key].allotQty+=(parseFloat(a.qty)||0);
    resGroups[key].usedQty +=(usedByAllot[a.id]||0);
  });

  var resRows=resGroupOrder.map(function(key){
    var g=resGroups[key];
    var allotQty=g.allotQty, usedQty=g.usedQty;
    var pct=allotQty>0?Math.round(usedQty/allotQty*100):0;
    var col=tCol[g.execType]||'#555';
    var bal=Math.max(0,allotQty-usedQty);
    var overused=usedQty>allotQty;
    var td2='padding:7px 10px;font-size:11px;text-align:right;white-space:nowrap;';
    return '<tr style="border-bottom:1px solid #F0F0F0;">'+
      '<td style="padding:7px 10px;">'+
        '<span style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:4px;background:'+col+'15;color:'+col+';">'+( tLbl[g.execType]||g.execType)+'</span>'+
      '</td>'+
      '<td style="padding:7px 10px;font-size:11px;">'+
        (g.resName?'<div style="font-weight:800;color:#1B5E20;">'+g.resName+'</div>':'')+
        '<div style="font-weight:700;color:#333;'+(g.resName?'font-size:10px;':'font-size:11px;font-weight:800;')+'">'+g.partyName+'</div>'+
      '</td>'+
      '<td style="'+td2+'">'+fmt(allotQty)+' <span style="font-size:9px;color:var(--text3);">'+g.unit+'</span></td>'+
      '<td style="'+td2+';color:'+(overused?'#C62828':col)+';font-weight:800;">'+fmt(usedQty)+' <span style="font-size:9px;font-weight:400;color:var(--text3);">'+g.unit+'</span><span style="font-size:9px;color:'+(overused?'#C62828':col)+';"> ('+pct+'%)</span></td>'+
      '<td style="'+td2+';font-weight:800;color:'+(overused?'#C62828':bal<0.01?'#2E7D32':'#555')+';">'+
        (overused?'+'+fmt(usedQty-allotQty)+' over':fmt(bal))+' <span style="font-size:9px;font-weight:400;color:var(--text3);">'+g.unit+'</span>'+
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
          '<button onclick="execEditDailyEntry(\''+d.id+'\',\''+item.id+'\')" style="background:#E3F2FD;border:none;color:#1565C0;border-radius:5px;padding:2px 7px;font-size:11px;font-weight:800;cursor:pointer;flex-shrink:0;">&#9998;</button>'+
          '<button onclick="execDelDaily(\''+d.id+'\')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:14px;flex-shrink:0;">&#215;</button>'+
        '</div>'+
        (resources.length?
          '<div style="display:flex;flex-wrap:wrap;gap:4px;">'+
            resources.map(function(r){
                var col=tCol[r.type]||'#555';
                // Show planned resource name if available
                var allot=WA_ALLOT.find(function(a){return a.id===r.allot_id;})||{};
                var planRes=WA_PLANNED.find(function(p){return p.id===allot.boq_exec_resource_id;})||{};
                var resLabel=planRes.party_name||planRes.resource_category||'';
                var label=(resLabel?resLabel+' &#8594; ':'')+r.name;
                return '<span style="font-size:9px;background:'+col+'15;color:'+col+';border:1px solid '+col+'30;border-radius:4px;padding:2px 6px;font-weight:700;">'+
                  (tLbl[r.type]||r.type)+': '+label+(r.qty?' \u00d7 '+fmt(r.qty)+(r.unit?' '+r.unit:''):'')+
                '</span>';
              }).join('')+
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
  var projId=PROJ_MOD_SEL_ID||(document.getElementById('exec-proj-sel')||{}).value||'';
  var item=WA_ITEMS.find(function(i){return i.id===itemId;})||{};

  // Get allotted resources for this item (via boq_item_id or sub-item)
  var itemSubIds=WA_SUBS.filter(function(s){return s.boq_item_id===itemId;}).map(function(s){return s.id;});
  var itemAllots=WA_ALLOT.filter(function(a){
    return a.boq_item_id===itemId||(a.boq_subitem_id&&itemSubIds.includes(a.boq_subitem_id));
  });

  var tLbl={vendor:'Vendor',sc:'SC',labour_contractor:'Labour Contr.',labour:'Labour',machinery:'Machinery'};
  var tCol={vendor:'#1565C0',sc:'#6A1B9A',labour_contractor:'#2E7D32',labour:'#37474F',machinery:'#E65100'};

  // Build resource name — from planned resource (what material it IS)
  function getResName(a){
    var pl=WA_PLANNED.find(function(p){return p.id===a.boq_exec_resource_id;})||{};
    return pl.party_name||pl.resource_category||a.scope||'';
  }
  // For store material: only ISSUED qty is available for daily progress use
  // Find issue log entries for this item (by allot_id or item_name)
  function getIssuedQty(a, rn){
    // Find the store item for this allotment
    var si=STORE_ITEMS.find(function(s){return s.allot_id===a.id;})||
           (rn?STORE_ITEMS.find(function(s){return s.item_name===rn&&s.project_id===projId;}):null);
    var siId=si?si.id:null;
    // Sum issue log by store_id OR allot_id OR item_name
    return STORE_ISSUE_LOG.filter(function(log){
      return (siId&&log.store_id===siId) ||
             (a.id&&log.allot_id===a.id) ||
             (rn&&log.item_name===rn&&log.project_id===projId);
    }).reduce(function(s,log){return s+(parseFloat(log.qty_issued)||0);},0);
  }

  function findStoreItem(a, rn){
    return STORE_ITEMS.find(function(s){return s.allot_id===a.id;})||
           (rn?STORE_ITEMS.find(function(s){return s.project_id===projId&&s.item_name===rn;}):null)||null;
  }

  // Split allotments
  var inStoreAllots=[], outStoreAllots=[];
  var seenStoreIds={};
  itemAllots.forEach(function(a){
    var rn=getResName(a);
    var storeItem=findStoreItem(a, rn);
    var inHand=storeItem?(parseFloat(storeItem.qty_in_hand)||0):0;
    var issuedQty=storeItem?getIssuedQty(a, rn):0;
    var allotQty=parseFloat(a.qty)||0;

    if(storeItem && inHand>0 && !seenStoreIds[storeItem.id]){
      seenStoreIds[storeItem.id]=true;
      // Show in store section — only issued qty can be used
      inStoreAllots.push({allot:a, storeItem:storeItem, resName:rn||storeItem.item_name, issuedQty:issuedQty, inHand:inHand});
    }
    // Outside-store: qty allotted but not yet in store
    var outsideQty=Math.max(0, allotQty-inHand-(storeItem?0:0));
    // If no store item at all, full allotted qty is outside
    if(!storeItem) outsideQty=allotQty;
    if(outsideQty>0){
      outStoreAllots.push({allot:a, resName:rn, outsideQty:outsideQty});
    }
  });

  function makeResRow(a, col, rn, storeItem, fromStore, outsideQty, issuedQty){
    var inHand=storeItem?parseFloat(storeItem.qty_in_hand)||0:null;
    issuedQty=issuedQty||0;
    // For store material: max = issued qty (must be issued first to use)
    // For outside-store: max = outsideQty (allotted balance)
    var maxQty=fromStore?(issuedQty>0?issuedQty:0):(outsideQty||null);
    return '<div class="dp-res-row" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1.5px solid '+(fromStore?'#C8E6C9':'#FFE0B2')+';border-radius:8px;margin-bottom:6px;background:'+(fromStore?'#F1FBF4':'#FFF8F5')+';">'+
      '<input type="checkbox" class="dp-res-chk" '+
        'data-allot-id="'+a.id+'" data-name="'+a.party_name+'" data-type="'+a.exec_type+'" data-unit="'+(a.unit||'')+'" '+
        (fromStore?'data-from-store="1" ':'')+
        (fromStore&&issuedQty<=0?'disabled title="Issue from Store tab first" ':'')+
        'style="width:15px;height:15px;accent-color:'+(fromStore?'#2E7D32':col)+';flex-shrink:0;'+(fromStore&&issuedQty<=0?'opacity:0.4;cursor:not-allowed;':'')+'">'+
      '<div style="flex:1;min-width:0;">'+
        (fromStore
          ?'<span style="font-size:9px;font-weight:800;background:#C8E6C9;color:#1B5E20;padding:1px 6px;border-radius:3px;margin-right:4px;">&#127981; Store</span>'
          :'<span style="font-size:9px;font-weight:800;background:#FFE0B2;color:#E65100;padding:1px 6px;border-radius:3px;margin-right:4px;">&#128666; Direct</span>')+
        (rn?'<span style="font-size:11px;font-weight:800;color:#1B5E20;margin-right:3px;">'+rn+'</span><span style="font-size:10px;color:#888;">&#8594;</span>':'')+
        ' <span style="font-size:11px;font-weight:700;color:#333;">'+a.party_name+'</span>'+
        (fromStore?
          '<div style="font-size:9px;font-weight:700;margin-top:2px;">'+
          '<span style="color:#2E7D32;">In Store: '+(inHand!==null?parseFloat(inHand).toFixed(2):'?')+' '+(a.unit||'')+'</span>'+
          (issuedQty>0?'<span style="color:#1565C0;margin-left:6px;">&#10003; Issued: '+parseFloat(issuedQty).toFixed(2)+'</span>':
            '<span style="color:#E65100;margin-left:6px;">&#9888; Not issued — issue from Store tab first</span>')+
          '</div>':
          (outsideQty?'<span style="font-size:9px;color:#E65100;font-weight:700;">Not in store — Allotted: '+a.qty+' | Outside: '+outsideQty.toFixed(2)+' '+(a.unit||'')+'</span>':''))+
        '</div>'+
        (a.scope?'<div style="font-size:9px;color:var(--text3);margin-top:1px;">'+a.scope+'</div>':'')+
      '</div>'+
      '<div class="dp-res-qty-wrap" style="display:flex;align-items:center;gap:4px;">'+
        '<div><div style="font-size:9px;color:#E65100;font-weight:700;margin-bottom:2px;">Qty Used *</div>'+
          '<input class="dp-res-qty finp" data-allot-id="'+a.id+'" type="number" step="0.001" '+
            (maxQty?'max="'+maxQty+'" placeholder="max '+maxQty+'"':'placeholder="qty"')+
            ' style="width:80px;padding:4px 6px;font-size:12px;text-align:center;'+(fromStore&&maxQty<=0?'background:#F5F5F5;color:#CCC;':'')+'"'+
            (fromStore&&maxQty<=0?' disabled':'')+'>'+
        '</div>'+
        '<div style="font-size:11px;font-weight:700;color:var(--text3);padding-top:16px;">'+(a.unit||'')+'</div>'+
      '</div>'+
    '</div>';
  }

  var inStoreRows = inStoreAllots.map(function(x){
    var col=tCol[x.allot.exec_type]||'#37474F';
    return makeResRow(x.allot, col, x.resName, x.storeItem, true, 0, x.issuedQty);
  }).join('');

  var outStoreRows = outStoreAllots.map(function(x){
    var col=tCol[x.allot.exec_type]||'#37474F';
    return makeResRow(x.allot, col, x.resName, null, false, x.outsideQty);
  }).join('');

  var resourceRows = itemAllots.length
    ? (inStoreRows
        ? '<div style="font-size:10px;font-weight:800;color:#1B5E20;margin-bottom:6px;">&#127981; From Store</div>'+inStoreRows
        : '<div style="font-size:10px;color:var(--text3);margin-bottom:6px;font-style:italic;">No matching store items for this BOQ item</div>')+
      (outStoreRows
        ? '<div style="margin-top:10px;">'+
            '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:6px;">'+
              '<input type="checkbox" id="dp-show-outside" onchange="document.getElementById(\'dp-outside-rows\').style.display=this.checked?\'block\':\'none\'" style="width:14px;height:14px;accent-color:#E65100;">'+
              '<span style="font-size:10px;font-weight:800;color:#E65100;">&#128666; Use resources outside store / direct use ('+outStoreAllots.length+')</span>'+
            '</label>'+
            '<div id="dp-outside-rows" style="display:none;">'+outStoreRows+'</div>'+
          '</div>'
        : '')
    : '<div style="font-size:11px;color:var(--text3);padding:8px 0;font-style:italic;">No resources allotted for this item yet.</div>';

  document.getElementById('exec-sheet-title').textContent='Daily Progress — '+(item.item_code?item.item_code+' ':'')+(item.short_name||item.description||'');
  document.getElementById('exec-sheet-body').innerHTML=
    '<div style="background:#FFF3E0;border-radius:10px;padding:12px;margin-bottom:12px;">'+
      '<div style="font-size:11px;font-weight:800;color:#E65100;margin-bottom:10px;">&#9312; Quantity Completed</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">'+
        '<div><label class="flbl">Date *</label><input id="dp-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
        '<div><label class="flbl">Qty Completed *</label>'+
        (function(){
          var jmQ=WA_JMS.filter(function(j){return j.boq_item_id===itemId;}).reduce(function(s,j){return s+(parseFloat(j.jm_qty)||0);},0);
          var boqQ=parseFloat(item.boq_qty||item.qty)||0;
          var limQ=jmQ||boqQ;
          var doneQ=WA_DAILY.filter(function(d){return d.boq_item_id===itemId;}).reduce(function(s,d){return s+(parseFloat(d.qty_done)||0);},0);
          var remQ=Math.max(0,limQ-doneQ);
          return '<div style="display:flex;gap:6px;align-items:center;">'+
            '<input id="dp-qty" class="finp" type="number" step="0.001" max="'+remQ+'" placeholder="max '+remQ+'" style="flex:1;">'+
            '<span style="font-size:12px;font-weight:700;color:var(--text3);padding-top:2px;">'+(item.unit||'')+'</span>'+
          '</div>'+
          '<div style="font-size:9px;color:#E65100;margin-top:2px;">'+(jmQ?'JM':'BOQ')+' balance: '+remQ.toFixed(2)+' '+(item.unit||'')+'</div>';
        })()+
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

  // Wire checkboxes → highlight row when checked, clear qty when unchecked
  setTimeout(function(){
    var body=document.getElementById('exec-sheet-body');
    if(!body)return;
    body.addEventListener('change',function(e){
      var chk=e.target;
      if(chk.classList&&chk.classList.contains('dp-res-chk')){
        var row=chk.closest('.dp-res-row');
        if(!row)return;
        var qtyInp=row.querySelector('.dp-res-qty');
        if(!chk.checked&&qtyInp) qtyInp.value=''; // clear qty if unchecked
        // Highlight border on check
        row.style.borderColor=chk.checked?'#1565C0':'var(--border)';
        row.style.background=chk.checked?'#EFF6FF':'#FAFAFA';
      }
    });
  },100);
}

function dpPartyChange(){} // kept for compatibility

async function execSaveDailyEntry(projId,itemId){
  var date=gv('dp-date'),qty=parseFloat(gv('dp-qty'))||0;
  if(!date){toast('Date required','warning');return;}
  if(!qty){toast('Enter qty completed','warning');return;}

  var item=WA_ITEMS.find(function(i){return i.id===itemId;})||{};

  // ── Validation 1: qty ≤ JM qty (or BOQ qty) minus already done ──
  var jmQty  = WA_JMS.filter(function(j){return j.boq_item_id===itemId;}).reduce(function(s,j){return s+(parseFloat(j.jm_qty)||0);},0);
  var boqQty = parseFloat(item.boq_qty||item.qty)||0;
  var limitQty = jmQty||boqQty; // use JM if available, else BOQ
  var alreadyDone = WA_DAILY.filter(function(d){return d.boq_item_id===itemId;}).reduce(function(s,d){return s+(parseFloat(d.qty_done)||0);},0);
  var remaining = Math.max(0, limitQty - alreadyDone);
  if(limitQty>0 && qty>remaining){
    toast('Qty ('+ qty+') exceeds '+(jmQty?'JM':'BOQ')+' balance ('+remaining.toFixed(2)+' '+( item.unit||'')+' remaining)','warning');
    return;
  }

  // ── Collect checked resources ──
  var resources=[];
  var resValid=true;
  document.querySelectorAll('.dp-res-chk:checked').forEach(function(chk){
    var row=chk.closest('.dp-res-row');
    var allotId=chk.getAttribute('data-allot-id');
    // Find qty input by data-allot-id attribute (most reliable)
    var qtyInp=document.querySelector('.dp-res-qty[data-allot-id="'+allotId+'"]')||
               (row&&row.querySelector('.dp-res-qty'));
    var resQty=parseFloat(qtyInp&&qtyInp.value)||0;
    console.log('Resource:',chk.getAttribute('data-name'),'allot:',allotId,'qty:',resQty,'input found:',!!qtyInp);
    var resName=chk.getAttribute('data-name');
    var resUnit=chk.getAttribute('data-unit')||null;

    // Qty is required when resource is checked
    if(!resQty||resQty<=0){
      toast('Enter qty used for: '+resName,'warning');
      resValid=false;
      if(qtyInp){qtyInp.style.border='2px solid #C62828';qtyInp.focus();}
      return;
    }

    // ── Validation 2: resource qty ≤ allotted minus already utilised ──
    if(resQty&&allotId){
      var allot=WA_ALLOT.find(function(a){return a.id===allotId;})||{};
      var allotQty=parseFloat(allot.qty)||0;
      var alreadyUsed=0;
      WA_DAILY.forEach(function(d){
        var rr=[];try{rr=d.resources_used?JSON.parse(d.resources_used):[];}catch(ex){}
        rr.forEach(function(r){if(r.allot_id===allotId&&r.qty)alreadyUsed+=parseFloat(r.qty)||0;});
      });
      var resRemaining=Math.max(0,allotQty-alreadyUsed);
      if(resQty>resRemaining){
        toast(resName+': qty ('+resQty+') exceeds allotted balance ('+resRemaining.toFixed(2)+' '+(resUnit||'')+')', 'warning');
        resValid=false; return;
      }
    }

    resources.push({
      allot_id:allotId,
      name:resName,
      type:chk.getAttribute('data-type'),
      unit:resUnit,
      qty:resQty  // always a positive number now
    });
  });
  if(!resValid) return;
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
  var entry=WA_DAILY.find(function(d){return d.id===id;});
  if(!entry)return;
  // Find linked issue logs — those whose daily_progress_id matches or whose status changed due to this entry
  var linkedLogs=STORE_ISSUE_LOG.filter(function(l){return l.daily_progress_id===id;});
  var msg='Delete this daily progress entry?';
  if(linkedLogs.length) msg+='\n\n'+linkedLogs.length+' issue log utilisation record(s) will also be cleared.';
  if(!confirm(msg))return;
  WA_DAILY=WA_DAILY.filter(function(d){return d.id!==id;});
  // Restore issue log status to 'available' and clear daily_progress_id
  STORE_ISSUE_LOG=STORE_ISSUE_LOG.map(function(l){
    if(l.daily_progress_id===id) return Object.assign({},l,{status:'available',daily_progress_id:null});
    return l;
  });
  execRenderDaily();
  try{
    await sbDelete('work_daily_progress',id);
    // Restore linked issue logs
    for(var li=0;li<linkedLogs.length;li++){
      try{
        await sbUpdate('store_issue_log',linkedLogs[li].id,{status:'available',daily_progress_id:null});
      }catch(e){console.warn(e);}
    }
  }catch(e){console.error(e);}
}

async function execEditDailyEntry(entryId, itemId){
  var d=WA_DAILY.find(function(x){return x.id===entryId;});
  if(!d){toast('Entry not found','warning');return;}
  var item=WA_ITEMS.find(function(i){return i.id===itemId;})||{};
  var projId=PROJ_MOD_SEL_ID||(document.getElementById('exec-proj-sel')||{}).value||'';

  // Get allotted resources for this item
  var itemSubIds=WA_SUBS.filter(function(s){return s.boq_item_id===itemId;}).map(function(s){return s.id;});
  var itemAllots=WA_ALLOT.filter(function(a){
    return a.boq_item_id===itemId||(a.boq_subitem_id&&itemSubIds.includes(a.boq_subitem_id));
  });

  // Parse existing resources_used
  var existingRes=[];try{existingRes=d.resources_used?JSON.parse(d.resources_used):[];}catch(e){}

  var tCol={vendor:'#1565C0',sc:'#6A1B9A',labour_contractor:'#2E7D32',labour:'#37474F',machinery:'#E65100'};
  var tLbl={vendor:'Vendor',sc:'SC',labour_contractor:'Labour Contr.',labour:'Labour',machinery:'Machinery'};

  // Store-aware resource rows for edit — same logic as new entry
  function getEditResName(a){
    var pl=WA_PLANNED.find(function(p){return p.id===a.boq_exec_resource_id;})||{};
    return pl.party_name||pl.resource_category||a.scope||'';
  }

  var inStoreE=[], outStoreE=[];
  var seenStoreIdsE={};
  itemAllots.forEach(function(a){
    var rn=getEditResName(a);
    var sm=STORE_ITEMS.find(function(s){return s.allot_id===a.id&&(parseFloat(s.qty_in_hand)||0)>0;})||
           (rn?STORE_ITEMS.find(function(s){return s.project_id===projId&&s.item_name===rn&&(parseFloat(s.qty_in_hand)||0)>0;}):null);
    var allotQty=parseFloat(a.qty)||0;
    var storeQty=sm?(parseFloat(sm.qty_in_hand)||0):0;
    var outsideQty=Math.max(0,allotQty-storeQty);
    if(sm&&!seenStoreIdsE[sm.id]){seenStoreIdsE[sm.id]=true;inStoreE.push({allot:a,storeItem:sm,resName:rn||sm.item_name});}
    if(outsideQty>0) outStoreE.push({allot:a,resName:rn,outsideQty:outsideQty});
  });

  function makeEditResRow(a, col, rn, storeItem, fromStore, outsideQty){
    var existingUse=existingRes.find(function(r){return r.allot_id===a.id;});
    var existingQty=existingUse?existingUse.qty||'':'';
    var allotQ=parseFloat(a.qty)||0;
    var usedExcl=0;
    WA_DAILY.forEach(function(dd){
      if(dd.id===entryId)return;
      var rr=[];try{rr=dd.resources_used?JSON.parse(dd.resources_used):[];}catch(e){}
      rr.forEach(function(r){if(r.allot_id===a.id&&r.qty)usedExcl+=parseFloat(r.qty)||0;});
    });
    var balQ=Math.max(0,allotQ-usedExcl);
    var inHand=storeItem?parseFloat(storeItem.qty_in_hand)||0:null;
    var maxQ=fromStore&&inHand!==null?inHand:(outsideQty||balQ);

    return '<div class="dp-res-row" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1.5px solid '+(fromStore?'#C8E6C9':col);+';border-radius:8px;margin-bottom:6px;background:'+(fromStore?'#F1FBF4':'#FAFAFA')+';">'+
      '<input type="checkbox" class="dp-res-chk" data-allot-id="'+a.id+'" data-name="'+a.party_name+'" data-type="'+a.exec_type+'" data-unit="'+(a.unit||'')+'" '+(existingUse?'checked':'')+' style="width:15px;height:15px;accent-color:'+col+';flex-shrink:0;">'+
      '<div style="flex:1;min-width:0;">'+
        (fromStore?'<span style="font-size:9px;font-weight:800;background:#C8E6C9;color:#1B5E20;padding:1px 6px;border-radius:3px;margin-right:4px;">&#127981; Store</span>':
          '<span style="font-size:9px;font-weight:800;padding:1px 6px;background:'+col+'15;color:'+col+';border-radius:3px;margin-right:4px;">'+(tLbl[a.exec_type]||a.exec_type)+'</span>')+
        (rn?'<span style="font-size:11px;font-weight:800;color:#1B5E20;margin-right:3px;">'+rn+'</span><span style="font-size:10px;color:#888;">&#8594;</span>':'')+
        ' <span style="font-size:11px;font-weight:700;color:#333;">'+a.party_name+'</span>'+
        '<div style="font-size:9px;color:var(--text3);">'+
          (fromStore&&inHand!==null?'In Store: <b style="color:#2E7D32;">'+inHand.toFixed(2)+'</b> | ':'')+'Allotted: '+a.qty+' | Balance: <b>'+balQ.toFixed(2)+'</b>'+
        '</div>'+
      '</div>'+
      '<div class="dp-res-qty-wrap" style="display:flex;align-items:center;gap:4px;">'+
        '<div><div style="font-size:9px;color:#E65100;font-weight:700;margin-bottom:2px;">Qty Used *</div>'+
          '<input class="dp-res-qty finp" data-allot-id="'+a.id+'" type="number" step="0.001" max="'+maxQ+'" value="'+existingQty+'" placeholder="qty" style="width:80px;padding:4px 6px;font-size:12px;text-align:center;"></div>'+
        '<div style="font-size:11px;font-weight:700;color:var(--text3);padding-top:16px;">'+(a.unit||'')+'</div>'+
      '</div>'+
    '</div>';
  }

  var resourceRows = itemAllots.length
    ? (inStoreE.length
        ? '<div style="font-size:10px;font-weight:800;color:#1B5E20;margin-bottom:6px;">&#127981; From Store</div>'+
          inStoreE.map(function(x){return makeEditResRow(x.allot,tCol[x.allot.exec_type]||'#37474F',x.resName,x.storeItem,true);}).join('')
        : '<div style="font-size:10px;color:var(--text3);margin-bottom:6px;font-style:italic;">No matching store items</div>')+
      (outStoreE.length
        ? '<div style="margin-top:10px;">'+
            '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:6px;">'+
              '<input type="checkbox" id="dp-show-outside" onchange="document.getElementById(\'dp-outside-rows\').style.display=this.checked?\'block\':\'none\'" style="width:14px;height:14px;accent-color:#E65100;"'+(existingRes.some(function(r){return outStoreE.some(function(x){return x.allot.id===r.allot_id;})})?'checked':'')+'>'+
              '<span style="font-size:10px;font-weight:800;color:#E65100;">Use resources not in store ('+outStoreE.length+')</span>'+
            '</label>'+
            '<div id="dp-outside-rows" style="display:'+(existingRes.some(function(r){return outStoreE.some(function(x){return x.allot.id===r.allot_id;})})?'block':'none')+';">'+
              outStoreE.map(function(x){return makeEditResRow(x.allot,tCol[x.allot.exec_type]||'#37474F',x.resName,null,false,x.outsideQty);}).join('')+
            '</div>'+
          '</div>'
        : '')
    : '<div style="font-size:11px;color:var(--text3);padding:8px 0;font-style:italic;">No resources allotted for this item yet.</div>';

  // BOQ qty balance excluding this entry
  var jmQ=WA_JMS.filter(function(j){return j.boq_item_id===itemId;}).reduce(function(s,j){return s+(parseFloat(j.jm_qty)||0);},0);
  var boqQ=parseFloat(item.boq_qty||item.qty)||0;
  var limQ=jmQ||boqQ;
  var doneExcl=WA_DAILY.filter(function(dd){return dd.boq_item_id===itemId&&dd.id!==entryId;}).reduce(function(s,dd){return s+(parseFloat(dd.qty_done)||0);},0);
  var remQ=Math.max(0,limQ-doneExcl);

  document.getElementById('exec-sheet-title').textContent='Edit Daily Entry';
  document.getElementById('exec-sheet-body').innerHTML=
    '<div style="background:#FFF3E0;border-radius:10px;padding:12px;margin-bottom:12px;">'+
      '<div style="font-size:11px;font-weight:800;color:#E65100;margin-bottom:10px;">&#9312; Progress</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">'+
        '<div><label class="flbl">Date *</label><input id="dp-date" class="finp" type="date" value="'+(d.date||new Date().toISOString().slice(0,10))+'"></div>'+
        '<div><label class="flbl">Qty Completed *</label>'+
          '<div style="display:flex;gap:6px;align-items:center;">'+
            '<input id="dp-qty" class="finp" type="number" step="0.001" max="'+remQ+'" value="'+(d.qty_done||'')+'" style="flex:1;">'+
            '<span style="font-size:12px;font-weight:700;color:var(--text3);">'+(item.unit||'')+'</span>'+
          '</div>'+
          '<div style="font-size:9px;color:#E65100;margin-top:2px;">'+(jmQ?'JM':'BOQ')+' balance: '+remQ.toFixed(2)+' '+(item.unit||'')+'</div>'+
        '</div>'+
      '</div>'+
      '<div><label class="flbl">Remarks</label><input id="dp-remarks" class="finp" value="'+(d.remarks||'')+'" placeholder="Weather, issues, notes..."></div>'+
    '</div>'+
    (itemAllots.length?
      '<div style="font-size:11px;font-weight:800;color:#1565C0;margin-bottom:8px;">&#9313; Resources Utilised</div>'+resourceRows
      :'');

  var sf=document.getElementById('exec-sheet-foot');sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#1565C0;color:white;';
  sb.innerHTML='&#10003; Update Entry';
  sb.onclick=function(){execUpdateDailyEntry(entryId,itemId,projId);};
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-exec','sh-exec');

  // Wire checkboxes
  setTimeout(function(){
    var body=document.getElementById('exec-sheet-body');
    if(!body)return;
    body.addEventListener('change',function(e){
      var chk=e.target;
      if(chk.classList&&chk.classList.contains('dp-res-chk')){
        var row=chk.closest('.dp-res-row');if(!row)return;
        var qw=row.querySelector('.dp-res-qty-wrap');
        if(qw)qw.style.display=chk.checked?'flex':'none';
      }
    });
  },100);
}

async function execUpdateDailyEntry(entryId, itemId, projId){
  var date=gv('dp-date'),qty=parseFloat(gv('dp-qty'))||0;
  if(!date){toast('Date required','warning');return;}
  if(!qty){toast('Enter qty completed','warning');return;}

  var item=WA_ITEMS.find(function(i){return i.id===itemId;})||{};

  // Validate qty against JM/BOQ balance (excluding this entry)
  var jmQ=WA_JMS.filter(function(j){return j.boq_item_id===itemId;}).reduce(function(s,j){return s+(parseFloat(j.jm_qty)||0);},0);
  var boqQ=parseFloat(item.boq_qty||item.qty)||0;
  var limQ=jmQ||boqQ;
  var doneExcl=WA_DAILY.filter(function(dd){return dd.boq_item_id===itemId&&dd.id!==entryId;}).reduce(function(s,dd){return s+(parseFloat(dd.qty_done)||0);},0);
  var remQ=Math.max(0,limQ-doneExcl);
  if(limQ>0&&qty>remQ){
    toast('Qty ('+ qty+') exceeds '+(jmQ?'JM':'BOQ')+' balance ('+remQ.toFixed(2)+')','warning');
    return;
  }

  // Collect resources
  var resources=[];var resValid=true;
  document.querySelectorAll('.dp-res-chk:checked').forEach(function(chk){
    var row=chk.closest('.dp-res-row');
    var qtyInp=row&&row.querySelector('.dp-res-qty');
    var resQty=parseFloat(qtyInp&&qtyInp.value)||null;
    var allotId=chk.getAttribute('data-allot-id');
    var resName=chk.getAttribute('data-name');
    var resUnit=chk.getAttribute('data-unit')||null;
    if(resQty&&allotId){
      var allot=WA_ALLOT.find(function(a){return a.id===allotId;})||{};
      var allotQ=parseFloat(allot.qty)||0;
      var usedExcl=0;
      WA_DAILY.forEach(function(dd){
        if(dd.id===entryId)return;
        var rr=[];try{rr=dd.resources_used?JSON.parse(dd.resources_used):[];}catch(e){}
        rr.forEach(function(r){if(r.allot_id===allotId&&r.qty)usedExcl+=parseFloat(r.qty)||0;});
      });
      var resRem=Math.max(0,allotQ-usedExcl);
      if(resQty>resRem){toast(resName+': qty ('+resQty+') exceeds allotted balance ('+resRem.toFixed(2)+')','warning');resValid=false;return;}
    }
    resources.push({allot_id:allotId,name:resName,type:chk.getAttribute('data-type'),unit:resUnit,qty:resQty});
  });
  if(!resValid)return;

  var updateData={date:date,qty_done:qty,remarks:gv('dp-remarks')||null,resources_used:resources.length?JSON.stringify(resources):null};
  try{
    await sbUpdate('work_daily_progress',entryId,updateData);
    var idx=WA_DAILY.findIndex(function(d){return d.id===entryId;});
    if(idx>-1) WA_DAILY[idx]=Object.assign(WA_DAILY[idx],updateData);
    toast('Entry updated!','success');
    closeSheet('ov-exec','sh-exec');
    execRenderDaily();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}
// ── Bills & Payments ────────────────────────────────────────────────────

function billsToggleGroup(grpId){
  var rows=document.querySelectorAll('#'+grpId+'-rows, [id="'+grpId+'-rows"]');
  // querySelectorAll with same id - use attribute selector
  var allRows=document.querySelectorAll('[id="'+grpId+'-rows"]');
  if(!allRows.length) return;
  var isHidden=allRows[0].style.display==='none';
  allRows.forEach(function(r){r.style.display=isHidden?'table-row':'none';});
}

function execRenderBills(){
  var el=document.getElementById('exec-content');if(!el)return;
  var projId=PROJ_MOD_SEL_ID||(document.getElementById('exec-proj-sel')||{}).value||'';
  var inr=function(n){return '\u20b9'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:0});};
  var tLbl={vendor:'Vendor',sc:'SC',labour_contractor:'Labour Contr.',labour:'Labour',machinery:'Machinery'};
  var tCol={vendor:'#1565C0',sc:'#6A1B9A',labour_contractor:'#2E7D32',labour:'#37474F',machinery:'#E65100'};

  if(!WA_ALLOT.length){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">No allotments yet</div>';
    return;
  }

  // Group allotments by party
  var parties={};
  WA_ALLOT.forEach(function(a){
    var key=a.exec_type+'::'+a.party_name;
    if(!parties[key]) parties[key]={type:a.exec_type,name:a.party_name,allots:[]};
    parties[key].allots.push(a);
  });

  el.innerHTML=Object.keys(parties).map(function(key){
    var p=parties[key];
    var col=tCol[p.type]||'#37474F';

    // ── Per-allotment rows — grouped with expandable individual rows ──
    var allotGroups={}, allotGroupOrder=[];
    p.allots.forEach(function(a){
      var planRes=WA_PLANNED.find(function(r){return r.id===a.boq_exec_resource_id;})||{};
      var resName=planRes.party_name||planRes.resource_category||'';
      var allotRate=parseFloat(a.rate)||0;
      var allotQty=parseFloat(a.qty)||0;
      var doneQty=0;
      WA_DAILY.forEach(function(d){
        var rr=[];try{rr=d.resources_used?JSON.parse(d.resources_used):[];}catch(e){}
        rr.forEach(function(r){if(r.allot_id===a.id&&r.qty)doneQty+=parseFloat(r.qty)||0;});
      });
      var boqItem=WA_ITEMS.find(function(i){return i.id===a.boq_item_id;})||{};
      var key=(resName||a.party_name)+'__'+(a.unit||'');
      if(!allotGroups[key]){
        allotGroups[key]={resName:resName,partyName:a.party_name,unit:a.unit||'',allotQty:0,allotAmt:0,doneQty:0,doneAmt:0,items:[]};
        allotGroupOrder.push(key);
      }
      // Advance paid for this allotment
      var advAmt=WA_ADVANCES.filter(function(x){return x.allot_id===a.id;}).reduce(function(s,x){return s+(parseFloat(x.amount)||0);},0);
      // Bill payments for this allotment (via bills that include this allotment)
      var billPaid=WA_PAYMENTS.filter(function(py){
        var b=WA_BILLS.find(function(b){return b.id===py.bill_id;});
        if(!b)return false;
        var si=[];try{si=b.selected_items?JSON.parse(b.selected_items):[];}catch(e){}
        return si.some(function(x){return x.allot_id===a.id;});
      }).reduce(function(s,py){return s+(parseFloat(py.amount)||0);},0);
      // Billed amount for this allotment
      var billedAmt=WA_BILLS.reduce(function(s,b){
        var si=[];try{si=b.selected_items?JSON.parse(b.selected_items):[];}catch(e){}
        return s+si.filter(function(x){return x.allot_id===a.id;}).reduce(function(s2,x){return s2+(parseFloat(x.amount)||0);},0);
      },0);
      allotGroups[key].allotQty+=allotQty;
      allotGroups[key].allotAmt+=Math.round(allotQty*allotRate);
      allotGroups[key].doneQty+=doneQty;
      allotGroups[key].doneAmt+=Math.round(doneQty*allotRate);
      allotGroups[key].billedAmt=(allotGroups[key].billedAmt||0)+billedAmt;
      allotGroups[key].advAmt=(allotGroups[key].advAmt||0)+advAmt;
      allotGroups[key].paidAmt=(allotGroups[key].paidAmt||0)+billPaid;
      allotGroups[key].items.push({a:a,resName:resName,allotQty:allotQty,allotRate:allotRate,doneQty:doneQty,boqItem:boqItem});
    });

    var allotRows=allotGroupOrder.map(function(key){
      var g=allotGroups[key];
      var pct=g.allotQty>0?Math.min(100,Math.round(g.doneQty/g.allotQty*100)):0;
      var pctCol=pct>=100?'#2E7D32':pct>=50?'#1565C0':'#E65100';
      var grpId='grp-'+key.replace(/[^a-z0-9]/gi,'-');
      var hasMultiple=g.items.length>1;

      // Individual rows (hidden by default when multiple)
      var indivRows=hasMultiple?g.items.map(function(x){
        var aPct=x.allotQty>0?Math.min(100,Math.round(x.doneQty/x.allotQty*100)):0;
        var aPctCol=aPct>=100?'#2E7D32':aPct>=50?'#1565C0':'#E65100';
        return '<tr id="'+grpId+'-rows" style="display:none;background:#F8FAFC;border-bottom:1px solid #F0F0F0;">'+
          '<td style="padding:5px 10px 5px 24px;font-size:10px;color:#555;">'+
            (x.boqItem.item_code?'<span style="font-size:9px;font-family:monospace;background:#EEE;padding:1px 4px;border-radius:3px;margin-right:4px;">['+x.boqItem.item_code+']</span>':'')+
            (x.boqItem.short_name||x.boqItem.description||x.resName||'—')+
          '</td>'+
          '<td style="padding:5px 10px;font-size:10px;text-align:right;">'+x.allotQty.toFixed(2)+'</td>'+
          '<td style="padding:5px 10px;font-size:10px;text-align:right;">'+inr(Math.round(x.allotQty*x.allotRate))+'</td>'+
          '<td style="padding:5px 10px;font-size:10px;text-align:right;color:'+aPctCol+';">'+x.doneQty.toFixed(2)+' ('+aPct+'%)</td>'+
          '<td style="padding:5px 10px;font-size:10px;text-align:right;color:#1565C0;">'+inr(Math.round(x.doneQty*x.allotRate))+'</td>'+
        '</tr>';
      }).join(''):'';

      var trStyle='border-bottom:1px solid #F5F5F5;'+(hasMultiple?'cursor:pointer;':'');
      var trClick=hasMultiple?' onclick="billsToggleGroup(\'' + grpId + '\')"':'';
      return '<tr style="'+trStyle+'"'+trClick+'>'+
        '<td style="padding:7px 10px;font-size:11px;">'+
          (g.resName?'<div style="font-weight:800;color:#1B5E20;">'+g.resName+(hasMultiple?' <span style="font-size:9px;background:#E3F2FD;color:#1565C0;border-radius:3px;padding:1px 5px;font-weight:700;">'+g.items.length+' items &#9660;</span>':'')+'</div>':'')+
          '<div style="font-size:10px;color:#555;">'+g.partyName+'</div>'+
        '</td>'+
        '<td style="padding:7px 10px;font-size:11px;text-align:right;">'+g.allotQty.toFixed(2)+' <span style="font-size:9px;color:var(--text3);">'+g.unit+'</span></td>'+
        '<td style="padding:7px 10px;font-size:11px;text-align:right;">'+inr(g.allotAmt)+'</td>'+
        '<td style="padding:7px 10px;font-size:11px;text-align:right;color:'+pctCol+';font-weight:700;">'+g.doneQty.toFixed(2)+' <span style="font-size:9px;color:var(--text3);">'+g.unit+'</span><div style="font-size:9px;color:'+pctCol+';">('+pct+'% of allotted)</div></td>'+
        '<td style="padding:7px 10px;font-size:11px;text-align:right;font-weight:800;color:#1565C0;">'+inr(g.doneAmt)+'</td>'+
        '<td style="padding:7px 10px;font-size:11px;text-align:right;font-weight:800;color:#1A237E;">'+(g.billedAmt?inr(g.billedAmt):'—')+'</td>'+
        '<td style="padding:7px 10px;font-size:11px;text-align:right;color:#F57F17;font-weight:800;">'+(g.advAmt?inr(g.advAmt):'—')+'</td>'+
        '<td style="padding:7px 10px;font-size:11px;text-align:right;color:#558B2F;font-weight:800;">'+(g.paidAmt?inr(g.paidAmt):'—')+'</td>'+
        (function(){var tot=(g.advAmt||0)+(g.paidAmt||0);return '<td style="padding:7px 10px;font-size:11px;text-align:right;font-weight:800;color:#2E7D32;">'+inr(tot)+'</td>';})()+
        (function(){var bal=g.doneAmt-(g.advAmt||0)-(g.paidAmt||0);return '<td style="padding:7px 10px;font-size:11px;text-align:right;font-weight:800;color:'+(bal>0?'#C62828':bal<0?'#6A1B9A':'#2E7D32')+';">'+inr(bal)+'</td>';})()+ 
      '</tr>'+indivRows;
    }).join('');

    // ── Totals — sum from groups ──
    var totAllotAmt=Object.keys(allotGroups).reduce(function(s,k){return s+allotGroups[k].allotAmt;},0);
    var totDoneAmt=Object.keys(allotGroups).reduce(function(s,k){return s+allotGroups[k].doneAmt;},0);

    // ── Bills summary ──
    var pAdvances=WA_ADVANCES.filter(function(a){return a.party_name===p.name&&a.party_type===p.type;});
    var totalAdvance=pAdvances.reduce(function(s,a){return s+(parseFloat(a.amount)||0);},0);
    var pBills=WA_BILLS.filter(function(b){return b.party_name===p.name&&b.party_type===p.type;});
    var totalBilled=pBills.reduce(function(s,b){return s+(parseFloat(b.bill_amount)||0);},0);
    var totalDeductions=pBills.reduce(function(s,b){
      var ded=[];try{ded=b.deductions?JSON.parse(b.deductions):[];}catch(e){}
      return s+ded.filter(function(d){return !d.released;}).reduce(function(s2,d){return s2+(parseFloat(d.amount)||0);},0);
    },0);
    var totalHeld=pBills.reduce(function(s,b){
      var ded=[];try{ded=b.deductions?JSON.parse(b.deductions):[];}catch(e){}
      return s+ded.filter(function(d){return d.released;}).reduce(function(s2,d){return s2+(parseFloat(d.amount)||0);},0);
    },0);
    var pPaid=WA_PAYMENTS.filter(function(py){return py.party_name===p.name&&py.party_type===p.type;});
    var totalPaid=pPaid.reduce(function(s,py){return s+(parseFloat(py.amount)||0);},0);
    var netPayable=totalBilled-totalDeductions;
    var totalPaidAll=totalPaid+totalAdvance;
    var balDue=netPayable-totalPaidAll;

    // ── Bills list ──
    var billsList=pBills.length?pBills.map(function(b){
      var ded=[];try{ded=b.deductions?JSON.parse(b.deductions):[];}catch(e){}
      var activeDed=ded.filter(function(d){return !d.released;});
      var relDed=ded.filter(function(d){return d.released;});
      var dedTotal=activeDed.reduce(function(s,d){return s+(parseFloat(d.amount)||0);},0);
      var relTotal=relDed.reduce(function(s,d){return s+(parseFloat(d.amount)||0);},0);
      var bPaid=WA_PAYMENTS.filter(function(py){return py.bill_id===b.id;});
      var bPaidAmt=bPaid.reduce(function(s,py){return s+(parseFloat(py.amount)||0);},0);
      // Advance adjustments count as paid
      var bAdvAdj=activeDed.filter(function(d){return d.is_advance_adj;}).reduce(function(s,d){return s+(parseFloat(d.amount)||0);},0);
      // Released deductions count as paid (released back to party)
      var bRelDed=relDed.reduce(function(s,d){return s+(parseFloat(d.amount)||0);},0);
      var bNet=(parseFloat(b.bill_amount)||0)-dedTotal;
      var bBal=bNet-bPaidAmt-bRelDed;

      return '<div style="background:#F8FAFC;border:1px solid #E8EAF6;border-radius:10px;padding:10px 12px;margin-bottom:8px;">'+
        // Bill header
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'+
          '<span style="background:#E3F2FD;color:#1565C0;font-weight:800;padding:2px 8px;border-radius:4px;font-size:10px;">'+(b.bill_ref||'Bill #'+b.bill_number)+'</span>'+
          '<span style="font-size:10px;color:var(--text3);">'+fmtD(b.bill_date)+'</span>'+
          '<span style="font-size:10px;color:var(--text3);">'+( b.bill_date||'')+'</span>'+
          (b.description?'<span style="font-size:10px;color:var(--text3);flex:1;">'+b.description+'</span>':'<span style="flex:1;"></span>')+
          '<button onclick="execOpenPayment(\''+b.id+'\',\''+key+'\',\''+projId+'\','+bBal+')" style="background:#2E7D32;color:white;border:none;border-radius:5px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;">+ Pay</button>'+
          '<button onclick="execAddDeduction(\''+b.id+'\')" style="background:#E65100;color:white;border:none;border-radius:5px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;">- Deduction</button>'+
          '<button onclick="execDownloadBillPDF(\''+b.id+'\')" style="background:#558B2F;color:white;border:none;border-radius:5px;padding:3px 8px;font-size:10px;cursor:pointer;font-weight:700;" title="Download PDF">&#11015; PDF</button>'+
          '<button onclick="execDelBill(\''+b.id+'\')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:15px;" title="Delete">&#215;</button>'+
        '</div>'+
        // Bill amounts grid
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:'+(ded.length?'8':'0')+'px;">'+
          '<div style="text-align:center;background:white;padding:5px;border-radius:6px;"><div style="font-size:9px;color:var(--text3);">Gross Bill</div><div style="font-size:12px;font-weight:800;">'+inr(b.bill_amount)+'</div></div>'+
          '<div style="text-align:center;background:white;padding:5px;border-radius:6px;"><div style="font-size:9px;color:var(--text3);">Deductions</div><div style="font-size:12px;font-weight:800;color:#E65100;">'+inr(dedTotal)+'</div></div>'+
          '<div style="text-align:center;background:white;padding:5px;border-radius:6px;"><div style="font-size:9px;color:var(--text3);">Net Payable</div><div style="font-size:12px;font-weight:800;color:#1565C0;">'+inr(bNet)+'</div></div>'+
          '<div style="text-align:center;background:white;padding:5px;border-radius:6px;"><div style="font-size:9px;color:var(--text3);">Balance Due</div><div style="font-size:12px;font-weight:800;color:'+(bBal>0?'#C62828':'#2E7D32')+';">'+inr(bBal)+'</div></div>'+
        '</div>'+
        // Deductions detail
        (activeDed.length?
          '<div style="margin-bottom:6px;">'+
            '<div style="font-size:9px;font-weight:800;color:#E65100;margin-bottom:4px;">DEDUCTIONS HELD</div>'+
            activeDed.map(function(d){
              var isAdvAdj=d.is_advance_adj?true:false;
              return '<div style="display:flex;align-items:center;gap:6px;font-size:10px;padding:3px 0;border-bottom:1px solid #F0F0F0;">'+
                '<span style="background:'+(isAdvAdj?'#FFF8E1':'#FFF3E0')+';color:'+(isAdvAdj?'#F57F17':'#E65100')+';font-size:9px;font-weight:800;padding:1px 5px;border-radius:3px;">'+(isAdvAdj?'ADV ADJ':'DED')+'</span>'+
                '<span style="flex:1;font-weight:700;">'+d.head+'</span>'+
                '<span style="color:'+(isAdvAdj?'#F57F17':'#E65100')+';font-weight:800;">'+inr(d.amount)+'</span>'+
                (isAdvAdj?
                  '<button onclick="billDownloadAdvReceipt(\''+b.id+'\',\''+d.id+'\')" style="font-size:9px;background:#FFF8E1;color:#F57F17;border:1px solid #FFE0B2;border-radius:3px;padding:1px 5px;cursor:pointer;font-weight:700;">&#128438; PDF</button>':
                  '<button onclick="execReleaseDeduction(\''+b.id+'\',\''+d.id+'\')" style="font-size:9px;background:#E8F5E9;color:#2E7D32;border:1px solid #C8E6C9;border-radius:3px;padding:1px 5px;cursor:pointer;font-weight:700;">Release</button>'
                )+
                '<button onclick="execDeleteDeduction(\''+b.id+'\',\''+d.id+'\')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:13px;" title="Delete">&#215;</button>'+
              '</div>';
            }).join('')+
          '</div>':'')+
        (relDed.length?
          '<div style="margin-bottom:6px;">'+
            '<div style="font-size:9px;font-weight:800;color:#2E7D32;margin-bottom:4px;">RELEASED DEDUCTIONS (COUNTED AS PAID)</div>'+
            relDed.map(function(d){
              return '<div style="display:flex;align-items:center;gap:6px;font-size:10px;padding:2px 0;">'+
                '<span style="background:#E8F5E9;color:#2E7D32;font-size:9px;font-weight:800;padding:1px 5px;border-radius:3px;">REL</span>'+
                '<span style="flex:1;color:#555;">'+d.head+'</span>'+
                '<span style="font-weight:800;color:#2E7D32;">'+inr(d.amount)+'</span>'+
                '<span style="font-size:9px;color:#2E7D32;">&#10003; Released: '+fmtD(d.released_date)+'</span>'+
              '</div>';
            }).join('')+
          '</div>':'')+
        // Advance adjustments shown as payments
        (activeDed.filter(function(d){return d.is_advance_adj;}).length?
          '<div style="margin-bottom:6px;">'+
            '<div style="font-size:9px;font-weight:800;color:#F57F17;margin-bottom:4px;">ADVANCE ADJUSTED (COUNTED AS PAID)</div>'+
            activeDed.filter(function(d){return d.is_advance_adj;}).map(function(d){
              return '<div style="display:flex;align-items:center;gap:6px;font-size:10px;padding:2px 0;">'+
                '<span style="flex:1;color:#555;">'+d.head+'</span>'+
                '<span style="font-weight:800;color:#F57F17;">'+inr(d.amount)+'</span>'+
              '</div>';
            }).join('')+
          '</div>':'')+
        // Payments
        (bPaid.length?
          '<div><div style="font-size:9px;font-weight:800;color:var(--text3);margin-bottom:4px;">PAYMENTS</div>'+
            bPaid.map(function(py){
              return '<div style="display:flex;align-items:center;gap:6px;font-size:10px;padding:2px 0;border-bottom:1px solid #F8F8F8;">'+
                '<span style="color:var(--text3);">'+py.payment_date+'</span>'+
                '<span style="flex:1;font-weight:700;">'+inr(py.amount)+'</span>'+
                '<span style="color:var(--text3);">'+(py.payment_mode||'')+(py.reference?' · '+py.reference:'')+'</span>'+
                '<button onclick="execDelPayment(\''+py.id+'\')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:13px;">&#215;</button>'+
              '</div>';
            }).join('')+
          '</div>':'')+
      '</div>';
    }).join(''):'';

    var cardTop=
      '<div style="background:white;border-radius:14px;border:1px solid var(--border);margin-bottom:12px;overflow:hidden;">'+
      '<div style="padding:10px 14px;background:'+col+'10;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">'+
        '<span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:5px;background:'+col+'20;color:'+col+';">'+(tLbl[p.type]||p.type)+'</span>'+
        '<div style="flex:1;font-size:13px;font-weight:800;">'+p.name+'</div>'+
        '<button onclick="execOpenBill(\''+key+'\',\''+projId+'\')" style="background:'+col+';color:white;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:800;cursor:pointer;">&#128203; Generate Bill</button>'+
        '<button onclick="execOpenAdvance(\''+key+'\',\''+projId+'\')" style="background:#F57F17;color:white;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:800;cursor:pointer;">&#128181; + Advance</button>'+
      '</div>'+
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:500px;">'+
        '<thead><tr style="background:#F8FAFC;">'+
          '<th style="padding:6px 10px;font-size:9px;text-align:left;color:var(--text3);">RESOURCE / WORK</th>'+
          '<th style="padding:6px 10px;font-size:9px;text-align:right;color:var(--text3);">ALLOTTED QTY</th>'+
          '<th style="padding:6px 10px;font-size:9px;text-align:right;color:var(--text3);">ALLOTTED AMT</th>'+
          '<th style="padding:6px 10px;font-size:9px;text-align:right;color:#1565C0;">UTILISED QTY</th>'+
          '<th style="padding:6px 10px;font-size:9px;text-align:right;color:#2E7D32;">PAYABLE AMT</th>'+
          '<th style="padding:6px 10px;font-size:9px;text-align:right;color:#1A237E;">BILLED</th>'+
          '<th style="padding:6px 10px;font-size:9px;text-align:right;color:#F57F17;">ADVANCE</th>'+
          '<th style="padding:6px 10px;font-size:9px;text-align:right;color:#558B2F;">PAYMENT</th>'+
          '<th style="padding:6px 10px;font-size:9px;text-align:right;color:#2E7D32;">TOTAL PAID</th>'+
          '<th style="padding:6px 10px;font-size:9px;text-align:right;color:#C62828;">BALANCE</th>'+
        '</tr></thead>'+
        '<tbody>'+allotRows+'</tbody>'+
        '<tfoot><tr style="background:#EFF6FF;border-top:2px solid #1565C0;">'+
          '<td style="padding:7px 10px;font-size:11px;font-weight:800;">TOTAL</td>'+
          '<td></td>'+
          '<td style="padding:7px 10px;font-size:11px;text-align:right;font-weight:800;">'+inr(totAllotAmt)+'</td>'+
          '<td></td>'+
          '<td style="padding:7px 10px;font-size:12px;text-align:right;font-weight:900;color:#1565C0;">'+inr(totDoneAmt)+'</td>'+
        '<td style="padding:7px 10px;font-size:12px;text-align:right;font-weight:900;color:#1A237E;">'+inr(totalBilled)+'</td>'+
        '<td style="padding:7px 10px;font-size:12px;text-align:right;font-weight:900;color:#F57F17;">'+inr(totalAdvance)+'</td>'+
        '<td style="padding:7px 10px;font-size:12px;text-align:right;font-weight:900;color:#558B2F;">'+inr(totalPaid)+'</td>'+
        '<td style="padding:7px 10px;font-size:12px;text-align:right;font-weight:900;color:#2E7D32;">'+inr(totalPaidAll)+'</td>'+
        '<td style="padding:7px 10px;font-size:12px;text-align:right;font-weight:900;color:'+(balDue>0?'#C62828':balDue<0?'#6A1B9A':'#2E7D32')+';">'+inr(balDue)+'</td>'+
        '</tr></tfoot>'+
      '</table></div>';

    var summaryBar=
      '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:0;border-top:2px solid var(--border);">'+
        '<div style="padding:8px 6px;text-align:center;border-right:1px solid var(--border);"><div style="font-size:9px;color:var(--text3);font-weight:700;">BILLED</div><div style="font-size:12px;font-weight:900;color:#1565C0;">'+inr(totalBilled)+'</div></div>'+
        '<div style="padding:8px 6px;text-align:center;border-right:1px solid var(--border);"><div style="font-size:9px;color:var(--text3);font-weight:700;">DEDUCTIONS</div><div style="font-size:12px;font-weight:900;color:#E65100;">'+inr(totalDeductions)+'</div></div>'+
        '<div style="padding:8px 6px;text-align:center;border-right:1px solid var(--border);"><div style="font-size:9px;color:var(--text3);font-weight:700;">NET PAYABLE</div><div style="font-size:12px;font-weight:900;color:#1565C0;">'+inr(netPayable)+'</div></div>'+
        '<div style="padding:8px 6px;text-align:center;border-right:1px solid var(--border);"><div style="font-size:9px;color:var(--text3);font-weight:700;">ADVANCE</div><div style="font-size:12px;font-weight:900;color:#F57F17;">'+inr(totalAdvance)+'</div></div>'+
        '<div style="padding:8px 6px;text-align:center;border-right:1px solid var(--border);"><div style="font-size:9px;color:var(--text3);font-weight:700;">PAYMENT</div><div style="font-size:12px;font-weight:900;color:#2E7D32;">'+inr(totalPaid)+'</div></div>'+
        '<div style="padding:8px 6px;text-align:center;"><div style="font-size:9px;color:var(--text3);font-weight:700;">BALANCE</div><div style="font-size:12px;font-weight:900;color:'+(balDue>0?'#C62828':balDue<0?'#6A1B9A':'#2E7D32')+';">'+inr(balDue)+'</div></div>'+
      '</div>';

    var advancesList=pAdvances.length?
      '<div style="padding:10px 14px;border-top:1px solid var(--border);">'+
        '<div style="font-size:10px;font-weight:800;color:#F57F17;margin-bottom:8px;">ADVANCE PAYMENTS</div>'+
        pAdvances.map(function(adv){
          var allot=WA_ALLOT.find(function(a){return a.id===adv.allot_id;})||{};
          var planRes=WA_PLANNED.find(function(r){return r.id===allot.boq_exec_resource_id;})||{};
          var resLabel=planRes.party_name||planRes.resource_category||allot.scope||'';
          var adjSoFar=parseFloat(adv.adjusted_amount)||0;
          var advTotal=parseFloat(adv.amount)||0;
          var remaining=Math.max(0,advTotal-adjSoFar);
          return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F5F5F5;font-size:11px;">'+
            '<span style="background:#FFF8E1;color:#F57F17;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;">'+(remaining<=0?'ADJ':'ADV')+'</span>'+
            '<div style="flex:1;">'+(resLabel?'<b>'+resLabel+'</b> — ':'')+(adv.purpose||'')+
              '<div style="font-size:9px;color:var(--text3);">'+adv.date+' '+(adv.payment_mode||'')+(adv.reference?' · '+adv.reference:'')+
                (adjSoFar?'<span style="color:#E65100;margin-left:6px;"> Adj: '+inr(adjSoFar)+'</span>':'')+
                (remaining>0&&adjSoFar?'<span style="color:#2E7D32;margin-left:4px;"> Rem: '+inr(remaining)+'</span>':'')+
              '</div>'+
            '</div>'+
            '<span style="font-weight:800;color:'+(remaining<=0?'#9E9E9E':'#F57F17')+';">'+inr(advTotal)+'</span>'+
            '<button onclick="execDelAdvance(\''+adv.id+'\')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:14px;">&#215;</button>'+
          '</div>';
        }).join('')+
      '</div>':'';

    var billsSection=billsList?
      '<div style="padding:10px 14px;border-top:1px solid var(--border);">'+
        '<div style="font-size:10px;font-weight:800;color:var(--text3);margin-bottom:8px;">BILLS &amp; PAYMENTS</div>'+
        billsList+
      '</div>':'';

    return cardTop + summaryBar + advancesList + billsSection + '</div>';
  }).join('');
}


// ════ ADVANCE PAYMENT (from Allotted Work tab) ══════════════════════════
async function execOpenAdvanceAllot(allotId){
  var a=WA_ALLOT.find(function(x){return x.id===allotId;});
  if(!a){toast('Allotment not found','error');return;}
  var projId=PROJ_MOD_SEL_ID||(document.getElementById('exec-proj-sel')||{}).value||'';
  var planRes=WA_PLANNED.find(function(r){return r.id===a.boq_exec_resource_id;})||{};
  var resName=planRes.party_name||planRes.resource_category||a.scope||'';
  var allotAmt=Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));
  var alreadyAdv=WA_ADVANCES.filter(function(x){return x.allot_id===allotId;})
    .reduce(function(s,x){return s+(parseFloat(x.amount)||0);},0);
  var balance=Math.max(0,allotAmt-alreadyAdv);
  var inr=function(n){return '\u20b9'+Number(n||0).toLocaleString('en-IN');};

  document.getElementById('exec-sheet-title').textContent='Advance Payment — '+a.party_name;
  document.getElementById('exec-sheet-body').innerHTML=
    '<div style="background:#FFF8E1;border-radius:10px;padding:10px 14px;margin-bottom:12px;">'+
      '<div style="font-size:11px;font-weight:800;color:#F57F17;margin-bottom:6px;">'+a.party_name+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px;">'+
        '<div><div style="font-size:9px;color:var(--text3);">Resource</div><b>'+( resName||'—')+'</b></div>'+
        '<div><div style="font-size:9px;color:var(--text3);">Total Value</div><b>'+inr(allotAmt)+'</b></div>'+
        '<div><div style="font-size:9px;color:var(--text3);">Balance</div><b style="color:#F57F17;">'+inr(balance)+'</b></div>'+
      '</div>'+
      (alreadyAdv?'<div style="font-size:10px;color:#E65100;margin-top:6px;">Already advanced: '+inr(alreadyAdv)+'</div>':'')+
    '</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">Date *</label><input id="adva-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
      '<div><label class="flbl">Amount (₹) *</label><input id="adva-amount" class="finp" type="number" placeholder="0" value="'+Math.max(0,balance)+'"></div>'+
    '</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">Payment Mode</label>'+
        '<select id="adva-mode" class="fsel"><option>Bank Transfer</option><option>Cheque</option><option>Cash</option><option>UPI</option></select>'+
      '</div>'+
      '<div><label class="flbl">Reference / UTR</label><input id="adva-ref" class="finp" placeholder="UTR / Cheque no."></div>'+
    '</div>'+
    '<label class="flbl">Purpose / Remarks *</label>'+
    '<input id="adva-purpose" class="finp" placeholder="e.g. Mobilization advance, Advance against PO...">';

  var sf=document.getElementById('exec-sheet-foot');sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#F57F17;color:white;';
  sb.innerHTML='&#128181; Record Advance';
  sb.onclick=function(){execSaveAdvanceAllot(allotId,a.party_type||a.exec_type,a.party_name,projId,resName,allotAmt);};
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-exec','sh-exec');
}

async function execSaveAdvanceAllot(allotId,partyType,partyName,projId,resName,allotAmt){
  var date=gv('adva-date'),amount=parseFloat(gv('adva-amount'))||0;
  var purpose=(gv('adva-purpose')||'').trim();
  if(!date||!amount){toast('Date and amount required','warning');return;}
  if(!purpose){toast('Purpose/remarks required','warning');return;}
  if(amount>allotAmt){
    if(!confirm('Amount exceeds total allotted value ('+'\u20b9'+allotAmt.toLocaleString('en-IN')+').\nContinue?'))return;
  }
  try{
    var res=await sbInsert('work_advances',{
      project_id:projId,party_type:partyType,party_name:partyName,
      allot_id:allotId,date:date,amount:amount,
      payment_mode:gv('adva-mode')||null,
      reference:gv('adva-ref')||null,
      purpose:purpose
    });
    if(res&&res[0]){
      WA_ADVANCES.push(res[0]);
      toast('Advance of \u20b9'+amount.toLocaleString('en-IN')+' recorded!','success');
      closeSheet('ov-exec','sh-exec');
      // Download receipt automatically
      execAdvanceReceipt(res[0].id,resName,allotAmt);
      execRenderAllotted();
    }
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

function execAdvanceReceipt(advId,resName,allotAmt){
  var adv=WA_ADVANCES.find(function(x){return x.id===advId;});
  if(!adv){toast('Advance not found','error');return;}
  var a=WA_ALLOT.find(function(x){return x.id===adv.allot_id;})||{};
  var co=typeof COMPANY_DATA!=='undefined'?COMPANY_DATA:{};
  var projSel=document.getElementById('proj-mod-sel');
  var projName=projSel&&projSel.selectedIndex>=0?projSel.options[projSel.selectedIndex].text:'';
  var inr=function(n){return '\u20b9'+Number(n||0).toLocaleString('en-IN');};
  function fmtD(d){if(!d)return '—';var p=d.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d;}

  // Receipt number
  var rcptNo='ADV/'+new Date().getFullYear()+'/'+String(WA_ADVANCES.length).padStart(4,'0');
  var allotAmt2=Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));
  var totalAdv=WA_ADVANCES.filter(function(x){return x.allot_id===adv.allot_id;})
    .reduce(function(s,x){return s+(parseFloat(x.amount)||0);},0);

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Advance Receipt — '+rcptNo+'</title>'+
    '<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;font-size:12px;padding:32px;color:#1a1a1a;}'+
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #F57F17;padding-bottom:12px;margin-bottom:16px;}'+
    '.co{font-size:17px;font-weight:900;color:#F57F17;}.co-info{font-size:10px;color:#555;margin-top:3px;}'+
    '.rcpt-title{font-size:20px;font-weight:900;color:#F57F17;text-align:right;}.rcpt-no{font-size:12px;color:#555;text-align:right;margin-top:4px;}'+
    '.info-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #DDD;border-radius:8px;overflow:hidden;margin-bottom:16px;}'+
    '.info-cell{padding:10px 14px;}.info-cell+.info-cell{border-left:1px solid #DDD;}'+
    '.lbl{font-size:9px;font-weight:800;color:#888;text-transform:uppercase;margin-bottom:3px;}'+
    '.val{font-size:13px;font-weight:800;}'+
    '.amt-box{background:#FFF8E1;border:2px solid #F57F17;border-radius:12px;padding:20px;text-align:center;margin-bottom:16px;}'+
    '.amt-lbl{font-size:11px;color:#888;font-weight:700;margin-bottom:6px;}'+
    '.amt-val{font-size:32px;font-weight:900;color:#F57F17;}'+
    '.detail-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;border:1px solid #EEE;border-radius:8px;padding:12px;margin-bottom:16px;background:#FAFAFA;}'+
    '.detail-cell .d-lbl{font-size:9px;color:#888;font-weight:700;margin-bottom:3px;}'+
    '.detail-cell .d-val{font-size:12px;font-weight:800;}'+
    '.purpose-box{background:#F8FAFC;border-radius:8px;padding:12px;margin-bottom:16px;}'+
    '.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;}'+
    '.sig-box{border-top:1.5px solid #333;padding-top:8px;text-align:center;font-size:10px;color:#555;}'+
    '@media print{button{display:none;}}</style></head><body>'+
    '<button onclick="window.print()" style="background:#F57F17;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;margin-bottom:18px;font-family:Arial;font-weight:700;">&#128438; Print / Save PDF</button>'+

    '<div class="hdr">'+
      '<div><div class="co">'+(co.name||'Company Name')+'</div>'+
        '<div class="co-info">'+(co.address||'')+(co.gstin?'<br>GSTIN: '+co.gstin:'')+'</div></div>'+
      '<div><div class="rcpt-title">ADVANCE RECEIPT</div>'+
        '<div class="rcpt-no">'+rcptNo+'</div>'+
        '<div style="font-size:10px;color:#555;text-align:right;margin-top:3px;">Date: '+fmtD(adv.date)+'</div>'+
      '</div>'+
    '</div>'+

    '<div class="info-grid">'+
      '<div class="info-cell"><div class="lbl">Party</div><div class="val">'+adv.party_name+'</div>'+
        '<div style="font-size:10px;color:#555;margin-top:2px;">'+(adv.party_type||'')+'</div></div>'+
      '<div class="info-cell"><div class="lbl">Project</div><div class="val">'+projName+'</div></div>'+
    '</div>'+

    '<div class="amt-box">'+
      '<div class="amt-lbl">ADVANCE AMOUNT PAID</div>'+
      '<div class="amt-val">'+inr(adv.amount)+'</div>'+
      '<div style="font-size:11px;color:#888;margin-top:6px;">'+(adv.payment_mode||'')+(adv.reference?' · Ref: '+adv.reference:'')+'</div>'+
    '</div>'+

    '<div class="detail-grid">'+
      '<div class="detail-cell"><div class="d-lbl">Resource / Work</div><div class="d-val">'+(resName||'—')+'</div></div>'+
      '<div class="detail-cell"><div class="d-lbl">Allotted Qty × Rate</div><div class="d-val">'+( a.qty||0)+' '+(a.unit||'')+' @ '+inr(a.rate)+'</div></div>'+
      '<div class="detail-cell"><div class="d-lbl">Total Order Value</div><div class="d-val">'+inr(allotAmt2)+'</div></div>'+
      '<div class="detail-cell"><div class="d-lbl">Total Advance Paid</div><div class="d-val" style="color:#F57F17;">'+inr(totalAdv)+'</div></div>'+
      '<div class="detail-cell"><div class="d-lbl">Balance Payable</div><div class="d-val" style="color:#C62828;">'+inr(Math.max(0,allotAmt2-totalAdv))+'</div></div>'+
      '<div class="detail-cell"><div class="d-lbl">Payment Mode</div><div class="d-val">'+(adv.payment_mode||'—')+'</div></div>'+
    '</div>'+

    (adv.purpose?'<div class="purpose-box"><div class="lbl" style="margin-bottom:4px;">Purpose / Remarks</div><div style="font-size:11px;">'+adv.purpose+'</div></div>':'')+

    '<div class="sig-grid">'+
      '<div class="sig-box"><div style="height:40px;"></div><div style="font-weight:800;">'+(co.name||'Company')+'</div><div>Paid By / Authorized</div></div>'+
      '<div class="sig-box"><div style="height:40px;"></div><div style="font-weight:800;">'+adv.party_name+'</div><div>Received By</div></div>'+
    '</div>'+
  '</body></html>';

  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else toast('Allow popups to download receipt','warning');
}

async function execDelAdvance(id){
  if(!confirm('Delete this advance payment record?'))return;
  WA_ADVANCES=WA_ADVANCES.filter(function(a){return a.id!==id;});
  execRenderAllotted();
  try{await sbDelete('work_advances',id);}catch(e){console.error(e);}
  toast('Advance deleted','success');
}

async function execOpenBill(partyKey,projId){
  var parts=partyKey.split('::');
  var partyType=parts[0],partyName=parts[1];
  var inr=function(n){return '\u20b9'+Number(n||0).toLocaleString('en-IN');};

  // Build work rows — grouped by resource name+unit
  var partyAllots=WA_ALLOT.filter(function(a){return a.party_name===partyName&&a.exec_type===partyType;});
  var wrkGroups={}, wrkOrder=[];
  partyAllots.forEach(function(a){
    var planRes=WA_PLANNED.find(function(r){return r.id===a.boq_exec_resource_id;})||{};
    var resName=planRes.party_name||planRes.resource_category||a.party_name;
    var allotRate=parseFloat(a.rate)||0;
    var allotQty=parseFloat(a.qty)||0;
    var doneQty=0;
    WA_DAILY.forEach(function(d){
      var rr=[];try{rr=d.resources_used?JSON.parse(d.resources_used):[];}catch(e){}
      rr.forEach(function(r){if(r.allot_id===a.id&&r.qty)doneQty+=parseFloat(r.qty)||0;});
    });
    var doneAmt=Math.round(doneQty*allotRate);
    var prevBilled=WA_BILLS.reduce(function(s,b){
      if(b.party_name!==partyName||b.party_type!==partyType) return s;
      var si=[];try{si=b.selected_items?JSON.parse(b.selected_items):[];}catch(e){}
      return s+si.filter(function(x){return x.allot_id===a.id;}).reduce(function(s2,x){return s2+(parseFloat(x.amount)||0);},0);
    },0);
    var key=resName+'__'+(a.unit||'');
    if(!wrkGroups[key]){
      wrkGroups[key]={resName:resName,unit:a.unit||'',allotIds:[],allotQty:0,allotRate:allotRate,doneQty:0,doneAmt:0,prevBilled:0,unbilled:0};
      wrkOrder.push(key);
    }
    wrkGroups[key].allotIds.push(a.id);
    wrkGroups[key].allotQty+=allotQty;
    wrkGroups[key].doneQty+=doneQty;
    wrkGroups[key].doneAmt+=doneAmt;
    wrkGroups[key].prevBilled+=prevBilled;
  });
  wrkOrder.forEach(function(k){
    var g=wrkGroups[k];
    g.unbilled=Math.max(0,g.doneAmt-g.prevBilled);
  });
  // workRows format compatible with existing save code
  var workRows=wrkOrder.map(function(k){
    var g=wrkGroups[k];
    return {a:{id:g.allotIds[0]},resName:g.resName,boqItem:{},allotQty:g.allotQty,allotRate:g.allotRate,doneQty:g.doneQty,doneAmt:g.doneAmt,prevBilled:g.prevBilled,unbilled:g.unbilled,unit:g.unit,allotIds:g.allotIds};
  });

  var nextBillNo=(WA_BILLS.filter(function(b){return b.party_name===partyName&&b.party_type===partyType;}).length)+1;

  // Work selection rows
  var workSelRows=workRows.map(function(w,i){
    var chkId='bl-work-'+i;
    return '<div class="bl-work-row" style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px;background:#FAFAFA;">'+
      '<div style="display:flex;align-items:flex-start;gap:8px;">'+
        '<input type="checkbox" id="'+chkId+'" class="bl-work-chk" data-idx="'+i+'" '+(w.unbilled>0?'checked':'')+
          ' style="width:15px;height:15px;accent-color:#1565C0;flex-shrink:0;margin-top:3px;" onchange="blUpdateTotal()">'+
        '<div style="flex:1;">'+
          '<div style="font-size:12px;font-weight:800;color:#1B5E20;">'+w.resName+'</div>'+
          '<div style="font-size:10px;color:#555;">'+(w.unit||'')+(w.allotIds&&w.allotIds.length>1?' | '+w.allotIds.length+' allotments combined':'')+'</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;margin-top:5px;font-size:10px;">'+
            '<div><div style="color:var(--text3);">Allotted</div><b>'+w.allotQty.toFixed(2)+'</b></div>'+
            '<div><div style="color:var(--text3);">Done</div><b style="color:#1565C0;">'+w.doneQty.toFixed(2)+'</b></div>'+
            '<div><div style="color:var(--text3);">Prev Billed</div><b style="color:#E65100;">'+inr(w.prevBilled)+'</b></div>'+
            '<div><div style="color:var(--text3);">Unbilled</div><b style="color:#2E7D32;">'+inr(w.unbilled)+'</b></div>'+
          '</div>'+
        '</div>'+
        '<div style="text-align:right;flex-shrink:0;">'+
          '<div style="font-size:9px;color:var(--text3);">Bill Amount</div>'+
          '<input class="finp bl-work-amt" data-idx="'+i+'" type="number" value="'+w.unbilled+'" '+
            'style="width:100px;text-align:right;padding:4px 6px;font-size:12px;font-weight:800;" onchange="blUpdateTotal()">'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');

  // Released deductions from previous bills — payable to party in this bill
  var partyRelDed=[];
  WA_BILLS.filter(function(b){return b.party_name===partyName&&b.party_type===partyType;}).forEach(function(b){
    var ded=[];try{ded=b.deductions?JSON.parse(b.deductions):[];}catch(e){}
    ded.filter(function(d){return d.released&&!d.is_advance_adj;}).forEach(function(d){
      partyRelDed.push({head:d.head,amount:d.amount,released_date:d.released_date,bill_no:b.bill_number,bill_ref:b.bill_ref||('Bill #'+b.bill_number),bill_date:b.bill_date});
    });
  });
  var totalRelDed=partyRelDed.reduce(function(s,d){return s+(parseFloat(d.amount)||0);},0);

  // Calculate advances for this party
  var partyAdvances=WA_ADVANCES.filter(function(a){
    return a.party_name===partyName&&a.party_type===partyType;
  });
  var totalAdvParty=partyAdvances.reduce(function(s,a){return s+(parseFloat(a.amount)||0);},0);

  // Store workRows for save
  window._blWorkRows=workRows;

  document.getElementById('exec-sheet-title').textContent='Generate Bill — '+partyName;
  document.getElementById('exec-sheet-body').innerHTML=
    // Party info
    '<div style="background:#E3F2FD;border-radius:10px;padding:8px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">'+
      '<div style="flex:1;font-size:13px;font-weight:800;color:#1565C0;">'+partyName+'</div>'+
      '<span style="font-size:10px;color:var(--text3);">Bill #'+nextBillNo+'</span>'+
    '</div>'+
    // Work selection
    '<div style="font-size:11px;font-weight:800;color:#333;margin-bottom:8px;">'+
      '&#9312; Select Works to Include in this Bill'+
    '</div>'+
    (workRows.length?workSelRows:'<div style="font-size:11px;color:var(--text3);padding:8px 0;">No work allotments found for this party.</div>')+
    // Advance info
    (function(){
      if(!partyAdvances.length) return '';
      // Cap advance adjustment to current bill amount
      var grossBillAmt=workRows.reduce(function(s,w){return s+(w.unbilled||0);},0);
      return '<div style="background:#FFF8E1;border-radius:10px;padding:10px 14px;margin-bottom:10px;">'+
        '<div style="font-size:11px;font-weight:800;color:#F57F17;margin-bottom:8px;">&#128181; Advance Adjustment</div>'+
        '<div style="font-size:10px;color:var(--text3);margin-bottom:8px;">Select advances to adjust against this bill. Amounts are capped to current bill value.</div>'+
        partyAdvances.map(function(adv,ai){
          var allot=WA_ALLOT.find(function(a){return a.id===adv.allot_id;})||{};
          var planRes=WA_PLANNED.find(function(r){return r.id===allot.boq_exec_resource_id;})||{};
          var resLabel=planRes.party_name||planRes.resource_category||allot.scope||adv.purpose||'';
          var advAmt=parseFloat(adv.amount)||0;
          var adjSoFar=parseFloat(adv.adjusted_amount)||0;
          var remaining=Math.max(0,advAmt-adjSoFar);
          var alreadyAdj=remaining<=0; // fully adjusted only when nothing left
          // Auto-cap: if bill < remaining advance, only adjust up to bill amount
          var defaultAdj=Math.min(remaining, grossBillAmt);
          return '<div style="padding:6px 0;border-bottom:1px solid #FFE0B2;">'+
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">'+
              '<input type="checkbox" id="adv-adj-'+ai+'" class="adv-adj-chk" data-adv-id="'+adv.id+'" data-amount="'+defaultAdj+'" data-max="'+remaining+'" '+(alreadyAdj?'disabled checked':'checked')+' style="width:15px;height:15px;accent-color:#F57F17;flex-shrink:0;" onchange="blAdvAdjChange(this,'+ai+')">'+
              '<div style="flex:1;font-size:11px;">'+
                (resLabel?'<b>'+resLabel+'</b> — ':'')+adv.date+
                (adv.payment_mode?' · '+adv.payment_mode:'')+
                (alreadyAdj?'<span style="font-size:9px;color:#C62828;margin-left:6px;">(fully adjusted)</span>':'')+
              '</div>'+
              '<span style="font-size:10px;color:var(--text3);">Total: <b style="color:#F57F17;">₹'+Number(advAmt).toLocaleString("en-IN")+'</b>'+(adjSoFar>0?' | Adj: <b style="color:#E65100;">₹'+Number(adjSoFar).toLocaleString("en-IN")+'</b> | Rem: <b style="color:#2E7D32;">₹'+Number(remaining).toLocaleString("en-IN")+'</b>':'')+'</span>'+
            '</div>'+
            (!alreadyAdj?
              '<div style="display:flex;align-items:center;gap:8px;padding:0 0 2px 23px;">'+
                '<span style="font-size:10px;color:var(--text3);">Adjust amount:</span>'+
                '<input id="adv-adj-amt-'+ai+'" type="number" value="'+defaultAdj+'" min="0" max="'+remaining+'" '+
                  'style="width:120px;padding:3px 8px;border:1px solid #FFE0B2;border-radius:5px;font-size:12px;font-weight:800;color:#F57F17;" '+
                  'onchange="blAdvAdjAmtChange(this,'+ai+')">'+
                '<span style="font-size:10px;color:var(--text3);">of ₹'+Number(remaining).toLocaleString("en-IN")+(defaultAdj<remaining?' <b style="color:#E65100;">(₹'+Number(remaining-defaultAdj).toLocaleString("en-IN")+' carried forward)</b>':'')+'</span>'+
              '</div>':'')+
          '</div>';
        }).join('')+
      '</div>';
    })()+
    // Released deductions info
    (totalRelDed>0?
      '<div style="background:#E8F5E9;border-radius:10px;padding:10px 14px;margin-bottom:10px;">'+
        '<div style="font-size:11px;font-weight:800;color:#2E7D32;margin-bottom:6px;">&#128176; Released Deductions (payable in this bill)</div>'+
        partyRelDed.map(function(d){
          return '<div style="display:flex;gap:8px;font-size:10px;padding:3px 0;">'+
            '<span style="background:#E8F5E9;color:#2E7D32;font-size:9px;font-weight:800;padding:1px 5px;border-radius:3px;">REL</span>'+
            '<span style="flex:1;">'+d.head+
              ' <span style="color:var(--text3);">Ref: <b>'+(d.bill_ref||'Bill #'+d.bill_no)+'</b>'+
              ' | Bill Date: '+fmtD(d.bill_date||'')+'</span>'+
              ' <span style="color:#2E7D32;font-weight:700;">Released: '+fmtD(d.released_date)+'</span>'+
            '</span>'+
            '<b style="color:#2E7D32;">&#8377;'+Number(d.amount||0).toLocaleString("en-IN")+'</b>'+
          '</div>';
        }).join('')+
        '<div style="font-size:10px;font-weight:800;color:#2E7D32;border-top:1px solid #C8E6C9;margin-top:6px;padding-top:4px;">Total Released: &#8377;'+Number(totalRelDed).toLocaleString("en-IN")+'</div>'+
      '</div>':'')+ 
    // Bill details
    '<div style="font-size:11px;font-weight:800;color:#333;margin:12px 0 8px;">&#9313; Bill Details</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">'+
      '<div><label class="flbl">Bill Date *</label><input id="bl-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
      '<div><label class="flbl">Bill Number</label><input id="bl-no" class="finp" value="'+nextBillNo+'"></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">'+
      '<div>'+
        '<label class="flbl">Gross Bill Amount (₹) *</label>'+
        '<input id="bl-amount" class="finp" type="number" style="font-weight:800;" readonly>'+
        '<div id="bl-adv-adj-display" style="font-size:10px;color:#F57F17;font-weight:700;margin-top:3px;"></div>'+
        '<div style="font-size:9px;color:var(--text3);margin-top:2px;">Auto-calculated (advance deducted if selected)</div>'+
      '</div>'+
      '<div><label class="flbl">Description</label><input id="bl-desc" class="finp" placeholder="e.g. RA Bill No.1 for work done upto..."></div>'+
    '</div>'+
    // Deductions
    '<div style="font-size:11px;font-weight:800;color:#333;margin-bottom:8px;">&#9314; Deductions (optional)</div>'+
    '<div id="bl-deductions">'+
      '<div id="bl-ded-list"></div>'+
      '<button onclick="blAddDeduction()" style="font-size:10px;padding:4px 10px;background:#FFF3E0;color:#E65100;border:1px solid #FFCC80;border-radius:5px;cursor:pointer;font-weight:700;">+ Add Deduction</button>'+
    '</div>';

  // Calculate initial total
  setTimeout(function(){blUpdateTotal();},50);

  var sf=document.getElementById('exec-sheet-foot');sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#1565C0;color:white;';
  sb.innerHTML='&#128203; Generate Bill';
  sb.onclick=function(){execSaveBill(partyType,partyName,projId,nextBillNo);};
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-exec','sh-exec');
}


function blAdvAdjChange(chk, ai){
  // When checkbox toggled, enable/disable the amount input
  var amtInp=document.getElementById('adv-adj-amt-'+ai);
  if(amtInp){
    amtInp.disabled=!chk.checked;
    if(chk.checked){
      // Restore to max if was cleared
      var max=parseFloat(chk.getAttribute('data-max'))||0;
      if(!parseFloat(amtInp.value)) amtInp.value=max;
    }
  }
  // Update data-amount from input
  blAdvAdjAmtChange(amtInp,ai);
  blUpdateTotal();
}

function blAdvAdjAmtChange(inp, ai){
  if(!inp) return;
  var chk=document.getElementById('adv-adj-'+ai);
  if(!chk) return;
  var max=parseFloat(chk.getAttribute('data-max'))||0;
  var val=Math.min(Math.max(0,parseFloat(inp.value)||0),max);
  inp.value=val;
  chk.setAttribute('data-amount',val);
  blUpdateTotal();
}

function blUpdateTotal(){
  var total=0;
  document.querySelectorAll('.bl-work-chk').forEach(function(chk){
    if(chk.checked){
      var idx=parseInt(chk.getAttribute('data-idx'));
      var amtInp=document.querySelector('.bl-work-amt[data-idx="'+idx+'"]');
      total+=parseFloat(amtInp&&amtInp.value)||0;
    }
  });
  // Sum selected advance adjustments (use input field values for partial)
  var advAdj=0;
  document.querySelectorAll('.adv-adj-chk:checked:not([disabled])').forEach(function(chk){
    var ai=chk.id.replace('adv-adj-','');
    var amtInp=document.getElementById('adv-adj-amt-'+ai);
    var amt=amtInp?parseFloat(amtInp.value)||0:parseFloat(chk.getAttribute('data-amount'))||0;
    advAdj+=amt;
    chk.setAttribute('data-amount',amt); // keep in sync for save
  });
  var net=Math.max(0,total-advAdj);
  var amtEl=document.getElementById('bl-amount');
  if(amtEl) amtEl.value=Math.round(net);
  // Show advance deduction display
  var advEl=document.getElementById('bl-adv-adj-display');
  if(advEl) advEl.textContent=advAdj>0?'Less Advance Adjustment: ₹'+advAdj.toLocaleString('en-IN'):'';
}

var BL_DEDUCTIONS=[];
function blAddDeduction(){
  var id='ded-'+Date.now();
  BL_DEDUCTIONS.push({id:id,head:'',amount:0});
  var container=document.getElementById('bl-ded-list');
  if(!container)return;
  var div=document.createElement('div');
  div.id=id;
  div.style.cssText='display:grid;grid-template-columns:1fr 120px 30px;gap:6px;margin-bottom:6px;align-items:center;';
  div.innerHTML=
    '<input class="finp bl-ded-head" placeholder="e.g. Retention Money, Security Deposit..." style="margin:0;">'+
    '<input class="finp bl-ded-amt" type="number" placeholder="Amount" style="margin:0;text-align:right;">'+
    '<button onclick="blRemoveDeduction(\''+id+'\')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:16px;">&#215;</button>';
  container.appendChild(div);
}
function blRemoveDeduction(id){
  BL_DEDUCTIONS=BL_DEDUCTIONS.filter(function(d){return d.id!==id;});
  var el=document.getElementById(id);if(el)el.remove();
}

async function execSaveBill(partyType,partyName,projId,billNo){
  var date=gv('bl-date'),amount=parseFloat(gv('bl-amount'))||0;
  if(!date){toast('Bill date required','warning');return;}

  // Collect adjusted advance IDs
  var adjAdvIds=[];
  var adjAdvTotal=0;
  document.querySelectorAll('.adv-adj-chk:checked:not([disabled])').forEach(function(chk){
    adjAdvIds.push(chk.getAttribute('data-adv-id'));
    adjAdvTotal+=parseFloat(chk.getAttribute('data-amount'))||0;
  });

  // Collect selected work items
  var selectedItems=[];
  document.querySelectorAll('.bl-work-chk:checked').forEach(function(chk){
    var idx=parseInt(chk.getAttribute('data-idx'));
    var amtInp=document.querySelector('.bl-work-amt[data-idx="'+idx+'"]');
    var amt=parseFloat(amtInp&&amtInp.value)||0;
    var w=window._blWorkRows&&window._blWorkRows[idx];
    if(w&&amt>0){
      selectedItems.push({
        allot_id:w.a.id,
        res_name:w.resName,
        done_qty:w.doneQty,
        rate:w.allotRate,
        amount:amt
      });
    }
  });
  if(!selectedItems.length){toast('Select at least one work item','warning');return;}

  // Gross = sum of selected items; Net = Gross - advance adjustment
  var grossAmount=selectedItems.reduce(function(s,x){return s+(parseFloat(x.amount)||0);},0);
  amount=Math.max(0,grossAmount-adjAdvTotal);
  if(grossAmount===0){toast('Bill amount cannot be zero','warning');return;}

  // Collect deductions (include advance adjustment as a deduction line)
  var deductions=[];
  if(adjAdvTotal>0){
    deductions.push({id:'adv-adj-'+Date.now(),head:'Advance Adjustment',amount:adjAdvTotal,released:false,is_advance_adj:true,advance_ids:adjAdvIds});
  }
  document.querySelectorAll('#bl-ded-list > div').forEach(function(row){
    var head=(row.querySelector('.bl-ded-head')||{}).value||'';
    var amt=parseFloat((row.querySelector('.bl-ded-amt')||{}).value)||0;
    if(head&&amt>0) deductions.push({id:'d'+Date.now()+Math.random().toString(36).slice(2),head:head,amount:amt,released:false});
  });

  // Generate unique bill ref: BILL/YYYY/NNNN (global across all bills)
  var billYear=new Date().getFullYear();
  var billSeq=String(WA_BILLS.length+1).padStart(4,'0');
  var billRef='BILL/'+billYear+'/'+billSeq;

  try{
    var res=await sbInsert('work_bills',{
      project_id:projId,party_type:partyType,party_name:partyName,
      bill_number:parseInt(gv('bl-no'))||billNo,
      bill_ref:billRef,
      bill_date:date,bill_amount:Math.round(grossAmount),
      selected_items:JSON.stringify(selectedItems),
      deductions:deductions.length?JSON.stringify(deductions):null,
      description:gv('bl-desc')||null
    });
    if(res&&res[0]){
      WA_BILLS.push(res[0]);
      // Update adjusted_amount for each advance (cumulative partial tracking)
      if(adjAdvIds.length){
        // Collect per-advance amounts from checkboxes
        document.querySelectorAll('.adv-adj-chk:checked:not([disabled])').forEach(function(chk){
          var advId=chk.getAttribute('data-adv-id');
          var adjAmt=parseFloat(chk.getAttribute('data-amount'))||0;
          if(!adjAmt) return;
          var idx=WA_ADVANCES.findIndex(function(a){return a.id===advId;});
          if(idx>-1){
            var prev=parseFloat(WA_ADVANCES[idx].adjusted_amount)||0;
            var newAdj=prev+adjAmt;
            WA_ADVANCES[idx].adjusted_amount=newAdj;
            WA_ADVANCES[idx].adjusted_in_bill=res[0].id;
            sbUpdate('work_advances',advId,{adjusted_amount:newAdj,adjusted_in_bill:res[0].id}).catch(function(){});
          }
        });
      }
    }
    toast(billRef+' generated'+(adjAdvTotal?' — advance ₹'+adjAdvTotal.toLocaleString('en-IN')+' adjusted':''),'success');
    BL_DEDUCTIONS=[];
    window._blWorkRows=null;
    closeSheet('ov-exec','sh-exec');
    execRenderBills();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function execAddDeduction(billId){
  var bill=WA_BILLS.find(function(b){return b.id===billId;});
  if(!bill)return;
  var head=prompt('Deduction head (e.g. Retention Money, Security Deposit):');
  if(!head)return;
  var amtStr=prompt('Amount to deduct (₹):');
  var amt=parseFloat(amtStr)||0;
  if(!amt||amt<=0){toast('Enter valid amount','warning');return;}

  var deductions=[];try{deductions=bill.deductions?JSON.parse(bill.deductions):[];}catch(e){}
  deductions.push({id:'d'+Date.now(),head:head,amount:amt,released:false});

  try{
    await sbUpdate('work_bills',billId,{deductions:JSON.stringify(deductions)});
    var idx=WA_BILLS.findIndex(function(b){return b.id===billId;});
    if(idx>-1) WA_BILLS[idx].deductions=JSON.stringify(deductions);
    toast(head+' deduction added','success');
    execRenderBills();
  }catch(e){toast('Error: '+e.message,'error');}
}


function billDownloadAdvReceipt(billId, dedId){
  var bill=WA_BILLS.find(function(b){return b.id===billId;});
  if(!bill){toast('Bill not found','error');return;}
  var ded=[]; try{ded=bill.deductions?JSON.parse(bill.deductions):[];}catch(e){}
  var d=ded.find(function(x){return x.id===dedId;});
  if(!d){toast('Deduction not found','error');return;}

  // Find advances linked to this adjustment
  var advIds=d.advance_ids||[];
  var advList=WA_ADVANCES.filter(function(a){return advIds.indexOf(a.id)>-1;});

  var co=typeof COMPANY_DATA!=='undefined'?COMPANY_DATA:{};
  var projSel=document.getElementById('proj-mod-sel');
  var projName=projSel&&projSel.selectedIndex>=0?projSel.options[projSel.selectedIndex].text:'';
  var inr=function(n){return '\u20b9'+Number(n||0).toLocaleString('en-IN');};
  function fmtD(dt){if(!dt)return '—';var p=String(dt).split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:dt;}

  var rcptNo='ADVADJ/'+new Date().getFullYear()+'/'+String(WA_BILLS.indexOf(bill)+1).padStart(4,'0');

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Advance Adjustment — '+rcptNo+'</title>'+
    '<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;font-size:12px;padding:32px;color:#1a1a1a;}'+
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #F57F17;padding-bottom:12px;margin-bottom:16px;}'+
    '.co{font-size:17px;font-weight:900;color:#F57F17;}.co-info{font-size:10px;color:#555;margin-top:3px;}'+
    '.rcpt-title{font-size:18px;font-weight:900;color:#F57F17;text-align:right;}'+
    '.rcpt-no{font-size:12px;color:#555;text-align:right;margin-top:4px;}'+
    '.info-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #DDD;border-radius:8px;overflow:hidden;margin-bottom:14px;}'+
    '.info-cell{padding:10px 14px;}.info-cell+.info-cell{border-left:1px solid #DDD;}'+
    '.lbl{font-size:9px;font-weight:800;color:#888;text-transform:uppercase;margin-bottom:3px;}'+
    '.val{font-size:13px;font-weight:800;}'+
    '.amt-box{background:#FFF8E1;border:2px solid #F57F17;border-radius:12px;padding:18px;text-align:center;margin-bottom:14px;}'+
    '.amt-lbl{font-size:11px;color:#888;font-weight:700;margin-bottom:6px;}'+
    '.amt-val{font-size:30px;font-weight:900;color:#F57F17;}'+
    'table{width:100%;border-collapse:collapse;margin-bottom:14px;}'+
    'th{background:#F57F17;color:white;padding:7px 10px;font-size:10px;text-align:left;}'+
    'td{padding:7px 10px;font-size:11px;border-bottom:1px solid #EEE;}'+
    '.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;}'+
    '.sig-box{border-top:1.5px solid #333;padding-top:8px;text-align:center;font-size:10px;color:#555;}'+
    '@media print{button{display:none;}}</style></head><body>'+
    '<button onclick="window.print()" style="background:#F57F17;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;margin-bottom:16px;font-family:Arial;font-weight:700;">&#128438; Print / Save PDF</button>'+

    '<div class="hdr">'+
      '<div><div class="co">'+(co.name||'Company Name')+'</div>'+
        '<div class="co-info">'+(co.address||'')+(co.gstin?'<br>GSTIN: '+co.gstin:'')+'</div></div>'+
      '<div><div class="rcpt-title">ADVANCE ADJUSTMENT NOTE</div>'+
        '<div class="rcpt-no">Ref: '+rcptNo+'</div>'+
        '<div style="font-size:10px;color:#555;text-align:right;margin-top:3px;">Ref: '+(bill.bill_ref||'Bill #'+bill.bill_number)+' | Date: '+fmtD(bill.bill_date)+'</div>'+
      '</div>'+
    '</div>'+

    '<div class="info-grid">'+
      '<div class="info-cell"><div class="lbl">Party</div><div class="val">'+bill.party_name+'</div>'+
        '<div style="font-size:10px;color:#555;">'+(bill.party_type||'')+'</div></div>'+
      '<div class="info-cell"><div class="lbl">Project</div><div class="val">'+projName+'</div></div>'+
    '</div>'+

    '<div class="amt-box">'+
      '<div class="amt-lbl">ADVANCE ADJUSTED AGAINST '+(bill.bill_ref||'BILL #'+bill.bill_number)+'</div>'+
      '<div class="amt-val">'+inr(d.amount)+'</div>'+
      '<div style="font-size:11px;color:#888;margin-top:4px;">Gross Bill: '+inr(bill.bill_amount)+' | Net after adjustment: '+inr(Math.max(0,bill.bill_amount-d.amount))+'</div>'+
    '</div>'+

    (advList.length?
      '<div class="lbl" style="margin-bottom:6px;">ADVANCE PAYMENTS ADJUSTED</div>'+
      '<table><thead><tr><th>Date</th><th>Purpose</th><th>Mode</th><th>Reference</th><th style="text-align:right;">Amount</th></tr></thead><tbody>'+
      advList.map(function(adv){
        return '<tr><td>'+fmtD(adv.date)+'</td><td>'+(adv.purpose||'—')+'</td><td>'+(adv.payment_mode||'—')+'</td><td>'+(adv.reference||'—')+'</td><td style="text-align:right;font-weight:800;color:#F57F17;">'+inr(adv.amount)+'</td></tr>';
      }).join('')+
      '</tbody></table>':'')+

    '<div class="sig-grid">'+
      '<div class="sig-box"><div style="height:40px;"></div><div style="font-weight:800;">'+(co.name||'Company')+'</div><div>Authorised Signatory</div></div>'+
      '<div class="sig-box"><div style="height:40px;"></div><div style="font-weight:800;">'+bill.party_name+'</div><div>Acknowledged By</div></div>'+
    '</div>'+
  '</body></html>';

  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else toast('Allow popups to download receipt','warning');
}

async function execReleaseDeduction(billId,dedId){
  var bill=WA_BILLS.find(function(b){return b.id===billId;});
  if(!bill)return;
  var deductions=[];try{deductions=bill.deductions?JSON.parse(bill.deductions):[];}catch(e){}
  var ded=deductions.find(function(d){return d.id===dedId;});
  if(!ded)return;

  // Show release form with date
  document.getElementById('exec-sheet-title').textContent='Release Deduction';
  document.getElementById('exec-sheet-body').innerHTML=
    '<div style="background:#E8F5E9;border-radius:10px;padding:12px 14px;margin-bottom:12px;">'+
      '<div style="font-size:12px;font-weight:800;color:#2E7D32;margin-bottom:4px;">'+ded.head+'</div>'+
      '<div style="font-size:11px;color:#555;">Amount: <b>&#8377;'+Number(ded.amount||0).toLocaleString("en-IN")+'</b></div>'+
      '<div style="font-size:10px;color:var(--text3);">Bill: '+(bill.bill_ref||'Bill #'+bill.bill_number)+' | Bill Date: '+fmtD(bill.bill_date)+'</div>'+
    '</div>'+
    '<label class="flbl">Release Date *</label>'+
    '<input id="rel-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'">'+
    '<label class="flbl" style="margin-top:8px;">Remarks (optional)</label>'+
    '<input id="rel-remarks" class="finp" placeholder="e.g. Released after DLP period, Final settlement...">';

  var sf=document.getElementById('exec-sheet-foot');sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#2E7D32;color:white;';
  sb.innerHTML='&#10003; Confirm Release';
  sb.onclick=async function(){
    var relDate=gv('rel-date');
    var relRemarks=gv('rel-remarks');
    if(!relDate){toast('Release date required','warning');return;}
    ded.released=true;
    ded.released_date=relDate;
    ded.released_remarks=relRemarks||undefined;
    try{
      await sbUpdate('work_bills',billId,{deductions:JSON.stringify(deductions)});
      var idx=WA_BILLS.findIndex(function(b){return b.id===billId;});
      if(idx>-1) WA_BILLS[idx].deductions=JSON.stringify(deductions);
      toast('Deduction released — ₹'+Number(ded.amount||0).toLocaleString('en-IN')+' on '+relDate,'success');
      closeSheet('ov-exec','sh-exec');
      execRenderBills();
    }catch(e){toast('Error: '+e.message,'error');}
  };
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-exec','sh-exec');
}

async function execOpenPayment(billId,partyKey,projId,balAmount){
  var parts=partyKey.split('::');
  var partyType=parts[0],partyName=parts[1];
  document.getElementById('exec-sheet-title').textContent='Record Payment';
  document.getElementById('exec-sheet-body').innerHTML=
    '<div style="background:#E8F5E9;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:11px;">'+
      '<div style="font-weight:800;color:#2E7D32;">Balance Due: \u20b9'+Number(balAmount).toLocaleString('en-IN')+'</div>'+
    '</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">Payment Date *</label><input id="py-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
      '<div><label class="flbl">Amount (₹) *</label><input id="py-amount" class="finp" type="number" value="'+Math.max(0,balAmount)+'"></div>'+
    '</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">Payment Mode</label>'+
        '<select id="py-mode" class="fsel">'+
          '<option>Bank Transfer</option><option>Cheque</option><option>Cash</option><option>UPI</option>'+
        '</select>'+
      '</div>'+
      '<div><label class="flbl">Reference / UTR</label><input id="py-ref" class="finp" placeholder="UTR/Cheque no."></div>'+
    '</div>'+
    '<label class="flbl">Remarks</label>'+
    '<input id="py-remarks" class="finp" placeholder="Payment remarks...">';

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
      payment_mode:gv('py-mode')||null,
      reference:gv('py-ref')||null,
      remarks:gv('py-remarks')||null
    });
    if(res&&res[0]) WA_PAYMENTS.push(res[0]);
    toast('Payment of \u20b9'+amount.toLocaleString('en-IN')+' recorded!','success');
    closeSheet('ov-exec','sh-exec');
    execRenderBills();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

function execDownloadBillPDF(billId){
  var b=WA_BILLS.find(function(x){return x.id===billId;});
  if(!b){toast('Bill not found','error');return;}

  var co=typeof COMPANY_DATA!=='undefined'?COMPANY_DATA:{};
  var projSel=document.getElementById('proj-mod-sel');
  var projName=projSel&&projSel.selectedIndex>=0?projSel.options[projSel.selectedIndex].text:'';
  var inr=function(n){return '₹'+Number(n||0).toLocaleString('en-IN');};
  function fmtD(d){if(!d)return '—';if(/^\d{4}-\d{2}-\d{2}/.test(d)){var p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0];}return d;}

  // Deductions
  var deductions=[];try{deductions=b.deductions?JSON.parse(b.deductions):[];}catch(e){}
  var activeDed=deductions.filter(function(d){return !d.released;});
  var relDed=deductions.filter(function(d){return d.released;});
  var totalDed=activeDed.reduce(function(s,d){return s+(parseFloat(d.amount)||0);},0);
  var totalRel=relDed.reduce(function(s,d){return s+(parseFloat(d.amount)||0);},0);
  var grossAmt=parseFloat(b.bill_amount)||0;
  var netPayable=grossAmt-totalDed;

  // Selected work items
  var selItems=[];try{selItems=b.selected_items?JSON.parse(b.selected_items):[];}catch(e){}

  // Payments for this bill
  var billPays=WA_PAYMENTS.filter(function(p){return p.bill_id===b.id;});
  var totalPaid=billPays.reduce(function(s,p){return s+(parseFloat(p.amount)||0);},0);
  var balDue=Math.max(0,netPayable-totalPaid);

  // Work items table rows
  var workRows=selItems.length
    ? selItems.map(function(si,i){
        var allot=WA_ALLOT.find(function(a){return a.id===si.allot_id;})||{};
        var planRes=WA_PLANNED.find(function(r){return r.id===allot.boq_exec_resource_id;})||{};
        var resName=planRes.party_name||planRes.resource_category||si.res_name||'';
        var boqItem=WA_ITEMS.find(function(x){return x.id===allot.boq_item_id;})||{};
        return '<tr><td style="padding:7px 10px;border-bottom:1px solid #EEE;">'+(i+1)+'</td>'+
          '<td style="padding:7px 10px;border-bottom:1px solid #EEE;font-weight:700;">'+(resName||si.res_name||'—')+'<br>'+
            '<small style="font-weight:400;color:#555;">'+(boqItem.item_code?'['+boqItem.item_code+'] '+(boqItem.short_name||boqItem.description||''):'')+'</small></td>'+
          '<td style="padding:7px 10px;border-bottom:1px solid #EEE;text-align:right;">'+( si.done_qty?si.done_qty.toFixed(2):'—')+'</td>'+
          '<td style="padding:7px 10px;border-bottom:1px solid #EEE;text-align:right;">'+inr(si.rate||0)+'</td>'+
          '<td style="padding:7px 10px;border-bottom:1px solid #EEE;text-align:right;font-weight:800;">'+inr(si.amount)+'</td>'+
        '</tr>';
      }).join('')
    : '<tr><td colspan="5" style="padding:10px;color:#888;text-align:center;">No work items recorded</td></tr>';

  // Deduction rows
  var dedRows=activeDed.length
    ? activeDed.map(function(d){
        return '<tr><td colspan="4" style="padding:6px 10px;border-bottom:1px solid #EEE;">'+d.head+'</td>'+
          '<td style="padding:6px 10px;border-bottom:1px solid #EEE;text-align:right;color:#E65100;font-weight:700;">('+inr(d.amount)+')</td></tr>';
      }).join('') : '';

  var relRows=relDed.length
    ? relDed.map(function(d){
        return '<tr><td colspan="4" style="padding:5px 10px;color:#2E7D32;font-size:10px;border-bottom:1px solid #F5F5F5;">'+
          d.head+' <span style="font-size:9px;">(Released: '+fmtD(d.released_date)+')</span></td>'+
          '<td style="padding:5px 10px;text-align:right;color:#2E7D32;font-size:10px;">Released</td></tr>';
      }).join('') : '';

  // Payment rows
  var payRows=billPays.length
    ? billPays.map(function(p){
        return '<tr>'+
          '<td style="padding:6px 10px;border-bottom:1px solid #EEE;">'+fmtD(p.payment_date)+'</td>'+
          '<td style="padding:6px 10px;border-bottom:1px solid #EEE;">'+(p.payment_mode||'—')+'</td>'+
          '<td style="padding:6px 10px;border-bottom:1px solid #EEE;">'+(p.reference||'—')+'</td>'+
          '<td style="padding:6px 10px;border-bottom:1px solid #EEE;text-align:right;font-weight:800;color:#2E7D32;">'+inr(p.amount)+'</td>'+
        '</tr>';
      }).join('')
    : '<tr><td colspan="4" style="padding:10px;color:#888;text-align:center;">No payments recorded</td></tr>';

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8">'+
    '<title>'+(b.bill_ref||'Bill #'+b.bill_number)+' — '+b.party_name+'</title>'+
    '<style>'+
      '*{box-sizing:border-box;margin:0;padding:0;}'+
      'body{font-family:Arial,sans-serif;font-size:11px;padding:24px;color:#1a1a1a;}'+
      '.hdr{display:flex;justify-content:space-between;border-bottom:3px solid #1565C0;padding-bottom:10px;margin-bottom:14px;}'+
      '.co-name{font-size:16px;font-weight:900;color:#1565C0;}.co-info{font-size:10px;color:#555;margin-top:3px;}'+
      '.bill-title{font-size:20px;font-weight:900;color:#1565C0;}.bill-no{font-size:12px;color:#555;margin-top:4px;}'+
      'table{width:100%;border-collapse:collapse;margin-bottom:14px;}'+
      'th{background:#1565C0;color:white;padding:7px 10px;font-size:10px;text-align:left;}'+
      '.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #DDD;border-radius:8px;overflow:hidden;margin-bottom:14px;}'+
      '.sum-cell{padding:10px 12px;text-align:center;border-right:1px solid #DDD;}'+
      '.sum-cell:last-child{border-right:none;}'+
      '.sum-lbl{font-size:9px;font-weight:800;color:#888;text-transform:uppercase;margin-bottom:3px;}'+
      '.sum-val{font-size:14px;font-weight:900;}'+
      '.sig-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:40px;}'+
      '.sig-box{border-top:1.5px solid #333;padding-top:6px;text-align:center;font-size:10px;color:#555;}'+
      '@media print{button{display:none;}}'+
    '</style></head><body>'+
    '<button onclick="window.print()" style="background:#1565C0;color:white;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;margin-bottom:16px;font-family:Arial;font-weight:700;">Print / Save PDF</button>'+

    // Header
    '<div class="hdr">'+
      '<div><div class="co-name">'+(co.name||'Company Name')+'</div>'+
        '<div class="co-info">'+(co.address||'')+(co.gstin?'<br>GSTIN: '+co.gstin:'')+'</div></div>'+
      '<div style="text-align:right;">'+
        '<div class="bill-title">BILL / INVOICE</div>'+
        '<div class="bill-no">'+(b.bill_ref||'Bill #'+b.bill_number)+'</div>'+
        '<div style="font-size:10px;color:#555;margin-top:3px;">Date: '+fmtD(b.bill_date)+'</div>'+
      '</div>'+
    '</div>'+

    // Party + Project info
    '<div style="display:grid;grid-template-columns:1fr 1fr;border:1px solid #DDD;border-radius:8px;overflow:hidden;margin-bottom:14px;">'+
      '<div style="padding:10px 14px;border-right:1px solid #DDD;">'+
        '<div style="font-size:9px;font-weight:800;color:#888;margin-bottom:3px;">PARTY</div>'+
        '<div style="font-size:14px;font-weight:800;">'+b.party_name+'</div>'+
        '<div style="font-size:10px;color:#555;">'+(b.party_type||'')+'</div>'+
      '</div>'+
      '<div style="padding:10px 14px;">'+
        '<div style="font-size:9px;font-weight:800;color:#888;margin-bottom:3px;">PROJECT</div>'+
        '<div style="font-size:12px;font-weight:800;">'+projName+'</div>'+
        (b.description?'<div style="font-size:10px;color:#555;margin-top:3px;">'+b.description+'</div>':'')+
      '</div>'+
    '</div>'+

    // Summary bar
    '<div class="summary-grid">'+
      '<div class="sum-cell"><div class="sum-lbl">Gross Amount</div><div class="sum-val" style="color:#1565C0;">'+inr(grossAmt)+'</div></div>'+
      '<div class="sum-cell"><div class="sum-lbl">Deductions</div><div class="sum-val" style="color:#E65100;">'+inr(totalDed)+'</div></div>'+
      '<div class="sum-cell"><div class="sum-lbl">Net Payable</div><div class="sum-val" style="color:#1565C0;">'+inr(netPayable)+'</div></div>'+
      '<div class="sum-cell"><div class="sum-lbl">Balance Due</div><div class="sum-val" style="color:'+(balDue>0?'#C62828':balDue<0?'#6A1B9A':'#2E7D32')+';">'+inr(balDue)+'</div></div>'+
    '</div>'+

    // Work items table
    '<div style="font-size:11px;font-weight:800;color:#333;margin-bottom:6px;">Work / Resource Details</div>'+
    '<table>'+
      '<thead><tr><th style="width:30px;">#</th><th>Resource / Work</th><th style="text-align:right;width:80px;">Qty</th><th style="text-align:right;width:80px;">Rate</th><th style="text-align:right;width:100px;">Amount</th></tr></thead>'+
      '<tbody>'+workRows+'</tbody>'+
      '<tfoot>'+
        '<tr style="background:#EFF6FF;"><td colspan="4" style="padding:7px 10px;font-weight:900;text-align:right;">Gross Total</td>'+
          '<td style="padding:7px 10px;font-weight:900;text-align:right;color:#1565C0;">'+inr(grossAmt)+'</td></tr>'+
        (dedRows?dedRows:'')+
        (relRows?relRows:'')+
        (activeDed.length?'<tr style="background:#FFF3E0;"><td colspan="4" style="padding:7px 10px;font-weight:900;text-align:right;">Net Payable (after deductions)</td>'+
          '<td style="padding:7px 10px;font-weight:900;text-align:right;color:#1565C0;">'+inr(netPayable)+'</td></tr>':'')+
      '</tfoot>'+
    '</table>'+

    // Payments table
    (billPays.length?
      '<div style="font-size:11px;font-weight:800;color:#333;margin-bottom:6px;">Payment History</div>'+
      '<table>'+
        '<thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th style="text-align:right;">Amount</th></tr></thead>'+
        '<tbody>'+payRows+'</tbody>'+
        '<tfoot><tr style="background:#E8F5E9;">'+
          '<td colspan="3" style="padding:7px 10px;font-weight:900;text-align:right;">Total Paid</td>'+
          '<td style="padding:7px 10px;font-weight:900;text-align:right;color:#2E7D32;">'+inr(totalPaid)+'</td>'+
        '</tr><tr style="background:'+(balDue>0?'#FFEBEE':'#E8F5E9')+';"><td colspan="3" style="padding:7px 10px;font-weight:900;text-align:right;">Balance Due</td>'+
          '<td style="padding:7px 10px;font-weight:900;text-align:right;color:'+(balDue>0?'#C62828':balDue<0?'#6A1B9A':'#2E7D32')+';">'+inr(balDue)+'</td>'+
        '</tr></tfoot>'+
      '</table>'
    :'')+

    // Signatures
    '<div class="sig-grid">'+
      '<div class="sig-box"><div style="height:40px;"></div><div style="font-weight:800;">'+b.party_name+'</div><div>Party Signature</div></div>'+
      '<div class="sig-box"><div style="height:40px;"></div><div style="font-weight:800;">Site Engineer</div><div>Verified By</div></div>'+
      '<div class="sig-box"><div style="height:40px;"></div><div style="font-weight:800;">'+(co.name||'Management')+'</div><div>Authorized By</div></div>'+
    '</div>'+
  '</body></html>';

  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else toast('Allow popups to download PDF','warning');
}


async function execOpenAdvance(partyKey,projId){
  var parts=partyKey.split('::');
  var partyType=parts[0],partyName=parts[1];
  var inr=function(n){return '\u20b9'+Number(n||0).toLocaleString('en-IN');};

  // Get allotments for this party
  var partyAllots=WA_ALLOT.filter(function(a){return a.party_name===partyName&&a.exec_type===partyType;});
  if(!partyAllots.length){toast('No allotments found for this party','warning');return;}

  var allotOpts=partyAllots.map(function(a){
    var planRes=WA_PLANNED.find(function(r){return r.id===a.boq_exec_resource_id;})||{};
    var resLabel=planRes.party_name||planRes.resource_category||a.scope||'Item';
    var amt=Math.round((parseFloat(a.qty)||0)*(parseFloat(a.rate)||0));
    return '<option value="'+a.id+'">['+resLabel+'] '+a.qty+' '+(a.unit||'')+' @ \u20b9'+a.rate+' = '+inr(amt)+'</option>';
  }).join('');

  document.getElementById('exec-sheet-title').textContent='Record Advance — '+partyName;
  document.getElementById('exec-sheet-body').innerHTML=
    '<div style="background:#FFF8E1;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:11px;">'+
      '<div style="font-weight:800;color:#F57F17;margin-bottom:4px;">&#128181; Advance Payment to '+partyName+'</div>'+
      '<div style="color:var(--text3);">Advance will be deducted from future bill payments</div>'+
    '</div>'+
    '<div style="margin-bottom:8px;"><label class="flbl">Allotment / Work Order *</label>'+
      '<select id="adv-allot" class="fsel">'+
        '<option value="">— Select Allotment —</option>'+allotOpts+
      '</select>'+
    '</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">Payment Date *</label><input id="adv-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
      '<div><label class="flbl">Amount (₹) *</label><input id="adv-amount" class="finp" type="number" placeholder="0"></div>'+
    '</div>'+
    '<div class="g2">'+
      '<div><label class="flbl">Payment Mode</label>'+
        '<select id="adv-mode" class="fsel">'+
          '<option>Bank Transfer</option><option>Cheque</option><option>Cash</option><option>UPI</option>'+
        '</select>'+
      '</div>'+
      '<div><label class="flbl">Reference / UTR</label><input id="adv-ref" class="finp" placeholder="UTR / Cheque no."></div>'+
    '</div>'+
    '<label class="flbl">Purpose / Remarks *</label>'+
    '<input id="adv-purpose" class="finp" placeholder="e.g. Mobilization advance, Advance against PO-001">';

  var sf=document.getElementById('exec-sheet-foot');sf.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#F57F17;color:white;';
  sb.innerHTML='&#128181; Record Advance';
  sb.onclick=function(){execSaveAdvance(partyType,partyName,projId);};
  sf.appendChild(cb);sf.appendChild(sb);
  openSheet('ov-exec','sh-exec');
}

async function execSaveAdvance(partyType,partyName,projId){
  var allotId=(document.getElementById('adv-allot')||{}).value||'';
  var date=gv('adv-date'),amount=parseFloat(gv('adv-amount'))||0;
  var purpose=(gv('adv-purpose')||'').trim();
  if(!allotId){toast('Select an allotment','warning');return;}
  if(!date||!amount){toast('Date and amount required','warning');return;}
  if(!purpose){toast('Purpose/remarks required','warning');return;}
  try{
    var res=await sbInsert('work_advances',{
      project_id:projId,party_type:partyType,party_name:partyName,
      allot_id:allotId,date:date,amount:amount,
      payment_mode:gv('adv-mode')||null,
      reference:gv('adv-ref')||null,
      purpose:purpose
    });
    if(res&&res[0]) WA_ADVANCES.push(res[0]);
    toast('Advance of \u20b9'+amount.toLocaleString('en-IN')+' recorded!','success');
    closeSheet('ov-exec','sh-exec');
    execRenderBills();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function execDelAdvance(id){
  if(!confirm('Delete this advance payment record?'))return;
  WA_ADVANCES=WA_ADVANCES.filter(function(a){return a.id!==id;});
  execRenderBills();
  try{await sbDelete('work_advances',id);}catch(e){console.error(e);}
  toast('Advance deleted','success');
}
async function execDelBill(id){
  var hasPaid=WA_PAYMENTS.some(function(p){return p.bill_id===id;});
  var msg=hasPaid?'This bill has payments.\\nDeleting will also delete all related payments. Continue?':'Delete this bill?';
  if(!confirm(msg))return;
  if(hasPaid){
    var relPays=WA_PAYMENTS.filter(function(p){return p.bill_id===id;});
    for(var i=0;i<relPays.length;i++) try{await sbDelete('work_payments',relPays[i].id);}catch(e){}
    WA_PAYMENTS=WA_PAYMENTS.filter(function(p){return p.bill_id!==id;});
  }
  WA_BILLS=WA_BILLS.filter(function(b){return b.id!==id;});
  execRenderBills();
  try{await sbDelete('work_bills',id);toast('Bill deleted','success');}catch(e){console.error(e);}
}


async function execDeleteDeduction(billId,dedId){
  if(!confirm('Delete this deduction?'))return;
  var bill=WA_BILLS.find(function(b){return b.id===billId;});
  if(!bill)return;
  var deductions=[];try{deductions=bill.deductions?JSON.parse(bill.deductions):[];}catch(e){}
  deductions=deductions.filter(function(d){return d.id!==dedId;});
  try{
    await sbUpdate('work_bills',billId,{deductions:deductions.length?JSON.stringify(deductions):null});
    var idx=WA_BILLS.findIndex(function(b){return b.id===billId;});
    if(idx>-1) WA_BILLS[idx].deductions=deductions.length?JSON.stringify(deductions):null;
    toast('Deduction deleted','success');
    execRenderBills();
  }catch(e){toast('Error: '+e.message,'error');}
}

async function execDelPayment(id){
  if(!confirm('Delete this payment record?'))return;
  WA_PAYMENTS=WA_PAYMENTS.filter(function(p){return p.id!==id;});
  execRenderBills();
  try{await sbDelete('work_payments',id);}catch(e){console.error(e);}
}


// ════════════════════════════════════════════════════════════════
// GRN (Goods Received Note) MODULE
// ════════════════════════════════════════════════════════════════
var GRN_ITEMS=[], GRN_ALLOTS=[], GRN_PROJ_ID='';

function grnEnsureContainer(){
  if(!document.getElementById('grn-content')){
    var div=document.createElement('div');
    div.id='grn-content'; div.style.cssText='padding:12px;';
    var ap=document.getElementById('app-projects');
    if(ap) ap.appendChild(div);
  }
}

async function grnLoadItems(){
  grnEnsureContainer();
  var el=document.getElementById('grn-content'); if(!el) return;
  var projId=PROJ_MOD_SEL_ID||'';
  if(!projId){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">Select a project from the dropdown above</div>';
    return;
  }
  GRN_PROJ_ID=projId;
  el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text3);">&#9203; Loading...</div>';
  try{
    var r=await Promise.all([
      sbFetch('grn_entries',{select:'*',filter:'project_id=eq.'+projId,order:'created_at.desc'}),
      sbFetch('boq_exec_resources',{select:'*',filter:'project_id=eq.'+projId+'&exec_type=eq.vendor',order:'created_at.desc'})
    ]);
    GRN_ITEMS  = Array.isArray(r[0])?r[0]:[];
    GRN_ALLOTS = Array.isArray(r[1])?r[1]:[];
  }catch(e){
    GRN_ITEMS=[]; GRN_ALLOTS=[];
    console.warn('GRN load:',e.message);
  }
  grnRender();
}

function grnRender(){
  var el=document.getElementById('grn-content'); if(!el) return;
  var projId=GRN_PROJ_ID||PROJ_MOD_SEL_ID;
  var projSel=document.getElementById('proj-mod-sel');
  var projName=projSel&&projSel.selectedIndex>=0?projSel.options[projSel.selectedIndex].text:'';

  // Summary
  var totalGRNs=GRN_ITEMS.length;
  var pendingAllots=GRN_ALLOTS.filter(function(a){
    return !GRN_ITEMS.some(function(g){return g.allot_id===a.id&&(g.status==='accepted'||g.approval_status==='approved');});
  }).length;

  var summaryBar=
    '<div style="display:flex;gap:8px;margin-bottom:12px;">'+
      '<div style="background:white;border-radius:10px;padding:8px 14px;border-left:4px solid #558B2F;flex:1;">'+
        '<div style="font-size:18px;font-weight:900;color:#558B2F;">'+totalGRNs+'</div>'+
        '<div style="font-size:10px;color:var(--text3);font-weight:700;">GRNs Created</div></div>'+
      '<div style="background:white;border-radius:10px;padding:8px 14px;border-left:4px solid #E65100;flex:1;">'+
        '<div style="font-size:18px;font-weight:900;color:#E65100;">'+pendingAllots+'</div>'+
        '<div style="font-size:10px;color:var(--text3);font-weight:700;">Pending GRN</div></div>'+
    '</div>';

  // Pending allotments (vendor type, no accepted GRN yet)
  var pendingSection='';
  var pending=GRN_ALLOTS.filter(function(a){
    var accepted=GRN_ITEMS.filter(function(g){return g.allot_id===a.id&&(g.status==='accepted'||g.approval_status==='approved');})
      .reduce(function(s,g){return s+(parseFloat(g.qty_received)||0);},0);
    return accepted < (parseFloat(a.qty)||0);
  });

  if(pending.length){
    var pendingRows=pending.map(function(a){
      var accepted=GRN_ITEMS.filter(function(g){return g.allot_id===a.id&&(g.status==='accepted'||g.approval_status==='approved');})
        .reduce(function(s,g){return s+(parseFloat(g.qty_received)||0);},0);
      var bal=Math.max(0,(parseFloat(a.qty)||0)-accepted);
      var boqItem=WA_ITEMS.find(function(i){return i.id===a.boq_item_id;})||{};
      var planRes=WA_PLANNED.find(function(p){return p.id===a.boq_exec_resource_id;})||{};
      var resName=planRes.party_name||planRes.resource_category||'';
      return '<div style="display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid #F5F5F5;background:white;">'+
        '<div style="flex:1;">'+
          (resName?'<div style="font-size:12px;font-weight:800;color:#1B5E20;">'+resName+'</div>':'')+''+
          '<div style="font-size:11px;font-weight:700;color:#333;">'+a.party_name+'</div>'+
          '<div style="font-size:10px;color:var(--text3);">'+(boqItem.item_code?'['+boqItem.item_code+'] ':'')+
            'Ordered: '+a.qty+' '+(a.unit||'')+' | Received: '+accepted.toFixed(2)+' | <b style="color:#E65100;">Pending: '+bal.toFixed(2)+'</b></div>'+
        '</div>'+
        '<button onclick="grnOpenForm(\''+a.id+'\',\''+projId+'\')" '+
          'style="background:#558B2F;color:white;border:none;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:800;cursor:pointer;flex-shrink:0;">+ Create GRN</button>'+
      '</div>';
    }).join('');

    pendingSection=
      '<div style="background:white;border-radius:14px;overflow:hidden;margin-bottom:12px;">'+
        '<div style="padding:10px 14px;background:#F1FBF4;border-bottom:2px solid #C8E6C9;">'+
          '<div style="font-size:12px;font-weight:800;color:#558B2F;">&#128230; Pending Material Receipt</div>'+
          '<div style="font-size:10px;color:var(--text3);">Materials ordered but GRN not yet created</div>'+
        '</div>'+
        pendingRows+
      '</div>';
  }

  // GRN list
  var grnList='';
  if(GRN_ITEMS.length){
    var grnRows=GRN_ITEMS.map(function(g){
      var stCol={accepted:'#2E7D32',rejected:'#C62828',partial:'#F57F17'}[g.status]||'#555';
      var stLbl={accepted:'Accepted',rejected:'Rejected',partial:'Partial'}[g.status]||g.status;
      var allot=GRN_ALLOTS.find(function(a){return a.id===g.allot_id;})||{};
      var planRes=WA_PLANNED.find(function(p){return p.id===allot.boq_exec_resource_id;})||{};
      var resName=planRes.party_name||planRes.resource_category||allot.party_name||'';
      return '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid #F5F5F5;">'+
        '<div style="flex:1;">'+
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">'+
            '<span style="font-size:10px;font-weight:700;">'+g.grn_number+'</span>'+
            '<span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:4px;background:'+stCol+'20;color:'+stCol+';">'+stLbl+'</span>'+
            (g.approval_status==='approved'
              ? '<span style="font-size:9px;background:#E3F2FD;color:#1565C0;padding:1px 6px;border-radius:4px;font-weight:700;">&#10003; Approved</span>'
              : '<span style="font-size:9px;background:#FFF3E0;color:#E65100;padding:1px 6px;border-radius:4px;font-weight:700;">&#9203; Pending Approval</span>')+
          '</div>'+
          (resName?'<div style="font-size:12px;font-weight:800;color:#1B5E20;">'+resName+'</div>':'')+''+
          '<div style="font-size:11px;font-weight:700;color:#333;">'+allot.party_name+'</div>'+
          '<div style="font-size:10px;color:var(--text3);">'+
            'Ordered: '+(allot.qty||'?')+' '+(allot.unit||'')+' | '+
            'Ordered: '+(allot.qty||'?')+' '+(allot.unit||'')+' | '+
            'Received: <b style="color:#2E7D32;">'+g.qty_received+' '+(g.unit||allot.unit||'')+'</b>'+
            ' | Date: '+(g.grn_date?g.grn_date.split('-').reverse().join('/'):'-')+
            (g.created_by?' | Created by: <b>'+g.created_by+'</b>':'')+
          '</div>'+
          (g.remarks?'<div style="font-size:9px;color:var(--text3);font-style:italic;">'+g.remarks+'</div>':'')+
          (g.rejection_reason?'<div style="font-size:9px;color:#C62828;">Reason: '+g.rejection_reason+'</div>':'')+
        '</div>'+
        '<div style="display:flex;gap:4px;flex-shrink:0;">'+
          '<button onclick="grnDownloadPDF(\''+g.id+'\')" style="background:#558B2F;color:white;border:none;border-radius:5px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:700;">&#11015; PDF</button>'+
          ((g.status==='accepted'||g.approval_status==='approved')?(
            g.store_updated
              ? '<span style="font-size:9px;background:#E8F5E9;color:#2E7D32;padding:3px 8px;border-radius:4px;font-weight:700;">&#10003; In Store</span>'
              : (g.approval_status==='approved'
                  ? '<button onclick="grnAddToStore(\''+g.id+'\')" style="background:#6A1B9A;color:white;border:none;border-radius:5px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:700;">+ Store</button>'
                  : '<button onclick="grnApprove(\''+g.id+'\')" style="background:#1565C0;color:white;border:none;border-radius:5px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:700;">&#10003; Approve &amp; Store</button>'
                  )
          ):'')+''+
          '<button onclick="grnDelete(\''+g.id+'\')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:16px;" title="Delete GRN">&#215;</button>'+
        '</div>'+
      '</div>';
    }).join('');

    grnList=
      '<div style="background:white;border-radius:14px;overflow:hidden;">'+
        '<div style="padding:10px 14px;background:#F8FAFC;border-bottom:2px solid #DDD;">'+
          '<div style="font-size:12px;font-weight:800;color:#333;">&#128196; GRN Records</div>'+
        '</div>'+grnRows+
      '</div>';
  }

  el.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'+
      '<div style="font-size:13px;font-weight:800;color:#558B2F;">&#128230; Goods Received Notes — '+projName+'</div>'+
    '</div>'+
    summaryBar+pendingSection+
    (grnList||(!pending.length?'<div style="text-align:center;padding:30px;color:var(--text3);background:white;border-radius:12px;">No vendor allotments found for this project</div>':''));
}

function grnOpenForm(allotId, projId){
  grnEnsureContainer();
  var allot=GRN_ALLOTS.find(function(a){return a.id===allotId;})||{};
  var planRes=WA_PLANNED.find(function(p){return p.id===allot.boq_exec_resource_id;})||{};
  var resName=planRes.party_name||planRes.resource_category||allot.party_name||'';
  var accepted=GRN_ITEMS.filter(function(g){return g.allot_id===allotId&&(g.status==='accepted'||g.approval_status==='approved');})
    .reduce(function(s,g){return s+(parseFloat(g.qty_received)||0);},0);
  var bal=Math.max(0,(parseFloat(allot.qty)||0)-accepted);

  var shTitle=document.getElementById('exec-sheet-title');
  var shBody =document.getElementById('exec-sheet-body');
  var shFoot =document.getElementById('exec-sheet-foot');
  if(!shTitle||!shBody||!shFoot){
    // Use grn sheet instead
    grnEnsureContainer();
    if(!document.getElementById('grn-sheet-overlay')){
      var ov=document.createElement('div');
      ov.id='grn-sheet-overlay';
      ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9998;display:none;';
      ov.onclick=function(){grnCloseSheet();};
      document.body.appendChild(ov);
      var sh=document.createElement('div');
      sh.id='grn-sheet';
      sh.style.cssText='position:fixed;bottom:0;left:0;right:0;background:white;border-radius:20px 20px 0 0;z-index:9999;display:none;max-height:85vh;overflow-y:auto;';
      sh.innerHTML='<div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;"><div id="grn-sheet-title" style="font-size:14px;font-weight:800;"></div><span onclick="grnCloseSheet()" style="cursor:pointer;font-size:18px;color:var(--text3);">&#10005;</span></div><div id="grn-sheet-body" style="padding:14px;"></div><div id="grn-sheet-foot" style="padding:10px 14px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end;"></div>';
      document.body.appendChild(sh);
    }
    shTitle=document.getElementById('grn-sheet-title');
    shBody =document.getElementById('grn-sheet-body');
    shFoot =document.getElementById('grn-sheet-foot');
    document.getElementById('grn-sheet-overlay').style.display='block';
    document.getElementById('grn-sheet').style.display='block';
  } else {
    openSheet('ov-exec','sh-exec');
  }

  shTitle.textContent='Create GRN';
  shBody.innerHTML=
    '<div style="background:#F1FBF4;border-radius:10px;padding:12px;margin-bottom:12px;">'+
      '<div style="font-size:12px;font-weight:800;color:#558B2F;margin-bottom:4px;">Material Details</div>'+
      '<div style="font-size:13px;font-weight:800;">'+resName+'</div>'+
      '<div style="font-size:11px;color:var(--text3);">Supplier: '+allot.party_name+
        ' | Ordered: '+allot.qty+' '+(allot.unit||'')+
        ' | Pending: <b style="color:#E65100;">'+bal.toFixed(2)+'</b></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">'+
      '<div><label class="flbl">GRN Date *</label><input id="grn-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
      '<div><label class="flbl">Qty Received *</label>'+
        '<div style="display:flex;gap:6px;align-items:center;">'+
          '<input id="grn-qty" class="finp" type="number" step="0.001" max="'+bal+'" placeholder="max '+bal.toFixed(2)+'" style="flex:1;">'+
          '<span style="font-size:12px;font-weight:700;color:var(--text3);">'+(allot.unit||'')+'</span>'+
        '</div></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">'+
      '<div><label class="flbl">Vehicle / Challan No</label><input id="grn-challan" class="finp" placeholder="Vehicle no / delivery challan"></div>'+
      '<div><label class="flbl">Invoice No</label><input id="grn-invoice" class="finp" placeholder="Supplier invoice number"></div>'+
    '</div>'+
    '<div style="margin-bottom:8px;"><label class="flbl">Quality Check *</label>'+
      '<div style="display:flex;gap:6px;margin-top:4px;">'+
        '<label style="display:flex;align-items:center;gap:6px;padding:7px 12px;border:1.5px solid #C8E6C9;border-radius:8px;cursor:pointer;flex:1;">'+
          '<input type="radio" name="grn-status" value="accepted" checked style="accent-color:#2E7D32;">'+
          '<span style="font-size:11px;font-weight:800;color:#2E7D32;">&#10003; Accepted</span></label>'+
        '<label style="display:flex;align-items:center;gap:6px;padding:7px 12px;border:1.5px solid #FFE0B2;border-radius:8px;cursor:pointer;flex:1;">'+
          '<input type="radio" name="grn-status" value="partial" style="accent-color:#F57F17;">'+
          '<span style="font-size:11px;font-weight:800;color:#F57F17;">&#9888; Partial</span></label>'+
        '<label style="display:flex;align-items:center;gap:6px;padding:7px 12px;border:1.5px solid #FFCDD2;border-radius:8px;cursor:pointer;flex:1;">'+
          '<input type="radio" name="grn-status" value="rejected" style="accent-color:#C62828;">'+
          '<span style="font-size:11px;font-weight:800;color:#C62828;">&#10005; Rejected</span></label>'+
      '</div>'+
    '</div>'+
    '<div><label class="flbl">Remarks / Quality Notes</label><textarea id="grn-remarks" class="ftxt" rows="2" placeholder="Quality observations, condition of material..."></textarea></div>'+
    '<div id="grn-rejection-div" style="display:none;margin-top:8px;"><label class="flbl">Rejection Reason *</label><input id="grn-rejection" class="finp" placeholder="Reason for rejection or partial acceptance"></div>';

  // Show rejection reason field when rejected or partial
  setTimeout(function(){
    document.querySelectorAll('input[name="grn-status"]').forEach(function(r){
      r.addEventListener('change',function(){
        var d=document.getElementById('grn-rejection-div');
        if(d) d.style.display=(this.value==='rejected'||this.value==='partial')?'block':'none';
      });
    });
  },100);

  shFoot.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){grnCloseSheet();closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#558B2F;color:white;';
  sb.innerHTML='&#10003; Save GRN';
  sb.onclick=function(){grnSave(allotId,projId);};
  shFoot.appendChild(cb);shFoot.appendChild(sb);
}

function grnCloseSheet(){
  var ov=document.getElementById('grn-sheet-overlay');
  var sh=document.getElementById('grn-sheet');
  if(ov)ov.style.display='none';
  if(sh)sh.style.display='none';
}

async function grnSave(allotId, projId){
  var date=document.getElementById('grn-date')?document.getElementById('grn-date').value:'';
  var qty=parseFloat(document.getElementById('grn-qty')?document.getElementById('grn-qty').value:0)||0;
  var statusEl=document.querySelector('input[name="grn-status"]:checked');
  var status=statusEl?statusEl.value:'accepted';
  var challan=(document.getElementById('grn-challan')||{}).value||'';
  var invoice=(document.getElementById('grn-invoice')||{}).value||'';
  var remarks=(document.getElementById('grn-remarks')||{}).value||'';
  var rejection=(document.getElementById('grn-rejection')||{}).value||'';

  if(!date){toast('GRN date required','warning');return;}
  if(!qty&&status!=='rejected'){toast('Enter quantity received','warning');return;}
  if((status==='rejected'||status==='partial')&&!rejection){toast('Enter rejection/partial reason','warning');return;}

  // Validate qty against pending balance
  var allot=GRN_ALLOTS.find(function(a){return a.id===allotId;})||{};
  var accepted=GRN_ITEMS.filter(function(g){return g.allot_id===allotId&&(g.status==='accepted'||g.approval_status==='approved');})
    .reduce(function(s,g){return s+(parseFloat(g.qty_received)||0);},0);
  var bal=Math.max(0,(parseFloat(allot.qty)||0)-accepted);
  if(status!=='rejected'&&qty>bal){
    toast('Qty ('+qty+') exceeds pending balance ('+bal.toFixed(2)+')','warning');return;
  }

  // Generate GRN number
  var grnNo='GRN/'+new Date().getFullYear()+'/'+String(GRN_ITEMS.length+1).padStart(4,'0');

  try{
    var res=await sbInsert('grn_entries',{
      project_id:projId, allot_id:allotId,
      grn_number:grnNo, grn_date:date,
      qty_received:status==='rejected'?0:qty,
      unit:allot.unit||null,
      status:status,
      challan_no:challan||null, invoice_no:invoice||null,
      remarks:remarks||null, rejection_reason:rejection||null,
      store_updated:false,
      approval_status:'pending',
      created_by:(typeof currentUser!=='undefined'&&currentUser&&(currentUser.name||currentUser.email))||null
    });
    if(res&&res[0]) GRN_ITEMS.push(res[0]);
    toast(grnNo+' saved! Awaiting admin approval to add to store.','success');
    grnCloseSheet(); closeSheet('ov-exec','sh-exec');
    grnRender();
    // Do NOT auto-add to store — admin must approve first
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function grnAddToStore(grnId){
  var grn=GRN_ITEMS.find(function(g){return g.id===grnId;});
  if(!grn||grn.store_updated){return;}
  var allot=GRN_ALLOTS.find(function(a){return a.id===grn.allot_id;})||{};

  // Always fetch planned resource from DB to get correct material name
  var planRes={};
  if(allot.boq_exec_resource_id){
    try{
      var pr=await sbFetch('boq_exec_resources',{select:'*',filter:'id=eq.'+allot.boq_exec_resource_id+'&exec_type=eq.planned'});
      planRes=(Array.isArray(pr)&&pr[0])?pr[0]:{};
    }catch(e){ console.warn('planRes fetch:',e.message); }
  }

  // Material name = planned resource party_name (what the material IS)
  // NOT the vendor/allotment party_name
  var resName = planRes.party_name || planRes.resource_category || '';
  if(!resName){
    toast('Cannot determine material name — planned resource not found','warning');
    console.warn('planRes empty for allot:',allot);
    return;
  }

  var boqItemId = allot.boq_item_id || planRes.boq_item_id || null;

  try{
    // Check if store record already exists for this project + material + unit
    var existing=await sbFetch('store_inventory',{
      select:'*',
      filter:'project_id=eq.'+grn.project_id+'&allot_id=eq.'+allot.id
    });
    var existRec=Array.isArray(existing)&&existing.length?existing[0]:null;
    if(existRec){
      await sbUpdate('store_inventory',existRec.id,{
        qty_in_hand:(parseFloat(existRec.qty_in_hand)||0)+(parseFloat(grn.qty_received)||0),
        last_grn_date:grn.grn_date
      });
    } else {
      await sbInsert('store_inventory',{
        project_id: grn.project_id,
        item_name:  resName,           // planned resource name (material)
        allot_id:   grn.allot_id,
        grn_id:     grnId,
        boq_item_id: boqItemId,        // BOQ item reference for daily progress matching
        unit:       grn.unit||null,
        qty_in_hand: parseFloat(grn.qty_received)||0,
        qty_issued:  0,
        last_grn_date: grn.grn_date
      });
    }
    await sbUpdate('grn_entries',grnId,{store_updated:true});
    var idx=GRN_ITEMS.findIndex(function(g){return g.id===grnId;});
    if(idx>-1) GRN_ITEMS[idx].store_updated=true;
    // Refresh STORE_ITEMS in memory
    try{
      var si=await sbFetch('store_inventory',{select:'*',filter:'project_id=eq.'+grn.project_id,order:'item_name.asc'});
      STORE_ITEMS=Array.isArray(si)?si:STORE_ITEMS;
    }catch(e){}
    toast('Material "'+resName+'" added to store','success');
    grnRender();
  }catch(e){toast('Error updating store: '+e.message,'error');console.error(e);}
}

async function grnApprove(grnId){
  if(!currentUser){toast('Please log in','warning');return;}
  try{
    await sbUpdate('grn_entries',grnId,{status:'accepted',approval_status:'approved',approved_by:currentUser.name||currentUser.email||'admin'});
    var idx=GRN_ITEMS.findIndex(function(g){return g.id===grnId;});
    if(idx>-1){GRN_ITEMS[idx].approval_status='approved';GRN_ITEMS[idx].status='accepted';}
    toast('GRN approved — now add to store','success');
    grnRender();
    // Auto-add to store after approval
    await grnAddToStore(grnId);
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function grnDelete(grnId){
  var grn=GRN_ITEMS.find(function(g){return g.id===grnId;});
  if(!grn)return;
  var msg=grn.store_updated
    ? 'This GRN has been added to store.\nDeleting will also reverse the store quantity.\n\nDelete GRN and reverse store entry?'
    : 'Delete this GRN?';
  if(!confirm(msg))return;

  // If store was updated, reverse the qty in store_inventory
  if(grn.store_updated&&grn.qty_received){
    try{
      var allot=GRN_ALLOTS.find(function(a){return a.id===grn.allot_id;})||{};
      var planRes=WA_PLANNED.find(function(p){return p.id===allot.boq_exec_resource_id;})||{};
      var resName=planRes.party_name||planRes.resource_category||allot.party_name||'';
      var storeRecs=await sbFetch('store_inventory',{select:'*',filter:'project_id=eq.'+grn.project_id+'&grn_id=eq.'+grnId});
      if(!Array.isArray(storeRecs)||!storeRecs.length){
        // Try by item name
        storeRecs=await sbFetch('store_inventory',{select:'*',filter:'project_id=eq.'+grn.project_id+'&item_name=eq.'+encodeURIComponent(resName)});
      }
      if(Array.isArray(storeRecs)&&storeRecs.length){
        var s=storeRecs[0];
        var newQty=Math.max(0,(parseFloat(s.qty_in_hand)||0)-(parseFloat(grn.qty_received)||0));
        await sbUpdate('store_inventory',s.id,{qty_in_hand:newQty});
        // Remove store item if qty reaches 0
        if(newQty<=0) await sbDelete('store_inventory',s.id);
      }
    }catch(e){console.warn('Store reversal error:',e.message);}
  }

  GRN_ITEMS=GRN_ITEMS.filter(function(g){return g.id!==grnId;});
  grnRender();
  try{await sbDelete('grn_entries',grnId);toast('GRN deleted','success');}catch(e){console.error(e);}
}

function grnDownloadPDF(grnId){
  var grn=GRN_ITEMS.find(function(g){return g.id===grnId;});
  if(!grn){toast('GRN not found','error');return;}
  var allot=GRN_ALLOTS.find(function(a){return a.id===grn.allot_id;})||{};
  var planRes=WA_PLANNED.find(function(p){return p.id===allot.boq_exec_resource_id;})||{};
  var resName=planRes.party_name||planRes.resource_category||allot.party_name||'';
  var boqItem=WA_ITEMS.find(function(i){return i.id===allot.boq_item_id;})||{};
  var co=typeof COMPANY_DATA!=='undefined'?COMPANY_DATA:{};
  var projSel=document.getElementById('proj-mod-sel');
  var projName=projSel&&projSel.selectedIndex>=0?projSel.options[projSel.selectedIndex].text:'';
  function fmtD(d){if(!d)return '—';if(/^\d{4}-\d{2}-\d{2}/.test(d)){var p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0];}return d;}
  var stCol={accepted:'#2E7D32',rejected:'#C62828',partial:'#F57F17'}[grn.status]||'#555';
  var stLbl={accepted:'ACCEPTED',rejected:'REJECTED',partial:'PARTIAL'}[grn.status]||grn.status.toUpperCase();

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>GRN — '+grn.grn_number+'</title>'+
    '<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;font-size:11px;padding:24px;color:#1a1a1a;}'+
    '.hdr{display:flex;justify-content:space-between;border-bottom:3px solid #558B2F;padding-bottom:10px;margin-bottom:14px;}'+
    '.co-name{font-size:16px;font-weight:900;color:#558B2F;}.co-info{font-size:10px;color:#555;margin-top:3px;}'+
    '.grn-title{font-size:18px;font-weight:900;color:#558B2F;}.grn-no{font-size:12px;color:#555;margin-top:4px;}'+
    '.status{display:inline-block;padding:4px 14px;border-radius:20px;font-weight:900;font-size:11px;color:white;background:'+stCol+';margin-top:6px;}'+
    '.info-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #DDD;border-radius:8px;overflow:hidden;margin-bottom:14px;}'+
    '.info-cell{padding:10px 14px;}.info-cell+.info-cell{border-left:1px solid #DDD;}.info-cell.full{grid-column:span 2;border-top:1px solid #DDD;}'+
    '.lbl{font-size:9px;font-weight:800;text-transform:uppercase;color:#888;margin-bottom:3px;}.val{font-size:13px;font-weight:800;}'+
    '.mat-box{background:#F1FBF4;border-radius:8px;padding:14px;margin-bottom:14px;border-left:4px solid #558B2F;}'+
    '.sig-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:40px;}'+
    '.sig-box{border-top:1.5px solid #333;padding-top:6px;text-align:center;font-size:10px;color:#555;}'+
    '@media print{button{display:none;}}</style></head><body>'+
    '<button onclick="window.print()" style="background:#558B2F;color:white;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;margin-bottom:16px;font-family:Arial;font-weight:700;">Print / Save PDF</button>'+
    '<div class="hdr">'+
      '<div><div class="co-name">'+(co.name||'Company Name')+'</div>'+
        '<div class="co-info">'+(co.address||'')+'<br>'+(co.gstin?'GSTIN: '+co.gstin:'')+'</div></div>'+
      '<div style="text-align:right;"><div class="grn-title">GOODS RECEIVED NOTE</div>'+
        '<div class="grn-no">'+grn.grn_number+'</div>'+
        '<div><span class="status">'+stLbl+'</span></div></div>'+
    '</div>'+
    '<div class="info-grid">'+
      '<div class="info-cell"><div class="lbl">Project</div><div class="val">'+projName+'</div></div>'+
      '<div class="info-cell"><div class="lbl">GRN Date</div><div class="val">'+fmtD(grn.grn_date)+'</div></div>'+
      '<div class="info-cell"><div class="lbl">Supplier</div><div class="val">'+allot.party_name+'</div></div>'+
      '<div class="info-cell"><div class="lbl">Quantity Received</div><div class="val" style="color:#558B2F;font-size:16px;">'+grn.qty_received+' '+(grn.unit||'')+'</div></div>'+
      (grn.challan_no?'<div class="info-cell full"><div class="lbl">Challan / Vehicle No</div><div class="val">'+grn.challan_no+'</div></div>':'')+
      (grn.invoice_no?'<div class="info-cell"><div class="lbl">Invoice No</div><div class="val">'+grn.invoice_no+'</div></div>':'')+
      (grn.created_by?'<div class="info-cell"><div class="lbl">GRN Created By</div><div class="val">'+grn.created_by+'</div></div>':'')+
    '</div>'+
    '<div class="mat-box">'+
      '<div style="font-size:12px;font-weight:800;color:#558B2F;margin-bottom:8px;">Material Details</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">'+
        '<div><div class="lbl">Material / Resource</div><div class="val">'+resName+'</div></div>'+
        '<div><div class="lbl">BOQ Item</div><div class="val" style="font-size:11px;">'+(boqItem.item_code?'['+boqItem.item_code+'] ':'')+( boqItem.short_name||boqItem.description||'—')+'</div></div>'+
        '<div><div class="lbl">Total Ordered</div><div class="val">'+allot.qty+' '+(allot.unit||'')+'</div></div>'+
      '</div>'+
    '</div>'+
    (grn.remarks?'<div style="margin-bottom:12px;padding:10px 14px;background:#F8FAFC;border-radius:8px;"><div class="lbl">Quality Remarks</div><div style="margin-top:4px;">'+grn.remarks+'</div></div>':'')+
    (grn.rejection_reason?'<div style="margin-bottom:12px;padding:10px 14px;background:#FFEBEE;border-radius:8px;border-left:4px solid #C62828;"><div class="lbl" style="color:#C62828;">Rejection Reason</div><div style="margin-top:4px;">'+grn.rejection_reason+'</div></div>':'')+
    '<div class="sig-grid">'+
      '<div class="sig-box"><div style="height:40px;"></div><div style="font-weight:800;">'+(grn.created_by||'Store Keeper')+'</div><div>GRN Created By</div></div>'+
      '<div class="sig-box"><div style="height:40px;"></div><div style="font-weight:800;">Quality Inspector</div><div>Inspected By</div></div>'+
      '<div class="sig-box"><div style="height:40px;"></div><div style="font-weight:800;">'+(co.name||'Management')+'</div><div>Authorized By</div></div>'+
    '</div></body></html>';

  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else toast('Allow popups','warning');
}

// ════════════════════════════════════════════════════════════════
// STORE MODULE
// ════════════════════════════════════════════════════════════════
var STORE_ITEMS=[], STORE_PROJ_ID='';

function storeEnsureContainer(){
  if(!document.getElementById('store-content')){
    var div=document.createElement('div');
    div.id='store-content'; div.style.cssText='padding:12px;';
    var ap=document.getElementById('app-projects');
    if(ap) ap.appendChild(div);
  }
}

async function storeLoadItems(){
  storeEnsureContainer();
  var el=document.getElementById('store-content'); if(!el) return;
  var projId=PROJ_MOD_SEL_ID||'';
  if(!projId){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3);">Select a project from the dropdown above</div>';
    return;
  }
  STORE_PROJ_ID=projId;
  el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text3);">&#9203; Loading...</div>';
  try{
    var r=await sbFetch('store_inventory',{select:'*',filter:'project_id=eq.'+projId,order:'item_name.asc'});
    STORE_ITEMS=Array.isArray(r)?r:[];
  }catch(e){STORE_ITEMS=[];console.warn('Store load:',e.message);}
  storeRender();
}

function storeRender(){
  var el=document.getElementById('store-content'); if(!el) return;
  var projSel=document.getElementById('proj-mod-sel');
  var projName=projSel&&projSel.selectedIndex>=0?projSel.options[projSel.selectedIndex].text:'';

  if(!STORE_ITEMS.length){
    el.innerHTML=
      '<div style="text-align:center;padding:40px;color:var(--text3);background:white;border-radius:12px;">'+
        '<div style="font-size:36px;margin-bottom:10px;">&#127981;</div>'+
        '<div style="font-weight:700;">Store is empty</div>'+
        '<div style="font-size:11px;margin-top:6px;">Materials are added to store when GRN is accepted</div>'+
      '</div>';
    return;
  }

  // Group STORE_ITEMS by item_name + unit — combine duplicates
  var grouped={}, groupOrder=[];
  STORE_ITEMS.forEach(function(item){
    var key=(item.item_name||'').toLowerCase()+'__'+(item.unit||'').toLowerCase();
    if(!grouped[key]){
      grouped[key]={
        ids:[],item_name:item.item_name,unit:item.unit||'',
        qty_in_hand:0,qty_issued:0,min_qty:parseFloat(item.min_qty)||0,
        last_grn_date:item.last_grn_date||''
      };
      groupOrder.push(key);
    }
    grouped[key].ids.push(item.id);
    grouped[key].qty_in_hand+=(parseFloat(item.qty_in_hand)||0);
    grouped[key].qty_issued +=(parseFloat(item.qty_issued)||0);
    // Use most recent GRN date
    if(item.last_grn_date&&item.last_grn_date>grouped[key].last_grn_date)
      grouped[key].last_grn_date=item.last_grn_date;
  });

  var uniqueCount=groupOrder.length;
  var lowStock=groupOrder.filter(function(k){
    var g=grouped[k];
    return g.qty_in_hand<=g.min_qty&&g.min_qty>0;
  }).length;

  var summaryBar=
    '<div style="display:flex;gap:8px;margin-bottom:12px;">'+
      '<div style="background:white;border-radius:10px;padding:8px 14px;border-left:4px solid #6A1B9A;flex:1;">'+
        '<div style="font-size:18px;font-weight:900;color:#6A1B9A;">'+uniqueCount+'</div>'+
        '<div style="font-size:10px;color:var(--text3);font-weight:700;">Items in Store</div></div>'+
      (lowStock>0?'<div style="background:white;border-radius:10px;padding:8px 14px;border-left:4px solid #C62828;flex:1;">'+
        '<div style="font-size:18px;font-weight:900;color:#C62828;">'+lowStock+'</div>'+
        '<div style="font-size:10px;color:var(--text3);font-weight:700;">Low Stock</div></div>':'')+''+
    '</div>';

  var rows=groupOrder.map(function(key,i){
    var g=grouped[key];
    var inHand=g.qty_in_hand, issued=g.qty_issued;
    var isLow=inHand<=g.min_qty&&g.min_qty>0;
    // Use first id for issue/delete (covers single item); for grouped use all ids
    var firstId=g.ids[0];
    return '<tr style="border-bottom:1px solid #F0F0F0;'+(i%2===0?'':'background:#FAFAFA;')+'">'+
      '<td style="padding:9px 10px;font-size:12px;font-weight:800;">'+g.item_name+
        (isLow?'<span style="font-size:9px;background:#FFEBEE;color:#C62828;padding:1px 5px;border-radius:3px;font-weight:700;margin-left:5px;">Low Stock</span>':'')+
        (g.ids.length>1?'<span style="font-size:9px;background:#E8F5E9;color:#2E7D32;padding:1px 5px;border-radius:3px;margin-left:4px;">'+g.ids.length+' entries</span>':'')+
      '</td>'+
      '<td style="padding:9px 10px;font-size:11px;text-align:right;font-weight:800;color:#558B2F;">'+inHand.toFixed(2)+' <span style="font-size:9px;color:var(--text3);">'+g.unit+'</span></td>'+
      '<td style="padding:9px 10px;font-size:11px;text-align:right;color:#E65100;">'+issued.toFixed(2)+' <span style="font-size:9px;color:var(--text3);">'+g.unit+'</span></td>'+
      '<td style="padding:9px 10px;font-size:11px;text-align:right;font-weight:800;color:#1565C0;">'+(inHand+issued).toFixed(2)+' <span style="font-size:9px;color:var(--text3);">'+g.unit+'</span></td>'+
      '<td style="padding:9px 10px;font-size:10px;color:var(--text3);">'+(g.last_grn_date?g.last_grn_date.split('-').reverse().join('/'):'—')+'</td>'+
      '<td style="padding:9px 10px;">'+
        '<div style="display:flex;gap:4px;">'+
          '<button onclick="storeIssue(\''+firstId+'\')" style="background:#6A1B9A;color:white;border:none;border-radius:5px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:700;">Issue</button>'+
          '<button onclick="storeDelete(\''+firstId+'\')" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:16px;" title="Delete">&#215;</button>'+
        '</div>'+
      '</td>'+
    '</tr>';
  }).join('');

  el.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'+
      '<div style="font-size:13px;font-weight:800;color:#6A1B9A;">&#127981; Store — '+projName+'</div>'+
    '</div>'+
    summaryBar+
    '<div style="background:white;border-radius:14px;overflow:hidden;">'+
      '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">'+
        '<table style="width:100%;border-collapse:collapse;min-width:480px;">'+
          '<thead><tr style="background:#6A1B9A;color:white;">'+
            '<th style="padding:8px 10px;font-size:9px;text-align:left;">MATERIAL</th>'+
            '<th style="padding:8px 10px;font-size:9px;text-align:right;color:#E8F5E9;">IN HAND</th>'+
            '<th style="padding:8px 10px;font-size:9px;text-align:right;color:#FFE0B2;">ISSUED</th>'+
            '<th style="padding:8px 10px;font-size:9px;text-align:right;">TOTAL IN</th>'+
            '<th style="padding:8px 10px;font-size:9px;text-align:left;">LAST GRN</th>'+
            '<th style="padding:8px 10px;font-size:9px;text-align:left;">ACTION</th>'+
          '</tr></thead>'+
          '<tbody>'+rows+'</tbody>'+
        '</table>'+
      '</div>'+
    '</div>'+
    // Issue Log section
    (function(){
      var projLogs=STORE_ISSUE_LOG.filter(function(l){return l.project_id===(STORE_PROJ_ID||'');});
      if(!projLogs.length) return '';
      return '<div style="background:white;border-radius:14px;margin-top:12px;overflow:hidden;">'+
        '<div style="padding:10px 14px;font-size:12px;font-weight:800;color:#6A1B9A;border-bottom:1px solid #F0F0F0;">&#128221; Issue Log</div>'+
        '<div style="overflow-x:auto;">'+
        '<table style="width:100%;border-collapse:collapse;min-width:480px;">'+
          '<thead><tr style="background:#F3E5F5;">'+
            '<th style="padding:7px 10px;font-size:9px;text-align:left;color:#6A1B9A;">MATERIAL</th>'+
            '<th style="padding:7px 10px;font-size:9px;text-align:right;color:#6A1B9A;">QTY</th>'+
            '<th style="padding:7px 10px;font-size:9px;text-align:left;color:#6A1B9A;">ISSUED TO</th>'+
            '<th style="padding:7px 10px;font-size:9px;text-align:left;color:#6A1B9A;">DATE</th>'+
            '<th style="padding:7px 10px;font-size:9px;text-align:left;color:#6A1B9A;">STATUS</th>'+
            '<th style="padding:7px 10px;font-size:9px;text-align:left;color:#6A1B9A;"></th>'+
          '</tr></thead>'+
          '<tbody>'+
          projLogs.map(function(log){
            var statusCol=log.status==='used'?'#2E7D32':'#F57F17';
            return '<tr style="border-bottom:1px solid #F9F0FF;">'+
              '<td style="padding:7px 10px;font-size:11px;font-weight:700;">'+( log.item_name||'—')+'</td>'+
              '<td style="padding:7px 10px;font-size:11px;text-align:right;font-weight:800;color:#6A1B9A;">'+(parseFloat(log.qty_issued)||0).toFixed(2)+' '+(log.unit||'')+'</td>'+
              '<td style="padding:7px 10px;font-size:11px;">'+(log.issued_to||'—')+'</td>'+
              '<td style="padding:7px 10px;font-size:11px;">'+(log.issue_date?log.issue_date.split('-').reverse().join('/'):'—')+'</td>'+
              '<td style="padding:7px 10px;"><span style="font-size:9px;font-weight:800;color:'+statusCol+';background:'+statusCol+'18;padding:2px 6px;border-radius:3px;">'+(log.status||'available').toUpperCase()+'</span></td>'+
              '<td style="padding:7px 10px;"><button data-lid="'+log.id+'" onclick="storeDeleteIssueLog(this.getAttribute(\x27data-lid\x27))" style="background:none;border:none;color:#C62828;cursor:pointer;font-size:14px;" title="Delete issue log">&#215;</button></td>'+
            '</tr>';
          }).join('')+
          '</tbody>'+
        '</table>'+
        '</div></div>';
    })();
}

function storeIssue(itemId){
  var item=STORE_ITEMS.find(function(i){return i.id===itemId;});
  if(!item){toast('Item not found','error');return;}
  var inHand=parseFloat(item.qty_in_hand)||0;
  if(inHand<=0){toast('No stock available to issue','warning');return;}

  // Use exec sheet for proper form
  var shTitle=document.getElementById('exec-sheet-title');
  var shBody =document.getElementById('exec-sheet-body');
  var shFoot =document.getElementById('exec-sheet-foot');
  if(!shTitle||!shBody||!shFoot) return;

  // BOQ item options
  var boqOpts='<option value="">— Select BOQ Item (optional) —</option>'+
    WA_ITEMS.map(function(i){return '<option value="'+i.id+'">['+i.item_code+'] '+(i.short_name||i.description)+'</option>';}).join('');

  shTitle.textContent='Issue Material from Store';
  shBody.innerHTML=
    '<div style="background:#F3E5F5;border-radius:10px;padding:12px;margin-bottom:12px;">'+
      '<div style="font-size:12px;font-weight:800;color:#6A1B9A;margin-bottom:4px;">'+item.item_name+'</div>'+
      '<div style="font-size:11px;color:var(--text3);">In Stock: <b style="color:#2E7D32;">'+inHand.toFixed(2)+' '+(item.unit||'')+'</b></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">'+
      '<div><label class="flbl">Issue Date *</label><input id="si-date" class="finp" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
      '<div><label class="flbl">Qty to Issue *</label>'+
        '<div style="display:flex;gap:6px;align-items:center;">'+
          '<input id="si-qty" class="finp" type="number" step="0.001" max="'+inHand+'" placeholder="max '+inHand.toFixed(2)+'" style="flex:1;">'+
          '<span style="font-size:12px;font-weight:700;color:var(--text3);">'+(item.unit||'')+'</span>'+
        '</div></div>'+
    '</div>'+
    '<div style="margin-bottom:8px;"><label class="flbl">Issued To (name / location) *</label>'+
      '<input id="si-to" class="finp" placeholder="e.g. Site Engineer, Block A, Labour Gang 1"></div>'+
    '<div style="margin-bottom:8px;"><label class="flbl">BOQ Item / Purpose</label>'+
      '<select id="si-boq" class="fsel">'+boqOpts+'</select></div>'+
    '<div><label class="flbl">Description of Use *</label>'+
      '<textarea id="si-desc" class="ftxt" rows="2" placeholder="Where and how this material will be used..."></textarea></div>';

  shFoot.innerHTML='';
  var cb=document.createElement('button');cb.className='btn btn-outline';cb.textContent='Cancel';
  cb.onclick=function(){closeSheet('ov-exec','sh-exec');};
  var sb=document.createElement('button');sb.className='btn';sb.style.cssText='background:#6A1B9A;color:white;';
  sb.innerHTML='&#10003; Issue Material';
  sb.onclick=function(){storeSaveIssue(itemId);};
  shFoot.appendChild(cb);shFoot.appendChild(sb);
  openSheet('ov-exec','sh-exec');
}

async function storeSaveIssue(itemId){
  var item=STORE_ITEMS.find(function(i){return i.id===itemId;});
  if(!item)return;
  var date=gv('si-date');
  var qty=parseFloat(gv('si-qty'))||0;
  var issuedTo=(gv('si-to')||'').trim();
  var boqId=gv('si-boq')||null;
  var desc=(gv('si-desc')||'').trim();
  var inHand=parseFloat(item.qty_in_hand)||0;

  if(!date){toast('Issue date required','warning');return;}
  if(!qty||qty<=0){toast('Enter qty to issue','warning');return;}
  if(qty>inHand){toast('Cannot issue more than in-hand ('+inHand.toFixed(2)+')','warning');return;}
  if(!issuedTo){toast('Enter issued to name/location','warning');return;}
  if(!desc){toast('Enter description of use','warning');return;}

  try{
    // Save issue log with boq_item_id for daily progress linkage
    var logRes=await sbInsert('store_issue_log',{
      store_id:itemId,
      project_id:STORE_PROJ_ID||item.project_id,
      item_name:item.item_name,
      qty_issued:qty,
      unit:item.unit||null,
      issued_to:issuedTo,
      issue_date:date,
      boq_item_id:boqId||item.boq_item_id||null,
      purpose:desc,
      allot_id:item.allot_id||null,
      status:'available' // available for daily progress use
    });
    // Update store qty
    await sbUpdate('store_inventory',itemId,{
      qty_in_hand:inHand-qty,
      qty_issued:(parseFloat(item.qty_issued)||0)+qty
    });
    var idx=STORE_ITEMS.findIndex(function(i){return i.id===itemId;});
    if(idx>-1){STORE_ITEMS[idx].qty_in_hand=inHand-qty;STORE_ITEMS[idx].qty_issued=(parseFloat(item.qty_issued)||0)+qty;}
    toast('Issued '+qty+' '+(item.unit||'')+' — available for daily progress','success');
    closeSheet('ov-exec','sh-exec');
    storeRender();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function storeDeleteIssueLog(logId){
  var log=STORE_ISSUE_LOG.find(function(l){return l.id===logId;});
  if(!log)return;
  var msg='Delete this issue record?';
  if(log.status==='used') msg+='\n\nThis issue has been used in daily progress. Deleting will restore it as available.';
  msg+='\n\nStore quantity will be restored.';
  if(!confirm(msg))return;

  // Restore store qty
  var storeItem=STORE_ITEMS.find(function(i){return i.id===log.store_id;});
  var qtyToRestore=parseFloat(log.qty_issued)||0;

  // Remove from memory
  STORE_ISSUE_LOG=STORE_ISSUE_LOG.filter(function(l){return l.id!==logId;});

  try{
    await sbDelete('store_issue_log',logId);
    // Restore store qty
    if(storeItem&&qtyToRestore>0){
      var newInHand=(parseFloat(storeItem.qty_in_hand)||0)+qtyToRestore;
      var newIssued=Math.max(0,(parseFloat(storeItem.qty_issued)||0)-qtyToRestore);
      await sbUpdate('store_inventory',storeItem.id,{qty_in_hand:newInHand,qty_issued:newIssued});
      var idx=STORE_ITEMS.findIndex(function(i){return i.id===storeItem.id;});
      if(idx>-1){STORE_ITEMS[idx].qty_in_hand=newInHand;STORE_ITEMS[idx].qty_issued=newIssued;}
    }
    toast('Issue log deleted — qty restored to store','success');
    storeRender();
  }catch(e){toast('Error: '+e.message,'error');console.error(e);}
}

async function storeDelete(itemId){
  var item=STORE_ITEMS.find(function(i){return i.id===itemId;});
  if(!item)return;
  // Count linked issue logs
  var linkedLogs=STORE_ISSUE_LOG.filter(function(l){return l.store_id===itemId;});
  var msg='Delete store entry for "'+item.item_name+'"?';
  if(linkedLogs.length) msg+='\n\n'+linkedLogs.length+' issue log entry(s) will also be deleted.';
  msg+='\n\nThe GRN will remain.';
  if(!confirm(msg)) return;
  STORE_ITEMS=STORE_ITEMS.filter(function(i){return i.id!==itemId;});
  // Remove linked issue logs from memory
  STORE_ISSUE_LOG=STORE_ISSUE_LOG.filter(function(l){return l.store_id!==itemId;});
  storeRender();
  try{
    // Delete linked issue log entries first
    for(var li=0;li<linkedLogs.length;li++){
      try{await sbDelete('store_issue_log',linkedLogs[li].id);}catch(e){console.warn(e);}
    }
    await sbDelete('store_inventory',itemId);
    // Also mark the linked GRN as store_updated=false so it can be re-added
    if(item.grn_id){
      await sbUpdate('grn_entries',item.grn_id,{store_updated:false});
      var grnIdx=GRN_ITEMS.findIndex(function(g){return g.id===item.grn_id;});
      if(grnIdx>-1) GRN_ITEMS[grnIdx].store_updated=false;
    }
    toast('Store entry deleted'+(linkedLogs.length?' with '+linkedLogs.length+' issue log(s)':''),'success');
  }catch(e){console.error(e);toast('Error: '+e.message,'error');}
}


// ═══════════════════════════════════════════
// FINANCE.JS — Petty Cash & Accounts
// ═══════════════════════════════════════════

// ── PETTY CASH ────────────────────────────────────────────
var PC_IN=[], PC_EXP=[], PC_EMPS=[], PC_PROJS=[], PC_ACTIVE=null, PC_CAT='all';
var PC_SITE_TAB='all';
var PC_EMP_FILTER='all'; // 'all' or empId

var PC_CATS=['Fuel & Transport','Site Materials','Labour Wages','Food & Refreshment','Office Expenses','Equipment Repair','Safety Items','Utilities','Medical','Miscellaneous'];
