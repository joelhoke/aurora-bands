import {test} from 'node:test';
import assert from 'node:assert/strict';
import {samplePath,simplify,smoothStroke,translatePoints,ridgePosition,ribbonGeometry,hitBand,makeBand,preset,validateScene,parseCoordinates} from '../app/bands.ts';
test('all built-in studies are importable, including blank canvas',()=>{
  for(let i=0;i<6;i++)assert.ok(validateScene(preset(i)));
});
test('a smooth path hits its first and last anchors without nonfinite samples',()=>{
  const points=[{x:0,y:10},{x:300,y:200},{x:1200,y:50}];
  const path=samplePath(points);
  assert.deepEqual(path[0],points[0]);assert.deepEqual(path.at(-1),points.at(-1));
  assert.ok(path.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('explicit Bézier handles curve the path',()=>{
  const path=samplePath([{x:0,y:0,hx:0,hy:100},{x:100,y:0,hx:0,hy:-100}]);
  assert.ok(path.some(p=>p.y>60));
});
test('motion is deterministic, and speed zero freezes deformation',()=>{
  const points=[{x:10,y:20},{x:300,y:400}];
  assert.deepEqual(samplePath(points,4,40,1),samplePath(points,4,40,1));
  assert.notDeepEqual(samplePath(points,1,40,1),samplePath(points,2,40,1));
  assert.deepEqual(samplePath(points,1,40,0),samplePath(points,100,40,0));
});
test('freehand simplification keeps endpoints and removes coincident points',()=>{
  assert.deepEqual(simplify([{x:0,y:0},{x:0,y:0},{x:2,y:2},{x:10,y:10}],5),[{x:0,y:0},{x:10,y:10}]);
});
test('coordinate input accepts off-canvas points and rejects malformed input',()=>{
  assert.deepEqual(parseCoordinates('-100, 400\n350, 250; 1200 500'),[{x:-100,y:400},{x:350,y:250},{x:1200,y:500}]);
  for(const value of ['','10, 20','10,20,30\n40,50','Infinity,5\n10,20','10000,2\n3,4'])assert.throws(()=>parseCoordinates(value));
});
test('import rejects invalid dimensions, colors, duplicate ids and huge paths',()=>{
  const changes=[s=>s.bands[0].width=-4,s=>s.bands[0].colors=['red','blue'],s=>s.bands[1].id=s.bands[0].id,s=>s.bands[0].points[0].x=Infinity,s=>s.bands[0].speed=100,s=>s.bands[0].points=Array(301).fill({x:0,y:0})];
  for(const change of changes){const s=preset(0);change(s);assert.equal(validateScene(s),false);}
});

test('natural smoothing removes hand jitter without flattening a broad wave',()=>{
  const wave=x=>300+100*Math.sin(x/600*Math.PI*2);
  const points=Array.from({length:121},(_,i)=>({x:i*5,y:wave(i*5)+(i===0||i===120?0:(i%2?9:-9))}));
  const fitted=smoothStroke(points),smooth=samplePath(fitted);
  assert.ok(fitted.length<=8,`Expected a few anchors, got ${fitted.length}`);
  const rms=values=>Math.sqrt(values.reduce((sum,p)=>sum+(p.y-wave(p.x))**2,0)/values.length);
  assert.ok(rms(smooth)<rms(points)*.4);
  assert.ok(Math.max(...smooth.map(p=>p.y))-Math.min(...smooth.map(p=>p.y))>185);
  assert.deepEqual(smooth[0],points[0]);assert.deepEqual(smooth.at(-1),points.at(-1));
});
test('smoothing is independent of pointer event density on the same stroke',()=>{
  const points=[{x:0,y:0},{x:180,y:90},{x:400,y:-60},{x:600,y:0}];
  const dense=[];
  for(let i=0;i<points.length-1;i++)for(let j=0;j<40;j++){const t=j/40;dense.push({x:points[i].x+(points[i+1].x-points[i].x)*t,y:points[i].y+(points[i+1].y-points[i].y)*t});}
  dense.push(points.at(-1));const a=smoothStroke(points),b=smoothStroke(dense);
  assert.equal(a.length,b.length);a.forEach((p,i)=>assert.ok(Math.hypot(p.x-b[i].x,p.y-b[i].y)<.00001));
});
test('short, repeated and stationary strokes remain finite and do not mutate input',()=>{
  assert.deepEqual(smoothStroke([]),[]);
  assert.deepEqual(smoothStroke([{x:3,y:4},{x:3,y:4}]),[{x:3,y:4}]);
  const points=[{x:0,y:0},{x:1,y:3},{x:2,y:0}],before=structuredClone(points);
  const result=smoothStroke(points);assert.deepEqual(points,before);
  assert.deepEqual({x:result[0].x,y:result[0].y},points[0]);assert.deepEqual({x:result.at(-1).x,y:result.at(-1).y},points.at(-1));
  assert.ok(result.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('long smoothed strokes stay within editable project limits',()=>{
  const points=Array.from({length:10000},(_,i)=>({x:Math.sin(i/100)*400+600,y:Math.cos(i/100)*300+400}));
  const result=smoothStroke(points);assert.ok(result.length<=240);
  const scene=preset(0);scene.bands[0].points=result;assert.ok(validateScene(scene));
});

test('whole-path movement preserves all relative anchors and both curve handles',()=>{
  const p=[{x:10,y:20,hx:50,hy:40},{x:200,y:300,ix:-60,iy:30,hx:20,hy:5}];
  const moved=translatePoints(p,75,-30);
  assert.deepEqual(moved,[{x:85,y:-10,hx:50,hy:40},{x:275,y:270,ix:-60,iy:30,hx:20,hy:5}]);
  assert.equal(p[0].x,10);
  const a=samplePath(p),b=samplePath(moved);
  a.forEach((v,i)=>assert.ok(Math.hypot(b[i].x-v.x-75,b[i].y-v.y+30)<1e-8));
});
test('silk hit testing follows its ridge and asymmetric body, not the old center',()=>{
  const b=makeBand([{x:100,y:400},{x:1100,y:400}],{width:150,amplitude:0});
  assert.equal(ridgePosition('Silk'),.985);
  assert.ok(hitBand(b,{x:600,y:400},0,2));
  assert.ok(hitBand(b,{x:600,y:300},0,2));
  assert.equal(hitBand(b,{x:600,y:450},0,2),false);
  for(const style of ['Radiant','Neon']){b.style=style;assert.ok(hitBand(b,{x:600,y:400},0,2));assert.equal(ridgePosition(style),.5);}
});
test('tight turns narrow the inward ribbon instead of creating a folded offset',()=>{
  const b=makeBand(Array.from({length:9},(_,i)=>({x:600+40*Math.cos(-i*Math.PI/8),y:400+40*Math.sin(-i*Math.PI/8)})),{width:250,amplitude:0});
  const edges=ribbonGeometry(b);
  assert.ok(edges.every(p=>Number.isFinite(p.width)&&p.width>=0));
  assert.ok(edges.slice(10,-10).every(p=>p.width<60));
});
test('independent incoming handles survive project validation and curve sampling',()=>{
  const s=preset(0);s.bands[0].points=[{x:0,y:0,hx:30,hy:0},{x:100,y:0,ix:-30,iy:80}];
  assert.ok(validateScene(s));assert.ok(samplePath(s.bands[0].points).some(p=>p.y>30));
  s.bands[0].points[1].ix=Infinity;assert.equal(validateScene(s),false);
});
