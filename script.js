(function(){
  "use strict";

  const BOARD_PX = 630;
  const DIRS4 = [[-1,0],[1,0],[0,-1],[0,1]];
  // ---------- Estado del motor de IA (74, 75, 82, 84) ----------
  let HEADLESS = false;                       // pruebas automáticas: sin dibujar, sin sonido, sin estadísticas
  let edgesEpoch = 0;                         // sube cada vez que cambian las paredes de la partida (invalida cachés)
  const BFS_STATS = { calls:0 };
  const _Q = new Int32Array(4096);
  const _STAMPS = new Uint32Array(4096);
  let _stamp = 0;
  const _maskCache = { set:null, epoch:-1, n:-1, size:-1, mask:null };
  const _distCache = { set:null, epoch:-1, n:-1, size:-1, maps:new Map() };
  function makeRng(seed){
    let a = seed>>>0;
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a>>>15, 1 | a);
      t = t + Math.imul(t ^ t>>>7, 61 | t) ^ t;
      return ((t ^ t>>>14) >>> 0) / 4294967296;
    };
  }
  let botRand = makeRng((Math.random()*4294967296)>>>0);   // azar propio de la IA: con semilla se puede repetir una partida
  function setBotSeed(s){ botRand = makeRng(s); }
  // ---------- 2v2: identidad de equipo (48) y compensación de orden (50) ----------
  // Los colores de las fichas son libres (skins), así que el equipo se marca con un anillo aparte: A = blanco continuo,
  // B = negro punteado (la forma del trazo distingue el equipo aunque no se vean bien los colores).
  const TEAM_STYLE = {
    A: { color:'#ffffff', halo:'rgba(0,0,0,.55)',       dash:'' },
    B: { color:'#16161a', halo:'rgba(255,255,255,.65)', dash:'5 4' },
  };
  const TEAM_RING_PX = 3;
  // Paredes extra para el equipo que juega segundo. Valor medido con la simulación (ver informe de la ronda 6).
  const TEAM_SECOND_WALLS = 1;

  const PALETTE = [
    { name:'Jugador 1', color:'#d64550', shape:'circle' },
    { name:'Jugador 2', color:'#3a6ea5', shape:'square' },
    { name:'Jugador 3', color:'#4f8a63', shape:'triangle' },
    { name:'Jugador 4', color:'#e0973c', shape:'diamond' },
  ];
  const SKIN_COLORS = ['#d64550','#3a6ea5','#4f8a63','#e0973c','#8e5fb0','#2f9e97','#c25b9c','#6b7280'];
  const SKIN_SHAPES = ['circle','square','triangle','diamond','star','hex'];
  const SHAPE_LABEL = { circle:'Círculo', square:'Cuadrado', triangle:'Triángulo', diamond:'Rombo', star:'Estrella', hex:'Hexágono' };

  // ---------- assets del kit (Kenney, CC0) ----------
  const ASSET = 'assets/';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const EMOTE_ICON_IDS = ['alert','anger','bars','cash','circle','cloud','cross','dots1','dots2','dots3','drop','drops','exclamation','exclamations','faceAngry','faceHappy','faceSad','heart','heartBroken','hearts','idea','laugh','music','question','sleep','sleeps','star','stars','swirl'];
  const FRAME_IDS = ['f1','f2','f3','f4','f5','f6','f7','none'];
  const emoteIconSrc = id => ASSET + 'emotes/icons/' + id + '.png';
  const frameSrc = id => ASSET + 'emotes/frames/' + id + '.png';
  const medalSrc = n => ASSET + 'medals/m' + n + '.png';

  // ---------- economía / tienda ----------
  const TIERS = {
    bronze: { label:'Bronce', reward:15 },
    silver: { label:'Plata', reward:30 },
    gold:   { label:'Oro', reward:60 },
    legend: { label:'Leyenda', reward:120 },
  };
  const DIFFICULTY = {
    easy:   { label:'Fácil',   wall:0.28, random:0.30, coins:10, hint:'La IA se equivoca seguido y bloquea poco. Ganar da 10 monedas.' },
    normal: { label:'Normal',  wall:0.50, random:0.20, coins:20, hint:'Una IA equilibrada: bloquea a veces y casi no se equivoca. Ganar da 20 monedas.' },
    hard:   { label:'Difícil', wall:0.72, random:0.10, coins:35, hint:'Bloquea todo el tiempo y casi no falla. Ganar da 35 monedas.' },
    expert: { label:'Experto', wall:0.90, random:0.03, coins:50, hint:'La IA más dura: calcula rutas, bloquea con precisión y casi nunca falla. Ganar da 50 monedas.' },
  };
  const DAILY_GAME_COIN_CAP = 120;      // tope diario de monedas por ganar partidas (el desafío diario y los trofeos no cuentan)
  const EMOTE_LIFE_MS = 2500;
  const EMOTE_COOLDOWN_MS = 3000;
  const CPU_EMOTE_COOLDOWN_MS = 9000;
  const SHOP_ITEMS = [
    { id:'e_faceHappy', type:'emote', icon:'faceHappy', name:'Sonrisa', rarity:'common', price:0 },
    { id:'e_laugh', type:'emote', icon:'laugh', name:'Jajaja', rarity:'common', price:0 },
    { id:'e_faceSad', type:'emote', icon:'faceSad', name:'Bajón', rarity:'common', price:30 },
    { id:'e_question', type:'emote', icon:'question', name:'¿Eh?', rarity:'common', price:30 },
    { id:'e_exclamation', type:'emote', icon:'exclamation', name:'¡Ojo!', rarity:'common', price:30 },
    { id:'e_sleep', type:'emote', icon:'sleep', name:'Zzz', rarity:'common', price:30 },
    { id:'e_cloud', type:'emote', icon:'cloud', name:'Nubarrón', rarity:'common', price:30 },
    { id:'e_faceAngry', type:'emote', icon:'faceAngry', name:'Enojo', rarity:'rare', price:80 },
    { id:'e_heart', type:'emote', icon:'heart', name:'Corazón', rarity:'rare', price:80 },
    { id:'e_music', type:'emote', icon:'music', name:'Música', rarity:'rare', price:80 },
    { id:'e_idea', type:'emote', icon:'idea', name:'Idea', rarity:'rare', price:80 },
    { id:'e_star', type:'emote', icon:'star', name:'Estrella', rarity:'rare', price:80 },
    { id:'e_hearts', type:'emote', icon:'hearts', name:'Amor', rarity:'epic', price:150 },
    { id:'e_stars', type:'emote', icon:'stars', name:'Destellos', rarity:'epic', price:150 },
    { id:'e_cash', type:'emote', icon:'cash', name:'Billete', rarity:'epic', price:150 },
    { id:'e_swirl', type:'emote', icon:'swirl', name:'Mareo', rarity:'epic', price:150 },
    { id:'fr_f1', type:'frame', frame:'f1', name:'Cuadrado', price:0 },
    { id:'fr_f3', type:'frame', frame:'f3', name:'Redondo', price:40 },
    { id:'fr_none', type:'frame', frame:'none', name:'Sin globo', price:40 },
    { id:'fr_f2', type:'frame', frame:'f2', name:'Cuadrado azul', price:60 },
    { id:'fr_f4', type:'frame', frame:'f4', name:'Redondo con borde', price:60 },
    { id:'fr_f5', type:'frame', frame:'f5', name:'Pensamiento', price:80 },
    { id:'fr_f6', type:'frame', frame:'f6', name:'Pensamiento con borde', price:120 },
    { id:'fr_f7', type:'frame', frame:'f7', name:'Estallido', price:150 },
  ];
  // ---------- 137 · sumideros de monedas: temas de tablero (cosméticos) ----------
  // 141 · availableFrom / availableTo (ISO UTC) limitan sólo la COMPRA; lo ya comprado se conserva al vencer la oferta.
  // sinceFirstSessionHours cuenta desde la primera sesión (wallet.firstSeen).
  SHOP_ITEMS.push(
    { id:'th_clasico', type:'theme', theme:'clasico', name:'Clásico', price:0, colors:['#e7ddc9','#ddcfb0'] },
    { id:'th_mar', type:'theme', theme:'mar', name:'Mar', price:120, colors:['#d8e6ea','#b9d3db'] },
    { id:'th_bosque', type:'theme', theme:'bosque', name:'Bosque', price:120, colors:['#dde5d1','#c3d1b0'] },
    { id:'th_carbon', type:'theme', theme:'carbon', name:'Carbón', price:200, colors:['#c9ccd1','#aeb3ba'] },
    { id:'th_primavera', type:'theme', theme:'primavera', name:'Primavera', price:150, season:true,
      availableFrom:'2026-09-23T00:00:00Z', availableTo:'2026-12-21T00:00:00Z', colors:['#f3e4eb','#e8c9d6'] },
    { id:'th_verano', type:'theme', theme:'verano', name:'Verano', price:150, season:true,
      availableFrom:'2026-12-21T00:00:00Z', availableTo:'2027-03-21T00:00:00Z', colors:['#f6ecc4','#ecd98f'] },
    { id:'pk_bienvenida', type:'pack', name:'Paquete de bienvenida', price:0, sinceFirstSessionHours:48,
      grants:{ coins:100, items:['e_heart','th_mar'] } }
  );
  const SHOP_TABS = [
    { id:'common', label:'Comunes' }, { id:'rare', label:'Raros' }, { id:'epic', label:'Épicos' }, { id:'frames', label:'Globos' },
    { id:'themes', label:'Tableros' }, { id:'offers', label:'Ofertas' },
  ];

  // ---------- 138/139 · monetización ----------
  const AD_UNLOCK_MS = 30 * 60 * 1000;            // un anuncio recompensado desbloquea 30 minutos
  const AD_TIMEOUT_MS = 5 * 60 * 1000;            // si el puente nunca responde, el pedido se descarta (sin pago)
  const LOCKED_MODES = ['party', 'hunter'];       // modos que piden anuncio o Premium (para no bloquear ninguno: [])
  const PREMIUM_PRODUCT_ID = 'premium_unlock';    // id del producto único en Play Console
  const PREMIUM_GRACE_MS = 3 * 24 * 3600 * 1000;  // sin conexión, el último chequeo verificado vale 3 días
  const CLOCK_BACK_TOL_MS = 2 * 60 * 1000;        // tolerancia antes de considerar que se atrasó el reloj

  // ---------- modos de partida ----------
  // Rey de la colina: turnos SEGUIDOS dentro de la zona según la cantidad de jugadores (con más rivales
  // la zona se disputa más, así que alcanza con menos turnos) y empujones por jugador.
  const HILL_TARGET = { 2:4, 3:3, 4:3 };
  const HILL_TARGET_DEFAULT = 3;   // por si alguna vez se juega con otra cantidad de jugadores
  const HILL_PUSHES = 2;
  const HILL_MIN_ACCESSES = 2;      // la zona nunca puede quedar con menos accesos que estos
  const HILL_TARGET_TEXT = Object.keys(HILL_TARGET).map(n=> `${n} jugadores: ${HILL_TARGET[n]} turnos`).join(' · ');
  // ---------- Fiesta: catálogo de poderes ----------
  // kind 'instant': se aplica al recogerlo. kind 'stored': se guarda (hasta PARTY_MAX_HELD, sin repetidos) y se usa en el propio turno.
  // Reglas para que ninguno rompa la partida: UN poder por turno (el turno extra cuenta como el mismo turno), cada poder tiene
  // su tope (ver abajo), el poder en el tablero aparece en una casilla "justa" y se desvanece si nadie lo agarra.
  const PARTY_MAX_HELD = 2;            // poderes guardados a la vez por jugador
  const PARTY_TOKEN_TTL = 4;           // rondas que un poder dura en el tablero
  const PARTY_RESPAWN_MIN = 2;         // rondas hasta el siguiente poder (+0 o +1 al azar)
  const PARTY_SPAWN_MAX_DIST = 4;      // el poder aparece a lo sumo a 4 pasos de quien más cerca esté
  const PARTY_WALL_BONUS_MAX = 2;      // Pared extra: como mucho +2 por jugador y partida
  const PARTY_SHIELD_ROUNDS = 2;       // Escudo: rondas de protección
  const PARTY_STUN_IMMUNE_TURNS = 2;   // tras perder un turno por aturdimiento, 2 turnos propios sin poder aturdirlo de nuevo
  const PARTY_STUN_MAX_LEAD = 1;       // Aturdir: sólo contra un rival que no esté a más de 1 paso detrás de quien lo usa
  const PARTY_POWERS = {
    pared_extra:  { name:'Pared extra',  emoji:'🧱', icon:'bars',         kind:'instant', weight:3, catchUp:false, duration:'Permanente',
      desc:`Suma 1 pared a tu reserva al instante (máximo +${PARTY_WALL_BONUS_MAX} por partida).` },
    paso_doble:   { name:'Paso doble',   emoji:'👟', icon:'exclamations', kind:'stored',  weight:3, catchUp:true,  duration:'1 movimiento',
      desc:'Este turno avanzás 2 casillas en línea recta, sin cruzar paredes ni fichas. No sirve para pisar el centro.' },
    turno_extra:  { name:'Turno extra',  emoji:'⏩', icon:'star',         kind:'stored',  weight:2, catchUp:true,  duration:'1 acción extra',
      desc:'Jugás dos acciones seguidas (mover o poner pared).' },
    aturdido:     { name:'Aturdir',      emoji:'💫', icon:'swirl',        kind:'stored',  weight:2, catchUp:true,  duration:'1 turno del rival',
      desc:`El rival mejor ubicado pierde su próximo turno y después queda ${PARTY_STUN_IMMUNE_TURNS} turnos sin poder ser aturdido. Sólo sirve contra quien va igual o mejor que vos (o a lo sumo ${PARTY_STUN_MAX_LEAD} paso detrás).` },
    romper_pared: { name:'Romper pared', emoji:'🔨', icon:'cross',        kind:'stored',  weight:2, catchUp:true,  duration:'Instantáneo',
      desc:'Quita la pared de un rival que más te alarga el camino, siempre que a vos te ayude más que a cualquier rival.' },
    escudo:       { name:'Escudo',       emoji:'🛡️', icon:'heart',        kind:'stored',  weight:2, catchUp:false, duration:`${PARTY_SHIELD_ROUNDS} rondas`,
      desc:`Durante ${PARTY_SHIELD_ROUNDS} rondas nadie puede aturdirte.` },
  };
  const PARTY_TYPES = Object.keys(PARTY_POWERS);
  const PARTY_BOT_USE = { easy:0.5, normal:0.75, hard:0.95, expert:1 };   // con qué ganas cada IA usa un poder que le conviene
  const PARTY_BOT_DETOUR = { easy:0, normal:1, hard:1, expert:2 };        // pasos de desvío que acepta para agarrar un poder
  const RULESETS = {
    classic: { label:'Clásico', hint:'Las reglas de siempre: movete y bloqueá con paredes hasta llegar al centro.' },
    official:{ label:'Clásico oficial', hint:'Como el Quoridor de mesa: gana quien llega primero al lado opuesto del tablero (la franja de su color), no al centro. Con 3 o 4 jugadores cada uno va al lado contrario al suyo.' },
    fog:     { label:'Niebla de guerra', hint:'Sólo ves las paredes cercanas a quien juega en ese turno. Las lejanas siguen bloqueando aunque no se vean.', forcePlayers:null },
    teams:   { label:'2v2 (equipos)', hint:'4 fichas: Equipo A (jugadores 1 y 3) contra Equipo B (jugadores 2 y 4). Cada equipo comparte una sola reserva de paredes, empieza un equipo sorteado (el otro recibe una pared de compensación) y podés intercambiar lugar con tu aliado. Gana el primero que llega al centro, o el equipo cuyos dos aliados llegan. Se puede jugar entre 4 personas o «Yo + IA contra 2 IA».', forcePlayers:4, forceLocal:true },
    party:   { label:'Fiesta', hint:`Cada tanto aparece un poder en una casilla justa del tablero y dura ${PARTY_TOKEN_TTL} rondas si nadie lo agarra. Pared extra se aplica al instante; los demás (paso doble, turno extra, aturdir, romper pared y escudo) los guardás —hasta ${PARTY_MAX_HELD}— y los usás en tu turno. Un poder por turno, y cada uno trae su tope para que la partida siga pareja. La IA también los usa.` },
    maze:    { label:'Laberinto', hint:'El tablero arranca con paredes al azar ya colocadas (o con tu propio diseño del editor de niveles), garantizando que siempre haya camino.' },
    blitz:   { label:'Contrarreloj', hint:'Cada turno corre contra el reloj (10, 20, 30 o 45 s; por defecto 10 s + el tamaño del tablero), sea para mover o para poner una pared. Si se acaba, se juega solo el paso que más te acerca al centro (nunca una pared). Con 2 jugadores también hay reloj de ajedrez: 60 s de banco y +3 s por jugada; pierde quien llega a 0.' },
    mirror:  { label:'Espejo', hint:'Sólo para 2 jugadores. Cada pared que colocás aparece también reflejada en el punto opuesto del tablero.', forcePlayers:2 },
    hill:    { label:'Rey de la colina', hint:`No alcanza con pisar el centro: hay que terminar turnos SEGUIDOS dentro de la zona central (${HILL_TARGET_TEXT}). Si salís de la zona o te empujan, el conteo vuelve a 0. Cada jugador tiene ${HILL_PUSHES} empujones para sacar al rival, y no se puede cerrar la zona a menos de ${HILL_MIN_ACCESSES} accesos.` },
    hunter:  { label:'Cazador y fugitivo', hint:'El Jugador 1 es el fugitivo (contra la IA elegís tu rol) y gana si llega al centro. Los cazadores ganan atrapándolo —terminar su movimiento junto al fugitivo, sin pared de por medio— o si se acaba el límite de rondas. El fugitivo tiene 2 sprints y deja huellas durante 2 turnos; los cazadores comparten un pozo de paredes.' },
  };
  // Niebla de guerra: radio proporcional al tablero (antes era fijo en 2, casi todo un 5×5 y casi nada
  // de un 11×11). `extra` permite ampliarlo (la IA en Experto ve un poco más lejos, como cualquier rival duro).
  function fogRadius(extra){ return Math.max(2, Math.round(state.size/4)) + (extra||0); }
  const FOG_ECHO_LIFE = 2;          // turnos que dura el eco de un rival tras salir del radio
  const FOG_SEEN_OPACITY = 0.45;    // opacidad de las paredes ya vistas pero fuera del radio actual
  function wallSlotKey(r,c,orientation){ return r+','+c+','+orientation; }
  // Contrarreloj: segundos por turno configurables (por defecto 10 + tamaño del tablero) y reloj de ajedrez.
  const BLITZ_SECONDS_CHOICES = [10, 20, 30, 45];
  function blitzDefaultSeconds(size){ return 10 + size; }
  const CLOCK_BANK_SECONDS = 60;          // reloj de ajedrez: banco inicial por jugador
  const CLOCK_INCREMENT_SECONDS = 3;      // reloj de ajedrez: segundos que se suman por jugada
  const CLOCK_LOW_SECONDS = 5;            // desde acá: tic con tono creciente y aro/barra en rojo
  const CLOCK_VIBRATE_SECONDS = 3;        // desde acá: vibración corta en cada segundo
  const TIMEOUT_PAUSE_STREAK = 2;         // vencimientos seguidos (sin que nadie juegue) que pausan la partida
  const BOT_THINK_MS = [550, 1000];       // cuánto "piensa" la IA
  const BOT_THINK_BLITZ_MS = [300, 600];  // ... en Contrarreloj
  let blitzPrefs = { seconds:0, clock:'turn' };   // seconds 0 = automático (10 + tamaño); clock 'turn' | 'chess'
  function blitzSetup(size, playersCount){        // lo que recibe initGame al arrancar una partida de Contrarreloj
    return {
      turnTimeSeconds: blitzPrefs.seconds || blitzDefaultSeconds(size),
      clockMode: (blitzPrefs.clock==='chess' && playersCount===2) ? 'chess' : 'turn',
    };
  }
  const HUNTER_ROUNDS_EXTRA = 3;   // límite de rondas = size + este valor (una ronda = todos jugaron una vez)
  const HUNTER_SPRINTS = 2;        // usos del paso doble en línea recta del fugitivo
  const HUNTER_POOL_MULT = 2;      // pozo compartido de paredes de los cazadores = paredes por jugador * este valor
  const HUNTER_TRAIL_LIFE = 2;     // turnos del fugitivo que dura cada huella
  const CAMPAIGN_LEVELS = [
    { id:1, name:'Primer duelo', rival:'Toto', personality:'speed', difficulty:'easy', size:5, xp:100, intro:'Toto todavía está aprendiendo. Aprovechá sus movimientos directos.' },
    { id:2, name:'El desafío de Mora', rival:'Mora', personality:'defensive', difficulty:'easy', size:7, xp:125, intro:'Mora prefiere cerrar caminos antes que correr al centro.' },
    { id:3, name:'Rulo contraataca', rival:'Rulo', personality:'aggressive', difficulty:'normal', size:7, xp:150, intro:'Rulo empieza a usar las paredes para frenarte.' },
    { id:4, name:'La estratega Nina', rival:'Nina', personality:'strategist', difficulty:'normal', size:9, xp:175, intro:'Nina calcula mejor sus bloqueos y busca el camino más corto.' },
    { id:5, name:'Bruno no cede', rival:'Bruno', personality:'defensive', difficulty:'normal', size:9, xp:200, intro:'Bruno conserva paredes y espera el momento justo.' },
    { id:6, name:'Vega acelera', rival:'Vega', personality:'speed', difficulty:'hard', size:9, xp:225, intro:'Vega prioriza avanzar y te obliga a reaccionar rápido.' },
    { id:7, name:'Sombra', rival:'Sombra', personality:'aggressive', difficulty:'hard', size:11, xp:250, intro:'Sombra empieza a presionar con bloqueos cerca de tu ruta.' },
    { id:8, name:'Atlas', rival:'Atlas', personality:'strategist', difficulty:'hard', size:11, xp:275, intro:'Atlas analiza el tablero completo antes de decidir.' },
    { id:9, name:'Lince', rival:'Lince', personality:'speed', difficulty:'expert', size:9, xp:300, intro:'Lince combina velocidad con bloqueos oportunistas.' },
    { id:10, name:'El maestro', rival:'Maestro', personality:'strategist', difficulty:'expert', size:11, xp:400, intro:'El último rival domina todas las herramientas del tablero.' },
  ];
  const CAMPAIGN_RANKS = [
    { name:'Novato', min:0 }, { name:'Aprendiz', min:150 }, { name:'Táctico', min:400 },
    { name:'Estratega', min:750 }, { name:'Maestro', min:1200 }, { name:'Leyenda', min:1800 }
  ];
  const CAMPAIGN_SKIN_UNLOCKS = { 4:{color:'#8e5fb0'}, 6:{color:'#2f9e97'}, 8:{color:'#c25b9c'}, 10:{color:'#6b7280'} };
  const CAMPAIGN_SHAPE_UNLOCKS = { 3:'star', 5:'hex' };
  function blankCampaign(){ return { xp:0, unlockedLevel:1, completed:[], wins:0, losses:0 }; }
  function loadCampaign(){
    const base=blankCampaign();
    try{
      const raw=localStorage.getItem('quoridor_campaign');
      if(raw){ const d=JSON.parse(raw)||{}; base.xp=+d.xp||0; base.unlockedLevel=Math.max(1,Math.min(CAMPAIGN_LEVELS.length,+d.unlockedLevel||1)); base.completed=Array.isArray(d.completed)?d.completed:[]; base.wins=+d.wins||0; base.losses=+d.losses||0; }
    }catch(e){}
    return base;
  }
  let campaignData=loadCampaign();
  // ---------- logros (con categoría, tier, medalla, recompensa y progreso) ----------
  function totalWins(s){ return (s.winsBySlot||[0,0,0,0]).reduce((a,b)=>a+b,0); }
  function prog(cur, goal){ return [Math.max(0, Math.min(cur||0, goal)), goal]; }
  function flag(cond){ return [cond ? 1 : 0, 1]; }
  const MODE_KEYS = Object.keys(RULESETS).filter(k=> k!=='classic');
  function A(id, cat, icon, name, desc, tier, medal, check, progress){
    return { id, cat, icon, name, desc, tier, medal, reward: TIERS[tier].reward, check, progress };
  }
  const ACH_CATS = ['Partidas','Victorias','IA','Estilo','Tableros','Modos','Diario','Extras'];
  const ACHIEVEMENTS = [
    A('jugar_1','Partidas','🎮','Primer paso','Jugá tu primera partida.','bronze',1, s=> s.totalGames>=1, s=> prog(s.totalGames,1)),
    A('jugar_10','Partidas','📅','Habitué','Jugá 10 partidas.','bronze',1, s=> s.totalGames>=10, s=> prog(s.totalGames,10)),
    A('jugar_50','Partidas','🗓️','De la casa','Jugá 50 partidas.','silver',2, s=> s.totalGames>=50, s=> prog(s.totalGames,50)),
    A('maraton_60','Partidas','🐢','Maratón','Jugá una partida de más de 60 movimientos en total.','bronze',1, s=> s.longestGameMoves>=60, s=> prog(s.longestGameMoves,60)),
    A('victoria_1','Victorias','🥇','Primera victoria','Ganá tu primera partida.','bronze',1, s=> totalWins(s)>=1, s=> prog(totalWins(s),1)),
    A('victoria_10','Victorias','🏆','Ganador serial','Sumá 10 victorias entre todos los jugadores.','silver',4, s=> totalWins(s)>=10, s=> prog(totalWins(s),10)),
    A('victoria_50','Victorias','👑','Leyenda del tablero','Sumá 50 victorias entre todos los jugadores.','gold',3, s=> totalWins(s)>=50, s=> prog(totalWins(s),50)),
    A('racha_3','Victorias','🔥','Rachero','Ganá 3 partidas seguidas con el mismo jugador.','silver',2, s=> !!(s.streak&&s.streak.count>=3), s=> prog(s.streak&&s.streak.count,3)),
    A('racha_5','Victorias','🚀','Imparable','Ganá 5 partidas seguidas con el mismo jugador.','gold',5, s=> !!(s.streak&&s.streak.count>=5), s=> prog(s.streak&&s.streak.count,5)),
    A('vs_ia_ganar','IA','🤖','Más listo que la máquina','Ganale una partida a la IA.','bronze',1, s=> !!(s.vsCpu&&s.vsCpu.won>=1), s=> prog(s.vsCpu&&s.vsCpu.won,1)),
    A('vs_ia_normal','IA','⚔️','A la altura','Ganale a la IA en dificultad Normal o Difícil.','silver',6, s=> s.vsCpuNormalWon>=1, s=> prog(s.vsCpuNormalWon,1)),
    A('vs_ia_dificil','IA','🧠','Sin ayuda de nadie','Ganale a la IA en dificultad difícil.','gold',7, s=> s.vsCpuHardWon>=1, s=> prog(s.vsCpuHardWon,1)),
    A('vs_ia_10','IA','⚙️','Domador de bots','Ganale 10 partidas a la IA.','silver',4, s=> !!(s.vsCpu&&s.vsCpu.won>=10), s=> prog(s.vsCpu&&s.vsCpu.won,10)),
    A('sin_paredes','Estilo','🚫','Camino directo','Ganá una partida sin colocar ninguna pared.','silver',2, s=> s.noWallWins>=1, s=> prog(s.noWallWins,1)),
    A('todas_paredes','Estilo','🧱','Arquitecto','Ganá una partida habiendo usado todas tus paredes.','silver',6, s=> s.allWallsUsedWins>=1, s=> prog(s.allWallsUsedWins,1)),
    A('rapido_15','Estilo','⚡','Directo al grano','Ganá una partida en 15 movimientos o menos.','silver',4, s=> s.fastestWinMoves!=null && s.fastestWinMoves<=15, s=> flag(s.fastestWinMoves!=null && s.fastestWinMoves<=15)),
    A('paredes_100','Estilo','🏗️','Constructor','Colocá 100 paredes en total, sumando todas las partidas.','silver',2, s=> s.totalWallsPlaced>=100, s=> prog(s.totalWallsPlaced,100)),
    A('tablero_5','Tableros','🔹','Sprint','Ganá una partida en un tablero de 5×5.','bronze',1, s=> !!(s.sizeWins&&s.sizeWins[5]>=1), s=> prog(s.sizeWins&&s.sizeWins[5],1)),
    A('tablero_11','Tableros','🔷','Territorio grande','Ganá una partida en un tablero de 11×11.','silver',6, s=> !!(s.sizeWins&&s.sizeWins[11]>=1), s=> prog(s.sizeWins&&s.sizeWins[11],1)),
    A('cuatro_jugadores','Tableros','👥','Multitud','Ganá una partida de 4 jugadores.','silver',4, s=> s.winsWith4>=1, s=> prog(s.winsWith4,1)),
    A('modo_niebla','Modos','🌫️','Ojo de águila','Ganá una partida en modo Niebla de guerra.','bronze',1, s=> !!(s.modeWins&&s.modeWins.fog>=1), s=> prog(s.modeWins&&s.modeWins.fog,1)),
    A('modo_equipos','Modos','🤝','Trabajo en equipo','Ganá una partida en modo 2v2.','bronze',1, s=> !!(s.modeWins&&s.modeWins.teams>=1), s=> prog(s.modeWins&&s.modeWins.teams,1)),
    A('modo_fiesta','Modos','🎉','El alma de la fiesta','Ganá una partida en modo Fiesta.','bronze',1, s=> !!(s.modeWins&&s.modeWins.party>=1), s=> prog(s.modeWins&&s.modeWins.party,1)),
    A('modo_laberinto','Modos','🧊','Sin perderse','Ganá una partida en modo Laberinto.','bronze',1, s=> !!(s.modeWins&&s.modeWins.maze>=1), s=> prog(s.modeWins&&s.modeWins.maze,1)),
    A('modo_blitz','Modos','⏱️','Contra las cuerdas','Ganá una partida en modo Contrarreloj.','silver',4, s=> !!(s.modeWins&&s.modeWins.blitz>=1), s=> prog(s.modeWins&&s.modeWins.blitz,1)),
    A('modo_espejo','Modos','🪞','Simetría perfecta','Ganá una partida en modo Espejo.','silver',6, s=> !!(s.modeWins&&s.modeWins.mirror>=1), s=> prog(s.modeWins&&s.modeWins.mirror,1)),
    A('modo_colina','Modos','⛰️','Rey de la colina','Ganá una partida en modo Rey de la colina.','silver',2, s=> !!(s.modeWins&&s.modeWins.hill>=1), s=> prog(s.modeWins&&s.modeWins.hill,1)),
    A('modo_cazador','Modos','🏹','Cacería exitosa','Ganá una partida en modo Cazador y fugitivo, como fugitivo o como cazador.','silver',4, s=> !!(s.modeWins&&s.modeWins.hunter>=1), s=> prog(s.modeWins&&s.modeWins.hunter,1)),
    A('cazador_1','Modos','🎯','Ojo de halcón','Atrapá al fugitivo jugando de cazador.','silver',9, s=> s.hunterCaptures>=1, s=> prog(s.hunterCaptures,1)),
    A('cazador_5','Modos','🦅','Cazador serial','Atrapá al fugitivo 5 veces jugando de cazador.','gold',3, s=> s.hunterCaptures>=5, s=> prog(s.hunterCaptures,5)),
    A('fugitivo_3','Modos','💨','Escurridizo','Escapá al centro como fugitivo 3 veces.','silver',6, s=> s.hunterEscapes>=3, s=> prog(s.hunterEscapes,3)),
    A('todos_los_modos','Modos','🌈','Probaste de todo','Jugá al menos una vez en todos los modos especiales.','legend',9,
      s=> !!s.modesPlayed && MODE_KEYS.every(k=> (s.modesPlayed[k]||0)>=1),
      s=> prog(MODE_KEYS.filter(k=> s.modesPlayed && (s.modesPlayed[k]||0)>=1).length, MODE_KEYS.length)),
    A('desafio_1','Diario','📌','Reto del día','Resolvé el desafío diario.','bronze',1, s=> !!(s.daily&&s.daily.completedCount>=1), s=> prog(s.daily&&s.daily.completedCount,1)),
    A('desafio_racha_7','Diario','📆','Semana completa','Completá el desafío diario 7 días seguidos.','legend',8, s=> !!(s.daily&&s.daily.bestStreak>=7), s=> prog(s.daily&&s.daily.bestStreak,7)),
    A('personalizar_ficha','Extras','🎨','Estilo propio','Cambiá el color o la forma de una ficha.','bronze',1, s=> !!s.skinsCustomized, s=> flag(!!s.skinsCustomized)),
    A('editor_1','Extras','🧩','Diseñador','Creá y jugá un nivel propio en el editor.','bronze',1, s=> s.customLevelsPlayed>=1, s=> prog(s.customLevelsPlayed,1)),
  ];

  // ---------- DOM refs ----------
  const menuScreen = document.getElementById('menuScreen');
  const gameScreen = document.getElementById('gameScreen');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const menuBtn = document.getElementById('menuBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const turnIndicator = document.getElementById('turnIndicator');
  const playersListEl = document.getElementById('playersList');
  const boardSvg = document.getElementById('boardSvg');
  const gridEl = document.getElementById('gridGroup');
  const movesEl = document.getElementById('movesGroup');
  const wallsEl = document.getElementById('wallsGroup');
  const piecesEl = document.getElementById('piecesGroup');
  const previewEl = document.getElementById('wallPreview');
  const teamHudEl = document.getElementById('teamHud');
  const fogOverlayEl = document.getElementById('fogOverlay');
  const fogMaskHoleEl = document.getElementById('fogMaskHole');
  const winOverlay = document.getElementById('winOverlay');
  const winCard = document.getElementById('winCard');
  const winTitle = document.getElementById('winTitle');
  const playAgainBtn = document.getElementById('playAgainBtn');
  const changeConfigBtn = document.getElementById('changeConfigBtn');
  const moveModeBtn = document.getElementById('moveModeBtn');
  const wallModeBtn = document.getElementById('wallModeBtn');
  const sprintBtn = document.getElementById('sprintBtn');
  const undoBtn = document.getElementById('undoBtn');
  const auxToggle = document.getElementById('auxToggle');
  const pieBtn = document.getElementById('pieBtn');
  const distChipsEl = document.getElementById('distChips');
  const boardNoteEl = document.getElementById('boardNote');
  const distHelpToggle = document.getElementById('distHelpToggle');
  const lotteryToggle = document.getElementById('lotteryToggle');
  const pieToggle = document.getElementById('pieToggle');
  const powerBar = document.getElementById('powerBar');
  const powerBtns = document.getElementById('powerBtns');
  const powerNote = document.getElementById('powerNote');
  const powerHelpList = document.getElementById('powerHelpList');
  const sprintCount = document.getElementById('sprintCount');
  const roleFieldset = document.getElementById('roleFieldset');
  const hintLine = document.getElementById('hintLine');
  const repeatMapBtn = document.getElementById('repeatMapBtn');
  const winMapInfo = document.getElementById('winMapInfo');
  const winKeyMoment = document.getElementById('winKeyMoment');
  const mazeRandomOptions = document.getElementById('mazeRandomOptions');
  const mazeDensityGroup = document.getElementById('mazeDensityGroup');
  const mazeDensityHint = document.getElementById('mazeDensityHint');
  const mazeMineCheck = document.getElementById('mazeMineCheck');
  const mazeMineCount = document.getElementById('mazeMineCount');
  const mazeMinimap = document.getElementById('mazeMinimap');
  const mazeMapName = document.getElementById('mazeMapName');
  const mazeSeedText = document.getElementById('mazeSeedText');
  const mazeDiceBtn = document.getElementById('mazeDiceBtn');
  const editorSavePatternBtn = document.getElementById('editorSavePatternBtn');
  const namePromptTitle = document.getElementById('namePromptTitle');

  const difficultyFieldset = document.getElementById('difficultyFieldset');
  const playersFieldset = document.getElementById('playersFieldset');
  const namesContainer = document.getElementById('namesContainer');
  const settingsLinkBtn = document.getElementById('settingsLinkBtn');
  const skinsLinkBtn = document.getElementById('skinsLinkBtn');
  const statsLinkBtn = document.getElementById('statsLinkBtn');
  const helpLinkBtn = document.getElementById('helpLinkBtn');

  const confirmOverlay = document.getElementById('confirmOverlay');
  const confirmMessage = document.getElementById('confirmMessage');
  const confirmYesBtn = document.getElementById('confirmYesBtn');
  const confirmNoBtn = document.getElementById('confirmNoBtn');

  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsThemeGroup = document.getElementById('settingsThemeGroup');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');

  const tutorialOverlay = document.getElementById('tutorialOverlay');
  const closeTutorialBtn = document.getElementById('closeTutorialBtn');

  const statsOverlay = document.getElementById('statsOverlay');
  const statsBody = document.getElementById('statsBody');
  const resetStatsBtn = document.getElementById('resetStatsBtn');
  const closeStatsBtn = document.getElementById('closeStatsBtn');

  const skinsOverlay = document.getElementById('skinsOverlay');
  const skinsBody = document.getElementById('skinsBody');
  const resetSkinsBtn = document.getElementById('resetSkinsBtn');
  const closeSkinsBtn = document.getElementById('closeSkinsBtn');

  const achievementsOverlay = document.getElementById('achievementsOverlay');
  const achSummary = document.getElementById('achSummary');
  const achGrid = document.getElementById('achGrid');
  const closeAchievementsBtn = document.getElementById('closeAchievementsBtn');
  const achievementsLinkBtn = document.getElementById('achievementsLinkBtn');
  const achievementToast = document.getElementById('achievementToast');

  const dailyOverlay = document.getElementById('dailyOverlay');
  const dailyStatusBody = document.getElementById('dailyStatusBody');
  const playDailyBtn = document.getElementById('playDailyBtn');
  const closeDailyBtn = document.getElementById('closeDailyBtn');
  const dailyLinkBtn = document.getElementById('dailyLinkBtn');
  const shareDailyBtn = document.getElementById('shareDailyBtn');
  const shareDailyOverlayBtn = document.getElementById('shareDailyOverlayBtn');
  const dailyCalTitle = document.getElementById('dailyCalTitle');
  const dailyCalGrid = document.getElementById('dailyCalGrid');
  const dailyCalLegend = document.getElementById('dailyCalLegend');
  const dailyCalPrev = document.getElementById('dailyCalPrev');
  const dailyCalNext = document.getElementById('dailyCalNext');

  const rulesetSelect = document.getElementById('rulesetSelect');
  const rulesetHint = document.getElementById('rulesetHint');
  const turnTimerBadge = document.getElementById('turnTimerBadge');
  const pauseNotice = document.getElementById('pauseNotice');

  const reminderTimeInput = document.getElementById('reminderTimeInput');
  const reminderToggleBtn = document.getElementById('reminderToggleBtn');
  const reminderHint = document.getElementById('reminderHint');

  const editorLinkBtn = document.getElementById('editorLinkBtn');
  const editorScreen = document.getElementById('editorScreen');
  const editorBackBtn = document.getElementById('editorBackBtn');
  const editorSizeSelect = document.getElementById('editorSizeSelect');
  const editorClearBtn = document.getElementById('editorClearBtn');
  const editorSaveBtn = document.getElementById('editorSaveBtn');
  const editorPlayBtn = document.getElementById('editorPlayBtn');
  const editorBoardSvg = document.getElementById('editorBoardSvg');
  const editorGridGroup = document.getElementById('editorGridGroup');
  const editorWallsGroup = document.getElementById('editorWallsGroup');
  const editorFeedback = document.getElementById('editorFeedback');
  const editorLevelsList = document.getElementById('editorLevelsList');

  const winMsg = document.getElementById('winMsg');
  const winStars = document.getElementById('winStars');
  const winRewards = document.getElementById('winRewards');
  const winGoal = document.getElementById('winGoal');
  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const teamSetupFieldset = document.getElementById('teamSetupFieldset');
  const teamGoalFieldset = document.getElementById('teamGoalFieldset');
  const handoffOverlay = document.getElementById('handoffOverlay');
  const handoffTitle = document.getElementById('handoffTitle');
  const handoffMsg = document.getElementById('handoffMsg');
  const handoffReadyBtn = document.getElementById('handoffReadyBtn');
  const moreOverlay = document.getElementById('moreOverlay');
  const moreLinkBtn = document.getElementById('moreLinkBtn');
  const closeMoreBtn = document.getElementById('closeMoreBtn');
  const shopOverlay = document.getElementById('shopOverlay');
  const shopExtrasEl = document.getElementById('shopExtras');
  const winDoubleBtn = document.getElementById('winDoubleBtn');
  const shopLinkBtn = document.getElementById('shopLinkBtn');
  const closeShopBtn = document.getElementById('closeShopBtn');
  const shopSlotsEl = document.getElementById('shopSlots');
  const shopTabsEl = document.getElementById('shopTabs');
  const shopGridEl = document.getElementById('shopGrid');
  const shopDetailEl = document.getElementById('shopDetail');
  const achCatsEl = document.getElementById('achCats');
  const claimAllBtn = document.getElementById('claimAllBtn');
  const namePromptOverlay = document.getElementById('namePromptOverlay');
  const levelNameInput = document.getElementById('levelNameInput');
  const levelNameOkBtn = document.getElementById('levelNameOkBtn');
  const levelNameCancelBtn = document.getElementById('levelNameCancelBtn');
  const sfxVolumeInput = document.getElementById('sfxVolume');
  const sfxVolLabel = document.getElementById('sfxVolLabel');
  const musicRow = document.getElementById('musicRow');
  const musicVolumeInput = document.getElementById('musicVolume');
  const musicVolLabel = document.getElementById('musicVolLabel');
  const vibrateToggle = document.getElementById('vibrateToggle');
  const showMovesToggle = document.getElementById('showMovesToggle');
  const glassToggle = document.getElementById('glassToggle');
  const explainToggle = document.getElementById('explainToggle');
  const adaptiveToggle = document.getElementById('adaptiveToggle');
  const adaptiveHint = document.getElementById('adaptiveHint');
  const difficultyHint = document.getElementById('difficultyHint');

  const customLevelFieldset = document.getElementById('customLevelFieldset');
  const customLevelSelect = document.getElementById('customLevelSelect');
  const editorPlayersCount = document.getElementById('editorPlayersCount');
  const editorTurnTime = document.getElementById('editorTurnTime');
  const editorRuleset = document.getElementById('editorRuleset');
  const editorPlayersConfig = document.getElementById('editorPlayersConfig');
  const editorObjectiveCoords = document.getElementById('editorObjectiveCoords');
  const editorObjectiveRow = document.getElementById('editorObjectiveRow');
  const editorObjectiveCol = document.getElementById('editorObjectiveCol');
  const campaignBtn = document.getElementById('campaignLinkBtn');
  const campaignOverlay = document.getElementById('campaignOverlay');
  const closeCampaignBtn = document.getElementById('closeCampaignBtn');
  const campaignLevelsEl = document.getElementById('campaignLevels');
  const campaignRankLine = document.getElementById('campaignRankLine');
  const campaignNextLine = document.getElementById('campaignNextLine');
  const campaignProgressFill = document.getElementById('campaignProgressFill');
  const modeTriggerBtn = document.getElementById('modeTriggerBtn');
  const modeTriggerPlate = document.getElementById('modeTriggerPlate');
  const modeTriggerName = document.getElementById('modeTriggerName');
  const modeTriggerSub = document.getElementById('modeTriggerSub');
  const modesOverlay = document.getElementById('modesOverlay');
  const modesGrid = document.getElementById('modesGrid');
  const modeDetail = document.getElementById('modeDetail');
  const modesConfirmBtn = document.getElementById('modesConfirmBtn');
  const modesCloseBtn = document.getElementById('modesCloseBtn');
  const overlayEls = { campaign:campaignOverlay, modes:modesOverlay, win:winOverlay, confirm:confirmOverlay, settings:settingsOverlay, tutorial:tutorialOverlay, stats:statsOverlay, skins:skinsOverlay, achievements:achievementsOverlay, daily:dailyOverlay, pause:pauseOverlay, more:moreOverlay, shop:shopOverlay, namePrompt:namePromptOverlay, handoff:handoffOverlay };

  let state = null;
  let mode = 'move'; // 'move' | 'wall'
  let overlayStack = [];
  let pendingConfirmAction = null;
  let activeSkinSlot = 0;
  let audioCtx = null;
  let botTimer = null;
  let botToken = 0;

  // ---------- utilidades ----------
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
    });
  }
  function cellSize(){ return BOARD_PX / state.size; }
  function todayKey(offsetDays){
    const d = new Date();
    if(offsetDays) d.setDate(d.getDate()+offsetDays);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  // ---------- desafío diario: fecha UTC, rotación de modos y racha (88-91) ----------
  // Todo lo del desafío diario usa la fecha UTC (no la del dispositivo) para que, durante ese día, todos
  // los jugadores del mundo reciban exactamente el mismo desafío, sin importar su huso horario.
  const DAY_MS = 86400000;
  const DAILY_EPOCH_UTC = Date.UTC(2026, 0, 1);   // el desafío #1 es el del 1/1/2026 (UTC)
  function utcDayKey(offsetDays, nowMs){
    const d = new Date((nowMs==null ? Date.now() : nowMs) + (offsetDays||0)*DAY_MS);
    return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');
  }
  function dayKeyToMs(key){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key||''); return m ? Date.UTC(+m[1], +m[2]-1, +m[3]) : NaN; }
  function dayKeyDiff(a, b){ return Math.round((dayKeyToMs(b) - dayKeyToMs(a))/DAY_MS); }   // días de a a b
  function dayKeyAdd(key, n){ return utcDayKey(0, dayKeyToMs(key) + n*DAY_MS); }
  // Rotación (89): cada día toca la siguiente entrada, así nunca hay dos días seguidos con el mismo tipo de partida.
  // Todos son desafíos de una sola ficha contra el par (casillas al centro), cada uno con su regla propia.
  // `slack` = movimientos de más que todavía valen 2 estrellas. `turnSeconds` = reloj por turno (Contrarreloj).
  const DAILY_ROTATION = [
    { id:'maze',    ruleset:'maze',  emoji:'🧩', label:'Laberinto',        size:9,  density:'medio',  slack:3,
      hint:'Llegá al centro en la menor cantidad de movimientos. El tablero de hoy es igual para todos.' },
    { id:'fog',     ruleset:'fog',   emoji:'🌫️', label:'Niebla de guerra', size:9,  density:'ligero', slack:6,
      hint:'Sólo ves las paredes cercanas, pero las lejanas igual bloquean. Explorá con cuidado.' },
    { id:'blitz',   ruleset:'blitz', emoji:'⏱️', label:'Contrarreloj',     size:9,  density:'medio',  slack:3, turnSeconds:10,
      hint:'Tenés 10 s por turno. Si se acaba, perdés el turno y suma un movimiento.' },
    { id:'maze-d',  ruleset:'maze',  emoji:'🧱', label:'Laberinto denso',  size:9,  density:'denso',  slack:4,
      hint:'Más paredes que de costumbre: buscá el camino más corto antes de moverte.' },
    { id:'fog-xl',  ruleset:'fog',   emoji:'🌫️', label:'Niebla grande',    size:11, density:'medio',  slack:8,
      hint:'Tablero de 11×11 con niebla: sólo ves lo que tenés cerca.' },
    { id:'blitz-d', ruleset:'blitz', emoji:'⚡', label:'Relámpago denso',  size:9,  density:'denso',  slack:4, turnSeconds:8,
      hint:'Laberinto denso y sólo 8 s por turno. Si se acaba, perdés el turno y suma un movimiento.' },
  ];
  function dailyNumberOf(key){ return Math.round((dayKeyToMs(key) - DAILY_EPOCH_UTC)/DAY_MS) + 1; }
  function dailyModeFor(key){
    const n = dailyNumberOf(key) - 1, L = DAILY_ROTATION.length;
    return DAILY_ROTATION[((n % L) + L) % L];
  }
  const dailyCache = {};
  // El desafío completo de una fecha: modo + tablero + par. Es una función pura de la fecha UTC.
  function dailyChallengeFor(key){
    key = key || utcDayKey();
    if(dailyCache[key]) return dailyCache[key];
    const cfg = dailyModeFor(key);
    const walls = generateDailyLayout(key, cfg.size, cfg.density);
    const blocked = new Set();
    walls.forEach(w=> wallEdges(w.r,w.c,w.orientation).forEach(e=> blocked.add(edgeKey(e[0],e[1],e[2],e[3]))));
    const mid = (cfg.size-1)/2;
    const par = bfsShortestPath(0, mid, mid, mid, blocked, cfg.size);
    const ch = Object.assign({}, cfg, { dateKey:key, number:dailyNumberOf(key), walls, par });
    const keys = Object.keys(dailyCache);
    if(keys.length>8) delete dailyCache[keys[0]];
    dailyCache[key] = ch;
    return ch;
  }
  // Racha (91): se cuenta por días UTC seguidos. Los escudos protegen la racha cuando se pierden días:
  //  · se gana 1 escudo cada 7 días seguidos (se guardan hasta DAILY_SHIELD_MAX);
  //  · cada día perdido gasta 1 escudo, y sólo se gastan al volver a resolver un desafío;
  //  · si faltaste más días de los que cubren tus escudos, la racha se corta (y no se gasta ninguno);
  //  · los días protegidos mantienen la racha pero no la suman.
  const DAILY_SHIELD_MAX = 2;
  const DAILY_SHIELD_EVERY = 7;
  function dailyStreakStatus(d, today){
    if(!d.lastDate) return { alive:false, streak:0, missed:0, covered:false, gap:null };
    const gap = dayKeyDiff(d.lastDate, today);          // 0 = ya jugó hoy · 1 = ayer · 2+ = faltó
    if(!(gap>=2)) return { alive:true, streak:d.streak||0, missed:0, covered:false, gap };
    const missed = gap-1;
    const covered = missed <= (d.shields||0);
    return { alive:covered, streak:covered ? (d.streak||0) : 0, missed, covered, gap };
  }
  function isDailyDone(d, key){ return !!(d.history && d.history[key]) || (d.bestMoves && d.bestMoves[key]!=null); }

  function hashStringToSeed(str){
    let h = 1779033703 ^ str.length;
    for(let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }
  function bfsShortestPath(startR,startC,targetR,targetC,blockedSet,size){
    if(startR===targetR && startC===targetC) return 0;
    return bfsToGoal(edgeMaskFor(blockedSet,size),size,startR*size+startC,targetR*size+targetC,null);
  }

  function edgeKey(r1,c1,r2,c2){
    if(r1>r2 || (r1===r2 && c1>c2)){ const tr=r1,tc=c1; r1=r2;c1=c2;r2=tr;c2=tc; }
    return r1+','+c1+'-'+r2+','+c2;
  }
  function isBlocked(r1,c1,r2,c2,blockedSet){
    return blockedSet.has(edgeKey(r1,c1,r2,c2));
  }
  function hexToRgba(hex, alpha){
    const v = hex.replace('#','');
    const r=parseInt(v.substring(0,2),16), g=parseInt(v.substring(2,4),16), b=parseInt(v.substring(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  // Paredes por jugador según tamaño de tablero y cantidad de jugadores (tabla calibrada con partidas IA vs IA).
  const WALLS_TABLE = {
    5:  { 1:6,  2:3,  3:2,  4:1 },
    7:  { 1:12, 2:6,  3:4,  4:3 },
    9:  { 1:20, 2:10, 3:7,  4:5 },
    11: { 1:30, 2:15, 3:10, 4:8 },
  };
  // Fórmula anterior: se conserva para la campaña y el desafío diario (su dificultad no tiene que cambiar) y como respaldo.
  function legacyWallsPerPlayer(size, playersCount){
    const total = Math.round(0.25*size*size);
    return Math.max(2, Math.floor(total/playersCount));
  }
  function wallsPerPlayer(size, playersCount, legacy){
    const row = WALLS_TABLE[size], v = row && row[playersCount];
    if(legacy || v==null) return legacyWallsPerPlayer(size, playersCount);
    return v;
  }
  // ---------- Motor de distancias (74, 75, 82) ----------
  // BFS con índices enteros (r*size+c), una máscara de paredes por casilla (1 arriba, 2 abajo, 4 izquierda, 8 derecha),
  // visitados por "sello" (sin reiniciar el arreglo) y cola con puntero de cabeza. Las paredes en juego se compilan una
  // sola vez por cambio (edgesEpoch) y la distancia de todas las casillas al objetivo sale de una sola BFS desde la meta.
  function setMaskEdge(mask,size,r1,c1,r2,c2){
    const a=r1*size+c1, b=r2*size+c2;
    if(r2===r1+1){ mask[a]|=2; mask[b]|=1; }
    else if(r2===r1-1){ mask[a]|=1; mask[b]|=2; }
    else if(c2===c1+1){ mask[a]|=8; mask[b]|=4; }
    else if(c2===c1-1){ mask[a]|=4; mask[b]|=8; }
  }
  function compileEdgeMask(set,size){
    const mask = new Uint8Array(size*size);
    set.forEach(key=>{
      const p = key.split(/[,-]/);
      setMaskEdge(mask,size,+p[0],+p[1],+p[2],+p[3]);
    });
    return mask;
  }
  function edgeMaskFor(set,size){
    if(state && set===state.blockedEdges){
      const c = _maskCache;
      if(c.set===set && c.epoch===edgesEpoch && c.n===set.size && c.size===size) return c.mask;
      const m = compileEdgeMask(set,size);
      c.set=set; c.epoch=edgesEpoch; c.n=set.size; c.size=size; c.mask=m;
      return m;
    }
    return compileEdgeMask(set,size);
  }
  // Aplica aristas a una máscara y devuelve cómo deshacerlo (se usa con try/finally: nunca queda una pared de prueba puesta).
  function applyEdgesToMask(mask,size,edges){
    const undo = [];
    for(const e of edges){
      const a=e[0]*size+e[1], b=e[2]*size+e[3];
      undo.push(a,mask[a],b,mask[b]);
      setMaskEdge(mask,size,e[0],e[1],e[2],e[3]);
    }
    return undo;
  }
  function undoMask(mask,undo){
    for(let i=undo.length-4;i>=0;i-=4){ mask[undo[i+2]]=undo[i+3]; mask[undo[i]]=undo[i+1]; }
  }
  // Pasos desde `start` hasta la meta (un índice o un arreglo de banderas). Infinity si no hay camino.
  function bfsToGoal(mask,size,start,goalIdx,goalFlags){
    BFS_STATS.calls++;
    if(goalFlags ? goalFlags[start] : start===goalIdx) return 0;
    const stamp = ++_stamp;
    let head=0, tail=0, d=0;
    _Q[tail++] = start; _STAMPS[start] = stamp;
    while(head<tail){
      const levelEnd = tail; d++;
      for(; head<levelEnd; head++){
        const cur=_Q[head], r=(cur/size)|0, c=cur-r*size, m=mask[cur];
        let nx;
        if(r>0 && !(m&1)){ nx=cur-size; if(_STAMPS[nx]!==stamp){ if(goalFlags ? goalFlags[nx] : nx===goalIdx) return d; _STAMPS[nx]=stamp; _Q[tail++]=nx; } }
        if(r<size-1 && !(m&2)){ nx=cur+size; if(_STAMPS[nx]!==stamp){ if(goalFlags ? goalFlags[nx] : nx===goalIdx) return d; _STAMPS[nx]=stamp; _Q[tail++]=nx; } }
        if(c>0 && !(m&4)){ nx=cur-1; if(_STAMPS[nx]!==stamp){ if(goalFlags ? goalFlags[nx] : nx===goalIdx) return d; _STAMPS[nx]=stamp; _Q[tail++]=nx; } }
        if(c<size-1 && !(m&8)){ nx=cur+1; if(_STAMPS[nx]!==stamp){ if(goalFlags ? goalFlags[nx] : nx===goalIdx) return d; _STAMPS[nx]=stamp; _Q[tail++]=nx; } }
      }
    }
    return Infinity;
  }
  // Mapa de distancias de TODAS las casillas a la meta (BFS inversa; el tablero es no dirigido). -1 = sin camino.
  function buildDistMap(mask,size,goals){
    BFS_STATS.calls++;
    const out = new Int16Array(size*size).fill(-1);
    let head=0, tail=0;
    for(const g of goals){ if(out[g]<0){ out[g]=0; _Q[tail++]=g; } }
    while(head<tail){
      const cur=_Q[head++], d=out[cur]+1, r=(cur/size)|0, c=cur-r*size, m=mask[cur];
      let nx;
      if(r>0 && !(m&1)){ nx=cur-size; if(out[nx]<0){ out[nx]=d; _Q[tail++]=nx; } }
      if(r<size-1 && !(m&2)){ nx=cur+size; if(out[nx]<0){ out[nx]=d; _Q[tail++]=nx; } }
      if(c>0 && !(m&4)){ nx=cur-1; if(out[nx]<0){ out[nx]=d; _Q[tail++]=nx; } }
      if(c<size-1 && !(m&8)){ nx=cur+1; if(out[nx]<0){ out[nx]=d; _Q[tail++]=nx; } }
    }
    return out;
  }
  // Mapa de distancias de las paredes reales de la partida, en caché hasta que cambien las paredes.
  function liveDistMap(set,size,sig,goals){
    const c = _distCache;
    if(!(c.set===set && c.epoch===edgesEpoch && c.n===set.size && c.size===size)){
      c.set=set; c.epoch=edgesEpoch; c.n=set.size; c.size=size; c.maps.clear();
    }
    let m = c.maps.get(sig);
    if(!m){ m = buildDistMap(edgeMaskFor(set,size),size,goals); c.maps.set(sig,m); }
    return m;
  }
  function centerGoal(){ return state.center.r*state.size + state.center.c; }
  function hillGoalIdx(targets){ const size=state.size; return (targets || hillCells()).map(t=> t.r*size+t.c); }
  function hasPath(startR,startC,targetR,targetC,blockedSet,size,targets){
    if(targets) return isFinite(distanceToHill(startR,startC,blockedSet,targets));   // varias metas: BFS multiobjetivo
    if(startR===targetR && startC===targetC) return true;
    return bfsToGoal(edgeMaskFor(blockedSet,size),size,startR*size+startC,targetR*size+targetC,null) !== Infinity;
  }
  // ---------- Metas por jugador (63): centro (modos de siempre) o lado opuesto (Clásico oficial) ----------
  const GOAL_OPPOSITE = { top:'bottom', right:'left', bottom:'top', left:'right' };
  function goalCells(pid){
    if(!state || state.goalMode!=='rows') return [{ r:state.objective.r, c:state.objective.c }];
    const side = state.goalSides[pid], n = state.size, out = [];
    for(let i=0;i<n;i++){
      if(side==='bottom') out.push({ r:n-1, c:i });
      else if(side==='top') out.push({ r:0, c:i });
      else if(side==='left') out.push({ r:i, c:0 });
      else out.push({ r:i, c:n-1 });
    }
    return out;
  }
  function isGoalCell(pid, r, c){ return goalCells(pid).some(g=> g.r===r && g.c===c); }
  function distanceToGoal(pid, r, c, blockedSet){ return distanceToHill(r, c, blockedSet, goalCells(pid)); }
  // ¿le queda camino a la meta? (centro o fila opuesta)
  function playerHasPath(p, blockedSet){
    if(state.goalMode==='rows') return hasPath(p.r,p.c,0,0,blockedSet,state.size,goalCells(p.id));
    return hasPath(p.r,p.c,state.objective.r,state.objective.c,blockedSet,state.size);
  }
  // pid es opcional: en el Clásico oficial hace falta saber de quién es la meta (si no viene, se deduce de quién está en esa casilla).
  function distanceToCenter(r, c, blockedSet, pid){
    if(state.goalMode==='rows'){
      if(pid==null) pid = state.players.findIndex(pl=> pl.r===r && pl.c===c);
      if(pid>=0) return distanceToGoal(pid, r, c, blockedSet);
    }
    const size=state.size, cen=centerGoal(), start=r*size+c;
    if(start===cen) return 0;
    if(blockedSet===state.blockedEdges){
      const v = liveDistMap(blockedSet,size,'c',[cen])[start];
      return v<0 ? Infinity : v;
    }
    return bfsToGoal(edgeMaskFor(blockedSet,size),size,start,cen,null);
  }
  // Pasos hasta la casilla más cercana de `targets` (por defecto, toda la zona de la colina).
  function distanceToHill(r,c,blockedSet,targets){
    const size=state.size, goals=hillGoalIdx(targets), start=r*size+c;
    if(goals.indexOf(start)>=0) return 0;
    if(blockedSet===state.blockedEdges){
      const sig = 'h:' + goals.slice().sort((a,b)=>a-b).join(',');
      const v = liveDistMap(blockedSet,size,sig,goals)[start];
      return v<0 ? Infinity : v;
    }
    const flags = new Uint8Array(size*size);
    goals.forEach(g=>{ flags[g]=1; });
    return bfsToGoal(edgeMaskFor(blockedSet,size),size,start,-1,flags);
  }
  // Casillas de la zona que no ocupa ningún otro jugador (si están todas ocupadas, toda la zona).
  function hillFreeTargets(excludeIdx){
    const zone = hillCells();
    const free = zone.filter(cell=> !state.players.some((pl,i)=> i!==excludeIdx && pl.r===cell.r && pl.c===cell.c));
    return free.length ? free : zone;
  }

  // ---------- Niebla de guerra: memoria de paredes vistas + eco de rivales fuera de radio ----------
  function ensureFogMemory(){
    if(!state.seen) state.seen = state.players.map(()=> new Set());
    if(!state.echo) state.echo = state.players.map(()=> ({}));
    if(!state.lastSeenPos) state.lastSeenPos = state.players.map(()=> ({}));
  }
  // Jugador cuya visión se dibuja: el humano activo, o (si juega la IA) el único humano de la partida.
  function fogViewerIndex(){
    if(!state || state.ruleset!=='fog') return null;
    const ap = state.players[state.currentPlayerIndex];
    if(!ap) return null;
    if(ap.isCPU){ const h = state.players.findIndex(pl=> !pl.isCPU); return h>=0 ? h : state.currentPlayerIndex; }
    return state.currentPlayerIndex;
  }
  // Recorre a todos los jugadores (no sólo a quien ve la pantalla ahora) para que cada uno acumule su
  // propia memoria de paredes y, si un rival sale de su radio, le deje un eco en su última posición vista.
  function updateAllFogMemory(){
    if(!state || state.ruleset!=='fog') return;
    ensureFogMemory();
    const rad = fogRadius();
    state.players.forEach((viewer, vIdx)=>{
      const seenSet = state.seen[vIdx];
      state.walls.forEach(w=>{
        if(Math.max(Math.abs(w.r-viewer.r), Math.abs(w.c-viewer.c))<=rad) seenSet.add(wallSlotKey(w.r,w.c,w.orientation));
      });
      const echoMap = state.echo[vIdx], lastPos = state.lastSeenPos[vIdx];
      state.players.forEach((p,i)=>{
        if(i===vIdx) return;
        const dist = Math.max(Math.abs(p.r-viewer.r), Math.abs(p.c-viewer.c));
        if(dist<=rad){ lastPos[i] = { r:p.r, c:p.c }; delete echoMap[i]; }
        else if(!echoMap[i] && lastPos[i]) echoMap[i] = { r:lastPos[i].r, c:lastPos[i].c, life:FOG_ECHO_LIFE };
      });
    });
  }
  // Se llama una vez por turno (desde advanceTurn): los ecos se apagan con el paso de los turnos, no de los renders.
  function tickFogEchoes(){
    if(!state || state.ruleset!=='fog' || !state.echo) return;
    state.echo.forEach(echoMap=>{
      Object.keys(echoMap).forEach(k=>{ if(--echoMap[k].life<=0) delete echoMap[k]; });
    });
  }
  // Edges que un jugador puede ver ahora mismo o recuerda haber visto: base para el preview de colocación
  // (para no delatar paredes ocultas) y para el conocimiento propio de la IA (sin trampa).
  function visibleBlockedEdgesFor(viewerIdx){
    ensureFogMemory();
    const viewer = state.players[viewerIdx], rad = fogRadius(), edges = new Set();
    state.walls.forEach(w=>{
      const remembered = state.seen[viewerIdx].has(wallSlotKey(w.r,w.c,w.orientation));
      if(remembered || Math.max(Math.abs(w.r-viewer.r), Math.abs(w.c-viewer.c))<=rad){
        wallEdges(w.r,w.c,w.orientation).forEach(e=> edges.add(edgeKey(e[0],e[1],e[2],e[3])));
      }
    });
    return edges;
  }
  function visibleOccupiedFor(viewerIdx){
    ensureFogMemory();
    const viewer = state.players[viewerIdx], rad = fogRadius();
    const occ = Array.from({length: state.size-1}, ()=> Array(state.size-1).fill(null));
    state.walls.forEach(w=>{
      const remembered = state.seen[viewerIdx].has(wallSlotKey(w.r,w.c,w.orientation));
      if(remembered || Math.max(Math.abs(w.r-viewer.r), Math.abs(w.c-viewer.c))<=rad) occ[w.r][w.c] = w.orientation;
    });
    return occ;
  }
  // Conocimiento propio de la IA en niebla: sólo paredes dentro de SU radio (o que ya vio antes),
  // nunca el estado real completo. En Experto ve un anillo más.
  function botKnownEdges(idx){
    ensureFogMemory();
    const bot = state.players[idx];
    const rad = fogRadius(bot.difficulty==='expert' ? 1 : 0);
    const known = new Set();
    state.walls.forEach(w=>{
      const remembered = state.seen[idx] && state.seen[idx].has(wallSlotKey(w.r,w.c,w.orientation));
      if(remembered || Math.max(Math.abs(w.r-bot.r), Math.abs(w.c-bot.c))<=rad){
        wallEdges(w.r,w.c,w.orientation).forEach(e=> known.add(edgeKey(e[0],e[1],e[2],e[3])));
      }
    });
    return known;
  }

  function wallEdges(r,c,orientation){
    if(orientation==='h'){
      return [[r,c,r+1,c],[r,c+1,r+1,c+1]];
    }
    return [[r,c,r,c+1],[r+1,c,r+1,c+1]];
  }
  // Por qué no entra una pared en esa ranura (67): null si entra.
  //  'bounds' fuera del tablero · 'overlap' se solapa con otra del mismo sentido · 'cross' cruza una pared en X
  function wallSlotReason(r,c,orientation,occupiedGrid){
    const occ = occupiedGrid || state.occupied;
    if(r<0||c<0||r>state.size-2||c>state.size-2) return 'bounds';
    if(occ[r][c]) return occ[r][c]===orientation ? 'overlap' : 'cross';
    if(orientation==='h'){
      if(c>0 && occ[r][c-1]==='h') return 'overlap';
      if(c<state.size-2 && occ[r][c+1]==='h') return 'overlap';
    } else {
      if(r>0 && occ[r-1][c]==='v') return 'overlap';
      if(r<state.size-2 && occ[r+1][c]==='v') return 'overlap';
    }
    return null;
  }
  function canPlaceWallSlot(r,c,orientation,occupiedGrid){
    return wallSlotReason(r,c,orientation,occupiedGrid)===null;
  }
  const ERROR_VIBRATION = [20,40,20];
  // Texto para hintLine de cada motivo de rechazo. 'noWalls' lo agrega la capa de jugada (no es de la ranura).
  function wallReasonText(reason){
    switch(reason){
      case 'overlap':   return 'Esa pared se solapa con otra.';
      case 'cross':     return 'Esa pared cruza otra pared.';
      case 'noPath':    return 'No se puede: dejaría a un jugador sin camino a la meta.';
      case 'noWalls':   return 'No te quedan paredes.';
      case 'bounds':    return 'Esa pared queda fuera del tablero.';
      case 'mirror':    return 'No se puede: el reflejo de esa pared (modo Espejo) no entra.';
      case 'hillSiege': return `No se puede cerrar la zona: tiene que quedar con al menos ${HILL_MIN_ACCESSES} accesos.`;
      default:          return null;
    }
    return true;
  }
  // occupiedGrid/blockedBase opcionales: permiten evaluar contra un conocimiento parcial (niebla de guerra)
  // en lugar del estado real completo. El commit siempre valida con el estado real (sin overrides).
  function evaluateWallPlacement(r,c,orientation,occupiedGrid,blockedBase){
    const why = wallSlotReason(r,c,orientation,occupiedGrid);
    if(why) return { valid:false, reason:why };
    const edges = wallEdges(r,c,orientation);
    const testSet = new Set(blockedBase || state.blockedEdges);
    for(const e of edges) testSet.add(edgeKey(e[0],e[1],e[2],e[3]));
    for(const p of state.players){
      if(!playerHasPath(p,testSet)) return { valid:false, reason:'noPath' };
    }
    return { valid:true, edges };
  }
  // Versión de evaluateWallPlacement que ve lo mismo que ve el jugador activo en niebla de guerra (sólo
  // usada para pintar el preview): así no se delata una pared oculta pintando la ranura de inválida.
  function evaluateWallForPreview(r,c,orientation){
    if(state.ruleset!=='fog') return evaluateWallForMode(r,c,orientation);
    const viewerIdx = fogViewerIndex();
    if(viewerIdx==null) return evaluateWallForMode(r,c,orientation);
    return evaluateWallPlacement(r,c,orientation, visibleOccupiedFor(viewerIdx), visibleBlockedEdgesFor(viewerIdx));
  }
  // ---------- Modo Espejo: valida y arma también la pared reflejada ----------
  function mirrorSlot(r,c){ return { r: state.size-2-r, c: state.size-2-c }; }
  function evaluateWallForMode(r,c,orientation){
    const base = evaluateWallPlacement(r,c,orientation);
    if(!base.valid) return base;
    if(state.ruleset==='hill'){
      // a prueba de asedio: se rechaza la pared que deje la zona con menos de HILL_MIN_ACCESSES accesos
      // (sólo si además la pared los reduce, así un tablero raro no queda sin poder poner ninguna)
      const testSet = new Set(state.blockedEdges);
      base.edges.forEach(e=> testSet.add(edgeKey(e[0],e[1],e[2],e[3])));
      const after = hillAccessCount(testSet);
      if(after < HILL_MIN_ACCESSES && after < hillAccessCount(state.blockedEdges)) return { valid:false, reason:'hillSiege' };
      return base;
    }
    if(state.ruleset!=='mirror') return base;
    const m = mirrorSlot(r,c);
    if(m.r===r && m.c===c) return base; // cae en su propio reflejo, no hace falta espejo aparte
    if(!canPlaceWallSlot(m.r,m.c,orientation)) return { valid:false, reason:'mirror' };
    const mEdges = wallEdges(m.r,m.c,orientation);
    const testSet = new Set(state.blockedEdges);
    base.edges.forEach(e=> testSet.add(edgeKey(e[0],e[1],e[2],e[3])));
    mEdges.forEach(e=> testSet.add(edgeKey(e[0],e[1],e[2],e[3])));
    for(const p of state.players){
      if(!playerHasPath(p,testSet)) return { valid:false, reason:'noPath' };
    }
    return { valid:true, edges:base.edges, mirrorEdges:mEdges };
  }

  // ---------- Modo Rey de la colina: zona central proporcional al tablero ----------
  // La zona son las casillas a distancia Manhattan <= radio del centro: radio 1 (cruz de 5 casillas)
  // hasta 9x9 y radio 2 (rombo de 13 casillas) en 11x11. Se calcula una vez por partida.
  function hillRadius(){ return state.size >= 11 ? 2 : 1; }
  function hillZone(){
    if(state._hillZone) return state._hillZone;
    const { r, c } = state.center, rad = hillRadius(), cells = [];
    for(let dr=-rad; dr<=rad; dr++){
      for(let dc=-rad; dc<=rad; dc++){
        if(Math.abs(dr)+Math.abs(dc) > rad) continue;
        const rr=r+dr, cc=c+dc;
        if(rr<0 || cc<0 || rr>=state.size || cc>=state.size) continue;
        cells.push({ r:rr, c:cc });
      }
    }
    state._hillZone = { cells, keys: new Set(cells.map(cell=> cell.r+','+cell.c)) };
    return state._hillZone;
  }
  function hillCells(){ return hillZone().cells; }
  function isHillCell(r,c){ return hillZone().keys.has(r+','+c); }
  // Accesos de la zona = pasos libres (sin pared) entre una casilla de la zona y una casilla de afuera.
  function hillAccessCount(blockedSet){
    let n = 0;
    hillCells().forEach(cell=>{
      for(const [dr,dc] of DIRS4){
        const nr=cell.r+dr, nc=cell.c+dc;
        if(nr<0||nc<0||nr>=state.size||nc>=state.size) continue;
        if(isHillCell(nr,nc)) continue;
        if(!isBlocked(cell.r,cell.c,nr,nc,blockedSet)) n++;
      }
    });
    return n;
  }
  // Quién "sostiene" la zona ahora: el único que está dentro, o el que lleva más turnos seguidos si hay varios.
  // Devuelve null si nadie está dentro o si hay empate (entonces cada casilla se tiñe según su ocupante).
  function hillHolderIndex(){
    const inside = [];
    state.players.forEach((pl,i)=>{ if(isHillCell(pl.r,pl.c)) inside.push({ i, t: pl.hillTurns||0 }); });
    if(!inside.length) return null;
    if(inside.length===1) return inside[0].i;
    inside.sort((a,b)=> b.t-a.t);
    return inside[0].t>inside[1].t ? inside[0].i : null;
  }
  // Arco de progreso alrededor de la ficha: fracción = turnos seguidos / objetivo. Pulsa cuando falta un turno.
  function hillArcMarkup(p,cx,cy,cs){
    const target = hillTargetTurns(), t = Math.min(p.hillTurns||0, target);
    if(t<=0) return '';
    const rad = cs*0.46, circ = 2*Math.PI*rad, w = Math.max(3, cs*0.06);
    const urgent = t===target-1;
    const rot = `transform="rotate(-90 ${cx} ${cy})"`;      // el arco arranca a las 12 en punto
    return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${p.color}" stroke-width="${w}" opacity="0.22" class="hill-arc-track"/>`
      + `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${p.color}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(circ*t/target).toFixed(2)} ${circ.toFixed(2)}" ${rot} class="hill-arc${urgent?' urgent':''}" style="--w:${w}px"/>`;
  }

  // ---------- Condición de victoria (varía según el modo de partida) ----------
  function hillTargetTurns(){ return HILL_TARGET[state.players.length] || HILL_TARGET_DEFAULT; }
  // Se llama al terminar el turno de `p` (después de moverse, empujar o poner una pared).
  // Cuenta turnos SEGUIDOS: terminar el turno fuera de la zona reinicia el conteo.
  function updateHillProgress(p){
    if(isHillCell(p.r,p.c)){
      p.hillTurns = (p.hillTurns||0) + 1;
      // cada incremento suena con el efecto "tap" (un instante después, para que no se pise con el sonido de la jugada)
      setTimeout(()=> playSfx('tap', ()=> playTone(660, 0.07, 'sine', 0.12)), 90);
    } else p.hillTurns = 0;
    return p.hillTurns >= hillTargetTurns();
  }
  function checkWinAfterMove(p){
    if(state.goalMode==='rows') return isGoalCell(p.id, p.r, p.c);   // Clásico oficial: cualquier casilla del lado opuesto
    if(state.teams){
      if(p.r!==state.objective.r || p.c!==state.objective.c) return false;
      p.arrived = true;
      if(state.teamGoal!=='both') return true;
      return teamMembers(teamOf(p.id)).every(i=> state.players[i].arrived);   // deben llegar los dos aliados
    }
    if(state.ruleset==='hill') return updateHillProgress(p);
    if(state.ruleset==='hunter'){
      return p.id===state.fugitiveIdx && p.r===state.objective.r && p.c===state.objective.c;
    }
    return p.r===state.objective.r && p.c===state.objective.c;
  }
  // ---------- Cazador y fugitivo: rondas, captura y huellas ----------
  function hunterIndexes(){ return state.players.map((pl,i)=> i).filter(i=> i!==state.fugitiveIdx); }
  // Rondas completas (todos los jugadores actuaron una vez). Se cuenta sobre moveCount, que suma las acciones de todos.
  function hunterRoundsDone(){ return Math.floor((state.moveCount||0) / state.players.length); }
  // Ronda que se está jugando ahora (1..límite); sirve para el rótulo "Ronda 4/12".
  function hunterRoundNow(){ return Math.min(state.hunterRoundLimit, hunterRoundsDone() + 1); }
  // Ronda en la que ocurrió la última acción (para el mensaje final).
  function hunterRoundOfLastAction(){ return Math.min(state.hunterRoundLimit, Math.floor(Math.max(0,(state.moveCount||1)-1) / state.players.length) + 1); }
  // Captura por adyacencia: el cazador que acaba de moverse quedó pegado al fugitivo y sin pared de por medio.
  // Sólo cuenta la jugada del cazador: que el fugitivo pase cerca no lo atrapa.
  function isCaptureAdjacent(r,c){
    const f = state.players[state.fugitiveIdx];
    if(!f || Math.abs(r-f.r)+Math.abs(c-f.c)!==1) return false;
    return !isBlocked(r,c,f.r,f.c,state.blockedEdges);
  }
  function hunterWinnerForTimeout(){
    const hs = hunterIndexes().map(i=> state.players[i]);
    return hs.find(h=> !h.isCPU) || hs[0];    // si hay un cazador humano, la victoria es suya
  }
  function checkHunterTimeout(){
    if(!state || state.ruleset!=='hunter' || state.winner) return;
    if(hunterRoundsDone() >= state.hunterRoundLimit){
      finishGame(hunterWinnerForTimeout(), 'huntersWin', 'timeout');
    }
  }
  // Huellas: cada casilla que deja el fugitivo vive HUNTER_TRAIL_LIFE turnos suyos.
  function ageTrail(){
    state.trail = (state.trail||[]).map(t=> ({ r:t.r, c:t.c, life:t.life-1 })).filter(t=> t.life>0);
  }
  function dropTrail(r,c){
    state.trail = (state.trail||[]).filter(t=> !(t.r===r && t.c===c));
    state.trail.push({ r, c, life:HUNTER_TRAIL_LIFE });
  }
  // Pozo compartido: los cazadores ven todos el mismo saldo (wallsLeft de cada uno es un reflejo del pozo).
  function syncHunterPool(){
    if(state.hunterPool==null) return;
    hunterIndexes().forEach(i=>{ state.players[i].wallsLeft = state.hunterPool; });
  }

  // ---------- Generador de paredes al azar (modo Laberinto y Desafío diario) ----------
  // localState: objeto con {size, occupied, blockedEdges, walls, players} — puede ser
  // el state real de una partida (ya con jugadores) o uno temporal sólo para generar.
  function tryPlaceEnvWall(localState, r, c, orientation){
    const size = localState.size;
    if(r<0||c<0||r>size-2||c>size-2) return false;
    if(localState.guard && localState.guard(r,c,orientation)) return false;   // zonas protegidas (salidas)
    if(localState.occupied[r][c]) return false;
    if(orientation==='h'){
      if(c>0 && localState.occupied[r][c-1]==='h') return false;
      if(c<size-2 && localState.occupied[r][c+1]==='h') return false;
    } else {
      if(r>0 && localState.occupied[r-1][c]==='v') return false;
      if(r<size-2 && localState.occupied[r+1][c]==='v') return false;
    }
    const edges = wallEdges(r,c,orientation);
    const testSet = new Set(localState.blockedEdges);
    edges.forEach(e=> testSet.add(edgeKey(e[0],e[1],e[2],e[3])));
    for(const p of localState.players){
      if(!hasPath(p.r,p.c,localState.center.r,localState.center.c,testSet,size)) return false;
    }
    localState.occupied[r][c] = orientation;
    edges.forEach(e=> localState.blockedEdges.add(edgeKey(e[0],e[1],e[2],e[3])));
    localState.walls.push({ r, c, orientation, color:'var(--line)', env:true });
    edgesEpoch++;
    return true;
  }
  // ---------- Laberinto: patrones, transformaciones, equidad y semilla ----------
  // Cada patrón es una lista de segmentos [r,c,'h'|'v'] sobre una cuadrícula de referencia de 9×9
  // (posiciones de pared 0..7). Se escalan a cualquier tamaño y se transforman (4 giros × 2 espejos,
  // más un desplazamiento de ±1 del patrón entero). Todo el sorteo sale de mulberry32(semilla).
  const MAZE_REF = 9;
  const SEED_SPACE = 2176782336;                 // 36^6: la semilla se muestra con 6 caracteres base36
  const MAZE_DENSITIES = { ligero:'Ligero', medio:'Medio', denso:'Denso', caos:'Caos' };
  // Reglas de equidad y zonas protegidas en un solo lugar para poder ajustarlas.
  const MAZE_RULES = {
    minExtra: 2,                 // cada camino debe superar en al menos 2 pasos al camino sin paredes...
    capMult: 2,                  // ...sin pasar del doble
    diffMax: { 1:0, 2:1, 3:2, 4:2 },   // diferencia máxima de distancia entre jugadores
    strictExtra: false,          // true: sólo mapas donde TODOS cumplen minExtra (deja muy pocos patrones)
    retries: 30,                 // reintentos al combinar patrones (Medio y Denso)
    ligeroMaxSegs: 6,            // tope de segmentos del modo Ligero
    // radio de la zona central sin paredes: 1 = 3×3, 0 = sólo la meta, -1 = sin zona (tableros chicos)
    zoneRadius: function(size){ return size>=9 ? 1 : (size===7 ? 0 : -1); },
  };
  // Plantillas cortas (Medio y Caos): segmentos relativos a un punto de anclaje. Las originales se
  // pisaban entre sí (dos tramos en posiciones vecinas) y nunca se podían colocar.
  const MAZE_TEMPLATES = [
    [ [0,0,'h'], [0,2,'h'] ],                       // barra de 2 tramos
    [ [0,0,'v'], [2,0,'v'] ],                       // barra vertical de 2 tramos
    [ [0,0,'h'], [1,1,'v'] ],                       // L
    [ [0,0,'h'], [0,2,'h'], [1,1,'v'] ],            // T
    [ [0,0,'h'], [0,3,'h'] ],                       // dos tramos con paso de una casilla
  ];

  function mulberry32(a){
    const f = function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    f.getState = ()=> a >>> 0;            // el estado es un solo entero de 32 bits: se puede guardar y retomar
    f.setState = v=>{ a = v | 0; };
    return f;
  }
  function newMazeSeed(){ return Math.floor(Math.random()*SEED_SPACE); }
  // Aleatoriedad de la partida (71): todo lo que influye en el juego (IA, poderes, sorteos) sale de rng().
  // Los efectos puramente visuales (confeti, estrellas), la pausa de «pensando…» y el cofre diario
  // siguen con Math.random: no cambian el resultado de una partida.
  let gameSeed = 1;
  let gameRng = mulberry32(1);
  function rng(){ return gameRng(); }
  function seedGame(seed){
    gameSeed = (+seed >>> 0);
    gameRng = mulberry32(gameSeed);
    return gameSeed;
  }
  function seedToText(n){ return (n>>>0).toString(36).toUpperCase().padStart(6,'0'); }
  function seedFromText(t){
    const n = parseInt(String(t||'').trim().toLowerCase(), 36);
    return Number.isFinite(n) ? n % SEED_SPACE : null;
  }

  function segKey(s){ return s[0]+','+s[1]+','+s[2]; }
  function segsKey(segs){ return segs.map(segKey).sort().join('|'); }
  function uniqSegs(segs){ const seen = new Set(), out = []; segs.forEach(s=>{ const k = segKey(s); if(!seen.has(k)){ seen.add(k); out.push(s); } }); return out; }
  function hBar(r,c,n){ const a = []; for(let i=0;i<(n||1);i++) a.push([r,c+2*i,'h']); return a; }
  function vBar(r,c,n){ const a = []; for(let i=0;i<(n||1);i++) a.push([r+2*i,c,'v']); return a; }
  // giro de 90° horario: (r,c,o) → (c, m-r, otra orientación), con m = último índice de pared
  function applyTransform(segs, size, rot, flip){
    const m = size-2;
    return segs.map(([r,c,o])=>{
      if(flip) c = m-c;
      for(let k=0;k<rot;k++){ const nr = c, nc = m-r; r = nr; c = nc; o = (o==='h' ? 'v' : 'h'); }
      return [r,c,o];
    });
  }
  function rot4(segs){ let out = [], cur = segs; for(let i=0;i<4;i++){ out = out.concat(cur); cur = applyTransform(cur, MAZE_REF, 1, false); } return uniqSegs(out); }
  function rot2(segs){ return uniqSegs(segs.concat(applyTransform(segs, MAZE_REF, 2, false))); }
  function detectSym(segs){
    const base = segsKey(segs);
    if(segsKey(applyTransform(segs, MAZE_REF, 1, false))===base) return 'c4';
    return segsKey(applyTransform(segs, MAZE_REF, 2, false))===base ? 'c2' : null;
  }

  const MAZE_PATTERNS = [];
  function defPattern(id, name, segs, touchesCenter){
    segs = uniqSegs(segs);
    MAZE_PATTERNS.push({ id, name, segs, touchesCenter:!!touchesCenter, sym:detectSym(segs) });
  }
  (function buildPatternLibrary(){
    const anillo = rot4(hBar(1,1,3)).filter(s=> !(s[2]==='h' && s[0]===6));     // anillo de 5×5 sellado, sin el lado de abajo
    const escalera = [[1,0,'h'],[2,1,'v'],[3,2,'h']];
    defPattern('molino', 'Molino', rot4([[2,4,'h']]), true);                               // aspas alrededor de la meta
    defPattern('cuatropuertas', 'Cuatro puertas', rot4([[1,2,'h'],[1,5,'h']]));            // anillo con una puerta por lado
    defPattern('anillo', 'Anillo de una entrada', anillo);
    defPattern('ciudadela', 'Ciudadela', anillo.concat([[4,3,'h'],[4,4,'v']]), true);       // anillo + 2 tramos internos
    defPattern('peineh', 'Peine horizontal', hBar(0,5,2).concat(hBar(1,0,2), hBar(6,5,2), hBar(7,0,2)));
    defPattern('peinev', 'Peine vertical', vBar(3,0,3).concat(vBar(0,1,3), vBar(3,6,3), vBar(0,7,3)));
    defPattern('serpiente', 'Serpiente', rot2(hBar(1,0,3)));
    defPattern('embudo', 'Embudo', escalera.concat([[1,7,'h'],[2,6,'v'],[3,5,'h']]), true);
    defPattern('escalera', 'Escalera diagonal', escalera, true);
    defPattern('dobleescalera', 'Doble escalera', rot2(escalera), true);
    defPattern('corredor', 'Corredor central', vBar(2,2,2).concat(vBar(2,5,2)), true);
    defPattern('camaras', 'Cámaras', rot2(hBar(2,0,1).concat(hBar(2,3,3))), true);
    defPattern('islas', 'Islas', rot4([[1,1,'h'],[2,0,'v']]));
    defPattern('pinzas', 'Pinzas', rot2([[1,2,'h'],[2,1,'v'],[3,2,'h']]), true);
    defPattern('damero', 'Damero', rot4([[1,3,'h']]));
    defPattern('rombo', 'Rombo', rot4([[1,4,'h'],[2,5,'v']]), true);
    defPattern('trebol', 'Trébol', rot4([[2,1,'h'],[1,2,'v']]));
    defPattern('torres', 'Torres', vBar(0,1,2).concat(vBar(4,6,2)));
    defPattern('zigzag', 'Bordes en zigzag', [[1,0,'v'],[4,1,'v'],[1,7,'v'],[4,6,'v']]);
    defPattern('puente', 'Puente', hBar(1,0,2).concat(hBar(1,5,2)));
    defPattern('dobrepuente', 'Doble puente', rot2(hBar(1,0,3).concat(hBar(1,7,1))));
    defPattern('cruz', 'Cruz abierta', rot4(vBar(1,5,2)), true);
    defPattern('espiral', 'Espiral', [[2,3,'h']].concat(vBar(3,5,2), hBar(6,2,2), vBar(3,1,2)), true);
    defPattern('pasillos', 'Pasillos cruzados', rot4([[2,0,'h'],[0,2,'v']]));
    defPattern('bahias', 'Bahías', rot2([[0,0,'v'],[0,2,'v'],[0,7,'v']]));
  })();

  // Escala un patrón de 9×9 a otro tamaño. Cada barra (segmentos seguidos) se escala por su centro y
  // conserva su largo en segmentos, así no se rompen las barras ni la simetría.
  function scaleSegs(segs, size){
    if(size===MAZE_REF) return segs.map(s=> s.slice());
    const f = (size-2)/(MAZE_REF-2), m = size-2, out = [], used = new Set();
    const has = new Set(segs.map(segKey));
    const list = segs.slice().sort((a,b)=> a[2]!==b[2] ? (a[2]<b[2] ? -1 : 1) : (a[2]==='h' ? (a[0]-b[0] || a[1]-b[1]) : (a[1]-b[1] || a[0]-b[0])));
    for(const s of list){
      if(used.has(segKey(s))) continue;
      const o = s[2], chain = [s]; used.add(segKey(s));
      for(let cur = s;;){
        const nx = o==='h' ? [cur[0], cur[1]+2, 'h'] : [cur[0]+2, cur[1], 'v'];
        if(has.has(segKey(nx)) && !used.has(segKey(nx))){ chain.push(nx); used.add(segKey(nx)); cur = nx; } else break;
      }
      const n = chain.length, pos0 = o==='h' ? s[1] : s[0], line0 = o==='h' ? s[0] : s[1];
      const centerS = Math.round((pos0+n-1)*f), lineS = Math.round(line0*f);
      for(let i=0;i<n;i++){
        const pos = centerS-(n-1)+2*i;
        if(pos<0 || pos>m || lineS<0 || lineS>m) continue;
        out.push(o==='h' ? [lineS,pos,'h'] : [pos,lineS,'v']);
      }
    }
    return out;
  }

  // Gira/refleja una plantilla corta dentro de su propia caja y la deja anclada en (0,0).
  function templateVariant(tpl, rng){
    const m = Math.max(...tpl.map(s=> Math.max(s[0], s[1])));
    const t = applyTransform(tpl, m+2, Math.floor(rng()*4), rng()<0.5);
    const r0 = Math.min(...t.map(s=> s[0])), c0 = Math.min(...t.map(s=> s[1]));
    return t.map(s=> [s[0]-r0, s[1]-c0, s[2]]);
  }

  // Patrón propio guardado desde el editor: coordenadas relativas, sin escalar.
  function userPatternFrom(rec){
    if(!rec || !Array.isArray(rec.walls) || !rec.walls.length || rec.walls.length>24) return null;
    const segs = uniqSegs(rec.walls.map(w=> [w.r|0, w.c|0, w.orientation==='v' ? 'v' : 'h']));
    return { id:'mine:'+segsKey(segs), name:String(rec.name||'Mi patrón').slice(0,24), segs, touchesCenter:false, sym:null, fixed:true };
  }
  const mazeVariantCache = new Map();
  function patternVariants(pat, size){
    const cacheKey = pat.id+'|'+size;
    if(mazeVariantCache.has(cacheKey)) return mazeVariantCache.get(cacheKey);
    const m = size-2, seen = new Set(), out = [];
    const push = (segs, tf, off)=>{ const k = segsKey(segs); if(seen.has(k)) return; seen.add(k); out.push({ segs, tf, off }); };
    if(pat.fixed){
      const norm = segs=>{ const r0 = Math.min(...segs.map(s=>s[0])), c0 = Math.min(...segs.map(s=>s[1])); return segs.map(s=> [s[0]-r0, s[1]-c0, s[2]]); };
      const base = norm(pat.segs), side = Math.max(...base.map(s=> Math.max(s[0], s[1])))+1;
      for(let flip=0; flip<2; flip++) for(let rot=0; rot<4; rot++){
        const t = norm(applyTransform(base, side+1, rot, !!flip));
        const h = Math.max(...t.map(s=>s[0]))+1, w = Math.max(...t.map(s=>s[1]))+1;
        for(let r0=0; r0+h<=m+1; r0++) for(let c0=0; c0+w<=m+1; c0++) push(t.map(s=> [s[0]+r0, s[1]+c0, s[2]]), rot+4*flip, [r0,c0]);
      }
    } else {
      const base = scaleSegs(pat.segs, size);
      for(let flip=0; flip<2; flip++) for(let rot=0; rot<4; rot++){
        const t = applyTransform(base, size, rot, !!flip);
        for(let dr=-1; dr<=1; dr++) for(let dc=-1; dc<=1; dc++){
          const segs = t.map(s=> [s[0]+dr, s[1]+dc, s[2]]);
          if(segs.some(s=> s[0]<0 || s[1]<0 || s[0]>m || s[1]>m)) continue;     // el desplazamiento nunca rompe la forma
          push(segs, rot+4*flip, [dr,dc]);
        }
      }
    }
    if(mazeVariantCache.size>400) mazeVariantCache.clear();
    mazeVariantCache.set(cacheKey, out);
    return out;
  }

  // Contexto de un tablero: salidas según cantidad de jugadores, zonas protegidas y distancia libre.
  const mazeContextCache = new Map();
  function mazeContext(size, players){
    const key = size+'|'+players;
    if(mazeContextCache.has(key)) return mazeContextCache.get(key);
    const mid = (size-1)/2, T = {r:0,c:mid}, B = {r:size-1,c:mid}, R = {r:mid,c:size-1}, L = {r:mid,c:0};
    const seats = players<=1 ? [T] : players===2 ? [T,B] : players===3 ? [T,R,B] : [T,R,B,L];
    const zr = MAZE_RULES.zoneRadius(size), zone = new Set();
    if(zr>=0) for(let dr=-zr; dr<=zr; dr++) for(let dc=-zr; dc<=zr; dc++) zone.add((mid+dr)*size+(mid+dc));
    const ctx = { size, players, mid, seats, prot:new Set(seats.map(s=> s.r*size+s.c)), zone,
      free: seats.map(s=> Math.abs(s.r-mid)+Math.abs(s.c-mid)) };
    mazeContextCache.set(key, ctx);
    return ctx;
  }
  // Evalúa un conjunto de segmentos: colisiones, salidas y zona central protegidas, y distancia de cada
  // salida a la meta (una sola BFS desde la meta). Devuelve null si no se puede colocar.
  function mazeEval(ctx, segs, allowCenter){
    const size = ctx.size, m = size-1;
    const occ = new Uint8Array(m*m), right = new Uint8Array(size*size), down = new Uint8Array(size*size);
    for(let i=0;i<segs.length;i++){
      const r = segs[i][0], c = segs[i][1], o = segs[i][2];
      if(r<0 || c<0 || r>=m || c>=m || occ[r*m+c]) return null;
      if(o==='h'){ if(c>0 && occ[r*m+c-1]===1) return null; if(c<m-1 && occ[r*m+c+1]===1) return null; }
      else { if(r>0 && occ[(r-1)*m+c]===2) return null; if(r<m-1 && occ[(r+1)*m+c]===2) return null; }
      const a = r*size+c, b = a+1, d = a+size, e = d+1;               // las 4 casillas que toca el segmento
      if(ctx.prot.has(a) || ctx.prot.has(b) || ctx.prot.has(d) || ctx.prot.has(e)) return null;
      if(!allowCenter && (ctx.zone.has(a) || ctx.zone.has(b) || ctx.zone.has(d) || ctx.zone.has(e))) return null;
      occ[r*m+c] = (o==='h' ? 1 : 2);
      if(o==='h'){ down[a] = 1; down[b] = 1; } else { right[a] = 1; right[d] = 1; }
    }
    const dist = new Int16Array(size*size).fill(-1), q = new Int16Array(size*size);
    const goal = ctx.mid*size+ctx.mid; dist[goal] = 0; let head = 0, tail = 0; q[tail++] = goal;
    while(head<tail){
      const cur = q[head++], r = (cur/size)|0, c = cur-r*size, nd = dist[cur]+1;
      if(r>0 && !down[cur-size] && dist[cur-size]<0){ dist[cur-size] = nd; q[tail++] = cur-size; }
      if(r<size-1 && !down[cur] && dist[cur+size]<0){ dist[cur+size] = nd; q[tail++] = cur+size; }
      if(c>0 && !right[cur-1] && dist[cur-1]<0){ dist[cur-1] = nd; q[tail++] = cur-1; }
      if(c<size-1 && !right[cur] && dist[cur+1]<0){ dist[cur+1] = nd; q[tail++] = cur+1; }
    }
    const dists = [];
    for(const s of ctx.seats){ const d0 = dist[s.r*size+s.c]; if(d0<0) return null; dists.push(d0); }
    return { dists };
  }
  // Regla de equidad. Devuelve null si el mapa no es aceptable, o {pref, diff}; pref = cumple el mínimo de +2 en todos.
  function mazeJudge(ctx, d){
    const R = MAZE_RULES; let mn = 1e9, mx = -1, pref = true;
    for(let i=0;i<d.length;i++){
      const f = ctx.free[i];
      if(d[i] > f*R.capMult) return null;
      if(d[i] < f+Math.min(R.minExtra, Math.max(1, f-1))) pref = false;
      if(d[i]<mn) mn = d[i];
      if(d[i]>mx) mx = d[i];
    }
    if(mx-mn > (R.diffMax[ctx.players] || 2)) return null;
    if(R.strictExtra && !pref) return null;
    return { pref, diff: mx-mn };
  }
  // Todas las variantes de un patrón que se pueden colocar y son equitativas (ok), y las que además cumplen +2 (pref).
  const mazeTableCache = new Map();
  function mazeTable(pat, ctx){
    const key = pat.id+'|'+ctx.size+'|'+ctx.players;
    if(mazeTableCache.has(key)) return mazeTableCache.get(key);
    const variants = patternVariants(pat, ctx.size), ok = [], pref = [];
    let placeable = 0;
    for(const v of variants){
      const ev = mazeEval(ctx, v.segs, pat.touchesCenter);
      if(!ev) continue;
      placeable++;
      const j = mazeJudge(ctx, ev.dists);
      if(!j) continue;
      const item = { segs:v.segs, tf:v.tf, off:v.off, dists:ev.dists, pref:j.pref };
      ok.push(item);
      if(j.pref) pref.push(item);
    }
    const table = { total:variants.length, placeable, ok, pref };
    if(mazeTableCache.size>400) mazeTableCache.clear();
    mazeTableCache.set(key, table);
    return table;
  }
  function mazePool(ctx, density, mine){
    const list = MAZE_PATTERNS.filter(p=> ctx.players<3 || p.sym==='c4').concat(mine||[]);   // 3-4 jugadores: sólo simetría c4
    return list.filter(p=>{
      const t = mazeTable(p, ctx);
      if(!t.ok.length) return false;
      return density!=='ligero' || t.ok[0].segs.length<=MAZE_RULES.ligeroMaxSegs;
    });
  }
  function pickVariant(rng, table){
    const src = table.pref.length ? table.pref : table.ok;
    return src[Math.floor(rng()*src.length)];
  }

  // Estado temporal para colocar y validar paredes con tryPlaceEnvWall (la misma rutina del juego).
  function mazeScratch(ctx){
    return { size:ctx.size, center:{r:ctx.mid, c:ctx.mid}, players:ctx.seats.map(s=> ({ r:s.r, c:s.c })),
      occupied:Array.from({length:ctx.size-1}, ()=> Array(ctx.size-1).fill(null)), blockedEdges:new Set(), walls:[],
      guard:(r,c)=>{ const a = r*ctx.size+c; return ctx.prot.has(a) || ctx.prot.has(a+1) || ctx.prot.has(a+ctx.size) || ctx.prot.has(a+ctx.size+1); } };
  }
  function mazeCommit(ctx, segs){
    const local = mazeScratch(ctx);
    for(const s of segs) if(!tryPlaceEnvWall(local, s[0], s[1], s[2]==='v' ? 'v' : 'h')) return null;
    return local.walls.map(w=> ({ r:w.r, c:w.c, orientation:w.orientation }));
  }

  function mazeFromPatterns(ctx, rng, density, mine){
    const R = MAZE_RULES, m = ctx.size-2;
    let attempts = 0, rejected = 0, fallback = null;
    const pool = mazePool(ctx, density, mine);
    if(!pool.length) return { segs:[], names:[], attempts, rejected, fallback:'sin patrones utilizables' };
    const first = pool[Math.floor(rng()*pool.length)], t1 = mazeTable(first, ctx), v1 = pickVariant(rng, t1);
    attempts++;
    let segs = v1.segs, allowCenter = first.touchesCenter;
    const names = [first.name+' V'+(v1.tf+1)];
    if(density==='medio'){
      let done = false;
      for(let i=0;i<R.retries && !done;i++){
        attempts++;
        const tpl = MAZE_TEMPLATES[Math.floor(rng()*MAZE_TEMPLATES.length)];
        const t = templateVariant(tpl, rng);
        const h = Math.max(...t.map(s=>s[0]))+1, w = Math.max(...t.map(s=>s[1]))+1;
        const r0 = Math.floor(rng()*(m+2-h)), c0 = Math.floor(rng()*(m+2-w));
        const cand = segs.concat(t.map(s=> [s[0]+r0, s[1]+c0, s[2]]));
        const ev = mazeEval(ctx, cand, allowCenter), j = ev && mazeJudge(ctx, ev.dists);
        if(j){ segs = cand; names.push('tramo corto'); done = true; } else rejected++;
      }
      if(!done) fallback = 'medio sin tramo (30 intentos fallidos)';
    } else if(density==='denso'){
      let done = false;
      for(let i=0;i<R.retries && !done;i++){
        attempts++;
        const p2 = pool[Math.floor(rng()*pool.length)];
        if(pool.length>1 && p2.id===first.id){ rejected++; continue; }
        const v2 = pickVariant(rng, mazeTable(p2, ctx));
        const cand = segs.concat(v2.segs), center = allowCenter || p2.touchesCenter;
        const ev = mazeEval(ctx, cand, center), j = ev && mazeJudge(ctx, ev.dists);
        if(j){ segs = cand; allowCenter = center; names.push(p2.name+' V'+(v2.tf+1)); done = true; } else rejected++;
      }
      if(!done) fallback = 'denso con un solo patrón (30 intentos fallidos)';
    }
    return { segs, names, attempts, rejected, fallback, allowCenter };
  }

  // Generador principal. Es una función pura de {size, players, density, seed, mine}: la misma entrada
  // da siempre el mismo mapa, y eso es lo que usa el minimapa, la partida y "Repetir mapa".
  function generateMaze(opts){
    const size = opts.size, players = Math.max(1, Math.min(4, opts.players||2));
    const density = MAZE_DENSITIES[opts.density] ? opts.density : 'medio';
    const seed = (opts.seed==null || !Number.isFinite(+opts.seed)) ? newMazeSeed() : (Math.abs(Math.floor(+opts.seed)) % SEED_SPACE);
    const rng = mulberry32(seed), ctx = mazeContext(size, players);
    const mine = (opts.mine||[]).map(userPatternFrom).filter(Boolean);
    let walls = null, name = 'Caos', attempts = 0, rejected = 0, fallback = null, allowCenter = true;
    if(density!=='caos'){
      const r = mazeFromPatterns(ctx, rng, density, mine);
      attempts = r.attempts; rejected = r.rejected; fallback = r.fallback; allowCenter = r.allowCenter;
      if(r.segs.length){
        walls = mazeCommit(ctx, r.segs);
        if(walls) name = r.names.join(' + '); else fallback = 'el patrón no se pudo colocar';
      }
    }
    if(!walls){                                          // Caos, o último recurso si no hay patrón utilizable
      // Como plan B se exige equidad: hasta 30 intentos de Caos y, si ninguno es parejo, el tablero queda limpio.
      const tries = density==='caos' ? 1 : MAZE_RULES.retries;
      let found = null;
      for(let i=0;i<tries && !found;i++){
        const local = mazeScratch(ctx);
        const g = generateRandomWalls(local, 3+Math.floor(rng()*2), rng);
        attempts += g.attempts; rejected += g.attempts-g.placed;
        const list = local.walls.map(w=> ({ r:w.r, c:w.c, orientation:w.orientation }));
        if(density==='caos'){ found = list; break; }
        const ev = mazeEval(ctx, list.map(w=> [w.r, w.c, w.orientation]), true);
        if(ev && mazeJudge(ctx, ev.dists)) found = list; else rejected++;
      }
      walls = found || [];
      if(density!=='caos') fallback = (fallback ? fallback+' → ' : '')+(found ? 'Caos equitativo' : 'tablero limpio');
      name = found ? 'Caos' : 'Sin paredes'; allowCenter = true;
    }
    const ev = mazeEval(ctx, walls.map(w=> [w.r, w.c, w.orientation]), true);
    const dists = ev ? ev.dists : ctx.free.slice();
    const j = mazeJudge(ctx, dists);
    return { seed, seedText:seedToText(seed), size, players, density, name, walls, placed:walls.length, attempts, rejected, fallback,
      stats:{ dists, free:ctx.free.slice(), diff:Math.max(...dists)-Math.min(...dists), fair:!!j, preferred:!!(j && j.pref) } };
  }

  // Generador "Caos": plantillas cortas en posiciones al azar, sin zonas ni equidad (el generador de antes).
  // Devuelve {placed, attempts}: cuántas plantillas entraron y cuántos intentos hicieron falta.
  function generateRandomWalls(localState, count, rng){
    const random = rng || Math.random;
    const size = localState.size;
    let placed = 0, attempts = 0;
    while(placed < count && attempts < 200){
      attempts++;
      const tpl = templateVariant(MAZE_TEMPLATES[Math.floor(random()*MAZE_TEMPLATES.length)], random);
      const baseR = Math.floor(random()*(size-1));
      const baseC = Math.floor(random()*(size-1));
      const segs = tpl.map(([dr,dc,orientation])=> ({ r:baseR+dr, c:baseC+dc, orientation }));
      const snapshotOccupied = localState.occupied.map(row=> row.slice());
      const snapshotBlocked = new Set(localState.blockedEdges);
      const snapshotWallsLen = localState.walls.length;
      let ok = true;
      for(const seg of segs){
        if(!tryPlaceEnvWall(localState, seg.r, seg.c, seg.orientation)){ ok = false; break; }
      }
      if(!ok){
        localState.occupied = snapshotOccupied;
        localState.blockedEdges = snapshotBlocked;
        localState.walls.length = snapshotWallsLen;
        continue;
      }
      placed++;
    }
    return { placed, attempts };
  }

  function wallRect(r,c,orientation,cs){
    const thickness = cs*0.16;
    const inset = cs*0.06;
    if(orientation==='h'){
      return { x:c*cs+inset, y:(r+1)*cs - thickness/2, w:2*cs-2*inset, h:thickness };
    }
    return { x:(c+1)*cs-thickness/2, y:r*cs+inset, w:thickness, h:2*cs-2*inset };
  }
  function getWallSlotFromPoint(x,y){
    const cs = cellSize();
    const colF = x/cs, rowF = y/cs;
    const nearestCol = Math.min(Math.max(Math.round(colF),1), state.size-1);
    const nearestRow = Math.min(Math.max(Math.round(rowF),1), state.size-1);
    const distV = Math.abs(colF-nearestCol)*cs;
    const distH = Math.abs(rowF-nearestRow)*cs;
    const orientation = distV < distH ? 'v' : 'h';
    const r = Math.min(Math.max(nearestRow-1,0), state.size-2);
    const c = Math.min(Math.max(nearestCol-1,0), state.size-2);
    return { r, c, orientation };
  }
  function getBoardPoint(evt){
    const pt = boardSvg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const loc = pt.matrixTransform(boardSvg.getScreenCTM().inverse());
    return { x: loc.x, y: loc.y };
  }

  function computeValidMoves(playerIndex){
    const p = state.players[playerIndex];
    const moves = [];
    for(const [dr,dc] of DIRS4){
      const nr=p.r+dr, nc=p.c+dc;
      if(nr<0||nc<0||nr>=state.size||nc>=state.size) continue;
      if(isBlocked(p.r,p.c,nr,nc,state.blockedEdges)) continue;
      const occupantIdx = state.players.findIndex((pl,i)=> i!==playerIndex && !pl.arrived && pl.r===nr && pl.c===nc);
      if(occupantIdx===-1){
        moves.push({ r:nr, c:nc });
        continue;
      }
      // 2v2: con el aliado a un paso (y sin pared en medio) se ofrece intercambiar casillas; gasta el turno.
      if(state.teams && occupantIdx===allyIdxOf(playerIndex)) moves.push({ r:nr, c:nc, swap:true });
      const jr=nr+dr, jc=nc+dc;
      // Rey de la colina: empujar al rival adyacente. La jugada apunta a la casilla del rival
      // (donde va a quedar el atacante) y `push` es la casilla a la que se desliza el rival.
      // Se ofrece sólo si quedan empujones y no se lo acaba de empujar en el turno anterior.
      if(state.ruleset==='hill' && (p.pushesLeft||0)>0 && !(state.lastPush && state.lastPush[playerIndex]===occupantIdx)){
        const behindFree = jr>=0 && jc>=0 && jr<state.size && jc<state.size &&
          !isBlocked(nr,nc,jr,jc,state.blockedEdges) &&
          !state.players.some(pl=> !pl.arrived && pl.r===jr && pl.c===jc);
        if(behindFree) moves.push({ r:nr, c:nc, push:{ r:jr, c:jc } });
      }
      const straightOk = jr>=0 && jc>=0 && jr<state.size && jc<state.size &&
        !isBlocked(nr,nc,jr,jc,state.blockedEdges) &&
        !state.players.some((pl,i)=> i!==playerIndex && !pl.arrived && pl.r===jr && pl.c===jc);
      if(straightOk){
        moves.push({ r:jr, c:jc });
      } else {
        const perp = dr!==0 ? [[0,-1],[0,1]] : [[-1,0],[1,0]];
        for(const [pdr,pdc] of perp){
          const sr=nr+pdr, sc=nc+pdc;
          if(sr<0||sc<0||sr>=state.size||sc>=state.size) continue;
          if(isBlocked(nr,nc,sr,sc,state.blockedEdges)) continue;
          if(state.players.some((pl,i)=> i!==playerIndex && !pl.arrived && pl.r===sr && pl.c===sc)) continue;
          moves.push({ r:sr, c:sc });
        }
      }
    }
    // Cazador y fugitivo: sprint del fugitivo = paso doble en línea recta (las dos casillas libres y sin pared en medio)
    if(state.ruleset==='hunter' && playerIndex===state.fugitiveIdx && (p.sprints||0)>0){
      for(const [dr,dc] of DIRS4){
        const mr=p.r+dr, mc=p.c+dc, lr=p.r+2*dr, lc=p.c+2*dc;
        if(lr<0||lc<0||lr>=state.size||lc>=state.size) continue;
        if(isBlocked(p.r,p.c,mr,mc,state.blockedEdges) || isBlocked(mr,mc,lr,lc,state.blockedEdges)) continue;
        if(state.players.some(pl=> pl!==p && ((pl.r===mr&&pl.c===mc) || (pl.r===lr&&pl.c===lc)))) continue;
        moves.push({ r:lr, c:lc, sprint:true });
      }
    }
    // Fiesta: Paso doble guardado (un poder por turno; no vale para pisar el centro)
    if(state.ruleset==='party' && p.powers && p.powers.indexOf('paso_doble')>=0
       && !(state.party && state.party.usedThisTurn && playerIndex===state.currentPlayerIndex)){
      for(const [dr,dc] of DIRS4){
        const mr=p.r+dr, mc=p.c+dc, lr=p.r+2*dr, lc=p.c+2*dc;
        if(lr<0||lc<0||lr>=state.size||lc>=state.size) continue;
        if(lr===state.center.r && lc===state.center.c) continue;
        if(isBlocked(p.r,p.c,mr,mc,state.blockedEdges) || isBlocked(mr,mc,lr,lc,state.blockedEdges)) continue;
        if(state.players.some(pl=> pl!==p && ((pl.r===mr&&pl.c===mc) || (pl.r===lr&&pl.c===lc)))) continue;
        moves.push({ r:lr, c:lc, sprint:true });
      }
    }
    return moves;
  }

  function advanceTurn(){
    clearHintMarks();
    // Regla del pastel (62): al cerrarse la jugada de apertura se abre la ventana para que el segundo cambie de lado;
    // cualquier otra acción (o el cambio mismo) la cierra.
    if(state.pie && !state.pie.resolved){
      if(!state.pie.open && state.pie.actions===0){ state.pie.actions = 1; state.pie.open = true; }
      else { state.pie.open = false; state.pie.resolved = true; }
    }
    const n = state.players.length;
    let next = state.currentPlayerIndex;
    for(let i=0;i<n;i++){
      next = (next+1) % n;
      const cand = state.players[next];
      if(cand.arrived) continue;                 // 2v2 «llegan los dos»: quien ya llegó no vuelve a jugar
      if(cand.stunned){ cand.stunned = false; partyStunSkipped(cand); continue; }
      if(n>1 && cand.wallsLeft<=0 && computeValidMoves(next).length===0) continue;
      break;
    }
    const prevIndex = state.currentPlayerIndex;
    state.currentPlayerIndex = next;
    state.sprintArmed = false;
    if(state.ruleset==='party') partyOnTurnStart(next, prevIndex);
    state.validMoves = computeValidMoves(next);
    const cpNext = state.players[next];
    mode = (!state.validMoves.length && cpNext.wallsLeft>0 && !cpNext.isCPU) ? 'wall' : 'move';
    tickFogEchoes();
    // Niebla de guerra con 2+ humanos en el mismo dispositivo: al pasar a otro humano, lo que reveló quien
    // jugó antes anularía la niebla si se ve directo. Cortina "pasá el celular" hasta que el próximo confirme.
    if(state.ruleset==='fog' && !state.winner && next!==prevIndex && !cpNext.isCPU
      && state.players.filter(pl=> !pl.isCPU).length>=2){
      queueHandoff(cpNext);
    }
  }

  // ---------- Regla del pastel (62) ----------
  // Tras la jugada de apertura, el segundo puede cambiar de lado: toma la posición, las paredes que le quedan y la meta
  // del que abrió (que pasa a ocupar su lugar). Cambiar gasta el turno del segundo; quien abrió juega a continuación.
  function pieSwap(){
    if(!state || !state.pie || !state.pie.open || state.winner) return false;
    const cur = state.players[state.currentPlayerIndex], opener = state.players[state.firstIdx];
    if(!cur || !opener || cur===opener) return false;
    [cur.r, opener.r] = [opener.r, cur.r];
    [cur.c, opener.c] = [opener.c, cur.c];
    [cur.wallsLeft, opener.wallsLeft] = [opener.wallsLeft, cur.wallsLeft];
    if(state.goalSides){ const t = state.goalSides[cur.id]; state.goalSides[cur.id] = state.goalSides[opener.id]; state.goalSides[opener.id] = t; }
    const ss = state.startSeat; [ss[cur.id], ss[opener.id]] = [ss[opener.id], ss[cur.id]];
    state.pie.open = false; state.pie.resolved = true; state.pie.swapped = true;
    showToast(`🥧 ${escapeHtml(cur.name)} cambió de lado con ${escapeHtml(opener.name)}.`);
    playToggleSound(true);
    hideWallPreview(); previewSlot = null;
    advanceTurn();
    render();
    return true;
  }
  // La IA sólo cambia si quien abrió quedó adelante, con más o menos ganas según su dificultad.
  function botMaybePie(idx){
    if(!state || !state.pie || !state.pie.open || state.winner) return false;
    const me = state.players[idx], opener = state.players[state.firstIdx];
    if(!me || me===opener) return false;
    const ahead = distanceToCenter(me.r, me.c, state.blockedEdges, me.id) - distanceToCenter(opener.r, opener.c, state.blockedEdges, opener.id);
    const chance = { easy:0.25, normal:0.5, hard:0.85, expert:1 }[me.difficulty] || 0.25;
    return ahead>0 && Math.random()<chance && pieSwap();
  }
  pieBtn.addEventListener('click', ()=>{ if(state && state.pie && state.pie.open) pieSwap(); });

  // Botones auxiliares de la partida (pastel y pista): sólo se ven cuando corresponden.
  function updateAuxButtons(){
    if(!state) return;
    const cp = state.players[state.currentPlayerIndex];
    const humanTurn = !!cp && !cp.isCPU && !state.winner;
    const pieShow = !!(state.pie && state.pie.open) && humanTurn;
    pieBtn.classList.toggle('hidden', !pieShow);
    auxToggle.classList.toggle('hidden', !pieShow);
  }

  // ---------- Ayuda de distancia (65): fichas "Tú 5 · Rival 6" ----------
  // Distancia en pasos hasta la meta de cada jugador, según el modo (centro, lado opuesto, zona o, para los
  // cazadores, el fugitivo). En niebla de guerra sólo se muestra la propia, calculada con lo que se ve.
  function helpDist(i, edges){
    const pl = state.players[i];
    if(pl.arrived) return 0;
    if(state.ruleset==='hill') return distanceToHill(pl.r, pl.c, edges, hillFreeTargets(i));
    if(state.ruleset==='hunter' && i!==state.fugitiveIdx){
      const f = state.players[state.fugitiveIdx];
      return bfsShortestPath(pl.r, pl.c, f.r, f.c, edges, state.size);
    }
    return distanceToCenter(pl.r, pl.c, edges, i);
  }
  function fmtDist(d){ return isFinite(d) ? String(d) : '∞'; }
  function updateDistChips(previewEdges){
    if(!distChipsEl) return;
    const on = distHelpOn && !!state && !state.winner;
    distChipsEl.classList.toggle('hidden', !on);
    if(!on){ distChipsEl.innerHTML = ''; return; }
    const fog = state.ruleset==='fog';
    const viewer = fog ? fogViewerIndex() : null;
    const base = (fog && viewer!=null) ? visibleBlockedEdgesFor(viewer) : state.blockedEdges;
    let after = null;
    if(previewEdges){
      after = new Set(base);
      previewEdges.forEach(e=>{ if(!state.blockedEdges.has(e)) after.add(e); });
    }
    const cpuGame = !!state.isCpuGame && state.players.length===2;
    const chips = [];
    state.players.forEach((pl,i)=>{
      const label = cpuGame ? (pl.isCPU ? 'Rival' : 'Tú') : pl.name;
      let val;
      if(fog && viewer!=null && i!==viewer) val = '?';
      else {
        const b = helpDist(i, base);
        val = fmtDist(b);
        if(after){ const a = helpDist(i, after); if(a!==b) val += ' → ' + fmtDist(a); }
      }
      const cur = (i===state.currentPlayerIndex) ? ' active' : '';
      chips.push(`<span class="dist-chip${cur}" style="--pc:${pl.color}"><i class="dist-dot"></i>${escapeHtml(label)} <b>${val}</b></span>`);
    });
    distChipsEl.innerHTML = chips.join('<span class="dist-sep">·</span>');
    distChipsEl.setAttribute('aria-label', 'Pasos que le faltan a cada jugador');
  }

  // ---------- overlays genéricos ----------
  function openOverlay(name){
    const el = overlayEls[name];
    if(!el) return;
    hideEmoteBar();
    el.classList.remove('hidden');
    overlayStack.push(name);
    if(!gameScreen.classList.contains('hidden')){ invalidateBotTimer(); syncTurnTimeLeft(); clearTurnTimer(); }
  }
  function closeOverlay(name){
    const el = overlayEls[name];
    if(!el) return;
    el.classList.add('hidden');
    overlayStack = overlayStack.filter(n=> n!==name);
    if(name==='pause' && pauseNotice) pauseNotice.classList.add('hidden');   // el aviso de inactividad sólo vale para esa pausa
    if(name==='tutorial'){
      try{ localStorage.setItem('quoridor_tutorial_seen','1'); }catch(e){}
    }
    if(overlayStack.length===0 && !gameScreen.classList.contains('hidden') && state && !state.winner){
      scheduleBotTurnIfNeeded();
      startTurnTimer(true);
      updateHunterBadge();
    }
  }
  // Cortina de traspaso (niebla de guerra, 2+ humanos): pausa el reloj y tapa el tablero hasta que el
  // siguiente jugador confirme que ya tiene el celular en mano.
  function queueHandoff(player){
    handoffTitle.textContent = `Pasá el celular a ${player.name}`;
    handoffMsg.textContent = 'Cuando lo tenga en mano, tocá "Listo" para ver su turno.';
    openOverlay('handoff');
  }
  handoffReadyBtn.addEventListener('click', ()=> closeOverlay('handoff'));
  function closeTopOverlay(){
    if(!overlayStack.length) return false;
    closeOverlay(overlayStack[overlayStack.length-1]);
    return true;
  }

  // ---------- confirmación reutilizable (reinicio/salir/borrar stats) ----------
  function showConfirm(message, onConfirm, yesLabel){
    confirmMessage.textContent = message;
    confirmYesBtn.textContent = yesLabel || 'Sí, continuar';
    pendingConfirmAction = onConfirm;
    openOverlay('confirm');
  }
  confirmYesBtn.addEventListener('click', ()=>{
    const action = pendingConfirmAction;
    pendingConfirmAction = null;
    closeOverlay('confirm');
    if(action) action();
  });
  confirmNoBtn.addEventListener('click', ()=>{
    pendingConfirmAction = null;
    closeOverlay('confirm');
  });
  function matchInProgress(){ return !!state && !state.winner; }

  // ---------- tema claro/oscuro ----------
  function loadThemePref(){
    try{ return localStorage.getItem('quoridor_theme') || 'system'; }catch(e){ return 'system'; }
  }
  function applyTheme(pref){
    if(pref==='light') document.documentElement.setAttribute('data-theme','light');
    else if(pref==='dark') document.documentElement.setAttribute('data-theme','dark');
    else document.documentElement.removeAttribute('data-theme');
    try{ localStorage.setItem('quoridor_theme', pref); }catch(e){}
  }

  // ---------- ajustes de sonido / vibración / visual (persistidos) ----------
  function readPref(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } }
  function writePref(key, val){ try{ localStorage.setItem(key, String(val)); }catch(e){} }
  const legacyMuted = readPref('quoridor_muted')==='1';      // versión anterior: un solo botón para todo
  let sfxVolume = (function(){
    const v = readPref('quoridor_sfx');
    if(v!==null && v!=='' && !isNaN(+v)) return Math.min(1, Math.max(0, +v));
    return legacyMuted ? 0 : 0.8;
  })();
  let vibrateOn = (function(){
    const v = readPref('quoridor_vibrate');
    if(v!==null) return v==='1';
    return !legacyMuted;
  })();
  let showMovesOn = readPref('quoridor_showMoves')!=='0';
  let distHelpOn = readPref('quoridor_distHelp')==='1';      // 65: fichas "Tú 5 · Rival 6" (apagada por defecto)
  let lotteryOn = readPref('quoridor_lottery')!=='0';        // 62: sorteo de quién abre (encendido por defecto)
  let pieOn = readPref('quoridor_pie')==='1';                // 62: regla del pastel en partidas de 2 (apagada por defecto)
  let glassOn = (function(){
    const v = readPref('quoridor_glass');
    if(v!==null) return v==='1';
    const lowEnd = (navigator.deviceMemory && navigator.deviceMemory<=2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency<=4);
    return !lowEnd;
  })();

  // ---------- sonido: .ogg del kit con AudioBuffer + volumen maestro (con tonos sintéticos de respaldo) ----------
  const SFX_FILES = { click:'click-a', click2:'click-b', tap:'tap-a', wall:'tap-b', on:'switch-a', off:'switch-b' };
  let masterGain = null;
  const sfxBuffers = {};
  let sfxRequested = false;
  function getAudioCtx(){
    if(audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    try{
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = sfxVolume;
      masterGain.connect(audioCtx.destination);
    }catch(e){ audioCtx = null; masterGain = null; }
    return audioCtx;
  }
  function loadSfxBuffers(){
    if(sfxRequested) return;
    const ctx = getAudioCtx();
    if(!ctx) return;
    sfxRequested = true;
    Object.keys(SFX_FILES).forEach(key=>{
      try{
        fetch(ASSET + 'sounds/' + SFX_FILES[key] + '.ogg')
          .then(r=> r.arrayBuffer())
          .then(buf=> new Promise((res, rej)=> ctx.decodeAudioData(buf, res, rej)))
          .then(decoded=>{ sfxBuffers[key] = decoded; })
          .catch(()=>{});
      }catch(e){}
    });
  }
  // ---------- música de fondo (en bucle, con volumen propio) ----------
  // Pista esperada en assets/music/musica.mp3 (también prueba .ogg y .m4a). Si no hay archivo, no pasa nada:
  // no suena nada y la barra de "Volumen de música" queda oculta en Ajustes.
  // La música se mezcla por debajo de los efectos: al 100% del deslizador llega a MUSIC_CEIL del volumen máximo y la
  // curva es cuadrática (el oído percibe mejor los cambios), así el valor por defecto queda "de fondo".
  // Si la pista tuviera un volumen de grabación muy distinto, se ajusta con MUSIC_TRIM (1 = sin cambios).
  const MUSIC_FILES = ['musica.mp3', 'musica.ogg', 'musica.m4a'];
  const MUSIC_CEIL = 0.6;
  const MUSIC_TRIM = 1;
  const MUSIC_DEFAULT = 0.6;
  let musicVolume = (function(){
    const v = readPref('quoridor_music');
    if(v!==null && v!=='' && !isNaN(+v)) return Math.min(1, Math.max(0, +v));
    return MUSIC_DEFAULT;
  })();
  let musicEl = null, musicFileIdx = 0, musicAvailable = false, musicStarted = false, musicFade = null;
  function musicLevel(){ return Math.min(1, MUSIC_CEIL * MUSIC_TRIM * musicVolume * musicVolume); }
  function initMusic(){
    if(musicEl || typeof Audio==='undefined') return;
    try{
      musicEl = new Audio();
      musicEl.loop = true;
      musicEl.preload = 'auto';
      musicEl.volume = 0;
      musicEl.addEventListener('loadedmetadata', ()=>{
        musicAvailable = true;
        musicRow.classList.remove('hidden');
        if(musicStarted) syncMusic();
      });
      musicEl.addEventListener('error', ()=>{
        musicFileIdx++;
        if(musicFileIdx < MUSIC_FILES.length){ musicEl.src = ASSET + 'music/' + MUSIC_FILES[musicFileIdx]; }
        else { musicAvailable = false; musicRow.classList.add('hidden'); }
      });
      musicEl.src = ASSET + 'music/' + MUSIC_FILES[0];
    }catch(e){ musicEl = null; }
  }
  function fadeMusicTo(target, ms){
    if(!musicEl) return;
    if(musicFade){ clearInterval(musicFade); musicFade = null; }
    const from = musicEl.volume, steps = Math.max(1, Math.round(ms/40));
    let i = 0;
    musicFade = setInterval(()=>{
      i++;
      try{ musicEl.volume = Math.min(1, Math.max(0, from + (target-from)*(i/steps))); }catch(e){}
      if(i>=steps){ clearInterval(musicFade); musicFade = null; if(target<=0) try{ musicEl.pause(); }catch(e){} }
    }, 40);
  }
  function syncMusic(){                          // deja la pista sonando (o en pausa) según volumen y visibilidad de la app
    if(!musicEl || !musicAvailable) return;
    const level = musicLevel();
    if(level<=0 || document.hidden){ fadeMusicTo(0, 250); return; }
    if(musicEl.paused){
      const p = musicEl.play();
      if(p && p.catch) p.catch(()=>{ musicStarted = false; });   // el navegador pidió otro toque: se reintenta en el próximo
    }
    fadeMusicTo(level, 700);
  }
  function startMusic(){
    initMusic();
    if(musicStarted) return;
    musicStarted = true;
    syncMusic();
  }
  function setMusicVolume(v){
    musicVolume = Math.min(1, Math.max(0, v));
    writePref('quoridor_music', musicVolume);
    if(!musicEl) return;
    if(musicFade){ clearInterval(musicFade); musicFade = null; }
    if(musicLevel()<=0){ try{ musicEl.volume = 0; musicEl.pause(); }catch(e){} return; }
    try{ musicEl.volume = musicLevel(); }catch(e){}
    if(musicEl.paused && musicStarted) syncMusic();
  }
  document.addEventListener('visibilitychange', ()=>{ if(musicStarted) syncMusic(); });
  initMusic();

  function unlockAudio(){
    startMusic();
    const ctx = getAudioCtx();
    if(!ctx) return;
    if(ctx.state==='suspended'){ try{ ctx.resume(); }catch(e){} }
    loadSfxBuffers();
  }
  ['pointerdown','keydown','touchstart'].forEach(ev=> document.addEventListener(ev, unlockAudio, { passive:true }));
  function setSfxVolume(v){
    sfxVolume = Math.min(1, Math.max(0, v));
    writePref('quoridor_sfx', sfxVolume);
    if(masterGain) masterGain.gain.value = sfxVolume;
  }
  function playSfx(name, fallback){
    if(sfxVolume<=0) return;
    const ctx = getAudioCtx();
    if(!ctx) return;
    if(ctx.state==='suspended'){ try{ ctx.resume(); }catch(e){} }
    const buf = sfxBuffers[name];
    if(buf && masterGain){
      try{ const src = ctx.createBufferSource(); src.buffer = buf; src.connect(masterGain); src.start(); }catch(e){}
    } else if(fallback){
      fallback();
    }
  }
  function playTone(freq, duration, type, gainStart){
    if(sfxVolume<=0) return;
    const ctx = getAudioCtx();
    if(!ctx || !masterGain) return;
    if(ctx.state==='suspended'){ try{ ctx.resume(); }catch(e){} }
    try{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainStart!=null ? gainStart : 0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain).connect(masterGain);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }catch(e){}
  }
  function playMoveSound(){ if(HEADLESS) return; playSfx('tap', ()=> playTone(440, 0.09, 'sine', 0.14)); }
  function playWallSound(){ if(HEADLESS) return; playSfx('wall', ()=> playTone(170, 0.15, 'square', 0.15)); }
  function playUiClick(){ playSfx('click', ()=> playTone(660, 0.04, 'sine', 0.07)); }
  function playToggleSound(on){ playSfx(on ? 'on' : 'off', ()=> playTone(on ? 720 : 520, 0.05, 'sine', 0.08)); }
  function playWinSound(){
    if(sfxVolume<=0) return;
    [523.25,659.25,783.99].forEach((f,i)=>{ setTimeout(()=> playTone(f, 0.24, 'triangle', 0.17), i*110); });
  }
  function playCoinSound(){                       // el kit no trae sonido de monedas: sigue sintetizado
    if(sfxVolume<=0) return;
    playTone(988, 0.09, 'square', 0.08);
    setTimeout(()=> playTone(1319, 0.18, 'square', 0.08), 80);
  }
  function vibrate(pattern){
    if(HEADLESS) return;
    if(!vibrateOn) return;
    try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){}
  }
  // sonido de UI para todo botón del kit y para interruptores
  document.addEventListener('click', e=>{
    const b = e.target.closest && e.target.closest('.kbtn');
    if(b && !b.disabled) playUiClick();
  });
  document.addEventListener('change', e=>{
    const t = e.target;
    if(t && t.matches && t.matches('input[type=checkbox], input[type=radio]')) playToggleSound(t.type==='radio' ? true : t.checked);
  });

  // ---------- estadísticas locales ----------
  function blankStats(){
    return {
      totalGames:0, winsBySlot:[0,0,0,0], streak:{slot:null,count:0}, vsCpu:{played:0,won:0},
      vsCpuHardWon:0, vsCpuNormalWon:0, winsWith4:0,
      modesPlayed:{ official:0, fog:0, teams:0, party:0, maze:0, blitz:0, mirror:0, hill:0, hunter:0 },
      modeWins:{ official:0, fog:0, teams:0, party:0, maze:0, blitz:0, mirror:0, hill:0, hunter:0 },
      sizeWins:{5:0,7:0,9:0,11:0},
      noWallWins:0, allWallsUsedWins:0,
      fastestWinMoves:null, longestGameMoves:0, totalWallsPlaced:0,
      daily:{ lastDate:null, streak:0, bestStreak:0, completedCount:0, bestMoves:{}, history:{}, shielded:{}, shields:0, shieldsUsed:0 },
      customLevelsPlayed:0, skinsCustomized:false, partyStuns:0,
      hunterCaptures:0, hunterEscapes:0,
      seat:{},
      achievementsUnlocked:[],
      recentVsCpu:[],
    };
  }
  function loadStats(){
    const base = blankStats();
    try{
      const raw = localStorage.getItem('quoridor_stats');
      if(raw){
        const parsed = JSON.parse(raw) || {};
        base.totalGames = parsed.totalGames || 0;
        base.winsBySlot = Array.isArray(parsed.winsBySlot) ? [0,1,2,3].map(i=> parsed.winsBySlot[i]||0) : base.winsBySlot;
        base.streak = (parsed.streak && typeof parsed.streak.count==='number') ? parsed.streak : base.streak;
        base.vsCpu = parsed.vsCpu || base.vsCpu;
        base.vsCpuHardWon = parsed.vsCpuHardWon || 0;
        base.vsCpuNormalWon = parsed.vsCpuNormalWon || 0;
        base.winsWith4 = parsed.winsWith4 || 0;
        base.modesPlayed = Object.assign(base.modesPlayed, parsed.modesPlayed||{});
        base.modeWins = Object.assign(base.modeWins, parsed.modeWins||{});
        base.sizeWins = Object.assign(base.sizeWins, parsed.sizeWins||{});
        base.noWallWins = parsed.noWallWins || 0;
        base.allWallsUsedWins = parsed.allWallsUsedWins || 0;
        base.fastestWinMoves = (typeof parsed.fastestWinMoves==='number') ? parsed.fastestWinMoves : null;
        base.longestGameMoves = parsed.longestGameMoves || 0;
        base.totalWallsPlaced = parsed.totalWallsPlaced || 0;
        base.daily = Object.assign(base.daily, parsed.daily||{});
        base.daily.bestMoves = Object.assign({}, parsed.daily && parsed.daily.bestMoves);
        base.daily.history = Object.assign({}, parsed.daily && parsed.daily.history);
        base.daily.shielded = Object.assign({}, parsed.daily && parsed.daily.shielded);
        base.daily.shields = Math.max(0, Math.min(DAILY_SHIELD_MAX, +base.daily.shields || 0));
        base.daily.shieldsUsed = Math.max(0, +base.daily.shieldsUsed || 0);
        base.customLevelsPlayed = parsed.customLevelsPlayed || 0;
        base.skinsCustomized = !!parsed.skinsCustomized;
        base.partyStuns = parsed.partyStuns || 0;
        base.hunterCaptures = parsed.hunterCaptures || 0;
        base.hunterEscapes = parsed.hunterEscapes || 0;
        base.seat = (parsed.seat && typeof parsed.seat==='object') ? parsed.seat : {};
        base.achievementsUnlocked = Array.isArray(parsed.achievementsUnlocked) ? parsed.achievementsUnlocked : [];
        base.recentVsCpu = Array.isArray(parsed.recentVsCpu) ? parsed.recentVsCpu.slice(-5).map(v=> v?1:0) : [];
      }
    }catch(e){}
    return base;
  }
  function saveStats(){ try{ localStorage.setItem('quoridor_stats', JSON.stringify(statsData)); }catch(e){} }
  let statsData = loadStats();

  function recordGameResult(summary, opts){
    const winnerSlot = summary.winnerSlot;
    statsData.totalGames += 1;
    statsData.winsBySlot[winnerSlot] = (statsData.winsBySlot[winnerSlot]||0) + 1;
    if(statsData.streak.slot === winnerSlot) statsData.streak.count += 1;
    else { statsData.streak.slot = winnerSlot; statsData.streak.count = 1; }
    if(summary.isCpuGame){
      statsData.vsCpu.played += 1;
      if(!summary.campaign){
        statsData.recentVsCpu = (statsData.recentVsCpu||[]).concat(winnerSlot===0 ? 1 : 0).slice(-5);
        if(summary.adaptive) updateAdaptiveAfterGame();
      }
      if(winnerSlot === 0){
        statsData.vsCpu.won += 1;
        if(summary.cpuDifficulty==='hard' || summary.cpuDifficulty==='expert') statsData.vsCpuHardWon += 1;
        if(summary.cpuDifficulty==='hard' || summary.cpuDifficulty==='normal' || summary.cpuDifficulty==='expert') statsData.vsCpuNormalWon += 1;
      }
    }
    if(summary.playersCount===4) statsData.winsWith4 += 1;
    if(summary.ruleset && summary.ruleset!=='classic'){
      statsData.modeWins[summary.ruleset] = (statsData.modeWins[summary.ruleset]||0) + 1;
    }
    if(summary.size && statsData.sizeWins[summary.size]!=null) statsData.sizeWins[summary.size] += 1;
    if(summary.wallsUsedByWinner===0) statsData.noWallWins += 1;
    if(summary.wallsUsedByWinner!=null && summary.wallsUsedByWinner>=summary.wallsStart) statsData.allWallsUsedWins += 1;
    if(typeof summary.movesUsed==='number'){
      if(statsData.fastestWinMoves==null || summary.movesUsed<statsData.fastestWinMoves) statsData.fastestWinMoves = summary.movesUsed;
    }
    if(typeof summary.totalMovesThisGame==='number' && summary.totalMovesThisGame>statsData.longestGameMoves){
      statsData.longestGameMoves = summary.totalMovesThisGame;
    }
    statsData.totalWallsPlaced += (summary.wallsPlacedThisGame||0);
    if(summary.seatInfo){
      // medición por asiento (62): cuántas veces ganó quien abrió y cuántas cada asiento, por modo y cantidad de jugadores
      const k = summary.ruleset+':'+summary.playersCount;
      const sd = statsData.seat[k] || (statsData.seat[k] = { games:0, firstWins:0, bySeat:[0,0,0,0] });
      sd.games += 1;
      if(summary.seatInfo.winnerSeat===summary.seatInfo.firstIdx) sd.firstWins += 1;
      sd.bySeat[summary.seatInfo.winnerSeat] = (sd.bySeat[summary.seatInfo.winnerSeat]||0) + 1;
    }
    if(summary.capturedByHuman) statsData.hunterCaptures += 1;   // capturas hechas por un cazador humano (para logros propios)
    if(summary.escapedByHuman) statsData.hunterEscapes += 1;     // escapes de un fugitivo humano
    saveStats();
    return checkAchievements(opts);
  }
  function recordModePlayed(ruleset){
    if(!ruleset || ruleset==='classic') return;
    statsData.modesPlayed[ruleset] = (statsData.modesPlayed[ruleset]||0) + 1;
    saveStats();
  }
  // Registra un desafío resuelto de la fecha `dateKey` (la del desafío que se jugó, no la de «ahora»).
  // Devuelve cómo quedó la racha: si hubo días protegidos por escudo y si se ganó uno nuevo.
  function recordDailyResult(dateKey, movesUsed, par, info){
    info = info || {};
    const d = statsData.daily;
    const isFirst = !isDailyDone(d, dateKey);
    const out = { firstToday:isFirst, protectedDays:[], earnedShield:false, shieldCapped:false, broken:false };
    if(isFirst){
      d.completedCount += 1;
      if(!d.lastDate || dayKeyDiff(d.lastDate, dateKey) > 0){     // sólo si es más nuevo que el último día resuelto
        if(!d.lastDate){ d.streak = 1; }
        else {
          const gap = dayKeyDiff(d.lastDate, dateKey), missed = gap-1;
          if(missed<=0){ d.streak += 1; }
          else if(missed <= (d.shields||0)){                       // los escudos cubren todos los días perdidos
            for(let i=1;i<=missed;i++){ const k = dayKeyAdd(d.lastDate, i); d.shielded[k] = true; out.protectedDays.push(k); }
            d.shields -= missed; d.shieldsUsed = (d.shieldsUsed||0) + missed;
            d.streak += 1;
          } else { out.broken = d.streak>0; d.streak = 1; }        // no alcanzan: se corta
        }
        d.lastDate = dateKey;
        d.bestStreak = Math.max(d.bestStreak, d.streak);
        if(d.streak % DAILY_SHIELD_EVERY === 0){
          if((d.shields||0) < DAILY_SHIELD_MAX){ d.shields = (d.shields||0) + 1; out.earnedShield = true; }
          else out.shieldCapped = true;
        }
      }
    }
    const prev = d.history[dateKey];
    if(!prev || movesUsed < prev.moves){
      d.history[dateKey] = { moves:movesUsed, par, stars:info.stars||0, mode:info.mode||null, size:info.size||null, timeouts:info.timeouts||0 };
    }
    if(d.bestMoves[dateKey]==null || movesUsed < d.bestMoves[dateKey]) d.bestMoves[dateKey] = movesUsed;
    saveStats();
    const fresh = checkAchievements({ toast:false });
    out.streak = d.streak; out.shields = d.shields; out.fresh = fresh;
    return out;
  }
  function recordSkinCustomized(){
    if(statsData.skinsCustomized) return;
    statsData.skinsCustomized = true;
    saveStats();
    checkAchievements();
  }
  function recordCustomLevelPlayed(){
    statsData.customLevelsPlayed += 1;
    saveStats();
    checkAchievements();
  }
  function recordPartyStun(){
    statsData.partyStuns += 1;
    saveStats();
  }

  // ---------- billetera (monedas e inventario): clave propia, no se borra con "Reiniciar estadísticas" ----------
  const WALLET_KEY = 'quoridor_wallet';
  const WALLET_BAK_KEY = 'quoridor_wallet_bak';
  const WALLET_VERSION = 2;
  const WALLET_SALT = 'qdr-w4ll3t-s4l-v2';        // sal del hash: va en el código, así que sólo frena ediciones casuales
  const COIN_SANITY_MAX = 50000;                  // más que esto no se puede haber juntado jugando
  const LEGACY_COIN_MAX = 5000;                   // billeteras viejas (sin firma) con más monedas se consideran alteradas

  // ---------- 140 · integridad: SHA-256 sincrónico + firma con sal ----------
  const sha256Hex = (function(){
    const K = [], H0 = [];
    let n = 0;
    for(let c=2; n<64; c++){
      let prime = true;
      for(let d=2; d*d<=c; d++){ if(c%d===0){ prime = false; break; } }
      if(!prime) continue;
      if(n<8) H0[n] = (Math.pow(c, 1/2) % 1) * 4294967296 | 0;
      K[n++] = (Math.pow(c, 1/3) % 1) * 4294967296 | 0;
    }
    const rotr = (x, s)=> (x>>>s) | (x<<(32-s));
    return function(str){
      const b = new TextEncoder().encode(str), len = b.length;
      const total = ((len + 9 + 63) >> 6) << 6;
      const buf = new Uint8Array(total);
      buf.set(b); buf[len] = 0x80;
      const dv = new DataView(buf.buffer);
      dv.setUint32(total-8, Math.floor(len*8 / 4294967296));
      dv.setUint32(total-4, (len*8) >>> 0);
      const h = H0.slice(), w = new Array(64);
      for(let o=0; o<total; o+=64){
        for(let i=0;i<16;i++) w[i] = dv.getUint32(o + i*4);
        for(let i=16;i<64;i++){
          const s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15]>>>3);
          const s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2]>>>10);
          w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
        }
        let a=h[0], bb=h[1], c=h[2], d=h[3], e=h[4], f=h[5], g=h[6], hh=h[7];
        for(let i=0;i<64;i++){
          const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25), ch = (e&f) ^ (~e&g);
          const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
          const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22), mj = (a&bb) ^ (a&c) ^ (bb&c);
          const t2 = (S0 + mj) | 0;
          hh=g; g=f; f=e; e=(d+t1)|0; d=c; c=bb; bb=a; a=(t1+t2)|0;
        }
        h[0]=(h[0]+a)|0; h[1]=(h[1]+bb)|0; h[2]=(h[2]+c)|0; h[3]=(h[3]+d)|0;
        h[4]=(h[4]+e)|0; h[5]=(h[5]+f)|0; h[6]=(h[6]+g)|0; h[7]=(h[7]+hh)|0;
      }
      return h.map(x=> (x>>>0).toString(16).padStart(8,'0')).join('');
    };
  })();
  function stableStringify(v){
    if(v===null || typeof v!=='object') return JSON.stringify(v);
    if(Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(v).sort().map(k=> JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  }
  function sealOf(body){ return sha256Hex(WALLET_SALT + '|' + stableStringify(body) + '|' + WALLET_SALT); }
  // 'ok' firma válida · 'legacy' sin firma de una versión vieja · 'bad' firma que no coincide · 'none' no hay nada
  function checkSeal(raw){
    if(!raw || typeof raw!=='object') return 'none';
    if(typeof raw.sig!=='string') return (raw.v||1) < 2 ? 'legacy' : 'bad';
    const body = Object.assign({}, raw); delete body.sig;
    return sealOf(body) === raw.sig ? 'ok' : 'bad';
  }
  function signed(obj){
    const body = JSON.parse(JSON.stringify(obj));    // ida y vuelta por JSON: lo mismo que se va a leer después
    delete body.sig;
    body.sig = sealOf(body);
    return JSON.stringify(body);
  }
  // Si la app corre dentro de Android, el saldo vive en preferencias nativas (AndroidWallet.getWallet/setWallet) y
  // localStorage queda de espejo. En el navegador se usa sólo localStorage.
  function walletRead(){
    try{
      if(window.AndroidWallet && typeof window.AndroidWallet.getWallet==='function'){
        const s = window.AndroidWallet.getWallet();
        if(s) return JSON.parse(s);
      }
    }catch(e){}
    try{ return JSON.parse(localStorage.getItem(WALLET_KEY) || 'null'); }catch(e){ return null; }
  }
  function walletBackupRead(){
    try{ return JSON.parse(localStorage.getItem(WALLET_BAK_KEY) || 'null'); }catch(e){ return null; }
  }
  let walletTamperNotice = false;
  function defaultWallet(isNew){
    return {
      v: WALLET_VERSION, coins: 0,
      owned: { e_faceHappy:1, e_laugh:1, fr_f1:1, th_clasico:1 },
      equipped: { emotes:['faceHappy','laugh',null,null], frame:'f1', theme:'clasico' },
      claimed: {}, earned: { date:null, games:0 }, dailyPaid: null, shopSeen: 0,
      firstSeen: isNew ? Date.now() : 0, welcomeShown: false,
    };
  }
  function loadWallet(){
    let raw = walletRead();
    let seal = checkSeal(raw);
    const coinsOk = r=> typeof r.coins==='number' && r.coins>=0 && r.coins<=COIN_SANITY_MAX;
    if(seal==='bad'){
      walletTamperNotice = true;                       // firma rota: se vuelve al último estado firmado, si hay
      raw = walletBackupRead(); seal = checkSeal(raw);
      if(seal!=='ok' || !coinsOk(raw)) raw = null;
    } else if(seal==='legacy'){
      if(!(typeof raw.coins==='number' && raw.coins>=0 && raw.coins<=LEGACY_COIN_MAX)){ walletTamperNotice = true; raw = null; }
    } else if(seal==='ok'){
      if(!coinsOk(raw)){ walletTamperNotice = true; raw = null; }
    } else raw = null;
    const w = defaultWallet(!raw);
    if(raw){
      if(typeof raw.coins==='number' && raw.coins>0) w.coins = Math.floor(raw.coins);
      if(raw.owned && typeof raw.owned==='object') Object.keys(raw.owned).forEach(id=>{ if(raw.owned[id] && itemById(id)) w.owned[id] = 1; });
      if(raw.equipped){
        if(Array.isArray(raw.equipped.emotes)) w.equipped.emotes = [0,1,2,3].map(i=> raw.equipped.emotes[i] || null);
        if(typeof raw.equipped.frame==='string' && FRAME_IDS.indexOf(raw.equipped.frame)!==-1) w.equipped.frame = raw.equipped.frame;
        if(typeof raw.equipped.theme==='string') w.equipped.theme = raw.equipped.theme;
      }
      if(raw.claimed && typeof raw.claimed==='object') w.claimed = raw.claimed;
      if(raw.earned && typeof raw.earned==='object') w.earned = Object.assign(w.earned, raw.earned);
      w.dailyPaid = raw.dailyPaid || null;
      w.shopSeen = raw.shopSeen || 0;
      w.firstSeen = typeof raw.firstSeen==='number' ? raw.firstSeen : 0;   // billetera vieja: no es primera sesión
      w.welcomeShown = !!raw.welcomeShown;
    }
    // solo pueden estar equipados emotes, globos y tableros que sean tuyos
    w.equipped.emotes = w.equipped.emotes.map(id=> (id && w.owned['e_'+id]) ? id : null);
    if(!w.owned['fr_'+w.equipped.frame]) w.equipped.frame = 'f1';
    if(!w.owned['th_'+w.equipped.theme]) w.equipped.theme = 'clasico';
    return w;
  }
  let wallet = loadWallet();
  function saveWallet(){
    const text = signed(wallet);
    try{                                               // copia del estado firmado anterior, para recuperar si alguien edita
      const prev = localStorage.getItem(WALLET_KEY);
      if(prev && checkSeal(JSON.parse(prev))==='ok') localStorage.setItem(WALLET_BAK_KEY, prev);
    }catch(e){}
    try{ localStorage.setItem(WALLET_KEY, text); }catch(e){}
    try{ if(window.AndroidWallet && typeof window.AndroidWallet.setWallet==='function') window.AndroidWallet.setWallet(text); }catch(e){}
  }

  // ---------- 138/139 · entitlements: { premium, unlocks:{ clave: expira } } (firmados igual que la billetera) ----------
  const ENT_KEY = 'quoridor_entitlements';
  let entTamperNotice = false;
  function defaultEnt(){ return { v:1, premium:false, premiumVerifiedAt:0, premiumToken:'', unlocks:{}, lastSeen:0 }; }
  function loadEnt(){
    const e = defaultEnt();
    try{
      const raw = JSON.parse(localStorage.getItem(ENT_KEY) || 'null');
      if(raw && typeof raw==='object'){
        if(checkSeal(raw)!=='ok'){ entTamperNotice = true; return e; }
        e.premium = raw.premium===true;
        e.premiumVerifiedAt = typeof raw.premiumVerifiedAt==='number' ? raw.premiumVerifiedAt : 0;
        e.premiumToken = typeof raw.premiumToken==='string' ? raw.premiumToken.slice(0, 4096) : '';
        e.lastSeen = typeof raw.lastSeen==='number' ? raw.lastSeen : 0;
        if(raw.unlocks && typeof raw.unlocks==='object') Object.keys(raw.unlocks).forEach(k=>{ if(typeof raw.unlocks[k]==='number') e.unlocks[k] = raw.unlocks[k]; });
      }
    }catch(err){}
    return e;
  }
  let entitlements = loadEnt();
  let premiumSessionOk = false;                    // true sólo si Play confirmó la compra en ESTA sesión
  function saveEnt(){ try{ localStorage.setItem(ENT_KEY, signed(entitlements)); }catch(e){} }
  function isGatedFeature(f){
    if(f.indexOf('mode:')===0) return LOCKED_MODES.indexOf(f.slice(5))!==-1;
    if(f.indexOf('skin:')===0) return Object.values(CAMPAIGN_SHAPE_UNLOCKS).indexOf(f.slice(5))!==-1;
    return false;
  }
  function pruneEntitlements(){
    const t = Date.now(), e = entitlements;
    let dirty = false;
    if(t < e.lastSeen - CLOCK_BACK_TOL_MS){          // reloj atrasado: los desbloqueos temporales y la gracia offline se anulan
      if(Object.keys(e.unlocks).length || e.premiumVerifiedAt){ e.unlocks = {}; e.premiumVerifiedAt = 0; dirty = true; }
    } else if(t > e.lastSeen + 60000){ e.lastSeen = t; dirty = true; }
    Object.keys(e.unlocks).forEach(k=>{ if(!(e.unlocks[k] > t)){ delete e.unlocks[k]; dirty = true; } });
    if(dirty) saveEnt();
  }
  function premiumActive(){
    pruneEntitlements();
    const e = entitlements;
    if(!e.premium) return false;
    if(premiumSessionOk) return true;
    return e.premiumVerifiedAt > 0 && (Date.now() - e.premiumVerifiedAt) < PREMIUM_GRACE_MS;
  }
  // isUnlocked('premium') · isUnlocked('mode:party') · isUnlocked('skin:star'). Lo que no está bloqueado siempre da true.
  function isUnlocked(feature){
    if(feature==='premium') return premiumActive();
    if(!isGatedFeature(feature)) return true;
    if(premiumActive()) return true;
    pruneEntitlements();
    return (entitlements.unlocks[feature] || 0) > Date.now();
  }
  function grantUnlock(feature, ms){
    entitlements.unlocks[feature] = Date.now() + (ms || AD_UNLOCK_MS);
    saveEnt();
  }
  function featureLabel(f){
    if(f.indexOf('mode:')===0) return (RULESETS[f.slice(5)] || {}).label || f;
    if(f.indexOf('skin:')===0) return 'Forma ' + (SHAPE_LABEL[f.slice(5)] || f.slice(5));
    return f;
  }

  // ---------- 138 · anuncio recompensado (puente AndroidAds) ----------
  // JS -> nativo:  AndroidAds.showRewarded(requestId, placement)
  // nativo -> JS:  window.onRewardedAdResult(requestId, status)   status: 'rewarded' | 'closed' | 'failed' | 'noFill'
  // La recompensa se da SÓLO con 'rewarded' y el requestId pendiente; el pedido se consume antes de pagar (un pago por anuncio).
  let adPending = null;
  function adsAvailable(){ return !!(window.AndroidAds && typeof window.AndroidAds.showRewarded==='function'); }
  function requestRewardedAd(placement, onGrant){
    if(adPending){ showToast('Ya hay un anuncio en curso.'); return false; }
    if(!adsAvailable()){ showToast('Los anuncios no están disponibles ahora.'); return false; }
    const id = 'ad' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    adPending = { id, placement, onGrant, timer: setTimeout(()=>{ if(adPending && adPending.id===id) adPending = null; }, AD_TIMEOUT_MS) };
    try{ window.AndroidAds.showRewarded(id, placement); }
    catch(e){ clearTimeout(adPending.timer); adPending = null; showToast('No se pudo mostrar el anuncio.'); return false; }
    return true;
  }
  window.onRewardedAdResult = function(id, status){
    const p = adPending;
    if(!p || p.id!==String(id)) return;              // respuesta vieja, repetida o inventada
    clearTimeout(p.timer); adPending = null;
    if(status==='rewarded') p.onGrant();
    else if(status==='noFill') showToast('No hay anuncios disponibles. Probá en un rato.');
    else if(status==='failed') showToast('No se pudo mostrar el anuncio.');
    else showToast('Cerraste el anuncio antes de tiempo: sin recompensa.');
  };
  // Pide el desbloqueo temporal de un modo o una forma: anuncio (30 min) o Premium.
  function offerUnlock(feature, onUnlocked){
    const label = featureLabel(feature);
    if(!adsAvailable()){ showToast('🔒 «' + escapeHtml(label) + '» es Premium. Lo conseguís desde la tienda de la app.'); return; }
    showConfirm('«' + label + '» está bloqueado. Mirá un anuncio y usalo ' + Math.round(AD_UNLOCK_MS/60000) + ' minutos, o conseguí Premium en la tienda.', ()=>{
      requestRewardedAd('unlock:' + feature, ()=>{
        grantUnlock(feature);
        showToast('🔓 «' + escapeHtml(label) + '» desbloqueado ' + Math.round(AD_UNLOCK_MS/60000) + ' min');
        if(onUnlocked) onUnlocked();
      });
    }, 'Ver anuncio');
  }
  // Duplicar las monedas de la victoria: se duplica LO YA PAGADO (después del tope diario) y una sola vez por partida.
  function doubleWinCoins(){
    const rw = state && state.lastReward;
    if(!rw || rw.doubled || !(rw.coins>0)) return;
    const grant = ()=>{
      if(rw.doubled) return;
      rw.doubled = true;
      const extra = rw.coins;
      addCoins(extra, { reason:'Monedas duplicadas' });
      rw.coins = extra * 2;
      const el = document.getElementById('winCoinCount');
      if(el) el.textContent = rw.coins;
      refreshWinDouble();
    };
    if(premiumActive()) grant(); else requestRewardedAd('double_win', grant);
  }
  function refreshWinDouble(){
    const rw = state && state.lastReward;
    const show = !!(rw && state.winner && rw.coins>0 && !rw.doubled && (adsAvailable() || premiumActive()));
    winDoubleBtn.classList.toggle('hidden', !show);
    if(show) winDoubleBtn.textContent = 'Duplicar monedas (+' + rw.coins + ')' + (premiumActive() ? '' : ' · ver anuncio');
  }
  winDoubleBtn.addEventListener('click', doubleWinCoins);

  // ---------- 139 · Premium: compra única con Play Billing (puente AndroidBilling) ----------
  // JS -> nativo:  AndroidBilling.purchase(productId) · AndroidBilling.queryPurchases()
  // nativo -> JS:  window.onBillingResult({ type:'purchase'|'restore'|'cancelled'|'error', complete?:bool,
  //                  purchases:[{ productId, state:'purchased'|'pending', token, verified:bool }] })
  // `verified:true` lo pone el lado nativo/servidor DESPUÉS de validar el token con Google Play (y confirmar la compra).
  // Un indicador local solo nunca alcanza: Premium cuenta sólo si Play lo confirma (o dentro de la gracia del último chequeo).
  let billingBusy = false;
  function billingAvailable(){ return !!(window.AndroidBilling && typeof window.AndroidBilling.purchase==='function'); }
  function setPremium(on, token){
    entitlements.premium = !!on;
    entitlements.premiumVerifiedAt = on ? Date.now() : 0;
    entitlements.premiumToken = on ? String(token || '').slice(0, 4096) : '';
    premiumSessionOk = !!on;
    saveEnt();
    if(typeof shopOverlay!=='undefined' && !shopOverlay.classList.contains('hidden')) renderShop();
    refreshWinDouble();
  }
  function buyPremium(){
    if(premiumActive()) return;
    if(!billingAvailable()){ showToast('Premium se compra desde la app de Google Play.'); return; }
    if(billingBusy) return;
    billingBusy = true;
    setTimeout(()=>{ billingBusy = false; }, 60000);
    try{ window.AndroidBilling.purchase(PREMIUM_PRODUCT_ID); }
    catch(e){ billingBusy = false; showToast('No se pudo iniciar la compra.'); }
  }
  function restorePurchases(){
    if(!billingAvailable() || typeof window.AndroidBilling.queryPurchases!=='function'){ showToast('Restaurar compras sólo funciona en la app de Google Play.'); return; }
    try{ window.AndroidBilling.queryPurchases(); showToast('Buscando tus compras…'); }
    catch(e){ showToast('No se pudo consultar Google Play.'); }
  }
  window.onBillingResult = function(res){
    try{ if(typeof res==='string') res = JSON.parse(res); }catch(e){ return; }
    if(!res || typeof res!=='object') return;
    billingBusy = false;
    if(res.type==='cancelled') return;
    if(res.type==='error' || res.error){ showToast('No se pudo completar la operación con Google Play.'); return; }
    const list = Array.isArray(res.purchases) ? res.purchases : [];
    const mine = list.filter(p=> p && p.productId===PREMIUM_PRODUCT_ID);
    const ok = mine.find(p=> p.state==='purchased' && p.verified===true && typeof p.token==='string' && p.token);
    if(ok){
      const was = premiumActive();
      setPremium(true, ok.token);
      if(!was) showToast('⭐ ¡Premium activado!');
    } else if(mine.some(p=> p.state==='pending')){
      showToast('Compra pendiente: se activa cuando se confirme el pago.');
    } else if(res.type==='restore' && res.complete===true && entitlements.premium){
      setPremium(false);                              // Play ya no la reconoce (reembolso o cuenta distinta)
      showToast('Premium ya no figura en tu cuenta de Google Play.');
    } else if(res.type==='restore' && !billingSilentRestore){
      showToast('No encontramos compras para restaurar.');
    }
    if(res.type==='restore') billingSilentRestore = false;
  };
  let billingSilentRestore = false;                 // la consulta de arranque no muestra avisos si no hay nada
  function itemById(id){ return SHOP_ITEMS.find(it=> it.id===id) || null; }
  function ownsItem(it){ return !!wallet.owned[it.id]; }
  function isEquipped(it){
    if(it.type==='emote') return wallet.equipped.emotes.indexOf(it.icon)!==-1;
    if(it.type==='theme') return wallet.equipped.theme===it.theme;
    if(it.type==='pack') return false;
    return wallet.equipped.frame===it.frame;
  }
  function earnedToday(){ return wallet.earned && wallet.earned.date===todayKey() ? (wallet.earned.games||0) : 0; }

  // toasts (logros, monedas): una sola cola
  let toastQueue = [];
  let toastShowing = false;
  function showToast(html){
    if(HEADLESS) return;
    toastQueue.push(html);
    if(!toastShowing) advanceToastQueue();
  }
  function advanceToastQueue(){
    if(!toastQueue.length){ toastShowing = false; return; }
    toastShowing = true;
    achievementToast.innerHTML = toastQueue.shift();
    achievementToast.classList.add('show');
    setTimeout(()=>{
      achievementToast.classList.remove('show');
      setTimeout(advanceToastQueue, 260);
    }, 2400);
  }
  function showAchievementToasts(list){
    list.forEach(a=> showToast(`<img src="${medalSrc(a.medal)}" alt="">Nuevo trofeo: ${escapeHtml(a.name)}`));
  }

  // monedas
  const coinChip = document.getElementById('coinChip');
  const coinCountEl = document.getElementById('coinCount');
  const shopCoinsEl = document.getElementById('shopCoins');
  let shownCoins = null;
  function countUp(el, from, to, ms){
    if(!el) return;
    const t0 = performance.now();
    function step(now){
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = Math.round(from + (to - from) * k);
      if(k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function updateCoinUI(animate){
    const target = wallet.coins;
    if(animate && shownCoins!=null && shownCoins!==target){
      countUp(coinCountEl, shownCoins, target, 700);
      countUp(shopCoinsEl, shownCoins, target, 700);
      coinChip.classList.remove('bump'); void coinChip.offsetWidth; coinChip.classList.add('bump');
    } else {
      coinCountEl.textContent = target;
      shopCoinsEl.textContent = target;
    }
    shownCoins = target;
  }
  function addCoins(amount, opts){
    opts = opts || {};
    amount = Math.floor(amount);
    if(!amount || !isFinite(amount)) return;
    wallet.coins = Math.min(COIN_SANITY_MAX, Math.max(0, wallet.coins + amount));
    saveWallet();
    updateCoinUI(true);
    if(!opts.silent){
      playCoinSound();
      showToast(`<img src="${emoteIconSrc('cash')}" alt="">+${amount}${opts.reason ? ' · ' + escapeHtml(opts.reason) : ''}`);
    }
    updateBadges();
  }
  function award(reason, amount, opts){ addCoins(amount, Object.assign({ reason }, opts||{})); }

  // puntos rojos del menú
  const trophyBadge = document.getElementById('trophyBadge');
  const shopBadge = document.getElementById('shopBadge');
  const dailyReadyChip = document.getElementById('dailyReadyChip');
  function pendingClaims(){
    return ACHIEVEMENTS.filter(a=> statsData.achievementsUnlocked.indexOf(a.id)!==-1 && !wallet.claimed[a.id]).length;
  }
  function affordableItems(){ return SHOP_ITEMS.filter(it=> it.type!=='pack' && shopVisible(it) && !ownsItem(it) && it.price<=wallet.coins).length; }
  function setBadge(el, n){
    el.textContent = n > 9 ? '9+' : String(n);
    el.classList.toggle('hidden', !(n>0));
  }
  function updateBadges(){
    setBadge(trophyBadge, pendingClaims());
    setBadge(shopBadge, (wallet.coins > wallet.shopSeen ? affordableItems() : 0) + (welcomeClaimable() ? 1 : 0));
    dailyReadyChip.classList.toggle('hidden', isDailyDone(statsData.daily, utcDayKey()));
  }

  // ---------- emotes: dibujo (globo + ícono componen en runtime: 7 globos × 29 íconos sin repetir archivos) ----------
  function currentFrame(){ return wallet.equipped.frame || 'f1'; }
  function emoteHTML(iconId, frameId, widthPx){
    const nf = frameId==='none';
    return `<span class="emo${nf ? ' noframe' : ''}" style="width:${widthPx}px">${nf ? '' : `<img class="emo-frame" src="${frameSrc(frameId)}" alt="">`}<img class="emo-icon" src="${emoteIconSrc(iconId)}" alt=""></span>`;
  }
  // coordenadas locales del globo: 40×50, cuerpo en (4,4)-(36,36), punta de la cola en (20,42). Al voltearlo la cola queda arriba (punta en (20,8)).
  function emoteSvgInner(iconId, frameId, flip){
    const nf = frameId==='none';
    const frame = nf ? '' : `<image href="${frameSrc(frameId)}" x="0" y="0" width="40" height="50"${flip ? ' transform="translate(0 50) scale(1 -1)"' : ''}/>`;
    return frame + `<image href="${emoteIconSrc(iconId)}" x="4" y="${flip ? 14 : 4}" width="32" height="32"/>`;
  }

  const emotesEl = document.getElementById('emotesGroup');
  let activeEmotes = {};
  let emoteCooldown = {};
  let thinkingEntry = null;
  function emoteGeometry(pid){
    const cs = cellSize();
    const p = state.players[pid];
    const cx = (p.c + 0.5) * cs, cy = (p.r + 0.5) * cs;
    const W = Math.max(52, Math.min(90, cs * 1.25));
    const k = W / 40;
    const tipAbove = cy - cs * 0.30;
    const flip = (tipAbove - 42 * k) < -6;          // en la fila 0 (y cerca) no entra arriba: se voltea hacia abajo
    return { k, flip, tx: cx - 20 * k, ty: flip ? (cy + cs * 0.30) - 8 * k : tipAbove - 42 * k };
  }
  function positionEmote(entry){
    if(!state || entry.game!==state || !state.players[entry.pid]){ removeEmote(entry); return; }
    const g = emoteGeometry(entry.pid);
    entry.wrap.setAttribute('transform', `translate(${g.tx.toFixed(1)} ${g.ty.toFixed(1)}) scale(${g.k.toFixed(3)})`);
    if(entry.flip!==g.flip){
      entry.flip = g.flip;
      entry.inner.innerHTML = emoteSvgInner(entry.iconId, entry.frame, g.flip);
      entry.inner.setAttribute('class', 'emo-pop' + (g.flip ? ' flip' : '') + (entry.persist ? ' persist' : ''));
      entry.inner.style.setProperty('--dir', g.flip ? '-1' : '1');
    }
  }
  function removeEmote(entry){
    if(!entry) return;
    clearTimeout(entry.timer);
    if(entry.cycle) clearInterval(entry.cycle);
    if(entry.wrap.parentNode) entry.wrap.parentNode.removeChild(entry.wrap);
    if(activeEmotes[entry.pid]===entry) delete activeEmotes[entry.pid];
    if(thinkingEntry===entry) thinkingEntry = null;
  }
  function clearEmotes(){
    Object.keys(activeEmotes).forEach(k=> removeEmote(activeEmotes[k]));
    activeEmotes = {}; emoteCooldown = {}; thinkingEntry = null;
    emotesEl.innerHTML = '';
  }
  function renderEmotes(){ Object.keys(activeEmotes).forEach(k=> positionEmote(activeEmotes[k])); }
  function showEmote(pid, iconId, opts){
    opts = opts || {};
    if(!state || !state.players[pid]) return null;
    removeEmote(activeEmotes[pid]);
    const wrap = document.createElementNS(SVGNS, 'g');
    const inner = document.createElementNS(SVGNS, 'g');
    wrap.appendChild(inner);
    emotesEl.appendChild(wrap);
    const entry = { pid, iconId, frame: opts.frame || currentFrame(), wrap, inner, flip:null, game:state, persist:!!opts.persist, timer:null, cycle:null };
    activeEmotes[pid] = entry;
    positionEmote(entry);
    if(!opts.persist) entry.timer = setTimeout(()=> removeEmote(entry), EMOTE_LIFE_MS);
    return entry;
  }
  function startThinking(pid){
    if(thinkingEntry || activeEmotes[pid]) return;    // si la IA está mostrando una reacción, no la pisa
    const e = showEmote(pid, 'dots1', { persist:true, frame:'f5' });
    if(!e) return;
    thinkingEntry = e;
    let n = 1;
    e.cycle = setInterval(()=>{
      n = (n % 3) + 1;
      e.iconId = 'dots' + n;
      const imgs = e.inner.querySelectorAll('image');
      if(imgs.length) imgs[imgs.length-1].setAttribute('href', emoteIconSrc(e.iconId));
    }, 350);
  }
  function stopThinking(){ if(thinkingEntry) removeEmote(thinkingEntry); }
  // reacción de la IA con enfriamiento largo para que no fastidie
  function cpuReact(iconId, force){
    if(!state || !state.isCpuGame || !state.players[1]) return;
    const now = Date.now();
    if(!force && (emoteCooldown[1]||0) > now) return;
    emoteCooldown[1] = now + CPU_EMOTE_COOLDOWN_MS;
    stopThinking();
    showEmote(1, iconId);
  }
  function sendEmote(pid, iconId){
    if(!state || state.winner || !state.players[pid] || state.players[pid].isCPU) return false;
    const now = Date.now();
    if((emoteCooldown[pid]||0) > now) return false;
    emoteCooldown[pid] = now + EMOTE_COOLDOWN_MS;
    showEmote(pid, iconId);
    refreshEmoteButtons();
    setTimeout(refreshEmoteButtons, EMOTE_COOLDOWN_MS + 40);
    return true;
  }
  function refreshEmoteButtons(){
    const now = Date.now();
    playersListEl.querySelectorAll('.emote-btn').forEach(btn=>{
      btn.classList.toggle('cooldown', (emoteCooldown[+btn.dataset.pid]||0) > now);
    });
  }
  const emoteBar = document.getElementById('emoteBar');
  function hideEmoteBar(){ emoteBar.classList.add('hidden'); emoteBar.dataset.pid = ''; }
  function openEmoteBar(pid, anchor){
    const icons = wallet.equipped.emotes.filter(Boolean);
    if(!icons.length) return;
    emoteBar.innerHTML = icons.map(id=> `<button type="button" data-icon="${id}" aria-label="Emote">${emoteHTML(id, currentFrame(), 40)}</button>`).join('');
    emoteBar.dataset.pid = String(pid);
    emoteBar.classList.remove('hidden');
    const r = anchor.getBoundingClientRect();
    const bw = emoteBar.offsetWidth, bh = emoteBar.offsetHeight;
    let left = Math.min(Math.max(8, r.right - bw), window.innerWidth - bw - 8);
    let top = r.top - bh - 8;
    if(top < 8) top = r.bottom + 8;
    emoteBar.style.left = left + 'px';
    emoteBar.style.top = top + 'px';
  }
  emoteBar.addEventListener('click', e=>{
    const b = e.target.closest('button[data-icon]');
    if(!b) return;
    const pid = +emoteBar.dataset.pid;
    hideEmoteBar();
    sendEmote(pid, b.dataset.icon);
  });
  document.addEventListener('pointerdown', e=>{
    if(emoteBar.classList.contains('hidden')) return;
    if(emoteBar.contains(e.target) || (e.target.closest && e.target.closest('.emote-btn'))) return;
    hideEmoteBar();
  });
  playersListEl.addEventListener('click', e=>{
    const btn = e.target.closest('.emote-btn');
    if(!btn) return;
    const pid = +btn.dataset.pid;
    if(!emoteBar.classList.contains('hidden') && emoteBar.dataset.pid===String(pid)){ hideEmoteBar(); return; }
    if((emoteCooldown[pid]||0) > Date.now()) return;
    openEmoteBar(pid, btn);
  });

  // ---------- lluvia de estrellas (festejo) ----------
  const starRainEl = document.getElementById('starRain');
  function starRain(){
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let html = '';
    for(let i=0;i<26;i++){
      const w = 16 + Math.random()*16;
      html += `<img src="${ASSET}ui/star.png" alt="" style="left:${(Math.random()*96).toFixed(1)}%; width:${w.toFixed(0)}px; animation-duration:${(1.6+Math.random()*1.6).toFixed(2)}s; animation-delay:${(Math.random()*0.9).toFixed(2)}s">`;
    }
    starRainEl.innerHTML = html;
    setTimeout(()=>{ starRainEl.innerHTML = ''; }, 4600);
  }

  // ---------- logros: chequeo ----------
  function checkAchievements(opts){
    const fresh = [];
    ACHIEVEMENTS.forEach(a=>{
      if(statsData.achievementsUnlocked.indexOf(a.id)===-1 && a.check(statsData)){
        statsData.achievementsUnlocked.push(a.id);
        fresh.push(a);
      }
    });
    if(fresh.length){
      saveStats();
      if(!(opts && opts.toast===false)) showAchievementToasts(fresh);
      updateBadges();
    }
    return fresh;
  }

  // ---------- Sala de trofeos ----------
  let achCat = 'all';
  const LOCK_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2" fill="none" stroke="#3a3128" stroke-width="2.4" stroke-linecap="round"/><rect x="5" y="10" width="14" height="11" rx="2.5" fill="#3a3128"/><circle cx="12" cy="15.5" r="1.6" fill="#faf7f0"/></svg>`;
  function achState(a){
    const unlocked = statsData.achievementsUnlocked.indexOf(a.id)!==-1;
    const claimed = !!wallet.claimed[a.id];
    let [cur, goal] = a.progress(statsData);
    if(unlocked) cur = goal;
    const status = claimed ? 'claimed' : (unlocked ? 'ready' : (cur>0 ? 'progress' : 'locked'));
    return { unlocked, claimed, status, cur, goal, ratio: goal ? cur/goal : 0 };
  }
  // listos para reclamar → más cercanos → el resto → ya reclamados
  function achSortRank(s){ return s.status==='ready' ? 0 : (s.status==='progress' ? 1 : (s.status==='locked' ? 2 : 3)); }
  function renderAchievementsOverlay(){
    const rows = ACHIEVEMENTS.map((a,i)=> ({ a, i, s:achState(a) }));
    const unlockedN = rows.filter(r=> r.s.unlocked).length;
    const pending = rows.filter(r=> r.s.status==='ready').length;
    achSummary.textContent = `${unlockedN} / ${ACHIEVEMENTS.length} desbloqueados` + (pending ? ` · ${pending} para reclamar` : '');
    achCatsEl.innerHTML = ['all'].concat(ACH_CATS).map(c=>{
      const n = rows.filter(r=> (c==='all' || r.a.cat===c) && r.s.status==='ready').length;
      return `<button type="button" class="cat-chip ${c===achCat?'active':''}" data-cat="${c}">${c==='all'?'Todos':c}${n ? ` (${n})` : ''}</button>`;
    }).join('');
    const shown = rows.filter(r=> achCat==='all' || r.a.cat===achCat).sort((x,y)=>{
      const rx = achSortRank(x.s), ry = achSortRank(y.s);
      if(rx!==ry) return rx-ry;
      if(rx===1 && y.s.ratio!==x.s.ratio) return y.s.ratio - x.s.ratio;
      return x.i - y.i;
    });
    achGrid.innerHTML = shown.map(({a,s})=>{
      const sil = s.status!=='claimed';
      const lock = s.status==='locked' || s.status==='progress';
      const pct = Math.round(s.ratio*100);
      const progress = s.status==='claimed' ? '' :
        `<div class="ach-prog"><div class="kbar ${s.status==='ready'?'green':''} ${s.cur<=0?'empty':''}"><i style="width:${pct}%"></i></div><span>${s.cur}/${s.goal}</span></div>`;
      const action = s.status==='ready'
        ? `<button type="button" class="kbtn green small" data-claim="${a.id}">Reclamar</button>`
        : (s.status==='claimed' ? '<span>✓ Reclamado</span>' : '');
      return `<div class="ach-card ${s.status}" data-id="${a.id}">
        <div class="ach-medal ${sil?'sil':''} ${lock?'locked':''}"><img src="${medalSrc(a.medal)}" alt="">${lock ? LOCK_SVG : ''}</div>
        <div class="ach-info"><div class="ach-name">${escapeHtml(a.name)}</div><div class="ach-desc">${escapeHtml(a.desc)}</div>${progress}</div>
        <div class="ach-side">${action}<span class="ach-reward"><img src="${emoteIconSrc('cash')}" alt="">+${a.reward}</span><span class="ach-tier">${TIERS[a.tier].label}</span></div>
      </div>`;
    }).join('');
    claimAllBtn.classList.toggle('hidden', pending===0);
  }
  function sparkleAt(card){
    let html = '';
    for(let i=0;i<7;i++){
      const ang = (Math.PI*2*i)/7, dist = 34 + Math.random()*22;
      html += `<img class="spark" src="${emoteIconSrc('stars')}" alt="" style="--dx:${Math.round(Math.cos(ang)*dist)}px; --dy:${Math.round(Math.sin(ang)*dist)}px; animation-delay:${i*25}ms">`;
    }
    card.insertAdjacentHTML('beforeend', html);
  }
  function claimAchievement(id, cardEl){
    const a = ACHIEVEMENTS.find(x=> x.id===id);
    if(!a) return;
    if(statsData.achievementsUnlocked.indexOf(id)===-1 || wallet.claimed[id]) return;
    wallet.claimed[id] = todayKey();
    saveWallet();
    addCoins(a.reward, { reason: a.name });
    vibrate(15);
    if(cardEl){
      const medal = cardEl.querySelector('.ach-medal');
      if(medal) medal.classList.remove('sil','locked');
      cardEl.classList.add('claiming');
      sparkleAt(cardEl);
      setTimeout(renderAchievementsOverlay, 750);
    } else {
      renderAchievementsOverlay();
    }
    updateBadges();
  }
  achGrid.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-claim]');
    if(btn) claimAchievement(btn.dataset.claim, btn.closest('.ach-card'));
  });
  achCatsEl.addEventListener('click', e=>{
    const chip = e.target.closest('.cat-chip');
    if(!chip) return;
    achCat = chip.dataset.cat;
    renderAchievementsOverlay();
  });
  claimAllBtn.addEventListener('click', ()=>{
    let total = 0, n = 0;
    ACHIEVEMENTS.forEach(a=>{
      if(statsData.achievementsUnlocked.indexOf(a.id)!==-1 && !wallet.claimed[a.id]){
        wallet.claimed[a.id] = todayKey(); total += a.reward; n++;
      }
    });
    if(!n) return;
    saveWallet();
    addCoins(total, { reason: n + ' trofeos reclamados' });
    renderAchievementsOverlay();
  });
  achievementsLinkBtn.addEventListener('click', ()=>{ renderAchievementsOverlay(); openOverlay('achievements'); });
  closeAchievementsBtn.addEventListener('click', ()=>{ closeOverlay('achievements'); updateBadges(); });

  // ---------- estadísticas ----------
  function renderStatsOverlay(){
    const names = loadPlayerNames();
    let rows = '';
    for(let i=0;i<4;i++){
      const wins = statsData.winsBySlot[i] || 0;
      const nm = escapeHtml(names[i] && names[i].trim() ? names[i].trim() : PALETTE[i].name);
      rows += `<div class="stats-row"><span>${nm}</span><span>${wins} 🏆</span></div>`;
    }
    let streakText = 'Todavía no hay una racha activa.';
    if(statsData.streak && statsData.streak.count>=2 && statsData.streak.slot!=null){
      const nm = escapeHtml(names[statsData.streak.slot] && names[statsData.streak.slot].trim() ? names[statsData.streak.slot].trim() : PALETTE[statsData.streak.slot].name);
      streakText = `🔥 ${nm} lleva ${statsData.streak.count} victorias seguidas.`;
    }
    const cpuRow = statsData.vsCpu.played>0
      ? `<div class="stats-row"><span>Contra la IA</span><span>${statsData.vsCpu.won} de ${statsData.vsCpu.played}</span></div>`
      : '';
    // ventaja del primer turno (62): % de victorias de quien abre y de cada asiento
    let seatHTML = '';
    Object.keys(statsData.seat||{}).sort().forEach(k=>{
      const sd = statsData.seat[k]; if(!sd || !sd.games) return;
      const [rsKey, cnt] = k.split(':'), n = +cnt;
      const label = (RULESETS[rsKey] ? RULESETS[rsKey].label : rsKey) + ' · ' + n + ' jugadores';
      const pct = Math.round(100*sd.firstWins/sd.games);
      const seats = [0,1,2,3].slice(0,n).map(i=> `${i+1}.º asiento ${Math.round(100*(sd.bySeat[i]||0)/sd.games)}%`).join(' · ');
      seatHTML += `<div class="stats-row seat-row"><span>${escapeHtml(label)}</span><span>Quien abre ganó ${pct}% de ${sd.games}</span></div><p class="field-hint seat-hint">${seats}${sd.games<20 ? ' · pocas partidas todavía' : ''}</p>`;
    });
    if(seatHTML) seatHTML = '<h3 class="stats-sub">Ventaja del primer turno</h3>' + seatHTML;
    statsBody.innerHTML = `
      <div class="stats-row"><span>Partidas jugadas</span><span>${statsData.totalGames}</span></div>
      ${rows}
      ${cpuRow}
      <p class="streak-line">${streakText}</p>
      ${seatHTML}
    `;
  }
  resetStatsBtn.addEventListener('click', ()=>{
    showConfirm('¿Reiniciar las estadísticas? Tus monedas, compras y trofeos se conservan. No se puede deshacer.', ()=>{
      const keep = statsData.achievementsUnlocked;
      statsData = blankStats();               // estructura completa: recordGameResult y recordModePlayed ya no fallan
      statsData.achievementsUnlocked = keep;
      saveStats();
      renderStatsOverlay();
      updateBadges();
    });
  });
  statsLinkBtn.addEventListener('click', ()=>{ renderStatsOverlay(); openOverlay('stats'); });
  closeStatsBtn.addEventListener('click', ()=> closeOverlay('stats'));

  // ---------- tienda: emotes + globos + tableros + ofertas, con vista previa y espacios para equipar ----------
  let shopTab = 'common';
  let shopSelected = null;
  let shopSlot = 0;
  let shopTicker = null;
  const RARITY_LABEL = { common:'Emote común', rare:'Emote raro', epic:'Emote épico' };

  // 141 · ventana de disponibilidad (sólo limita la compra)
  function hasWindow(it){ return !!(it.availableFrom || it.availableTo || it.sinceFirstSessionHours); }
  function offerWindow(it){
    let from = it.availableFrom ? Date.parse(it.availableFrom) : null;
    let to = it.availableTo ? Date.parse(it.availableTo) : null;
    if(it.sinceFirstSessionHours){
      from = wallet.firstSeen || 0;
      to = wallet.firstSeen ? wallet.firstSeen + it.sinceFirstSessionHours * 3600000 : 0;   // sin primera sesión registrada: vencida
    }
    return { from, to };
  }
  function isAvailableNow(it){
    if(!hasWindow(it)) return true;
    const w = offerWindow(it), t = Date.now();
    return (w.from==null || t>=w.from) && (w.to==null || t<w.to);
  }
  function shopVisible(it){ return ownsItem(it) || isAvailableNow(it); }   // lo próximo y lo vencido no se muestra
  function welcomeClaimable(){
    const it = itemById('pk_bienvenida');
    return !!it && !ownsItem(it) && isAvailableNow(it);
  }
  function fmtRemaining(ms){
    if(ms<=0) return 'Terminada';
    const s = Math.floor(ms/1000), d = Math.floor(s/86400), h = Math.floor(s%86400/3600), m = Math.floor(s%3600/60);
    if(d>0) return d + ' d ' + h + ' h';
    if(h>0) return h + ' h ' + m + ' min';
    return m + ' min ' + String(s%60).padStart(2,'0') + ' s';
  }
  // 137 · tabla de tiempo hasta cada desbloqueo (con el tope diario DAILY_GAME_COIN_CAP y las victorias por dificultad)
  function economyTable(){
    return SHOP_ITEMS.filter(it=> it.price>0).map(it=>({
      id: it.id, name: it.name, price: it.price,
      minDays: Math.ceil(it.price / DAILY_GAME_COIN_CAP),
      winsNormal: Math.ceil(it.price / DIFFICULTY.normal.coins),
      winsHard: Math.ceil(it.price / DIFFICULTY.hard.coins),
      winsExpert: Math.ceil(it.price / DIFFICULTY.expert.coins),
    }));
  }
  function themeSwatchHTML(it, w){
    const c = it.colors || ['#e7ddc9','#ddcfb0'];
    let r = '';
    for(let y=0;y<4;y++) for(let x=0;x<4;x++) r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c[(x+y)%2]}"/>`;
    return `<svg class="theme-sw" viewBox="0 0 4 4" width="${w}" height="${w}" aria-hidden="true">${r}</svg>`;
  }
  function shopVisual(it, w){
    if(it.type==='theme') return themeSwatchHTML(it, w);
    if(it.type==='pack') return `<span class="pack-ico" style="font-size:${Math.round(w*0.85)}px">🎁</span>`;
    return it.type==='emote' ? emoteHTML(it.icon, currentFrame(), w) : emoteHTML('faceHappy', it.frame, w);
  }
  function shopItemsFor(tab){
    return SHOP_ITEMS.filter(it=>{
      if(!shopVisible(it)) return false;
      if(tab==='frames') return it.type==='frame';
      if(tab==='themes') return it.type==='theme';
      if(tab==='offers') return hasWindow(it) && !ownsItem(it);
      return it.type==='emote' && it.rarity===tab;
    });
  }
  function featureMinutesLeft(ms){ return Math.max(1, Math.ceil((ms - Date.now()) / 60000)); }
  function renderShopExtras(){
    let h = '';
    if(premiumActive()){
      h += '<div class="premium-row on"><span>⭐ Premium activo · todo desbloqueado</span></div>';
    } else {
      const can = billingAvailable();
      h += `<div class="premium-row"><span>⭐ <b>Premium</b> · compra única: todos los modos y formas, y monedas dobles sin anuncios</span>`
        + `<span class="pr-actions"><button type="button" class="kbtn yellow small" data-pact="premium" ${can?'':'disabled'}>Obtener</button>`
        + `<button type="button" class="kbtn grey small" data-pact="restore" ${can?'':'disabled'}>Restaurar</button></span></div>`;
      if(!can) h += '<p class="field-hint" style="margin:0; text-align:left;">Premium está disponible en la app de Google Play.</p>';
      const act = Object.keys(entitlements.unlocks).filter(k=> entitlements.unlocks[k] > Date.now());
      if(act.length) h += '<p class="field-hint" style="margin:0; text-align:left;">Desbloqueado por anuncio: '
        + act.map(k=> escapeHtml(featureLabel(k)) + ' (' + featureMinutesLeft(entitlements.unlocks[k]) + ' min)').join(' · ') + '</p>';
    }
    shopExtrasEl.innerHTML = h;
  }
  function renderShop(){
    shopCoinsEl.textContent = wallet.coins;
    renderShopExtras();
    shopSlotsEl.innerHTML = wallet.equipped.emotes.map((id,i)=>
      `<button type="button" class="shop-slot ${i===shopSlot?'active':''}" data-slot="${i}" aria-label="Espacio ${i+1}">${id ? emoteHTML(id, currentFrame(), 43) : '+'}</button>`).join('');
    shopTabsEl.innerHTML = SHOP_TABS.map(t=> `<button type="button" class="shop-tab ${t.id===shopTab?'active':''}" data-tab="${t.id}">${t.label}</button>`).join('');
    const items = shopItemsFor(shopTab);
    shopGridEl.innerHTML = items.length ? items.map(it=>{
      const owned = ownsItem(it);
      const tag = isEquipped(it) ? '<span class="tag">En uso</span>' : (owned ? '<span class="tag" style="background:#3a6ea5">Tuyo</span>' : (hasWindow(it) ? '<span class="tag offer">Oferta</span>' : ''));
      const price = owned ? '' : (it.price>0 ? `<span class="pr"><img src="${emoteIconSrc('cash')}" alt="">${it.price}</span>` : '<span class="pr">Gratis</span>');
      const w = offerWindow(it);
      const cd = (!owned && w.to!=null) ? `<span class="cd" data-to="${w.to}">${fmtRemaining(w.to - Date.now())}</span>` : '';
      return `<button type="button" class="shop-item ${it.id===shopSelected?'selected':''}" data-id="${it.id}">${tag}${shopVisual(it,38)}<span class="nm">${escapeHtml(it.name)}</span>${price}${cd}</button>`;
    }).join('') : '<p class="field-hint" style="grid-column:1/-1; text-align:center; margin:10px 0;">No hay ofertas por ahora. ¡Volvé pronto!</p>';
    renderShopDetail();
  }
  function shopPreviewSvg(it){
    const skin = pieceSkins[0];
    if(it.type==='pack') return '<svg viewBox="0 0 200 130" aria-hidden="true"><text x="100" y="80" font-size="64" text-anchor="middle">🎁</text></svg>';
    if(it.type==='theme'){
      const c = it.colors || ['#e7ddc9','#ddcfb0'];
      let g = `<rect width="200" height="130" fill="${c[0]}"/>`;
      for(let y=0;y<3;y++) for(let x=0;x<5;x++) if((x+y)%2===1) g += `<rect x="${x*40}" y="${y*43.3}" width="40" height="43.4" fill="${c[1]}"/>`;
      const pawnT = pieceMarkup(skin.shape, 100, 82, 40, skin.color, '').replace(' filter="url(#pieceShadow)"', '');
      return `<svg viewBox="0 0 200 130" aria-hidden="true">${g}${pawnT}</svg>`;
    }
    const frame = it.type==='frame' ? it.frame : currentFrame();
    const icon = it.type==='emote' ? it.icon : 'faceHappy';
    const pawn = pieceMarkup(skin.shape, 100, 106, 40, skin.color, '').replace(' filter="url(#pieceShadow)"', '');
    const k = 1.4;
    return `<svg viewBox="0 0 200 130" aria-hidden="true">${pawn}<g transform="translate(${100-20*k} ${82-42*k}) scale(${k})"><g class="emo-pop loop" style="--dir:1">${emoteSvgInner(icon, frame, false)}</g></g></svg>`;
  }
  function itemKindLabel(it){
    if(it.type==='emote') return RARITY_LABEL[it.rarity];
    if(it.type==='frame') return 'Globo de emotes';
    if(it.type==='theme') return it.season ? 'Tema de tablero de temporada' : 'Tema de tablero';
    if(it.type==='pack'){
      const names = (it.grants.items||[]).map(id=> (itemById(id)||{}).name).filter(Boolean);
      return it.grants.coins + ' monedas' + (names.length ? ' + ' + names.join(' + ') : '');
    }
    return '';
  }
  function renderShopDetail(){
    const it = shopSelected ? itemById(shopSelected) : null;
    if(!it || !shopVisible(it)){
      shopDetailEl.innerHTML = '<p class="field-hint" style="margin:0; width:100%; text-align:center;">Tocá un ítem para verlo en acción antes de comprarlo.</p>';
      return;
    }
    const owned = ownsItem(it);
    const w = offerWindow(it);
    const cd = (!owned && w.to!=null) ? ` · Vence en <span class="cd" data-to="${w.to}">${fmtRemaining(w.to - Date.now())}</span>` : '';
    let sub, btn, eco = '';
    if(!owned){
      sub = escapeHtml(itemKindLabel(it)) + cd;
      const why = canBuy(it);
      if(it.price>0){
        const days = Math.max(1, Math.ceil(it.price / DAILY_GAME_COIN_CAP));
        eco = `<div class="det-eco">≈ ${Math.ceil(it.price / DIFFICULTY.hard.coins)} victorias en Difícil · mínimo ${days} día${days===1?'':'s'} por el tope diario</div>`;
      }
      btn = why
        ? `<button type="button" class="kbtn grey small" data-act="buy" disabled>${escapeHtml(why.replace(/\.$/, ''))}</button>`
        : `<button type="button" class="kbtn green small" data-act="buy">${it.price>0 ? 'Comprar · ' + it.price : 'Reclamar gratis'}</button>`;
    } else if(isEquipped(it)){
      sub = it.type==='emote' ? 'Ya está en tus espacios' : (it.type==='theme' ? 'Es el tablero que estás usando' : 'Es el globo que estás usando');
      btn = `<button type="button" class="kbtn grey small" disabled>En uso</button>`;
    } else {
      sub = 'Tuyo';
      btn = it.type==='emote'
        ? `<button type="button" class="kbtn yellow small" data-act="equip">Poner en espacio ${shopSlot+1}</button>`
        : (it.type==='theme'
          ? `<button type="button" class="kbtn yellow small" data-act="equip">Usar este tablero</button>`
          : `<button type="button" class="kbtn yellow small" data-act="equip">Usar este globo</button>`);
    }
    shopDetailEl.innerHTML = `${shopPreviewSvg(it)}<div class="det-info"><div class="det-name">${escapeHtml(it.name)}</div><div class="det-sub">${sub}</div>${eco}${btn}</div>`;
  }
  function applyBoardTheme(){
    const t = wallet.equipped.theme;
    if(t && t!=='clasico') document.documentElement.setAttribute('data-board', t);
    else document.documentElement.removeAttribute('data-board');
  }
  function equipItem(it){
    if(!ownsItem(it)) return;
    if(it.type==='frame'){ wallet.equipped.frame = it.frame; }
    else if(it.type==='theme'){ wallet.equipped.theme = it.theme; applyBoardTheme(); }
    else if(it.type==='emote'){
      const arr = wallet.equipped.emotes;
      const idx = arr.indexOf(it.icon);
      const prev = arr[shopSlot];
      if(idx!==-1) arr[idx] = prev || null;       // si ya estaba en otro espacio, se intercambian
      arr[shopSlot] = it.icon;
    }
    saveWallet();
  }
  // Devuelve '' si se puede comprar, o el motivo en castellano.
  function canBuy(it){
    if(!it || !itemById(it.id)) return 'Ese objeto ya no está en la tienda.';
    if(ownsItem(it)) return 'Ya lo tenés.';
    if(!Number.isInteger(it.price) || it.price<0) return 'Precio inválido.';
    if(!isAvailableNow(it)) return 'Esta oferta ya terminó.';
    if(wallet.coins < it.price) return 'Te faltan ' + (it.price - wallet.coins) + ' monedas.';
    return '';
  }
  function autoEquipEmote(it){
    if(it.type!=='emote') return;
    const empty = wallet.equipped.emotes.indexOf(null);
    if(empty!==-1) wallet.equipped.emotes[empty] = it.icon;     // si hay un espacio libre, queda puesto
  }
  function buyItem(it){
    const why = canBuy(it);                       // se revalida SIEMPRE: precio, saldo, si ya es tuyo y si la oferta sigue vigente
    if(why){ showToast(escapeHtml(why)); return false; }
    wallet.coins -= it.price;
    wallet.owned[it.id] = 1;
    autoEquipEmote(it);
    if(it.type==='pack' && it.grants){
      if(it.grants.coins) wallet.coins = Math.min(COIN_SANITY_MAX, wallet.coins + it.grants.coins);
      (it.grants.items||[]).forEach(id=>{ const g = itemById(id); if(g){ wallet.owned[g.id] = 1; autoEquipEmote(g); } });
    }
    wallet.shopSeen = wallet.coins;
    saveWallet();
    playCoinSound();
    vibrate(20);
    updateCoinUI(true);
    updateBadges();
    return true;
  }
  function tickShop(){
    if(shopOverlay.classList.contains('hidden')){ clearInterval(shopTicker); shopTicker = null; return; }
    let expired = false;
    shopOverlay.querySelectorAll('.cd[data-to]').forEach(el=>{
      const left = +el.dataset.to - Date.now();
      el.textContent = fmtRemaining(left);
      if(left<=0) expired = true;
    });
    if(expired) renderShop();                     // la oferta vencida desaparece sola
  }
  function openShop(){
    wallet.shopSeen = wallet.coins;
    saveWallet();
    renderShop();
    openOverlay('shop');
    updateBadges();
    if(shopTicker) clearInterval(shopTicker);
    shopTicker = setInterval(tickShop, 1000);
  }
  shopOverlay.addEventListener('click', e=>{
    const pa = e.target.closest('button[data-pact]');
    if(pa){ if(pa.dataset.pact==='premium') buyPremium(); else if(pa.dataset.pact==='restore') restorePurchases(); return; }
    const slot = e.target.closest('.shop-slot');
    if(slot){ shopSlot = +slot.dataset.slot; renderShop(); return; }
    const tab = e.target.closest('.shop-tab');
    if(tab){ shopTab = tab.dataset.tab; shopSelected = null; renderShop(); return; }
    const card = e.target.closest('.shop-item');
    if(card){ shopSelected = card.dataset.id; renderShop(); return; }
    const act = e.target.closest('button[data-act]');
    if(act && shopSelected){
      const it = itemById(shopSelected);
      if(!it) return;
      if(act.dataset.act==='buy'){
        if(it.price>0) showConfirm('¿Comprar «' + it.name + '» por ' + it.price + ' monedas?', ()=>{ buyItem(it); renderShop(); }, 'Sí, comprar');
        else { buyItem(it); renderShop(); }
      } else if(act.dataset.act==='equip'){ equipItem(it); renderShop(); }
    }
  });
  shopLinkBtn.addEventListener('click', openShop);
  coinChip.addEventListener('click', openShop);
  closeShopBtn.addEventListener('click', ()=>{ closeOverlay('shop'); updateBadges(); });

  // ---------- recompensas de partida / desafío diario ----------
  function dailyStars(moves, par, slack){ const k = (slack==null ? 3 : slack); return moves<=par ? 3 : (moves<=par+k ? 2 : 1); }
  // Datos del desafío en juego (si la partida se armó sin ellos, p. ej. en pruebas, se completan con los de hoy).
  function dailyInfoOf(st){
    if(st && st.dailyInfo) return st.dailyInfo;
    const cfg = dailyModeFor(utcDayKey());
    return { dateKey:utcDayKey(), number:dailyNumberOf(utcDayKey()), id:cfg.id, label:cfg.label, emoji:cfg.emoji, hint:cfg.hint, slack:cfg.slack, turnSeconds:0 };
  }
  function dailyBaseCoins(streak){ return 20 + 5*(Math.min(Math.max(streak,1),7)-1); }
  function starsHTML(n, total, px){
    let h = '';
    for(let i=0;i<total;i++) h += `<img src="${ASSET}ui/${i<n?'star':'star-off'}.png" alt="" style="width:${px}px;height:auto">`;
    return h;
  }
  function gameReward(p){
    const r = { coins:0, note:'', stars:0, chest:null };
    if(!state.isCpuGame){ r.note = 'Las partidas entre personas no dan monedas. Ganale a la IA o resolvé el desafío diario para juntar.'; return r; }
    if(state.players[creditedSlot(p)].isCPU) return r;
    const diff = (state.players[1] && state.players[1].difficulty) || 'easy';
    const base = (DIFFICULTY[diff] || DIFFICULTY.easy).coins;
    if(state.moveCount < state.size + 1){ r.note = 'Fue una partida muy corta: para sumar monedas tiene que durar un poco más.'; return r; }
    const pay = Math.min(base, Math.max(0, DAILY_GAME_COIN_CAP - earnedToday()));
    if(pay<=0){ r.note = 'Ya llegaste al tope de monedas por partidas de hoy. Mañana vuelven a sumar.'; return r; }
    if(pay<base) r.note = 'Llegaste al tope diario de monedas por partidas.';
    wallet.earned = { date: todayKey(), games: earnedToday() + pay };
    r.coins = pay;
    addCoins(pay, { silent:true });
    return r;
  }
  function dailyReward(res, moves, par, dateKey, slack){
    const stars = dailyStars(moves, par, slack);
    const r = { coins:0, note:'', stars, chest:null };
    const today = dateKey || utcDayKey();
    if(wallet.dailyPaid===today){ r.note = 'Ya cobraste la recompensa de hoy.'; return r; }
    wallet.dailyPaid = today;
    let coins = dailyBaseCoins(res.streak) + (stars-1)*10;
    if(res.streak>0 && res.streak%7===0){                           // cofre cada 7 días seguidos
      const pool = SHOP_ITEMS.filter(it=> it.type==='emote' && !ownsItem(it));
      if(pool.length){
        const it = pool[Math.floor(Math.random()*pool.length)];
        wallet.owned[it.id] = 1;
        const empty = wallet.equipped.emotes.indexOf(null);
        if(empty!==-1) wallet.equipped.emotes[empty] = it.icon;
        r.chest = { item: it };
      } else { coins += 100; r.chest = { coins:100 }; }
    }
    r.coins = coins;
    saveWallet();
    addCoins(coins, { silent:true });
    return r;
  }
  function nextGoal(){
    const unowned = SHOP_ITEMS.filter(it=> (it.type==='emote' || it.type==='frame') && !ownsItem(it)).sort((a,b)=> a.price-b.price);
    if(!unowned.length) return null;
    const above = unowned.find(it=> it.price > wallet.coins);
    return { item: above || unowned[0], canBuy: !above };
  }
  function renderWinGoal(){
    const g = nextGoal();
    if(!g){ winGoal.classList.add('hidden'); return; }
    const it = g.item;
    const vis = shopVisual(it, 26);
    if(g.canBuy){
      winGoal.innerHTML = `<div class="goal-line">${vis}<span>Ya te alcanza para «${escapeHtml(it.name)}». Está en la tienda.</span></div><div class="kbar green"><i style="width:100%"></i></div>`;
    } else {
      const pct = Math.round(100 * wallet.coins / it.price);
      winGoal.innerHTML = `<div class="goal-line">${vis}<span>Te faltan ${it.price - wallet.coins} para «${escapeHtml(it.name)}»</span></div><div class="kbar ${wallet.coins<=0?'empty':''}"><i style="width:${pct}%"></i></div>`;
    }
    winGoal.classList.remove('hidden');
  }

  // ---------- nombres de jugadores (persistidos) ----------
  function loadPlayerNames(){
    try{
      const raw = localStorage.getItem('quoridor_playerNames');
      if(raw){
        const arr = JSON.parse(raw);
        if(Array.isArray(arr)) return [arr[0]||'', arr[1]||'', arr[2]||'', arr[3]||''];
      }
    }catch(e){}
    return ['','','',''];
  }
  function savePlayerNames(arr){
    try{ localStorage.setItem('quoridor_playerNames', JSON.stringify(arr)); }catch(e){}
  }

  // ---------- fichas / skins ----------
  function defaultSkins(){ return PALETTE.map(p=> ({ color:p.color, shape:p.shape })); }
  function loadSkins(){
    try{
      const raw = localStorage.getItem('quoridor_pieceSkins');
      if(raw){
        const arr = JSON.parse(raw);
        if(Array.isArray(arr) && arr.length===4){
          return arr.map((s,i)=> ({
            color: (s && s.color) || PALETTE[i].color,
            shape: (s && s.shape) || PALETTE[i].shape,
          }));
        }
      }
    }catch(e){}
    return defaultSkins();
  }
  function saveSkins(){ try{ localStorage.setItem('quoridor_pieceSkins', JSON.stringify(pieceSkins)); }catch(e){} }
  let pieceSkins = loadSkins();

  function shapeAdGated(sh){ return Object.values(CAMPAIGN_SHAPE_UNLOCKS).indexOf(sh)!==-1; }
  function shapeUsable(sh){ return campaignShapeUnlocked(sh) || (shapeAdGated(sh) && isUnlocked('skin:' + sh)); }
  function requestShapeUnlock(sh){
    if(!shapeAdGated(sh)){ showToast('🔒 Forma bloqueada: avanzá en la campaña para desbloquearla.'); return; }
    offerUnlock('skin:' + sh, ()=>{ pieceSkins[activeSkinSlot].shape = sh; saveSkins(); recordSkinCustomized(); renderSkinsOverlay(); });
  }
  function sanitizeSkinsForLocks(){               // si venció un desbloqueo temporal, la ficha vuelve a su forma de fábrica
    let changed = false;
    pieceSkins.forEach((sk,i)=>{ if(!shapeUsable(sk.shape)){ sk.shape = PALETTE[i].shape; changed = true; } });
    if(changed) saveSkins();
  }
  function renderSkinsOverlay(){
    const tabsHtml = pieceSkins.map((s,i)=>
      `<button type="button" class="slot-tab ${i===activeSkinSlot?'active':''}" data-slot="${i}" style="background:${s.color}" aria-label="Editar ficha ${i+1}"></button>`
    ).join('');
    const current = pieceSkins[activeSkinSlot];
    const previewHtml = smallShapeSVG(current.shape, current.color, 64);
    const colorsHtml = SKIN_COLORS.map(c=>{
      const sel = c===current.color ? 'selected' : ''; const locked=!campaignSkinColorUnlocked(c);
      return `<button type="button" class="color-swatch ${sel} ${locked?'locked-swatch':''}" data-color="${c}" style="background:${c}" aria-label="${locked?'Bloqueado':'Color '+c}">${locked?'🔒':''}</button>`;
    }).join('');
    const shapesHtml = SKIN_SHAPES.map(sh=>{
      const sel = sh===current.shape ? 'selected' : ''; const locked=!shapeUsable(sh);
      return `<button type="button" class="shape-swatch ${sel} ${locked?'locked-swatch':''}" data-shape="${sh}" aria-label="${locked?'Bloqueado':SHAPE_LABEL[sh]}">${locked?'🔒':smallShapeSVG(sh,'var(--ink)',22)}</button>`;
    }).join('');
    skinsBody.innerHTML = `
      <div class="slot-tabs">${tabsHtml}</div>
      <div class="skin-preview">${previewHtml}</div>
      <p class="swatch-label">Color</p>
      <div class="swatch-grid">${colorsHtml}</div>
      <p class="swatch-label">Forma</p>
      <div class="swatch-grid">${shapesHtml}</div>
    `;
  }
  function setSkinColor(slot, color){
    if(!campaignSkinColorUnlocked(color)){ showToast('🔒 Color bloqueado: completá la etapa correspondiente de la campaña.'); return; }
    const currentColorOfSlot = pieceSkins[slot].color;
    const otherIdx = pieceSkins.findIndex((s,i)=> i!==slot && s.color===color);
    pieceSkins[slot].color = color;
    if(otherIdx!==-1){
      pieceSkins[otherIdx].color = currentColorOfSlot;
    }
    saveSkins();
    recordSkinCustomized();
    renderSkinsOverlay();
  }
  skinsBody.addEventListener('click', e=>{
    const tab = e.target.closest('.slot-tab');
    if(tab){ activeSkinSlot = +tab.dataset.slot; renderSkinsOverlay(); return; }
    const colorBtn = e.target.closest('.color-swatch');
    if(colorBtn){ setSkinColor(activeSkinSlot, colorBtn.dataset.color); return; }
    const shapeBtn = e.target.closest('.shape-swatch');
    if(shapeBtn){ if(!shapeUsable(shapeBtn.dataset.shape)){ requestShapeUnlock(shapeBtn.dataset.shape); return; } pieceSkins[activeSkinSlot].shape = shapeBtn.dataset.shape; saveSkins(); recordSkinCustomized(); renderSkinsOverlay(); return; }
  });
  resetSkinsBtn.addEventListener('click', ()=>{
    pieceSkins = defaultSkins();
    saveSkins();
    renderSkinsOverlay();
  });
  skinsLinkBtn.addEventListener('click', ()=>{ renderSkinsOverlay(); openOverlay('skins'); });
  closeSkinsBtn.addEventListener('click', ()=> closeOverlay('skins'));

  // ---------- último setup usado ----------
  function loadLastSetup(){
    try{
      const raw = localStorage.getItem('quoridor_lastSetup');
      if(raw) return JSON.parse(raw);
    }catch(e){}
    return null;
  }
  function saveLastSetup(cfg){
    try{ localStorage.setItem('quoridor_lastSetup', JSON.stringify(cfg)); }catch(e){}
  }

  // ---------- move / wall mode toggle (tap-friendly, works with touch and mouse) ----------
  function setMode(m){
    if(!state || state.winner) return;
    const cpNow = state.players[state.currentPlayerIndex];
    if(cpNow && cpNow.isCPU) return;
    if(m==='wall'){
      const cp = state.players[state.currentPlayerIndex];
      if(!cp || cp.wallsLeft<=0) return;
    }
    mode = m;
    hideWallPreview();
    previewSlot = null;
    if(state.sprintArmed){ state.sprintArmed = false; redrawMoves(); }   // volver a Mover o pasar a pared desarma el sprint
    updateModeUI();
  }
  function updateModeUI(){
    const cp = state && state.players[state.currentPlayerIndex];
    const canWall = !!cp && cp.wallsLeft>0 && !(state && state.winner);
    const isHumanTurn = !cp || !cp.isCPU;
    moveModeBtn.classList.toggle('active', mode==='move');
    wallModeBtn.classList.toggle('active', mode==='wall');
    moveModeBtn.disabled = !isHumanTurn;
    wallModeBtn.disabled = !canWall || !isHumanTurn;
    hintLine.classList.remove('thinking');
    if(state && state.winner){ hintLine.textContent=''; updateSprintBtn(); updateUndoBtn(); updateAuxButtons(); return; }
    const canPush = !!state && state.ruleset==='hill' && state.validMoves.some(m=> m.push);
    const mapTag = (state && state.mazeInfo && (state.moveCount||0) < state.players.length*2) ? 'Mapa: '+state.mazeInfo.name+'. ' : '';
    const dailyTag = (state && state.isDaily && (state.moveCount||0) < 2 && dailyInfoOf(state).hint) ? dailyInfoOf(state).hint+' ' : '';
    hintLine.textContent = mapTag + dailyTag + (mode==='wall'
      ? 'Arrastrá sobre el tablero para ubicar la pared y soltá para confirmarla.'
      : (state && state.sprintArmed
        ? (state.ruleset==='party' ? 'Paso doble: tocá una casilla a dos pasos en línea recta (no vale para el centro).' : 'Sprint: tocá una casilla a dos pasos en línea recta.')
        : 'Tocá una casilla resaltada para moverte.' + (canPush ? ' La flecha empuja al rival.' : '') + ((state && state.validMoves.some(m=> m.swap)) ? ' El ⇄ intercambia lugar con tu aliado (gasta el turno).' : '')));
    if(state && state.ruleset==='party' && !state.winner && mode!=='wall' && !state.sprintArmed){
      const me = state.players[state.currentPlayerIndex];
      if(me && me.fx && me.fx.extra>0) hintLine.textContent = (me.fx.extra===1 ? 'Turno extra activo: después de esta acción jugás otra. ' : 'Acción extra: es la última de este turno. ') + hintLine.textContent;
    }
    if(state && state.pie && state.pie.open && !(cp && cp.isCPU) && mode!=='wall') hintLine.textContent = '🥧 Regla del pastel: podés cambiar de lado (tomar la posición de tu rival) o jugar normal. ' + hintLine.textContent;
    updateSprintBtn();
    updateUndoBtn();
    updatePowerBar();
    updateAuxButtons();
    updateAssistBtns();
  }
  // Botón de sprint del HUD (sólo existe en Cazador y fugitivo; sólo lo usa el fugitivo humano en su turno)
  function updateSprintBtn(){
    const on = !!state && state.ruleset==='hunter';
    sprintBtn.classList.toggle('hidden', !on);
    if(!on) return;
    const fug = state.players[state.fugitiveIdx];
    const cp = state.players[state.currentPlayerIndex];
    const myTurn = !state.winner && !!cp && state.currentPlayerIndex===state.fugitiveIdx && !cp.isCPU;
    sprintCount.textContent = fug ? (fug.sprints||0) : 0;
    sprintBtn.disabled = !(myTurn && state.validMoves.some(m=> m.sprint));
    sprintBtn.classList.toggle('active', !!state.sprintArmed && mode==='move' && !sprintBtn.disabled);
  }
  function redrawMoves(){ movesEl.innerHTML = movesMarkup(cellSize()).moves; }
  sprintBtn.addEventListener('click', ()=>{
    if(!state || state.winner || state.ruleset!=='hunter' || sprintBtn.disabled) return;
    state.sprintArmed = !state.sprintArmed;
    mode = 'move';
    hideWallPreview();
    previewSlot = null;
    redrawMoves();          // sólo los puntos: no reinicia el reloj de turno ni vuelve a llamar a la IA
    updateModeUI();
    playToggleSound(state.sprintArmed);
  });
  powerBtns.addEventListener('click', e=>{
    const btn = e.target.closest ? e.target.closest('.power-btn') : null;
    if(!btn || btn.disabled || !state || state.ruleset!=='party' || state.winner) return;
    const idx = state.currentPlayerIndex;
    if(state.players[idx].isCPU) return;
    const key = btn.dataset.power;
    if(!partyUse(idx, key)) return;
    hideWallPreview();
    previewSlot = null;
    if(key==='paso_doble'){          // sólo arma/desarma: se gasta al hacer el paso doble
      mode = 'move';
      redrawMoves();                 // sólo los puntos: no reinicia el reloj de turno ni vuelve a llamar a la IA
      updateModeUI();
      playToggleSound(state.sprintArmed);
    } else {
      if(key==='romper_pared') playWallSound(); else playToggleSound(true);
      vibrate(20);
      partyRerender();
    }
  });
  moveModeBtn.addEventListener('click', ()=> setMode('move'));
  wallModeBtn.addEventListener('click', ()=> setMode('wall'));

  // ---------- IA (bot) ----------
  function invalidateBotTimer(){
    stopThinking();
    botToken++;
    if(botTimer){ clearTimeout(botTimer); botTimer=null; }
  }
  function otherPlayerClosestToCenter(excludeIdx,edgesOverride){
    const edges = edgesOverride || state.blockedEdges;
    // 2v2: los únicos rivales son los del otro equipo. Con «primero que llega» amenaza el más cercano al centro; con
    // «llegan los dos» el equipo rival termina cuando llega su miembro más lejano, así que ése es el que hay que frenar.
    if(state.teams){
      const myTeam = teamOf(excludeIdx);
      const rivals = state.players.map((p,i)=> i).filter(i=> teamOf(i)!==myTeam && !state.players[i].arrived);
      if(!rivals.length) return null;
      const dist = i=> distanceToCenter(state.players[i].r, state.players[i].c, edges);
      return rivals.reduce((best,i)=> {
        if(best==null) return i;
        return (state.teamGoal==='both' ? dist(i)>dist(best) : dist(i)<dist(best)) ? i : best;
      }, null);
    }
    let best=null, bestDist=Infinity;
    state.players.forEach((p,i)=>{
      if(i===excludeIdx) return;
      const d = distanceToCenter(p.r,p.c,edges,i);
      if(d<bestDist){ bestDist=d; best=i; }
    });
    return best;
  }
  // Caminos mínimos del rival: todas las aristas que pertenecen a algún camino más corto desde `start` hasta la meta.
  // Una pared que no toca ninguna de ellas no puede alargarle el camino, así que ni se prueba (83).
  function shortestPathDag(mask,size,dm,start){
    const n=size*size, dag=new Set(), seen=new Uint8Array(n), stack=[start];
    seen[start]=1;
    while(stack.length){
      const cur=stack.pop(), dcur=dm[cur];
      if(dcur<=0) continue;
      const r=(cur/size)|0, c=cur-r*size, m=mask[cur];
      for(let k=0;k<4;k++){
        if(m&(1<<k)) continue;
        const nr=r+DIRS4[k][0], nc=c+DIRS4[k][1];
        if(nr<0||nc<0||nr>=size||nc>=size) continue;
        const nx=nr*size+nc;
        if(dm[nx]!==dcur-1) continue;
        dag.add(cur<nx ? cur*n+nx : nx*n+cur);
        if(!seen[nx]){ seen[nx]=1; stack.push(nx); }
      }
    }
    return dag;
  }
  function wallHitsDag(we,size,dag){
    const n=size*size;
    for(const e of we){
      const a=e[0]*size+e[1], b=e[2]*size+e[3];
      if(dag.has(a<b ? a*n+b : b*n+a)) return true;
    }
    return false;
  }
  // edgesOverride: base de paredes conocidas para ESTIMAR la ganancia de una pared (niebla de guerra: el
  // conocimiento propio de la IA). La legalidad real de colocarla siempre se valida con el estado real.
  // Devuelve TODAS las paredes que le alargan el camino al rival, de mayor a menor ganancia. Cada prueba pone las
  // aristas en una máscara local y las saca en un finally (82): no se copia ningún Set por candidato.
  function collectWallCandidates(opponentIdx,currentOppDist,distFn,edgesOverride,botIdx){
    const size=state.size, n=size*size, baseEdges = edgesOverride || state.blockedEdges;
    const rowsGoal = state.goalMode==='rows';
    const useHill = distFn===distanceToHill || rowsGoal;
    const goals = rowsGoal ? hillGoalIdx(goalCells(opponentIdx)) : (useHill ? hillGoalIdx() : [centerGoal()]);
    let flags = null;
    if(useHill){ flags = new Uint8Array(n); goals.forEach(g=>{ flags[g]=1; }); }
    const mask = edgeMaskFor(baseEdges,size).slice();
    // IA aliada (53): Δally = cuánto le alarga la pared el camino a su compañero. Se descuenta doble de la ganancia
    // contra el rival, y la pared que no sale a cuenta se descarta.
    const me = botIdx!=null ? botIdx : state.currentPlayerIndex;
    const ally = (state.teams && state.players[allyIdxOf(me)] && !state.players[allyIdxOf(me)].arrived) ? state.players[allyIdxOf(me)] : null;
    const cen = centerGoal();
    const allyStart = ally ? ally.r*size+ally.c : -1;
    const allyBase = ally ? bfsToGoal(mask,size,allyStart,cen,null) : 0;
    const opp=state.players[opponentIdx], start=opp.r*size+opp.c;
    const dm = buildDistMap(mask,size,goals);
    // en Espejo la pared lleva su reflejo (también podría tocar el camino), así que ahí no se filtra
    const dag = (state.ruleset!=='mirror' && dm[start]>0) ? shortestPathDag(mask,size,dm,start) : null;
    const radius=3, maxSlot=size-2, out=[];
    for(let r=Math.max(0,opp.r-radius);r<=Math.min(maxSlot,opp.r+radius);r++) for(let c=Math.max(0,opp.c-radius);c<=Math.min(maxSlot,opp.c+radius);c++) for(const orientation of ['h','v']){
      if(dag && !wallHitsDag(wallEdges(r,c,orientation),size,dag)) continue;
      const ev=evaluateWallForMode(r,c,orientation); if(!ev.valid) continue;
      const undo = applyEdgesToMask(mask,size,ev.edges);
      const undo2 = ev.mirrorEdges ? applyEdgesToMask(mask,size,ev.mirrorEdges) : null;
      let d, deltaAlly=0;
      try{
        d = useHill ? bfsToGoal(mask,size,start,-1,flags) : bfsToGoal(mask,size,start,cen,null);
        if(ally) deltaAlly = Math.max(0, bfsToGoal(mask,size,allyStart,cen,null) - allyBase);
      } finally {
        if(undo2) undoMask(mask,undo2);
        undoMask(mask,undo);
      }
      if(d<=currentOppDist) continue;
      const net = (d-currentOppDist) - deltaAlly*2;
      if(net<=0) continue;
      out.push({r,c,orientation,gain:net,newOppDist:d,deltaAlly});
    }
    out.sort((a,b)=>b.gain-a.gain||a.newOppDist-b.newOppDist);
    return out;
  }
  function findBestBlockingWall(opponentIdx,currentOppDist,distFn,edgesOverride,botIdx){
    const cands = collectWallCandidates(opponentIdx,currentOppDist,distFn,edgesOverride,botIdx);
    if(!cands.length) return null;
    const gain=cands[0].gain, top=cands.filter(x=>x.gain===gain);
    return top[Math.floor(botRand()*top.length)];
  }
  // Pared que más alarga el camino a la zona del rival más cercano (los que ya están dentro no se pueden frenar).
  function findHillBlockingWall(botIdx){
    const rivals = [];
    state.players.forEach((pl,i)=>{
      if(i===botIdx) return;
      const d = distanceToHill(pl.r,pl.c,state.blockedEdges);
      if(d>0 && d<Infinity) rivals.push({ i, d });
    });
    rivals.sort((a,b)=> a.d-b.d);
    for(const rv of rivals){
      const w = findBestBlockingWall(rv.i, rv.d, distanceToHill);
      if(w) return { type:'wall', r:w.r, c:w.c, orientation:w.orientation };
    }
    return null;
  }
  function findAnyLegalWall(){
    for(let r=0;r<=state.size-2;r++) for(let c=0;c<=state.size-2;c++) for(const orientation of ['h','v']){
      if(evaluateWallForMode(r,c,orientation).valid) return { type:'wall', r, c, orientation };
    }
    return null;
  }
  // IA de Rey de la colina: llegar a la casilla libre más cercana de la zona y, una vez dentro, sostenerla.
  function botPlanHill(idx, profile){
    const bot = state.players[idx], moves = state.validMoves;
    const rank = list=> list.map(m=>({ m, score:scoreBotMove(idx,m,profile.personality) })).sort((a,b)=>b.score-a.score);
    if(isHillCell(bot.r,bot.c)){
      // 1) empujar al rival adyacente (sólo si el empujón me deja dentro de la zona: no quiero perder mi propio conteo)
      if((bot.pushesLeft||0)>0){
        const pushes = moves.filter(m=> m.push && isHillCell(m.r,m.c));
        if(pushes.length){
          const heat = m=>{ const rv=state.players.find(pl=> pl!==bot && pl.r===m.r && pl.c===m.c); return rv ? (rv.hillTurns||0) : 0; };
          pushes.sort((a,b)=> heat(b)-heat(a));
          return { type:'move', r:pushes[0].r, c:pushes[0].c };
        }
      }
      const hold = moves.filter(m=> !m.push && isHillCell(m.r,m.c));
      // 2) si no, una pared que alargue el camino del rival más cercano (las IA más fuertes la usan más seguido)
      if(bot.wallsLeft>0 && (hold.length===0 || botRand() < Math.min(1, (profile.wallChance||0)+0.4))){
        const w = findHillBlockingWall(idx) || (hold.length===0 ? findAnyLegalWall() : null);
        if(w) return w;
      }
      // 3) si no, moverse a otra casilla de la zona para no perder el conteo
      if(hold.length){ const best = rank(hold)[0].m; return { type:'move', r:best.r, c:best.c }; }
    }
    if(!moves.length) return { type:'move', r:bot.r, c:bot.c };
    // fuera de la zona (o sin forma de quedarse): el movimiento que mejor puntúa, con el ruido propio de cada dificultad
    const scored = rank(moves);
    const choice = botRand()<profile.randomness ? scored[Math.floor(botRand()*Math.min(3,scored.length))] : scored[0];
    return { type:'move', r:choice.m.r, c:choice.m.c };
  }
  // IA cazadora: 1) atrapar si puede quedar pegada al fugitivo, 2) frenarlo con paredes (casi siempre si está cerca del centro),
  // 3) acercarse a él por el camino más corto (desempate: quedar cerca del centro, que es adonde tiene que ir).
  function botPlanHunter(idx, profile){
    const bot=state.players[idx], fIdx=state.fugitiveIdx, f=state.players[fIdx], moves=state.validMoves;
    const catches = moves.filter(m=> isCaptureAdjacent(m.r,m.c));
    if(catches.length && botRand() >= profile.randomness*0.25){
      const c = catches[Math.floor(botRand()*catches.length)];
      return { type:'move', r:c.r, c:c.c };
    }
    const fDist = distanceToCenter(f.r,f.c,state.blockedEdges);
    if(bot.wallsLeft>0){
      const chance = fDist<=2 ? Math.min(.95, profile.wallChance+.35) : profile.wallChance;   // más pared cuando el fugitivo está por ganar; escala con la dificultad
      if(botRand()<chance){ const w=findBestBlockingWall(fIdx,fDist); if(w) return {type:'wall',r:w.r,c:w.c,orientation:w.orientation}; }
    }
    if(!moves.length) return { type:'move', r:bot.r, c:bot.c };
    const big = v=> isFinite(v) ? v : 99;
    const scored = moves.map(m=> ({ m, score: -big(bfsShortestPath(m.r,m.c,f.r,f.c,state.blockedEdges,state.size))*10 - big(distanceToCenter(m.r,m.c,state.blockedEdges)) }))
      .sort((a,b)=> b.score-a.score);
    const choice = botRand()<profile.randomness ? scored[Math.floor(botRand()*Math.min(3,scored.length))] : scored[0];
    return { type:'move', r:choice.m.r, c:choice.m.c };
  }
  // IA fugitiva: llegar al centro gana; si no, maximiza la distancia al cazador más cercano y desempata por distanceToCenter.
  // La distancia se topa en HUNTER_SAFE_DIST (más lejos que eso ya no hay riesgo), así que con margen simplemente avanza al centro.
  // El sprint se guarda para cuando está apurado (o para ganar).
  const HUNTER_SAFE_DIST = 3;
  function botPlanFugitive(idx, profile){
    const bot=state.players[idx], moves=state.validMoves;
    if(!moves.length) return { type:'move', r:bot.r, c:bot.c };
    const hunters = hunterIndexes().map(i=> state.players[i]);
    const evaluated = moves.map(m=>{
      let nearest = Infinity;
      hunters.forEach(h=>{ const d = bfsShortestPath(h.r,h.c,m.r,m.c,state.blockedEdges,state.size); if(d<nearest) nearest = d; });
      const dc = distanceToCenter(m.r,m.c,state.blockedEdges);
      return { m, nearest: Math.min(isFinite(nearest) ? nearest : HUNTER_SAFE_DIST, HUNTER_SAFE_DIST), toCenter: isFinite(dc) ? dc : 99 };
    });
    const win = evaluated.find(e=> e.toCenter===0);
    if(win) return { type:'move', r:win.m.r, c:win.m.c };
    const cmp = (a,b)=> b.nearest-a.nearest || a.toCenter-b.toCenter;
    const plain = evaluated.filter(e=> !e.m.sprint).sort(cmp);
    let list = plain;
    if(!plain.length || plain[0].nearest < HUNTER_SAFE_DIST) list = evaluated.slice().sort(cmp);
    const choice = botRand() < profile.randomness*0.5 ? list[Math.floor(botRand()*Math.min(3,list.length))] : list[0];
    return { type:'move', r:choice.m.r, c:choice.m.c };
  }
  // ---------- Perfiles, voz y explicaciones de la IA (77, 78, 79, 80, 92) ----------
  const BOT_PROFILES = {
    easy:{wallChance:.12,randomness:.55,personality:'speed'},
    normal:{wallChance:.32,randomness:.28,personality:'speed'},
    hard:{wallChance:.58,randomness:.12,personality:'aggressive'},
    expert:{wallChance:.82,randomness:.04,personality:'strategist'},
  };
  // tiempos de "pensar" por personalidad (la velocidad normal sigue en BOT_THINK_MS); el defensivo no pasa de 1,2 s
  const BOT_THINK_BY_PERSONALITY = { aggressive:[400,800], defensive:[900,1200], strategist:[700,1100] };
  // emotes de la IA por personalidad: pared grande, a un paso del centro, o pared del rival que la frena
  const BOT_EMOTES = {
    speed:      { wallBig:'idea',  close:'star',        blocked:'faceSad' },
    aggressive: { wallBig:'laugh', close:'exclamation', blocked:'faceAngry' },
    defensive:  { wallBig:'idea',  close:'exclamation', blocked:'question' },
    strategist: { wallBig:'idea',  close:'stars',       blocked:'dots1' },
  };
  const MINIMAX_BUDGET_MS = 60;
  let MM_ON=true, MM_AW=2, MM_WW=0.3, MM_WALLS=4, MM_MOVES=4, MM_TOTAL=8, MM_REPLY_WALLS=5;
  const ADAPT_MIN = 0.03, ADAPT_MAX = 0.55, ADAPT_STEP = 0.05, ADAPT_START = 0.28;
  let explainOn = readPref('quoridor_explain') !== '0';
  function adaptiveEnabled(){ return readPref('quoridor_adaptive') === '1'; }
  function adaptiveRandomness(){
    const v = parseFloat(readPref('quoridor_adaptive_rand'));
    return isFinite(v) ? Math.min(ADAPT_MAX, Math.max(ADAPT_MIN, v)) : ADAPT_START;
  }
  function adaptiveWallChance(rnd){ return 0.12 + (ADAPT_MAX-rnd)/(ADAPT_MAX-ADAPT_MIN)*0.58; }   // de .12 (principiante) a .70
  function adaptiveLevelPct(){ return Math.round((ADAPT_MAX-adaptiveRandomness())/(ADAPT_MAX-ADAPT_MIN)*100); }
  // Una vez por partida contra la IA: con los últimos 5 resultados, 4 o más victorias suben la exigencia y 1 o menos la bajan.
  function updateAdaptiveAfterGame(){
    const rec = statsData.recentVsCpu || [];
    if(rec.length < 3) return;
    const wins = rec.reduce((s,v)=> s+(v?1:0), 0);
    let rnd = adaptiveRandomness();
    if(wins >= 4) rnd -= ADAPT_STEP;
    else if(wins <= 1) rnd += ADAPT_STEP;
    rnd = Math.round(Math.min(ADAPT_MAX, Math.max(ADAPT_MIN, rnd))*100)/100;
    writePref('quoridor_adaptive_rand', rnd);
  }
  function botProfileFor(idx){
    const bot=state.players[idx], difficulty=bot.difficulty||'easy';
    const profile=Object.assign({}, BOT_PROFILES[difficulty]||BOT_PROFILES.easy);
    if(state.adaptiveOn){
      const rnd = adaptiveRandomness();
      profile.randomness = rnd;
      profile.wallChance = adaptiveWallChance(rnd);
      profile.personality = rnd>0.3 ? 'speed' : (rnd>0.12 ? 'aggressive' : 'strategist');
    }
    if(state.campaign && state.campaignPersonality){
      profile.personality=state.campaignPersonality;
      if(profile.personality==='defensive') profile.wallChance=Math.min(.9,profile.wallChance+.2);
      else if(profile.personality==='aggressive') profile.wallChance=Math.min(.9,profile.wallChance+.1);
      else if(profile.personality==='speed') profile.wallChance=Math.max(.05,profile.wallChance-.1);
    }
    return profile;
  }
  function botEmoteFor(idx,kind){
    const t = BOT_EMOTES[botProfileFor(idx).personality] || BOT_EMOTES.speed;
    return t[kind];
  }
  function wallReason(oppIdx,oldD,newD){
    const o=state.players[oppIdx];
    const who = (state.players.length===2 && !o.isCPU) ? 'tu camino' : 'el camino de '+o.name;
    return `Puse una pared porque ${who} era más corto: de ${oldD} pasó a ${newD} pasos.`;
  }
  function moveReason(after){
    if(after===0) return '¡Llegué al centro!';
    return `Avancé por el camino más corto: me ${after===1 ? 'falta 1 paso' : 'faltan '+after+' pasos'} para el centro.`;
  }

  // ---------- Gestión de paredes (77) ----------
  // La IA sólo gasta una pared si la ganancia alcanza el mínimo de su nivel (2 en Normal, 1 en el resto) y guarda una
  // reserva del 30% de las paredes iniciales hasta que el rival esté a 3 pasos de la meta. A 2 pasos acepta cualquier ganancia.
  function chooseBotWall(idx,bot,oppIdx,oppDist,knownEdges){
    const urgent = oppDist<=2;
    const start = bot.wallsStart || bot.wallsLeft;
    const reserve = Math.ceil(start*0.3);
    if(!urgent && oppDist>3 && bot.wallsLeft<=reserve) return null;
    const cands = collectWallCandidates(oppIdx,oppDist,null,knownEdges,idx);
    if(!cands.length) return null;
    const minGain = urgent ? 1 : (bot.difficulty==='normal' ? 2 : 1);
    const gain = cands[0].gain;
    if(gain<minGain) return null;
    const top = cands.filter(x=>x.gain===gain);
    return top[Math.floor(botRand()*top.length)];
  }

  // ---------- Búsqueda de 2 jugadas (76) ----------
  // Minimax con poda alfa-beta: mis 8 mejores acciones y, por cada una, las 8 mejores respuestas del rival.
  // Evaluación: 2 * distancia del rival - distancia mía + 0,3 * (mis paredes - sus paredes). El 2 sobre la distancia del rival
  // sale de medirlo en el torneo: con peso 1 Experto perdía fuerza en 11x11 (58% contra Difícil) y con 2 sube a 68%-72%. Presupuesto de 60 ms;
  // si no alcanza a evaluar ninguna acción, devuelve null y se usa la heurística de siempre. Sólo Experto en 1v1 clásico.
  function canMinimax(bot){
    return MM_ON && bot.difficulty==='expert' && !state.adaptiveOn && state.ruleset==='classic' && state.players.length===2 && !state.teams && !state.isDaily;
  }
  function wallSlotFreeHypo(r,c,o,extra){
    if(!canPlaceWallSlot(r,c,o)) return false;
    for(const w of extra){
      if(w.r===r && w.c===c) return false;
      if(w.o===o){
        if(o==='h' && w.r===r && Math.abs(w.c-c)===1) return false;
        if(o==='v' && w.c===c && Math.abs(w.r-r)===1) return false;
      }
    }
    return true;
  }
  // Mejor respuesta del rival (la que minimiza mi valor). Poda en cuanto una respuesta ya no deja superar a `alpha`.
  function mmOppReply(mask,size,cen,mPos,oPos,myW,opW,extra,alpha){
    const dm = buildDistMap(mask,size,[cen]);
    const myD = dm[mPos], opD = dm[oPos];
    const r0=(oPos/size)|0, c0=oPos-r0*size, m0=mask[oPos], steps=[];
    for(let k=0;k<4;k++){          // pasos del rival (sin saltos: aproximación; si pisa mi casilla se descarta)
      if(m0&(1<<k)) continue;
      const nr=r0+DIRS4[k][0], nc=c0+DIRS4[k][1];
      if(nr<0||nc<0||nr>=size||nc>=size) continue;
      const nx=nr*size+nc;
      if(nx===mPos) continue;
      steps.push({ pos:nx, key:dm[nx] });
    }
    steps.sort((a,b)=>a.key-b.key);
    const walls=[];
    if(opW>0 && myD>0){            // paredes del rival: sólo las que tocan mis caminos mínimos
      const dag = shortestPathDag(mask,size,dm,mPos);
      const pr=(mPos/size)|0, pc=mPos-pr*size;
      for(let r=Math.max(0,pr-3);r<=Math.min(size-2,pr+3);r++) for(let c=Math.max(0,pc-3);c<=Math.min(size-2,pc+3);c++) for(const o of ['h','v']){
        const we = wallEdges(r,c,o);
        if(!wallHitsDag(we,size,dag)) continue;
        if(!wallSlotFreeHypo(r,c,o,extra)) continue;
        const undo = applyEdgesToMask(mask,size,we);
        let nm, no;
        try{
          nm = bfsToGoal(mask,size,mPos,cen,null);
          no = nm===Infinity ? Infinity : bfsToGoal(mask,size,oPos,cen,null);
        } finally { undoMask(mask,undo); }
        if(nm===Infinity || no===Infinity || nm<=myD) continue;
        walls.push({ nm, no, gain:nm-myD });
      }
      walls.sort((a,b)=>b.gain-a.gain);
    }
    let worst = Infinity;
    for(const s of steps.slice(0,3)){
      const val = s.pos===cen ? -10000 : (MM_AW*s.key - myD + MM_WW*(myW-opW));
      if(val<worst) worst=val;
      if(worst<=alpha) return worst;
    }
    for(const w of walls.slice(0,MM_REPLY_WALLS)){
      const val = MM_AW*w.no - w.nm + MM_WW*(myW-(opW-1));
      if(val<worst) worst=val;
      if(worst<=alpha) return worst;
    }
    if(worst===Infinity) worst = MM_AW*opD - myD + MM_WW*(myW-opW);
    return worst;
  }
  function minimaxDecision(idx,budgetMs){
    const t0=performance.now();
    const size=state.size, cen=centerGoal(), me=state.players[idx], oi=1-idx, opp=state.players[oi];
    if(!opp || !state.validMoves.length) return null;
    const base = edgeMaskFor(state.blockedEdges,size).slice();
    const myStart=me.r*size+me.c, opStart=opp.r*size+opp.c;
    const dm0 = buildDistMap(base,size,[cen]);
    const opD0 = dm0[opStart];
    const moves = state.validMoves.map(m=>({ type:'move', r:m.r, c:m.c, key:dm0[m.r*size+m.c] })).sort((a,b)=>a.key-b.key);
    if(moves[0].key===0) return { type:'move', r:moves[0].r, c:moves[0].c, algo:'minimax', reason:moveReason(0), ms:performance.now()-t0 };
    const walls = me.wallsLeft>0 ? collectWallCandidates(oi,opD0,null,null,idx).slice(0,MM_WALLS) : [];
    const actions = moves.slice(0,Math.max(MM_MOVES,MM_TOTAL-walls.length));
    walls.forEach(w=> actions.push({ type:'wall', r:w.r, c:w.c, orientation:w.orientation, gain:w.gain, newOppDist:w.newOppDist }));
    let bestVal=-Infinity, best=[], evaluated=0;
    for(const a of actions){
      if(evaluated>0 && performance.now()-t0>budgetMs) break;
      let mPos=myStart, undo=null, myW=me.wallsLeft;
      const extra=[];
      if(a.type==='move') mPos = a.r*size+a.c;
      else { undo = applyEdgesToMask(base,size,wallEdges(a.r,a.c,a.orientation)); extra.push({ r:a.r, c:a.c, o:a.orientation }); myW -= 1; }
      let val;
      try{
        val = mPos===cen ? 10000 : mmOppReply(base,size,cen,mPos,opStart,myW,opp.wallsLeft,extra,bestVal-1e-9);
      } finally { if(undo) undoMask(base,undo); }
      evaluated++;
      if(val>bestVal+1e-9){ bestVal=val; best=[a]; }
      else if(Math.abs(val-bestVal)<=1e-9) best.push(a);
    }
    if(!best.length) return null;
    const a = best[Math.floor(botRand()*best.length)];
    const ms = performance.now()-t0;
    if(a.type==='wall') return { type:'wall', r:a.r, c:a.c, orientation:a.orientation, gain:a.gain, algo:'minimax', ms,
      reason:wallReason(oi,opD0,a.newOppDist) };
    return { type:'move', r:a.r, c:a.c, algo:'minimax', ms, reason:moveReason(a.key) };
  }

  function botPlanMove(idx){
    const bot=state.players[idx];
    const profile=botProfileFor(idx);
    if(state.ruleset==='hill') return botPlanHill(idx, profile);
    if(state.ruleset==='hunter') return idx===state.fugitiveIdx ? botPlanFugitive(idx, profile) : botPlanHunter(idx, profile);
    // En niebla de guerra la IA razona sólo con lo que su propio radio (o su memoria) le muestra, nunca con
    // el estado real completo: así no tiene ventaja sobre un humano jugando la misma partida.
    const knownEdges = state.ruleset==='fog' ? botKnownEdges(idx) : state.blockedEdges;
    if(canMinimax(bot) && botRand()>=profile.randomness){
      const mm = minimaxDecision(idx, MINIMAX_BUDGET_MS);
      if(mm) return mm;
    }
    const oppIdx = otherPlayerClosestToCenter(idx, knownEdges);
    if(bot.wallsLeft>0&&oppIdx!=null){
      const myDist=state.teams ? teamEta(teamOf(idx)) : distanceToCenter(bot.r,bot.c,knownEdges,idx), oppDist=distanceToCenter(state.players[oppIdx].r,state.players[oppIdx].c,knownEdges,oppIdx);
      if(oppDist<=myDist+1&&botRand()<profile.wallChance){
        const w = chooseBotWall(idx,bot,oppIdx,oppDist,knownEdges);
        if(w) return { type:'wall', r:w.r, c:w.c, orientation:w.orientation, gain:w.gain, algo:'heurística', reason:wallReason(oppIdx,oppDist,w.newOppDist) };
      }
    }
    const moves=state.validMoves; if(!moves.length)return {type:'move',r:bot.r,c:bot.c};
    if(state.ruleset==='party'){ const detour = botPartyTokenMove(idx, moves); if(detour) return {type:'move',r:detour.r,c:detour.c,algo:'heurística',reason:'Fui a buscar un poder.'}; }
    const scored=moves.map(m=>({m,score:scoreBotMove(idx,m,profile.personality,knownEdges)})).sort((a,b)=>b.score-a.score);
    const choice=botRand()<profile.randomness?scored[Math.floor(botRand()*Math.min(3,scored.length))]:scored[0];
    const after = distanceToCenter(choice.m.r,choice.m.c,knownEdges,idx);
    return {type:'move',r:choice.m.r,c:choice.m.c,algo:'heurística',reason:moveReason(after),after};
  }
  function scheduleBotTurnIfNeeded(){
    if(HEADLESS) return;
    if(!state || state.winner) return;
    const cp = state.players[state.currentPlayerIndex];
    if(!cp || !cp.isCPU) return;
    const myToken = ++botToken;
    // en Contrarreloj la IA piensa menos (300-600 ms en vez de 550-1000 ms); con reloj de ajedrez el tiempo
    // de pensar se descuenta del banco, así que ahí todas piensan igual
    let range = state.ruleset==='blitz' ? BOT_THINK_BLITZ_MS : BOT_THINK_MS;
    if(!state.clockMode && state.ruleset!=='blitz'){
      range = BOT_THINK_BY_PERSONALITY[botProfileFor(state.currentPlayerIndex).personality] || range;
    }
    const thinkMs = range[0] + botRand()*(range[1]-range[0]);
    hintLine.textContent = 'La IA está pensando…';
    hintLine.classList.add('thinking');
    startThinking(state.currentPlayerIndex);
    botTimer = setTimeout(()=>{
      if(myToken!==botToken) return;
      stopThinking();
      if(!state || state.winner) return;
      const idxNow = state.currentPlayerIndex;
      const cpNow = state.players[idxNow];
      if(!cpNow || !cpNow.isCPU) return;
      // reloj de ajedrez: el tiempo de "pensar" simulado se descuenta del banco de la IA (si llega a 0, pierde)
      if(state.clockMode==='chess' && !chargeBotThinkTime(idxNow, thinkMs)) return;
      botAct(idxNow);
    }, thinkMs);
  }
  // Una acción completa de la IA. Aparte del temporizador para poder ejercitarla en las pruebas.
  function botAct(idxNow){
    if(botMaybePie(idxNow)) return;      // regla del pastel: la IA puede quedarse con la posición adelantada
    if(state.ruleset==='party'){
      const forced = botPartyPowers(idxNow);        // puede gastar un poder "gratis" o decidir un Paso doble
      if(forced){ performMove(forced.r, forced.c); return; }
    }
    const t0 = performance.now(), bfs0 = BFS_STATS.calls;
    const decision = botPlanMove(idxNow);
    AI_DEBUG.last = { ms:performance.now()-t0, bfs:BFS_STATS.calls-bfs0, algo:decision.algo||'otra', type:decision.type,
      reason:decision.reason||'', move:state.moveCount||0, seed:state.botSeed };
    updateDebugPanel();
    if(decision.type==='move') performMove(decision.r, decision.c);
    else commitWall(decision.r, decision.c, decision.orientation);
    afterBotAction(idxNow, decision);
  }
  // Después de jugar: explicación en pantalla (80) y reacción con emote según la personalidad (78, 92).
  function afterBotAction(idx,decision){
    if(HEADLESS || !state || state.winner || !state.players[idx]) return;
    const bot = state.players[idx];
    if(explainOn && decision.reason && state.isCpuGame && state.players.length===2 && !state.adaptiveOn
       && (bot.difficulty==='easy' || bot.difficulty==='normal') && (statsData.totalGames||0) < 12){
      hintLine.textContent = '🤖 ' + decision.reason;
    }
    if(idx===1 && state.isCpuGame){
      if(decision.type==='wall' && (decision.gain||0)>=3) cpuReact(botEmoteFor(idx,'wallBig'));
      else if(decision.type==='move' && !state._closeEmoted && distanceToCenter(bot.r,bot.c,state.blockedEdges)===1){
        state._closeEmoted = true;
        cpuReact(botEmoteFor(idx,'close'));
      }
    }
  }
  function chargeBotThinkTime(idx, ms){
    state.clock[idx] = Math.max(0, state.clock[idx] - ms/1000);
    if(state.clock[idx] <= 0){ flagFall(idx); return false; }
    return true;
  }

  // ---------- Panel de depuración (87): se activa con ?debug en la dirección ----------
  const AI_DEBUG = { on: /[?&]debug(=|&|$)/.test(location.search), last:null, el:null };
  function updateDebugPanel(){
    if(!AI_DEBUG.on || HEADLESS) return;
    if(!AI_DEBUG.el){
      const el = document.createElement('div');
      el.id = 'aiDebug';
      el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:9999;max-width:92vw;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.78);color:#9fe870;font:11px/1.35 monospace;pointer-events:none;white-space:pre-wrap';
      document.body.appendChild(el);
      AI_DEBUG.el = el;
    }
    const d = AI_DEBUG.last;
    if(!d){ AI_DEBUG.el.textContent = 'IA: sin jugadas todavía'; return; }
    AI_DEBUG.el.textContent = `IA ${d.algo} · ${d.type==='wall'?'pared':'movimiento'} · jugada ${d.move}\n${d.ms.toFixed(1)} ms · ${d.bfs} BFS · semilla ${d.seed}\n${d.reason}`;
  }

  // ---------- Pista (89) y camino del rival (93) ----------
  const HINT_COST = 15, HINT_MAX = 3, PATH_MAX = 5;
  const hintBtn = document.getElementById('hintBtn');
  const pathBtn = document.getElementById('pathBtn');
  const assistRow = document.getElementById('assistRow');
  const hintGroupEl = document.getElementById('hintGroup');
  const ASSIST_RULESETS = ['classic','blitz','mirror','maze'];   // sin niebla (delataría lo oculto) ni modos con reglas propias
  function assistAllowed(){
    return !!state && !state.winner && state.isCpuGame && state.players.length===2 && !state.isDaily && ASSIST_RULESETS.indexOf(state.ruleset)>=0;
  }
  function updateAssistBtns(){
    if(!assistRow) return;
    const ok = assistAllowed();
    assistRow.classList.toggle('hidden', !ok);
    if(!ok) return;
    const cp = state.players[state.currentPlayerIndex];
    const human = !!cp && !cp.isCPU;
    const hl = HINT_MAX-(state.hintsUsed||0), pl = PATH_MAX-(state.pathUses||0);
    hintBtn.disabled = !human || hl<=0;
    pathBtn.disabled = !human || pl<=0;
    hintBtn.innerHTML = `💡 Pista · ${HINT_COST} 🪙 (${hl})`;
    pathBtn.innerHTML = `👁️ Camino rival (${pl})`;
  }
  function clearHintMarks(){ if(hintGroupEl) hintGroupEl.innerHTML = ''; }
  function computeHint(idx){
    const me = state.players[idx];
    let dec = (state.ruleset==='classic') ? minimaxDecision(idx, 80) : null;
    if(dec) return dec;
    const oppIdx = otherPlayerClosestToCenter(idx);
    const scored = state.validMoves.map(m=>({ m, score:scoreBotMove(idx,m,'strategist') })).sort((a,b)=>b.score-a.score);
    if(!scored.length) return null;
    dec = { type:'move', r:scored[0].m.r, c:scored[0].m.c };
    if(me.wallsLeft>0 && oppIdx!=null){
      const od = distanceToCenter(state.players[oppIdx].r, state.players[oppIdx].c, state.blockedEdges);
      const cands = collectWallCandidates(oppIdx, od, null, null, idx);
      if(cands.length && cands[0].gain>=2) dec = { type:'wall', r:cands[0].r, c:cands[0].c, orientation:cands[0].orientation };
    }
    return dec;
  }
  function drawHint(h){
    const cs = cellSize();
    if(h.type==='move'){
      hintGroupEl.innerHTML = `<circle cx="${(h.c+0.5)*cs}" cy="${(h.r+0.5)*cs}" r="${cs*0.36}" fill="rgba(255,214,10,.28)" stroke="#f5b800" stroke-width="3" stroke-dasharray="6 5"/>`;
    } else {
      const rc = wallRect(h.r,h.c,h.orientation,cs);
      hintGroupEl.innerHTML = `<rect x="${rc.x}" y="${rc.y}" width="${rc.w}" height="${rc.h}" rx="${Math.min(rc.w,rc.h)*0.4}" fill="rgba(255,214,10,.5)" stroke="#f5b800" stroke-width="2.5" stroke-dasharray="5 4"/>`;
    }
  }
  // El anuncio recompensado lo provee la capa nativa a través del puente AndroidAds (ver requestRewardedAd más arriba).
  // Mientras no exista, la pista se paga sólo con monedas.
  function showRewardedAd(cb){
    // cb(true) sólo si el anuncio se completó; los avisos de cierre/fallo los muestra requestRewardedAd.
    requestRewardedAd('hint', ()=> cb(true));
  }
  function deliverHint(payFn){
    if(!state || state.winner || !assistAllowed()) return false;
    const idx = state.currentPlayerIndex;
    if(state.players[idx].isCPU) return false;
    const h = computeHint(idx);
    if(!h){ showToast('Ahora no encuentro una jugada para sugerir.'); return false; }
    if(payFn) payFn();
    state.hintsUsed = (state.hintsUsed||0) + 1;
    drawHint(h);
    hintLine.textContent = h.type==='move'
      ? '💡 Pista: la mejor jugada es moverte a la casilla marcada.'
      : `💡 Pista: poné la pared ${h.orientation==='h'?'horizontal':'vertical'} marcada para frenar al rival.`;
    updateAssistBtns();
    return true;
  }
  if(hintBtn) hintBtn.addEventListener('click', ()=>{
    if(!assistAllowed()) return;
    const idx = state.currentPlayerIndex;
    if(state.players[idx].isCPU) return;
    if((state.hintsUsed||0) >= HINT_MAX){ showToast(`Ya usaste las ${HINT_MAX} pistas de esta partida.`); return; }
    if(wallet.coins >= HINT_COST){
      deliverHint(()=>{ addCoins(-HINT_COST, { silent:true }); });
      return;
    }
    const missing = HINT_COST - wallet.coins;
    if(adsAvailable()){
      showConfirm(`Te faltan ${missing} monedas para una pista. ¿Ver un anuncio para recibirla gratis?`, ()=>{
        showRewardedAd(ok=>{
          if(ok) deliverHint(null);
          else showToast('No se completó el anuncio: no hay pista.');
        });
      });
    } else {
      showToast(`Una pista cuesta ${HINT_COST} monedas y te faltan ${missing}. Ganale a la IA o resolvé el desafío diario para juntar.`);
    }
  });
  function showRivalPath(){
    if(!assistAllowed()) return false;
    const idx = state.currentPlayerIndex;
    if(state.players[idx].isCPU) return false;
    const oi = otherPlayerClosestToCenter(idx);
    if(oi==null) return false;
    const size=state.size, cen=centerGoal(), cs=cellSize();
    const rowsGoal = state.goalMode==='rows';
    const mask = edgeMaskFor(state.blockedEdges,size);
    const dm = rowsGoal ? buildDistMap(mask,size,hillGoalIdx(goalCells(oi))) : liveDistMap(state.blockedEdges,size,'c',[cen]);
    const o = state.players[oi];
    let cur = o.r*size+o.c, guard = 0;
    const pts = [cur];
    while(dm[cur]>0 && guard++<500){
      const r=(cur/size)|0, c=cur-r*size, m=mask[cur];
      let nxt=-1;
      for(let k=0;k<4;k++){
        if(m&(1<<k)) continue;
        const nr=r+DIRS4[k][0], nc=c+DIRS4[k][1];
        if(nr<0||nc<0||nr>=size||nc>=size) continue;
        const nx=nr*size+nc;
        if(dm[nx]===dm[cur]-1){ nxt=nx; break; }
      }
      if(nxt<0) break;
      cur = nxt; pts.push(cur);
    }
    const poly = pts.map(p=> (((p%size)+0.5)*cs).toFixed(1)+','+((((p/size)|0)+0.5)*cs).toFixed(1)).join(' ');
    hintGroupEl.innerHTML = `<polyline points="${poly}" fill="none" stroke="${o.color}" stroke-width="${cs*0.12}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${cs*0.18} ${cs*0.2}" opacity=".85"/>`;
    return true;
  }
  let pathHolding = false;
  function releasePath(){
    if(!pathHolding) return;
    pathHolding = false;
    clearHintMarks();
    updateAssistBtns();
  }
  if(pathBtn){
    pathBtn.addEventListener('pointerdown', e=>{
      e.preventDefault();
      if(pathBtn.disabled || (state && (state.pathUses||0) >= PATH_MAX)) return;
      if(showRivalPath()){ state.pathUses = (state.pathUses||0) + 1; pathHolding = true; }
    });
    ['pointerup','pointercancel','pointerleave'].forEach(ev=> pathBtn.addEventListener(ev, releasePath));
    pathBtn.addEventListener('contextmenu', e=> e.preventDefault());
  }

  // ---------- Momento clave (90): la jugada que más cambió la ventaja en pasos ----------
  const KEY_RULESETS = ['classic','blitz','mirror','maze','fog'];
  function keyMomentsOn(){ return !!state && state.players.length===2 && KEY_RULESETS.indexOf(state.ruleset)>=0 && !state.isDaily; }
  function stepGap(idx){
    const oi = otherPlayerClosestToCenter(idx, state.blockedEdges);
    if(oi==null) return 0;
    const me=state.players[idx], o=state.players[oi];
    return distanceToCenter(o.r,o.c,state.blockedEdges) - distanceToCenter(me.r,me.c,state.blockedEdges);
  }
  function logKeyMoment(idx,type,gapBefore){
    if(HEADLESS || !state.keyMoments) return;
    state.keyMoments.push({ n:(state.moveCount||0)+1, idx, type, swing: stepGap(idx)-gapBefore });
  }
  function keyMomentText(){
    if(!keyMomentsOn() || !state.keyMoments || !state.keyMoments.length) return '';
    let best = null;
    state.keyMoments.forEach(k=>{ if(!best || k.swing>best.swing) best=k; });
    if(!best || best.swing<2) return '';
    const who = state.players[best.idx].name;
    return `Momento clave: en la jugada ${best.n}, ${who} ${best.type==='wall'?'puso una pared':'se movió'} y sacó ${best.swing} pasos de ventaja.`;
  }

  function teamOf(playerId){
    if(state.ruleset!=='teams') return null;
    return (playerId===0 || playerId===2) ? 'A' : 'B';
  }
  function teamMembers(team){ return team==='A' ? [0,2] : [1,3]; }
  // Estadísticas y premios: si el equipo ganador tiene una persona, la victoria se le acredita a ella aunque haya
  // llegado su aliado IA («Yo + IA contra 2 IA»). Sin equipos, o sin IA, es el propio ganador.
  function creditedSlot(p){
    if(!state.teams || !state.isCpuGame) return p.id;
    const human = teamMembers(teamOf(p.id)).find(i=> !state.players[i].isCPU);
    return human!=null ? human : p.id;
  }
  function allyIdxOf(idx){ return (idx+2) % 4; }                // asientos enfrentados: 0-2 y 1-3
  // Reserva compartida (49): cada jugador del equipo ve el saldo del equipo en su wallsLeft.
  function syncTeamWalls(){
    if(!state.teams) return;
    ['A','B'].forEach(k=> state.teams[k].members.forEach(i=>{ state.players[i].wallsLeft = state.teams[k].wallsLeft; }));
  }
  // Pasos que le faltan al equipo para cumplir su objetivo: el que va más adelantado ("primero que llega")
  // o el más rezagado ("llegan los dos"). Los que ya llegaron no cuentan.
  function teamEta(team){
    const ds = teamMembers(team).map(i=> state.players[i]).filter(pl=> !pl.arrived)
      .map(pl=> distanceToCenter(pl.r,pl.c,state.blockedEdges));
    if(!ds.length) return 0;
    return state.teamGoal==='both' ? Math.max(...ds) : Math.min(...ds);
  }
  function finishGame(p, resultTag, reason){
    state.winner = p;
    if(HEADLESS) return;
    state.resultTag = resultTag || null;
    // Cazador y fugitivo: por qué terminó ('caught' atrapado · 'timeout' se acabaron las rondas · 'escaped' llegó al centro)
    state.endReason = reason || (state.ruleset==='hunter' ? 'escaped' : null);
    const winnerTeam = teamOf(p.id);
    const wallsStart = p.wallsStart;
    const wallsUsedByWinner = Math.max(0, wallsStart - p.wallsLeft);
    if(state.campaign){ state.campaignXPReward = awardCampaignXP(state.campaignLevel, p.id===0); }
    stopThinking();
    hideEmoteBar();
    let fresh = [];
    let reward;
    if(state.isDaily){
      const info = dailyInfoOf(state);
      const stars = dailyStars(state.moveCount, state.dailyPar, info.slack);
      const res = recordDailyResult(info.dateKey, state.moveCount, state.dailyPar, { stars, mode:info.id, size:state.size, timeouts:state.dailyTimeouts||0 });
      fresh = res.fresh;
      reward = dailyReward(res, state.moveCount, state.dailyPar, info.dateKey, info.slack);
      reward.streakInfo = res;
    } else {
      fresh = recordGameResult({
        winnerSlot: creditedSlot(p),
        isCpuGame: !!state.isCpuGame,
        cpuDifficulty: (state.isCpuGame && state.players[1]) ? state.players[1].difficulty : null,
        ruleset: state.ruleset,
        size: state.size,
        playersCount: state.players.length,
        wallsUsedByWinner, wallsStart,
        movesUsed: state.moveCount,
        totalMovesThisGame: state.moveCount,
        wallsPlacedThisGame: state.walls.filter(w=>!w.env).length,
        seatInfo: (state.seatMeasured && !(state.pie && state.pie.swapped) && !state.resultTag) ? { firstIdx: state.firstIdx, winnerSeat: state.startSeat[p.id] } : null,
        capturedByHuman: state.ruleset==='hunter' && state.endReason==='caught' && !p.isCPU,
        escapedByHuman: state.ruleset==='hunter' && state.endReason==='escaped' && !p.isCPU,
        campaign: !!state.campaign, adaptive: !!state.adaptiveOn,
      }, { toast:false });
      reward = gameReward(p);
    }
    reward.fresh = fresh;
    state.lastReward = reward;
    if(state.isCpuGame && !state.isDaily) cpuReact(state.players[creditedSlot(p)].isCPU ? 'laugh' : 'faceSad', true);
    clearTurnTimer();
    playWinSound();
    vibrate([0,40,60,40,140]);
    showWinOverlay(p, winnerTeam);
  }
  // ---------- Fiesta: poderes ----------
  // Los eventos (conseguir, activar, terminar, desvanecerse) se juntan y salen en UN solo aviso por jugada;
  // los últimos también quedan escritos bajo los botones de poderes.
  function partyEvent(html){
    if(!state || !state.party) return;
    state.party.pending.push(html);
    state.party.recent.push(html);
    if(state.party.recent.length>3) state.party.recent.shift();
  }
  function partyFlush(){
    if(!state || !state.party || !state.party.pending.length) return;
    const lines = state.party.pending.splice(0);
    showToast('<span>' + lines.join('<br>') + '</span>');
  }
  function partyDist(i, edges){
    const pl = state.players[i];
    return distanceToCenter(pl.r, pl.c, edges || state.blockedEdges);
  }
  function partyStunnable(i){
    const pl = state.players[i];
    return !pl.stunned && !(pl.fx.immune>0) && !(pl.fx.shield>0);
  }
  // A quién aturdiría `idx`: el rival mejor ubicado que se pueda aturdir y que no esté a más de PARTY_STUN_MAX_LEAD pasos detrás.
  // (Así el que va ganando no puede usarlo para hundir a quien viene lejos: el poder es para frenar al que te alcanza.)
  function partyStunTarget(idx){
    const me = partyDist(idx);
    let best = null, bd = Infinity;
    state.players.forEach((pl,i)=>{
      if(i===idx || !partyStunnable(i)) return;
      const d = partyDist(i);
      if(!isFinite(d) || d > me + PARTY_STUN_MAX_LEAD) return;
      if(d<bd){ bd = d; best = i; }
    });
    return best;
  }
  // Pared rival que más le acorta el camino a `idx`. Sólo cuenta si a él le ayuda más que a cualquier rival.
  function partyBreakChoice(idx){
    const edges = state.blockedEdges;
    const myBase = partyDist(idx, edges);
    const rivals = state.players.map((_,i)=> i).filter(i=> i!==idx);
    const rivalBase = rivals.map(i=> partyDist(i, edges));
    let best = null;
    state.walls.forEach((w,wi)=>{
      if(w.env || w.owner==null || w.owner===idx) return;
      const test = new Set(edges);
      wallEdges(w.r,w.c,w.orientation).forEach(e=> test.delete(edgeKey(e[0],e[1],e[2],e[3])));
      const mine = myBase - partyDist(idx, test);
      if(!(mine>=1)) return;
      const theirs = Math.max(0, ...rivals.map((i,k)=> rivalBase[k] - partyDist(i, test)));
      if(!(mine>theirs)) return;
      const net = mine - theirs;
      if(!best || net>best.net || (net===best.net && mine>best.gain)) best = { wallIndex:wi, gain:mine, net };
    });
    return best;
  }
  function partyBreakWall(wi){
    const w = state.walls.splice(wi,1)[0];
    state.occupied[w.r][w.c] = null;
    wallEdges(w.r,w.c,w.orientation).forEach(e=> state.blockedEdges.delete(edgeKey(e[0],e[1],e[2],e[3])));
    edgesEpoch++;
    return w;
  }
  // ¿Puede `p` llevarse este poder? (guardados: máximo PARTY_MAX_HELD y sin repetidos; Pared extra: tope por partida)
  function partyCanTake(p, type){
    const def = PARTY_POWERS[type];
    if(def.kind==='instant'){
      if(type==='pared_extra' && (p.wallBonus||0) >= PARTY_WALL_BONUS_MAX) return { ok:false, reason:`ya sumó el máximo de paredes extra (+${PARTY_WALL_BONUS_MAX})` };
      return { ok:true };
    }
    if(p.powers.indexOf(type)>=0) return { ok:false, reason:`ya tiene ${def.name} guardado` };
    if(p.powers.length>=PARTY_MAX_HELD) return { ok:false, reason:`ya lleva ${PARTY_MAX_HELD} poderes guardados` };
    return { ok:true };
  }
  function maybePickUpPower(p){
    if(state.ruleset!=='party' || !state.powerUp) return false;
    const t = state.powerUp;
    if(p.r!==t.r || p.c!==t.c) return false;
    const def = PARTY_POWERS[t.type], can = partyCanTake(p, t.type), who = escapeHtml(p.name);
    if(!can.ok){
      partyEvent(`${def.emoji} ${who} pisó ${def.name}, pero ${can.reason}. El poder queda en el tablero.`);
      return false;
    }
    if(def.kind==='instant'){
      p.wallsLeft += 1; p.wallsStart += 1; p.wallBonus = (p.wallBonus||0) + 1;
      partyEvent(`${def.emoji} ${who} consiguió ${def.name}: +1 pared (le quedan ${p.wallsLeft}).`);
    } else {
      p.powers.push(t.type);
      partyEvent(`${def.emoji} ${who} guardó ${def.name}. Duración: ${def.duration}.`);
    }
    state.party.stats.picked[t.type] = (state.party.stats.picked[t.type]||0) + 1;
    state.powerUp = null;
    state.party.nextSpawn = state.party.round + PARTY_RESPAWN_MIN + Math.floor(rng()*2);
    return true;
  }

  // Distancias (en pasos, respetando paredes) desde una casilla a todo el tablero.
  function partyDistMap(r0, c0){
    const size = state.size, d = Array.from({length:size}, ()=> Array(size).fill(Infinity));
    d[r0][c0] = 0;
    const q = [[r0,c0]];
    for(let h=0; h<q.length; h++){
      const [r,c] = q[h];
      for(const [dr,dc] of DIRS4){
        const nr=r+dr, nc=c+dc;
        if(nr<0||nc<0||nr>=size||nc>=size || d[nr][nc]!==Infinity || isBlocked(r,c,nr,nc,state.blockedEdges)) continue;
        d[nr][nc] = d[r][c] + 1;
        q.push([nr,nc]);
      }
    }
    return d;
  }
  // Casilla "justa" para un poder nuevo. Se mide el tiempo de llegada de cada ficha (a igual distancia llega antes quien juega antes)
  // y se busca que sean parecidos; si no se puede, es preferible que el poder quede más cerca de quien va atrás que de quien va
  // adelante, nunca al revés (la ventaja del líder pesa el triple). Nunca pegada a una ficha ni al centro, y a lo sumo a
  // PARTY_SPAWN_MAX_DIST pasos de la ficha más cercana para que se pueda disputar antes de que se desvanezca.
  function partyPickSpawnCell(maxDist){
    maxDist = maxDist || PARTY_SPAWN_MAX_DIST;
    const n = state.players.length, cur = state.currentPlayerIndex;
    const maps = state.players.map(pl=> partyDistMap(pl.r, pl.c));
    const toCenter = state.players.map((_,i)=> partyDist(i));
    const bestCenter = Math.min(...toCenter);
    const isLeader = toCenter.map(d=> d===bestCenter);
    const hasOthers = isLeader.some(x=> !x);
    const cands = [];
    for(let r=0;r<state.size;r++) for(let c=0;c<state.size;c++){
      if(Math.abs(r-state.center.r)+Math.abs(c-state.center.c) < 2) continue;
      if(state.players.some(pl=> pl.r===r && pl.c===c)) continue;
      let minD = Infinity, minT = Infinity, maxT = -Infinity, nearest = 0, tLead = Infinity, tOth = Infinity, ok = true;
      for(let i=0;i<n;i++){
        const d = maps[i][r][c];
        if(!isFinite(d)){ ok = false; break; }
        const t = d*n + ((i-cur+n)%n);
        if(d<minD) minD = d;
        if(t<minT){ minT = t; nearest = i; }
        if(t>maxT) maxT = t;
        if(isLeader[i]){ if(t<tLead) tLead = t; } else if(t<tOth) tOth = t;
      }
      if(!ok || minD<2 || minD>maxDist) continue;
      const leadHead = hasOthers ? Math.max(0, tOth - tLead) : 0;      // cuánto antes llega el líder que el resto
      cands.push({ r, c, spread:maxT-minT, leadHead, score:(maxT-minT) + 3*leadHead, nearest });
    }
    if(!cands.length) return null;
    const best = Math.min(...cands.map(x=> x.score));
    const pool = cands.filter(x=> x.score<=best+1);
    return pool[Math.floor(rng()*pool.length)];
  }
  // Prueba con el alcance normal y, si el líder quedaría con ventaja de más de un paso, con un poco más de alcance.
  // Si aun así no hay una casilla pareja, el poder espera a la ronda siguiente (a la tercera espera se tolera hasta 2 pasos de ventaja).
  // Nunca se lo regala al que va adelante: si las posiciones no lo permiten, simplemente no aparece todavía.
  function partyChooseSpawnCell(){
    const n = state.players.length, P = state.party;
    let cell = partyPickSpawnCell(PARTY_SPAWN_MAX_DIST);
    if(!cell || cell.leadHead>n) cell = partyPickSpawnCell(PARTY_SPAWN_MAX_DIST+2) || cell;
    const limit = P.spawnMisses>=2 ? 2*n : n;
    if(!cell || cell.leadHead>limit){ P.spawnMisses += 1; return null; }
    P.spawnMisses = 0;
    return cell;
  }
  // Qué poder sale: al azar con pesos. Si quien más cerca queda es quien va ganando, los poderes de remontada valen la mitad;
  // si es quien va último, el doble. Nunca sale algo que ese jugador no podría llevarse.
  function partyPickType(nearestIdx){
    const dists = state.players.map((_,i)=> partyDist(i));
    const best = Math.min(...dists), worst = Math.max(...dists), me = dists[nearestIdx];
    const isLeader = best<worst && me===best, isLast = best<worst && me===worst;
    const pool = [];
    let total = 0;
    PARTY_TYPES.forEach(k=>{
      const def = PARTY_POWERS[k];
      if(!partyCanTake(state.players[nearestIdx], k).ok) return;
      let w = def.weight;
      if(def.catchUp){ if(isLeader) w *= 0.5; else if(isLast) w *= 2; }
      pool.push({ k, w });
      total += w;
    });
    if(!pool.length) return 'escudo';
    let roll = rng()*total;
    for(const x of pool){ roll -= x.w; if(roll<=0) return x.k; }
    return pool[pool.length-1].k;
  }
  function partySpawn(){
    if(!state.party || state.powerUp) return false;
    const cell = partyChooseSpawnCell();
    if(!cell) return false;
    const type = partyPickType(cell.nearest), def = PARTY_POWERS[type];
    state.powerUp = { r:cell.r, c:cell.c, type, ttl:PARTY_TOKEN_TTL };
    state.party.stats.spawned += 1;
    partyEvent(`✨ Apareció ${def.emoji} ${def.name} en el tablero. Dura ${PARTY_TOKEN_TTL} rondas.`);
    return true;
  }
  // Empieza una ronda nueva (volvió a jugar quien abre): el poder del tablero envejece y, si toca, aparece otro.
  function partyNewRound(){
    const P = state.party;
    P.round += 1;
    if(state.powerUp){
      state.powerUp.ttl -= 1;
      if(state.powerUp.ttl<=0){
        const def = PARTY_POWERS[state.powerUp.type];
        partyEvent(`💨 ${def.emoji} ${def.name} se desvaneció del tablero.`);
        state.powerUp = null;
        P.stats.vanished += 1;
        P.nextSpawn = P.round + PARTY_RESPAWN_MIN + Math.floor(rng()*2);
      }
    }
    if(!state.powerUp && P.round>=P.nextSpawn) partySpawn();
  }
  function partyOnTurnStart(next, prevIndex){
    const P = state.party;
    if(!P) return;
    if(next<=prevIndex) partyNewRound();
    P.usedThisTurn = false;
    const p = state.players[next];
    if(p.fx.shield>0){
      p.fx.shield -= 1;
      if(p.fx.shield===0) partyEvent(`🛡️ Terminó el escudo de ${escapeHtml(p.name)}.`);
    }
    if(p.fx.immune>0) p.fx.immune -= 1;
    p.fx.extra = 0;
  }
  function partyStunSkipped(p){
    if(!state.party) return;
    p.fx.immune = PARTY_STUN_IMMUNE_TURNS;
    partyEvent(`💫 ${escapeHtml(p.name)} está aturdido y pierde este turno. Los próximos ${PARTY_STUN_IMMUNE_TURNS} no se lo puede volver a aturdir.`);
  }

  // ¿Puede `idx` usar `key` ahora? (siempre en su turno, un poder por turno)
  function partyCanUse(idx, key){
    const P = state && state.party;
    if(!P || state.winner || idx!==state.currentPlayerIndex) return { ok:false, reason:'no es tu turno' };
    const p = state.players[idx];
    if(p.powers.indexOf(key)<0) return { ok:false, reason:'no lo tenés guardado' };
    if(key==='paso_doble' && state.sprintArmed) return { ok:true };          // ya armado: el botón lo cancela
    if(P.usedThisTurn) return { ok:false, reason:'ya usaste un poder en este turno' };
    switch(key){
      case 'paso_doble':   return state.validMoves.some(m=> m.sprint) ? { ok:true } : { ok:false, reason:'no hay dos casillas libres en línea recta' };
      case 'turno_extra':  return p.fx.extra ? { ok:false, reason:'ya está activo' } : { ok:true };
      case 'aturdido':     return partyStunTarget(idx)!=null ? { ok:true } : { ok:false, reason:'ningún rival cumple: van muy atrás, ya están aturdidos, inmunes o con escudo' };
      case 'romper_pared': return partyBreakChoice(idx) ? { ok:true } : { ok:false, reason:'ninguna pared rival te estorba más de lo que ayuda a los demás' };
      case 'escudo':       return p.fx.shield>0 ? { ok:false, reason:'ya tenés escudo' } : { ok:true };
    }
    return { ok:false, reason:'poder desconocido' };
  }
  // Usa el poder. Paso doble sólo se arma/desarma (se gasta al hacer el paso). Devuelve true si algo cambió.
  function partyUse(idx, key){
    if(!partyCanUse(idx, key).ok) return false;
    const p = state.players[idx], P = state.party, who = escapeHtml(p.name);
    if(key==='paso_doble'){ state.sprintArmed = !state.sprintArmed; return true; }
    p.powers.splice(p.powers.indexOf(key), 1);
    P.usedThisTurn = true;
    P.stats.used[key] = (P.stats.used[key]||0) + 1;
    if(key==='turno_extra'){
      p.fx.extra = 1;
      partyEvent(`⏩ ${who} activó Turno extra: juega dos acciones seguidas.`);
    } else if(key==='aturdido'){
      const target = state.players[partyStunTarget(idx)];
      target.stunned = true;
      if(!p.isCPU) recordPartyStun();
      partyEvent(`💫 ${who} aturdió a ${escapeHtml(target.name)}: pierde su próximo turno.`);
    } else if(key==='romper_pared'){
      const choice = partyBreakChoice(idx), w = partyBreakWall(choice.wallIndex);
      partyEvent(`🔨 ${who} rompió una pared de ${escapeHtml(state.players[w.owner].name)} y se ahorra ${choice.gain} paso${choice.gain===1?'':'s'}.`);
    } else if(key==='escudo'){
      p.fx.shield = PARTY_SHIELD_ROUNDS;
      partyEvent(`🛡️ ${who} activó Escudo: nadie puede aturdirlo durante ${PARTY_SHIELD_ROUNDS} rondas.`);
    }
    state.sprintArmed = false;
    state.validMoves = computeValidMoves(idx);
    return true;
  }
  function partySpendSprint(p){
    const i = p.powers.indexOf('paso_doble');
    if(i<0 || !state.party) return;
    p.powers.splice(i, 1);
    state.party.usedThisTurn = true;
    state.party.stats.used.paso_doble = (state.party.stats.used.paso_doble||0) + 1;
    partyEvent(`👟 ${escapeHtml(p.name)} usó Paso doble.`);
  }
  // Turno extra: la primera acción no termina el turno; la segunda sí. Devuelve true si el turno sigue.
  function partyKeepTurn(p){
    if(state.ruleset!=='party' || !state.party || !p.fx) return false;
    if(p.fx.extra===1){
      const idx = state.players.indexOf(p);
      if(p.wallsLeft>0 || computeValidMoves(idx).length>0){
        p.fx.extra = 2;
        partyEvent(`⏩ ${escapeHtml(p.name)} juega su acción extra.`);
        return true;
      }
      p.fx.extra = 0;
      return false;
    }
    if(p.fx.extra===2){
      p.fx.extra = 0;
      partyEvent(`⏩ Terminó el turno extra de ${escapeHtml(p.name)}.`);
    }
    return false;
  }
  // Redibuja tras usar un poder sin regalarle tiempo al reloj de turno (render() lo reinicia).
  function partyRerender(){
    syncTurnTimeLeft();
    const left = state.turnTimeLeft;
    render();
    if(left>0 && activeClockKind()==='turn'){ state.turnTimeLeft = left; startTurnTimer(true); }
  }

  // Fichas de estado en la lista de jugadores (poderes guardados y efectos activos)
  function partyTagsHTML(p){
    if(!p.fx) return '';
    let h = '';
    p.powers.forEach(k=>{
      const d = PARTY_POWERS[k];
      h += `<span class="cpu-tag power-tag" title="${escapeHtml(d.name+': '+d.desc+' Duración: '+d.duration+'.')}">${d.emoji}</span>`;
    });
    if(p.fx.shield>0) h += `<span class="cpu-tag power-tag on" title="Escudo: nadie puede aturdirlo (rondas que le quedan)">🛡️ ${p.fx.shield}</span>`;
    if(p.fx.extra>0) h += `<span class="cpu-tag power-tag on" title="Turno extra activo">⏩ ${p.fx.extra===1 ? '+1 acción' : 'última acción'}</span>`;
    if(p.fx.immune>0 && !p.stunned) h += `<span class="cpu-tag power-tag" title="No se lo puede aturdir (turnos que le quedan)">💫✖ ${p.fx.immune}</span>`;
    if(p.wallBonus>0) h += `<span class="cpu-tag power-tag" title="Paredes extra recibidas">🧱+${p.wallBonus}</span>`;
    return h;
  }
  // Barra de poderes bajo los botones de modo: los del jugador que tiene el turno (si es una persona) y el aviso del tablero.
  function updatePowerBar(){
    if(!powerBar) return;
    const on = !!state && state.ruleset==='party' && !!state.party && !state.winner;
    powerBar.classList.toggle('hidden', !on);
    if(!on) return;
    const idx = state.currentPlayerIndex, p = state.players[idx];
    let html = '';
    if(p && !p.isCPU){
      p.powers.forEach(key=>{
        const def = PARTY_POWERS[key], chk = partyCanUse(idx, key);
        const armed = key==='paso_doble' && !!state.sprintArmed;
        const tip = def.name+': '+def.desc+' Duración: '+def.duration+'.'+(chk.ok ? '' : ' Ahora no se puede: '+chk.reason+'.');
        html += `<button type="button" class="kbtn small mode-btn power-btn${armed?' active':''}" data-power="${key}"${chk.ok?'':' disabled'} title="${escapeHtml(tip)}" aria-label="${escapeHtml(tip)}"><img class="btn-ico" src="${emoteIconSrc(def.icon)}" alt=""> ${def.name}</button>`;
      });
    }
    if(!html){
      const held = p && p.powers.length ? p.powers.map(k=> PARTY_POWERS[k].emoji+' '+PARTY_POWERS[k].name).join(', ') : 'ninguno';
      html = `<span class="power-empty">${p && p.isCPU ? escapeHtml(p.name)+' guarda: '+held+'.' : 'No tenés poderes guardados.'}</span>`;
    }
    powerBtns.innerHTML = html;
    const lines = [];
    if(state.powerUp){
      const d = PARTY_POWERS[state.powerUp.type], t = state.powerUp.ttl;
      lines.push(`✨ En el tablero: ${d.emoji} ${d.name} (${d.kind==='instant' ? 'se aplica al instante' : 'se guarda'}). Se desvanece en ${t} ronda${t===1?'':'s'}.`);
    } else {
      lines.push('✨ Ahora no hay ningún poder en el tablero.');
    }
    state.party.recent.slice(-2).forEach(l=> lines.push(l));
    powerNote.innerHTML = lines.map(l=> `<span>${l}</span>`).join('');
  }
  // Ayuda desplegable: qué hace cada poder y cuánto dura
  if(powerHelpList){
    powerHelpList.innerHTML = PARTY_TYPES.map(k=>{
      const d = PARTY_POWERS[k];
      return `<li><b>${d.emoji} ${d.name}</b> <em>${d.kind==='instant' ? 'instantáneo' : 'se guarda'} · dura: ${d.duration}</em><br>${escapeHtml(d.desc)}</li>`;
    }).join('');
  }

  // IA de Fiesta. Gasta un poder cuando de verdad le conviene (sin gastar nada si puede ganar ya) y, en tal caso, sigue con su jugada.
  // Devuelve una jugada sólo cuando la decisión ES un Paso doble; en los demás casos devuelve null y la jugada la elige botPlanMove.
  function botPartyPowers(idx){
    const bot = state.players[idx], P = state.party;
    if(!P || state.winner || P.usedThisTurn || !bot.powers.length) return null;
    const edges = state.blockedEdges;
    if(state.validMoves.some(m=> !m.sprint && distanceToCenter(m.r,m.c,edges)===0)) return null;   // puede ganar: no gasta nada
    const luck = PARTY_BOT_USE[bot.difficulty||'easy'] || 0.5;
    const has = k=> bot.powers.indexOf(k)>=0;
    const dMe = partyDist(idx);
    const oppIdx = otherPlayerClosestToCenter(idx, edges);
    const dOpp = oppIdx!=null ? partyDist(oppIdx) : Infinity;
    // 1) Aturdir: cuando el rival me alcanza o está por ganar
    if(has('aturdido') && rng()<luck){
      const t = partyStunTarget(idx);
      if(t!=null){
        const dT = partyDist(t);
        if(((dT<=dMe && dT<=5) || dT<=2) && partyUse(idx,'aturdido')) return null;
      }
    }
    // 2) Romper pared: si me ahorra camino de verdad (la IA más floja exige más)
    if(has('romper_pared') && rng()<luck){
      const c = partyBreakChoice(idx);
      if(c && c.gain >= ((bot.difficulty||'easy')==='easy' ? 2 : 1) && partyUse(idx,'romper_pared')) return null;
    }
    // 3) Escudo: sólo si algún rival guarda un Aturdir
    if(has('escudo') && bot.fx.shield===0 && rng()<luck && state.players.some((pl,i)=> i!==idx && pl.powers.indexOf('aturdido')>=0)){
      if(partyUse(idx,'escudo')) return null;
    }
    // 4) Turno extra: en la recta final o cuando la carrera está pareja
    if(has('turno_extra') && rng()<luck && (dMe<=3 || dOpp<=dMe)){
      if(partyUse(idx,'turno_extra')) return null;
    }
    // 5) Paso doble: sólo si el salto queda mejor que cualquier paso normal
    if(has('paso_doble') && rng()<luck){
      const sp = state.validMoves.filter(m=> m.sprint);
      const normal = state.validMoves.filter(m=> !m.sprint && !m.push && !m.swap);
      if(sp.length && normal.length){
        const pick = list=> list.map(m=> ({ m, d:distanceToCenter(m.r,m.c,edges) })).sort((a,b)=> a.d-b.d)[0];
        const bs = pick(sp), bn = pick(normal);
        if(bs.d < bn.d) return { type:'move', r:bs.m.r, c:bs.m.c };
      }
    }
    return null;
  }
  // La IA agarra un poder si le queda "de paso" (el desvío no pasa de su margen) y todavía puede llevárselo.
  function botPartyTokenMove(idx, moves){
    const t = state.powerUp;
    if(!t || !state.party) return null;
    const bot = state.players[idx];
    if(!partyCanTake(bot, t.type).ok) return null;
    const edges = state.blockedEdges;
    const dMe = partyDist(idx);
    if(dMe<=2) return null;                                   // cerca de ganar: nada de desvíos
    const b = PARTY_BOT_DETOUR[bot.difficulty||'easy'], budget = b===undefined ? 0 : b;
    const dTok = bfsShortestPath(bot.r, bot.c, t.r, t.c, edges, state.size);
    if(!isFinite(dTok)) return null;
    if(dTok + distanceToCenter(t.r,t.c,edges) > dMe + budget) return null;
    let best = null, bd = Infinity, bc = Infinity;
    moves.forEach(m=>{
      if(m.sprint || m.push || m.swap) return;
      const d = bfsShortestPath(m.r, m.c, t.r, t.c, edges, state.size);
      const dc = distanceToCenter(m.r, m.c, edges);
      if(d<bd || (d===bd && dc<bc)){ best = m; bd = d; bc = dc; }
    });
    return (best && bd<dTok) ? best : null;
  }


  // ---------- Estado serializable (73) ----------
  // blockedEdges (y, en niebla, seen[i]) son Set; el resto es JSON puro. serializeState() devuelve un objeto
  // plano (los Set pasan a {$set:[...]}), apto para JSON.stringify, localStorage, postMessage o un worker.
  // Lo que empieza con «_» (cachés como _hillZone) y la animación pendiente no se guardan: se recalculan.
  function serializeState(src){
    const s = src || state;
    if(!s) return null;
    const data = JSON.parse(JSON.stringify(s, function(k, v){
      if(v instanceof Set) return { $set: Array.from(v) };
      if(k.charAt(0)==='_') return undefined;
      if(k==='anim') return null;
      if(k==='winner' && v && this===s) return { $player: v.id };      // el ganador es una referencia a players[i]
      return v;
    }));
    if(s===state) data.rngState = gameRng.getState();
    return data;
  }
  // Inversa: acepta el objeto o su JSON en texto y devuelve un estado nuevo (no toca el estado activo).
  function deserializeState(data){
    const obj = (typeof data==='string') ? JSON.parse(data) : data;
    const out = JSON.parse(JSON.stringify(obj), (k, v)=> (v && typeof v==='object' && Array.isArray(v.$set)) ? new Set(v.$set) : v);
    if(out.winner && out.winner.$player!=null) out.winner = out.players[out.winner.$player];
    return out;
  }
  // Pone un estado serializado como estado activo (y retoma el generador aleatorio donde estaba).
  function restoreState(data){
    state = deserializeState(data);
    state.anim = null;
    if(state.seed!=null){
      gameRng = mulberry32(state.seed);
      if(typeof state.rngState==='number') gameRng.setState(state.rngState);
    }
    state.validMoves = computeValidMoves(state.currentPlayerIndex);
    return state;
  }

  // ---------- Registro de jugadas (69) ----------
  // state.log = [{p,type,r,c,o,t}]: p jugador · type move|push|swap|sprint|wall · r,c destino (o ranura de la
  // pared) · o orientación (sólo paredes) · t ms desde que empezó la partida. Es todo lo que hace falta
  // para repetir la partida con la misma semilla; la pared reflejada del modo Espejo se deduce de la primera.
  function logAction(type, r, c, o){
    if(!state) return;
    const e = { p: state.currentPlayerIndex, type, r, c };
    if(o) e.o = o;
    e.t = Math.max(0, Date.now() - (state.startedAt || Date.now()));
    (state.log || (state.log = [])).push(e);
  }
  // Resumen compartible: cabecera de la partida + registro.
  function exportGameLog(){
    if(!state) return null;
    return {
      v: 1, size: state.size, ruleset: state.ruleset, seed: state.seed, players: state.players.length,
      objective: state.objective,
      preset: state.walls.filter(w=> w.env).map(w=> ({ r:w.r, c:w.c, o:w.orientation })),
      log: (state.log || []).map(e=> Object.assign({}, e)),
    };
  }

  // ---------- Deshacer (68) ----------
  // Una vez por partida (local y contra la IA), mientras nadie haya jugado después. Sirve en cuanto la persona
  // hace su jugada y hasta que la IA (o el siguiente jugador) mueve. Se apoya en una foto del estado tomada justo
  // antes de la jugada: así vuelven también reloj, poderes, niebla y el generador aleatorio.
  // Desactivado en el desafío diario y en la campaña (y en niebla con 2+ humanos, que revelaría información).
  const UNDO_PER_GAME = 1;
  let undoSnap = null;        // { data, after } · after = moveCount que tiene que haber para que valga
  function undoEnabledFor(ruleset, isDaily, isCampaign, humans){
    if(isDaily || isCampaign) return false;
    if(ruleset==='fog' && humans>=2) return false;
    return true;
  }
  function takeUndoSnapshot(){
    undoSnap = null;
    if(!state || !state.undoEnabled || state.undoLeft<=0 || autoPlayInFlight) return;
    const cp = state.players[state.currentPlayerIndex];
    if(!cp || cp.isCPU) return;
    undoSnap = { data: serializeState(), after: (state.moveCount||0) + 1 };
  }
  function canUndo(){
    return !!state && !state.winner && state.undoEnabled && state.undoLeft>0
      && !!undoSnap && undoSnap.after===(state.moveCount||0);
  }
  function undoLastAction(){
    if(!canUndo()) return false;
    const left = state.undoLeft - 1;
    invalidateBotTimer();                       // si la IA estaba «pensando», su jugada no sale
    clearTurnTimer();
    restoreState(undoSnap.data);
    state.undoLeft = left;
    undoSnap = null;
    mode = 'move';
    hideWallPreview();
    previewSlot = null;
    state.sprintArmed = false;
    vibrate(10);
    render();
    showToast('↩ Jugada deshecha.');
    return true;
  }
  // Gancho para ofrecer un deshacer extra (p. ej. al terminar un anuncio con premio): suma uno a la partida.
  function grantExtraUndo(){
    if(!state || !state.undoEnabled || state.winner) return false;
    state.undoLeft += 1;
    updateUndoBtn();
    return true;
  }
  function updateUndoBtn(){
    if(!undoBtn) return;
    const on = !!state && state.undoEnabled;
    undoBtn.classList.toggle('hidden', !on);
    if(!on) return;
    undoBtn.disabled = !canUndo();
  }
  if(undoBtn) undoBtn.addEventListener('click', ()=>{ undoLastAction(); });

  // ---------- Tope de partida (70) ----------
  // Sin límite propio (clásico, laberinto, espejo…), dos IA con `randomness` pueden oscilar para siempre.
  // A las size*13 acciones (mover + poner pared) gana quien está más cerca de la meta; empata el que tiene
  // más paredes libres. Con equipos se comparan los equipos. Cazador ya tiene su propio límite de rondas.
  const TURN_CAP_MULT = 13;
  function turnCapLimit(){ return state.size * TURN_CAP_MULT; }
  function turnCapWinner(){
    const dist = i=> distanceToCenter(state.players[i].r, state.players[i].c, state.blockedEdges);
    const idxs = state.players.map((pl,i)=> i);
    if(state.teams){
      const score = k=>{
        const ds = teamMembers(k).map(dist);
        return { d: state.teamGoal==='both' ? Math.max.apply(null, ds) : Math.min.apply(null, ds), w: state.teams[k].wallsLeft };
      };
      const a = score('A'), b = score('B');
      const k = (a.d!==b.d) ? (a.d<b.d ? 'A' : 'B') : (a.w!==b.w ? (a.w>b.w ? 'A' : 'B') : 'A');
      return state.players[teamMembers(k).slice().sort((x,y)=> dist(x)-dist(y) || x-y)[0]];
    }
    idxs.sort((x,y)=> dist(x)-dist(y) || state.players[y].wallsLeft-state.players[x].wallsLeft || x-y);
    return state.players[idxs[0]];
  }
  function checkTurnCap(){
    if(!state || state.winner || state.isDaily || state.ruleset==='hunter') return;
    const left = turnCapLimit() - (state.moveCount||0);
    if(left<=0){
      finishGame(turnCapWinner(), null, 'turnCap');
      return;
    }
    if(left===state.players.length*2 && !state.capWarned){
      state.capWarned = true;
      showToast(`⏳ Quedan ${left} acciones: si nadie llega, gana quien esté más cerca del centro.`);
    }
  }

  function performMove(r,c){
    if(state.winner) return;
    const idx = state.currentPlayerIndex;
    const p = state.players[idx];
    takeUndoSnapshot();                                          // deshacer (68): foto antes de la jugada
    if(!autoPlayInFlight && !p.isCPU) state.timeoutStreak = 0;   // una persona jugó: se corta la racha de vencimientos
    // ¿la casilla elegida es un empujón? (la jugada guarda a dónde se desliza el rival)
    const gapBeforeKM = keyMomentsOn() ? stepGap(idx) : 0;
    const chosen = state.validMoves.find(m=> m.r===r && m.c===c);
    logAction(chosen && chosen.push ? 'push' : chosen && chosen.swap ? 'swap' : chosen && chosen.sprint ? 'sprint' : 'move', r, c);
    const pushTo = (state.ruleset==='hill' && chosen && chosen.push) ? chosen.push : null;
    // 2v2: intercambio con el aliado. Ambos cambian de casilla (deslizan como en el empujón) y se gasta el turno.
    if(chosen && chosen.swap){
      const ally = state.players.find(pl=> pl!==p && !pl.arrived && pl.r===r && pl.c===c);
      if(ally){
        state.anim = { pusher: idx, pushed: state.players.indexOf(ally), pusherFrom:{ r:p.r, c:p.c }, pushedFrom:{ r:ally.r, c:ally.c } };
        ally.r = p.r; ally.c = p.c;
      }
    }
    if(pushTo){
      const rival = state.players.find(pl=> pl!==p && pl.r===r && pl.c===c);
      // datos para la animación: cada ficha desliza desde donde estaba (render() los consume una sola vez)
      state.anim = { pusher: idx, pushed: state.players.indexOf(rival), pusherFrom:{ r:p.r, c:p.c }, pushedFrom:{ r:rival.r, c:rival.c } };
      rival.r = pushTo.r; rival.c = pushTo.c;
      rival.hillTurns = 0;                                  // ser empujado reinicia el conteo del rival
      p.pushesLeft = Math.max(0, (p.pushesLeft||0) - 1);
      state.lastPush[idx] = state.players.indexOf(rival);   // no se lo puede volver a empujar en el turno siguiente
    } else if(state.lastPush){
      state.lastPush[idx] = null;                           // cualquier otra acción libera la restricción
    }
    // Cazador y fugitivo: huellas y sprint (el paso doble deja huella también en la casilla del medio)
    if(state.ruleset==='hunter' && idx===state.fugitiveIdx){
      ageTrail();
      if(chosen && chosen.sprint){
        dropTrail(p.r+(r-p.r)/2, p.c+(c-p.c)/2);
        p.sprints = Math.max(0, (p.sprints||0) - 1);
      }
      dropTrail(p.r, p.c);
    }
    if(state.ruleset==='party' && chosen && chosen.sprint) partySpendSprint(p);
    p.r = r; p.c = c;
    if(keyMomentsOn()) logKeyMoment(idx,'move',gapBeforeKM);
    state.moveCount = (state.moveCount||0) + 1;
    maybePickUpPower(p);
    if(checkWinAfterMove(p)){
      state.winner = p;
      render(idx);
      finishGame(p);
      return;
    }
    if(state.teams && p.arrived){
      const ally = state.players[allyIdxOf(idx)];
      showToast(`✅ ${escapeHtml(p.name)} llegó al centro. Falta ${escapeHtml(ally.name)}.`);
    }
    settleClock(idx);                              // reloj de ajedrez: descuenta lo gastado y suma el incremento
    // Captura por adyacencia: sólo cuenta la jugada de un cazador
    if(state.ruleset==='hunter' && idx!==state.fugitiveIdx && isCaptureAdjacent(r,c)){
      state.winner = p;
      state.resultTag = 'huntersWin';
      state.endReason = 'caught';
      render(idx);
      finishGame(p, 'huntersWin', 'caught');
      return;
    }
    if(pushTo){ playWallSound(); vibrate(25); }   // el empujón suena como una pared, con un golpe más largo
    else { playMoveSound(); vibrate(12); }
    if(partyKeepTurn(p)){                          // Fiesta: Turno extra, la jugada no termina el turno
      state.sprintArmed = false;
      state.validMoves = computeValidMoves(idx);
      mode = 'move';
      render(idx);
      return;
    }
    advanceTurn();
    checkHunterTimeout();
    checkTurnCap();
    render(idx);
  }

  function commitWall(r,c,orientation){
    if(state.winner) return false;
    const cpWall = state.players[state.currentPlayerIndex];
    const evalRes = (cpWall && cpWall.wallsLeft<=0) ? { valid:false, reason:'noWalls' } : evaluateWallForMode(r,c,orientation);
    if(!evalRes.valid){
      // En niebla de guerra el preview pudo verse válido con lo poco que el jugador ve; si el estado real
      // lo rechaza (pared oculta u otra razón), no delatamos el motivo: mensaje neutro y esa ranura queda vista.
      if(state.ruleset==='fog'){
        const viewerIdx = fogViewerIndex();
        if(viewerIdx!=null){ ensureFogMemory(); state.seen[viewerIdx].add(wallSlotKey(r,c,orientation)); }
        hintLine.textContent = 'No se pudo colocar la pared ahí.';
        if(activeClockKind()!=='turn') render();   // evita reiniciar sin querer un reloj de turno a mitad de jugada
        if(!cpWall.isCPU) vibrate(ERROR_VIBRATION);
      } else if(cpWall && !cpWall.isCPU){
        hintLine.textContent = wallReasonText(evalRes.reason) || 'No se pudo colocar la pared ahí.';
        vibrate(ERROR_VIBRATION);
      }
      return false;
    }
    const cp = state.players[state.currentPlayerIndex];
    takeUndoSnapshot();                                           // deshacer (68): foto antes de la jugada
    logAction('wall', r, c, orientation);
    if(!autoPlayInFlight && !cp.isCPU) state.timeoutStreak = 0;   // una persona jugó: se corta la racha de vencimientos
    const cpuOpp = (state.isCpuGame && !cp.isCPU && state.players[1]) ? state.players[1] : null;
    const gapBefore = cpuOpp ? distanceToCenter(cpuOpp.r, cpuOpp.c, state.blockedEdges, cpuOpp.id) - distanceToCenter(cp.r, cp.c, state.blockedEdges, cp.id) : 0;
    const gapBeforeKM = keyMomentsOn() ? stepGap(state.currentPlayerIndex) : 0;
    state.occupied[r][c] = orientation;
    evalRes.edges.forEach(e=> state.blockedEdges.add(edgeKey(e[0],e[1],e[2],e[3])));
    edgesEpoch++;
    state.walls.push({ r, c, orientation, color: cp.color, owner: state.currentPlayerIndex });
    if(keyMomentsOn()) logKeyMoment(state.currentPlayerIndex,'wall',gapBeforeKM);
    if(evalRes.mirrorEdges){
      const m = mirrorSlot(r,c);
      state.occupied[m.r][m.c] = orientation;
      evalRes.mirrorEdges.forEach(e=> state.blockedEdges.add(edgeKey(e[0],e[1],e[2],e[3])));
      edgesEpoch++;
      state.walls.push({ r:m.r, c:m.c, orientation, color: cp.color });
    }
    if(cpuOpp){
      // si la pared del humano le sacó 3 o más de ventaja a la IA, la IA se enoja (con enfriamiento largo)
      const gapAfter = distanceToCenter(cpuOpp.r, cpuOpp.c, state.blockedEdges, cpuOpp.id) - distanceToCenter(cp.r, cp.c, state.blockedEdges, cp.id);
      if(gapAfter - gapBefore >= 3) cpuReact(botEmoteFor(1,'blocked'));
    }
    if(state.hunterPool!=null && state.currentPlayerIndex!==state.fugitiveIdx){
      state.hunterPool -= 1;      // los cazadores gastan del pozo común
      syncHunterPool();
    } else if(state.teams){
      state.teams[teamOf(cp.id)].wallsLeft -= 1;   // reserva compartida: la pared la paga el equipo
      syncTeamWalls();
    } else {
      cp.wallsLeft -= 1;
    }
    if(state.ruleset==='hunter' && state.currentPlayerIndex===state.fugitiveIdx) ageTrail();   // poner pared también es un turno del fugitivo
    if(state.lastPush) state.lastPush[state.currentPlayerIndex] = null;
    state.moveCount = (state.moveCount||0) + 1;
    playWallSound();
    vibrate(18);
    if(state.ruleset==='hill' && updateHillProgress(cp)){
      state.winner = cp;
      render();
      finishGame(cp);
      return true;
    }
    settleClock(state.currentPlayerIndex);        // reloj de ajedrez: descuenta lo gastado y suma el incremento
    if(partyKeepTurn(cp)){                        // Fiesta: Turno extra, la pared no termina el turno
      state.sprintArmed = false;
      state.validMoves = computeValidMoves(state.currentPlayerIndex);
      mode = 'move';
      render();
      return true;
    }
    advanceTurn();
    checkHunterTimeout();
    checkTurnCap();
    render();
    return true;
  }

  // ---------- Contrarreloj: reloj por turno y reloj de ajedrez ----------
  // Un solo motor para los dos relojes. Guarda el vencimiento (Date.now) y refresca cada 100 ms:
  //  · "turn":  cada turno arranca con state.turnTimeSeconds (mover o poner pared, da igual). Al vencer se
  //             juega solo un paso (nunca una pared) y, tras TIMEOUT_PAUSE_STREAK vencimientos seguidos, se pausa.
  //  · "chess": cada jugador tiene un banco (state.clock[i], en segundos) que sólo corre en su turno y gana
  //             CLOCK_INCREMENT_SECONDS por jugada. Quien llega a 0 pierde (sin jugada automática).
  // state.turnTimeLeft es siempre lo que le queda al reloj activo: por eso los overlays y el pasar la app a
  // segundo plano pueden frenarlo y retomarlo después con startTurnTimer(true).
  const TIMER_TICK_MS = 100;
  let turnTimerInterval = null;
  let timerDeadline = 0;        // Date.now() en que vence el reloj que está corriendo
  let timerOwner = -1;          // jugador dueño de ese reloj
  let lastTickSec = null;       // último segundo entero anunciado (el tic y la vibración suenan una vez por segundo)
  let autoPlayInFlight = false; // la jugada que se está haciendo la eligió el reloj, no una persona

  function turnSeconds(){ return (state && state.turnTimeSeconds>0) ? state.turnTimeSeconds : 0; }
  function activeClockKind(){
    if(!state || state.winner) return null;
    if(state.clockMode==='chess' && state.clock) return 'chess';
    return turnSeconds()>0 ? 'turn' : null;
  }
  function clockTotalSeconds(kind){ return kind==='chess' ? CLOCK_BANK_SECONDS : turnSeconds(); }
  function fmtClock(sec){
    const s = Math.max(0, Math.ceil(sec));
    return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
  }

  // Pasa lo que ya transcurrió del reloj que corre a state.turnTimeLeft (y al banco, en ajedrez).
  function syncTurnTimeLeft(){
    if(!turnTimerInterval || !state) return;
    const left = Math.max(0, (timerDeadline - Date.now())/1000);
    state.turnTimeLeft = left;
    if(state.clockMode==='chess' && state.clock && timerOwner>=0) state.clock[timerOwner] = left;
  }
  function haltTurnTimer(){
    if(turnTimerInterval){ clearInterval(turnTimerInterval); turnTimerInterval = null; }
  }
  function clearTurnTimer(){
    haltTurnTimer();
    turnTimerBadge.classList.add('hidden');
  }
  function startTurnTimer(keep){
    clearTurnTimer();
    if(!state || state.winner) return;
    const kind = activeClockKind();
    if(!kind) return;
    const idx = state.currentPlayerIndex, cp = state.players[idx];
    if(kind==='chess') state.turnTimeLeft = state.clock[idx];
    else if(!(keep && state.turnTimeLeft>0)) state.turnTimeLeft = turnSeconds();
    // la IA no corre reloj de verdad (en ajedrez se le descuenta su tiempo de pensar al mover), y con la app
    // en segundo plano el reloj espera: al volver se retoma con startTurnTimer(true)
    if(!cp || cp.isCPU || document.hidden){ updateClockUI(); return; }
    timerOwner = idx;
    timerDeadline = Date.now() + state.turnTimeLeft*1000;
    lastTickSec = Math.ceil(state.turnTimeLeft);
    turnTimerBadge.classList.remove('hidden');
    turnTimerInterval = setInterval(tickTurnTimer, TIMER_TICK_MS);
    updateClockUI();
  }
  function tickTurnTimer(){
    if(!state || state.winner){ clearTurnTimer(); return; }
    syncTurnTimeLeft();
    const left = state.turnTimeLeft;
    const sec = Math.ceil(left);
    if(sec!==lastTickSec){
      lastTickSec = sec;
      if(sec>=1 && sec<=CLOCK_LOW_SECONDS){
        // últimos 5 s: tic cada vez más agudo (5 s → 530 Hz … 1 s → 890 Hz) y, en los últimos 3, vibración corta
        playTone(440 + (CLOCK_LOW_SECONDS + 1 - sec)*90, 0.09, 'square', 0.08);
        if(sec<=CLOCK_VIBRATE_SECONDS) vibrate(15);
      }
    }
    updateClockUI();
    if(left<=0) onClockExpired();
  }
  function onClockExpired(){
    haltTurnTimer();
    if(state.clockMode==='chess'){ flagFall(timerOwner); return; }
    // reloj por turno: se juega solo un paso; con 2 vencimientos seguidos se pausa para no dejar la partida sola
    state.timeoutStreak = (state.timeoutStreak||0) + 1;
    const mustPause = state.timeoutStreak >= TIMEOUT_PAUSE_STREAK;
    playTone(200, 0.22, 'square', 0.13);
    vibrate(40);
    if(state.isDaily){
      // desafío diario (una sola ficha): el reloj NO juega por vos, porque el paso automático sería siempre el óptimo.
      // Se pierde el turno y cuenta como un movimiento más.
      state.moveCount = (state.moveCount||0) + 1;
      state.dailyTimeouts = (state.dailyTimeouts||0) + 1;
      advanceTurn();
      render();
      if(mustPause) pauseForInactivity();
      else showToast('⏱️ Se acabó el tiempo: perdés el turno (+1 movimiento).');
      return;
    }
    autoPlayInFlight = true;
    try{ autoPlayBestMove(); } finally { autoPlayInFlight = false; }
    if(!state || state.winner) return;
    if(mustPause) pauseForInactivity();
    else showToast('⏱️ Se acabó el tiempo: se jugó el paso más directo al centro.');
  }
  // Al vencer el reloj por turno se juega SOLO el paso que más acerca al centro. Nunca se coloca una pared
  // ni se gasta un empujón en automático (si no hay ningún paso posible, simplemente pasa el turno).
  function autoPlayBestMove(){
    if(!state || state.winner) return;
    const moves = state.validMoves;
    if(!moves.length){ advanceTurn(); render(); return; }
    const plain = moves.filter(m=> !m.push && !m.sprint && !m.swap);   // el reloj no gasta empujones ni sprints por el jugador
    const scored = (plain.length ? plain : moves).map(m=> ({ m, d: distanceToCenter(m.r, m.c, state.blockedEdges, state.currentPlayerIndex) }));
    scored.sort((a,b)=> a.d-b.d);
    performMove(scored[0].m.r, scored[0].m.c);
  }
  function pauseForInactivity(){
    state.timeoutStreak = 0;     // al continuar vuelven a tener 2 oportunidades
    pauseNotice.textContent = 'Se acabó el tiempo ' + TIMEOUT_PAUSE_STREAK + ' veces seguidas sin que nadie jugara, así que pausamos la partida. Tocá Continuar cuando quieras seguir.';
    pauseNotice.classList.remove('hidden');
    openOverlay('pause');
  }

  // Reloj de ajedrez: el jugador `idx` terminó su jugada (mover o pared) → se le descuenta lo gastado y se le suman 3 s.
  function settleClock(idx){
    if(!state || state.clockMode!=='chess' || !state.clock) return;
    if(turnTimerInterval && timerOwner===idx) syncTurnTimeLeft();
    haltTurnTimer();
    state.clock[idx] = Math.max(0, state.clock[idx]) + CLOCK_INCREMENT_SECONDS;
  }
  // Se cayó la bandera: pierde `idx` y gana el otro jugador (el reloj de ajedrez es sólo de 2 jugadores).
  function flagFall(idx){
    if(!state || state.winner) return;
    haltTurnTimer();
    state.clock[idx] = 0;
    const winner = state.players.find((pl,i)=> i!==idx);
    state.flagLoser = idx;
    state.resultTag = 'flag';
    state.winner = winner;
    render();                       // pinta el estado final (ya no corre ningún reloj)
    finishGame(winner, 'flag');
  }

  // Anillo SVG alrededor de la ficha activa: se vacía con stroke-dashoffset a medida que pasa el tiempo.
  function clockRingMarkup(p,i,cx,cy,cs){
    if(state.winner || i!==state.currentPlayerIndex || p.isCPU || !activeClockKind()) return '';
    const rad = cs*0.53, circ = 2*Math.PI*rad, w = Math.max(3, cs*0.05);
    const c = circ.toFixed(2);
    const rot = `transform="rotate(-90 ${cx} ${cy})"`;      // arranca a las 12 en punto
    return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${p.color}" stroke-width="${w}" opacity="0.2" class="clock-ring-track"/>`
      + `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${p.color}" stroke-width="${w}" stroke-dasharray="${c} ${c}" stroke-dashoffset="0" data-circ="${c}" ${rot} class="clock-ring" style="--w:${w}px"/>`;
  }
  // Refresca badge, anillo y barras sin volver a dibujar el tablero (lo llama cada tick).
  function updateClockUI(){
    if(!state) return;
    const kind = activeClockKind();
    if(!kind) return;
    const left = Math.max(0, state.turnTimeLeft || 0);
    const low = left <= CLOCK_LOW_SECONDS;
    if(turnTimerInterval){
      turnTimerBadge.classList.toggle('low', low);
      turnTimerBadge.textContent = kind==='chess' ? `⏱️ ${fmtClock(left)}` : `⏱️ ${Math.ceil(left)}s`;
    }
    const ring = piecesEl.querySelector('.clock-ring');
    if(ring){
      const circ = +ring.getAttribute('data-circ');
      const frac = Math.min(1, left / clockTotalSeconds(kind));
      ring.setAttribute('stroke-dashoffset', (circ*(1-frac)).toFixed(2));
      ring.classList.toggle('low', low);
    }
    if(kind==='chess'){
      playersListEl.querySelectorAll('.clock-line').forEach(el=>{
        const t = Math.max(0, state.clock[+el.dataset.pid] || 0);
        el.querySelector('.clock-fill').style.width = Math.min(100, t/CLOCK_BANK_SECONDS*100).toFixed(1) + '%';
        const label = fmtClock(t), txt = el.querySelector('.clock-time');
        if(txt.textContent!==label){ txt.textContent = label; el.setAttribute('aria-valuenow', String(Math.ceil(t))); }
        el.classList.toggle('low', t <= CLOCK_LOW_SECONDS);
      });
    }
  }

  // Al pasar la app a segundo plano el reloj se frena (guardando lo que quedaba) y la IA deja de pensar;
  // al volver se retoma exactamente donde estaba, así la jugada no se hace sola mientras no estabas mirando.
  document.addEventListener('visibilitychange', ()=>{
    if(!state || state.winner || gameScreen.classList.contains('hidden')) return;
    if(document.hidden){
      invalidateBotTimer();
      syncTurnTimeLeft();          // guarda turnTimeLeft (y el banco) con lo que quedaba
      clearTurnTimer();
    } else if(overlayStack.length===0){
      scheduleBotTurnIfNeeded();
      startTurnTimer(true);
      updateHunterBadge();
    }
  });

  // ---------- shapes ----------
  function pieceMarkup(shape,cx,cy,size,color,extraClass){
    const half = size/2;
    switch(shape){
      case 'square':
        return `<rect x="${cx-half}" y="${cy-half}" width="${size}" height="${size}" rx="${size*0.18}" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1.5" filter="url(#pieceShadow)" class="${extraClass}"/>`;
      case 'triangle': {
        const h = size*0.95;
        const pts = `${cx},${cy-h*0.62} ${cx-h*0.62},${cy+h*0.42} ${cx+h*0.62},${cy+h*0.42}`;
        return `<polygon points="${pts}" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1.5" filter="url(#pieceShadow)" class="${extraClass}"/>`;
      }
      case 'diamond': {
        const h = size*0.68;
        const pts = `${cx},${cy-h} ${cx+h},${cy} ${cx},${cy+h} ${cx-h},${cy}`;
        return `<polygon points="${pts}" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1.5" filter="url(#pieceShadow)" class="${extraClass}"/>`;
      }
      case 'star': {
        const outerR = size*0.56, innerR = outerR*0.42;
        const pts = [];
        for(let i=0;i<10;i++){
          const ang = -Math.PI/2 + i*Math.PI/5;
          const rr = i%2===0 ? outerR : innerR;
          pts.push(`${cx+rr*Math.cos(ang)},${cy+rr*Math.sin(ang)}`);
        }
        return `<polygon points="${pts.join(' ')}" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1.5" filter="url(#pieceShadow)" class="${extraClass}"/>`;
      }
      case 'hex': {
        const rr = size*0.58;
        const pts = [];
        for(let i=0;i<6;i++){
          const ang = Math.PI/6 + i*Math.PI/3;
          pts.push(`${cx+rr*Math.cos(ang)},${cy+rr*Math.sin(ang)}`);
        }
        return `<polygon points="${pts.join(' ')}" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1.5" filter="url(#pieceShadow)" class="${extraClass}"/>`;
      }
      default:
        return `<circle cx="${cx}" cy="${cy}" r="${half}" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1.5" filter="url(#pieceShadow)" class="${extraClass}"/>`;
    }
  }
  function smallShapeSVG(shape,color,size){
    const s = size, half = s/2;
    switch(shape){
      case 'square': return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><rect x="1" y="1" width="${s-2}" height="${s-2}" rx="3" fill="${color}"/></svg>`;
      case 'triangle': return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><polygon points="${half},2 ${s-2},${s-2} 2,${s-2}" fill="${color}"/></svg>`;
      case 'diamond': return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><polygon points="${half},1 ${s-1},${half} ${half},${s-1} 1,${half}" fill="${color}"/></svg>`;
      case 'star': {
        const outerR = half-1, innerR = outerR*0.42;
        const pts = [];
        for(let i=0;i<10;i++){
          const ang = -Math.PI/2 + i*Math.PI/5;
          const rr = i%2===0 ? outerR : innerR;
          pts.push(`${(half+rr*Math.cos(ang)).toFixed(2)},${(half+rr*Math.sin(ang)).toFixed(2)}`);
        }
        return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><polygon points="${pts.join(' ')}" fill="${color}"/></svg>`;
      }
      case 'hex': {
        const rr = half-1;
        const pts = [];
        for(let i=0;i<6;i++){
          const ang = Math.PI/6 + i*Math.PI/3;
          pts.push(`${(half+rr*Math.cos(ang)).toFixed(2)},${(half+rr*Math.sin(ang)).toFixed(2)}`);
        }
        return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><polygon points="${pts.join(' ')}" fill="${color}"/></svg>`;
      }
      default: return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="${half}" cy="${half}" r="${half-1}" fill="${color}"/></svg>`;
    }
  }

  // Puntos (y áreas de toque) de las jugadas válidas del jugador activo.
  function movesMarkup(cs){
    let movesHTML = '';
    let pushArrowsHTML = '';   // se dibujan sobre las fichas: la casilla de un empujón está ocupada por el rival
    const activePlayer = state.players[state.currentPlayerIndex];
    if(!state.winner && activePlayer && !activePlayer.isCPU){
      for(const m of state.validMoves){
        if(!!m.sprint !== !!state.sprintArmed) continue;    // los sprints sólo se ven con el botón armado (y entonces no se ven los pasos normales)
        const cx=(m.c+0.5)*cs, cy=(m.r+0.5)*cs;
        if(m.push){
          // flecha en la dirección en que sale despedido el rival (no es un paso: no lleva el punto normal)
          const ang = Math.atan2(m.push.r-m.r, m.push.c-m.c) * 180 / Math.PI;
          const u = cs*0.2;
          const pts = [[-1.3,-.36],[.2,-.36],[.2,-.95],[1.5,0],[.2,.95],[.2,.36],[-1.3,.36]].map(([x,y])=> `${(x*u).toFixed(1)},${(y*u).toFixed(1)}`).join(' ');
          pushArrowsHTML += `<g transform="translate(${cx} ${cy}) rotate(${ang.toFixed(1)})" class="move-dot push-arrow"><polygon points="${pts}" fill="${activePlayer.color}" stroke="rgba(255,255,255,.92)" stroke-width="2" stroke-linejoin="round"/></g>`;
        } else if(m.swap){
          // ⇄ sobre la ficha del aliado (va con las flechas: se dibuja por encima de las fichas)
          pushArrowsHTML += `<g class="move-dot push-arrow" pointer-events="none"><circle cx="${cx}" cy="${cy}" r="${cs*0.3}" fill="${activePlayer.color}" opacity="0.92" stroke="rgba(255,255,255,.92)" stroke-width="2"/>`
            + `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${cs*0.42}" font-weight="700" fill="#fff">⇄</text></g>`;
        } else if(m.sprint){
          const isz = cs*0.46;
          movesHTML += `<circle cx="${cx}" cy="${cy}" r="${cs*0.3}" fill="${activePlayer.color}" opacity="0.22" class="move-dot"/>`
            + `<image href="${emoteIconSrc('exclamations')}" x="${cx-isz/2}" y="${cy-isz/2}" width="${isz}" height="${isz}" class="move-dot" pointer-events="none"/>`;
        } else {
          movesHTML += `<circle cx="${cx}" cy="${cy}" r="${cs*0.16}" fill="${activePlayer.color}" class="move-dot" opacity="0.8"/>`;
        }
        movesHTML += `<rect data-r="${m.r}" data-c="${m.c}" x="${m.c*cs}" y="${m.r*cs}" width="${cs}" height="${cs}" fill="transparent" pointer-events="all" style="--tint:${activePlayer.color}" class="valid-move-hit"/>`;
      }
    }
    return { moves: movesHTML, arrows: pushArrowsHTML };
  }

  // ---------- render ----------
  // Niebla suave (tarea 47): una máscara con gradiente radial que sigue a la ficha del visor, en vez de
  // un corte brusco por casilla. Sólo se actualizan cx/cy/r; la transición de 150ms la hace el CSS.
  function updateFogOverlay(cs, viewerPlayer, rad){
    if(!fogOverlayEl || !fogMaskHoleEl) return;
    if(!viewerPlayer){ fogOverlayEl.setAttribute('opacity','0'); return; }
    const cx=(viewerPlayer.c+0.5)*cs, cy=(viewerPlayer.r+0.5)*cs, r=(rad+0.55)*cs;
    fogMaskHoleEl.setAttribute('cx', cx);
    fogMaskHoleEl.setAttribute('cy', cy);
    fogMaskHoleEl.setAttribute('r', r);
    fogOverlayEl.setAttribute('opacity','1');
  }

  function render(justMovedIndex){
    if(HEADLESS) return;
    clearHintMarks();
    const cs = cellSize();
    updateAllFogMemory();
    const fogViewer = fogViewerIndex();
    const fogViewerPlayer = fogViewer!=null ? state.players[fogViewer] : null;
    const fogRad = fogViewerPlayer ? fogRadius() : null;

    let gridHTML = `<rect x="0" y="0" width="${BOARD_PX}" height="${BOARD_PX}" fill="var(--board)"/>`;
    for(let r=0;r<state.size;r++){
      for(let c=0;c<state.size;c++){
        if((r+c)%2===1){
          gridHTML += `<rect x="${c*cs}" y="${r*cs}" width="${cs}" height="${cs}" fill="var(--board-alt)"/>`;
        }
      }
    }
    for(let i=1;i<state.size;i++){
      gridHTML += `<line x1="${i*cs}" y1="0" x2="${i*cs}" y2="${BOARD_PX}" stroke="var(--line)" stroke-width="1"/>`;
      gridHTML += `<line x1="0" y1="${i*cs}" x2="${BOARD_PX}" y2="${i*cs}" stroke="var(--line)" stroke-width="1"/>`;
    }
    if(state.ruleset==='hill'){
      // la zona se tiñe del color de quien la sostiene; la casilla de cada ocupante, un poco más fuerte
      const holderIdx = hillHolderIndex();
      const holder = holderIdx!=null ? state.players[holderIdx] : null;
      hillCells().forEach(cell=>{
        const occ = state.players.find(pl=> pl.r===cell.r && pl.c===cell.c);
        const owner = occ || holder;
        const fill = owner ? owner.color : 'var(--accent)';
        const op = occ ? 0.32 : (holder ? 0.2 : 0.14);
        gridHTML += `<rect x="${cell.c*cs}" y="${cell.r*cs}" width="${cs}" height="${cs}" fill="${fill}" opacity="${op}" class="hill-cell"/>`;
      });
    }
    if(state.goalMode==='rows'){
      // Clásico oficial: cada jugador tiene una franja de su color en el borde que debe alcanzar
      state.players.forEach((pl,i)=>{
        goalCells(i).forEach(g=>{
          gridHTML += `<rect x="${g.c*cs}" y="${g.r*cs}" width="${cs}" height="${cs}" fill="${pl.color}" opacity="0.16" class="goal-cell"/>`;
        });
        const side = state.goalSides[i], B = BOARD_PX, t = 5;
        const edge = side==='bottom' ? [0,B-t,B,t] : side==='top' ? [0,0,B,t] : side==='left' ? [0,0,t,B] : [B-t,0,t,B];
        gridHTML += `<rect x="${edge[0]}" y="${edge[1]}" width="${edge[2]}" height="${edge[3]}" fill="${pl.color}" opacity="0.9" class="goal-edge"/>`;
      });
    } else {
      const ccx=(state.center.c+0.5)*cs, ccy=(state.center.r+0.5)*cs;
      gridHTML += `<circle cx="${ccx}" cy="${ccy}" r="15" fill="none" stroke="var(--accent)" stroke-width="3" class="center-glow"/>`;
    }
    gridEl.innerHTML = gridHTML;

    const activePlayer = state.players[state.currentPlayerIndex];
    const marks = movesMarkup(cs);
    const pushArrowsHTML = marks.arrows;   // se dibujan sobre las fichas
    movesEl.innerHTML = marks.moves;

    let wallsHTML = '';
    for(const w of state.walls){
      let wallOpacity = 1;
      if(fogViewerPlayer){
        const dist = Math.max(Math.abs(w.r-fogViewerPlayer.r), Math.abs(w.c-fogViewerPlayer.c));
        if(dist > fogRad){
          const remembered = state.seen && state.seen[fogViewer] && state.seen[fogViewer].has(wallSlotKey(w.r,w.c,w.orientation));
          if(!remembered) continue;   // nunca vista: no se dibuja
          wallOpacity = FOG_SEEN_OPACITY;   // vista alguna vez, ahora fuera de radio: se dibuja tenue
        }
      }
      const rect = wallRect(w.r,w.c,w.orientation,cs);
      const rx = rect.h>rect.w ? rect.w*0.4 : rect.h*0.4;
      const look = w.env ? 'fill="url(#stoneTex)" stroke="#2b2620" stroke-width="1.6"' : `fill="${w.color}" stroke="rgba(0,0,0,0.3)" stroke-width="1"`;
      wallsHTML += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="${rx}" ${look} opacity="${wallOpacity}"${w.env ? ' class="map-wall"' : ''}/>`;
    }
    if(state.ruleset==='party' && state.powerUp){
      const pc=(state.powerUp.c+0.5)*cs, pr=(state.powerUp.r+0.5)*cs;
      const pdef = PARTY_POWERS[state.powerUp.type];
      const isz = cs*0.5, ttl = state.powerUp.ttl;
      const badgeR = cs*0.17;
      wallsHTML += `<g class="power-token${ttl<=1 ? ' fading' : ''}"><title>${escapeHtml(pdef.name+': '+pdef.desc+' Se desvanece en '+ttl+(ttl===1?' ronda.':' rondas.'))}</title>`
        + `<circle cx="${pc}" cy="${pr}" r="${cs*0.32}" fill="var(--accent)" opacity="0.25" class="spin"/>`
        + `<image href="${emoteIconSrc(pdef.icon)}" x="${pc-isz/2}" y="${pr-isz/2}" width="${isz}" height="${isz}"/>`
        + `<circle cx="${pc+cs*0.3}" cy="${pr+cs*0.3}" r="${badgeR}" fill="var(--ink)" stroke="var(--panel)" stroke-width="1.5"/>`
        + `<text x="${pc+cs*0.3}" y="${pr+cs*0.3}" text-anchor="middle" dominant-baseline="central" font-size="${cs*0.22}" font-weight="700" fill="var(--panel)">${ttl}</text></g>`;
    }
    wallsEl.innerHTML = wallsHTML;

    let piecesHTML = '';
    // huellas del fugitivo (Cazador y fugitivo): puntos que se apagan a medida que envejecen
    if(state.ruleset==='hunter' && state.trail && state.trail.length){
      const fug = state.players[state.fugitiveIdx];
      state.trail.forEach(t=>{
        if(state.players.some(pl=> pl.r===t.r && pl.c===t.c)) return;
        const tx=(t.c+0.5)*cs, ty=(t.r+0.5)*cs, a = t.life>=HUNTER_TRAIL_LIFE ? 0.8 : 0.4;
        piecesHTML += `<g opacity="${a}" pointer-events="none"><circle cx="${tx-cs*0.09}" cy="${ty+cs*0.05}" r="${cs*0.075}" fill="${fug.color}" class="trail-dot"/><circle cx="${tx+cs*0.09}" cy="${ty-cs*0.05}" r="${cs*0.075}" fill="${fug.color}" class="trail-dot"/></g>`;
      });
    }
    const anim = state.anim; state.anim = null;   // la animación del empujón se reproduce una sola vez
    state.players.forEach((p,i)=>{
      if(fogViewerPlayer && i!==fogViewer){
        const dist = Math.max(Math.abs(p.r-fogViewerPlayer.r), Math.abs(p.c-fogViewerPlayer.c));
        if(dist > fogRad){
          const echo = state.echo && state.echo[fogViewer] && state.echo[fogViewer][i];
          if(echo){
            const ex=(echo.c+0.5)*cs, ey=(echo.r+0.5)*cs, eSize=cs*0.5;
            const eOp = echo.life>=FOG_ECHO_LIFE ? 0.4 : 0.2;
            piecesHTML += `<g opacity="${eOp}" pointer-events="none" class="fog-echo">${pieceMarkup(p.shape, ex, ey, eSize, p.color, '')}</g>`;
          }
          return;   // fuera del radio de niebla: la ficha real no se dibuja
        }
      }
      const cx=(p.c+0.5)*cs, cy=(p.r+0.5)*cs;
      const size = cs*0.58;
      let g = '';
      const tm = teamOf(p.id);
      if(p.arrived){
        // llegó al centro y espera a su aliado: queda en miniatura en una esquina de la casilla central
        const k = state.players.filter((q,j)=> q.arrived && j<i).length;
        const off = (k===0 ? -1 : 1) * cs*0.2, mx = cx+off, my = cy+off, ms = size*0.55;
        if(tm) g += teamRingMarkup(tm, mx, my, ms);
        g += pieceMarkup(p.shape, mx, my, ms, p.color, '');
        piecesHTML += g;
        return;
      }
      if(tm) g += teamRingMarkup(tm, cx, cy, size);
      if(i===state.currentPlayerIndex && !state.winner){
        g += `<circle cx="${cx}" cy="${cy}" r="${size*0.72}" fill="none" stroke="${p.color}" stroke-width="2.5" class="turn-ring"/>`;
      }
      if(state.ruleset==='hill') g += hillArcMarkup(p, cx, cy, cs);
      g += clockRingMarkup(p, i, cx, cy, cs);
      const popped = (i===justMovedIndex) || (anim && (i===anim.pusher || i===anim.pushed));
      // el atacante entra un poco después que el rival (clase "late")
      g += pieceMarkup(p.shape, cx, cy, size, p.color, popped ? 'piece-pop' + (anim && i===anim.pusher ? ' late' : '') : '');
      if(p.stunned){
        const sz = cs*0.46;
        g += `<image href="${emoteIconSrc('swirl')}" x="${cx-sz/2}" y="${cy-size*0.95-sz/2}" width="${sz}" height="${sz}" pointer-events="none"/>`;
      }
      if(state.ruleset==='party' && p.fx){
        if(p.fx.shield>0) g += `<circle cx="${cx}" cy="${cy}" r="${size*0.9}" fill="none" stroke="#4da3ff" stroke-width="2.5" stroke-dasharray="5 4" class="shield-ring" pointer-events="none"/>`;
        if(p.fx.extra>0){
          const sz2 = cs*0.4;
          g += `<image href="${emoteIconSrc('star')}" x="${cx+size*0.35}" y="${cy-size*0.95-sz2/2}" width="${sz2}" height="${sz2}" pointer-events="none"/>`;
        }
      }
      if(anim && (i===anim.pusher || i===anim.pushed)){
        const from = (i===anim.pusher) ? anim.pusherFrom : anim.pushedFrom;
        const dx = (from.c - p.c) * cs, dy = (from.r - p.r) * cs;
        g = `<g class="piece-slide${i===anim.pusher ? ' late' : ''}" style="--dx:${dx}px;--dy:${dy}px">${g}</g>`;
      }
      piecesHTML += g;
    });
    piecesEl.innerHTML = piecesHTML + pushArrowsHTML;
    updateFogOverlay(cs, fogViewerPlayer, fogRad);


    updateHeader();
    updateSidePanel();
    updateDistChips();
    partyFlush();
    updateModeUI();
    scheduleBotTurnIfNeeded();
    startTurnTimer();
    updateHunterBadge();
    renderEmotes();
  }
  function updateHunterBadge(){
    // Sólo maneja el contador del modo Cazador. El reloj de turno (Contrarreloj / niveles con
    // tiempo) administra su propio badge en startTurnTimer/clearTurnTimer, así que acá no lo tocamos.
    if(!state || state.ruleset!=='hunter' || state.winner) return;
    if(turnTimerInterval) return; // hay un reloj de turno corriendo: tiene prioridad sobre el badge
    const remaining = Math.max(0, state.hunterRoundLimit - hunterRoundsDone());
    turnTimerBadge.classList.remove('hidden');
    turnTimerBadge.classList.toggle('low', remaining<=2);
    turnTimerBadge.textContent = `🏃 Ronda ${hunterRoundNow()}/${state.hunterRoundLimit}`;
  }

  function updateHeader(){
    if(state.winner){
      if(state.resultTag==='huntersWin'){
        const fug = state.players[state.fugitiveIdx];
        turnIndicator.textContent = state.endReason==='timeout'
          ? 'Se acabó el tiempo: ganan los cazadores'
          : `¡${fug.name} fue atrapado por ${state.winner.name}!`;
        turnIndicator.style.color = state.winner.color;
        return;
      }
      if(state.resultTag==='flag' && state.players[state.flagLoser]){
        turnIndicator.textContent = `¡${state.players[state.flagLoser].name} se quedó sin tiempo! Ganó ${state.winner.name}`;
        turnIndicator.style.color = state.winner.color;
        return;
      }
      if(state.endReason==='turnCap'){
        turnIndicator.textContent = `Tope de partida: ganó ${state.winner.name} por cercanía`;
        turnIndicator.style.color = state.winner.color;
        return;
      }
      const team = teamOf(state.winner.id);
      turnIndicator.textContent = team ? (state.teamGoal==='both' ? `¡Equipo ${team} ganó! Llegaron los dos` : `¡Equipo ${team} ganó! (${state.winner.name})`) : `¡${state.winner.name} ganó!`;
      turnIndicator.style.color = state.winner.color;
      return;
    }
    const cp = state.players[state.currentPlayerIndex];
    if(state.isDaily){
      const di = dailyInfoOf(state);
      turnIndicator.textContent = `${di.emoji||'📌'} Desafío #${di.number} · ${di.label} · ${state.moveCount||0} mov. · par ${state.dailyPar}`;
      turnIndicator.style.color = cp.color;
      return;
    }
    const team = teamOf(cp.id);
    turnIndicator.textContent = team ? `Turno de ${cp.name} (Equipo ${team})` : `Turno de ${cp.name}`;
    turnIndicator.style.color = cp.color;
  }

  // Anillo de equipo (48): 3 px, color del equipo (A continuo, B punteado) con un halo fino para que se lea sobre cualquier tablero.
  function teamRingMarkup(team, cx, cy, size){
    const ts = TEAM_STYLE[team], r = (size*0.6).toFixed(1);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ts.halo}" stroke-width="${TEAM_RING_PX+2.5}" pointer-events="none"/>`
      + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ts.color}" stroke-width="${TEAM_RING_PX}"${ts.dash ? ` stroke-dasharray="${ts.dash}"` : ''} pointer-events="none" class="team-ring"/>`;
  }

  // Marcador de equipos: rótulo, progreso (0/2, 1/2 si deben llegar los dos) y reserva común de paredes.
  function updateTeamHud(){
    if(!teamHudEl) return;
    teamHudEl.classList.toggle('hidden', !state.teams);
    if(!state.teams){ teamHudEl.innerHTML = ''; return; }
    const turnTeam = state.winner ? teamOf(state.winner.id) : teamOf(state.currentPlayerIndex);
    teamHudEl.innerHTML = ['A','B'].map(k=>{
      const t = state.teams[k];
      const arrived = t.members.filter(i=> state.players[i].arrived).length;
      const prog = state.teamGoal==='both'
        ? `<span class="team-prog" title="Aliados que ya llegaron al centro">🏁 ${arrived}/2</span>`
        : '<span class="team-prog" title="Gana el primero que llegue">🏁 1º</span>';
      return `<div class="team-chip team-${k}${turnTeam===k ? ' active' : ''}"><i class="team-dot"></i><b>Equipo ${k}</b>${prog}<span class="team-walls" title="Reserva de paredes compartida">🧱 ${t.wallsLeft}</span></div>`;
    }).join('');
  }

  function updateSidePanel(){
    const now = Date.now();
    updateTeamHud();
    playersListEl.innerHTML = state.players.map((p,i)=>{
      const active = (i===state.currentPlayerIndex && !state.winner);
      const bg = active ? hexToRgba(p.color,0.12) : 'transparent';
      const diffN = p.difficulty==='expert' ? 4 : (p.difficulty==='hard' ? 3 : (p.difficulty==='normal' ? 2 : 1));
      const cpuTag = p.isCPU ? `<span class="cpu-tag">IA <span class="stars-row">${starsHTML(diffN,diffN===4?4:3,10)}</span></span>` : '';
      const team = teamOf(p.id);
      const teamTag = team ? `<span class="cpu-tag team-tag team-${team}"><i class="team-dot"></i>Equipo ${team}</span>` : '';
      const arrivedTag = p.arrived ? '<span class="cpu-tag">🏁 llegó</span>' : '';
      const stunTag = p.stunned ? `<span class="cpu-tag"><img src="${emoteIconSrc('swirl')}" alt="">aturdido</span>` : '';
      const partyTag = state.ruleset==='party' ? partyTagsHTML(p) : '';
      const hillTag = (state.ruleset==='hill')
        ? `<span class="cpu-tag">⛰️ ${p.hillTurns||0}/${hillTargetTurns()}</span><span class="cpu-tag" title="Empujones que le quedan"><img src="${emoteIconSrc('anger')}" alt="Empujones">${p.pushesLeft||0}</span>`
        : '';
      const isFug = state.ruleset==='hunter' && i===state.fugitiveIdx;
      const hunterTag = (state.ruleset==='hunter')
        ? (isFug ? `<span class="cpu-tag">🏃 fugitivo</span><span class="cpu-tag" title="Sprints que le quedan"><img src="${emoteIconSrc('exclamations')}" alt="Sprints">${p.sprints||0}</span>` : '<span class="cpu-tag">🏹 cazador</span>')
        : '';
      const sharedWalls = !!state.teams || (state.ruleset==='hunter' && state.hunterPool!=null && !isFug && hunterIndexes().length>1);
      const chess = state.clockMode==='chess' && state.clock;
      const clockLine = chess
        ? `<div class="clock-line${state.clock[i]<=CLOCK_LOW_SECONDS?' low':''}" data-pid="${i}" role="progressbar" aria-label="Reloj de ${escapeHtml(p.name)}" aria-valuemin="0" aria-valuemax="${CLOCK_BANK_SECONDS}" aria-valuenow="${Math.ceil(Math.max(0,state.clock[i]))}"><span class="clock-track"><span class="clock-fill" style="width:${Math.min(100, Math.max(0,state.clock[i])/CLOCK_BANK_SECONDS*100).toFixed(1)}%"></span></span><span class="clock-time">${fmtClock(state.clock[i])}</span></div>`
        : '';
      const emoteBtn = p.isCPU ? '' :
        `<button type="button" class="emote-btn ${(emoteCooldown[i]||0)>now?'cooldown':''}" data-pid="${i}" aria-label="Emotes de ${escapeHtml(p.name)}"><img src="${emoteIconSrc('faceHappy')}" alt=""></button>`;
      return `<li class="player-row ${active?'active':''}${chess?' has-clock':''}" style="--pc:${p.color}; --pc-bg:${bg}">
        <span class="row-icon">${smallShapeSVG(p.shape,p.color,22)}</span>
        <span class="player-name">${escapeHtml(p.name)}${cpuTag}${teamTag}${arrivedTag}${stunTag}${partyTag}${hillTag}${hunterTag}</span>
        <span class="wall-count">${p.wallsLeft} <span class="wall-label">${sharedWalls ? 'del equipo' : 'paredes'}</span></span>
        ${emoteBtn}
        ${clockLine}
      </li>`;
    }).join('');
  }

  // ---------- win overlay ----------
  function showWinOverlay(p, team){
    const kmText = keyMomentText();
    winKeyMoment.textContent = kmText;
    winKeyMoment.classList.toggle('hidden', !kmText);
    const rw = state.lastReward || { coins:0, fresh:[], note:'', stars:0 };
    winTitle.style.color = p.color;
    winCard.style.setProperty('--wc', p.color);
    if(state.isDaily){
      const par = state.dailyPar, used = state.moveCount, di = dailyInfoOf(state);
      winTitle.textContent = '¡Desafío diario resuelto!';
      winMsg.textContent = `${di.emoji||''} #${di.number} · ${di.label}: lo resolviste en ${used} movimiento${used===1?'':'s'} (par: ${par}). ${used<=par ? '¡Igualaste el par!' : 'Volvé mañana por un nuevo desafío.'}`;
    } else if(state.resultTag==='flag' && state.players[state.flagLoser]){
      winTitle.textContent = `¡${p.name} ganó!`;
      winMsg.textContent = `${state.players[state.flagLoser].name} se quedó sin tiempo en el reloj de ajedrez.`;
    } else if(state.endReason==='turnCap'){
      const cap = turnCapLimit();
      winTitle.textContent = team ? `¡Equipo ${team} ganó por cercanía!` : `¡${p.name} ganó por cercanía!`;
      winMsg.textContent = `Se llegó al tope de ${cap} acciones sin que nadie alcanzara la meta. Gana quien estaba más cerca del centro; si hay empate, quien conservaba más paredes.`;
    } else if(state.ruleset==='hunter'){
      const fug = state.players[state.fugitiveIdx];
      if(state.endReason==='caught'){
        winTitle.textContent = `¡Atrapado por ${p.name}!`;
        winMsg.textContent = `${fug.name} no pudo escapar: ${p.name} lo alcanzó en la ronda ${hunterRoundOfLastAction()} de ${state.hunterRoundLimit}.`;
      } else if(state.endReason==='timeout'){
        winTitle.textContent = 'Se acabó el tiempo';
        winMsg.textContent = `${fug.name} no llegó al centro en ${state.hunterRoundLimit} rondas: ganan los cazadores.`;
      } else {
        winTitle.textContent = `¡${p.name} escapó!`;
        winMsg.textContent = `Llegó al centro en la ronda ${hunterRoundOfLastAction()} de ${state.hunterRoundLimit}, antes de que lo atraparan.`;
      }
    } else if(state.goalMode==='rows' && !state.campaign){
      winTitle.textContent = `¡${p.name} ganó!`;
      winMsg.textContent = `${p.name} llegó primero al lado opuesto del tablero.`;
    } else if(state.ruleset==='hill'){
      winTitle.textContent = `¡${p.name} ganó!`;
      winMsg.textContent = `Se mantuvo ${hillTargetTurns()} turnos seguidos en la zona central. ¡Rey de la colina!`;
    } else {
      winTitle.textContent = team ? `¡Equipo ${team} ganó!` : `¡${p.name} ganó!`;
      if(state.campaign){
        winMsg.textContent = p.id===0
          ? `¡Ganaste la etapa ${state.campaignLevel}! +${state.campaignXPReward||0} XP. ${campaignProgressText()}`
          : `${p.name} ganó esta etapa. Podés intentarlo de nuevo cuando quieras.`;
      } else {
        winMsg.textContent = team ? (state.teamGoal==='both' ? `${state.players[teamMembers(team)[0]].name} y ${state.players[teamMembers(team)[1]].name} llegaron al centro.` : `${p.name} llegó primero al centro para su equipo.`) : 'Podés jugar otra ronda con la misma configuración o cambiar los ajustes.';
      }
    }
    // estrellas (desafío diario: según el par)
    if(state.isDaily){
      winStars.innerHTML = starsHTML(rw.stars || dailyStars(state.moveCount, state.dailyPar, dailyInfoOf(state).slack), 3, 44);
      winStars.classList.remove('hidden');
    } else {
      winStars.classList.add('hidden');
      winStars.innerHTML = '';
    }
    // premios: monedas con cuenta animada, cofre y trofeos nuevos
    let html = '';
    if(rw.coins>0) html += `<div class="reward-line"><img class="coin" src="${emoteIconSrc('cash')}" alt=""><span>+<span id="winCoinCount">0</span></span></div>`;
    if(rw.chest){
      html += rw.chest.item
        ? `<div class="reward-medal">${emoteHTML(rw.chest.item.icon, currentFrame(), 26)}<span>¡Cofre de la semana! Emote nuevo: ${escapeHtml(rw.chest.item.name)}</span></div>`
        : `<div class="reward-medal"><img src="${emoteIconSrc('cash')}" alt=""><span>¡Cofre de la semana! +${rw.chest.coins} monedas extra</span></div>`;
    }
    const fresh = rw.fresh || [];
    if(fresh.length){
      const strip = fresh.slice(0,5).map(a=> `<img src="${medalSrc(a.medal)}" alt="">`).join('');
      html += `<div class="reward-medal"><span class="medal-strip">${strip}</span><span>${fresh.length===1 ? 'Trofeo nuevo: ' + escapeHtml(fresh[0].name) : fresh.length + ' trofeos nuevos'}<br><small>Reclamalo${fresh.length===1?'':'s'} en Trofeos</small></span></div>`;
    }
    const si = rw.streakInfo;
    if(si){
      html += `<div class="reward-streak">🔥 Racha: ${si.streak} día${si.streak===1?'':'s'}</div>`;
      if(si.protectedDays && si.protectedDays.length) html += `<div class="reward-streak shield">🛡️ ¡Tu racha se salvó! Un escudo cubrió ${si.protectedDays.length===1 ? '1 día' : si.protectedDays.length+' días'} sin jugar.</div>`;
      if(si.broken) html += `<div class="reward-streak">Tu racha anterior se cortó: empezaste una nueva.</div>`;
      if(si.earnedShield) html += `<div class="reward-streak shield">🛡️ ¡Escudo de racha ganado! Cubre un día que no puedas jugar (${si.shields}/${DAILY_SHIELD_MAX}).</div>`;
      else if(si.shieldCapped) html += `<div class="reward-streak shield">🛡️ Ya tenés el máximo de escudos (${DAILY_SHIELD_MAX}).</div>`;
    }
    if(rw.note) html += `<p class="reward-note">${escapeHtml(rw.note)}</p>`;
    winRewards.innerHTML = html;
    shareDailyBtn.classList.toggle('hidden', !state.isDaily);
    if(rw.coins>0) countUp(document.getElementById('winCoinCount'), 0, rw.coins, 900);
    renderWinGoal();
    refreshWinDouble();
    renderWinMapInfo();
    openOverlay('win');
    if(!state.players[creditedSlot(p)].isCPU) starRain();
  }
  function renderWinMapInfo(){
    const mi = state && state.mazeInfo;
    winMapInfo.classList.toggle('hidden', !mi);
    repeatMapBtn.classList.toggle('hidden', !mi);
    if(mi) winMapInfo.textContent = 'Mapa: '+mi.name+' · semilla '+mi.seedText;
  }
  function hideWinOverlay(){
    closeOverlay('win');
  }

  // ---------- game setup ----------
  function initGame(playersCount, size, options){
    options = options || {};
    invalidateBotTimer();
    clearTurnTimer();
    undoSnap = null;
    seedGame(options.seed!=null ? options.seed : newMazeSeed());   // 71: toda la aleatoriedad de la partida sale de esta semilla
    clearEmotes();
    hideEmoteBar();
    const mid = (size-1)/2;
    const slots = {
      top:{r:0,c:mid}, right:{r:mid,c:size-1}, bottom:{r:size-1,c:mid}, left:{r:mid,c:0}
    };
    let order;
    if(playersCount===1) order=['top'];
    else if(playersCount===2) order=['top','bottom'];
    else if(playersCount===3) order=['top','right','bottom'];
    else order=['top','right','bottom','left'];

    const ruleset = options.ruleset || 'classic';
    const isDaily = !!options.isDaily;
    const wallsEach = isDaily ? 0 : wallsPerPlayer(size, playersCount, !!options.campaign);   // campaña y diario conservan la fórmula anterior
    const names = options.names || loadPlayerNames();
    const isCpu = !!options.isCpu;
    const difficulty = options.difficulty || 'easy';
    const customPlayers = Array.isArray(options.playerConfigs) && options.playerConfigs.length===playersCount ? options.playerConfigs : null;
    const objective = (options.objective && Number.isInteger(options.objective.r) && Number.isInteger(options.objective.c))
      ? { r:Math.max(0,Math.min(size-1,options.objective.r)), c:Math.max(0,Math.min(size-1,options.objective.c)) }
      : { r:mid, c:mid };

    // Cazador y fugitivo: contra la IA el humano es siempre el jugador 0 y elige rol; la IA ocupa el otro puesto.
    const fugitiveIdx = (ruleset==='hunter' && isCpu && !customPlayers && options.hunterRole==='hunter') ? 1 : 0;
    // pozo compartido de los cazadores (no aplica a niveles del editor, que traen sus propias paredes)
    const hunterPoolOn = ruleset==='hunter' && !isDaily && !customPlayers;
    const hunterPool = wallsEach * HUNTER_POOL_MULT;
    // Contrarreloj: tiempo por turno (por defecto 10 + tamaño) y reloj de ajedrez (sólo de 2 jugadores)
    const isBlitzPlain = ruleset==='blitz' && !options.isCustomLevel && !isDaily;
    let turnTimeSeconds = Math.max(0, +options.turnTimeSeconds || 0);
    if(!turnTimeSeconds && isBlitzPlain) turnTimeSeconds = blitzDefaultSeconds(size);
    const clockMode = (isBlitzPlain && options.clockMode==='chess' && playersCount===2) ? 'chess' : null;

    // 2v2 (50, 51): objetivo del equipo y sorteo de quién abre. Los niveles del editor traen sus propias reglas de paredes.
    const isTeams = ruleset==='teams' && playersCount===4;
    const teamGoal = (isTeams && options.teamGoal==='both') ? 'both' : 'first';
    const startTeam = isTeams ? ((options.startTeam==='A' || options.startTeam==='B') ? options.startTeam : (rng()<0.5 ? 'A' : 'B')) : 'A';

    // Primer turno (62): se sortea quién abre y se mide por asiento. No aplica a 2v2 (tiene su propio sorteo),
    // Cazador y fugitivo (roles fijos), diario, campaña ni niveles del editor.
    const plainRace = !isTeams && ruleset!=='hunter' && !isDaily && !options.campaign && !options.isCustomLevel && !customPlayers && playersCount>=2;
    let firstIdx = 0;
    if(isTeams) firstIdx = startTeam==='B' ? 1 : 0;
    else if(Number.isInteger(options.firstIdx) && options.firstIdx>=0 && options.firstIdx<playersCount) firstIdx = options.firstIdx;
    else if(plainRace && lotteryOn) firstIdx = Math.floor(rng()*playersCount);
    const lotteryApplied = plainRace && lotteryOn && !isTeams && options.firstIdx==null;
    const goalMode = ruleset==='official' ? 'rows' : 'center';
    const goalSides = order.map(k=> GOAL_OPPOSITE[k]);
    const pieEnabled = pieOn && plainRace && playersCount===2 && (ruleset==='classic' || ruleset==='official') && !options.noPie;

    const players = order.map((slotKey,i)=>{
      const skin = pieceSkins[i] || PALETTE[i];
      const isCPU = customPlayers ? !!customPlayers[i].isCPU : (isCpu && i===1);
      let walls = wallsEach;
      if(hunterPoolOn){
        walls = (i===fugitiveIdx) ? Math.max(1, Math.floor(wallsEach/2)) : hunterPool;
      }
      return {
        id: i,
        name: isCPU ? (options.campaignRival || (isTeams ? (i===2 ? 'IA aliada' : 'IA rival ' + (i===1 ? 1 : 2)) : 'CPU')) : ((names[i] && names[i].trim()) ? names[i].trim() : PALETTE[i].name),
        color: skin.color,
        shape: skin.shape,
        r: customPlayers ? Math.max(0,Math.min(size-1,+customPlayers[i].r||0)) : slots[slotKey].r,
        c: customPlayers ? Math.max(0,Math.min(size-1,+customPlayers[i].c||0)) : slots[slotKey].c,
        wallsLeft: customPlayers ? Math.max(0,+customPlayers[i].walls||0) : walls,
        wallsStart: customPlayers ? Math.max(0,+customPlayers[i].walls||0) : walls,
        isCPU: isCPU,
        difficulty: customPlayers ? (customPlayers[i].difficulty||'easy') : difficulty,
        stunned: false,
        powers: [],                                   // Fiesta: poderes guardados
        fx: { shield:0, extra:0, immune:0 },          // Fiesta: efectos activos (rondas de escudo · acción extra · turnos sin poder ser aturdido)
        wallBonus: 0,                                 // Fiesta: paredes extra ya recibidas
        hillTurns: 0,
        pushesLeft: ruleset==='hill' ? HILL_PUSHES : 0,
        sprints: (ruleset==='hunter' && i===fugitiveIdx) ? HUNTER_SPRINTS : 0,
      };
    });

    // Reserva de paredes compartida por equipo (49). El equipo que juega segundo recibe la compensación (50).
    let teams = null;
    if(isTeams){
      const balance = !options.isCustomLevel && !isDaily;
      const mk = (ids, second)=>{
        const base = ids.reduce((s,i)=> s + players[i].wallsLeft, 0);
        const extra = (balance && second) ? TEAM_SECOND_WALLS : 0;
        return { members: ids, wallsLeft: base + extra, wallsStart: base + extra, extra };
      };
      teams = { A: mk([0,2], startTeam==='B'), B: mk([1,3], startTeam==='A') };
      ['A','B'].forEach(k=> teams[k].members.forEach(i=>{ players[i].wallsLeft = teams[k].wallsLeft; players[i].wallsStart = teams[k].wallsStart; }));
    }

    state = {
      size,
      center: objective,
      objective,
      players,
      currentPlayerIndex: firstIdx,
      firstIdx, goalMode, goalSides,
      pie: pieEnabled ? { open:false, resolved:false, actions:0, swapped:false } : null,
      seatMeasured: plainRace && (ruleset==='classic' || ruleset==='official'),
      startSeat: players.map((_,i)=> i),
      hintsUsed: 0,
      teams, teamGoal, startTeam,
      occupied: Array.from({length:size-1}, ()=>Array(size-1).fill(null)),
      blockedEdges: new Set(),
      walls: [],
      winner: null,
      validMoves: [],
      lastPush: players.map(()=> null),   // por jugador: índice del rival al que empujó en su turno anterior
      anim: null,                         // animación pendiente del empujón (la consume render)
      isCpuGame: isCpu || !!(customPlayers && customPlayers.some(p=> p.isCPU)),
      ruleset,
      moveCount: 0,
      powerUp: null,                                     // Fiesta: {r,c,type,ttl}
      party: ruleset==='party' ? { round:1, nextSpawn:1, spawnMisses:0, usedThisTurn:false, pending:[], recent:[], stats:{ used:{}, picked:{}, spawned:0, vanished:0 } } : null,
      isDaily,
      dailyPar: null,
      dailyInfo: (isDaily && options.dailyChallenge) ? { dateKey:options.dailyChallenge.dateKey, number:options.dailyChallenge.number, id:options.dailyChallenge.id,
        label:options.dailyChallenge.label, emoji:options.dailyChallenge.emoji, hint:options.dailyChallenge.hint, slack:options.dailyChallenge.slack,
        turnSeconds:options.dailyChallenge.turnSeconds||0 } : null,
      dailyTimeouts: 0,
      hunterRoundLimit: ruleset==='hunter' ? size + HUNTER_ROUNDS_EXTRA : null,
      fugitiveIdx,
      hunterPool: hunterPoolOn ? hunterPool : null,
      trail: [],
      sprintArmed: false,
      resultTag: null,
      endReason: null,
      campaign: !!options.campaign,
      campaignLevel: options.campaignLevel || null,
      campaignRival: options.campaignRival || null,
      campaignPersonality: options.campaignPersonality || null,
      campaignXPReward: 0,
      presetWalls: Array.isArray(options.presetWalls) ? options.presetWalls : null,
      isCustomLevel: !!options.isCustomLevel,
      turnTimeSeconds,
      clockMode,                                             // null | 'chess'
      clock: clockMode ? players.map(()=> CLOCK_BANK_SECONDS) : null,   // reloj de ajedrez: segundos que le quedan a cada jugador
      turnTimeLeft: 0,                                       // lo que le queda al reloj activo
      timeoutStreak: 0,                                      // vencimientos seguidos sin que nadie jugara
      flagLoser: null,                                       // reloj de ajedrez: quién se quedó sin tiempo
      playerConfigs: customPlayers ? customPlayers.map(p=> Object.assign({}, p)) : null,
      seed: gameSeed,                                        // 71: semilla de la partida (reproducir y compartir)
      startedAt: Date.now(),
      log: [],                                               // 69: registro de jugadas
      undoEnabled: undoEnabledFor(ruleset, isDaily, !!options.campaign, players.filter(pl=> !pl.isCPU).length),
      undoLeft: undoEnabledFor(ruleset, isDaily, !!options.campaign, players.filter(pl=> !pl.isCPU).length) ? UNDO_PER_GAME : 0,
      capWarned: false,
    };
    mode = 'move';
    state.botSeed = (options.botSeed!=null) ? (options.botSeed>>>0) : ((rng()*4294967296)>>>0);
    setBotSeed(state.botSeed);
    state.adaptiveOn = !HEADLESS && adaptiveEnabled() && state.isCpuGame && !state.campaign && !isDaily && playersCount===2;
    state.hintsUsed = 0; state.pathUses = 0; state.keyMoments = [];
    if(boardNoteEl) boardNoteEl.textContent = goalMode==='rows'
      ? 'Cada jugador debe llegar al borde opuesto al suyo: la franja de su color marca la meta.'
      : 'El objetivo es la casilla central marcada con el anillo dorado.';

    if(Array.isArray(options.presetWalls) && options.presetWalls.length){
      options.presetWalls.forEach(w=> tryPlaceEnvWall(state, w.r, w.c, w.orientation));
      if(options.isCustomLevel) recordCustomLevelPlayed();
    } else if(ruleset==='maze' && !isDaily){
      const mine = Array.isArray(options.mazeMine) ? options.mazeMine : [];
      const layout = generateMaze({ size, players:playersCount, density:options.mazeDensity||'medio', seed:options.mazeSeed, mine });
      layout.walls.forEach(w=> tryPlaceEnvWall(state, w.r, w.c, w.orientation));
      state.mazeInfo = { name:layout.name, seed:layout.seed, seedText:layout.seedText, density:layout.density, mine, fallback:layout.fallback };
    } else if(isDaily && Array.isArray(options.dailyWalls)){
      options.dailyWalls.forEach(w=> tryPlaceEnvWall(state, w.r, w.c, w.orientation));
    }

    if(isDaily){
      state.dailyPar = bfsShortestPath(players[0].r, players[0].c, mid, mid, state.blockedEdges, size);
    } else {
      if(!HEADLESS) recordModePlayed(ruleset);
    }
    if(ruleset==='party') partySpawn();

    state.validMoves = computeValidMoves(state.currentPlayerIndex);
    render();
    if(lotteryApplied){
      showToast(`🎲 Sorteo: empieza ${escapeHtml(players[firstIdx].name)}.`);
    }
    if(isTeams){
      const extraTeam = startTeam==='A' ? 'B' : 'A';
      const extra = teams[extraTeam].extra;
      showToast(`🎲 Sorteo: abre el Equipo ${startTeam}.` + (extra>0 ? ` El Equipo ${extraTeam} recibe +${extra} pared${extra===1?'':'es'} de compensación.` : ''));
    }
  }

  // ---------- input handling (Pointer Events: works identically for mouse, touch and stylus) ----------
  let previewSlot = null;
  let dragging = false;
  let siegeHintOn = false;   // el aviso de "zona con menos de 2 accesos" está en pantalla

  boardSvg.addEventListener('contextmenu', e=> e.preventDefault());

  // "Mover": tap/click directly on a highlighted valid-move cell.
  movesEl.addEventListener('click', e=>{
    if(mode!=='move' || !state || state.winner) return;
    const t = e.target;
    if(t && t.classList && t.classList.contains('valid-move-hit')){
      const r = +t.dataset.r, c = +t.dataset.c;
      performMove(r,c);
    }
  });

  // "Pared": press/touch and drag over the board to preview, release to confirm.
  boardSvg.addEventListener('pointerdown', e=>{
    if(!state || state.winner || mode!=='wall') return;
    e.preventDefault();
    dragging = true;
    try{ boardSvg.setPointerCapture(e.pointerId); }catch(err){}
    updateWallPreview(getBoardPoint(e));
  });
  boardSvg.addEventListener('pointermove', e=>{
    if(!dragging) return;
    updateWallPreview(getBoardPoint(e));
  });
  function finishWallDrag(){
    if(!dragging) return;
    dragging = false;
    let rejected = false;
    if(mode==='wall' && previewSlot){
      if(previewSlot.valid) commitWall(previewSlot.r, previewSlot.c, previewSlot.orientation);
      else rejected = true;
    }
    hideWallPreview();
    previewSlot = null;
    if(rejected){ vibrate(ERROR_VIBRATION); siegeHintOn = false; }   // soltar sobre una ranura inválida: vibra y deja el motivo a la vista
    else if(siegeHintOn){ siegeHintOn = false; if(state && !state.winner) updateModeUI(); }
  }
  boardSvg.addEventListener('pointerup', finishWallDrag);
  boardSvg.addEventListener('pointercancel', finishWallDrag);
  boardSvg.addEventListener('pointerleave', e=>{ if(e.pointerType==='mouse') finishWallDrag(); });

  function updateWallPreview(pt){
    const cs = cellSize();
    const slot = getWallSlotFromPoint(pt.x, pt.y);
    let evalRes = evaluateWallForPreview(slot.r, slot.c, slot.orientation);
    const cpPrev = state.players[state.currentPlayerIndex];
    if(evalRes.valid && cpPrev && cpPrev.wallsLeft<=0) evalRes = { valid:false, reason:'noWalls' };
    slot.valid = evalRes.valid;
    previewSlot = slot;
    const whyNot = evalRes.valid ? null : wallReasonText(evalRes.reason);
    if(whyNot){
      hintLine.textContent = whyNot;     // el motivo se ve mientras se arrastra (67)
      siegeHintOn = true;
    } else if(siegeHintOn){ siegeHintOn = false; updateModeUI(); }
    const rect = wallRect(slot.r, slot.c, slot.orientation, cs);
    const cp = state.players[state.currentPlayerIndex];
    previewEl.setAttribute('x', rect.x);
    previewEl.setAttribute('y', rect.y);
    previewEl.setAttribute('width', rect.w);
    previewEl.setAttribute('height', rect.h);
    previewEl.setAttribute('rx', rect.h>rect.w ? rect.w*0.4 : rect.h*0.4);
    previewEl.setAttribute('fill', evalRes.valid ? cp.color : '#c0392b');
    previewEl.setAttribute('opacity', evalRes.valid ? '0.55' : '0.4');
    // 65: con la ayuda activa, las fichas muestran cuánto cambia cada distancia si se pone esta pared
    if(distHelpOn){
      if(evalRes.valid){
        const test = new Set(state.blockedEdges);
        evalRes.edges.forEach(e=> test.add(edgeKey(e[0],e[1],e[2],e[3])));
        if(evalRes.mirrorEdges) evalRes.mirrorEdges.forEach(e=> test.add(edgeKey(e[0],e[1],e[2],e[3])));
        updateDistChips(test);
      } else updateDistChips();
    }
  }

  function hideWallPreview(){
    if(distHelpOn && state) updateDistChips();
    previewEl.setAttribute('opacity','0');
  }

  // ---------- menú: modo / dificultad / nombres / modo de partida ----------
  function currentRuleset(){ return rulesetSelect.value || 'classic'; }
  function currentMode(){
    const rs = RULESETS[currentRuleset()];
    if(rs && rs.forceLocal) return 'local';
    const r = document.querySelector('input[name="gmode"]:checked');
    return r ? r.value : 'local';
  }
  function currentHunterRole(){
    const r = document.querySelector('input[name="hrole"]:checked');
    return r && r.value==='hunter' ? 'hunter' : 'fugitive';
  }
  function currentPlayersCount(){
    const rs = RULESETS[currentRuleset()];
    if(rs && rs.forcePlayers) return rs.forcePlayers;
    if(currentMode()==='cpu') return 2;
    const r = document.querySelector('input[name="players"]:checked');
    return r ? +r.value : 2;
  }
  function skinDotHTML(i){
    const sk = pieceSkins[i] || pieceSkins[0];
    return `<button type="button" class="skin-dot" data-slot="${i}" aria-label="Personalizar la ficha del jugador ${i+1}">${smallShapeSVG(sk.shape, sk.color, 26)}</button>`;
  }
  function updateDifficultyHint(){
    const r = document.querySelector('input[name="difficulty"]:checked');
    difficultyHint.textContent = adaptiveEnabled() ? `Dificultad adaptativa activa (nivel ${adaptiveLevelPct()} de 100): la IA se ajusta sola. Podés desactivarla en Ajustes.` : (r && DIFFICULTY[r.value] ? DIFFICULTY[r.value].hint : '');
  }
  namesContainer.addEventListener('click', e=>{
    const dot = e.target.closest('.skin-dot');
    if(!dot) return;
    activeSkinSlot = +dot.dataset.slot;
    renderSkinsOverlay();
    openOverlay('skins');
  });
  document.getElementById('difficultyGroup').addEventListener('change', updateDifficultyHint);
  function currentTeamSetup(){
    const r = document.querySelector('input[name="tsetup"]:checked');
    return r && r.value==='ally' ? 'ally' : 'local';
  }
  function currentTeamGoal(){
    const r = document.querySelector('input[name="tgoal"]:checked');
    return r && r.value==='both' ? 'both' : 'first';
  }
  // «Yo + IA contra 2 IA»: el jugador 1 es humano; su aliado (asiento 3) y los dos rivales son IA. Usa playerConfigs, igual que el editor.
  function buildTeamAllyConfigs(size, difficulty){
    const mid = Math.floor(size/2), w = wallsPerPlayer(size,4);
    const seats = [ {r:0,c:mid}, {r:mid,c:size-1}, {r:size-1,c:mid}, {r:mid,c:0} ];
    return seats.map((s,i)=> ({ r:s.r, c:s.c, walls:w, isCPU:i!==0, difficulty }));
  }

  function renderNameInputs(count, cpuSeatsArg){
    const cpuSeats = Array.isArray(cpuSeatsArg) ? cpuSeatsArg : (cpuSeatsArg ? [1] : []);
    const current = loadPlayerNames();
    for(let i=0;i<4;i++){
      const existing = document.getElementById('nameInput'+i);
      if(existing) current[i] = existing.value;
    }
    let html = '';
    for(let i=0;i<count;i++){
      if(cpuSeats.includes(i)){
        html += `<div class="name-row">${skinDotHTML(i)}<span class="cpu-name-badge">🤖 ${cpuSeatsArg && cpuSeats.length>1 ? (i===2 ? 'IA aliada' : 'IA rival') : 'CPU'}</span></div>`;
        continue;
      }
      const val = escapeHtml(current[i] || PALETTE[i].name);
      html += `<div class="name-row">${skinDotHTML(i)}<input type="text" class="name-input" id="nameInput${i}" maxlength="16" value="${val}" placeholder="${escapeHtml(PALETTE[i].name)}" aria-label="Nombre del jugador ${i+1}"></div>`;
    }
    namesContainer.innerHTML = html;
  }
  function updateMenuVisibility(){
    const rs = RULESETS[currentRuleset()];
    rulesetHint.textContent = rs ? rs.hint : '';
    updateDifficultyHint();
    document.getElementById('modeCpu').disabled = !!(rs && rs.forceLocal);
    if(rs && rs.forceLocal){ document.getElementById('modeLocal').checked = true; }
    const m = currentMode();
    const isTeamsMenu = currentRuleset()==='teams';
    const teamAlly = isTeamsMenu && currentTeamSetup()==='ally';
    teamSetupFieldset.classList.toggle('hidden', !isTeamsMenu);
    teamGoalFieldset.classList.toggle('hidden', !isTeamsMenu);
    if(isTeamsMenu){
      const gh = document.getElementById('teamGoalHint');
      if(gh) gh.textContent = currentTeamGoal()==='both'
        ? 'Los dos aliados tienen que llegar al centro. Al llegar, cada uno espera en una esquina de la casilla; el HUD muestra 0/2 y 1/2.'
        : 'Gana el equipo del primero que llegue al centro.';
    }
    difficultyFieldset.classList.toggle('hidden', !(m==='cpu' || teamAlly));
    roleFieldset.classList.toggle('hidden', !(m==='cpu' && currentRuleset()==='hunter'));
    if(rs && rs.forcePlayers){
      playersFieldset.classList.add('hidden');
      const el = document.getElementById('p'+rs.forcePlayers);
      if(el) el.checked = true;
    } else {
      playersFieldset.classList.toggle('hidden', m==='cpu');
    }
    renderNameInputs(currentPlayersCount(), teamAlly ? [1,2,3] : m==='cpu');
    refreshCustomLevelSelect();
    syncModeButton();
  }
  rulesetSelect.addEventListener('change', updateMenuVisibility);
  document.getElementById('modeGroup').addEventListener('change', updateMenuVisibility);
  document.getElementById('playersGroup').addEventListener('change', updateMenuVisibility);
  document.getElementById('teamSetupGroup').addEventListener('change', updateMenuVisibility);
  document.getElementById('teamGoalGroup').addEventListener('change', updateMenuVisibility);

  // ---------- ajustes (tema, volumen, vibración, ayudas visuales) ----------
  function setMusicSliderFill(){
    const pct = Math.round(musicVolume*100);
    musicVolumeInput.style.setProperty('--pct', pct + '%');
    musicVolLabel.textContent = pct + '%';
    document.getElementById('musicWrap').style.setProperty('--p', String(pct/100));
  }
  function setSliderFill(){
    const pct = Math.round(sfxVolume*100);
    sfxVolumeInput.style.setProperty('--pct', pct + '%');
    sfxVolLabel.textContent = pct + '%';
    document.getElementById('sfxWrap').style.setProperty('--p', String(pct/100));
  }
  function applyGlass(){ document.body.classList.toggle('no-glass', !glassOn); }
  function applyShowMoves(){ document.body.classList.toggle('hide-moves', !showMovesOn); }
  function openSettings(){
    const pref = loadThemePref();
    const radioId = pref==='light' ? 'stLight' : (pref==='dark' ? 'stDark' : 'stSystem');
    const radio = document.getElementById(radioId);
    if(radio) radio.checked = true;
    sfxVolumeInput.value = Math.round(sfxVolume*100);
    setSliderFill();
    musicVolumeInput.value = Math.round(musicVolume*100);
    setMusicSliderFill();
    vibrateToggle.checked = vibrateOn;
    showMovesToggle.checked = showMovesOn;
    distHelpToggle.checked = distHelpOn;
    lotteryToggle.checked = lotteryOn;
    pieToggle.checked = pieOn;
    glassToggle.checked = glassOn;
    explainToggle.checked = explainOn;
    adaptiveToggle.checked = adaptiveEnabled();
    refreshAdaptiveHint();
    openOverlay('settings');
  }
  function refreshAdaptiveHint(){
    adaptiveHint.textContent = adaptiveEnabled()
      ? `Nivel actual: ${adaptiveLevelPct()} de 100. Sube si ganás 4 de las últimas 5 partidas contra la IA y baja si ganás 1 o ninguna.`
      : 'La IA ajusta sola su nivel según tus últimas 5 partidas. Reemplaza la dificultad elegida (no vale en campaña).';
  }
  explainToggle.addEventListener('change', ()=>{ explainOn = explainToggle.checked; writePref('quoridor_explain', explainOn ? '1' : '0'); });
  adaptiveToggle.addEventListener('change', ()=>{ writePref('quoridor_adaptive', adaptiveToggle.checked ? '1' : '0'); refreshAdaptiveHint(); updateDifficultyHint(); });
  settingsThemeGroup.addEventListener('change', e=>{ applyTheme(e.target.value); });
  sfxVolumeInput.addEventListener('input', ()=>{ setSfxVolume(+sfxVolumeInput.value/100); setSliderFill(); });
  sfxVolumeInput.addEventListener('change', ()=>{ playMoveSound(); });        // muestra el volumen elegido
  musicVolumeInput.addEventListener('input', ()=>{ setMusicVolume(+musicVolumeInput.value/100); setMusicSliderFill(); });
  vibrateToggle.addEventListener('change', ()=>{
    vibrateOn = vibrateToggle.checked;
    writePref('quoridor_vibrate', vibrateOn ? '1' : '0');
    if(vibrateOn) vibrate(25);
  });
  showMovesToggle.addEventListener('change', ()=>{
    showMovesOn = showMovesToggle.checked;
    writePref('quoridor_showMoves', showMovesOn ? '1' : '0');
    applyShowMoves();
  });
  distHelpToggle.addEventListener('change', ()=>{
    distHelpOn = distHelpToggle.checked;
    writePref('quoridor_distHelp', distHelpOn ? '1' : '0');
    updateDistChips();
  });
  lotteryToggle.addEventListener('change', ()=>{
    lotteryOn = lotteryToggle.checked;
    writePref('quoridor_lottery', lotteryOn ? '1' : '0');
  });
  pieToggle.addEventListener('change', ()=>{
    pieOn = pieToggle.checked;
    writePref('quoridor_pie', pieOn ? '1' : '0');
  });
  glassToggle.addEventListener('change', ()=>{
    glassOn = glassToggle.checked;
    writePref('quoridor_glass', glassOn ? '1' : '0');
    applyGlass();
  });
  settingsLinkBtn.addEventListener('click', openSettings);
  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', ()=> closeOverlay('settings'));

  // ---------- precarga de imágenes (botones pulsados, emotes, medallas) y de la fuente ----------
  let preloaded = [];
  function preloadAssets(){
    const urls = [];
    ['yellow','grey','red','green','blue'].forEach(c=> ['rect','sq','rd'].forEach(sh=>{
      urls.push(`ui/btn-${c}-${sh}.png`, `ui/btn-${c}-${sh}-down.png`);
    }));
    urls.push('ui/slide-track.png','ui/slide-fill.png','ui/slide-fill-green.png','ui/slide-thumb.png','ui/check-off.png','ui/check-on.png','ui/star.png','ui/star-off.png');
    EMOTE_ICON_IDS.forEach(id=> urls.push('emotes/icons/'+id+'.png'));
    FRAME_IDS.filter(f=> f!=='none').forEach(f=> urls.push('emotes/frames/'+f+'.png'));
    for(let m=1;m<=9;m++) urls.push('medals/m'+m+'.png');
    modeAssetUrls().forEach(u=> urls.push(u));
    preloaded = urls.map(u=>{ const im = new Image(); im.src = ASSET + u; return im; });
    try{ if(document.fonts && document.fonts.load) document.fonts.load('16px "Kenney Future Narrow"'); }catch(e){}
  }

  function blankCampaign(){ return { xp:0, unlockedLevel:1, completed:[], wins:0, losses:0 }; }

  function loadCampaign(){
    const base=blankCampaign();
    try{
      const raw=localStorage.getItem('quoridor_campaign');
      if(raw){ const d=JSON.parse(raw)||{}; base.xp=+d.xp||0; base.unlockedLevel=Math.max(1,Math.min(CAMPAIGN_LEVELS.length,+d.unlockedLevel||1)); base.completed=Array.isArray(d.completed)?d.completed:[]; base.wins=+d.wins||0; base.losses=+d.losses||0; }
    }catch(e){}
    return base;
  }

  function saveCampaign(){ try{ localStorage.setItem('quoridor_campaign',JSON.stringify(campaignData)); }catch(e){} }

  function campaignRank(){ let rank=CAMPAIGN_RANKS[0]; for(const r of CAMPAIGN_RANKS){ if(campaignData.xp>=r.min) rank=r; } return rank; }

  function campaignNextRank(){ for(const r of CAMPAIGN_RANKS){ if(campaignData.xp<r.min) return r; } return null; }

  function campaignLevelUnlocked(n){ return n<=campaignData.unlockedLevel; }

  function campaignSkinColorUnlocked(color){
    for(const [lvl,c] of Object.entries(CAMPAIGN_SKIN_UNLOCKS)){
      if(c.color===color) return campaignData.completed.includes(+lvl);
    }
    return true;
  }

  function campaignShapeUnlocked(shape){
    if(PALETTE.some(p=> p.shape===shape)) return true;
    for(const [lvl,sh] of Object.entries(CAMPAIGN_SHAPE_UNLOCKS)){ if(sh===shape && campaignData.completed.includes(+lvl)) return true; }
    return !Object.values(CAMPAIGN_SHAPE_UNLOCKS).includes(shape);
  }

  function awardCampaignXP(level, won){
    if(!state || !state.campaign) return 0;
    const lvl=CAMPAIGN_LEVELS.find(x=>x.id===level);
    if(!lvl) return 0;
    if(won){
      const first=campaignData.completed.indexOf(level)===-1;
      if(first){ campaignData.completed.push(level); campaignData.xp+=lvl.xp; }
      campaignData.wins+=1;
      if(level>=campaignData.unlockedLevel) campaignData.unlockedLevel=Math.min(CAMPAIGN_LEVELS.length,level+1);
      saveCampaign();
      return first ? lvl.xp : 0;
    }
    campaignData.losses+=1; saveCampaign(); return 0;
  }

  function campaignProgressText(){
    const rank=campaignRank(), next=campaignNextRank();
    return `${rank.name} · ${campaignData.xp} XP${next?` · ${next.min-campaignData.xp} XP para ${next.name}`:' · rango máximo'}`;
  }

  function startCampaignLevel(level){
    const names=loadPlayerNames();
    initGame(2,level.size,{isCpu:true,difficulty:level.difficulty,names,ruleset:'classic',campaign:true,campaignLevel:level.id,campaignRival:level.rival,campaignPersonality:level.personality});
    menuScreen.classList.add('hidden'); gameScreen.classList.remove('hidden');
    setTimeout(()=>{ hintLine.textContent=`${level.rival}: ${level.intro}`; },0);
  }

  function scoreBotMove(botIdx,m,personality,edgesOverride){
    const edges = edgesOverride || state.blockedEdges;
    const bot=state.players[botIdx], myAfter=distanceToCenter(m.r,m.c,edges,botIdx);
    let score=-myAfter*10, oppIdx=otherPlayerClosestToCenter(botIdx, edges);
    if(m.swap){
      // intercambio con el aliado: vale la pena sólo si lo que gano yo supera lo que pierde él (queda en mi casilla actual)
      const al = state.players[allyIdxOf(botIdx)];
      score -= (distanceToCenter(bot.r,bot.c,edges) - distanceToCenter(al.r,al.c,edges))*10 + 2;
    }
    if(oppIdx!=null){ const oppDist=distanceToCenter(state.players[oppIdx].r,state.players[oppIdx].c,edges,oppIdx);
      if(personality==='aggressive')score+=(oppDist-myAfter)*1.8;
      if(personality==='defensive')score+=oppDist*0.25;
      if(personality==='speed'&&myAfter===0)score+=1000;
      if(personality==='strategist')score+=(oppDist-myAfter)*0.9;
    }
    if(personality==='defensive')score+=distanceToCenter(bot.r,bot.c,edges,botIdx)-myAfter;
    if(state.ruleset==='hill'){
      // término "hill": acercarse a la casilla libre más cercana de la zona, valorar estar dentro, no salir de ella
      // y sólo gastar un empujón si me deja adentro
      const inNow = isHillCell(bot.r,bot.c), inAfter = isHillCell(m.r,m.c);
      let dz = inAfter ? 0 : distanceToHill(m.r,m.c,edges,hillFreeTargets(botIdx));
      if(!isFinite(dz)) dz = 50;
      score += -dz*25 + (inAfter?40:0) + ((inNow && !inAfter)?-150:0) + (m.push ? (inAfter?35:-100) : 0);
      // con empujones disponibles, arrimarse al rival que va ganando dentro de la zona para poder sacarlo
      if((bot.pushesLeft||0)>0 && !m.push){
        let leader = null;
        state.players.forEach((pl,i)=>{ if(i!==botIdx && isHillCell(pl.r,pl.c) && (pl.hillTurns||0)>0 && (!leader || pl.hillTurns>leader.hillTurns)) leader = pl; });
        if(leader) score += -(Math.abs(m.r-leader.r)+Math.abs(m.c-leader.c))*6;
      }
    }
    return score;
  }

  function refreshCustomLevelSelect(){
    const isMaze = currentRuleset()==='maze';
    customLevelFieldset.classList.toggle('hidden', !isMaze);
    if(!isMaze) return;
    const previous = customLevelSelect.value;
    const list = loadCustomLevels();
    customLevelSelect.innerHTML = '<option value="random">🎲 Paredes al azar</option>' +
      list.map((lvl,i)=> lvl.pattern ? '' : `<option value="${i}">${escapeHtml(lvl.name)} (${lvl.size}×${lvl.size})</option>`).join('');
    customLevelSelect.value = (previous!=='random' && list[+previous] && !list[+previous].pattern) ? previous : 'random';
    const nMine = loadUserPatterns().length;
    mazeMineCount.textContent = nMine ? '('+nMine+')' : '(todavía no guardaste ninguno)';
    mazeMineCheck.disabled = !nMine;
    if(!nMine) mazeMineCheck.checked = false;
    refreshMazePreview();
  }

  // ---------- Laberinto en el menú: densidad, minimapa, dado y semilla ----------
  const MAZE_DENSITY_HINTS = {
    ligero:'Un patrón de hasta 6 tramos.',
    medio:'Un patrón más un tramo corto.',
    denso:'Dos patrones combinados.',
    caos:'Tramos sueltos al azar, sin patrón.',
  };
  let mazeMenuSeed = newMazeSeed();
  let menuMazeLayout = null;
  function currentMazeDensity(){
    const r = document.querySelector('input[name="mazeDensity"]:checked');
    return r ? r.value : 'medio';
  }
  function loadUserPatterns(){ return loadCustomLevels().filter(l=> l && l.pattern && Array.isArray(l.walls) && l.walls.length); }
  function mazeMenuOptions(){
    return {
      size: +document.querySelector('input[name="size"]:checked').value,
      players: currentPlayersCount(),
      density: currentMazeDensity(),
      seed: mazeMenuSeed,
      mine: mazeMineCheck.checked ? loadUserPatterns() : [],
    };
  }
  // Vista previa SVG de 120×120: tablero, salidas de cada jugador, meta y paredes.
  function mazeMinimapHTML(size, walls, seats){
    const W = 120, cs = W/size, mid = (size-1)/2;
    let h = `<rect width="${W}" height="${W}" rx="8" fill="var(--board)"/>`;
    for(let r=0;r<size;r++) for(let c=0;c<size;c++){
      if((r+c)%2===1) h += `<rect x="${(c*cs).toFixed(2)}" y="${(r*cs).toFixed(2)}" width="${cs.toFixed(2)}" height="${cs.toFixed(2)}" fill="var(--board-alt)"/>`;
    }
    seats.forEach((p,i)=>{
      h += `<circle cx="${((p.c+0.5)*cs).toFixed(2)}" cy="${((p.r+0.5)*cs).toFixed(2)}" r="${(cs*0.3).toFixed(2)}" fill="${(PALETTE[i]||PALETTE[0]).color}" stroke="var(--panel)" stroke-width="1"/>`;
    });
    h += `<circle cx="${((mid+0.5)*cs).toFixed(2)}" cy="${((mid+0.5)*cs).toFixed(2)}" r="${(cs*0.38).toFixed(2)}" fill="none" stroke="var(--accent)" stroke-width="1.8"/>`;
    const sw = Math.max(2.4, cs*0.2).toFixed(2);
    walls.forEach(w=>{
      const o = w.orientation;
      const x1 = o==='h' ? w.c*cs : (w.c+1)*cs, y1 = o==='h' ? (w.r+1)*cs : w.r*cs;
      const x2 = o==='h' ? (w.c+2)*cs : x1, y2 = o==='h' ? y1 : (w.r+2)*cs;
      h += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#6b665a" stroke-width="${sw}" stroke-linecap="round"/>`;
    });
    return h;
  }
  function refreshMazePreview(){
    if(currentRuleset()!=='maze') return;
    const isCustom = customLevelSelect.value!=='random';
    mazeRandomOptions.classList.toggle('hidden', isCustom);
    mazeDiceBtn.classList.toggle('hidden', isCustom);
    if(isCustom){
      const lvl = loadCustomLevels()[+customLevelSelect.value];
      if(lvl){
        const seats = (lvl.players && lvl.players.length) ? lvl.players : mazeContext(lvl.size, 2).seats;
        mazeMinimap.innerHTML = mazeMinimapHTML(lvl.size, lvl.walls||[], seats);
        mazeMapName.textContent = lvl.name;
        mazeSeedText.textContent = 'Nivel guardado';
      }
      return;
    }
    mazeDensityHint.textContent = MAZE_DENSITY_HINTS[currentMazeDensity()];
    const opts = mazeMenuOptions();
    const layout = generateMaze(opts);
    menuMazeLayout = layout;
    mazeMinimap.innerHTML = mazeMinimapHTML(opts.size, layout.walls, mazeContext(opts.size, opts.players).seats);
    mazeMapName.textContent = 'Mapa: '+layout.name;
    mazeSeedText.textContent = 'Semilla '+layout.seedText;
  }
  function saveMazePrefs(){
    const cfg = loadLastSetup() || {};
    cfg.mazeDensity = currentMazeDensity();
    cfg.mazeMine = !!mazeMineCheck.checked;
    saveLastSetup(cfg);
  }
  mazeDensityGroup.addEventListener('change', ()=>{ saveMazePrefs(); refreshMazePreview(); syncModeButton(); });
  mazeMineCheck.addEventListener('change', ()=>{ saveMazePrefs(); refreshMazePreview(); });
  mazeDiceBtn.addEventListener('click', ()=>{ mazeMenuSeed = newMazeSeed(); refreshMazePreview(); vibrate(8); });
  document.getElementById('sizeGroup').addEventListener('change', refreshMazePreview);
  document.getElementById('sizeGroup').addEventListener('change', syncModeButton);     // el "Auto" de Contrarreloj depende del tamaño
  customLevelSelect.addEventListener('change', refreshMazePreview);

  function defaultEditorPlayers(size,count){
    const mid=(size-1)/2;
    const slots=[{r:0,c:mid},{r:size-1,c:mid},{r:mid,c:0},{r:mid,c:size-1}];
    return slots.slice(0,count).map(p=>({r:p.r,c:p.c,walls:wallsPerPlayer(size,count),isCPU:false,difficulty:'easy'}));
  }

  function editorPlayerConfigHTML(){
    let html='';
    editorState.players.forEach((p,i)=>{
      html += '<div class="editor-player-card"><div class="editor-player-title"><strong>Jugador '+(i+1)+'</strong></div>';
      html += '<div class="editor-fields-4">';
      html += '<label>Fila <input type="number" min="1" max="'+editorState.size+'" data-player="'+i+'" data-field="r" value="'+(p.r+1)+'"></label>';
      html += '<label>Col. <input type="number" min="1" max="'+editorState.size+'" data-player="'+i+'" data-field="c" value="'+(p.c+1)+'"></label>';
      html += '<label>Paredes <input type="number" min="0" max="50" data-player="'+i+'" data-field="walls" value="'+p.walls+'"></label>';
      html += '<label>Control<select class="select-field" data-player="'+i+'" data-field="control"><option value="local" '+(!p.isCPU?'selected':'')+'>👤 Local</option><option value="cpu" '+(p.isCPU?'selected':'')+'>🤖 IA</option></select></label></div>';
      html += '<label class="editor-difficulty '+(p.isCPU?'':'hidden')+'">Dificultad IA<select class="select-field" data-player="'+i+'" data-field="difficulty">';
      html += '<option value="easy" '+(p.difficulty==='easy'?'selected':'')+'>Fácil</option><option value="normal" '+(p.difficulty==='normal'?'selected':'')+'>Normal</option><option value="hard" '+(p.difficulty==='hard'?'selected':'')+'>Difícil</option><option value="expert" '+(p.difficulty==='expert'?'selected':'')+'>Experto</option></select></label></div>';
    });
    return html;
  }

  function syncEditorControls(){
    if(!editorState) return;
    editorPlayersCount.value=String(editorState.players.length);
    editorTurnTime.value=String(editorState.turnTime||0);
    editorRuleset.value=editorState.ruleset||'classic';
    document.querySelectorAll('input[name="editorObjective"]').forEach(r=>r.checked=r.value===editorState.objective.mode);
    editorObjectiveRow.value=String(editorState.objective.r+1);
    editorObjectiveCol.value=String(editorState.objective.c+1);
    editorObjectiveCoords.classList.toggle('hidden',editorState.objective.mode!=='custom');
    editorPlayersConfig.innerHTML=editorPlayerConfigHTML();
    renderEditor();
  }

  function editorApplyObjective(){
    const modeValue=document.querySelector('input[name="editorObjective"]:checked')?.value||'center';
    editorState.objective.mode=modeValue;
    if(modeValue==='center'){
      editorState.objective.r=Math.floor((editorState.size-1)/2);
      editorState.objective.c=Math.floor((editorState.size-1)/2);
    }else{
      editorState.objective.r=Math.max(0,Math.min(editorState.size-1,(+editorObjectiveRow.value||1)-1));
      editorState.objective.c=Math.max(0,Math.min(editorState.size-1,(+editorObjectiveCol.value||1)-1));
    }
    syncEditorControls();
  }

  function renderCampaign(){
    const rank = campaignRank(), next = campaignNextRank();
    campaignRankLine.textContent = `${rank.name} · ${campaignData.xp} XP · ${campaignData.wins} victorias`;
    const prev = rank.min, max = next ? next.min : Math.max(rank.min+1, campaignData.xp);
    campaignProgressFill.style.width = (next ? Math.max(0, Math.min(100, ((campaignData.xp-prev)/(max-prev))*100)) : 100) + '%';
    campaignNextLine.textContent = next ? `${next.min-campaignData.xp} XP para rango ${next.name}` : 'Rango máximo alcanzado';
    const starsByDiff = { easy:1, normal:2, hard:3, expert:4 };
    campaignLevelsEl.innerHTML = CAMPAIGN_LEVELS.map(l=>{
      const done = campaignData.completed.includes(l.id), locked = !campaignLevelUnlocked(l.id);
      const badge = done ? `<img class="lvl-medal" src="${medalSrc(((l.id-1)%9)+1)}" alt="Completada">` : (locked ? '🔒' : l.id);
      return `<button type="button" class="campaign-level ${done?'done':''} ${locked?'locked':''}" data-level="${l.id}" ${locked?'disabled':''}>
        <span class="campaign-level-num">${badge}</span>
        <span class="campaign-level-main"><strong>${escapeHtml(l.name)}</strong><small>vs. ${escapeHtml(l.rival)} · ${l.size}×${l.size} <span class="stars-row">${starsHTML(starsByDiff[l.difficulty]||1,4,10)}</span></small></span>
        <span class="campaign-level-xp">+${l.xp} XP</span>
      </button>`;
    }).join('');
  }
  campaignBtn.addEventListener('click', ()=>{ renderCampaign(); openOverlay('campaign'); });
  closeCampaignBtn.addEventListener('click', ()=> closeOverlay('campaign'));
  campaignLevelsEl.addEventListener('click', e=>{
    const btn = e.target.closest('.campaign-level'); if(!btn || btn.disabled) return;
    const level = CAMPAIGN_LEVELS.find(x=> x.id===+btn.dataset.level); if(!level) return;
    closeOverlay('campaign'); startCampaignLevel(level);
  });

  // ---------- selector de modos: ventana modal en cuadrícula ----------
  // DATOS: qué recursos gráficos usa cada modo. Nombre, reglas y textos salen de RULESETS (única fuente de verdad).
  // frame/frameOn = globo del pack de emotes (normal / seleccionado), medal = medalla que aparece al ganar en ese modo.
  const MODE_CATALOG = [
    { key:'classic', icon:'circle',       frame:'f1', frameOn:'f2', medal:1, level:1 },
    { key:'official',icon:'bars',         frame:'f1', frameOn:'f2', medal:1, level:1 },
    { key:'fog',     icon:'cloud',        frame:'f5', frameOn:'f6', medal:2, level:2 },
    { key:'teams',   icon:'hearts',       frame:'f3', frameOn:'f4', medal:3, level:2 },
    { key:'party',   icon:'music',        frame:'f7', frameOn:'f7', medal:4, level:2 },
    { key:'maze',    icon:'swirl',        frame:'f1', frameOn:'f2', medal:5, level:2 },
    { key:'blitz',   icon:'exclamations', frame:'f3', frameOn:'f4', medal:6, level:3 },
    { key:'mirror',  icon:'dots2',        frame:'f1', frameOn:'f2', medal:7, level:2 },
    { key:'hill',    icon:'star',         frame:'f3', frameOn:'f4', medal:8, level:2 },
    { key:'hunter',  icon:'anger',        frame:'f7', frameOn:'f7', medal:9, level:3 },
  ];
  const MODE_BY_KEY = {};
  MODE_CATALOG.forEach(m=>{ MODE_BY_KEY[m.key] = m; });
  function modeAssetUrls(){
    const urls = ['ui/check-on.png','ui/check-off.png','ui/star.png','ui/star-off.png'];
    MODE_CATALOG.forEach(m=>{
      urls.push('emotes/icons/'+m.icon+'.png', 'emotes/frames/'+m.frame+'.png', 'emotes/frames/'+m.frameOn+'.png', 'medals/m'+m.medal+'.png');
    });
    return urls;
  }
  function syncModeButton(){ modePicker.syncTrigger(); }

  // COMPONENTE: los listeners se registran una sola vez (build) y las tarjetas se construyen una sola vez,
  // así abrir/cerrar la ventana no crea ni acumula nodos ni handlers. Sólo se animan transform y opacity.
  const modePicker = (function(){
    const COLS = 3, CLOSE_MS = 230;
    let built = false, pending = 'classic', closeTimer = null, returnFocusTo = null, lastTriggerKey = null;
    const cardEls = [];

    function rs(key){ return RULESETS[key] || RULESETS.classic; }
    function won(key){
      if(key==='classic') return totalWins(statsData) > 0;
      return ((statsData.modeWins && statsData.modeWins[key]) || 0) > 0;
    }
    function plateHTML(m){
      return '<span class="mode-plate">'
        + '<img class="plate-frame plate-off" src="'+frameSrc(m.frame)+'" alt="" decoding="async">'
        + '<img class="plate-frame plate-on" src="'+frameSrc(m.frameOn)+'" alt="" decoding="async">'
        + '<img class="plate-icon" src="'+emoteIconSrc(m.icon)+'" alt="" decoding="async"></span>';
    }
    function build(){
      if(built) return;
      built = true;
      modesGrid.innerHTML = MODE_CATALOG.map((m,i)=>
        '<button type="button" class="mode-card" role="radio" aria-checked="false" tabindex="-1" data-mode="'+m.key+'" style="--i:'+i+'">'
        + '<img class="mc-check" src="'+ASSET+'ui/check-on.png" alt="" decoding="async">'
        + '<img class="mc-medal" src="'+medalSrc(m.medal)+'" alt="Ganado" decoding="async">'
        + plateHTML(m)
        + '<span class="mc-name">'+escapeHtml(rs(m.key).label)+'</span>'
        + '<span class="stars-row mc-stars" title="Complejidad">'+starsHTML(m.level,3,11)+'</span>'
        + '</button>').join('');
      modesGrid.querySelectorAll('.mode-card').forEach(el=> cardEls.push(el));
      modesGrid.addEventListener('click', onGridClick);
      modesGrid.addEventListener('keydown', onGridKey);
      modesOverlay.addEventListener('click', e=>{ if(e.target===modesOverlay) close(); });
      modesOverlay.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } });
      modeDetail.addEventListener('change', onDetailChange);
      modesConfirmBtn.addEventListener('click', confirm);
      modesCloseBtn.addEventListener('click', close);
      modeTriggerBtn.addEventListener('click', open);
    }
    function isAvailable(key){ return !!MODE_BY_KEY[key]; }   // punto de extensión: un modo puede quedar deshabilitado (aria-disabled)
    function paint(){
      cardEls.forEach(el=>{
        const on = el.dataset.mode===pending, ok = isAvailable(el.dataset.mode);
        el.setAttribute('aria-checked', on ? 'true' : 'false');
        el.setAttribute('aria-disabled', ok ? 'false' : 'true');
        el.classList.toggle('is-locked', !isUnlocked('mode:' + el.dataset.mode));
        el.tabIndex = on ? 0 : -1;
      });
      const m = MODE_BY_KEY[pending], r = rs(pending);
      const players = r.forcePlayers ? r.forcePlayers+' jugadores' : '2 a 4 jugadores';
      const who = r.forceLocal ? (pending==='teams' ? 'Local o Yo + IA' : 'Solo local') : 'Local o vs. IA';
      modeDetail.innerHTML = '<div class="md-inner">'
        + '<div class="md-head"><span class="md-name">'+escapeHtml(r.label)+'</span><span class="stars-row" title="Complejidad">'+starsHTML(m.level,3,13)+'</span></div>'
        + '<p class="md-hint">'+escapeHtml(r.hint)+'</p>'
        + '<div class="md-tags"><span class="md-tag">'+players+'</span><span class="md-tag">'+who+'</span>'
        + (pending==='maze' ? '<span class="md-tag">Densidad: '+MAZE_DENSITIES[currentMazeDensity()]+'</span>' : '')
        + (won(pending) ? '<span class="md-tag won"><img src="'+medalSrc(m.medal)+'" alt="">Ganado</span>' : '')
        + '</div>'
        + (pending==='blitz' ? blitzConfigHTML() : '')
        + '</div>';
      if(pending==='blitz') syncBlitzControls();
    }
    // Contrarreloj: tipo de reloj y segundos por turno (se guardan al tocar; el tamaño del tablero define el "Auto")
    function menuBoardSize(){
      const r = document.querySelector('input[name="size"]:checked');
      return r ? +r.value : 9;
    }
    function blitzConfigHTML(){
      const autoSecs = blitzDefaultSeconds(menuBoardSize());
      const secs = [0].concat(BLITZ_SECONDS_CHOICES).map(v=>
        '<input type="radio" name="blitzSecs" id="bs'+v+'" value="'+v+'"><label for="bs'+v+'">'+(v ? v+' s' : 'Auto '+autoSecs+' s')+'</label>').join('');
      return '<div class="md-config">'
        + '<div class="md-config-row"><span class="md-config-label">Reloj</span>'
        + '<div class="segmented" role="radiogroup" aria-label="Tipo de reloj">'
        + '<input type="radio" name="blitzClock" id="bcTurn" value="turn"><label for="bcTurn">Por turno</label>'
        + '<input type="radio" name="blitzClock" id="bcChess" value="chess"><label for="bcChess">Ajedrez 60 s + 3 s</label>'
        + '</div></div>'
        + '<div class="md-config-row"><span class="md-config-label">Segundos por turno</span>'
        + '<div class="segmented" id="blitzSecsGroup" role="radiogroup" aria-label="Segundos por turno">'+secs+'</div></div>'
        + '<p class="md-config-note" id="blitzNote"></p>'
        + '</div>';
    }
    function syncBlitzControls(){
      const two = currentPlayersCount()===2;
      const chess = blitzPrefs.clock==='chess' && two;
      const q = id=> document.getElementById(id);
      if(!q('bcTurn')) return;
      q('bcTurn').checked = !chess;
      q('bcChess').checked = chess;
      q('bcChess').disabled = !two;
      const secsEl = q('bs'+blitzPrefs.seconds) || q('bs0');
      secsEl.checked = true;
      BLITZ_SECONDS_CHOICES.concat([0]).forEach(v=>{ q('bs'+v).disabled = chess; });
      q('blitzSecsGroup').classList.toggle('is-off', chess);
      q('blitzNote').textContent = !two ? 'El reloj de ajedrez es sólo para 2 jugadores.'
        : (chess ? 'Cada jugador tiene 60 s para toda la partida y gana 3 s por jugada. Pierde quien llega a 0.' : '');
    }
    function blitzSummary(){
      const chess = blitzPrefs.clock==='chess' && currentPlayersCount()===2;
      return chess ? 'Reloj de ajedrez 60 s + 3 s' : (blitzPrefs.seconds || blitzDefaultSeconds(menuBoardSize()))+' s por turno';
    }
    function onDetailChange(e){
      const t = e.target;
      if(!t || (t.name!=='blitzClock' && t.name!=='blitzSecs')) return;
      if(t.name==='blitzClock') blitzPrefs.clock = t.value==='chess' ? 'chess' : 'turn';
      else blitzPrefs.seconds = BLITZ_SECONDS_CHOICES.indexOf(+t.value)>=0 ? +t.value : 0;
      const cfg = loadLastSetup() || {};
      cfg.blitzSeconds = blitzPrefs.seconds; cfg.blitzClock = blitzPrefs.clock;
      saveLastSetup(cfg);
      syncBlitzControls();
      syncTrigger();
      playToggleSound(true); vibrate(8);
    }
    function select(key, focusCard){
      if(!isAvailable(key)) return;
      pending = key;
      paint();
      if(focusCard){ const el = cardEls.find(c=> c.dataset.mode===key); if(el) el.focus({ preventScroll:true }); }
    }
    function onGridClick(e){
      const card = e.target.closest('.mode-card');
      if(!card || card.getAttribute('aria-disabled')==='true') return;
      const key = card.dataset.mode;
      if(key===pending){ confirm(); return; }          // segundo toque sobre la misma tarjeta = elegir
      select(key);
      playToggleSound(true); vibrate(8);
    }
    function onGridKey(e){
      const keys = MODE_CATALOG.map(m=> m.key), n = keys.length;
      let i = keys.indexOf(pending);
      if(e.key==='ArrowRight') i = (i+1) % n;
      else if(e.key==='ArrowLeft') i = (i+n-1) % n;
      else if(e.key==='ArrowDown') i = Math.min(n-1, i+COLS);
      else if(e.key==='ArrowUp') i = Math.max(0, i-COLS);
      else if(e.key==='Home') i = 0;
      else if(e.key==='End') i = n-1;
      else return;
      e.preventDefault();
      select(keys[i], true);
    }
    function open(){
      build();
      if(closeTimer){ clearTimeout(closeTimer); closeTimer = null; }
      const wasClosed = modesOverlay.classList.contains('hidden');
      if(wasClosed) returnFocusTo = document.activeElement;
      pending = MODE_BY_KEY[currentRuleset()] ? currentRuleset() : 'classic';
      cardEls.forEach(el=> el.classList.toggle('is-won', won(el.dataset.mode)));
      paint();
      if(wasClosed) openOverlay('modes');
      modeTriggerBtn.setAttribute('aria-expanded','true');
      const raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (fn=> setTimeout(fn,16));
      raf(()=> raf(()=>{
        modesOverlay.classList.add('show');
        const sel = cardEls.find(el=> el.dataset.mode===pending);
        if(sel) sel.focus({ preventScroll:true });
      }));
    }
    function close(){
      if(closeTimer || modesOverlay.classList.contains('hidden')) return;
      modesOverlay.classList.remove('show');
      modeTriggerBtn.setAttribute('aria-expanded','false');
      closeTimer = setTimeout(()=>{
        closeTimer = null;
        closeOverlay('modes');
        if(returnFocusTo && returnFocusTo.focus){ try{ returnFocusTo.focus({ preventScroll:true }); }catch(e){} }
        returnFocusTo = null;
      }, CLOSE_MS);
    }
    function confirm(){
      if(closeTimer) return;
      const key = pending;
      if(isAvailable(key) && key!==currentRuleset()){
        const apply = ()=>{
          rulesetSelect.value = key;
          rulesetSelect.dispatchEvent(new Event('change', { bubbles:true }));   // reutiliza toda la lógica existente del menú
        };
        if(!isUnlocked('mode:' + key)){ offerUnlock('mode:' + key, ()=>{ apply(); paint(); close(); }); return; }
        apply();
      }
      close();
    }
    function syncTrigger(){
      const key = MODE_BY_KEY[currentRuleset()] ? currentRuleset() : 'classic';
      if(key!==lastTriggerKey){
        lastTriggerKey = key;
        modeTriggerPlate.innerHTML = plateHTML(MODE_BY_KEY[key]);
        modeTriggerName.textContent = rs(key).label;
      }
      modeTriggerSub.textContent = key==='blitz' ? blitzSummary()+' · tocá para cambiar' : 'Tocá para ver los '+MODE_CATALOG.length+' modos';
    }
    return { build, open, close, confirm, syncTrigger };
  })();

  // ---------- tutorial ----------
  closeTutorialBtn.addEventListener('click', ()=> closeOverlay('tutorial'));
  helpLinkBtn.addEventListener('click', ()=> openOverlay('tutorial'));

  // ---------- desafío diario ----------
  function generateDailyLayout(dateStr, size, density){
    // la semilla del día sale del texto de la fecha (UTC): el mismo tablero para todos, ahora con patrones
    const dens = density || 'medio';
    const seed = Math.floor(hashStringToSeed('quoridor-daily-'+dateStr+'-'+size+(dens==='medio' ? '' : '-'+dens))() * SEED_SPACE);
    return generateMaze({ size, players:1, density:dens, seed }).walls;
  }
  function initDailyChallenge(){
    const ch = dailyChallengeFor(utcDayKey());
    initGame(1, ch.size, { isDaily:true, dailyWalls: ch.walls, dailyChallenge: ch, ruleset: ch.ruleset, turnTimeSeconds: ch.turnSeconds||0 });
    closeOverlay('daily');
    menuScreen.classList.add('hidden');
    editorScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
  }

  // --- compartir resultado (90) ---
  function dailyRecordFor(key){
    const d = statsData.daily;
    if(d.history[key]) return d.history[key];
    if(d.bestMoves[key]!=null) return { moves:d.bestMoves[key], par:null, stars:0, mode:null, size:null, timeouts:0 };   // días anteriores a la rotación
    return null;
  }
  function buildDailyShareText(key){
    const h = dailyRecordFor(key);
    if(!h) return '';
    const cfg = DAILY_ROTATION.find(x=> x.id===h.mode) || null;
    const lines = [`Quoridor · Desafío diario #${dailyNumberOf(key)}${cfg ? ' '+cfg.emoji : ''}`];
    lines.push((cfg ? `${cfg.label} · ${h.size||cfg.size}×${h.size||cfg.size} · ` : '') + `${key} (UTC)`);
    const stars = h.stars || (cfg && h.par!=null ? dailyStars(h.moves, h.par, cfg.slack) : 0);
    const diff = h.par!=null ? h.moves - h.par : null;
    lines.push((stars ? '⭐'.repeat(stars)+'☆'.repeat(3-stars)+' ' : '') + `${h.moves} movimiento${h.moves===1?'':'s'}`
      + (h.par!=null ? ` (par ${h.par}${diff>0 ? ', +'+diff : ''})` : ''));
    if(h.timeouts>0) lines.push(`⏱️ Tiempos agotados: ${h.timeouts}`);
    const st = dailyStreakStatus(statsData.daily, utcDayKey());
    if(key===utcDayKey() && st.alive && st.streak>0) lines.push(`🔥 Racha: ${st.streak} día${st.streak===1?'':'s'}`);
    lines.push(key===utcDayKey() ? '¿Podés mejorarlo? El desafío de hoy es el mismo para todos.' : 'Ese día el desafío era el mismo para todos.');
    return lines.join('\n');
  }
  function copyTextFallback(text){
    try{
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly',''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    }catch(e){ return false; }
  }
  async function shareDailyResult(key){
    key = key || utcDayKey();
    const text = buildDailyShareText(key);
    if(!text){ showToast('Todavía no resolviste ese desafío.'); return; }
    try{
      if(navigator.share){ await navigator.share({ text }); return; }
    }catch(e){
      if(e && e.name==='AbortError') return;          // el jugador cerró el menú de compartir
    }
    let copied = false;
    try{ if(navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(text); copied = true; } }catch(e){}
    if(!copied) copied = copyTextFallback(text);
    showToast(copied ? '📋 Resultado copiado. ¡Pegalo donde quieras!' : 'No se pudo compartir. Copiá el resultado a mano desde la captura.');
  }
  shareDailyBtn.addEventListener('click', ()=> shareDailyResult(dailyInfoOf(state).dateKey));
  shareDailyOverlayBtn.addEventListener('click', ()=> shareDailyResult(utcDayKey()));

  // --- calendario (91) ---
  const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  let dailyCalView = null;     // mes que se está mirando: { y, m } (UTC)
  function dailyCalReset(){ const t = new Date(); dailyCalView = { y:t.getUTCFullYear(), m:t.getUTCMonth() }; }
  function renderDailyCalendar(){
    if(!dailyCalView) dailyCalReset();
    const d = statsData.daily, todayK = utcDayKey();
    const { y, m } = dailyCalView;
    const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;              // la semana arranca el lunes
    const total = new Date(Date.UTC(y, m+1, 0)).getUTCDate();
    let cells = '', done = 0, shielded = 0, elapsed = 0;
    for(let i=0;i<lead;i++) cells += '<span class="cal-day blank"></span>';
    for(let day=1; day<=total; day++){
      const key = y+'-'+String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
      const future = key > todayK, isDone = isDailyDone(d, key), isShield = !isDone && !!d.shielded[key];
      const h = d.history[key], stars = h ? (h.stars||0) : 0;
      if(!future) elapsed++;
      if(isDone) done++;
      if(isShield) shielded++;
      const cfg = h && DAILY_ROTATION.find(x=> x.id===h.mode);
      const label = `${day} de ${MONTHS_ES[m]}` + (isDone ? `: resuelto en ${h ? h.moves : d.bestMoves[key]} movimientos${cfg ? ' ('+cfg.label+')' : ''}` : (isShield ? ': día protegido por un escudo' : (future ? '' : ': sin resolver')));
      const cls = 'cal-day' + (isDone ? ' done'+(stars ? ' s'+stars : '') : '') + (isShield ? ' shield' : '') + (key===todayK ? ' today' : '') + (future ? ' future' : '');
      const mark = isDone ? (stars ? '★'.repeat(stars) : '✓') : (isShield ? '🛡️' : '');
      cells += `<span class="${cls}" title="${label}" aria-label="${label}"><b>${day}</b><i>${mark}</i></span>`;
    }
    dailyCalTitle.textContent = MONTHS_ES[m] + ' ' + y;
    dailyCalGrid.innerHTML = cells;
    const first = new Date(DAILY_EPOCH_UTC), minIdx = first.getUTCFullYear()*12 + first.getUTCMonth();
    const now = new Date(), maxIdx = now.getUTCFullYear()*12 + now.getUTCMonth();
    dailyCalPrev.disabled = (y*12+m) <= minIdx;
    dailyCalNext.disabled = (y*12+m) >= maxIdx;
    dailyCalLegend.textContent = `${done} de ${elapsed} día${elapsed===1?'':'s'} resuelto${done===1?'':'s'} este mes` + (shielded ? ` · ${shielded} protegido${shielded===1?'':'s'} 🛡️` : '');
  }
  function dailyCalMove(delta){
    if(!dailyCalView) dailyCalReset();
    let idx = dailyCalView.y*12 + dailyCalView.m + delta;
    dailyCalView = { y:Math.floor(idx/12), m:((idx%12)+12)%12 };
    renderDailyCalendar();
  }
  dailyCalPrev.addEventListener('click', ()=> dailyCalMove(-1));
  dailyCalNext.addEventListener('click', ()=> dailyCalMove(1));

  function renderDailyOverlay(){
    const today = utcDayKey();
    const d = statsData.daily;
    const ch = dailyChallengeFor(today);
    const tomorrow = dailyModeFor(dayKeyAdd(today, 1));
    const doneToday = isDailyDone(d, today);
    const rec = dailyRecordFor(today);
    const par = ch.par;
    const st = dailyStreakStatus(d, today);
    const resetLocal = new Date(dayKeyToMs(dayKeyAdd(today, 1))).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    let html = `<div class="daily-mode"><span class="dm-emoji">${ch.emoji}</span><div><b>Desafío #${ch.number} · ${ch.label}</b><small>${ch.size}×${ch.size} · par ${par}${ch.turnSeconds ? ' · '+ch.turnSeconds+' s por turno' : ''}</small></div></div>`;
    if(doneToday && rec){
      const stars = rec.stars || dailyStars(rec.moves, par, ch.slack);
      html += `<div class="daily-stars">${starsHTML(stars,3,34)}</div><div class="sub">Ya lo resolviste hoy en ${rec.moves} movimiento${rec.moves===1?'':'s'} (par: ${par}).</div>`;
    } else {
      html += `<div class="sub">${ch.hint}</div><div class="sub">Todavía no lo resolviste hoy. Es el mismo desafío para todos los jugadores.</div>`;
    }
    const curStreak = st.alive ? st.streak : 0;
    const nextStreak = doneToday ? curStreak : curStreak + 1;
    const pos = ((Math.max(nextStreak,1) - 1) % 7) + 1;
    let dots = '';
    for(let i=1;i<=7;i++){
      const on = doneToday ? i<=pos : i<pos;
      dots += `<span class="${on?'on':''}">${i===7 ? '🎁' : ''}</span>`;
    }
    html += `<div class="streak-dots">${dots}</div>`;
    const base = dailyBaseCoins(nextStreak);
    html += (wallet.dailyPaid===today)
      ? `<div class="sub">Ya cobraste la recompensa de hoy.</div>`
      : `<div class="sub">Recompensa de hoy: de ${base} a ${base+20} monedas según las estrellas (3 estrellas si igualás el par).</div>`;
    html += `<div class="sub" style="margin-top:8px;">🔥 Racha actual: ${curStreak} día${curStreak===1?'':'s'} · Mejor racha: ${d.bestStreak||0}</div>`;
    html += `<div class="sub">🛡️ Escudos: ${d.shields||0}/${DAILY_SHIELD_MAX}. Ganás uno cada ${DAILY_SHIELD_EVERY} días seguidos y cubre un día sin jugar.</div>`;
    if(!doneToday){
      if(st.gap!=null && st.gap>=2 && st.covered) html += `<div class="sub daily-warn">🛡️ Faltaste ${st.missed} día${st.missed===1?'':'s'}: si resolvés el de hoy, tus escudos protegen la racha.</div>`;
      else if(st.gap!=null && st.gap>=2 && (d.streak||0)>0) html += `<div class="sub daily-warn">Tu racha de ${d.streak} día${d.streak===1?'':'s'} se cortó: tus escudos no alcanzan para cubrir ${st.missed} días. ¡Empezá una nueva hoy!</div>`;
      else if(st.gap===1 && curStreak>0) html += `<div class="sub daily-warn">¡No cortes la racha! Resolvé el desafío de hoy.</div>`;
    }
    html += `<div class="sub" style="margin-top:8px;">Mañana: ${tomorrow.emoji} ${tomorrow.label}. Cambia todos los días a las ${resetLocal} (00:00 UTC).</div>`;
    dailyStatusBody.innerHTML = html;
    playDailyBtn.textContent = doneToday ? 'Jugar de nuevo' : 'Jugar';
    shareDailyOverlayBtn.classList.toggle('hidden', !doneToday);
    renderDailyCalendar();
  }
  function openDailyOverlay(){ dailyCalReset(); renderDailyOverlay(); openOverlay('daily'); }
  dailyReadyChip.addEventListener('click', openDailyOverlay);
  dailyLinkBtn.addEventListener('click', openDailyOverlay);
  playDailyBtn.addEventListener('click', initDailyChallenge);
  closeDailyBtn.addEventListener('click', ()=> closeOverlay('daily'));

  // El desafío cambia a las 00:00 UTC: si la app queda abierta, se refresca el aviso y el panel al cruzar la medianoche.
  let lastUtcDay = utcDayKey();
  function checkDayRollover(){
    const k = utcDayKey();
    if(k===lastUtcDay) return;
    lastUtcDay = k;
    updateBadges();
    if(!dailyOverlay.classList.contains('hidden')){ dailyCalReset(); renderDailyOverlay(); }
  }
  setInterval(checkDayRollover, 60000);
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) checkDayRollover(); });

  // ---------- recordatorio diario (notificaciones nativas, ver MainActivity.java) ----------
  function loadReminderPref(){
    try{ return JSON.parse(localStorage.getItem('quoridor_reminder')||'null') || { enabled:false, time:'19:00' }; }
    catch(e){ return { enabled:false, time:'19:00' }; }
  }
  function saveReminderPref(p){ try{ localStorage.setItem('quoridor_reminder', JSON.stringify(p)); }catch(e){} }
  let reminderPref = loadReminderPref();
  function updateReminderUI(){
    reminderTimeInput.value = reminderPref.time || '19:00';
    reminderToggleBtn.textContent = reminderPref.enabled ? '🔔 Activado (tocar para apagar)' : 'Activar';
    const hasBridge = !!(window.AndroidNotifications && window.AndroidNotifications.scheduleDailyReminder);
    reminderHint.textContent = hasBridge
      ? 'Te avisa cuando el desafío diario está listo.'
      : 'Disponible sólo en la app de Android instalada (no en el navegador).';
    reminderToggleBtn.disabled = !hasBridge;
    reminderTimeInput.disabled = !hasBridge;
  }
  reminderToggleBtn.addEventListener('click', ()=>{
    const hasBridge = !!(window.AndroidNotifications && window.AndroidNotifications.scheduleDailyReminder);
    if(!hasBridge) return;
    if(reminderPref.enabled){
      window.AndroidNotifications.cancelDailyReminder();
      reminderPref.enabled = false;
      saveReminderPref(reminderPref);
      updateReminderUI();
    } else {
      const [h,m] = (reminderTimeInput.value||'19:00').split(':').map(Number);
      window.AndroidNotifications.scheduleDailyReminder(h, m);
      // La confirmación final llega por window.QuoridorNotifPermissionResult si hacía falta permiso;
      // si el permiso ya estaba concedido, damos por hecho que se programó.
      reminderPref.enabled = true;
      reminderPref.time = reminderTimeInput.value;
      saveReminderPref(reminderPref);
      updateReminderUI();
    }
  });
  reminderTimeInput.addEventListener('change', ()=>{
    reminderPref.time = reminderTimeInput.value;
    saveReminderPref(reminderPref);
    if(reminderPref.enabled && window.AndroidNotifications){
      const [h,m] = reminderTimeInput.value.split(':').map(Number);
      window.AndroidNotifications.scheduleDailyReminder(h,m);
    }
  });
  window.QuoridorNotifPermissionResult = function(granted){
    if(!granted){
      reminderPref.enabled = false;
      saveReminderPref(reminderPref);
      reminderHint.textContent = 'No se pudo activar: falta el permiso de notificaciones de Android.';
    }
    updateReminderUI();
  };

  // ---------- editor de niveles ----------
  let editorState = null;
  function editorReset(size){
    const count=editorState&&editorState.players ? editorState.players.length : 2;
    editorState={
      size,
      objective:{r:Math.floor((size-1)/2),c:Math.floor((size-1)/2),mode:'center'},
      players:defaultEditorPlayers(size,count),
      turnTime:0,ruleset:'classic',
      occupied:Array.from({length:size-1},()=>Array(size-1).fill(null)),
      walls:[]
    };
    syncEditorControls();
  }
  function editorCanPlaceWallSlot(r,c,orientation){
    const size = editorState.size;
    if(r<0||c<0||r>size-2||c>size-2) return false;
    if(editorState.occupied[r][c]) return false;
    if(orientation==='h'){
      if(c>0 && editorState.occupied[r][c-1]==='h') return false;
      if(c<size-2 && editorState.occupied[r][c+1]==='h') return false;
    } else {
      if(r>0 && editorState.occupied[r-1][c]==='v') return false;
      if(r<size-2 && editorState.occupied[r+1][c]==='v') return false;
    }
    return true;
  }
  function editorToggleSlot(r,c,orientation){
    const existingHere = editorState.occupied[r][c];
    if(existingHere===orientation){
      editorState.occupied[r][c] = null;
      editorState.walls = editorState.walls.filter(w=> !(w.r===r && w.c===c && w.orientation===orientation));
      editorFeedback.textContent = 'Pared quitada.';
      renderEditor();
      return;
    }
    if(!editorCanPlaceWallSlot(r,c,orientation)){
      editorFeedback.textContent = 'Ahí no se puede: se cruza o se pega con otra pared.';
      return;
    }
    editorState.occupied[r][c] = orientation;
    editorState.walls.push({ r, c, orientation });
    editorFeedback.textContent = 'Pared agregada. Podés seguir editando.';
    renderEditor();
  }
  function editorValidate(){
    const size=editorState.size,obj=editorState.objective,seen=new Set();
    for(const p of editorState.players){
      if(p.r<0||p.c<0||p.r>=size||p.c>=size) return false;
      const key=p.r+','+p.c; if(seen.has(key)) return false; seen.add(key);
    }
    if(obj.r<0||obj.c<0||obj.r>=size||obj.c>=size) return false;
    const blockedSet=new Set();
    editorState.walls.forEach(w=>wallEdges(w.r,w.c,w.orientation).forEach(e=>blockedSet.add(edgeKey(e[0],e[1],e[2],e[3]))));
    for(const p of editorState.players) if(!hasPath(p.r,p.c,obj.r,obj.c,blockedSet,size)) return false;
    if(editorState.players.some(p=>p.r===obj.r&&p.c===obj.c)) return false; // nadie puede empezar sobre el objetivo
    if(editorState.ruleset==='teams'&&editorState.players.length!==4) return false;
    if(editorState.ruleset==='mirror'&&editorState.players.length!==2) return false;
    return true;
  }
  function renderEditor(){
    const size = editorState.size;
    const cs = BOARD_PX/size;
    let gridHTML = `<rect x="0" y="0" width="${BOARD_PX}" height="${BOARD_PX}" fill="var(--board)"/>`;
    for(let r=0;r<size;r++) for(let c=0;c<size;c++){
      if((r+c)%2===1) gridHTML += `<rect x="${c*cs}" y="${r*cs}" width="${cs}" height="${cs}" fill="var(--board-alt)"/>`;
    }
    for(let i=1;i<size;i++){
      gridHTML += `<line x1="${i*cs}" y1="0" x2="${i*cs}" y2="${BOARD_PX}" stroke="var(--line)" stroke-width="1"/>`;
      gridHTML += `<line x1="0" y1="${i*cs}" x2="${BOARD_PX}" y2="${i*cs}" stroke="var(--line)" stroke-width="1"/>`;
    }
    const obj=editorState.objective;
    const ccx=(obj.c+0.5)*cs, ccy=(obj.r+0.5)*cs;
    gridHTML += `<circle cx="${ccx}" cy="${ccy}" r="15" fill="none" stroke="var(--accent)" stroke-width="3"/>`;
    editorState.players.forEach((p,i)=>{
      const px=(p.c+0.5)*cs,py=(p.r+0.5)*cs,color=PALETTE[i].color;
      gridHTML += `<circle cx="${px}" cy="${py}" r="${cs*0.28}" fill="${color}" opacity=".9" stroke="var(--panel)" stroke-width="2"/><text x="${px}" y="${py+4}" text-anchor="middle" font-size="${cs*.24}" font-weight="700" fill="white">${i+1}</text>`;
    });
    editorGridGroup.innerHTML = gridHTML;
    let wallsHTML = '';
    editorState.walls.forEach(w=>{
      const rect = wallRect(w.r,w.c,w.orientation,cs);
      const rx = rect.h>rect.w ? rect.w*0.4 : rect.h*0.4;
      wallsHTML += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="${rx}" fill="var(--accent)" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>`;
    });
    editorWallsGroup.innerHTML = wallsHTML;
  }
  function editorGetSlotFromPoint(x,y){
    const size = editorState.size;
    const cs = BOARD_PX/size;
    const colF = x/cs, rowF = y/cs;
    const nearestCol = Math.min(Math.max(Math.round(colF),1), size-1);
    const nearestRow = Math.min(Math.max(Math.round(rowF),1), size-1);
    const distV = Math.abs(colF-nearestCol)*cs;
    const distH = Math.abs(rowF-nearestRow)*cs;
    const orientation = distV < distH ? 'v' : 'h';
    const r = Math.min(Math.max(nearestRow-1,0), size-2);
    const c = Math.min(Math.max(nearestCol-1,0), size-2);
    return { r, c, orientation };
  }
  editorBoardSvg.addEventListener('pointerdown', e=>{
    if(!editorState) return;
    const pt = editorBoardSvg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const loc = pt.matrixTransform(editorBoardSvg.getScreenCTM().inverse());
    const slot = editorGetSlotFromPoint(loc.x, loc.y);
    editorToggleSlot(slot.r, slot.c, slot.orientation);
  });
  function loadCustomLevels(){
    try{ const raw = JSON.parse(localStorage.getItem('quoridor_customLevels')||'[]'); return Array.isArray(raw)?raw:[]; }
    catch(e){ return []; }
  }
  function saveCustomLevels(list){ try{ localStorage.setItem('quoridor_customLevels', JSON.stringify(list)); }catch(e){} }
  function renderEditorLevelsList(){
    const list = loadCustomLevels();
    if(!list.length){ editorLevelsList.innerHTML = '<p class="field-hint">Todavía no guardaste ningún nivel.</p>'; return; }
    editorLevelsList.innerHTML = list.map((lvl,i)=> lvl.pattern ? `
      <div class="editor-level-row">
        <span class="lvl-name">🧱 ${escapeHtml(lvl.name)} <small>(patrón · ${(lvl.walls||[]).length} tramos)</small></span>
        <button type="button" class="kbtn grey small" data-act="load" data-i="${i}">Cargar</button>
        <button type="button" class="kbtn red small" data-act="del" data-i="${i}">Borrar</button>
      </div>` : `
      <div class="editor-level-row">
        <span class="lvl-name">${escapeHtml(lvl.name)} (${lvl.size}×${lvl.size})</span>
        <button type="button" class="kbtn grey small" data-act="load" data-i="${i}">Cargar</button>
        <button type="button" class="kbtn yellow small" data-act="play" data-i="${i}">Jugar</button>
        <button type="button" class="kbtn red small" data-act="del" data-i="${i}">Borrar</button>
      </div>`).join('');
  }
  editorLevelsList.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-act]');
    if(!btn) return;
    const list = loadCustomLevels();
    const i = +btn.dataset.i;
    const lvl = list[i];
    if(!lvl) return;
    if(btn.dataset.act==='del'){
      list.splice(i,1); saveCustomLevels(list); renderEditorLevelsList();
    } else if(btn.dataset.act==='load' && lvl.pattern){
      // un patrón guardado se carga pegado a la esquina de arriba a la izquierda
      editorReset(editorState.size);
      (lvl.walls||[]).forEach(w=>{
        if(w.r<=editorState.size-2 && w.c<=editorState.size-2 && editorCanPlaceWallSlot(w.r,w.c,w.orientation)){
          editorState.occupied[w.r][w.c]=w.orientation; editorState.walls.push({ r:w.r, c:w.c, orientation:w.orientation });
        }
      });
      renderEditor();
      editorFeedback.textContent = `Cargaste el patrón "${lvl.name}". Lo que no entra en este tamaño se omite.`;
    } else if(btn.dataset.act==='load'){
      editorSizeSelect.value = String(lvl.size);
      editorReset(lvl.size);
      editorState.objective = lvl.objective ? Object.assign({}, lvl.objective) : editorState.objective;
      editorState.turnTime = +lvl.turnTime || 0;
      editorState.ruleset = lvl.ruleset || 'classic';
      if(Array.isArray(lvl.players) && lvl.players.length>=2) editorState.players = lvl.players.slice(0,4).map(p=> Object.assign({}, p));
      (lvl.walls||[]).forEach(w=>{ editorState.occupied[w.r][w.c]=w.orientation; editorState.walls.push(Object.assign({}, w)); });
      syncEditorControls();
      editorFeedback.textContent = `Cargaste "${lvl.name}". Podés seguir editando.`;
    } else if(btn.dataset.act==='play'){
      startCustomLevelMatch(lvl);
    }
  });
  function startCustomLevelMatch(lvl){
    const count=Array.isArray(lvl.players)?lvl.players.length:2;
    initGame(count,lvl.size,{presetWalls:lvl.walls||[],isCustomLevel:true,ruleset:lvl.ruleset||'classic',objective:lvl.objective,turnTimeSeconds:+lvl.turnTime||0,playerConfigs:lvl.players});
    editorScreen.classList.add('hidden');menuScreen.classList.add('hidden');gameScreen.classList.remove('hidden');
  }
  editorSizeSelect.addEventListener('change', ()=>{ editorReset(+editorSizeSelect.value); renderEditor(); });
  editorClearBtn.addEventListener('click', ()=>{ editorReset(editorState.size); renderEditor(); editorFeedback.textContent='Tablero limpio.'; });
  editorSaveBtn.addEventListener('click', ()=>{
    if(!editorValidate()){ editorFeedback.textContent='El diseño no es válido: revisá las posiciones de los jugadores, el objetivo, que todos tengan camino posible o la cantidad de jugadores que pide el modo elegido.'; return; }
    openNamePrompt('level');                         // modal propio: prompt() no es confiable en un WebView
  });
  let namePromptMode = 'level';
  function openNamePrompt(mode){
    namePromptMode = mode;
    namePromptTitle.textContent = mode==='pattern' ? 'Nombre del patrón' : 'Nombre del nivel';
    levelNameInput.value = mode==='pattern' ? 'Mi patrón' : 'Mi nivel';
    openOverlay('namePrompt');
    setTimeout(()=>{ try{ levelNameInput.focus(); levelNameInput.select(); }catch(e){} }, 60);
  }
  editorSavePatternBtn.addEventListener('click', ()=>{
    if(!editorState.walls.length){ editorFeedback.textContent = 'Poné al menos una pared para guardar un patrón.'; return; }
    if(editorState.walls.length>24){ editorFeedback.textContent = 'Un patrón puede tener hasta 24 tramos.'; return; }
    openNamePrompt('pattern');
  });
  function saveEditorPattern(name){
    // coordenadas relativas: la pared más arriba y más a la izquierda pasa a ser (0,0)
    const r0 = Math.min(...editorState.walls.map(w=> w.r)), c0 = Math.min(...editorState.walls.map(w=> w.c));
    const list = loadCustomLevels();
    list.push({ name:name.slice(0,24), pattern:true, size:editorState.size,
      walls: editorState.walls.map(w=> ({ r:w.r-r0, c:w.c-c0, orientation:w.orientation })) });
    saveCustomLevels(list);
    renderEditorLevelsList();
    editorFeedback.textContent = 'Patrón guardado. Entra en el sorteo del Laberinto si tildás "Incluir mis patrones".';
  }
  function confirmLevelName(){
    const name = (levelNameInput.value || '').trim();
    if(!name){ levelNameInput.focus(); return; }
    if(namePromptMode==='pattern'){ saveEditorPattern(name); closeOverlay('namePrompt'); namePromptMode = 'level'; return; }
    const list = loadCustomLevels();
    list.push({ name: name.slice(0,24), size: editorState.size, objective: Object.assign({}, editorState.objective), turnTime: editorState.turnTime||0, ruleset: editorState.ruleset||'classic',
      players: editorState.players.map(p=>({ r:p.r, c:p.c, walls:p.walls, isCPU:!!p.isCPU, difficulty:p.difficulty||'easy' })),
      walls: editorState.walls.map(w=>({r:w.r,c:w.c,orientation:w.orientation})) });
    saveCustomLevels(list);
    renderEditorLevelsList();
    editorFeedback.textContent = 'Nivel guardado.';
    closeOverlay('namePrompt');
  }
  levelNameOkBtn.addEventListener('click', confirmLevelName);
  levelNameCancelBtn.addEventListener('click', ()=>{ closeOverlay('namePrompt'); namePromptMode = 'level'; });
  levelNameInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); confirmLevelName(); } });
  editorPlayBtn.addEventListener('click', ()=>{
    if(!editorValidate()){
      editorFeedback.textContent='El diseño no es válido: revisá las posiciones de los jugadores, el objetivo, que todos tengan camino posible o la cantidad de jugadores que pide el modo elegido.';
      return;
    }
    startCustomLevelMatch({
      size: editorState.size,
      objective: { r: editorState.objective.r, c: editorState.objective.c },
      turnTime: editorState.turnTime||0,
      ruleset: editorState.ruleset||'classic',
      players: editorState.players.map(p=>({ r:p.r, c:p.c, walls:p.walls, isCPU:!!p.isCPU, difficulty:p.difficulty||'easy' })),
      walls: editorState.walls.map(w=>({ r:w.r, c:w.c, orientation:w.orientation })),
    });
  });
  editorLinkBtn.addEventListener('click', ()=>{
    closeOverlay('more');
    editorReset(9);
    renderEditor();
    renderEditorLevelsList();
    menuScreen.classList.add('hidden');
    editorScreen.classList.remove('hidden');
  });
  editorBackBtn.addEventListener('click', ()=>{
    editorScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
  });

  editorPlayersCount.addEventListener('change', ()=>{
    const count = Math.max(2, Math.min(4, +editorPlayersCount.value || 2));
    const old = editorState.players || [], next = defaultEditorPlayers(editorState.size, count);
    next.forEach((p,i)=>{ if(old[i]) Object.assign(p, old[i]); p.r = Math.max(0,Math.min(editorState.size-1,+p.r||0)); p.c = Math.max(0,Math.min(editorState.size-1,+p.c||0)); });
    editorState.players = next; syncEditorControls();
  });
  editorTurnTime.addEventListener('change', ()=>{ editorState.turnTime = +editorTurnTime.value || 0; });
  editorRuleset.addEventListener('change', ()=>{ editorState.ruleset = editorRuleset.value; });
  document.querySelectorAll('input[name="editorObjective"]').forEach(r=> r.addEventListener('change', editorApplyObjective));
  editorObjectiveRow.addEventListener('change', editorApplyObjective);
  editorObjectiveCol.addEventListener('change', editorApplyObjective);
  editorPlayersConfig.addEventListener('change', e=>{
    const el = e.target.closest('[data-player]'); if(!el) return;
    const p = editorState.players[+el.dataset.player]; if(!p) return;
    if(el.dataset.field==='control'){ p.isCPU = el.value==='cpu'; syncEditorControls(); }
    if(el.dataset.field==='difficulty') p.difficulty = el.value;
  });
  editorPlayersConfig.addEventListener('input', e=>{
    const el = e.target.closest('[data-player]'); if(!el) return;
    const p = editorState.players[+el.dataset.player]; if(!p) return;
    const v = +el.value;
    if(el.dataset.field==='r') p.r = Math.max(0, Math.min(editorState.size-1, (v||1)-1));
    if(el.dataset.field==='c') p.c = Math.max(0, Math.min(editorState.size-1, (v||1)-1));
    if(el.dataset.field==='walls') p.walls = Math.max(0, Math.min(50, v||0));
    if(el.dataset.field==='r' || el.dataset.field==='c') renderEditor();
  });

  // ---------- menú & navegación ----------
  function goToMenu(){
    invalidateBotTimer();
    clearTurnTimer();
    clearEmotes();
    hideEmoteBar();
    gameScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    hideWinOverlay();
    closeOverlay('pause');
    updateCoinUI(false);
    updateBadges();
    refreshCustomLevelSelect();
  }
  pauseBtn.addEventListener('click', ()=>{ if(state) openOverlay('pause'); });
  resumeBtn.addEventListener('click', ()=> closeOverlay('pause'));
  moreLinkBtn.addEventListener('click', ()=> openOverlay('more'));
  closeMoreBtn.addEventListener('click', ()=> closeOverlay('more'));
  closeSkinsBtn.addEventListener('click', ()=> updateMenuVisibility());
  function doRestart(sameMap){
    if(!state) return;
    if(state.isDaily){ hideWinOverlay(); closeOverlay('pause'); initDailyChallenge(); return; }
    sanitizeSkinsForLocks();
    if(!state.campaign && !isUnlocked('mode:' + state.ruleset)){
      showToast('⏱️ Terminó el desbloqueo de «' + escapeHtml((RULESETS[state.ruleset]||{}).label || state.ruleset) + '».');
      goToMenu();
      return;
    }
    const cfg = {
      isCpu: !!state.isCpuGame,
      difficulty: (state.players[1] && state.players[1].difficulty) || 'easy',
      names: loadPlayerNames(),
      ruleset: state.ruleset,
      campaign: state.campaign, campaignLevel: state.campaignLevel, campaignRival: state.campaignRival, campaignPersonality: state.campaignPersonality,
      presetWalls: state.presetWalls, isCustomLevel: state.isCustomLevel, objective: state.objective,
      turnTimeSeconds: state.turnTimeSeconds, clockMode: state.clockMode, playerConfigs: state.playerConfigs,
      hunterRole: state.fugitiveIdx===1 ? 'hunter' : 'fugitive',
      teamGoal: state.teamGoal,   // el sorteo del equipo inicial se repite en cada partida
    };
    if(state.mazeInfo){
      cfg.mazeDensity = state.mazeInfo.density;
      cfg.mazeMine = state.mazeInfo.mine;
      if(sameMap===true) cfg.mazeSeed = state.mazeInfo.seed;      // "Repetir mapa": misma semilla, mismo mapa
    }
    const playersCount = state.players.length;
    const size = state.size;
    hideWinOverlay();
    closeOverlay('pause');
    initGame(playersCount, size, cfg);
  }

  startBtn.addEventListener('click', ()=>{
    const ruleset = currentRuleset();
    sanitizeSkinsForLocks();
    if(!isUnlocked('mode:' + ruleset)){             // el desbloqueo temporal terminó
      showToast('⏱️ Terminó el desbloqueo de «' + escapeHtml(RULESETS[ruleset].label) + '». Elegí otro modo o desbloquealo de nuevo.');
      rulesetSelect.value = 'classic';
      rulesetSelect.dispatchEvent(new Event('change', { bubbles:true }));
      return;
    }
    const m = currentMode();
    const isCpu = m==='cpu';
    const teamAlly = ruleset==='teams' && currentTeamSetup()==='ally';
    const teamGoal = currentTeamGoal();
    const playersCount = currentPlayersCount();
    let size = +document.querySelector('input[name="size"]:checked').value;
    let presetWalls = null, isCustomLevel = false;
    if(ruleset==='maze' && customLevelSelect.value!=='random'){
      const lvl = loadCustomLevels()[+customLevelSelect.value];
      if(lvl){ size = lvl.size; presetWalls = lvl.walls; isCustomLevel = true; }
    }
    const diffRadio = document.querySelector('input[name="difficulty"]:checked');
    const difficulty = diffRadio ? diffRadio.value : 'easy';

    const names = loadPlayerNames();
    for(let i=0;i<playersCount;i++){
      if((isCpu && i===1) || (teamAlly && i>0)) continue;
      const inp = document.getElementById('nameInput'+i);
      if(inp){ names[i] = inp.value.trim(); }
    }
    savePlayerNames(names);
    const hunterRole = currentHunterRole();
    saveLastSetup({ playersCount, size: +document.querySelector('input[name="size"]:checked').value, mode:m, difficulty, ruleset, teamGoal, teamSetup: currentTeamSetup(),
      mazeDensity: currentMazeDensity(), mazeMine: !!mazeMineCheck.checked, hunterRole,
      blitzSeconds: blitzPrefs.seconds, blitzClock: blitzPrefs.clock });

    const mazeOpts = (ruleset==='maze' && !presetWalls) ? { mazeSeed: mazeMenuSeed, mazeDensity: currentMazeDensity(), mazeMine: mazeMineCheck.checked ? loadUserPatterns() : [] } : {};
    const blitzOpts = (ruleset==='blitz' && !isCustomLevel) ? blitzSetup(size, playersCount) : {};
    const teamOpts = ruleset==='teams' ? { teamGoal, playerConfigs: teamAlly ? buildTeamAllyConfigs(size, difficulty) : null } : {};
    initGame(playersCount, size, Object.assign({ isCpu, difficulty, names, ruleset, presetWalls, isCustomLevel, hunterRole }, mazeOpts, blitzOpts, teamOpts));
    mazeMenuSeed = newMazeSeed();                    // el próximo mapa del menú ya es otro
    menuScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
  });

  restartBtn.addEventListener('click', ()=>{
    if(!state) return;
    if(matchInProgress()){
      showConfirm('¿Reiniciar esta partida? Vas a perder el progreso actual.', doRestart);
    } else {
      doRestart();
    }
  });

  menuBtn.addEventListener('click', ()=>{
    if(matchInProgress()){
      showConfirm('¿Volver al menú? Vas a perder el progreso de esta partida.', goToMenu);
    } else {
      goToMenu();
    }
  });

  playAgainBtn.addEventListener('click', ()=> doRestart());
  repeatMapBtn.addEventListener('click', ()=> doRestart(true));
  changeConfigBtn.addEventListener('click', goToMenu);

  // ---------- botón físico "atrás" de Android (ver MainActivity.java) ----------
  window.QuoridorHandleBack = function(){
    if(!emoteBar.classList.contains('hidden')){ hideEmoteBar(); return; }
    if(closeTopOverlay()) return;
    if(!editorScreen.classList.contains('hidden')){
      editorBackBtn.click();
      return;
    }
    if(!gameScreen.classList.contains('hidden') && matchInProgress()){
      showConfirm('¿Salir al menú? Vas a perder el progreso de esta partida.', goToMenu);
      return;
    }
    if(window.AndroidExitBridge && window.AndroidExitBridge.exitApp){
      window.AndroidExitBridge.exitApp();
    }
  };

  // ---------- arranque ----------
  applyTheme(loadThemePref());
  updateReminderUI();
  applyGlass();
  applyShowMoves();
  preloadAssets();
  updateCoinUI(false);
  applyBoardTheme();
  pruneEntitlements();
  if(billingAvailable() && typeof window.AndroidBilling.queryPurchases==='function'){   // 139 · verificar la compra al iniciar
    billingSilentRestore = true;
    try{ window.AndroidBilling.queryPurchases(); }catch(e){ billingSilentRestore = false; }
  }
  setTimeout(()=>{
    if(walletTamperNotice || entTamperNotice) showToast('⚠️ Detectamos cambios en tus datos de la tienda y se restauró el último estado válido.');
    if(welcomeClaimable() && !wallet.welcomeShown){
      wallet.welcomeShown = true; saveWallet();
      showToast('🎁 Tenés un paquete de bienvenida esperando en la tienda');
    }
    updateBadges();
  }, 900);

  (function restoreLastSetup(){
    const cfg = loadLastSetup();
    if(!cfg) return;
    if(cfg.mode==='cpu'){
      const r = document.getElementById('modeCpu'); if(r) r.checked = true;
    } else {
      const r = document.getElementById('modeLocal'); if(r) r.checked = true;
      if(cfg.playersCount){
        const pr = document.getElementById('p'+cfg.playersCount); if(pr) pr.checked = true;
      }
    }
    if(cfg.difficulty && DIFFICULTY[cfg.difficulty]){
      const dr = document.getElementById('diff' + cfg.difficulty.charAt(0).toUpperCase() + cfg.difficulty.slice(1)); if(dr) dr.checked = true;
    }
    if(cfg.size){
      const sr = document.getElementById('s'+cfg.size); if(sr) sr.checked = true;
    }
    if(cfg.ruleset && RULESETS[cfg.ruleset] && isUnlocked('mode:' + cfg.ruleset)){
      rulesetSelect.value = cfg.ruleset;
    }
    if(cfg.mazeDensity && MAZE_DENSITIES[cfg.mazeDensity]){
      const dr = document.querySelector('input[name="mazeDensity"][value="'+cfg.mazeDensity+'"]'); if(dr) dr.checked = true;
    }
    if(cfg.mazeMine) mazeMineCheck.checked = true;
    if(cfg.teamGoal==='both'){ const tg = document.getElementById('tgBoth'); if(tg) tg.checked = true; }
    if(cfg.teamSetup==='ally'){ const ts = document.getElementById('tsAlly'); if(ts) ts.checked = true; }
    if(cfg.hunterRole==='hunter'){ const hr = document.getElementById('roleHunter'); if(hr) hr.checked = true; }
    if(BLITZ_SECONDS_CHOICES.indexOf(+cfg.blitzSeconds)>=0) blitzPrefs.seconds = +cfg.blitzSeconds;
    if(cfg.blitzClock==='chess') blitzPrefs.clock = 'chess';
  })();

  if(window.__QUORIDOR_TEST__){
    window.__quoridorEconomy = { economyTable, sha256Hex, checkSeal, signed, stableStringify, buyItem, canBuy, isAvailableNow, offerWindow,
      isUnlocked, grantUnlock, premiumActive, requestRewardedAd, doubleWinCoins, loadWallet, saveWallet, loadEnt,
      itemById, getWallet:()=> wallet, getEnt:()=> entitlements, setWallet:w=>{ wallet = w; }, hasWindow, welcomeClaimable };
    window.__quoridorMaze = { generateMaze, generateRandomWalls, tryPlaceEnvWall, MAZE_PATTERNS, MAZE_RULES, MAZE_DENSITIES, MAZE_TEMPLATES,
      mazeContext, mazeTable, mazePool, mazeEval, mazeJudge, userPatternFrom, seedToText, seedFromText, generateDailyLayout, hashStringToSeed, SEED_SPACE,
      getState:()=> state, bfsShortestPath, openOverlay, closeOverlay };
    window.__quoridorDaily = { utcDayKey, dayKeyDiff, dayKeyAdd, DAILY_ROTATION, dailyModeFor, dailyChallengeFor, dailyNumberOf, dailyStreakStatus, recordDailyResult,
      buildDailyShareText, shareDailyResult, initDailyChallenge, dailyStars, isDailyDone, renderDailyOverlay, renderDailyCalendar, onClockExpired, DAILY_SHIELD_MAX,
      getStats:()=> statsData, getState:()=> state, performMove, initGame, advanceTurn };
    window.__quoridorV4 = { initGame, getState:()=> state, botAct, performMove, commitWall, advanceTurn, render, computeValidMoves,
      WALLS_TABLE, wallsPerPlayer, legacyWallsPerPlayer, goalCells, isGoalCell, distanceToGoal, distanceToCenter, hasPath, playerHasPath,
      pieSwap, botMaybePie, updateDistChips, statsData:()=> statsData,
      setPrefs:(o)=>{ if('pie' in o) pieOn=!!o.pie; if('lottery' in o) lotteryOn=!!o.lottery; if('dist' in o) distHelpOn=!!o.dist; },
      wallet:()=> wallet, K:{ HINT_COST } };
    window.__quoridorParty = { initGame, getState:()=> state, botAct, botPartyPowers, performMove, commitWall, advanceTurn, render,
      partyUse, partyCanUse, partyCanTake, partySpawn, partyStunTarget, partyBreakChoice, partyNewRound, partyPickSpawnCell,
      serializeState, deserializeState, restoreState, undoLastAction, canUndo, grantExtraUndo, checkTurnCap, turnCapLimit,
      edgeKey, evaluateWallPlacement, evaluateWallForMode, wallReasonText, exportGameLog, seedGame, rng, mulberry32, botPlanMove,
      computeValidMoves, distanceToCenter, hasPath, PARTY_POWERS, PARTY_TYPES, EMOTE_ICON_IDS, RULESETS,
      K:{ PARTY_MAX_HELD, PARTY_TOKEN_TTL, PARTY_RESPAWN_MIN, PARTY_SPAWN_MAX_DIST, PARTY_WALL_BONUS_MAX, PARTY_SHIELD_ROUNDS, PARTY_STUN_IMMUNE_TURNS, PARTY_STUN_MAX_LEAD } };
  }
  modePicker.build();
  updateMenuVisibility();
  updateBadges();

  // ---------- Torneo de regresión (81) y pruebas del motor ----------
  // Juega IA contra IA sin dibujar, sin sonido y sin tocar estadísticas ni monedas. Uno de los dos empieza en cada
  // partida (se alterna) y la semilla de la IA es reproducible, así que un resultado raro se puede repetir.
  function aiPlayGame(diffs,size,seed,maxTurns){
    HEADLESS = true;
    try{
      const mid=(size-1)/2, W=wallsPerPlayer(size,2);
      initGame(2,size,{ ruleset:'classic', names:['A','B'], botSeed:seed, playerConfigs:[
        { isCPU:true, difficulty:diffs[0], r:0, c:mid, walls:W },
        { isCPU:true, difficulty:diffs[1], r:size-1, c:mid, walls:W } ] });
      let guard=0, worstMs=0;
      while(!state.winner && guard++<(maxTurns||500)){
        const t0=performance.now();
        botAct(state.currentPlayerIndex);
        worstMs = Math.max(worstMs, performance.now()-t0);
      }
      return { winner: state.winner ? state.winner.id : -1, moves: state.moveCount||0, worstMs };
    } finally { HEADLESS = false; }
  }
  function aiTournament(opts){
    opts = opts || {};
    const pairs = opts.pairs || [['expert','hard'],['hard','normal']];
    const sizes = opts.sizes || [7,9,11];
    const games = opts.games || 200;
    const seedBase = opts.seedBase || 1;
    const out = [];
    pairs.forEach(pair=> sizes.forEach(size=>{
      let wins=0, played=0, draws=0, worst=0, moves=0;
      for(let g=0; g<games; g++){
        const strongFirst = g%2===0;
        const res = aiPlayGame(strongFirst ? [pair[0],pair[1]] : [pair[1],pair[0]], size, seedBase*100003 + g*17 + size);
        if(res.winner<0){ draws++; continue; }
        played++; moves += res.moves; worst = Math.max(worst,res.worstMs);
        if(res.winner === (strongFirst?0:1)) wins++;
      }
      out.push({ strong:pair[0], weak:pair[1], size, games, wins, draws, rate: played ? wins/played : 0, avgMoves: played ? moves/played : 0, worstMs:worst });
    }));
    return out;
  }
  window.QuoridorAI = { _tune:(o)=>{ if(o.aw!=null) MM_AW=o.aw; if(o.mm!=null) MM_ON=o.mm; if(o.ww!=null) MM_WW=o.ww; if(o.walls!=null) MM_WALLS=o.walls; if(o.moves!=null) MM_MOVES=o.moves; if(o.total!=null) MM_TOTAL=o.total; if(o.rw!=null) MM_REPLY_WALLS=o.rw; }, playGame:aiPlayGame, tournament:aiTournament, makeRng,
    _engine:{ botAct, hasPath, bfsShortestPath, distanceToCenter, edgeKey, wallEdges, getState:()=>state, BFS_STATS, collectWallCandidates, minimaxDecision,
      evaluateWallForMode, commitWall, performMove, botPlanMove, setBotSeed, initGame, render, openSettings, updateAssistBtns, keyMomentText, adaptiveRandomness, updateAdaptiveAfterGame, getStats:()=>statsData, recordGameResult } };

  let tutorialSeen = false;
  try{ tutorialSeen = localStorage.getItem('quoridor_tutorial_seen')==='1'; }catch(e){}
  if(!tutorialSeen) openOverlay('tutorial');

})();
