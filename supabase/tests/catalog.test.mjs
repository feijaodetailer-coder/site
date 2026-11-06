import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { catalog } from '../functions/_shared/catalog.ts';
import { serviceCategories } from '../../lib/service-categories.ts';

test('price-list migration preserves historical IDs and packages/plans and can be retried', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`CREATE TABLE services (id serial PRIMARY KEY,category text,name text,price int,duration int,booking_duration int,description text,archived boolean NOT NULL DEFAULT false);
      INSERT INTO services (category,name,price) VALUES ('Limpeza','Serviço antigo',999),('Pacotes','Pacote existente',12345),('Planos mensais','Plano existente',67890);
      CREATE TABLE bookings (service_id int REFERENCES services(id)); INSERT INTO bookings VALUES (1);`);
    const before = (await pg.query('SELECT * FROM services WHERE id IN (2,3) ORDER BY id')).rows;
    const sql = readFileSync(new URL('../migrations/20261106000000_service_price_list.sql', import.meta.url),'utf8');
    await pg.exec(sql);
    const first = (await pg.query('SELECT * FROM services ORDER BY id')).rows;
    await pg.exec(sql);
    assert.deepEqual((await pg.query('SELECT * FROM services ORDER BY id')).rows, first);
    assert.deepEqual(first.filter(s => [2,3].includes(s.id)), before);
    assert.equal(first[0].archived, true);
    assert.equal((await pg.query('SELECT service_id FROM bookings')).rows[0].service_id, 1);
    const active = first.filter(s => !s.archived && ![2,3].includes(s.id));
    assert.equal(active.length,28);
    for (const item of catalog.filter(s => !['Pacotes','Planos mensais'].includes(s.category))) {
      assert.equal(active.find(s => s.name === item.name)?.price,item.price);
    }
    const names = new Set(active.map(s=>s.name.split(' · ')[0]));
    assert.deepEqual(new Set(serviceCategories.flatMap(c=>c.items)),names);
    await pg.exec("TRUNCATE bookings, services RESTART IDENTITY;");
    await pg.exec(sql);
    assert.equal((await pg.query("SELECT count(*)::int AS total FROM services")).rows[0].total,0);
  } finally { await pg.close(); }
});
