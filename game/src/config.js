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
  heatDecaySeconds: 7, // seconds out of police sight before heat falls
  policeSight: 45, // m — closer than this, the police see you
  policeSpeed: 13, // m/s — well below the player's top speed; the police cut
  // corners across blocks, so a bigger gap is needed for a clean getaway
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
  sky: 0x2a1a4e, // deep violet dusk — the top of the sunset gradient
  fog: 0xe8906a, // warm sunset haze on the horizon
  sun: 0xffb347, // low warm sun, from the south-west
  sand: 0xe8b98a,
  sea: 0x3a6a8a, // dusk sea, dark teal under a violet sky
  road: 0x3a3f46,
  sidewalk: 0x9aa0a3,
  grass: 0x6fae5f,
};
