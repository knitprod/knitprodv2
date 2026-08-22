const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../app_db.json');
const appDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

let fixedCount = 0;
if (Array.isArray(appDb.orderPlans)) {
  appDb.orderPlans = appDb.orderPlans.map((ord, idx) => {
    const num = (ord.orderNumber || ord.ewo || ord.orderNo || '').toString().trim();
    if (!ord.ewo && num) {
      fixedCount++;
    }
    return {
      ...ord,
      ewo: num || ord.ewo || `ORD-${idx + 1}`,
      orderNumber: num || ord.orderNumber || ord.ewo || `ORD-${idx + 1}`
    };
  });
}

fs.writeFileSync(dbPath, JSON.stringify(appDb, null, 2), 'utf8');
console.log(`Successfully normalized ${appDb.orderPlans.length} orders in app_db.json. Fixed ${fixedCount} missing ewo values.`);
