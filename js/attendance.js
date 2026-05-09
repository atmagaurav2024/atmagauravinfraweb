// ═══════════════════════════════════════════
// ATTENDANCE.JS — Punch, GPS, Table, Leave
// ═══════════════════════════════════════════

var isPunchedIn=false, punchInTime=null, punchLog=[];
var currentLat=null, currentLng=null, currentAccuracy=null;
var selfieOk=false, selfieUrl=null;
var ATT_DATA=[], ATT_DATE=new Date().toISOString().slice(0,10), ATT_TAB='today';
var LEAVE_DATA=[], PUNCH_LOG_DATE=new Date().toISOString().slice(0,10);
var clockInt=null;

function initAttendance(){
  tick(); clockInt=setInterval(tick,1000);
  refreshGPS(); renderAttTable(); renderCal(); renderLeave(); renderPunchLog(); initPunchLogDate();
  applyAttendanceRoleView();
}

function applyAttendanceRoleView(){
  var u=currentUser; if(!u)return;
  var isAdmin=(u.role==='admin'||u.role==='pm');
  var selfView=document.getElementById('self-view-section');
  var adminView=document.getElementById('admin-view-section');
  if(selfView)selfView.style.display='block';
  if(adminView)adminView.style.display=isAdmin?'block':'none';
}

function tick(){
  var now=new Date();
  var h=String(now.getHours()).padStart(2,'0'), m=String(now.getMinutes()).padStart(2,'0'), s=String(now.getSeconds()).padStart(2,'0');
  var timeEl=document.getElementById('hero-clock'); if(timeEl)timeEl.textContent=h+':'+m+':'+s;
  var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var dateEl=document.getElementById('hero-date'); if(dateEl)dateEl.textContent=days[now.getDay()]+', '+now.getDate()+' '+months[now.getMonth()]+' '+now.getFullYear();
  if(isPunchedIn&&punchInTime){
    var diff=Math.floor((now-punchInTime)/1000);
    var dh=String(Math.floor(diff/3600)).padStart(2,'0'), dm=String(Math.floor((diff%3600)/60)).padStart(2,'0'), ds=String(diff%60).padStart(2,'0');
    var mytime=document.getElementById('stat-mytime'); if(mytime)mytime.textContent=dh+':'+dm+':'+ds;
  }
}

function refreshGPS(){
  var strip=document.getElementById('gps-strip'), txt=document.getElementById('gps-text'), coords=document.getElementById('gps-coords-display');
  if(strip)strip.className='gps-strip gps-checking';
  if(txt)txt.textContent='Getting location...';
  if(!navigator.geolocation){if(strip)strip.className='gps-strip gps-fail';if(txt)txt.textContent='GPS not available';return;}
  navigator.geolocation.getCurrentPosition(function(pos){
    currentLat=pos.coords.latitude; currentLng=pos.coords.longitude; currentAccuracy=pos.coords.accuracy;
    if(strip)strip.className='gps-strip gps-ok';
    if(txt)txt.textContent='Location acquired';
    if(coords)coords.textContent=currentLat.toFixed(5)+', '+currentLng.toFixed(5)+' (±'+Math.round(currentAccuracy)+'m)';
  },function(){
    if(strip)strip.className='gps-strip gps-fail';if(txt)txt.textContent='Location denied';
    currentLat=null;currentLng=null;
  },{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
}

function doPunch(){
  selfieOk=false;selfieUrl=null;
  var title=document.getElementById('punch-modal-title');if(title)title.textContent=isPunchedIn?'Punch Out':'Punch In';
  var selfieBox=document.getElementById('selfie-box'), selfieContent=document.getElementById('selfie-content');
  if(selfieBox)selfieBox.style.background='var(--bg3)';
  if(selfieContent)selfieContent.innerHTML='<span style="font-size:40px;">📷</span>';
  var coordsEl=document.getElementById('modal-coords'), accEl=document.getElementById('modal-accuracy');
  if(coordsEl)coordsEl.textContent=currentLat?currentLat.toFixed(5)+', '+currentLng.toFixed(5):'Not available';
  if(accEl)accEl.textContent=currentAccuracy?'±'+Math.round(currentAccuracy)+'m':'—';
  var now=new Date(), timeInp=document.getElementById('punch-time-input');
  if(timeInp)timeInp.value=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  var modal=document.getElementById('punch-modal');
  if(modal){modal.style.display='flex';requestAnimationFrame(function(){modal.style.opacity='1';});}
}

function closePunchModal(){
  var modal=document.getElementById('punch-modal');
  if(modal){modal.style.opacity='0';setTimeout(function(){modal.style.display='none';},300);}
}

function takeSelfie(){
  var input=document.createElement('input');input.type='file';input.accept='image/*';input.capture='user';
  input.onchange=function(e){
    var file=e.target.files[0];if(!file)return;
    var reader=new FileReader();
    reader.onload=function(ev){
      var sc=document.getElementById('selfie-content'),sb=document.getElementById('selfie-box');
      if(sc)sc.innerHTML='<img src="'+ev.target.result+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
      if(sb)sb.style.background='transparent';
      selfieOk=true;selfieUrl=ev.target.result;toast('Selfie captured ✓','success');
    };reader.readAsDataURL(file);
  };input.click();
}

async function confirmPunch(){
  var timeInp=document.getElementById('punch-time-input');
  var punchTime=timeInp?timeInp.value:new Date().toTimeString().slice(0,5);
  var now=new Date();
  var entry={type:isPunchedIn?'out':'in',time:punchTime,timestamp:now.toISOString(),lat:currentLat,lng:currentLng,accuracy:currentAccuracy,selfie:selfieUrl,empId:currentUser?currentUser.empId:null};
  punchLog.push(entry);
  if(!isPunchedIn){
    isPunchedIn=true;punchInTime=now;
    var ring=document.getElementById('punch-ring'),icon=document.getElementById('punch-icon'),label=document.getElementById('punch-label'),status=document.getElementById('punch-status');
    if(ring)ring.className='punch-ring punch-ring-out';
    if(icon)icon.textContent='🔴';if(label)label.textContent='PUNCH OUT';if(status)status.textContent='Punched in at '+punchTime;
    toast('Punched in at '+punchTime,'success');
    try{await sbInsert('attendance_punches',{emp_id:entry.empId,punch_type:'in',punch_time:entry.timestamp,lat:entry.lat,lng:entry.lng,accuracy:entry.accuracy,date:now.toISOString().slice(0,10)});}catch(e){console.warn(e);}
  } else {
    isPunchedIn=false;punchInTime=null;
    var ring2=document.getElementById('punch-ring'),icon2=document.getElementById('punch-icon'),label2=document.getElementById('punch-label'),status2=document.getElementById('punch-status');
    if(ring2)ring2.className='punch-ring punch-ring-in';
    if(icon2)icon2.textContent='🟢';if(label2)label2.textContent='PUNCH IN';if(status2)status2.textContent='Ready to punch in';
    toast('Punched out at '+punchTime,'success');
    try{await sbInsert('attendance_punches',{emp_id:entry.empId,punch_type:'out',punch_time:entry.timestamp,lat:entry.lat,lng:entry.lng,accuracy:entry.accuracy,date:now.toISOString().slice(0,10)});}catch(e){console.warn(e);}
  }
  closePunchModal();renderPunchLog();
}

async function renderAttTable(){
  var tbody=document.getElementById('att-tbody');if(!tbody)return;
  tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3);">Loading...</td></tr>';
  try{
    var today=new Date().toISOString().slice(0,10);
    var data=await sbFetch('attendance',{select:'*',filter:'date=eq.'+today,order:'created_at.asc'});
    ATT_DATA=Array.isArray(data)?data:[];
    var emps=USERS&&USERS.length?USERS.filter(function(u){return u.status==='active';}):[];
    if(!emps.length){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3);">No active employees</td></tr>';return;}
    var attMap={};ATT_DATA.forEach(function(a){if(a.emp_id)attMap[a.emp_id]=a;});
    tbody.innerHTML=emps.map(function(u){
      var att=attMap[u.empId]||{};var status=att.status||'absent';
      var badges={present:'b-present',absent:'b-absent',half:'b-half',leave:'b-leave',wo:'b-wo'};
      var col=(typeof ROLE_COLORS!=='undefined'&&ROLE_COLORS[u.role])||'#37474F';
      var initials=(u.name||'?').split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase();
      return '<tr>'+
        '<td><div class="emp-cell"><div class="emp-avatar" style="background:'+col+';">'+initials+'</div><div><div class="emp-name">'+u.name+'</div><div class="emp-desig">'+(u.access||u.role)+'</div></div></div></td>'+
        '<td><div class="status-row">'+['present','absent','half','leave','wo'].map(function(s){return '<button class="sts-btn '+s+(status===s?' sel':'')+'" onclick="setStatus(\''+u.empId+'\',\''+s+'\',this)">'+s[0].toUpperCase()+'</button>';}).join('')+'</div></td>'+
        '<td><span class="att-badge '+(badges[status]||'b-absent')+'">'+status+'</span></td>'+
        '<td><input type="time" class="time-in" value="'+(att.time_in||'')+'" id="ti-'+u.empId+'"></td>'+
        '<td><input type="time" class="time-in" value="'+(att.time_out||'')+'" id="to-'+u.empId+'"></td>'+
        '<td>'+(att.lat?'<span class="gps-tag gps-site">📍 Site</span>':'<span class="gps-tag gps-manual">Manual</span>')+'</td>'+
        '<td>'+(att.remarks||'—')+'</td>'+
      '</tr>';
    }).join('');
    updateSummary();lockStatusBtnsIfNotAdmin();
  }catch(e){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--red);">Error loading</td></tr>';console.error(e);}
}

function setStatus(empId,status,btn){
  var row=btn.closest('tr');
  row.querySelectorAll('.sts-btn').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  var badges={present:'b-present',absent:'b-absent',half:'b-half',leave:'b-leave',wo:'b-wo'};
  var badgeEl=row.querySelector('.att-badge');
  if(badgeEl){badgeEl.className='att-badge '+(badges[status]||'b-absent');badgeEl.textContent=status;}
  updateSummary();
  var today=new Date().toISOString().slice(0,10);
  sbFetch('attendance',{select:'id',filter:'emp_id=eq.'+empId+'&date=eq.'+today}).then(function(ex){
    if(ex&&ex[0])return sbUpdate('attendance',ex[0].id,{status:status});
    else return sbInsert('attendance',{emp_id:empId,date:today,status:status});
  }).catch(function(e){console.warn('setStatus:',e);});
}

function lockStatusBtnsIfNotAdmin(){
  var isAdmin=currentUser&&(currentUser.role==='admin'||currentUser.role==='pm');
  if(!isAdmin)document.querySelectorAll('.sts-btn').forEach(function(b){b.style.pointerEvents='none';b.style.opacity='0.5';});
}

function updateSummary(){
  var counts={present:0,absent:0,half:0,leave:0,wo:0};
  document.querySelectorAll('#att-tbody tr').forEach(function(row){
    var badge=row.querySelector('.att-badge');
    if(badge){var s=badge.textContent.trim().toLowerCase();if(counts[s]!==undefined)counts[s]++;}
  });
  function setEl(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
  setEl('stat-present',counts.present);setEl('stat-absent',counts.absent);
  setEl('stat-half',counts.half||0);setEl('stat-leave',counts.leave||0);setEl('stat-wo',counts.wo||0);
}

function markAllPresent(){
  document.querySelectorAll('#att-tbody .sts-btn.present').forEach(function(btn){if(!btn.classList.contains('sel'))btn.click();});
  toast('All marked present','success');
}

function renderCal(){
  var cal=document.getElementById('month-cal');if(!cal)return;
  var now=new Date(),year=now.getFullYear(),month=now.getMonth();
  var first=new Date(year,month,1).getDay(),days=new Date(year,month+1,0).getDate(),today=now.getDate();
  var headers=['S','M','T','W','T','F','S'].map(function(d){return '<div style="text-align:center;font-size:10px;font-weight:700;color:var(--text3);padding:4px;">'+d+'</div>';}).join('');
  var cells='';
  for(var i=0;i<first;i++)cells+='<div class="day-cell dc-no"></div>';
  for(var d=1;d<=days;d++){
    var isToday=d===today,isFuture=d>today,isSun=(first+d-1)%7===0;
    var cls=isFuture?'dc-future':isSun?'dc-wo':'dc-present';
    cells+='<div class="day-cell '+cls+(isToday?' today':'')+'"><div class="day-num">'+d+'</div><div class="day-dot">'+(isFuture?'':isSun?'WO':'P')+'</div></div>';
  }
  cal.innerHTML='<div class="month-grid">'+headers+cells+'</div>';
}

async function renderLeave(){
  var tbody=document.getElementById('leave-tbody');if(!tbody)return;
  try{
    var data=await sbFetch('leave_requests',{select:'*',order:'created_at.desc'});
    LEAVE_DATA=Array.isArray(data)?data:[];
    if(!LEAVE_DATA.length){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3);">No leave requests</td></tr>';return;}
    tbody.innerHTML=LEAVE_DATA.slice(0,30).map(function(l){
      var badge=l.status==='approved'?'b-green':l.status==='rejected'?'b-red':'b-amber';
      var canApprove=l.status==='pending'&&currentUser&&(currentUser.role==='admin'||currentUser.role==='pm');
      return '<tr><td>'+(l.emp_name||l.emp_id||'—')+'</td><td>'+(l.leave_type||'—')+'</td><td>'+fmtDate(l.from_date)+'</td><td>'+fmtDate(l.to_date)+'</td><td>'+(l.days||'—')+'</td>'+
        '<td><span class="badge '+badge+'">'+(l.status||'pending')+'</span>'+(canApprove?' <button class="btn btn-sm btn-green" onclick="approveLeave(\''+l.id+'\',this)">✓</button>':'')+'</td></tr>';
    }).join('');
  }catch(e){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3);">No leave data</td></tr>';}
}

async function approveLeave(id,btn){
  try{
    await sbUpdate('leave_requests',id,{status:'approved'});
    var idx=LEAVE_DATA.findIndex(function(l){return l.id===id;});
    if(idx>-1)LEAVE_DATA[idx].status='approved';
    renderLeave();toast('Leave approved','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

function openLeaveModal(){
  document.getElementById('leave-modal').style.display='flex';
  var sel=document.getElementById('leave-emp-sel');
  if(sel&&USERS&&USERS.length){
    sel.innerHTML='<option value="">Select employee...</option>'+USERS.filter(function(u){return u.status==='active';}).map(function(u){return '<option value="'+u.empId+'">'+u.name+'</option>';}).join('');
  }
}
function closeLeaveModal(){document.getElementById('leave-modal').style.display='none';}

async function submitLeave(){
  var empSel=document.getElementById('leave-emp-sel'),leaveType=document.getElementById('leave-type-sel');
  var fromDate=document.getElementById('leave-from'),toDate=document.getElementById('leave-to'),reason=document.getElementById('leave-reason');
  if(!empSel||!empSel.value){toast('Select employee','warning');return;}
  if(!fromDate||!fromDate.value){toast('Select from date','warning');return;}
  if(!toDate||!toDate.value){toast('Select to date','warning');return;}
  var from=new Date(fromDate.value),to=new Date(toDate.value);
  var days=Math.round((to-from)/(1000*60*60*24))+1;
  var emp=USERS.find(function(u){return u.empId===empSel.value;});
  try{
    await sbInsert('leave_requests',{emp_id:empSel.value,emp_name:emp?emp.name:empSel.value,leave_type:leaveType?leaveType.value:'CL',from_date:fromDate.value,to_date:toDate.value,days:days,reason:reason?reason.value:'',status:'pending'});
    closeLeaveModal();renderLeave();toast('Leave request submitted','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

function switchTab(tab){
  ATT_TAB=tab;
  document.querySelectorAll('.tabs-row .tab').forEach(function(t){t.classList.toggle('active',t.dataset.tab===tab);});
  var sections={today:'att-today-section',calendar:'att-cal-section',leave:'att-leave-section',punchlog:'att-punchlog-section'};
  Object.keys(sections).forEach(function(k){var el=document.getElementById(sections[k]);if(el)el.style.display=k===tab?'block':'none';});
  if(tab==='today')renderAttTable();
  if(tab==='calendar')renderCal();
  if(tab==='leave')renderLeave();
  if(tab==='punchlog')renderPunchLog();
}

async function renderPunchLog(){
  var wrap=document.getElementById('punch-log-wrap');if(!wrap)return;
  try{
    var filter='date=eq.'+PUNCH_LOG_DATE;
    if(currentUser&&currentUser.role!=='admin')filter+='&emp_id=eq.'+currentUser.empId;
    var data=await sbFetch('attendance_punches',{select:'*',filter:filter,order:'punch_time.asc'});
    var log=Array.isArray(data)&&data.length?data:punchLog;
    if(!log.length){wrap.innerHTML='<div class="punch-log-empty">No punch records for this date</div>';return;}
    wrap.innerHTML=log.map(function(entry){
      var isIn=entry.punch_type==='in'||entry.type==='in';
      var timeStr=entry.punch_time?new Date(entry.punch_time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):(entry.time||'—');
      return '<div class="punch-entry">'+
        '<div class="punch-dot '+(isIn?'punch-dot-in':'punch-dot-out')+'"></div>'+
        '<div class="punch-entry-info"><div class="punch-entry-type">'+(isIn?'🟢 Punch In':'🔴 Punch Out')+'</div>'+
        '<div class="punch-entry-time">'+timeStr+(entry.lat?' · 📍 Site':' · Manual')+'</div></div>'+
        (entry.lat?'<button class="btn btn-sm" onclick="openPunchMap('+(entry.lat||0)+','+(entry.lng||0)+')" style="font-size:11px;">🗺 Map</button>':'')+
      '</div>';
    }).join('');
  }catch(e){wrap.innerHTML='<div class="punch-log-empty">Error loading punch log</div>';}
}

function openPunchMap(lat,lng){window.open('https://www.google.com/maps?q='+lat+','+lng,'_blank');}

function initPunchLogDate(){
  var inp=document.getElementById('punchlog-date');
  if(inp){inp.value=PUNCH_LOG_DATE;inp.onchange=function(){PUNCH_LOG_DATE=inp.value;renderPunchLog();};}
}
