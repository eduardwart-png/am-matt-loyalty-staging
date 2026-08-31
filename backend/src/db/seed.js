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
  const { rows } = await query(`SELECT COUNT(*) as n FROM menu_categories WHERE tenant_id = 'TENANT_001'`);
  if (Number(rows[0].n) > 0) return;

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
      await query(`
        INSERT INTO menu_items (tenant_id, category_id, name, description, price, vegetarian, seasonal, source, last_verified, sort_order, status)
        VALUES ('TENANT_001', $1, $2, $3, $4, $5, 0, 'am-matt.com/menue Live-Scan', '2026-08-31', $6, 'verified')
      `, [catId, name, description, price, vegetarian, itemIdx]);
    }
  }
  console.log('Speisekarte geseedet (real verifizierte Daten).');
}

async function seedDemoCustomer() {
  const { rows } = await query(`SELECT id FROM customers WHERE tenant_id = 'TENANT_001' AND email = 'demo@am-matt.example'`);
  if (rows[0]) return;
  const { hash, salt } = hashPassword('demo1234');
  const qrToken = randomToken(16);
  const insert = await query(`
    INSERT INTO customers (tenant_id, email, display_name, password_hash, password_salt, birthday, qr_code_token, points_balance)
    VALUES ('TENANT_001', 'demo@am-matt.example', 'Demo Kunde', $1, $2, '1990-05-15', $3, 0) RETURNING id
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
  if (Number(rows[0].n) > 0) return;
  await query(`
    INSERT INTO rewards (tenant_id, title, description, points_cost, active)
    VALUES ('TENANT_001', 'Gratis Dessert', 'Ein Dessert nach Wahl gratis (DEMO LOYALTY DATA)', 600, 1)
  `);
  console.log('Demo-Prämie angelegt (600 Punkte).');
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

async function seedDemoCampaign() {
  const { rows } = await query(`SELECT COUNT(*) as n FROM campaigns WHERE tenant_id = 'TENANT_001'`);
  if (Number(rows[0].n) > 0) return;
  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  await query(`
    INSERT INTO campaigns (tenant_id, title, description, campaign_type, target_segment, start_at, end_at,
      points_bonus, visibility, status, created_by)
    VALUES ('TENANT_001', $1, $2, 'weekly', 'all', $3, $4, 0, 'app', 'live', 'seed_script')
  `, ['Mittagsangebot der Woche',
      'Aktuelle Mittagsangebote — Preise und Gerichte laut Website, real verifiziert (Stand 31.08.2026).',
      now, in30days]);
  console.log('Demo-Kampagne "Mittagsangebot der Woche" angelegt (live, 30 Tage).');
}

async function main() {
  await migrate();
  await upsertTenant();
  await seedOpeningHours();
  await seedMenu();
  await seedDemoCustomer();
  await seedDemoReward();
  await seedStaffAndAdmin();
  await seedDemoCampaign();
  console.log('\n--- SEED ABGESCHLOSSEN ---');
  console.log('Demo-Kunde: demo@am-matt.example / demo1234');
  console.log('Staff: personal / personal1234');
  console.log('Admin: admin / admin1234');
  await pool.end();
}

main().catch((err) => { console.error('SEED FEHLGESCHLAGEN:', err); process.exit(1); });
