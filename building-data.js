/* Building data — calibrated from editor export
   Positions match the actual GLB scan coordinates
   Updated: 2026-05-12 via Calibration Editor */

export const FLOOR_H = 5.0;

export const DEPT_COLORS = {
  electrical:   0x1a3a7a,
  chemical:     0x2d7ab8,
  mechanical:   0x6bcf8a,
  civil:        0x1a8a5a,
  aeronautical: 0xc49a6c,
  industrial:   0xe8c844,
  mining:       0x3a2a6a,
  core:         0xb89a7a,
  corridor:     0x3b4252,
  stairs:       0x94a3b8,
  elevator:     0x64748b,
  restroom:     0xef4444,
  emergency:    0x22c55e,
  entrance:     0x22d3ee,
};

export const ROOMS = [
  // ═══════════ FIRST FLOOR ═══════════
  { id:"entrance_f1",         label:"Entrance",            dept:"entrance", floor:1, x:0.9,  z:-13.8, w:2, d:2 },
  { id:"south_hall_f1",       label:"South Hall F1",       dept:"corridor", floor:1, x:-0.3, z:-4.4,  w:2, d:2 },
  { id:"central_hall_f1",     label:"Central Hall F1",     dept:"corridor", floor:1, x:-1,   z:2.6,   w:2, d:2 },
  { id:"north_hall_f1",       label:"North Hall F1",       dept:"corridor", floor:1, x:-2.4, z:7.5,   w:2, d:2 },
  { id:"110a_f1",             label:"110A",                dept:"core",     floor:1, x:4.9,  z:-4.1,  w:2, d:2 },
  { id:"109a_f1",             label:"109A",                dept:"core",     floor:1, x:4.6,  z:-1.2,  w:2, d:2 },
  { id:"104a_f1",             label:"104A",                dept:"core",     floor:1, x:3.2,  z:9.9,   w:2, d:2 },
  { id:"102a_f1",             label:"102A",                dept:"core",     floor:1, x:2.5,  z:12.9,  w:2, d:2 },
  { id:"107a_f1",             label:"107A",                dept:"core",     floor:1, x:-5.7, z:-5.7,  w:2, d:2 },
  { id:"108a_f1",             label:"108A",                dept:"core",     floor:1, x:-6.1, z:-2.7,  w:2, d:2 },
  { id:"103a_f1",             label:"103A",                dept:"core",     floor:1, x:-7.9, z:8.3,   w:2, d:2 },
  { id:"101a_f1",             label:"101A",                dept:"core",     floor:1, x:-8.4, z:11.2,  w:2, d:2 },
  { id:"main_stairs_f1",      label:"Main Stairs F1",      dept:"stairs",   floor:1, x:-3.7, z:9.6,   w:2, d:2 },
  { id:"elevator_f1",         label:"Elevator F1",         dept:"elevator", floor:1, x:4,    z:19.5,  w:2, d:2 },

  // ═══════════ SECOND FLOOR ═══════════
  { id:"north_hall_f2",       label:"North Hall F2",       dept:"corridor", floor:2, x:1.1,  z:-14.3, w:2, d:2 },
  { id:"main_stairs_f2",      label:"Main Stairs F2",      dept:"stairs",   floor:2, x:-0.7, z:-3.6,  w:2, d:2 },
  { id:"central_hall_b_f2",   label:"Central Hall B F2",   dept:"corridor", floor:2, x:3,    z:4.3,   w:2, d:2 },
  { id:"central_hall_a_f2",   label:"Central Hall A F2",   dept:"corridor", floor:2, x:-4.4, z:3.1,   w:2, d:2 },
  { id:"south_corridor_f2",   label:"South Corridor F2",   dept:"corridor", floor:2, x:-0.7, z:-2,    w:2, d:2 },
  { id:"north_corridor_f2",   label:"North Corridor F2",   dept:"corridor", floor:2, x:-0.7, z:9,     w:2, d:2 },
  { id:"south_hall_f2",       label:"South Hall F2",       dept:"corridor", floor:2, x:-2.4, z:11.5,  w:2, d:2 },
  { id:"204a_f2",             label:"204A",                dept:"core",     floor:2, x:-5,   z:-3.1,  w:2, d:2 },
  { id:"202a_f2",             label:"202A",                dept:"core",     floor:2, x:-4.6, z:-5.7,  w:2, d:2 },
  { id:"212a_f2",             label:"212A",                dept:"core",     floor:2, x:-6.4, z:8.5,   w:2, d:2 },
  { id:"210a_f2",             label:"210A (Teachers Room)", dept:"core",    floor:2, x:-7,   z:11.6,  w:2, d:2 },
  { id:"201a_f2",             label:"201A",                dept:"core",     floor:2, x:6,    z:-4.4,  w:2, d:2 },
  { id:"203a_f2",             label:"203A",                dept:"core",     floor:2, x:5.4,  z:-1.3,  w:2, d:2 },
  { id:"211a_f2",             label:"211A",                dept:"core",     floor:2, x:3.2,  z:10,    w:2, d:2 },
  { id:"208a_f2",             label:"208A",                dept:"core",     floor:2, x:2.4,  z:15,    w:2, d:2 },
  { id:"206a_f2",             label:"206A",                dept:"core",     floor:2, x:5.4,  z:-18.2, w:2, d:2 },
  { id:"elevator_f2",         label:"Elevator F2",         dept:"elevator", floor:2, x:-5.8, z:-15.4, w:2, d:2 },
  { id:"205a_f2",             label:"205A",                dept:"core",     floor:2, x:-4.4, z:-18.9, w:2, d:2 },
];

export const EDGES = [
  // ═══ FLOOR 1 ═══
  ["entrance_f1",       "south_hall_f1"],
  ["south_hall_f1",     "central_hall_f1"],
  ["central_hall_f1",   "north_hall_f1"],
  ["central_hall_f1",   "110a_f1"],
  ["central_hall_f1",   "109a_f1"],
  ["central_hall_f1",   "107a_f1"],
  ["central_hall_f1",   "108a_f1"],
  ["110a_f1",           "109a_f1"],
  ["107a_f1",           "108a_f1"],
  ["north_hall_f1",     "104a_f1"],
  ["north_hall_f1",     "102a_f1"],
  ["north_hall_f1",     "103a_f1"],
  ["north_hall_f1",     "101a_f1"],
  ["104a_f1",           "102a_f1"],
  ["103a_f1",           "101a_f1"],
  ["north_hall_f1",     "main_stairs_f1"],
  ["north_hall_f1",     "elevator_f1"],

  // ═══ FLOOR 2 ═══
  ["north_hall_f2",       "206a_f2"],
  ["north_hall_f2",       "elevator_f2"],
  ["north_hall_f2",       "205a_f2"],
  ["north_hall_f2",       "main_stairs_f2"],
  ["main_stairs_f2",      "south_corridor_f2"],
  // South corridor: routes around the south side of the atrium
  ["south_corridor_f2",   "central_hall_a_f2"],
  ["south_corridor_f2",   "central_hall_b_f2"],
  // North corridor: routes around the north side of the atrium
  ["north_corridor_f2",   "central_hall_a_f2"],
  ["north_corridor_f2",   "central_hall_b_f2"],
  ["central_hall_a_f2",   "204a_f2"],
  ["central_hall_a_f2",   "202a_f2"],
  ["central_hall_b_f2",   "201a_f2"],
  ["central_hall_b_f2",   "203a_f2"],
  ["204a_f2",             "202a_f2"],
  ["201a_f2",             "203a_f2"],
  ["central_hall_a_f2",   "south_hall_f2"],
  ["north_corridor_f2",   "south_hall_f2"],
  ["south_hall_f2",       "212a_f2"],
  ["south_hall_f2",       "210a_f2"],
  ["south_hall_f2",       "211a_f2"],
  ["south_hall_f2",       "208a_f2"],
  ["212a_f2",             "210a_f2"],

  // ═══ CROSS-FLOOR (stairs & elevator only) ═══
  ["main_stairs_f1", "main_stairs_f2"],
  ["elevator_f1",    "elevator_f2"],
];

export const NO_GO_ZONES = [
  { id:"central_atrium", label:"Central Atrium", floor:2, x:-0.5, z:3.4, width:4, depth:9 },
];
