'use strict';
function leaderboardConfigured(){
 const c=window.ASEAN_EMPIRE_CONFIG;
 return !!(c && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(c.supabaseUrl) && /^sb_publishable_/.test(c.supabasePublishableKey));
}
function readPlayerName(){try{return localStorage.getItem('asean-empire-player-name')||''}catch{return ''}}
function normalizePlayerName(name){return name.normalize('NFKC').replace(/\s+/gu,' ').trim()}
async function leaderboardRpc(method,payload={}){
 if(!leaderboardConfigured())throw new Error('Global leaderboard setup is pending.');
 const config=window.ASEAN_EMPIRE_CONFIG;
 const response=await fetch(config.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/'+method,{
  method:'POST',headers:{apikey:config.supabasePublishableKey,'Content-Type':'application/json'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)
 });
 if(!response.ok){
  if(response.status===404)throw new Error('Leaderboard database setup is pending.');
  throw new Error('The leaderboard is unavailable. Please try again later.');
 }
 return response.status===204?null:response.json();
}
let leaderboardRequest=0;
async function refreshLeaderboard(){
 const request=++leaderboardRequest,rows=document.getElementById('leaderboardRows'),status=document.getElementById('leaderboardStatus');
 document.getElementById('refreshLeaderboard').disabled=true;
 rows.replaceChildren();status.textContent='Loading global rankings…';
 try{
  const data=await leaderboardRpc('get_top25');
  if(request!==leaderboardRequest)return;
  if(!Array.isArray(data))throw new Error('Could not read the leaderboard.');
  data.slice(0,25).forEach((entry,index)=>{
   const tr=document.createElement('tr');
   for(const value of [String(index+1),String(entry.player_name),fmt(Number(entry.score))]){
    const td=document.createElement('td');td.textContent=value;tr.append(td);
   }
   rows.append(tr);
  });
  status.textContent=data.length?'Global rankings · '+new Date().toLocaleTimeString():'No scores yet. Finish a campaign and be the first!';
 }catch(error){
  if(request!==leaderboardRequest)return;
  status.textContent=error.name==='TimeoutError'?'The leaderboard timed out. Please refresh to retry.':error.message;
 }finally{if(request===leaderboardRequest)document.getElementById('refreshLeaderboard').disabled=false}
}
async function submitScore(event){
 event.preventDefault();
 const campaign=S,nameInput=document.getElementById('playerName'),button=document.getElementById('submitScore'),status=document.getElementById('scoreStatus');
 if(!campaign.finished||campaign.submitted)return;
 const name=normalizePlayerName(nameInput.value);
 if(name.length<2||name.length>24||/[\u0000-\u001f\u007f]/u.test(name)){status.textContent='Use a player name with 2–24 characters.';return}
 campaign.playerName=name;save();
 try{localStorage.setItem('asean-empire-player-name',name)}catch{}
 button.disabled=true;nameInput.disabled=true;status.textContent='Submitting your score…';
 try{
  const receipt=await leaderboardRpc('submit_score',{p_campaign_id:campaign.campaignId,p_player_name:name,p_score:campaign.finalWorth,p_trades:campaign.trades,p_debt:campaign.debt});
  if(receipt?.campaign_id!==campaign.campaignId)throw new Error('Could not confirm your score. Please retry.');
  if(S.campaignId===campaign.campaignId){S.submitted=true;S.playerName=receipt.player_name;save()}
  if(status.isConnected){status.textContent='Your score is registered in the global rankings.';nameInput.value=receipt.player_name}
  refreshLeaderboard();
 }catch(error){
  if(status.isConnected){status.textContent=(error.name==='TimeoutError'?'Submission timed out.':error.message)+' Your completed campaign is saved; you can retry.';button.disabled=false;nameInput.disabled=false}
 }
}
function updateTradeButtons(){
 document.querySelectorAll('[data-trade]').forEach(button=>{
  const g=GOODS.find(x=>x.id===button.dataset.trade),side=button.dataset.side;
  const input=document.getElementById('qty-'+g.id),raw=input.value,q=raw.trim()===''?NaN:Number(raw);
  const limit=side==='buy'?maxBuy(g):owned(g.id);
  button.disabled=S.finished || (button.dataset.all?limit<1:!Number.isSafeInteger(q)||q<1||q>limit);
  if(button.dataset.all)button.title=(side==='buy'?'Buy up to ':'Sell all ')+limit+' lots';
 });
}
