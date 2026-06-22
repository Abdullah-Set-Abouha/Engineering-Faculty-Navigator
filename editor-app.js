/* Antigravity — Marker Calibration Editor
   Click on 3D scan to place/move room markers, export as JSON */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* ═══ CONSTANTS ═══ */
const FLOOR_H = 5.0;
const DEPT_COLORS = {
  electrical: 0x1a3a7a, chemical: 0x2d7ab8, mechanical: 0x6bcf8a,
  civil: 0x1a8a5a, aeronautical: 0xc49a6c, industrial: 0xe8c844,
  mining: 0x3a2a6a, core: 0xb89a7a, corridor: 0x3b4252,
  stairs: 0x94a3b8, elevator: 0x64748b, restroom: 0xef4444,
  emergency: 0x22c55e, entrance: 0x22d3ee,
};

/* ═══ STATE ═══ */
let markers = []; // {id, label, dept, floor, x, y, z}
let selectedId = null;
let editMode = "place"; // "navigate","place","move"
let activeFloor = 1;
let nextId = 1;
let undoStack = [];
const MAX_UNDO = 30;
let zones = [];
let selectedZoneId = null;
let nextZoneId = 1;

/* ═══ HELPERS ═══ */
function toast(msg, type = "info") {
  const c = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function pushUndo(label) {
  undoStack.push({ label, snapshot: JSON.parse(JSON.stringify(markers)), selectedId });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  updateUndoUI();
}

function performUndo() {
  if (!undoStack.length) return;
  const state = undoStack.pop();
  markers.forEach(m => removeMarker3D(m.id));
  markers = state.snapshot;
  nextId = Math.max(...markers.map(m => m.id), 0) + 1;
  selectedId = state.selectedId;
  refreshAllMarkers();
  renderMarkerList();
  if (selectedId) showEditForm(selectedId);
  else editForm.classList.remove("visible");
  updateUndoUI();
  toast("Undone: " + state.label, "info");
}

function updateUndoUI() {
  const btn = document.getElementById("btn-undo");
  const text = document.getElementById("undo-text");
  btn.disabled = !undoStack.length;
  text.textContent = undoStack.length ? `${undoStack.length} action${undoStack.length > 1 ? "s" : ""}` : "No actions";
}

/* ═══ THREE.JS SETUP ═══ */
const viewport = document.getElementById("viewport");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060910);
scene.fog = new THREE.FogExp2(0x060910, 0.005);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
camera.position.set(30, 28, 35);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 2;
controls.maxDistance = 100;
controls.target.set(0, 2, 3);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dl = new THREE.DirectionalLight(0xffffff, 0.9);
dl.position.set(20, 30, 25); dl.castShadow = true;
dl.shadow.mapSize.set(2048, 2048);
dl.shadow.camera.left = -40; dl.shadow.camera.right = 40;
dl.shadow.camera.top = 40; dl.shadow.camera.bottom = -40;
scene.add(dl);

// Ground + Grid
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x060910, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1;
ground.receiveShadow = true;
ground.name = "ground";
scene.add(ground);

const grid = new THREE.GridHelper(80, 80, 0x152030, 0x152030);
grid.position.y = 0.01;
grid.material.opacity = 0.4;
grid.material.transparent = true;
scene.add(grid);

const axes = new THREE.AxesHelper(5);
axes.position.y = 0.02;
scene.add(axes);

/* ═══ FLOOR 2 ALIGNMENT (must match main app.js) ═══ */
const f2Align = { x: -2.0, y: 2.6, z: 6.2, rot: 180 };

/* ═══ GLB LOADING ═══ */
const glbGroups = { 1: new THREE.Group(), 2: new THREE.Group() };
scene.add(glbGroups[1], glbGroups[2]);

// Apply F2 alignment so the editor matches the main navigator
glbGroups[2].rotation.y = (f2Align.rot * Math.PI) / 180;
glbGroups[2].position.set(f2Align.x, f2Align.y, f2Align.z);

// F2 markers go into an offset sub-group (must match main app.js)
const f2MarkerGroup = new THREE.Group();
f2MarkerGroup.position.set(0, 2.9, 0);
glbGroups[2].add(f2MarkerGroup);

const loader = new GLTFLoader();
const loadOverlay = document.getElementById("loading-overlay");
const loadProgress = document.getElementById("load-progress");
let glbMeshes = [];

function loadGLB(url, floor) {
  return new Promise((resolve) => {
    loader.load(url, (gltf) => {
      const model = gltf.scene;
      // Model goes into its group at origin — the group handles alignment
      model.traverse(ch => {
        if (ch.isMesh) {
          ch.castShadow = true;
          ch.receiveShadow = true;
          if (ch.material) { ch.material.transparent = true; ch.material.opacity = 1; }
          ch.userData.isGLB = true;
          ch.userData.floor = floor;
          glbMeshes.push(ch);
        }
      });
      glbGroups[floor].add(model);
      resolve(model);
    },
      (xhr) => {
        if (xhr.total) {
          const p = Math.round((xhr.loaded / xhr.total) * 50 + (floor - 1) * 50);
          loadProgress.textContent = p + "%";
        }
      },
      (err) => { console.warn("GLB load error:", err); resolve(null); }
    );
  });
}

/* ═══ MARKER 3D OBJECTS ═══ */
const markerMeshes = new Map();

function createMarker3D(marker) {
  // Markers are children of the floor group, so use local Y only
  const y = marker.y;
  const color = DEPT_COLORS[marker.dept] || 0x3b4252;

  // Disc
  const geo = new THREE.CylinderGeometry(0.6, 0.6, 0.2, 16);
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.4, metalness: 0.1,
    emissive: color, emissiveIntensity: 0.3
  });
  const disc = new THREE.Mesh(geo, mat);
  disc.position.set(marker.x, y, marker.z);
  disc.userData.markerId = marker.id;

  // Beacon pole
  const bGeo = new THREE.CylinderGeometry(0.04, 0.04, 3, 6);
  const bMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
  const beacon = new THREE.Mesh(bGeo, bMat);
  beacon.position.set(marker.x, y + 1.5, marker.z);

  // Top sphere
  const sGeo = new THREE.SphereGeometry(0.18, 12, 12);
  const sMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const sphere = new THREE.Mesh(sGeo, sMat);
  sphere.position.set(marker.x, y + 3, marker.z);

  // Label sprite
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(8,11,20,0.85)";
  ctx.roundRect(0, 0, 256, 64, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(34,211,238,0.3)";
  ctx.lineWidth = 2;
  ctx.roundRect(0, 0, 256, 64, 8);
  ctx.stroke();
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 24px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(marker.label || "???", 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(marker.x, y + 4, marker.z);
  sprite.scale.set(3, 0.75, 1);

  // F2 markers go into the offset sub-group, F1 directly into floor group
  const parent = marker.floor === 2 ? f2MarkerGroup : glbGroups[marker.floor];
  parent.add(disc, beacon, sphere, sprite);
  markerMeshes.set(marker.id, { disc, beacon, sphere, sprite, floor: marker.floor });
  return disc;
}

function removeMarker3D(id) {
  const m = markerMeshes.get(id);
  if (!m) return;
  const parent = m.floor === 2 ? f2MarkerGroup : glbGroups[m.floor];
  parent.remove(m.disc, m.beacon, m.sphere, m.sprite);
  m.disc.geometry.dispose(); m.disc.material.dispose();
  m.beacon.geometry.dispose(); m.beacon.material.dispose();
  m.sphere.geometry.dispose(); m.sphere.material.dispose();
  m.sprite.material.map.dispose(); m.sprite.material.dispose();
  markerMeshes.delete(id);
}

function updateMarker3D(marker) {
  removeMarker3D(marker.id);
  createMarker3D(marker);
}

function refreshAllMarkers() {
  markerMeshes.forEach((_, id) => removeMarker3D(id));
  markers.forEach(m => createMarker3D(m));
}

/* ═══ UI: MARKER LIST ═══ */
const markerList = document.getElementById("marker-list");
const markerCount = document.getElementById("marker-count");
const statusMarkerCount = document.getElementById("status-marker-count");
const searchInput = document.getElementById("marker-search");

searchInput.addEventListener("input", renderMarkerList);

function renderMarkerList() {
  const query = searchInput.value.toLowerCase().trim();
  const filtered = query ? markers.filter(m =>
    m.label.toLowerCase().includes(query) ||
    m.dept.toLowerCase().includes(query)
  ) : markers;

  markerCount.textContent = markers.length;
  statusMarkerCount.textContent = markers.length;

  if (!filtered.length) {
    markerList.innerHTML = `<div class="marker-item empty-state">${markers.length ? "No matches" : "No markers yet — use Place mode"}</div>`;
    return;
  }

  let html = "";
  filtered.forEach(m => {
    const color = "#" + (DEPT_COLORS[m.dept] || 0x3b4252).toString(16).padStart(6, "0");
    const sel = m.id === selectedId ? "selected" : "";
    html += `<div class="marker-item ${sel}" data-id="${m.id}">
      <span class="color-dot" style="background:${color}"></span>
      <span class="name">${m.label || "???"}</span>
      <span class="floor-tag">F${m.floor}</span>
      <span class="coords">(${m.x.toFixed(1)}, ${m.z.toFixed(1)})</span>
    </div>`;
  });
  markerList.innerHTML = html;

  markerList.querySelectorAll(".marker-item[data-id]").forEach(el => {
    el.addEventListener("click", () => {
      selectedId = parseInt(el.dataset.id);
      renderMarkerList();
      showEditForm(selectedId);
      highlightMarker(selectedId);
    });
  });
}

function highlightMarker(id) {
  markerMeshes.forEach((m, mid) => {
    m.disc.material.emissiveIntensity = mid === id ? 0.8 : 0.3;
    m.sphere.material.color.setHex(mid === id ? 0x34d399 : 0x22d3ee);
  });
}

/* ═══ UI: EDIT FORM ═══ */
const editForm = document.getElementById("edit-form");

function showEditForm(id) {
  const m = markers.find(m => m.id === id);
  if (!m) { editForm.classList.remove("visible"); return; }
  editForm.classList.add("visible");
  document.getElementById("edit-label").value = m.label;
  document.getElementById("edit-dept").value = m.dept;
  document.getElementById("edit-x").value = m.x.toFixed(1);
  document.getElementById("edit-y").value = m.y.toFixed(1);
  document.getElementById("edit-z").value = m.z.toFixed(1);
  // Update floor selector
  document.querySelectorAll(".floor-sel-btn").forEach(b => {
    b.classList.toggle("active", parseInt(b.dataset.editFloor) === m.floor);
  });
}

// Floor selector in edit form
document.querySelectorAll(".floor-sel-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".floor-sel-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

document.getElementById("btn-save-marker").addEventListener("click", () => {
  const m = markers.find(m => m.id === selectedId);
  if (!m) return;
  pushUndo("Edit " + m.label);
  m.label = document.getElementById("edit-label").value;
  m.dept = document.getElementById("edit-dept").value;
  m.x = parseFloat(document.getElementById("edit-x").value) || 0;
  m.y = parseFloat(document.getElementById("edit-y").value) || 0;
  m.z = parseFloat(document.getElementById("edit-z").value) || 0;
  const activeFloorBtn = document.querySelector(".floor-sel-btn.active");
  if (activeFloorBtn) m.floor = parseInt(activeFloorBtn.dataset.editFloor);
  updateMarker3D(m);
  renderMarkerList();
  toast("Marker saved", "success");
});

document.getElementById("btn-delete-marker").addEventListener("click", () => {
  const m = markers.find(m => m.id === selectedId);
  if (!m) return;
  pushUndo("Delete " + m.label);
  markers = markers.filter(m => m.id !== selectedId);
  removeMarker3D(selectedId);
  selectedId = null;
  editForm.classList.remove("visible");
  renderMarkerList();
  toast("Marker deleted", "error");
});

document.getElementById("btn-duplicate-marker").addEventListener("click", () => {
  const m = markers.find(m => m.id === selectedId);
  if (!m) return;
  pushUndo("Clone " + m.label);
  const clone = { ...m, id: nextId++, label: m.label + " (copy)", x: m.x + 1, z: m.z + 1 };
  markers.push(clone);
  createMarker3D(clone);
  selectedId = clone.id;
  renderMarkerList();
  showEditForm(clone.id);
  toast("Marker cloned", "success");
});

document.getElementById("btn-add-marker").addEventListener("click", () => {
  pushUndo("Add marker");
  const m = { id: nextId++, label: "Room " + nextId, dept: "core", floor: activeFloor, x: 0, y: 0.3, z: 0 };
  markers.push(m);
  createMarker3D(m);
  selectedId = m.id;
  renderMarkerList();
  showEditForm(m.id);
  toast("Marker added at origin", "info");
});

document.getElementById("btn-clear-all").addEventListener("click", () => {
  if (!markers.length) return;
  if (!confirm("Delete ALL markers? This can be undone.")) return;
  pushUndo("Clear all");
  markers.forEach(m => removeMarker3D(m.id));
  markers = [];
  selectedId = null;
  editForm.classList.remove("visible");
  renderMarkerList();
  toast("All markers cleared", "error");
});

/* ═══ UI: MODES ═══ */
const modeButtons = {
  navigate: document.getElementById("mode-navigate"),
  place: document.getElementById("mode-place"),
  move: document.getElementById("mode-move")
};

Object.entries(modeButtons).forEach(([mode, btn]) => {
  btn.addEventListener("click", () => {
    editMode = mode;
    Object.values(modeButtons).forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector("#status .mode-label").textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    document.getElementById("crosshair").classList.toggle("visible", mode !== "navigate");
  });
});

/* ═══ UI: FLOOR SWITCHING ═══ */
const floorBtns = document.querySelectorAll(".floor-group .floor-btn");
floorBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    floorBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const f = btn.dataset.floor;
    activeFloor = f === "all" ? 1 : parseInt(f);
    document.getElementById("status-floor").textContent = f === "all" ? "All" : f;
    const t1 = (f === "1" || f === "all") ? 1 : 0.05;
    const t2 = (f === "2" || f === "all") ? 1 : 0.05;
    fadeGroup(glbGroups[1], t1);
    fadeGroup(glbGroups[2], t2);
  });
});

function fadeGroup(group, target) {
  group.traverse(ch => {
    if (ch.isMesh && ch.material) {
      ch.material.opacity = target;
      ch.material.transparent = true;
    }
    if (ch.isSprite) { ch.material.opacity = target; ch.material.transparent = true; }
  });
}

/* ═══ RAYCASTER ═══ */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const coordDisplay = document.getElementById("coord-display");

// Convert world-space point to local coordinates of a floor's marker parent
function worldToLocal(worldPoint, floor) {
  const local = worldPoint.clone();
  const parent = floor === 2 ? f2MarkerGroup : glbGroups[floor];
  parent.worldToLocal(local);
  return local;
}

renderer.domElement.addEventListener("mousemove", (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  if (editMode !== "navigate") {
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(glbMeshes.concat([ground]));
    if (hits.length) {
      const p = hits[0].point;
      coordDisplay.textContent = `X: ${p.x.toFixed(1)}   Y: ${p.y.toFixed(1)}   Z: ${p.z.toFixed(1)}`;
    }
  }
});

renderer.domElement.addEventListener("click", () => {
  if (editMode === "navigate") return;
  raycaster.setFromCamera(mouse, camera);

  if (editMode === "place") {
    const hits = raycaster.intersectObjects(glbMeshes.concat([ground]));
    if (!hits.length) return;
    // Auto-detect which floor was clicked from the mesh's userData
    const hitMesh = hits[0].object;
    const detectedFloor = (hitMesh.userData && hitMesh.userData.floor) ? hitMesh.userData.floor : activeFloor;
    // Convert world hit to local coords of the detected floor group
    const local = worldToLocal(hits[0].point, detectedFloor);
    pushUndo("Place marker");
    const m = {
      id: nextId++, label: "Room " + nextId, dept: "core", floor: detectedFloor,
      x: parseFloat(local.x.toFixed(1)),
      y: parseFloat(local.y.toFixed(1)),
      z: parseFloat(local.z.toFixed(1)),
    };
    markers.push(m);
    createMarker3D(m);
    selectedId = m.id;
    renderMarkerList();
    showEditForm(m.id);
    toast(`Marker placed on Floor ${detectedFloor}`, "success");
  }

  if (editMode === "move") {
    const allDiscs = Array.from(markerMeshes.values()).map(m => m.disc);
    const discHits = raycaster.intersectObjects(allDiscs);
    if (discHits.length) {
      selectedId = discHits[0].object.userData.markerId;
      renderMarkerList();
      showEditForm(selectedId);
      highlightMarker(selectedId);
      return;
    }
    if (selectedId) {
      const hits = raycaster.intersectObjects(glbMeshes.concat([ground]));
      if (!hits.length) return;
      const p = hits[0].point;
      const m = markers.find(m => m.id === selectedId);
      if (!m) return;
      pushUndo("Move " + m.label);
      // Convert world hit to local coords of the marker's floor group
      const local = worldToLocal(p, m.floor);
      m.x = parseFloat(local.x.toFixed(1));
      m.y = parseFloat(local.y.toFixed(1));
      m.z = parseFloat(local.z.toFixed(1));
      updateMarker3D(m);
      renderMarkerList();
      showEditForm(m.id);
      toast("Marker moved", "info");
    }
  }
});

/* ═══ KEYBOARD SHORTCUTS ═══ */
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z") { e.preventDefault(); performUndo(); }
  if (e.key === "Escape") {
    selectedId = null;
    editForm.classList.remove("visible");
    renderMarkerList();
    highlightMarker(null);
  }
  if (e.key === "Delete" && selectedId) {
    document.getElementById("btn-delete-marker").click();
  }
});

/* ═══ LOAD BUILDING DATA ═══ */
document.getElementById("btn-load-building-data").addEventListener("click", async () => {
  try {
    const module = await import("./building-data.js");
    if (!module.ROOMS || !module.ROOMS.length) { toast("No rooms found in building-data.js", "error"); return; }
    pushUndo("Import building-data");
    markers.forEach(m => removeMarker3D(m.id));
    markers = module.ROOMS.map((r, i) => ({
      id: i + 1, label: r.label, dept: r.dept, floor: r.floor,
      x: r.x, y: 0.3, z: r.z,
    }));
    nextId = markers.length + 1;
    refreshAllMarkers();
    renderMarkerList();
    // Import zones
    if (module.NO_GO_ZONES && module.NO_GO_ZONES.length) {
      zones.forEach(z => removeZone3D(z.id));
      zones = module.NO_GO_ZONES.map((z, i) => ({ ...z, id: i + 1 }));
      nextZoneId = zones.length + 1;
      refreshAllZones();
      renderZoneList();
    }
    toast(`Loaded ${markers.length} markers + ${zones.length} zones`, "success");
  } catch (err) {
    console.error(err);
    toast("Failed to load building-data.js", "error");
  }
});

/* ═══ EXPORT / IMPORT ═══ */
const exportArea = document.getElementById("export-area");

document.getElementById("btn-export").addEventListener("click", () => {
  const roomsStr = markers.map(m => {
    const base = m.label.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_f[12]$/, "");
    const id = base + "_f" + m.floor;
    return `  { id:"${id}", label:"${m.label}", dept:"${m.dept}", floor:${m.floor}, x:${m.x}, z:${m.z}, w:2, d:2 }`;
  }).join(",\n");
  const zonesStr = zones.length ? zones.map(z =>
    `  { id:"${z.label.toLowerCase().replace(/[^a-z0-9]/g,"_")}", label:"${z.label}", floor:${z.floor}, x:${z.x}, z:${z.z}, width:${z.width}, depth:${z.depth} }`
  ).join(",\n") : "";
  const zonesBlock = zones.length ? `\n\nexport const NO_GO_ZONES = [\n${zonesStr}\n];` : "";
  exportArea.value = `// Generated by Antigravity Calibration Editor\n// ${new Date().toISOString()}\n\nexport const ROOMS = [\n${roomsStr}\n];\n\n// TODO: Add EDGES connections${zonesBlock}`;
  toast("Exported as JS code", "success");
});

document.getElementById("btn-export-json").addEventListener("click", () => {
  const data = markers.map(m => ({ label: m.label, dept: m.dept, floor: m.floor, x: m.x, y: m.y, z: m.z }));
  exportArea.value = JSON.stringify(data, null, 2);
  toast("Exported as JSON", "success");
});

document.getElementById("btn-copy").addEventListener("click", () => {
  exportArea.select();
  navigator.clipboard.writeText(exportArea.value);
  toast("Copied to clipboard!", "success");
});

document.getElementById("btn-import").addEventListener("click", () => {
  const text = exportArea.value.trim();
  if (!text) return;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      pushUndo("Import JSON");
      markers.forEach(m => removeMarker3D(m.id));
      markers = parsed.map((m, i) => ({ ...m, id: i + 1, y: m.y || 0.3 }));
      nextId = markers.length + 1;
      refreshAllMarkers();
      renderMarkerList();
      toast(`Imported ${markers.length} markers`, "success");
    }
  } catch (e) {
    toast("Invalid JSON — paste a JSON array", "error");
  }
});

/* ═══ UNDO ═══ */
document.getElementById("btn-undo").addEventListener("click", performUndo);

/* ═══ RESIZE ═══ */
function onResize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener("resize", onResize);
onResize();

/* ═══ ANIMATION LOOP ═══ */
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  controls.update();
  if (selectedId) {
    const m = markerMeshes.get(selectedId);
    if (m) m.sphere.material.opacity = 0.5 + 0.5 * Math.sin(t * 5);
  }
  renderer.render(scene, camera);
}
animate();

/* ═══ NO-GO ZONES ═══ */
const zoneMeshes = new Map();
const zoneEditForm = document.getElementById("zone-edit-form");

function createZone3D(zone) {
  const geo = new THREE.PlaneGeometry(zone.width, zone.depth);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff4444, transparent: true, opacity: 0.15,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(zone.x, 0.5, zone.z);

  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.6 });
  const border = new THREE.LineSegments(edges, lineMat);
  border.rotation.x = -Math.PI / 2;
  border.position.set(zone.x, 0.5, zone.z);

  const hw = zone.width / 2, hd = zone.depth / 2;
  const crossGeo = new THREE.BufferGeometry();
  crossGeo.setAttribute("position", new THREE.Float32BufferAttribute([
    -hw, 0, -hd, hw, 0, hd, -hw, 0, hd, hw, 0, -hd,
  ], 3));
  const cross = new THREE.LineSegments(crossGeo, new THREE.LineBasicMaterial({
    color: 0xff4444, transparent: true, opacity: 0.3,
  }));
  cross.position.set(zone.x, 0.5, zone.z);

  const parent = zone.floor === 2 ? f2MarkerGroup : glbGroups[zone.floor];
  parent.add(mesh, border, cross);
  zoneMeshes.set(zone.id, { mesh, border, cross, floor: zone.floor });
}

function removeZone3D(id) {
  const z = zoneMeshes.get(id);
  if (!z) return;
  const parent = z.floor === 2 ? f2MarkerGroup : glbGroups[z.floor];
  parent.remove(z.mesh, z.border, z.cross);
  z.mesh.geometry.dispose(); z.mesh.material.dispose();
  z.border.geometry.dispose(); z.border.material.dispose();
  z.cross.geometry.dispose(); z.cross.material.dispose();
  zoneMeshes.delete(id);
}

function refreshAllZones() {
  zoneMeshes.forEach((_, id) => removeZone3D(id));
  zones.forEach(z => createZone3D(z));
}

function renderZoneList() {
  const list = document.getElementById("zone-list");
  const count = document.getElementById("zone-count");
  if (!list || !count) return;
  count.textContent = zones.length;
  if (!zones.length) {
    list.innerHTML = '<div class="marker-item empty-state">No zones defined</div>';
    return;
  }
  let html = "";
  zones.forEach(z => {
    const sel = z.id === selectedZoneId ? "selected" : "";
    html += `<div class="marker-item ${sel}" data-zone-id="${z.id}">
      <span class="color-dot" style="background:#ef4444"></span>
      <span class="name">${z.label}</span>
      <span class="floor-tag">F${z.floor}</span>
      <span class="coords">${z.width}×${z.depth}</span>
    </div>`;
  });
  list.innerHTML = html;
  list.querySelectorAll(".marker-item[data-zone-id]").forEach(el => {
    el.addEventListener("click", () => {
      selectedZoneId = parseInt(el.dataset.zoneId);
      renderZoneList();
      showZoneEditForm(selectedZoneId);
    });
  });
}

function showZoneEditForm(id) {
  const z = zones.find(z => z.id === id);
  if (!z) { zoneEditForm.classList.remove("visible"); return; }
  zoneEditForm.classList.add("visible");
  document.getElementById("zone-label").value = z.label;
  document.getElementById("zone-x").value = z.x;
  document.getElementById("zone-z").value = z.z;
  document.getElementById("zone-width").value = z.width;
  document.getElementById("zone-depth").value = z.depth;
  document.querySelectorAll("[data-zone-floor]").forEach(b => {
    b.classList.toggle("active", parseInt(b.dataset.zoneFloor) === z.floor);
  });
}

document.querySelectorAll("[data-zone-floor]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-zone-floor]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

document.getElementById("btn-add-zone").addEventListener("click", () => {
  const z = { id: nextZoneId++, label: "Zone " + nextZoneId, floor: activeFloor, x: 0, z: 0, width: 4, depth: 4 };
  zones.push(z);
  createZone3D(z);
  selectedZoneId = z.id;
  renderZoneList();
  showZoneEditForm(z.id);
  toast("Zone added — adjust position and size", "info");
});

document.getElementById("btn-save-zone").addEventListener("click", () => {
  const z = zones.find(z => z.id === selectedZoneId);
  if (!z) return;
  z.label = document.getElementById("zone-label").value;
  z.x = parseFloat(document.getElementById("zone-x").value) || 0;
  z.z = parseFloat(document.getElementById("zone-z").value) || 0;
  z.width = parseFloat(document.getElementById("zone-width").value) || 4;
  z.depth = parseFloat(document.getElementById("zone-depth").value) || 4;
  const floorBtn = document.querySelector("[data-zone-floor].active");
  if (floorBtn) z.floor = parseInt(floorBtn.dataset.zoneFloor);
  removeZone3D(z.id);
  createZone3D(z);
  renderZoneList();
  toast("Zone saved", "success");
});

document.getElementById("btn-delete-zone").addEventListener("click", () => {
  if (!selectedZoneId) return;
  removeZone3D(selectedZoneId);
  zones = zones.filter(z => z.id !== selectedZoneId);
  selectedZoneId = null;
  zoneEditForm.classList.remove("visible");
  renderZoneList();
  toast("Zone deleted", "error");
});

/* ═══ INIT ═══ */
async function init() {
  await Promise.all([
    loadGLB("./models/first_floor.glb", 1),
    loadGLB("./models/second_floor.glb", 2),
  ]);
  loadOverlay.classList.add("hidden");
  renderMarkerList();
  renderZoneList();
  updateUndoUI();
}
init();
