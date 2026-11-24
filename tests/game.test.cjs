const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
function harness(fetchImpl=async()=>({ok:true,status:200,json:async()=>[]})){
 const elements=new Map(),storage=new Map();
 class Element{
  constructor(){this.value='';this.textContent='';this.innerText='';this.style={};this.dataset={};this.children=[];this.disabled=false;this.isConnected=true;this.listeners={};this.hidden=false;this._html=''}
  set innerHTML(html){this._html=html;if(this.id==='market')for(const m of html.matchAll(/<input id="([^"]+)"[^>]*value="([^"]*)"/g))get(m[1]).value=m[2]}
  get innerHTML(){return this._html}
  append(child){this.children.push(child)}
  replaceChildren(){this.children=[]}
  addEventListener(type,fn){this.listeners[type]=fn}
  scrollIntoView(){}
 }
 const get=id=>{if(!elements.has(id)){const element=new Element();element.id=id;elements.set(id,element)}return elements.get(id)};
 const document={getElementById:get,createElement:()=>new Element(),querySelectorAll:()=>{
  const buttons=[];
  for(const match of get('market').innerHTML.matchAll(/<button\b([^>]*data-trade[^>]*)>/g)){
   const button=new Element();for(const attr of match[1].matchAll(/data-(trade|side|all)="([^"]*)"/g))button.dataset[attr[1]]=attr[2];buttons.push(button)
  }
  return buttons;
 }};
 const context=vm.createContext({document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},window:{location:{protocol:'https:'}},navigator:{},crypto:require('node:crypto').webcrypto,console,setTimeout:()=>1,clearTimeout:()=>{},confirm:()=>true,fetch:fetchImpl,AbortSignal});
 vm.runInContext(fs.readFileSync(path.join(root,'leaderboard.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context);
 return {get,context,run:code=>vm.runInContext(code,context)};
}
test('startup renders all products and travel destinations',()=>{
 const h=harness();assert.equal((h.get('market').innerHTML.match(/<tr>/g)||[]).length,10);assert.equal((h.get('destination').innerHTML.match(/<option/g)||[]).length,6);assert.equal((h.get('chartGood').innerHTML.match(/<option/g)||[]).length,10)
});
test('bulk buy and partial/all sales update cash, cargo and cost basis exactly',()=>{
 const h=harness(),p=h.run('price(GOODS[0])');h.run("trade('chips','buy','5')");assert.equal(h.run("owned('chips')"),5);assert.equal(h.run('S.cash'),10000-5*p);assert.equal(h.run('S.basis.chips'),5*p);
 h.run("trade('chips','sell',2)");assert.equal(h.run('S.basis.chips'),3*p);h.run("trade('chips','sell',3)");assert.equal(h.run('S.cash'),10000);assert.equal(h.run('cargo()'),0);assert.equal(h.run('S.basis.chips'),0);assert.equal(h.run('S.trades'),3)
});
test('invalid quantities and quantities over cash/cargo/holdings never mutate state',()=>{
 const h=harness();for(const q of ['',0,-1,1.5,'abc',1e20]){const before=h.run('JSON.stringify(S)');h.run(`trade('chips','buy',${JSON.stringify(q)})`);assert.equal(h.run('JSON.stringify(S)'),before)}
 for(const expression of ["S.cash=1;trade('chips','buy',1)","S.cash=100000;S.capacity=2;trade('chips','buy',3)","trade('chips','sell',1)"]){h.run(expression);assert.equal(h.run('cargo()'),0)}
});
test('Buy Max respects cash and cargo; Sell All clears holdings',()=>{
 const h=harness(),p=h.run('price(GOODS[0])');assert.equal(h.run('maxBuy(GOODS[0])'),Math.floor(10000/p));h.run('S.cash=100000');assert.equal(h.run('maxBuy(GOODS[0])'),24);h.run("trade('chips','buy',maxBuy(GOODS[0]))");assert.equal(h.run('cargo()'),24);assert.equal(h.run('maxBuy(GOODS[1])'),0);h.run("trade('chips','sell',owned('chips'))");assert.equal(h.run('cargo()'),0)
});
test('quantity fields survive rendering and finished campaigns block trades',()=>{
 const h=harness();h.run("quantities.chips='5';render()");assert.equal(h.get('qty-chips').value,'5');h.run('S.finished=true');const before=h.run('JSON.stringify(S)');h.run("trade('chips','buy',1)");assert.equal(h.run('JSON.stringify(S)'),before)
});
test('campaign completion fixes the score and offers public name registration',()=>{
 const h=harness();h.run('S.day=29;newDay()');assert.equal(h.run('S.finished'),true);assert.equal(h.run('S.finalWorth'),h.run('worth()'));assert.match(h.get('modal').innerHTML,/Register your player name/);assert.match(h.get('modal').innerHTML,/public on the global leaderboard/)
});
test('global rankings are capped at 25 and names render as text',async()=>{
 const rows=Array.from({length:30},(_,i)=>({player_name:i===0?'<img src=x onerror=alert(1)>':'Player '+i,score:10000-i}));let options;
 const h=harness(async(url,opts)=>{options=opts;return {ok:true,status:200,json:async()=>rows}});h.run("window.ASEAN_EMPIRE_CONFIG={supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_test'}");await h.run('refreshLeaderboard()');assert.equal(h.get('leaderboardRows').children.length,25);assert.equal(h.get('leaderboardRows').children[0].children[1].textContent,rows[0].player_name);assert.equal(options.headers.apikey,'sb_publishable_test');assert.equal(options.headers.Authorization,undefined)
});
test('score submission is confirmed once, saves the name and prevents repeats',async()=>{
 let requests=0;const h=harness(async(url,opts)=>{if(url.endsWith('submit_score')){requests++;const body=JSON.parse(opts.body);return {ok:true,status:200,json:async()=>({campaign_id:body.p_campaign_id,player_name:body.p_player_name})}}return {ok:true,status:200,json:async()=>[]}});
 h.run("window.ASEAN_EMPIRE_CONFIG={supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_test'};S.finished=true;S.finalWorth=12345;showEnd()");h.get('playerName').value='  IBJ   Trader  ';await h.run('submitScore({preventDefault(){}})');assert.equal(h.run('S.submitted'),true);assert.equal(h.run('S.playerName'),'IBJ Trader');await h.run('submitScore({preventDefault(){}})');assert.equal(requests,1)
});
test('network errors keep completed scores retryable and show no fabricated rankings',async()=>{
 const h=harness(async()=>{throw new Error('Offline')});h.run("window.ASEAN_EMPIRE_CONFIG={supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_test'};S.finished=true;S.finalWorth=10000;showEnd()");h.get('playerName').value='IBJ';await h.run('submitScore({preventDefault(){}})');assert.equal(h.run('S.submitted'),false);assert.equal(h.get('submitScore').disabled,false);assert.match(h.get('scoreStatus').textContent,/retry/);await h.run('refreshLeaderboard()');assert.equal(h.get('leaderboardRows').children.length,0);assert.match(h.get('leaderboardStatus').textContent,/Offline/)
});

