// db/seed.js — Seed für TENANT_001 (Restaurant Am-Matt) mit verifizierten Realdaten + klar markierten Demo-Daten.
// Idempotent (ON CONFLICT DO NOTHING / Existenz-Checks) — sicher mehrfach ausführbar (z.B. bei jedem Deploy).
const { query, migrate, pool } = require('./index');
const { hashPassword, randomToken } = require('../lib/crypto');

async function upsertTenant() {
  const { rows } = await query(`SELECT id FROM tenants WHERE id = 'TENANT_001'`);
  if (rows[0]) return;
  await query(`
    INSERT INTO tenants (id, name, slug, address_street, address_zip, address_city, phone, email,
      brand_primary_color, brand_accent_color)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `, ['TENANT_001', 'Restaurant Am-Matt', 'am-matt', 'Markt 12', '42477', 'Radevormwald',
      '+49 2195 677099', 'am-matt@vodafone.de', '#1B4D3E', '#C9A24B']);
  console.log('Tenant TENANT_001 (Restaurant Am-Matt) angelegt.');
}

async function seedOpeningHours() {
  const { rows } = await query(`SELECT COUNT(*) as n FROM opening_hours WHERE tenant_id = 'TENANT_001'`);
  if (Number(rows[0].n) > 0) return;
  for (let wd = 1; wd <= 6; wd++) {
    await query(`INSERT INTO opening_hours (tenant_id, weekday, is_closed, open_time, close_time, slot_order)
      VALUES ('TENANT_001', $1, 0, '11:30', '14:30', 0)`, [wd]);
    await query(`INSERT INTO opening_hours (tenant_id, weekday, is_closed, open_time, close_time, slot_order)
      VALUES ('TENANT_001', $1, 0, '17:00', '22:30', 1)`, [wd]);
  }
  await query(`INSERT INTO opening_hours (tenant_id, weekday, is_closed, open_time, close_time, slot_order)
    VALUES ('TENANT_001', 0, 1, NULL, NULL, 0)`);
  console.log('Öffnungszeiten geseedet.');
}

async function seedMenu() {
  const dishImages = {
    'Rumpsteak „Madagaskar\"': '/assets/img/dish-rumpsteak.jpg',
    'Zwiebel-Rumpsteak': '/assets/img/dish-rumpsteak.jpg',
    '8 gegrillte Gambas': '/assets/img/dish-gambas.jpg',
    '5 gegrillte Gambas': '/assets/img/dish-gambas.jpg',
    'Gambas': '/assets/img/dish-gambas.jpg',
    'Baklava': '/assets/img/dish-baklava.jpg',
  };

  const { rows } = await query(`SELECT COUNT(*) as n FROM menu_categories WHERE tenant_id = 'TENANT_001'`);
  if (Number(rows[0].n) > 0) {
    // Bereits geseedet in früherem Deploy — nur fehlende Bilder nachziehen (additiv, kein Datenverlust).
    for (const [name, url] of Object.entries(dishImages)) {
      await query(`UPDATE menu_items SET image_url = $1 WHERE tenant_id = 'TENANT_001' AND name = $2 AND image_url IS NULL`, [url, name]);
    }
    return;
  }

  const categories = [
    { name: 'Vorspeisen', items: [
      ['Bruschetta', 'mit Tomaten, Parmesan, Knoblauch & Oliven', 9.90, 1],
      ['Frisches Brot', 'mit Kräuterbutter & Oliven', 8.90, 1],
      ['Hausgemachtes Aioli', 'mit geröstetem Ciabattabrot & Oliven', 9.90, 1],
      ['Gambas', 'geschält in Knoblauch-Chili-Öl mit frischem Baguettebrot, pikant', 14.90, 0],
      ['Kartoffel-Lauchsuppe', '', 7.90, 1],
      ['Kartoffel-Lauchsuppe mit Lachs', '', 9.90, 0],
      ['Frische Tomatensuppe', 'mit Gin und Sahnehäubchen', 7.90, 1],
    ]},
    { name: 'Fleischgerichte', items: [
      ['Champignon-Rahm-Schnitzel', 'mit frischen Champignons und Rahmsauce', 20.50, 0],
      ['Rumpsteak „Madagaskar"', 'ca. 250g, mit grüner Pfeffersauce, knusprigen Bratkartoffeln und Salat', 33.50, 0],
      ['Zwiebel-Rumpsteak', 'ca. 250g, mit Röstzwiebeln, knusprigen Bratkartoffeln und Salat', 33.00, 0],
      ['Zigeunerschnitzel', 'mit frischer Paprika, Zucchini, Auberginen und Zwiebeln, dazu Pommes Frites und Salat', 21.70, 0],
      ['Nizza-Schnitzel', 'paniertes Schweineschnitzel mit Preiselbeeren und Camembert-Käse überbacken, dazu Basmatireis und Salat', 23.00, 0],
      ['Grillteller', 'Hähnchenfilet, Rumpsteak, Cevapcici, Speck, Schweinerückensteak, mit Kräuterbutter, Ajvar, Pommes Frites, Djuvec Reis und Salat', 27.90, 0],
      ['Gebratene Spaghetti mit Hähnchen', 'in Curry mit Paprika, Zwiebeln, Hähnchenfilet und Salat', 20.50, 0],
    ]},
    { name: 'Beilagen', items: [
      ['Pommes frites', '', 4.90, 1],
      ['Knusprige Bratkartoffeln', '', 6.50, 1],
      ['Kroketten', '', 4.90, 1],
      ['Basmatireis', '', 4.00, 1],
      ['Djuvecreis', '', 4.50, 1],
      ['Ofenkartoffel mit Quark', '', 5.00, 1],
      ['Spaghetti', '', 4.00, 1],
      ['Kaisergemüse', '', 4.50, 1],
      ['Röstzwiebeln', '', 3.80, 1],
    ]},
    { name: 'Fischgerichte', items: [
      ['Lachsfilet', 'auf Blattspinat mit Kräutersauce, dazu Basmatireis', 26.90, 0],
      ['Kabeljaufilet', 'gebraten, an Kräutersauce mit Kaisergemüse und Basmatireis', 26.50, 0],
      ['Schlemmerpfanne', 'von Edelfischen mit Curry, frischem Gemüse, dazu Basmatireis', 26.90, 0],
      ['8 gegrillte Gambas', 'geschält, mit Kräutersauce auf Basmatireis mit Salat', 30.90, 0],
      ['5 gegrillte Gambas', 'geschält, auf Spaghetti Aglio-Olio-Peperoni mit Salat, pikant', 25.90, 0],
    ]},
    { name: 'Salate', items: [
      ['Bunter Salatteller', 'mit Hähnchenfilet, Mandarinen, Käse und Joghurtdressing', 21.20, 0],
      ['California Salat', 'mit gebratener Hähnchenbrust in Chili-Sauce, mit Obst und Balsamicodressing', 22.90, 0],
      ['Gemischter Salat', 'Blattsalat, Tomaten, Gurken, Mais, Rotkohl und Joghurtdressing', 12.20, 1],
      ['Avocado-Mozzarella-Salat', 'Pflücksalat mit Himbeervinaigrette, Avocado, Mozzarella, Cocktailtomaten, dazu Brot mit Butter', 19.90, 1],
    ]},
    { name: 'Deftig Rustikal', items: [
      ['Kartoffel-Zucchini-Rösti „Kaiserlicher Art"', 'mit Honig-Meerrettich, geräuchertem Lachs, Pflücksalat und Balsamico-Dressing', 19.90, 0],
      ['Leberkäse', 'mit 2 Spiegeleiern, knusprigen Bratkartoffeln und Salat', 19.60, 0],
      ['2 Spiegeleier', 'mit knusprigen Bratkartoffeln und gemischtem Salat', 16.20, 1],
      ['Ofenkartoffel', 'mit Kräuterquark und gemischtem Salat', 14.50, 1],
    ]},
    { name: 'Vegetarisch', items: [
      ['Gebackener Camembert', 'mit Preiselbeeren, gerösteter Petersilie und Toast', 16.70, 1],
      ['Kartoffel-Zucchini-Rösti', 'mit frischen Champignons und Kräuterquark', 16.70, 1],
      ['Panierter Schafskäse', 'mit gemischtem Salat in Joghurtdressing, dazu Baguettebrot mit hausgemachter Aioli', 18.90, 1],
      ['Spinat mit Schafskäse überbacken', 'dazu frisches Brot', 16.70, 1],
      ['Spaghetti Aglio-Olio-Peperoni', 'pikant, mit Olivenöl, Knoblauch, Peperoni und Salat', 15.90, 1],
    ]},
    { name: 'Pfannkuchen + Dessert', items: [
      ['Pfannkuchen Spinat', 'mit Spinat, Sauce Hollandaise und Käse überbacken', 15.60, 1],
      ['Speckpfannkuchen', 'mit gemischtem Salat', 16.90, 0],
      ['Apfelpfannkuchen', '', 14.50, 1],
      ['Baklava', 'Blätterteigsüßspeise mit Vanilleeis und Sahne', 9.50, 1],
      ['Vanilleeis mit heißer Schokoladensauce', 'und Sahne', 9.50, 1],
      ['Vanilleeis mit Eierlikör', 'und Sahne', 10.60, 1],
      ['Gemischtes Eis', '3 Kugeln mit Sahne', 8.90, 1],
      ['Vanilleeis mit heißen Kirschen', 'und Sahne', 9.50, 1],
    ]},
  ];

  for (let catIdx = 0; catIdx < categories.length; catIdx++) {
    const cat = categories[catIdx];
    const catInsert = await query(`INSERT INTO menu_categories (tenant_id, name, sort_order) VALUES ('TENANT_001', $1, $2) RETURNING id`, [cat.name, catIdx]);
    const catId = catInsert.rows[0].id;
    for (let itemIdx = 0; itemIdx < cat.items.length; itemIdx++) {
      const [name, description, price, vegetarian] = cat.items[itemIdx];
      const imageUrl = dishImages[name] || null;
      await query(`
        INSERT INTO menu_items (tenant_id, category_id, name, description, price, vegetarian, seasonal, image_url, source, last_verified, sort_order, status)
        VALUES ('TENANT_001', $1, $2, $3, $4, $5, 0, $6, 'am-matt.com/menue Live-Scan', '2026-08-31', $7, 'verified')
      `, [catId, name, description, price, vegetarian, imageUrl, itemIdx]);
    }
  }
  console.log('Speisekarte geseedet (real verifizierte Daten).');
}

async function seedDemoCustomer() {
  const { rows } = await query(`SELECT id FROM customers WHERE tenant_id = 'TENANT_001' AND email = 'demo@am-matt.example'`);
  if (rows[0]) {
    await query(`UPDATE customers SET display_name = 'Anna Schmitz' WHERE id = $1 AND display_name = 'Demo Kunde'`, [rows[0].id]);
    return;
  }
  const { hash, salt } = hashPassword('demo1234');
  const qrToken = randomToken(16);
  const insert = await query(`
    INSERT INTO customers (tenant_id, email, display_name, password_hash, password_salt, birthday, qr_code_token, points_balance)
    VALUES ('TENANT_001', 'demo@am-matt.example', 'Anna Schmitz', $1, $2, '1990-05-15', $3, 0) RETURNING id
  `, [hash, salt, qrToken]);
  const customerId = insert.rows[0].id;
  await query(`
    INSERT INTO loyalty_ledger (tenant_id, customer_id, value, reason, source, actor)
    VALUES ('TENANT_001', $1, 540, 'demo_seed_purchase_history', 'system', 'seed_script')
  `, [customerId]);
  await query(`UPDATE customers SET points_balance = 540 WHERE id = $1`, [customerId]);
  console.log('Demo-Kunde mit 540 Demo-Punkten angelegt (DEMO LOYALTY DATA, kein reales Angebot).');
}

async function seedDemoReward() {
  const { rows } = await query(`SELECT COUNT(*) as n FROM rewards WHERE tenant_id = 'TENANT_001'`);
  if (Number(rows[0].n) > 0) {
    // Staging-Config, kein Kundendatensatz — sicher ersetzbar bei Redesign/Content-Update.
    await query(`DELETE FROM rewards WHERE tenant_id = 'TENANT_001'`);
  }
  await query(`
    INSERT INTO rewards (tenant_id, title, description, points_cost, active, image_url)
    VALUES ('TENANT_001', 'Espresso oder Kaffee', 'Ein Heißgetränk nach Wahl auf uns.', 50, 1, '/assets/img/reward-espresso.jpg')
  `);
  await query(`
    INSERT INTO rewards (tenant_id, title, description, points_cost, active, image_url)
    VALUES ('TENANT_001', 'Dessert des Hauses', 'Baklava, Eis oder Pfannkuchen — deine Wahl.', 100, 1, '/assets/img/dish-baklava.jpg')
  `);
  await query(`
    INSERT INTO rewards (tenant_id, title, description, points_cost, active, image_url)
    VALUES ('TENANT_001', 'Hauptgericht gratis', 'Ein Hauptgericht deiner Wahl bei deinem nächsten Besuch.', 600, 1, '/assets/img/dish-rumpsteak.jpg')
  `);
  console.log('Prämien angelegt (50 / 100 / 600 Punkte).');
}

async function seedStaffAndAdmin() {
  const staffRes = await query(`SELECT id FROM staff_users WHERE tenant_id = 'TENANT_001' AND username = 'personal'`);
  if (!staffRes.rows[0]) {
    const { hash, salt } = hashPassword('personal1234');
    await query(`INSERT INTO staff_users (tenant_id, username, password_hash, password_salt, role) VALUES ('TENANT_001', 'personal', $1, $2, 'staff')`, [hash, salt]);
    console.log('Staff-Login angelegt: personal / personal1234 (Demo — vor Production ändern!)');
  }
  const adminRes = await query(`SELECT id FROM staff_users WHERE tenant_id = 'TENANT_001' AND username = 'admin'`);
  if (!adminRes.rows[0]) {
    const { hash, salt } = hashPassword('admin1234');
    await query(`INSERT INTO staff_users (tenant_id, username, password_hash, password_salt, role) VALUES ('TENANT_001', 'admin', $1, $2, 'admin')`, [hash, salt]);
    console.log('Admin-Login angelegt: admin / admin1234 (Demo — vor Production ändern!)');
  }
}

async function seedDemoCoupon() {
  const { rows } = await query(`SELECT id FROM coupons WHERE tenant_id = 'TENANT_001' AND code = 'WILLKOMMEN10'`);
  if (rows[0]) return;
  const now = new Date();
  const in60days = new Date(now.getTime() + 60 * 24 * 3600 * 1000);
  await query(`
    INSERT INTO coupons (tenant_id, code, title, description, image_url, discount_type, discount_value,
      valid_from, valid_until, target_segment, max_uses_per_customer, status)
    VALUES ('TENANT_001', 'WILLKOMMEN10', $1, $2, $3, 'percent', 10, $4, $5, 'all', 1, 'live')
  `, ['10% auf deine Rechnung',
      'Als Dankeschön für deine Treue: 10% Rabatt auf deinen nächsten Besuch.',
      '/assets/img/dish-schnitzel.jpg', now, in60days]);
  console.log('Coupon WILLKOMMEN10 angelegt (10%, live).');
}

async function seedDemoCampaign() {
  const { rows } = await query(`SELECT COUNT(*) as n FROM campaigns WHERE tenant_id = 'TENANT_001'`);
  if (Number(rows[0].n) > 0) {
    await query(`DELETE FROM campaigns WHERE tenant_id = 'TENANT_001'`);
  }
  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  await query(`
    INSERT INTO campaigns (tenant_id, title, description, image_url, campaign_type, target_segment, start_at, end_at,
      points_bonus, visibility, status, created_by)
    VALUES ('TENANT_001', $1, $2, $3, 'weekly', 'all', $4, $5, 0, 'app', 'live', 'seed_script')
  `, ['Mittagsangebot der Woche',
      'Täglich wechselnde Mittagsgerichte — frisch, regional, zum fairen Preis. Auch zum Mitnehmen.',
      '/assets/img/dish-schnitzel.jpg', now, in30days]);
  await query(`
    INSERT INTO campaigns (tenant_id, title, description, image_url, campaign_type, target_segment, start_at, end_at,
      points_bonus, visibility, status, created_by)
    VALUES ('TENANT_001', $1, $2, $3, 'seasonal', 'all', $4, $5, 0, 'app', 'live', 'seed_script')
  `, ['Spargelzeit im Am-Matt',
      'Frischer Spargel aus der Region — cremig mit Sauce Hollandaise, klassisch mit Schinken oder vegetarisch.',
      '/assets/img/dish-spargel.jpg', now, in30days]);
  console.log('Kampagnen angelegt: Mittagsangebot + Saisonale Spargelzeit (live).');
}

async function main(closePool = true) {
  await migrate();
  await upsertTenant();
  await seedOpeningHours();
  await seedMenu();
  await seedDemoCustomer();
  await seedDemoReward();
  await seedStaffAndAdmin();
  await seedDemoCoupon();
  await seedDemoCampaign();
  console.log('\n--- SEED ABGESCHLOSSEN ---');
  console.log('Demo-Kunde: demo@am-matt.example / demo1234');
  console.log('Staff: personal / personal1234');
  console.log('Admin: admin / admin1234');
  if (closePool) await pool.end();
}

// Direktaufruf (node db/seed.js): läuft standalone und beendet den Pool danach.
// Als Modul importiert (require('./db/seed')): main() wird vom Aufrufer gesteuert,
// Pool bleibt offen (der Server braucht ihn weiter für Requests).
if (require.main === module) {
  main(true).catch((err) => { console.error('SEED FEHLGESCHLAGEN:', err); process.exit(1); });
}

module.exports = { main };
