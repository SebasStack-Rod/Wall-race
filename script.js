(function(){
  "use strict";

  const BOARD_PX = 630;
  const DIRS4 = [[-1,0],[1,0],[0,-1],[0,1]];
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
  const SHOP_TABS = [
    { id:'common', label:'Comunes' }, { id:'rare', label:'Raros' }, { id:'epic', label:'Épicos' }, { id:'frames', label:'Globos' },
  ];

  // ---------- modos de partida ----------
  // Rey de la colina: turnos SEGUIDOS dentro de la zona según la cantidad de jugadores (con más rivales
  // la zona se disputa más, así que alcanza con menos turnos) y empujones por jugador.
  const HILL_TARGET = { 2:4, 3:3, 4:3 };
  const HILL_TARGET_DEFAULT = 3;   // por si alguna vez se juega con otra cantidad de jugadores
  const HILL_PUSHES = 2;
  const HILL_MIN_ACCESSES = 2;      // la zona nunca puede quedar con menos accesos que estos
  const HILL_TARGET_TEXT = Object.keys(HILL_TARGET).map(n=> `${n} jugadores: ${HILL_TARGET[n]} turnos`).join(' · ');
  const RULESETS = {
    classic: { label:'Clásico', hint:'Las reglas de siempre: movete y bloqueá con paredes hasta llegar al centro.' },
    fog:     { label:'Niebla de guerra', hint:'Sólo ves las paredes cercanas a quien juega en ese turno. Las lejanas siguen bloqueando aunque no se vean.', forcePlayers:null },
    teams:   { label:'2v2 (equipos)', hint:'Se juega siempre con 4 en el mismo dispositivo. Equipo A: jugadores 1 y 3. Equipo B: jugadores 2 y 4. Gana el equipo del primero en llegar al centro.', forcePlayers:4, forceLocal:true },
    party:   { label:'Fiesta', hint:'De vez en cuando aparece un poder en el tablero: pared extra, turno extra o aturdir al rival mejor ubicado.' },
    maze:    { label:'Laberinto', hint:'El tablero arranca con paredes al azar ya colocadas (o con tu propio diseño del editor de niveles), garantizando que siempre haya camino.' },
    blitz:   { label:'Contrarreloj', hint:'Cada turno tiene 20 segundos. Si se acaba el tiempo, se juega un movimiento al azar y pasa el turno.' },
    mirror:  { label:'Espejo', hint:'Sólo para 2 jugadores. Cada pared que colocás aparece también reflejada en el punto opuesto del tablero.', forcePlayers:2 },
    hill:    { label:'Rey de la colina', hint:`No alcanza con pisar el centro: hay que terminar turnos SEGUIDOS dentro de la zona central (${HILL_TARGET_TEXT}). Si salís de la zona o te empujan, el conteo vuelve a 0. Cada jugador tiene ${HILL_PUSHES} empujones para sacar al rival, y no se puede cerrar la zona a menos de ${HILL_MIN_ACCESSES} accesos.` },
    hunter:  { label:'Cazador y fugitivo', hint:'El Jugador 1 es el fugitivo y gana si llega al centro. El resto son cazadores: no ganan llegando al centro, sólo bloqueando con paredes antes de que se acabe el límite de turnos.' },
  };
  const FOG_RADIUS = 2;
  const BLITZ_SECONDS = 20;
  const HUNTER_TURNS_PER_SIZE = 3; // límite de turnos totales = size * este valor
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
  const PARTY_TYPES = ['pared_extra','turno_extra','aturdido'];
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
  const winOverlay = document.getElementById('winOverlay');
  const winCard = document.getElementById('winCard');
  const winTitle = document.getElementById('winTitle');
  const playAgainBtn = document.getElementById('playAgainBtn');
  const changeConfigBtn = document.getElementById('changeConfigBtn');
  const moveModeBtn = document.getElementById('moveModeBtn');
  const wallModeBtn = document.getElementById('wallModeBtn');
  const hintLine = document.getElementById('hintLine');
  const repeatMapBtn = document.getElementById('repeatMapBtn');
  const winMapInfo = document.getElementById('winMapInfo');
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

  const rulesetSelect = document.getElementById('rulesetSelect');
  const rulesetHint = document.getElementById('rulesetHint');
  const turnTimerBadge = document.getElementById('turnTimerBadge');

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
  const moreOverlay = document.getElementById('moreOverlay');
  const moreLinkBtn = document.getElementById('moreLinkBtn');
  const closeMoreBtn = document.getElementById('closeMoreBtn');
  const shopOverlay = document.getElementById('shopOverlay');
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
  const vibrateToggle = document.getElementById('vibrateToggle');
  const showMovesToggle = document.getElementById('showMovesToggle');
  const glassToggle = document.getElementById('glassToggle');
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
  const overlayEls = { campaign:campaignOverlay, modes:modesOverlay, win:winOverlay, confirm:confirmOverlay, settings:settingsOverlay, tutorial:tutorialOverlay, stats:statsOverlay, skins:skinsOverlay, achievements:achievementsOverlay, daily:dailyOverlay, pause:pauseOverlay, more:moreOverlay, shop:shopOverlay, namePrompt:namePromptOverlay };

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
    const visited = new Set([startR+','+startC]);
    const queue = [[startR,startC,0]];
    while(queue.length){
      const [r,c,d] = queue.shift();
      for(const [dr,dc] of DIRS4){
        const nr=r+dr, nc=c+dc;
        if(nr<0||nc<0||nr>=size||nc>=size) continue;
        const key = nr+','+nc;
        if(visited.has(key)) continue;
        if(isBlocked(r,c,nr,nc,blockedSet)) continue;
        if(nr===targetR && nc===targetC) return d+1;
        visited.add(key);
        queue.push([nr,nc,d+1]);
      }
    }
    return Infinity;
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
  function wallsPerPlayer(size, playersCount){
    const total = Math.round(0.25*size*size);
    return Math.max(2, Math.floor(total/playersCount));
  }
  function hasPath(startR,startC,targetR,targetC,blockedSet,size){
    if(startR===targetR && startC===targetC) return true;
    const visited = new Set([startR+','+startC]);
    const queue = [[startR,startC]];
    while(queue.length){
      const [r,c] = queue.shift();
      for(const [dr,dc] of DIRS4){
        const nr=r+dr, nc=c+dc;
        if(nr<0||nc<0||nr>=size||nc>=size) continue;
        const key = nr+','+nc;
        if(visited.has(key)) continue;
        if(isBlocked(r,c,nr,nc,blockedSet)) continue;
        if(nr===targetR && nc===targetC) return true;
        visited.add(key);
        queue.push([nr,nc]);
      }
    }
    return false;
  }
  function distanceToCenter(r, c, blockedSet){
    if(r===state.center.r && c===state.center.c) return 0;
    const visited = new Set([r+','+c]);
    const queue = [[r,c,0]];
    while(queue.length){
      const [cr,cc,d] = queue.shift();
      for(const [dr,dc] of DIRS4){
        const nr=cr+dr, nc=cc+dc;
        if(nr<0||nc<0||nr>=state.size||nc>=state.size) continue;
        const key = nr+','+nc;
        if(visited.has(key)) continue;
        if(isBlocked(cr,cc,nr,nc,blockedSet)) continue;
        if(nr===state.center.r && nc===state.center.c) return d+1;
        visited.add(key);
        queue.push([nr,nc,d+1]);
      }
    }
    return Infinity;
  }

  // BFS multiobjetivo: pasos hasta la casilla más cercana de `targets` (por defecto, toda la zona de la colina).
  function distanceToHill(r,c,blockedSet,targets){
    const goals = new Set((targets || hillCells()).map(t=> t.r+','+t.c));
    if(goals.has(r+','+c)) return 0;
    const visited = new Set([r+','+c]);
    const queue = [[r,c,0]];
    for(let head=0; head<queue.length; head++){
      const [cr,cc,d] = queue[head];
      for(const [dr,dc] of DIRS4){
        const nr=cr+dr, nc=cc+dc;
        if(nr<0||nc<0||nr>=state.size||nc>=state.size) continue;
        const key = nr+','+nc;
        if(visited.has(key)) continue;
        if(isBlocked(cr,cc,nr,nc,blockedSet)) continue;
        if(goals.has(key)) return d+1;
        visited.add(key);
        queue.push([nr,nc,d+1]);
      }
    }
    return Infinity;
  }
  // Casillas de la zona que no ocupa ningún otro jugador (si están todas ocupadas, toda la zona).
  function hillFreeTargets(excludeIdx){
    const zone = hillCells();
    const free = zone.filter(cell=> !state.players.some((pl,i)=> i!==excludeIdx && pl.r===cell.r && pl.c===cell.c));
    return free.length ? free : zone;
  }

  function wallEdges(r,c,orientation){
    if(orientation==='h'){
      return [[r,c,r+1,c],[r,c+1,r+1,c+1]];
    }
    return [[r,c,r,c+1],[r+1,c,r+1,c+1]];
  }
  function canPlaceWallSlot(r,c,orientation){
    if(r<0||c<0||r>state.size-2||c>state.size-2) return false;
    if(state.occupied[r][c]) return false;
    if(orientation==='h'){
      if(c>0 && state.occupied[r][c-1]==='h') return false;
      if(c<state.size-2 && state.occupied[r][c+1]==='h') return false;
    } else {
      if(r>0 && state.occupied[r-1][c]==='v') return false;
      if(r<state.size-2 && state.occupied[r+1][c]==='v') return false;
    }
    return true;
  }
  function evaluateWallPlacement(r,c,orientation){
    if(!canPlaceWallSlot(r,c,orientation)) return { valid:false };
    const edges = wallEdges(r,c,orientation);
    const testSet = new Set(state.blockedEdges);
    for(const e of edges) testSet.add(edgeKey(e[0],e[1],e[2],e[3]));
    for(const p of state.players){
      if(!hasPath(p.r,p.c,state.objective.r,state.objective.c,testSet,state.size)) return { valid:false };
    }
    return { valid:true, edges };
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
    if(!canPlaceWallSlot(m.r,m.c,orientation)) return { valid:false };
    const mEdges = wallEdges(m.r,m.c,orientation);
    const testSet = new Set(state.blockedEdges);
    base.edges.forEach(e=> testSet.add(edgeKey(e[0],e[1],e[2],e[3])));
    mEdges.forEach(e=> testSet.add(edgeKey(e[0],e[1],e[2],e[3])));
    for(const p of state.players){
      if(!hasPath(p.r,p.c,state.objective.r,state.objective.c,testSet,state.size)) return { valid:false };
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
    if(state.ruleset==='hill') return updateHillProgress(p);
    if(state.ruleset==='hunter'){
      return p.id===0 && p.r===state.objective.r && p.c===state.objective.c;
    }
    return p.r===state.objective.r && p.c===state.objective.c;
  }
  function checkHunterTimeout(){
    if(!state || state.ruleset!=='hunter' || state.winner) return;
    if((state.moveCount||0) >= state.hunterTurnLimit){
      finishGame(state.players[1], 'huntersWin');
    }
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
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function newMazeSeed(){ return Math.floor(Math.random()*SEED_SPACE); }
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
      const occupantIdx = state.players.findIndex((pl,i)=> i!==playerIndex && pl.r===nr && pl.c===nc);
      if(occupantIdx===-1){
        moves.push({ r:nr, c:nc });
        continue;
      }
      const jr=nr+dr, jc=nc+dc;
      // Rey de la colina: empujar al rival adyacente. La jugada apunta a la casilla del rival
      // (donde va a quedar el atacante) y `push` es la casilla a la que se desliza el rival.
      // Se ofrece sólo si quedan empujones y no se lo acaba de empujar en el turno anterior.
      if(state.ruleset==='hill' && (p.pushesLeft||0)>0 && !(state.lastPush && state.lastPush[playerIndex]===occupantIdx)){
        const behindFree = jr>=0 && jc>=0 && jr<state.size && jc<state.size &&
          !isBlocked(nr,nc,jr,jc,state.blockedEdges) &&
          !state.players.some(pl=> pl.r===jr && pl.c===jc);
        if(behindFree) moves.push({ r:nr, c:nc, push:{ r:jr, c:jc } });
      }
      const straightOk = jr>=0 && jc>=0 && jr<state.size && jc<state.size &&
        !isBlocked(nr,nc,jr,jc,state.blockedEdges) &&
        !state.players.some((pl,i)=> i!==playerIndex && pl.r===jr && pl.c===jc);
      if(straightOk){
        moves.push({ r:jr, c:jc });
      } else {
        const perp = dr!==0 ? [[0,-1],[0,1]] : [[-1,0],[1,0]];
        for(const [pdr,pdc] of perp){
          const sr=nr+pdr, sc=nc+pdc;
          if(sr<0||sc<0||sr>=state.size||sc>=state.size) continue;
          if(isBlocked(nr,nc,sr,sc,state.blockedEdges)) continue;
          if(state.players.some((pl,i)=> i!==playerIndex && pl.r===sr && pl.c===sc)) continue;
          moves.push({ r:sr, c:sc });
        }
      }
    }
    return moves;
  }

  function advanceTurn(){
    const n = state.players.length;
    let next = state.currentPlayerIndex;
    for(let i=0;i<n;i++){
      next = (next+1) % n;
      const cand = state.players[next];
      if(cand.stunned){ cand.stunned = false; continue; }
      if(n>1 && cand.wallsLeft<=0 && computeValidMoves(next).length===0) continue;
      break;
    }
    state.currentPlayerIndex = next;
    state.validMoves = computeValidMoves(next);
    const cpNext = state.players[next];
    mode = (!state.validMoves.length && cpNext.wallsLeft>0 && !cpNext.isCPU) ? 'wall' : 'move';
  }

  // ---------- overlays genéricos ----------
  function openOverlay(name){
    const el = overlayEls[name];
    if(!el) return;
    hideEmoteBar();
    el.classList.remove('hidden');
    overlayStack.push(name);
    if(!gameScreen.classList.contains('hidden')){ invalidateBotTimer(); clearTurnTimer(); }
  }
  function closeOverlay(name){
    const el = overlayEls[name];
    if(!el) return;
    el.classList.add('hidden');
    overlayStack = overlayStack.filter(n=> n!==name);
    if(name==='tutorial'){
      try{ localStorage.setItem('quoridor_tutorial_seen','1'); }catch(e){}
    }
    if(overlayStack.length===0 && !gameScreen.classList.contains('hidden') && state && !state.winner){
      scheduleBotTurnIfNeeded();
      startTurnTimer(true);
      updateHunterBadge();
    }
  }
  function closeTopOverlay(){
    if(!overlayStack.length) return false;
    closeOverlay(overlayStack[overlayStack.length-1]);
    return true;
  }

  // ---------- confirmación reutilizable (reinicio/salir/borrar stats) ----------
  function showConfirm(message, onConfirm){
    confirmMessage.textContent = message;
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
  function unlockAudio(){
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
  function playMoveSound(){ playSfx('tap', ()=> playTone(440, 0.09, 'sine', 0.14)); }
  function playWallSound(){ playSfx('wall', ()=> playTone(170, 0.15, 'square', 0.15)); }
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
      modesPlayed:{ fog:0, teams:0, party:0, maze:0, blitz:0, mirror:0, hill:0, hunter:0 },
      modeWins:{ fog:0, teams:0, party:0, maze:0, blitz:0, mirror:0, hill:0, hunter:0 },
      sizeWins:{5:0,7:0,9:0,11:0},
      noWallWins:0, allWallsUsedWins:0,
      fastestWinMoves:null, longestGameMoves:0, totalWallsPlaced:0,
      daily:{ lastDate:null, streak:0, bestStreak:0, completedCount:0, bestMoves:{} },
      customLevelsPlayed:0, skinsCustomized:false, partyStuns:0,
      achievementsUnlocked:[],
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
        base.customLevelsPlayed = parsed.customLevelsPlayed || 0;
        base.skinsCustomized = !!parsed.skinsCustomized;
        base.partyStuns = parsed.partyStuns || 0;
        base.achievementsUnlocked = Array.isArray(parsed.achievementsUnlocked) ? parsed.achievementsUnlocked : [];
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
    saveStats();
    return checkAchievements(opts);
  }
  function recordModePlayed(ruleset){
    if(!ruleset || ruleset==='classic') return;
    statsData.modesPlayed[ruleset] = (statsData.modesPlayed[ruleset]||0) + 1;
    saveStats();
  }
  function recordDailyResult(movesUsed, par){
    const today = todayKey();
    const d = statsData.daily;
    const isFirstToday = d.lastDate !== today;
    if(isFirstToday){
      const yesterday = todayKey(-1);
      d.streak = (d.lastDate === yesterday) ? d.streak + 1 : 1;
      d.bestStreak = Math.max(d.bestStreak, d.streak);
      d.completedCount += 1;
      d.lastDate = today;
    }
    if(d.bestMoves[today]==null || movesUsed < d.bestMoves[today]) d.bestMoves[today] = movesUsed;
    saveStats();
    const fresh = checkAchievements({ toast:false });
    return { firstToday:isFirstToday, streak:d.streak, fresh };
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
  const WALLET_VERSION = 1;
  function defaultWallet(){
    return {
      v: WALLET_VERSION, coins: 0,
      owned: { e_faceHappy:1, e_laugh:1, fr_f1:1 },
      equipped: { emotes:['faceHappy','laugh',null,null], frame:'f1' },
      claimed: {}, earned: { date:null, games:0 }, dailyPaid: null, shopSeen: 0,
    };
  }
  function loadWallet(){
    const w = defaultWallet();
    try{
      const raw = JSON.parse(localStorage.getItem(WALLET_KEY) || 'null');
      if(raw && typeof raw==='object'){
        if(typeof raw.coins==='number' && raw.coins>0) w.coins = Math.floor(raw.coins);
        if(raw.owned && typeof raw.owned==='object') Object.assign(w.owned, raw.owned);
        if(raw.equipped){
          if(Array.isArray(raw.equipped.emotes)) w.equipped.emotes = [0,1,2,3].map(i=> raw.equipped.emotes[i] || null);
          if(typeof raw.equipped.frame==='string' && FRAME_IDS.indexOf(raw.equipped.frame)!==-1) w.equipped.frame = raw.equipped.frame;
        }
        if(raw.claimed && typeof raw.claimed==='object') w.claimed = raw.claimed;
        if(raw.earned && typeof raw.earned==='object') w.earned = Object.assign(w.earned, raw.earned);
        w.dailyPaid = raw.dailyPaid || null;
        w.shopSeen = raw.shopSeen || 0;
      }
    }catch(e){}
    // solo pueden estar equipados emotes y globos que sean tuyos
    w.equipped.emotes = w.equipped.emotes.map(id=> (id && w.owned['e_'+id]) ? id : null);
    if(!w.owned['fr_'+w.equipped.frame]) w.equipped.frame = 'f1';
    return w;
  }
  let wallet = loadWallet();
  function saveWallet(){ try{ localStorage.setItem(WALLET_KEY, JSON.stringify(wallet)); }catch(e){} }
  function itemById(id){ return SHOP_ITEMS.find(it=> it.id===id) || null; }
  function ownsItem(it){ return !!wallet.owned[it.id]; }
  function isEquipped(it){
    if(it.type==='emote') return wallet.equipped.emotes.indexOf(it.icon)!==-1;
    return wallet.equipped.frame===it.frame;
  }
  function earnedToday(){ return wallet.earned && wallet.earned.date===todayKey() ? (wallet.earned.games||0) : 0; }

  // toasts (logros, monedas): una sola cola
  let toastQueue = [];
  let toastShowing = false;
  function showToast(html){
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
    if(!amount) return;
    wallet.coins = Math.max(0, wallet.coins + amount);
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
  function affordableItems(){ return SHOP_ITEMS.filter(it=> !ownsItem(it) && it.price<=wallet.coins).length; }
  function setBadge(el, n){
    el.textContent = n > 9 ? '9+' : String(n);
    el.classList.toggle('hidden', !(n>0));
  }
  function updateBadges(){
    setBadge(trophyBadge, pendingClaims());
    setBadge(shopBadge, wallet.coins > wallet.shopSeen ? affordableItems() : 0);
    dailyReadyChip.classList.toggle('hidden', statsData.daily.lastDate === todayKey());
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
    statsBody.innerHTML = `
      <div class="stats-row"><span>Partidas jugadas</span><span>${statsData.totalGames}</span></div>
      ${rows}
      ${cpuRow}
      <p class="streak-line">${streakText}</p>
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

  // ---------- tienda: emotes + globos, con vista previa y espacios para equipar ----------
  let shopTab = 'common';
  let shopSelected = null;
  let shopSlot = 0;
  function shopVisual(it, w){
    return it.type==='emote' ? emoteHTML(it.icon, currentFrame(), w) : emoteHTML('faceHappy', it.frame, w);
  }
  function renderShop(){
    shopCoinsEl.textContent = wallet.coins;
    shopSlotsEl.innerHTML = wallet.equipped.emotes.map((id,i)=>
      `<button type="button" class="shop-slot ${i===shopSlot?'active':''}" data-slot="${i}" aria-label="Espacio ${i+1}">${id ? emoteHTML(id, currentFrame(), 43) : '+'}</button>`).join('');
    shopTabsEl.innerHTML = SHOP_TABS.map(t=> `<button type="button" class="shop-tab ${t.id===shopTab?'active':''}" data-tab="${t.id}">${t.label}</button>`).join('');
    const items = SHOP_ITEMS.filter(it=> shopTab==='frames' ? it.type==='frame' : (it.type==='emote' && it.rarity===shopTab));
    shopGridEl.innerHTML = items.map(it=>{
      const owned = ownsItem(it);
      const tag = isEquipped(it) ? '<span class="tag">En uso</span>' : (owned ? '<span class="tag" style="background:#3a6ea5">Tuyo</span>' : '');
      const price = owned ? '' : `<span class="pr"><img src="${emoteIconSrc('cash')}" alt="">${it.price}</span>`;
      return `<button type="button" class="shop-item ${it.id===shopSelected?'selected':''}" data-id="${it.id}">${tag}${shopVisual(it,38)}<span class="nm">${escapeHtml(it.name)}</span>${price}</button>`;
    }).join('');
    renderShopDetail();
  }
  function shopPreviewSvg(it){
    const skin = pieceSkins[0];
    const frame = it.type==='frame' ? it.frame : currentFrame();
    const icon = it.type==='emote' ? it.icon : 'faceHappy';
    const pawn = pieceMarkup(skin.shape, 100, 106, 40, skin.color, '').replace(' filter="url(#pieceShadow)"', '');
    const k = 1.4;
    return `<svg viewBox="0 0 200 130" aria-hidden="true">${pawn}<g transform="translate(${100-20*k} ${82-42*k}) scale(${k})"><g class="emo-pop loop" style="--dir:1">${emoteSvgInner(icon, frame, false)}</g></g></svg>`;
  }
  function renderShopDetail(){
    const it = shopSelected ? itemById(shopSelected) : null;
    if(!it){
      shopDetailEl.innerHTML = '<p class="field-hint" style="margin:0; width:100%; text-align:center;">Tocá un ítem para verlo en acción antes de comprarlo.</p>';
      return;
    }
    const owned = ownsItem(it);
    let sub, btn;
    if(!owned){
      const missing = it.price - wallet.coins;
      sub = it.type==='emote' ? RARITY_LABEL[it.rarity] : 'Globo de emotes';
      btn = missing>0
        ? `<button type="button" class="kbtn grey small" data-act="buy" disabled>Te faltan ${missing}</button>`
        : `<button type="button" class="kbtn green small" data-act="buy">Comprar · ${it.price}</button>`;
    } else if(isEquipped(it)){
      sub = it.type==='emote' ? 'Ya está en tus espacios' : 'Es el globo que estás usando';
      btn = `<button type="button" class="kbtn grey small" disabled>En uso</button>`;
    } else {
      sub = 'Tuyo';
      btn = it.type==='emote'
        ? `<button type="button" class="kbtn yellow small" data-act="equip">Poner en espacio ${shopSlot+1}</button>`
        : `<button type="button" class="kbtn yellow small" data-act="equip">Usar este globo</button>`;
    }
    shopDetailEl.innerHTML = `${shopPreviewSvg(it)}<div class="det-info"><div class="det-name">${escapeHtml(it.name)}</div><div class="det-sub">${sub}</div>${btn}</div>`;
  }
  const RARITY_LABEL = { common:'Emote común', rare:'Emote raro', epic:'Emote épico' };
  function equipItem(it){
    if(it.type==='frame'){ wallet.equipped.frame = it.frame; }
    else {
      const arr = wallet.equipped.emotes;
      const idx = arr.indexOf(it.icon);
      const prev = arr[shopSlot];
      if(idx!==-1) arr[idx] = prev || null;       // si ya estaba en otro espacio, se intercambian
      arr[shopSlot] = it.icon;
    }
    saveWallet();
  }
  function buyItem(it){
    if(ownsItem(it) || wallet.coins < it.price) return;
    wallet.coins -= it.price;
    wallet.owned[it.id] = 1;
    if(it.type==='emote'){
      const empty = wallet.equipped.emotes.indexOf(null);
      if(empty!==-1) wallet.equipped.emotes[empty] = it.icon;     // si hay un espacio libre, queda puesto
    }
    wallet.shopSeen = wallet.coins;
    saveWallet();
    playCoinSound();
    vibrate(20);
    updateCoinUI(true);
    updateBadges();
  }
  function openShop(){
    wallet.shopSeen = wallet.coins;
    saveWallet();
    renderShop();
    openOverlay('shop');
    updateBadges();
  }
  shopOverlay.addEventListener('click', e=>{
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
      if(act.dataset.act==='buy') buyItem(it);
      else if(act.dataset.act==='equip') equipItem(it);
      renderShop();
    }
  });
  shopLinkBtn.addEventListener('click', openShop);
  coinChip.addEventListener('click', openShop);
  closeShopBtn.addEventListener('click', ()=>{ closeOverlay('shop'); updateBadges(); });

  // ---------- recompensas de partida / desafío diario ----------
  function dailyStars(moves, par){ return moves<=par ? 3 : (moves<=par+3 ? 2 : 1); }
  function dailyBaseCoins(streak){ return 20 + 5*(Math.min(Math.max(streak,1),7)-1); }
  function starsHTML(n, total, px){
    let h = '';
    for(let i=0;i<total;i++) h += `<img src="${ASSET}ui/${i<n?'star':'star-off'}.png" alt="" style="width:${px}px;height:auto">`;
    return h;
  }
  function gameReward(p){
    const r = { coins:0, note:'', stars:0, chest:null };
    if(!state.isCpuGame){ r.note = 'Las partidas entre personas no dan monedas. Ganale a la IA o resolvé el desafío diario para juntar.'; return r; }
    if(p.isCPU) return r;
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
  function dailyReward(res, moves, par){
    const stars = dailyStars(moves, par);
    const r = { coins:0, note:'', stars, chest:null };
    const today = todayKey();
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
    const unowned = SHOP_ITEMS.filter(it=> !ownsItem(it)).sort((a,b)=> a.price-b.price);
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
      const sel = sh===current.shape ? 'selected' : ''; const locked=!campaignShapeUnlocked(sh);
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
    if(shapeBtn){ if(!campaignShapeUnlocked(shapeBtn.dataset.shape)){ showToast('🔒 Forma bloqueada: avanzá en la campaña para desbloquearla.'); return; } pieceSkins[activeSkinSlot].shape = shapeBtn.dataset.shape; saveSkins(); recordSkinCustomized(); renderSkinsOverlay(); return; }
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
    if(state && state.winner){ hintLine.textContent=''; return; }
    const canPush = !!state && state.ruleset==='hill' && state.validMoves.some(m=> m.push);
    const mapTag = (state && state.mazeInfo && (state.moveCount||0) < state.players.length*2) ? 'Mapa: '+state.mazeInfo.name+'. ' : '';
    hintLine.textContent = mapTag + (mode==='wall'
      ? 'Arrastrá sobre el tablero para ubicar la pared y soltá para confirmarla.'
      : 'Tocá una casilla resaltada para moverte.' + (canPush ? ' La flecha empuja al rival.' : ''));
  }
  moveModeBtn.addEventListener('click', ()=> setMode('move'));
  wallModeBtn.addEventListener('click', ()=> setMode('wall'));

  // ---------- IA (bot) ----------
  function invalidateBotTimer(){
    stopThinking();
    botToken++;
    if(botTimer){ clearTimeout(botTimer); botTimer=null; }
  }
  function otherPlayerClosestToCenter(excludeIdx){
    let best=null, bestDist=Infinity;
    state.players.forEach((p,i)=>{
      if(i===excludeIdx) return;
      const d = distanceToCenter(p.r,p.c,state.blockedEdges);
      if(d<bestDist){ bestDist=d; best=i; }
    });
    return best;
  }
  function findBestBlockingWall(opponentIdx,currentOppDist,distFn){
    const distOf = distFn || distanceToCenter;
    const opp=state.players[opponentIdx], radius=3, maxSlot=state.size-2, candidates=[];
    for(let r=Math.max(0,opp.r-radius);r<=Math.min(maxSlot,opp.r+radius);r++) for(let c=Math.max(0,opp.c-radius);c<=Math.min(maxSlot,opp.c+radius);c++) for(const orientation of ['h','v']){
      const ev=evaluateWallForMode(r,c,orientation); if(!ev.valid) continue;
      const test=new Set(state.blockedEdges); ev.edges.forEach(e=>test.add(edgeKey(e[0],e[1],e[2],e[3])));
      if(ev.mirrorEdges) ev.mirrorEdges.forEach(e=>test.add(edgeKey(e[0],e[1],e[2],e[3])));
      const d=distOf(opp.r,opp.c,test); if(d>currentOppDist) candidates.push({r,c,orientation,gain:d-currentOppDist,newOppDist:d});
    }
    if(!candidates.length)return null;
    candidates.sort((a,b)=>b.gain-a.gain||a.newOppDist-b.newOppDist);
    const gain=candidates[0].gain, top=candidates.filter(x=>x.gain===gain);
    return top[Math.floor(Math.random()*top.length)];
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
      if(bot.wallsLeft>0 && (hold.length===0 || Math.random() < Math.min(1, (profile.wallChance||0)+0.4))){
        const w = findHillBlockingWall(idx) || (hold.length===0 ? findAnyLegalWall() : null);
        if(w) return w;
      }
      // 3) si no, moverse a otra casilla de la zona para no perder el conteo
      if(hold.length){ const best = rank(hold)[0].m; return { type:'move', r:best.r, c:best.c }; }
    }
    if(!moves.length) return { type:'move', r:bot.r, c:bot.c };
    // fuera de la zona (o sin forma de quedarse): el movimiento que mejor puntúa, con el ruido propio de cada dificultad
    const scored = rank(moves);
    const choice = Math.random()<profile.randomness ? scored[Math.floor(Math.random()*Math.min(3,scored.length))] : scored[0];
    return { type:'move', r:choice.m.r, c:choice.m.c };
  }
  function botPlanMove(idx){
    const bot=state.players[idx], difficulty=bot.difficulty||'easy';
    const profiles={easy:{wallChance:.12,randomness:.55,personality:'speed'},normal:{wallChance:.32,randomness:.28,personality:'speed'},hard:{wallChance:.58,randomness:.12,personality:'aggressive'},expert:{wallChance:.82,randomness:.04,personality:'strategist'}};
    const profile=Object.assign({}, profiles[difficulty]||profiles.easy);
    if(state.campaign && state.campaignPersonality){
      profile.personality=state.campaignPersonality;
      if(profile.personality==='defensive') profile.wallChance=Math.min(.9,profile.wallChance+.2);
      else if(profile.personality==='aggressive') profile.wallChance=Math.min(.9,profile.wallChance+.1);
      else if(profile.personality==='speed') profile.wallChance=Math.max(.05,profile.wallChance-.1);
    }
    if(state.ruleset==='hill') return botPlanHill(idx, profile);
    const isHunterBot = state.ruleset==='hunter' && bot.id!==0;
    if(isHunterBot) profile.wallChance=Math.max(profile.wallChance,.85);
    const oppIdx = isHunterBot ? 0 : otherPlayerClosestToCenter(idx);
    if(bot.wallsLeft>0&&oppIdx!=null){
      const myDist=distanceToCenter(bot.r,bot.c,state.blockedEdges),oppDist=distanceToCenter(state.players[oppIdx].r,state.players[oppIdx].c,state.blockedEdges);
      if((isHunterBot||oppDist<=myDist+1)&&Math.random()<profile.wallChance){ const w=findBestBlockingWall(oppIdx,oppDist); if(w)return {type:'wall',r:w.r,c:w.c,orientation:w.orientation}; }
    }
    const moves=state.validMoves; if(!moves.length)return {type:'move',r:bot.r,c:bot.c};
    const scored=moves.map(m=>({m,score:scoreBotMove(idx,m,profile.personality)})).sort((a,b)=>b.score-a.score);
    const choice=Math.random()<profile.randomness?scored[Math.floor(Math.random()*Math.min(3,scored.length))]:scored[0];
    return {type:'move',r:choice.m.r,c:choice.m.c};
  }
  function scheduleBotTurnIfNeeded(){
    if(!state || state.winner) return;
    const cp = state.players[state.currentPlayerIndex];
    if(!cp || !cp.isCPU) return;
    const myToken = ++botToken;
    hintLine.textContent = 'La IA está pensando…';
    hintLine.classList.add('thinking');
    startThinking(state.currentPlayerIndex);
    botTimer = setTimeout(()=>{
      if(myToken!==botToken) return;
      stopThinking();
      if(!state || state.winner) return;
      const cpNow = state.players[state.currentPlayerIndex];
      if(!cpNow || !cpNow.isCPU) return;
      const decision = botPlanMove(state.currentPlayerIndex);
      if(decision.type==='move') performMove(decision.r, decision.c);
      else commitWall(decision.r, decision.c, decision.orientation);
    }, 550 + Math.random()*450);
  }

  function teamOf(playerId){
    if(state.ruleset!=='teams') return null;
    return (playerId===0 || playerId===2) ? 'A' : 'B';
  }
  function finishGame(p, resultTag){
    state.winner = p;
    state.resultTag = resultTag || null;
    const winnerTeam = teamOf(p.id);
    const wallsStart = p.wallsStart;
    const wallsUsedByWinner = Math.max(0, wallsStart - p.wallsLeft);
    if(state.campaign){ state.campaignXPReward = awardCampaignXP(state.campaignLevel, p.id===0); }
    stopThinking();
    hideEmoteBar();
    let fresh = [];
    let reward;
    if(state.isDaily){
      const res = recordDailyResult(state.moveCount, state.dailyPar);
      fresh = res.fresh;
      reward = dailyReward(res, state.moveCount, state.dailyPar);
    } else {
      fresh = recordGameResult({
        winnerSlot: p.id,
        isCpuGame: !!state.isCpuGame,
        cpuDifficulty: (state.isCpuGame && state.players[1]) ? state.players[1].difficulty : null,
        ruleset: state.ruleset,
        size: state.size,
        playersCount: state.players.length,
        wallsUsedByWinner, wallsStart,
        movesUsed: state.moveCount,
        totalMovesThisGame: state.moveCount,
        wallsPlacedThisGame: state.walls.filter(w=>!w.env).length,
      }, { toast:false });
      reward = gameReward(p);
    }
    reward.fresh = fresh;
    state.lastReward = reward;
    if(state.isCpuGame && !state.isDaily) cpuReact(p.isCPU ? 'laugh' : 'faceSad', true);
    clearTurnTimer();
    playWinSound();
    vibrate([0,40,60,40,140]);
    showWinOverlay(p, winnerTeam);
  }
  function maybePickUpPower(p){
    if(state.ruleset!=='party' || !state.powerUp) return false;
    if(p.r!==state.powerUp.r || p.c!==state.powerUp.c) return false;
    const type = state.powerUp.type;
    state.powerUp = null;
    if(type==='pared_extra'){
      p.wallsLeft += 1;
    } else if(type==='turno_extra'){
      state.skipAdvance = true;
    } else if(type==='aturdido'){
      const targetIdx = otherPlayerClosestToCenter(state.currentPlayerIndex);
      if(targetIdx!=null){ state.players[targetIdx].stunned = true; recordPartyStun(); }
    }
    return true;
  }
  function maybeSpawnPower(){
    if(state.ruleset!=='party') return;
    if(state.powerUp) return;
    if(state.currentPlayerIndex!==0) return;
    if(Math.random()>0.45) return;
    const occupiedCells = new Set(state.players.map(p=> p.r+','+p.c));
    occupiedCells.add(state.center.r+','+state.center.c);
    let tries=0;
    while(tries<40){
      tries++;
      const r = Math.floor(Math.random()*state.size);
      const c = Math.floor(Math.random()*state.size);
      if(occupiedCells.has(r+','+c)) continue;
      state.powerUp = { r, c, type: PARTY_TYPES[Math.floor(Math.random()*PARTY_TYPES.length)] };
      return;
    }
  }

  function performMove(r,c){
    if(state.winner) return;
    const idx = state.currentPlayerIndex;
    const p = state.players[idx];
    // ¿la casilla elegida es un empujón? (la jugada guarda a dónde se desliza el rival)
    const chosen = state.validMoves.find(m=> m.r===r && m.c===c);
    const pushTo = (state.ruleset==='hill' && chosen && chosen.push) ? chosen.push : null;
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
    p.r = r; p.c = c;
    state.moveCount = (state.moveCount||0) + 1;
    maybePickUpPower(p);
    if(checkWinAfterMove(p)){
      state.winner = p;
      render(idx);
      finishGame(p);
      return;
    }
    if(pushTo){ playWallSound(); vibrate(25); }   // el empujón suena como una pared, con un golpe más largo
    else { playMoveSound(); vibrate(12); }
    if(state.skipAdvance){
      state.skipAdvance = false;
      state.validMoves = computeValidMoves(idx);
      render(idx);
      return;
    }
    advanceTurn();
    maybeSpawnPower();
    checkHunterTimeout();
    render(idx);
  }

  function commitWall(r,c,orientation){
    if(state.winner) return;
    const evalRes = evaluateWallForMode(r,c,orientation);
    if(!evalRes.valid) return;
    const cp = state.players[state.currentPlayerIndex];
    const cpuOpp = (state.isCpuGame && !cp.isCPU && state.players[1]) ? state.players[1] : null;
    const gapBefore = cpuOpp ? distanceToCenter(cpuOpp.r, cpuOpp.c, state.blockedEdges) - distanceToCenter(cp.r, cp.c, state.blockedEdges) : 0;
    state.occupied[r][c] = orientation;
    evalRes.edges.forEach(e=> state.blockedEdges.add(edgeKey(e[0],e[1],e[2],e[3])));
    state.walls.push({ r, c, orientation, color: cp.color });
    if(evalRes.mirrorEdges){
      const m = mirrorSlot(r,c);
      state.occupied[m.r][m.c] = orientation;
      evalRes.mirrorEdges.forEach(e=> state.blockedEdges.add(edgeKey(e[0],e[1],e[2],e[3])));
      state.walls.push({ r:m.r, c:m.c, orientation, color: cp.color });
    }
    if(cpuOpp){
      // si la pared del humano le sacó 3 o más de ventaja a la IA, la IA se enoja (con enfriamiento largo)
      const gapAfter = distanceToCenter(cpuOpp.r, cpuOpp.c, state.blockedEdges) - distanceToCenter(cp.r, cp.c, state.blockedEdges);
      if(gapAfter - gapBefore >= 3) cpuReact('anger');
    }
    cp.wallsLeft -= 1;
    if(state.lastPush) state.lastPush[state.currentPlayerIndex] = null;
    state.moveCount = (state.moveCount||0) + 1;
    playWallSound();
    vibrate(18);
    if(state.ruleset==='hill' && updateHillProgress(cp)){
      state.winner = cp;
      render();
      finishGame(cp);
      return;
    }
    advanceTurn();
    maybeSpawnPower();
    checkHunterTimeout();
    render();
  }

  // ---------- Contrarreloj: temporizador por turno ----------
  let turnTimerInterval = null;
  function clearTurnTimer(){
    if(turnTimerInterval){ clearInterval(turnTimerInterval); turnTimerInterval = null; }
    turnTimerBadge.classList.add('hidden');
  }
  function startTurnTimer(keep){
    clearTurnTimer();
    if(!state || state.winner) return;
    const seconds = state.turnTimeSeconds>0 ? state.turnTimeSeconds : (state.isCustomLevel ? 0 : (state.ruleset==='blitz' ? BLITZ_SECONDS : 0));
    if(seconds<=0) return;
    const cp = state.players[state.currentPlayerIndex];
    if(cp && cp.isCPU) return;
    if(!(keep && state.turnTimeLeft>0)) state.turnTimeLeft = seconds;
    turnTimerBadge.classList.remove('hidden');
    turnTimerBadge.classList.toggle('low', state.turnTimeLeft<=5);
    turnTimerBadge.textContent = `⏱️ ${state.turnTimeLeft}s`;
    turnTimerInterval = setInterval(()=>{
      state.turnTimeLeft -= 1;
      if(state.turnTimeLeft<=5) turnTimerBadge.classList.add('low');
      turnTimerBadge.textContent = `⏱️ ${Math.max(0,state.turnTimeLeft)}s`;
      if(state.turnTimeLeft<=0){
        clearTurnTimer();
        autoPlayRandomMove();
      }
    }, 1000);
  }
  function autoPlayRandomMove(){
    if(!state || state.winner) return;
    const idx = state.currentPlayerIndex;
    const moves = state.validMoves;
    if(!moves.length){ advanceTurn(); render(); return; }
    const plain = moves.filter(m=> !m.push);           // el reloj no gasta empujones por el jugador
    const scored = (plain.length ? plain : moves).map(m=> ({ m, d: distanceToCenter(m.r, m.c, state.blockedEdges) }));
    scored.sort((a,b)=> a.d-b.d);
    performMove(scored[0].m.r, scored[0].m.c);
  }

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

  // ---------- render ----------
  function render(justMovedIndex){
    const cs = cellSize();

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
    const ccx=(state.center.c+0.5)*cs, ccy=(state.center.r+0.5)*cs;
    gridHTML += `<circle cx="${ccx}" cy="${ccy}" r="15" fill="none" stroke="var(--accent)" stroke-width="3" class="center-glow"/>`;
    gridEl.innerHTML = gridHTML;

    let movesHTML = '';
    let pushArrowsHTML = '';   // se dibujan sobre las fichas: la casilla de un empujón está ocupada por el rival
    const activePlayer = state.players[state.currentPlayerIndex];
    if(!state.winner && activePlayer && !activePlayer.isCPU){
      for(const m of state.validMoves){
        const cx=(m.c+0.5)*cs, cy=(m.r+0.5)*cs;
        if(m.push){
          // flecha en la dirección en que sale despedido el rival (no es un paso: no lleva el punto normal)
          const ang = Math.atan2(m.push.r-m.r, m.push.c-m.c) * 180 / Math.PI;
          const u = cs*0.2;
          const pts = [[-1.3,-.36],[.2,-.36],[.2,-.95],[1.5,0],[.2,.95],[.2,.36],[-1.3,.36]].map(([x,y])=> `${(x*u).toFixed(1)},${(y*u).toFixed(1)}`).join(' ');
          pushArrowsHTML += `<g transform="translate(${cx} ${cy}) rotate(${ang.toFixed(1)})" class="move-dot push-arrow"><polygon points="${pts}" fill="${activePlayer.color}" stroke="rgba(255,255,255,.92)" stroke-width="2" stroke-linejoin="round"/></g>`;
        } else {
          movesHTML += `<circle cx="${cx}" cy="${cy}" r="${cs*0.16}" fill="${activePlayer.color}" class="move-dot" opacity="0.8"/>`;
        }
        movesHTML += `<rect data-r="${m.r}" data-c="${m.c}" x="${m.c*cs}" y="${m.r*cs}" width="${cs}" height="${cs}" fill="transparent" pointer-events="all" style="--tint:${activePlayer.color}" class="valid-move-hit"/>`;
      }
    }
    movesEl.innerHTML = movesHTML;

    let wallsHTML = '';
    const fogCenter = (state.ruleset==='fog' && activePlayer) ? (activePlayer.isCPU ? (state.players.find(pl=> !pl.isCPU) || activePlayer) : activePlayer) : null;
    for(const w of state.walls){
      if(fogCenter){
        const dist = Math.max(Math.abs(w.r-fogCenter.r), Math.abs(w.c-fogCenter.c));
        if(dist > FOG_RADIUS) continue;
      }
      const rect = wallRect(w.r,w.c,w.orientation,cs);
      const rx = rect.h>rect.w ? rect.w*0.4 : rect.h*0.4;
      const look = w.env ? 'fill="url(#stoneTex)" stroke="#2b2620" stroke-width="1.6"' : `fill="${w.color}" stroke="rgba(0,0,0,0.3)" stroke-width="1"`;
      wallsHTML += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="${rx}" ${look}${w.env ? ' class="map-wall"' : ''}/>`;
    }
    if(state.ruleset==='party' && state.powerUp){
      const pc=(state.powerUp.c+0.5)*cs, pr=(state.powerUp.r+0.5)*cs;
      const icon = state.powerUp.type==='pared_extra' ? 'bars' : (state.powerUp.type==='turno_extra' ? 'star' : 'alert');
      const isz = cs*0.5;
      wallsHTML += `<g class="power-token"><circle cx="${pc}" cy="${pr}" r="${cs*0.32}" fill="var(--accent)" opacity="0.25" class="spin"/><image href="${emoteIconSrc(icon)}" x="${pc-isz/2}" y="${pr-isz/2}" width="${isz}" height="${isz}"/></g>`;
    }
    wallsEl.innerHTML = wallsHTML;

    let piecesHTML = '';
    const anim = state.anim; state.anim = null;   // la animación del empujón se reproduce una sola vez
    state.players.forEach((p,i)=>{
      const cx=(p.c+0.5)*cs, cy=(p.r+0.5)*cs;
      const size = cs*0.58;
      let g = '';
      if(i===state.currentPlayerIndex && !state.winner){
        g += `<circle cx="${cx}" cy="${cy}" r="${size*0.72}" fill="none" stroke="${p.color}" stroke-width="2.5" class="turn-ring"/>`;
      }
      if(state.ruleset==='hill') g += hillArcMarkup(p, cx, cy, cs);
      const popped = (i===justMovedIndex) || (anim && (i===anim.pusher || i===anim.pushed));
      // el atacante entra un poco después que el rival (clase "late")
      g += pieceMarkup(p.shape, cx, cy, size, p.color, popped ? 'piece-pop' + (anim && i===anim.pusher ? ' late' : '') : '');
      if(p.stunned){
        const sz = cs*0.46;
        g += `<image href="${emoteIconSrc('swirl')}" x="${cx-sz/2}" y="${cy-size*0.95-sz/2}" width="${sz}" height="${sz}" pointer-events="none"/>`;
      }
      if(anim && (i===anim.pusher || i===anim.pushed)){
        const from = (i===anim.pusher) ? anim.pusherFrom : anim.pushedFrom;
        const dx = (from.c - p.c) * cs, dy = (from.r - p.r) * cs;
        g = `<g class="piece-slide${i===anim.pusher ? ' late' : ''}" style="--dx:${dx}px;--dy:${dy}px">${g}</g>`;
      }
      piecesHTML += g;
    });
    piecesEl.innerHTML = piecesHTML + pushArrowsHTML;

    updateHeader();
    updateSidePanel();
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
    const remaining = Math.max(0, state.hunterTurnLimit - (state.moveCount||0));
    turnTimerBadge.classList.remove('hidden');
    turnTimerBadge.classList.toggle('low', remaining<=5);
    turnTimerBadge.textContent = `🏃 ${remaining} turno${remaining===1?'':'s'}`;
  }

  function updateHeader(){
    if(state.winner){
      if(state.resultTag==='huntersWin'){
        turnIndicator.textContent = '¡Los cazadores atraparon al fugitivo!';
        turnIndicator.style.color = state.winner.color;
        return;
      }
      const team = teamOf(state.winner.id);
      turnIndicator.textContent = team ? `¡Equipo ${team} ganó! (${state.winner.name})` : `¡${state.winner.name} ganó!`;
      turnIndicator.style.color = state.winner.color;
      return;
    }
    const cp = state.players[state.currentPlayerIndex];
    if(state.isDaily){
      turnIndicator.textContent = `Desafío diario · ${state.moveCount||0} movimiento${(state.moveCount||0)===1?'':'s'} · par ${state.dailyPar}`;
      turnIndicator.style.color = cp.color;
      return;
    }
    const team = teamOf(cp.id);
    turnIndicator.textContent = team ? `Turno de ${cp.name} (Equipo ${team})` : `Turno de ${cp.name}`;
    turnIndicator.style.color = cp.color;
  }

  function updateSidePanel(){
    const now = Date.now();
    playersListEl.innerHTML = state.players.map((p,i)=>{
      const active = (i===state.currentPlayerIndex && !state.winner);
      const bg = active ? hexToRgba(p.color,0.12) : 'transparent';
      const diffN = p.difficulty==='expert' ? 4 : (p.difficulty==='hard' ? 3 : (p.difficulty==='normal' ? 2 : 1));
      const cpuTag = p.isCPU ? `<span class="cpu-tag">IA <span class="stars-row">${starsHTML(diffN,diffN===4?4:3,10)}</span></span>` : '';
      const team = teamOf(p.id);
      const teamTag = team ? `<span class="cpu-tag">Equipo ${team}</span>` : '';
      const stunTag = p.stunned ? `<span class="cpu-tag"><img src="${emoteIconSrc('swirl')}" alt="">aturdido</span>` : '';
      const hillTag = (state.ruleset==='hill')
        ? `<span class="cpu-tag">⛰️ ${p.hillTurns||0}/${hillTargetTurns()}</span><span class="cpu-tag" title="Empujones que le quedan"><img src="${emoteIconSrc('anger')}" alt="Empujones">${p.pushesLeft||0}</span>`
        : '';
      const hunterTag = (state.ruleset==='hunter') ? (p.id===0 ? '<span class="cpu-tag">🏃 fugitivo</span>' : '<span class="cpu-tag">🏹 cazador</span>') : '';
      const emoteBtn = p.isCPU ? '' :
        `<button type="button" class="emote-btn ${(emoteCooldown[i]||0)>now?'cooldown':''}" data-pid="${i}" aria-label="Emotes de ${escapeHtml(p.name)}"><img src="${emoteIconSrc('faceHappy')}" alt=""></button>`;
      return `<li class="player-row ${active?'active':''}" style="--pc:${p.color}; --pc-bg:${bg}">
        <span class="row-icon">${smallShapeSVG(p.shape,p.color,22)}</span>
        <span class="player-name">${escapeHtml(p.name)}${cpuTag}${teamTag}${stunTag}${hillTag}${hunterTag}</span>
        <span class="wall-count">${p.wallsLeft} <span class="wall-label">paredes</span></span>
        ${emoteBtn}
      </li>`;
    }).join('');
  }

  // ---------- win overlay ----------
  function showWinOverlay(p, team){
    const rw = state.lastReward || { coins:0, fresh:[], note:'', stars:0 };
    winTitle.style.color = p.color;
    winCard.style.setProperty('--wc', p.color);
    if(state.isDaily){
      const par = state.dailyPar, used = state.moveCount;
      winTitle.textContent = '¡Desafío diario resuelto!';
      winMsg.textContent = `Lo resolviste en ${used} movimiento${used===1?'':'s'} (par: ${par}). ${used<=par ? '¡Igualaste o mejoraste el par!' : 'Volvé mañana por un nuevo tablero.'}`;
    } else if(state.resultTag==='huntersWin'){
      winTitle.textContent = '¡Atraparon al fugitivo!';
      winMsg.textContent = 'Los cazadores se las arreglaron con las paredes para acorralarlo antes de que se acabaran los turnos.';
    } else if(state.ruleset==='hunter'){
      winTitle.textContent = `¡${p.name} escapó!`;
      winMsg.textContent = 'El fugitivo llegó al centro antes de que lo atraparan.';
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
        winMsg.textContent = team ? `${p.name} llegó primero al centro para su equipo.` : 'Podés jugar otra ronda con la misma configuración o cambiar los ajustes.';
      }
    }
    // estrellas (desafío diario: según el par)
    if(state.isDaily){
      winStars.innerHTML = starsHTML(rw.stars || dailyStars(state.moveCount, state.dailyPar), 3, 44);
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
    if(rw.note) html += `<p class="reward-note">${escapeHtml(rw.note)}</p>`;
    winRewards.innerHTML = html;
    if(rw.coins>0) countUp(document.getElementById('winCoinCount'), 0, rw.coins, 900);
    renderWinGoal();
    renderWinMapInfo();
    openOverlay('win');
    if(!p.isCPU) starRain();
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
    const wallsEach = isDaily ? 0 : wallsPerPlayer(size, playersCount);
    const names = options.names || loadPlayerNames();
    const isCpu = !!options.isCpu;
    const difficulty = options.difficulty || 'easy';
    const customPlayers = Array.isArray(options.playerConfigs) && options.playerConfigs.length===playersCount ? options.playerConfigs : null;
    const objective = (options.objective && Number.isInteger(options.objective.r) && Number.isInteger(options.objective.c))
      ? { r:Math.max(0,Math.min(size-1,options.objective.r)), c:Math.max(0,Math.min(size-1,options.objective.c)) }
      : { r:mid, c:mid };

    const players = order.map((slotKey,i)=>{
      const skin = pieceSkins[i] || PALETTE[i];
      const isCPU = customPlayers ? !!customPlayers[i].isCPU : (isCpu && i===1);
      let walls = wallsEach;
      if(ruleset==='hunter' && !isDaily){
        walls = (i===0) ? Math.max(1, Math.floor(wallsEach/2)) : (wallsEach + 2);
      }
      return {
        id: i,
        name: isCPU ? (options.campaignRival || 'CPU') : ((names[i] && names[i].trim()) ? names[i].trim() : PALETTE[i].name),
        color: skin.color,
        shape: skin.shape,
        r: customPlayers ? Math.max(0,Math.min(size-1,+customPlayers[i].r||0)) : slots[slotKey].r,
        c: customPlayers ? Math.max(0,Math.min(size-1,+customPlayers[i].c||0)) : slots[slotKey].c,
        wallsLeft: customPlayers ? Math.max(0,+customPlayers[i].walls||0) : walls,
        wallsStart: customPlayers ? Math.max(0,+customPlayers[i].walls||0) : walls,
        isCPU: isCPU,
        difficulty: customPlayers ? (customPlayers[i].difficulty||'easy') : difficulty,
        stunned: false,
        hillTurns: 0,
        pushesLeft: ruleset==='hill' ? HILL_PUSHES : 0,
      };
    });

    state = {
      size,
      center: objective,
      objective,
      players,
      currentPlayerIndex: 0,
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
      powerUp: null,
      skipAdvance: false,
      isDaily,
      dailyPar: null,
      hunterTurnLimit: ruleset==='hunter' ? size*HUNTER_TURNS_PER_SIZE : null,
      resultTag: null,
      campaign: !!options.campaign,
      campaignLevel: options.campaignLevel || null,
      campaignRival: options.campaignRival || null,
      campaignPersonality: options.campaignPersonality || null,
      campaignXPReward: 0,
      presetWalls: Array.isArray(options.presetWalls) ? options.presetWalls : null,
      isCustomLevel: !!options.isCustomLevel,
      turnTimeSeconds: Math.max(0, +options.turnTimeSeconds || 0),
      playerConfigs: customPlayers ? customPlayers.map(p=> Object.assign({}, p)) : null,
    };
    mode = 'move';

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
      recordModePlayed(ruleset);
    }
    if(ruleset==='party') maybeSpawnPower();

    state.validMoves = computeValidMoves(0);
    render();
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
    if(mode==='wall' && previewSlot && previewSlot.valid){
      commitWall(previewSlot.r, previewSlot.c, previewSlot.orientation);
    }
    hideWallPreview();
    previewSlot = null;
    if(siegeHintOn){ siegeHintOn = false; if(state && !state.winner) updateModeUI(); }
  }
  boardSvg.addEventListener('pointerup', finishWallDrag);
  boardSvg.addEventListener('pointercancel', finishWallDrag);
  boardSvg.addEventListener('pointerleave', e=>{ if(e.pointerType==='mouse') finishWallDrag(); });

  function updateWallPreview(pt){
    const cs = cellSize();
    const slot = getWallSlotFromPoint(pt.x, pt.y);
    const evalRes = evaluateWallForMode(slot.r, slot.c, slot.orientation);
    slot.valid = evalRes.valid;
    previewSlot = slot;
    if(evalRes.reason==='hillSiege'){
      hintLine.textContent = `No se puede cerrar la zona: tiene que quedar con al menos ${HILL_MIN_ACCESSES} accesos.`;
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
  }

  function hideWallPreview(){
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
    difficultyHint.textContent = r && DIFFICULTY[r.value] ? DIFFICULTY[r.value].hint : '';
  }
  namesContainer.addEventListener('click', e=>{
    const dot = e.target.closest('.skin-dot');
    if(!dot) return;
    activeSkinSlot = +dot.dataset.slot;
    renderSkinsOverlay();
    openOverlay('skins');
  });
  document.getElementById('difficultyGroup').addEventListener('change', updateDifficultyHint);
  function renderNameInputs(count, isCpu){
    const current = loadPlayerNames();
    for(let i=0;i<4;i++){
      const existing = document.getElementById('nameInput'+i);
      if(existing) current[i] = existing.value;
    }
    let html = '';
    for(let i=0;i<count;i++){
      if(isCpu && i===1){
        html += `<div class="name-row">${skinDotHTML(i)}<span class="cpu-name-badge">🤖 CPU</span></div>`;
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
    difficultyFieldset.classList.toggle('hidden', m!=='cpu');
    if(rs && rs.forcePlayers){
      playersFieldset.classList.add('hidden');
      const el = document.getElementById('p'+rs.forcePlayers);
      if(el) el.checked = true;
    } else {
      playersFieldset.classList.toggle('hidden', m==='cpu');
    }
    renderNameInputs(currentPlayersCount(), m==='cpu');
    refreshCustomLevelSelect();
    syncModeButton();
  }
  rulesetSelect.addEventListener('change', updateMenuVisibility);
  document.getElementById('modeGroup').addEventListener('change', updateMenuVisibility);
  document.getElementById('playersGroup').addEventListener('change', updateMenuVisibility);

  // ---------- ajustes (tema, volumen, vibración, ayudas visuales) ----------
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
    vibrateToggle.checked = vibrateOn;
    showMovesToggle.checked = showMovesOn;
    glassToggle.checked = glassOn;
    openOverlay('settings');
  }
  settingsThemeGroup.addEventListener('change', e=>{ applyTheme(e.target.value); });
  sfxVolumeInput.addEventListener('input', ()=>{ setSfxVolume(+sfxVolumeInput.value/100); setSliderFill(); });
  sfxVolumeInput.addEventListener('change', ()=>{ playMoveSound(); });        // muestra el volumen elegido
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

  function scoreBotMove(botIdx,m,personality){
    const bot=state.players[botIdx], myAfter=distanceToCenter(m.r,m.c,state.blockedEdges);
    let score=-myAfter*10, oppIdx=otherPlayerClosestToCenter(botIdx);
    if(oppIdx!=null){ const oppDist=distanceToCenter(state.players[oppIdx].r,state.players[oppIdx].c,state.blockedEdges);
      if(personality==='aggressive')score+=(oppDist-myAfter)*1.8;
      if(personality==='defensive')score+=oppDist*0.25;
      if(personality==='speed'&&myAfter===0)score+=1000;
      if(personality==='strategist')score+=(oppDist-myAfter)*0.9;
    }
    if(personality==='defensive')score+=distanceToCenter(bot.r,bot.c,state.blockedEdges)-myAfter;
    if(state.ruleset==='hill'){
      // término "hill": acercarse a la casilla libre más cercana de la zona, valorar estar dentro, no salir de ella
      // y sólo gastar un empujón si me deja adentro
      const inNow = isHillCell(bot.r,bot.c), inAfter = isHillCell(m.r,m.c);
      let dz = inAfter ? 0 : distanceToHill(m.r,m.c,state.blockedEdges,hillFreeTargets(botIdx));
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
        el.tabIndex = on ? 0 : -1;
      });
      const m = MODE_BY_KEY[pending], r = rs(pending);
      const players = r.forcePlayers ? r.forcePlayers+' jugadores' : '2 a 4 jugadores';
      const who = r.forceLocal ? 'Solo local' : 'Local o vs. IA';
      modeDetail.innerHTML = '<div class="md-inner">'
        + '<div class="md-head"><span class="md-name">'+escapeHtml(r.label)+'</span><span class="stars-row" title="Complejidad">'+starsHTML(m.level,3,13)+'</span></div>'
        + '<p class="md-hint">'+escapeHtml(r.hint)+'</p>'
        + '<div class="md-tags"><span class="md-tag">'+players+'</span><span class="md-tag">'+who+'</span>'
        + (pending==='maze' ? '<span class="md-tag">Densidad: '+MAZE_DENSITIES[currentMazeDensity()]+'</span>' : '')
        + (won(pending) ? '<span class="md-tag won"><img src="'+medalSrc(m.medal)+'" alt="">Ganado</span>' : '')
        + '</div></div>';
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
        rulesetSelect.value = key;
        rulesetSelect.dispatchEvent(new Event('change', { bubbles:true }));   // reutiliza toda la lógica existente del menú
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
      modeTriggerSub.textContent = 'Tocá para ver los '+MODE_CATALOG.length+' modos';
    }
    return { build, open, close, confirm, syncTrigger };
  })();

  // ---------- tutorial ----------
  closeTutorialBtn.addEventListener('click', ()=> closeOverlay('tutorial'));
  helpLinkBtn.addEventListener('click', ()=> openOverlay('tutorial'));

  // ---------- desafío diario ----------
  function generateDailyLayout(dateStr, size){
    // la semilla del día sale del texto de la fecha: el mismo tablero para todos, ahora con patrones
    const seed = Math.floor(hashStringToSeed('quoridor-daily-'+dateStr+'-'+size)() * SEED_SPACE);
    return generateMaze({ size, players:1, density:'medio', seed }).walls;
  }
  function initDailyChallenge(){
    const dateStr = todayKey();
    const walls = generateDailyLayout(dateStr, 9);
    initGame(1, 9, { isDaily:true, dailyWalls: walls });
    closeOverlay('daily');
    menuScreen.classList.add('hidden');
    editorScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
  }
  function dailyParToday(){
    const size = 9, mid = 4;
    const walls = generateDailyLayout(todayKey(), size);
    const blocked = new Set();
    walls.forEach(w=> wallEdges(w.r,w.c,w.orientation).forEach(e=> blocked.add(edgeKey(e[0],e[1],e[2],e[3]))));
    return bfsShortestPath(0, mid, mid, mid, blocked, size);
  }
  function renderDailyOverlay(){
    const today = todayKey();
    const d = statsData.daily;
    const doneToday = d.lastDate === today;
    const bestToday = d.bestMoves ? d.bestMoves[today] : null;
    const par = dailyParToday();
    let html;
    if(doneToday && bestToday!=null){
      html = `<div class="big">✅</div><div class="daily-stars">${starsHTML(dailyStars(bestToday,par),3,34)}</div><div class="sub">Ya lo resolviste hoy en ${bestToday} movimiento${bestToday===1?'':'s'} (par: ${par}).</div>`;
    } else {
      html = `<div class="big">🗓️</div><div class="sub">Todavía no lo resolviste hoy. El tablero de hoy es el mismo para todos. Par: ${par} movimientos.</div>`;
    }
    const curStreak = (d.lastDate===today || d.lastDate===todayKey(-1)) ? (d.streak||0) : 0;
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
    html += `<div class="sub" style="margin-top:8px;">Racha actual: ${curStreak} día${curStreak===1?'':'s'} · Mejor racha: ${d.bestStreak||0}</div>`;
    html += `<div class="sub">Cada 7 días seguidos te espera un cofre con un emote sorpresa.</div>`;
    dailyStatusBody.innerHTML = html;
    playDailyBtn.textContent = doneToday ? 'Jugar de nuevo' : 'Jugar';
  }
  dailyReadyChip.addEventListener('click', ()=>{ renderDailyOverlay(); openOverlay('daily'); });
  dailyLinkBtn.addEventListener('click', ()=>{ renderDailyOverlay(); openOverlay('daily'); });
  playDailyBtn.addEventListener('click', initDailyChallenge);
  closeDailyBtn.addEventListener('click', ()=> closeOverlay('daily'));

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
    const cfg = {
      isCpu: !!state.isCpuGame,
      difficulty: (state.players[1] && state.players[1].difficulty) || 'easy',
      names: loadPlayerNames(),
      ruleset: state.ruleset,
      campaign: state.campaign, campaignLevel: state.campaignLevel, campaignRival: state.campaignRival, campaignPersonality: state.campaignPersonality,
      presetWalls: state.presetWalls, isCustomLevel: state.isCustomLevel, objective: state.objective,
      turnTimeSeconds: state.turnTimeSeconds, playerConfigs: state.playerConfigs,
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
    const m = currentMode();
    const isCpu = m==='cpu';
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
      if(isCpu && i===1) continue;
      const inp = document.getElementById('nameInput'+i);
      if(inp){ names[i] = inp.value.trim(); }
    }
    savePlayerNames(names);
    saveLastSetup({ playersCount, size: +document.querySelector('input[name="size"]:checked').value, mode:m, difficulty, ruleset,
      mazeDensity: currentMazeDensity(), mazeMine: !!mazeMineCheck.checked });

    const mazeOpts = (ruleset==='maze' && !presetWalls) ? { mazeSeed: mazeMenuSeed, mazeDensity: currentMazeDensity(), mazeMine: mazeMineCheck.checked ? loadUserPatterns() : [] } : {};
    initGame(playersCount, size, Object.assign({ isCpu, difficulty, names, ruleset, presetWalls, isCustomLevel }, mazeOpts));
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
    if(cfg.ruleset && RULESETS[cfg.ruleset]){
      rulesetSelect.value = cfg.ruleset;
    }
    if(cfg.mazeDensity && MAZE_DENSITIES[cfg.mazeDensity]){
      const dr = document.querySelector('input[name="mazeDensity"][value="'+cfg.mazeDensity+'"]'); if(dr) dr.checked = true;
    }
    if(cfg.mazeMine) mazeMineCheck.checked = true;
  })();

  if(window.__QUORIDOR_TEST__){
    window.__quoridorMaze = { generateMaze, generateRandomWalls, tryPlaceEnvWall, MAZE_PATTERNS, MAZE_RULES, MAZE_DENSITIES, MAZE_TEMPLATES,
      mazeContext, mazeTable, mazePool, mazeEval, mazeJudge, userPatternFrom, seedToText, seedFromText, generateDailyLayout, hashStringToSeed, SEED_SPACE,
      getState:()=> state, bfsShortestPath, openOverlay, closeOverlay };
  }
  modePicker.build();
  updateMenuVisibility();
  updateBadges();

  let tutorialSeen = false;
  try{ tutorialSeen = localStorage.getItem('quoridor_tutorial_seen')==='1'; }catch(e){}
  if(!tutorialSeen) openOverlay('tutorial');

})();
