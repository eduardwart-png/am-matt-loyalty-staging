// db/seed.js — Seed für TENANT_001 (Restaurant Am-Matt) mit verifizierten Realdaten + klar markierten Demo-Daten.
const { db, migrate } = require('./index');
const { hashPassword, randomToken } = require('../lib/crypto');

migrate();

function upsertTenant() {
  const exists = db.prepare(`SELECT id FROM tenants WHERE id = 'TENANT_001'`).get();
  if (exists) return;
  db.prepare(`
    INSERT INTO tenants (id, name, slug, address_street, address_zip, address_city, phone, email,
      brand_primary_color, brand_accent_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'TENANT_001', 'Restaurant Am-Matt', 'am-matt',
    'Markt 12', '42477', 'Radevormwald',
    '+49 2195 677099', 'am-matt@vodafone.de',
    '#1B4D3E', '#C9A24B'
  );
  console.log('Tenant TENANT_001 (Restaurant Am-Matt) angelegt.');
}

// Öffnungszeiten — real verifiziert von am-matt.com (Stand 31.08.2026), zentral, einmalig.
function seedOpeningHours() {
  const count = db.prepare(`SELECT COUNT(*) as n FROM opening_hours WHERE tenant_id = 'TENANT_001'`).get().n;
  if (count > 0) return;
  const insert = db.prepare(`
    INSERT INTO opening_hours (tenant_id, weekday, is_closed, open_time, close_time, slot_order)
    VALUES ('TENANT_001', ?, ?, ?, ?, ?)
  `);
  // weekday: 0=Sonntag..6=Samstag
  for (let wd = 1; wd <= 6; wd++) { // Montag(1) bis Samstag(6)
    insert.run(wd, 0, '11:30', '14:30', 0);
    insert.run(wd, 0, '17:00', '22:30', 1);
  }
  insert.run(0, 1, null, null, 0); // Sonntag Ruhetag
  console.log('Öffnungszeiten geseedet.');
}

// Speisekarte — real verifiziert (siehe audit/menue-scan-live.md), nichts erfunden.
function seedMenu() {
  const count = db.prepare(`SELECT COUNT(*) as n FROM menu_categories WHERE tenant_id = 'TENANT_001'`).get().n;
  if (count > 0) return;

  const catInsert = db.prepare(`INSERT INTO menu_categories (tenant_id, name, sort_order) VALUES ('TENANT_001', ?, ?)`);
  const itemInsert = db.prepare(`
    INSERT INTO menu_items (tenant_id, category_id, name, description, price, vegetarian, seasonal, source, last_verified, sort_order, status)
    VALUES ('TENANT_001', ?, ?, ?, ?, ?, ?, 'am-matt.com/menue Live-Scan', '2026-08-31', ?, 'verified')
  `);

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

  categories.forEach((cat, catIdx) => {
    const catInfo = catInsert.run(cat.name, catIdx);
    cat.items.forEach((item, itemIdx) => {
      const [name, description, price, vegetarian] = item;
      itemInsert.run(catInfo.lastInsertRowid, name, description, price, vegetarian, 0, itemIdx);
    });
  });
  console.log('Speisekarte geseedet (real verifizierte Daten).');
}

// Demo-Kunde + Demo-Loyalty-Daten (klar als Demo gekennzeichnet, Direktive §14)
function seedDemoCustomer() {
  const exists = db.prepare(`SELECT id FROM customers WHERE tenant_id = 'TENANT_001' AND email = 'demo@am-matt.example'`).get();
  if (exists) return;
  const { hash, salt } = hashPassword('demo1234');
  const qrToken = randomToken(16);
  const info = db.prepare(`
    INSERT INTO customers (tenant_id, email, display_name, password_hash, password_salt, birthday, qr_code_token, points_balance)
    VALUES ('TENANT_001', 'demo@am-matt.example', 'Demo Kunde', ?, ?, '1990-05-15', ?, 0)
  `).run(hash, salt, qrToken);

  const customerId = info.lastInsertRowid;
  const ledgerInsert = db.prepare(`
    INSERT INTO loyalty_ledger (tenant_id, customer_id, value, reason, source, actor)
    VALUES ('TENANT_001', ?, ?, ?, 'system', 'seed_demo_data')
  `);
  // DEMO LOYALTY DATA — kein reales Angebot, nur zur Veranschaulichung der UI (Direktive §14)
  ledgerInsert.run(customerId, 540, 'demo_seed_purchase_history');
  db.prepare(`UPDATE customers SET points_balance = 540 WHERE id = ?`).run(customerId);
  console.log('Demo-Kunde mit 540 Demo-Punkten angelegt (DEMO LOYALTY DATA, kein reales Angebot).');
}

function seedDemoReward() {
  const count = db.prepare(`SELECT COUNT(*) as n FROM rewards WHERE tenant_id = 'TENANT_001'`).get().n;
  if (count > 0) return;
  db.prepare(`
    INSERT INTO rewards (tenant_id, title, description, points_cost, active)
    VALUES ('TENANT_001', ?, ?, ?, 1)
  `).run('Gratis Dessert', 'Ein Dessert nach Wahl gratis (DEMO LOYALTY DATA)', 600);
  console.log('Demo-Prämie angelegt (600 Punkte).');
}

function seedStaffAndAdmin() {
  const staffExists = db.prepare(`SELECT id FROM staff_users WHERE tenant_id = 'TENANT_001' AND username = 'personal'`).get();
  if (!staffExists) {
    const { hash, salt } = hashPassword('personal1234');
    db.prepare(`INSERT INTO staff_users (tenant_id, username, password_hash, password_salt, role) VALUES ('TENANT_001', 'personal', ?, ?, 'staff')`)
      .run(hash, salt);
    console.log('Staff-Login angelegt: personal / personal1234 (Demo — vor Production ändern!)');
  }
  const adminExists = db.prepare(`SELECT id FROM staff_users WHERE tenant_id = 'TENANT_001' AND username = 'admin'`).get();
  if (!adminExists) {
    const { hash, salt } = hashPassword('admin1234');
    db.prepare(`INSERT INTO staff_users (tenant_id, username, password_hash, password_salt, role) VALUES ('TENANT_001', 'admin', ?, ?, 'admin')`)
      .run(hash, salt);
    console.log('Admin-Login angelegt: admin / admin1234 (Demo — vor Production ändern!)');
  }
}

// Demo-Kampagne (klar als Demo-Beispiel, orientiert an realem Mittagsangebot)
function seedDemoCampaign() {
  const count = db.prepare(`SELECT COUNT(*) as n FROM campaigns WHERE tenant_id = 'TENANT_001'`).get().n;
  if (count > 0) return;
  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
  db.prepare(`
    INSERT INTO campaigns (tenant_id, title, description, campaign_type, target_segment, start_at, end_at,
      points_bonus, visibility, status, created_by)
    VALUES ('TENANT_001', ?, ?, 'weekly', 'all', ?, ?, ?, 'app', 'live', 'seed_script')
  `).run(
    'Mittagsangebot der Woche',
    'Aktuelle Mittagsangebote — Preise und Gerichte laut Website, real verifiziert (Stand 31.08.2026).',
    now.toISOString(), in30days, 0
  );
  console.log('Demo-Kampagne "Mittagsangebot der Woche" angelegt (live, 30 Tage).');
}

upsertTenant();
seedOpeningHours();
seedMenu();
seedDemoCustomer();
seedDemoReward();
seedStaffAndAdmin();
seedDemoCampaign();

console.log('\n--- SEED ABGESCHLOSSEN ---');
console.log('Demo-Kunde: demo@am-matt.example / demo1234');
console.log('Staff: personal / personal1234');
console.log('Admin: admin / admin1234');
