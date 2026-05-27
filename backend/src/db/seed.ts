import { initDb, getDb } from './init';

const junctions = [
  { id: 1, name: 'Sakchi Chowk', lat: 22.8046, lng: 86.2029, description: 'Main commercial hub of Jamshedpur' },
  { id: 2, name: 'Bistupur Square', lat: 22.8090, lng: 86.1883, description: 'Shopping and business district' },
  { id: 3, name: 'Golmuri Chowk', lat: 22.8216, lng: 86.1747, description: 'Industrial area junction' },
  { id: 4, name: 'Kadma Chowk', lat: 22.7918, lng: 86.2147, description: 'Eastern residential junction' },
  { id: 5, name: 'Baridih Chowk', lat: 22.8312, lng: 86.1623, description: 'Northern corridor junction' },
  { id: 6, name: 'Mango Chowk', lat: 22.7756, lng: 86.1944, description: 'Southern market area' },
  { id: 7, name: 'Telco Gate Chowk', lat: 22.8445, lng: 86.1534, description: 'Tata Motors factory entrance' },
  { id: 8, name: 'Dimna Chowk', lat: 22.7634, lng: 86.2389, description: 'Near Dimna Lake recreational area' },
];

const roadTemplates: Record<string, { N: string; S: string; E: string; W: string }> = {
  'Sakchi Chowk':      { N: 'NH-33 North',           S: 'NH-33 South',            E: 'Sakchi Market Road East', W: 'Ram Mandir Road West'  },
  'Bistupur Square':   { N: 'JRD Tata Marg North',   S: 'JRD Tata Marg South',    E: 'Bistupur Main Road East', W: 'Bistupur Road West'    },
  'Golmuri Chowk':     { N: 'Steel Plant Road North', S: 'Golmuri Industrial South',E: 'Golmuri East Road',       W: 'Telco Road West'       },
  'Kadma Chowk':       { N: 'Kadma Main North',       S: 'Kadma Main South',        E: 'Kadma Bypass East',       W: 'MG Road West'          },
  'Baridih Chowk':     { N: 'Baridih North Avenue',   S: 'Baridih South Road',      E: 'Baridih Colony East',     W: 'Boram Road West'       },
  'Mango Chowk':       { N: 'Mango Main North',       S: 'Mango Bypass South',      E: 'Mango East Road',         W: 'Mango Market West'     },
  'Telco Gate Chowk':  { N: 'Telco Gate North',       S: 'Telco Factory South',     E: 'Telco East Avenue',       W: 'Industrial Area West'  },
  'Dimna Chowk':       { N: 'Dimna Lake North',       S: 'Dimna Village South',     E: 'Dimna East Road',         W: 'Dimna Main West'       },
};

async function seed(): Promise<void> {
  await initDb();
  const db = getDb();

  const insertJunction = db.prepare(
    'INSERT OR IGNORE INTO junctions (id, name, lat, lng, description) VALUES (:id, :name, :lat, :lng, :description)'
  );

  const insertRoad = db.prepare(
    'INSERT OR IGNORE INTO roads (junction_id, direction, road_name) VALUES (:junction_id, :direction, :road_name)'
  );

  const getRoadId = db.prepare(
    'SELECT id FROM roads WHERE junction_id = :junction_id AND direction = :direction'
  );

  const insertTimer = db.prepare(
    'INSERT INTO signal_timers (junction_id, direction, green_time, red_time, yellow_time, updated_at) VALUES (:junction_id, :direction, :green_time, :red_time, :yellow_time, :updated_at)'
  );

  const getTimerCount = db.prepare(
    'SELECT COUNT(*) as count FROM signal_timers WHERE junction_id = :junction_id AND direction = :direction'
  );

  const seedAll = db.transaction(() => {
    for (const junction of junctions) {
      insertJunction.run({
        id: junction.id, name: junction.name,
        lat: junction.lat, lng: junction.lng,
        description: junction.description,
      });

      const directions = ['N', 'S', 'E', 'W'] as const;
      const roads = roadTemplates[junction.name];

      for (const dir of directions) {
        insertRoad.run({
          junction_id: junction.id,
          direction: dir,
          road_name: roads[dir],
        });

        const road = getRoadId.get({ junction_id: junction.id, direction: dir }) as { id: number } | undefined;
        if (!road) continue;

        const row = getTimerCount.get({ junction_id: junction.id, direction: dir }) as { count: number } | undefined;
        if (!row || row.count === 0) {
          insertTimer.run({
            junction_id: junction.id,
            direction: dir,
            green_time: 30,
            red_time: 90,
            yellow_time: 5,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }
  });

  seedAll();
  console.log('✅ Database seeded successfully with 8 Jamshedpur junctions');
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
