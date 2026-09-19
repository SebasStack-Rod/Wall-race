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

  // ---------- modos de partida ----------
  const RULESETS = {
    classic: { label:'Clásico', hint:'Las reglas de siempre: movete y bloqueá con paredes hasta llegar al centro.' },
    fog:     { label:'Niebla de guerra', hint:'Sólo ves las paredes cercanas a quien juega en ese turno. Las lejanas siguen bloqueando aunque no se vean.', forcePlayers:null },
    teams:   { label:'2v2 (equipos)', hint:'Se juega siempre con 4 en el mismo dispositivo. Equipo A: jugadores 1 y 3. Equipo B: jugadores 2 y 4. Gana el equipo del primero en llegar al centro.', forcePlayers:4, forceLocal:true },
    party:   { label:'Fiesta', hint:'De vez en cuando aparece un poder en el tablero: pared extra, turno extra o aturdir al rival mejor ubicado.' },
    maze:    { label:'Laberinto', hint:'El tablero arranca con paredes al azar ya colocadas (o con tu propio diseño del editor de niveles), garantizando que siempre haya camino.' },
    blitz:   { label:'Contrarreloj', hint:'Cada turno tiene 20 segundos. Si se acaba el tiempo, se juega un movimiento al azar y pasa el turno.' },
    mirror:  { label:'Espejo', hint:'Sólo para 2 jugadores. Cada pared que colocás aparece también reflejada en el punto opuesto del tablero.', forcePlayers:2 },
    hill:    { label:'Rey de la colina', hint:'No alcanza con pisar el centro una vez: hay que acumular varios turnos parado en la zona central (no hace falta que sean seguidos).' },
    hunter:  { label:'Cazador y fugitivo', hint:'El Jugador 1 es el fugitivo y gana si llega al centro. El resto son cazadores: no ganan llegando al centro, sólo bloqueando con paredes antes de que se acabe el límite de turnos.' },
  };
  const FOG_RADIUS = 2;
  const BLITZ_SECONDS = 20;
  const HILL_TARGET = 3;
  const HUNTER_TURNS_PER_SIZE = 3;
  const PARTY_TYPES = ['pared_extra','turno_extra','aturdido'];
  // ---------- FASE 2: campaña, rivales, XP y progresión ----------
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
  function saveCampaign(){ try{ localStorage.setItem('quoridor_campaign',JSON.stringify(campaignData)); }catch(e){} }
  function campaignRank(){ let rank=CAMPAIGN_RANKS[0]; for(const r of CAMPAIGN_RANKS){ if(campaignData.xp>=r.min) rank=r; } return rank; }
  function campaignNextRank(){ for(const r of CAMPAIGN_RANKS){ if(campaignData.xp<r.min) return r; } return null; }
  function campaignLevelUnlocked(n){ return n<=campaignData.unlockedLevel; }
  function campaignSkinColorUnlocked(color){
    for(const [lvl,c] of Object.entries(CAMPAIGN_SKIN_UNLOCKS)){ if(c===color && campaignData.completed.includes(+lvl)) return true; }
    return !Object.values(CAMPAIGN_SKIN_UNLOCKS).includes(color);
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
  // Plantillas de paredes para el modo Laberinto: cada una es una lista de segmentos
  // relativos a un punto de anclaje (dr,dc,orientation). Se prueban una por una y si
  // alguna rompe el camino de algún jugador, se descarta la plantilla completa.
  const MAZE_TEMPLATES = [
    [ [0,0,'h'], [0,1,'h'] ],                       // línea de 2 (pared larga)
    [ [0,0,'v'], [1,0,'v'] ],                       // línea vertical de 2
    [ [0,0,'h'], [0,1,'h'], [1,1,'v'] ],             // forma de L
    [ [0,0,'v'], [0,0,'h'] ],                        // "caja" (esquina cerrada)
    [ [0,0,'h'], [0,2,'h'] ],                        // dos paredes separadas (paso angosto en el medio)
  ];

  // ---------- logros ----------
  function totalWins(s){ return (s.winsBySlot||[0,0,0,0]).reduce((a,b)=>a+b,0); }
  const ACHIEVEMENTS = [
    { id:'jugar_1', icon:'🎮', name:'Primer paso', desc:'Jugá tu primera partida.', check:s=> s.totalGames>=1 },
    { id:'jugar_10', icon:'📅', name:'Habitué', desc:'Jugá 10 partidas.', check:s=> s.totalGames>=10 },
    { id:'jugar_50', icon:'🗓️', name:'De la casa', desc:'Jugá 50 partidas.', check:s=> s.totalGames>=50 },
    { id:'victoria_1', icon:'🥇', name:'Primera victoria', desc:'Ganá tu primera partida.', check:s=> totalWins(s)>=1 },
    { id:'victoria_10', icon:'🏆', name:'Ganador serial', desc:'Sumá 10 victorias entre todos los jugadores.', check:s=> totalWins(s)>=10 },
    { id:'victoria_50', icon:'👑', name:'Leyenda del tablero', desc:'Sumá 50 victorias entre todos los jugadores.', check:s=> totalWins(s)>=50 },
    { id:'racha_3', icon:'🔥', name:'Rachero', desc:'Ganá 3 partidas seguidas con el mismo jugador.', check:s=> (s.streak&&s.streak.count>=3) },
    { id:'racha_5', icon:'🚀', name:'Imparable', desc:'Ganá 5 partidas seguidas con el mismo jugador.', check:s=> (s.streak&&s.streak.count>=5) },
    { id:'vs_ia_ganar', icon:'🤖', name:'Más listo que la máquina', desc:'Ganale una partida a la IA.', check:s=> s.vsCpu && s.vsCpu.won>=1 },
    { id:'vs_ia_dificil', icon:'🧠', name:'Sin ayuda de nadie', desc:'Ganale a la IA en dificultad difícil.', check:s=> s.vsCpuHardWon>=1 },
    { id:'vs_ia_10', icon:'⚙️', name:'Domador de bots', desc:'Ganale 10 partidas a la IA.', check:s=> s.vsCpu && s.vsCpu.won>=10 },
    { id:'sin_paredes', icon:'🚫', name:'Camino directo', desc:'Ganá una partida sin colocar ninguna pared.', check:s=> s.noWallWins>=1 },
    { id:'todas_paredes', icon:'🧱', name:'Arquitecto', desc:'Ganá una partida habiendo usado todas tus paredes.', check:s=> s.allWallsUsedWins>=1 },
    { id:'rapido_15', icon:'⚡', name:'Directo al grano', desc:'Ganá una partida en 15 movimientos o menos.', check:s=> s.fastestWinMoves!=null && s.fastestWinMoves<=15 },
    { id:'maraton_60', icon:'🐢', name:'Maratón', desc:'Jugá una partida de más de 60 movimientos en total.', check:s=> s.longestGameMoves>=60 },
    { id:'tablero_5', icon:'🔹', name:'Sprint', desc:'Ganá una partida en un tablero de 5×5.', check:s=> s.sizeWins && s.sizeWins[5]>=1 },
    { id:'tablero_11', icon:'🔷', name:'Territorio grande', desc:'Ganá una partida en un tablero de 11×11.', check:s=> s.sizeWins && s.sizeWins[11]>=1 },
    { id:'cuatro_jugadores', icon:'👥', name:'Multitud', desc:'Ganá una partida de 4 jugadores.', check:s=> s.winsWith4>=1 },
    { id:'modo_niebla', icon:'🌫️', name:'Ojo de águila', desc:'Ganá una partida en modo Niebla de guerra.', check:s=> s.modeWins && s.modeWins.fog>=1 },
    { id:'modo_equipos', icon:'🤝', name:'Trabajo en equipo', desc:'Ganá una partida en modo 2v2.', check:s=> s.modeWins && s.modeWins.teams>=1 },
    { id:'modo_fiesta', icon:'🎉', name:'El alma de la fiesta', desc:'Ganá una partida en modo Fiesta.', check:s=> s.modeWins && s.modeWins.party>=1 },
    { id:'modo_laberinto', icon:'🧊', name:'Sin perderse', desc:'Ganá una partida en modo Laberinto.', check:s=> s.modeWins && s.modeWins.maze>=1 },
    { id:'modo_blitz', icon:'⏱️', name:'Contra las cuerdas', desc:'Ganá una partida en modo Contrarreloj.', check:s=> s.modeWins && s.modeWins.blitz>=1 },
    { id:'modo_espejo', icon:'🪞', name:'Simetría perfecta', desc:'Ganá una partida en modo Espejo.', check:s=> s.modeWins && s.modeWins.mirror>=1 },
    { id:'modo_colina', icon:'⛰️', name:'Rey de la colina', desc:'Ganá una partida en modo Rey de la colina.', check:s=> s.modeWins && s.modeWins.hill>=1 },
    { id:'modo_cazador', icon:'🏹', name:'Cacería exitosa', desc:'Ganá una partida en modo Cazador y fugitivo, como fugitivo o como cazador.', check:s=> s.modeWins && s.modeWins.hunter>=1 },
    { id:'todos_los_modos', icon:'🌈', name:'Probaste de todo', desc:'Jugá al menos una vez en todos los modos especiales.', check:s=> s.modesPlayed && Object.keys(RULESETS).filter(k=>k!=='classic').every(k=> (s.modesPlayed[k]||0)>=1) },
    { id:'desafio_1', icon:'📌', name:'Reto del día', desc:'Resolvé el desafío diario.', check:s=> s.daily && s.daily.completedCount>=1 },
    { id:'desafio_racha_7', icon:'📆', name:'Semana completa', desc:'Completá el desafío diario 7 días seguidos.', check:s=> s.daily && s.daily.bestStreak>=7 },
    { id:'personalizar_ficha', icon:'🎨', name:'Estilo propio', desc:'Cambiá el color o la forma de una ficha.', check:s=> !!s.skinsCustomized },
    { id:'editor_1', icon:'🧩', name:'Diseñador', desc:'Creá y jugá un nivel propio en el editor.', check:s=> s.customLevelsPlayed>=1 },
    { id:'paredes_100', icon:'🏗️', name:'Constructor', desc:'Colocá 100 paredes en total, sumando todas las partidas.', check:s=> s.totalWallsPlaced>=100 },
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
  const settingsSoundBtn = document.getElementById('settingsSoundBtn');
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
  const customLevelFieldset = document.getElementById('customLevelFieldset');
  const customLevelSelect = document.getElementById('customLevelSelect');
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
  const levelNameOverlay = document.getElementById('levelNameOverlay');
  const levelNameInput = document.getElementById('levelNameInput');
  const levelNameSaveBtn = document.getElementById('levelNameSaveBtn');
  const levelNameCancelBtn = document.getElementById('levelNameCancelBtn');
  const editorPlayersCount = document.getElementById('editorPlayersCount');
  const editorTurnTime = document.getElementById('editorTurnTime');
  const editorRuleset = document.getElementById('editorRuleset');
  const editorPlayersConfig = document.getElementById('editorPlayersConfig');
  const editorObjectiveCoords = document.getElementById('editorObjectiveCoords');
  const editorObjectiveRow = document.getElementById('editorObjectiveRow');
  const editorObjectiveCol = document.getElementById('editorObjectiveCol');

  const overlayEls = { win:winOverlay, confirm:confirmOverlay, settings:settingsOverlay, tutorial:tutorialOverlay, stats:statsOverlay, skins:skinsOverlay, achievements:achievementsOverlay, daily:dailyOverlay, levelName:levelNameOverlay };

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
    if(!base.valid || state.ruleset!=='mirror') return base;
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

  // ---------- Modo Rey de la colina: zona central en forma de cruz ----------
  function hillCells(){
    const { r, c } = state.center;
    return [ {r,c}, {r:r-1,c}, {r:r+1,c}, {r,c:c-1}, {r,c:c+1} ].filter(cell=>
      cell.r>=0 && cell.c>=0 && cell.r<state.size && cell.c<state.size
    );
  }
  function isHillCell(r,c){ return hillCells().some(cell=> cell.r===r && cell.c===c); }

  // ---------- Condición de victoria (varía según el modo de partida) ----------
  function checkWinAfterMove(p){
    if(state.ruleset==='hill'){
      if(isHillCell(p.r,p.c)) p.hillTurns = (p.hillTurns||0) + 1;
      return p.hillTurns >= HILL_TARGET;
    }
    if(state.ruleset==='hunter'){
      return p.id===0 && p.r===state.center.r && p.c===state.center.c;
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
  function generateRandomWalls(localState, count, rng){
    const random = rng || Math.random;
    const size = localState.size;
    let placed = 0, attempts = 0;
    while(placed < count && attempts < 200){
      attempts++;
      const template = MAZE_TEMPLATES[Math.floor(random()*MAZE_TEMPLATES.length)];
      const baseR = Math.floor(random()*(size-1));
      const baseC = Math.floor(random()*(size-1));
      const segs = template.map(([dr,dc,orientation])=> ({ r:baseR+dr, c:baseC+dc, orientation }));
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
    return placed;
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
      startTurnTimer();
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

  // ---------- sonido y vibración (Web Audio + Vibration API, sin plugins nativos) ----------
  function loadSoundPref(){
    try{ return localStorage.getItem('quoridor_muted')==='1'; }catch(e){ return false; }
  }
  let muted = loadSoundPref();
  function setMuted(v){
    muted = v;
    try{ localStorage.setItem('quoridor_muted', v ? '1':'0'); }catch(e){}
  }
  function getAudioCtx(){
    if(audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    try{ audioCtx = new AC(); }catch(e){ audioCtx = null; }
    return audioCtx;
  }
  function playTone(freq, duration, type, gainStart){
    if(muted) return;
    const ctx = getAudioCtx();
    if(!ctx) return;
    if(ctx.state==='suspended'){ try{ ctx.resume(); }catch(e){} }
    try{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainStart!=null ? gainStart : 0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }catch(e){}
  }
  function playMoveSound(){ playTone(440, 0.09, 'sine', 0.14); }
  function playWallSound(){ playTone(170, 0.15, 'square', 0.15); }
  function playWinSound(){
    if(muted) return;
    [523.25,659.25,783.99].forEach((f,i)=>{
      setTimeout(()=> playTone(f, 0.24, 'triangle', 0.17), i*110);
    });
  }
  function vibrate(pattern){
    if(muted) return;
    try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){}
  }
  function updateSettingsSoundBtn(){
    settingsSoundBtn.textContent = muted ? '🔇 Silenciado — tocar para activar' : '🔊 Activado — tocar para silenciar';
  }

  // ---------- estadísticas locales ----------
  function blankStats(){
    return {
      totalGames:0, winsBySlot:[0,0,0,0], streak:{slot:null,count:0}, vsCpu:{played:0,won:0},
      vsCpuHardWon:0, winsWith4:0,
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

  function recordGameResult(summary){
    const winnerSlot = summary.winnerSlot;
    statsData.totalGames += 1;
    statsData.winsBySlot[winnerSlot] = (statsData.winsBySlot[winnerSlot]||0) + 1;
    if(statsData.streak.slot === winnerSlot) statsData.streak.count += 1;
    else { statsData.streak.slot = winnerSlot; statsData.streak.count = 1; }
    if(summary.isCpuGame){
      statsData.vsCpu.played += 1;
      if(winnerSlot === 0){
        statsData.vsCpu.won += 1;
        if(summary.isCpuHard) statsData.vsCpuHardWon += 1;
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
    return checkAchievements();
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
    return checkAchievements();
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

  // ---------- logros: chequeo + UI ----------
  function checkAchievements(){
    const fresh = [];
    ACHIEVEMENTS.forEach(a=>{
      if(statsData.achievementsUnlocked.indexOf(a.id)===-1 && a.check(statsData)){
        statsData.achievementsUnlocked.push(a.id);
        fresh.push(a);
      }
    });
    if(fresh.length){
      saveStats();
      showAchievementToasts(fresh);
    }
    return fresh;
  }
  let toastQueue = [];
  let toastShowing = false;
  function showAchievementToasts(list){
    toastQueue = toastQueue.concat(list);
    if(!toastShowing) advanceToastQueue();
  }
  function advanceToastQueue(){
    if(!toastQueue.length){ toastShowing=false; return; }
    toastShowing = true;
    const a = toastQueue.shift();
    achievementToast.textContent = a.text || `🏆 Nuevo logro: ${a.name}`;
    achievementToast.classList.add('show');
    setTimeout(()=>{
      achievementToast.classList.remove('show');
      setTimeout(advanceToastQueue, 260);
    }, 2600);
  }
  function renderAchievementsOverlay(){
    const unlocked = statsData.achievementsUnlocked;
    achSummary.textContent = `${unlocked.length} / ${ACHIEVEMENTS.length} desbloqueados`;
    achGrid.innerHTML = ACHIEVEMENTS.map(a=>{
      const is = unlocked.indexOf(a.id)!==-1;
      return `<div class="ach-row ${is?'unlocked':''}">
        <span class="ach-icon">${is ? a.icon : '🔒'}</span>
        <span class="ach-text"><span class="ach-name">${escapeHtml(a.name)}</span><div class="ach-desc">${escapeHtml(a.desc)}</div></span>
      </div>`;
    }).join('');
  }
  achievementsLinkBtn.addEventListener('click', ()=>{ renderAchievementsOverlay(); openOverlay('achievements'); });
  closeAchievementsBtn.addEventListener('click', ()=> closeOverlay('achievements'));
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
    showConfirm('¿Reiniciar todas las estadísticas guardadas? No se puede deshacer.', ()=>{
      const keepAchievements = statsData.achievementsUnlocked.slice();
      statsData = blankStats();
      statsData.achievementsUnlocked = keepAchievements;
      saveStats();
      renderStatsOverlay();
    });
  });
  statsLinkBtn.addEventListener('click', ()=>{ renderStatsOverlay(); openOverlay('stats'); });
  closeStatsBtn.addEventListener('click', ()=> closeOverlay('stats'));

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
    if(!campaignSkinColorUnlocked(color)){ showAchievementToasts([{text:'🔒 Color bloqueado: completá la etapa correspondiente de la campaña.'}]); return; }
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
    if(shapeBtn){ if(!campaignShapeUnlocked(shapeBtn.dataset.shape)){ showAchievementToasts([{text:'🔒 Forma bloqueada: avanzá en la campaña para desbloquearla.'}]); return; } pieceSkins[activeSkinSlot].shape = shapeBtn.dataset.shape; saveSkins(); recordSkinCustomized(); renderSkinsOverlay(); return; }
  });
  resetSkinsBtn.addEventListener('click', ()=>{
    pieceSkins = defaultSkins();
    saveSkins();
    renderSkinsOverlay();
  });
  skinsLinkBtn.addEventListener('click', ()=>{ renderSkinsOverlay(); openOverlay('skins'); });
  closeSkinsBtn.addEventListener('click', ()=> closeOverlay('skins'));


  // ---------- campaña: interfaz y selección de niveles ----------
  const campaignBtn=document.getElementById('campaignLinkBtn');
  const campaignOverlay=document.createElement('div');
  campaignOverlay.id='campaignOverlay'; campaignOverlay.className='overlay-backdrop hidden';
  campaignOverlay.innerHTML=`<div class="modal-card wide campaign-card">
    <h2>🏕️ Campaña</h2><p id="campaignRankLine" class="campaign-rank-line"></p>
    <div class="campaign-progress"><div id="campaignProgressFill"></div></div>
    <p id="campaignNextLine" class="campaign-next-line"></p><div id="campaignLevels" class="campaign-levels"></div>
    <div class="modal-actions"><button class="secondary-btn" id="closeCampaignBtn">Volver</button></div>
  </div>`;
  document.body.appendChild(campaignOverlay); overlayEls.campaign=campaignOverlay;
  const campaignLevelsEl=campaignOverlay.querySelector('#campaignLevels'), campaignRankLine=campaignOverlay.querySelector('#campaignRankLine');
  const campaignNextLine=campaignOverlay.querySelector('#campaignNextLine'), campaignProgressFill=campaignOverlay.querySelector('#campaignProgressFill');
  function renderCampaign(){
    const rank=campaignRank(), next=campaignNextRank();
    campaignRankLine.textContent=`${rank.name} · ${campaignData.xp} XP · ${campaignData.wins} victorias`;
    const prev=rank.min, max=next?next.min:Math.max(rank.min+1,campaignData.xp);
    campaignProgressFill.style.width=(next?Math.max(0,Math.min(100,((campaignData.xp-prev)/(max-prev))*100)):100)+'%';
    campaignNextLine.textContent=next?`${next.min-campaignData.xp} XP para rango ${next.name}`:'Rango máximo alcanzado';
    campaignLevelsEl.innerHTML=CAMPAIGN_LEVELS.map(l=>{
      const unlocked=campaignLevelUnlocked(l.id), done=campaignData.completed.includes(l.id), locked=!unlocked;
      return `<button type="button" class="campaign-level ${done?'done':''} ${locked?'locked':''}" data-level="${l.id}" ${locked?'disabled':''}>
        <span class="campaign-level-num">${done?'✓':l.id}</span><span class="campaign-level-main"><strong>${escapeHtml(l.name)}</strong><small>vs. ${escapeHtml(l.rival)} · ${l.size}×${l.size}</small></span><span class="campaign-level-xp">+${l.xp} XP</span>
      </button>`;
    }).join('');
  }
  campaignBtn.addEventListener('click',()=>{ renderCampaign(); openOverlay('campaign'); });
  campaignOverlay.querySelector('#closeCampaignBtn').addEventListener('click',()=>closeOverlay('campaign'));
  campaignLevelsEl.addEventListener('click',e=>{
    const btn=e.target.closest('.campaign-level'); if(!btn || btn.disabled) return;
    const level=CAMPAIGN_LEVELS.find(x=>x.id===+btn.dataset.level); if(!level) return;
    closeOverlay('campaign'); startCampaignLevel(level);
  });
  function startCampaignLevel(level){
    const names=loadPlayerNames();
    initGame(2,level.size,{isCpu:true,difficulty:level.difficulty,names,ruleset:'classic',campaign:true,campaignLevel:level.id,campaignRival:level.rival,campaignPersonality:level.personality});
    menuScreen.classList.add('hidden'); gameScreen.classList.remove('hidden');
    setTimeout(()=>{ hintLine.textContent=`${level.rival}: ${level.intro}`; },0);
  }

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
    hintLine.textContent = mode==='wall'
      ? 'Arrastrá sobre el tablero para ubicar la pared y soltá para confirmarla.'
      : 'Tocá una casilla resaltada para moverte.';
  }
  moveModeBtn.addEventListener('click', ()=> setMode('move'));
  wallModeBtn.addEventListener('click', ()=> setMode('wall'));

  // ---------- IA estratégica ----------
  function invalidateBotTimer(){ botToken++; if(botTimer){ clearTimeout(botTimer); botTimer=null; } }
  function otherPlayerClosestToCenter(excludeIdx){
    let best=null,bestDist=Infinity;
    state.players.forEach((p,i)=>{ if(i===excludeIdx)return; const d=distanceToCenter(p.r,p.c,state.blockedEdges); if(d<bestDist){bestDist=d;best=i;} });
    return best;
  }
  function findBestBlockingWall(opponentIdx,currentOppDist){
    const opp=state.players[opponentIdx], radius=3, maxSlot=state.size-2, candidates=[];
    for(let r=Math.max(0,opp.r-radius);r<=Math.min(maxSlot,opp.r+radius);r++) for(let c=Math.max(0,opp.c-radius);c<=Math.min(maxSlot,opp.c+radius);c++) for(const orientation of ['h','v']){
      const ev=evaluateWallForMode(r,c,orientation); if(!ev.valid) continue;
      const test=new Set(state.blockedEdges); ev.edges.forEach(e=>test.add(edgeKey(e[0],e[1],e[2],e[3])));
      if(ev.mirrorEdges) ev.mirrorEdges.forEach(e=>test.add(edgeKey(e[0],e[1],e[2],e[3])));
      const d=distanceToCenter(opp.r,opp.c,test); if(d>currentOppDist) candidates.push({r,c,orientation,gain:d-currentOppDist,newOppDist:d});
    }
    if(!candidates.length)return null;
    candidates.sort((a,b)=>b.gain-a.gain||a.newOppDist-b.newOppDist);
    const gain=candidates[0].gain, top=candidates.filter(x=>x.gain===gain);
    return top[Math.floor(Math.random()*top.length)];
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
    return score;
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
    if(!state||state.winner)return; const cp=state.players[state.currentPlayerIndex]; if(!cp||!cp.isCPU)return;
    const token=++botToken; hintLine.textContent='La IA está analizando el tablero…'; hintLine.classList.add('thinking');
    botTimer=setTimeout(()=>{ if(token!==botToken||!state||state.winner)return; const now=state.players[state.currentPlayerIndex]; if(!now||!now.isCPU)return;
      const d=botPlanMove(state.currentPlayerIndex); if(d.type==='move')performMove(d.r,d.c); else commitWall(d.r,d.c,d.orientation);
    },700+Math.random()*700);
  }

  function teamOf(playerId){
    if(state.ruleset!=='teams') return null;
    return (playerId===0 || playerId===2) ? 'A' : 'B';
  }
  function finishGame(p, tag){
    state.winner = p;
    state.resultTag = tag || null;
    const winnerTeam = teamOf(p.id);
    const wallsStart = p.wallsStart;
    const wallsUsedByWinner = Math.max(0, wallsStart - p.wallsLeft);
    if(state.campaign){
      state.campaignXPReward = awardCampaignXP(state.campaignLevel, p.id===0);
    }
    if(state.isDaily){
      recordDailyResult(state.moveCount, state.dailyPar);
    } else {
      recordGameResult({
        winnerSlot: p.id,
        isCpuGame: !!state.isCpuGame,
        isCpuHard:!!(state.isCpuGame&&state.players.some(pl=>pl.isCPU&&(pl.difficulty==='hard'||pl.difficulty==='expert'))),
        ruleset: state.ruleset,
        size: state.size,
        playersCount: state.players.length,
        wallsUsedByWinner, wallsStart,
        movesUsed: state.moveCount,
        totalMovesThisGame: state.moveCount,
        wallsPlacedThisGame: state.walls.filter(w=>!w.env).length,
      });
    }
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
    p.r = r; p.c = c;
    state.moveCount = (state.moveCount||0) + 1;
    maybePickUpPower(p);
    if(checkWinAfterMove(p)){
      state.winner = p;
      render(idx);
      finishGame(p);
      return;
    }
    playMoveSound();
    vibrate(12);
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
    state.occupied[r][c] = orientation;
    evalRes.edges.forEach(e=> state.blockedEdges.add(edgeKey(e[0],e[1],e[2],e[3])));
    state.walls.push({ r, c, orientation, color: cp.color });
    if(evalRes.mirrorEdges){
      const m = mirrorSlot(r,c);
      state.occupied[m.r][m.c] = orientation;
      evalRes.mirrorEdges.forEach(e=> state.blockedEdges.add(edgeKey(e[0],e[1],e[2],e[3])));
      state.walls.push({ r:m.r, c:m.c, orientation, color: cp.color });
    }
    cp.wallsLeft -= 1;
    state.moveCount = (state.moveCount||0) + 1;
    playWallSound();
    vibrate(18);
    if(state.ruleset==='hill' && isHillCell(cp.r,cp.c)){
      cp.hillTurns = (cp.hillTurns||0) + 1;
      if(cp.hillTurns>=HILL_TARGET){
        state.winner = cp;
        render();
        finishGame(cp);
        return;
      }
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
  function startTurnTimer(){
    clearTurnTimer();
    if(!state || state.winner) return;
    const seconds=state.turnTimeSeconds>0?state.turnTimeSeconds:(state.isCustomLevel?0:(state.ruleset==='blitz'?BLITZ_SECONDS:0));
    if(seconds<=0) return;
    const cp=state.players[state.currentPlayerIndex];
    if(cp&&cp.isCPU) return;
    state.turnTimeLeft=seconds;
    turnTimerBadge.classList.remove('hidden');
    turnTimerBadge.classList.remove('low');
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
    const moves = state.validMoves;
    if(!moves.length){ advanceTurn(); render(); return; }
    const m = moves[Math.floor(Math.random()*moves.length)];
    performMove(m.r, m.c);
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
      hillCells().forEach(cell=>{
        gridHTML += `<rect x="${cell.c*cs}" y="${cell.r*cs}" width="${cs}" height="${cs}" fill="var(--accent)" opacity="0.14"/>`;
      });
    }
    const ccx=(state.center.c+0.5)*cs, ccy=(state.center.r+0.5)*cs;
    gridHTML += `<circle cx="${ccx}" cy="${ccy}" r="15" fill="none" stroke="var(--accent)" stroke-width="3" class="center-glow"/>`;
    gridEl.innerHTML = gridHTML;

    let movesHTML = '';
    const activePlayer = state.players[state.currentPlayerIndex];
    if(!state.winner && activePlayer && !activePlayer.isCPU){
      for(const m of state.validMoves){
        const cx=(m.c+0.5)*cs, cy=(m.r+0.5)*cs;
        movesHTML += `<circle cx="${cx}" cy="${cy}" r="${cs*0.16}" fill="${activePlayer.color}" class="move-dot" opacity="0.8"/>`;
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
      wallsHTML += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="${rx}" fill="${w.color}" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>`;
    }
    if(state.ruleset==='party' && state.powerUp){
      const pc=(state.powerUp.c+0.5)*cs, pr=(state.powerUp.r+0.5)*cs;
      const icon = state.powerUp.type==='pared_extra' ? '🧱' : (state.powerUp.type==='turno_extra' ? '⭐' : '💥');
      wallsHTML += `<g class="power-token"><circle cx="${pc}" cy="${pr}" r="${cs*0.32}" fill="var(--accent)" opacity="0.25" class="spin"/><text x="${pc}" y="${pr}" font-size="${cs*0.4}" text-anchor="middle" dominant-baseline="central">${icon}</text></g>`;
    }
    wallsEl.innerHTML = wallsHTML;

    let piecesHTML = '';
    state.players.forEach((p,i)=>{
      const cx=(p.c+0.5)*cs, cy=(p.r+0.5)*cs;
      const size = cs*0.58;
      if(i===state.currentPlayerIndex && !state.winner){
        piecesHTML += `<circle cx="${cx}" cy="${cy}" r="${size*0.72}" fill="none" stroke="${p.color}" stroke-width="2.5" class="turn-ring"/>`;
      }
      const cls = (i===justMovedIndex) ? 'piece-pop' : '';
      piecesHTML += pieceMarkup(p.shape, cx, cy, size, p.color, cls);
    });
    piecesEl.innerHTML = piecesHTML;

    updateHeader();
    updateSidePanel();
    updateModeUI();
    scheduleBotTurnIfNeeded();
    startTurnTimer();
    updateHunterBadge();
  }
  function updateHunterBadge(){
    if(!state || state.ruleset!=='hunter' || state.winner){
      if(!state || state.ruleset!=='blitz') turnTimerBadge.classList.add('hidden');
      return;
    }
    const remaining = Math.max(0, state.hunterTurnLimit - (state.moveCount||0));
    turnTimerBadge.classList.remove('hidden');
    turnTimerBadge.classList.toggle('low', remaining<=5);
    turnTimerBadge.textContent = `🏃 ${remaining} turno${remaining===1?'':'s'}`;
  }

  function updateHeader(){
    if(state.winner){
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
    playersListEl.innerHTML = state.players.map((p,i)=>{
      const active = (i===state.currentPlayerIndex && !state.winner);
      const bg = active ? hexToRgba(p.color,0.12) : 'transparent';
      const cpuTag = p.isCPU ? '<span class="cpu-tag">IA</span>' : '';
      const team = teamOf(p.id);
      const teamTag = team ? `<span class="cpu-tag">Equipo ${team}</span>` : '';
      const stunTag = p.stunned ? '<span class="cpu-tag">😵 aturdido</span>' : '';
      const hillTag = (state.ruleset==='hill') ? `<span class="cpu-tag">⛰️ ${p.hillTurns||0}/${HILL_TARGET}</span>` : '';
      const hunterTag = (state.ruleset==='hunter') ? (p.id===0 ? '<span class="cpu-tag">🏃 fugitivo</span>' : '<span class="cpu-tag">🏹 cazador</span>') : '';
      return `<li class="player-row ${active?'active':''}" style="--pc:${p.color}; --pc-bg:${bg}">
        <span class="row-icon">${smallShapeSVG(p.shape,p.color,22)}</span>
        <span class="player-name">${escapeHtml(p.name)}${cpuTag}${teamTag}${stunTag}${hillTag}${hunterTag}</span>
        <span class="wall-count">${p.wallsLeft} <span class="wall-label">paredes</span></span>
      </li>`;
    }).join('');
  }

  // ---------- win overlay ----------
  function showWinOverlay(p, team){
    if(state.resultTag==='huntersWin'){
      winTitle.textContent = '¡Atraparon al fugitivo!';
      winTitle.style.color = state.winner.color;
      winCard.style.setProperty('--wc', state.winner.color);
      const msgEl = winCard.querySelector('p');
      if(msgEl) msgEl.textContent = 'Se acabaron los turnos y el fugitivo no llegó al centro.';
    } else if(state.isDaily){
      const par = state.dailyPar;
      const used = state.moveCount;
      winTitle.textContent = '¡Desafío diario resuelto!';
      winTitle.style.color = p.color;
      winCard.style.setProperty('--wc', p.color);
      const msgEl = winCard.querySelector('p');
      if(msgEl) msgEl.textContent = `Lo resolviste en ${used} movimiento${used===1?'':'s'} (par: ${par}). ${used<=par ? '¡Igualaste o mejoraste el par!' : 'Volvé mañana por un nuevo tablero.'}`;
    } else if(state.ruleset==='hunter'){
      winTitle.textContent = `¡${p.name} escapó!`;
      winTitle.style.color = p.color;
      winCard.style.setProperty('--wc', p.color);
      const msgEl = winCard.querySelector('p');
      if(msgEl) msgEl.textContent = 'El fugitivo llegó al centro antes de que lo atraparan.';
    } else if(state.ruleset==='hill'){
      winTitle.textContent = `¡${p.name} ganó!`;
      winTitle.style.color = p.color;
      winCard.style.setProperty('--wc', p.color);
      const msgEl = winCard.querySelector('p');
      if(msgEl) msgEl.textContent = `Acumuló ${HILL_TARGET} turnos en la zona central. ¡Rey de la colina!`;
    } else {
      winTitle.textContent = team ? `¡Equipo ${team} ganó!` : `¡${p.name} ganó!`;
      winTitle.style.color = p.color;
      winCard.style.setProperty('--wc', p.color);
      const msgEl = winCard.querySelector('p');
      if(state.campaign){
        if(p.id===0) msgEl.textContent = `¡Ganaste la etapa ${state.campaignLevel}! +${state.campaignXPReward||0} XP. ${campaignProgressText()}`;
        else msgEl.textContent = `${p.name} ganó esta etapa. Podés intentarlo de nuevo cuando quieras.`;
      } else {
        if(msgEl) msgEl.textContent = team ? `${p.name} llegó primero al centro para su equipo.` : 'Podés jugar otra ronda con la misma configuración o cambiar los ajustes.';
      }
    }
    openOverlay('win');
  }
  function hideWinOverlay(){
    closeOverlay('win');
  }

  // ---------- game setup ----------
  function initGame(playersCount, size, options){
    options = options || {};
    invalidateBotTimer();
    clearTurnTimer();
    const mid = (size-1)/2;
    const slots = {
      top:{r:0,c:mid}, right:{r:mid,c:size-1}, bottom:{r:size-1,c:mid}, left:{r:mid,c:0}
    };
    let order;
    if(playersCount===1) order=['top'];
    else if(playersCount===2) order=['top','bottom'];
    else if(playersCount===3) order=['top','right','bottom'];
    else order=['top','right','bottom','left'];

    const ruleset=options.ruleset||'classic', isDaily=!!options.isDaily;
    const customPlayers=Array.isArray(options.playerConfigs)&&options.playerConfigs.length===playersCount?options.playerConfigs:null;
    const wallsEach=isDaily?0:wallsPerPlayer(size,playersCount);
    const names=options.names||loadPlayerNames(),isCpu=!!options.isCpu,difficulty=options.difficulty||'easy';
    const objective=options.objective&&Number.isInteger(options.objective.r)&&Number.isInteger(options.objective.c)?{r:Math.max(0,Math.min(size-1,options.objective.r)),c:Math.max(0,Math.min(size-1,options.objective.c))}:{r:mid,c:mid};

    const players = order.map((slotKey,i)=>{
      const skin = pieceSkins[i] || PALETTE[i];
      const isCPU = isCpu && i===1;
      let walls = wallsEach;
      if(ruleset==='hunter' && !isDaily){
        walls = (i===0) ? Math.max(1, Math.floor(wallsEach/2)) : (wallsEach + 2);
      }
      return {
        id: i,
        name: isCPU ? (options.campaignRival || 'CPU') : ((names[i] && names[i].trim()) ? names[i].trim() : PALETTE[i].name),
        color: skin.color,
        shape: skin.shape,
        r:customPlayers?Math.max(0,Math.min(size-1,+customPlayers[i].r||0)):slots[slotKey].r,
        c:customPlayers?Math.max(0,Math.min(size-1,+customPlayers[i].c||0)):slots[slotKey].c,
        wallsLeft:customPlayers?Math.max(0,+customPlayers[i].walls||0):walls,
        wallsStart:customPlayers?Math.max(0,+customPlayers[i].walls||0):walls,
        isCPU:customPlayers?!!customPlayers[i].isCPU:isCPU,
        difficulty:customPlayers?(customPlayers[i].difficulty||'easy'):difficulty,
        stunned: false,
        hillTurns: 0,
      };
    });

    state = {
      size,
      center:objective,
      objective,
      players,
      currentPlayerIndex: 0,
      occupied: Array.from({length:size-1}, ()=>Array(size-1).fill(null)),
      blockedEdges: new Set(),
      walls: [],
      winner: null,
      validMoves: [],
      isCpuGame:isCpu||!!(customPlayers&&customPlayers.some(p=>p.isCPU)),
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
      isCustomLevel:!!options.isCustomLevel,
      turnTimeSeconds:Math.max(0,+options.turnTimeSeconds||0),
      playerConfigs:customPlayers?customPlayers.map(p=>Object.assign({},p)):null,
    };
    mode = 'move';

    if(Array.isArray(options.presetWalls) && options.presetWalls.length){
      options.presetWalls.forEach(w=> tryPlaceEnvWall(state, w.r, w.c, w.orientation));
      if(options.isCustomLevel) recordCustomLevelPlayed();
    } else if(ruleset==='maze' && !isDaily){
      generateRandomWalls(state, 3 + Math.floor(Math.random()*2), Math.random);
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
  function renderNameInputs(count, isCpu){
    const current = loadPlayerNames();
    for(let i=0;i<4;i++){
      const existing = document.getElementById('nameInput'+i);
      if(existing) current[i] = existing.value;
    }
    let html = '';
    for(let i=0;i<count;i++){
      if(isCpu && i===1){
        html += `<div><span class="cpu-name-badge">🤖 CPU</span></div>`;
        continue;
      }
      const val = escapeHtml(current[i] || PALETTE[i].name);
      html += `<input type="text" class="name-input" id="nameInput${i}" maxlength="16" value="${val}" placeholder="${escapeHtml(PALETTE[i].name)}" aria-label="Nombre del jugador ${i+1}">`;
    }
    namesContainer.innerHTML = html;
  }
  function updateMenuVisibility(){
    const rs = RULESETS[currentRuleset()];
    rulesetHint.textContent = rs ? rs.hint : '';
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
  }
  function refreshCustomLevelSelect(){
    const isMaze = currentRuleset()==='maze';
    customLevelFieldset.classList.toggle('hidden', !isMaze);
    if(!isMaze) return;
    const previous = customLevelSelect.value;
    const list = loadCustomLevels();
    customLevelSelect.innerHTML = '<option value="random">🎲 Paredes al azar</option>' +
      list.map((lvl,i)=> `<option value="${i}">${escapeHtml(lvl.name)} (${lvl.size}×${lvl.size})</option>`).join('');
    customLevelSelect.value = (previous!=='random' && list[+previous]) ? previous : 'random';
  }
  rulesetSelect.addEventListener('change', updateMenuVisibility);
  document.getElementById('modeGroup').addEventListener('change', updateMenuVisibility);
  document.getElementById('playersGroup').addEventListener('change', updateMenuVisibility);

  // ---------- ajustes (tema + sonido) ----------
  function openSettings(){
    const pref = loadThemePref();
    const radioId = pref==='light' ? 'stLight' : (pref==='dark' ? 'stDark' : 'stSystem');
    const radio = document.getElementById(radioId);
    if(radio) radio.checked = true;
    updateSettingsSoundBtn();
    openOverlay('settings');
  }
  settingsThemeGroup.addEventListener('change', e=>{ applyTheme(e.target.value); });
  settingsSoundBtn.addEventListener('click', ()=>{ setMuted(!muted); updateSettingsSoundBtn(); });
  settingsLinkBtn.addEventListener('click', openSettings);
  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', ()=> closeOverlay('settings'));

  // ---------- tutorial ----------
  closeTutorialBtn.addEventListener('click', ()=> closeOverlay('tutorial'));
  helpLinkBtn.addEventListener('click', ()=> openOverlay('tutorial'));

  // ---------- desafío diario ----------
  function generateDailyLayout(dateStr, size){
    const rng = hashStringToSeed('quoridor-daily-'+dateStr+'-'+size);
    const mid = (size-1)/2;
    const tempState = {
      size, center:{ r:mid, c:mid },
      players: [{ r:0, c:mid }],
      occupied: Array.from({length:size-1}, ()=>Array(size-1).fill(null)),
      blockedEdges: new Set(),
      walls: [],
    };
    generateRandomWalls(tempState, 4, rng);
    return tempState.walls.map(w=> ({ r:w.r, c:w.c, orientation:w.orientation }));
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
  function renderDailyOverlay(){
    const today = todayKey();
    const d = statsData.daily;
    const doneToday = d.lastDate === today;
    const bestToday = d.bestMoves ? d.bestMoves[today] : null;
    let html;
    if(doneToday && bestToday!=null){
      html = `<div class="big">✅</div><div class="sub">Ya lo resolviste hoy en ${bestToday} movimiento${bestToday===1?'':'s'}.</div>`;
    } else {
      html = `<div class="big">🗓️</div><div class="sub">Todavía no lo resolviste hoy. El tablero de hoy es el mismo para todos.</div>`;
    }
    html += `<div class="sub" style="margin-top:10px;">Racha actual: ${d.streak||0} día${(d.streak||0)===1?'':'s'} · Mejor racha: ${d.bestStreak||0}</div>`;
    dailyStatusBody.innerHTML = html;
    playDailyBtn.textContent = doneToday ? 'Jugar de nuevo' : 'Jugar';
  }
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
  editorPlayersCount.addEventListener('change',()=>{
    const count=Math.max(2,Math.min(4,+editorPlayersCount.value||2));
    const old=editorState.players||[], next=defaultEditorPlayers(editorState.size,count);
    next.forEach((p,i)=>{if(old[i]) Object.assign(p,old[i]); p.r=Math.max(0,Math.min(editorState.size-1,+p.r||0)); p.c=Math.max(0,Math.min(editorState.size-1,+p.c||0));});
    editorState.players=next; syncEditorControls();
  });
  editorTurnTime.addEventListener('change',()=>editorState.turnTime=+editorTurnTime.value||0);
  editorRuleset.addEventListener('change',()=>editorState.ruleset=editorRuleset.value);
  document.querySelectorAll('input[name="editorObjective"]').forEach(r=>r.addEventListener('change',editorApplyObjective));
  editorObjectiveRow.addEventListener('change',editorApplyObjective);
  editorObjectiveCol.addEventListener('change',editorApplyObjective);
  editorPlayersConfig.addEventListener('change',e=>{
    const el=e.target.closest('[data-player]'); if(!el) return;
    const p=editorState.players[+el.dataset.player]; if(!p) return;
    if(el.dataset.field==='control'){p.isCPU=el.value==='cpu';syncEditorControls();}
    if(el.dataset.field==='difficulty') p.difficulty=el.value;
  });
  editorPlayersConfig.addEventListener('input',e=>{
    const el=e.target.closest('[data-player]'); if(!el) return;
    const p=editorState.players[+el.dataset.player]; if(!p) return;
    const v=+el.value;
    if(el.dataset.field==='r') p.r=Math.max(0,Math.min(editorState.size-1,(v||1)-1));
    if(el.dataset.field==='c') p.c=Math.max(0,Math.min(editorState.size-1,(v||1)-1));
    if(el.dataset.field==='walls') p.walls=Math.max(0,Math.min(50,v||0));
  });
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
    editorState.walls.forEach(w=>wallEdges(w.r,w.c,w.orientation).forEach(e=>blockedSet.add(edgeKey(e[0],e[1],e[2],e[3])));
    for(const p of editorState.players) if(!hasPath(p.r,p.c,obj.r,obj.c,blockedSet,size)) return false;
    if(editorState.ruleset==='teams'&&editorState.players.length!==4) return false;
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
    editorLevelsList.innerHTML = list.map((lvl,i)=> `
      <div class="editor-level-row">
        <span class="lvl-name">${escapeHtml(lvl.name)} (${lvl.size}×${lvl.size})</span>
        <button type="button" data-act="load" data-i="${i}">Cargar</button>
        <button type="button" data-act="play" data-i="${i}">Jugar</button>
        <button type="button" data-act="del" data-i="${i}">Borrar</button>
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
    } else if(btn.dataset.act==='load'){
      editorSizeSelect.value=String(lvl.size);
      editorReset(lvl.size);
      editorState.objective=lvl.objective||editorState.objective;
      editorState.turnTime=+lvl.turnTime||0;
      editorState.ruleset=lvl.ruleset||'classic';
      if(Array.isArray(lvl.players)&&lvl.players.length>=2) editorState.players=lvl.players.slice(0,4);
      lvl.walls.forEach(w=>{editorState.occupied[w.r][w.c]=w.orientation;editorState.walls.push(Object.assign({},w));});
      syncEditorControls();
      editorFeedback.textContent=`Cargaste "${lvl.name}". Podés seguir editando.`;
    } else if(btn.dataset.act==='play'){
      startCustomLevelMatch(lvl);
    }
  });
  function startCustomLevelMatch(lvl){
    const count=Array.isArray(lvl.players)?lvl.players.length:2;
    initGame(count,lvl.size,{presetWalls:lvl.walls||[],isCustomLevel:true,ruleset:lvl.ruleset||'classic',objective:lvl.objective,turnTimeSeconds:+lvl.turnTime||0,playerConfigs:lvl.players});
    editorScreen.classList.add('hidden');menuScreen.classList.add('hidden');gameScreen.classList.remove('hidden');
  }
  editorSizeSelect.addEventListener('change', ()=>{editorReset(+editorSizeSelect.value);syncEditorControls();});
  editorClearBtn.addEventListener('click', ()=>{editorReset(editorState.size);syncEditorControls();editorFeedback.textContent='Tablero limpio.';});
  editorSaveBtn.addEventListener('click', ()=>{
    if(!editorValidate()){ editorFeedback.textContent='El diseño no es válido: revisá las posiciones, el objetivo o los caminos posibles.'; return; }
    levelNameInput.value = 'Mi nivel';
    openOverlay('levelName');
    setTimeout(()=>{ try{ levelNameInput.focus(); levelNameInput.select(); }catch(e){} }, 50);
  });
  function confirmSaveLevel(){
    const name = (levelNameInput.value || '').trim() || 'Mi nivel';
    const list = loadCustomLevels();
    list.push({name:name.slice(0,24),size:editorState.size,objective:Object.assign({},editorState.objective),turnTime:editorState.turnTime||0,ruleset:editorState.ruleset||'classic',players:editorState.players.map(p=>({r:p.r,c:p.c,walls:p.walls,isCPU:!!p.isCPU,difficulty:p.difficulty||'easy'})),walls:editorState.walls.map(w=>({r:w.r,c:w.c,orientation:w.orientation}))});
    saveCustomLevels(list);
    renderEditorLevelsList();
    editorFeedback.textContent = 'Nivel guardado.';
    closeOverlay('levelName');
  }
  levelNameSaveBtn.addEventListener('click', confirmSaveLevel);
  levelNameCancelBtn.addEventListener('click', ()=> closeOverlay('levelName'));
  levelNameInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); confirmSaveLevel(); } });
  editorPlayBtn.addEventListener('click', ()=>{
    if(editorState.walls.length && !editorValidate()){
      editorFeedback.textContent='Este diseño deja a algún jugador sin camino posible al centro. Ajustalo antes de jugar.';
      return;
    }
    startCustomLevelMatch({ size: editorState.size, walls: editorState.walls });
  });
  editorLinkBtn.addEventListener('click', ()=>{
    editorReset(9);
    syncEditorControls();
    renderEditorLevelsList();
    menuScreen.classList.add('hidden');
    editorScreen.classList.remove('hidden');
  });
  editorBackBtn.addEventListener('click', ()=>{
    editorScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    refreshCustomLevelSelect();
  });

  // ---------- menú & navegación ----------
  function goToMenu(){
    invalidateBotTimer();
    clearTurnTimer();
    hideWinOverlay();
    gameScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
  }
  function doRestart(){
    if(!state) return;
    if(state.isDaily){ hideWinOverlay(); initDailyChallenge(); return; }
    const cfg = {
      isCpu: !!state.isCpuGame,
      difficulty: (state.players[1] && state.players[1].difficulty) || 'easy',
      names: loadPlayerNames(),
      ruleset: state.ruleset,
      campaign: state.campaign,
      campaignLevel: state.campaignLevel,
      campaignRival: state.campaignRival,
      campaignPersonality:state.campaignPersonality,presetWalls:state.presetWalls,isCustomLevel:state.isCustomLevel,
      objective:state.objective,turnTimeSeconds:state.turnTimeSeconds,playerConfigs:state.playerConfigs,
    };
    const playersCount = state.players.length;
    const size = state.size;
    hideWinOverlay();
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
    saveLastSetup({ playersCount, size: +document.querySelector('input[name="size"]:checked').value, mode:m, difficulty, ruleset });

    initGame(playersCount, size, { isCpu, difficulty, names, ruleset, presetWalls, isCustomLevel });
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

  playAgainBtn.addEventListener('click', doRestart);
  changeConfigBtn.addEventListener('click', goToMenu);

  // ---------- botón físico "atrás" de Android (ver MainActivity.java) ----------
  window.QuoridorHandleBack = function(){
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
  updateSettingsSoundBtn();
  updateReminderUI();

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
    if(cfg.difficulty){
      const dr = document.getElementById('diff'+cfg.difficulty.charAt(0).toUpperCase()+cfg.difficulty.slice(1));
      if(dr) dr.checked = true;
    }
    if(cfg.size){
      const sr = document.getElementById('s'+cfg.size); if(sr) sr.checked = true;
    }
    if(cfg.ruleset && RULESETS[cfg.ruleset]){
      rulesetSelect.value = cfg.ruleset;
    }
  })();

  updateMenuVisibility();

  let tutorialSeen = false;
  try{ tutorialSeen = localStorage.getItem('quoridor_tutorial_seen')==='1'; }catch(e){}
  if(!tutorialSeen) openOverlay('tutorial');

})();
