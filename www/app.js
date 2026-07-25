/* Cashbook — entire application. Single IIFE; APP_VERSION lives here.
   Version rule: bump APP_VERSION here + V in sw.js + both ?v= query strings in index.html. */
(function(){
'use strict';

/* ============ storage ============ */
var KEY='cashbook.app.v2', OLDKEY='cashbook.app.v1';
var store=(function(){
  var mem=null,ok=false;
  try{localStorage.setItem('__cb_probe','1');localStorage.removeItem('__cb_probe');ok=true;}catch(e){ok=false;}
  return{
    load:function(){ if(ok){try{var r=localStorage.getItem(KEY);if(r)return JSON.parse(r);var o=localStorage.getItem(OLDKEY);if(o)return JSON.parse(o);}catch(e){}} return mem;},
    save:function(d){ mem=d; if(ok){try{localStorage.setItem(KEY,JSON.stringify(d));return true;}catch(e){return false;}} return true;},
    persistent:ok
  };
})();

/* ============ defaults & schema 3 ============ */
var MODES=['Cash','Online'];
var CAT_COLORS=['#188A50','#2F6DB5','#7A5AF8','#D97E2B','#E4572E','#0E8A8A','#C9A227','#C7414F','#6B7A8C','#B04FB0'];
function hashColor(id){var n=0;id=String(id||'');for(var i=0;i<id.length;i++)n=(n*31+id.charCodeAt(i))>>>0;return CAT_COLORS[n%CAT_COLORS.length];}
/* v6: gradient avatar tones (books & parties) — 6 tones from the Paper Ledger design */
var AV_TONES=['indigo','teal','gold','rose','purple','green'];
function avTone(id){var n=0;id=String(id||'');for(var i=0;i<id.length;i++)n=(n*31+id.charCodeAt(i))>>>0;return AV_TONES[n%AV_TONES.length];}
function initialsOf(name){
  var w=String(name||'').split(/\s+/).filter(Boolean);
  if(!w.length)return '?';
  return (w[0][0]+(w.length>1?w[1][0]:'')).toUpperCase();
}
function defaultCats(){return[
  {id:'sales',name:'Sales',emoji:'💵',color:'#188A50',builtin:true},
  {id:'purchase',name:'Purchase',emoji:'🛒',color:'#2F6DB5',builtin:true},
  {id:'salary',name:'Salary',emoji:'💼',color:'#7A5AF8',builtin:true},
  {id:'rent',name:'Rent',emoji:'🏠',color:'#D97E2B',builtin:true},
  {id:'food',name:'Food',emoji:'🍲',color:'#E4572E',builtin:true},
  {id:'transport',name:'Transport',emoji:'🚚',color:'#0E8A8A',builtin:true},
  {id:'utilities',name:'Utilities',emoji:'💡',color:'#C9A227',builtin:true},
  {id:'other',name:'Other',emoji:'🏷️',color:'#6B7A8C',builtin:true}
];}
function defaultState(){return{
  schema:3, seq:1,
  settings:{currency:'₨',customCur:'',dateFormat:'dd/mm/yyyy',firstDay:1,theme:'system',grouping:'lakh',
    pinHash:'',pinSalt:'',bioCred:'',lastBackupAt:0,backupSnooze:0,lastBook:'',cashBookId:'',accOpening:{cash:0,bank:0},pdf:{}},
  books:[],entries:[],categories:defaultCats(),parties:[],recurring:[],budgets:[],templates:[],trash:[],transfers:[]
};}
function fixMode(m){
  if(m==='Cash'||m==='Online')return m;
  if(m==='Cheque')return 'Online';
  return 'Cash';
}
function normalize(d){
  if(!d||typeof d!=='object')return null;
  if(d.schema===1||d.schema===2)d.schema=3;
  if(d.schema!==3)return null;
  ['books','entries','categories','parties','recurring','budgets','templates','trash','transfers'].forEach(function(k){if(!Array.isArray(d[k]))d[k]=[];});
  if(!d.settings||typeof d.settings!=='object')d.settings={};
  var ds=defaultState().settings;
  for(var k in ds)if(!(k in d.settings))d.settings[k]=JSON.parse(JSON.stringify(ds[k]));
  var st=d.settings;
  if(['dd/mm/yyyy','dd/mm/yy','mm/dd/yyyy','mm/dd/yy','yyyy-mm-dd','dd-mmm-yyyy'].indexOf(st.dateFormat)<0)st.dateFormat='dd/mm/yyyy';
  if([0,1,6].indexOf(st.firstDay)<0)st.firstDay=1;
  if(['light','dark','system'].indexOf(st.theme)<0)st.theme='system';
  if(['lakh','intl'].indexOf(st.grouping)<0)st.grouping=(st.currency==='₨'||st.currency==='₹')?'lakh':'intl';
  ['pinHash','pinSalt','bioCred','lastBook','customCur','cashBookId'].forEach(function(k){if(typeof st[k]!=='string')st[k]='';});
  ['lastBackupAt','backupSnooze'].forEach(function(k){if(typeof st[k]!=='number')st[k]=0;});
  if(!st.accOpening||typeof st.accOpening!=='object')st.accOpening={cash:0,bank:0};
  st.accOpening.cash=(typeof st.accOpening.cash==='number'&&isFinite(st.accOpening.cash))?Math.round(st.accOpening.cash):0;
  st.accOpening.bank=(typeof st.accOpening.bank==='number'&&isFinite(st.accOpening.bank))?Math.round(st.accOpening.bank):0;
  if(typeof d.seq!=='number'||!isFinite(d.seq))d.seq=1;

  d.books=d.books.filter(function(b){return b&&typeof b.id==='string'&&typeof b.name==='string'&&b.name;});
  var bookIds={}; d.books.forEach(function(b){bookIds[b.id]=true;
    if(typeof b.created!=='number')b.created=0;
    b.opening=(typeof b.opening==='number'&&isFinite(b.opening))?Math.round(b.opening):0;
  });

  d.categories=d.categories.filter(function(c){return c&&typeof c.id==='string'&&typeof c.name==='string'&&c.name;})
    .map(function(c){ if(typeof c.emoji!=='string'||!c.emoji)c.emoji='🏷️'; if(typeof c.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(c.color))c.color='#6B7A8C'; c.builtin=!!c.builtin; return c;});
  if(!d.categories.length)d.categories=defaultCats();
  if(!d.categories.some(function(c){return c.id==='other';}))d.categories.push(defaultCats()[7]);
  var catIds={}; d.categories.forEach(function(c){catIds[c.id]=true;});

  d.parties=d.parties.filter(function(p){return p&&typeof p.id==='string'&&typeof p.name==='string'&&p.name;})
    .map(function(p){ if(typeof p.phone!=='string')p.phone=''; if(typeof p.created!=='number')p.created=0;
      if(['customer','supplier','staff'].indexOf(p.role)<0)p.role='customer'; return p;});
  var partyIds={}; d.parties.forEach(function(p){partyIds[p.id]=true;});

  function cleanEntry(e){
    if(!(e&&typeof e.id==='string'&&typeof e.bookId==='string'&&(e.type==='in'||e.type==='out')&&
      typeof e.amount==='number'&&isFinite(e.amount)&&e.amount>0&&typeof e.ts==='number'&&isFinite(e.ts)))return null;
    e.amount=Math.round(e.amount);
    if(typeof e.created!=='number')e.created=e.ts;
    if(typeof e.note!=='string')e.note='';
    e.mode=fixMode(e.mode);
    if(typeof e.categoryId!=='string'||!catIds[e.categoryId])e.categoryId='other';
    if(e.partyId!==undefined&&(typeof e.partyId!=='string'||!partyIds[e.partyId]))delete e.partyId;
    if(e.attach!==undefined&&(typeof e.attach!=='string'||e.attach.slice(0,10)!=='data:image'))delete e.attach;
    e.auto=!!e.auto;
    return e;
  }
  d.entries=d.entries.map(cleanEntry).filter(function(e){return e&&bookIds[e.bookId];});
  d.trash=d.trash.filter(function(t){return t&&typeof t.at==='number'&&t.e;}).map(function(t){t.e=cleanEntry(t.e);return t;}).filter(function(t){return t.e&&bookIds[t.e.bookId];});

  d.transfers=d.transfers.filter(function(x){return x&&typeof x.id==='string'&&(x.dir==='c2b'||x.dir==='b2c')&&
    typeof x.amount==='number'&&isFinite(x.amount)&&x.amount>0&&typeof x.ts==='number'&&isFinite(x.ts);})
    .map(function(x){ x.amount=Math.round(x.amount); if(typeof x.note!=='string')x.note=''; if(typeof x.created!=='number')x.created=x.ts; return x;});

  d.recurring=d.recurring.filter(function(r){return r&&typeof r.id==='string'&&bookIds[r.bookId]&&(r.type==='in'||r.type==='out')&&
    typeof r.amount==='number'&&r.amount>0&&['daily','weekly','monthly'].indexOf(r.freq)>-1&&typeof r.nextTs==='number';})
    .map(function(r){ r.amount=Math.round(r.amount); if(!catIds[r.categoryId])r.categoryId='other'; r.mode=fixMode(r.mode);
      if(typeof r.note!=='string')r.note=''; if(r.partyId&&!partyIds[r.partyId])delete r.partyId;
      if(r.endTs!==undefined&&typeof r.endTs!=='number')delete r.endTs;
      if(typeof r.day!=='number')r.day=new Date(r.nextTs).getDate();
      r.paused=!!r.paused; return r;});

  d.budgets=d.budgets.filter(function(b){return b&&bookIds[b.bookId]&&catIds[b.categoryId]&&typeof b.amount==='number'&&b.amount>0;})
    .map(function(b){b.amount=Math.round(b.amount);return b;});
  var seenB={}; d.budgets=d.budgets.filter(function(b){var k=b.bookId+'|'+b.categoryId; if(seenB[k])return false; seenB[k]=true; return true;});

  d.templates=d.templates.filter(function(t){return t&&typeof t.id==='string'&&bookIds[t.bookId]&&(t.type==='in'||t.type==='out');})
    .map(function(t){ if(t.amount!==undefined){t.amount=Math.round(t.amount); if(!(t.amount>0))delete t.amount;}
      if(!catIds[t.categoryId])t.categoryId='other'; t.mode=fixMode(t.mode);
      if(typeof t.note!=='string')t.note=''; if(t.partyId&&!partyIds[t.partyId])delete t.partyId; return t;});
  if(st.lastBook&&!bookIds[st.lastBook])st.lastBook='';
  // primary cash book: the single book whose entries drive Cash-in-hand & Bank
  if(!st.cashBookId||!bookIds[st.cashBookId]){
    var pick='';
    for(var bi=0;bi<d.books.length;bi++){if((d.books[bi].name||'').toLowerCase()==='money in hand'){pick=d.books[bi].id;break;}}
    if(!pick){var best=null;d.books.forEach(function(b){if(!best||b.created<best.created)best=b;});pick=best?best.id:'';}
    st.cashBookId=pick;
  }
  // PDF export field preferences (per report type, all default on)
  var pdfDef={ledger:['date','note','category','party','mode','amount','balance'],account:['date','note','book','amount','balance'],party:['date','note','book','amount','balance'],analytics:['summary','categories','accounts','time','insights','budgets']};
  if(!st.pdf||typeof st.pdf!=='object')st.pdf={};
  Object.keys(pdfDef).forEach(function(sc){
    if(!st.pdf[sc]||typeof st.pdf[sc]!=='object')st.pdf[sc]={};
    pdfDef[sc].forEach(function(k2){st.pdf[sc][k2]=(k2 in st.pdf[sc])?!!st.pdf[sc][k2]:true;});
  });
  // whole-rupee mode: round every stored amount to an exact multiple of 100
  var r100=function(n){return Math.round(n/100)*100;};
  d.entries.forEach(function(e){e.amount=r100(e.amount);});
  d.trash.forEach(function(t){t.e.amount=r100(t.e.amount);});
  d.transfers.forEach(function(x){x.amount=r100(x.amount);});
  d.recurring.forEach(function(rc){rc.amount=r100(rc.amount);});
  d.templates.forEach(function(t){if(typeof t.amount==='number')t.amount=r100(t.amount);});
  d.budgets.forEach(function(b){b.amount=r100(b.amount);});
  d.books.forEach(function(b){b.opening=r100(b.opening);});
  st.accOpening.cash=r100(st.accOpening.cash);st.accOpening.bank=r100(st.accOpening.bank);
  return d;
}
var S=normalize(store.load())||defaultState();
function save(){return store.save(S);}
function uid(p){var id=p+Date.now().toString(36)+'-'+S.seq.toString(36);S.seq++;return id;}

/* ============ utils ============ */
function $(s,r){return (r||document).querySelector(s);}
function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function clamp(n,a,b){return Math.min(b,Math.max(a,n));}
function buzz(ms){if(navigator.vibrate)try{navigator.vibrate(ms||12);}catch(e){}}

/* ============ money ============ */
function curSym(){var c=S.settings.currency;return c==='custom'?(S.settings.customCur||'¤'):c;}
function groupInt(str){
  if(S.settings.grouping==='lakh'){
    var s=str,out=s.slice(-3);s=s.slice(0,-3);
    while(s.length>2){out=s.slice(-2)+','+out;s=s.slice(0,-2);}
    if(s)out=s+','+out;return out;
  }
  return str.replace(/\B(?=(\d{3})+(?!\d))/g,',');
}
function nfmt(cents){
  var neg=cents<0,r=Math.round(Math.abs(cents)/100);
  return (neg?'\u2212':'')+groupInt(String(r));
}
function money(cents){var neg=cents<0;return (neg?'\u2212':'')+curSym()+' '+nfmt(Math.abs(cents));}
function moneySigned(cents,type){return (type==='in'?'+':'\u2212')+' '+curSym()+' '+nfmt(cents);}
function compact(cents){
  var v=Math.abs(cents)/100,s=cents<0?'\u2212':'';
  if(S.settings.grouping==='lakh'){
    if(v>=1e7)return s+(v/1e7).toFixed(v>=1e8?0:1).replace(/\.0$/,'')+'Cr';
    if(v>=1e5)return s+(v/1e5).toFixed(v>=1e6?0:1).replace(/\.0$/,'')+'L';
  }else if(v>=1e6)return s+(v/1e6).toFixed(v>=1e7?0:1).replace(/\.0$/,'')+'M';
  if(v>=1e3)return s+(v/1e3).toFixed(v>=1e4?0:1).replace(/\.0$/,'')+'k';
  return s+String(Math.round(v));
}
function calcEval(str){
  str=String(str).replace(/,/g,'').replace(/\s+/g,'');
  if(!/^[\d+\-*/().]+$/.test(str)||!/\d/.test(str))return null;
  var pos=0;
  function num(){var m=/^\d+(\.\d+)?/.exec(str.slice(pos));if(!m)return null;pos+=m[0].length;return parseFloat(m[0]);}
  function factor(){
    if(str[pos]==='('){pos++;var v=expr();if(v===null||str[pos]!==')')return null;pos++;return v;}
    if(str[pos]==='-'){pos++;var f=factor();return f===null?null:-f;}
    return num();
  }
  function term(){var v=factor();if(v===null)return null;
    while(str[pos]==='*'||str[pos]==='/'){var op=str[pos++],r=factor();if(r===null)return null;v=op==='*'?v*r:v/r;}
    return v;}
  function expr(){var v=term();if(v===null)return null;
    while(str[pos]==='+'||str[pos]==='-'){var op=str[pos++],r=term();if(r===null)return null;v=op==='+'?v+r:v-r;}
    return v;}
  var v=expr();
  if(v===null||pos!==str.length||!isFinite(v))return null;
  return v;
}
function parseAmt(s){
  s=String(s||'').trim().replace(/,/g,'');
  if(!s)return null;
  var v;
  if(/^\d+(\.\d+)?$/.test(s))v=parseFloat(s);
  else{v=calcEval(s);if(v===null)return null;}
  if(!isFinite(v)||v<=0)return null;
  var cents=Math.round(v)*100;
  return (cents>0&&cents<=999999999999)?cents:null;
}
function entryValid(amountStr,noteStr){
  return{cents:parseAmt(amountStr),noteOk:!!String(noteStr||'').trim()};
}
var W1=['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
var W10=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function w2(n){return n<20?W1[n]:W10[Math.floor(n/10)]+(n%10?'-'+W1[n%10]:'');}
function w3(n){var h=Math.floor(n/100),r=n%100;return (h?W1[h]+' hundred'+(r?' ':''):'')+(r?w2(r):'');}
function intWords(n){
  if(n===0)return 'zero';
  if(S.settings.grouping==='lakh'){
    var parts=[],cr=Math.floor(n/1e7);n%=1e7;
    var lk=Math.floor(n/1e5);n%=1e5;
    var th=Math.floor(n/1e3);n%=1e3;
    if(cr)parts.push(intWords(cr)+' crore');
    if(lk)parts.push(w2(lk)+' lakh');
    if(th)parts.push(w2(th)+' thousand');
    if(n)parts.push(w3(n));
    return parts.join(' ');
  }
  var sc=['','thousand','million','billion'],out=[],i=0;
  while(n>0){var g=n%1000;if(g)out.unshift(w3(g)+(sc[i]?' '+sc[i]:''));n=Math.floor(n/1000);i++;}
  return out.join(' ');
}
function amtWords(cents){
  var w=intWords(Math.round(cents/100));
  return w.charAt(0).toUpperCase()+w.slice(1);
}

/* ============ dates ============ */
function pad(n){return n<10?'0'+n:''+n;}
function dayKeyOf(ts){var d=new Date(ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(ts){
  var d=new Date(ts),dd=pad(d.getDate()),mm=pad(d.getMonth()+1),yyyy=d.getFullYear(),yy=pad(yyyy%100);
  switch(S.settings.dateFormat){
    case 'mm/dd/yyyy':return mm+'/'+dd+'/'+yyyy;
    case 'mm/dd/yy':return mm+'/'+dd+'/'+yy;
    case 'dd/mm/yy':return dd+'/'+mm+'/'+yy;
    case 'yyyy-mm-dd':return yyyy+'-'+mm+'-'+dd;
    case 'dd-mmm-yyyy':return dd+' '+MONTHS[d.getMonth()]+' '+yyyy;
    default:return dd+'/'+mm+'/'+yyyy;
  }
}
function fmtTime(ts){return new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function sod(d){d=new Date(d);d.setHours(0,0,0,0);return d;}
function addDays(d,n){d=new Date(d);d.setDate(d.getDate()+n);return d;}
function startOfWeek(d){d=sod(d);var diff=(d.getDay()-S.settings.firstDay+7)%7;return addDays(d,-diff);}
function dayLabel(key){
  var tk=dayKeyOf(Date.now()),yk=dayKeyOf(addDays(new Date(),-1).getTime());
  if(key===tk)return 'Today';
  if(key===yk)return 'Yesterday';
  var p=key.split('-'),d=new Date(+p[0],+p[1]-1,+p[2]);
  return d.toLocaleDateString([],{weekday:'short'})+', '+fmtDate(d.getTime());
}
function dateInputVal(d){d=new Date(d);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function timeInputVal(d){d=new Date(d);return pad(d.getHours())+':'+pad(d.getMinutes());}
function parseRangeInput(fromStr,toStr){
  if(!fromStr||!toStr)return null;
  var f=new Date(fromStr+'T00:00:00'),t=new Date(toStr+'T00:00:00');
  if(isNaN(f.getTime())||isNaN(t.getTime()))return null;
  if(f>t){var x=f;f=t;t=x;}
  return [f.getTime(),addDays(t,1).getTime()];
}
function presetRange(p){
  var now=new Date();
  if(p==='today')return [sod(now).getTime(),addDays(sod(now),1).getTime()];
  if(p==='yesterday')return [addDays(sod(now),-1).getTime(),sod(now).getTime()];
  if(p==='week'){var w=startOfWeek(now);return [w.getTime(),addDays(w,7).getTime()];}
  if(p==='month')return [new Date(now.getFullYear(),now.getMonth(),1).getTime(),new Date(now.getFullYear(),now.getMonth()+1,1).getTime()];
  if(p==='year')return [new Date(now.getFullYear(),0,1).getTime(),new Date(now.getFullYear()+1,0,1).getTime()];
  return null;
}
function rangeLabel(r){if(!r)return 'All time';return fmtDate(r[0])+' \u2013 '+fmtDate(r[1]-1);}
function advanceTs(ts,freq,baseDay){
  var d=new Date(ts);
  if(freq==='daily')return addDays(d,1).getTime();
  if(freq==='weekly')return addDays(d,7).getTime();
  var nm=new Date(d.getFullYear(),d.getMonth()+1,1);
  var last=new Date(nm.getFullYear(),nm.getMonth()+1,0).getDate();
  nm.setDate(Math.min(baseDay||d.getDate(),last));
  nm.setHours(d.getHours(),d.getMinutes(),0,0);
  return nm.getTime();
}

/* ============ lookups & balances ============ */
function signed(e){return e.type==='in'?e.amount:-e.amount;}
function catById(id){var c=null,other=null,i;for(i=0;i<S.categories.length;i++){if(S.categories[i].id===id)c=S.categories[i];if(S.categories[i].id==='other')other=S.categories[i];}return c||other||S.categories[0];}
function catExact(id){for(var i=0;i<S.categories.length;i++)if(S.categories[i].id===id)return S.categories[i];return null;}
function bookById(id){for(var i=0;i<S.books.length;i++)if(S.books[i].id===id)return S.books[i];return null;}
function partyById(id){for(var i=0;i<S.parties.length;i++)if(S.parties[i].id===id)return S.parties[i];return null;}
function entryById(id){for(var i=0;i<S.entries.length;i++)if(S.entries[i].id===id)return S.entries[i];return null;}
function xferById(id){for(var i=0;i<S.transfers.length;i++)if(S.transfers[i].id===id)return S.transfers[i];return null;}
function bookEntries(id){return S.entries.filter(function(e){return e.bookId===id;});}
function partyEntries(id){return S.entries.filter(function(e){return e.partyId===id;});}
function entrySortAsc(a,b){return (a.ts-b.ts)||(a.created-b.created)||(a.id<b.id?-1:1);}
function bookTotals(id){
  var b=bookById(id),tin=0,tout=0;
  bookEntries(id).forEach(function(e){if(e.type==='in')tin+=e.amount;else tout+=e.amount;});
  var op=b?b.opening:0;
  return{tin:tin,tout:tout,opening:op,net:op+tin-tout};
}
function bookNet(id){return bookTotals(id).net;}
function runningMap(id){
  var b=bookById(id),m={},bal=b?b.opening:0;
  bookEntries(id).sort(entrySortAsc).forEach(function(e){bal+=signed(e);m[e.id]=bal;});
  return m;
}
function partyTotals(id){var gave=0,got=0;partyEntries(id).forEach(function(e){if(e.type==='out')gave+=e.amount;else got+=e.amount;});return{gave:gave,got:got,bal:gave-got};}
/* v6: TO COLLECT / TO PAY band totals — sum of positive vs negative party balances */
function partyAggregates(){
  var col=0,pay=0;
  S.parties.forEach(function(p){var b=partyTotals(p.id).bal;if(b>0)col+=b;else if(b<0)pay+=-b;});
  return{toCollect:col,toPay:pay};
}
function partyRunMap(id){var m={},b=0;partyEntries(id).sort(entrySortAsc).forEach(function(e){b+=(e.type==='out'?e.amount:-e.amount);m[e.id]=b;});return m;}
function budgetFor(bookId,catId){for(var i=0;i<S.budgets.length;i++)if(S.budgets[i].bookId===bookId&&S.budgets[i].categoryId===catId)return S.budgets[i];return null;}
function spentThisMonth(bookId,catId){
  var r=presetRange('month'),sum=0;
  bookEntries(bookId).forEach(function(e){if(e.type==='out'&&e.categoryId===catId&&e.ts>=r[0]&&e.ts<r[1])sum+=e.amount;});
  return sum;
}
function xferEffect(x,acc){
  if(acc==='cash')return x.dir==='b2c'?x.amount:-x.amount;
  return x.dir==='c2b'?x.amount:-x.amount;
}
function accModeOf(acc){return acc==='cash'?'Cash':'Online';}
function accName(acc){return acc==='cash'?'Cash in hand':'Bank account';}
function primaryCashBookId(){var id=S.settings.cashBookId;return (id&&bookById(id))?id:'';}
function isCashBook(bookId){return !!bookId&&bookId===primaryCashBookId();}
function accBal(acc){
  var mode=accModeOf(acc),bal=S.settings.accOpening[acc]||0,cb=primaryCashBookId();
  if(cb)S.entries.forEach(function(e){if(e.bookId===cb&&e.mode===mode)bal+=signed(e);});
  S.transfers.forEach(function(x){bal+=xferEffect(x,acc);});
  return bal;
}
function cashBal(){return accBal('cash');}
function bankBal(){return accBal('bank');}
function accMovements(acc){
  var mode=accModeOf(acc),items=[],cb=primaryCashBookId();
  if(cb)S.entries.forEach(function(e){if(e.bookId===cb&&e.mode===mode)items.push({ts:e.ts,created:e.created,id:e.id,kind:'e',ref:e,eff:signed(e)});});
  S.transfers.forEach(function(x){items.push({ts:x.ts,created:x.created,id:x.id,kind:'t',ref:x,eff:xferEffect(x,acc)});});
  items.sort(function(a,b){return (a.ts-b.ts)||(a.created-b.created)||(a.id<b.id?-1:1);});
  var run={},bal=S.settings.accOpening[acc]||0;
  items.forEach(function(it){bal+=it.eff;run[it.id]=bal;});
  return{items:items,run:run,opening:S.settings.accOpening[acc]||0,closing:bal};
}
function noteSuggestions(bookId,type){
  var m={};
  S.entries.forEach(function(e){
    if(e.bookId!==bookId||e.type!==type)return;
    var n=(e.note||'').trim();if(!n)return;
    var k=n.toLowerCase();
    if(!m[k])m[k]={t:n,c:0,last:0};
    m[k].c++; if(e.ts>m[k].last){m[k].last=e.ts;m[k].t=n;}
  });
  return Object.keys(m).map(function(k){return m[k];})
    .sort(function(a,b){return (b.c-a.c)||(b.last-a.last);}).slice(0,8).map(function(x){return x.t;});
}
function allTotals(r){
  var tin=0,tout=0,n=0;
  S.entries.forEach(function(e){if(e.ts>=r[0]&&e.ts<r[1]){n++;if(e.type==='in')tin+=e.amount;else tout+=e.amount;}});
  return{tin:tin,tout:tout,n:n};
}
function reportTotals(es){var tin=0,tout=0;es.forEach(function(e){if(e.type==='in')tin+=e.amount;else tout+=e.amount;});return{tin:tin,tout:tout};}

/* ============ theme ============ */
var mq=window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){
  var t=S.settings.theme,dark=t==='dark'||(t==='system'&&mq.matches);
  document.documentElement.setAttribute('data-theme',dark?'dark':'light');
  var m=$('#meta-theme');if(m)m.setAttribute('content',dark?'#191612':'#F6F2E8');
}
if(mq.addEventListener)mq.addEventListener('change',function(){if(S.settings.theme==='system')applyTheme();});
else if(mq.addListener)mq.addListener(function(){if(S.settings.theme==='system')applyTheme();});

/* ============ sheets, dialogs, feedback ============ */
var openStack=[],cfResolve=null;
function openSheet(id){var el=$('#'+id);if(!el||openStack.indexOf(id)>-1)return;el.classList.add('open');openStack.push(id);$('#scrim').classList.add('show');if(typeof syncControls==='function')syncControls(el);}
function closeSheet(id){
  var i=openStack.indexOf(id);if(i>-1)openStack.splice(i,1);
  var el=$('#'+id);if(el)el.classList.remove('open');
  if(!openStack.length)$('#scrim').classList.remove('show');
  if(id==='dlg-confirm'&&cfResolve){var r=cfResolve;cfResolve=null;r(false);}
}
function closeTop(){if(openStack.length)closeSheet(openStack[openStack.length-1]);}
/* Focus a field only AFTER its sheet has finished sliding in.
   Focusing mid-animation pops the Android soft keyboard while the sheet is still
   transforming; the keyboard physically resizes the WebView, so the app was relaying
   out underneath a running animation. That was the main cause of the entry-form
   flicker reported on the APK (browsers never showed it — no soft keyboard).
   transitionend is authoritative; the timer is a fallback for reduced-motion and for
   any browser that skips the transition entirely. */
function focusAfterOpen(sheetId,sel){
  var sheet=$('#'+sheetId),done=false;
  function go(){
    if(done)return;done=true;
    if(sheet)sheet.removeEventListener('transitionend',onEnd);
    var el=$(sel);if(el&&el.focus)try{el.focus();}catch(e){}
  }
  function onEnd(e){if(e.target===sheet&&e.propertyName==='transform')go();}
  if(sheet&&sheet.addEventListener)sheet.addEventListener('transitionend',onEnd);
  setTimeout(go,560);
}
$('#scrim').addEventListener('click',closeTop);
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  if($('#viewer').classList.contains('show')){$('#viewer').classList.remove('show');return;}
  if(openStack.length)closeTop();
});
$$('[data-close]').forEach(function(b){b.addEventListener('click',function(){var sh=b.closest('.sheet,.dialog');if(sh)closeSheet(sh.id);});});
var toastT=null;
function toast(msg){var t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show');},2200);}
var snackT=null,snackUndo=null;
function snack(msg,undoFn){
  $('#snack-msg').textContent=msg;snackUndo=undoFn||null;
  $('#snack-undo').classList.toggle('hidden',!undoFn);
  $('#snackbar').classList.add('show');
  clearTimeout(snackT);snackT=setTimeout(hideSnack,5000);
}
function hideSnack(){$('#snackbar').classList.remove('show');snackUndo=null;}
$('#snack-undo').addEventListener('click',function(){var f=snackUndo;hideSnack();if(f)f();});
function confirmDlg(o){
  $('#cf-title').textContent=o.title;$('#cf-msg').textContent=o.msg;
  var ww=$('#cf-word-wrap');
  if(o.word){ww.classList.remove('hidden');$('#cf-word-hint').textContent=o.word;$('#cf-input').value='';$('#cf-ok').disabled=true;}
  else{ww.classList.add('hidden');$('#cf-ok').disabled=false;}
  $('#cf-ok').textContent=o.okLabel||'Confirm';
  $('#cf-ok').className='btn '+(o.danger?'out':'primary');
  $('#cf-ok').setAttribute('data-word',o.word||'');
  openSheet('dlg-confirm');
  if(o.word)focusAfterOpen('dlg-confirm','#cf-input');
  return new Promise(function(res){cfResolve=res;});
}
$('#cf-input').addEventListener('input',function(){$('#cf-ok').disabled=$('#cf-input').value.trim()!==$('#cf-ok').getAttribute('data-word');});
$('#cf-input').addEventListener('keydown',function(e){if(e.key==='Enter'&&!$('#cf-ok').disabled)$('#cf-ok').click();});
$('#cf-ok').addEventListener('click',function(){var r=cfResolve;cfResolve=null;closeSheet('dlg-confirm');if(r)r(true);});
$('#cf-cancel').addEventListener('click',function(){closeSheet('dlg-confirm');});
function countUp(el,target,fmt){
  fmt=fmt||money;
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var from=(typeof el._cv==='number')?el._cv:target;
  el._cv=target;
  if(reduce||from===target){el.textContent=fmt(target);return;}
  var start=performance.now(),dur=450;
  if(el._raf)cancelAnimationFrame(el._raf);
  function step(now){
    var p=clamp((now-start)/dur,0,1),e2=1-Math.pow(1-p,3);
    el.textContent=fmt(Math.round(from+(target-from)*e2));
    if(p<1)el._raf=requestAnimationFrame(step);
  }
  el._raf=requestAnimationFrame(step);
}
/* ===== v5 motion: staggered list entrances ===== */
function stagger(el){
  if(!el||!el.children)return;
  for(var i=0;i<el.children.length;i++){var st=el.children[i].style;if(st&&st.setProperty)st.setProperty('--i',Math.min(i,10));}
  if(el.classList)el.classList.add('stag');
}
/* ===== v5 motion: save celebration (spring check + confetti) ===== */
function celebrate(type){
  try{
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    var old=document.querySelector('.celeb');if(old)old.parentNode.removeChild(old);
    var cols=type==='in'?['#0FA3B1','#37C980','#F2C14E']:['#0FA3B1','#F27B91','#F2C14E'];
    var parts='';
    for(var i=0;i<10;i++)parts+='<i style="--a:'+(i*36)+'deg;background:'+cols[i%3]+';animation-duration:'+(620+(i%4)*70)+'ms"></i>';
    var c=document.createElement('div');c.className='celeb';
    c.innerHTML='<div class="cb'+(type==='out'?' out':'')+'"><svg class="ic"><use href="#i-check"/></svg></div>'+parts;
    document.body.appendChild(c);
    setTimeout(function(){if(c.parentNode)c.parentNode.removeChild(c);},950);
  }catch(e){}
}
/* ===== v5 motion: 3D tilt + glare on hero balance cards ===== */
function initTilt(){
  try{
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    $$('.passbook').forEach(function(card){
      if(card._tilt)return;card._tilt=1;
      var glow=document.createElement('span');glow.className='glow';card.appendChild(glow);
      function move(x,y){
        var r=card.getBoundingClientRect();if(!r.width)return;
        var px=(x-r.left)/r.width,py=(y-r.top)/r.height;
        card.style.transition='transform .09s linear';
        card.style.transform='perspective(900px) rotateX('+((py-.5)*-7).toFixed(2)+'deg) rotateY('+((px-.5)*9).toFixed(2)+'deg) scale(1.012)';
        card.style.setProperty('--gx',(px*100).toFixed(1)+'%');
        card.style.setProperty('--gy',(py*100).toFixed(1)+'%');
      }
      function reset(){card.style.transition='';card.style.transform='';}
      card.addEventListener('pointerdown',function(e){move(e.clientX,e.clientY);});
      card.addEventListener('pointermove',function(e){
        if(e.pointerType==='mouse'||e.buttons)move(e.clientX,e.clientY);
      });
      card.addEventListener('pointerup',reset);
      card.addEventListener('pointerleave',reset);
      card.addEventListener('pointercancel',reset);
    });
  }catch(e){}
}

/* ============ navigation ============ */
var currentBook=null,currentTab='ledger',currentParty=null,currentAcc='cash';
var ROOT={'view-home':1,'view-parties':1,'view-analytics':1,'view-settings':1};
var backOf={'view-book':'view-home','view-party':'view-parties','view-account':'view-home','view-trash':'view-settings','view-budgets':'view-book','view-recurring':'view-book','view-categories':'view-settings'};
function activeViewId(){var el=$('.view.active');return el?el.id:'view-home';}
function showView(id){
  $$('.view').forEach(function(v){v.classList.toggle('active',v.id===id);});
  var root=!!ROOT[id];
  $('#bottomnav').classList.toggle('hidden',!root);
  $('#fab-entry').classList.toggle('hidden',id!=='view-home');
  if(root)$$('#bottomnav .nbtn').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-v')===id);});
  window.scrollTo(0,0);
}
function renderFor(id){
  if(id==='view-home')renderHome();
  else if(id==='view-books')renderBooks();
  else if(id==='view-parties')renderParties();
  else if(id==='view-analytics')renderGlobalAnalytics();
  else if(id==='view-settings')renderSettings();
  else if(id==='view-book')renderBook();
  else if(id==='view-party')renderParty();
  else if(id==='view-account')renderAccount();
}
function goTab(id){exitSel();renderFor(id);showView(id);}
function goView(id,from){if(from)backOf[id]=from;showView(id);}
function goBack(cur){
  var t=backOf[cur]||'view-home';
  if(t==='view-book'&&!currentBook)t='view-home';
  if(t==='view-party'&&!currentParty)t='view-parties';
  renderFor(t);showView(t);
}
function refreshData(){renderFor(activeViewId());}
$('#bottomnav').addEventListener('click',function(e){
  var b=e.target.closest('.nbtn');if(b)goTab(b.getAttribute('data-v'));
});

/* ============ home: accounts, today, passbook, search, recent ============ */
function sparkSVG(strokeCol,dotCol){
  if(!S.entries.length)return '';
  var start=addDays(sod(new Date()),-29).getTime(),end=addDays(sod(new Date()),1).getTime();
  var opening=0;
  S.books.forEach(function(b){opening+=b.opening;});
  S.entries.forEach(function(e){if(e.ts<start)opening+=signed(e);});
  var pts=[],bal=opening,d,t;
  for(d=start;d<end;d=addDays(d,1).getTime()){
    t=addDays(d,1).getTime();
    S.entries.forEach(function(e){if(e.ts>=d&&e.ts<t)bal+=signed(e);});
    pts.push(bal);
  }
  var mn=Math.min.apply(null,pts),mx=Math.max.apply(null,pts);
  if(mn===mx){mn-=100;mx+=100;}
  var W=96,H=34,path='';
  pts.forEach(function(v,i){
    var x=(W-4)*i/(pts.length-1)+2,y=2+(1-(v-mn)/(mx-mn))*(H-4);
    path+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)+' ';
  });
  return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" aria-label="30 day trend"><path d="'+path+'" fill="none" stroke="'+strokeCol+'" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="'+(W-2)+'" cy="'+(2+(1-(pts[pts.length-1]-mn)/(mx-mn))*(H-4)).toFixed(1)+'" r="3" fill="'+dotCol+'"/></svg>';
}
function renderBanners(){
  $('#persist-banner').classList.toggle('hidden',store.persistent);
  var st=S.settings,now=Date.now();
  var due=S.entries.length>=10&&(!st.lastBackupAt||now-st.lastBackupAt>7*86400000)&&now>st.backupSnooze;
  $('#backup-banner').classList.toggle('hidden',!due);
}
$('#bb-do').addEventListener('click',function(){shareBackup();renderBanners();});
$('#bb-later').addEventListener('click',function(){S.settings.backupSnooze=Date.now()+7*86400000;save();renderBanners();});
var HQ='';
function entryCardInner(e,opts){
  /* v6 Paper Ledger row: title (note first line) + category dot line, signed amount right */
  opts=opts||{};
  var c=catById(e.categoryId);
  var title=String(e.note||c.name).split(/\n/)[0];
  var marks='';
  if(e.auto)marks+='<span title="Recurring"><svg class="ic"><use href="#i-repeat"/></svg></span>';
  if(e.attach)marks+='<span title="Photo attached"><svg class="ic"><use href="#i-clip"/></svg></span>';
  var subBits=['<span class="subcat"><span class="catdot" style="background:'+(c.color||hashColor(c.id))+'"></span>'+esc(c.name)+'</span>'];
  if(opts.bookName)subBits.push('<span>'+esc(opts.bookName)+'</span>');
  if(opts.partyName)subBits.push('<span>'+esc(opts.partyName)+'</span>');
  var amt=opts.amtHtml!==undefined?opts.amtHtml:'<div class="e2amt '+e.type+'">'+moneySigned(e.amount,e.type)+'</div>';
  var bal=opts.balHtml||'';
  return '<div class="e2head"><span class="selcheck"><svg class="ic"><use href="#i-check"/></svg></span>'+
    '<div class="e2main"><div class="e2title">'+esc(title)+'</div><div class="e2sub">'+subBits.join('')+(marks?'<span class="e2marks">'+marks+'</span>':'')+'</div></div>'+
    '<div class="e2right">'+amt+bal+'</div></div>';
}
function gRow(e,showBook){
  return '<button class="entry" data-gid="'+e.id+'">'+
    entryCardInner(e,{bookName:showBook&&bookById(e.bookId)?bookById(e.bookId).name:'',
      partyName:e.partyId&&partyById(e.partyId)?partyById(e.partyId).name:''})+
    '</button>';
}
function renderHomeResults(){
  var box=$('#home-results'),body=$('#home-body');
  var q=HQ.trim().toLowerCase();
  if(!q){box.innerHTML='';if(body)body.classList.remove('hidden');return;}
  if(body)body.classList.add('hidden');
  var qa=q.replace(/,/g,'');
  var hits=S.entries.filter(function(e){
    var cn=catById(e.categoryId).name.toLowerCase();
    var pn=e.partyId&&partyById(e.partyId)?partyById(e.partyId).name.toLowerCase():'';
    var amtStr=String(Math.round(e.amount/100));
    return (e.note||'').toLowerCase().indexOf(q)>-1||cn.indexOf(q)>-1||pn.indexOf(q)>-1||amtStr.indexOf(qa)>-1;
  }).sort(function(a,b){return -entrySortAsc(a,b);});
  var capped=hits.slice(0,50);
  if(!capped.length){box.innerHTML='<div class="empty" style="padding:24px"><h2 style="font-size:16px">Nothing found</h2><p>No entry in any book matches \u201C'+esc(HQ.trim())+'\u201D.</p></div>';return;}
  var groups=[],map={};
  capped.forEach(function(e){var k=dayKeyOf(e.ts);if(!map[k]){map[k]={key:k,items:[]};groups.push(map[k]);}map[k].items.push(e);});
  box.innerHTML='<div class="sect"><h3>'+capped.length+(hits.length>50?' of '+hits.length:'')+' result'+(capped.length===1?'':'s')+(hits.length>50?' \u00B7 first 50':'')+'</h3></div>'+
    groups.map(function(g){return '<div class="day fadein"><div class="dayhead"><h4>'+dayLabel(g.key)+'</h4></div><div class="daycard">'+
      g.items.map(function(e){return '<div class="erow">'+gRow(e,true)+'</div>';}).join('')+'</div></div>';}).join('');
}
$('#home-search').addEventListener('input',function(){HQ=this.value;clearTimeout(window.__hqT);window.__hqT=setTimeout(renderHomeResults,180);});
$('#home-results').addEventListener('click',function(e){var b=e.target.closest('[data-gid]');if(b)openDetail(b.getAttribute('data-gid'));});
function renderHome(){
  renderBanners();
  $('#btn-locknow').classList.toggle('hidden',!S.settings.pinHash);
  var hd=$('#home-date');
  if(hd)hd.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  renderHomeTrialPill();
  var empty=$('#home-empty'),main=$('#home-main');
  if(!S.books.length){empty.classList.remove('hidden');main.classList.add('hidden');return;}
  empty.classList.add('hidden');main.classList.remove('hidden');
  var _cb=cashBal(),_bb=bankBal();
  countUp($('#acc-cash-bal'),_cb);
  countUp($('#acc-bank-bal'),_bb);
  $('#acc-cash-bal').classList.toggle('neg',_cb<0);
  $('#acc-bank-bal').classList.toggle('neg',_bb<0);
  var net=0;S.books.forEach(function(b){net+=bookNet(b.id);});
  $('#home-pass').setAttribute('data-cur',curSym());
  countUp($('#hp-net'),net);
  $('#home-books').innerHTML=S.books.map(function(b){
    var t=bookTotals(b.id),es=bookEntries(b.id);
    var cls=t.net<0?'neg':'';
    var primary=(b.id===primaryCashBookId())?'<span class="pillprimary">PRIMARY</span>':'';
    return '<button class="bookcard card" data-id="'+b.id+'">'+
      '<span class="avb" data-tone="'+avTone(b.id)+'">'+esc(initialsOf(b.name))+'</span>'+
      '<div class="bmid"><div class="bname"><span class="bnm">'+esc(b.name)+'</span>'+primary+'</div><div class="bsub">'+es.length+(es.length===1?' entry':' entries')+'</div></div>'+
      '<div class="bbal '+cls+'">'+money(t.net)+'</div></button>';
  }).join('');
  stagger($('#home-books'));
  renderHomeResults();
}
function renderHomeTrialPill(){
  var p=$('#home-trial');if(!p)return;
  var st=licState();
  if(st.s==='trial'){p.textContent=st.left+(st.left===1?' day left':' days left');p.classList.remove('hidden');}
  else p.classList.add('hidden');
}
$('#btn-locknow').addEventListener('click',function(){if(S.settings.pinHash)showLock();});
$('#btn-home-search').addEventListener('click',function(){
  var row=$('#home-searchrow'),show=row.classList.contains('hidden');
  row.classList.toggle('hidden',!show);
  if(show)setTimeout(function(){$('#home-search').focus();},60);
  else{$('#home-search').value='';HQ='';renderHomeResults();}
});
$('#btn-home-newbook').addEventListener('click',function(){openBookSheet(null);});
$('#home-pass').addEventListener('click',function(e){
  if(e.target.closest('#btn-xfer')){openXferSheet(null);return;}
  var c=e.target.closest('[data-acc]');
  if(c)openAccount(c.getAttribute('data-acc'));
});
$('#home-books').addEventListener('click',function(e){var b=e.target.closest('[data-id]');if(b)openBook(b.getAttribute('data-id'));});
/* v6: long-press a home book row for its options menu (rename, export, delete, ...) */
(function(){
  var lpT=null,lpFired=false;
  var list=$('#home-books');
  list.addEventListener('pointerdown',function(e){
    var b=e.target.closest('[data-id]');if(!b)return;
    lpFired=false;
    lpT=setTimeout(function(){lpFired=true;buzz();bookMenu(b.getAttribute('data-id'));},550);
  });
  ['pointerup','pointercancel','pointerleave'].forEach(function(ev){
    list.addEventListener(ev,function(){clearTimeout(lpT);});
  });
  list.addEventListener('click',function(e){if(lpFired){e.stopPropagation();e.preventDefault();lpFired=false;}},true);
})();

/* ============ transfers ============ */
var xfEditing=null,xfDir='c2b';
function openXferSheet(id){
  if(!lockGate())return;
  var x=id?xferById(id):null;
  xfEditing=x?id:null;
  xfDir=x?x.dir:'c2b';
  $('#xf-title').textContent=x?'Edit transfer':'Transfer';
  $('#xf-cur').textContent=curSym();
  $('#xf-amount').value=x?(x.amount/100):'';
  $('#xf-calc').textContent='';
  $('#xf-err').classList.add('hidden');
  var when=x?new Date(x.ts):new Date();
  $('#xf-date').value=dateInputVal(when);
  $('#xf-time').value=timeInputVal(when);
  $('#xf-note').value=x?(x.note||''):'';
  $('#xf-delete').classList.toggle('hidden',!x);
  $$('#xf-dir button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-d')===xfDir);});
  openSheet('sheet-xfer');
  focusAfterOpen('sheet-xfer','#xf-amount');
}
$('#xf-dir').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;xfDir=b.getAttribute('data-d');$$('#xf-dir button').forEach(function(x){x.classList.toggle('on',x===b);});});
$('#xf-amount').addEventListener('input',function(){
  var s=this.value;$('#xf-err').classList.add('hidden');
  if(/[+\-*/()]/.test(s)){var v=calcEval(s);$('#xf-calc').textContent=(v!==null&&v>0)?'= '+curSym()+' '+nfmt(Math.round(v*100)):'';}
  else $('#xf-calc').textContent='';
});
$('#xf-save').addEventListener('click',function(){
  var cents=parseAmt($('#xf-amount').value);
  if(cents===null){$('#xf-err').classList.remove('hidden');return;}
  var d=$('#xf-date').value,tp=($('#xf-time').value||'12:00').split(':'),ts;
  if(d){var dp=d.split('-');ts=new Date(+dp[0],+dp[1]-1,+dp[2],+tp[0]||0,+tp[1]||0).getTime();}else ts=Date.now();
  var note=$('#xf-note').value.trim();
  if(xfEditing){
    var x=xferById(xfEditing);
    if(x){x.dir=xfDir;x.amount=cents;x.ts=ts;x.note=note;}
    toast('Transfer updated');
  }else{
    S.transfers.push({id:uid('x'),dir:xfDir,amount:cents,ts:ts,note:note,created:Date.now()});
    toast('Transfer saved');
  }
  save();closeSheet('sheet-xfer');buzz();
  refreshData();
});
$('#xf-delete').addEventListener('click',function(){
  var id=xfEditing;
  confirmDlg({title:'Delete transfer?',msg:'Both account balances will be adjusted back.',okLabel:'Delete',danger:true}).then(function(ok){
    if(!ok)return;
    S.transfers=S.transfers.filter(function(x){return x.id!==id;});
    save();closeSheet('sheet-xfer');refreshData();toast('Transfer deleted');
  });
});

/* ============ account statement ============ */
var ACCR={r:'all',from:'',to:''};
function openAccount(acc){currentAcc=acc;ACCR={r:'all',from:'',to:''};renderAccount();goView('view-account');}
function renderAccount(){
  var acc=currentAcc;
  $('#acc-title').textContent=accName(acc);
  var mv=accMovements(acc);
  var big=$('#acc-big');
  countUp(big,mv.closing);
  big.classList.toggle('neg',mv.closing<0);
  $('#acc-lbl').textContent='Balance right now';
  $('#acc-sub').textContent='Opening '+money(mv.opening)+' \u00B7 '+mv.items.length+' movement'+(mv.items.length===1?'':'s');
  $$('#acc-range .chip').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-r')===ACCR.r);});
  $('#acc-custom').classList.toggle('hidden',ACCR.r!=='custom');
  var range=null;
  if(ACCR.r==='month')range=presetRange('month');
  else if(ACCR.r==='custom')range=parseRangeInput(ACCR.from,ACCR.to);
  var items=mv.items.slice().reverse().filter(function(it){return !range||(it.ts>=range[0]&&it.ts<range[1]);});
  var list=$('#acc-list'),empty=$('#acc-empty');
  if(!items.length){list.innerHTML='';empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  var groups=[],map={};
  items.forEach(function(it){
    var k=dayKeyOf(it.ts);
    if(!map[k]){map[k]={key:k,items:[]};groups.push(map[k]);}
    map[k].items.push(it);
  });
  list.innerHTML=groups.map(function(g){
    return '<div class="day"><div class="dayhead"><h4>'+dayLabel(g.key)+'</h4></div><div class="daycard">'+
      g.items.map(function(it){
        var bal=mv.run[it.id];
        if(it.kind==='t'){
          var x=it.ref,dirTxt=acc==='cash'?(x.dir==='c2b'?'To Bank account':'From Bank account'):(x.dir==='c2b'?'From Cash in hand':'To Cash in hand');
          return '<div class="erow"><button class="entry xrow" data-xid="'+x.id+'">'+
            '<div class="eic"><svg class="ic"><use href="#i-xfer"/></svg></div>'+
            '<div class="emid"><div class="etitle">'+(x.note?esc(x.note):'Transfer')+'</div><div class="esub">'+dirTxt+'</div></div>'+
            '<div class="e2right"><div class="e2amt '+(it.eff>0?'in':'out')+'">'+(it.eff>0?'+ ':'\u2212 ')+curSym()+' '+nfmt(Math.abs(it.eff))+'</div><div class="e2bal">Balance: '+nfmt(bal)+'</div></div></button></div>';
        }
        var e=it.ref,b=bookById(e.bookId);
        return '<div class="erow"><button class="entry" data-gid="'+e.id+'">'+
          entryCardInner(e,{bookName:b?b.name:'?',partyName:e.partyId&&partyById(e.partyId)?partyById(e.partyId).name:'',balHtml:'<div class="e2bal">Balance: '+nfmt(bal)+'</div>'})+
          '</button></div>';
      }).join('')+'</div></div>';
  }).join('');
}
$('#acc-range').addEventListener('click',function(e){
  var b=e.target.closest('.chip');if(!b)return;
  ACCR.r=b.getAttribute('data-r');
  if(ACCR.r==='custom'&&!ACCR.from){var r=presetRange('month');ACCR.from=dateInputVal(r[0]);ACCR.to=dateInputVal(new Date());$('#acc-from').value=ACCR.from;$('#acc-to').value=ACCR.to;}if(typeof syncControls==='function')syncControls();
  renderAccount();
});
$('#acc-from').addEventListener('change',function(){ACCR.from=this.value;renderAccount();});
$('#acc-to').addEventListener('change',function(){ACCR.to=this.value;renderAccount();});
$('#acc-list').addEventListener('click',function(e){
  var x=e.target.closest('[data-xid]');
  if(x){openXferSheet(x.getAttribute('data-xid'));return;}
  var g=e.target.closest('[data-gid]');
  if(g)openDetail(g.getAttribute('data-gid'));
});
$('#btn-acc-back').addEventListener('click',function(){goBack('view-account');});
$('#btn-acc-xfer').addEventListener('click',function(){openXferSheet(null);});
var aoSign=1;
$('#btn-acc-open').addEventListener('click',function(){
  if(!lockGate())return;
  var v=S.settings.accOpening[currentAcc]||0;
  aoSign=v<0?-1:1;
  $('#ao-title').textContent='Opening \u00B7 '+accName(currentAcc);
  $('#ao-cur').textContent=curSym();
  $('#ao-amount').value=v?Math.abs(v/100):'';
  $('#ao-err').classList.add('hidden');
  $$('#ao-sign button').forEach(function(b){b.classList.toggle('on',+b.getAttribute('data-s')===aoSign);});
  openSheet('sheet-accopen');
  focusAfterOpen('sheet-accopen','#ao-amount');
});
$('#ao-sign').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;aoSign=+b.getAttribute('data-s');$$('#ao-sign button').forEach(function(x){x.classList.toggle('on',x===b);});});
$('#ao-save').addEventListener('click',function(){
  if(!lockGate())return;
  var raw=$('#ao-amount').value.trim(),cents=0;
  if(raw){cents=parseAmt(raw);if(cents===null){$('#ao-err').classList.remove('hidden');return;}}
  S.settings.accOpening[currentAcc]=aoSign*cents;
  save();closeSheet('sheet-accopen');refreshData();toast('Opening balance saved');
});
$('#btn-acc-menu').addEventListener('click',function(){
  var acc=currentAcc;
  menuSheet([
    {icon:'download',label:'Export CSV',fn:function(){exportAccountCSV(acc);}},
    {icon:'printer',label:'Export PDF',fn:function(){openExportSheet('account');}}
  ]);
});

/* ============ books tab, menus, book CRUD ============ */
function renderBooks(){
  var list=$('#books-list'),empty=$('#books-empty');
  if(!S.books.length){empty.classList.remove('hidden');list.innerHTML='';return;}
  empty.classList.add('hidden');
  list.innerHTML=S.books.map(function(b){
    var t=bookTotals(b.id),es=bookEntries(b.id),n=es.length,last=0;
    es.forEach(function(e){if(e.ts>last)last=e.ts;});
    var cls=t.net>0?'pos':(t.net<0?'neg':'');
    return '<div class="bookcard card" data-id="'+b.id+'" role="button" tabindex="0" aria-label="Open '+esc(b.name)+'">'+
      '<div class="bic" style="background:'+hashColor(b.id)+'22;color:'+hashColor(b.id)+'"><svg class="ic"><use href="#i-book"/></svg></div>'+
      '<div class="bmid"><div class="bname">'+esc(b.name)+'</div><div class="bsub">'+n+(n===1?' entry':' entries')+(last?' \u00B7 last '+fmtDate(last):'')+'</div></div>'+
      '<div class="bbal '+cls+'">'+money(t.net)+'</div>'+
      '<button class="iconbtn" data-menu="'+b.id+'" aria-label="Options for '+esc(b.name)+'"><svg class="ic"><use href="#i-more"/></svg></button></div>';
  }).join('');
  stagger(list);
}
$('#books-list').addEventListener('click',function(e){
  var k=e.target.closest('[data-menu]');
  if(k){bookMenu(k.getAttribute('data-menu'));return;}
  var c=e.target.closest('.bookcard');if(c)openBook(c.getAttribute('data-id'));
});
$('#books-list').addEventListener('keydown',function(e){
  if(e.key!=='Enter'&&e.key!==' ')return;
  var c=e.target.closest('.bookcard');
  if(c&&!e.target.closest('[data-menu]')){e.preventDefault();openBook(c.getAttribute('data-id'));}
});
var menuActions=[];
function menuSheet(items){
  menuActions=items;
  $('#menu-items').innerHTML=items.map(function(it,i){
    return '<button class="srow'+(it.danger?' danger':'')+'" data-i="'+i+'"><svg class="ic"><use href="#i-'+it.icon+'"/></svg><span class="sl">'+esc(it.label)+'</span></button>';
  }).join('');
  openSheet('sheet-menu');
}
$('#menu-items').addEventListener('click',function(e){
  var b=e.target.closest('[data-i]');if(!b)return;
  var fn=menuActions[+b.getAttribute('data-i')].fn;
  closeSheet('sheet-menu');fn();
});
function bookMenu(id){
  if(!bookById(id))return;
  menuSheet([
    {icon:'book',label:'Open book',fn:function(){openBook(id);}},
    {icon:'edit',label:'Edit book',fn:function(){openBookSheet(id);}},
    {icon:'trash',label:'Delete book',danger:true,fn:function(){deleteBook(id);}}
  ]);
}
function inBookMenu(){
  var id=currentBook;
  menuSheet([
    {icon:'repeat',label:'Recurring entries',fn:function(){renderRecurring();goView('view-recurring');}},
    {icon:'target',label:'Budgets',fn:function(){renderBudgets();goView('view-budgets');}},
    {icon:'calc',label:'Cash counter',fn:function(){openDenoms(null);}},
    {icon:'download',label:'Export CSV (filtered)',fn:function(){exportCSV(filteredEntries().slice().reverse(),bookById(id).name);}},
    {icon:'printer',label:'Export PDF',fn:function(){openExportSheet('ledger');}},
    {icon:'trash',label:'Trash',fn:function(){renderTrash();goView('view-trash','view-book');}},
    {icon:'edit',label:'Edit book',fn:function(){openBookSheet(id);}},
    {icon:'alert',label:'Delete book',danger:true,fn:function(){deleteBook(id);}}
  ]);
}
var bkEditing=null,bkSign=1,bkFromEntry=false;
function openBookSheet(id,fromEntry){
  if(!lockGate())return;
  bkEditing=id||null;bkFromEntry=!!fromEntry;
  var b=id?bookById(id):null;
  bkSign=(b&&b.opening<0)?-1:1;
  $('#bk-title').textContent=b?'Edit book':'New book';
  $('#bk-save').textContent=b?'Save book':'Create book';
  $('#bk-name').value=b?b.name:'';
  $('#bk-open').value=b&&b.opening?Math.abs(b.opening/100):'';
  $$('#bk-open-sign button').forEach(function(x){x.classList.toggle('on',+x.getAttribute('data-s')===bkSign);});
  $('#bk-err').classList.add('hidden');
  openSheet('sheet-book');
  focusAfterOpen('sheet-book','#bk-name');
}
$('#bk-open-sign').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;bkSign=+b.getAttribute('data-s');$$('#bk-open-sign button').forEach(function(x){x.classList.toggle('on',x===b);});});
function saveBook(){
  var name=$('#bk-name').value.trim();
  if(!name){$('#bk-err').classList.remove('hidden');$('#bk-name').focus();return;}
  var raw=$('#bk-open').value.trim(),op=0;
  if(raw){var c=parseAmt(raw);if(c===null){toast('Check the opening amount');return;}op=bkSign*c;}
  if(bkEditing){
    var b=bookById(bkEditing);
    if(b){b.name=name;b.opening=op;}
    save();closeSheet('sheet-book');
    if(currentBook===bkEditing){lastBal=null;$('#book-title').textContent=name;}
    refreshData();toast('Book saved');
  }else{
    var nb={id:uid('b'),name:name,created:Date.now(),opening:op};
    S.books.push(nb);S.settings.lastBook=nb.id;
    if(!primaryCashBookId())S.settings.cashBookId=nb.id;
    save();
    closeSheet('sheet-book');
    if(bkFromEntry){bkFromEntry=false;entBook=nb.id;renderEntSelects();toast('Book created');return;}
    toast('Book created');openBook(nb.id);
  }
}
$('#bk-save').addEventListener('click',saveBook);
$('#bk-name').addEventListener('keydown',function(e){if(e.key==='Enter')saveBook();});
function deleteBook(id){
  if(!lockGate())return;
  var b=bookById(id);if(!b)return;
  var n=bookEntries(id).length;
  confirmDlg({title:'Delete \u201C'+b.name+'\u201D?',
    msg:'This permanently deletes the book, its '+n+' '+(n===1?'entry':'entries')+', and its recurring rules, budgets and quick adds. This cannot be undone.',
    word:b.name,okLabel:'Delete book',danger:true}).then(function(ok){
    if(!ok)return;
    S.books=S.books.filter(function(x){return x.id!==id;});
    S.entries=S.entries.filter(function(e){return e.bookId!==id;});
    S.trash=S.trash.filter(function(t){return t.e.bookId!==id;});
    S.recurring=S.recurring.filter(function(r){return r.bookId!==id;});
    S.budgets=S.budgets.filter(function(x){return x.bookId!==id;});
    S.templates=S.templates.filter(function(t){return t.bookId!==id;});
    if(S.settings.lastBook===id)S.settings.lastBook='';
    if(S.settings.cashBookId===id){var cbBest=null;S.books.forEach(function(b){if(!cbBest||b.created<cbBest.created)cbBest=b;});S.settings.cashBookId=cbBest?cbBest.id:'';}
    save();
    if(currentBook===id){currentBook=null;goTab('view-home');}
    else refreshData();
    toast('Book deleted');
  });
}
$('#btn-new-book').addEventListener('click',function(){openBookSheet(null);});
$('#btn-books-new').addEventListener('click',function(){openBookSheet(null);});
$('#btn-empty-new').addEventListener('click',function(){openBookSheet(null);});

/* ============ open book, tabs, summary, filters ============ */
var F=null,A=null,lastBal=null;
function resetFilters(){F={q:'',type:'all',cats:[],modes:[],parties:[],range:'all',from:'',to:''};}
resetFilters();
function openBook(id){
  if(!bookById(id))return;
  exitSel();
  currentBook=id;S.settings.lastBook=id;save();
  resetFilters();
  $('#search-input').value='';
  A={p:'month',from:'',to:'',donut:'out'};
  lastBal=null;
  $('#book-title').textContent=bookById(id).name;
  renderBook();showView('view-book');
}
$('#btn-book-back').addEventListener('click',function(){exitSel();currentBook=null;goTab('view-home');});
$('#btn-book-menu').addEventListener('click',inBookMenu);
/* v6: tap the book name to switch books (mock's title-dropdown pattern) */
$('#btn-book-switch').addEventListener('click',function(){
  if(S.books.length<2)return;
  menuSheet(S.books.map(function(b){
    return {icon:'book',label:b.name+(b.id===currentBook?'  ✓':''),fn:function(){if(b.id!==currentBook)openBook(b.id);}};
  }));
});
function renderBook(){
  if(!currentBook)return;
  renderSummary();renderQuickbar();renderEntries();
}
function renderSummary(){
  var t=bookTotals(currentBook);
  var el=$('#book-balsub');
  if(lastBal===null)el._cv=undefined;
  countUp(el,t.net,function(v){return 'Balance '+money(v);});
  lastBal=t.net;
}
function activeRange(){
  if(F.range==='all')return null;
  if(F.range==='custom')return parseRangeInput(F.from,F.to);
  return presetRange(F.range);
}
function filteredEntries(){
  var r=activeRange(),q=F.q.trim().toLowerCase();
  return bookEntries(currentBook).filter(function(e){
    if(F.type!=='all'&&e.type!==F.type)return false;
    if(F.cats.length&&F.cats.indexOf(e.categoryId)<0)return false;
    if(F.modes.length&&F.modes.indexOf(e.mode)<0)return false;
    if(F.parties.length&&F.parties.indexOf(e.partyId||'')<0)return false;
    if(r&&(e.ts<r[0]||e.ts>=r[1]))return false;
    if(q){
      var catName=catById(e.categoryId).name.toLowerCase();
      var pn=e.partyId&&partyById(e.partyId)?partyById(e.partyId).name.toLowerCase():'';
      var amtStr=String(Math.round(e.amount/100)),qa=q.replace(/,/g,'');
      if((e.note||'').toLowerCase().indexOf(q)<0&&catName.indexOf(q)<0&&pn.indexOf(q)<0&&amtStr.indexOf(qa)<0)return false;
    }
    return true;
  }).sort(function(a,b){return -entrySortAsc(a,b);});
}
function filterCount(){var n=0;if(F.type!=='all')n++;if(F.cats.length)n++;if(F.modes.length)n++;if(F.parties.length)n++;if(F.range!=='all')n++;return n;}
function updateBadge(){var n=filterCount(),b=$('#filter-badge');b.textContent=n;b.classList.toggle('hidden',!n);}
function filtersLabel(){
  var parts=[];
  if(F.type!=='all')parts.push(F.type==='in'?'Cash in':'Cash out');
  if(F.cats.length)parts.push(F.cats.map(function(id){return catById(id).name;}).join(', '));
  if(F.parties.length)parts.push('Party: '+F.parties.map(function(id){var p=partyById(id);return p?p.name:'?';}).join(', '));
  if(F.modes.length)parts.push(F.modes.join(', '));
  if(F.range!=='all'){var names={today:'Today',yesterday:'Yesterday',week:'This week',month:'This month'};parts.push(names[F.range]||rangeLabel(activeRange()));}
  if(F.q.trim())parts.push('search \u201C'+F.q.trim()+'\u201D');
  return parts.length?parts.join(' \u00B7 '):'None';
}
$('#search-input').addEventListener('input',function(){F.q=this.value;renderEntries();});
$('#btn-nores-clear').addEventListener('click',function(){resetFilters();$('#search-input').value='';renderEntries();});

/* ============ ledger render, swipe, selection ============ */
function renderQuickbar(){
  var bar=$('#quickbar');
  var ts=S.templates.filter(function(t){return t.bookId===currentBook;});
  if(!ts.length){bar.classList.add('hidden');bar.innerHTML='';return;}
  bar.classList.remove('hidden');
  bar.innerHTML=ts.map(function(t){
    var label=t.note||catById(t.categoryId).name;
    if(t.amount)label+=' \u00B7 '+curSym()+compact(t.amount);
    return '<span class="qchip" data-tid="'+t.id+'"><svg class="ic zapic"><use href="#i-zap"/></svg><span class="qlabel">'+esc(label)+'</span><button class="qx" data-del="'+t.id+'" aria-label="Remove quick add"><svg class="ic"><use href="#i-x"/></svg></button></span>';
  }).join('');
}
function renderEntries(){
  openSw=null;
  var all=bookEntries(currentBook);
  var list=$('#entries-list'),emptyBook=$('#ledger-empty'),nores=$('#ledger-nores');
  updateBadge();renderChips();
  list.classList.toggle('selmode',sel.on);
  if(!all.length){list.innerHTML='';emptyBook.classList.remove('hidden');nores.classList.add('hidden');return;}
  emptyBook.classList.add('hidden');
  var es=filteredEntries();
  if(!es.length){list.innerHTML='';nores.classList.remove('hidden');return;}
  nores.classList.add('hidden');
  var run;
  if(filterCount()>0||F.q.trim()){
    run={};var fbal=0;
    es.slice().reverse().forEach(function(e){fbal+=signed(e);run[e.id]=fbal;});
  }else run=runningMap(currentBook);
  var groups=[],map={};
  es.forEach(function(e){
    var k=dayKeyOf(e.ts);
    if(!map[k]){map[k]={key:k,items:[],tin:0,tout:0};groups.push(map[k]);}
    map[k].items.push(e);
    if(e.type==='in')map[k].tin+=e.amount;else map[k].tout+=e.amount;
  });
  list.innerHTML=groups.map(function(g){
    /* v6: day header shows the day's CLOSING balance (items are newest-first, so [0] closes the day);
       per-row running balance moved to Entry Detail ("Balance after entry") + PDF exports. */
    var close=run[g.items[0].id];
    return '<div class="day"><div class="dayhead"><h4>'+dayLabel(g.key)+'</h4><span class="dsub">'+nfmt(close)+'</span></div>'+
      '<div class="daycard">'+g.items.map(function(e){return entryRow(e);}).join('')+'</div></div>';
  }).join('');
  stagger(list);
}
function entryRow(e){
  return '<div class="erow" data-id="'+e.id+'">'+
    '<div class="eact dup" data-act="dup"><svg class="ic"><use href="#i-copy"/></svg>Duplicate</div>'+
    '<div class="eact del" data-act="del"><svg class="ic"><use href="#i-trash"/></svg>Delete</div>'+
    '<button class="entry'+(sel.on&&sel.set[e.id]?' selected':'')+'" data-id="'+e.id+'">'+
    entryCardInner(e,{partyName:e.partyId&&partyById(e.partyId)?partyById(e.partyId).name:''})+
    '</button></div>';
}
function renderChips(){
  var row=$('#chips-row'),chips=[];
  if(F.type!=='all')chips.push({k:'type',v:'',label:F.type==='in'?'Cash in':'Cash out'});
  F.cats.forEach(function(id){var c=catById(id);chips.push({k:'cat',v:id,label:c.name});});
  F.parties.forEach(function(id){var p=partyById(id);if(p)chips.push({k:'party',v:id,label:p.name});});
  F.modes.forEach(function(m){chips.push({k:'mode',v:m,label:m});});
  if(F.range!=='all'){
    var names={today:'Today',yesterday:'Yesterday',week:'This week',month:'This month'};
    chips.push({k:'range',v:'',label:names[F.range]||rangeLabel(activeRange())});
  }
  if(!chips.length){row.classList.add('hidden');row.innerHTML='';return;}
  row.classList.remove('hidden');
  row.innerHTML=chips.map(function(c){
    return '<button class="chip on" data-k="'+c.k+'" data-v="'+esc(c.v)+'" aria-label="Remove filter '+esc(c.label)+'">'+esc(c.label)+'<svg class="ic"><use href="#i-x"/></svg></button>';
  }).join('');
}
$('#chips-row').addEventListener('click',function(e){
  var ch=e.target.closest('.chip');if(!ch)return;
  var k=ch.getAttribute('data-k'),v=ch.getAttribute('data-v');
  if(k==='type')F.type='all';
  else if(k==='cat')F.cats=F.cats.filter(function(x){return x!==v;});
  else if(k==='party')F.parties=F.parties.filter(function(x){return x!==v;});
  else if(k==='mode')F.modes=F.modes.filter(function(x){return x!==v;});
  else if(k==='range'){F.range='all';F.from='';F.to='';}
  renderEntries();
});
$('#btn-filter').addEventListener('click',function(){syncFilterSheet();openSheet('sheet-filter');});
function syncFilterSheet(){
  $$('#f-type button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-t')===F.type);});
  $('#f-cats').innerHTML=S.categories.map(function(c){
    return '<button class="chip'+(F.cats.indexOf(c.id)>-1?' on':'')+'" data-id="'+c.id+'"><span class="catdot" style="background:'+c.color+'"></span>'+esc(c.name)+'</button>';
  }).join('');
  $('#f-party-wrap').classList.toggle('hidden',!S.parties.length);
  $('#f-parties').innerHTML=S.parties.map(function(p){
    return '<button class="chip'+(F.parties.indexOf(p.id)>-1?' on':'')+'" data-id="'+p.id+'">'+esc(p.name)+'</button>';
  }).join('');
  $('#f-modes').innerHTML=MODES.map(function(m){
    return '<button class="chip'+(F.modes.indexOf(m)>-1?' on':'')+'" data-m="'+m+'">'+m+'</button>';
  }).join('');
  $$('#f-range .chip').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-r')===F.range);});
  $('#f-custom').classList.toggle('hidden',F.range!=='custom');
  $('#f-from').value=F.from;$('#f-to').value=F.to;
}
$('#f-type').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;$$('#f-type button').forEach(function(x){x.classList.toggle('on',x===b);});});
['f-cats','f-parties','f-modes'].forEach(function(id){
  $('#'+id).addEventListener('click',function(e){var b=e.target.closest('.chip');if(b)b.classList.toggle('on');});
});
$('#f-range').addEventListener('click',function(e){
  var b=e.target.closest('.chip');if(!b)return;
  $$('#f-range .chip').forEach(function(x){x.classList.toggle('on',x===b);});
  var custom=b.getAttribute('data-r')==='custom';
  $('#f-custom').classList.toggle('hidden',!custom);
  if(custom&&!$('#f-from').value){var r=presetRange('month');$('#f-from').value=dateInputVal(r[0]);$('#f-to').value=dateInputVal(new Date());}if(typeof syncControls==='function')syncControls();
});
$('#f-apply').addEventListener('click',function(){
  var tb=$('#f-type button.on');F.type=tb?tb.getAttribute('data-t'):'all';
  F.cats=$$('#f-cats .chip.on').map(function(b){return b.getAttribute('data-id');});
  F.parties=$$('#f-parties .chip.on').map(function(b){return b.getAttribute('data-id');});
  F.modes=$$('#f-modes .chip.on').map(function(b){return b.getAttribute('data-m');});
  var rb=$('#f-range .chip.on');F.range=rb?rb.getAttribute('data-r'):'all';
  F.from=$('#f-from').value;F.to=$('#f-to').value;
  if(F.range==='custom'&&!parseRangeInput(F.from,F.to)){toast('Pick both custom dates');return;}
  closeSheet('sheet-filter');renderEntries();
});
$('#f-clear').addEventListener('click',function(){resetFilters();closeSheet('sheet-filter');renderEntries();});

/* selection + swipe */
var sel={on:false,set:{}};
function selCount(){return Object.keys(sel.set).length;}
function enterSel(id){sel.on=true;sel.set={};sel.set[id]=true;buzz(20);$('#selbar').classList.add('show');updateSelbar();renderEntries();}
function exitSel(){if(!sel.on)return;sel.on=false;sel.set={};$('#selbar').classList.remove('show');if(currentBook&&activeViewId()==='view-book')renderEntries();}
function toggleSel(id){
  if(sel.set[id])delete sel.set[id];else sel.set[id]=true;
  if(!selCount()){exitSel();return;}
  updateSelbar();renderEntries();
}
function updateSelbar(){$('#sel-count').textContent=selCount()+' selected';}
var lpTimer=null,lpStart=null;
var sw={active:false,row:null,id:null,startX:0,startY:0,dx:0},openSw=null,suppressClick=false;
function closeSwipe(){if(openSw){openSw.el.style.transform='';var er=openSw.el.closest('.erow');if(er)er.classList.remove('swp');openSw=null;}}
var EL=$('#entries-list');
EL.addEventListener('pointerdown',function(e){
  var row=e.target.closest('.entry');
  if(openSw&&(!row||openSw.id!==row.getAttribute('data-id'))&&!e.target.closest('.eact'))closeSwipe();
  if(!row)return;
  var id=row.getAttribute('data-id');
  sw.active=false;sw.row=row;sw.id=id;sw.startX=e.clientX;sw.startY=e.clientY;sw.dx=0;
  lpStart={x:e.clientX,y:e.clientY};
  clearTimeout(lpTimer);
  lpTimer=setTimeout(function(){lpTimer=null;if(!sel.on&&!sw.active)enterSel(id);},480);
});
EL.addEventListener('pointermove',function(e){
  if(!sw.row)return;
  var dx=e.clientX-sw.startX,dy=e.clientY-sw.startY;
  if(lpTimer&&(Math.abs(dx)>12||Math.abs(dy)>12)){clearTimeout(lpTimer);lpTimer=null;}
  if(!sw.active){
    if(sel.on)return;
    if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){sw.active=true;suppressClick=true;sw.row.style.transition='none';var er2=sw.row.closest('.erow');if(er2)er2.classList.add('swp');}
    else return;
  }
  sw.dx=clamp(dx,-84,84);
  sw.row.style.transform='translateX('+sw.dx+'px)';
});
function endSwipe(){
  clearTimeout(lpTimer);lpTimer=null;
  if(!sw.row)return;
  if(sw.active){
    var row=sw.row;
    row.style.transition='';
    if(Math.abs(sw.dx)>42){
      var snap=sw.dx>0?84:-84;
      row.style.transform='translateX('+snap+'px)';
      openSw={id:sw.id,el:row};
    }else{
      row.style.transform='';
      var er3=row.closest('.erow');if(er3)er3.classList.remove('swp');
      if(openSw&&openSw.el===row)openSw=null;
    }
    setTimeout(function(){suppressClick=false;},60);
  }
  sw.active=false;sw.row=null;
}
EL.addEventListener('pointerup',endSwipe);
EL.addEventListener('pointercancel',endSwipe);
EL.addEventListener('contextmenu',function(e){e.preventDefault();});
EL.addEventListener('click',function(e){
  var act=e.target.closest('.eact');
  if(act){
    var erow=act.closest('.erow'),id=erow.getAttribute('data-id');
    closeSwipe();
    if(act.getAttribute('data-act')==='dup'){var en=entryById(id);if(en)openEntrySheet({entry:en,duplicate:true});}
    else swipeDelete(id);
    return;
  }
  if(suppressClick){suppressClick=false;return;}
  var row=e.target.closest('.entry');if(!row)return;
  var id2=row.getAttribute('data-id');
  if(openSw&&openSw.id===id2){closeSwipe();return;}
  if(sel.on){toggleSel(id2);return;}
  openDetail(id2);
});
function swipeDelete(id){
  if(!lockGate())return;
  var idx=-1;
  for(var i=0;i<S.entries.length;i++)if(S.entries[i].id===id)idx=i;
  if(idx<0)return;
  var copy=S.entries[idx];
  S.entries.splice(idx,1);
  S.trash.push({e:copy,at:Date.now()});
  save();buzz();renderBook();
  snack('Moved to Trash',function(){
    S.trash=S.trash.filter(function(t){return t.e.id!==copy.id;});
    S.entries.push(copy);save();refreshData();toast('Entry restored');
  });
}
$('#sel-close').addEventListener('click',exitSel);
$('#sel-csv').addEventListener('click',function(){
  var ids=sel.set;
  var es=filteredEntries().filter(function(e){return ids[e.id];}).slice().reverse();
  exportCSV(es,bookById(currentBook).name+'-selected');
});
$('#sel-cat').addEventListener('click',function(){
  if(!lockGate())return;
  $('#bc-cats').innerHTML=S.categories.map(function(c){
    return '<button class="chip" data-id="'+c.id+'"><span class="catdot" style="background:'+c.color+'"></span>'+esc(c.name)+'</button>';
  }).join('');
  openSheet('sheet-bulkcat');
});
$('#bc-cats').addEventListener('click',function(e){
  var b=e.target.closest('.chip');if(!b)return;
  var cid=b.getAttribute('data-id'),n=0;
  S.entries.forEach(function(en){if(sel.set[en.id]){en.categoryId=cid;n++;}});
  save();closeSheet('sheet-bulkcat');
  toast(n+' moved to '+catById(cid).name);
  exitSel();renderBook();
});
$('#sel-del').addEventListener('click',function(){
  if(!lockGate())return;
  var n=selCount();
  confirmDlg({title:'Delete '+n+' '+(n===1?'entry':'entries')+'?',msg:'They move to Trash and stay recoverable for 30 days.',okLabel:'Delete',danger:true}).then(function(ok){
    if(!ok)return;
    var moved=[];
    S.entries=S.entries.filter(function(e){
      if(sel.set[e.id]){moved.push(e);S.trash.push({e:e,at:Date.now()});return false;}
      return true;
    });
    save();exitSel();refreshData();buzz();
    snack(moved.length+' moved to Trash',function(){
      moved.forEach(function(e){S.entries.push(e);S.trash=S.trash.filter(function(t){return t.e.id!==e.id;});});
      save();refreshData();toast('Restored');
    });
  });
});
$('#quickbar').addEventListener('click',function(e){
  if(!lockGate())return;
  var x=e.target.closest('[data-del]');
  if(x){
    var did=x.getAttribute('data-del');
    S.templates=S.templates.filter(function(t){return t.id!==did;});
    save();renderQuickbar();toast('Quick add removed');buzz();
    return;
  }
  var b=e.target.closest('.qchip');if(!b)return;
  var tid=b.getAttribute('data-tid'),t=null;
  S.templates.forEach(function(x){if(x.id===tid)t=x;});
  if(t)openEntrySheet({template:t,book:currentBook});
});

/* ============ entry sheet ============ */
var entEditing=null,entDup=false,entType='in',entCat='other',entMode='Cash',entParty='',entAttach=null,entBook='';
function openEntrySheet(opts){
  if(!lockGate())return;
  opts=opts||{};
  var e=opts.entry||null,t=opts.template||null;
  entEditing=(e&&!opts.duplicate)?e.id:null;
  entDup=!!opts.duplicate;
  entType=e?e.type:(t?t.type:(opts.type||'in'));
  entCat=e?e.categoryId:(t?t.categoryId:'other');
  entMode=e?e.mode:(t?t.mode:'Cash');
  entParty=e?(e.partyId||''):(t?(t.partyId||''):(opts.party||''));
  entAttach=(e&&!entDup&&e.attach)?e.attach:null;
  entBook=e?e.bookId:(t?t.bookId:(opts.book||S.settings.lastBook||''));
  if(!bookById(entBook)&&S.books.length)entBook=S.books[0].id;
  $('#ent-title').textContent=entEditing?'Edit entry':(entDup?'Duplicate entry':(t?'Quick add':(entType==='in'?'New cash in':'New cash out')));
  $('#ent-save').textContent=entEditing?'Save changes':'Save entry';
  $('#ent-save-new').classList.toggle('hidden',!!entEditing);
  $('#ent-cur').textContent=curSym();
  $('#ent-amount').value=e?(e.amount/100):(t&&t.amount?(t.amount/100):'');
  $('#ent-calc').textContent='';
  $('#ent-amount-err').classList.add('hidden');
  $('#ent-note-err').classList.add('hidden');
  var when=(e&&!entDup)?new Date(e.ts):new Date();
  $('#ent-date').value=dateInputVal(when);
  $('#ent-time').value=timeInputVal(when);
  $('#ent-note').value=e?(e.note||''):(t?(t.note||''):(opts.noteDefault||''));
  paintEntFlood();paintEntMode();renderEntSelects();renderNoteChips();paintAttach();
  openSheet('sheet-entry');
  focusAfterOpen('sheet-entry','#ent-amount');
}
function paintEntFlood(){
  var sh=$('#sheet-entry');
  sh.classList.toggle('t-in',entType==='in');
  sh.classList.toggle('t-out',entType==='out');
  $$('#ent-type button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-t')===entType);});
  $('#ent-save').className='btn big '+(entType==='in'?'in':'out');
}
function paintEntMode(){
  $$('#ent-mode button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-m')===entMode);});
  var cash=entMode==='Cash';
  $('#ent-route').innerHTML='<span class="mdot '+(cash?'cash':'bank')+'"></span><span style="color:var(--muted)">Goes to \u2192 '+(cash?'Cash in hand':'Bank account')+'</span>';
}
function renderEntSelects(){
  var bsel=$('#ent-book'),cta=$('#ent-book-cta');
  if(!S.books.length){
    bsel.classList.add('hidden');cta.classList.remove('hidden');
  }else{
    bsel.classList.remove('hidden');cta.classList.add('hidden');
    if(!bookById(entBook))entBook=bookById(S.settings.lastBook)?S.settings.lastBook:S.books[0].id;
    bsel.innerHTML=S.books.map(function(b){return '<option value="'+b.id+'"'+(b.id===entBook?' selected':'')+'>'+esc(b.name)+'</option>';}).join('');
  }
  $('#ent-party-sel').innerHTML='<option value=""'+(entParty===''?' selected':'')+'>No party</option>'+
    S.parties.map(function(p){return '<option value="'+p.id+'"'+(p.id===entParty?' selected':'')+'>'+esc(p.name)+'</option>';}).join('')+
    '<option value="__new">\uFF0B Add new party\u2026</option>';
  $('#ent-cat-sel').innerHTML=S.categories.map(function(c){return '<option value="'+c.id+'"'+(c.id===entCat?' selected':'')+'>'+esc(c.name)+'</option>';}).join('')+
    '<option value="__new">\uFF0B Add new category\u2026</option>';
  $('#ent-mode-field').classList.toggle('hidden',!isCashBook(entBook));
  if(typeof syncControls==='function')syncControls($('#sheet-entry'));
}
function renderNoteChips(){
  var box=$('#ent-note-chips');
  var list=bookById(entBook)?noteSuggestions(entBook,entType):[];
  if(!list.length){box.classList.add('hidden');box.innerHTML='';return;}
  box.classList.remove('hidden');
  box.innerHTML=list.map(function(n){return '<button class="chip" data-n="'+esc(n)+'">'+esc(n)+'</button>';}).join('');
}
$('#ent-note-chips').addEventListener('click',function(e){
  var b=e.target.closest('.chip');if(!b)return;
  $('#ent-note').value=b.getAttribute('data-n');
  $('#ent-note-err').classList.add('hidden');
});
$('#ent-type').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;entType=b.getAttribute('data-t');paintEntFlood();renderNoteChips();});
$('#ent-mode').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;entMode=b.getAttribute('data-m');paintEntMode();});
$('#ent-book').addEventListener('change',function(){entBook=this.value;renderNoteChips();$('#ent-mode-field').classList.toggle('hidden',!isCashBook(entBook));});
$('#ent-book-cta').addEventListener('click',function(){openBookSheet(null,true);});
$('#ent-party-sel').addEventListener('change',function(){
  if(this.value==='__new'){this.value=entParty;openPartySheet(null,true);return;}
  entParty=this.value;
});
$('#ent-cat-sel').addEventListener('change',function(){
  if(this.value==='__new'){this.value=entCat;openCatSheet(null,true);return;}
  entCat=this.value;
});
$('#ent-amount').addEventListener('input',function(){
  var s=this.value;
  $('#ent-amount-err').classList.add('hidden');
  if(/[+\-*/()]/.test(s)){
    var v=calcEval(s);
    $('#ent-calc').textContent=(v!==null&&v>0)?'= '+curSym()+' '+nfmt(Math.round(v*100)):'';
  }else $('#ent-calc').textContent='';
});
$('#ent-note').addEventListener('input',function(){$('#ent-note-err').classList.add('hidden');});
$('#btn-ent-photo').addEventListener('click',function(){$('#ent-photo').click();});
$('#ent-attach-x').addEventListener('click',function(){entAttach=null;paintAttach();});
$('#ent-attach-img').addEventListener('click',function(){showViewer(entAttach);});
$('#ent-photo').addEventListener('change',function(){
  var f=this.files[0];this.value='';
  if(!f)return;
  compressImage(f,function(dataUrl){
    if(!dataUrl)return;
    entAttach=dataUrl;paintAttach();
  });
});
function paintAttach(){
  var has=!!entAttach;
  $('#ent-attach-wrap').classList.toggle('hidden',!has);
  if(has)$('#ent-attach-img').src=entAttach;
  $('#btn-ent-photo').innerHTML='<svg class="ic"><use href="#i-camera"/></svg>'+(has?'Replace photo':'Add photo');
}
function compressImage(file,cb){
  var rd=new FileReader();
  rd.onerror=function(){toast('Couldn\u2019t read that image');cb(null);};
  rd.onload=function(){
    var img=new Image();
    img.onerror=function(){toast('Couldn\u2019t read that image');cb(null);};
    img.onload=function(){
      function pass(maxSide,q){
        var w=img.width,h=img.height,sc=Math.min(1,maxSide/Math.max(w,h));
        var cv=document.createElement('canvas');
        cv.width=Math.max(1,Math.round(w*sc));cv.height=Math.max(1,Math.round(h*sc));
        cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
        return cv.toDataURL('image/jpeg',q);
      }
      var out=pass(900,0.55);
      if(out.length>420000)out=pass(680,0.42);
      if(out.length>520000){toast('That photo is too detailed to store \u2014 try a smaller one');cb(null);return;}
      cb(out);
    };
    img.src=rd.result;
  };
  rd.readAsDataURL(file);
}
function saveEntry(keepOpen){
  var v=entryValid($('#ent-amount').value,$('#ent-note').value);
  if(v.cents===null){$('#ent-amount-err').classList.remove('hidden');$('#ent-amount').focus();return;}
  if(!v.noteOk){$('#ent-note-err').classList.remove('hidden');$('#ent-note').focus();return;}
  if(!bookById(entBook)){toast('Pick a book first');return;}
  var d=$('#ent-date').value,t=$('#ent-time').value,ts;
  if(d){var dp=d.split('-'),tp=(t||'00:00').split(':');ts=new Date(+dp[0],+dp[1]-1,+dp[2],+tp[0]||0,+tp[1]||0).getTime();}
  else ts=Date.now();
  var note=$('#ent-note').value.trim(),msg,rollback=null;
  if(entEditing){
    var e=entryById(entEditing);if(!e)return;
    var before=JSON.parse(JSON.stringify(e));
    rollback=function(){for(var k in e)delete e[k];for(var k2 in before)e[k2]=before[k2];};
    e.bookId=entBook;e.type=entType;e.amount=v.cents;e.categoryId=entCat;e.mode=entMode;e.note=note;e.ts=ts;
    if(entParty)e.partyId=entParty;else delete e.partyId;
    if(entAttach)e.attach=entAttach;else delete e.attach;
    msg='Entry updated';
  }else{
    var ne={id:uid('e'),bookId:entBook,type:entType,amount:v.cents,categoryId:entCat,mode:entMode,note:note,ts:ts,created:Date.now()};
    if(entParty)ne.partyId=entParty;
    if(entAttach)ne.attach=entAttach;
    S.entries.push(ne);
    rollback=function(){S.entries.pop();};
    msg=entDup?'Entry duplicated':'Entry saved';
  }
  S.settings.lastBook=entBook;
  if(!save()){
    rollback();save();
    toast('Storage is full \u2014 remove the photo or clear old data');
    return;
  }
  buzz();
  if(!entEditing)celebrate(entType);
  if(keepOpen&&!entEditing){
    entAttach=null;paintAttach();
    $('#ent-amount').value='';$('#ent-note').value='';$('#ent-calc').textContent='';
    refreshData();renderNoteChips();toast(msg);
    $('#ent-amount').focus();
    return;
  }
  closeSheet('sheet-entry');
  refreshData();toast(msg);
}
$('#ent-save').addEventListener('click',function(){saveEntry(false);});
$('#ent-save-new').addEventListener('click',function(){saveEntry(true);});
$('#ent-counter').addEventListener('click',function(){openDenoms(true);});
$('#btn-cash-in').addEventListener('click',function(){openEntrySheet({type:'in',book:currentBook});});
$('#btn-cash-out').addEventListener('click',function(){openEntrySheet({type:'out',book:currentBook});});
$('#btn-empty-in').addEventListener('click',function(){openEntrySheet({type:'in',book:currentBook});});
$('#fab-entry').addEventListener('click',function(){openEntrySheet({});});
$('#btn-ent-quick').addEventListener('click',function(){
  if(!bookById(entBook)){toast('Pick a book first');return;}
  var mine=S.templates.filter(function(t){return t.bookId===entBook;});
  if(mine.length>=8){toast('Quick add is full (8 max) \u2014 long-press one to remove it');return;}
  var t={id:uid('t'),bookId:entBook,type:entType,categoryId:entCat,mode:entMode,note:$('#ent-note').value.trim()};
  var c=parseAmt($('#ent-amount').value);if(c)t.amount=c;
  if(entParty)t.partyId=entParty;
  S.templates.push(t);save();
  if(currentBook===entBook)renderQuickbar();
  toast('Added to quick add');buzz();
});

/* ============ cash counter ============ */
function denomSet(){
  var c=curSym();
  if(c==='₹')return[500,200,100,50,20,10,5,2,1];
  if(c==='₨')return[5000,1000,500,100,50,20,10,5,2,1];
  return[100,50,20,10,5,2,1];
}
function openDenoms(forEntry){
  $('#dn-use').classList.toggle('hidden',!forEntry);
  $('#dn-list').innerHTML=denomSet().map(function(v){
    return '<div class="dnrow"><span class="dl">'+esc(curSym())+' '+v+'</span><input type="number" inputmode="numeric" min="0" data-v="'+v+'" placeholder="0"><span class="da" data-a="'+v+'"></span></div>';
  }).join('');
  updateDenoms();
  openSheet('sheet-denoms');
}
function updateDenoms(){
  var total=0;
  $$('#dn-list input').forEach(function(inp){
    var v=+inp.getAttribute('data-v'),n=Math.max(0,Math.floor(+inp.value||0));
    var amt=v*n*100;total+=amt;
    $('#dn-list [data-a="'+v+'"]').textContent=n?nfmt(amt):'';
  });
  $('#dn-total').textContent=money(total);
  $('#dn-total').setAttribute('data-cents',total);
}
$('#dn-list').addEventListener('input',updateDenoms);
$('#dn-clear').addEventListener('click',function(){$$('#dn-list input').forEach(function(i){i.value='';});updateDenoms();});
$('#dn-use').addEventListener('click',function(){
  var c=+$('#dn-total').getAttribute('data-cents')||0;
  if(!c){toast('Count some notes first');return;}
  $('#ent-amount').value=(c/100);
  $('#ent-calc').textContent='';
  closeSheet('sheet-denoms');
});

/* ============ detail, viewer, trash ============ */
var detId=null;
function openDetail(id){
  var e=entryById(id);if(!e)return;
  detId=id;
  var c=catById(e.categoryId),b=bookById(e.bookId);
  /* v6: balance after entry (true book running balance) shown in the details card */
  var run=runningMap(e.bookId),balAfter=run[e.id];
  var rows='<div class="drow"><span>Category</span><b><span class="catdot" style="background:'+(c.color||hashColor(c.id))+';margin-right:7px"></span>'+esc(c.name)+'</b></div>'+
    drow('Paid via',(e.mode==='Cash'?'Cash in hand':'Bank account')+' ('+e.mode+')')+
    drow('Date & time',fmtDate(e.ts)+' \u00B7 '+fmtTime(e.ts))+
    drow('Book',b?b.name:'?')+
    (e.partyId&&partyById(e.partyId)?drow('Party',partyById(e.partyId).name):'')+
    (e.auto?drow('Posted by','Recurring rule'):'')+
    (balAfter!==undefined?drow('Balance after entry',money(balAfter)):'');
  $('#det-body').innerHTML='<div style="text-align:center"><span class="det-badge '+e.type+'">'+(e.type==='in'?'CASH IN':'CASH OUT')+'</span></div>'+
    '<div class="det-amt '+e.type+'">'+moneySigned(e.amount,e.type)+'</div>'+
    '<div class="det-words">'+esc(amtWords(e.amount))+'</div>'+
    '<div class="card detcard">'+rows+'</div>'+
    '<div class="notecard detnote"><div class="nchead"><svg class="ic"><use href="#i-edit"/></svg><span>Note</span></div><div class="detnotetext">'+(e.note?esc(e.note):'<span style="color:var(--faint)">No note</span>')+'</div></div>'+
    (e.attach?'<img class="detimg" id="det-img" src="'+e.attach+'" alt="Receipt">':'');
  openSheet('sheet-detail');
  if(e.attach)$('#det-img').addEventListener('click',function(){showViewer(e.attach);});
}
function drow(l,v){return '<div class="drow"><span>'+esc(l)+'</span><b>'+esc(v)+'</b></div>';}
function showViewer(src){if(!src)return;$('#viewer-img').src=src;$('#viewer').classList.add('show');}
$('#viewer').addEventListener('click',function(e){if(e.target.id!=='viewer-img')$('#viewer').classList.remove('show');});
$('#viewer-x').addEventListener('click',function(){$('#viewer').classList.remove('show');});
/* ============ NATIVE PLATFORM BRIDGE (APK via Capacitor · web fallback) ============ */
/* One code path for both the PWA (browser) and the APK (Android WebView).
   In the APK, window.Capacitor.Plugins.{Share,Filesystem,Clipboard} exist and
   bridge to real Android intents/storage. In the browser we fall back to web APIs. */
var IS_NATIVE=!!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform());
function capPlugin(n){return (window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins[n])?window.Capacitor.Plugins[n]:null;}
function b64FromBytes(bytes){var bin='',chunk=0x8000;for(var i=0;i<bytes.length;i+=chunk)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));return btoa(bin);}
function b64FromLatin1(str){var b=new Uint8Array(str.length);for(var i=0;i<str.length;i++)b[i]=str.charCodeAt(i)&0xff;return b64FromBytes(b);}
function b64FromText(str){return b64FromBytes(new TextEncoder().encode(str));}
function b64FromDataURL(u){return u.substring(u.indexOf(',')+1);}
/* write a file natively then Save (to Documents) or Share (via the OS sheet). Returns a promise<bool>. */
function nativeFile(base64,filename,mime,mode){
  var FS=capPlugin('Filesystem'),SH=capPlugin('Share');
  if(mode==='share'&&FS&&SH){
    return FS.writeFile({path:filename,data:base64,directory:'CACHE'}).then(function(w){
      return SH.share({title:filename,url:w.uri,dialogTitle:'Share or save'}).then(function(){return true;},function(){return true;});
    });
  }
  if(mode==='save'&&FS){
    return FS.writeFile({path:filename,data:base64,directory:'DOCUMENTS',recursive:true}).then(function(){
      toast('Saved to Documents');return true;
    },function(){
      if(SH)return FS.writeFile({path:filename,data:base64,directory:'CACHE'}).then(function(w){return SH.share({title:filename,url:w.uri,dialogTitle:'Save or share'}).then(function(){return true;},function(){return true;});});
      toast('Couldn\u2019t save the file');return false;
    });
  }
  return Promise.resolve(false);
}
function webDownloadBlob(blob,filename){
  var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},400);
}
/* ============ in-app update check (direct APK channel only; Play updates itself) ============ */
var APP_VERSION="6.1.1";
var UPDATE_URL="https://husainstudios.github.io/cashbook/version.json";
function verCmp(a,b){var pa=String(a).split('.').map(Number),pb=String(b).split('.').map(Number);for(var i=0;i<3;i++){if((pa[i]||0)>(pb[i]||0))return 1;if((pa[i]||0)<(pb[i]||0))return -1;}return 0;}
function checkForUpdate(){
  if(!IS_NATIVE||LIC_CHANNEL==='play')return;
  var last=+localStorage.getItem('cashbook.updchk')||0;
  if(Date.now()-last<6*3600000)return;
  try{fetch(UPDATE_URL,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
    localStorage.setItem('cashbook.updchk',String(Date.now()));
    if(j&&j.version&&verCmp(j.version,APP_VERSION)>0)showUpdateBanner(j);
  }).catch(function(){});}catch(e){}
}
function showUpdateBanner(j){
  if($('#upd-banner'))return;
  var b=document.createElement('div');b.id='upd-banner';b.className='upd-banner';
  b.innerHTML='<span>New version '+esc(j.version)+' available'+(j.notes?' \u00b7 '+esc(j.notes):'')+'</span><b>Update</b>';
  b.querySelector('b').addEventListener('click',function(){window.open(j.apkUrl||UPDATE_URL,'_blank');});
  document.body.appendChild(b);
}

function shareText(text){
  if(!lockGate())return;
  if(IS_NATIVE){
    var SH=capPlugin('Share'),CB=capPlugin('Clipboard');
    if(CB)CB.write({string:text}).catch(function(){});
    if(SH){SH.share({text:text,dialogTitle:'Share'}).catch(function(){});return;}
  }
  if(navigator.share){navigator.share({text:text}).catch(function(){});return;}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){toast('Copied to clipboard');},function(){toast('Couldn\u2019t copy');});
  }else toast('Sharing isn\u2019t available here');
}
function entryText(e){
  var b=bookById(e.bookId),c=catById(e.categoryId);
  var lines=[(b?b.name:'Cashbook')+' \u2014 '+(e.type==='in'?'Cash in':'Cash out'),
    moneySigned(e.amount,e.type)+' ('+amtWords(e.amount)+')',
    (e.note?'Note: '+e.note:''),
    c.name+' \u00B7 '+e.mode+' \u00B7 '+fmtDate(e.ts)+' '+fmtTime(e.ts)];
  if(e.partyId&&partyById(e.partyId))lines.push('Party: '+partyById(e.partyId).name);
  return lines.filter(Boolean).join('\n');
}
$('#det-share').addEventListener('click',function(){
  var e=entryById(detId);if(!e)return;
  shareCanvas(buildEntryCard(e),'entry-'+dayKeyOf(e.ts)+'.png','Cashbook entry');
});
$('#det-copy').addEventListener('click',function(){
  var e=entryById(detId);if(!e)return;
  shareText(entryText(e));
});
$('#det-edit').addEventListener('click',function(){var e=entryById(detId);if(!e)return;closeSheet('sheet-detail');openEntrySheet({entry:e});});
$('#det-dup').addEventListener('click',function(){var e=entryById(detId);if(!e)return;closeSheet('sheet-detail');openEntrySheet({entry:e,duplicate:true});});
$('#det-del').addEventListener('click',function(){
  if(!lockGate())return;
  var id=detId;
  confirmDlg({title:'Delete entry?',msg:'It moves to Trash and stays recoverable for 30 days.',okLabel:'Delete',danger:true}).then(function(ok){
    if(!ok)return;
    closeSheet('sheet-detail');
    swipeDelete(id);
    refreshData();
  });
});
function purgeTrash(){
  var cut=Date.now()-30*86400000,before=S.trash.length;
  S.trash=S.trash.filter(function(t){return t.at>=cut;});
  if(S.trash.length!==before)save();
}
function renderTrash(){
  var list=$('#trash-list'),empty=$('#trash-empty');
  if(!S.trash.length){list.classList.add('hidden');list.innerHTML='';empty.classList.remove('hidden');$('#btn-trash-clear').classList.add('hidden');return;}
  empty.classList.add('hidden');list.classList.remove('hidden');$('#btn-trash-clear').classList.remove('hidden');
  var items=S.trash.slice().sort(function(a,b){return b.at-a.at;});
  list.innerHTML=items.map(function(t){
    var e=t.e,c=catById(e.categoryId),b=bookById(e.bookId);
    var daysLeft=Math.max(0,Math.ceil((t.at+30*86400000-Date.now())/86400000));
    return '<div class="srow"><div class="eic" style="width:36px;height:36px;font-size:16px;border-radius:10px;background:'+c.color+'22;color:'+c.color+'"><span class="catdot big" style="background:'+c.color+'"></span></div>'+
      '<span class="sl">'+(e.note?esc(e.note):esc(c.name))+'<br><span style="font-size:12px;color:var(--faint)">'+esc(b?b.name:'?')+' \u00B7 '+fmtDate(e.ts)+' \u00B7 '+daysLeft+'d left</span></span>'+
      '<span class="eamt '+e.type+'" style="font-size:13.5px">'+moneySigned(e.amount,e.type)+'</span>'+
      '<button class="iconbtn" data-restore="'+e.id+'" aria-label="Restore"><svg class="ic"><use href="#i-restore"/></svg></button>'+
      '<button class="iconbtn" data-kill="'+e.id+'" aria-label="Delete forever"><svg class="ic" style="color:var(--out)"><use href="#i-x"/></svg></button></div>';
  }).join('');
}
$('#trash-list').addEventListener('click',function(e){
  var r=e.target.closest('[data-restore]');
  if(r){
    var id=r.getAttribute('data-restore'),item=null;
    S.trash=S.trash.filter(function(t){if(t.e.id===id){item=t;return false;}return true;});
    if(item){S.entries.push(item.e);save();renderTrash();toast('Entry restored');}
    return;
  }
  var k=e.target.closest('[data-kill]');
  if(k){
    var id2=k.getAttribute('data-kill');
    confirmDlg({title:'Delete forever?',msg:'This entry cannot be recovered afterwards.',okLabel:'Delete forever',danger:true}).then(function(ok){
      if(!ok)return;
      S.trash=S.trash.filter(function(t){return t.e.id!==id2;});
      save();renderTrash();toast('Deleted forever');
    });
  }
});
$('#btn-trash-clear').addEventListener('click',function(){
  var n=S.trash.length;if(!n)return;
  confirmDlg({title:'Empty trash?',msg:n+' '+(n===1?'entry':'entries')+' will be gone for good.',okLabel:'Empty trash',danger:true}).then(function(ok){
    if(!ok)return;S.trash=[];save();renderTrash();toast('Trash emptied');
  });
});
$('#btn-trash-back').addEventListener('click',function(){goBack('view-trash');});
$('#row-trash').addEventListener('click',function(){renderTrash();goView('view-trash','view-settings');});

/* ============ analytics: generic builders ============ */
function sumIn(es,r){var tin=0,tout=0,n=0;es.forEach(function(e){if(e.ts>=r[0]&&e.ts<r[1]){n++;if(e.type==='in')tin+=e.amount;else tout+=e.amount;}});return{tin:tin,tout:tout,n:n};}
function deltaHTML(cur,prev,goodUp){
  if(!prev){return cur?'<span class="neu">new</span>':'<span class="neu">\u2014</span>';}
  var pct=Math.round((cur-prev)/prev*100);
  if(pct===0)return '<span class="neu">\u00B1 0% vs prev</span>';
  var up=pct>0,good=up===goodUp;
  return '<span class="'+(good?'up':'down')+'">'+(up?'\u25B2':'\u25BC')+' '+Math.abs(pct)+'% vs prev</span>';
}
function catAgg(es,type){
  var sums={},total=0;
  es.forEach(function(e){if(e.type!==type)return;sums[e.categoryId]=(sums[e.categoryId]||0)+e.amount;total+=e.amount;});
  var arr=Object.keys(sums).map(function(id){return{c:catById(id),v:sums[id]};}).sort(function(a,b){return b.v-a.v;});
  return{arr:arr,total:total};
}
function donutHTML(es,type){
  var ag=catAgg(es,type),arr=ag.arr,total=ag.total;
  if(!total)return '<div class="chart-empty">No cash '+type+' in this period</div>';
  if(arr.length>6){
    var rest=arr.slice(5),rv=0;rest.forEach(function(x){rv+=x.v;});
    arr=arr.slice(0,5);arr.push({c:{name:'Others',emoji:'',color:'#98A6B5'},v:rv});
  }
  var R=54,CX=80,CY=80,C=2*Math.PI*R,off=0,segs='';
  arr.forEach(function(s){
    var len=s.v/total*C,draw=len>3?len-2:len;
    segs+='<circle cx="'+CX+'" cy="'+CY+'" r="'+R+'" fill="none" stroke="'+s.c.color+'" stroke-width="22" stroke-dasharray="'+draw.toFixed(2)+' '+(C-draw).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'" transform="rotate(-90 '+CX+' '+CY+')"/>';
    off+=len;
  });
  var svg='<svg viewBox="0 0 160 160" role="img" aria-label="Category breakdown">'+segs+
    '<text x="80" y="75" text-anchor="middle" style="font-size:9.5px;letter-spacing:.12em;fill:var(--muted)">'+(type==='out'?'SPENT':'RECEIVED')+'</text>'+
    '<text x="80" y="93" text-anchor="middle" style="font-size:14px;font-weight:700;fill:var(--ink)">'+esc(curSym()+' '+compact(total))+'</text></svg>';
  var legend='<div class="legend">'+arr.map(function(s){
    var pct=Math.round(s.v/total*100);
    return '<div class="lrow"><span class="sw" style="background:'+s.c.color+'"></span><span class="ln">'+esc(s.c.name)+'</span><span class="lv">'+money(s.v)+' \u00B7 '+pct+'%</span></div>';
  }).join('')+'</div>';
  return '<div class="chart donutbox">'+svg+'</div>'+legend;
}
function modesHTML(es,type){
  var sums={},total=0;
  es.forEach(function(e){if(e.type!==type)return;sums[e.mode]=(sums[e.mode]||0)+e.amount;total+=e.amount;});
  if(!total)return '<div class="chart-empty">No cash '+type+' in this period</div>';
  return MODES.filter(function(m){return sums[m];}).map(function(m){
    var v=sums[m],pct=Math.round(v/total*100);
    var lbl=m==='Cash'?'Cash':'Bank';
    return '<div class="mrow"><span class="mn"><span class="mdot '+(m==='Cash'?'cash':'bank')+'"></span>'+lbl+'</span><div class="mtrack"><div class="mfill" style="width:'+pct+'%;background:'+(m==='Cash'?'var(--in)':'#3E7CC4')+'"></div></div><span class="mv">'+money(v)+' \u00B7 '+pct+'%</span></div>';
  }).join('');
}
function buildBuckets(r,p){
  var a=new Date(r[0]),b=new Date(r[1]);
  var days=Math.round((r[1]-r[0])/86400000);
  var list=[],d,e2,nm;
  var unit=(p==='year'||days>140)?'month':(days>35?'week':'day');
  if(unit==='day'){for(d=new Date(a);d<b;d=addDays(d,1))list.push({start:d.getTime(),end:addDays(d,1).getTime(),label:String(d.getDate())});}
  else if(unit==='week'){d=new Date(a);while(d<b){e2=addDays(d,7);if(e2>b)e2=b;list.push({start:d.getTime(),end:e2.getTime(),label:pad(d.getDate())+'/'+pad(d.getMonth()+1)});d=new Date(e2);}}
  else{d=new Date(a);while(d<b){nm=new Date(d.getFullYear(),d.getMonth()+1,1);e2=nm<b?nm:b;list.push({start:d.getTime(),end:e2.getTime(),label:d.toLocaleDateString([],{month:'short'})});d=new Date(e2);}}
  return list;
}
function bucketData(es,bk){
  return bk.map(function(b){
    var tin=0,tout=0;
    es.forEach(function(e){if(e.ts>=b.start&&e.ts<b.end){if(e.type==='in')tin+=e.amount;else tout+=e.amount;}});
    return{tin:tin,tout:tout,label:b.label};
  });
}
function barsHTML(es,r,p){
  var data=bucketData(es,buildBuckets(r,p));
  var max=0;data.forEach(function(d){max=Math.max(max,d.tin,d.tout);});
  if(!max)return '<div class="chart-empty">Nothing in this period</div>';
  var W=640,H=230,PL=8,PR=8,PT=16,PB=26,plotH=H-PT-PB,base=H-PB;
  var cw=(W-PL-PR)/data.length,bw=Math.min(16,Math.max(2.5,cw*0.32)),s='';
  [0,0.5,1].forEach(function(f){
    var y=PT+(1-f)*plotH;
    s+='<line x1="'+PL+'" y1="'+y.toFixed(1)+'" x2="'+(W-PR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1"/>';
    if(f>0)s+='<text x="'+(W-PR)+'" y="'+(y-5).toFixed(1)+'" text-anchor="end" style="font-size:10px;fill:var(--faint)">'+esc(compact(max*f))+'</text>';
  });
  var labelEvery=Math.max(1,Math.ceil(data.length/8));
  data.forEach(function(d,i){
    var cx=PL+cw*i+cw/2;
    if(d.tin){var hIn=Math.max(d.tin/max*plotH,2);
      s+='<rect x="'+(cx-bw-1).toFixed(1)+'" y="'+(base-hIn).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+hIn.toFixed(1)+'" rx="'+Math.min(3,bw/2).toFixed(1)+'" fill="var(--in)"/>';}
    if(d.tout){var hOut=Math.max(d.tout/max*plotH,2);
      s+='<rect x="'+(cx+1).toFixed(1)+'" y="'+(base-hOut).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+hOut.toFixed(1)+'" rx="'+Math.min(3,bw/2).toFixed(1)+'" fill="var(--out)"/>';}
    if(i%labelEvery===0)s+='<text x="'+cx.toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" style="font-size:10px;fill:var(--faint)">'+esc(d.label)+'</text>';
  });
  return '<div class="chart"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="In versus out over time">'+s+'</svg></div>'+
    '<div class="legend hleg"><span class="lrow"><span class="sw" style="background:var(--in)"></span>Cash in</span><span class="lrow"><span class="sw" style="background:var(--out)"></span>Cash out</span></div>';
}
function lineHTML(es,r,opening,p){
  var bk=buildBuckets(r,p);
  if(!bk.length)return '<div class="chart-empty">Nothing in this period</div>';
  var pts=[],bal=opening;
  bk.forEach(function(b){
    es.forEach(function(e){if(e.ts>=b.start&&e.ts<b.end)bal+=signed(e);});
    pts.push(bal);
  });
  var series=[opening].concat(pts),mn=series[0],mx=series[0];
  series.forEach(function(v){mn=Math.min(mn,v);mx=Math.max(mx,v);});
  if(mn===mx){mn-=100;mx+=100;}
  var padv=(mx-mn)*0.1;mn-=padv;mx+=padv;
  var W=640,H=210,PL=8,PR=8,PT=14,PB=24,n=series.length-1;
  function xAt(i){return PL+(W-PL-PR)*i/n;}
  function yAt(v){return PT+(1-(v-mn)/(mx-mn))*(H-PT-PB);}
  var dLine='',i;
  for(i=0;i<series.length;i++)dLine+=(i?'L':'M')+xAt(i).toFixed(1)+' '+yAt(series[i]).toFixed(1)+' ';
  var dArea=dLine+'L'+xAt(n).toFixed(1)+' '+(H-PB)+' L'+xAt(0).toFixed(1)+' '+(H-PB)+' Z';
  var s='';
  [mn+padv,mx-padv].forEach(function(v,k){
    var y=yAt(v);
    s+='<line x1="'+PL+'" y1="'+y.toFixed(1)+'" x2="'+(W-PR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1"/>'+
      '<text x="'+PL+'" y="'+(k===0?y-5:y+13).toFixed(1)+'" style="font-size:10px;fill:var(--faint)">'+esc(compact(v))+'</text>';
  });
  if(mn<0&&mx>0){var zy=yAt(0);s+='<line x1="'+PL+'" y1="'+zy.toFixed(1)+'" x2="'+(W-PR)+'" y2="'+zy.toFixed(1)+'" stroke="var(--line-strong)" stroke-width="1" stroke-dasharray="4 4"/>';}
  var endV=series[series.length-1];
  s+='<path d="'+dArea+'" fill="var(--brand)" opacity="0.12"/>'+
    '<path d="'+dLine+'" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'+
    '<circle cx="'+xAt(n).toFixed(1)+'" cy="'+yAt(endV).toFixed(1)+'" r="4.5" fill="var(--brand)"/>'+
    '<text x="'+(W-PR-2)+'" y="'+Math.max(yAt(endV)-10,11).toFixed(1)+'" text-anchor="end" style="font-size:11px;font-weight:700;fill:var(--ink)">'+esc(curSym()+' '+compact(endV))+'</text>'+
    '<text x="'+PL+'" y="'+(H-7)+'" style="font-size:10px;fill:var(--faint)">'+esc(fmtDate(r[0]))+'</text>'+
    '<text x="'+(W-PR)+'" y="'+(H-7)+'" text-anchor="end" style="font-size:10px;fill:var(--faint)">'+esc(fmtDate(r[1]-1))+'</text>';
  return '<div class="chart"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Balance over time">'+s+'</svg></div>';
}
function insightsData(es,r){
  var days=Math.max(1,Math.round((Math.min(r[1],Date.now()+1)-r[0])/86400000));
  var tin=0,tout=0,bigIn=null,bigOut=null,wk={};
  es.forEach(function(e){
    if(e.type==='in'){tin+=e.amount;if(!bigIn||e.amount>bigIn.amount)bigIn=e;}
    else{tout+=e.amount;if(!bigOut||e.amount>bigOut.amount)bigOut=e;}
    var w=new Date(e.ts).getDay();wk[w]=(wk[w]||0)+1;
  });
  var busiest=null,bn=0;
  Object.keys(wk).forEach(function(k){if(wk[k]>bn){bn=wk[k];busiest=+k;}});
  return{days:days,tin:tin,tout:tout,bigIn:bigIn,bigOut:bigOut,busiest:busiest,bn:bn};
}
function insightsHTML(es,r){
  if(!es.length)return '<div class="chart-empty">Nothing in this period</div>';
  var d=insightsData(es,r);
  var wd=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var html='<div class="irow"><span>Average per day</span><b><span style="color:var(--in)">+'+nfmt(Math.round(d.tin/d.days))+'</span> \u00B7 <span style="color:var(--out)">\u2212'+nfmt(Math.round(d.tout/d.days))+'</span></b></div>';
  if(d.bigIn)html+='<button class="irow" data-eid="'+d.bigIn.id+'"><span>Biggest cash in</span><b style="color:var(--in)">+'+nfmt(d.bigIn.amount)+' \u00B7 '+esc(d.bigIn.note||catById(d.bigIn.categoryId).name)+'</b></button>';
  if(d.bigOut)html+='<button class="irow" data-eid="'+d.bigOut.id+'"><span>Biggest cash out</span><b style="color:var(--out)">\u2212'+nfmt(d.bigOut.amount)+' \u00B7 '+esc(d.bigOut.note||catById(d.bigOut.categoryId).name)+'</b></button>';
  if(d.busiest!==null)html+='<div class="irow"><span>Busiest day</span><b>'+wd[d.busiest]+' \u00B7 '+d.bn+' entries</b></div>';
  return html;
}
function budgetRowsHTML(buds,withBook){
  return buds.map(function(x){
    var pct=Math.round(x.pct*100),w=Math.min(100,pct);
    var col=x.pct>=1?'var(--out)':(x.pct>=0.8?'var(--amber)':'var(--brand)');
    var name=x.c.name+(withBook&&x.book?' \u00B7 '+x.book.name:'');
    return '<div class="budrow"><div class="budtop"><span>'+esc(name)+'</span><b class="'+(x.pct>=1?'over':'')+'">'+nfmt(x.sp)+' / '+nfmt(x.b.amount)+' \u00B7 '+pct+'%</b></div>'+
      '<div class="mtrack"><div class="mfill" style="width:'+w+'%;background:'+col+'"></div></div></div>';
  }).join('');
}

/* ============ book analytics range (kept: PDF analytics export uses A + anRange) ============ */
function anRange(){
  if(A.p==='custom'){var r=parseRangeInput(A.from,A.to);return r||presetRange('month');}
  return presetRange(A.p);
}
/* v6: the in-book Analytics tab is gone — per-book analytics now lives in the root
   Analytics tab's book-scope pill; "Export analytics PDF" stays in the book ⋮ menu. */

/* ============ global analytics driver ============ */
var GA={p:'month',from:'',to:'',donut:'out',book:''};
function gaRange(){
  if(GA.p==='custom'){var r=parseRangeInput(GA.from,GA.to);return r||presetRange('month');}
  return presetRange(GA.p);
}
function byBookData(r){
  return S.books.map(function(b){
    var t=sumIn(bookEntries(b.id),r);
    return{book:b,tin:t.tin,tout:t.tout,net:t.tin-t.tout,n:t.n};
  }).sort(function(a,b){return Math.abs(b.net)-Math.abs(a.net);});
}
/* v6 \u00ABPaper Ledger\u00BB analytics: IN/OUT/NET strip + Where-money-went donut + balance line,
   with a book-scope pill and a period pill (full period logic incl. custom kept). */
function ganPeriodLabel(){
  if(GA.p==='custom')return rangeLabel(gaRange());
  return GA.p==='week'?'This week':(GA.p==='year'?'This year':'This month');
}
function renderGlobalAnalytics(){
  var r=gaRange();
  var scoped=GA.book&&bookById(GA.book)?bookById(GA.book):null;
  if(GA.book&&!scoped)GA.book='';
  $('#gan-scope-lbl').textContent=scoped?scoped.name:'All books';
  $('#gan-period-lbl').textContent=ganPeriodLabel();
  var pool=scoped?bookEntries(scoped.id):S.entries;
  var es=pool.filter(function(e){return e.ts>=r[0]&&e.ts<r[1];}).sort(entrySortAsc);
  var tin=0,tout=0;
  es.forEach(function(e){if(e.type==='in')tin+=e.amount;else tout+=e.amount;});
  $('#gkpi-in').textContent=money(tin);
  $('#gkpi-out').textContent=money(tout);
  var net=tin-tout,kn=$('#gkpi-net');
  kn.textContent=(net>0?'+ ':'')+money(net);
  kn.style.color=net>0?'var(--in)':(net<0?'var(--out)':'var(--ink)');
  $('#gdonut-wrap').innerHTML=donutHTML(es,'out');
  var opening=0;
  if(scoped){opening=scoped.opening;pool.forEach(function(e){if(e.ts<r[0])opening+=signed(e);});}
  else{S.books.forEach(function(b){opening+=b.opening;});S.entries.forEach(function(e){if(e.ts<r[0])opening+=signed(e);});}
  $('#gline-wrap').innerHTML=lineHTML(es,r,opening,GA.p);
  var d=$('#gan-delta');
  if(opening>0&&net!==0){
    var pct=Math.abs(net/opening*100);
    /* a % change against a tiny opening balance is meaningless \u2014 hide beyond 500% */
    if(pct<=500){
      d.textContent=(net>0?'\u25B2 ':'\u25BC ')+(pct>=10?Math.round(pct):pct.toFixed(1))+'%';
      d.style.color=net>0?'var(--in)':'var(--out)';
    }else d.textContent='';
  }else d.textContent='';
}
$('#gan-scope').addEventListener('click',function(){
  var items=[{icon:'chart',label:'All books'+(GA.book?'':'  \u2713'),fn:function(){GA.book='';renderGlobalAnalytics();}}];
  S.books.forEach(function(b){
    items.push({icon:'book',label:b.name+(GA.book===b.id?'  \u2713':''),fn:function(){GA.book=b.id;renderGlobalAnalytics();}});
  });
  menuSheet(items);
});
$('#gan-period-pill').addEventListener('click',function(){
  function setP(p){GA.p=p;$('#gan-custom').classList.add('hidden');renderGlobalAnalytics();}
  menuSheet([
    {icon:'cal',label:'This week'+(GA.p==='week'?'  \u2713':''),fn:function(){setP('week');}},
    {icon:'cal',label:'This month'+(GA.p==='month'?'  \u2713':''),fn:function(){setP('month');}},
    {icon:'cal',label:'This year'+(GA.p==='year'?'  \u2713':''),fn:function(){setP('year');}},
    {icon:'cal',label:'Custom range\u2026'+(GA.p==='custom'?'  \u2713':''),fn:function(){
      GA.p='custom';
      if(!GA.from){var r=presetRange('month');GA.from=dateInputVal(r[0]);GA.to=dateInputVal(new Date());}
      $('#gan-from').value=GA.from;$('#gan-to').value=GA.to;
      $('#gan-custom').classList.remove('hidden');
      if(typeof syncControls==='function')syncControls();
      renderGlobalAnalytics();
    }}
  ]);
});
$('#gan-from').addEventListener('change',function(){GA.from=this.value;renderGlobalAnalytics();});
$('#gan-to').addEventListener('change',function(){GA.to=this.value;renderGlobalAnalytics();});
$('#gan-menu').addEventListener('click',function(){
  menuSheet([{icon:'printer',label:'Export report (PDF)',fn:function(){openExportSheet('analytics-global');}}]);
});

/* ============ parties ============ */
function relTime(ts){
  if(!ts)return '';
  var d=Date.now()-ts;
  if(d<3600000)return 'just now';
  if(d<86400000)return Math.floor(d/3600000)+'h ago';
  if(d<7*86400000)return Math.floor(d/86400000)+'d ago';
  return fmtDate(ts);
}
var ROLE_LABEL={customer:'Customer',supplier:'Supplier',staff:'Staff'};
function renderParties(){
  var list=$('#party-list'),empty=$('#parties-empty'),band=$('#ppband');
  if(!S.parties.length){list.classList.add('hidden');list.innerHTML='';band.classList.add('hidden');empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');list.classList.remove('hidden');band.classList.remove('hidden');
  var agg=partyAggregates();
  $('#pp-collect').textContent=money(agg.toCollect);
  $('#pp-pay').textContent=money(agg.toPay);
  var items=S.parties.slice().sort(function(a,b){return Math.abs(partyTotals(b.id).bal)-Math.abs(partyTotals(a.id).bal);});
  list.innerHTML=items.map(function(p){
    var t=partyTotals(p.id),cls=t.bal>0?'pos':(t.bal<0?'neg':''),lbl=t.bal>0?'to collect':(t.bal<0?'to pay':'settled');
    var es=partyEntries(p.id),last=0;es.forEach(function(e){if(e.ts>last)last=e.ts;});
    var sub=ROLE_LABEL[p.role]||'Customer';if(last)sub+=' · '+relTime(last);
    return '<button class="srow prow" data-pid="'+p.id+'">'+
      '<span class="avb circle" data-tone="'+avTone(p.id)+'">'+esc(initialsOf(p.name))+'</span>'+
      '<span class="sl"><span class="pnm">'+esc(p.name)+'</span><span class="psub">'+esc(sub)+'</span></span>'+
      '<span class="pr-bal '+cls+'"><b>'+money(Math.abs(t.bal))+'</b><small>'+lbl+'</small></span></button>';
  }).join('');
  stagger(list);
}
$('#party-list').addEventListener('click',function(e){
  var b=e.target.closest('[data-pid]');
  if(b)openParty(b.getAttribute('data-pid'));
});
function openParty(id){
  if(!partyById(id))return;
  currentParty=id;renderParty();goView('view-party');
}
function renderParty(){
  var p=partyById(currentParty);if(!p)return;
  $('#pd-name').textContent=p.name;
  var t=partyTotals(p.id);
  $('#pd-lbl').textContent=t.bal>0?'To receive':(t.bal<0?'To pay':'Settled');
  var pv=$('#pd-bal');pv.textContent=money(Math.abs(t.bal));
  pv.className='pv '+(t.bal>0?'pos':(t.bal<0?'neg':''));
  $('#pd-gave').textContent=nfmt(t.gave);
  $('#pd-got').textContent=nfmt(t.got);
  var es=partyEntries(p.id).sort(function(a,b){return -entrySortAsc(a,b);});
  var box=$('#pd-entries'),empty=$('#pd-empty');
  if(!es.length){box.innerHTML='';empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  var run=partyRunMap(p.id);
  var groups=[],map={};
  es.forEach(function(e){
    var k=dayKeyOf(e.ts);
    if(!map[k]){map[k]={key:k,items:[]};groups.push(map[k]);}
    map[k].items.push(e);
  });
  box.innerHTML=groups.map(function(g){
    return '<div class="day"><div class="dayhead"><h4>'+dayLabel(g.key)+'</h4></div><div class="daycard">'+
      g.items.map(function(e){
        var b=bookById(e.bookId),bal=run[e.id];
        var amtHtml='<div class="e2amt '+(e.type==='out'?'in':'out')+'">'+(e.type==='out'?'Gave ':'Got ')+nfmt(e.amount)+'</div>';
        var balHtml='<div class="e2bal">'+(bal>=0?'Receive ':'Pay ')+nfmt(Math.abs(bal))+'</div>';
        return '<div class="erow"><button class="entry" data-pdid="'+e.id+'">'+
          entryCardInner(e,{bookName:b?b.name:'?',amtHtml:amtHtml,balHtml:balHtml})+
          '</button></div>';
      }).join('')+'</div></div>';
  }).join('');
}
$('#pd-entries').addEventListener('click',function(e){
  var row=e.target.closest('[data-pdid]');
  if(row)openDetail(row.getAttribute('data-pdid'));
});
$('#pd-receive').addEventListener('click',function(){openEntrySheet({type:'in',party:currentParty,noteDefault:'Payment received'});});
$('#pd-pay').addEventListener('click',function(){openEntrySheet({type:'out',party:currentParty,noteDefault:'Payment given'});});
var spEditing=null,spFromEntry=false,spRole='customer';
function openPartySheet(id,fromEntry){
  if(!lockGate())return;
  spEditing=id||null;spFromEntry=!!fromEntry;
  var p=id?partyById(id):null;
  spRole=(p&&p.role)||'customer';
  $$('#sp-role button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-r')===spRole);});
  $('#sp-title').textContent=p?'Edit party':'New party';
  $('#sp-name').value=p?p.name:'';
  $('#sp-phone').value=p?(p.phone||''):'';
  $('#sp-err').classList.add('hidden');
  $('#sp-delete').classList.toggle('hidden',!p);
  openSheet('sheet-party');
  focusAfterOpen('sheet-party','#sp-name');
}
$('#sp-role').addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  spRole=b.getAttribute('data-r');
  $$('#sp-role button').forEach(function(x){x.classList.toggle('on',x===b);});
});
$('#sp-save').addEventListener('click',function(){
  var name=$('#sp-name').value.trim(),phone=$('#sp-phone').value.trim();
  if(!name){$('#sp-err').classList.remove('hidden');$('#sp-name').focus();return;}
  if(spEditing){
    var p=partyById(spEditing);
    if(p){p.name=name;p.phone=phone;p.role=spRole;}
    save();closeSheet('sheet-party');
    refreshData();toast('Party updated');
  }else{
    var np={id:uid('p'),name:name,phone:phone,role:spRole,created:Date.now()};
    S.parties.push(np);save();closeSheet('sheet-party');
    if(spFromEntry){entParty=np.id;renderEntSelects();}
    refreshData();toast('Party added');
  }
});
$('#sp-name').addEventListener('keydown',function(e){if(e.key==='Enter')$('#sp-save').click();});
$('#sp-delete').addEventListener('click',function(){
  var p=partyById(spEditing);if(!p)return;
  var n=partyEntries(p.id).length;
  confirmDlg({title:'Delete \u201C'+p.name+'\u201D?',
    msg:n?('Their '+n+' '+(n===1?'entry stays':'entries stay')+' in your books, just without a party tag.'):'This party will be removed.',
    okLabel:'Delete',danger:true}).then(function(ok){
    if(!ok)return;
    S.entries.forEach(function(e){if(e.partyId===p.id)delete e.partyId;});
    S.trash.forEach(function(t){if(t.e.partyId===p.id)delete t.e.partyId;});
    S.recurring.forEach(function(r){if(r.partyId===p.id)delete r.partyId;});
    S.templates.forEach(function(t){if(t.partyId===p.id)delete t.partyId;});
    S.parties=S.parties.filter(function(x){return x.id!==p.id;});
    save();closeSheet('sheet-party');
    if(currentParty===p.id){currentParty=null;goTab('view-parties');}
    else refreshData();
    toast('Party deleted');
  });
});
$('#btn-pd-menu').addEventListener('click',function(){
  var id=currentParty;
  menuSheet([
    {icon:'edit',label:'Edit party',fn:function(){openPartySheet(id,false);}},
    {icon:'trash',label:'Delete party',danger:true,fn:function(){openPartySheet(id,false);setTimeout(function(){$('#sp-delete').click();},350);}}
  ]);
});
$('#pd-remind').addEventListener('click',function(){
  var p=partyById(currentParty);if(!p)return;
  var t=partyTotals(p.id);
  var line=t.bal>0?('Pending to receive: '+money(t.bal)):(t.bal<0?('Pending to pay: '+money(-t.bal)):'All settled \u2014 balance is zero.');
  shareText('Hello '+p.name+',\n'+line+'\nAs of '+fmtDate(Date.now())+'.\n\u2014 Sent from Cashbook');
});
$('#pd-imgshare').addEventListener('click',function(){
  shareCanvas(buildPartyCard(currentParty),'statement-'+dayKeyOf(Date.now())+'.png','Party statement');
});
$('#pd-print').addEventListener('click',function(){openExportSheet('party');});
$('#btn-pd-back').addEventListener('click',function(){currentParty=null;goBack('view-party');});
$('#btn-new-party').addEventListener('click',function(){openPartySheet(null,false);});
$('#btn-empty-party').addEventListener('click',function(){openPartySheet(null,false);});

/* ============ recurring ============ */
function runRecurring(){
  if(licLocked())return 0;
  var now=Date.now(),posted=0;
  S.recurring.forEach(function(rc){
    if(rc.paused)return;
    var guard=0;
    while(rc.nextTs<=now&&(!rc.endTs||rc.nextTs<=rc.endTs)&&guard<60){
      if(bookById(rc.bookId)){
        var ne={id:uid('e'),bookId:rc.bookId,type:rc.type,amount:rc.amount,categoryId:rc.categoryId,mode:rc.mode,note:rc.note||'',ts:rc.nextTs,created:Date.now(),auto:true};
        if(rc.partyId)ne.partyId=rc.partyId;
        S.entries.push(ne);posted++;
      }
      rc.nextTs=advanceTs(rc.nextTs,rc.freq,rc.day);
      guard++;
    }
  });
  if(posted){save();toast(posted+' recurring '+(posted===1?'entry':'entries')+' posted');}
  return posted;
}
function renderRecurring(){
  var list=$('#rec-list'),empty=$('#rec-empty');
  var mine=S.recurring.filter(function(r){return r.bookId===currentBook;});
  if(!mine.length){list.classList.add('hidden');list.innerHTML='';empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');list.classList.remove('hidden');
  var fr={daily:'Daily',weekly:'Weekly',monthly:'Monthly'};
  list.innerHTML=mine.map(function(r){
    var c=catById(r.categoryId);
    var ended=r.endTs&&r.nextTs>r.endTs;
    var stat=r.paused?'Paused':(ended?'Ended':'Next '+fmtDate(r.nextTs));
    return '<div class="srow"><div class="eic" style="width:36px;height:36px;font-size:16px;border-radius:10px;background:'+c.color+'22;color:'+c.color+'"><span class="catdot big" style="background:'+c.color+'"></span></div>'+
      '<span class="sl">'+(r.note?esc(r.note):esc(c.name))+'<br><span style="font-size:12px;color:var(--faint)">'+fr[r.freq]+' \u00B7 '+stat+'</span></span>'+
      '<span class="eamt '+r.type+'" style="font-size:13.5px">'+moneySigned(r.amount,r.type)+'</span>'+
      '<button class="iconbtn" data-toggle="'+r.id+'" aria-label="'+(r.paused?'Resume':'Pause')+'"><svg class="ic"><use href="#i-'+(r.paused?'play':'pause')+'"/></svg></button>'+
      '<button class="iconbtn" data-redit="'+r.id+'" aria-label="Edit"><svg class="ic"><use href="#i-edit"/></svg></button></div>';
  }).join('');
}
$('#rec-list').addEventListener('click',function(e){
  if(!lockGate())return;
  var t=e.target.closest('[data-toggle]');
  if(t){
    var id=t.getAttribute('data-toggle');
    S.recurring.forEach(function(r){if(r.id===id)r.paused=!r.paused;});
    save();
    var posted=runRecurring();
    renderRecurring();
    if(posted)refreshData();
    return;
  }
  var ed=e.target.closest('[data-redit]');
  if(ed)openRecurSheet(ed.getAttribute('data-redit'));
});
var srEditing=null,srType='out',srCat='other',srMode='Cash',srParty='',srFreq='monthly';
function openRecurSheet(id){
  if(!lockGate())return;
  var r=null;S.recurring.forEach(function(x){if(x.id===id)r=x;});
  srEditing=r?id:null;
  srType=r?r.type:'out';srCat=r?r.categoryId:'other';srMode=r?r.mode:'Cash';
  srParty=r?(r.partyId||''):'';srFreq=r?r.freq:'monthly';
  $('#sr-title').textContent=r?'Edit recurring':'New recurring';
  $('#sr-cur').textContent=curSym();
  $('#sr-amount').value=r?(r.amount/100):'';
  var when=r?new Date(r.nextTs):new Date();
  $('#sr-date').value=dateInputVal(when);
  $('#sr-time').value=timeInputVal(when);
  $('#sr-end').value=r&&r.endTs?dateInputVal(r.endTs):'';
  $('#sr-note').value=r?(r.note||''):'';
  $('#sr-err').classList.add('hidden');
  $$('#sr-type button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-t')===srType);});
  $$('#sr-freq button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-f')===srFreq);});
  $$('#sr-mode button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-m')===srMode);});
  $('#sr-party-sel').innerHTML='<option value=""'+(srParty===''?' selected':'')+'>No party</option>'+
    S.parties.map(function(p){return '<option value="'+p.id+'"'+(p.id===srParty?' selected':'')+'>'+esc(p.name)+'</option>';}).join('');
  $('#sr-cat-sel').innerHTML=S.categories.map(function(c){return '<option value="'+c.id+'"'+(c.id===srCat?' selected':'')+'>'+esc(c.name)+'</option>';}).join('');
  openSheet('sheet-recur');
}
$('#sr-type').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;srType=b.getAttribute('data-t');$$('#sr-type button').forEach(function(x){x.classList.toggle('on',x===b);});});
$('#sr-freq').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;srFreq=b.getAttribute('data-f');$$('#sr-freq button').forEach(function(x){x.classList.toggle('on',x===b);});});
$('#sr-mode').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;srMode=b.getAttribute('data-m');$$('#sr-mode button').forEach(function(x){x.classList.toggle('on',x===b);});});
$('#sr-party-sel').addEventListener('change',function(){srParty=this.value;});
$('#sr-cat-sel').addEventListener('change',function(){srCat=this.value;});
$('#sr-save').addEventListener('click',function(){
  var cents=parseAmt($('#sr-amount').value);
  var d=$('#sr-date').value,note=$('#sr-note').value.trim();
  if(cents===null||!d||!note){$('#sr-err').classList.remove('hidden');return;}
  var dp=d.split('-'),tp=($('#sr-time').value||'09:00').split(':');
  var nextTs=new Date(+dp[0],+dp[1]-1,+dp[2],+tp[0]||0,+tp[1]||0).getTime();
  var endTs;
  if($('#sr-end').value){var ep=$('#sr-end').value.split('-');endTs=new Date(+ep[0],+ep[1]-1,+ep[2],23,59).getTime();}
  if(srEditing){
    S.recurring.forEach(function(r){
      if(r.id!==srEditing)return;
      r.type=srType;r.amount=cents;r.categoryId=srCat;r.mode=srMode;r.note=note;
      r.freq=srFreq;r.nextTs=nextTs;r.day=new Date(nextTs).getDate();
      if(srParty)r.partyId=srParty;else delete r.partyId;
      if(endTs)r.endTs=endTs;else delete r.endTs;
    });
    toast('Recurring updated');
  }else{
    var nr={id:uid('r'),bookId:currentBook,type:srType,amount:cents,categoryId:srCat,mode:srMode,note:note,freq:srFreq,nextTs:nextTs,day:new Date(nextTs).getDate(),paused:false};
    if(srParty)nr.partyId=srParty;
    if(endTs)nr.endTs=endTs;
    S.recurring.push(nr);
    toast('Recurring saved');
  }
  save();closeSheet('sheet-recur');
  var posted=runRecurring();
  renderRecurring();
  if(posted)refreshData();
});
$('#btn-rec-back').addEventListener('click',function(){goBack('view-recurring');});
$('#btn-new-rec').addEventListener('click',function(){openRecurSheet(null);});
$('#btn-empty-rec').addEventListener('click',function(){openRecurSheet(null);});

/* ============ budgets ============ */
function renderBudgets(){
  var monthName=new Date().toLocaleDateString([],{month:'long',year:'numeric'});
  $('#bud-hint').textContent='Monthly cash-out limits for '+(bookById(currentBook)?bookById(currentBook).name:'')+' \u00B7 '+monthName;
  $('#bud-list').innerHTML=S.categories.map(function(c){
    var b=budgetFor(currentBook,c.id),sp=spentThisMonth(currentBook,c.id);
    var right=b?(nfmt(sp)+' / '+nfmt(b.amount)):(sp?nfmt(sp)+' spent':'No budget');
    var bar='';
    if(b){
      var pct=sp/b.amount,w=Math.min(100,Math.round(pct*100));
      var col=pct>=1?'var(--out)':(pct>=0.8?'var(--amber)':'var(--brand)');
      bar='<div class="mtrack"><div class="mfill" style="width:'+w+'%;background:'+col+'"></div></div>';
    }
    return '<button class="budxrow" data-cid="'+c.id+'"><div class="bxtop"><div class="eic" style="width:34px;height:34px;font-size:15px;border-radius:9px;background:'+c.color+'22;color:'+c.color+'"><span class="catdot big" style="background:'+c.color+'"></span></div>'+
      '<span class="sl">'+esc(c.name)+'</span><span class="sv">'+right+'</span></div>'+bar+'</button>';
  }).join('');
}
var sbCat=null;
$('#bud-list').addEventListener('click',function(e){
  if(!lockGate())return;
  var b=e.target.closest('[data-cid]');if(!b)return;
  sbCat=b.getAttribute('data-cid');
  var c=catById(sbCat),bud=budgetFor(currentBook,sbCat);
  $('#sb-title').textContent=c.name;
  $('#sb-cur').textContent=curSym();
  $('#sb-amount').value=bud?(bud.amount/100):'';
  $('#sb-err').classList.add('hidden');
  $('#sb-remove').classList.toggle('hidden',!bud);
  openSheet('sheet-budget');
  focusAfterOpen('sheet-budget','#sb-amount');
});
$('#sb-save').addEventListener('click',function(){
  var cents=parseAmt($('#sb-amount').value);
  if(cents===null){$('#sb-err').classList.remove('hidden');return;}
  var bud=budgetFor(currentBook,sbCat);
  if(bud)bud.amount=cents;
  else S.budgets.push({bookId:currentBook,categoryId:sbCat,amount:cents});
  save();closeSheet('sheet-budget');renderBudgets();toast('Budget saved');
});
$('#sb-remove').addEventListener('click',function(){
  S.budgets=S.budgets.filter(function(b){return !(b.bookId===currentBook&&b.categoryId===sbCat);});
  save();closeSheet('sheet-budget');renderBudgets();toast('Budget removed');
});
$('#btn-bud-back').addEventListener('click',function(){goBack('view-budgets');});

/* ============ CSV export ============ */
function csvCell(v){
  v=String(v==null?'':v);
  if(/[",\n\r]/.test(v))return '"'+v.replace(/"/g,'""')+'"';
  return v;
}
function downloadFile(name,mime,content){
  if(!lockGate())return;
  if(IS_NATIVE){nativeFile(b64FromText(content),name,mime,'save');return;}
  webDownloadBlob(new Blob([content],{type:mime}),name);
}
function safeName(s){return String(s||'export').replace(/[^\w\u0600-\u06FF-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'export';}
function exportCSV(esAsc,baseName){
  if(!esAsc.length){toast('Nothing to export');return;}
  var rows=[['Date','Time','Type','Amount','Category','Party','Payment mode','Note']];
  esAsc.forEach(function(e){
    rows.push([fmtDate(e.ts),fmtTime(e.ts),e.type==='in'?'Cash in':'Cash out',(e.amount/100),
      catById(e.categoryId).name,e.partyId&&partyById(e.partyId)?partyById(e.partyId).name:'',e.mode,e.note||'']);
  });
  var csv='\uFEFF'+rows.map(function(r){return r.map(csvCell).join(',');}).join('\r\n');
  downloadFile(safeName(baseName)+'-'+dayKeyOf(Date.now())+'.csv','text/csv;charset=utf-8',csv);
  toast('CSV downloaded');
}
function exportAllCSV(){
  if(!S.entries.length){toast('Nothing to export');return;}
  var rows=[['Book','Date','Time','Type','Amount','Category','Party','Payment mode','Note']];
  S.entries.slice().sort(entrySortAsc).forEach(function(e){
    var b=bookById(e.bookId);
    rows.push([b?b.name:'?',fmtDate(e.ts),fmtTime(e.ts),e.type==='in'?'Cash in':'Cash out',(e.amount/100),
      catById(e.categoryId).name,e.partyId&&partyById(e.partyId)?partyById(e.partyId).name:'',e.mode,e.note||'']);
  });
  var csv='\uFEFF'+rows.map(function(r){return r.map(csvCell).join(',');}).join('\r\n');
  downloadFile('cashbook-all-'+dayKeyOf(Date.now())+'.csv','text/csv;charset=utf-8',csv);
  toast('CSV downloaded');
}
function exportAccountCSV(acc){
  var mv=accMovements(acc);
  if(!mv.items.length){toast('Nothing to export');return;}
  var rows=[['Date','Time','Type','Amount','Detail','Book','Party']];
  mv.items.forEach(function(it){
    if(it.kind==='t'){
      var x=it.ref;
      rows.push([fmtDate(x.ts),fmtTime(x.ts),it.eff>0?'Transfer in':'Transfer out',(x.amount/100),x.note||'Transfer','','']);
    }else{
      var e=it.ref,b=bookById(e.bookId);
      rows.push([fmtDate(e.ts),fmtTime(e.ts),e.type==='in'?'Cash in':'Cash out',(e.amount/100),
        e.note||catById(e.categoryId).name,b?b.name:'?',e.partyId&&partyById(e.partyId)?partyById(e.partyId).name:'']);
    }
  });
  var csv='\uFEFF'+rows.map(function(r){return r.map(csvCell).join(',');}).join('\r\n');
  downloadFile(safeName(accName(acc))+'-'+dayKeyOf(Date.now())+'.csv','text/csv;charset=utf-8',csv);
  toast('CSV downloaded');
}
$('#btn-export-all').addEventListener('click',exportAllCSV);

/* ============ in-app PDF export ============ */
var PDF_HELV=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
var PDF_HELVB=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
var PDF_MAP={'\u20A8':'Rs','\u20B9':'Rs','\u2212':'-','\u2013':'-','\u2014':'-','\u2018':"'",'\u2019':"'",'\u201C':'"','\u201D':'"','\u00B7':'-','\u2026':'...','\u2192':'->','\uFF0B':'+','\u201E':'"','\u2022':'-'};
function pdfSafe(s){
  var out='',i,c;
  s=String(s==null?'':s);
  for(i=0;i<s.length;i++){
    c=s.charAt(i);
    if(PDF_MAP[c]!==undefined)out+=PDF_MAP[c];
    else if(s.charCodeAt(i)<=255)out+=c;
    else out+='?';
  }
  return out;
}
function pdfEsc(s){return s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
function pdfW(s,size,bold){
  var t=bold?PDF_HELVB:PDF_HELV,w=0,i,c;
  for(i=0;i<s.length;i++){c=s.charCodeAt(i)-32;w+=(c>=0&&c<95)?t[c]:556;}
  return w*size/1000;
}
function fitStr(s,maxW,size,bold){
  s=pdfSafe(s);
  if(pdfW(s,size,bold)<=maxW)return s;
  while(s.length&&pdfW(s+'..',size,bold)>maxW)s=s.slice(0,-1);
  return s+'..';
}
function wrapPdf(s,maxW,size,bold){
  var out=[];
  String(s==null?'':s).split(/\n/).forEach(function(par){
    var words=pdfSafe(par).split(/\s+/).filter(Boolean);
    if(!words.length){out.push('');return;}
    var cur='';
    words.forEach(function(w2){
      var t=cur?cur+' '+w2:w2;
      if(pdfW(t,size,bold)<=maxW)cur=t;
      else{
        if(cur)out.push(cur);
        while(pdfW(w2,size,bold)>maxW){
          var cut=w2.length;
          while(cut>1&&pdfW(w2.slice(0,cut),size,bold)>maxW)cut--;
          out.push(w2.slice(0,cut));w2=w2.slice(cut);
        }
        cur=w2;
      }
    });
    if(cur)out.push(cur);
  });
  return out.length?out:[''];
}
function makePDF(pages){
  var objs=['<</Type /Catalog /Pages 2 0 R>>','PAGES','<</Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding>>','<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding>>','<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding>>'];
  var kids=[];
  pages.forEach(function(ops){
    objs.push('<</Length '+ops.length+'>>\nstream\n'+ops+'\nendstream');
    var cid=objs.length;
    objs.push('<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <</Font <</F1 3 0 R /F2 4 0 R /F3 5 0 R>>>> /Contents '+cid+' 0 R>>');
    kids.push(objs.length+' 0 R');
  });
  objs[1]='<</Type /Pages /Kids ['+kids.join(' ')+'] /Count '+pages.length+'>>';
  var out='%PDF-1.4\n',offs=[];
  objs.forEach(function(o,i){offs.push(out.length);out+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});
  var xref=out.length;
  out+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
  offs.forEach(function(o){out+=('0000000000'+o).slice(-10)+' 00000 n \n';});
  out+='trailer\n<</Size '+(objs.length+1)+' /Root 1 0 R>>\nstartxref\n'+xref+'\n%%EOF';
  return out;
}
function fitCols(cols){
  var fixed=0,flexI=-1;
  cols.forEach(function(c,i){if(c.flex)flexI=i;else fixed+=c.w;});
  var avail=523-fixed;
  if(flexI>-1){
    if(avail<110){
      var over=110-avail,sh=cols.filter(function(c){return !c.flex&&c.align!=='r'&&c.w>44;}),tot=0;
      sh.forEach(function(c){tot+=c.w-44;});
      if(tot>0)sh.forEach(function(c){var cut=Math.min(c.w-44,Math.round(over*(c.w-44)/tot));c.w-=cut;});
      fixed=0;cols.forEach(function(c){if(!c.flex)fixed+=c.w;});
      avail=523-fixed;
    }
    cols[flexI].w=Math.max(avail,90);
  }
  return cols;
}
function renderPDF(EX){
  var pages=[],ops=null,y=0,M=36,W2=523,R2=M+W2;
  /* ===== v5 «Ledger» PDF design language =====
     Ocean Teal brand (#0B5C6B/#07414D) + cyan accent; in=green / out=red (money semantics).
     Masthead + stat cards + borderless hairline tables + rounded totals band. */
  /* v6 «Paper Ledger» PDF identity: Indigo brand (#4C4AA8/#37357E) + violet accent (#7A6CDF);
     in=forest-green / out=terracotta (money semantics), warm-paper neutral tints. */
  var BRAND=[0.298,0.290,0.659],BRANDDK=[0.216,0.208,0.494],ACCENT=[0.478,0.424,0.874],INK=[0.149,0.141,0.125],MUT=[0.42,0.46,0.5],HAIR=[0.89,0.88,0.86];
  var TONE={in:{t:[0.180,0.490,0.310],bg:[0.929,0.965,0.937]},out:{t:[0.753,0.333,0.251],bg:[0.980,0.933,0.914]},neu:{t:[0.20,0.19,0.17],bg:[0.960,0.949,0.925]}};
  function CF(c){return Array.isArray(c)?c[0]+' '+c[1]+' '+c[2]+' rg':(c||0)+' g';}
  function CS(c){return Array.isArray(c)?c[0]+' '+c[1]+' '+c[2]+' RG':(c||0)+' G';}
  function PWnew(){ops=[];pages.push(ops);y=(pages.length===1?104:52);}
  function fTag(st2){return st2===2?'3':(st2?'2':'1');}
  function txt(x,yTop,s,size,st2,c){ops.push(CF(c)+' BT /F'+fTag(st2)+' '+size+' Tf '+x.toFixed(1)+' '+(842-yTop).toFixed(1)+' Td ('+pdfEsc(pdfSafe(s))+') Tj ET');}
  function txtR(xR,yTop,s,size,st2,c){txt(xR-pdfW(pdfSafe(s),size,st2===1),yTop,s,size,st2,c);}
  function rule(x1,x2,yTop,lw,c){ops.push(CS(c)+' '+lw+' w '+x1+' '+(842-yTop).toFixed(1)+' m '+x2+' '+(842-yTop).toFixed(1)+' l S');}
  function box(x,yTop,w2,h2,c){ops.push(CF(c)+' '+x+' '+(842-yTop-h2).toFixed(1)+' '+w2+' '+h2+' re f');}
  function rrect(x,yTop,w2,h2,r,c){
    var yb=842-yTop-h2,yt=842-yTop,k=0.5523*r;
    function n(v){return v.toFixed(2);}
    var p=n(x+r)+' '+n(yb)+' m '+n(x+w2-r)+' '+n(yb)+' l '
      +n(x+w2-r+k)+' '+n(yb)+' '+n(x+w2)+' '+n(yb+r-k)+' '+n(x+w2)+' '+n(yb+r)+' c '
      +n(x+w2)+' '+n(yt-r)+' l '
      +n(x+w2)+' '+n(yt-r+k)+' '+n(x+w2-r+k)+' '+n(yt)+' '+n(x+w2-r)+' '+n(yt)+' c '
      +n(x+r)+' '+n(yt)+' l '
      +n(x+r-k)+' '+n(yt)+' '+n(x)+' '+n(yt-r+k)+' '+n(x)+' '+n(yt-r)+' c '
      +n(x)+' '+n(yb+r)+' l '
      +n(x)+' '+n(yb+r-k)+' '+n(x+r-k)+' '+n(yb)+' '+n(x+r)+' '+n(yb)+' c h';
    ops.push(CF(c)+' '+p+' f');
  }
  function ensure(hh){if(y+hh>842-56)PWnew();}
  function toneOf(k){return TONE[k]||TONE.neu;}
  PWnew();
  /* masthead (page 1): indigo band, violet keyline, ledger mark, letterspaced wordmark */
  box(0,0,595,74,BRAND);
  box(0,74,595,2.5,ACCENT);
  rrect(M,17,27,27,8,[0.404,0.361,0.784]);
  rule(M+7,M+20,27.5,1.5,[1,1,1]);
  rule(M+7,M+20,33.5,1.5,[0.83,0.81,0.95]);
  txt(M+37,36,fitStr(EX.title,W2-37-170,19,true),19,1,[1,1,1]);
  txt(M+37,53,fitStr(EX.subtitle,W2-37-170,9.5,false),9.5,0,[0.85,0.83,0.95]);
  txtR(R2,31,'C A S H B O O K',8,1,[0.83,0.81,0.95]);
  txtR(R2,47,'Printed '+fmtDate(Date.now())+' '+fmtTime(Date.now()),7.5,0,[0.85,0.83,0.95]);
  function renderTbl(bk){
    var cols=fitCols(bk.cols.map(function(c){return{label:c.label,w:c.w,align:c.align,wrap:c.wrap,flex:c.flex,tone:c.tone};}));
    var xs=[],x=M;cols.forEach(function(c){xs.push(x);x+=c.w;});
    var tw=x-M;
    function head(){
      ensure(30);
      y+=11;
      cols.forEach(function(c,i){
        var s=c.label.toUpperCase();
        if(c.align==='r')txtR(xs[i]+c.w-4,y,s,7,1,MUT);else txt(xs[i]+4,y,s,7,1,MUT);
      });
      y+=5;rule(M,M+tw,y,1.1,BRAND);y+=3;
    }
    head();
    bk.rows.forEach(function(row){
      var cl=row.map(function(cell,i){
        var c=cols[i],maxW=c.w-8;
        return c.wrap?wrapPdf(cell,maxW,8.6,false):[fitStr(String(cell==null?'':cell),maxW,8.6,false)];
      });
      var nl=1;cl.forEach(function(ls){nl=Math.max(nl,ls.length);});
      var rh=nl*10.6+8;
      if(y+rh>842-56){PWnew();head();}
      var y0=y;
      cl.forEach(function(ls,i){
        var c=cols[i],tc=c.tone?toneOf(c.tone).t:[0.13,0.15,0.18];
        ls.forEach(function(l,k){
          var yy=y0+10.6*(k+1)+2.5;
          if(c.align==='r')txtR(xs[i]+c.w-4,yy,l,8.6,c.tone?1:0,tc);
          else txt(xs[i]+4,yy,l,8.6,0,tc);
        });
      });
      y+=rh;
      rule(M,M+tw,y,0.4,[0.92,0.937,0.947]);
    });
    if(bk.foot){
      ensure(32);
      y+=4;
      rrect(M,y,tw,20,6,[0.94,0.953,0.96]);
      y+=13.5;
      bk.foot.forEach(function(cell,i){
        var c=cols[i],s=String(cell==null?'':cell);if(!s)return;
        var tc=c.tone?toneOf(c.tone).t:INK;
        if(c.align==='r')txtR(xs[i]+c.w-4,y,s,8.8,1,tc);else txt(xs[i]+6,y,s,8.8,1,tc);
      });
      y+=11;
    }
  }
  EX.blocks.forEach(function(bk){
    if(bk.t==='tot'){
      /* KPI stat cards: balanced rows of up to 4 rounded tiles spanning full width */
      var items=bk.items,idx=0,rowsN=Math.ceil(items.length/4);
      y+=4;
      for(var ri=0;ri<rowsN;ri++){
        var take=Math.ceil((items.length-idx)/(rowsN-ri));
        var rowIt=items.slice(idx,idx+take);idx+=take;
        var gap=8,cw=(W2-gap*(rowIt.length-1))/rowIt.length,ch=36;
        ensure(ch+8);
        rowIt.forEach(function(it,ci){
          var tn=toneOf(it[2]),x0=M+ci*(cw+gap);
          rrect(x0,y,cw,ch,8,tn.bg);
          txt(x0+10,y+14,fitStr(String(it[0]).toUpperCase(),cw-20,6.8,true),6.8,1,[0.36,0.42,0.46]);
          var vs=11.5;while(vs>7.5&&pdfW(pdfSafe(String(it[1])),vs,true)>cw-20)vs-=0.5;
          txt(x0+10,y+28.5,it[1],vs,1,tn.t);
        });
        y+=ch+8;
      }
      y+=8;
    }else if(bk.t==='h2'){
      ensure(36);y+=24;
      var hs=bk.s.toUpperCase();
      txt(M,y,hs,9.5,1,BRANDDK);
      rule(M+pdfW(pdfSafe(hs),9.5,true)+10,R2,y-3,0.7,HAIR);
      y+=8;
    }else if(bk.t==='note'){
      wrapPdf(bk.s,W2,8,false).forEach(function(l){ensure(12);y+=11;txt(M,y,l,8,2,MUT);});
      y+=3;
    }else if(bk.t==='p'){
      bk.lines.forEach(function(l){wrapPdf(l,W2,9.5,false).forEach(function(l2){ensure(14);y+=13;txt(M,y,l2,9.5,0,[0.15,0.18,0.2]);});});
      y+=2;
    }else if(bk.t==='tbl')renderTbl(bk);
  });
  var N=pages.length;
  pages.forEach(function(p,i){
    p.push(CS(HAIR)+' 0.7 w 36 36 m 559 36 l S');
    p.push(CF(MUT)+' BT /F1 7.5 Tf 36 25 Td ('+pdfEsc('Generated by Cashbook - data stays on this device')+') Tj ET');
    var pn='Page '+(i+1)+' of '+N;
    p.push(CF(BRANDDK)+' BT /F2 7.5 Tf '+(559-pdfW(pn,7.5,true)).toFixed(1)+' 25 Td ('+pdfEsc(pn)+') Tj ET');
  });
  return makePDF(pages.map(function(p){return p.join('\n');}));
}
function pdfBlobOf(str){
  var bts=new Uint8Array(str.length);
  for(var i=0;i<str.length;i++)bts[i]=str.charCodeAt(i)&0xff;
  return new Blob([bts],{type:'application/pdf'});
}
function savePDFFile(str,name){
  if(!lockGate())return;
  if(IS_NATIVE){nativeFile(b64FromLatin1(str),name,'application/pdf','save');return;}
  webDownloadBlob(pdfBlobOf(str),name);toast('PDF saved');
}
function sharePDFFile(str,name){
  if(!lockGate())return;
  if(IS_NATIVE){nativeFile(b64FromLatin1(str),name,'application/pdf','share');return;}
  var file=null;
  try{file=new File([pdfBlobOf(str)],name,{type:'application/pdf'});}catch(e){}
  if(file&&navigator.canShare&&navigator.canShare({files:[file]})&&navigator.share){
    navigator.share({files:[file],title:'Cashbook report'}).catch(function(){});
    return;
  }
  savePDFFile(str,name);
}
/* ---- export data builders (field toggles respected here) ---- */
var XP={m:'view',r:'month',from:'',to:''},XPscope='ledger',EXP=null;
var PDF_TOGGLES={
  ledger:[['date','Date'],['note','Note'],['category','Category'],['party','Party'],['mode','Payment mode'],['amount','Amount'],['balance','Running balance']],
  account:[['date','Date'],['note','Detail'],['book','Book'],['amount','Amount'],['balance','Running balance']],
  party:[['date','Date'],['note','Note'],['book','Book'],['amount','Gave / got'],['balance','Balance']],
  analytics:[['summary','Summary'],['categories','By category'],['accounts','By account'],['time','Over time'],['insights','Insights'],['budgets','Budgets']]
};
function pdfScopeKey(scope){return scope.indexOf('analytics')===0?'analytics':scope;}
var PDF_DEFAULT_KEYS={ledger:['date','note','category','party','mode','amount','balance'],account:['date','note','book','amount','balance'],party:['date','note','book','amount','balance'],analytics:['summary','categories','accounts','time','insights','budgets']};
function pdfPrefs(scope){
  var sc=pdfScopeKey(scope);
  if(!S.settings.pdf||typeof S.settings.pdf!=='object')S.settings.pdf={};
  if(!S.settings.pdf[sc]||typeof S.settings.pdf[sc]!=='object')S.settings.pdf[sc]={};
  var p=S.settings.pdf[sc];
  PDF_DEFAULT_KEYS[sc].forEach(function(k2){if(!(k2 in p))p[k2]=true;});
  return p;
}
function footRow(cols,map){
  return cols.map(function(c,i){
    if(i===0&&map[c.k]===undefined)return 'Totals';
    return map[c.k]!==undefined?map[c.k]:'';
  });
}
function buildExport(scope){
  var p=pdfPrefs(scope);
  if(scope==='ledger'){
    var bk=bookById(currentBook);if(!bk)return null;
    var cols=[];
    if(p.date)cols.push({k:'date',label:'Date',w:62});
    if(p.note)cols.push({k:'note',label:'Detail',w:0,wrap:1,flex:1});
    if(p.category)cols.push({k:'category',label:'Category',w:72});
    if(p.party)cols.push({k:'party',label:'Party',w:72});
    if(p.mode)cols.push({k:'mode',label:'Mode',w:42});
    if(p.amount){cols.push({k:'in',label:'In',w:64,align:'r',tone:'in'});cols.push({k:'out',label:'Out',w:64,align:'r',tone:'out'});}
    if(p.balance)cols.push({k:'balance',label:'Balance',w:70,align:'r'});
    if(!cols.length)return null;
    var filtered=XP.m==='view',es,opening=null,range=null,sub;
    if(filtered){
      es=filteredEntries().slice().reverse();
      sub='Ledger - current view ('+es.length+(es.length===1?' entry':' entries')+')';
    }else{
      range=XP.r==='all'?null:(XP.r==='custom'?parseRangeInput(XP.from,XP.to):presetRange(XP.r));
      es=bookEntries(currentBook).sort(entrySortAsc).filter(function(e){return !range||(e.ts>=range[0]&&e.ts<range[1]);});
      opening=bk.opening;
      if(range)bookEntries(currentBook).forEach(function(e){if(e.ts<range[0])opening+=signed(e);});
      sub='Ledger report - '+rangeLabel(range);
    }
    if(!es.length)return null;
    var t=reportTotals(es),run;
    if(filtered){
      run={};var fbal=0;
      es.forEach(function(e){fbal+=signed(e);run[e.id]=fbal;});
    }else run=runningMap(currentBook);
    var rows=es.map(function(e){
      return cols.map(function(c){
        switch(c.k){
          case 'date':return fmtDate(e.ts);
          case 'note':return e.note||catById(e.categoryId).name;
          case 'category':return catById(e.categoryId).name;
          case 'party':return e.partyId&&partyById(e.partyId)?partyById(e.partyId).name:'';
          case 'mode':return isCashBook(e.bookId)?e.mode:'';
          case 'in':return e.type==='in'?nfmt(e.amount):'';
          case 'out':return e.type==='out'?nfmt(e.amount):'';
          case 'balance':return nfmt(run[e.id]);
        }
      });
    });
    var blocks=[];
    var tot=[['Total in',money(t.tin),'in'],['Total out',money(t.tout),'out'],['Net',money(t.tin-t.tout),(t.tin-t.tout)<0?'out':'in']];
    if(opening!==null){tot.push(['Opening',money(opening),'neu']);tot.push(['Closing',money(opening+t.tin-t.tout),'neu']);}
    blocks.push({t:'tot',items:tot});
    if(filtered)blocks.push({t:'note',s:'Filters: '+filtersLabel()});
    blocks.push({t:'tbl',cols:cols,rows:rows,foot:footRow(cols,{in:nfmt(t.tin),out:nfmt(t.tout)})});
    if(p.balance)blocks.push({t:'note',s:filtered
      ?'Balance column is a running total of the listed entries only - it starts at zero and leaves out the opening balance. All amounts in '+curSym()+'.'
      :'Balance column shows the true running balance of the whole book, including the opening balance. All amounts in '+curSym()+'.'});
    return{title:bk.name,subtitle:sub,fname:safeName(bk.name),blocks:blocks};
  }
  if(scope==='account'){
    var acc=currentAcc,mv=accMovements(acc);
    if(!mv.items.length)return null;
    var cols2=[];
    if(p.date)cols2.push({k:'date',label:'Date',w:62});
    if(p.note)cols2.push({k:'note',label:'Detail',w:0,wrap:1,flex:1});
    if(p.book)cols2.push({k:'book',label:'Book',w:84});
    if(p.amount){cols2.push({k:'in',label:'In',w:64,align:'r',tone:'in'});cols2.push({k:'out',label:'Out',w:64,align:'r',tone:'out'});}
    if(p.balance)cols2.push({k:'balance',label:'Balance',w:70,align:'r'});
    if(!cols2.length)return null;
    var tin=0,tout=0;
    mv.items.forEach(function(it){if(it.eff>0)tin+=it.eff;else tout+=-it.eff;});
    var rows2=mv.items.map(function(it){
      var isT=it.kind==='t',e2=it.ref;
      return cols2.map(function(c){
        switch(c.k){
          case 'date':return fmtDate(it.ts);
          case 'note':return isT?((e2.note?e2.note+' - ':'')+(it.eff>0?'Transfer in':'Transfer out')):(e2.note||catById(e2.categoryId).name);
          case 'book':return isT?'':(bookById(e2.bookId)?bookById(e2.bookId).name:'?');
          case 'in':return it.eff>0?nfmt(it.eff):'';
          case 'out':return it.eff<0?nfmt(-it.eff):'';
          case 'balance':return nfmt(mv.run[it.id]);
        }
      });
    });
    return{title:accName(acc),subtitle:'Account statement - all time',fname:safeName(accName(acc)),
      blocks:[{t:'tot',items:[['Opening',money(mv.opening),'neu'],['Total in',money(tin),'in'],['Total out',money(tout),'out'],['Closing',money(mv.closing),'neu']]},
        {t:'tbl',cols:cols2,rows:rows2,foot:footRow(cols2,{in:nfmt(tin),out:nfmt(tout),balance:nfmt(mv.closing)})}]};
  }
  if(scope==='party'){
    var pt=partyById(currentParty);if(!pt)return null;
    var es3=partyEntries(pt.id).sort(entrySortAsc);
    if(!es3.length)return null;
    var run3=partyRunMap(pt.id),t3=partyTotals(pt.id);
    var cols3=[];
    if(p.date)cols3.push({k:'date',label:'Date',w:62});
    if(p.note)cols3.push({k:'note',label:'Detail',w:0,wrap:1,flex:1});
    if(p.book)cols3.push({k:'book',label:'Book',w:84});
    if(p.amount){cols3.push({k:'gave',label:'You gave',w:66,align:'r',tone:'out'});cols3.push({k:'got',label:'You got',w:66,align:'r',tone:'in'});}
    if(p.balance)cols3.push({k:'balance',label:'Balance',w:70,align:'r'});
    if(!cols3.length)return null;
    var rows3=es3.map(function(e){
      return cols3.map(function(c){
        switch(c.k){
          case 'date':return fmtDate(e.ts);
          case 'note':return e.note||catById(e.categoryId).name;
          case 'book':return bookById(e.bookId)?bookById(e.bookId).name:'?';
          case 'gave':return e.type==='out'?nfmt(e.amount):'';
          case 'got':return e.type==='in'?nfmt(e.amount):'';
          case 'balance':return nfmt(run3[e.id]);
        }
      });
    });
    return{title:pt.name+(pt.phone?' - '+pt.phone:''),subtitle:'Party statement - as of '+fmtDate(Date.now()),fname:safeName(pt.name),
      blocks:[{t:'tot',items:[['You gave',money(t3.gave),'out'],['You got',money(t3.got),'in'],[t3.bal>0?'To receive':(t3.bal<0?'To pay':'Settled'),money(Math.abs(t3.bal)),t3.bal>0?'in':(t3.bal<0?'out':'neu')]]},
        {t:'tbl',cols:cols3,rows:rows3,foot:footRow(cols3,{gave:nfmt(t3.gave),got:nfmt(t3.got),balance:nfmt(t3.bal)})},
        {t:'note',s:'Positive balance means the party owes you. '+amtWords(Math.abs(t3.bal))+(t3.bal>0?' receivable.':(t3.bal<0?' payable.':''))+' All amounts in '+curSym()+'.'}]};
  }
  /* analytics scopes */
  var isBook=scope==='analytics';
  var rr=isBook?anRange():gaRange(),pp=isBook?A.p:GA.p;
  var pool=isBook?bookEntries(currentBook):S.entries;
  var es4=pool.filter(function(e){return e.ts>=rr[0]&&e.ts<rr[1];}).sort(entrySortAsc);
  var len=rr[1]-rr[0],rPrev=[rr[0]-len,rr[0]];
  var cur=sumIn(pool,rr),prev=sumIn(pool,rPrev);
  var blocks4=[];
  if(p.summary){
    blocks4.push({t:'h2',s:'Summary'});
    blocks4.push({t:'tbl',cols:[{k:'m',label:'',w:0,flex:1},{k:'a',label:'This period',w:110,align:'r'},{k:'b',label:'Previous period',w:110,align:'r'}],
      rows:[['Total in',nfmt(cur.tin),nfmt(prev.tin)],['Total out',nfmt(cur.tout),nfmt(prev.tout)],['Net',nfmt(cur.tin-cur.tout),nfmt(prev.tin-prev.tout)],['Entries',String(cur.n),String(prev.n)]]});
  }
  if(p.categories){
    var inA=catAgg(es4,'in'),outA=catAgg(es4,'out'),seen={},order=[];
    outA.arr.forEach(function(x2){if(!seen[x2.c.id]){seen[x2.c.id]=1;order.push(x2.c);}});
    inA.arr.forEach(function(x2){if(!seen[x2.c.id]){seen[x2.c.id]=1;order.push(x2.c);}});
    function aggVal(agg,cid){var v=0;agg.arr.forEach(function(x2){if(x2.c.id===cid)v=x2.v;});return v;}
    if(order.length){
      blocks4.push({t:'h2',s:'By category'});
      blocks4.push({t:'tbl',cols:[{k:'c',label:'Category',w:0,flex:1},{k:'i',label:'In',w:92,align:'r',tone:'in'},{k:'o',label:'Out',w:92,align:'r',tone:'out'},{k:'p',label:'% of out',w:64,align:'r'}],
        rows:order.map(function(c2){
          var vi=aggVal(inA,c2.id),vo=aggVal(outA,c2.id);
          return[c2.name,vi?nfmt(vi):'',vo?nfmt(vo):'',vo&&outA.total?Math.round(vo/outA.total*100)+'%':''];
        })});
    }
  }
  if(p.accounts){
    var mSums={};
    es4.forEach(function(e){if(!mSums[e.mode])mSums[e.mode]={tin:0,tout:0};mSums[e.mode][e.type==='in'?'tin':'tout']+=e.amount;});
    var mrows=MODES.filter(function(m2){return mSums[m2];}).map(function(m2){
      return[m2==='Cash'?'Cash in hand':'Bank account',nfmt(mSums[m2].tin),nfmt(mSums[m2].tout)];
    });
    if(mrows.length){
      blocks4.push({t:'h2',s:'By account'});
      blocks4.push({t:'tbl',cols:[{k:'a',label:'Account',w:0,flex:1},{k:'i',label:'In',w:100,align:'r',tone:'in'},{k:'o',label:'Out',w:100,align:'r',tone:'out'}],rows:mrows});
    }
  }
  if(p.time){
    var bd=bucketData(es4,buildBuckets(rr,pp));
    if(bd.length){
      blocks4.push({t:'h2',s:'Over time'});
      blocks4.push({t:'tbl',cols:[{k:'l',label:'Period',w:0,flex:1},{k:'i',label:'In',w:92,align:'r',tone:'in'},{k:'o',label:'Out',w:92,align:'r',tone:'out'},{k:'n',label:'Net',w:92,align:'r'}],
        rows:bd.map(function(d2){return[d2.label,d2.tin?nfmt(d2.tin):'',d2.tout?nfmt(d2.tout):'',nfmt(d2.tin-d2.tout)];})});
    }
  }
  if(p.insights&&es4.length){
    var ins=insightsData(es4,rr),wd=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],lines=[];
    lines.push('Average per day: +'+nfmt(Math.round(ins.tin/ins.days))+' in, -'+nfmt(Math.round(ins.tout/ins.days))+' out.');
    if(ins.bigIn)lines.push('Biggest cash in: '+nfmt(ins.bigIn.amount)+' - '+(ins.bigIn.note||catById(ins.bigIn.categoryId).name)+' on '+fmtDate(ins.bigIn.ts)+'.');
    if(ins.bigOut)lines.push('Biggest cash out: '+nfmt(ins.bigOut.amount)+' - '+(ins.bigOut.note||catById(ins.bigOut.categoryId).name)+' on '+fmtDate(ins.bigOut.ts)+'.');
    if(ins.busiest!==null)lines.push('Busiest day: '+wd[ins.busiest]+' ('+ins.bn+' entries).');
    blocks4.push({t:'h2',s:'Insights'});
    blocks4.push({t:'p',lines:lines});
  }
  if(p.budgets){
    var buds=isBook?S.budgets.filter(function(x2){return x2.bookId===currentBook;}):S.budgets.slice();
    if(buds.length){
      blocks4.push({t:'h2',s:'Budgets - this month'});
      var bcols=[];
      if(!isBook)bcols.push({k:'bk',label:'Book',w:90});
      bcols.push({k:'c',label:'Category',w:0,flex:1});
      bcols.push({k:'s',label:'Spent',w:80,align:'r'});
      bcols.push({k:'b',label:'Budget',w:80,align:'r'});
      bcols.push({k:'u',label:'Used',w:50,align:'r'});
      blocks4.push({t:'tbl',cols:bcols,rows:buds.map(function(x2){
        var sp=spentThisMonth(x2.bookId,x2.categoryId),row=[];
        if(!isBook)row.push(bookById(x2.bookId)?bookById(x2.bookId).name:'?');
        row.push(catById(x2.categoryId).name);row.push(nfmt(sp));row.push(nfmt(x2.amount));row.push(Math.round(sp/x2.amount*100)+'%');
        return row;
      })});
    }
  }
  if(!blocks4.length)return null;
  return{title:isBook?(bookById(currentBook)?bookById(currentBook).name:'Book'):'All books',
    subtitle:'Analytics report - '+rangeLabel(rr),fname:'analytics',blocks:blocks4};
}
/* ---- export UI ---- */
function prevHTML(EX){
  var h2='<div class="xhead"><div class="xh1">'+esc(EX.title)+'</div><div class="xhsub">'+esc(EX.subtitle)+' \u00b7 printed '+esc(fmtDate(Date.now()))+'</div></div>';
  EX.blocks.forEach(function(bk){
    if(bk.t==='tot')h2+='<div class="xtot">'+bk.items.map(function(it){return '<span class="xchip t-'+(it[2]||'neu')+'">'+esc(it[0])+' <b>'+esc(it[1])+'</b></span>';}).join('')+'</div>';
    else if(bk.t==='h2')h2+='<div class="xh2">'+esc(bk.s)+'</div>';
    else if(bk.t==='note')h2+='<div class="xnotefoot">'+esc(bk.s)+'</div>';
    else if(bk.t==='p')h2+='<div class="xlines">'+bk.lines.map(esc).join('<br>')+'</div>';
    else if(bk.t==='tbl'){
      h2+='<table><thead><tr>'+bk.cols.map(function(c){return '<th'+(c.align==='r'?' class="num"':'')+'>'+esc(c.label)+'</th>';}).join('')+'</tr></thead><tbody>';
      bk.rows.forEach(function(rw){h2+='<tr>'+rw.map(function(cell,i){var c=bk.cols[i];return '<td class="'+(c.align==='r'?'num':'')+(c.wrap?' xnote':'')+(c.tone?' t-'+c.tone+'-txt':'')+'">'+esc(cell==null?'':cell)+'</td>';}).join('')+'</tr>';});
      if(bk.foot)h2+='<tr class="foot">'+bk.foot.map(function(cell,i){var c=bk.cols[i];return '<td class="'+(c.align==='r'?'num':'')+(c.tone?' t-'+c.tone+'-txt':'')+'">'+esc(cell||'')+'</td>';}).join('')+'</tr>';
      h2+='</tbody></table>';
    }
  });
  return h2;
}
function renderXpChips(){
  var p=pdfPrefs(XPscope);
  $('#xp-fields').innerHTML=PDF_TOGGLES[pdfScopeKey(XPscope)].map(function(f){
    return '<button class="chip'+(p[f[0]]?' on':'')+'" data-f="'+f[0]+'">'+f[1]+'</button>';
  }).join('');
}
function openExportSheet(scope){
  if(!lockGate())return;
  XPscope=scope;
  var isLedger=scope==='ledger';
  $('#xp-mode-wrap').classList.toggle('hidden',!isLedger);
  if(isLedger){
    XP={m:'view',r:'month',from:'',to:''};
    $$('#xp-mode button').forEach(function(b2){b2.classList.toggle('on',b2.getAttribute('data-m')==='view');});
    $('#xp-view-hint').textContent='Exports exactly what the ledger shows now \u2014 filters: '+filtersLabel();
    $('#xp-view-hint').classList.remove('hidden');
    $('#xp-period-wrap').classList.add('hidden');
    $$('#xp-range .chip').forEach(function(b2){b2.classList.toggle('on',b2.getAttribute('data-r')==='month');});
    $('#xp-custom').classList.add('hidden');
  }
  renderXpChips();
  openSheet('sheet-export');
}
$('#xp-fields').addEventListener('click',function(e){
  var b2=e.target.closest('.chip');if(!b2)return;
  var p=pdfPrefs(XPscope),k=b2.getAttribute('data-f');
  p[k]=!p[k];save();
  b2.classList.toggle('on',p[k]);
});
$('#xp-mode').addEventListener('click',function(e){
  var b2=e.target.closest('button');if(!b2)return;
  XP.m=b2.getAttribute('data-m');
  $$('#xp-mode button').forEach(function(x2){x2.classList.toggle('on',x2===b2);});
  $('#xp-view-hint').classList.toggle('hidden',XP.m!=='view');
  $('#xp-period-wrap').classList.toggle('hidden',XP.m!=='period');
});
$('#xp-range').addEventListener('click',function(e){
  var b2=e.target.closest('.chip');if(!b2)return;
  XP.r=b2.getAttribute('data-r');
  $$('#xp-range .chip').forEach(function(x2){x2.classList.toggle('on',x2===b2);});
  var custom=XP.r==='custom';
  $('#xp-custom').classList.toggle('hidden',!custom);
  if(custom&&!$('#xp-from').value){var r2=presetRange('month');$('#xp-from').value=dateInputVal(r2[0]);$('#xp-to').value=dateInputVal(new Date());if(typeof syncControls==='function')syncControls();}
});
$('#xp-from').addEventListener('change',function(){XP.from=this.value;});
$('#xp-to').addEventListener('change',function(){XP.to=this.value;});
$('#xp-go').addEventListener('click',function(){
  var p=pdfPrefs(XPscope),any=false;
  PDF_TOGGLES[pdfScopeKey(XPscope)].forEach(function(f){if(p[f[0]])any=true;});
  if(!any){toast('Turn on at least one field');return;}
  if(XPscope==='ledger'&&XP.m==='period'&&XP.r==='custom'){
    XP.from=$('#xp-from').value;XP.to=$('#xp-to').value;
    if(!parseRangeInput(XP.from,XP.to)){toast('Pick both dates');return;}
  }
  EXP=buildExport(XPscope);
  if(!EXP){toast('Nothing to export for this selection');return;}
  closeSheet('sheet-export');
  $('#xp-prev').innerHTML=prevHTML(EXP);
  goView('view-export',activeViewId());
});
$('#xp-save').addEventListener('click',function(){if(EXP)savePDFFile(renderPDF(EXP),EXP.fname+'-'+dayKeyOf(Date.now())+'.pdf');});
$('#xp-share').addEventListener('click',function(){if(EXP)sharePDFFile(renderPDF(EXP),EXP.fname+'-'+dayKeyOf(Date.now())+'.pdf');});
$('#btn-xp-back').addEventListener('click',function(){goBack('view-export');});

/* ============ backup & restore ============ */
function downloadBackup(){
  if(!lockGate())return;
  S.settings.lastBackupAt=Date.now();save();
  downloadFile('cashbook-backup-'+dayKeyOf(Date.now())+'.json','application/json',JSON.stringify(S,null,1));
  toast('Backup downloaded');
  renderSettings();renderBanners();
}
function shareBackup(){
  if(!lockGate())return;
  S.settings.lastBackupAt=Date.now();save();
  var json=JSON.stringify(S,null,1),name='cashbook-backup-'+dayKeyOf(Date.now())+'.json';
  if(IS_NATIVE){nativeFile(b64FromText(json),name,'application/json','share').then(function(){renderSettings();});return;}
  var file=null;
  try{file=new File([json],name,{type:'application/json'});}catch(e){}
  if(file&&navigator.canShare&&navigator.canShare({files:[file]})&&navigator.share){
    navigator.share({files:[file],title:'Cashbook backup'}).catch(function(){});
    renderSettings();
    return;
  }
  downloadFile(name,'application/json',json);
  toast('Backup downloaded');
  renderSettings();
}
$('#btn-backup').addEventListener('click',downloadBackup);
$('#btn-backup-share').addEventListener('click',shareBackup);
var pendingRestore=null;
$('#row-restore').addEventListener('click',function(){if(!lockGate())return;$('#file-restore').click();});
$('#file-restore').addEventListener('change',function(){
  var f=this.files[0];this.value='';
  if(!f)return;
  var rd=new FileReader();
  rd.onerror=function(){toast('Couldn\u2019t read that file');};
  rd.onload=function(){
    var d=null;
    try{d=normalize(JSON.parse(rd.result));}catch(e){}
    if(!d){toast('That file isn\u2019t a Cashbook backup');return;}
    pendingRestore=d;
    var first=Infinity,last=0;
    d.entries.forEach(function(e){first=Math.min(first,e.ts);last=Math.max(last,e.ts);});
    $('#rs-body').innerHTML='<p>This backup contains:</p>'+
      '<div class="drow"><span>Books</span><b>'+d.books.length+'</b></div>'+
      '<div class="drow"><span>Entries</span><b>'+d.entries.length+'</b></div>'+
      '<div class="drow"><span>Parties</span><b>'+d.parties.length+'</b></div>'+
      '<div class="drow"><span>Transfers</span><b>'+d.transfers.length+'</b></div>'+
      (d.entries.length?'<div class="drow"><span>Date range</span><b>'+fmtDate(first)+' \u2013 '+fmtDate(last)+'</b></div>':'')+
      '<p class="rs-warn">Restoring replaces everything currently in the app.</p>';
    openSheet('dlg-restore');
  };
  rd.readAsText(f);
});
$('#rs-cancel').addEventListener('click',function(){pendingRestore=null;closeSheet('dlg-restore');});
$('#rs-ok').addEventListener('click',function(){
  if(!lockGate())return;
  if(!pendingRestore)return;
  S=pendingRestore;pendingRestore=null;save();
  currentBook=null;currentParty=null;exitSel();resetFilters();
  applyTheme();closeSheet('dlg-restore');
  renderSettings();renderHome();showView('view-home');
  toast('Backup restored');
});

/* ============ settings ============ */
function storageKB(){try{return Math.round((localStorage.getItem(KEY)||'').length/1024);}catch(e){return Math.round(JSON.stringify(S).length/1024);}}
function renderLicCard(){
  var card=$('#lic-card');if(!card)return;
  var s=licState(),lbl=$('#lic-label'),val=$('#lic-val'),btn=$('#lic-btn'),barWrap=$('#lic-bar-wrap'),bar=$('#lic-bar');
  card.classList.remove('unlocked','locked');
  if(s.s==='unlocked'){
    card.classList.add('unlocked');
    lbl.textContent='CASHBOOK';var lifetime=(LIC.type==='lifetime');
    val.textContent=lifetime?'Lifetime — unlocked':'Unlocked';
    btn.textContent='✓';barWrap.classList.add('hidden');
  }else if(s.s==='locked'){
    card.classList.add('locked');
    lbl.textContent=s.expiredMonthly?'SUBSCRIPTION ENDED':'TRIAL ENDED';
    val.textContent='View-only mode';
    btn.textContent='Unlock';barWrap.classList.add('hidden');
  }else{
    lbl.textContent='FREE TRIAL';
    val.textContent=s.left+(s.left===1?' day left':' days left');
    btn.textContent='Unlock';barWrap.classList.remove('hidden');
    bar.style.width=Math.max(4,Math.round(s.left/LIC_TRIAL_DAYS*100))+'%';
  }
}
$('#lic-card')&&$('#lic-card').addEventListener('click',function(){pwDismissed=false;licShowPaywall(licState().expiredMonthly);});
function renderSettings(){
  renderLicCard();
  var st=S.settings;
  $$('#set-currency .chip').forEach(function(b){
    var c=b.getAttribute('data-c');
    b.classList.toggle('on',c===st.currency);
  });
  $('#set-custom-wrap').classList.toggle('hidden',st.currency!=='custom');
  $('#set-custom-cur').value=st.customCur;
  $$('#set-grouping button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-g')===st.grouping);});
  $('#set-datefmt').value=st.dateFormat;
  var cbSel=$('#set-cashbook');
  if(!S.books.length)cbSel.innerHTML='<option value="">No books yet</option>';
  else cbSel.innerHTML=S.books.map(function(b){return '<option value="'+b.id+'"'+(b.id===st.cashBookId?' selected':'')+'>'+esc(b.name)+'</option>';}).join('');
  $('#set-firstday').value=String(st.firstDay);
  $$('#set-theme button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-t')===st.theme);});
  $('#lock-state').textContent=st.pinHash?'On':'Off';
  var bioRow=$('#row-bio');
  if(!bioReady){$('#bio-state').textContent=IS_NATIVE?'Set up fingerprint/face first':'Needs installed app';bioRow.classList.add('dim');}
  else{$('#bio-state').textContent=st.bioCred?'On':'Off';bioRow.classList.remove('dim');}
  $('#trash-count').textContent=S.trash.length?String(S.trash.length):'Empty';
  $('#storage-used').textContent=storageKB()+' KB';
  if(typeof syncControls==='function')syncControls($('#view-settings'));
}
function repaintMoney(){save();renderSettings();refreshData();}
$('#set-currency').addEventListener('click',function(e){
  if(!lockGate())return;
  var b=e.target.closest('.chip');if(!b)return;
  S.settings.currency=b.getAttribute('data-c');
  if(S.settings.currency==='₨'||S.settings.currency==='₹')S.settings.grouping='lakh';
  else if(S.settings.currency!=='custom')S.settings.grouping='intl';
  repaintMoney();
});
$('#set-custom-cur').addEventListener('input',function(){if(!lockGate()){renderSettings();return;}S.settings.customCur=this.value.trim();save();refreshData();});
$('#set-grouping').addEventListener('click',function(e){
  if(!lockGate())return;
  var b=e.target.closest('button');if(!b)return;
  S.settings.grouping=b.getAttribute('data-g');repaintMoney();
});
$('#set-datefmt').addEventListener('change',function(){if(!lockGate()){renderSettings();return;}S.settings.dateFormat=this.value;repaintMoney();});
$('#set-cashbook').addEventListener('change',function(){if(!lockGate()){renderSettings();return;}S.settings.cashBookId=this.value;save();renderSettings();toast('Cash & Bank now follow '+(bookById(this.value)?bookById(this.value).name:'this book'));});
$('#set-firstday').addEventListener('change',function(){if(!lockGate()){renderSettings();return;}S.settings.firstDay=+this.value;repaintMoney();});
$('#set-theme').addEventListener('click',function(e){
  if(!lockGate())return;
  var b=e.target.closest('button');if(!b)return;
  S.settings.theme=b.getAttribute('data-t');save();applyTheme();renderSettings();
});
function wipeAll(){
  S=defaultState();save();
  currentBook=null;currentParty=null;exitSel();resetFilters();HQ='';
  $('#home-search').value='';$('#search-input').value='';
  applyTheme();renderSettings();renderHome();showView('view-home');
}
$('#btn-erase').addEventListener('click',function(){
  if(!lockGate())return;
  confirmDlg({title:'Erase all data?',msg:'Every book, entry, party, transfer and setting will be permanently removed from this device.',word:'ERASE',okLabel:'Erase everything',danger:true}).then(function(ok){
    if(!ok)return;
    wipeAll();toast('All data erased');
  });
});

/* ============ categories ============ */
function renderCats(){
  $('#cat-list').innerHTML=S.categories.map(function(c){
    var n=0;S.entries.forEach(function(e){if(e.categoryId===c.id)n++;});
    return '<button class="srow" data-cid="'+c.id+'"><div class="eic" style="width:36px;height:36px;font-size:16px;border-radius:10px;background:'+c.color+'22;color:'+c.color+'"><span class="catdot big" style="background:'+c.color+'"></span></div>'+
      '<span class="sl">'+esc(c.name)+(c.builtin?'<span class="tagb">built-in</span>':'')+'</span>'+
      '<span class="sv">'+(n?n+(n===1?' entry':' entries'):'')+'</span><svg class="ic"><use href="#i-chev"/></svg></button>';
  }).join('');
}
var scEditing=null,scColor=CAT_COLORS[0],scFromEntry=false;
function paintSwatches(){
  $('#sc-colors').innerHTML=CAT_COLORS.map(function(c){
    return '<button class="swatch'+(c===scColor?' on':'')+'" data-c="'+c+'" style="background:'+c+'" aria-label="Color '+c+'"></button>';
  }).join('');
}
function openCatSheet(id,fromEntry){
  if(!lockGate())return;
  var c=id?catExact(id):null;
  scEditing=c?id:null;scFromEntry=!!fromEntry;
  scColor=c?c.color:CAT_COLORS[Math.floor(Math.random()*CAT_COLORS.length)];
  $('#sc-title').textContent=c?'Edit category':'New category';
  $('#sc-name').value=c?c.name:'';
  $('#sc-err').classList.add('hidden');
  $('#sc-delete').classList.toggle('hidden',!c||c.builtin||c.id==='other');
  paintSwatches();
  openSheet('sheet-cat');
  focusAfterOpen('sheet-cat','#sc-name');
}
$('#sc-colors').addEventListener('click',function(e){
  var b=e.target.closest('.swatch');if(!b)return;
  scColor=b.getAttribute('data-c');paintSwatches();
});
$('#sc-save').addEventListener('click',function(){
  var name=$('#sc-name').value.trim();
  if(!name){$('#sc-err').classList.remove('hidden');$('#sc-name').focus();return;}
  if(scEditing){
    var c=catExact(scEditing);
    if(c){c.name=name;c.color=scColor;} /* emoji kept as-is (dots are the visual since v6) */
    toast('Category saved');
  }else{
    var newCat={id:uid('c'),name:name,emoji:'🏷️',color:scColor,builtin:false};
    S.categories.push(newCat);
    if(scFromEntry)entCat=newCat.id;
    toast('Category added');
  }
  save();closeSheet('sheet-cat');renderCats();
  if(scFromEntry){scFromEntry=false;renderEntSelects();}
  refreshData();
});
$('#sc-delete').addEventListener('click',function(){
  var c=catExact(scEditing);if(!c||c.builtin||c.id==='other')return;
  var n=0;S.entries.forEach(function(e){if(e.categoryId===c.id)n++;});
  confirmDlg({title:'Delete \u201C'+c.name+'\u201D?',
    msg:n?('Its '+n+' '+(n===1?'entry moves':'entries move')+' to \u201COther\u201D.'):'This category will be removed.',
    okLabel:'Delete',danger:true}).then(function(ok){
    if(!ok)return;
    S.entries.forEach(function(e){if(e.categoryId===c.id)e.categoryId='other';});
    S.trash.forEach(function(t){if(t.e.categoryId===c.id)t.e.categoryId='other';});
    S.recurring.forEach(function(r){if(r.categoryId===c.id)r.categoryId='other';});
    S.templates.forEach(function(t){if(t.categoryId===c.id)t.categoryId='other';});
    S.budgets=S.budgets.filter(function(b){return b.categoryId!==c.id;});
    F.cats=F.cats.filter(function(x){return x!==c.id;});
    S.categories=S.categories.filter(function(x){return x.id!==c.id;});
    save();closeSheet('sheet-cat');renderCats();refreshData();toast('Category deleted');
  });
});
$('#cat-list').addEventListener('click',function(e){
  var b=e.target.closest('[data-cid]');if(b)openCatSheet(b.getAttribute('data-cid'));
});
$('#row-categories').addEventListener('click',function(){renderCats();goView('view-categories','view-settings');});
$('#btn-cat-back').addEventListener('click',function(){goBack('view-categories');});
$('#btn-new-cat').addEventListener('click',function(){openCatSheet(null);});

/* ============ share-image pipeline ============ */
var FF='-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
var IMG={bg:'#EEEBF7',ink:'#262420',mut:'#8D8776',line:'rgba(38,36,32,.08)',incol:'#2E7D4F',outcol:'#C05540'};
function cardCanvas(h){
  var c=document.createElement('canvas');
  c.width=1080;c.height=Math.round(h*2);
  var x=c.getContext('2d');x.scale(2,2);
  return{c:c,x:x};
}
function rr(x,px,py,w,h,r){
  x.beginPath();
  x.moveTo(px+r,py);
  x.arcTo(px+w,py,px+w,py+h,r);
  x.arcTo(px+w,py+h,px,py+h,r);
  x.arcTo(px,py+h,px,py,r);
  x.arcTo(px,py,px+w,py,r);
  x.closePath();
}
function measCtx(){return document.createElement('canvas').getContext('2d');}
function ellipsize(x,text,maxW){
  text=String(text||'');
  if(x.measureText(text).width<=maxW)return text;
  while(text.length&&x.measureText(text+'\u2026').width>maxW)text=text.slice(0,-1);
  return text+'\u2026';
}
function wrapLines(x,text,maxW,maxLines){
  var words=String(text||'').split(/\s+/).filter(Boolean),lines=[],cur='';
  words.forEach(function(w){
    var t=cur?cur+' '+w:w;
    if(x.measureText(t).width<=maxW)cur=t;
    else{if(cur)lines.push(cur);cur=w;}
  });
  if(cur)lines.push(cur);
  if(lines.length>maxLines){
    lines=lines.slice(0,maxLines);
    lines[maxLines-1]=ellipsize(x,lines[maxLines-1]+' \u2026',maxW);
  }
  return lines;
}
function drawChrome(x,H){
  x.fillStyle=IMG.bg;x.fillRect(0,0,540,H);
  x.save();
  x.shadowColor='rgba(38,36,32,.16)';x.shadowBlur=22;x.shadowOffsetY=9;
  rr(x,16,16,508,H-32,22);x.fillStyle='#FFFFFF';x.fill();
  x.restore();
  rr(x,16,16,508,H-32,22);x.strokeStyle=IMG.line;x.lineWidth=1;x.stroke();
  var g=x.createLinearGradient(34,32,34,62);
  g.addColorStop(0,'#7A6CDF');g.addColorStop(1,'#413F96');
  rr(x,34,32,30,30,9);x.fillStyle=g;x.fill();
  x.strokeStyle='#FFFFFF';x.lineWidth=3.2;x.lineCap='round';x.lineJoin='round';
  x.beginPath();x.moveTo(41.5,47.5);x.lineTo(47,53.5);x.lineTo(57,40.5);x.stroke();
  x.fillStyle=IMG.ink;x.font='800 12px '+FF;x.textAlign='left';x.textBaseline='alphabetic';
  x.fillText('C A S H B O O K',74,51.5);
  x.fillStyle=IMG.mut;x.font='600 11px '+FF;x.textAlign='right';
  x.fillText(fmtDate(Date.now()),506,51.5);
  x.textAlign='left';
  x.strokeStyle=IMG.line;x.lineWidth=1;
  x.beginPath();x.moveTo(34,76);x.lineTo(506,76);x.stroke();
  return 98;
}
function drawFooter(x,H,label){
  x.strokeStyle=IMG.line;x.lineWidth=1;
  x.beginPath();x.moveTo(34,H-52);x.lineTo(506,H-52);x.stroke();
  x.fillStyle=IMG.mut;x.font='500 10px '+FF;x.textAlign='center';
  x.fillText(label||'Generated by Cashbook \u00B7 data stays on this device',270,H-33);
  x.textAlign='left';
}
function shareCanvas(canvas,filename,title){
  if(!lockGate())return;
  if(IS_NATIVE&&canvas&&canvas.toDataURL){
    nativeFile(b64FromDataURL(canvas.toDataURL('image/png')),filename,'image/png','share');return;
  }
  if(!canvas||!canvas.toBlob){toast('Images aren\u2019t supported here');return;}
  canvas.toBlob(function(blob){
    if(!blob){toast('Couldn\u2019t build the image');return;}
    var file=null;
    try{file=new File([blob],filename,{type:'image/png'});}catch(e){}
    if(file&&navigator.canShare&&navigator.canShare({files:[file]})&&navigator.share){
      navigator.share({files:[file],title:title||'Cashbook'}).catch(function(){});
      return;
    }
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download=filename;
    document.body.appendChild(a);a.click();
    setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},400);
    toast('Image saved');
  },'image/png');
}
function buildEntryCard(e){
  var m=measCtx();m.font='700 18px '+FF;
  var noteLines=e.note?wrapLines(m,e.note,440,3):[];
  var rows=[['Category',catById(e.categoryId).emoji+' '+catById(e.categoryId).name],
    ['Account',(e.mode==='Cash'?'Cash in hand':'Bank account')+' ('+e.mode+')'],
    ['Date',fmtDate(e.ts)+' \u00B7 '+fmtTime(e.ts)],
    ['Book',bookById(e.bookId)?bookById(e.bookId).name:'?']];
  if(e.partyId&&partyById(e.partyId))rows.push(['Party',partyById(e.partyId).name]);
  if(e.attach)rows.push(['Photo','Attached (in app)']);
  var H=98+30+50+22+(noteLines.length?noteLines.length*25+8:14)+12+rows.length*29+18+60;
  var cc=cardCanvas(H),x=cc.x,y=drawChrome(x,H);
  var col=e.type==='in'?IMG.incol:IMG.outcol;
  x.textAlign='center';
  x.font='800 11px '+FF;
  var lbl=e.type==='in'?'CASH IN':'CASH OUT';
  var bw=x.measureText(lbl).width+30;
  rr(x,270-bw/2,y-4,bw,22,11);
  x.fillStyle=e.type==='in'?'rgba(17,138,87,.12)':'rgba(214,69,96,.12)';x.fill();
  x.fillStyle=col;
  x.fillText(lbl,270,y+11);
  y+=30;
  x.font='750 38px '+FF;
  x.fillText((e.type==='in'?'+ ':'\u2212 ')+curSym()+' '+nfmt(e.amount),270,y+34);
  y+=50;
  x.fillStyle=IMG.mut;x.font='500 11px '+FF;
  x.fillText(ellipsize(x,amtWords(e.amount),440),270,y+12);
  y+=22;
  if(noteLines.length){
    x.fillStyle=IMG.ink;x.font='700 18px '+FF;
    noteLines.forEach(function(ln){y+=25;x.fillText(ln,270,y);});
    y+=8;
  }else y+=14;
  x.textAlign='left';
  x.strokeStyle=IMG.line;x.beginPath();x.moveTo(44,y);x.lineTo(496,y);x.stroke();
  y+=10;
  rows.forEach(function(rw){
    y+=29;
    x.fillStyle=IMG.mut;x.font='600 12.5px '+FF;x.textAlign='left';
    x.fillText(rw[0],44,y);
    x.fillStyle=IMG.ink;x.font='650 13.5px '+FF;x.textAlign='right';
    x.fillText(ellipsize(x,rw[1],330),496,y);
  });
  x.textAlign='left';
  drawFooter(x,H);
  return cc.c;
}
function buildPartyCard(pid){
  var p=partyById(pid);if(!p)return null;
  var t=partyTotals(pid);
  var es=partyEntries(pid).sort(function(a,b){return -entrySortAsc(a,b);});
  var shown=es.slice(0,12),more=es.length-shown.length;
  var H=98+30+(p.phone?18:0)+16+16+40+24+18+shown.length*27+(more>0?22:0)+(shown.length?0:24)+60;
  var cc=cardCanvas(H),x=cc.x,y=drawChrome(x,H);
  x.fillStyle=IMG.ink;x.font='750 21px '+FF;
  x.fillText(ellipsize(x,p.name,440),44,y+20);y+=30;
  if(p.phone){x.fillStyle=IMG.mut;x.font='550 12px '+FF;x.fillText(p.phone,44,y+10);y+=18;}
  y+=16;
  var lbl=t.bal>0?'TO RECEIVE':(t.bal<0?'TO PAY':'SETTLED');
  var col=t.bal>0?IMG.incol:(t.bal<0?IMG.outcol:IMG.mut);
  x.fillStyle=col;x.font='800 11px '+FF;
  x.fillText(lbl,44,y+10);y+=16;
  x.font='750 33px '+FF;
  x.fillText(curSym()+' '+nfmt(Math.abs(t.bal)),44,y+30);y+=40;
  x.fillStyle=IMG.mut;x.font='550 12.5px '+FF;
  x.fillText('You gave '+nfmt(t.gave)+'   \u00B7   You got '+nfmt(t.got),44,y+14);y+=24;
  x.strokeStyle=IMG.line;x.beginPath();x.moveTo(44,y+6);x.lineTo(496,y+6);x.stroke();y+=18;
  if(!shown.length){
    x.fillStyle=IMG.mut;x.font='500 12px '+FF;
    x.fillText('No entries yet.',44,y+10);y+=24;
  }
  shown.forEach(function(e){
    y+=27;
    x.fillStyle=IMG.mut;x.font='550 10.5px '+FF;x.textAlign='left';
    x.fillText(fmtDate(e.ts),44,y);
    x.fillStyle=IMG.ink;x.font='600 12.5px '+FF;
    x.fillText(ellipsize(x,e.note||catById(e.categoryId).name,235),118,y);
    x.fillStyle=e.type==='out'?IMG.incol:IMG.outcol;
    x.font='700 12.5px '+FF;x.textAlign='right';
    x.fillText((e.type==='out'?'Gave ':'Got ')+nfmt(e.amount),496,y);
    x.textAlign='left';
  });
  if(more>0){
    y+=22;
    x.fillStyle=IMG.mut;x.font='550 11px '+FF;
    x.fillText('+ '+more+' earlier '+(more===1?'entry':'entries')+' \u2014 full statement in the app',44,y);
  }
  drawFooter(x,H);
  return cc.c;
}

/* ============ PIN lock & biometrics ============ */
var _imul=Math.imul||function(a,b){var ah=(a>>>16)&0xffff,al=a&0xffff,bh=(b>>>16)&0xffff,bl=b&0xffff;return (al*bl+(((ah*bl+al*bh)<<16)>>>0))|0;};
function fnv(str){
  var h=0x811c9dc5;
  for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=_imul(h,0x01000193)>>>0;}
  return h>>>0;
}
function pinHashOf(pin,salt){
  var h=fnv(salt+':'+pin);
  for(var i=0;i<1000;i++)h=fnv(salt+':'+h+':'+pin);
  return String(h);
}
function buildPad(el,cb){
  var keys=['1','2','3','4','5','6','7','8','9','','0','back'];
  el.innerHTML=keys.map(function(k){
    if(k==='')return '<button class="pkey blank" tabindex="-1"></button>';
    if(k==='back')return '<button class="pkey" data-k="back" aria-label="Delete digit"><svg class="ic"><use href="#i-back"/></svg></button>';
    return '<button class="pkey" data-k="'+k+'">'+k+'</button>';
  }).join('');
  el.addEventListener('click',function(e){
    var b=e.target.closest('[data-k]');
    if(b)cb(b.getAttribute('data-k'));
  });
}
function paintDots(el,n){
  $$('.pdot',el).forEach(function(d,i){d.classList.toggle('f',i<n);});
}
function shakeEl(el){
  el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');buzz(30);
}
var pinStage='verify',pinBuf='',pinFirst='',pinFlow='';
function openPinSheet(flow){
  pinFlow=flow||(S.settings.pinHash?'change':'new');
  pinBuf='';pinFirst='';
  if(S.settings.pinHash){
    pinStage='verify';
    if(pinFlow==='bio-off'){
      $('#pin-title').textContent='Biometric unlock';
      $('#pin-msg').textContent='Enter your PIN to turn biometrics off';
      $('#pin-off').classList.add('hidden');
    }else{
      $('#pin-title').textContent='Change PIN';
      $('#pin-msg').textContent='Enter your current PIN';
      $('#pin-off').classList.remove('hidden');
    }
  }else{
    pinStage='new1';pinFlow='new';
    $('#pin-title').textContent='Set app lock';
    $('#pin-msg').textContent='Choose a 4-digit PIN';
    $('#pin-off').classList.add('hidden');
  }
  paintDots($('#pin-dots'),0);
  openSheet('sheet-pin');
}
function pinKey(k){
  if(k==='back'){pinBuf=pinBuf.slice(0,-1);paintDots($('#pin-dots'),pinBuf.length);return;}
  if(pinBuf.length>=4)return;
  pinBuf+=k;paintDots($('#pin-dots'),pinBuf.length);
  if(pinBuf.length===4)setTimeout(handlePin,140);
}
function handlePin(){
  var st=S.settings;
  if(pinStage==='verify'){
    if(pinHashOf(pinBuf,st.pinSalt)!==st.pinHash){
      pinBuf='';paintDots($('#pin-dots'),0);
      $('#pin-msg').textContent='Wrong PIN \u2014 try again';
      shakeEl($('#pin-dots'));return;
    }
    pinBuf='';
    if(pinFlow==='off'){
      st.pinHash='';st.pinSalt='';st.bioCred='';save();
      closeSheet('sheet-pin');renderSettings();renderHome();
      toast('App lock is off');return;
    }
    if(pinFlow==='bio-off'){
      st.bioCred='';save();
      closeSheet('sheet-pin');renderSettings();
      toast('Biometric unlock is off');return;
    }
    pinStage='new1';paintDots($('#pin-dots'),0);
    $('#pin-msg').textContent='Choose a new 4-digit PIN';
    $('#pin-off').classList.add('hidden');
    return;
  }
  if(pinStage==='new1'){
    pinFirst=pinBuf;pinBuf='';pinStage='new2';
    paintDots($('#pin-dots'),0);
    $('#pin-msg').textContent='Enter it once more';
    return;
  }
  if(pinBuf!==pinFirst){
    pinBuf='';pinStage='new1';paintDots($('#pin-dots'),0);
    $('#pin-msg').textContent='They didn\u2019t match \u2014 choose a PIN';
    shakeEl($('#pin-dots'));return;
  }
  st.pinSalt=String(Date.now())+':'+Math.random().toString(36).slice(2,8);
  st.pinHash=pinHashOf(pinBuf,st.pinSalt);
  pinBuf='';save();
  closeSheet('sheet-pin');renderSettings();renderHome();
  toast('App lock is on');
}
$('#pin-off').addEventListener('click',function(){
  pinFlow='off';pinStage='verify';pinBuf='';
  paintDots($('#pin-dots'),0);
  $('#pin-msg').textContent='Enter current PIN to turn off';
  $('#pin-off').classList.add('hidden');
});
$('#row-lock').addEventListener('click',function(){if(!lockGate())return;openPinSheet();});
function b64u(buf){
  var b=new Uint8Array(buf),s='';
  for(var i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function ub64u(str){
  str=String(str).replace(/-/g,'+').replace(/_/g,'/');
  while(str.length%4)str+='=';
  var s=atob(str),b=new Uint8Array(s.length);
  for(var i=0;i<s.length;i++)b[i]=s.charCodeAt(i);
  return b.buffer;
}
function bioPlugin(){return capPlugin('NativeBiometric');}
function bioSupported(){
  if(IS_NATIVE)return !!bioPlugin();
  return !!(window.isSecureContext&&window.PublicKeyCredential&&navigator.credentials);
}
var bioReady=false;
function checkBio(cb){
  if(IS_NATIVE){
    var P=bioPlugin();if(!P){cb(false);return;}
    try{P.isAvailable().then(function(r){cb(!!(r&&r.isAvailable));},function(){cb(false);});}catch(e){cb(false);}
    return;
  }
  if(!bioSupported()){cb(false);return;}
  try{
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function(v){cb(!!v);},function(){cb(false);});
  }catch(e){cb(false);}
}
function rnd(n){
  var a=new Uint8Array(n);
  if(window.crypto&&crypto.getRandomValues)crypto.getRandomValues(a);
  else for(var i=0;i<n;i++)a[i]=Math.floor(Math.random()*256);
  return a;
}
function enableBio(){
  if(!S.settings.pinHash){
    toast('Set a PIN first \u2014 it stays as your fallback');
    openPinSheet();return;
  }
  if(IS_NATIVE){
    var P=bioPlugin();if(!P){toast('Biometrics not available on this device');return;}
    P.verifyIdentity({reason:'Confirm to turn on unlock',title:'Enable biometric unlock',useFallback:false}).then(function(){
      S.settings.bioCred='native';save();renderSettings();toast('Biometric unlock is on');
    },function(){toast('Couldn\u2019t verify \u2014 try again');});
    return;
  }
  navigator.credentials.create({publicKey:{
    challenge:rnd(32),
    rp:{name:'Cashbook'},
    user:{id:rnd(16),name:'cashbook',displayName:'Cashbook'},
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'preferred'},
    timeout:60000,attestation:'none'
  }}).then(function(cred){
    S.settings.bioCred=b64u(cred.rawId);save();
    renderSettings();toast('Biometric unlock is on');
  },function(){toast('Couldn\u2019t set up biometrics');});
}
function tryBio(cb){
  if(!S.settings.bioCred||!bioReady){cb(false);return;}
  if(IS_NATIVE){
    var P=bioPlugin();if(!P){cb(false);return;}
    try{P.verifyIdentity({reason:'Unlock Cashbook',title:'Unlock Cashbook',useFallback:false}).then(function(){cb(true);},function(){cb(false);});}catch(e){cb(false);}
    return;
  }
  try{
    navigator.credentials.get({publicKey:{
      challenge:rnd(32),
      allowCredentials:[{type:'public-key',id:ub64u(S.settings.bioCred)}],
      userVerification:'required',timeout:60000
    }}).then(function(){cb(true);},function(){cb(false);});
  }catch(e){cb(false);}
}
$('#row-bio').addEventListener('click',function(){
  if(!lockGate())return;
  if(!bioReady){toast(IS_NATIVE?'No fingerprint or face is set up on this phone yet':'Available once you open the installed app (needs HTTPS)');return;}
  if(S.settings.bioCred)openPinSheet('bio-off');
  else enableBio();
});
var lockBuf='',lockShownAt=0,lockBioTried=false;
function showLock(){
  lockBuf='';lockBioTried=false;lockShownAt=Date.now();
  $('#lock-msg').textContent='Enter your PIN';
  paintDots($('#lock-dots'),0);
  $('#lock').classList.add('show');
  var canBio=!!(S.settings.bioCred&&bioReady);
  $('#lock-bio').classList.toggle('hidden',!canBio);
  if(canBio)setTimeout(function(){
    if(lockBioTried||!$('#lock').classList.contains('show'))return;
    lockBioTried=true;
    tryBio(function(ok){if(ok)hideLock();else $('#lock-msg').textContent='Use your PIN';});
  },350);
}
function hideLock(){$('#lock').classList.remove('show');buzz();}
function lockKey(k){
  if(k==='back'){lockBuf=lockBuf.slice(0,-1);paintDots($('#lock-dots'),lockBuf.length);return;}
  if(lockBuf.length>=4)return;
  lockBuf+=k;paintDots($('#lock-dots'),lockBuf.length);
  if(lockBuf.length===4)setTimeout(function(){
    if(pinHashOf(lockBuf,S.settings.pinSalt)===S.settings.pinHash)hideLock();
    else{
      lockBuf='';paintDots($('#lock-dots'),0);
      $('#lock-msg').textContent='Wrong PIN \u2014 try again';
      shakeEl($('#lock-dots'));
    }
  },140);
}
$('#lock-bio').addEventListener('click',function(){
  tryBio(function(ok){if(ok)hideLock();else $('#lock-msg').textContent='Use your PIN';});
});
$('#lock-forgot').addEventListener('click',function(){
  var dlg=$('#dlg-confirm');
  dlg.style.zIndex='130';
  confirmDlg({title:'Forgot PIN?',msg:'The only way back in is to erase everything and start fresh. Restore a backup afterwards if you have one.',word:'ERASE',okLabel:'Erase everything',danger:true}).then(function(ok){
    dlg.style.zIndex='';
    if(!ok)return;
    wipeAll();hideLock();toast('All data erased');
  });
});
var hiddenAt=0;
document.addEventListener('visibilitychange',function(){
  if(document.hidden){hiddenAt=Date.now();return;}
  try{enforceEntitlement();}catch(e){}
  if(S.settings.pinHash&&hiddenAt&&Date.now()-hiddenAt>120000&&!$('#lock').classList.contains('show'))showLock();
});

/* ============ sample data ============ */
function loadSample(){
  if(!lockGate())return;
  var now=Date.now(),bid=uid('b'),pid=uid('p');
  S.books.push({id:bid,name:'Karachi General Store',created:now,opening:500000});
  S.parties.push({id:pid,name:'Ali Traders',phone:'0300-1234567',created:now});
  function ago(d,h){return now-d*86400000+(h||0)*3600000;}
  var rows=[
    ['in',2500000,'sales','Cash','Day sales',20],
    ['out',450000,'purchase','Online','Stock from wholesale market',19],
    ['out',120000,'transport','Cash','Loader rickshaw',19],
    ['in',1800000,'sales','Online','Card & wallet sales',16],
    ['out',300000,'utilities','Online','Electricity bill',14],
    ['out',5000,'food','Cash','Chai for shop',12],
    ['in',2200000,'sales','Cash','Day sales',11],
    ['out',500000,'purchase','Cash','Vegetables & dairy restock',10],
    ['out',80000,'food','Cash','Staff lunch',8],
    ['in',950000,'sales','Cash','Weekend rush',6],
    ['out',5000,'food','Cash','Chai for shop',5],
    ['out',250000,'transport','Online','Fuel for delivery bike',4],
    ['in',1500000,'sales','Online','Online orders',2],
    ['out',60000,'other','Cash','Shop repairs',1],
    ['in',700000,'sales','Cash','Morning sales',0,-3]
  ];
  rows.forEach(function(r){
    S.entries.push({id:uid('e'),bookId:bid,type:r[0],amount:r[1],categoryId:r[2],mode:r[3],note:r[4],ts:ago(r[5],r[6]||0),created:now});
  });
  S.entries.push({id:uid('e'),bookId:bid,type:'out',amount:500000,categoryId:'other',mode:'Cash',note:'Loan to Ali Traders',ts:ago(9),created:now,partyId:pid});
  S.entries.push({id:uid('e'),bookId:bid,type:'in',amount:200000,categoryId:'other',mode:'Cash',note:'Part payment back',ts:ago(3),created:now,partyId:pid});
  S.transfers.push({id:uid('x'),dir:'c2b',amount:1000000,ts:ago(2),note:'Deposited at branch',created:now});
  S.budgets.push({bookId:bid,categoryId:'food',amount:800000});
  var nm=new Date();nm=new Date(nm.getFullYear(),nm.getMonth()+1,1,10,0);
  S.recurring.push({id:uid('r'),bookId:bid,type:'out',amount:3000000,categoryId:'rent',mode:'Cash',note:'Shop rent',freq:'monthly',nextTs:nm.getTime(),day:1,paused:false});
  S.templates.push({id:uid('t'),bookId:bid,type:'out',amount:20000,categoryId:'food',mode:'Cash',note:'Chai'});
  S.settings.lastBook=bid;
  S.settings.cashBookId=bid;
  save();renderHome();
  toast('Sample data loaded \u2014 explore freely');
  openBook(bid);
}
$('#btn-sample').addEventListener('click',loadSample);

/* ============ keyboard shortcuts ============ */
document.addEventListener('keydown',function(e){
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  if($('#lock').classList.contains('show')||openStack.length)return;
  var tag=(e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='select'||tag==='textarea')return;
  var v=activeViewId();
  if(e.key==='/'){
    if(v==='view-home'){e.preventDefault();$('#home-searchrow').classList.remove('hidden');$('#home-search').focus();}
    else if(v==='view-book'){e.preventDefault();$('#search-input').focus();}
    return;
  }
  if(v==='view-book'){
    if(e.key==='i'){e.preventDefault();openEntrySheet({type:'in',book:currentBook});}
    else if(e.key==='o'){e.preventDefault();openEntrySheet({type:'out',book:currentBook});}
    return;
  }
  if(ROOT[v]){
    if(e.key==='n'){e.preventDefault();openEntrySheet({});}
    else if(e.key==='b'&&v==='view-home'){e.preventDefault();openBookSheet(null);}
  }
});

/* ============ service worker & boot ============ */
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  try{navigator.serviceWorker.register('./sw.js').catch(function(){});}catch(e){}
}
/* ============ custom native-feeling selects & date pickers ============ */
var MONTHS_FULL=['January','February','March','April','May','June','July','August','September','October','November','December'];
var DOW_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function selText(sel){var o=sel.options[sel.selectedIndex];return o?o.textContent:'';}
function makeTrigger(cls,icon){
  var b=document.createElement('button');
  b.type='button';b.className=cls;
  b.innerHTML='<span class="sbtxt"></span><svg class="ic"><use href="#'+icon+'"/></svg>';
  return b;
}
function syncControls(root){
  root=root||document;
  $$('select.enhanced',root).forEach(function(s){if(s._sync)s._sync();});
  $$('input.enhanced',root).forEach(function(i){if(i._sync)i._sync();});
}
var pickTarget=null;
function enhanceSelect(sel){
  if(sel._enh)return;sel._enh=true;
  sel.classList.add('enhanced');
  var btn=makeTrigger('selectbtn','i-chev');
  sel.parentNode.insertBefore(btn,sel.nextSibling);
  sel._btn=btn;
  sel._sync=function(){
    btn.classList.toggle('hidden',sel.classList.contains('hidden'));
    var t=selText(sel);
    var span=btn.querySelector('.sbtxt');
    span.textContent=t||'Select';
    span.classList.toggle('ph',!t);
  };
  btn.addEventListener('click',function(){openSelectPicker(sel);});
  new MutationObserver(sel._sync).observe(sel,{childList:true,attributes:true,subtree:true});
  sel.addEventListener('change',sel._sync);
  sel._sync();
}
function openSelectPicker(sel){
  pickTarget=sel;
  var lbl='';
  if(sel.id){var lf=document.querySelector('label[for="'+sel.id+'"]');if(lf)lbl=lf.textContent;}
  if(!lbl)lbl=sel.getAttribute('aria-label')||'';
  if(!lbl){var f=sel.closest('.field');if(f){var l=f.querySelector('label');if(l)lbl=l.textContent;}}
  if(!lbl){var sr=sel.closest('.srow');if(sr){var sl=sr.querySelector('.sl');if(sl)lbl=sl.textContent;}}
  $('#pick-title').textContent=lbl||'Choose';
  var cur=sel.value;
  var opts=Array.prototype.map.call(sel.options,function(o){
    var isNew=o.value==='__new',on=(o.value===cur&&!isNew);
    return '<button class="pickopt'+(on?' on':'')+(isNew?' newopt':'')+'" data-v="'+esc(o.value)+'">'+esc(o.textContent)+(on?'<svg class="ic"><use href="#i-check"/></svg>':'')+'</button>';
  }).join('');
  var searchable=sel.options.length>8;
  $('#pick-list').innerHTML=(searchable?'<div class="searchbox" id="pick-search-wrap"><svg class="ic"><use href="#i-search"/></svg><input id="pick-search" type="search" placeholder="Search" autocomplete="off"></div>':'')+
    '<div id="pick-opts">'+opts+'</div>';
  if(searchable){
    $('#pick-search').addEventListener('input',function(){
      var q=this.value.trim().toLowerCase();
      $$('#pick-opts .pickopt').forEach(function(o){o.classList.toggle('hidden',q&&o.textContent.toLowerCase().indexOf(q)<0);});
    });
    focusAfterOpen('sheet-pick','#pick-search');
  }
  openSheet('sheet-pick');
}
$('#pick-list').addEventListener('click',function(e){
  var b=e.target.closest('[data-v]');if(!b||!pickTarget)return;
  var sel=pickTarget,v=b.getAttribute('data-v');
  closeSheet('sheet-pick');
  sel.value=v;
  sel.dispatchEvent(new Event('change',{bubbles:true}));
  if(sel._sync)sel._sync();
});
var dateTarget=null,calY=0,calM=0;
function enhanceDate(inp){
  if(inp._enh)return;inp._enh=true;
  inp.classList.add('enhanced');
  var btn=makeTrigger('datebtn','i-cal');
  inp.parentNode.insertBefore(btn,inp.nextSibling);
  inp._btn=btn;
  inp._sync=function(){
    btn.classList.toggle('hidden',inp.classList.contains('hidden'));
    var span=btn.querySelector('.sbtxt');
    if(inp.value){var p=inp.value.split('-');span.textContent=fmtDate(new Date(+p[0],+p[1]-1,+p[2]).getTime());span.classList.remove('ph');}
    else{span.textContent='Select date';span.classList.add('ph');}
  };
  btn.addEventListener('click',function(){openCalendar(inp);});
  inp.addEventListener('change',inp._sync);
  new MutationObserver(inp._sync).observe(inp,{attributes:true});
  inp._sync();
}
function openCalendar(inp){
  dateTarget=inp;
  var d;
  if(inp.value){var p=inp.value.split('-');d=new Date(+p[0],+p[1]-1,+p[2]);}else d=new Date();
  calY=d.getFullYear();calM=d.getMonth();
  renderCalendar();
  openSheet('sheet-cal');
}
function renderCalendar(){
  var first=new Date(calY,calM,1),start=(first.getDay()-S.settings.firstDay+7)%7;
  var days=new Date(calY,calM+1,0).getDate();
  var sel=(dateTarget&&dateTarget.value)?dateTarget.value:'';
  var todayK=dateInputVal(new Date());
  $('#cal-title').textContent=MONTHS_FULL[calM]+' '+calY;
  var cells=[];
  for(var i=0;i<7;i++)cells.push('<div class="cal-dow">'+DOW_SHORT[(S.settings.firstDay+i)%7]+'</div>');
  for(var e=0;e<start;e++)cells.push('<div class="cal-cell empty"></div>');
  for(var day=1;day<=days;day++){
    var key=calY+'-'+pad(calM+1)+'-'+pad(day);
    var cls='cal-cell';if(key===sel)cls+=' sel';else if(key===todayK)cls+=' today';
    cells.push('<button class="'+cls+'" data-d="'+key+'">'+day+'</button>');
  }
  $('#cal-grid').innerHTML=cells.join('');
}
function pickDate(key){
  if(!dateTarget)return;
  dateTarget.value=key;
  dateTarget.dispatchEvent(new Event('change',{bubbles:true}));
  if(dateTarget._sync)dateTarget._sync();
  closeSheet('sheet-cal');
}
$('#cal-prev').addEventListener('click',function(){calM--;if(calM<0){calM=11;calY--;}renderCalendar();});
$('#cal-next').addEventListener('click',function(){calM++;if(calM>11){calM=0;calY++;}renderCalendar();});
$('#cal-today').addEventListener('click',function(){pickDate(dateInputVal(new Date()));});
$('#cal-grid').addEventListener('click',function(e){var b=e.target.closest('[data-d]');if(b)pickDate(b.getAttribute('data-d'));});
function enhanceAllControls(){
  $$('select').forEach(enhanceSelect);
  $$('input[type="date"]').forEach(enhanceDate);
}


/* ============ licensing & trial (Ed25519 verified) ============ */
var LIC_PUB_HEX="4d5a2188d5f70a1b1ed7bef71d5a2892577af067a0e95e7b39cb54e028f587df";
var LIC_CHANNEL="direct";
var LIC_WHATSAPP="923000243095";
var LIC_TRIAL_DAYS=7;
var LKEY="cashbook.lic.v1";
var LIC=null;
function licLoad(){try{LIC=JSON.parse(localStorage.getItem(LKEY))||{};}catch(e){LIC={};}if(typeof LIC!=="object"||!LIC)LIC={};}
function licSave(){try{localStorage.setItem(LKEY,JSON.stringify(LIC));}catch(e){}}
function b32decode(str){
  var M="0123456789ABCDEFGHJKMNPQRSTVWXYZ",R={};for(var i=0;i<M.length;i++)R[M[i]]=i;
  var bits=0,val=0,out=[];
  for(var j=0;j<str.length;j++){var c=R[str[j]];if(c===undefined)continue;val=(val<<5)|c;bits+=5;if(bits>=8){out.push((val>>>(bits-8))&255);bits-=8;}}
  return new Uint8Array(out);
}
var _licPub=null;
function licPubKey(){
  if(_licPub)return _licPub;
  var raw=new Uint8Array(32);for(var i=0;i<32;i++)raw[i]=parseInt(LIC_PUB_HEX.substr(i*2,2),16);
  _licPub=crypto.subtle.importKey("raw",raw,{name:"Ed25519"},false,["verify"]);
  return _licPub;
}
function licTodayNum(){var d=new Date();return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();}
async function licVerifyKey(key){
  try{
    var body=String(key||"").toUpperCase().replace(/[^0-9A-HJ-NP-TV-Z]/g,"").replace(/^CB/,"");
    var all=b32decode(body);
    if(all.length<66)return {valid:false};
    var sig=all.slice(all.length-64),payloadBuf=all.slice(0,all.length-64);
    var ok=await crypto.subtle.verify({name:"Ed25519"},await licPubKey(),sig,payloadBuf);
    if(!ok)return {valid:false};
    var parts=new TextDecoder().decode(payloadBuf).split("|");
    if(parts[0]!=="V1")return {valid:false};
    var type=parts[1],exp=parts[2];
    if(type==="L")return {valid:true,type:"lifetime",exp:"0"};
    if(type==="M"){if(parseInt(exp,10)<licTodayNum())return {valid:false,expired:true};return {valid:true,type:"monthly",exp:exp};}
    return {valid:false};
  }catch(e){return {valid:false};}
}
function licState(){
  licLoad();
  var now=Date.now();
  if(!LIC.t0)LIC.t0=now;
  /* remember the latest time we have ever seen, so setting the phone clock
     backwards cannot extend the trial */
  if(!LIC.seen||now>LIC.seen)LIC.seen=now;
  licSave();
  if(LIC.key&&LIC.type){
    if(LIC.type==="lifetime")return {s:"unlocked"};
    if(LIC.type==="monthly"&&LIC.exp&&parseInt(LIC.exp,10)>=licTodayNum())return {s:"unlocked"};
  }
  var eff=Math.max(now,LIC.seen);
  var days=Math.floor((eff-LIC.t0)/86400000);
  var left=LIC_TRIAL_DAYS-days;
  if(left>LIC_TRIAL_DAYS)left=LIC_TRIAL_DAYS;
  if(left>0)return {s:"trial",left:left};
  return {s:"locked",expiredMonthly:(LIC.type==="monthly")};
}
function licShowPaywall(expiredMonthly){
  var pw=$("#paywall");if(!pw)return;
  $("#pw-title").textContent=expiredMonthly?"Your subscription expired":"Your free trial has ended";
  if(LIC_CHANNEL==="play"){
    $("#pw-buy").textContent="Subscribe / Restore";
    $("#pw-haskey").style.display="none";
    $("#pw-foot").textContent="Manage your subscription anytime in Google Play. Your data stays safe on your device.";
  }else{
    $("#pw-buy").textContent="Unlock on WhatsApp";
    $("#pw-foot").textContent="Pay by Easypaisa, JazzCash or bank transfer \u2014 message us and we\u2019ll send your key instantly. Your entries stay safe on your device.";
  }
  pw.classList.add("show");
}
function licHidePaywall(){var pw=$("#paywall");if(pw)pw.classList.remove("show");}
function licUpdateBanner(){
  var st=licState(),b=$("#trial-banner");if(!b)return;
  if(st.s==="trial"){
    b.innerHTML="Free trial \u2014 "+st.left+" day"+(st.left===1?"":"s")+" left. <b id=\"tb-unlock\">Unlock</b>";
    b.classList.add("show");
    var u=$("#tb-unlock");if(u)u.onclick=function(){licShowPaywall(false);};
  }else b.classList.remove("show");
}
function licLocked(){return licState().s==="locked";}
var pwDismissed=false;
/* Gate every write/export: returns true when allowed, false (and re-asserts the
   paywall) when the trial has ended. View-only = browse data, no writes, no exports. */
function lockGate(){
  if(licLocked()){pwDismissed=false;licShowPaywall(licState().expiredMonthly);return false;}
  return true;
}
function enforceEntitlement(){
  var st=licState(),locked=st.s==="locked";
  document.documentElement.classList.toggle("locked",locked);
  if(locked){if(!pwDismissed)licShowPaywall(st.expiredMonthly);}
  else{pwDismissed=false;licHidePaywall();}
  licUpdateBanner();
}
function licWhatsAppLink(){
  var msg="Assalam o Alaikum! I want to unlock Cashbook.%0A%0APlan: (Lifetime Rs 5000 / Monthly Rs 500)%0AI will pay by: (Easypaisa / JazzCash / Bank)";
  return "https://wa.me/"+LIC_WHATSAPP+"?text="+msg;
}
function licInit(){
  licLoad();
  $("#pw-close").addEventListener("click",function(){pwDismissed=true;licHidePaywall();});
  $("#pw-haskey").addEventListener("click",function(){$("#pw-keyrow").classList.toggle("show");var k=$("#pw-key");if(k)k.focus();});
  $("#pw-buy").addEventListener("click",function(){
    if(LIC_CHANNEL==="play"){if(typeof playPurchase==="function")playPurchase();}
    else{window.open(licWhatsAppLink(),"_blank");}
  });
  $("#pw-activate").addEventListener("click",async function(){
    var key=$("#pw-key").value.trim();
    $("#pw-err").textContent="";
    var r=await licVerifyKey(key);
    if(!r.valid){$("#pw-err").textContent=r.expired?"This key has expired.":"Invalid key. Check and try again.";return;}
    LIC.key=key;LIC.type=r.type;LIC.exp=r.exp;licSave();
    licHidePaywall();licUpdateBanner();
    toast(r.type==="lifetime"?"Unlocked forever \u2014 thank you!":"Unlocked \u2014 thank you!");
  });
  enforceEntitlement();
  setTimeout(checkForUpdate,1500);
}

/* ===== hardware / gesture back: navigate within the app instead of exiting ===== */
function appGoBack(){
  if($('#viewer').classList.contains('show')){$('#viewer').classList.remove('show');return true;}
  if($('#paywall').classList.contains('show')){pwDismissed=true;licHidePaywall();return true;}
  if(openStack.length){closeTop();return true;}
  if(sel.on){exitSel();return true;}
  var v=activeViewId();
  if(!ROOT[v]){goBack(v);return true;}
  if(v!=='view-home'){goTab('view-home');return true;}
  return false;
}
/* ---- Android soft keyboard ----
   The Keyboard plugin is configured resize:"none" (capacitor.config.json), so opening the
   keyboard no longer resizes the WebView. That resize was the entry-form flicker: Android
   shrank the whole web view frame-by-frame over the keyboard animation, repainting a
   full-screen fixed sheet every frame. Nothing resizes now — so the page makes room
   itself: publish the keyboard height as --kb (CSS lifts sheets / pads scroll bodies by
   it) and bring the focused field into view. No-ops on web, where there is no plugin. */
function initKeyboard(){
  var KB=capPlugin('Keyboard');
  if(!KB||!KB.addListener)return;
  function setKB(px){
    var v=(typeof px==='number'&&isFinite(px)&&px>0)?Math.round(px):0;
    document.documentElement.style.setProperty('--kb',v+'px');
  }
  function reveal(){
    var el=document.activeElement;
    if(!el||!el.scrollIntoView)return;
    var tag=(el.tagName||'').toLowerCase();
    if(tag!=='input'&&tag!=='textarea')return;
    /* instant, not smooth — a scroll animation running as the keyboard slides in is
       exactly the kind of overlapping motion we just removed */
    try{el.scrollIntoView({block:'center'});}catch(e){try{el.scrollIntoView();}catch(e2){}}
  }
  KB.addListener('keyboardWillShow',function(info){setKB(info&&info.keyboardHeight);});
  KB.addListener('keyboardDidShow',reveal);
  KB.addListener('keyboardWillHide',function(){setKB(0);});
}
function initBackButton(){
  var App=capPlugin('App');
  if(App&&App.addListener){
    App.addListener('backButton',function(){ if(!appGoBack()&&App.exitApp)App.exitApp(); });
  }
  // web / PWA: drive the browser back button through the same in-app navigation
  try{history.pushState({cb:1},'');}catch(e){}
  window.addEventListener('popstate',function(){
    if(appGoBack()){try{history.pushState({cb:1},'');}catch(e){}}
  });
}
function boot(){
  licInit();
  applyTheme();
  purgeTrash();
  buildPad($('#pin-pad'),pinKey);
  buildPad($('#lock-pad'),lockKey);
  enhanceAllControls();
  renderSettings();
  renderHome();
  if(S.settings.pinHash)showLock();
  var posted=runRecurring();
  if(posted)renderHome();
  showView('view-home');
  initTilt();
  initKeyboard();
  initBackButton();
  checkBio(function(v){
    bioReady=v;
    renderSettings();
    if($('#lock').classList.contains('show'))
      $('#lock-bio').classList.toggle('hidden',!(S.settings.bioCred&&bioReady));
  });
}
boot();
})();
