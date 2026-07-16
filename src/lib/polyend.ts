// Access layer over @polyend/tracker-lib (npm).
//
// Everything possible goes through the package's public API (Tracker
// factories/readers, types, constants, AudioUtil). The four serializer
// classes below are internal modules the package does not re-export yet —
// its public write helpers (Tracker.writeInstrument, ...) wrap them in a
// forced browser download per file, which cannot produce a project zip.
// They are reached through a dist alias (see config/vite.config.base.ts and
// the tsconfig "paths" entry) until upstream exposes buffer-returning writers.
export { default as Tracker } from '@polyend/tracker-lib';
export * from '@polyend/tracker-lib';

export { default as Instrument } from '@polyend/tracker-lib/dist/instruments/instrument.js';
export { default as Pattern } from '@polyend/tracker-lib/dist/patterns/pattern.js';
export { default as Metadata } from '@polyend/tracker-lib/dist/patterns/metadata.js';
export { default as Project } from '@polyend/tracker-lib/dist/projects/project.js';
