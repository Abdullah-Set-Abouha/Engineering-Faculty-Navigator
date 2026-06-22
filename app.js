/* Antigravity Navigator – Main App
   Loads GLB scans + A* pathfinding + UI */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { ROOMS, EDGES, DEPT_COLORS, FLOOR_H } from "./building-data.js";

/* ═══ 0. PALETTE & ALIGNMENT CONFIG ═══ */
const C = { bg:0xffffff, cyan:0x22d3ee, purple:0xa855f7, green:0x34d399, red:0xf87171 };

// Floor 2 alignment: rotation (degrees) and offset
const f2Align = { x: -2.0, y: 2.6, z: 6.2, rot: 180 };
let f2Model = null; // reference to floor 2 GLB model

/* ═══ 1. GRAPH SETUP ═══ */
const roomMap = new Map();
ROOMS.forEach(r => roomMap.set(r.id, r));

function roomPos3(r){
  if(r.floor === 2){
    // Apply same transform as glbGroups[2] for accurate distance
    const rad = (f2Align.rot * Math.PI) / 180;
    const nx = r.x * Math.cos(rad) - r.z * Math.sin(rad) + f2Align.x;
    const nz = r.x * Math.sin(rad) + r.z * Math.cos(rad) + f2Align.z;
    return new THREE.Vector3(nx, f2Align.y + 3.5, nz);
  }
  return new THREE.Vector3(r.x, 1.5, r.z);
}
function eucDist(a,b){ return roomPos3(a).distanceTo(roomPos3(b)); }

const ADJ = new Map();
ROOMS.forEach(r => ADJ.set(r.id, []));
const edgeSet = new Set();
EDGES.forEach(([a,b]) => {
  const key = [a,b].sort().join("|");
  if(edgeSet.has(key)) return;
  edgeSet.add(key);
  const w = eucDist(roomMap.get(a), roomMap.get(b));
  ADJ.get(a).push({to:b,w});
  ADJ.get(b).push({to:a,w});
});

/* ═══ 2. A* ALGORITHM ═══ */
function astar(startId, goalId){
  const gScore=new Map(), fScore=new Map(), cameFrom=new Map();
  const openSet=new Set([startId]);
  const explored=[];
  const goalRoom=roomMap.get(goalId);
  gScore.set(startId,0);
  fScore.set(startId, eucDist(roomMap.get(startId),goalRoom));
  while(openSet.size){
    let current=null, bestF=Infinity;
    for(const id of openSet){ const f=fScore.get(id)??Infinity; if(f<bestF){bestF=f;current=id;} }
    if(current===goalId){
      const path=[current];
      while(cameFrom.has(current)){current=cameFrom.get(current);path.unshift(current);}
      return {path,explored,dist:gScore.get(goalId)};
    }
    openSet.delete(current);
    explored.push(current);
    for(const {to,w} of ADJ.get(current)){
      const tentG=(gScore.get(current)??Infinity)+w;
      if(tentG<(gScore.get(to)??Infinity)){
        cameFrom.set(to,current);
        gScore.set(to,tentG);
        fScore.set(to,tentG+eucDist(roomMap.get(to),goalRoom));
        openSet.add(to);
      }
    }
  }
  return null;
}

/* ═══ 3. THREE.JS SCENE ═══ */
const viewport = document.getElementById("viewport");
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
scene.fog = new THREE.FogExp2(C.bg, 0.005);

const camera = new THREE.PerspectiveCamera(50,1,0.1,500);
camera.position.set(30,28,35);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.position="absolute";
labelRenderer.domElement.style.top="0";
labelRenderer.domElement.style.left="0";
labelRenderer.domElement.style.pointerEvents="none";
viewport.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=0.07;
controls.minDistance=5; controls.maxDistance=80;
controls.maxPolarAngle=Math.PI/2.05;
controls.target.set(0,3,3);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff,0.45));
const dirLight = new THREE.DirectionalLight(0xffffff,0.9);
dirLight.position.set(20,30,25);
dirLight.castShadow=true;
dirLight.shadow.mapSize.set(2048,2048);
dirLight.shadow.camera.left=-40; dirLight.shadow.camera.right=40;
dirLight.shadow.camera.top=40; dirLight.shadow.camera.bottom=-40;
scene.add(dirLight);
const pCyan = new THREE.PointLight(C.cyan, 0.4, 60);
pCyan.position.set(-15, 12, 15);
scene.add(pCyan);
const pPurple = new THREE.PointLight(C.purple, 0.35, 60);
pPurple.position.set(15, 12, -8);
scene.add(pPurple);

/* ═══ 4. GLB LOADING ═══ */
const glbGroups = { 1: new THREE.Group(), 2: new THREE.Group() };
scene.add(glbGroups[1], glbGroups[2]);

// Apply alignment to the F2 GROUP so all children (model + markers) move together
glbGroups[2].rotation.y = (f2Align.rot * Math.PI) / 180;
glbGroups[2].position.set(f2Align.x, f2Align.y, f2Align.z);

const loader = new GLTFLoader();
const loadOverlay = document.getElementById("loading-overlay");
const loadProgress = document.getElementById("load-progress");
let modelsLoaded = 0;

function loadGLB(url, floor){
  return new Promise((resolve,reject) => {
    loader.load(url, (gltf) => {
      const model = gltf.scene;
      model.traverse(ch => {
        if(ch.isMesh){
          ch.castShadow=true; ch.receiveShadow=true;
          if(ch.material){ ch.material.transparent=true; ch.material.opacity=1; }
        }
      });

      // Model goes into its group at origin — the group handles alignment
      glbGroups[floor].add(model);
      modelsLoaded++;
      loadProgress.textContent = Math.round((modelsLoaded/2)*100)+"%";
      resolve(model);
    },
    (xhr) => {
      if(xhr.total){
        const p = Math.round((xhr.loaded/xhr.total)*50 + (floor-1)*50);
        loadProgress.textContent = p+"%";
      }
    },
    (err) => { console.warn("GLB load error:",err); resolve(null); }
    );
  });
}

// Apply current alignment values to F2 GROUP (moves model + markers together)
function applyF2Alignment(){
  glbGroups[2].rotation.y = (f2Align.rot * Math.PI) / 180;
  glbGroups[2].position.set(f2Align.x, f2Align.y, f2Align.z);
}

/* ═══ 5. NAVIGATION MARKERS (overlay on GLB) ═══ */
const markerGroup = new THREE.Group();
scene.add(markerGroup);
const roomMeshes = new Map();

// F2 markers go into a sub-group so we can offset them separately
const f2MarkerOffset = { x: 0, y: 2.9, z: 0 };
const f2MarkerGroup = new THREE.Group();
f2MarkerGroup.position.set(0, 2.9, 0);
glbGroups[2].add(f2MarkerGroup);

function createMarkers(){
  ROOMS.forEach(room => {
    // Markers go into their floor group at local coords — group handles alignment
    const y = 0.3;
    const color = DEPT_COLORS[room.dept] || 0x3b4252;
    // Disc marker
    const geo = new THREE.CylinderGeometry(0.8,0.8,0.15,16);
    const mat = new THREE.MeshStandardMaterial({
      color, roughness:0.5, metalness:0.1, transparent:true, opacity:0.7,
      emissive:color, emissiveIntensity:0.15
    });
    const mesh = new THREE.Mesh(geo,mat);
    mesh.position.set(room.x,y,room.z);
    mesh.userData = {roomId:room.id};
    mesh.castShadow=true;
    // F2 markers go into the offset sub-group, F1 directly into floor group
    const parent = room.floor === 2 ? f2MarkerGroup : glbGroups[room.floor];
    parent.add(mesh);
    roomMeshes.set(room.id,mesh);

    // Vertical beacon
    const beaconGeo = new THREE.CylinderGeometry(0.04,0.04,2.5,6);
    const beaconMat = new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.3});
    const beacon = new THREE.Mesh(beaconGeo,beaconMat);
    beacon.position.set(room.x,y+1.25,room.z);
    parent.add(beacon);

    // Label
    const div = document.createElement("div");
    div.className="room-label";
    div.textContent=room.label;
    const lbl = new CSS2DObject(div);
    lbl.position.set(room.x,y+3,room.z);
    parent.add(lbl);
  });
}

// Ground plane
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120,120),
  new THREE.MeshStandardMaterial({color:0xf0f0f0,roughness:1})
);
ground.rotation.x=-Math.PI/2; ground.position.y=-0.1; ground.receiveShadow=true;
scene.add(ground);

// Grid
const grid = new THREE.GridHelper(60,60,0xcccccc,0xcccccc);
grid.position.y=0.01; grid.material.opacity=0.3; grid.material.transparent=true;
scene.add(grid);

/* ═══ 6. POPULATE DROPDOWNS ═══ */
const selStart = document.getElementById("sel-start");
const selEnd = document.getElementById("sel-end");

function populateDropdowns(){
  const deptNames = {
    electrical:"Electrical Eng.", chemical:"Chemical Eng.", mechanical:"Mechanical Eng.",
    civil:"Civil Eng.", aeronautical:"Aeronautical Eng.", industrial:"Industrial Eng.",
    mining:"Mining Eng.", core:"Core", corridor:"Corridors",
    stairs:"Stairs", elevator:"Elevators", restroom:"Restrooms",
    emergency:"Emergency", entrance:"Entrances"
  };
  [1,2].forEach(f => {
    const grp = document.createElement("optgroup");
    grp.label = f===1?"━━ First Floor ━━":"━━ Second Floor ━━";
    ROOMS.filter(r=>r.floor===f).forEach(r=>{
      const opt=document.createElement("option");
      opt.value=r.id; opt.textContent=r.label;
      grp.appendChild(opt);
    });
    selStart.appendChild(grp.cloneNode(true));
    selEnd.appendChild(grp);
  });
}
populateDropdowns();

function updateBtnState(){
  document.getElementById("btn-find").disabled = !(selStart.value && selEnd.value && selStart.value!==selEnd.value);
}
selStart.addEventListener("change",()=>{updateBtnState();updateSelectionRings();});
selEnd.addEventListener("change",()=>{updateBtnState();updateSelectionRings();});

/* ═══ 7. SELECTION RINGS ═══ */
let startRing=null, endRing=null;
function makeRing(roomId,color){
  const r=roomMap.get(roomId);
  const pos=roomPos3(r);
  const geo=new THREE.RingGeometry(1.2,1.5,32);
  const mat=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:0.8});
  const m=new THREE.Mesh(geo,mat);
  m.rotation.x=-Math.PI/2; m.position.set(pos.x,pos.y-1.15,pos.z);
  return m;
}
function updateSelectionRings(){
  if(startRing){scene.remove(startRing);startRing=null;}
  if(endRing){scene.remove(endRing);endRing=null;}
  if(selStart.value){startRing=makeRing(selStart.value,C.green);scene.add(startRing);}
  if(selEnd.value){endRing=makeRing(selEnd.value,C.red);scene.add(endRing);}
}

/* ═══ 8. RAYCASTER ═══ */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredId = null;
const tooltip = document.getElementById("room-tooltip");
const allMeshArray = [];

renderer.domElement.addEventListener("mousemove",e=>{
  const rect=renderer.domElement.getBoundingClientRect();
  mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
  mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(allMeshArray);
  if(hoveredId){
    const m=roomMeshes.get(hoveredId);
    if(m){m.material.emissiveIntensity=0.15;}
  }
  if(hits.length){
    const id=hits[0].object.userData.roomId;
    if(!id) return;
    hoveredId=id;
    const m=roomMeshes.get(id);
    if(m) m.material.emissiveIntensity=0.6;
    renderer.domElement.style.cursor="pointer";
    const room=roomMap.get(id);
    const deptLabel = room.dept.charAt(0).toUpperCase()+room.dept.slice(1);
    tooltip.innerHTML=`<div class="tooltip-name">${room.label}</div>
      <div class="tooltip-dept"><span class="tooltip-dept-dot" style="background:#${(DEPT_COLORS[room.dept]||0x3b4252).toString(16).padStart(6,'0')}"></span>${deptLabel}</div>
      <div class="tooltip-meta">Floor ${room.floor} · ${room.w}×${room.d}m</div>`;
    tooltip.classList.add("visible");
  } else {
    hoveredId=null;
    renderer.domElement.style.cursor="default";
    tooltip.classList.remove("visible");
  }
});

renderer.domElement.addEventListener("click",()=>{
  if(!hoveredId) return;
  if(!selStart.value){ selStart.value=hoveredId; }
  else if(!selEnd.value && hoveredId!==selStart.value){ selEnd.value=hoveredId; }
  else { selStart.value=hoveredId; selEnd.value=""; clearRoute(); }
  updateBtnState(); updateSelectionRings();
});

/* ═══ 9. FLOOR SWITCHING ═══ */
let activeFloor="all";
const pills=document.querySelectorAll(".pill");
const floorLabel=document.getElementById("floor-label");

pills.forEach(p=>p.addEventListener("click",()=>{
  pills.forEach(q=>q.classList.remove("active"));
  p.classList.add("active");
  activeFloor=p.dataset.floor;
  doFloorSwitch(activeFloor);
  floorLabel.textContent = activeFloor==="all"?"All Floors":activeFloor==="1"?"First Floor":"Second Floor";
}));

function doFloorSwitch(f){
  const t1=(f==="1"||f==="all")?1:0.05;
  const t2=(f==="2"||f==="all")?1:0.05;
  fadeGroup(glbGroups[1],t1,600);
  fadeGroup(glbGroups[2],t2,600);
  const ty=f==="1"?0:f==="2"?f2Align.y:f2Align.y/2;
  tweenTarget(new THREE.Vector3(0,ty+3,3),600);
}

function fadeGroup(group,target,dur){
  const t0=performance.now();
  const items=[];
  group.traverse(ch=>{
    if(ch.isMesh&&ch.material) items.push(ch);
    if(ch.isCSS2DObject){
      ch.element.style.transition=`opacity ${dur}ms`;
      ch.element.style.opacity=target<0.5?"0":"1";
    }
  });
  const inits=items.map(m=>m.material.opacity);
  (function tick(){
    const t=Math.min((performance.now()-t0)/dur,1);
    const e=1-(1-t)**3;
    items.forEach((m,i)=>{m.material.opacity=inits[i]+(target-inits[i])*e;m.material.transparent=true;});
    if(t<1) requestAnimationFrame(tick);
  })();
}

function tweenTarget(to,dur){
  const t0=performance.now(),from=controls.target.clone();
  (function tick(){
    const t=Math.min((performance.now()-t0)/dur,1);
    controls.target.lerpVectors(from,to,1-(1-t)**3);
    if(t<1) requestAnimationFrame(tick);
  })();
}

/* ═══ 10. ROUTE FINDING ═══ */
let routeTube=null, animating=false, exploredVisuals=[];
const btnFind=document.getElementById("btn-find");
const btnReset=document.getElementById("btn-reset");

btnFind.addEventListener("click",()=>{
  if(!selStart.value||!selEnd.value||animating) return;
  const t0=performance.now();
  const result=astar(selStart.value,selEnd.value);
  const dt=performance.now()-t0;
  if(!result){setStats("—","—","—","—");return;}
  clearRoute();
  animating=true; btnFind.disabled=true;
  const {explored,path,dist:pathDist}=result;
  const floorsCrossed=new Set(path.map(id=>roomMap.get(id).floor)).size;
  if(floorsCrossed>1&&activeFloor!=="all"){
    pills.forEach(p=>p.classList.toggle("active",p.dataset.floor==="all"));
    activeFloor="all"; doFloorSwitch("all");
    floorLabel.textContent="All Floors";
  }
  let step=0;
  function animExplore(){
    if(step<explored.length){
      pulseRoom(explored[step]); step++;
      setStats(step+"/"+explored.length,"—","—","—");
      setTimeout(animExplore,60);
    } else {
      drawRoute(path);
      generateDirections(path);
      setStats(explored.length.toString(),Math.round(pathDist)+"m",dt.toFixed(1)+"ms",floorsCrossed.toString());
      animating=false;
      renderMinimap(explored,path);
    }
  }
  animExplore();
});

function pulseRoom(id){
  const mesh=roomMeshes.get(id);
  if(!mesh) return;
  mesh.material.emissiveIntensity=0.8;
  exploredVisuals.push(id);
  setTimeout(()=>{if(mesh)mesh.material.emissiveIntensity=0.25;},300);
}

function drawRoute(pathIds){
  const points=pathIds.map(id=>{
    const r = roomMap.get(id);
    return roomPos3(r);
  });
  let curve;
  if(points.length===2) curve=new THREE.LineCurve3(points[0],points[1]);
  else curve=new THREE.CatmullRomCurve3(points,false,"centripetal",0.3);
  const tubeGeo=new THREE.TubeGeometry(curve,points.length*16,0.18,8,false);
  const tubeMat=new THREE.MeshBasicMaterial({color:C.cyan,transparent:true,opacity:0.85});
  routeTube=new THREE.Mesh(tubeGeo,tubeMat);
  const glowGeo=new THREE.TubeGeometry(curve,points.length*16,0.5,8,false);
  const glowMat=new THREE.MeshBasicMaterial({color:C.cyan,transparent:true,opacity:0.12});
  const glow=new THREE.Mesh(glowGeo,glowMat); glow.name="glow";
  routeTube.add(glow);
  scene.add(routeTube);
}

function clearRoute(){
  if(routeTube){scene.remove(routeTube);routeTube.geometry.dispose();routeTube.material.dispose();routeTube=null;}
  exploredVisuals.forEach(id=>{const m=roomMeshes.get(id);if(m)m.material.emissiveIntensity=0.15;});
  exploredVisuals=[];
  document.getElementById("directions").innerHTML='<p class="placeholder-text">Select start & destination to get directions</p>';
}

/* ═══ 11. DIRECTIONS ═══ */
function generateDirections(path){
  const el=document.getElementById("directions");
  let html="";
  path.forEach((id,i)=>{
    const room=roomMap.get(id);
    let action="";
    if(i===0) action=`Start at <strong>${room.label}</strong>`;
    else if(i===path.length-1) action=`Arrive at <strong>${room.label}</strong> ✓`;
    else {
      const prev=roomMap.get(path[i-1]);
      if(room.floor!==prev.floor) action=`Take <strong>${prev.label}</strong> to Floor ${room.floor}`;
      else {
        const dx=room.x-prev.x,dz=room.z-prev.z;
        let dir="";
        if(Math.abs(dx)>Math.abs(dz)) dir=dx>0?"east":"west";
        else dir=dz>0?"south":"north";
        action=`Go ${dir} to <strong>${room.label}</strong>`;
      }
    }
    const fb=(i>0&&room.floor!==roomMap.get(path[i-1]).floor)?`<span class="dir-floor-badge">F${room.floor}</span>`:"";
    html+=`<div class="dir-step"><span class="dir-num">${i+1}</span><span class="dir-text">${action}${fb}</span></div>`;
  });
  el.innerHTML=html;
}

/* ═══ 12. STATS & RESET ═══ */
function setStats(explored,dist,time,floors){
  document.getElementById("stat-explored").textContent=explored;
  document.getElementById("stat-distance").textContent=dist;
  document.getElementById("stat-time").textContent=time;
  document.getElementById("stat-floors").textContent=floors;
}

btnReset.addEventListener("click",()=>{
  selStart.value=""; selEnd.value="";
  updateBtnState(); clearRoute();
  if(startRing){scene.remove(startRing);startRing=null;}
  if(endRing){scene.remove(endRing);endRing=null;}
  setStats("—","—","—","—");
  renderMinimap([],[]);
});

/* ═══ 13. VIEW CONTROLS ═══ */
document.getElementById("btn-orbit").addEventListener("click",()=>{
  setActiveView("btn-orbit");
  camera.position.set(30,28,35); controls.target.set(0,3,3);
  controls.maxPolarAngle=Math.PI/2.05;
});
document.getElementById("btn-top").addEventListener("click",()=>{
  setActiveView("btn-top");
  camera.position.set(0,50,0.1); controls.target.set(0,0,3);
  controls.maxPolarAngle=Math.PI/2.05;
});
document.getElementById("btn-walk").addEventListener("click",()=>{
  setActiveView("btn-walk");
  camera.position.set(0,2.5,20); controls.target.set(0,2.5,0);
  controls.maxPolarAngle=Math.PI*0.85;
});
function setActiveView(id){
  document.querySelectorAll(".view-btn").forEach(b=>b.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* ═══ 14. MINIMAP ═══ */
const miniCanvas=document.getElementById("minimap");
const mctx=miniCanvas.getContext("2d");
let miniW,miniH;
function setupMinimap(){
  const dpr=Math.min(devicePixelRatio,2);
  miniW=miniCanvas.clientWidth*dpr; miniH=miniCanvas.clientHeight*dpr;
  miniCanvas.width=miniW; miniCanvas.height=miniH;
}
const MINI_PAD=20;
function mx(room){return((room.x+16)/32)*(miniW-MINI_PAD*2)+MINI_PAD;}
function mz(room){return((22-room.z)/32)*(miniH-MINI_PAD*2)+MINI_PAD;}

function renderMinimap(explored=[],path=[]){
  mctx.clearRect(0,0,miniW,miniH);
  edgeSet.forEach(key=>{
    const [a,b]=key.split("|");
    const ra=roomMap.get(a),rb=roomMap.get(b);
    if(!ra||!rb) return;
    mctx.beginPath(); mctx.moveTo(mx(ra),mz(ra)); mctx.lineTo(mx(rb),mz(rb));
    let onPath=false;
    for(let i=0;i<path.length-1;i++){
      if((path[i]===a&&path[i+1]===b)||(path[i]===b&&path[i+1]===a)){onPath=true;break;}
    }
    if(onPath){mctx.strokeStyle="rgba(34,211,238,0.8)";mctx.lineWidth=2.5;mctx.shadowColor="#22d3ee";mctx.shadowBlur=6;}
    else{mctx.strokeStyle="rgba(255,255,255,0.08)";mctx.lineWidth=1;mctx.shadowBlur=0;}
    mctx.stroke(); mctx.shadowBlur=0;
  });
  const exploredSet=new Set(explored);
  ROOMS.forEach(r=>{
    const x=mx(r),y=mz(r);
    let rad=3.5,fill="#"+(DEPT_COLORS[r.dept]||0x3b4252).toString(16).padStart(6,"0");
    if(exploredSet.has(r.id)){mctx.beginPath();mctx.arc(x,y,7,0,Math.PI*2);mctx.fillStyle="rgba(168,85,247,0.2)";mctx.fill();}
    if(path.includes(r.id)){fill="#22d3ee";rad=4.5;}
    if(r.id===selStart.value){fill="#34d399";rad=5;}
    if(r.id===selEnd.value){fill="#f87171";rad=5;}
    mctx.beginPath();mctx.arc(x,y,rad,0,Math.PI*2);mctx.fillStyle=fill;mctx.fill();
    if(r.dept!=="corridor"||path.includes(r.id)){
      mctx.fillStyle="rgba(226,232,240,0.5)";
      mctx.font=`${7*Math.min(devicePixelRatio,2)}px Inter,sans-serif`;
      mctx.textAlign="center";
      mctx.fillText(r.label,x,y+rad+8);
    }
  });
}

/* ═══ 15. RESIZE ═══ */
function onResize(){
  const w=viewport.clientWidth,h=viewport.clientHeight;
  camera.aspect=w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h); labelRenderer.setSize(w,h);
  setupMinimap(); renderMinimap();
}
window.addEventListener("resize",onResize);

/* ═══ 16. ANIMATION LOOP ═══ */
const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const t=clock.getElapsedTime();
  controls.update();
  if(routeTube){
    routeTube.material.opacity=0.65+0.35*Math.sin(t*3);
    const glow=routeTube.getObjectByName("glow");
    if(glow)glow.material.opacity=0.08+0.08*Math.sin(t*3+1);
  }
  if(startRing) startRing.material.opacity=0.5+0.3*Math.sin(t*4);
  if(endRing) endRing.material.opacity=0.5+0.3*Math.sin(t*4+1.5);
  renderer.render(scene,camera);
  labelRenderer.render(scene,camera);
}

/* ═══ 17. F2 ALIGNMENT CONTROLS ═══ */
const alignX = document.getElementById("align-x");
const alignY = document.getElementById("align-y");
const alignZ = document.getElementById("align-z");
const alignR = document.getElementById("align-r");

function setupAlignControls(){
  if(!alignX) return;

  function updateAlign(){
    f2Align.x = parseFloat(alignX.value);
    f2Align.y = parseFloat(alignY.value);
    f2Align.z = parseFloat(alignZ.value);
    f2Align.rot = parseFloat(alignR.value);
    document.getElementById("align-x-val").textContent = f2Align.x.toFixed(1);
    document.getElementById("align-y-val").textContent = f2Align.y.toFixed(1);
    document.getElementById("align-z-val").textContent = f2Align.z.toFixed(1);
    document.getElementById("align-r-val").textContent = f2Align.rot;
    applyF2Alignment();
  }

  [alignX, alignY, alignZ, alignR].forEach(el => {
    el.addEventListener("input", updateAlign);
  });

  document.getElementById("btn-save-align").addEventListener("click", () => {
    const msg = `F2 Alignment: x=${f2Align.x}, y=${f2Align.y}, z=${f2Align.z}, rot=${f2Align.rot}°`;
    console.log(msg);
    alert(msg);
  });
}

/* ═══ 18. F2 MARKER OFFSET CONTROLS ═══ */
const mkX = document.getElementById("mk-x");
const mkY = document.getElementById("mk-y");
const mkZ = document.getElementById("mk-z");

function setupMarkerOffsetControls(){
  if(!mkX) return;

  function updateMarkerOffset(){
    f2MarkerOffset.x = parseFloat(mkX.value);
    f2MarkerOffset.y = parseFloat(mkY.value);
    f2MarkerOffset.z = parseFloat(mkZ.value);
    document.getElementById("mk-x-val").textContent = f2MarkerOffset.x.toFixed(1);
    document.getElementById("mk-y-val").textContent = f2MarkerOffset.y.toFixed(1);
    document.getElementById("mk-z-val").textContent = f2MarkerOffset.z.toFixed(1);
    // Move the F2 marker sub-group
    f2MarkerGroup.position.set(f2MarkerOffset.x, f2MarkerOffset.y, f2MarkerOffset.z);
  }

  [mkX, mkY, mkZ].forEach(el => {
    el.addEventListener("input", updateMarkerOffset);
  });

  document.getElementById("btn-save-markers").addEventListener("click", () => {
    const msg = `F2 Marker Offset: x=${f2MarkerOffset.x}, y=${f2MarkerOffset.y}, z=${f2MarkerOffset.z}`;
    console.log(msg);
    alert(msg + "\n\nShare these values to hardcode them.");
  });
}

/* ═══ 19. INIT ═══ */
async function init(){
  createMarkers();
  allMeshArray.push(...Array.from(roomMeshes.values()));
  onResize();
  animate();
  setupAlignControls();
  setupMarkerOffsetControls();

  try {
    await Promise.all([
      loadGLB("./models/first_floor.glb",1),
      loadGLB("./models/second_floor.glb",2),
    ]);
  } catch(e){ console.warn("GLB loading issue:",e); }

  loadOverlay.classList.add("hidden");
  renderMinimap();
}
init();
