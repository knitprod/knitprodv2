const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../firebase-applet-config.json'), 'utf8'));
const appDb = JSON.parse(fs.readFileSync(path.join(__dirname, '../app_db.json'), 'utf8'));

const projectId = config.projectId;
const dbId = config.firestoreDatabaseId;
const apiKey = config.apiKey;

const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents`;

// Helper to convert JS object to Firestore REST format
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

async function writeDocument(collectionPath, docId, data) {
  const url = `${baseUrl}/${collectionPath}/${encodeURIComponent(docId)}?key=${apiKey}`;
  const payload = {
    fields: toFirestoreFields(data)
  };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Write failed ${collectionPath}/${docId}: ${res.status} - ${errText}`);
  }
  return res.json();
}

async function main() {
  console.log('Seeding Firestore database:', dbId);

  // 1. Seed Yarn Allocation Chunks
  const yarnList = appDb.yarnAllocations || [];
  console.log(`Uploading ${yarnList.length} Yarn Allocations...`);
  const CHUNK_SIZE = 150;
  const chunkCount = Math.ceil(yarnList.length / CHUNK_SIZE);

  for (let i = 0; i < yarnList.length; i += CHUNK_SIZE) {
    const chunkIdx = Math.floor(i / CHUNK_SIZE);
    const chunkItems = yarnList.slice(i, i + CHUNK_SIZE);
    await writeDocument('yarn_allocations_store', `chunk_${chunkIdx}`, {
      chunkIndex: chunkIdx,
      items: chunkItems,
      updatedAt: new Date().toISOString()
    });
    if (chunkIdx % 10 === 0 || chunkIdx === chunkCount - 1) {
      console.log(`Saved yarn chunk ${chunkIdx + 1}/${chunkCount}`);
    }
  }

  // Meta doc
  const uploadMeta = appDb.master_yarn_upload_info || {
    lastUploadedAt: 'Aug 20, 2026, 06:58 PM',
    lastUpdatedDate: '20-Aug-2026',
    lastUpdateTime: '06:58 PM',
    uploadedBy: 'Md. Raihan Hossain Antu',
    userName: 'Md. Raihan Hossain Antu',
    fileName: 'Yarn Allocation.xlsx',
    totalRecords: yarnList.length,
    status: 'Success'
  };

  await writeDocument('yarn_allocations_store', 'meta', {
    updatedAt: new Date().toISOString(),
    version: Date.now(),
    totalRecords: yarnList.length,
    chunkCount: chunkCount,
    lastUpdatedDate: uploadMeta.lastUpdatedDate || '20-Aug-2026',
    lastUpdateTime: uploadMeta.lastUpdateTime || '06:58 PM',
    uploadedBy: uploadMeta.uploadedBy || 'Md. Raihan Hossain Antu'
  });

  await writeDocument('settings', 'master_yarn_upload_info', uploadMeta);

  // App config doc
  await writeDocument('settings', 'app_config', {
    gasWebAppUrl: 'https://script.google.com/macros/s/AKfycbxFWAAfakjwAFV9V4AdZr6WvXOBXfWO3yAHSJkxSKxyTgOeSqW04d2sewbbtFRxd2Cn/exec',
    databaseMode: 'gas',
    updatedAt: new Date().toISOString()
  });

  console.log('✅ Successfully seeded Yarn Allocation and Settings into Firebase Firestore!');
}

main().catch(console.error);
