import { Router, Request, Response } from 'express';
import { getDb } from '../db/init';
import {
  calculatePCU,
  calculateDensity,
  getCongestionLevel,
  calculateAdaptiveTimers,
  VehicleCounts,
} from '../services/densityService';

const router = Router();

/** Base URL for the Python model micro-service */
const MODEL_API_URL = process.env.MODEL_API_URL || 'http://localhost:8000';

// ── GET /api/junctions ────────────────────────────────────────────────────────
router.get('/', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const junctions = db.prepare('SELECT * FROM junctions').all() as Array<{
      id: number; name: string; lat: number; lng: number; description: string;
    }>;

    const result = junctions.map((junction) => {
      const roads = db.prepare('SELECT * FROM roads WHERE junction_id = :junction_id')
        .all({ junction_id: junction.id }) as Array<{ id: number }>;

      let totalPcu = 0;
      let roadCount = 0;

      for (const road of roads) {
        const latestCount = db.prepare(
          'SELECT * FROM vehicle_counts WHERE road_id = :road_id ORDER BY timestamp DESC LIMIT 1'
        ).get({ road_id: road.id }) as VehicleCounts | undefined;

        if (latestCount) {
          totalPcu += calculatePCU(latestCount);
          roadCount++;
        }
      }

      const avgPcu  = roadCount > 0 ? totalPcu / roadCount : 0;
      const density = calculateDensity(avgPcu);

      return {
        id: junction.id,
        name: junction.name,
        lat: junction.lat,
        lng: junction.lng,
        description: junction.description,
        congestion_level: getCongestionLevel(density),
        congestion_density: density,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch junctions' });
  }
});

// ── GET /api/junctions/:id ────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
  try {
    const db         = getDb();
    const junctionId = parseInt(req.params.id, 10);

    const junction = db.prepare('SELECT * FROM junctions WHERE id = :id')
      .get({ id: junctionId }) as {
        id: number; name: string; lat: number; lng: number; description: string
      } | undefined;

    if (!junction) {
      res.status(404).json({ error: 'Junction not found' });
      return;
    }

    const roads = db.prepare('SELECT * FROM roads WHERE junction_id = :junction_id')
      .all({ junction_id: junction.id }) as Array<{
        id: number; junction_id: number; direction: string; road_name: string
      }>;

    const signalTimers = db.prepare(
      'SELECT * FROM signal_timers WHERE junction_id = :junction_id'
    ).all({ junction_id: junction.id });

    const roadsWithCounts = roads.map((road) => {
      const latestCount = db.prepare(
        'SELECT * FROM vehicle_counts WHERE road_id = :road_id ORDER BY timestamp DESC LIMIT 1'
      ).get({ road_id: road.id });
      return { ...road, latest_count: latestCount || null };
    });

    res.json({ ...junction, roads: roadsWithCounts, signal_timers: signalTimers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch junction detail' });
  }
});

// ── GET /api/junctions/:id/signals ───────────────────────────────────────────
router.get('/:id/signals', (req: Request, res: Response) => {
  try {
    const db     = getDb();
    const timers = db.prepare(
      'SELECT * FROM signal_timers WHERE junction_id = :junction_id'
    ).all({ junction_id: parseInt(req.params.id, 10) });
    res.json(timers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch signal timers' });
  }
});

// ── POST /api/junctions/:id/vehicles ─────────────────────────────────────────
router.post('/:id/vehicles', (req: Request, res: Response) => {
  try {
    const db         = getDb();
    const junctionId = parseInt(req.params.id, 10);
    const { roads: roadsInput } = req.body as {
      roads?: Array<{
        direction: string;
        cars: number; bikes: number; buses: number;
        mini_trucks: number; medium_trucks: number; big_trucks: number; cycles: number;
        auto_rickshaws?: number; e_rickshaws?: number; tempos?: number; tractors?: number;
      }>;
    };

    if (!roadsInput || !Array.isArray(roadsInput)) {
      res.status(400).json({ error: 'Invalid request body: roads array required' });
      return;
    }

    const timerInput = roadsInput.map((r) => ({
      direction: r.direction,
      vehicles: {
        cars:           r.cars           || 0,
        bikes:          r.bikes          || 0,
        buses:          r.buses          || 0,
        mini_trucks:    r.mini_trucks    || 0,
        medium_trucks:  r.medium_trucks  || 0,
        big_trucks:     r.big_trucks     || 0,
        cycles:         r.cycles         || 0,
        auto_rickshaws: r.auto_rickshaws || 0,
        e_rickshaws:    r.e_rickshaws    || 0,
        tempos:         r.tempos         || 0,
        tractors:       r.tractors       || 0,
      } as VehicleCounts,
    }));

    const adaptiveTimers = calculateAdaptiveTimers(timerInput);

    const doWork = db.transaction(() => {
      const timestamp = new Date().toISOString();

      for (const roadInput of roadsInput) {
        const road = db.prepare(
          'SELECT id FROM roads WHERE junction_id = :junction_id AND direction = :direction'
        ).get({ junction_id: junctionId, direction: roadInput.direction }) as { id: number } | undefined;

        if (road) {
          db.prepare(`
            INSERT INTO vehicle_counts
              (road_id, timestamp,
               cars, bikes, buses, mini_trucks, medium_trucks, big_trucks, cycles,
               auto_rickshaws, e_rickshaws, tempos, tractors)
            VALUES
              (:road_id, :timestamp,
               :cars, :bikes, :buses, :mini_trucks, :medium_trucks, :big_trucks, :cycles,
               :auto_rickshaws, :e_rickshaws, :tempos, :tractors)
          `).run({
            road_id:        road.id,
            timestamp,
            cars:           roadInput.cars           || 0,
            bikes:          roadInput.bikes          || 0,
            buses:          roadInput.buses          || 0,
            mini_trucks:    roadInput.mini_trucks    || 0,
            medium_trucks:  roadInput.medium_trucks  || 0,
            big_trucks:     roadInput.big_trucks     || 0,
            cycles:         roadInput.cycles         || 0,
            auto_rickshaws: roadInput.auto_rickshaws || 0,
            e_rickshaws:    roadInput.e_rickshaws    || 0,
            tempos:         roadInput.tempos         || 0,
            tractors:       roadInput.tractors       || 0,
          });
        }
      }

      // Replace signal timers with freshly calculated ones
      db.prepare('DELETE FROM signal_timers WHERE junction_id = :junction_id')
        .run({ junction_id: junctionId });

      const now = new Date().toISOString();
      for (const timer of adaptiveTimers) {
        db.prepare(`
          INSERT INTO signal_timers (junction_id, direction, green_time, red_time, yellow_time, updated_at)
          VALUES (:junction_id, :direction, :green_time, :red_time, :yellow_time, :updated_at)
        `).run({
          junction_id: junctionId,
          direction:   timer.direction,
          green_time:  timer.green_time,
          red_time:    timer.red_time,
          yellow_time: timer.yellow_time,
          updated_at:  now,
        });
      }
    });

    doWork();

    const congestion: Record<string, { density: number; level: string }> = {};
    for (const r of timerInput) {
      const pcu     = calculatePCU(r.vehicles);
      const density = calculateDensity(pcu);
      congestion[r.direction] = { density, level: getCongestionLevel(density) };
    }

    res.json({ success: true, timers: adaptiveTimers, congestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process vehicle counts' });
  }
});

// ── POST /api/junctions/:id/detect ───────────────────────────────────────────
// Forwards an image to the Python model service and returns detection results.
// Also passes junction_id + direction so training data is saved per-junction.
router.post('/:id/detect', async (req: Request, res: Response) => {
  try {
    const { image, direction } = req.body as { image: string; direction: string };
    const junctionId           = req.params.id;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const base64Data  = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const formData = new FormData();
    const blob     = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('file',              blob,       'road.jpg');
    formData.append('junction_id',       junctionId);
    formData.append('direction',         direction || 'unknown');
    formData.append('save_for_training', 'true');

    const modelRes = await fetch(`${MODEL_API_URL}/detect`, {
      method: 'POST',
      body:   formData as unknown as RequestInit['body'],
      signal: AbortSignal.timeout(30000),
    });

    if (!modelRes.ok) {
      throw new Error(`Model API returned ${modelRes.status}`);
    }

    const result = await modelRes.json() as Record<string, unknown>;

    return res.json({
      success:              true,
      direction,
      counts:               result['counts'],
      total_vehicles:       result['total_vehicles'],
      total_pcu:            result['total_pcu'],
      density:              result['density'],
      congestion_level:     result['congestion_level'],
      detections:           result['detections'],
      annotated_image:      result['annotated_image'],
      model_info:           result['model_info'],
      training_data_saved:  result['training_data_saved'],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Detection error:', msg);
    return res.status(500).json({
      success:  false,
      error:    'Detection failed',
      message:  msg,
      fallback: 'Please enter vehicle counts manually',
    });
  }
});

// ── GET /api/junctions/:id/history ───────────────────────────────────────────
router.get('/:id/history', (req: Request, res: Response) => {
  try {
    const db         = getDb();
    const junctionId = parseInt(req.params.id, 10);

    const roads = db.prepare('SELECT * FROM roads WHERE junction_id = :junction_id')
      .all({ junction_id: junctionId }) as Array<{
        id: number; direction: string; road_name: string
      }>;

    const history = roads.map((road) => ({
      road_id:   road.id,
      direction: road.direction,
      road_name: road.road_name,
      counts:    db.prepare(
        'SELECT * FROM vehicle_counts WHERE road_id = :road_id ORDER BY timestamp DESC LIMIT 10'
      ).all({ road_id: road.id }),
    }));

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
