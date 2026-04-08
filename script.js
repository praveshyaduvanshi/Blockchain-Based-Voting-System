// ===== STATE =====
const DB = {
  voters: JSON.parse(localStorage.getItem('cv_voters')||'[]'),
  candidates: JSON.parse(localStorage.getItem('cv_candidates')||'[]'),
  votes: JSON.parse(localStorage.getItem('cv_votes')||'[]'),
  blockchain: JSON.parse(localStorage.getItem('cv_chain')||'[]'),
  electionOpen: JSON.parse(localStorage.getItem('cv_election')||'false'),
  electionEnded: JSON.parse(localStorage.getItem('cv_ended')||'false'),
};
let currentVoter = null;
let otpData = {code:'',target:'',action:''};
let selectedCandidate = null;

function save(){
  localStorage.setItem('cv_voters',JSON.stringify(DB.voters));
  localStorage.setItem('cv_candidates',JSON.stringify(DB.candidates));
  localStorage.setItem('cv_votes',JSON.stringify(DB.votes));
  localStorage.setItem('cv_chain',JSON.stringify(DB.blockchain));
  localStorage.setItem('cv_election',JSON.stringify(DB.electionOpen));
  localStorage.setItem('cv_ended',JSON.stringify(DB.electionEnded));
}

// Init genesis block
if(DB.blockchain.length===0){
  DB.blockchain.push({
    index:0,type:'genesis',data:'ChainVote Genesis Block',
    previousHash:'0000000000000000',
    hash:sha256mock('genesis'+Date.now()),
    timestamp:new Date().toISOString(),nonce:0
  });
  save();
}

// ===== SHA-256 MOCK (deterministic) =====
function sha256mock(str){
  let h=0x811c9dc5;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h+=( h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);}
  let r=(h>>>0).toString(16).padStart(8,'0');
  // Expand to 64 chars for realism
  let seed=str;
  let result=r;
  for(let i=0;i<7;i++){
    let h2=0;
    for(let j=0;j<seed.length;j++){h2=(h2*31+seed.charCodeAt(j))>>>0;}
    result+=(h2>>>0).toString(16).padStart(8,'0');
    seed=result;
  }
  return result.substring(0,64);
}

function genWallet(){
  return '0x'+Array.from({length:40},()=>'0123456789abcdef'[Math.floor(Math.random()*16)]).join('');
}

function genOTP(){return String(Math.floor(100000+Math.random()*900000));}

// ===== NAVIGATION =====
function goto(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showAlert(id,msg,type='error'){
  const el=document.getElementById(id);
  if(!el)return;
  el.textContent=msg;
  el.className='alert '+type+' show';
  setTimeout(()=>el.classList.remove('show'),4000);
}

function toast(msg,type='success'){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className='show '+type;
  setTimeout(()=>t.className='',3000);
}

function showModal(icon,title,text,cb){
  document.getElementById('modal-icon').textContent=icon;
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-text').textContent=text;
  document.getElementById('modal').classList.add('show');
  document.getElementById('modal-ok').onclick=()=>{closeModal();if(cb)cb();};
}
function closeModal(){document.getElementById('modal').classList.remove('show');}

// ===== EC AUTH =====
function ecLogin(){
  const u=document.getElementById('ec-user').value.trim();
  const p=document.getElementById('ec-pass').value.trim();
  if(u==='admin'&&p==='admin123'){
    goto('ec-dash');
    refreshEC();
  } else {
    showAlert('ec-alert','Invalid credentials. Use admin / admin123');
  }
}
function ecLogout(){goto('landing');}

// ===== VOTER SIGNUP =====
function voterSignup(){
  const name=document.getElementById('s-name').value.trim();
  const vid=document.getElementById('s-vid').value.trim().toUpperCase();
  const email=document.getElementById('s-email').value.trim();
  const mobile=document.getElementById('s-mobile').value.trim();
  const pass=document.getElementById('s-pass').value.trim();
  if(!name||!vid||!email||!mobile||!pass){showAlert('signup-alert','Please fill all fields');return;}
  if(vid.length<8){showAlert('signup-alert','Voter ID must be at least 8 characters');return;}
  if(pass.length<6){showAlert('signup-alert','Password must be at least 6 characters');return;}
  if(DB.voters.find(v=>v.vid===vid)){showAlert('signup-alert','Voter ID already registered');return;}
  const otp=genOTP();
  otpData={code:otp,target:mobile,action:'signup',data:{name,vid,email,mobile,pass,wallet:genWallet()}};
  document.getElementById('otp-target').textContent=mobile;
  document.getElementById('otp-display').textContent=otp;
  ['o1','o2','o3','o4','o5','o6'].forEach(id=>document.getElementById(id).value='');
  goto('otp-screen');
  document.getElementById('o1').focus();
}

// ===== VOTER LOGIN =====
function voterLogin(){
  const vid=document.getElementById('l-vid').value.trim().toUpperCase();
  const pass=document.getElementById('l-pass').value.trim();
  const voter=DB.voters.find(v=>v.vid===vid&&v.pass===pass);
  if(!voter){showAlert('login-alert','Invalid Voter ID or password');return;}
  const otp=genOTP();
  otpData={code:otp,target:voter.mobile,action:'login',data:{voter}};
  document.getElementById('otp-target').textContent=voter.mobile;
  document.getElementById('otp-display').textContent=otp;
  ['o1','o2','o3','o4','o5','o6'].forEach(id=>document.getElementById(id).value='');
  goto('otp-screen');
  document.getElementById('o1').focus();
}

function otpNext(el,nextId){
  el.value=el.value.replace(/\D/,'');
  if(el.value&&nextId)document.getElementById(nextId).focus();
}
function otpBack(e,el,prevId){
  if(e.key==='Backspace'&&!el.value&&prevId)document.getElementById(prevId).focus();
}

function getOTPValue(){
  return ['o1','o2','o3','o4','o5','o6'].map(id=>document.getElementById(id).value).join('');
}

function verifyOTP(){
  const entered=getOTPValue();
  if(entered.length<6){showAlert('otp-alert','Enter 6-digit OTP');return;}
  if(entered!==otpData.code){showAlert('otp-alert','Incorrect OTP. Try again');return;}
  if(otpData.action==='signup'){
    DB.voters.push(otpData.data);save();
    showModal('✅','Registration Successful!','Your voter account has been created. Please login to proceed.',()=>goto('voter-login'));
  } else if(otpData.action==='login'){
    currentVoter=otpData.data.voter;
    loadVoterDash();
    goto('voter-dash');
  }
}

function resendOTP(){
  const newOtp=genOTP();
  otpData.code=newOtp;
  document.getElementById('otp-display').textContent=newOtp;
  toast('New OTP sent to '+otpData.target);
}

// ===== VOTER DASHBOARD =====
function loadVoterDash(){
  if(!currentVoter)return;
  const v=currentVoter;
  document.getElementById('nav-vid').textContent=v.vid;
  document.getElementById('v-avatar').textContent=v.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  document.getElementById('v-name').textContent=v.name;
  document.getElementById('pf-name').textContent=v.name;
  document.getElementById('pf-vid').textContent=v.vid;
  document.getElementById('pf-email').textContent=v.email;
  document.getElementById('pf-mobile').textContent=v.mobile;
  document.getElementById('pf-wallet').textContent=v.wallet.substring(0,20)+'…';
  refreshVoterDash();
}

function refreshVoterDash(){
  const hasVoted=DB.votes.find(vt=>vt.voterId===currentVoter.vid);
  const totalVotes=DB.votes.length;
  const numCands=DB.candidates.length;
  document.getElementById('h-total-votes').textContent=totalVotes;
  document.getElementById('h-candidates').textContent=numCands;
  const statusEl=document.getElementById('h-status-dot');
  const statusTxt=document.getElementById('h-status-text');
  if(DB.electionEnded){
    statusEl.className='status-indicator closed';
    statusTxt.innerHTML='Election Ended <span>Results are available</span>';
  } else if(DB.electionOpen){
    statusEl.className='status-indicator open';
    statusTxt.innerHTML='Election is LIVE <span>Voting in progress</span>';
  } else {
    statusEl.className='status-indicator closed';
    statusTxt.innerHTML='Election not active <span>Waiting for EC to open voting</span>';
  }
  document.getElementById('v-status-dot').className='status-indicator '+(DB.electionOpen?'open':'closed');
  document.getElementById('v-status-text').textContent=DB.electionOpen?'Voting is open':'Voting is closed';
  const vstEl=document.getElementById('pf-vstatus');
  if(hasVoted){vstEl.textContent='Voted ✓';vstEl.style.color='var(--green)';}
  else{vstEl.textContent='Not voted yet';vstEl.style.color='var(--text2)';}
  // vote tab
  const waiting=document.getElementById('vote-waiting');
  const voteOpen=document.getElementById('vote-open');
  const voteDone=document.getElementById('vote-done');
  if(hasVoted){waiting.style.display='none';voteOpen.style.display='none';voteDone.style.display='block';document.getElementById('done-hash').textContent=hasVoted.hash;}
  else if(DB.electionOpen&&!DB.electionEnded){waiting.style.display='none';voteOpen.style.display='block';voteDone.style.display='none';renderCandidates();}
  else{waiting.style.display='block';voteOpen.style.display='none';voteDone.style.display='none';}
  if(DB.electionEnded){waiting.style.display='none';voteOpen.style.display='none';}
  renderAnalytics();renderResults();renderChain('chain-list','chain-count');
}

function renderCandidates(){
  const grid=document.getElementById('candidates-grid');
  grid.innerHTML='';
  DB.candidates.forEach(c=>{
    const div=document.createElement('div');
    div.className='candidate-card';
    div.id='cc-'+c.id;
    div.innerHTML=`<div class="cand-symbol">${c.symbol||'🧑'}</div><div class="cand-party">${c.party}</div><div class="cand-name">${c.name}</div><div style="font-size:0.75rem;color:var(--text3);margin-top:0.25rem">${c.constituency||''}</div>`;
    div.onclick=()=>selectCandidate(c);
    grid.appendChild(div);
  });
  if(DB.candidates.length===0)grid.innerHTML='<div style="color:var(--text3);font-size:0.85rem;grid-column:span 2;padding:1rem">No candidates registered yet</div>';
}

function selectCandidate(c){
  selectedCandidate=c;
  document.querySelectorAll('.candidate-card').forEach(el=>el.classList.remove('selected'));
  const el=document.getElementById('cc-'+c.id);
  if(el)el.classList.add('selected');
  const confirm=document.getElementById('vote-confirm');
  confirm.classList.add('show');
  document.getElementById('confirm-cand-name').textContent=c.name+' ('+c.party+')';
  const hashInput=currentVoter.vid+'|'+c.id+'|'+Date.now()+'|'+currentVoter.wallet;
  document.getElementById('vote-hash-preview').textContent=sha256mock(hashInput);
}

function castVote(){
  if(!selectedCandidate){toast('Select a candidate first','error');return;}
  const hasVoted=DB.votes.find(vt=>vt.voterId===currentVoter.vid);
  if(hasVoted){toast('You have already voted!','error');return;}
  const ts=new Date().toISOString();
  const voteData={voterId:currentVoter.vid,candidateId:selectedCandidate.id,timestamp:ts,wallet:currentVoter.wallet};
  const encData=btoa(JSON.stringify(voteData));
  const hash=sha256mock(encData+ts);
  const prevBlock=DB.blockchain[DB.blockchain.length-1];
  const block={
    index:DB.blockchain.length,type:'vote',
    data:{candidateId:selectedCandidate.id,candidateName:selectedCandidate.name,party:selectedCandidate.party,voterId:'anon_'+sha256mock(currentVoter.vid).substring(0,8),timestamp:ts},
    previousHash:prevBlock.hash,hash,timestamp:ts,nonce:Math.floor(Math.random()*99999)
  };
  DB.votes.push({voterId:currentVoter.vid,candidateId:selectedCandidate.id,hash,timestamp:ts});
  DB.blockchain.push(block);save();
  showModal('🔗','Vote Cast Successfully!','Your vote has been recorded on the blockchain with hash: '+hash.substring(0,20)+'...',()=>{refreshVoterDash();vTab('vote',document.querySelector('.nav-tab:nth-child(2)'));});
}

function renderAnalytics(){
  const bars=document.getElementById('analytics-bars');
  const emptyEl=document.getElementById('analytics-empty');
  const statsEl=document.getElementById('election-stats-list');
  const totalVotes=DB.votes.length;
  bars.innerHTML='';
  if(totalVotes===0){emptyEl.style.display='block';}
  else{
    emptyEl.style.display='none';
    DB.candidates.forEach(c=>{
      const cv=DB.votes.filter(v=>v.candidateId===c.id).length;
      const pct=totalVotes>0?Math.round(cv/totalVotes*100):0;
      bars.innerHTML+=`<div class="bar-row"><div class="bar-label">${c.name}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><div class="bar-pct">${pct}%</div></div>`;
    });
  }
  statsEl.innerHTML=`
    <div class="pf" style="margin-bottom:0.5rem"><div class="pf-label">Total Votes</div><div class="pf-value">${totalVotes}</div></div>
    <div class="pf" style="margin-bottom:0.5rem"><div class="pf-label">Candidates</div><div class="pf-value">${DB.candidates.length}</div></div>
    <div class="pf" style="margin-bottom:0.5rem"><div class="pf-label">Registered Voters</div><div class="pf-value">${DB.voters.length}</div></div>
    <div class="pf" style="margin-bottom:0.5rem"><div class="pf-label">Turnout</div><div class="pf-value">${DB.voters.length>0?Math.round(totalVotes/DB.voters.length*100):0}%</div></div>
    <div class="pf"><div class="pf-label">Blocks Mined</div><div class="pf-value">${DB.blockchain.length}</div></div>`;
}

function renderResults(){
  const waiting=document.getElementById('results-waiting');
  const content=document.getElementById('results-content');
  if(!DB.electionEnded){waiting.style.display='block';content.style.display='none';return;}
  waiting.style.display='none';content.style.display='block';
  const sorted=[...DB.candidates].sort((a,b)=>{
    const av=DB.votes.filter(v=>v.candidateId===a.id).length;
    const bv=DB.votes.filter(v=>v.candidateId===b.id).length;
    return bv-av;
  });
  const maxV=sorted.length>0?DB.votes.filter(v=>v.candidateId===sorted[0].id).length:0;
  if(sorted.length>0){
    document.getElementById('winner-name').textContent=sorted[0].name;
    document.getElementById('winner-party').textContent=sorted[0].party;
    document.getElementById('winner-votes').textContent=maxV+' votes';
  }
  const list=document.getElementById('full-results-list');
  list.innerHTML='';
  sorted.forEach((c,i)=>{
    const cv=DB.votes.filter(v=>v.candidateId===c.id).length;
    const pct=DB.votes.length>0?Math.round(cv/DB.votes.length*100):0;
    list.innerHTML+=`<div class="result-row"><div class="result-rank">#${i+1}</div><div class="result-cand"><div class="result-cand-name">${c.symbol||''} ${c.name}</div><div class="result-cand-party">${c.party}</div></div><div class="result-votes">${cv}</div><div class="result-bar-wrap"><div class="result-bar" style="width:${pct}%"></div></div></div>`;
  });
}

function renderChain(listId,countId){
  const list=document.getElementById(listId);
  const count=document.getElementById(countId);
  if(!list)return;
  count.textContent=DB.blockchain.length+' blocks';
  list.innerHTML='';
  [...DB.blockchain].reverse().forEach(b=>{
    const isGenesis=b.index===0;
    list.innerHTML+=`<div class="block-card ${isGenesis?'genesis-block':''}">
      <div class="block-num">Block #${b.index} · ${b.type.toUpperCase()}</div>
      <div class="block-hash">${b.hash}</div>
      <div class="block-meta">
        <div class="block-meta-item"><strong>Prev:</strong>${b.previousHash.substring(0,16)}…</div>
        <div class="block-meta-item"><strong>Time:</strong>${new Date(b.timestamp).toLocaleTimeString()}</div>
        ${b.nonce!==undefined?`<div class="block-meta-item"><strong>Nonce:</strong>${b.nonce}</div>`:''}
        ${b.data&&b.data.candidateName?`<div class="block-meta-item"><strong>Vote:</strong>${b.data.candidateName}</div>`:''}
      </div>
    </div>`;
  });
}

// ===== EC =====
function refreshEC(){
  document.getElementById('ec-reg-voters').textContent=DB.voters.length;
  document.getElementById('ec-votes-cast').textContent=DB.votes.length;
  document.getElementById('ec-candidates').textContent=DB.candidates.length;
  document.getElementById('ec-blocks').textContent=DB.blockchain.length;
  const pill=document.getElementById('ec-status-pill');
  const btn=document.getElementById('ec-toggle-btn');
  if(DB.electionOpen&&!DB.electionEnded){
    pill.className='ec-status-pill open';pill.textContent='● OPEN';
    btn.className='ec-btn-stop';btn.textContent='⏹ End Election';
  } else {
    pill.className='ec-status-pill closed';pill.textContent='● CLOSED';
    btn.className='ec-btn-start';btn.textContent='▶ Start Election';
  }
  renderECCandList();renderECVotersTable();renderChain('ec-chain-list','ec-chain-count');
  renderLiveResults();
}

function toggleElection(){
  if(DB.electionEnded){showModal('⚠️','Election Ended','This election has already ended. Results have been declared.');return;}
  if(DB.electionOpen){
    DB.electionOpen=false;DB.electionEnded=true;save();
    showModal('🏆','Election Ended!','Voting has been closed. Results are now declared automatically.',()=>refreshEC());
  } else {
    if(DB.candidates.length===0){showModal('⚠️','No Candidates','Please add at least one candidate before starting the election.');return;}
    DB.electionOpen=true;save();
    toast('Election started successfully!');
    refreshEC();
  }
}

function addCandidate(){
  if(DB.electionOpen){showAlert('cand-alert','Cannot add candidates after election starts');return;}
  const name=document.getElementById('cand-name').value.trim();
  const party=document.getElementById('cand-party').value.trim();
  const symbol=document.getElementById('cand-symbol').value.trim()||'🧑';
  const cons=document.getElementById('cand-const').value.trim();
  if(!name||!party){showAlert('cand-alert','Name and Party are required');return;}
  DB.candidates.push({id:'c'+Date.now(),name,party,symbol,constituency:cons});
  save();
  document.getElementById('cand-name').value='';
  document.getElementById('cand-party').value='';
  document.getElementById('cand-symbol').value='';
  document.getElementById('cand-const').value='';
  toast('Candidate added: '+name);
  renderECCandList();
  document.getElementById('ec-candidates').textContent=DB.candidates.length;
}

function deleteCandidate(id){
  if(DB.electionOpen){toast('Cannot remove candidates during election','error');return;}
  DB.candidates=DB.candidates.filter(c=>c.id!==id);save();
  toast('Candidate removed');renderECCandList();
  document.getElementById('ec-candidates').textContent=DB.candidates.length;
}

function renderECCandList(){
  const list=document.getElementById('ec-cand-list');
  if(DB.candidates.length===0){list.innerHTML='<div style="color:var(--text3);font-size:0.85rem;padding:0.5rem 0">No candidates added yet</div>';return;}
  list.innerHTML=DB.candidates.map(c=>`
    <div class="cand-list-item">
      <div class="cand-symbol-sm">${c.symbol||'🧑'}</div>
      <div class="cand-list-info">
        <div class="cand-list-name">${c.name}</div>
        <div class="cand-list-party">${c.party}${c.constituency?' · '+c.constituency:''}</div>
      </div>
      <div style="color:var(--green);font-size:0.8rem;font-weight:600">${DB.votes.filter(v=>v.candidateId===c.id).length} votes</div>
      <button class="cand-delete" onclick="deleteCandidate('${c.id}')">✕ Remove</button>
    </div>`).join('');
}

function renderECVotersTable(){
  const tbody=document.getElementById('ec-voters-table');
  if(DB.voters.length===0){tbody.innerHTML='<tr><td colspan="5" style="color:var(--text3);text-align:center;padding:1.5rem">No voters registered</td></tr>';return;}
  tbody.innerHTML=DB.voters.map(v=>{
    const voted=DB.votes.find(vt=>vt.voterId===v.vid);
    return `<tr>
      <td>${v.name}</td>
      <td class="mono" style="font-size:0.78rem">${v.vid}</td>
      <td>${v.email}</td>
      <td class="mono" style="font-size:0.72rem;color:var(--blue)">${v.wallet.substring(0,18)}…</td>
      <td><span class="badge ${voted?'voted':'pending'}">${voted?'Voted':'Pending'}</span></td>
    </tr>`;
  }).join('');
}

function renderLiveResults(){
  const card=document.getElementById('ec-live-results-card');
  const list=document.getElementById('ec-live-results');
  if(DB.votes.length===0){card.style.display='none';return;}
  card.style.display='block';
  const sorted=[...DB.candidates].sort((a,b)=>DB.votes.filter(v=>v.candidateId===b.id).length-DB.votes.filter(v=>v.candidateId===a.id).length);
  const maxV=sorted.length>0?DB.votes.filter(v=>v.candidateId===sorted[0].id).length:1;
  list.innerHTML=sorted.map((c,i)=>{
    const cv=DB.votes.filter(v=>v.candidateId===c.id).length;
    const pct=DB.votes.length>0?Math.round(cv/DB.votes.length*100):0;
    return `<div class="result-row"><div class="result-rank">#${i+1}</div><div class="result-cand"><div class="result-cand-name">${c.symbol||''} ${c.name}</div><div class="result-cand-party">${c.party}</div></div><div class="result-votes">${cv} (${pct}%)</div><div class="result-bar-wrap" style="width:150px"><div class="result-bar" style="width:${maxV>0?Math.round(cv/maxV*100):0}%"></div></div></div>`;
  }).join('');
}

function vTab(name,el){
  document.querySelectorAll('#voter-dash .nav-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#voter-dash .tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('vp-'+name).classList.add('active');
  refreshVoterDash();
}

function ecTab(name,el){
  document.querySelectorAll('#ec-dash .nav-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#ec-dash .tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('ep-'+name).classList.add('active');
  refreshEC();
}

function voterLogout(){currentVoter=null;selectedCandidate=null;goto('landing');}

// Auto-refresh every 3s when dashboards are open
setInterval(()=>{
  if(document.getElementById('voter-dash').classList.contains('active')&&currentVoter)refreshVoterDash();
  if(document.getElementById('ec-dash').classList.contains('active'))refreshEC();
},3000);
