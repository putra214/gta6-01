// Sunset Keys — shared tuning constants for the whole game.
// One place for every number the systems agree on: city size, speeds,
// wanted rules and mission rewards. Nothing here is read from the network.
export const CITY = {
  blocks: 5, // 5x5 blocks
  blockSize: 40, // metres of building block per side
  roadWidth: 12, // metres of road between blocks
  // pitch = block + road; the city spans blocks*pitch + roadWidth metres.
  get pitch() { return this.blockSize + this.roadWidth; },
  get size() { return this.blocks * this.pitch + this.roadWidth; },
};

export const PLAYER = {
  walkSpeed: 6, // m/s
  sprintSpeed: 9, // m/s while Shift is held
  radius: 0.5,
};

export const CAR = {
  accel: 16, // m/s^2
  brake: 34, // m/s^2
  maxSpeed: 30, // m/s (~108 km/h)
  maxReverse: 10,
  drag: 0.6, // /s rolling drag
  wheelBase: 2.7, // m
  radius: 1.6,
  stealRadius: 4.5, // m from the walker to press E
};

export const WANTED = {
  maxStars: 5,
  heatDecaySeconds: 12, // seconds out of police sight before heat falls
  policeSight: 40, // m — closer than this, the police see you
  policeSpeed: 17, // m/s — clearly below the player's top speed, so a clean getaway works
  bustSeconds: 2, // seconds a cop must touch a slow player to bust them
};

export const TRAFFIC = {
  cars: 8,
  pedestrians: 10,
  carSpeed: 9, // m/s cruising speed of traffic
  pedSpeed: 1.4, // m/s walking speed of pedestrians
};

export const MISSIONS = {
  rewards: [400, 300, 600], // cash per mission, in order
};

export const COLORS = {
  sky: 0x87b5d9,
  fog: 0xcfd8e0,
  sun: 0xfff2d0,
  sand: 0xe8cf9e,
  sea: 0x2e7f9e,
  road: 0x3a3f46,
  sidewalk: 0x9aa0a3,
  grass: 0x6fae5f,
};
