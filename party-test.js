// Prueba headless del modo Fiesta (poderes).
// Uso:  npm i jsdom   y luego   node party-test.js [index.html] [script.js] [partidas-por-configuración]
// Carga la página real bajo jsdom y comprueba: catálogo, reglas de cada poder (duración, topes, un poder por turno),
// guardado, aparición "justa", avisos en pantalla, uso por parte de la IA y, con partidas completas IA contra IA,
// que ningún poder deja a nadie sin camino, que no hay aturdimientos en cadena y que el modo no rompe el equilibrio.
// Termina con código 1 si algo falla.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const htmlFile = process.argv[2] || 'index.html';
const scriptFile = process.argv[3] || 'script.js';
const N = +process.argv[4] || 60;

const html = fs.readFileSync(htmlFile, 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '').replace(/<script src="script.js"><\/script>/, '');
const errors = [], vc = new VirtualConsole();
vc.on('jsdomError', e=> errors.push(String(e.stack || e)));
const dom = new JSDOM(html, { url:'http://localhost/', runScripts:'outside-only', pretendToBeVisual:true, virtualConsole:vc });
const w = dom.window, d = w.document;
w.HTMLCanvasElement.prototype.getContext = ()=> null;
w.__QUORIDOR_TEST__ = true;
w.eval(fs.readFileSync(scriptFile, 'utf8'));
if(errors.length){ console.error('Errores al cargar la página:\n'+errors.join('\n')); process.exit(1); }
const P = w.__quoridorParty, MZ = w.__quoridorMaze;
if(!P){ console.error('La página no expuso __quoridorParty'); process.exit(1); }

let bad = 0;
const ok = (c, msg)=>{ console.log((c ? '  ok  ' : '  ✗   ') + msg); if(!c) bad++; };
const $ = id=> d.getElementById(id);
const fire = (el, type)=> el.dispatchEvent(new w.Event(type, { bubbles:true }));
const S = ()=> P.getState();
const K = P.K;
const NAMES = ['Ana','Beto','Cami','Dani'];

function newGame(n, size, diffs, ruleset){
  P.initGame(n, size, { ruleset:ruleset||'party', difficulty:(diffs&&diffs[0])||'expert', names:NAMES.slice(0,n) });
  const s = S();
  if(diffs) s.players.forEach((p,i)=>{ p.difficulty = diffs[i % diffs.length]; });
  return s;
}
function clearToken(){ S().powerUp = null; }
function setTurn(i){ const s = S(); s.currentPlayerIndex = i; s.sprintArmed = false; s.party.usedThisTurn = false; s.validMoves = P.computeValidMoves(i); }
const plainMoves = ()=> S().validMoves.filter(m=> !m.sprint && !m.push && !m.swap);
function stepToward(){                       // el paso normal que más acerca al centro
  const s = S(), list = plainMoves().map(m=> ({ m, d:P.distanceToCenter(m.r, m.c, s.blockedEdges) })).sort((a,b)=> a.d-b.d);
  P.performMove(list[0].m.r, list[0].m.c);
}
function tokenAhead(type){                   // deja un poder justo en una casilla a la que puede pasar quien juega
  const m = plainMoves()[0];
  S().powerUp = { r:m.r, c:m.c, type, ttl:K.PARTY_TOKEN_TTL };
  return m;
}
const usedTotal = s=> Object.values(s.party.stats.used).reduce((a,b)=> a+b, 0);

// =====================================================================================================
console.log('\n1) Catálogo');
const types = P.PARTY_TYPES;
ok(types.length>=6, 'hay '+types.length+' poderes: '+types.join(', '));
ok(types.every(k=>{ const p = P.PARTY_POWERS[k]; return p.name && p.emoji && p.desc && p.duration && (p.kind==='instant'||p.kind==='stored') && P.EMOTE_ICON_IDS.indexOf(p.icon)>=0; }),
   'todos tienen nombre, emoji, ícono existente, descripción y duración definidos');
ok(types.some(k=> P.PARTY_POWERS[k].kind==='instant') && types.filter(k=> P.PARTY_POWERS[k].kind==='stored').length>=4, 'hay poderes instantáneos y varios que se guardan');
ok(/poder/i.test(P.RULESETS.party.hint) && /guard/.test(P.RULESETS.party.hint) && /IA/.test(P.RULESETS.party.hint), 'el texto del modo explica poderes, guardado y que la IA los usa');

// =====================================================================================================
console.log('\n2) Pantalla: barra de poderes, ayuda, ficha en el tablero');
$('rulesetSelect').value = 'party'; fire($('rulesetSelect'), 'change');
$('startBtn').click();
let s = S();
ok(s && s.ruleset==='party' && !!s.party, 'la partida arranca en modo Fiesta');
ok(!$('powerBar').classList.contains('hidden'), 'la barra de poderes se ve en Fiesta');
ok($('powerHelpList').querySelectorAll('li').length===types.length, 'la ayuda desplegable lista los '+types.length+' poderes con su duración');
ok(/Dura|dura/.test($('powerHelpList').textContent) && /Aturdir/.test($('powerHelpList').textContent), 'la ayuda dice qué hace y cuánto dura cada uno');
ok(!!s.powerUp, 'desde el arranque hay un poder en el tablero ('+(s.powerUp&&s.powerUp.type)+')');
ok(d.querySelectorAll('#wallsGroup .power-token').length===1, 'la ficha del poder se dibuja con su cuenta regresiva ('+(d.querySelector('#wallsGroup .power-token text')||{}).textContent+')');
ok(/En el tablero/.test($('powerNote').textContent) && /desvanece/.test($('powerNote').textContent), 'la nota dice qué poder hay y cuándo se desvanece');
ok(/Apareció/.test($('achievementToast').textContent), 'un aviso anuncia que apareció un poder: "'+$('achievementToast').textContent.slice(0,60)+'"');

// guardar y usar desde los botones (turno extra)
clearToken();
s.players[0].powers = ['turno_extra', 'escudo'];
P.render();
const btns = Array.from(d.querySelectorAll('#powerBtns .power-btn'));
ok(btns.length===2 && btns.every(b=> !b.disabled && /Dura/.test(b.title)), 'los poderes guardados aparecen como botones con su descripción y duración');
ok(/⏩|🛡/.test($('playersList').textContent), 'la lista de jugadores muestra los poderes guardados');
btns.find(b=> b.dataset.power==='turno_extra').click();
ok(s.players[0].fx.extra===1 && s.players[0].powers.join()==='escudo', 'usar Turno extra lo gasta y lo deja activo');
ok(/Turno extra activo/.test($('hintLine').textContent), 'el texto de ayuda dice que el turno extra está activo');
ok(Array.from(d.querySelectorAll('#powerBtns .power-btn')).every(b=> b.disabled), 'con un poder usado, los demás botones se apagan (un poder por turno)');
ok(/activó Turno extra/.test($('powerNote').textContent), 'el evento queda escrito bajo los botones');
d.querySelector('#movesGroup .valid-move-hit').dispatchEvent(new w.Event('click', { bubbles:true }));
ok(S().currentPlayerIndex===0 && s.players[0].fx.extra===2, 'la primera acción no termina el turno');
d.querySelector('#movesGroup .valid-move-hit').dispatchEvent(new w.Event('click', { bubbles:true }));
ok(S().currentPlayerIndex===1 && s.players[0].fx.extra===0, 'la segunda acción sí lo termina y el efecto se apaga');

// =====================================================================================================
console.log('\n3) Recoger: instantáneo, guardar, topes');
s = newGame(2, 9, ['expert']); clearToken();
let bonus0 = s.players[0].wallsLeft;
for(let i=0;i<3;i++){ setTurn(0); const m = tokenAhead('pared_extra'); P.performMove(m.r, m.c); }
ok(s.players[0].wallBonus===K.PARTY_WALL_BONUS_MAX && s.players[0].wallsLeft===bonus0+K.PARTY_WALL_BONUS_MAX, 'Pared extra: se aplica al instante y frena en +'+K.PARTY_WALL_BONUS_MAX+' por partida');
ok(!!s.powerUp && s.powerUp.type==='pared_extra', 'en el tope el poder no se pierde: queda en el tablero para otro');
ok(/máximo de paredes extra/.test($('powerNote').textContent) || s.party.recent.some(l=> /máximo de paredes extra/.test(l)), 'y se avisa por qué no se pudo llevar');

s = newGame(2, 9, ['expert']); clearToken(); setTurn(0);
let m0 = tokenAhead('escudo'); P.performMove(m0.r, m0.c);
ok(s.players[0].powers.join()==='escudo' && s.powerUp===null, 'un poder que se guarda va al inventario ('+s.players[0].powers+') y sale del tablero');
setTurn(0); m0 = tokenAhead('escudo'); P.performMove(m0.r, m0.c);
ok(s.players[0].powers.length===1 && !!s.powerUp, 'no se puede llevar dos del mismo (sin repetidos): queda en el tablero');
setTurn(0); m0 = tokenAhead('paso_doble'); P.performMove(m0.r, m0.c);
ok(s.players[0].powers.length===2, 'sí se pueden guardar '+K.PARTY_MAX_HELD+' distintos');
setTurn(0); m0 = tokenAhead('aturdido'); P.performMove(m0.r, m0.c);
ok(s.players[0].powers.length===K.PARTY_MAX_HELD && !!s.powerUp && s.powerUp.type==='aturdido', 'con el inventario lleno el poder no se recoge y se avisa');
ok(s.party.recent.some(l=> /ya lleva/.test(l)), 'el aviso explica que ya lleva '+K.PARTY_MAX_HELD+' poderes');

// =====================================================================================================
console.log('\n4) Aturdir: efecto, duración, inmunidad y tope');
s = newGame(2, 9, ['expert']); clearToken(); s.players[0].powers = ['aturdido']; setTurn(0);
ok(P.partyCanUse(0, 'aturdido').ok, 'con el rival igual de cerca se puede usar');
P.partyUse(0, 'aturdido');
ok(s.players[1].stunned && s.players[0].powers.length===0, 'el rival queda aturdido y el poder se gasta');
ok(s.party.recent.some(l=> /aturdió a/.test(l)), 'se avisa quién aturdió a quién');
stepToward();
ok(s.currentPlayerIndex===0, 'el aturdido pierde exactamente un turno (juega otra vez quien lo aturdió)');
ok(!s.players[1].stunned && s.players[1].fx.immune===K.PARTY_STUN_IMMUNE_TURNS, 'al perder el turno el aturdimiento termina y queda inmune '+K.PARTY_STUN_IMMUNE_TURNS+' turnos');
ok(s.party.recent.some(l=> /pierde este turno/.test(l)), 'el aviso de que pierde el turno aparece');
s.players[0].powers = ['aturdido']; s.validMoves = P.computeValidMoves(0);
ok(P.partyStunTarget(0)===null && !P.partyCanUse(0, 'aturdido').ok, 'mientras dura la inmunidad no se lo puede aturdir de nuevo');
stepToward(); ok(s.currentPlayerIndex===1 && s.players[1].fx.immune===K.PARTY_STUN_IMMUNE_TURNS-1, 'la inmunidad baja con cada turno propio (1)');
stepToward(); stepToward();
ok(s.currentPlayerIndex===1 && s.players[1].fx.immune===0, 'y termina a los '+K.PARTY_STUN_IMMUNE_TURNS+' turnos (0)');
// tope: el que va mucho más adelante no puede aturdir al que viene lejos
s = newGame(2, 9, ['expert']); clearToken();
s.players[0].r = 3; s.players[0].c = 4; s.players[0].powers = ['aturdido']; setTurn(0);
ok(P.partyStunTarget(0)===null && /van muy atrás/.test(P.partyCanUse(0,'aturdido').reason), 'quien va muy adelante no puede aturdir al que viene lejos (freno a la bola de nieve)');
s.players[1].r = 5; s.players[1].c = 4; setTurn(0);
ok(P.partyStunTarget(0)===1, 'pero sí al que lo alcanza');

// =====================================================================================================
console.log('\n5) Escudo');
s = newGame(2, 9, ['expert']); clearToken();
s.players[0].powers = ['aturdido']; s.players[1].powers = ['escudo']; setTurn(1);
P.partyUse(1, 'escudo');
ok(s.players[1].fx.shield===K.PARTY_SHIELD_ROUNDS, 'Escudo dura '+K.PARTY_SHIELD_ROUNDS+' rondas');
stepToward(); ok(s.currentPlayerIndex===0 && !P.partyCanUse(0, 'aturdido').ok, 'el escudo frena el aturdimiento del rival');
stepToward(); ok(s.currentPlayerIndex===1 && s.players[1].fx.shield===K.PARTY_SHIELD_ROUNDS-1, 'baja 1 al empezar su turno');
stepToward(); stepToward();
ok(s.players[1].fx.shield===0 && s.party.recent.some(l=> /Terminó el escudo/.test(l)), 'se apaga a las '+K.PARTY_SHIELD_ROUNDS+' rondas y se avisa');

// =====================================================================================================
console.log('\n6) Turno extra, Paso doble y un poder por turno');
s = newGame(2, 9, ['expert']); clearToken();
s.players[0].powers = ['turno_extra', 'paso_doble']; setTurn(0);
ok(P.partyCanUse(0, 'paso_doble').ok, 'Paso doble disponible');
P.partyUse(0, 'turno_extra');
ok(!P.partyCanUse(0, 'paso_doble').ok && !s.validMoves.some(m=> m.sprint), 'tras usar otro poder, en el mismo turno no se puede usar Paso doble');
stepToward(); stepToward();
ok(s.currentPlayerIndex===1, 'el turno extra son exactamente dos acciones');
s = newGame(2, 9, ['expert']); clearToken(); s.players[0].powers = ['turno_extra']; setTurn(0);
P.partyUse(0, 'turno_extra');
const wallOk = P.commitWall(0, 0, 'h');
ok(wallOk && s.currentPlayerIndex===0 && s.players[0].fx.extra===2, 'la acción extra también puede ser poner una pared');
stepToward(); ok(s.currentPlayerIndex===1, 'y luego termina el turno');

s = newGame(2, 9, ['expert']); clearToken(); s.players[0].powers = ['paso_doble']; setTurn(0);
const sp = s.validMoves.filter(m=> m.sprint);
ok(sp.length>0, 'Paso doble ofrece saltos de 2 casillas ('+sp.length+')');
const r0 = s.players[0].r; P.partyUse(0, 'paso_doble');
ok(s.sprintArmed && s.players[0].powers.length===1, 'al armarlo todavía no se gasta');
P.partyUse(0, 'paso_doble'); ok(!s.sprintArmed && s.players[0].powers.length===1, 'se puede desarmar sin perderlo');
P.performMove(sp[0].r, sp[0].c);
ok(Math.abs(s.players[0].r - r0)===2 && s.players[0].powers.length===0, 'el salto avanza 2 casillas y gasta el poder');
ok(s.party.recent.some(l=> /usó Paso doble/.test(l)), 'se avisa cuando se usa');
s = newGame(2, 9, ['expert']); clearToken(); s.players[0].powers = ['paso_doble'];
s.players[0].r = 2; s.players[0].c = 4; setTurn(0);      // a dos casillas del centro (4,4), en línea recta
ok(!s.validMoves.some(m=> m.sprint && m.r===4 && m.c===4), 'Paso doble no permite pisar el centro (no gana la partida de un salto)');

// =====================================================================================================
console.log('\n7) Romper pared');
s = newGame(2, 9, ['expert']); clearToken();
setTurn(1); P.commitWall(0, 4, 'h');                      // Beto pone una pared justo delante de Ana
const rival = s.walls.length;
s.players[0].powers = ['romper_pared']; setTurn(0);
const choice = P.partyBreakChoice(0);
ok(rival===1 && choice && choice.gain>=1, 'Ana puede romper la pared que le estorba (le ahorra '+(choice&&choice.gain)+' pasos)');
const before = P.distanceToCenter(s.players[0].r, s.players[0].c, s.blockedEdges);
P.partyUse(0, 'romper_pared');
const after = P.distanceToCenter(s.players[0].r, s.players[0].c, s.blockedEdges);
ok(s.walls.length===0 && s.blockedEdges.size===0 && s.occupied[0][4]===null, 'la pared desaparece del tablero, de los bordes y de la grilla');
ok(after < before, 'y el camino de Ana se acorta ('+before+' → '+after+')');
s = newGame(2, 9, ['expert']); clearToken(); s.players[0].powers = ['romper_pared']; setTurn(0);
ok(!P.partyCanUse(0, 'romper_pared').ok, 'sin paredes rivales que estorben no se puede usar');
setTurn(0); P.commitWall(0, 4, 'h');                      // la pared es propia
s.players[0].powers = ['romper_pared']; setTurn(0);
ok(P.partyBreakChoice(0)===null, 'no rompe paredes propias');

// =====================================================================================================
console.log('\n8) Poder en el tablero: aparición justa, duración y reaparición');
s = newGame(2, 9, ['expert']); clearToken();
const round0 = s.party.round;
s.party.nextSpawn = 0; P.partySpawn();
ok(!!s.powerUp && s.powerUp.ttl===K.PARTY_TOKEN_TTL, 'aparece con '+K.PARTY_TOKEN_TTL+' rondas de vida');
for(let i=0;i<K.PARTY_TOKEN_TTL-1;i++) P.partyNewRound();
ok(!!s.powerUp && s.powerUp.ttl===1, 'a la última ronda queda 1 (la ficha parpadea)');
P.partyNewRound();
ok(s.powerUp===null && s.party.recent.some(l=> /se desvaneció/.test(l)), 'si nadie lo agarra se desvanece y se avisa');
ok(s.party.nextSpawn>=s.party.round+K.PARTY_RESPAWN_MIN, 'el siguiente se hace esperar al menos '+K.PARTY_RESPAWN_MIN+' rondas');
let waited = 0; while(!s.powerUp && waited<6){ P.partyNewRound(); waited++; }
ok(!!s.powerUp && waited>=K.PARTY_RESPAWN_MIN && waited<=K.PARTY_RESPAWN_MIN+1, 'y reaparece a las '+waited+' rondas');

// equidad de la casilla en muchas posiciones
let spreadMax = 0, spreadSum = 0, cnt = 0, badCell = 0, headMax = 0, headSum = 0, headSteps = 0;
const bfsFrom = (st, r0, c0)=>{
  const dd = Array.from({length:st.size}, ()=> Array(st.size).fill(Infinity)); dd[r0][c0] = 0; const q = [[r0,c0]];
  for(let h=0;h<q.length;h++){ const [r,c] = q[h]; for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nr=r+dr, nc=c+dc; if(nr<0||nc<0||nr>=st.size||nc>=st.size||dd[nr][nc]!==Infinity) continue;
    const k = r<nr||(r===nr&&c<nc) ? r+','+c+'-'+nr+','+nc : nr+','+nc+'-'+r+','+c; if(st.blockedEdges.has(k)) continue;
    dd[nr][nc] = dd[r][c]+1; q.push([nr,nc]); } }
  return dd;
};

function measureToken(st){                     // tiempos de llegada de cada ficha al poder del tablero
  const t = st.powerUp, nn = st.players.length, cur = st.currentPlayerIndex;
  const maps = st.players.map(p=> bfsFrom(st, p.r, p.c));
  const ts = maps.map((mm,i)=> mm[t.r][t.c]*nn + ((i-cur+nn)%nn));
  const dc = st.players.map(p=> P.distanceToCenter(p.r, p.c, st.blockedEdges)), bestC = Math.min(...dc);
  const lead = ts.filter((_,i)=> dc[i]===bestC), oth = ts.filter((_,i)=> dc[i]!==bestC);
  return { spread:Math.max(...ts)-Math.min(...ts), leadHead: oth.length ? Math.max(0, Math.min(...oth)-Math.min(...lead)) : 0, dmin:Math.min(...maps.map(mm=> mm[t.r][t.c])), n:nn };
}
for(const size of [5,7,9,11]) for(const n of [2,3,4]) for(let g=0; g<25; g++){
  const st = newGame(n, size, ['expert']);
  for(let k=0;k<(g%6)*2;k++){ if(!S().winner) stepToward(); }   // posiciones ya movidas y algo desparejas
  clearToken(); S().party.nextSpawn = 0; P.partySpawn();
  const t = S().powerUp; if(!t) continue;
  const m = measureToken(S());
  spreadMax = Math.max(spreadMax, m.spread); spreadSum += m.spread; cnt++;
  headMax = Math.max(headMax, m.leadHead/m.n); headSum += m.leadHead/m.n; if(m.leadHead>0) headSteps++;
  if(m.dmin<2 || m.dmin>K.PARTY_SPAWN_MAX_DIST+2 || (t.r===S().center.r && t.c===S().center.c) || S().players.some(p=> p.r===t.r && p.c===t.c)) badCell++;
}
ok(badCell===0, 'ninguna aparición cae pegada a una ficha, en el centro o demasiado lejos ('+cnt+' muestras)');
console.log('        ventaja del que va adelante para llegar primero al poder: media '+(headSum/cnt).toFixed(2)+' pasos, máxima '+headMax.toFixed(2)+', en '+Math.round(100*headSteps/cnt)+'% de las apariciones (diferencia de llegada media '+(spreadSum/cnt).toFixed(1)+' tiempos)');
ok(headMax<=1.5 && headSum/cnt<=0.3, 'el poder no queda más cerca de quien va adelante que de quien va atrás (ventaja máxima '+headMax.toFixed(2)+' pasos)');

// =====================================================================================================
console.log('\n9) IA: usa los poderes con sentido');
function botScenario(setup){ s = newGame(2, 9, ['expert']); clearToken(); setup(s); s.validMoves = P.computeValidMoves(s.currentPlayerIndex); return s; }
botScenario(st=>{ st.players[1].powers = ['aturdido']; st.currentPlayerIndex = 1; st.players[1].r = 6; st.players[1].c = 4; st.players[0].r = 4; st.players[0].c = 3; });
P.botAct(1);
ok(s.party.stats.used.aturdido===1 && (s.players[0].stunned || s.players[0].fx.immune>0), 'la IA aturde al rival que la está alcanzando');
botScenario(st=>{ st.players[1].powers = ['aturdido']; st.currentPlayerIndex = 1; st.players[1].r = 5; st.players[1].c = 4; st.players[0].r = 0; st.players[0].c = 4; });
P.botAct(1);
ok(!s.party.stats.used.aturdido, 'la IA NO gasta Aturdir cuando el rival viene lejos');
let wins = 0, spent = 0;                                     // la IA experta tiene 4% de "distracción": se repite el caso
for(let i=0;i<25;i++){
  botScenario(st=>{ st.players[1].powers = ['aturdido']; st.players[1].wallsLeft = 0; st.currentPlayerIndex = 1; st.players[1].r = 5; st.players[1].c = 4; st.players[0].r = 4; st.players[0].c = 3; });
  P.botAct(1);
  if(s.winner===s.players[1]) wins++;
  if(s.party.stats.used.aturdido) spent++;
}
ok(spent===0 && wins>=21, 'si puede ganar en esta jugada la IA no gasta poderes y gana ('+wins+'/25, poderes gastados: '+spent+')');
botScenario(st=>{ st.players[1].powers = ['escudo']; st.players[0].powers = ['aturdido']; st.currentPlayerIndex = 1; });
P.botAct(1);
ok(s.players[1].fx.shield>0, 'la IA activa Escudo cuando el rival guarda un Aturdir');
botScenario(st=>{ st.players[1].powers = ['escudo']; st.currentPlayerIndex = 1; });
P.botAct(1);
ok(s.players[1].fx.shield===0, 'y no lo gasta sin motivo');
botScenario(st=>{ st.players[1].powers = ['turno_extra']; st.currentPlayerIndex = 1; st.players[1].r = 6; st.players[1].c = 4; });
const idxBefore = s.currentPlayerIndex; P.botAct(1);
ok(s.players[1].fx.extra===2 && s.currentPlayerIndex===idxBefore, 'la IA usa Turno extra en la recta final y juega su acción extra');
botScenario(st=>{ st.currentPlayerIndex = 1; st.players[1].powers = ['paso_doble']; st.players[1].r = 8; st.players[1].c = 4; });
const rb = s.players[1].r; P.botAct(1);
ok(Math.abs(s.players[1].r - rb)===2 && s.players[1].powers.length===0, 'la IA usa Paso doble cuando el salto la deja mejor que un paso normal');
botScenario(st=>{ st.currentPlayerIndex = 0; st.players[1].powers = ['romper_pared']; st.players[0].r = 0; st.players[0].c = 4; });
P.commitWall(7, 4, 'h');                                   // Ana pone una pared delante de Beto
s.players[1].powers = ['romper_pared']; s.players[1].wallsLeft = 0; s.validMoves = P.computeValidMoves(1);
P.botAct(1);
ok(s.party.stats.used.romper_pared===1 && s.walls.length===0, 'la IA rompe la pared que le estorba');
botScenario(st=>{ st.currentPlayerIndex = 1; const t = { r:5, c:4, type:'aturdido', ttl:4 }; st.powerUp = t; st.players[1].r = 6; st.players[1].c = 4; st.players[0].r = 0; st.players[0].c = 4; });
P.botAct(1);
ok(s.players[1].powers.indexOf('aturdido')>=0, 'la IA agarra un poder que le queda de paso');
botScenario(st=>{ st.currentPlayerIndex = 1; st.powerUp = { r:5, c:1, type:'aturdido', ttl:4 }; st.players[1].r = 6; st.players[1].c = 4; });
P.botAct(1);
ok(s.players[1].powers.length===0, 'pero no se desvía mucho para agarrarlo');

// =====================================================================================================
console.log('\n10) IA contra IA en partidas completas (invariantes)');
const cache = Object.getOwnPropertyDescriptor(w.Element.prototype, 'innerHTML');
Object.defineProperty(w.Element.prototype, 'innerHTML', { configurable:true, get(){ return ''; }, set(v){} });   // sin dibujar: sólo reglas
function runGame(n, size, diffs, ruleset){
  const st = newGame(n, size, diffs, ruleset);
  const out = { winner:null, actions:0, problems:[], spreads:[], stunRound:{} };
  const lastStun = st.players.map(()=> null), wasStunned = st.players.map(()=> false);
  let spawned = st.party ? st.party.stats.spawned : 0;
  if(st.party && st.powerUp) out.spreads.push(measureToken(st));       // el del arranque, medido antes de que nadie se mueva
  while(!st.winner && out.actions<900){
    const idx = st.currentPlayerIndex, u0 = ruleset==='classic' ? 0 : usedTotal(st);
    P.botAct(idx); out.actions++;
    if(ruleset==='classic') continue;
    if(usedTotal(st)-u0>1) out.problems.push('más de un poder usado en una acción');
    st.players.forEach((p,i)=>{
      if(p.powers.length>K.PARTY_MAX_HELD) out.problems.push('inventario > máximo');
      if(new Set(p.powers).size!==p.powers.length) out.problems.push('poder repetido');
      if(p.wallsLeft<0) out.problems.push('paredes negativas');
      if(p.wallBonus>K.PARTY_WALL_BONUS_MAX) out.problems.push('demasiadas paredes extra');
      if(p.fx.shield<0||p.fx.shield>K.PARTY_SHIELD_ROUNDS||p.fx.immune<0||p.fx.immune>K.PARTY_STUN_IMMUNE_TURNS||p.fx.extra<0||p.fx.extra>2) out.problems.push('efecto fuera de rango');
      if(!P.hasPath(p.r,p.c,st.center.r,st.center.c,st.blockedEdges,st.size)) out.problems.push('jugador sin camino');
      if(p.stunned && !wasStunned[i]){
        if(lastStun[i]!==null && st.party.round-lastStun[i]<3) out.problems.push('aturdimientos en cadena (rondas '+lastStun[i]+' y '+st.party.round+')');
        lastStun[i] = st.party.round;
      }
      wasStunned[i] = p.stunned;
    });
    if(st.powerUp){
      const t = st.powerUp;
      if(t.ttl<1||t.ttl>K.PARTY_TOKEN_TTL) out.problems.push('vida del poder fuera de rango');
    }
    if(st.party.stats.spawned>spawned){
      spawned = st.party.stats.spawned;
      if(st.powerUp) out.spreads.push(measureToken(st));
    }
  }
  if(!st.winner) out.problems.push('la partida no terminó en '+out.actions+' acciones');
  out.winner = st.winner ? st.winner.id : null;
  out.stats = ruleset==='classic' ? null : st.party.stats;
  out.rounds = ruleset==='classic' ? 0 : st.party.round;
  MZ.closeOverlay('win');
  return out;
}
const agg = { games:0, problems:new Map(), used:{}, picked:{}, spawned:0, vanished:0, spreads:[], actions:0, rounds:0 };
const t0 = Date.now();
const configs = [
  { n:2, size:5,  diffs:['expert','expert'] }, { n:2, size:7,  diffs:['hard','normal'] }, { n:2, size:9,  diffs:['expert','expert'] },
  { n:2, size:9,  diffs:['easy','easy'] },      { n:2, size:11, diffs:['expert','hard'] },  { n:3, size:9,  diffs:['expert','hard','normal'] },
  { n:4, size:9,  diffs:['expert','expert','hard','hard'] }, { n:4, size:11, diffs:['normal','normal','easy','easy'] },
];
for(const cfg of configs){
  let done = 0, stuck = 0;
  for(let g=0; g<N; g++){
    const r = runGame(cfg.n, cfg.size, cfg.diffs, 'party');
    agg.games++; done++; agg.actions += r.actions; agg.rounds += r.rounds;
    r.problems.forEach(p=> agg.problems.set(p, (agg.problems.get(p)||0)+1));
    if(!r.winner && r.winner!==0) stuck++;
    Object.entries(r.stats.used).forEach(([k,v])=> agg.used[k] = (agg.used[k]||0)+v);
    Object.entries(r.stats.picked).forEach(([k,v])=> agg.picked[k] = (agg.picked[k]||0)+v);
    agg.spawned += r.stats.spawned; agg.vanished += r.stats.vanished; r.spreads.forEach(x=> agg.spreads.push(x));
  }
  ok(stuck===0, cfg.n+' jugadores · '+cfg.size+'×'+cfg.size+' · '+cfg.diffs.join('/')+': '+done+' partidas terminan');
}
ok(agg.problems.size===0, 'sin infracciones en '+agg.games+' partidas'+(agg.problems.size ? ' → '+Array.from(agg.problems).map(([k,v])=> k+' ×'+v).join('; ') : ''));
console.log('        promedio '+(agg.actions/agg.games).toFixed(0)+' acciones y '+(agg.rounds/agg.games).toFixed(0)+' rondas por partida · '+((Date.now()-t0)/1000).toFixed(1)+' s');
console.log('        poderes que aparecieron '+agg.spawned+' · recogidos '+Object.values(agg.picked).reduce((a,b)=>a+b,0)+' · desvanecidos '+agg.vanished+' (por poder: '+types.map(k=> k+' '+(agg.picked[k]||0)).join(', ')+')');
console.log('        usos por la IA: '+types.filter(k=> P.PARTY_POWERS[k].kind==='stored').map(k=> k+' '+(agg.used[k]||0)).join(', '));
ok(types.filter(k=> P.PARTY_POWERS[k].kind==='stored').every(k=> (agg.used[k]||0)>0), 'la IA usó cada poder que se guarda al menos una vez');
ok((agg.picked.pared_extra||0)>0, 'Pared extra se recogió (instantáneo)');
const heads = agg.spreads.map(x=> x.leadHead/x.n), headMean = heads.reduce((a,b)=>a+b,0)/heads.length;
console.log('        apariciones a mitad de partida: '+heads.length+' · ventaja del líder media '+headMean.toFixed(2)+' pasos, máxima '+Math.max(...heads).toFixed(2)+', con ventaja en '+Math.round(100*heads.filter(x=> x>0).length/heads.length)+'%');
ok(heads.length>0 && headMean<=0.3 && Math.max(...heads)<=2, 'en partidas reales el poder tampoco favorece a quien va adelante');
const usedPerGame = Object.values(agg.used).reduce((a,b)=>a+b,0)/agg.games;
ok(usedPerGame>0.5 && usedPerGame<8, 'la IA usa '+usedPerGame.toFixed(1)+' poderes por partida: ni ninguno ni una avalancha');

// =====================================================================================================
console.log('\n11) Equilibrio: Fiesta contra Clásico con las mismas IA');
function winRates(ruleset, diffs, size, games){
  let firstWins = 0, strongWins = 0, decided = 0, actions = 0;
  for(let g=0; g<games; g++){
    const r = runGame(2, size, diffs, ruleset);
    if(r.winner===null) continue;
    decided++; actions += r.actions;
    if(r.winner===0) firstWins++;
    if(diffs[0]!==diffs[1] && r.winner===0) strongWins++;
  }
  return { first: 100*firstWins/decided, strong: 100*strongWins/decided, len: actions/decided };
}
const G = Math.max(80, N*3);
const cEE = winRates('classic', ['expert','expert'], 9, G), pEE = winRates('party', ['expert','expert'], 9, G);
console.log('        experta vs experta 9×9 ('+G+' partidas): gana quien abre  Clásico '+cEE.first.toFixed(0)+'%  ·  Fiesta '+pEE.first.toFixed(0)+'%   (acciones: '+cEE.len.toFixed(0)+' vs '+pEE.len.toFixed(0)+')');
ok(Math.abs(pEE.first - cEE.first) <= 15, 'los poderes no le regalan la partida a quien abre (diferencia de '+Math.abs(pEE.first-cEE.first).toFixed(0)+' puntos)');
const pHE = winRates('party', ['expert','easy'], 9, G), cHE = winRates('classic', ['expert','easy'], 9, G);
console.log('        experta (abre) vs fácil: gana la experta  Clásico '+cHE.strong.toFixed(0)+'%  ·  Fiesta '+pHE.strong.toFixed(0)+'%');
ok(pHE.strong>=70, 'la habilidad sigue contando: la IA experta gana el '+pHE.strong.toFixed(0)+'% contra la fácil aun con poderes');
ok(pEE.len <= cEE.len*1.5, 'las partidas no se alargan de más ('+pEE.len.toFixed(0)+' vs '+cEE.len.toFixed(0)+' acciones)');
Object.defineProperty(w.Element.prototype, 'innerHTML', cache);

// =====================================================================================================
console.log('\n12) Contra la IA desde la pantalla (temporizador real)');
(async ()=>{
  s = newGame(2, 9, ['expert']); s.players[1].isCPU = true; s.isCpuGame = true; clearToken();
  s.players[1].powers = ['escudo']; s.players[0].powers = ['aturdido']; P.render();
  d.querySelector('#movesGroup .valid-move-hit').dispatchEvent(new w.Event('click', { bubbles:true }));
  await new Promise(r=> setTimeout(r, 1400));
  ok(S().currentPlayerIndex===0 && S().moveCount>=2, 'la IA responde sola con el temporizador de siempre (movimientos: '+S().moveCount+')');
  ok(S().players[1].fx.shield>0, 'y activó el Escudo por su cuenta porque el humano guardaba Aturdir');
  console.log('\nerrores de página:', errors.length, errors.slice(0,2));
  console.log(bad ? '✗ '+bad+' falla(s)' : '✓ Fiesta bien');
  process.exit(bad || errors.length ? 1 : 0);
})();
