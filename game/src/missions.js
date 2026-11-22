// Sunset Keys — the mission chain for Dario Cruz.
// Three jobs in Solmar Bay, each a one-line objective, a beacon in the
// world, a pulsing marker on the minimap and a cash reward. The state
// machine is tiny: each mission has a `check` that watches the world and
// a `complete` that pays out. Finishing all three wins the story.
import { MISSIONS } from './config.js';

export function createMissions(city) {
  const stealCarSpot = { x: 6, z: -78 }; // parked on Coral Ave, on a road
  const hideout = { x: -78, z: 58 }; // on a road, west side
  const marina = { x: 58, z: 148 }; // the pier restaurant, on the beach
  const hotel = { x: -26, z: -110 }; // on a road, north side

  const list = [
    {
      id: 'steal',
      title: 'JOB 1 — HOT WHEELS',
      text: 'Steal the red convertible on Coral Ave (press E), then lose the cops.',
      marker: stealCarSpot,
      reward: MISSIONS.rewards[0],
      done: false,
      check(world) {
        return world.stolen && world.escaped;
      },
    },
    {
      id: 'delivery',
      title: 'JOB 2 — PIER RUN',
      text: 'Pick up the package at the marina, deliver it to the Hotel Solmar.',
      marker: marina,
      reward: MISSIONS.rewards[1],
      done: false,
      check(world) {
        return world.delivered;
      },
    },
    {
      id: 'getaway',
      title: 'JOB 3 — THE GETAWAY',
      text: 'Take the black sedan and reach the hideout with the cops on your tail.',
      marker: hideout,
      reward: MISSIONS.rewards[2],
      done: false,
      check(world) {
        return world.atHideout && world.wanted > 0;
      },
    },
  ];

  return {
    list,
    index: 0,
    get current() {
      return this.list[this.index] ?? null;
    },
    get finished() {
      return this.index >= this.list.length;
    },
    /** Mark the current mission done and advance; returns the reward paid. */
    advance() {
      const mission = this.current;
      if (!mission) return 0;
      mission.done = true;
      this.index += 1;
      return mission.reward;
    },
    spots: { stealCarSpot, hideout, marina, hotel },
  };
}
