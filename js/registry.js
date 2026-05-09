// ═══════════════════════════════════════════
// REGISTRY.JS — Master Registry Module
// ═══════════════════════════════════════════

var VENDORS=[], MATERIALS=[], SUBCONTRACTORS=[], LABOURERS=[], USERS=[], PROJECTS=[];
var vendorCatFilter='all', matCatFilter='all', scCatFilter='all', labCatFilter='all', userRoleFilter='all';
var currentPage='vendors';
var vendorMatRates=[];
var PAY_EARN_ID=0, PAY_DED_ID=0;
var _syncInterval=null, _deletedIds={};

var ROLE_IC={admin:'&#128084;',pm:'&#127959;',engineer:'&#9881;&#65039;',qhse:'&#128203;',finance:'&#128178;',viewer:'&#128065;'};

var CAT_DATA={
  vendor:[
    {id:'vc-1',icon:'&#129493;',name:'Steel',desc:'TMT bars',color:'#C62828',count:0,active:true},
    {id:'vc-2',icon:'&#129521;',name:'Cement',desc:'OPC, PPC',color:'#37474F',count:0,active:true},
    {id:'vc-3',icon:'&#9898;',name:'Aggregate',desc:'Coarse aggregate',color:'#795548',count:0,active:true},
    {id:'vc-4',icon:'&#128167;',name:'Sand',desc:'River sand, M-sand',color:'#FF8F00',count:0,active:true},
    {id:'vc-5',icon:'&#128296;',name:'Formwork',desc:'H-frame, table form',color:'#1565C0',count:0,active:true},
    {id:'vc-6',icon:'&#9889;',name:'Electrical',desc:'DG sets, cables',color:'#F57F17',count:0,active:true},
    {id:'vc-7',icon:'&#128167;',name:'Waterproofing',desc:'Membrane, crystalline',color:'#6A1B9A',count:0,active:true},
    {id:'vc-8',icon:'&#9881;&#65039;',name:'Plant Hire',desc:'Excavators, cranes',color:'#00838F',count:0,active:true},
    {id:'vc-9',icon:'&#9973;&#65039;',name:'Safety PPE',desc:'Helmets, harness',color:'#E65100',count:0,active:true},
    {id:'vc-10',icon:'&#128230;',name:'Other',desc:'Miscellaneous',color:'#94A3B8',count:0,active:true},
  ],
  material:[
    {id:'mc-1',icon:'&#127959;',name:'Structural',desc:'Steel bars, beams',color:'#C62828',count:0,active:true},
    {id:'mc-2',icon:'&#129521;',name:'Concrete',desc:'Cement, aggregates',color:'#37474F',count:0,active:true},
    {id:'mc-3',icon:'&#127775;',name:'Finishing',desc:'Paint, tiles, plaster',color:'#E65100',count:0,active:true},
    {id:'mc-4',icon:'&#9889;',name:'MEP Electrical',desc:'Conduit, cables',color:'#F57F17',count:0,active:true},
    {id:'mc-5',icon:'&#128739;',name:'Road Works',desc:'GSB, WMM, bitumen',color:'#795548',count:0,active:true},
    {id:'mc-6',icon:'&#9973;&#65039;',name:'Safety',desc:'PPE, signage',color:'#2E7D32',count:0,active:true},
  ],
  sc:[
    {id:'sc-1',icon:'&#127955;',name:'Civil',desc:'Earthwork, RCC',color:'#1565C0',count:0,active:true},
    {id:'sc-2',icon:'&#9889;',name:'MEP',desc:'Electrical, plumbing',color:'#F57F17',count:0,active:true},
    {id:'sc-3',icon:'&#127775;',name:'Finishing',desc:'Plaster, tile, painting',color:'#E65100',count:0,active:true},
    {id:'sc-4',icon:'&#128739;',name:'Road',desc:'GSB, WMM, bituminous',color:'#37474F',count:0,active:true},
    {id:'sc-5',icon:'&#128167;',name:'Waterproofing',desc:'Membrane, grouting',color:'#6A1B9A',count:0,active:true},
  ],
  role:[
    {id:'r-1',icon:'&#128101;',name:'Admin',desc:'Full access',color:'#6A1B9A',count:0,active:true},
    {id:'r-2',icon:'&#128203;',name:'Project Manager',desc:'Project planning',color:'#2E7D32',count:0,active:true},
    {id:'r-3',icon:'&#127959;',name:'Site Engineer',desc:'Site execution',color:'#1565C0',count:0,active:true},
    {id:'r-4',icon:'&#128296;',name:'Junior Engineer',desc:'Field supervision',color:'#1565C0',count:0,active:true},
    {id:'r-5',icon:'&#9989;',name:'QC Engineer',desc:'Quality checks',color:'#00838F',count:0,active:true},
    {id:'r-6',icon:'&#9973;&#65039;',name:'Safety Officer',desc:'HSE compliance',color:'#E65100',count:0,active:true},
    {id:'r-7',icon:'&#128200;',name:'Finance / Accounts',desc:'Billing, payments',color:'#C62828',count:0,active:true},
    {id:'r-8',icon:'&#128101;',name:'HR / Admin',desc:'HR, attendance',color:'#880E4F',count:0,active:true},
    {id:'r-9',icon:'&#128065;',name:'Viewer (Read Only)',desc:'View-only access',color:'#37474F',count:0,active:true},
    {id:'r-10',icon:'&#128101;',name:'Client Viewer',desc:'External client view',color:'#455A64',count:0,active:true},
  ],
  dept:[
    {id:'d-1',icon:'&#127968;',name:'Management',desc:'Directors, PMs',color:'#6A1B9A',count:0,active:true},
    {id:'d-2',icon:'&#127959;',name:'Engineering',desc:'Site engineers, JEs',color:'#1565C0',count:0,active:true},
    {id:'d-3',icon:'&#9989;',name:'QHSE',desc:'Quality, Safety',color:'#2E7D32',count:0,active:true},
    {id:'d-4',icon:'&#128200;',name:'Finance',desc:'Accounts, billing',color:'#C62828',count:0,active:true},
    {id:'d-5',icon:'&#128101;',name:'HR / Admin',desc:'Human resources',color:'#880E4F',count:0,active:true},
  ],
  uom:[
    {id:'u-1',icon:'',name:'MT',desc:'Metric Tonne',color:'#C62828',count:0,active:true},
    {id:'u-2',icon:'',name:'Bags',desc:'50 kg bags',color:'#37474F',count:0,active:true},
    {id:'u-3',icon:'',name:'m³',desc:'Cubic metres',color:'#1565C0',count:0,active:true},
    {id:'u-4',icon:'',name:'m²',desc:'Square metres',color:'#2E7D32',count:0,active:true},
    {id:'u-5',icon:'',name:'RMT',desc:'Running metres',color:'#6A1B9A',count:0,active:true},
    {id:'u-6',icon:'',name:'nos',desc:'Numbers',color:'#00838F',count:0,active:true},
    {id:'u-7',icon:'',name:'kg',desc:'Kilogram',color:'#795548',count:0,active:true},
    {id:'u-8',icon:'',name:'Litres',desc:'Liquid materials',color:'#F57F17',count:0,active:true},
    {id:'u-9',icon:'',name:'LS',desc:'Lump Sum',color:'#37474F',count:0,active:true},
  ],
  labour:[], resource:[]
};

var catSectionMap={vendor:'vendor-cats',material:'material-cats',sc:'sc-cats',uom:'uom-cats',role:'role-cats',dept:'dept-cats',labour:'labour-cats',resource:'resource-cats'};

function initRegistry() {
  loadCategories();
  rebuildPills('vendor','vendor-cat-pills','var(--teal)',filterVendors);
  rebuildPills('material','mat-cat-pills','var(--green)',filterMaterials);
  rebuildPills('sc','sc-cat-pills','var(--purple)',filterSC);
  rebuildPills('labour','lab-cat-pills','#E65100',filterLabour);
  renderCatSection('vendor','vendor-cats');
  renderCatSection('material','material-cats');
  renderCatSection('sc','sc-cats');
  renderCatSection('uom','uom-cats');
  renderCatSection('role','role-cats');
  renderCatSection('dept','dept-cats');
  loadAllData();
}

function mapVendor(v) {
  return {id:v.id,vendorId:v.vendor_id,name:v.name||'Unknown',cat:v.category||'',status:v.status||'active',rating:v.rating||0,
    gst:v.gst||'',contact:v.contact_person||'',phone:v.phone||'',email:v.email||'',address:v.address||'',
    brands:v.brands||'',payTerms:v.pay_terms||'',leadTime:v.lead_time||'',orders:v.total_orders||0,
    totalValue:v.total_value||0,materialRates:[],col:catColor(v.category)};
}
function mapMaterial(m) {
  return {id:m.id,matId:m.mat_id,name:m.name,cat:m.category||'',code:m.code||'',unit:m.unit,uom:m.uom,spec:m.spec,col:catColor(m.category)};
}
function mapSC(s) {
  return {id:s.id,scId:s.sc_id,name:s.name||'Unknown',trade:s.trade||'',rating:s.rating||0,
    gst:s.gst||'',contact:s.contact_person||'',phone:s.phone||'',email:s.email||'',address:s.address||'',
    exp:s.experience||'',turnover:s.turnover||'',workers:s.workers||0,speciality:s.speciality||'',
    pbgAvail:s.pbg_available,emdAvail:s.emd_available,status:s.status||'active',projects:[],col:'#1565C0'};
}
function mapLabour(l) {
  return {id:l.id,labId:l.lab_id||l.id.slice(0,8).toUpperCase(),name:l.name||'Unknown',skill:l.skill||'',type:l.type||'unskilled',
    phone:l.phone||'',address:l.address||'',aadhar:l.aadhar||'',dailyRate:l.daily_rate||0,
    source:l.source||'direct',contractor:l.contractor||'',project:l.project||'',
    status:l.status||'active',joined:l.joined||'',bloodGroup:l.blood_group||'',remarks:l.remarks||''};
}
function catColor(cat) {
  var colors={steel:'#C62828',cement:'#37474F',concrete:'#1565C0',structural:'#C62828',
    finishing:'#E65100',mep:'#F57F17',road:'#795548',safety:'#F57F17',
    formwork:'#1565C0',waterproofing:'#6A1B9A',electrical:'#F57F17',plant:'#00838F'};
  return colors[(cat||'').toLowerCase()]||'#37474F';
}

async function loadAllData() {
  try {
    var [vendors,materials,subcons,labours,employees,projects] = await Promise.all([
      sbFetch('vendors',{select:'*',order:'created_at.desc'}),
      sbFetch('materials',{select:'*',order:'created_at.desc'}),
      sbFetch('subcontractors',{select:'*',order:'created_at.desc'}),
      sbFetch('labourers',{select:'*',order:'created_at.desc'}),
      sbFetch('employees',{select:'*',order:'created_at.desc'}),
      sbFetch('projects',{select:'*',order:'name.asc'}),
    ]);
    VENDORS       = Array.isArray(vendors)   ? vendors.map(mapVendor)    : [];
    MATERIALS     = Array.isArray(materials) ? materials.map(mapMaterial): [];
    SUBCONTRACTORS= Array.isArray(subcons)   ? subcons.map(mapSC)        : [];
    LABOURERS     = Array.isArray(labours)   ? labours.map(mapLabour)    : [];
    USERS         = Array.isArray(employees) ? employees.map(mapEmployee): [];
    PROJECTS      = Array.isArray(projects)  ? projects                  : [];
    renderVendors(); renderMaterials(); renderSC(); renderLabour(); renderUsers();
    updateAllStats();
    toast('Data loaded','success');
  } catch(e) { toast('Failed to load data','error'); console.error(e); }
}

function renderVendors(list) {
  list = list || VENDORS;
  if (vendorCatFilter !== 'all') list = list.filter(function(v){return v.cat.toLowerCase().includes(vendorCatFilter);});
  var el = document.getElementById('vendor-list'); if (!el) return;
  var stBadge={approved:'b-green',active:'b-green','under-review':'b-amber',blacklisted:'b-red',rejected:'b-red'};
  el.innerHTML = list.map(function(v) {
    return '<div class="reg-card" onclick="openDetail(\'vendor\',\''+v.id+'\')">' +
      '<div class="rc-accent" style="background:'+v.col+'"></div>' +
      '<div class="rc-body">' +
        '<div class="avatar" style="background:'+v.col+'">'+(v.name||'?').split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2)+'</div>' +
        '<div class="rc-info"><div class="rc-name">'+v.name+'</div><div class="rc-sub">'+(v.brands||'').split(',')[0]+'</div>' +
        '<div class="rc-tags"><span class="badge '+(stBadge[v.status]||'b-navy')+'">'+v.status+'</span><span class="badge b-navy">'+v.cat+'</span><span class="badge b-teal">★ '+v.rating+'</span></div></div>' +
        '<div class="rc-right"><div class="rc-id" style="color:'+v.col+'">'+v.id+'</div><div style="font-family:monospace;font-size:12px;font-weight:800;color:var(--green);margin-top:4px;">'+fmtV(v.totalValue)+'</div></div>' +
      '</div>' +
      '<div class="rc-footer"><span>📞 '+v.phone+'</span><span>Lead: '+v.leadTime+'</span><span>'+v.payTerms+'</span></div></div>';
  }).join('') || '<div style="text-align:center;padding:30px;color:var(--text3);">No vendors found</div>';
  var sv=document.getElementById('stat-v-total'); if(sv)sv.textContent=VENDORS.length;
}

function renderMaterials(list) {
  list = list || MATERIALS;
  if (matCatFilter !== 'all') list = list.filter(function(m){return m.cat.toLowerCase().includes(matCatFilter);});
  var el = document.getElementById('material-list'); if (!el) return;
  el.innerHTML = list.map(function(m) {
    return '<div class="reg-card" onclick="openDetail(\'material\',\''+m.id+'\')">' +
      '<div class="rc-accent" style="background:'+m.col+'"></div>' +
      '<div class="rc-body">' +
        '<div class="avatar" style="background:'+m.col+';font-size:20px;">📦</div>' +
        '<div class="rc-info"><div class="rc-name">'+m.name+'</div><div class="rc-sub">'+(m.code||'—')+' · '+(m.spec||'—')+'</div>' +
        '<div class="rc-tags"><span class="badge b-navy">'+m.cat+'</span></div></div>' +
        '<div class="rc-right"><div class="rc-id" style="color:'+m.col+'">'+m.id+'</div><div style="font-size:11px;color:var(--text3);margin-top:4px;">'+(m.uom||'—')+'</div></div>' +
      '</div></div>';
  }).join('') || '<div style="text-align:center;padding:30px;color:var(--text3);">No materials found</div>';
  var sm=document.getElementById('stat-m-total'); if(sm)sm.textContent=MATERIALS.length;
}

function renderSC(list) {
  list = list || SUBCONTRACTORS;
  if (scCatFilter !== 'all') list = list.filter(function(s){return s.trade.toLowerCase().includes(scCatFilter);});
  var el = document.getElementById('sc-list'); if (!el) return;
  el.innerHTML = list.map(function(s) {
    return '<div class="reg-card" onclick="openDetail(\'sc\',\''+s.id+'\')">' +
      '<div class="rc-accent" style="background:'+s.col+'"></div>' +
      '<div class="rc-body">' +
        '<div class="avatar" style="background:'+s.col+'">'+(s.name||'?').split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2)+'</div>' +
        '<div class="rc-info"><div class="rc-name">'+s.name+'</div><div class="rc-sub">'+(s.speciality||'').split(',')[0]+'</div>' +
        '<div class="rc-tags"><span class="badge b-purple">'+s.trade+'</span>'+(s.pbgAvail?'<span class="badge b-teal">PBG ✓</span>':'')+'</div></div>' +
        '<div class="rc-right"><div class="rc-id" style="color:'+s.col+'">'+s.id+'</div><div style="font-size:9px;color:var(--text3);">'+s.workers+' workers</div></div>' +
      '</div>' +
      '<div class="rc-footer"><span>📞 '+s.phone+'</span><span>'+s.exp+'</span></div></div>';
  }).join('') || '<div style="text-align:center;padding:30px;color:var(--text3);">No subcontractors found</div>';
  var st=document.getElementById('stat-sc-total'); if(st)st.textContent=SUBCONTRACTORS.length;
}

function renderLabour(list) {
  list = list || LABOURERS;
  if (labCatFilter !== 'all') list = list.filter(function(l){return (l.skill||'').toLowerCase()===labCatFilter;});
  var el = document.getElementById('labour-list'); if (!el) return;
  var tc={'skilled':'#1565C0','semi-skilled':'#7B1FA2','unskilled':'#E65100'};
  el.innerHTML = list.map(function(l) {
    var col = tc[l.type]||'#E65100';
    return '<div class="reg-card" onclick="openDetail(\'labour\',\''+l.id+'\')">' +
      '<div class="rc-accent" style="background:'+col+'"></div>' +
      '<div class="rc-body">' +
        '<div class="avatar" style="background:'+col+'">'+(l.name||'?').split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2)+'</div>' +
        '<div class="rc-info"><div class="rc-name">'+l.name+'</div><div class="rc-sub">'+(l.skill||'—')+(l.project?' · '+l.project:'')+'</div></div>' +
        '<div class="rc-right"><div class="rc-id" style="color:'+col+'">'+l.labId+'</div><div style="font-size:11px;font-weight:800;color:#1B5E20;margin-top:4px;">₹'+Number(l.dailyRate||0).toLocaleString('en-IN')+'/day</div></div>' +
      '</div>' +
      '<div class="rc-footer"><span>📞 '+(l.phone||'—')+'</span><span>'+l.skill+'</span></div></div>';
  }).join('') || '<div style="text-align:center;padding:30px;color:var(--text3);">No labourers found</div>';
  var stTotal=document.getElementById('stat-lab-total'); if(stTotal)stTotal.textContent=LABOURERS.length;
}

function renderUsers(list) {
  list = list || USERS;
  if (userRoleFilter !== 'all' && userRoleFilter !== 'subcontractor') list = list.filter(function(u){return u.role===userRoleFilter||u.status===userRoleFilter;});
  var el = document.getElementById('user-list'); if (!el) return;
  var stBadge={active:'b-green',pending:'b-amber',inactive:'b-red',rejected:'b-red'};
  el.innerHTML = list.slice(0,50).map(function(u) {
    var col = ROLE_COLORS[u.role]||'#37474F';
    return '<div class="reg-card" onclick="openDetail(\'user\',\''+u.id+'\')">' +
      '<div class="rc-accent" style="background:'+col+'"></div>' +
      '<div class="rc-body">' +
        '<div class="avatar" style="background:'+col+'">'+(u.name||'?').split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2)+'</div>' +
        '<div class="rc-info" style="min-width:0;flex:1;"><div class="rc-name" style="white-space:normal;word-break:break-word;">'+u.name+'</div>' +
        '<div class="rc-sub">'+(u.access||'—')+' · '+(u.dept||'—')+'</div>' +
        '<div class="rc-tags"><span class="badge '+(stBadge[u.status]||'b-navy')+'">'+u.status+'</span></div></div>' +
        '<div class="rc-right" style="flex-shrink:0;"><div class="rc-id" style="color:'+col+'">'+(u.empId||u.employee_code||'—')+'</div></div>' +
      '</div>' +
      '<div class="rc-footer"><span>📱 '+(u.phone||'—')+'</span></div></div>';
  }).join('') || '<div style="text-align:center;padding:30px;color:var(--text3);">No users found</div>';
}

function filterVendors(cat,el) {
  document.querySelectorAll('#vendor-cat-pills .pill').forEach(function(p){p.style.background='';p.style.borderColor='';p.style.color='';});
  if(el){el.style.background='var(--teal)';el.style.borderColor='var(--teal)';el.style.color='white';}
  vendorCatFilter=cat; renderVendors(cat==='all'?null:VENDORS.filter(function(v){return v.cat.toLowerCase().includes(cat);}));
}
function filterMaterials(cat,el) {
  document.querySelectorAll('#mat-cat-pills .pill').forEach(function(p){p.style.background='';p.style.borderColor='';p.style.color='';});
  if(el){el.style.background='var(--green)';el.style.borderColor='var(--green)';el.style.color='white';}
  matCatFilter=cat; renderMaterials(cat==='all'?null:MATERIALS.filter(function(m){return m.cat.toLowerCase().includes(cat);}));
}
function filterSC(cat,el) {
  document.querySelectorAll('#sc-cat-pills .pill').forEach(function(p){p.style.background='';p.style.borderColor='';p.style.color='';});
  if(el){el.style.background='var(--purple)';el.style.borderColor='var(--purple)';el.style.color='white';}
  scCatFilter=cat; renderSC(cat==='all'?null:SUBCONTRACTORS.filter(function(s){return s.trade.toLowerCase().includes(cat);}));
}
function filterLabour(cat,el) {
  document.querySelectorAll('#lab-cat-pills .pill').forEach(function(p){p.style.background='';p.style.borderColor='';p.style.color='';});
  if(el){el.style.background='#E65100';el.style.borderColor='#E65100';el.style.color='white';}
  labCatFilter=cat; renderLabour();
}
function filterUsers(role,el) {
  document.querySelectorAll('#user-role-pills .pill').forEach(function(p){p.style.background='';p.style.borderColor='';p.style.color='';});
  if(el){el.style.background='var(--rose)';el.style.borderColor='var(--rose)';el.style.color='white';}
  userRoleFilter=role; renderUsers();
}

function searchList(type,q) {
  var ql=q.toLowerCase();
  if(type==='vendors')   renderVendors(VENDORS.filter(function(v){return v.name.toLowerCase().includes(ql)||v.cat.includes(ql)||v.gst.toLowerCase().includes(ql);}));
  if(type==='materials') renderMaterials(MATERIALS.filter(function(m){return m.name.toLowerCase().includes(ql)||m.code.toLowerCase().includes(ql)||m.cat.includes(ql);}));
  if(type==='sc')        renderSC(SUBCONTRACTORS.filter(function(s){return s.name.toLowerCase().includes(ql)||s.trade.includes(ql);}));
  if(type==='labour')    renderLabour(LABOURERS.filter(function(l){return l.name.toLowerCase().includes(ql)||(l.skill||'').toLowerCase().includes(ql);}));
  if(type==='users')     renderUsers(USERS.filter(function(u){return u.name.toLowerCase().includes(ql)||u.role.includes(ql)||u.dept.toLowerCase().includes(ql);}));
}

function openAdd() {
  document.getElementById('add-title').textContent = 'Add New — ' + currentPage;
  document.getElementById('add-body').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);">Form for ' + currentPage + '</div>';
  document.getElementById('add-foot').innerHTML = '<button class="btn btn-outline" onclick="closeSheet(\'ov-add\',\'sh-add\')">Cancel</button>';
  openSheet('ov-add','sh-add');
}

function openDetail(type,id) {
  var items={vendor:VENDORS,material:MATERIALS,sc:SUBCONTRACTORS,labour:LABOURERS,user:USERS};
  var item=(items[type]||[]).find(function(x){return x.id===id;});
  if(!item) return;
  document.getElementById('det-title').textContent = item.name;
  document.getElementById('det-body').innerHTML = '<div style="padding:12px;">' + Object.keys(item).filter(function(k){return typeof item[k]==='string'&&item[k];}).slice(0,8).map(function(k){return ir(k,item[k]);}).join('') + '</div>';
  document.getElementById('det-foot').innerHTML = '<button class="btn btn-outline" onclick="closeSheet(\'ov-det\',\'sh-det\')">Close</button>';
  openSheet('ov-det','sh-det');
}

function switchPage(p) {
  currentPage=p;
  ['vendors','materials','subcontractors','labour','settings'].forEach(function(t){
    var pg=document.getElementById('pg-'+t); var nv=document.getElementById('nav-'+t);
    if(pg)pg.classList.toggle('on',t===p);
    if(nv)nv.classList.toggle('on',t===p);
  });
}

function updateAllStats() {
  function setEl(id,val){var el=document.getElementById(id);if(el)el.textContent=val;}
  setEl('stat-v-total',VENDORS.length);
  setEl('stat-m-total',MATERIALS.length);
  setEl('stat-sc-total',SUBCONTRACTORS.length);
  setEl('stat-lab-total',LABOURERS.length);
  setEl('stat-emp-total',USERS.length);
  setEl('stat-emp-active',USERS.filter(function(u){return u.status==='active';}).length);
  setEl('stat-emp-pending',USERS.filter(function(u){return u.status==='pending';}).length);
  setEl('dk-workers',USERS.filter(function(u){return u.status==='active';}).length||'—');
}

function rebuildPills(type,containerId,activeColor,filterFn) {
  var cats=(CAT_DATA[type]||[]).filter(function(c){return c.active;});
  var el=document.getElementById(containerId); if(!el)return;
  el.innerHTML='<div class="pill on" style="background:'+activeColor+';border-color:'+activeColor+';color:white" onclick="'+filterFn.name+'(\'all\',this)">All</div>'+
    cats.map(function(c){return '<div class="pill" onclick="'+filterFn.name+'(\''+c.name.toLowerCase().replace(/[^a-z0-9]/g,'')+'\',this)">'+c.icon+' '+c.name+'</div>';}).join('');
}

function renderCatSection(type,containerId) {
  var cats=(CAT_DATA[type])||[]; var el=document.getElementById(containerId); if(!el)return;
  el.innerHTML=cats.map(function(c,i){
    return '<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid var(--border);">' +
      '<div style="width:38px;height:38px;border-radius:10px;background:'+c.color+'20;border:1px solid '+c.color+'40;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">'+c.icon+'</div>' +
      '<div style="flex:1;"><div style="font-size:13px;font-weight:800;">'+c.name+'</div><div style="font-size:11px;color:var(--text3);">'+c.desc+'</div></div>' +
      '<div onclick="toggleCat(\''+type+'\','+i+')" style="width:40px;height:22px;border-radius:11px;background:'+(c.active?'var(--green)':'#CBD5E1')+';position:relative;cursor:pointer;">' +
        '<div style="position:absolute;top:3px;left:'+(c.active?'21':'3')+'px;width:16px;height:16px;border-radius:50%;background:white;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.2);"></div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function toggleCat(type,i){
  CAT_DATA[type][i].active=!CAT_DATA[type][i].active;
  renderCatSection(type,catSectionMap[type]);
  toast(CAT_DATA[type][i].name+' '+(CAT_DATA[type][i].active?'enabled':'disabled'),'success');
}

function addCategory(type){
  document.getElementById('add-title').textContent='Add Category';
  document.getElementById('add-body').innerHTML='<label class="flbl">Category Name *</label><input class="finp" id="new-cat-name" placeholder="e.g. Precast Concrete"><label class="flbl">Icon (Emoji)</label><input class="finp" id="new-cat-icon" placeholder="e.g. 🏗️"><label class="flbl">Description</label><input class="finp" id="new-cat-desc" placeholder="Brief description">';
  document.getElementById('add-foot').innerHTML='<button class="btn btn-outline" onclick="closeSheet(\'ov-add\',\'sh-add\')">Cancel</button><button class="btn btn-navy" onclick="saveNewCat(\''+type+'\')">+ Add</button>';
  openSheet('ov-add','sh-add');
}

async function saveNewCat(type){
  var n=(document.getElementById('new-cat-name')||{value:''}).value.trim();
  if(!n){toast('Please enter a category name','warning');return;}
  var icon=(document.getElementById('new-cat-icon')||{value:''}).value.trim()||'📦';
  var desc=(document.getElementById('new-cat-desc')||{value:''}).value.trim()||'';
  var newCat={id:type+'-new-'+Date.now(),icon:icon,name:n,desc:desc,color:'#37474F',count:0,active:true};
  CAT_DATA[type].push(newCat);
  renderCatSection(type,catSectionMap[type]);
  rebuildPills(type,{vendor:'vendor-cat-pills',material:'mat-cat-pills',sc:'sc-cat-pills',labour:'lab-cat-pills'}[type]||'','#37474F',{vendor:filterVendors,material:filterMaterials,sc:filterSC,labour:filterLabour}[type]||function(){});
  closeSheet('ov-add','sh-add');
  toast(n+' added!','success');
  try{await sbInsert('categories',{type:type,name:n,icon:icon,description:desc,color:'#37474F',active:true});}catch(e){console.warn(e);}
}

async function loadCategories(){
  try{
    var data=await sbFetch('categories',{select:'*',order:'created_at.asc'});
    if(!data||!data.length)return;
    ['vendor','material','sc','uom','role','dept','labour','resource'].forEach(function(type){
      var dbCats=data.filter(function(c){return c.type===type;});
      if(dbCats.length){CAT_DATA[type]=dbCats.map(function(c){return {id:c.id,icon:c.icon||'📦',name:c.name,desc:c.description||'',color:c.color||'#37474F',count:0,active:c.active};});}
    });
    Object.keys(catSectionMap).forEach(function(type){renderCatSection(type,catSectionMap[type]);});
  }catch(e){console.error('loadCategories:',e);}
}

function catOptions(type){
  return (CAT_DATA[type]||[]).filter(function(c){return c.active;}).map(function(c){return '<option value="'+c.name+'">'+c.icon+' '+c.name+'</option>';}).join('');
}

async function deleteRecord(type,id){
  var arrays={vendor:VENDORS,material:MATERIALS,sc:SUBCONTRACTORS,user:USERS};
  var tables={vendor:'vendors',material:'materials',sc:'subcontractors',user:'employees'};
  var arr=arrays[type]; if(!arr)return;
  var idx=arr.findIndex(function(x){return x.id===id;});
  if(idx===-1)return;
  var name=arr[idx].name;
  _deletedIds[id]=true; arr.splice(idx,1);
  closeSheet('ov-det','sh-det');
  var renders={vendor:renderVendors,material:renderMaterials,sc:renderSC,user:renderUsers};
  if(renders[type])renders[type]();
  updateAllStats(); toast(name+' deleted','success');
  try{await sbDelete(tables[type],id);}catch(e){console.error(e);}
}

// Stub: detail / edit (minimal, expandable)
function editRecord(type,id){toast('Edit form — expand in registry.js','info');}
function confirmDelete(type,id,name){
  document.getElementById('det-body').innerHTML='<div style="text-align:center;padding:24px;"><div style="font-size:48px;margin-bottom:12px;">⚠️</div><div style="font-size:16px;font-weight:800;margin-bottom:8px;">Delete?</div><div style="font-size:13px;color:var(--text2);">Delete <strong>'+name+'</strong>? This cannot be undone.</div></div>';
  document.getElementById('det-foot').innerHTML='<button class="btn btn-outline" onclick="closeSheet(\'ov-det\',\'sh-det\')">Cancel</button><button class="btn btn-red" onclick="deleteRecord(\''+type+'\',\''+id+'\')">🗑 Delete</button>';
}

// Save stubs (expand as needed)
async function saveVendor(){toast('Save vendor — implement in registry.js','info');}
async function saveMaterial(){toast('Save material — implement in registry.js','info');}
async function saveSC(){toast('Save SC — implement in registry.js','info');}
async function saveUser(){toast('Save user — implement in registry.js','info');}
async function saveLabour(editId){toast('Save labour — implement in registry.js','info');}
