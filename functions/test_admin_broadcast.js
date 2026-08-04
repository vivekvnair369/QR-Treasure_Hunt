process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "demo-aitheron"
});

const db = admin.firestore();

async function run() {
  console.log("Starting broadcast test inside functions...");
  
  // Fetch routes first
  const routesSnap = await db.collection("routes").get();
  const routes = routesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log("Routes in DB:", routes.map(r => r.id));

  // Mimic selectedBroadcastRoute = 'route_a'
  const selectedBroadcastRoute = 'route_a';
  const broadcastAutoHide = false;
  const broadcastDuration = 5;
  const broadcastHintText = "Test Hint Message";
  const hideAt = broadcastAutoHide ? new Date(Date.now() + Number(broadcastDuration) * 60 * 1000) : null;
  const hintVal = broadcastHintText.trim();
  
  const batch = db.batch();
  
  const broadcastPayload = {
    broadcast_hint: hintVal,
    broadcast_message: hintVal,
    current_hint: hintVal,
    broadcast_hint_auto_hide: broadcastAutoHide,
    broadcast_message_auto_hide: broadcastAutoHide,
    broadcast_hint_hide_at: hideAt,
    broadcast_message_hide_at: hideAt,
    broadcast_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    broadcast_hint_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    hint_updated_at: admin.firestore.FieldValue.serverTimestamp()
  };

  if (selectedBroadcastRoute === 'all_routes') {
    routes.forEach(r => {
      console.log(`Adding update for route: ${r.id}`);
      batch.update(db.collection("routes").doc(r.id), broadcastPayload);
    });
    
    console.log("Adding update for active_event");
    batch.update(db.collection("events").doc("active_event"), {
      broadcast_message: hintVal,
      broadcast_hint: hintVal,
      current_hint: hintVal,
      broadcast_message_auto_hide: broadcastAutoHide,
      broadcast_hint_auto_hide: broadcastAutoHide,
      broadcast_message_hide_at: hideAt,
      broadcast_hint_hide_at: hideAt,
      broadcast_message_updated_at: admin.firestore.FieldValue.serverTimestamp(),
      broadcast_hint_updated_at: admin.firestore.FieldValue.serverTimestamp(),
      broadcast_updated_at: admin.firestore.FieldValue.serverTimestamp(),
      hint_updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  console.log("Adding to broadcasts history collection");
  const historyRef = db.collection("broadcasts").doc();
  batch.set(historyRef, {
    route_id: selectedBroadcastRoute,
    route_name: "All Routes",
    message: hintVal,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    auto_hide: broadcastAutoHide,
    duration_minutes: broadcastAutoHide ? Number(broadcastDuration) : null,
    hide_at: hideAt,
    status: 'active'
  });

  console.log("Committing batch...");
  await batch.commit();
  console.log("Batch committed successfully!");
}

run().catch(err => {
  console.error("Error during run:", err);
});
