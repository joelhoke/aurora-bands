import {test} from 'node:test';
import assert from 'node:assert/strict';
import {samplePath,simplify,smoothStroke,preset,validateScene,parseCoordinates} from '../app/bands.ts';
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
  const smooth=smoothStroke(points);
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
  assert.deepEqual(result[0],points[0]);assert.deepEqual(result.at(-1),points.at(-1));
  assert.ok(result.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('long smoothed strokes stay within editable project limits',()=>{
  const points=Array.from({length:10000},(_,i)=>({x:Math.sin(i/100)*400+600,y:Math.cos(i/100)*300+400}));
  const result=smoothStroke(points);assert.ok(result.length<=240);
  const scene=preset(0);scene.bands[0].points=result;assert.ok(validateScene(scene));
});
