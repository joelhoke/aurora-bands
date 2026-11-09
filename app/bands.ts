export type Point = { x: number; y: number; hx?: number; hy?: number };
export type Band = { id: string; name: string; points: Point[]; colors: string[]; width: number; glow: number; opacity: number; speed: number; amplitude: number; style: 'Silk' | 'Radiant' | 'Neon'; visible: boolean };
export type Scene = { bands: Band[]; background: string; title: string };
export const W = 1200, H = 800;
export const uid = () => Math.random().toString(36).slice(2, 10);
export const makeBand = (points: Point[], options: Partial<Band> = {}): Band => ({ id: uid(), name: 'Untitled band', points, colors: ['#ff91a8', '#c1a5f5', '#8bd9ed'], width: 150, glow: 18, opacity: 88, speed: 0.7, amplitude: 20, style: 'Silk', visible: true, ...options });
const p = (x: number, y: number): Point => ({ x, y });
export const presets = ['Daydream', 'Afterglow', 'Electric', 'Tidal', 'Solar', 'Blank canvas'];
export function preset(index: number): Scene {
  const base = [
    makeBand([p(-150, 230), p(220, 450), p(590, 370), p(960, 220), p(1350, 300)], { name: 'Peach current', colors: ['#f7bb93', '#ff798b', '#e8b3f5'], width: 205, glow: 23, amplitude: 16 }),
    makeBand([p(-150, 480), p(260, 555), p(630, 390), p(960, 390), p(1350, 270)], { name: 'Rose ribbon', colors: ['#ffbca5', '#f774af', '#cfb2ef'], width: 170, glow: 12, amplitude: 25 }),
    makeBand([p(-150, 310), p(240, 430), p(600, 470), p(950, 580), p(1350, 420)], { name: 'Blue hour', colors: ['#b8e2dd', '#c1d2ef', '#77d7ec'], width: 140, glow: 15, opacity: 72, amplitude: 19 }),
  ];
  if (index === 5) return { bands: [], background: '#f8f7f4', title: 'Untitled study' };
  const palettes = [[], ['#ff956b', '#f169a2', '#7959d8'], ['#9a59ff', '#ff63cb', '#5cf4ff'], ['#66bfc5', '#9ce7d3', '#789cea'], ['#ffbc41', '#ff795c', '#f5bf92']];
  if (index) base.forEach((b, i) => { b.colors = palettes[index].map((_, j) => palettes[index][(i + j) % 3]); b.style = index === 2 ? 'Neon' : index === 4 ? 'Radiant' : 'Silk'; b.glow = index === 2 ? 50 : 25; });
  return { bands: base, background: index === 2 ? '#10121d' : index === 1 ? '#251b33' : '#f8f7f4', title: presets[index] + ' study' };
}
export function samplePath(points: Point[], time = 0, amplitude = 0, speed = 0): Point[] {
  if (points.length < 2) return points;
  const result: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 2)];
    const c1 = { x: a.x + (a.hx ?? (b.x - prev.x) / 6), y: a.y + (a.hy ?? (b.y - prev.y) / 6) };
    const c2 = { x: b.x - (b.hx ?? (next.x - a.x) / 6), y: b.y - (b.hy ?? (next.y - a.y) / 6) };
    const steps = Math.max(4, Math.min(100, Math.ceil(700 / points.length), Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/7)));
    for (let j = 0; j <= steps; j++) {
      if (i && j === 0) continue;
      const t = j / steps, u = 1 - t;
      const x = u*u*u*a.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*b.x;
      let y = u*u*u*a.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*b.y;
      y += amplitude * Math.sin(x / 230 + time * speed) * Math.sin(time * speed * 0.45);
      result.push({ x, y });
    }
  }
  return result;
}
function rgb(hex: string) { return [1, 3, 5].map(n => parseInt(hex.slice(n, n+2), 16)); }
function colorAt(colors: string[], t: number) {
  const v = Math.max(0, Math.min(.9999, t)) * (colors.length - 1), i = Math.floor(v), f = v - i;
  const a = rgb(colors[i]), b = rgb(colors[Math.min(i+1, colors.length-1)]);
  return a.map((n,j) => Math.round(n + (b[j]-n)*f));
}
export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene, time: number, width = W, height = H) {
  ctx.clearRect(0, 0, width, height); ctx.save(); ctx.scale(width/W,height/H);
  ctx.fillStyle = scene.background; ctx.fillRect(0,0,W,H);
  for (const band of scene.bands) {
    if (!band.visible || band.points.length < 2) continue;
    const pts = samplePath(band.points, time, band.amplitude, band.speed);
    const edge = pts.map((pt,i) => {
      const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)], len=Math.hypot(b.x-a.x,b.y-a.y)||1;
      const taper = .6 + .4 * Math.sin(Math.PI * i/(pts.length-1));
      const half = band.width/2 * taper;
      return { x:pt.x,y:pt.y,nx:-(b.y-a.y)/len,ny:(b.x-a.x)/len,half };
    });
    ctx.save(); ctx.globalAlpha=band.opacity/100;
    if (band.glow > 0) {
      ctx.save(); ctx.filter=`blur(${band.glow * .65}px)`;
      ctx.globalAlpha *= band.style === 'Neon' ? .8 : .3;
      ctx.strokeStyle=band.colors[1] || band.colors[0]; ctx.lineWidth=band.width * 1.15; ctx.lineCap='round';
      ctx.beginPath(); pts.forEach((q,i)=> i ? ctx.lineTo(q.x,q.y) : ctx.moveTo(q.x,q.y)); ctx.stroke(); ctx.restore();
    }
    // Paint continuous strips along the whole curve, avoiding seams across its length.
    const profiles = band.style === 'Silk'
      ? [[0,0,0],[.12,.25,.3],[.42,.65,.15],[.72,.85,0],[.94,.7,.45],[.985,.95,.92],[1,.18,0]]
      : band.style === 'Radiant'
      ? [[0,0,0],[.22,.35,0],[.5,.95,.65],[.7,.7,0],[1,0,0]]
      : [[0,0,0],[.35,.25,0],[.48,1,.4],[.5,1,.98],[.53,1,.4],[.7,.2,0],[1,0,0]];
    const first=pts[0], last=pts[pts.length-1];
    const dx=last.x-first.x,dy=last.y-first.y;
    const gradientEnd=Math.hypot(dx,dy)>1?last:{x:first.x+W,y:first.y};
    const strips = Math.max(80, Math.ceil(band.width / 1.5));
    for(let strip=0;strip<strips;strip++) {
      const t=(strip+.5)/strips;
      let k=0;while(k<profiles.length-2 && profiles[k+1][0]<t)k++;
      const a=profiles[k],b=profiles[k+1],f=(t-a[0])/(b[0]-a[0]);
      const alpha=a[1]+(b[1]-a[1])*f,white=a[2]+(b[2]-a[2])*f;
      const g=ctx.createLinearGradient(first.x,first.y,gradientEnd.x,gradientEnd.y);
      for(let c=0;c<=8;c++) {
        const progress=c/8;
        const rgb=colorAt(band.colors,progress+.18*Math.sin(time*band.speed*.5+progress*3));
        g.addColorStop(progress,`rgba(${rgb.map(n=>Math.round(n+(255-n)*white)).join(',')},${alpha})`);
      }
      ctx.fillStyle=g;ctx.beginPath();
      const lo=2*(strip/strips)-1,hi=2*((strip+1.12)/strips)-1;
      edge.forEach((q,i)=>{const x=q.x+q.nx*q.half*lo,y=q.y+q.ny*q.half*lo;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
      for(let i=edge.length-1;i>=0;i--){const q=edge[i];ctx.lineTo(q.x+q.nx*q.half*hi,q.y+q.ny*q.half*hi);}
      ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}
export function simplify(points: Point[], distance = 45): Point[] {
  const result=[points[0]];
  for(let i=1;i<points.length-1;i++) if(Math.hypot(points[i].x-result[result.length-1].x,points[i].y-result[result.length-1].y)>=Math.max(distance,1)) result.push(points[i]);
  if(points.length>1 && Math.hypot(points.at(-1)!.x-result.at(-1)!.x,points.at(-1)!.y-result.at(-1)!.y)>1) result.push(points[points.length-1]);
  return result;
}
export function validateScene(value: unknown): value is Scene {
  if(!value || typeof value!=='object') return false;
  const s=value as Scene, hex=/^#[0-9a-f]{6}$/i;
  return typeof s.title==='string' && s.title.length<200 && hex.test(s.background) && Array.isArray(s.bands) && s.bands.length<=40 && new Set(s.bands.map(b=>b.id)).size===s.bands.length && s.bands.every(b=>typeof b.id==='string' && typeof b.name==='string' && b.name.length<200 && typeof b.visible==='boolean' && ['Silk','Radiant','Neon'].includes(b.style) && Array.isArray(b.colors) && b.colors.length>=2 && b.colors.length<=8 && b.colors.every(c=>hex.test(c)) && Array.isArray(b.points) && b.points.length>=2 && b.points.length<=300 && b.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<10000&&Math.abs(p.y)<10000 && [p.hx,p.hy].every(n=>n===undefined||(Number.isFinite(n)&&Math.abs(n)<10000))) && [['width',5,400],['glow',0,100],['opacity',0,100],['speed',0,3],['amplitude',0,100]].every(([k,min,max])=>Number.isFinite(b[k as keyof Band]) && Number(b[k as keyof Band])>=Number(min) && Number(b[k as keyof Band])<=Number(max)));
}

export function parseCoordinates(text: string): Point[] {
  const rows=text.trim().split(/[\n;]+/), points:Point[]=[];
  for(const row of rows) {
    const pair=row.trim().split(/[\s,]+/).map(Number);
    if(pair.length!==2||pair.some(n=>!Number.isFinite(n)||Math.abs(n)>=10000)) throw new Error('Use one x, y pair per line. Values must be between −9999 and 9999.');
    points.push({x:pair[0],y:pair[1]});
  }
  if(points.length<2||points.length>300) throw new Error('Enter between 2 and 300 points.');
  return points;
}
