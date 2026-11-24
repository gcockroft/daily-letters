import { defineConfig } from 'vitest/config';

// Pin the zone so DST tests in tracker.test.ts hit real clock changes on every machine
process.env.TZ = 'Europe/Berlin';

export default defineConfig({});
