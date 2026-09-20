// Prueba headless del generador del modo Laberinto.
// Uso:  npm i jsdom   y luego   node maze-test.js [index.html] [script.js] [mapas-por-tamaño]
// Carga la página real bajo jsdom, genera N mapas por tamaño (1000 por defecto) y reporta rechazos,
// largo medio de camino y diferencia entre jugadores. Termina con código 1 si algún mapa es inválido.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const htmlFile = process.argv[2] || 'index.html';
const scriptFile = process.argv[3] || 'script.js';
const N = +process.argv[4] || 1000;

function boot(){
  const html = fs.readFileSync(htmlFile, 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '').replace(/<script src="script.js"><\/script>/, '');
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', e=> errors.push(String(e.stack || e)));
  const dom = new JSDOM(html, { url:'http://localhost/', runScripts:'outside-only', pretendToBeVisual:true, virtualConsole:vc });
  dom.window.HTMLCanvasElement.prototype.getContext = ()=> null;
  dom.window.__QUORIDOR_TEST__ = true;                       // expone window.__quoridorMaze
  dom.window.eval(fs.readFileSync(scriptFile, 'utf8'));
  if(errors.length){ console.error('Errores al cargar la página:\n'+errors.join('\n')); process.exit(1); }
  if(!dom.window.__quoridorMaze){ console.error('La página no expuso __quoridorMaze'); process.exit(1); }
  return dom.window.__quoridorMaze;
}

// BFS independiente del generador: distancia de cada salida a la meta con las paredes dadas.
function independentDists(size, players, walls){
  const blocked = new Set(), key = (a,b,c,d)=> a<c||(a===c&&b<d) ? a+','+b+'|'+c+','+d : c+','+d+'|'+a+','+b;
  for(const w of walls){
    if(w.orientation==='h'){ for(const dc of [0,1]) blocked.add(key(w.r, w.c+dc, w.r+1, w.c+dc)); }
    else { for(const dr of [0,1]) blocked.add(key(w.r+dr, w.c, w.r+dr, w.c+1)); }
  }
  const mid = (size-1)/2, dist = new Map([[mid+','+mid, 0]]), queue = [[mid, mid]];
  while(queue.length){
    const [r,c] = queue.shift(), d = dist.get(r+','+c);
    for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const nr = r+dr, nc = c+dc;
      if(nr<0 || nc<0 || nr>=size || nc>=size || dist.has(nr+','+nc) || blocked.has(key(r,c,nr,nc))) continue;
      dist.set(nr+','+nc, d+1); queue.push([nr,nc]);
    }
  }
  const T = [0,mid], B = [size-1,mid], R = [mid,size-1], L = [mid,0];
  const seats = players<=1 ? [T] : players===2 ? [T,B] : players===3 ? [T,R,B] : [T,R,B,L];
  return { seats, dists: seats.map(s=> dist.has(s[0]+','+s[1]) ? dist.get(s[0]+','+s[1]) : -1) };
}
function checkMap(g, size, players){
  const problems = [], occ = new Set();
  for(const w of g.walls){
    if(w.r<0 || w.c<0 || w.r>size-2 || w.c>size-2) problems.push('pared fuera del tablero');
    const k = w.r+','+w.c; if(occ.has(k)) problems.push('dos paredes en la misma posición'); occ.add(k);
  }
  for(const w of g.walls){                                    // dos tramos seguidos de la misma orientación no pueden pisarse
    if(w.orientation==='h' && g.walls.some(o=> o.orientation==='h' && o.r===w.r && o.c===w.c+1)) problems.push('tramos horizontales pisados');
    if(w.orientation==='v' && g.walls.some(o=> o.orientation==='v' && o.c===w.c && o.r===w.r+1)) problems.push('tramos verticales pisados');
  }
  const ind = independentDists(size, players, g.walls);
  if(ind.dists.some(d=> d<0)) problems.push('una salida se queda sin camino');
  for(const s of ind.seats){                                  // ninguna pared toca la casilla de salida
    if(g.walls.some(w=> s[0]>=w.r && s[0]<=w.r+1 && s[1]>=w.c && s[1]<=w.c+1)) problems.push('pared pegada a una salida');
  }
  if(g.density!=='caos' || g.name!=='Caos'){ /* las estadísticas del generador deben coincidir con la BFS independiente */
    if(JSON.stringify(ind.dists)!==JSON.stringify(g.stats.dists)) problems.push('distancias distintas a la BFS independiente');
  }
  return { problems, dists: ind.dists };
}

const M = boot();
const t00 = Date.now();
let failures = 0;
const fmt = (x, d)=> (Number.isFinite(x) ? x : 0).toFixed(d===undefined ? 1 : d);
console.log('Biblioteca: '+M.MAZE_PATTERNS.length+' patrones, reglas '+JSON.stringify({ minExtra:M.MAZE_RULES.minExtra, capMult:M.MAZE_RULES.capMult, diffMax:M.MAZE_RULES.diffMax, strictExtra:M.MAZE_RULES.strictExtra }));

// 1) cobertura de la biblioteca por tamaño y cantidad de jugadores
console.log('\nPatrones utilizables (al menos una variante colocable y equitativa) / con variante que cumple +2');
for(const players of [2,3,4]){
  const row = [];
  for(const size of [5,7,9,11]){
    const ctx = M.mazeContext(size, players);
    const cand = M.MAZE_PATTERNS.filter(p=> players<3 || p.sym==='c4');
    let ok = 0, pref = 0;
    cand.forEach(p=>{ const t = M.mazeTable(p, ctx); if(t.ok.length) ok++; if(t.pref.length) pref++; });
    row.push(size+'×'+size+': '+ok+'/'+cand.length+' ('+pref+' con +2)');
  }
  console.log('  '+players+' jugadores  '+row.join('   '));
}

// 2) N mapas por tamaño y densidad
console.log('\n'+N+' mapas por tamaño y densidad. rech = intentos rechazados por mapa · fb = mapas que cayeron a un plan B · +2 = todos cumplen el mínimo de +2');
console.log('tamaño jug  densidad  tramos  camino(libre)  dif.media dif.máx  rech   fb%   equit.%  +2%');
for(const size of [5,7,9,11]){
  for(const [players, densities] of [[2, ['ligero','medio','denso','caos']], [3, ['medio']], [4, ['medio']]]){
    for(const density of densities){
      let walls = 0, path = 0, free = 0, diffSum = 0, diffMax = 0, rej = 0, fb = 0, fair = 0, pref = 0, pathN = 0;
      for(let i=0;i<N;i++){
        const g = M.generateMaze({ size, players, density, seed:(i+1)*2654435 % M.SEED_SPACE });
        const c = checkMap(g, size, players);
        if(c.problems.length){ failures++; if(failures<=10) console.log('  ✗ mapa inválido ('+size+', '+players+' jug, '+density+', semilla '+g.seedText+'): '+c.problems.join('; ')); }
        walls += g.placed; rej += g.rejected; if(g.fallback) fb++; if(g.stats.fair) fair++; if(g.stats.preferred) pref++;
        const d = c.dists.filter(x=> x>=0); if(d.length){ path += d.reduce((a,b)=>a+b,0)/d.length; free += g.stats.free.reduce((a,b)=>a+b,0)/g.stats.free.length; pathN++; }
        const df = Math.max(...c.dists)-Math.min(...c.dists); diffSum += df; if(df>diffMax) diffMax = df;
      }
      console.log(String(size+'×'+size).padEnd(7)+String(players).padEnd(4)+density.padEnd(10)+fmt(walls/N).padStart(6)+'  '+(fmt(path/pathN)+' ('+fmt(free/pathN)+')').padEnd(14)+
        fmt(diffSum/N, 2).padStart(9)+String(diffMax).padStart(8)+fmt(rej/N).padStart(7)+fmt(100*fb/N, 0).padStart(6)+fmt(100*fair/N, 0).padStart(9)+fmt(100*pref/N, 0).padStart(7));
    }
  }
}

// 3) la misma semilla tiene que dar siempre el mismo mapa
let notDeterministic = 0;
for(const size of [5,7,9,11]) for(const density of ['ligero','medio','denso','caos']) for(let i=1;i<=50;i++){
  const a = M.generateMaze({ size, players:2, density, seed:i*97 }), b = M.generateMaze({ size, players:2, density, seed:i*97 });
  if(JSON.stringify(a.walls)!==JSON.stringify(b.walls) || a.name!==b.name) notDeterministic++;
}
console.log('\nDeterminismo (misma semilla, mismo mapa): '+(notDeterministic ? '✗ '+notDeterministic+' mapas distintos' : 'ok'));
if(notDeterministic) failures++;

// 4) patrones propios: relativos, sin escalar y con las mismas reglas
const mine = [{ name:'Prueba', pattern:true, walls:[{r:0,c:0,orientation:'h'},{r:0,c:2,orientation:'h'},{r:1,c:1,orientation:'v'}] }];
let mineUsed = 0;
for(let i=1;i<=200;i++){ const g = M.generateMaze({ size:9, players:2, density:'ligero', seed:i*31, mine }); if(g.name.indexOf('Prueba')>=0) mineUsed++; if(checkMap(g, 9, 2).problems.length) failures++; }
console.log('Patrón propio en el sorteo (Ligero, 9×9): salió en '+mineUsed+' de 200 mapas');

// 5) generateRandomWalls devuelve {placed, attempts}
const loc = { size:9, center:{r:4,c:4}, players:[{r:0,c:4},{r:8,c:4}], occupied:Array.from({length:8},()=>Array(8).fill(null)), blockedEdges:new Set(), walls:[] };
const rw = M.generateRandomWalls(loc, 4, Math.random);
console.log('generateRandomWalls → '+JSON.stringify(rw)+(typeof rw.placed==='number' && typeof rw.attempts==='number' ? '  ok' : '  ✗'));
if(!(typeof rw.placed==='number' && typeof rw.attempts==='number')) failures++;

console.log('\n'+(failures ? '✗ '+failures+' problema(s)' : '✓ todo bien')+' · '+((Date.now()-t00)/1000).toFixed(1)+' s');
process.exit(failures ? 1 : 0);
