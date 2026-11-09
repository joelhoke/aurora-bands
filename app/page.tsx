'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Code2, Copy, Download, Eye, EyeOff, FolderOpen, HelpCircle, Layers, Maximize2, Move, MousePointer2, Pause, PenTool, Pencil, Play, Plus, Redo2, RotateCcw, Save, SlidersHorizontal, Sparkles, Trash2, Undo2, Waves, X } from 'lucide-react';
import { Band, Point, Scene, W, H, makeBand, preset, presets, renderScene, parseCoordinates, samplePath, simplify, smoothStroke, hitBand, translatePoints, uid, validateScene } from './bands';
type Tool = 'move' | 'select' | 'pen' | 'draw';
const INITIAL = preset(0);
const clone = <T,>(v:T):T => JSON.parse(JSON.stringify(v));
function Slider({label,value,min=0,max,step=1,suffix='',onChange,onStart}:{label:string;value:number;min?:number;max:number;step?:number;suffix?:string;onChange:(v:number)=>void;onStart:()=>void}) { return <label className="slider-label"><span>{label}<output>{value.toFixed(step<1?1:0)}<small>{suffix}</small></output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onPointerDown={onStart} onKeyDown={e=>{if(e.key.startsWith('Arrow'))onStart();}} onChange={e=>onChange(+e.target.value)} style={{'--fill':`${(value-min)/(max-min)*100}%`} as React.CSSProperties}/></label>; }
function Thumbnail({index}:{index:number}) { const ref=useRef<HTMLCanvasElement>(null);useEffect(()=>{const c=ref.current;if(c)renderScene(c.getContext('2d')!,preset(index),0,180,110);},[index]); return <canvas ref={ref} width={180} height={110}/>; }
export default function Home() {
  const [scene,setScene]=useState<Scene>(INITIAL), [selected,setSelected]=useState(INITIAL.bands[1].id), [selectedPoint,setSelectedPoint]=useState<number|null>(null), [tool,setTool]=useState<Tool>('move');
  const [playing,setPlaying]=useState(true), [showPaths,setShowPaths]=useState(false), [activePreset,setActivePreset]=useState(0), [modal,setModal]=useState<'coordinates'|'export'|'help'|null>(null);
  const [coordText,setCoordText]=useState('100, 400\n350, 250\n650, 500\n1100, 350'), [coordReplace,setCoordReplace]=useState(false), [error,setError]=useState(''), [toast,setToast]=useState(''), [saved,setSaved]=useState(true), [ready,setReady]=useState(false), [historyTick,setHistoryTick]=useState(0), [draft,setDraft]=useState<Point[]>([]), [focus,setFocus]=useState(false), [mobilePanel,setMobilePanel]=useState(false);
  const dialog=useRef<HTMLElement>(null), canvas=useRef<HTMLCanvasElement>(null), overlay=useRef<HTMLCanvasElement>(null), stage=useRef<HTMLDivElement>(null), timeLabel=useRef<HTMLSpanElement>(null), timeline=useRef<HTMLDivElement>(null), fileInput=useRef<HTMLInputElement>(null);
  const sceneRef=useRef(scene), time=useRef(0), playingRef=useRef(playing), toolRef=useRef(tool), selectedRef=useRef(selected), pointRef=useRef(selectedPoint), pathsRef=useRef(showPaths), draftRef=useRef<Point[]>(draft), history=useRef<Scene[]>([]), future=useRef<Scene[]>([]), drag=useRef<{kind:'anchor'|'handle'|'path'|'pen'|'draw';index:number;start:Point;points?:Point[];moved?:boolean;bandId?:string;side?:'incoming'|'outgoing'} | null>(null), toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  sceneRef.current=scene;playingRef.current=playing;toolRef.current=tool;selectedRef.current=selected;pointRef.current=selectedPoint;pathsRef.current=showPaths;draftRef.current=draft;
  const band=scene.bands.find(b=>b.id===selected);
  function selectBand(id:string){setSelected(id);setSelectedPoint(null);}
  function notify(message:string){setToast(message);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),3200);}
  function checkpoint(){history.current.push(clone(sceneRef.current));if(history.current.length>60)history.current.shift();future.current=[];setHistoryTick(n=>n+1);}
  function change(next:Scene){setScene(next);setSaved(false);}
  function updateBand(patch:Partial<Band>){change({...sceneRef.current,bands:sceneRef.current.bands.map(b=>b.id===selectedRef.current?{...b,...patch}:b)});}
  function deleteSelection(wholePath=false){
    if(!wholePath&&toolRef.current==='pen'){
      setDraft(points=>points.slice(0,-1));return;
    }
    if(!wholePath&&toolRef.current!=='select'&&toolRef.current!=='move')return;
    const current=sceneRef.current.bands.find(b=>b.id===selectedRef.current);
    if(!current)return;
    const point=wholePath?null:pointRef.current;
    if(point!==null&&(point<0||point>=current.points.length))return;
    checkpoint();drag.current=null;
    if(point!==null&&current.points.length>2){
      updateBand({points:current.points.filter((_,i)=>i!==point)});
      setSelectedPoint(null);notify('Point deleted. Undo to restore it.');
    }else{
      change({...sceneRef.current,bands:sceneRef.current.bands.filter(b=>b.id!==current.id)});
      selectBand('');notify(point!==null?'Path deleted — a band needs at least two points. Undo to restore it.':'Path deleted. Undo to restore it.');
    }
  }
  function undo(){if(!history.current.length)return;future.current.push(clone(sceneRef.current));const next=history.current.pop()!;change(next);selectBand(next.bands.some(b=>b.id===selected)?selected:next.bands[0]?.id||'');setHistoryTick(n=>n+1);}
  function redo(){if(!future.current.length)return;history.current.push(clone(sceneRef.current));const next=future.current.pop()!;change(next);selectBand(next.bands.some(b=>b.id===selected)?selected:next.bands[0]?.id||'');setHistoryTick(n=>n+1);}
  function addBand(points:Point[]){if(points.length<2){notify('Add at least two points to make a band.');return;}if(sceneRef.current.bands.length>=40){notify('This canvas supports up to 40 bands.');return;}checkpoint();const b=makeBand(points,{name:`Band ${sceneRef.current.bands.length+1}`});change({...sceneRef.current,bands:[...sceneRef.current.bands,b]});selectBand(b.id);setDraft([]);setTool('move');setShowPaths(true);setPlaying(false);time.current=0;}
  function finish(){if(draftRef.current.length>=2)addBand(toolRef.current==='draw'?smoothStroke(draftRef.current):simplify(draftRef.current,0));else notify('Place at least two points first.');}
  function selectTool(t:Tool){setSelectedPoint(null);setDraft([]);setTool(t);if(t==='pen'||t==='draw'||t==='select'){setPlaying(false);time.current=0;setShowPaths(true);}}
  function openCoordinates(replace=false){setCoordReplace(replace);setCoordText(replace&&band?band.points.map(p=>`${Math.round(p.x)}, ${Math.round(p.y)}`).join('\n'):'100, 400\n350, 250\n650, 500\n1100, 350');setError('');setModal('coordinates');}
  useEffect(()=>{try{const stored=localStorage.getItem('aurora-scene-v1');if(stored){const s=JSON.parse(stored);if(validateScene(s)){setScene(s);selectBand(s.bands[0]?.id||'');setActivePreset(-1);}}}catch{}setReady(true);if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)setPlaying(false);},[]);
  useEffect(()=>{if(!ready)return;const timer=setTimeout(()=>{try{localStorage.setItem('aurora-scene-v1',JSON.stringify(scene));setSaved(true);}catch{setSaved(false);}},500);return()=>clearTimeout(timer);},[scene,ready]);
  useEffect(()=>{let frame=0,last=0,lastScene:Scene|null=null,lastDraft:Point[]|null=null,lastSelected='',lastTool='',lastPaths=false,lastPoint:number|null=null,lastTime=-1;const draw=(now:number)=>{frame=requestAnimationFrame(draw);if(now-last<32)return;const dt=last?Math.min((now-last)/1000,.1):0;last=now;if(playingRef.current)time.current+=dt;if(!playingRef.current&&lastScene===sceneRef.current&&lastDraft===draftRef.current&&lastSelected===selectedRef.current&&lastTool===toolRef.current&&lastPaths===pathsRef.current&&lastPoint===pointRef.current&&lastTime===time.current)return;lastScene=sceneRef.current;lastDraft=draftRef.current;lastSelected=selectedRef.current;lastTool=toolRef.current;lastPaths=pathsRef.current;lastPoint=pointRef.current;lastTime=time.current;const c=canvas.current,o=overlay.current;if(!c||!o)return;const ctx=c.getContext('2d')!,oc=o.getContext('2d')!;renderScene(ctx,sceneRef.current,time.current,W,H);oc.clearRect(0,0,W,H);
    const current=sceneRef.current.bands.find(b=>b.id===selectedRef.current);
    function drawPath(points:Point[],anchors:boolean,highlight:number|null=null,animated?:Band){
      if(!points.length)return;
      const ps=samplePath(points,animated?time.current:0,animated?.amplitude||0,animated?.speed||0);
      const display=(p:Point)=>({x:p.x,y:p.y+(animated?animated.amplitude*Math.sin(p.x/230+time.current*animated.speed)*Math.sin(time.current*animated.speed*.45):0)});
      oc.beginPath();ps.forEach((p,i)=>i?oc.lineTo(p.x,p.y):oc.moveTo(p.x,p.y));oc.strokeStyle='#b14c76';oc.lineWidth=1.6;oc.setLineDash([5,5]);oc.stroke();oc.setLineDash([]);
      if(anchors)for(const [index,base] of points.entries()){
        const p=display(base);
        if(index===highlight){
          const outgoing={x:base.x+(base.hx||0),y:base.y+(base.hy||0)};
          const incoming={x:base.x+(base.ix??-(base.hx||0)),y:base.y+(base.iy??-(base.hy||0))};
          for(const handle of [incoming,outgoing]){
            const h=display(handle);if(Math.hypot(h.x-p.x,h.y-p.y)<1)continue;
            oc.beginPath();oc.moveTo(p.x,p.y);oc.lineTo(h.x,h.y);oc.strokeStyle='#b14c7699';oc.stroke();oc.beginPath();oc.arc(h.x,h.y,4,0,Math.PI*2);oc.fillStyle='#b14c76';oc.fill();
          }
        }
        oc.fillStyle=index===highlight?'#b14c76':'#fff';oc.strokeStyle='#b14c76';oc.lineWidth=2;oc.beginPath();const size=index===highlight?14:10;oc.roundRect(p.x-size/2,p.y-size/2,size,size,2);oc.fill();oc.stroke();
      }
    }
    if(pathsRef.current&&current&&current.visible&&(toolRef.current==='select'||toolRef.current==='move'))drawPath(current.points,toolRef.current==='select',pointRef.current,current);
    drawPath(toolRef.current==='draw'?smoothStroke(draftRef.current):draftRef.current,toolRef.current!=='draw');
    if(timeLabel.current)timeLabel.current.textContent=`${Math.floor(time.current/60).toString().padStart(2,'0')}:${(time.current%60).toFixed(1).padStart(4,'0')}`;if(timeline.current)timeline.current.style.left=`${(time.current%12)/12*100}%`;
  };frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);},[]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{const el=e.target as HTMLElement;if(['INPUT','TEXTAREA','SELECT'].includes(el.tagName)||el.isContentEditable)return;if(modal){if(e.key==='Escape')setModal(null);return;}if((e.metaKey||e.ctrlKey)&&e.key==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();if(!e.repeat)deleteSelection();}else if(e.key===' '){e.preventDefault();setPlaying(v=>!v);}else if(e.key==='Enter')finish();else if(e.key==='Escape'){setSelectedPoint(null);setDraft([]);setTool('move');setFocus(false);}else if(e.key.toLowerCase()==='v')selectTool('move');else if(e.key.toLowerCase()==='a')selectTool('select');else if(e.key.toLowerCase()==='p')selectTool('pen');else if(e.key.toLowerCase()==='b')selectTool('draw');else if(e.key==='?')setModal('help');};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
  useEffect(()=>{
    if(!modal)return;
    const previous=document.activeElement as HTMLElement|null;
    const container=dialog.current;
    const focusable=()=>Array.from(container?.querySelectorAll<HTMLElement>('button:not([disabled]),textarea,input,select,[tabindex="0"]')||[]);
    if(modal!=='coordinates')focusable()[0]?.focus();
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=='Tab')return;
      const elements=focusable(),first=elements[0],last=elements.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',trap);
    return()=>{document.removeEventListener('keydown',trap);previous?.focus();};
  },[modal]);
  function position(e:React.PointerEvent<HTMLCanvasElement>):Point {const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};}
  function pointerDown(e:React.PointerEvent<HTMLCanvasElement>){
    if(e.button!==0)return;const p=position(e);e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);
    if(tool==='draw'){draftRef.current=[p];setDraft([p]);drag.current={kind:'draw',index:0,start:p};return;}
    if(tool==='pen'){const last=draftRef.current.at(-1);if(last&&Math.hypot(last.x-p.x,last.y-p.y)<2)return;const points=[...draftRef.current,p];setDraft(points);drag.current={kind:'pen',index:points.length-1,start:p};return;}
    const hitRadius=10*W/e.currentTarget.getBoundingClientRect().width;
    if(tool==='select'&&showPaths&&band?.visible){
      const display=(q:Point)=>({x:q.x,y:q.y+band.amplitude*Math.sin(q.x/230+time.current*band.speed)*Math.sin(time.current*band.speed*.45)});
      const near=(q:Point)=>{const v=display(q);return Math.hypot(v.x-p.x,v.y-p.y)<hitRadius;};
      const i=band.points.findIndex(near);
      let hi=-1,side:'incoming'|'outgoing'='outgoing';
      if(selectedPoint!==null){const q=band.points[selectedPoint];if(q){
        if(q.hx!==undefined&&near({x:q.x+q.hx,y:q.y+(q.hy||0)}))hi=selectedPoint;
        else if((q.ix!==undefined||q.hx!==undefined)&&near({x:q.x+(q.ix??-(q.hx||0)),y:q.y+(q.iy??-(q.hy||0))})){hi=selectedPoint;side='incoming';}
      }}
      if(i>=0||hi>=0){setSelectedPoint(i>=0?i:hi);setPlaying(false);time.current=0;drag.current={kind:i>=0?'anchor':'handle',index:i>=0?i:hi,start:p,points:clone(band.points),bandId:band.id,side};return;}
    }
    const target=[...scene.bands].reverse().find(b=>hitBand(b,p,time.current,hitRadius));
    selectBand(target?.id||'');
    if(target){setShowPaths(true);setPlaying(false);time.current=0;drag.current={kind:'path',index:-1,start:p,points:clone(target.points),bandId:target.id};}
  }
  function pointerMove(e:React.PointerEvent<HTMLCanvasElement>){
    const d=drag.current;if(!d)return;const p=position(e);
    if(d.kind==='draw'){appendStroke(e);}
    else if(d.kind==='pen'){setDraft(draftRef.current.map((q,i)=>i===d.index?{...q,hx:p.x-d.start.x,hy:p.y-d.start.y}:q));}
    else if(d.points){
      if(!d.moved){if(Math.hypot(p.x-d.start.x,p.y-d.start.y)<2)return;checkpoint();d.moved=true;}
      const points=d.kind==='path'?translatePoints(d.points,p.x-d.start.x,p.y-d.start.y):clone(d.points);
      if(d.kind==='anchor'){points[d.index].x=p.x;points[d.index].y=p.y;}
      else if(d.kind==='handle'){
        const q=points[d.index];
        if(d.side==='incoming'){q.ix=p.x-q.x;q.iy=p.y-q.y;}
        else{q.hx=p.x-q.x;q.hy=p.y-q.y;}
      }
      change({...sceneRef.current,bands:sceneRef.current.bands.map(b=>b.id===d.bandId?{...b,points}:b)});
    }
  }
  function appendStroke(e:React.PointerEvent<HTMLCanvasElement>,includeEndpoint=false){
    const rect=e.currentTarget.getBoundingClientRect();
    const coalesced=e.nativeEvent.getCoalescedEvents?.()||[];
    const events=coalesced.length?coalesced:[e.nativeEvent];
    const points=[...draftRef.current];
    for(const event of events){
      const point={x:(event.clientX-rect.left)/rect.width*W,y:(event.clientY-rect.top)/rect.height*H};
      const last=points.at(-1);
      if(!last||Math.hypot(point.x-last.x,point.y-last.y)>(includeEndpoint?.001:2))points.push(point);
    }
    draftRef.current=points;setDraft(points);return points;
  }
  function pointerUp(e:React.PointerEvent<HTMLCanvasElement>){
    const d=drag.current;drag.current=null;
    if(d?.kind==='draw'){
      const points=smoothStroke(appendStroke(e,true));
      if(points.length>=2)addBand(points);else setDraft([]);
    }
  }
  function smoothSelectedPath(){
    if(!band)return;
    const points=smoothStroke(samplePath(band.points),Math.min(band.points.length,64));checkpoint();updateBand({points});
    setSelectedPoint(null);setShowPaths(true);setPlaying(false);time.current=0;
    notify(`Path simplified: ${band.points.length} → ${points.length} anchors. Undo to restore the original.`);
  }
  function applyCoords(){let points:Point[];try{points=parseCoordinates(coordText);}catch(e){setError((e as Error).message);return;}if(coordReplace&&band){if(points.length===band.points.length)points=points.map((p,i)=>({...band.points[i],...p}));checkpoint();updateBand({points});setSelectedPoint(null);setShowPaths(true);setPlaying(false);time.current=0;}else addBand(points);setModal(null);}
  function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function exportPNG(){const c=document.createElement('canvas');c.width=2400;c.height=1600;renderScene(c.getContext('2d')!,sceneRef.current,time.current,c.width,c.height);c.toBlob(b=>{if(b){download(b,'aurora-study.png');notify('Your 2400 × 1600 PNG is ready.');}},'image/png');setModal(null);}
  function exportProject(){download(new Blob([JSON.stringify(sceneRef.current,null,2)],{type:'application/json'}),'aurora-study.json');setModal(null);notify('Project saved. Import it anytime to keep creating.');}
  async function importProject(file?:File){if(!file)return;try{if(file.size>2000000)throw Error();const s=JSON.parse(await file.text());if(!validateScene(s))throw Error();checkpoint();change(s);selectBand(s.bands[0]?.id||'');setActivePreset(-1);time.current=0;notify('Project opened. Make it your own.');}catch{notify('That file is not a valid Aurora project.');}if(fileInput.current)fileInput.current.value='';}
  return <main className={`app ${focus?'focus-mode':''}`} data-history={historyTick}>
    <header className="topbar"><a className="brand" href="/" aria-label="Aurora home"><span className="brand-symbol"><Waves size={25}/></span><strong>aurora<span>®</span></strong><span className="brand-divider"/><span className="brand-description">a playground for light</span></a><div className="top-actions"><span className="save-status"><span className={saved?'saved-dot':'saving-dot'}/>{saved?'Saved locally':'Saving…'}</span><button className="icon-button" title="Open project" onClick={()=>fileInput.current?.click()}><FolderOpen size={18}/></button><button className="button export-button" onClick={()=>setModal('export')}>Export <ArrowUpRight size={16}/></button></div></header>
    <div className="workspace-heading"><div><div className="eyebrow">THE BAND PLAYGROUND <span>V.01</span></div><h1>A little space to play with light<span>.</span></h1><p>Draw a line. Add a little color. See where it takes you.</p></div><button className="quiet-button" onClick={()=>setModal('help')}><HelpCircle size={16}/> A quick guide <ArrowUpRight size={14}/></button></div>
    <div className="editor-shell">
      <div className="workspace-toolbar"><div className="document-title"><span className="document-dot"/>{scene.title}<span className="small-tag">{scene.bands.length} BANDS</span></div><div className="toolbar-actions"><button className="icon-button" onClick={undo} disabled={!history.current.length} title="Undo (⌘Z)"><Undo2 size={17}/></button><button className="icon-button" onClick={redo} disabled={!future.current.length} title="Redo (⌘⇧Z)"><Redo2 size={17}/></button><button className="icon-button" disabled={!band||(tool!=='select'&&tool!=='move')} onClick={()=>deleteSelection()} title={selectedPoint!==null?'Delete selected point':'Delete selected path'}><Trash2 size={16}/></button><span className="divider"/><button className={`quiet-button path-button ${showPaths?'enabled':''}`} onClick={()=>{setSelectedPoint(null);setShowPaths(v=>!v);if(!showPaths){setPlaying(false);time.current=0;}}}><PenTool size={14}/> Paths</button><button className="icon-button" onClick={()=>setFocus(v=>!v)} title={focus?'Exit focus view':'Focus view'}>{focus?<X size={17}/>:<Maximize2 size={17}/>}</button><button className="icon-button mobile-properties" title="Band properties" onClick={()=>setMobilePanel(v=>!v)}><SlidersHorizontal size={17}/></button></div></div>
      <div className="editor-body"><section className="canvas-area"><div className="canvas-surround"><div className="tool-rail"><button className={tool==='move'?'active':''} aria-label="Move paths tool" title="Move whole paths (V)" onClick={()=>selectTool('move')}><Move size={19}/></button><button className={tool==='select'?'active':''} aria-label="Edit points tool" title="Edit individual points (A)" onClick={()=>selectTool('select')}><MousePointer2 size={19}/></button><span/><button className={tool==='pen'?'active':''} aria-label="Pen tool" title="Pen tool (P)" onClick={()=>selectTool('pen')}><PenTool size={19}/></button><button className={tool==='draw'?'active':''} aria-label="Drawing tool" title="Freehand draw (B)" onClick={()=>selectTool('draw')}><Pencil size={19}/></button><button aria-label="Create from coordinates" title="Create from coordinates" onClick={()=>openCoordinates()}><Code2 size={19}/></button></div>
        <div className="canvas-topline"><span><span className="canvas-label-dot"/> LIVE CANVAS</span><span>1200 × 800 <span className="ratio">3:2</span></span></div>
        <div ref={stage} className={`artboard tool-${tool}`}><canvas ref={canvas} width={W} height={H} aria-label="Animated gradient band artwork"/><canvas className="path-overlay" tabIndex={0} ref={overlay} width={W} height={H} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{drag.current=null;draftRef.current=[];setDraft([]);}} onDoubleClick={()=>{if(tool==='pen')finish();}} aria-label="Drawing canvas"/>{!scene.bands.length&&!draft.length&&<div className="empty-canvas"><Sparkles size={30}/><h2>Something beautiful starts here.</h2><p>Pick the pen or draw tool to make your first band.</p></div>}<div className="canvas-watermark">made of light, shaped by you.</div></div>
        <div className="canvas-hint">{tool==='pen'?<><PenTool size={13}/> Click to place points · drag to curve <button onClick={finish} disabled={draft.length<2}>Finish path ↵</button></>:tool==='draw'?<><Pencil size={13}/> Draw naturally · your wave smooths as you go.</>:showPaths?<><MousePointer2 size={13}/> {selectedPoint!==null?`Point ${selectedPoint+1} selected`:tool==='move'?'Drag a band to move the whole path · A to edit points':'Drag a point to reshape · drag between points to move'}{band&&<button title={selectedPoint!==null&&band.points.length===2?'Deleting this point also removes the path. Undo restores it.':undefined} onClick={()=>deleteSelection()}><Trash2 size={11}/>{selectedPoint!==null?'Delete point':'Delete path'}</button>}</>:<><Sparkles size={13}/> Your next happy accident is one curve away.</>}</div>
      </div>
      <div className="playback"><button className="play-button" aria-label={playing?'Pause animation':'Play animation'} onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={16} fill="currentColor"/>:<Play size={16} fill="currentColor"/>}</button><span className="playback-label">{playing?'In motion':'On pause'}</span><span className="time-display" ref={timeLabel}>00:00.0</span><div className="timeline"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><div className="playhead" ref={timeline}/></div><button className="icon-button" title="Restart animation" onClick={()=>{time.current=0;}}><RotateCcw size={15}/></button><span className="live-badge"><span className={playing?'pulsing':''}/> LIVE</span></div>
      <div className="preset-section"><div className="preset-heading"><span>Start with a feeling</span><small>A few places to begin. Make them yours.</small><span className="preset-count">06 STUDIES</span></div><div className="preset-grid">{presets.map((name,i)=><button key={name} className={`preset ${activePreset===i?'selected':''}`} onClick={()=>{checkpoint();const next=preset(i);change(next);selectBand(next.bands[1]?.id||next.bands[0]?.id||'');setActivePreset(i);setShowPaths(false);setDraft([]);setTool('move');time.current=0;}}><div className="preset-image">{i===5?<div className="blank-preset"><Plus size={20}/></div>:<Thumbnail index={i}/>}<span className="preset-number">0{i+1}</span>{activePreset===i&&<span className="preset-check"><Check size={11}/></span>}</div><span className="preset-name">{name}{i===5&&<ArrowUpRight size={12}/>}</span></button>)}</div></div></section>
      <aside className={`properties ${mobilePanel?'mobile-open':''}`}><div className="panel-heading"><SlidersHorizontal size={15}/><strong>Make it yours</strong><span className="small-tag">PROPERTIES</span></div><section className="layer-section"><div className="section-heading"><span><Layers size={14}/> Bands <small>{scene.bands.length.toString().padStart(2,'0')}</small></span><button className="icon-button" title="Add band with pen" onClick={()=>selectTool('pen')}><Plus size={16}/></button></div><div className="layer-list">{[...scene.bands].reverse().map(b=><div key={b.id} className={`layer ${selected===b.id?'selected':''}`}><button className="layer-select" onClick={()=>selectBand(b.id)}><span className="band-swatch" style={{background:`linear-gradient(120deg,${b.colors.join(',')})`}}/><span>{b.name}</span></button><button className="layer-visibility" title={b.visible?`Hide ${b.name}`:`Show ${b.name}`} onClick={()=>{checkpoint();change({...scene,bands:scene.bands.map(x=>x.id===b.id?{...x,visible:!x.visible}:x)});}}>{b.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button></div>)}{!scene.bands.length&&<p className="empty-layers">Your bands will appear here.</p>}</div><button className="add-band" onClick={()=>selectTool('pen')}><Plus size={14}/> Add a band <span>P</span></button></section>
      {band?<><section className="appearance-section"><div className="section-heading"><span>Appearance</span><div className="mini-actions"><button title="Move selected band forward" className="icon-button" onClick={()=>{const i=scene.bands.findIndex(b=>b.id===selected);if(i===scene.bands.length-1)return;checkpoint();const bs=[...scene.bands];[bs[i],bs[i+1]]=[bs[i+1],bs[i]];change({...scene,bands:bs});}}><ArrowUpRight size={13}/></button><button title="Duplicate selected band" className="icon-button" onClick={()=>{if(scene.bands.length>=40)return;checkpoint();const b={...clone(band),id:uid(),name:band.name+' copy',points:band.points.map(p=>({...p,y:p.y+35}))};change({...scene,bands:[...scene.bands,b]});selectBand(b.id);}}><Copy size={13}/></button><button title="Delete selected band" className="icon-button" onClick={()=>deleteSelection(true)}><Trash2 size={13}/></button></div></div>
      <input className="band-name-input" aria-label="Band name" value={band.name} maxLength={80} onFocus={checkpoint} onChange={e=>updateBand({name:e.target.value})}/><div className="segmented">{(['Silk','Radiant','Neon'] as const).map(style=><button className={band.style===style?'active':''} key={style} onClick={()=>{checkpoint();updateBand({style});}}>{style}</button>)}</div>
      <div className="label-row"><span>Color story</span><button className="text-button" onClick={()=>{checkpoint();updateBand({colors:[...band.colors].reverse()});}}>Reverse <span>⇄</span></button></div><div className="gradient-preview" style={{background:`linear-gradient(90deg,${band.colors.join(',')})`}}/>
      <div className="color-stops">{band.colors.map((c,i)=><div className="color-stop" key={i}><label className="color-chip" style={{background:c}} title={`Color ${i+1}`}><input type="color" aria-label={`Gradient color ${i+1}`} value={c} onFocus={checkpoint} onChange={e=>updateBand({colors:band.colors.map((v,j)=>j===i?e.target.value:v)})}/></label><input className="hex-input" aria-label={`Color ${i+1} hex`} key={c} defaultValue={c.toUpperCase()} maxLength={7} onBlur={e=>{if(/^#[0-9a-f]{6}$/i.test(e.target.value)){if(e.target.value.toLowerCase()!==c.toLowerCase()){checkpoint();updateBand({colors:band.colors.map((v,j)=>j===i?e.target.value:v)});}}else e.target.value=c.toUpperCase();}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>{band.colors.length>2&&<button className="remove-color" title={`Remove color ${i+1}`} onClick={()=>{checkpoint();updateBand({colors:band.colors.filter((_,j)=>j!==i)});}}>×</button>}</div>)}</div><button className="text-button add-color" disabled={band.colors.length>=5} onClick={()=>{checkpoint();updateBand({colors:[...band.colors,'#f7d9c4']});}}><Plus size={12}/> Add color stop</button>
      <Slider label="Band width" value={band.width} min={5} max={400} suffix="px" onStart={checkpoint} onChange={v=>updateBand({width:v})}/><Slider label="Soft glow" value={band.glow} max={100} suffix="%" onStart={checkpoint} onChange={v=>updateBand({glow:v})}/><Slider label="Opacity" value={band.opacity} max={100} suffix="%" onStart={checkpoint} onChange={v=>updateBand({opacity:v})}/></section>
      <section className="motion-section"><div className="section-heading"><span><Waves size={14}/> Motion</span><button role="switch" aria-checked={playing} aria-label="Animate bands" className={`switch ${playing?'on':''}`} onClick={()=>setPlaying(v=>!v)}><span/></button></div><Slider label="Flow speed" value={band.speed} max={3} step={.1} suffix="×" onStart={checkpoint} onChange={v=>updateBand({speed:v})}/><Slider label="Waviness" value={band.amplitude} max={100} suffix="%" onStart={checkpoint} onChange={v=>updateBand({amplitude:v})}/><button className="coordinates-button" onClick={smoothSelectedPath}><Waves size={14}/> Smooth & simplify <Sparkles size={13}/></button><button className="coordinates-button" onClick={()=>openCoordinates(true)}><Code2 size={14}/> Edit path coordinates <ArrowUpRight size={13}/></button></section></>:<div className="no-selection"><PenTool size={24}/><p>{scene.bands.length?'Drag a band to move it. Use Edit points (A) to reshape it.':'Create a band to explore colors, light, and motion.'}</p></div>}
      <section className="canvas-settings"><div className="section-heading"><span>Canvas</span><span className="dimension-label">1200 × 800</span></div><div className="background-control"><span>Background</span><div className="background-swatches">{['#f8f7f4','#ffffff','#10121d'].map(c=><button key={c} title={`Use ${c} background`} className={scene.background===c?'active':''} style={{background:c}} onClick={()=>{checkpoint();change({...scene,background:c});}}/>)}<label title="Custom background" className="custom-bg" style={{background:scene.background}}><input type="color" aria-label="Custom background color" value={scene.background} onFocus={checkpoint} onChange={e=>change({...scene,background:e.target.value})}/><Plus size={12}/></label></div></div></section><div className="panel-footer"><span/> No rules. Just good gradients.</div></aside></div>
    </div><footer className="page-footer"><span>AN EXPERIMENT IN COLOR & MOVEMENT</span><span>Made for your curious side. <Sparkles size={12}/></span><button onClick={()=>setModal('help')}>Keyboard shortcuts <kbd>?</kbd></button></footer>
    <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={e=>importProject(e.target.files?.[0])}/>{toast&&<div className="toast" role="status"><Check size={16}/>{toast}</div>}
    {modal&&<div className="modal-backdrop" onClick={()=>setModal(null)}><section ref={dialog} className="modal" role="dialog" aria-modal="true" aria-label={modal==='coordinates'?'Path coordinates':modal==='export'?'Export your study':'Quick guide'} onClick={e=>e.stopPropagation()}><button className="modal-close icon-button" aria-label="Close dialog" onClick={()=>setModal(null)}><X size={19}/></button>{modal==='coordinates'?<><span className="modal-icon"><Code2 size={23}/></span><h2>A path, point by point.</h2><p>Enter one <strong>x, y</strong> pair per line. The canvas is 1200 × 800, with (0, 0) at the top left. Points connect in a smooth curve.</p><label className="textarea-label">PATH COORDINATES<textarea autoFocus value={coordText} onChange={e=>setCoordText(e.target.value)} spellCheck={false}/></label><div className="coordinate-note">Points outside the canvas are welcome.</div>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button modal-primary" onClick={applyCoords}>{coordReplace?'Update path':'Create band'} <ArrowUpRight size={16}/></button></>:modal==='export'?<><span className="modal-icon"><Download size={23}/></span><h2>Take a little light with you.</h2><p>Export the current moment or save your editable project.</p><button className="export-option" onClick={exportPNG}><span className="export-format">PNG</span><span><strong>Export image</strong><small>2400 × 1600 · current frame · no guides</small></span><Download size={18}/></button><button className="export-option" onClick={exportProject}><span className="export-format">JSON</span><span><strong>Save project</strong><small>All bands, paths, colors, and motion settings</small></span><Save size={18}/></button><p className="export-note">Use the folder icon to reopen a saved project. Your current work also saves automatically in this browser.</p></>:<><span className="modal-icon"><Sparkles size={23}/></span><h2>Follow your curiosity.</h2><p>A few small tools. Endless ways to play.</p><div className="guide-list"><div><MousePointer2/><span><strong>Move paths <kbd>V / A</kbd></strong>Use Move (V) to drag an entire band, including its handles. Switch to Edit points (A) to select and drag individual anchors; click an anchor to reveal its curve handles. Press Delete/Backspace or use the trash button to delete the selection. Deleting from a two-point path removes the path. Undo restores either.</span></div><div><PenTool/><span><strong>Pen tool <kbd>P</kbd></strong>Click to add points. Drag as you place a point to create a Bézier handle. Press Enter to finish.</span></div><div><Pencil/><span><strong>Freehand <kbd>B</kbd></strong>Draw a line, then release. Natural smoothing removes small hand jitters while keeping your wave and endpoints. Use Smooth & simplify to soften an existing band and reduce its anchors; Undo restores its original shape.</span></div><div><Code2/><span><strong>Coordinates</strong>Use precise x, y points to create a band or edit an existing path.</span></div><div><Play/><span><strong>Play / pause <kbd>Space</kbd></strong>Motion is independent for every band. Use ⌘/Ctrl Z to undo and Shift ⌘/Ctrl Z to redo.</span></div></div><p className="export-note">Backspace removes the last unfinished pen point. Escape cancels an unfinished path or clears a point selection. Presets replace your canvas; Undo brings your previous work back.</p></>}</section></div>}
  </main>;
}
