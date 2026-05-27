import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { initDb, resetDb, getDb } from '../src/db/init';
import junctionsRouter from '../src/routes/junctions';

// Build a fresh test app (routes share the module-level db singleton)
const testApp = express();
testApp.use(cors());
testApp.use(express.json());
testApp.use('/api/junctions', junctionsRouter);

beforeAll(async () => {
  // Reset and use a fresh in-memory DB so tests never pollute traffic.db
  resetDb();
  await initDb(null); // null = pure in-memory, no file persistence

  const db = getDb();

  // Insert test junction
  db.prepare(`INSERT OR IGNORE INTO junctions (id, name, lat, lng, description) VALUES (:id, :name, :lat, :lng, :description)`)
    .run({ id: 1, name: 'Sakchi Chowk', lat: 22.8046, lng: 86.2029, description: 'Test junction' });

  // Insert roads for junction 1 (now UNIQUE on junction_id+direction, so OR IGNORE works correctly)
  const directions = ['N', 'S', 'E', 'W'];
  const roadNames = ['NH-33 North', 'NH-33 South', 'Sakchi East Road', 'Ram Mandir West'];
  directions.forEach((dir, i) => {
    db.prepare(`INSERT OR IGNORE INTO roads (junction_id, direction, road_name) VALUES (:junction_id, :direction, :road_name)`)
      .run({ junction_id: 1, direction: dir, road_name: roadNames[i] });
  });

  // Insert initial signal timers
  const now = new Date().toISOString();
  directions.forEach((dir) => {
    const existing = db.prepare('SELECT id FROM signal_timers WHERE junction_id = :junction_id AND direction = :direction')
      .get({ junction_id: 1, direction: dir });
    if (!existing) {
      db.prepare(`INSERT INTO signal_timers (junction_id, direction, green_time, red_time, yellow_time, updated_at) VALUES (:junction_id, :direction, :green_time, :red_time, :yellow_time, :updated_at)`)
        .run({ junction_id: 1, direction: dir, green_time: 30, red_time: 90, yellow_time: 5, updated_at: now });
    }
  });
});

afterAll(() => {
  resetDb(); // clean up so other test files start fresh if needed
});

describe('GET /api/junctions', () => {
  it('returns array with lat/lng fields', async () => {
    const res = await request(testApp).get('/api/junctions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const junction = res.body[0];
    expect(junction).toHaveProperty('lat');
    expect(junction).toHaveProperty('lng');
    expect(junction).toHaveProperty('name');
    expect(junction).toHaveProperty('id');
  });

  it('returns congestion_level for each junction', async () => {
    const res = await request(testApp).get('/api/junctions');
    expect(res.status).toBe(200);
    for (const junction of res.body) {
      expect(junction).toHaveProperty('congestion_level');
      expect(['low', 'medium', 'high', 'critical']).toContain(junction.congestion_level);
    }
  });
});

describe('GET /api/junctions/1', () => {
  it('returns junction with roads array', async () => {
    const res = await request(testApp).get('/api/junctions/1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 1);
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('roads');
    expect(Array.isArray(res.body.roads)).toBe(true);
    expect(res.body.roads.length).toBe(4); // exactly 4 directions
  });

  it('returns 404 for non-existent junction', async () => {
    const res = await request(testApp).get('/api/junctions/999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/junctions/1/signals', () => {
  it('returns array of timers for junction', async () => {
    const res = await request(testApp).get('/api/junctions/1/signals');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4);

    const timer = res.body[0];
    expect(timer).toHaveProperty('direction');
    expect(timer).toHaveProperty('green_time');
    expect(timer).toHaveProperty('red_time');
    expect(timer).toHaveProperty('yellow_time');
  });
});

describe('POST /api/junctions/1/vehicles', () => {
  it('with valid body returns success:true and timers array', async () => {
    const body = {
      roads: [
        { direction: 'N', cars: 10, bikes: 5, buses: 2, mini_trucks: 1, medium_trucks: 0, big_trucks: 0, cycles: 3 },
        { direction: 'S', cars: 8, bikes: 4, buses: 1, mini_trucks: 0, medium_trucks: 1, big_trucks: 0, cycles: 2 },
        { direction: 'E', cars: 15, bikes: 8, buses: 3, mini_trucks: 2, medium_trucks: 1, big_trucks: 1, cycles: 5 },
        { direction: 'W', cars: 5, bikes: 2, buses: 0, mini_trucks: 0, medium_trucks: 0, big_trucks: 0, cycles: 1 },
      ],
    };

    const res = await request(testApp).post('/api/junctions/1/vehicles').send(body);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('timers');
    expect(Array.isArray(res.body.timers)).toBe(true);
    expect(res.body.timers.length).toBe(4);

    const timer = res.body.timers[0];
    expect(timer).toHaveProperty('direction');
    expect(timer).toHaveProperty('green_time');
    expect(timer.green_time).toBeGreaterThanOrEqual(10);
    expect(timer.green_time).toBeLessThanOrEqual(120);
  });

  it('with invalid body returns 400', async () => {
    const res = await request(testApp).post('/api/junctions/1/vehicles').send({ invalid: 'data' });
    expect(res.status).toBe(400);
  });
});
