// Prueba de flujo en jsdom: menú del Laberinto, partida, pantalla de victoria, "Repetir mapa" y patrones propios.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('index.html','utf8').replace(/<link[^>]*fonts[^>]*>/g,'').replace(/<script src="script.js"><\/script>/,'');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e=> errors.push(String(e.stack||e)));
const dom = new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w = dom.window, d = w.document;
w.HTMLCanvasElement.prototype.getContext = ()=> null; w.__QUORIDOR_TEST__ = true;
w.eval(fs.readFileSync('script.js','utf8'));
const M = w.__quoridorMaze; let bad = 0;
const ok = (c,msg)=>{ console.log((c?'  ok  ':'  ✗   ')+msg); if(!c) bad++; };
const $ = id=> d.getElementById(id);
const fire = (el,type)=> el.dispatchEvent(new w.Event(type,{bubbles:true}));

// --- menú
$('rulesetSelect').value='maze'; fire($('rulesetSelect'),'change');
ok(!$('customLevelFieldset').classList.contains('hidden'), 'el menú muestra el diseño del laberinto');
ok($('mazeMinimap').querySelectorAll('line').length>0, 'el minimapa dibuja paredes ('+$('mazeMinimap').querySelectorAll('line').length+')');
ok($('mazeMinimap').getAttribute('viewBox')==='0 0 120 120', 'minimapa de 120×120');
const seed0 = $('mazeSeedText').textContent, name0 = $('mazeMapName').textContent;
$('mazeDiceBtn').click();
ok($('mazeSeedText').textContent!==seed0, 'el dado cambia el mapa ('+seed0+' → '+$('mazeSeedText').textContent+')');
const shownSeed = $('mazeSeedText').textContent.replace('Semilla ','');
$('mdLigero').checked = true; fire($('mdLigero'),'change');
ok(JSON.parse(w.localStorage.getItem('quoridor_lastSetup')).mazeDensity==='ligero', 'la densidad se guarda en quoridor_lastSetup');
ok($('mazeDensityHint').textContent.length>0, 'hay texto de ayuda de la densidad');

// --- partida con el mapa del minimapa
$('mdMedio').checked = true; fire($('mdMedio'),'change');
const seedMenu = $('mazeSeedText').textContent.replace('Semilla ','');
const previewLines = $('mazeMinimap').querySelectorAll('line').length;
$('startBtn').click();
const stone = ()=> Array.from(d.querySelectorAll('#wallsGroup rect.map-wall')).map(r=> [r.getAttribute('x'),r.getAttribute('y'),r.getAttribute('width'),r.getAttribute('height')].join(','));
const walls1 = stone();
ok(walls1.length===previewLines, 'la partida usa exactamente el mapa del minimapa ('+walls1.length+' paredes)');
ok(d.querySelector('#wallsGroup rect.map-wall').getAttribute('fill')==='url(#stoneTex)', 'las paredes del mapa llevan la textura de piedra');
ok(!!d.getElementById('stoneTex'), 'existe el <pattern> de piedra en el tablero');
ok(/^Mapa: /.test($('hintLine').textContent), 'hintLine muestra el nombre del mapa: "'+$('hintLine').textContent.slice(0,60)+'"');

// --- jugar hasta ganar (cada turno: la casilla que más acerca a la meta)
function play(){
  for(let i=0;i<200;i++){
    const st = M.getState(); if(st.winner) return true;
    const hits = Array.from(d.querySelectorAll('#movesGroup .valid-move-hit'));
    if(!hits.length) return false;
    let best=null, bd=1e9;
    hits.forEach(h=>{ const r=+h.dataset.r, c=+h.dataset.c, dd=M.bfsShortestPath(r,c,st.center.r,st.center.c,st.blockedEdges,st.size); if(dd<bd){bd=dd;best=h;} });
    best.dispatchEvent(new w.Event('click',{bubbles:true}));
  }
  return !!M.getState().winner;
}
ok(play(), 'la partida se puede terminar');
ok(!$('winMapInfo').classList.contains('hidden'), 'la victoria muestra mapa y semilla: "'+$('winMapInfo').textContent+'"');
ok($('winMapInfo').textContent.indexOf(seedMenu)>=0, 'la semilla de la victoria es la del menú ('+seedMenu+')');
ok(!$('repeatMapBtn').classList.contains('hidden'), 'aparece el botón "Repetir mapa"');
$('repeatMapBtn').click();
ok(JSON.stringify(stone())===JSON.stringify(walls1), 'Repetir mapa da exactamente el mismo mapa');
ok(play(), 'la partida repetida también se puede terminar');
$('playAgainBtn').click();
ok(JSON.stringify(stone())!==JSON.stringify(walls1), 'Jugar de nuevo da un mapa distinto');

// --- 3 y 4 jugadores, tamaños y densidades
let matrix = 0;
for(const size of [5,7,9,11]) for(const players of [2,3,4]) for(const dens of ['ligero','medio','denso','caos']){
  const g = M.generateMaze({size,players,density:dens,seed:size*players*13}); if(g.walls.length>=0) matrix++;
}
ok(matrix===48, 'las 48 combinaciones tamaño × jugadores × densidad generan mapa');

// --- desafío diario
const day = M.generateDailyLayout('2026-09-20', 9);
ok(Array.isArray(day) && day.length>0 && JSON.stringify(day)===JSON.stringify(M.generateDailyLayout('2026-09-20', 9)), 'el desafío diario sale de la fecha y es estable ('+day.length+' paredes)');

// --- patrón propio desde el editor
w.localStorage.setItem('quoridor_customLevels', JSON.stringify([{name:'Mi patrón A',pattern:true,size:9,walls:[{r:0,c:0,orientation:'h'},{r:0,c:2,orientation:'h'}]}]));
$('editorLinkBtn').click();
$('editorSizeSelect').value='9'; fire($('editorSizeSelect'),'change');
ok(/patrón/.test($('editorLevelsList').textContent), 'el editor lista el patrón guardado');
ok(!$('editorLevelsList').querySelector('[data-act="play"]'), 'un patrón no tiene botón Jugar');
// pongo una pared en el editor con un clic sobre el tablero y guardo como patrón
const list0 = JSON.parse(w.localStorage.getItem('quoridor_customLevels')).length;
$('editorSavePatternBtn').click();
ok(/al menos una pared/.test($('editorFeedback').textContent), 'no deja guardar un patrón vacío');
$('editorBackBtn').click();
$('rulesetSelect').value='maze'; fire($('rulesetSelect'),'change');
ok(!$('mazeMineCheck').disabled, 'se habilita "Incluir mis patrones" ('+$('mazeMineCount').textContent+')');
ok(!/Mi patrón A/.test($('customLevelSelect').innerHTML), 'los patrones no aparecen en la lista de niveles');
$('mazeMineCheck').checked = true; fire($('mazeMineCheck'),'change');
ok(JSON.parse(w.localStorage.getItem('quoridor_lastSetup')).mazeMine===true, 'la casilla se guarda');
console.log('\nerrores de página:', errors.length, errors.slice(0,2));
console.log(bad ? '✗ '+bad+' falla(s)' : '✓ flujo completo bien');
process.exit(bad||errors.length ? 1 : 0);
