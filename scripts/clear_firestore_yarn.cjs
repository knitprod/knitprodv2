const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../firebase-applet-config.json'), 'utf8'));

const projectId = config.projectId;
const dbId = config.firestoreDatabaseId;
const apiKey = config.apiKey;

const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents`;

async function listDocuments(collectionPath) {
  try {
    const url = `${baseUrl}/${collectionPath}?key=${apiKey}&pageSize=300`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return json.documents || [];
  } catch (e) {
    return [];
  }
}

async function deleteDocumentByName(docName) {
  try {
    const url = `https://firestore.googleapis.com/v1/${docName}?key=${apiKey}`;
    const res = await fetch(url, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log('Cleaning Yarn Allocation data from Firestore database:', dbId);

  // 1. Delete yarn_allocations_store docs
  const storeDocs = await listDocuments('yarn_allocations_store');
  console.log(`Found ${storeDocs.length} documents in yarn_allocations_store`);
  for (const doc of storeDocs) {
    await deleteDocumentByName(doc.name);
    console.log(`Deleted ${doc.name}`);
  }

  // 2. Delete yarn_allocations docs
  const yarnDocs = await listDocuments('yarn_allocations');
  console.log(`Found ${yarnDocs.length} documents in yarn_allocations`);
  for (const doc of yarnDocs) {
    await deleteDocumentByName(doc.name);
  }

  console.log('Yarn Allocation stock data successfully removed from Firestore!');
}

main().catch(err => console.error('Error during cleanup:', err));
