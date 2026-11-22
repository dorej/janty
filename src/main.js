import "./style.css";
import { AVATARS, DECKS, BLACK_CARDS, RANKS, SUITS, ACCENTS } from "./data.js";

var STORE = "chardee_firepit_v1";
var DEVICE_STORE = "chardee_device_v1";
var SYNC_STORE = "chardee_sync_v1";
var S = null;
var timerId = null;
var warDanceTimer = null;

function el(html){ var d=document.createElement("div"); d.innerHTML=html.trim(); return d.firstElementChild; }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]; }); }
function byId(id){ return document.getElementById(id); }

function defaultConfig(){
  return { cardsPerLevel:3, timerMin:0, levelNames:["Mind","Body","Spirit"] };
}

function deviceId(){
  var id = null;
  try{ id = localStorage.getItem(DEVICE_STORE); }catch(e){}
  if(!id){
    id = "d-" + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
    try{ localStorage.setItem(DEVICE_STORE, id); }catch(e){}
  }
  return id;
}
var MYID = deviceId();
var LOCAL_PHASES = ["setup","ritual","play","over"];

function makeRoom(){
  var A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
  for(var i=0;i<4;i++){ s += A[Math.floor(Math.random()*A.length)]; }
  return "JANTY-" + s;
}

function baseState(){
  return {
    room:"", hostId:"", phase:"welcome", started:false,
    players:[],
    config:defaultConfig(),
    active:0, turn:1, log:[], card:null, steal:false,
    decks:{1:[],2:[],3:[]}, finishedOrder:[],
    timer:{total:0, remaining:0, running:false, endAt:0},
    black:{}, warDance:null, pause:null,
    modal:null, ui:{}
  };
}

function uid(){ return "p" + Math.random().toString(36).slice(2,9); }
function newPlayer(dev, name, avatar){
  return {id:uid(), deviceId:dev, name:name||"", avatar:avatar||"🔥", team:"", level:0, cards:0,
    skipNext:false, jail:false, accent:"", timeouts:3, done:false, place:null};
}

function freshRoom(room, hostId){
  var s = baseState();
  s.phase = "lobby"; s.room = room; s.hostId = hostId;
  return s;
}

function freshLocal(){
  var s = baseState();
  s.phase = "setup";
  s.players = [ newPlayer("local","Nancy","🦊"), newPlayer("local","Tyler","🐻"), newPlayer("local","Jerod","🐺") ];
  return s;
}

function me(){ return S.players.find(function(p){ return p.deviceId===MYID; }) || null; }
function isLocal(){ return !S.room; }
function isMyTurn(){
  if(isLocal()) return true;
  var a = S.players[S.active];
  return !!(a && a.deviceId===MYID);
}
function isHost(){ return !isLocal() && S.hostId===MYID; }
function randomAvatar(){ return AVATARS[Math.floor(Math.random()*AVATARS.length)]; }
function inviteLink(){ return location.origin + location.pathname + "?room=" + encodeURIComponent(S.room); }

function save(push){
  try{ localStorage.setItem(STORE, JSON.stringify(S)); }catch(e){}
  if(push!==false) GunRef.push();
}
function load(){ try{ return JSON.parse(localStorage.getItem(STORE)); }catch(e){ return null; } }
function clearSave(){ try{ localStorage.removeItem(STORE); }catch(e){} }

function addLog(msg){
  var stamp = new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  S.log.unshift(stamp + " — " + msg);
  if(S.log.length>40) S.log.length=40;
}

function beep(freq, dur){
  try{
    var ctx = beep.ctx || (beep.ctx = new (window.AudioContext||window.webkitAudioContext)());
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; o.type = "sine";
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.25, ctx.currentTime+.01);
    g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime+dur);
    o.start(); o.stop(ctx.currentTime+dur+.02);
  }catch(e){}
}

var NOTE_BASE = {C:0,"C#":1,D:2,"D#":3,E:4,F:5,"F#":6,G:7,"G#":8,A:9,"A#":10,B:11};
function noteFreq(name){
  var m = /^([A-G]#?)(\d)$/.exec(name);
  if(!m) return 440;
  var semi = NOTE_BASE[m[1]] + (parseInt(m[2],10)+1)*12;
  return 440 * Math.pow(2, (semi-69)/12);
}

var MELODIES = [
  {name:"Ode to Joy", tempo:0.42, notes:["E4","E4","F4","G4","G4","F4","E4","D4","C4","C4","D4","E4","E4","D4","D4","D4"]},
  {name:"Für Elise", tempo:0.27, notes:["E5","D#5","E5","D#5","E5","B4","D5","C5","A4","C4","E4","A4","B4","E4","G#4","B4","C5"]},
  {name:"Minuet in G", tempo:0.32, notes:["D5","G4","A4","B4","C5","D5","G4","G4","E5","C5","D5","E5","F#5","G5","G4","G4"]},
  {name:"Eine kleine Nachtmusik", tempo:0.30, notes:["G4","D4","G4","D4","G4","D4","G4","B4","D5","C5","A4","C5","A4","F#4","A4","D5"]}
];

var Music = {
  ctx:null, gain:null, playing:false, loop:null, muted:false, current:"",
  init:function(){
    if(this.ctx) return;
    try{
      this.ctx = new (window.AudioContext||window.webkitAudioContext)();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.45;
      this.gain.connect(this.ctx.destination);
    }catch(e){ this.ctx = null; }
  },
  voice:function(freq, start, dur, vol, type){
    var ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; o.connect(g); g.connect(this.gain);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start+0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, start+dur);
    o.start(start); o.stop(start+dur+0.05);
  },
  schedule:function(mel){
    if(!this.ctx) return;
    var ctx = this.ctx, t0 = ctx.currentTime + 0.08, t = t0;
    for(var k=0;k<mel.notes.length;k++){
      var f = noteFreq(mel.notes[k]);
      this.voice(f, t, mel.tempo*0.92, 0.16, "triangle");
      this.voice(f/2, t, mel.tempo*0.92, 0.06, "sine");
      t += mel.tempo;
    }
    var total = t - t0, self = this;
    this.loop = setTimeout(function(){ if(self.playing) self.schedule(self._mel); }, total*1000 + 300);
  },
  start:function(){
    this.init();
    if(!this.ctx) return;
    if(this.ctx.state==="suspended"){ this.ctx.resume(); }
    this.gain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.gain.gain.setValueAtTime(0.45, this.ctx.currentTime);
    this.playing = true;
    this._mel = MELODIES[Math.floor(Math.random()*MELODIES.length)];
    this.current = this._mel.name;
    this.schedule(this._mel);
  },
  stop:function(){
    this.playing = false;
    if(this.loop){ clearTimeout(this.loop); this.loop = null; }
    if(this.ctx && this.gain){
      try{
        this.gain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gain.gain.setValueAtTime(this.gain.gain.value, this.ctx.currentTime);
        this.gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime+0.15);
      }catch(e){}
    }
  },
  toggle:function(){
    if(this.playing){ this.muted = true; this.stop(); }
    else { this.muted = false; this.start(); }
  }
};

function syncMusic(){
  if(S.phase==="ritual"){
    if(!Music.playing && !Music.muted) Music.start();
  } else if(Music.playing){
    Music.stop();
  }
}

/* ---------- multiplayer sync (gun.js) ---------- */

var SYNC_FIELDS = ["room","hostId","phase","started","players","config","active","turn","log","card","steal","decks","finishedOrder","timer","black","warDance","pause"];
var DEFAULT_RELAYS = [
  "https://gun.ankush.one/gun",
  "https://gun.defucc.me/gun"
];

var GunRef = {
  gun:null, node:null, ready:false, status:"off", last:{}, received:false, pending:false,
  cfg:function(){
    try{ return JSON.parse(localStorage.getItem(SYNC_STORE)) || {}; }catch(e){ return {}; }
  },
  saveCfg:function(c){ try{ localStorage.setItem(SYNC_STORE, JSON.stringify(c)); }catch(e){} },
  load:function(cb){
    if(window.Gun) return cb(null);
    import("gun").then(function(mod){
      window.Gun = mod.default || mod;
      cb(window.Gun ? null : "Gun failed to initialise.");
    }).catch(function(){
      cb("Could not load Gun.js — are you online?");
    });
  },
  connect:function(room, relays, cb){
    var self = this;
    self.status = "connecting"; self.ready = false; self.received = false; self.last = {};
    self.load(function(err){
      if(err){ self.status = "error"; cb(err); return; }
      var peers = (relays && relays.length) ? relays : DEFAULT_RELAYS;
      try{ self.gun = Gun({peers:peers}); }
      catch(e){ self.status = "error"; cb("Could not start Gun."); return; }
      self.node = self.gun.get("janty-rooms").get(room);
      SYNC_FIELDS.forEach(function(f){
        self.node.get(f).on(function(data){
          if(typeof data !== "string") return;
          if(data === self.last[f]) return;
          self.last[f] = data;
          var val; try{ val = JSON.parse(data); }catch(e){ return; }
          if(f === "players"){
            var merged = mergePlayers(S.players, val);
            var changed = JSON.stringify(merged) !== JSON.stringify(val);
            S.players = merged;
            self.received = true;
            if(changed) self.pushField("players");
          } else if(f === "log"){
            var mlog = mergeLog(S.log, val);
            var lchanged = JSON.stringify(mlog) !== JSON.stringify(val);
            S.log = mlog;
            self.received = true;
            if(lchanged) self.pushField("log");
          } else {
            S[f] = val;
            self.received = true;
          }
          self.scheduleRender();
        });
      });
      self.ready = true;
      self.status = "on";
      self.saveCfg({room:room, relays:peers});
      setTimeout(function(){
        if(!self.received){ S = freshRoom(room, MYID); self.push(true); }
        registerMe();
        render();
        ensureClock();
      }, 1000);
      cb(null);
    });
  },
  pushField:function(f){
    if(!this.ready || !this.node) return;
    var json; try{ json = JSON.stringify(S[f]); }catch(e){ return; }
    if(this.last[f] !== json){ this.last[f] = json; this.node.get(f).put(json); }
  },
  push:function(force){
    if(!this.ready || !this.node) return;
    for(var i=0;i<SYNC_FIELDS.length;i++){
      var f = SYNC_FIELDS[i], json;
      try{ json = JSON.stringify(S[f]); }catch(e){ continue; }
      if(force || this.last[f] !== json){
        this.last[f] = json;
        this.node.get(f).put(json);
      }
    }
  },
  scheduleRender:function(){
    var self = this;
    if(self.pending) return;
    self.pending = true;
    setTimeout(function(){ self.pending = false; render(); ensureClock(); }, 60);
  },
  disconnect:function(){
    this.ready = false; this.status = "off";
    var n = this.node;
    if(n){ SYNC_FIELDS.forEach(function(f){ try{ n.get(f).off(); }catch(e){} }); }
    this.node = null; this.last = {};
    this.saveCfg({room:"", relays:[]});
  }
};

function registerMe(){
  if(isLocal()) return;
  if(S.phase!=="lobby" && S.phase!=="play") return;
  if(me()) return;
  var p = newPlayer(MYID, "", randomAvatar());
  S.players.push(p);
  addLog("A challenger entered the room.");
  save();
}

function mergePlayers(local, remote){
  var byDev = {}, out = [], seen = {};
  (local||[]).forEach(function(p){ if(p && p.deviceId) byDev[p.deviceId] = p; });
  (remote||[]).forEach(function(rp){
    if(!rp || !rp.deviceId) return;
    if(rp.deviceId === MYID) return;
    byDev[rp.deviceId] = Object.assign({}, byDev[rp.deviceId]||{}, rp);
  });
  (local||[]).forEach(function(p){ if(p && p.deviceId && !seen[p.deviceId]){ seen[p.deviceId]=1; out.push(byDev[p.deviceId]); } });
  (remote||[]).forEach(function(rp){ if(rp && rp.deviceId && !seen[rp.deviceId]){ seen[rp.deviceId]=1; out.push(byDev[rp.deviceId]); } });
  return out;
}

function mergeLog(local, remote){
  var seen = {}, out = [];
  (remote||[]).forEach(function(l){ if(typeof l==="string" && !seen[l]){ seen[l]=1; out.push(l); } });
  (local||[]).forEach(function(l){ if(typeof l==="string" && !seen[l]){ seen[l]=1; out.push(l); } });
  if(out.length>40) out.length = 40;
  return out;
}

function syncLabel(){
  if(GunRef.status==="on") return "📡 Connected";
  if(GunRef.status==="connecting") return "📡 Connecting…";
  if(GunRef.status==="error") return "📡 Offline";
  return "📡 Multiplayer";
}

function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

function activePlayer(){ return S.players[S.active]; }
function required(){ return S.config.cardsPerLevel; }
function levelLabel(i){ return S.config.levelNames[i] || ("Level "+(i+1)); }

function drawCard(){
  var lvl = activePlayer().level + 1;
  if(!S.decks[lvl] || !S.decks[lvl].length){ S.decks[lvl] = shuffle(DECKS[lvl].slice()); }
  return S.decks[lvl].pop();
}

/* ---------- rendering ---------- */

function render(){
  if(!S) S = baseState();
  var root = byId("root");
  var footer = byId("footer");
  var clock = byId("clock");
  var roomTag = byId("roomTag");

  if(S.phase==="welcome"){ root.innerHTML = viewWelcome(); footer.hidden = true; clock.hidden = true; }
  else if(S.phase==="connecting"){ root.innerHTML = viewConnecting(); footer.hidden = true; clock.hidden = true; }
  else if(S.phase==="lobby"){ root.innerHTML = viewLobby(); footer.hidden = true; clock.hidden = true; }
  else if(S.phase==="setup"){ root.innerHTML = viewSetup(); footer.hidden = true; clock.hidden = true; }
  else if(S.phase==="ritual"){ root.innerHTML = viewRitual(); footer.hidden = true; }
  else if(S.phase==="play"){ root.innerHTML = viewPlay(); footer.hidden = false; renderFooter(); }
  else if(S.phase==="over"){ root.innerHTML = viewOver(); footer.hidden = true; }

  if(S.phase==="play" && S.config.timerMin>0){ clock.hidden = false; }
  else { clock.hidden = true; }

  if(roomTag){
    if(S.room && S.phase!=="welcome"){ roomTag.hidden = false; roomTag.textContent = "🏕 " + S.room; }
    else { roomTag.hidden = true; }
  }

  renderModal();
  renderClock();
  syncMusic();
}

function viewWelcome(){
  if(!S.room) S.room = makeRoom();
  var link = inviteLink();
  var relayCfg = GunRef.cfg();
  var rejoin = (relayCfg.room && relayCfg.room!==S.room) ? relayCfg.room : "";
  return '<div class="card enter center">' +
      '<div class="badge">Multiplayer</div>' +
      '<h1 style="margin-top:10px; font-size:2.3rem">Janty</h1>' +
      '<div class="muted small" style="letter-spacing:.3em; text-transform:uppercase; margin-top:4px">The Game of Games</div>' +
      '<p class="muted small" style="margin-top:12px">It is not a game. It is a war. Every player brings their own device.</p>' +
    '</div>' +
    (S.ui.toast ? '<div class="card enter"><div class="banner hot center">'+esc(S.ui.toast)+'</div></div>' : '') +
    (S.err ? '<div class="card enter"><div class="banner hot">⚠️ '+esc(S.err)+'</div></div>' : '') +
    '<div class="card enter">' +
      '<h3>Your room code</h3>' +
      '<p class="muted small">Share this code (or the invite link) with everyone at the fire. Each person opens it on their own phone and enters their name and icon.</p>' +
      '<div class="count" style="font-size:2.6rem; letter-spacing:.12em">'+esc(S.room)+'</div>' +
      '<div class="banner tiny muted" style="margin-top:6px; word-break:break-all">'+esc(link)+'</div>' +
      '<button class="btn block" style="margin-top:12px" data-action="invite">📨 Invite players</button>' +
      '<button class="btn ghost block" style="margin-top:10px" data-action="enter-room">Enter room '+esc(S.room)+' →</button>' +
    '</div>' +
    '<div class="card enter">' +
      '<h3>Join a room</h3>' +
      '<div class="field" style="margin-top:8px"><label>Room code someone shared</label>' +
        '<input type="text" data-field="joinRoom" value="'+esc(S.ui.joinRoom||"")+'" maxlength="24" placeholder="JANTY-XXXX" /></div>' +
      (rejoin ? '<button class="btn ghost block" style="margin-top:10px" data-action="rejoin" data-room="'+esc(rejoin)+'">↩ Rejoin '+esc(rejoin)+'</button>' : '') +
      '<button class="btn ghost block" style="margin-top:10px" data-action="join-room">Join room →</button>' +
    '</div>' +
    '<div class="card enter">' +
      '<h3>Other options</h3>' +
      '<button class="btn ghost block" style="margin-top:10px" data-action="start-local">📱 Pass one device around (offline)</button>' +
      '<button class="btn ghost block" style="margin-top:10px" data-action="open-rules">📖 How to play</button>' +
    '</div>';
}

function viewConnecting(){
  return '<div class="card enter center">' +
      '<div class="badge">Multiplayer</div>' +
      '<h2 style="margin-top:10px">Joining room '+esc(S.room)+'…</h2>' +
      '<p class="muted small">Connecting to the network. Hang tight — the fire is warm.</p>' +
      '<div class="count">📡</div>' +
      '<button class="btn ghost block small" data-action="leave-room">Cancel</button>' +
    '</div>';
}

function viewLobby(){
  var rows = S.players.map(function(p, i){
    var mine = p.deviceId===MYID;
    var hostTag = (p.deviceId===S.hostId) ? ' <span class="badge">host</span>' : '';
    if(mine){
      return '<div class="track active"><button class="avatar-btn" data-action="pick-avatar" data-i="'+i+'" title="Choose your icon">'+p.avatar+'</button>' +
        '<div class="field" style="flex:1"><label>Your name</label>' +
        '<input type="text" data-field="name" data-i="'+i+'" value="'+esc(p.name)+'" maxlength="18" placeholder="Type your name" /></div>' +
        '<div>'+hostTag+'</div></div>';
    }
    return '<div class="track"><div class="who"><div class="ava">'+p.avatar+'</div>' +
      '<div style="min-width:0"><div class="nm">'+esc(p.name || "…waiting for name")+'</div></div></div>' +
      '<div>'+hostTag+'</div></div>';
  }).join("");

  var named = S.players.filter(function(p){ return p.name.trim().length>0; }).length;
  var canStart = named>=2;
  var start = isHost()
    ? '<button class="btn block" style="margin-top:14px" data-action="start-game" '+(canStart?'':'disabled')+'>▶ Start the game'+(canStart?'':' ('+named+'/2 ready)')+'</button>'
    : '<div class="banner small" style="margin-top:14px">Waiting for the host to start…</div>';

  return '<div class="card enter center">' +
      '<div class="badge">Lobby</div>' +
      '<h2 style="margin-top:8px">Room '+esc(S.room)+'</h2>' +
      '<p class="muted small">Everyone here plays from their own device. Enter your name and pick an icon. The host starts when two or more are ready.</p>' +
    '</div>' +
    (S.ui.toast ? '<div class="card enter"><div class="banner hot center">'+esc(S.ui.toast)+'</div></div>' : '') +
    '<div class="card enter">' +
      '<h3>Players ('+S.players.length+')</h3>' +
      '<div class="grid" style="margin-top:10px">'+rows+'</div>' +
      start +
      '<div class="row tight" style="margin-top:12px; justify-content:center">' +
        '<button class="btn ghost small" data-action="invite">📨 Invite</button>' +
        '<button class="btn ghost small" data-action="leave-room">Leave room</button>' +
      '</div>' +
      '<div class="muted tiny center" style="margin-top:10px">Only the player whose turn it is may draw cards. You can call your own timeout; anyone can log an infraction.</div>' +
    '</div>';
}

function viewSetup(){
  var p = S.players.map(function(pl, i){
    return '<div class="player-setup" style="margin-top:12px">' +
      '<button class="avatar-btn" data-action="pick-avatar" data-i="'+i+'" title="Choose your game piece">'+pl.avatar+'</button>' +
      '<div class="grid" style="flex:1">' +
        '<div class="field"><label>Player '+(i+1)+' name</label>' +
        '<input type="text" data-field="name" data-i="'+i+'" value="'+esc(pl.name)+'" maxlength="18" /></div>' +
        '<div class="field"><label>Team name (optional)</label>' +
        '<input type="text" data-field="team" data-i="'+i+'" value="'+esc(pl.team)+'" maxlength="22" placeholder="e.g. The Firepit Syndicate" /></div>' +
      '</div></div>';
  }).join("");

  return '<div class="card enter center">' +
      '<h1 style="font-size:2.1rem">Janty</h1>' +
      '<div class="muted small" style="letter-spacing:.3em; text-transform:uppercase; margin-top:4px">The Game of Games</div>' +
      '<div class="badge" style="margin-top:10px">Jerod Greigh Thornton · Nancy Lee Daly · Tyler Scott</div>' +
      '<p class="muted small" style="margin-top:10px">Remember: it is not a game. It is a war. Pick your game piece, name your team, and prepare for the ritual.</p>' +
    '</div>' +
    '<div class="card enter">' +
      '<h3>Choose your warriors</h3>' +
      '<p class="muted small">Three-player free-for-all: each of you is your own team. Everyone races Mind → Body → Spirit.</p>' +
      p +
      '<div class="row" style="margin-top:16px">' +
        '<button class="btn ghost small" data-action="randomize">🎲 Randomize pieces</button>' +
      '</div>' +
    '</div>' +
    '<div class="card enter">' +
      '<h3>House rules</h3>' +
      '<div class="grid">' +
        '<div class="field"><label>Cards needed to clear each level</label>' +
          '<select data-field="cardsPerLevel">' +
            [2,3,4,5].map(function(n){ return '<option value="'+n+'"'+(S.config.cardsPerLevel===n?' selected':'')+'>'+n+' cards per level</option>'; }).join("") +
          '</select></div>' +
        '<div class="field"><label>Game clock</label>' +
          '<select data-field="timerMin">' +
            '<option value="0"'+(S.config.timerMin===0?' selected':'')+'>No limit (recommended for first play)</option>' +
            '<option value="15"'+(S.config.timerMin===15?' selected':'')+'>15 minutes (classic)</option>' +
            '<option value="30"'+(S.config.timerMin===30?' selected':'')+'>30 minutes</option>' +
            '<option value="45"'+(S.config.timerMin===45?' selected':'')+'>45 minutes</option>' +
          '</select></div>' +
        '<div class="banner small">🍷 <b>BYO sip mode:</b> every "drink" is a sip of whatever is in your cup — wine, beer, liquor, soda, or water. Your call, your pace. Play smart and look out for each other.</div>' +
      '</div>' +
      '<button class="btn block" style="margin-top:16px" data-action="to-ritual">Begin the Ritual of Sportsmanship →</button>' +
    '</div>';
}

function viewRitual(){
  return '<div class="card enter center">' +
      '<div class="badge">Pre-Round Etiquette</div>' +
      '<h1 style="margin-top:10px">The Ritual of Sportsmanship</h1>' +
      '<p class="muted small">It gives the illusion of respect for your opponent. Things are about to get dark, quickly.</p>' +
    '</div>' +
    '<div class="card enter">' +
      '<ol class="steps">' +
        '<li><b>Pour the reception wine.</b> (Or your sip of choice.) Put on something classical. Make small talk. Pretend to respect each other.</li>' +
        '<li><b>Amnesty:</b> ask every rule question you have NOW. Once the clock runs, questions are forbidden.</li>' +
        '<li><b>Confiscate phones and keys.</b> No phones, no driving. This is a war, not a group chat.</li>' +
        '<li><b>Witness the game pieces.</b> Show everyone your avatar. These are what the winner gets to smash.</li>' +
        '<li><b>The war dance.</b> Do a fierce, intimidating dance. Show off your physical prowess.</li>' +
      '</ol>' +
      '<div class="banner small" style="margin-top:6px">🔥 House safety: no smashing real glass. Toast, cheer, or stomp a designated stand-in instead. First-aid kit stays within reach. Watch the fire.</div>' +
      '<button class="btn block" style="margin-top:14px" data-action="war-dance">🪘 Perform the War Dance</button>' +
      '<button class="btn ghost block small" style="margin-top:8px" data-action="music-toggle">'+(Music.playing?"🔇 Stop the music":"🔊 Play classical music")+'</button>' +
      '<button class="btn ghost block" style="margin-top:10px" data-action="begin-game">We are ready — Start the game</button>' +
      '<div class="muted tiny center" style="margin-top:10px">Tip: decide who goes first — or let fate decide with a random start.</div>' +
      '<div class="row tight" style="margin-top:10px; justify-content:center">' +
        '<button class="btn ghost small" data-action="random-start">🎲 Randomize turn order</button>' +
      '</div>' +
    '</div>';
}

function playerTrack(pl, idx){
  var lvl = pl.level;
  var lanes = [0,1,2].map(function(L){
    if(pl.done){ return '<div><div class="lvltag">'+levelLabel(L)+'</div><div class="lvldone">✓</div></div>'; }
    if(L < lvl){ return '<div><div class="lvltag">'+levelLabel(L)+'</div><div class="lvldone">✓</div></div>'; }
    if(L > lvl){ return '<div><div class="lvltag">'+levelLabel(L)+'</div><div class="muted tiny center">🔒</div></div>'; }
    var pips = "";
    for(var i=0;i<required();i++){ pips += '<span class="pip'+(i<pl.cards?' on':'')+'"></span>'; }
    return '<div><div class="lvltag">'+levelLabel(L)+'</div><div class="pips">'+pips+'</div></div>';
  }).join("");

  var flags = "";
  if(pl.skipNext) flags += ' <span class="badge">skip next</span>';
  if(pl.jail) flags += ' <span class="badge">in jail</span>';
  if(pl.accent) flags += ' <span class="badge">🌍 '+esc(pl.accent)+'</span>';
  if(!pl.done && pl.timeouts>0) flags += ' <span class="badge">⏱ '+pl.timeouts+'</span>';
  if(pl.done) flags += ' <span class="badge black">'+placeLabel(pl.place)+'</span>';

  var cls = "track" + (idx===S.active && !pl.done ? " active":"") + (pl.done?" done":"");
  return '<div class="'+cls+'">' +
      '<div class="who"><div class="ava">'+pl.avatar+'</div>' +
        '<div style="min-width:0"><div class="nm">'+esc(pl.name||"…")+'</div>' +
          (pl.team?'<div class="tn">'+esc(pl.team)+'</div>':'')+flags+'</div></div>' +
      '<div class="levels">'+lanes+'</div>' +
    '</div>';
}

function placeLabel(n){ return n===1?"1st":n===2?"2nd":n===3?"3rd":(n+"th"); }

function viewPlay(){
  var ap = activePlayer();
  var tracks = S.players.map(playerTrack).join("");
  var lvlName = levelLabel(ap.level);
  var drink = ap.level===0?"wine":ap.level===1?"beer":"liquor";
  var desc = ap.level===0?"Trivia, Puzzles & Artistry":ap.level===1?"Physical Challenge, Pain & Endurance":"Emotional Battery & Public Humiliation";

  var accentPanel = "";
  var lvl2 = S.players.filter(function(p){ return p.level===1 && !p.done; });
  if(lvl2.length){
    accentPanel = '<div class="card enter"><h3>🌍 Accent Challenge</h3>' +
      '<p class="muted small">Everyone at Level 2 (Body) speaks in an assigned accent for the rest of the level, or drinks. Spin the globe once — it is locked in until the level ends.</p>' +
      '<div class="grid" style="margin-top:10px">' +
        lvl2.map(function(p){
          if(p.accent){
            return '<div class="track"><div class="who"><div class="ava">'+p.avatar+'</div>' +
              '<div style="min-width:0"><div class="nm">'+esc(p.name)+'</div><div class="tn">Accent: '+esc(p.accent)+'</div></div></div>' +
              '<div style="font-size:1.4rem">🌍</div></div>';
          }
          return '<div class="track"><div class="who"><div class="ava">'+p.avatar+'</div>' +
            '<div style="min-width:0"><div class="nm">'+esc(p.name)+'</div><div class="tn">No accent yet</div></div></div>' +
            '<button class="btn small" data-action="spin-accent" data-id="'+p.id+'">🌍 Spin</button></div>';
        }).join("") +
      '</div></div>';
  }

  var myTurn = isMyTurn();
  var you = me();

  var cardPanel;
  if(S.card){
    cardPanel = viewCardPanel();
  } else if(myTurn){
    cardPanel = '<div class="card enter">' +
        '<div class="row" style="justify-content:center">' +
          '<button class="btn" data-action="draw" style="min-width:220px">🎴 Draw a Card</button>' +
        '</div>' +
        '<div class="row" style="justify-content:center; margin-top:10px">' +
          '<button class="btn ghost small" data-action="pass">Pass turn</button>' +
        '</div></div>';
  } else {
    cardPanel = '<div class="card enter center"><p class="muted">⏳ Waiting for '+esc(ap.name||"the next player")+' to draw…</p></div>';
  }

  return '<div class="banner hot center enter">' +
      '<div class="muted tiny" style="letter-spacing:.24em; text-transform:uppercase">Turn '+S.turn+' · Level '+(ap.level+1)+': '+lvlName+'</div>' +
      '<h2 style="margin-top:4px">'+ap.avatar+' '+esc(ap.name||"…")+'\u2019s turn</h2>' +
      '<div class="muted small">'+desc+' · drink: '+drink+' (or your sip)' +
        (you ? ' · you are '+you.avatar+' '+esc(you.name||"(name)") : '') + '</div>' +
    '</div>' +
    '<div class="card enter">' +
      '<div class="grid">'+tracks+'</div>' +
    '</div>' +
    cardPanel +
    accentPanel +
    timeoutPanel() +
    '<div class="card enter">' +
      '<div class="row" style="justify-content:center">' +
        '<button class="btn ghost small" data-action="infraction">🚨 Log an infraction</button>' +
        '<button class="btn ghost small" data-action="blackcard">⚫ Black card</button>' +
      '</div>' +
      (S.log.length? '<div class="log">'+S.log.map(function(l){return '<div>'+esc(l)+'</div>';}).join("")+'</div>' : '') +
    '</div>';
}

function viewCardPanel(){
  var c = S.card;
  var ap = activePlayer();
  var myTurn = isMyTurn();
  var you = me();
  var badge = '<span class="badge '+c.t+'">'+(c.t==="chance"?"Chance":c.t)+'</span>';
  var scope = c.scope==="all" ? ' <span class="badge">All-Play</span>' : '';
  var answer = c.a ? '<div class="banner" id="answerBox" style="margin-top:12px'+(S.ui.reveal?'':'; display:none')+'"><b>Answer:</b> '+esc(c.a)+'</div>' : '';

  var controls = "";
  if(S.steal){
    var canClaim = !myTurn && you && !you.done;
    controls = '<div class="banner hot" style="margin-top:12px">'+esc(ap.name||"They")+' failed the card. Anyone else may steal it.</div>' +
      (canClaim ? '<button class="btn block" style="margin-top:10px" data-action="steal-claim">😈 I\u2019ll steal it ('+you.avatar+' '+esc(you.name||"me")+')</button>' : '') +
      '<button class="btn ghost block small" style="margin-top:8px" data-action="steal-none">Let it go</button>';
  } else if(c.t==="chance"){
    controls = myTurn
      ? '<button class="btn block" style="margin-top:16px" data-action="chance-done">Carry out the card →</button>'
      : '<div class="muted small center" style="margin-top:14px">Waiting for '+esc(ap.name||"the player")+' to resolve the chance card.</div>';
  } else if(myTurn){
    controls = '<div class="row" style="margin-top:16px">' +
        '<button class="btn good" style="flex:1" data-action="card-success">✅ Completed — earn the card</button>' +
        '<button class="btn bad" style="flex:1" data-action="card-fail">❌ Failed</button>' +
      '</div>';
  } else {
    controls = '<div class="muted small center" style="margin-top:14px">'+esc(ap.name||"The player")+' is on the clock.</div>';
  }

  return '<div class="card enter">' +
      '<div class="row tight" style="align-items:center">'+badge+scope +
        '<div class="spacer" style="flex:1"></div><span class="muted tiny">'+ap.avatar+' '+esc(ap.name||"…")+'</span></div>' +
      '<p style="font-size:1.2rem; margin-top:14px; font-family:var(--serif)">'+esc(c.q)+'</p>' +
      (c.a ? '<button class="btn ghost small" style="margin-top:8px" data-action="reveal">'+(S.ui.reveal?"Hide answer":"Reveal answer")+'</button>' : '') +
      answer +
      '<div class="banner tiny muted" style="margin-top:12px">If the drawer cannot complete the task, anyone may steal it. Chance cards never count toward clearing a level.</div>' +
      controls +
    '</div>';
}

function timeoutPanel(){
  var rows = S.players.filter(function(p){ return !p.done; }).map(function(p){
    var own = p.deviceId===MYID;
    var btn = own
      ? (S.pause ? '<span class="muted tiny">pause active</span>'
         : p.timeouts>0 ? '<button class="btn small" data-action="timeout" data-id="'+p.id+'">⏱ Call timeout</button>'
         : '<span class="muted tiny">none left</span>')
      : '<span class="muted tiny">'+(p.timeouts>0?'⏱ '+p.timeouts:'—')+'</span>';
    return '<div class="track"><div class="who"><div class="ava">'+p.avatar+'</div>' +
      '<div style="min-width:0"><div class="nm">'+esc(p.name||"…")+'</div><div class="tn">'+p.timeouts+' of 3 timeouts left</div></div></div>' +
      btn + '</div>';
  }).join("");
  return '<div class="card enter"><h3>⏱ Timeouts</h3>' +
    '<p class="muted small">Each player gets 3 timeouts. You can only call one of your own — it pauses every device, and only you can resume.</p>' +
    '<div class="grid" style="margin-top:10px">'+rows+'</div></div>';
}

function renderFooter(){
  var f = byId("footerInner");
  var ap = activePlayer();
  f.innerHTML = '<div class="muted tiny center">Level '+(ap.level+1)+': '+levelLabel(ap.level)+' — clear '+required()+' cards to advance. Ask no questions while the clock runs.</div>';
}

function viewOver(){
  var order = S.finishedOrder.map(function(id){ return S.players.find(function(p){return p.id===id;}); });
  var winner = order[0];
  var rest = S.players.filter(function(p){ return !p.done; });
  var standings = order.concat(rest);
  var lines = standings.map(function(p, i){
    var medal = i===0?"🏆":i===1?"🥈":"🥉";
    return '<div class="track'+(i===0?' active':'')+'"><div class="who"><div class="ava">'+p.avatar+'</div>' +
      '<div><div class="nm">'+esc(p.name)+'</div><div class="tn">'+esc(p.team||"")+'</div></div></div>' +
      '<div style="font-size:1.4rem">'+medal+'</div></div>';
  }).join("");

  return '<div class="card enter center">' +
      '<div class="badge">Game Over</div>' +
      '<h1 style="margin-top:8px; font-size:2rem">'+winner.avatar+' '+esc(winner.name)+' wins!</h1>' +
      '<p class="muted small">The losers bow. The game pieces of the fallen await their fate.</p>' +
      '<button class="btn block" style="margin-top:8px" data-action="smash">💥 Smash the losing game pieces</button>' +
    '</div>' +
    '<div class="card enter"><h3>Final standings</h3><div class="grid">'+lines+'</div></div>' +
    '<div class="card enter center">' +
      '<button class="btn ghost block" data-action="new-game">Play again</button>' +
    '</div>';
}

/* ---------- synced overlays ---------- */

function showOverlay(html){
  var m = byId("modal");
  m.innerHTML = '<div class="overlay" data-overlay="1"><div id="modalBox" style="width:100%">'+html+'</div></div>';
}

function warDanceRemaining(){
  if(!S.warDance || !S.warDance.endAt) return 0;
  return Math.max(0, Math.ceil((S.warDance.endAt - Date.now())/1000));
}

function startWarDanceTicker(){
  if(warDanceTimer){ clearInterval(warDanceTimer); warDanceTimer = null; }
  if(!S.warDance || warDanceRemaining()<=0) return;
  warDanceTimer = setInterval(function(){
    if(!S.warDance || S.phase!=="ritual" || warDanceRemaining()<=0){
      if(warDanceTimer){ clearInterval(warDanceTimer); warDanceTimer = null; }
      render();
      return;
    }
    var n = warDanceRemaining(), node = byId("cd");
    if(node){
      node.textContent = n;
      node.classList.remove("shake"); void node.offsetWidth; node.classList.add("shake");
      beep(150 + (n%2)*70, .12);
    }
  }, 1000);
}

function pauseOverlayHtml(){
  var p = S.pause || {}, mine = me();
  var owner = !!mine && p.by===mine.id;
  return '<div class="card enter center"><div class="badge">Timeout</div>' +
    '<h2 style="margin-top:8px">⏱ Play paused</h2>' +
    '<p class="muted small">'+esc(p.name||"A player")+' called a timeout. The clock is stopped and play is on hold.</p>' +
    (owner
      ? '<button class="btn good block" style="margin-top:14px" data-action="resume-timeout">▶ Resume the game</button>'
      : '<div class="banner small" style="margin-top:12px">Waiting for '+esc(p.name||"the player")+' to resume.</div>') +
    '</div>';
}

function warDanceOverlayHtml(n){
  return '<div class="card enter center"><div class="badge">The Ritual</div>' +
    '<h2 style="margin-top:8px">🪘 War Dance!</h2>' +
    '<p class="muted small">Dance fiercely. Intimidate your opponents. Show off your physical prowess.</p>' +
    '<div class="count" id="cd">'+n+'</div>' +
    '<div class="muted tiny" style="margin-top:8px">Everyone in the room sees this same countdown.</div></div>';
}

function warDanceConfirmHtml(){
  return '<div class="card enter center"><div class="badge">Ritual complete</div>' +
    '<h2 style="margin-top:8px">🪘 The war dance is done.</h2>' +
    '<p class="muted small">Ready to begin? Confirming starts the game on every device.</p>' +
    '<button class="btn good block" style="margin-top:14px" data-action="confirm-start">▶ Start the game</button></div>';
}

/* ---------- modals ---------- */

function renderModal(){
  var m = byId("modal");
  var box = byId("modalBox");
  if(S.pause && S.phase==="play"){ showOverlay(pauseOverlayHtml()); return; }
  if(S.warDance && S.phase==="ritual"){
    var left = warDanceRemaining();
    if(left>0){ showOverlay(warDanceOverlayHtml(left)); startWarDanceTicker(); }
    else { showOverlay(warDanceConfirmHtml()); }
    return;
  }
  if(!S.modal){ m.innerHTML = ""; return; }
  var html = "";
  var kind = S.modal.kind;

  if(kind==="avatars"){
    var i = S.modal.i;
    html = '<div class="card enter"><h3>Choose a game piece</h3>' +
      '<p class="muted small">This is what the winner smashes if you lose. Choose wisely.</p>' +
      '<div class="avatar-grid" style="margin-top:10px">' +
        AVATARS.map(function(a){ return '<button data-action="choose-avatar" data-emoji="'+a+'" data-i="'+i+'"'+(S.players[i].avatar===a?' class="sel"':'')+'>'+a+'</button>'; }).join("") +
      '</div>' +
      '<div class="field" style="margin-top:14px"><label>Or type any emoji / letters</label>' +
        '<input type="text" data-field="customAvatar" data-i="'+i+'" maxlength="3" placeholder="e.g. 🔥" /></div>' +
      '<button class="btn ghost block" style="margin-top:12px" data-action="close-modal">Done</button></div>';
  }
  else if(kind==="rules"){
    html = viewRules();
  }
  else if(kind==="levelintro"){
    var L = S.modal.level;
    var dn = L===1?"wine (or your sip)":L===2?"beer (or your sip)":"liquor (or your sip)";
    var body = L===1
      ? '<ul class="steps"><li>Cards are <b>Trivia, Puzzles, and Artistry</b>.</li><li>Only <b>'+dn+'</b> is served at this level.</li><li>Clear <b>'+required()+' cards</b> to advance to Body.</li><li>No questions while the clock runs — 5-second sip penalty.</li></ul>'
      : L===2
      ? '<ul class="steps"><li>Cards are <b>Physical Challenge, Pain, and Endurance</b>.</li><li>Only <b>'+dn+'</b> is served.</li><li><b>NO CURSING.</b> Offenders sip for 5 seconds while the others count — as slowly as they like.</li><li>The level opens with the <b>Accent Challenge</b>.</li><li>Clear <b>'+required()+' cards</b> to advance to Spirit.</li></ul>'
      : '<ul class="steps"><li>Cards are <b>Emotional Battery and Public Humiliation</b>.</li><li>Only <b>'+dn+'</b> is served.</li><li><b>No mercy.</b> Roasts are personal. Skin is thick.</li><li>Clear <b>'+required()+' cards</b> to win the game.</li></ul>';
    var l2pid = S.modal.playerId;
    var l2p = (l2pid!=null) ? S.players.find(function(x){return x.id===l2pid;}) : activePlayer();
    var accentBlock = L===2 ? '<div class="banner hot" style="margin-top:10px"><b>🌍 Accent Challenge:</b> ' +
        (l2p.accent ? 'Your accent is <b>'+esc(l2p.accent)+'</b>. Speak it for the rest of the level or drink.' :
          'Spin the globe to lock in your accent for this level.') +
        (l2p.accent ? '' : '<br><button class="btn small" style="margin-top:8px" data-action="spin-accent" data-id="'+l2p.id+'">🌍 Spin the globe</button>') +
        '<div class="muted tiny" style="margin-top:6px">Anyone else who reaches Level 2 can spin from the game board.</div></div>' : '';
    html = '<div class="card enter"><div class="badge">Level '+L+' of 3</div>' +
      '<h2 style="margin-top:8px">'+levelLabel(L-1)+'</h2>' + body + accentBlock +
      '<button class="btn block" style="margin-top:14px" data-action="close-modal">Begin Level '+L+'</button></div>';
  }
  else if(kind==="blackcard"){
    html = viewBlack();
  }
  else if(kind==="infraction"){
    html = viewInfraction();
  }
  else if(kind==="countdown"){
    html = '<div class="card enter center"><h3>'+esc(S.modal.title)+'</h3>' +
      '<p class="muted small">'+esc(S.modal.sub)+'</p>' +
      '<div class="count" id="cd">'+(S.modal.seconds||5)+'</div>' +
      '<button class="btn good block" data-action="close-modal">'+(S.modal.doneLabel||"Done")+'</button></div>';
  }
  else if(kind==="menu"){
    var inRoom = !!S.room;
    html = '<div class="card enter"><h3>Menu</h3>' +
      (inRoom ? '<div class="banner small" style="margin-top:8px">Room <b>'+esc(S.room)+'</b> · '+esc(syncLabel())+'</div>' : '') +
      '<button class="btn ghost block" style="margin-top:10px" data-action="close-modal">Resume</button>' +
      (inRoom ? '<button class="btn ghost block" style="margin-top:10px" data-action="invite">📨 Invite players</button>' : '') +
      '<button class="btn ghost block" style="margin-top:10px" data-action="open-rules">Open the rulebook</button>' +
      '<button class="btn ghost block" style="margin-top:10px" data-action="open-sync">'+syncLabel()+'</button>' +
      '<button class="btn ghost block" style="margin-top:10px" data-action="save-note">Progress auto-saves on this device</button>' +
      (inRoom ? '<button class="btn bad block" style="margin-top:10px" data-action="leave-room">Leave room</button>' : '') +
      '<button class="btn bad block" style="margin-top:10px" data-action="confirm-reset">Reset the entire game</button></div>';
  }
  else if(kind==="sync"){
    var cfg = GunRef.cfg();
    var room = S.modal.room != null ? S.modal.room : (cfg.room||S.room||"");
    var relays = S.modal.relays != null ? S.modal.relays : ((cfg.relays&&cfg.relays.length?cfg.relays:DEFAULT_RELAYS).join(", "));
    var statusText = GunRef.status==="on" ? "Connected. Every device in this room sees the same game live."
      : GunRef.status==="connecting" ? "Connecting to the network…"
      : GunRef.status==="error" ? (S.modal.err||"Connection failed.")
      : "Not connected.";
    html = '<div class="card enter"><div class="badge">Multiplayer</div>' +
      '<h3 style="margin-top:8px">Connection</h3>' +
      '<p class="muted small">Powered by gun.js. Devices sync through a relay — the defaults are public relays; swap in your own if you like.</p>' +
      '<div class="field" style="margin-top:12px"><label>Room code</label>' +
        '<input type="text" data-field="syncRoom" value="'+esc(room)+'" maxlength="24" placeholder="JANTY-XXXX" /></div>' +
      '<div class="field" style="margin-top:10px"><label>Relay URLs (comma-separated)</label>' +
        '<input type="text" data-field="syncRelay" value="'+esc(relays)+'" placeholder="https://your-relay.example/gun" /></div>' +
      '<div class="banner small" style="margin-top:10px">'+esc(statusText)+'</div>' +
      '<button class="btn block" style="margin-top:12px" data-action="sync-connect">'+(GunRef.status==="on"?"Reconnect":"Connect")+'</button>' +
      (GunRef.status==="on" ? '<button class="btn bad block" style="margin-top:8px" data-action="sync-disconnect">Disconnect</button>' : '') +
      '<button class="btn ghost block small" style="margin-top:8px" data-action="close-modal">Close</button></div>';
  }

  m.innerHTML = '<div class="overlay" data-overlay="1"><div id="modalBox" style="width:100%">'+html+'</div></div>';

  if(kind==="countdown"){ startCountdown(); }
}

function viewInfraction(){
  var u = S.ui.inf || (S.ui.inf = {ids:[], type:"Question asked"});
  var types = ["Question asked","Cursed","Spilled a drink","Custom"];
  return '<div class="card enter"><div class="badge">Infraction</div>' +
    '<h3 style="margin-top:8px">Who broke a rule?</h3>' +
    '<div class="row tight" style="margin-top:6px">' +
      S.players.map(function(p){
        var on = u.ids.indexOf(p.id)>=0;
        return '<button class="btn small '+(on?'':'ghost')+'" data-action="inf-toggle" data-id="'+p.id+'">'+p.avatar+' '+esc(p.name)+'</button>';
      }).join("") +
    '</div>' +
    '<h3 style="margin-top:14px">What happened?</h3>' +
    '<div class="row tight" style="margin-top:6px">' +
      types.map(function(t){ return '<button class="btn small '+(u.type===t?'':'ghost')+'" data-action="inf-type" data-type="'+t+'">'+t+'</button>'; }).join("") +
    '</div>' +
    '<div class="banner small" style="margin-top:14px">'+infractionText(u)+'</div>' +
    '<button class="btn block" style="margin-top:14px" data-action="inf-enforce">Enforce the penalty</button>' +
    '<button class="btn ghost block small" style="margin-top:8px" data-action="close-modal">Cancel</button></div>';
}

function infractionText(u){
  if(!u.ids.length) return "Select at least one player.";
  var names = u.ids.map(function(id){ return S.players.find(function(p){return p.id===id;}).name; }).join(", ");
  if(u.type==="Spilled a drink") return names+" — house rule: finish your drink (or take a big sip), and everyone else takes a sip too.";
  if(u.type==="Cursed") return names+" — sip for 5 seconds while the others count, as slowly as they wish. (Cursing is only banned from Level 2 on.)";
  if(u.type==="Question asked") return names+" — asking questions while the clock runs costs a 5-second sip.";
  return names+" — take a 5-second sip as the penalty.";
}

function viewBlack(){
  var b = S.modal.black || (S.modal.black = BLACK_CARDS[Math.floor(Math.random()*BLACK_CARDS.length)]);
  var inner = '<div class="badge black">Black Card</div>' +
    '<h2 style="margin-top:8px">'+esc(b.name)+'</h2>' +
    '<p style="margin-top:10px">'+esc(b.text)+'</p>';
  if(b.deal){
    inner += '<button class="btn block" style="margin-top:12px" data-action="highcard">Deal the cards</button>' +
      '<div id="hc" class="grid" style="margin-top:12px"></div>';
  }
  inner += '<button class="btn ghost block" style="margin-top:12px" data-action="close-modal">Close</button>';
  return '<div class="card enter">'+inner+'</div>';
}

function viewRules(actionName, actionLabel){
  actionName = actionName || "close-modal";
  actionLabel = actionLabel || "Back to the game";
  return '<div class="card enter"><div class="badge">The Rulebook</div>' +
    '<h2 style="margin-top:8px">Janty</h2>' +
    '<p class="muted small">It is not a game. It is a war.</p>' +

    '<h3 style="margin-top:16px">The goal</h3>' +
    '<p class="small">A race from Level 1 to Level 3. Each level has its own rules and its own drink. The first player to clear all three levels wins — and gets to smash the losers\u2019 game pieces.</p>' +

    '<h3 style="margin-top:14px">The three levels</h3>' +
    '<ul class="steps"><li><b>Level 1 — Mind.</b> Trivia, Puzzles, Artistry. Served with wine.</li>' +
    '<li><b>Level 2 — Body.</b> Physical Challenge, Pain, Endurance. Served with beer. No cursing.</li>' +
    '<li><b>Level 3 — Spirit.</b> Emotional Battery, Public Humiliation. Served with hard liquor. No mercy.</li></ul>' +

    '<h3 style="margin-top:14px">Global rules</h3>' +
    '<ul class="steps"><li>Clear <b>'+required()+' cards</b> at each level to advance.</li>' +
    '<li>No questions while the clock runs — 5-second sip penalty.</li>' +
    '<li>No cursing from Level 2 on — 5-second sip, opponents count.</li>' +
    '<li>Spill your drink and you finish it; everyone else sips too.</li>' +
    '<li>Whenever you complete a card, the others take a sip.</li>' +
    '<li>Advance a level and you finish your drink.</li>' +
    '<li>Chance cards never count toward clearing a level.</li>' +
    '<li>If a card and the rules disagree, the card wins.</li>' +
    '<li>If you cannot do a card, anyone may steal it and do it for the card.</li></ul>' +

    '<h3 style="margin-top:14px">Cheating</h3>' +
    '<p class="small">Cheating is tolerated, accepted, and part of the game. But if you are caught: the opposing team advances one level. If the cheating team is ahead, the opposing team advances to the same level. Accents drop the moment cheating is caught, so you can shame them properly in your native tongue.</p>' +

    '<h3 style="margin-top:14px">The clock &amp; stoppages</h3>' +
    '<p class="small">15 minutes on the game clock (or your house setting). Stoppages happen between rounds, during time-outs, and for injuries. Each player gets 3 time-outs — use the ⏱ button on the board to spend one. There is a halftime, post-level breaks, and a two-minute warning.</p>' +

    '<h3 style="margin-top:14px">The Black Card</h3>' +
    '<p class="small">If the clock runs out with no winner, draw the Black Card. It decides the game — coin flip, high card, dare duel, and worse.</p>' +

    '<h3 style="margin-top:14px">House rules (this table)</h3>' +
    '<ul class="steps"><li><b>BYO sip mode:</b> every "drink" is a sip of whatever is in your cup.</li>' +
    '<li><b>Multi-device:</b> open the menu, set a room code, and every phone in the room follows the same board live (gun.js).</li>' +
    '<li>No smashing real glass. Toast, cheer, or stomp a stand-in.</li>' +
    '<li>Consent always wins. Anyone can swap a humiliation card for a 3-sip forfeit, no questions asked.</li>' +
    '<li>Water is always allowed. Nobody is expected to get annihilated.</li>' +
    '<li>First-aid kit within reach. Mind the fire.</li></ul>' +

    '<button class="btn block" style="margin-top:16px" data-action="'+actionName+'">'+actionLabel+'</button></div>';
}

/* ---------- clock ---------- */

function clockRemaining(){
  if(S.timer && S.timer.endAt) return Math.max(0, Math.round((S.timer.endAt - Date.now())/1000));
  return (S.timer && S.timer.remaining) || 0;
}

function renderClock(){
  var c = byId("clock");
  if(!c || c.hidden) return;
  var r = clockRemaining();
  var m = Math.floor(r/60), s = r%60;
  c.textContent = m + ":" + (s<10?"0":"") + s;
  c.classList.toggle("warn", r<=120);
}

function tickClock(){
  if(!S || S.phase!=="play" || !S.timer.running) return;
  var r = clockRemaining();
  var prev = S.timer.remaining;
  S.timer.remaining = r;
  if(r===120 && prev!==120) beep(660,.15);
  if(r<=0){
    S.timer.running = false;
    S.timer.endAt = 0;
    beep(300,.6);
    if(S.finishedOrder.length){ endGame(); }
    else { S.modal = {kind:"blackcard"}; addLog("Clock expired — Black Card drawn."); render(); }
    return;
  }
  renderClock();
}

function startClock(){
  if(S.config.timerMin<=0){ S.timer = {total:0,remaining:0,running:false,endAt:0}; return; }
  S.timer.total = S.config.timerMin*60;
  S.timer.remaining = S.timer.total;
  S.timer.endAt = Date.now() + S.timer.total*1000;
  S.timer.running = true;
  if(timerId) clearInterval(timerId);
  timerId = setInterval(tickClock, 1000);
}

function ensureClock(){
  if(S.phase==="play" && S.timer && S.timer.running && S.timer.total>0){
    if(!timerId) timerId = setInterval(tickClock, 1000);
  }
}

/* ---------- flow ---------- */

function beginGame(){
  S.phase = "play";
  S.turn = 1;
  S.active = 0;
  S.log = [];
  S.decks = {1:shuffle(DECKS[1].slice()), 2:shuffle(DECKS[2].slice()), 3:shuffle(DECKS[3].slice())};
  S.finishedOrder = [];
  S.card = null;
  S.steal = false;
  S.modal = {kind:"levelintro", level:1};
  addLog("The game begins. Level 1: Mind.");
  startClock();
  save();
  render();
}

function drawAndShow(){
  if(!isMyTurn() || S.card) return;
  S.card = drawCard();
  S.steal = false;
  S.ui.reveal = false;
  addLog(activePlayer().name + " drew a " + S.card.t + " card.");
  save();
  render();
}

function earnCard(player){
  player.cards++;
  addLog(player.name + " earned a card (" + player.cards + "/" + required() + " in " + levelLabel(player.level) + ").");
  if(player.cards >= required()){
    player.cards = 0;
    player.level++;
    if(player.level !== 1) player.accent = "";
    if(player.level >= 3){
      player.done = true;
      player.place = S.finishedOrder.length + 1;
      S.finishedOrder.push(player.id);
      addLog("🏆 " + player.name + " has conquered all three levels!");
      endGame();
      return "won";
    }
    addLog(player.name + " advanced to Level " + (player.level+1) + ": " + levelLabel(player.level) + ".");
    S.modal = {kind:"levelintro", level:player.level+1, thenEndTurn:true, playerId:player.id};
    return "advanced";
  }
  return "card";
}

function endGame(){
  S.phase = "over";
  S.timer.running = false;
  if(timerId){ clearInterval(timerId); timerId=null; }
  render();
}

function nextPlayer(){
  var n = S.players.length;
  var i = S.active;
  for(var k=0;k<n;k++){
    i = (i+1)%n;
    if(S.players[i].done) continue;
    if(S.players[i].skipNext){
      S.players[i].skipNext = false;
      addLog(S.players[i].name + " was skipped.");
      continue;
    }
    S.active = i;
    if(S.players[i].jail){ S.players[i].jail = false; addLog(S.players[i].name + " served their time — out of jail."); }
    return;
  }
}

function endTurn(){
  S.card = null;
  S.modal = null;
  S.turn++;
  nextPlayer();
  save();
  render();
}

function applyChance(c){
  var ap = activePlayer();
  switch(c.effect){
    case "everyone_else_sips":
      addLog("Everyone but " + ap.name + " sips."); break;
    case "skip":
      ap.skipNext = true; addLog(ap.name + " will skip the next turn."); break;
    case "jail":
      ap.jail = true; addLog(ap.name + " is in jail."); break;
    case "advance_card":
      ap.cards++; addLog(ap.name + " gained a free card."); break;
    case "swap":
      var others = S.players.filter(function(p){return p.id!==ap.id;});
      var o = others[Math.floor(Math.random()*others.length)];
      var t = ap.avatar; ap.avatar = o.avatar; o.avatar = t;
      addLog(ap.name + " and " + o.name + " swapped game pieces."); break;
    case "steal_leader":
      var lead = S.players.filter(function(p){return p.level===ap.level && p.id!==ap.id;})
        .sort(function(a,b){return b.cards-a.cards;})[0];
      if(lead && lead.cards>0){ lead.cards--; ap.cards++; addLog(ap.name + " stole a card from " + lead.name + "."); }
      else { addLog("No card to steal."); }
      break;
    default: addLog("Chance: " + ap.name + " — " + c.q);
  }
}

function dealHighCards(){
  var box = byId("hc");
  if(!box) return;
  var results = S.players.map(function(p){
    var r = RANKS[Math.floor(Math.random()*RANKS.length)];
    var s = SUITS[Math.floor(Math.random()*SUITS.length)];
    return {p:p, r:r, rank:RANKS.indexOf(r), suit:s};
  });
  var best = results.slice().sort(function(a,b){ return b.rank-a.rank; })[0];
  box.innerHTML = results.map(function(x){
    var win = x.p.id===best.p.id;
    return '<div class="track'+(win?' active':'')+'"><div class="who"><div class="ava">'+x.p.avatar+'</div>' +
      '<div><div class="nm">'+esc(x.p.name)+'</div></div></div>' +
      '<div style="font-size:1.4rem">'+x.r+x.suit+(win?' 🏆':'')+'</div></div>';
  }).join("");
  addLog("Black Card — High Card: " + best.p.name + " wins with " + best.r + best.suit + ".");
  beep(600,.2);
}

/* ---------- countdown ---------- */

function startCountdown(){
  var secs = (S.modal && S.modal.seconds) || 5;
  var end = (S.modal && S.modal.end) || "🍻";
  var drum = S.modal && S.modal.drum;
  var n = secs;
  var node = byId("cd");
  if(!node) return;
  node.textContent = n;
  beep(700,.12);
  var iv = setInterval(function(){
    n--;
    node = byId("cd");
    if(!node){ clearInterval(iv); return; }
    if(n<=0){ node.textContent = end; clearInterval(iv); beep(520,.2); return; }
    node.textContent = n;
    node.classList.remove("shake"); void node.offsetWidth; node.classList.add("shake");
    if(drum){ beep(150 + (n%2)*70, .12); } else { beep(700,.1); }
  }, 1000);
}

/* ---------- confetti ---------- */

function burst(){
  var b = byId("burst");
  var emo = ["🔥","🍷","🍺","🥃","💥","🏆","⚡","✨"];
  for(var i=0;i<48;i++){
    var s = document.createElement("span");
    s.textContent = emo[Math.floor(Math.random()*emo.length)];
    s.style.left = Math.random()*100 + "vw";
    s.style.animationDuration = (1.6 + Math.random()*1.8) + "s";
    s.style.animationDelay = (Math.random()*.6) + "s";
    b.appendChild(s);
  }
  setTimeout(function(){ b.innerHTML=""; }, 4200);
}

/* ---------- rooms & invites ---------- */

function toast(msg){
  S.ui.toast = msg; render();
  setTimeout(function(){ if(S.ui.toast===msg){ S.ui.toast=null; render(); } }, 2200);
}

function fallbackCopy(text){
  try{
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand("copy"); document.body.removeChild(ta);
  }catch(e){}
}

function copyInvite(){
  var link = inviteLink();
  var done = function(){ toast("Invite link copied — send it to the crew."); };
  if(navigator.share){
    navigator.share({title:"Janty", text:"Join my Janty game — room " + S.room, url:link}).then(done, function(){ fallbackCopy(link); done(); });
    return;
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(link).then(done, function(){ fallbackCopy(link); done(); });
    return;
  }
  fallbackCopy(link); done();
}

function connectRoom(room, relays){
  room = (room||"").trim().toUpperCase();
  if(!room) return;
  S = baseState();
  S.room = room;
  S.phase = "connecting";
  render();
  GunRef.connect(room, relays, function(err){
    if(err){ S.phase = "welcome"; S.err = err; render(); }
  });
}

function leaveRoom(){
  GunRef.disconnect();
  clearSave();
  if(timerId){ clearInterval(timerId); timerId = null; }
  S = baseState();
  S.room = makeRoom();
  S.phase = "welcome";
  render();
}

function resetRoom(){
  if(isLocal()){ S = freshLocal(); return; }
  var room = S.room, host = S.hostId;
  S = freshRoom(room, host);
  registerMe();
  save();
}

/* ---------- events ---------- */

document.addEventListener("click", function(e){
  var t = e.target.closest("[data-action]");
  var action = t ? t.getAttribute("data-action") : null;
  if(!action){
    if(e.target.getAttribute && e.target.getAttribute("data-overlay")==="1"){ S.modal=null; render(); }
    return;
  }
  var i = parseInt(t.getAttribute("data-i"), 10);

  switch(action){
    case "pick-avatar": S.modal={kind:"avatars", i:i}; render(); break;
    case "choose-avatar": S.players[i].avatar = t.getAttribute("data-emoji"); save(); render(); break;
    case "close-modal":
      if(S.modal && S.modal.thenEndTurn){ endTurn(); }
      else { S.modal=null; render(); }
      break;
    case "randomize":
      S.players.forEach(function(p){ p.avatar = randomAvatar(); });
      save(); render(); break;
    case "invite": copyInvite(); break;
    case "enter-room": connectRoom(S.room); break;
    case "join-room":
      var jr = (S.ui.joinRoom||"").trim().toUpperCase();
      if(!jr){ S.err = "Enter a room code."; render(); break; }
      connectRoom(jr); break;
    case "rejoin": connectRoom(t.getAttribute("data-room")); break;
    case "start-local": clearSave(); S = freshLocal(); render(); break;
    case "start-game":
      if(!isHost()) break;
      if(S.players.filter(function(p){ return p.name.trim().length>0; }).length < 2) break;
      S.phase = "ritual"; Music.muted = false; addLog("The lobby closes. The ritual begins."); save(); render(); break;
    case "leave-room": leaveRoom(); break;
    case "to-ritual": S.phase="ritual"; Music.muted=false; save(); render(); break;
    case "music-toggle": Music.toggle(); render(); break;
    case "war-dance":
      if(S.warDance) break;
      var wnow = Date.now();
      S.warDance = {by:MYID, startedAt:wnow, endAt:wnow+15000};
      document.body.classList.add("shake");
      setTimeout(function(){ document.body.classList.remove("shake"); }, 900);
      beep(700,.12);
      addLog("A fierce war dance was performed. Intimidation achieved.");
      save(); render();
      break;
    case "confirm-start":
      if(!S.warDance) break;
      S.warDance = null;
      beginGame();
      break;
    case "random-start":
      S.active = Math.floor(Math.random()*S.players.length);
      addLog("Fate chose " + activePlayer().name + " to go first.");
      render(); break;
    case "begin-game": beginGame(); break;
    case "draw": drawAndShow(); break;
    case "reveal": S.ui.reveal = !S.ui.reveal; render(); break;
    case "card-success":
      if(!isMyTurn()) break;
      var p = activePlayer(); S.card=null; S.steal=false; S.ui.reveal=false;
      var res = earnCard(p); save();
      if(res==="advanced"){ render(); }
      else if(res==="won"){ }
      else { endTurn(); }
      break;
    case "card-fail":
      if(!isMyTurn()) break;
      S.steal = true; addLog(activePlayer().name + " failed the card."); save(); render(); break;
    case "steal-claim":
      var mp = me();
      if(isMyTurn() || !S.steal || !mp) break;
      S.steal=false; S.card=null; S.ui.reveal=false;
      addLog(mp.name + " stole the card from " + activePlayer().name + ".");
      var r2 = earnCard(mp); save();
      if(r2==="advanced"){ render(); }
      else if(r2==="won"){ }
      else { endTurn(); }
      break;
    case "steal-none":
      S.steal=false; S.card=null; addLog("The card went unclaimed."); save(); endTurn(); break;
    case "chance-done":
      if(!isMyTurn()) break;
      applyChance(S.card); S.card=null; S.ui.reveal=false; save(); endTurn(); break;
    case "pass":
      if(!isMyTurn()) break;
      addLog(activePlayer().name + " passed."); endTurn(); break;
    case "timeout":
      var tid = t.getAttribute("data-id"), mine = me();
      if(!mine || tid!==mine.id || mine.timeouts<=0 || S.pause) break;
      mine.timeouts--;
      S.pause = {by:mine.id, name:mine.name, at:Date.now()};
      if(S.timer && S.timer.running){
        S.timer.remaining = clockRemaining(); S.timer.running = false; S.timer.endAt = 0;
      }
      addLog(mine.name + " called a timeout (" + mine.timeouts + " left). Play pauses.");
      beep(420,.2); setTimeout(function(){ beep(320,.25); }, 220);
      save(); render(); break;
    case "resume-timeout":
      if(!S.pause) break;
      var resumer = me();
      if(!resumer || S.pause.by!==resumer.id) break;
      S.pause = null;
      if(S.config.timerMin>0 && S.timer && S.timer.total>0){
        S.timer.endAt = Date.now() + S.timer.remaining*1000;
        S.timer.running = true;
      }
      addLog(resumer.name + " resumed the game.");
      if(timerId){ clearInterval(timerId); timerId = null; }
      ensureClock();
      save(); render(); break;
    case "infraction":
      S.ui.inf = {ids:[], type:"Question asked"}; S.modal={kind:"infraction"}; render(); break;
    case "inf-toggle":
      var id = t.getAttribute("data-id");
      var arr = S.ui.inf.ids, idx = arr.indexOf(id);
      if(idx>=0) arr.splice(idx,1); else arr.push(id);
      renderModal(); break;
    case "inf-type":
      S.ui.inf.type = t.getAttribute("data-type"); renderModal(); break;
    case "inf-enforce":
      if(!S.ui.inf.ids.length){ return; }
      var names = S.ui.inf.ids.map(function(id){ return S.players.find(function(p){return p.id===id;}).name; }).join(", ");
      addLog("Infraction (" + S.ui.inf.type + "): " + names + ".");
      S.modal={kind:"countdown", title:"Sip for 5 seconds", sub:infractionText(S.ui.inf)}; render(); break;
    case "blackcard":
      S.modal={kind:"blackcard", black:BLACK_CARDS[Math.floor(Math.random()*BLACK_CARDS.length)]}; render(); break;
    case "highcard":
      dealHighCards(); break;
    case "spin-accent":
      var pid = t.getAttribute("data-id");
      var pp = S.players.find(function(x){return x.id===pid;});
      if(pp && pp.level===1 && !pp.accent){
        pp.accent = ACCENTS[Math.floor(Math.random()*ACCENTS.length)];
        addLog(pp.name + " must speak as: " + pp.accent + ".");
        beep(500,.15);
      }
      save(); render(); break;
    case "open-rules": S.modal={kind:"rules"}; render(); break;
    case "open-sync": S.modal={kind:"sync"}; render(); break;
    case "sync-connect":
      var rc = ((S.modal && S.modal.room)||S.room||"").trim().toUpperCase();
      var rl = ((S.modal && S.modal.relays)||"").split(",").map(function(x){return x.trim();}).filter(Boolean);
      S.modal = null;
      connectRoom(rc, rl.length?rl:null);
      break;
    case "sync-disconnect":
      GunRef.disconnect(); render(); break;
    case "menu": S.modal={kind:"menu"}; render(); break;
    case "save-note": addLog("Progress is saved on this device."); renderModal(); break;
    case "confirm-reset":
      if(confirm("Reset the entire game? This cannot be undone.")){
        if(timerId){ clearInterval(timerId); timerId = null; }
        if(isLocal()){ clearSave(); S = freshLocal(); }
        else { resetRoom(); }
        render();
      }
      break;
    case "smash": burst(); beep(120,.5); break;
    case "new-game":
      if(timerId){ clearInterval(timerId); timerId = null; }
      if(isLocal()){ clearSave(); S = freshLocal(); }
      else { resetRoom(); }
      render(); break;
  }
});

document.addEventListener("input", function(e){
  var f = e.target.getAttribute && e.target.getAttribute("data-field");
  if(!f) return;
  var i = parseInt(e.target.getAttribute("data-i"),10);
  if(f==="name") S.players[i].name = e.target.value;
  else if(f==="team") S.players[i].team = e.target.value;
  else if(f==="cardsPerLevel") S.config.cardsPerLevel = parseInt(e.target.value,10);
  else if(f==="timerMin") S.config.timerMin = parseInt(e.target.value,10);
  else if(f==="customAvatar"){
    var v = e.target.value.trim();
    if(v){ S.players[i].avatar = v; render(); }
  }
  else if(f==="joinRoom"){ S.ui.joinRoom = e.target.value; return; }
  else if(f==="syncRoom"){ if(S.modal && S.modal.kind==="sync") S.modal.room = e.target.value; return; }
  else if(f==="syncRelay"){ if(S.modal && S.modal.kind==="sync") S.modal.relays = e.target.value; return; }
  save();
});

document.addEventListener("change", function(e){
  var f = e.target.getAttribute && e.target.getAttribute("data-field");
  if(!f) return;
  if(f==="cardsPerLevel" || f==="timerMin"){
    if(f==="cardsPerLevel") S.config.cardsPerLevel = parseInt(e.target.value,10);
    if(f==="timerMin") S.config.timerMin = parseInt(e.target.value,10);
    save(); render();
  }
});

/* ---------- boot ---------- */

(function boot(){
  var cached = load();
  if(cached && cached.phase){ S = cached; } else { S = baseState(); }
  if(!S.timer) S.timer = {total:0, remaining:0, running:false, endAt:0};
  if(!S.config) S.config = defaultConfig();
  if(!S.ui) S.ui = {};
  if(!("warDance" in S)) S.warDance = null;
  if(!("pause" in S)) S.pause = null;
  S.modal = null;
  if(!Array.isArray(S.players)) S.players = [];
  S.players.forEach(function(p){
    if(p.timeouts==null) p.timeouts = 3;
    if(p.accent==null) p.accent = "";
    if(!p.deviceId) p.deviceId = "local";
  });

  var room = null;
  try{ room = new URLSearchParams(location.search).get("room"); }catch(e){}

  if(room){
    connectRoom(room, null);
  } else if(S.room && S.phase && S.phase!=="welcome"){
    S.phase = "connecting";
    render();
    GunRef.connect(S.room, GunRef.cfg().relays, function(err){
      if(err){ S.phase = "welcome"; S.err = err; render(); }
    });
  } else if(!S.room && LOCAL_PHASES.indexOf(S.phase)>=0){
    render();
    ensureClock();
  } else {
    S.phase = "welcome";
    if(!S.room) S.room = makeRoom();
    render();
  }
  ensureClock();
})();
