import { useState, useEffect, useRef, useCallback } from "react";

/* ── Palette ─────────────────────────────────────────────── */
const XC="#e11d48",OC="#0284c7",GOLD="#d97706";
const XG="linear-gradient(135deg,#e11d48,#f43f5e)";
const OG="linear-gradient(135deg,#0284c7,#38bdf8)";

const THEMES={
  light:{BG:"#fafaf9",CARD:"#ffffff",INK:"#0c0a09",MUTE:"#78716c",BORDER:"#e7e5e4",
         INPUT:"#ffffff",CHIP:T().CHIP,CHIP2:T().CHIP2,RULE:"#f9f9f8"},
  dark: {BG:"#0f0f11",CARD:"#1c1c1f",INK:"#f4f4f5",MUTE:"#a1a1aa",BORDER:"#2e2e33",
         INPUT:"#27272a",CHIP:"#27272a",CHIP2:"#1c1c1f",RULE:"#18181b"},
};

// Global theme ref (updated via useTheme hook)
let _theme=THEMES.light;
const T=()=>_theme;

const colOf=p=>p==="X"?XC:OC;
const gradOf=p=>p==="X"?XG:OG;
const oppOf=p=>p==="X"?"O":"X";
// symOf is a function that gets called from App with profiles: use via closure
let _symOf=(p)=>p; // default passthrough, overridden in App

/* ── Player symbols ───────────────────────────────────────── */
const SYMBOLS=[
  {id:"X",  label:"✕",  display:"X"},
  {id:"O",  label:"○",  display:"O"},
  {id:"★",  label:"★",  display:"★"},
  {id:"♦",  label:"♦",  display:"♦"},
  {id:"▲",  label:"▲",  display:"▲"},
  {id:"⬟",  label:"⬟",  display:"⬟"},
  {id:"●",  label:"●",  display:"●"},
  {id:"♠",  label:"♠",  display:"♠"},
];

// Default symbol pairs (first player picks, second gets the opposite)
const DEFAULT_SYMBOLS={X:"X",O:"O"};

/* ── Theme hook ──────────────────────────────────────────── */
function useTheme(dark){
  useEffect(()=>{
    _theme=dark?THEMES.dark:THEMES.light;
  },[dark]);
  return dark?THEMES.dark:THEMES.light;
}

/* ── Storage ─────────────────────────────────────────────── */
const store={
  async get(k){try{const r=await window.storage.get(k);return r?JSON.parse(r.value):null;}catch{return null;}},
  async set(k,v){try{await window.storage.set(k,JSON.stringify(v));}catch{}},
};
const defProfile=(name,emoji,sym='X')=>({name,emoji,symbol:sym,points:0,wins:0,losses:0,draws:0,streak:0,bestStreak:0,totalGames:0,wonRounds:0});

/* ── Points ──────────────────────────────────────────────── */
function calcPoints({win,draw,moves,blitzLeft,blitzTime,streak,gridSize,difficulty,vsAI}){
  if(draw)return{total:15,breakdown:[{label:"Match nul",pts:15}]};
  if(!win)return{total:0,breakdown:[]};
  const base=gridSize===4?150:100;
  const bd=[{label:"Victoire",pts:base}];let total=base;
  if(blitzTime>0&&blitzLeft>blitzTime*0.5){const b=40;total+=b;bd.push({label:"⚡ Rapide",pts:b});}
  const maxM=gridSize===4?20:9;
  if(moves<=maxM*0.6){const b=30;total+=b;bd.push({label:"🎯 Efficace",pts:b});}
  if(streak>0){const b=Math.min(streak*20,100);total+=b;bd.push({label:`🔥 Série ×${streak}`,pts:b});}
  if(vsAI){const mult={beginner:0.5,easy:0.8,medium:1,hard:1.3,expert:1.6,legend:2}[difficulty]||1;if(mult!==1){const bonus=Math.round(total*(mult-1));total+=bonus;bd.push({label:`🤖 Difficulté ×${mult}`,pts:bonus});}}
  return{total:Math.round(total),breakdown:bd};
}
function calcLossPenalty(d){return{beginner:0,easy:0,medium:10,hard:20,expert:35,legend:50}[d]||0;}
const RANKS=[{min:0,label:"Novice",emoji:"🥉"},{min:200,label:"Amateur",emoji:"🥈"},{min:600,label:"Compétiteur",emoji:"🥇"},{min:1200,label:"Expert",emoji:"🏅"},{min:2500,label:"Maître",emoji:"🏆"},{min:5000,label:"Légendaire",emoji:"👑"}];
const getRank=pts=>RANKS.slice().reverse().find(r=>pts>=r.min)||RANKS[0];

/* ── Game logic ──────────────────────────────────────────── */
function makeLines(size,wl){
  const L=[];
  for(let r=0;r<size;r++)for(let c=0;c<=size-wl;c++)L.push(Array.from({length:wl},(_,k)=>r*size+c+k));
  for(let c=0;c<size;c++)for(let r=0;r<=size-wl;r++)L.push(Array.from({length:wl},(_,k)=>(r+k)*size+c));
  for(let r=0;r<=size-wl;r++)for(let c=0;c<=size-wl;c++)L.push(Array.from({length:wl},(_,k)=>(r+k)*size+c+k));
  for(let r=wl-1;r<size;r++)for(let c=0;c<=size-wl;c++)L.push(Array.from({length:wl},(_,k)=>(r-k)*size+c+k));
  return L;
}
function makeRot(size){return Array.from({length:size*size},(_,i)=>(i%size)*size+(size-1-Math.floor(i/size)));}
function getWinner(sq,lines){for(const l of lines)if(l.every(i=>sq[i]&&sq[i]===sq[l[0]]))return{w:sq[l[0]],line:l};return null;}

/* applyMove — returns {squares,xQueue,oQueue,needsChoice}
   needsChoice = true when vanish is triggered and player must pick which piece to remove */
function applyMove(sq,xQ,oQ,idx,player,vanish,max,chosenRemove=null){
  const nSq=[...sq],nXQ=[...xQ],nOQ=[...oQ];
  nSq[idx]=player;let removed=null,needsChoice=false;
  if(vanish){
    if(player==="X"){
      nXQ.push(idx);
      if(nXQ.length>max){
        if(chosenRemove!==null&&chosenRemove!==idx){removed=chosenRemove;nXQ.splice(nXQ.indexOf(chosenRemove),1);nSq[removed]=null;}
        else if(chosenRemove===null){needsChoice=true;} // player must choose
        else{nXQ.shift();} // edge case: chose the newly placed piece, skip
      }
    }else{
      nOQ.push(idx);
      if(nOQ.length>max){
        if(chosenRemove!==null&&chosenRemove!==idx){removed=chosenRemove;nOQ.splice(nOQ.indexOf(chosenRemove),1);nSq[removed]=null;}
        else if(chosenRemove===null){needsChoice=true;}
        else{nOQ.shift();}
      }
    }
  }else{if(player==="X")nXQ.push(idx);else nOQ.push(idx);}
  return{squares:nSq,xQueue:nXQ,oQueue:nOQ,removed,needsChoice};
}

/* applyMoveAI — always removes oldest (no choice for AI) */
function applyMoveAI(sq,xQ,oQ,idx,player,vanish,max){
  const nSq=[...sq],nXQ=[...xQ],nOQ=[...oQ];
  nSq[idx]=player;let removed=null;
  if(vanish){
    if(player==="X"){nXQ.push(idx);if(nXQ.length>max){const c=nXQ[0];if(c!==idx){removed=nXQ.shift();nSq[removed]=null;}else nXQ.shift();}}
    else{nOQ.push(idx);if(nOQ.length>max){const c=nOQ[0];if(c!==idx){removed=nOQ.shift();nSq[removed]=null;}else nOQ.shift();}}
  }else{if(player==="X")nXQ.push(idx);else nOQ.push(idx);}
  return{squares:nSq,xQueue:nXQ,oQueue:nOQ,removed};
}

function applyMoveSimple(sq,xQ,oQ,idx,player,vanish,max){
  const nSq=[...sq],nXQ=[...xQ],nOQ=[...oQ];
  nSq[idx]=player;
  if(vanish){
    if(player==="X"){nXQ.push(idx);if(nXQ.length>max){const c=nXQ[0];if(c!==idx){nXQ.shift();nSq[c]=null;}else nXQ.shift();}}
    else{nOQ.push(idx);if(nOQ.length>max){const c=nOQ[0];if(c!==idx){nOQ.shift();nSq[c]=null;}else nOQ.shift();}}
  }else{if(player==="X")nXQ.push(idx);else nOQ.push(idx);}
  return{squares:nSq,xQueue:nXQ,oQueue:nOQ};
}

function rotateSq(sq,rot,shielded={}){
  const n=Array(sq.length).fill(null);
  // Pass 1: move non-shielded pieces first
  sq.forEach((v,i)=>{if(v&&!shielded[i]){n[rot[i]]=v;}});
  // Pass 2: place shielded pieces last — they always win collisions
  sq.forEach((v,i)=>{if(v&&shielded[i]){n[i]=v;}});
  return n;
}

/* ── AI ──────────────────────────────────────────────────── */
function heuristic(sq,lines,player){
  const opp=oppOf(player);let score=0;
  for(const l of lines){const cells=l.map(i=>sq[i]);const me=cells.filter(c=>c===player).length,them=cells.filter(c=>c===opp).length;if(me>0&&them===0)score+=me===l.length-1?50:me*me;if(them>0&&me===0)score-=them===l.length-1?50:them*them;}
  return score;
}
function minimax(sq,xQ,oQ,isMax,d,a,b,van,max,maxD,lines){
  const r=getWinner(sq,lines);if(r)return r.w==="O"?100-d:d-100;
  const av=sq.reduce((acc,v,i)=>v===null?[...acc,i]:acc,[]);
  if(!av.length||d>=maxD)return heuristic(sq,lines,"O");
  if(isMax){let best=-Infinity;for(const i of av){const{squares:ns,xQueue:nx,oQueue:no}=applyMoveSimple(sq,xQ,oQ,i,"O",van,max);best=Math.max(best,minimax(ns,nx,no,false,d+1,a,b,van,max,maxD,lines));a=Math.max(a,best);if(b<=a)break;}return best;}
  else{let best=Infinity;for(const i of av){const{squares:ns,xQueue:nx,oQueue:no}=applyMoveSimple(sq,xQ,oQ,i,"X",van,max);best=Math.min(best,minimax(ns,nx,no,true,d+1,a,b,van,max,maxD,lines));b=Math.min(b,best);if(b<=a)break;}return best;}
}

/* AI also evaluates using bomb (capture) if available */
function getBestMove(sq,xQ,oQ,van,max,level,lines,size,bombAvail,shielded){
  const av=sq.reduce((a,v,i)=>v===null?[...a,i]:a,[]);
  if(!av.length)return{idx:-1,useBomb:false};
  if(level==="beginner")return{idx:av[Math.floor(Math.random()*av.length)],useBomb:false};
  // Check instant win
  for(const i of av){const{squares:ns}=applyMoveSimple(sq,xQ,oQ,i,"O",van,max);if(getWinner(ns,lines)?.w==="O")return{idx:i,useBomb:false};}
  // Check if bomb-capture can win immediately
  if(bombAvail){
    const enemies=sq.reduce((a,v,i)=>v==="X"&&!shielded[i]?[...a,i]:a,[]);
    for(const ei of enemies){const ns=[...sq];ns[ei]="O";if(getWinner(ns,lines)?.w==="O")return{idx:ei,useBomb:true};}
  }
  // Block human win
  for(const i of av){const{squares:ns}=applyMoveSimple(sq,xQ,oQ,i,"X",van,max);if(getWinner(ns,lines)?.w==="X")return{idx:i,useBomb:false};}
  if(level==="easy")return{idx:av[Math.floor(Math.random()*av.length)],useBomb:false};
  if(level==="medium"){if(Math.random()<0.4)return{idx:av[Math.floor(Math.random()*av.length)],useBomb:false};const mid=Math.floor(size/2);const s=[...av].sort((a,b)=>(Math.abs(Math.floor(a/size)-mid)+Math.abs(a%size-mid))-(Math.abs(Math.floor(b/size)-mid)+Math.abs(b%size-mid)));return{idx:s[0],useBomb:false};}
  const maxD={hard:size===4?4:6,expert:size===4?5:10,legend:size===4?7:12}[level]||6;
  const sorted=[...av].sort((a,b)=>{const mid=(size-1)/2;return(Math.abs(Math.floor(a/size)-mid)+Math.abs(a%size-mid))-(Math.abs(Math.floor(b/size)-mid)+Math.abs(b%size-mid));});
  let best=-Infinity,bm=sorted[0],useBomb=false;
  for(const i of sorted){const{squares:ns,xQueue:nx,oQueue:no}=applyMoveSimple(sq,xQ,oQ,i,"O",van,max);const s=minimax(ns,nx,no,false,0,-Infinity,Infinity,van,max,maxD,lines);if(s>best){best=s;bm=i;}}
  // Consider bomb if score is low and bomb would significantly help
  if(bombAvail&&best<3){
    const enemies=sq.reduce((a,v,i)=>v==="X"&&!shielded[i]?[...a,i]:a,[]);
    for(const ei of enemies){const ns=[...sq];ns[ei]="O";const s=heuristic(ns,lines,"O");if(s>best+20){best=s;bm=ei;useBomb=true;break;}}
  }
  return{idx:bm,useBomb};
}

/* ── Sound ───────────────────────────────────────────────── */
function useSfx(on){
  const ac=useRef(null);
  const ctx=()=>{if(!ac.current)ac.current=new(window.AudioContext||window.webkitAudioContext)();return ac.current;};
  const tone=useCallback((f,type="sine",d=0.1,v=0.1,delay=0)=>{
    if(!on)return;
    try{const c=ctx(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=type;o.frequency.setValueAtTime(f,c.currentTime+delay);g.gain.setValueAtTime(v,c.currentTime+delay);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+delay+d);o.start(c.currentTime+delay);o.stop(c.currentTime+delay+d);}catch(e){}
  },[on]);
  return{
    click:x=>tone(x?520:380,"triangle",0.08,0.1),
    win:()=>[523,659,784,1047].forEach((f,i)=>tone(f,"sine",0.22,0.15,i*0.1)),
    draw:()=>[330,294,262].forEach((f,i)=>tone(f,"sawtooth",0.16,0.09,i*0.1)),
    vanish:()=>tone(200,"sawtooth",0.11,0.07),
    cd:()=>tone(880,"sine",0.07,0.07),go:()=>[523,784].forEach((f,i)=>tone(f,"sine",0.16,0.15,i*0.08)),
    undo:()=>tone(240,"triangle",0.07,0.07),tap:()=>tone(700,"sine",0.05,0.05),
    urgent:()=>tone(460,"sawtooth",0.07,0.09),
    timeout:()=>[240,200,160].forEach((f,i)=>tone(f,"sawtooth",0.16,0.1,i*0.09)),
    bomb:()=>[200,150].forEach((f,i)=>tone(f,"sawtooth",0.18,0.15,i*0.08)),
    shield:()=>tone(660,"sine",0.18,0.12),
    rotate:()=>[440,550,440].forEach((f,i)=>tone(f,"sine",0.11,0.09,i*0.08)),
    swap:()=>[330,440,550,660].forEach((f,i)=>tone(f,"sine",0.12,0.1,i*0.06)),
    points:()=>[523,659,784].forEach((f,i)=>tone(f,"sine",0.1,0.1,i*0.07)),
    choose:()=>tone(440,"triangle",0.08,0.08),
  };
}

/* ── Confetti ────────────────────────────────────────────── */
function Confetti({active}){
  const pts=useRef(Array.from({length:55},(_,i)=>({id:i,sx:10+Math.random()*80,vx:(Math.random()-0.5)*6,vy:-(4+Math.random()*8),col:[XC,"#f43f5e",OC,"#38bdf8",GOLD,"#a78bfa","#34d399"][i%7],w:5+Math.random()*8,h:3+Math.random()*5,rot:Math.random()*360,rv:(Math.random()-0.5)*20})));
  const[st,setSt]=useState([]);const raf=useRef();
  useEffect(()=>{if(!active){setSt([]);return;}let s=pts.current.map(p=>({...p,x:p.sx,y:50,op:1})),tick=0;const run=()=>{tick++;s=s.map(p=>({...p,x:p.x+p.vx*0.4,y:p.y+p.vy+tick*0.1,vy:p.vy+0.2,rot:p.rot+p.rv,op:Math.max(0,1-tick/78)}));setSt([...s]);if(tick<78)raf.current=requestAnimationFrame(run);};raf.current=requestAnimationFrame(run);return()=>cancelAnimationFrame(raf.current);},[active]);
  return(<div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:200,overflow:"hidden"}}>{st.map(p=><div key={p.id} style={{position:"absolute",left:`${p.x}%`,top:`${p.y}%`,width:p.w,height:p.h,background:p.col,opacity:p.op,transform:`rotate(${p.rot}deg)`,borderRadius:"2px"}}/>)}</div>);
}

function Toast({message,color}){if(!message)return null;return(<div style={{position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",background:T().CARD,border:`1.5px solid ${color||T().BORDER}`,borderRadius:"24px",padding:"10px 20px",zIndex:190,boxShadow:`0 4px 20px ${color||"#000"}22`,animation:"toastIn .3s cubic-bezier(.34,1.56,.64,1)",display:"flex",alignItems:"center",gap:"8px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:"14px",color:color||T().INK,whiteSpace:"nowrap",pointerEvents:"none"}}>{message}</div>);}

/* ── Vanish choice modal ─────────────────────────────────── */
function VanishChoiceModal({squares,queue,player,shielded,onChoose,sfx}){
  const th=T();
  const col=colOf(player);
  const choices=queue.filter(i=>!shielded[i]);
  return(
    <div style={{position:"fixed",inset:0,background:T().BG==="#0f0f11"?"rgba(0,0,0,0.82)":"rgba(12,10,9,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:160,padding:"20px",backdropFilter:"blur(8px)",animation:"fadeIn .15s ease"}}>
      <div style={{background:T().CARD,borderRadius:"20px",padding:"24px 20px",width:"100%",maxWidth:"320px",boxShadow:"0 20px 60px rgba(0,0,0,0.18)",animation:"slideUp .25s cubic-bezier(.34,1.56,.64,1)"}}>
        <div style={{textAlign:"center",marginBottom:"16px"}}>
          <div style={{fontSize:"28px",marginBottom:"6px"}}>💀</div>
          <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:"16px",color:INK}}>Quelle pièce sacrifier ?</div>
          <div style={{fontSize:"12px",color:T().MUTE,marginTop:"4px"}}>Vous avez trop de pièces — choisissez laquelle disparaît</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          {choices.map((idx,n)=>(
            <button key={idx} onClick={()=>{sfx.choose();onChoose(idx);}} style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:"12px",background:n===0?"#fff1f2":"#f9f9f8",border:`1.5px solid ${n===0?XC+"44":BORDER}`,borderRadius:"12px",cursor:"pointer",transition:"all .15s",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
              <div style={{width:"32px",height:"32px",borderRadius:"8px",background:`${col}12`,border:`1.5px solid ${col}30`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"16px",color:col}}>{squares[idx]}</span>
              </div>
              <div style={{flex:1,textAlign:"left"}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,fontSize:"13px",color:INK}}>Case {idx+1}</span>
                  {n===0&&<span style={{fontSize:"10px",fontWeight:700,padding:"1px 6px",borderRadius:"6px",background:"#fee2e2",color:XC}}>Plus ancienne</span>}
                </div>
                <div style={{fontSize:"11px",color:MUTE}}>Position {n+1} dans la file</div>
              </div>
              <span style={{fontSize:"14px",color:MUTE}}>Sacrifier →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Points overlay ──────────────────────────────────────── */
function PointsOverlay({data,onClose}){
  if(!data)return null;
  return(
    <div style={{position:"fixed",inset:0,background:T().BG==="#0f0f11"?"rgba(0,0,0,0.75)":"rgba(12,10,9,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:160,padding:"20px",backdropFilter:"blur(8px)",animation:"fadeIn .2s ease"}} onClick={onClose}>
      <div style={{background:T().CARD,borderRadius:"20px",padding:"28px",width:"100%",maxWidth:"300px",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",animation:"slideUp .3s cubic-bezier(.34,1.56,.64,1)",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:"40px",marginBottom:"8px"}}>{data.isLoss?"😤":"🎉"}</div>
        <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"42px",color:data.isLoss?XC:GOLD,lineHeight:1,marginBottom:"4px"}}>{data.isLoss?data.total:`+${data.total}`}</div>
        <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,fontSize:"14px",color:T().MUTE,marginBottom:"16px"}}>{data.isLoss?"points perdus":"points gagnés !"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:"6px",marginBottom:"20px"}}>
          {data.breakdown.map((b,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 12px",background:T().RULE,borderRadius:"8px"}}>
              <span style={{fontSize:"13px",color:INK}}>{b.label}</span>
              <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:"13px",color:b.pts<0?XC:GOLD}}>{b.pts>0?"+":""}{b.pts}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{width:"100%",padding:"13px",fontSize:"14px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,background:XG,border:"none",color:"#fff",cursor:"pointer",borderRadius:"12px",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>Super !</button>
      </div>
    </div>
  );
}

/* ── Win Modal ───────────────────────────────────────────── */
function WinModal({winner,name,color,grad,subtext,onNext,onMenu,bestOf,seriesX,seriesO,drawsDontCount}){
  const th=T();
  const target=bestOf?Math.ceil(bestOf/2):0;
  const seriesWon=bestOf&&(seriesX>=target||seriesO>=target);
  return(<div style={{position:"fixed",inset:0,background:th.BG===""#0f0f11""?"rgba(0,0,0,0.8)":"rgba(12,10,9,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:150,padding:"20px",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",animation:"fadeIn .2s ease"}}><div style={{background:T().CARD,borderRadius:"24px",padding:"32px 28px",width:"100%",maxWidth:"320px",boxShadow:"0 24px 64px rgba(12,10,9,0.18),0 0 0 1px rgba(12,10,9,0.05)",animation:"slideUp .3s cubic-bezier(.34,1.56,.64,1)"}}><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"16px"}}><div style={{width:"68px",height:"68px",borderRadius:"50%",background:winner==="="?"#fef3c7":`${color}12`,border:`2px solid ${winner==="="?GOLD:color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"32px",animation:"bounceIn .4s cubic-bezier(.34,1.56,.64,1)"}}>{winner==="="?"🤝":seriesWon?"👑":"🏆"}</div>{winner!=="="&&<div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"72px",lineHeight:1,color}}>{winner}</div>}<div style={{textAlign:"center"}}><div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:"20px",color:T().INK,marginBottom:"4px"}}>{name}</div><div style={{fontSize:"13px",color:MUTE}}>{subtext}</div></div>{bestOf>0&&<div style={{display:"flex",gap:"10px",alignItems:"center",padding:"10px 16px",background:T().CHIP,borderRadius:"12px",flexDirection:"column",width:"100%"}}><div style={{display:"flex",gap:"14px",alignItems:"center"}}><span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"24px",color:XC}}>{seriesX}</span><span style={{fontSize:"11px",color:MUTE}}>objectif {target}</span><span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"24px",color:OC}}>{seriesO}</span></div>{drawsDontCount&&<span style={{fontSize:"10px",color:MUTE}}>Les nuls ne comptent pas</span>}</div>}<div style={{display:"flex",gap:"10px",width:"100%",marginTop:"4px"}}><button onClick={onNext} style={{flex:2,padding:"15px",fontSize:"15px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,background:seriesWon?`linear-gradient(135deg,${GOLD},#f59e0b)`:grad,border:"none",color:"#fff",cursor:"pointer",borderRadius:"14px",boxShadow:`0 4px 16px ${color}33`,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>{seriesWon?"Revanche ↺":"Suite →"}</button><button onClick={onMenu} style={{flex:1,padding:"15px",fontSize:"15px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,background:"transparent",border:`1.5px solid ${T().BORDER}`,color:T().MUTE,cursor:"pointer",borderRadius:"14px",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>Menu</button></div></div></div></div>);
}

/* ── Countdown ───────────────────────────────────────────── */
function Countdown({onDone,sfx}){const[n,setN]=useState(3);useEffect(()=>{sfx.cd();const iv=setInterval(()=>{setN(p=>{if(p<=1){clearInterval(iv);setTimeout(()=>{sfx.go();onDone();},360);return 0;}sfx.cd();return p-1;});},700);return()=>clearInterval(iv);},[]);return(<div style={{position:"fixed",inset:0,background:T().BG==='#0f0f11'?'rgba(15,15,17,0.97)':'rgba(250,250,249,0.96)',display:"flex",alignItems:"center",justifyContent:"center",zIndex:180,flexDirection:"column",gap:"10px",backdropFilter:"blur(8px)"}}><div style={{fontSize:"12px",color:T().MUTE,letterSpacing:"4px",textTransform:"uppercase"}}>Prêts ?</div><div key={n} style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"clamp(90px,28vw,150px)",lineHeight:1,color:n===0?OC:XC,animation:"countPop .3s cubic-bezier(.34,1.56,.64,1)"}}>{n===0?"GO!":n}</div></div>);}

/* ── Small UI ────────────────────────────────────────────── */
function Toggle({value,onChange,color}){return(<div onClick={onChange} style={{width:"42px",height:"24px",borderRadius:"12px",background:value?(color||XC):BORDER,transition:"background .2s",position:"relative",flexShrink:0,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}><div style={{position:"absolute",top:"3px",left:value?"21px":"3px",width:"18px",height:"18px",borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/></div>);}

function Stepper({value,min,max,onChange,label,unit,color}){const c=color||XC;return(<div style={{display:"flex",alignItems:"center",gap:"8px",justifyContent:"space-between",width:"100%"}}><span style={{fontSize:"13px",color:T().MUTE,flex:1}}>{label}</span><div style={{display:"flex",alignItems:"center",gap:"8px"}}><button onClick={()=>onChange(Math.max(min,value-1))} style={{width:"30px",height:"30px",borderRadius:"8px",background:T().CHIP,border:`1px solid ${T().BORDER}`,color:T().INK,fontSize:"17px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>−</button><span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:"16px",color:c,minWidth:"38px",textAlign:"center"}}>{value}{unit}</span><button onClick={()=>onChange(Math.min(max,value+1))} style={{width:"30px",height:"30px",borderRadius:"8px",background:T().CHIP,border:`1px solid ${T().BORDER}`,color:T().INK,fontSize:"17px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>+</button></div></div>);}

function RuleCard({icon,title,sub,color,active,onToggle,children,badge}){const c=color||XC;return(<div style={{background:active?`${c}06`:"#f9f9f8",border:`1.5px solid ${active?c+"40":BORDER}`,borderRadius:"14px",overflow:"hidden",transition:"all .2s"}}><div style={{display:"flex",alignItems:"center",gap:"12px",padding:"14px 16px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}} onClick={onToggle}><div style={{width:"38px",height:"38px",borderRadius:"10px",background:active?`${c}15`:T().CHIP2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0,transition:"background .2s"}}>{icon}</div><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:"6px"}}><div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,fontSize:"15px",color:active?c:INK,transition:"color .2s"}}>{title}</div>{badge&&<span style={{fontSize:"10px",fontWeight:700,padding:"1px 6px",borderRadius:"6px",background:`${c}15`,color:c}}>{badge}</span>}</div><div style={{fontSize:"12px",color:T().MUTE,marginTop:"1px"}}>{sub}</div></div><Toggle value={active} onChange={()=>{}} color={c}/></div>{active&&children&&<div style={{padding:"0 16px 14px 66px",display:"flex",flexDirection:"column",gap:"8px"}}>{children}</div>}</div>);}

function PowerPill({icon,label,active,color,onPress,charges}){
  if(charges<=0)return null;const c=color||XC;
  return(<button onClick={onPress} style={{display:"flex",alignItems:"center",gap:"6px",padding:"8px 14px",borderRadius:"20px",cursor:"pointer",background:active?`${c}12`:CARD,border:`1.5px solid ${active?c:BORDER}`,transition:"all .15s",boxShadow:active?`0 0 0 3px ${c}18`:"0 1px 3px rgba(0,0,0,0.06)",position:"relative",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
    <span style={{fontSize:"15px",lineHeight:1}}>{icon}</span>
    <span style={{fontSize:"12px",fontWeight:600,color:active?c:MUTE}}>{label}</span>
    {charges>1&&<span style={{position:"absolute",top:"-5px",right:"-5px",width:"16px",height:"16px",borderRadius:"50%",background:c,color:"#fff",fontSize:"9px",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{charges}</span>}
  </button>);
}

/* ── Profile Card ────────────────────────────────────────── */
const EMOJIS=["😀","😎","🦊","🐯","🦁","🐸","🤖","👾","🎮","🏆","⚡","🔥","💀","🌟","🎯","🦄"];
function ProfileCard({profile,color,onEdit,showStats}){
  const rank=getRank(profile.points);
  return(<div style={{background:T().CARD,borderRadius:"16px",padding:"14px 16px",border:`1.5px solid ${color}22`,boxShadow:`0 2px 12px ${color}14`}}><div style={{display:"flex",alignItems:"center",gap:"12px"}}><div style={{width:"44px",height:"44px",borderRadius:"50%",background:`${color}15`,border:`2px solid ${color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"22px",flexShrink:0}}>{profile.emoji}</div><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"2px"}}><span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:"15px",color:INK}}>{profile.name}</span><span style={{fontSize:"12px"}}>{rank.emoji}</span>{profile.streak>1&&<span style={{fontSize:"11px",fontWeight:700,color:"#f97316",background:"#fff7ed",padding:"1px 6px",borderRadius:"6px"}}>🔥{profile.streak}</span>}</div><div style={{display:"flex",gap:"6px",alignItems:"center"}}><span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:"14px",color:GOLD}}>{profile.points}</span><span style={{fontSize:"11px",color:MUTE}}>pts · {rank.label}</span></div></div>{onEdit&&<button onClick={onEdit} style={{padding:"6px 12px",fontSize:"12px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,background:T().CHIP,border:`1px solid ${T().BORDER}`,color:T().MUTE,cursor:"pointer",borderRadius:"8px",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>✎</button>}</div>{showStats&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px",marginTop:"12px"}}>{[{l:"Victoires",v:profile.wins,c:"#22c55e"},{l:"Défaites",v:profile.losses,c:XC},{l:"Nuls",v:profile.draws,c:GOLD}].map(s=><div key={s.l} style={{background:T().RULE,borderRadius:"8px",padding:"8px",textAlign:"center"}}><div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"18px",color:s.c}}>{s.v}</div><div style={{fontSize:"10px",color:T().MUTE,marginTop:"1px"}}>{s.l}</div></div>)}</div>}</div>);
}

function ProfileEditor({initial,onSave,onBack,playerSlot}){
  const[name,setName]=useState(initial.name);const[emoji,setEmoji]=useState(initial.emoji);const[symbol,setSymbol]=useState(initial.symbol||"X");
  return(<div style={{background:T().BG,minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}><div style={{background:T().CARD,borderRadius:"20px",padding:"28px 24px",width:"100%",maxWidth:"360px",boxShadow:"0 8px 40px rgba(0,0,0,0.1)"}}><button onClick={onBack} style={{marginBottom:"16px",fontSize:"13px",color:T().MUTE,background:"none",border:"none",cursor:"pointer",padding:0}}>← Retour</button><div style={{display:"flex",flexDirection:"column",gap:"16px"}}><div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:"18px",color:T().INK,textAlign:"center"}}>Modifier le profil</div><div><div style={{fontSize:"12px",color:T().MUTE,marginBottom:"6px"}}>Pseudo</div><input value={name} onChange={e=>setName(e.target.value.slice(0,16))} placeholder="Votre pseudo..." style={{width:"100%",padding:"12px 14px",fontSize:"15px",fontFamily:"'Plus Jakarta Sans',sans-serif",border:`1.5px solid ${T().BORDER}`,borderRadius:"12px",outline:"none",color:T().INK,background:T().BG,boxSizing:"border-box"}}/></div><div><div style={{fontSize:"12px",color:T().MUTE,marginBottom:"8px"}}>Avatar</div><div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:"6px"}}>{EMOJIS.map(e=><button key={e} onClick={()=>setEmoji(e)} style={{aspectRatio:"1",fontSize:"20px",background:emoji===e?T().CHIP:T().BG,border:`1.5px solid ${emoji===e?T().INK:T().BORDER}`,borderRadius:"8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>{e}</button>)}</div></div><div>
          <div style={{fontSize:"12px",color:T().MUTE,marginBottom:"8px"}}>Symbole en jeu</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
            {SYMBOLS.map(s=><button key={s.id} onClick={()=>setSymbol(s.id)} style={{padding:"12px",aspectRatio:"1",fontSize:"22px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,background:symbol===s.id?`${XC}12`:T().BG,border:`2px solid ${symbol===s.id?XC:T().BORDER}`,borderRadius:"10px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:symbol===s.id?XC:T().MUTE,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>{s.display}</button>)}
          </div>
        </div>
        <button onClick={()=>onSave({...initial,name:name||initial.name,emoji,symbol})} disabled={!name.trim()} style={{padding:"15px",fontSize:"15px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,background:XG,border:"none",color:"#fff",cursor:"pointer",borderRadius:"14px",opacity:name.trim()?1:0.5,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>Sauvegarder →</button></div></div></div>);
}

/* ── Options Panel ───────────────────────────────────────── */
function OptionsPanel({opts,onChange,onClose}){
  const th=T();
  return(<div style={{position:"fixed",inset:0,background:"rgba(12,10,9,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:170,backdropFilter:"blur(8px)",animation:"fadeIn .2s ease"}} onClick={onClose}><div style={{background:T().CARD,borderRadius:"24px 24px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:"440px",boxShadow:"0 -8px 40px rgba(0,0,0,0.12)",animation:"slideUpSheet .3s ease"}} onClick={e=>e.stopPropagation()}><div style={{width:"36px",height:"4px",borderRadius:"2px",background:BORDER,margin:"0 auto 20px"}}/><div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:"18px",color:T().INK,marginBottom:"18px"}}>⚙️ Options</div><div style={{display:"flex",flexDirection:"column",gap:"14px"}}>{[{key:"darkMode",icon:opts.darkMode?"🌙":"☀️",label:"Thème",sub:opts.darkMode?"Mode nuit actif":"Mode jour actif"},{key:"sound",icon:"🔊",label:"Sons",sub:"Effets sonores"},{key:"animations",icon:"✨",label:"Animations",sub:"Confettis et effets"},{key:"showPoints",icon:"🏅",label:"Afficher les points",sub:"Overlay après chaque manche"},{key:"hoverPreview",icon:"👆",label:"Aperçu au survol",sub:"Voir votre symbole avant de jouer"},].map(o=><div key={o.key} style={{display:"flex",alignItems:"center",gap:"12px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}} onClick={()=>onChange({...opts,[o.key]:!opts[o.key]})}><div style={{width:"38px",height:"38px",borderRadius:"10px",background:T().CHIP,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0}}>{o.icon}</div><div style={{flex:1}}><div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,fontSize:"15px",color:INK}}>{o.label}</div><div style={{fontSize:"12px",color:T().MUTE,marginTop:"1px"}}>{o.sub}</div></div><Toggle value={opts[o.key]!==false} onChange={()=>onChange({...opts,[o.key]:!opts[o.key]})} color={o.key==="darkMode"?"#6366f1":undefined}/></div>)}</div><button onClick={onClose} style={{width:"100%",marginTop:"20px",padding:"14px",fontSize:"14px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,background:T().CHIP,border:"none",color:T().MUTE,cursor:"pointer",borderRadius:"12px",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>Fermer</button></div></div>);
}

/* ── Difficulty levels ───────────────────────────────────── */
const DIFFS=[{id:"beginner",emoji:"🌱",label:"Débutant",sub:"Aléatoire",col:"#22c55e",mult:0.5},{id:"easy",emoji:"🟢",label:"Facile",sub:"Quelques bonnes décisions",col:OC,mult:0.8},{id:"medium",emoji:"🟡",label:"Moyen",sub:"Attaque & défend",col:GOLD,mult:1},{id:"hard",emoji:"🟠",label:"Difficile",sub:"Minimax",col:"#f97316",mult:1.3},{id:"expert",emoji:"🔴",label:"Expert",sub:"Imbattable",col:XC,mult:1.6},{id:"legend",emoji:"💀",label:"Légendaire",sub:"Profondeur maximale",col:"#7c3aed",mult:2}];

/* ── Menu ────────────────────────────────────────────────── */
function MenuScreen({profiles,onUpdateProfile,onStart,opts,onOpenOpts,sfx}){
  const[tab,setTab]=useState("2p");const[aiLevel,setAiLevel]=useState("medium");
  const[gridSize,setGridSize]=useState(4);const[vanish,setVanish]=useState(true);
  const[blitz,setBlitz]=useState(true);const[blitzTime,setBlitzTime]=useState(30);
  const[bombOn,setBombOn]=useState(true);const[shieldOn,setShieldOn]=useState(true);
  const[rotateOn,setRotateOn]=useState(true);const[rotSurprise,setRotSurprise]=useState(false);
  const[bestOfOn,setBestOfOn]=useState(true);const[bestOf,setBestOf]=useState(3);
  const[drawsDontCount,setDrawsDontCount]=useState(true);
  const[swapOn,setSwapOn]=useState(true);
  const[editingP,setEditingP]=useState(null);

  const cfg={gridSize,vanish,blitz,blitzTime,bombOn,shieldOn,rotateOn,rotSurprise,bestOf:bestOfOn?bestOf:0,drawsDontCount,swapOn,difficulty:tab==="ai"?aiLevel:"medium"};
  const rotEvery=gridSize===4?8:6;
  const ac=[vanish,blitz,bombOn,shieldOn,rotateOn,bestOfOn,swapOn].filter(Boolean).length;

  if(editingP)return<ProfileEditor initial={profiles[editingP]} onBack={()=>setEditingP(null)} onSave={async prof=>{await onUpdateProfile(editingP,prof);setEditingP(null);}}/>;

  return(
    <div style={{background:T().BG,minHeight:"100dvh",overflowY:"auto"}}>
      <div style={{maxWidth:"400px",margin:"0 auto",padding:"32px 20px 52px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"28px"}}>
          <h1 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"clamp(24px,7vw,36px)",color:T().INK,letterSpacing:"-1.5px",margin:0,lineHeight:1}}>Tic <span style={{color:XC}}>·</span> Tac <span style={{color:OC}}>·</span> Toe</h1>
          <button onClick={onOpenOpts} style={{width:"38px",height:"38px",borderRadius:"11px",background:T().CARD,border:`1px solid ${T().BORDER}`,color:T().MUTE,fontSize:"18px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>⚙️</button>
        </div>

        {/* Mode tabs */}
        <div style={{display:"flex",gap:"6px",marginBottom:"20px",background:T().CHIP2,borderRadius:"14px",padding:"4px"}}>
          {[{id:"2p",label:"👥 2 Joueurs"},{id:"ai",label:"🤖 Vs IA"}].map(tb=><button key={tb.id} onClick={()=>{sfx.tap();setTab(tb.id);}} style={{flex:1,padding:"12px",fontSize:"14px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,background:tab===tb.id?CARD:"transparent",border:"none",color:tab===tb.id?INK:MUTE,cursor:"pointer",borderRadius:"11px",transition:"all .2s",boxShadow:tab===tb.id?"0 1px 8px rgba(0,0,0,0.1)":"none",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>{tb.label}</button>)}
        </div>

        {/* Profiles */}
        <div style={{marginBottom:"20px"}}>
          <div style={{fontSize:"11px",color:T().MUTE,letterSpacing:"1px",marginBottom:"10px",textTransform:"uppercase",fontWeight:600}}>Joueurs</div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {(tab==="2p"?["X","O"]:["X"]).map(p=><ProfileCard key={p} profile={profiles[p]} color={colOf(p)} onEdit={()=>setEditingP(p)} showStats={true}/>)}
            {tab==="ai"&&<div style={{background:T().CARD,borderRadius:"16px",padding:"12px 16px",border:`1.5px solid ${OC}22`}}><div style={{display:"flex",alignItems:"center",gap:"10px"}}><div style={{width:"44px",height:"44px",borderRadius:"50%",background:`${OC}15`,border:`2px solid ${OC}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"22px"}}>🤖</div><div><div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:"15px",color:INK}}>IA</div><div style={{fontSize:"12px",color:MUTE}}>{DIFFS.find(d=>d.id===aiLevel)?.label}</div></div></div></div>}
          </div>
        </div>

        {/* AI difficulty */}
        {tab==="ai"&&<div style={{marginBottom:"20px"}}><div style={{fontSize:"11px",color:T().MUTE,letterSpacing:"1px",marginBottom:"10px",textTransform:"uppercase",fontWeight:600}}>Difficulté</div><div style={{display:"flex",flexDirection:"column",gap:"6px"}}>{DIFFS.map(lv=>{const sel=aiLevel===lv.id;return(<button key={lv.id} onClick={()=>{sfx.tap();setAiLevel(lv.id);}} style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:"12px",background:sel?CARD:"transparent",border:`1.5px solid ${sel?lv.col:BORDER}`,borderRadius:"12px",cursor:"pointer",transition:"all .2s",textAlign:"left",boxShadow:sel?`0 2px 12px ${lv.col}1e`:"none",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}><span style={{fontSize:"18px"}}>{lv.emoji}</span><div style={{flex:1}}><div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:"14px",color:sel?lv.col:INK}}>{lv.label}</div><div style={{fontSize:"11px",color:T().MUTE,marginTop:"1px"}}>{lv.sub}</div></div><span style={{fontSize:"11px",fontWeight:700,color:sel?lv.col:MUTE,padding:"2px 7px",borderRadius:"6px",background:sel?`${lv.col}10`:"transparent"}}>×{lv.mult}</span></button>);})}</div></div>}

        {/* Grid size */}
        <div style={{marginBottom:"20px"}}><div style={{fontSize:"11px",color:T().MUTE,letterSpacing:"1px",marginBottom:"10px",textTransform:"uppercase",fontWeight:600}}>Grille</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>{[{size:3,label:"3 × 3",sub:"3 en ligne",badge:"⚡"},{size:4,label:"4 × 4",sub:"4 en ligne",badge:"🧠"}].map(g=>{const sel=gridSize===g.size;return(<button key={g.size} onClick={()=>{sfx.tap();setGridSize(g.size);}} style={{padding:"14px",display:"flex",flexDirection:"column",gap:"6px",background:sel?CARD:"transparent",border:`1.5px solid ${sel?INK:BORDER}`,borderRadius:"14px",cursor:"pointer",transition:"all .2s",textAlign:"left",boxShadow:sel?"0 2px 12px rgba(0,0,0,0.1)":"none",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"18px",color:sel?INK:MUTE}}>{g.label}</div><span style={{fontSize:"16px"}}>{g.badge}</span></div><div style={{fontSize:"12px",color:MUTE}}>{g.sub}</div><div style={{display:"grid",gridTemplateColumns:`repeat(${g.size},1fr)`,gap:"2px",marginTop:"4px"}}>{Array.from({length:g.size*g.size}).map((_,i)=><div key={i} style={{aspectRatio:"1",borderRadius:"3px",background:sel?"#e7e5e4":T().CHIP2}}/>)}</div></button>);})}</div></div>

        {/* Rules */}
        <div style={{marginBottom:"28px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}><div style={{fontSize:"11px",color:T().MUTE,letterSpacing:"1px",textTransform:"uppercase",fontWeight:600}}>Règles</div><div style={{fontSize:"12px",color:MUTE}}>{ac} active{ac>1?"s":""}</div></div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>

            <RuleCard icon="💀" title="Disparition" color={XC} active={vanish}
              sub={`Max ${gridSize} pièces — vous choisissez laquelle sacrifier`}
              onToggle={()=>{sfx.tap();setVanish(!vanish);}} badge="Choix joueur"/>

            <RuleCard icon="⚡" title="Blitz" color={GOLD} active={blitz}
              sub={`${blitzTime}s par joueur — timeout = défaite`}
              onToggle={()=>{sfx.tap();setBlitz(!blitz);}}>
              <Stepper value={blitzTime} min={10} max={120} unit="s" onChange={v=>{sfx.tap();setBlitzTime(v);}} color={GOLD} label="Durée"/>
            </RuleCard>

            <RuleCard icon="💣" title="Bombe — Capture" color="#f97316" active={bombOn}
              sub="Capture une pièce ennemie → elle devient la vôtre"
              onToggle={()=>{sfx.tap();setBombOn(!bombOn);}} badge="Rechargeable"/>

            <RuleCard icon="🛡️" title="Bouclier — Ancre" color="#a78bfa" active={shieldOn}
              sub="Pièce immune : bombe + disparition + rotation"
              onToggle={()=>{sfx.tap();setShieldOn(!shieldOn);}}/>

            <RuleCard icon="🌀" title="Rotation" color="#f472b6" active={rotateOn}
              sub={rotSurprise?`Surprise entre les coups 4 et ${rotEvery+2}`:`Plateau tourne tous les ${rotEvery} coups`}
              onToggle={()=>{sfx.tap();setRotateOn(!rotateOn);}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}} onClick={()=>{sfx.tap();setRotSurprise(!rotSurprise);}}>
                <span style={{fontSize:"13px",color:T().MUTE,flex:1}}>Mode surprise 🎲</span>
                <Toggle value={rotSurprise} onChange={()=>{}} color="#f472b6"/>
              </div>
            </RuleCard>

            <RuleCard icon="🔀" title="Échange de symboles" color="#06b6d4" active={swapOn}
              sub={`À mi-partie (coup ${Math.floor((gridSize*gridSize)/2)}) X et O échangent toutes leurs pièces`}
              onToggle={()=>{sfx.tap();setSwapOn(!swapOn);}} badge="Retournement"/>

            <RuleCard icon="🏆" title="Best of" color={GOLD} active={bestOfOn}
              sub={`Série — ${Math.ceil(bestOf/2)} victoire${Math.ceil(bestOf/2)>1?"s":""} sur ${bestOf}`}
              onToggle={()=>{sfx.tap();setBestOfOn(!bestOfOn);}}>
              <Stepper value={bestOf} min={1} max={9} unit=" vic." onChange={v=>{sfx.tap();setBestOf(v%2===0?v+1:v);}} color={GOLD} label="Objectif"/>
              <div style={{display:"flex",alignItems:"center",gap:"12px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}} onClick={()=>{sfx.tap();setDrawsDontCount(!drawsDontCount);}}>
                <span style={{fontSize:"13px",color:T().MUTE,flex:1}}>Les nuls ne comptent pas</span>
                <Toggle value={drawsDontCount} onChange={()=>{}} color={GOLD}/>
              </div>
            </RuleCard>

          </div>
        </div>

        <button onClick={()=>{sfx.tap();onStart(tab==="2p"?"2p":aiLevel,cfg);}} style={{width:"100%",padding:"18px",fontSize:"17px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,background:XG,border:"none",color:"#fff",cursor:"pointer",borderRadius:"16px",boxShadow:`0 4px 20px ${XC}44`,letterSpacing:"-.3px",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>Jouer →</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════ */
export default function App(){
  const[screen,setScreen]=useState("loading");
  const[gameMode,setGameMode]=useState("2p");
  const[cfg,setCfg]=useState({gridSize:4,vanish:true,blitz:true,blitzTime:30,bombOn:true,shieldOn:true,rotateOn:true,rotSurprise:false,bestOf:3,drawsDontCount:true,swapOn:true,difficulty:"medium"});
  const[profiles,setProfiles]=useState({X:defProfile("Joueur 1","😎","X"),O:defProfile("Joueur 2","🦊","O")});
  const[opts,setOpts]=useState({sound:true,animations:true,showPoints:true,hoverPreview:true,darkMode:false});
  const[showOpts,setShowOpts]=useState(false);
  const[pointsData,setPointsData]=useState(null);
  const[playerSymbols,setPlayerSymbols]=useState({X:'X',O:'O'}); // chosen symbols per player slot

  useEffect(()=>{(async()=>{
    const px=await store.get("profile:X");const po=await store.get("profile:O");const op=await store.get("options");
    if(px)setProfiles(p=>({...p,X:px}));if(po)setProfiles(p=>({...p,O:po}));if(op)setOpts(op);
    setScreen("menu");
  })();},[]);

  const updateProfile=useCallback(async(p,prof)=>{setProfiles(pr=>({...pr,[p]:prof}));await store.set(`profile:${p}`,prof);},[]);
  const saveOpts=useCallback(async(o)=>{setOpts(o);await store.set("options",o);},[]);
  const theme=useTheme(opts.darkMode);
  // Update global symOf with current profile symbols
  _symOf=(p)=>{
    if(!profiles)return p;
    const sym=profiles[p]?.symbol;
    return sym&&sym!==p?sym:p;
  };
  const sfx=useSfx(opts.sound!==false);

  const SIZE=cfg.gridSize,WIN_LEN=cfg.gridSize,MAX_P=cfg.gridSize,ROT_EVR=cfg.gridSize===4?8:6;
  const LINES=useRef(makeLines(SIZE,WIN_LEN));
  const ROT=useRef(makeRot(SIZE));
  useEffect(()=>{LINES.current=makeLines(SIZE,WIN_LEN);ROT.current=makeRot(SIZE);},[SIZE]);

  // Board state
  const[squares,setSq]=useState(()=>Array(SIZE*SIZE).fill(null));
  const[xQueue,setXQ]=useState([]);const[oQueue,setOQ]=useState([]);
  const[xIsNext,setXN]=useState(true);
  const[scores,setScores]=useState({X:0,O:0,draws:0});
  const[seriesX,setSeriesX]=useState(0);const[seriesO,setSeriesO]=useState(0);
  const[winInfo,setWin]=useState(null);const[isDraw,setDraw]=useState(false);
  const[lineAnim,setLine]=useState(false);const[overlay,setOverlay]=useState(false);
  const[cdActive,setCd]=useState(false);const[round,setRound]=useState(1);
  const[flash,setFlash]=useState(null);const[moveCount,setMoveCount]=useState(0);
  const[hover,setHover]=useState(null);const[ripple,setRipple]=useState(null);
  const[stack,setStack]=useState([]);const[aiThinking,setAiThinking]=useState(false);
  const[toast,setToast]=useState(null);
  const[vanishAnim,setVanishAnim]=useState(null);const[shieldedCells,setShielded]=useState({});
  // Bomb: charges (starts at 1, recharges every 6 won rounds)
  const[bombCharges,setBombCharges]=useState({X:1,O:1});
  const[shieldUsed,setShieldUsed]=useState({X:false,O:false});
  const[powerMode,setPowerMode]=useState(null);
  const[rotAnim,setRotAnim]=useState(false);
  const[timerX,setTimerX]=useState(30);const[timerO,setTimerO]=useState(30);
  // Vanish choice: when player must pick which piece to remove
  const[vanishChoice,setVanishChoice]=useState(null); // {player, pendingIdx, pendingPlayer}
  // Surprise rotation: random trigger point
  const[surpriseTrigger,setSurpriseTrigger]=useState(null);
  // Swap happened this round
  const[swapDone,setSwapDone]=useState(false);

  const scored=useRef(false);const blitzRef=useRef(null);const toastRef=useRef(null);const moveRef=useRef(0);const boardMoveRef=useRef(0);
  const isAI=gameMode!=="2p";
  const aiConf=DIFFS.find(l=>l.id===gameMode)||DIFFS[2];
  const{vanish,blitz,blitzTime,bombOn,shieldOn,rotateOn,rotSurprise,bestOf,drawsDontCount,swapOn,difficulty}=cfg;
  const seriesTarget=bestOf?Math.ceil(bestOf/2):0;

  const showToast=useCallback((msg,color=INK)=>{clearTimeout(toastRef.current);setToast({msg,color});toastRef.current=setTimeout(()=>setToast(null),2200);},[]);

  /* Award points */
  const awardPoints=useCallback(async(winner,loser,draw,movesPlayed,blitzLeft)=>{
    if(!winner&&!draw)return;
    if(draw){
      const pts=calcPoints({win:false,draw:true,moves:movesPlayed,blitzLeft:0,blitzTime,streak:0,gridSize:SIZE,difficulty,vsAI:isAI});
      const nX={...profiles.X,draws:profiles.X.draws+1,points:profiles.X.points+pts.total,totalGames:profiles.X.totalGames+1};
      await updateProfile("X",nX);
      if(!isAI){const nO={...profiles.O,draws:profiles.O.draws+1,points:profiles.O.points+pts.total,totalGames:profiles.O.totalGames+1};await updateProfile("O",nO);}
      return;
    }
    if(isAI){
      if(winner==="X"){
        const winPts=calcPoints({win:true,draw:false,moves:movesPlayed,blitzLeft:blitzLeft??0,blitzTime,streak:profiles.X.streak,gridSize:SIZE,difficulty,vsAI:true});
        const newWonRounds=(profiles.X.wonRounds||0)+1;
        const extraCharge=newWonRounds%6===0?1:0;
        const nX={...profiles.X,wins:profiles.X.wins+1,points:profiles.X.points+winPts.total,streak:profiles.X.streak+1,bestStreak:Math.max(profiles.X.bestStreak,profiles.X.streak+1),totalGames:profiles.X.totalGames+1,wonRounds:newWonRounds};
        await updateProfile("X",nX);
        if(extraCharge>0){setBombCharges(b=>({...b,X:Math.min(b.X+1,3)}));showToast("💣 Bombe rechargée ! (+1 charge)","#f97316");}
        if(opts.showPoints!==false)setPointsData(winPts);sfx.points();
      }else{
        const penalty=calcLossPenalty(difficulty);
        const lossBreakdown=penalty>0?[{label:"Défaite vs IA",pts:0},{label:`🤖 Pénalité`,pts:-penalty}]:[{label:"Défaite",pts:0}];
        const nX={...profiles.X,losses:profiles.X.losses+1,points:Math.max(0,profiles.X.points-penalty),streak:0,totalGames:profiles.X.totalGames+1};
        await updateProfile("X",nX);
        if(penalty>0&&opts.showPoints!==false)setPointsData({total:-penalty,breakdown:lossBreakdown,isLoss:true});
      }
    }else{
      const winPts=calcPoints({win:true,draw:false,moves:movesPlayed,blitzLeft:blitzLeft??0,blitzTime,streak:profiles[winner].streak,gridSize:SIZE,difficulty,vsAI:false});
      const consolation=10;
      const newWonW=(profiles[winner].wonRounds||0)+1;
      const extraW=newWonW%6===0?1:0;
      const nWin={...profiles[winner],wins:profiles[winner].wins+1,points:profiles[winner].points+winPts.total,streak:profiles[winner].streak+1,bestStreak:Math.max(profiles[winner].bestStreak,profiles[winner].streak+1),totalGames:profiles[winner].totalGames+1,wonRounds:newWonW};
      const nLose={...profiles[loser],losses:profiles[loser].losses+1,points:profiles[loser].points+consolation,streak:0,totalGames:profiles[loser].totalGames+1};
      await updateProfile(winner,nWin);await updateProfile(loser,nLose);
      if(extraW>0){setBombCharges(b=>({...b,[winner]:Math.min(b[winner]+1,3)}));showToast(`💣 ${profiles[winner].name} gagne une bombe !`,"#f97316");}
      if(opts.showPoints!==false)setPointsData(winPts);sfx.points();
    }
  },[profiles,blitzTime,SIZE,difficulty,isAI,opts,updateProfile,sfx,showToast]);

  /* Blitz */
  useEffect(()=>{
    if(!blitz||screen!=="game"||!!winInfo||isDraw||cdActive||vanishChoice)return;
    clearInterval(blitzRef.current);
    blitzRef.current=setInterval(()=>{const setter=xIsNext?setTimerX:setTimerO;setter(t=>{if(t<=1){clearInterval(blitzRef.current);scored.current=true;const w=xIsNext?"O":"X";setWin({w,line:[],timeout:true});setScores(s=>({...s,[w]:s[w]+1}));if(bestOf)w==="X"?setSeriesX(s=>s+1):setSeriesO(s=>s+1);setFlash(w);setTimeout(()=>setOverlay(true),400);sfx.timeout();awardPoints(w,oppOf(w),false,moveCount,0);return 0;}if(t<=5)sfx.urgent();return t-1;});},1000);
    return()=>clearInterval(blitzRef.current);
  },[blitz,xIsNext,winInfo,isDraw,cdActive,screen,vanishChoice]);

  /* Check win */
  const checkWin=useCallback((sq,fromRule=null)=>{
    if(scored.current)return false;const r=getWinner(sq,LINES.current);
    if(r){scored.current=true;clearInterval(blitzRef.current);setWin(r);setScores(s=>({...s,[r.w]:s[r.w]+1}));if(bestOf)r.w==="X"?setSeriesX(s=>s+1):setSeriesO(s=>s+1);setFlash(r.w);setTimeout(()=>setLine(true),50);setTimeout(()=>setOverlay(true),880);sfx.win();const bl=r.w==="X"?timerX:timerO;awardPoints(r.w,oppOf(r.w),false,moveCount,bl);if(fromRule)showToast(`${fromRule} → Victoire !`,colOf(r.w));return true;}
    return false;
  },[bestOf,sfx,showToast,awardPoints,moveCount,timerX,timerO]);

  /* Squares change → check win/draw */
  useEffect(()=>{
    if(scored.current)return;const r=getWinner(squares,LINES.current);
    if(r){scored.current=true;clearInterval(blitzRef.current);setWin(r);setScores(s=>({...s,[r.w]:s[r.w]+1}));if(bestOf)r.w==="X"?setSeriesX(s=>s+1):setSeriesO(s=>s+1);setFlash(r.w);setTimeout(()=>setLine(true),50);setTimeout(()=>setOverlay(true),880);sfx.win();const bl=r.w==="X"?timerX:timerO;awardPoints(r.w,oppOf(r.w),false,moveCount,bl);}
    else if(!vanish&&squares.every(Boolean)){scored.current=true;clearInterval(blitzRef.current);setDraw(true);setScores(s=>({...s,draws:s.draws+1}));setFlash("draw");sfx.draw();awardPoints(null,null,true,moveCount,0);
      if(drawsDontCount&&bestOf){
        // Draw doesn't count in series — show brief toast and auto-continue after 1.8s
        showToast("🤝 Nul — ne compte pas pour la série","#d97706");
        setTimeout(()=>{setDraw(false);setFlash(null);scored.current=false;hardReset(blitzTime);setRound(r=>r+1);setCd(true);},1800);
      }else{setTimeout(()=>setOverlay(true),580);}
    }
  },[squares]);

  useEffect(()=>{if(flash)setTimeout(()=>setFlash(null),1100);},[flash]);

  /* Hard reset */
  const hardReset=useCallback((bt)=>{
    const t=bt??blitzTime;const s=SIZE*SIZE;
    setSq(Array(s).fill(null));setXN(true);setXQ([]);setOQ([]);setWin(null);setDraw(false);setLine(false);setOverlay(false);
    setStack([]);scored.current=false;setHover(null);setAiThinking(false);setVanishAnim(null);
    clearInterval(blitzRef.current);setTimerX(t);setTimerO(t);
    setMoveCount(0);moveRef.current=0;boardMoveRef.current=0;
    setShielded({});
    setBombCharges(b=>({X:b.X,O:b.O})); // keep charges across rounds
    setShieldUsed({X:false,O:false});setPowerMode(null);setRotAnim(false);
    setVanishChoice(null);setSwapDone(false);
    clearTimeout(toastRef.current);setToast(null);setPointsData(null);
    // Regenerate surprise trigger each round
    if(cfg.rotSurprise){const rEach=SIZE===4?8:6;const t2=4+Math.floor(Math.random()*(rEach-2));setSurpriseTrigger(t2);}
    else setSurpriseTrigger(null);
  },[blitzTime,SIZE,cfg.rotSurprise,ROT_EVR]);

  const[names,setNames]=useState({X:"Joueur 1",O:"IA"});

  const startGame=(mode,newCfg)=>{
    setGameMode(mode);setCfg(newCfg);
    setNames(mode==="2p"?{X:profiles.X.name,O:profiles.O.name}:{X:profiles.X.name,O:"IA"});
    const s=newCfg.gridSize;LINES.current=makeLines(s,s);ROT.current=makeRot(s);
    const t=newCfg.blitzTime;const cells=s*s;
    setSq(Array(cells).fill(null));setXN(true);setXQ([]);setOQ([]);setWin(null);setDraw(false);setLine(false);setOverlay(false);
    setStack([]);scored.current=false;setHover(null);setAiThinking(false);setVanishAnim(null);
    clearInterval(blitzRef.current);setTimerX(t);setTimerO(t);setMoveCount(0);moveRef.current=0;boardMoveRef.current=0;setShielded({});
    setBombCharges({X:1,O:1});setShieldUsed({X:false,O:false});setPowerMode(null);setRotAnim(false);
    setVanishChoice(null);setSwapDone(false);
    if(newCfg.rotSurprise){const rEvr=s===4?8:6;const trigger=4+Math.floor(Math.random()*(rEvr-2));setSurpriseTrigger(trigger);}
    clearTimeout(toastRef.current);setToast(null);setPointsData(null);
    setScores({X:0,O:0,draws:0});setSeriesX(0);setSeriesO(0);setRound(1);setScreen("game");setCd(true);
  };


  /* Rotation helper */
  const doRotate=useCallback((sq,xQ,oQ,shielded)=>{
    setRotAnim(true);showToast("🌀 Rotation !","#f472b6");
    setTimeout(()=>{
      const rotated=rotateSq(sq,ROT.current,shielded);
      // Queues: shielded pieces keep their index, others rotate
      // Rotate queue indices; shielded stay put; deduplicate in case of collision
      const rotQ=q=>{const seen=new Set();return q.map(i=>shielded[i]?i:ROT.current[i]).filter(i=>{if(seen.has(i))return false;seen.add(i);return true;});};
      setSq(rotated);setXQ(rotQ(xQ));setOQ(rotQ(oQ));
      setShielded(sh=>{const n={};Object.keys(sh).forEach(k=>{n[k]=sh[k];});return n;});
      sfx.rotate();setTimeout(()=>setRotAnim(false),450);
      setTimeout(()=>checkWin(rotated,"🌀 Rotation"),60);
    },200);
  },[sfx,showToast,checkWin]);

  /* Symbol swap helper */
  const doSymbolSwap=useCallback((sq,xQ,oQ)=>{
    // Swap all symbols; shielded pieces keep their symbol (anchored)
    const ns=sq.map((v,i)=>!v?null:shieldedCells[i]?v:v==="X"?"O":"X");
    const nShielded={};Object.keys(shieldedCells).forEach(k=>{nShielded[k]=shieldedCells[k];});
    setSq(ns);setXQ([...oQ]);setOQ([...xQ]);setShielded(nShielded);
    setSwapDone(true);sfx.swap();
    showToast("🔀 Échange de symboles !","#06b6d4");
    setTimeout(()=>checkWin(ns,"🔀 Échange"),60);
  },[shieldedCells,sfx,showToast,checkWin]);

  /* Core move — handles vanish choice prompt */
  const finalizeMove=useCallback((idx,sq,xQ,oQ,player,chosenRemove)=>{
    const{squares:ns,xQueue:nx,oQueue:no,removed,needsChoice}=applyMove(sq,xQ,oQ,idx,player,vanish,MAX_P,chosenRemove);

    if(needsChoice){
      if(!isAI){
        // Human: pause, show choice modal
        const tempSq=[...sq];tempSq[idx]=player;
        const tempQ=player==="X"?[...xQ,idx]:[...oQ,idx];
        // Exclude the newly placed piece from choices (can't sacrifice what you just placed)
        const choosableQ=tempQ.filter(i=>i!==idx&&!shieldedCells[i]);
        setSq(tempSq);
        if(player==="X")setXQ(tempQ);else setOQ(tempQ);
        setVanishChoice({player,pendingIdx:idx,pendingQueue:choosableQ});
        sfx.choose();
        return;
      } else {
        // AI: auto-remove oldest non-shielded piece
        const qRef=player==="X"?nXQ:nOQ;
        const oldest=qRef.find(i=>i!==idx&&!shieldedCells[i])??qRef.find(i=>i!==idx);
        if(oldest!==undefined){
          if(player==="X")nXQ.splice(nXQ.indexOf(oldest),1);
          else nOQ.splice(nOQ.indexOf(oldest),1);
          nSq[oldest]=null;
        }
      }
    }

    if(removed!==null&&!shieldedCells[removed]){
      setVanishAnim(removed);sfx.vanish();showToast("💀 Disparition !",XC);
      setTimeout(()=>setVanishAnim(null),500);
      setShielded(s=>{const n={...s};delete n[removed];return n;});
    }else if(removed!==null&&shieldedCells[removed]){
      showToast("🛡️ Ancre — pièce immunisée !","#a78bfa");
    }
    setSq(ns);setXQ(nx);setOQ(no);

    moveRef.current+=1;boardMoveRef.current+=1;const nm=moveRef.current;const bmn=boardMoveRef.current;setMoveCount(nm);

    // Symbol swap at mid-game (based on board moves)
    const swapAt=Math.floor((SIZE*SIZE)/2);
    if(swapOn&&!swapDone&&bmn===swapAt-2)showToast("⚠️ Échange dans 2 coups !","#06b6d4");
    if(swapOn&&!swapDone&&bmn===swapAt){
      setTimeout(()=>doSymbolSwap(ns,nx,no),400);
    }

    // Rotation warning 1 move before
    if(rotateOn&&!rotSurprise&&bmn>0&&(bmn+1)%ROT_EVR===0)showToast("⚠️ Rotation au prochain coup !","#f472b6");
    const shouldRotate=rotateOn&&(rotSurprise?bmn===surpriseTrigger:bmn>0&&bmn%ROT_EVR===0);
    if(shouldRotate){setTimeout(()=>doRotate(ns,nx,no,shieldedCells),swapOn&&!swapDone&&nm===swapAt?900:100);}

    setRipple(idx);setTimeout(()=>setRipple(null),350);
    setXN(player==="X"?false:true);sfx.click(player==="X");
    if(blitz){if(player==="X")setTimerO(blitzTime);else setTimerX(blitzTime);}
    setPowerMode(null);setVanishChoice(null);
  },[vanish,MAX_P,shieldedCells,blitz,blitzTime,rotateOn,rotSurprise,surpriseTrigger,ROT_EVR,swapOn,swapDone,moveCount,SIZE,sfx,showToast,doRotate,doSymbolSwap]);

  /* Vanish choice confirmed */
  const confirmVanishChoice=useCallback((chosenIdx)=>{
    if(!vanishChoice)return;
    const{player,pendingIdx}=vanishChoice;
    const currSq=[...squares];const currXQ=[...xQueue];const currOQ=[...oQueue];
    // The piece is already placed in tempSq, now remove the chosen one
    const ns=[...currSq];ns[chosenIdx]=null;
    let nx=[...currXQ],no=[...currOQ];
    if(player==="X")nx=nx.filter(i=>i!==chosenIdx);
    else no=no.filter(i=>i!==chosenIdx);
    if(!shieldedCells[chosenIdx]){
      setVanishAnim(chosenIdx);sfx.vanish();showToast("💀 Sacrifiée !",XC);
      setTimeout(()=>setVanishAnim(null),500);
    }
    setSq(ns);setXQ(nx);setOQ(no);
    moveRef.current+=1;boardMoveRef.current+=1;const nm=moveRef.current;const bmn=boardMoveRef.current;setMoveCount(nm);
    // Explicitly check win after vanish choice (squares state may not be sync'd yet)
    setTimeout(()=>checkWin(ns),30);
    const swapAt=Math.floor((SIZE*SIZE)/2);
    if(swapOn&&!swapDone&&bmn===swapAt)setTimeout(()=>doSymbolSwap(ns,nx,no),400);
    const shouldRotate=rotateOn&&(rotSurprise?bmn===surpriseTrigger:bmn>0&&bmn%ROT_EVR===0);
    if(shouldRotate)setTimeout(()=>doRotate(ns,nx,no,shieldedCells),swapOn&&!swapDone&&nm===swapAt?900:100);

    setRipple(pendingIdx);setTimeout(()=>setRipple(null),350);
    setXN(player==="X"?false:true);sfx.click(player==="X");
    if(blitz){if(player==="X")setTimerO(blitzTime);else setTimerX(blitzTime);}
    setPowerMode(null);setVanishChoice(null);
  },[vanishChoice,squares,xQueue,oQueue,shieldedCells,blitz,blitzTime,rotateOn,rotSurprise,surpriseTrigger,ROT_EVR,swapOn,swapDone,moveCount,SIZE,sfx,showToast,doRotate,doSymbolSwap]);

  /* Cell tap */
  const handleCell=useCallback(i=>{
    if(winInfo||isDraw||cdActive||aiThinking||vanishChoice)return;
    if(isAI&&!xIsNext)return;
    const player=xIsNext?"X":"O";

    /* Bomb — hijack */
    if(powerMode==="bomb"){
      if(squares[i]&&squares[i]!==player){
        if(shieldedCells[i]){showToast("🛡️ Pièce ancrée — immunisée !","#a78bfa");return;}
        const opp=oppOf(player);
        let newOQ=opp==="O"?[...oQueue].filter(x=>x!==i):[...oQueue];
        let newXQ=opp==="X"?[...xQueue].filter(x=>x!==i):[...xQueue];
        let finalXQ=player==="X"?[...newXQ,i]:newXQ;
        let finalOQ=player==="O"?[...newOQ,i]:newOQ;
        let ns=[...squares];ns[i]=player;
        if(vanish){
          if(player==="X"&&finalXQ.length>MAX_P&&!isAI){
            // Player must choose which to remove
            setSq(ns);setXQ(finalXQ);setOQ(finalOQ);
            setBombCharges(b=>({...b,[player]:b[player]-1}));sfx.bomb();setPowerMode(null);
            showToast("💣 Capturé ! Choisissez votre sacrifice","#f97316");
            setVanishChoice({player,pendingIdx:i,pendingQueue:finalXQ});return;
          }
          if(player==="X"&&finalXQ.length>MAX_P){const c=finalXQ[0];if(c!==i){finalXQ.shift();ns[c]=null;}else finalXQ.shift();}
          if(player==="O"&&finalOQ.length>MAX_P){const c=finalOQ[0];if(c!==i){finalOQ.shift();ns[c]=null;}else finalOQ.shift();}
        }
        setSq(ns);setXQ(finalXQ);setOQ(finalOQ);
        setBombCharges(b=>({...b,[player]:b[player]-1}));sfx.bomb();setPowerMode(null);
        showToast("💣 Pièce capturée → la vôtre !","#f97316");
        setXN(!xIsNext);if(blitz){if(player==="X")setTimerO(blitzTime);else setTimerX(blitzTime);}
        setMoveCount(m=>m+1);
        setTimeout(()=>checkWin(ns,"💣 Capture"),60);
      }
      return;
    }

    /* Shield — anchor */
    if(powerMode==="shield"){
      if(squares[i]===player&&!shieldedCells[i]){
        if(vanish){if(player==="X")setXQ(q=>q.filter(x=>x!==i));else setOQ(q=>q.filter(x=>x!==i));}
        setShielded(s=>({...s,[i]:true}));setShieldUsed(s=>({...s,[player]:true}));
        sfx.shield();setPowerMode(null);showToast("🛡️ Pièce ancrée — immunisée !","#a78bfa");
      }
      return;
    }

    if(squares[i])return;
    setStack(s=>[...s,{squares:[...squares],xQueue:[...xQueue],oQueue:[...oQueue],xIsNext,timerX,timerO,shieldedCells:{...shieldedCells},moveCount,swapDone}]);
    finalizeMove(i,squares,xQueue,oQueue,player,null);
  },[squares,xQueue,oQueue,winInfo,isDraw,cdActive,aiThinking,xIsNext,isAI,powerMode,shieldedCells,vanishChoice,vanish,MAX_P,blitz,blitzTime,finalizeMove,sfx,checkWin,showToast,moveCount,swapDone]);

  /* AI */
  useEffect(()=>{
    if(!isAI||xIsNext||winInfo||isDraw||cdActive||scored.current||vanishChoice)return;
    setAiThinking(true);
    const delay={beginner:900,easy:700,medium:600,hard:500,expert:650,legend:700}[gameMode]??600;
    const timer=setTimeout(()=>{
      const{idx,useBomb}=getBestMove(squares,xQueue,oQueue,vanish,MAX_P,gameMode,LINES.current,SIZE,bombCharges.O>0&&bombOn,shieldedCells);
      if(useBomb&&idx!==-1){
        // AI uses bomb
        const ns=[...squares];const opp="X";
        const newXQ=[...xQueue].filter(x=>x!==idx);
        let finalOQ=[...oQueue,idx];
        if(vanish&&finalOQ.length>MAX_P){const c=finalOQ[0];if(c!==idx){finalOQ.shift();ns[c]=null;}else finalOQ.shift();}
        ns[idx]="O";setSq(ns);setXQ(newXQ);setOQ(finalOQ);
        setBombCharges(b=>({...b,O:b.O-1}));sfx.bomb();
        showToast("🤖 💣 L'IA capture votre pièce !","#f97316");
        moveRef.current+=1;setMoveCount(moveRef.current);
        setXN(true);
        if(blitz)setTimerX(blitzTime);
        setTimeout(()=>checkWin(ns,"💣 IA Capture"),60);
      }else if(idx!==-1){
        // Pass oldest removable O piece as chosenRemove (AI never needs choice dialog)
        const aiOldestO=oQueue.filter(i=>!shieldedCells[i])[0]??oQueue[0]??null;
        finalizeMove(idx,squares,xQueue,oQueue,"O",aiOldestO);
      }
      setAiThinking(false);
    },delay+Math.random()*200);
    return()=>clearTimeout(timer);
  },[isAI,xIsNext,winInfo,isDraw,cdActive,squares,xQueue,oQueue,vanish,gameMode,finalizeMove,bombCharges,bombOn,shieldedCells,blitz,blitzTime,checkWin,sfx,showToast,vanishChoice]);

  /* Undo */
  const undo=()=>{
    if(!stack.length||winInfo||isDraw||aiThinking||powerMode||vanishChoice)return;
    const steps=isAI&&stack.length>=2?2:1;
    const prev=stack[Math.max(0,stack.length-steps)];
    setSq(prev.squares);setXN(prev.xIsNext);setXQ(prev.xQueue);setOQ(prev.oQueue);
    setTimerX(prev.timerX);setTimerO(prev.timerO);setShielded(prev.shieldedCells||{});
    setMoveCount(prev.moveCount||0);setSwapDone(prev.swapDone||false);
    setStack(s=>s.slice(0,-steps));sfx.undo();
  };

  const nextRound=()=>{
    setPointsData(null);hardReset(blitzTime);setRound(r=>r+1);setCd(true);
    if(cfg.rotSurprise){const trigger=4+Math.floor(Math.random()*(ROT_EVR-2));setSurpriseTrigger(trigger);}
  };
  const goMenu=()=>{setPointsData(null);hardReset(blitzTime);setScores({X:0,O:0,draws:0});setSeriesX(0);setSeriesO(0);setRound(1);setScreen("menu");};

  /* Derived */
  const isOver=!!(winInfo||isDraw);const cur=xIsNext?"X":"O";
  const winCoords=winInfo?.line?.length?(()=>{const line=winInfo.line;const r0=Math.floor(line[0]/SIZE),c0=line[0]%SIZE,rN=Math.floor(line[line.length-1]/SIZE),cN=line[line.length-1]%SIZE;const step=100/SIZE;return[c0*step+step/2,r0*step+step/2,cN*step+step/2,rN*step+step/2];})():null;
  const nextVX=vanish&&xQueue.length===MAX_P?xQueue.find(i=>!shieldedCells[i]):null;
  const nextVO=vanish&&oQueue.length===MAX_P?oQueue.find(i=>!shieldedCells[i]):null;
  const txUrgent=blitz&&timerX<=5&&xIsNext&&!isOver;const toUrgent=blitz&&timerO<=5&&!xIsNext&&!isOver;
  const cellSize=SIZE===3?"min(30vw,108px)":"min(22vw,84px)";const symSize=SIZE===3?"min(13vw,46px)":"min(9vw,32px)";const BR=SIZE===3?12:8;
  const swapAt=Math.floor((SIZE*SIZE)/2);
  const movesUntilSwap=swapOn&&!swapDone?swapAt-moveCount:null;

  if(screen==="loading")return(<div style={{background:T().BG,minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:"24px",color:MUTE}}>Chargement…</div></div>);
  if(screen==="menu")return(<div style={{background:T().BG,minHeight:"100dvh",transition:"background .3s"}}><style>{getAnim(T())}</style>{showOpts&&<OptionsPanel opts={opts} onChange={saveOpts} onClose={()=>setShowOpts(false)}/>}<MenuScreen profiles={profiles} onUpdateProfile={updateProfile} onStart={startGame} opts={opts} onOpenOpts={()=>setShowOpts(true)} sfx={sfx}/></div>);

  return(
    <div style={{background:T().BG,minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",paddingBottom:"28px",transition:"background .3s"}}>
      <style>{getAnim(T())}</style>
      {opts.animations!==false&&<Confetti active={!!winInfo&&overlay&&!winInfo.timeout}/>}
      {cdActive&&<Countdown sfx={sfx} onDone={()=>setCd(false)}/>}
      {toast&&<Toast message={toast.msg} color={toast.color}/>}
      {showOpts&&<OptionsPanel opts={opts} onChange={saveOpts} onClose={()=>setShowOpts(false)}/>}
      {pointsData&&<PointsOverlay data={pointsData} onClose={()=>{setPointsData(null);}}/>}
      {vanishChoice&&<VanishChoiceModal squares={squares} queue={vanishChoice.pendingQueue} player={vanishChoice.player} shielded={shieldedCells} onChoose={confirmVanishChoice} sfx={sfx}/>}
      {overlay&&!pointsData&&(winInfo?<WinModal winner={winInfo.timeout?"⏱":winInfo.w} name={winInfo.timeout?`${isAI&&oppOf(winInfo.w)==="O"?"IA":profiles[oppOf(winInfo.w)]?.name||"Joueur"} hors temps`:isAI&&winInfo.w==="O"?"IA":profiles[winInfo.w]?.name||winInfo.w} subtext={winInfo.timeout?"Temps écoulé":bestOf?`Série : ${seriesX} — ${seriesO} (/${seriesTarget})`:"remporte la manche !"} color={colOf(winInfo.w)} grad={gradOf(winInfo.w)} onNext={nextRound} onMenu={goMenu} bestOf={bestOf||null} seriesX={seriesX} seriesO={seriesO} drawsDontCount={drawsDontCount}/>:isDraw&&<WinModal winner="=" name="Match nul" subtext={drawsDontCount&&bestOf?"Ne compte pas pour la série":"Égalité !"} color={GOLD} grad={`linear-gradient(135deg,${GOLD},#f59e0b)`} onNext={nextRound} onMenu={goMenu} bestOf={bestOf||null} seriesX={seriesX} seriesO={seriesO} drawsDontCount={drawsDontCount}/>)}

      {/* Top bar */}
      <div style={{width:"100%",maxWidth:"440px",padding:"18px 20px 0",display:"flex",alignItems:"center",gap:"12px"}}>
        <button onClick={goMenu} style={{width:"38px",height:"38px",borderRadius:"11px",background:T().CARD,border:`1px solid ${T().BORDER}`,color:T().MUTE,fontSize:"17px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>←</button>
        <div style={{flex:1,textAlign:"center"}}>
          <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"20px",color:T().INK,letterSpacing:"-.5px"}}>Tic <span style={{color:XC}}>·</span> Tac <span style={{color:OC}}>·</span> Toe <span style={{fontSize:"13px",fontWeight:600,color:MUTE}}>{SIZE}×{SIZE}</span></div>
          <div style={{fontSize:"11px",color:T().MUTE,marginTop:"2px",display:"flex",gap:"6px",justifyContent:"center",flexWrap:"wrap"}}>
            <span>M.{round}</span>
            {isAI&&<span style={{color:aiConf.col}}>· {aiConf.emoji}{aiConf.label}</span>}
            {bestOf>0&&<span style={{color:GOLD}}>· {seriesX}–{seriesO}/{seriesTarget}</span>}
            {rotateOn&&!rotSurprise&&!isOver&&<span style={{color:"#f472b6"}}>· 🌀{ROT_EVR-moveCount%ROT_EVR}</span>}
            {rotateOn&&rotSurprise&&!isOver&&<span style={{color:"#f472b6"}}>· 🌀?</span>}
            {movesUntilSwap!==null&&movesUntilSwap>0&&<span style={{color:"#06b6d4"}}>· 🔀{movesUntilSwap}</span>}
            {swapDone&&<span style={{color:"#06b6d4"}}>· 🔀✓</span>}
          </div>
        </div>
        <button onClick={()=>setShowOpts(true)} style={{width:"38px",height:"38px",borderRadius:"11px",background:T().CARD,border:`1px solid ${T().BORDER}`,color:T().MUTE,fontSize:"17px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>⚙️</button>
      </div>

      <div style={{width:"100%",maxWidth:"440px",padding:"14px 20px 0",display:"flex",flexDirection:"column",gap:"10px"}}>
        {/* Blitz */}
        {blitz&&!cdActive&&<div style={{background:T().CARD,borderRadius:"16px",padding:"14px 16px",border:`1px solid ${txUrgent||toUrgent?`${XC}44`:BORDER}`,boxShadow:`0 1px 4px rgba(0,0,0,0.06)${txUrgent||toUrgent?`,0 0 0 3px ${XC}12`:""}`,transition:"all .3s"}}>
          <div style={{display:"flex",gap:"16px",alignItems:"center"}}>
            {[{p:"X",t:timerX,urg:txUrgent,act:xIsNext},{p:"O",t:timerO,urg:toUrgent,act:!xIsNext}].map(({p,t,urg,act})=>(
              <div key={p} style={{flex:1,opacity:!act&&!isOver?0.4:1,transition:"opacity .3s"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:p==="O"?"flex-end":"flex-start",gap:"6px",marginBottom:"5px"}}>
                  {act&&!isOver&&<span style={{width:"7px",height:"7px",borderRadius:"50%",background:colOf(p),display:"inline-block",animation:"blink .9s infinite"}}/>}
                  <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"clamp(18px,5vw,24px)",color:urg?XC:colOf(p),animation:urg&&act?"urgentPulse .5s ease-in-out infinite":"none"}}>{String(Math.floor(t/60)).padStart(2,"0")}:{String(t%60).padStart(2,"0")}</span>
                </div>
                <div style={{height:"4px",background:T().CHIP2,borderRadius:"2px",overflow:"hidden",transform:p==="O"?"scaleX(-1)":"none"}}><div style={{height:"100%",borderRadius:"2px",background:urg?XG:gradOf(p),width:`${(t/blitzTime)*100}%`,transition:"width .5s ease"}}/></div>
                <div style={{fontSize:"11px",color:T().MUTE,marginTop:"4px",textAlign:p==="O"?"right":"left"}}>{aiThinking&&p==="O"&&isAI?"Réfléchit…":profiles[p].name}</div>
              </div>
            ))}
            <div style={{width:"1px",height:"48px",background:BORDER,flexShrink:0}}/>
          </div>
        </div>}

        {/* Scores */}
        <div style={{display:"flex",gap:"8px"}}>
          {["X","O"].map(p=>{
            const col=colOf(p),grad=gradOf(p),prof=profiles[p];
            const active=cur===p&&!isOver&&!cdActive;const popping=flash===p;const isAiP=isAI&&p==="O";
            return(<div key={p} style={{flex:1,background:T().CARD,borderRadius:"16px",padding:"12px 14px",border:`1.5px solid ${active?col:BORDER}`,boxShadow:active?`0 0 0 3px ${col}18,0 2px 8px rgba(0,0,0,0.06)`:"0 1px 4px rgba(0,0,0,0.06)",transition:"all .2s",position:"relative",overflow:"hidden",transform:popping?"scale(1.04)":"scale(1)"}}>
              {popping&&<div style={{position:"absolute",top:"8px",right:"10px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"14px",color:col,animation:"scoreFlash .7s ease forwards"}}>+1</div>}
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <div style={{width:"36px",height:"36px",borderRadius:"50%",background:`${col}15`,border:`1.5px solid ${col}30`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"18px"}}>{isAiP?"🤖":prof.emoji}<span style={{position:"absolute",bottom:"-2px",right:"-2px",fontSize:"9px",fontWeight:800,color:col,background:T().CARD,borderRadius:"50%",width:"14px",height:"14px",display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${col}22`}}>{_symOf(p)}</span></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                    <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:"12px",color:T().INK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"70px"}}>{isAiP?`IA ${aiConf.emoji}`:prof.name}</span>
                    {!isAiP&&prof.streak>1&&<span style={{fontSize:"10px",fontWeight:700,color:"#f97316"}}>🔥{prof.streak}</span>}
                    {bombCharges[p]>1&&<span style={{fontSize:"10px",fontWeight:700,color:"#f97316",background:"#fff7ed",padding:"1px 5px",borderRadius:"5px"}}>💣×{bombCharges[p]}</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"4px",marginTop:"1px"}}>
                    <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"22px",color:T().INK,lineHeight:1}}>{scores[p]}</span>
                    {!isAiP&&<span style={{fontSize:"10px",color:GOLD,fontWeight:600}}>{prof.points}pts</span>}
                  </div>
                </div>
                {bestOf>0&&<div style={{display:"flex",flexDirection:"column",gap:"3px"}}>{Array.from({length:seriesTarget}).map((_,si)=><div key={si} style={{width:"6px",height:"6px",borderRadius:"50%",background:si<(p==="X"?seriesX:seriesO)?col:"#e7e5e4",transition:"background .3s"}}/>)}</div>}
              </div>
              {active&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:"3px",background:grad,borderRadius:"0 0 14px 14px"}}/>}
            </div>);
          })}
          <div style={{background:T().CARD,borderRadius:"16px",padding:"12px",border:`1px solid ${T().BORDER}`,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"2px"}}>
            <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:"22px",color:MUTE}}>{scores.draws}</div>
            <div style={{fontSize:"9px",color:T().MUTE,letterSpacing:"1px",textTransform:"uppercase"}}>Nuls</div>
          </div>
        </div>

        {/* Status */}
        <div style={{background:T().CARD,borderRadius:"12px",padding:"12px 16px",border:`1px solid ${powerMode?"#7c3aed44":BORDER}`,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",textAlign:"center",transition:"border-color .2s"}}>
          <span style={{fontSize:"14px",fontWeight:600,color:winInfo?colOf(winInfo.w):isDraw?GOLD:powerMode?"#7c3aed":colOf(cur),animation:isOver?"blink 1.1s ease-in-out infinite":"none"}}>
            {aiThinking?"🤖 L'IA réfléchit…":powerMode==="bomb"?"💣 Tap sur une pièce ennemie à capturer":powerMode==="shield"?"🛡️ Tap sur votre pièce à ancrer":winInfo?`🏆 ${isAI&&winInfo.w==="O"?"IA":profiles[winInfo.w]?.name||winInfo.w} gagne !`:isDraw?"🤝 Match nul !":`Tour de ${profiles[cur]?.name||cur}`}
          </span>
        </div>

        {/* Powers */}
        {!isOver&&!cdActive&&(!isAI||xIsNext)&&(bombOn||shieldOn)&&<div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {bombOn&&<PowerPill icon="💣" label="Capturer" color="#f97316" active={powerMode==="bomb"} charges={bombCharges[cur]} onPress={()=>setPowerMode(powerMode==="bomb"?null:"bomb")}/>}
          {shieldOn&&!shieldUsed[cur]&&<PowerPill icon="🛡️" label="Ancrer" color="#a78bfa" active={powerMode==="shield"} charges={1} onPress={()=>setPowerMode(powerMode==="shield"?null:"shield")}/>}
        </div>}

        {/* Board */}
        <div style={{background:T().CARD,borderRadius:"22px",padding:"8px",boxShadow:"0 2px 16px rgba(0,0,0,0.08),0 0 0 1px rgba(0,0,0,0.04)",transform:rotAnim?"rotate(90deg)":"rotate(0deg)",transition:rotAnim?"transform .45s cubic-bezier(.4,0,.2,1)":"none",position:"relative"}}>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${SIZE},${cellSize})`,gridTemplateRows:`repeat(${SIZE},${cellSize})`,position:"relative"}} onMouseLeave={()=>setHover(null)}>
            {squares.map((val,i)=>{
              const col=val?colOf(val):null;const isWin=winInfo?.line?.includes(i);
              const isNVX=i===nextVX,isNVO=i===nextVO;const isVanishing=i===vanishAnim;
              const isShielded=!!shieldedCells[i];
              const isBombTarget=powerMode==="bomb"&&val&&val!==cur&&!shieldedCells[i];
              const isShieldTarget=powerMode==="shield"&&val===cur&&!shieldedCells[i]&&!shieldUsed[cur];
              const canPlay=!val&&!isOver&&!cdActive&&!aiThinking&&(!isAI||xIsNext)&&!powerMode&&!vanishChoice;
              const row=Math.floor(i/SIZE),col2=i%SIZE;const isLastRow=row===SIZE-1,isLastCol=col2===SIZE-1;
              let bg="transparent";
              if(isWin)bg=`${col}10`;else if(isBombTarget)bg="#fff7ed";else if(isShieldTarget)bg="#f5f3ff";
              else if(hover===i&&(canPlay||isBombTarget||isShieldTarget)&&opts.hoverPreview!==false)bg=`${colOf(cur)}07`;

              return(<div key={i} onClick={()=>handleCell(i)} onMouseEnter={()=>setHover(i)}
                style={{display:"flex",alignItems:"center",justifyContent:"center",position:"relative",userSelect:"none",cursor:canPlay||isBombTarget||isShieldTarget?"pointer":"default",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",background:bg,transition:"background .12s",borderRight:!isLastCol?`1.5px solid ${BORDER}`:"none",borderBottom:!isLastRow?`1.5px solid ${BORDER}`:"none",borderRadius:row===0&&col2===0?`${BR}px 0 0 0`:row===0&&isLastCol?`0 ${BR}px 0 0`:isLastRow&&col2===0?`0 0 0 ${BR}px`:isLastRow&&isLastCol?`0 0 ${BR}px 0`:"0"}}>
                {ripple===i&&<div style={{position:"absolute",inset:0,background:`radial-gradient(circle,${colOf(oppOf(cur))}14 0%,transparent 70%)`,animation:"rippleIn .32s ease forwards",pointerEvents:"none"}}/>}
                {(isNVX||isNVO)&&val&&!isVanishing&&<div style={{position:"absolute",inset:"4px",borderRadius:`${BR-4}px`,border:`2px dashed ${isNVX?XC:OC}50`,animation:"vanishWarn 1s ease-in-out infinite",pointerEvents:"none"}}/>}
                {isShielded&&val&&<div style={{position:"absolute",inset:"3px",borderRadius:`${BR-3}px`,border:"2px solid #a78bfa70",pointerEvents:"none"}}/>}
                {isShielded&&val&&<div style={{position:"absolute",top:"3px",left:"3px",width:"12px",height:"12px",borderRadius:"50%",background:"#a78bfa",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"7px"}} title="Ancré">🛡️</div>}
                {isBombTarget&&<div style={{position:"absolute",inset:"3px",borderRadius:`${BR-3}px`,border:"2px solid #f9731660",animation:"vanishWarn .7s ease-in-out infinite",pointerEvents:"none"}}/>}
                {isShieldTarget&&<div style={{position:"absolute",inset:"3px",borderRadius:`${BR-3}px`,border:"2px solid #a78bfa60",animation:"vanishWarn .7s ease-in-out infinite",pointerEvents:"none"}}/>}
                {val&&<span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:symSize,display:"block",lineHeight:1,color:col,opacity:isVanishing?0.05:(isNVX||isNVO)?0.35:1,transform:isVanishing?"scale(0.3) rotate(180deg)":"scale(1)",transition:isVanishing?"all .4s ease":"none",animation:ripple===i?"popIn .2s cubic-bezier(.34,1.56,.64,1) both":"none"}}>{_symOf(val)}</span>}
                {!val&&hover===i&&canPlay&&opts.hoverPreview!==false&&<span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:symSize,display:"block",lineHeight:1,color:colOf(cur),opacity:0.13,pointerEvents:"none"}}>{_symOf(cur)}</span>}
              </div>);
            })}
            {winInfo&&winCoords&&(<svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:5}} viewBox="0 0 100 100" preserveAspectRatio="none"><defs><filter id="gf"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><line x1={winCoords[0]} y1={winCoords[1]} x2={winCoords[2]} y2={winCoords[3]} stroke={colOf(winInfo.w)} strokeWidth="3" strokeLinecap="round" strokeDasharray="150" strokeDashoffset={lineAnim?"0":"150"} filter="url(#gf)" opacity=".85" style={{transition:"stroke-dashoffset .5s cubic-bezier(.4,0,.2,1)"}}/></svg>)}
          </div>
        </div>

        {/* Actions */}
        <div style={{display:"flex",gap:"8px"}}>
          <button onClick={undo} disabled={!stack.length||!!winInfo||isDraw||aiThinking||!!powerMode||!!vanishChoice} style={{flex:1,padding:"14px",fontSize:"14px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,background:T().CARD,border:`1px solid ${T().BORDER}`,color:T().MUTE,cursor:"pointer",borderRadius:"14px",transition:"all .15s",opacity:!stack.length||winInfo||isDraw||aiThinking||powerMode||vanishChoice?0.35:1,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>← Annuler</button>
          <button onClick={nextRound} style={{flex:1.6,padding:"14px",fontSize:"14px",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,background:XG,border:"none",color:"#fff",cursor:"pointer",borderRadius:"14px",boxShadow:`0 3px 12px ${XC}33`,transition:"all .15s",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>↺ Rejouer</button>
        </div>
      </div>
    </div>
  );
}

const getAnim=(T)=>`
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  *,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  html,body{overflow-x:hidden;touch-action:manipulation;background:${T.BG};margin:0;transition:background .3s,color .3s;}
  @keyframes popIn{0%{transform:scale(0) rotate(-12deg);opacity:0}65%{transform:scale(1.2) rotate(3deg)}100%{transform:scale(1) rotate(0);opacity:1}}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0.35}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideUp{from{opacity:0;transform:translateY(22px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes slideUpSheet{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
  @keyframes bounceIn{0%{transform:scale(0);opacity:0}60%{transform:scale(1.16)}100%{transform:scale(1);opacity:1}}
  @keyframes countPop{0%{opacity:0;transform:scale(.28)}70%{transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}
  @keyframes scoreFlash{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-22px) scale(1.35)}}
  @keyframes rippleIn{from{opacity:.28;transform:scale(.1)}to{opacity:0;transform:scale(2.2)}}
  @keyframes vanishWarn{0%,100%{opacity:.35}50%{opacity:.85}}
  @keyframes urgentPulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-12px) scale(.92)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
`;
