process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "demo-aitheron"
});

const auth = admin.auth();
const db = admin.firestore();

async function check() {
  console.log("=== Checking Auth Emulator Users ===");
  try {
    const listUsersResult = await auth.listUsers(100);
    listUsersResult.users.forEach((userRecord) => {
      console.log(`User: ${userRecord.email} (UID: ${userRecord.uid})`);
    });
    if (listUsersResult.users.length === 0) {
      console.log("No users found in Auth emulator.");
    }
  } catch (e) {
    console.error("Auth check failed: ", e);
  }

  console.log("\n=== Checking Firestore admins Collection ===");
  try {
    const adminsSnap = await db.collection("admins").get();
    adminsSnap.forEach((doc) => {
      console.log(`Admin Doc ID: ${doc.id} =>`, doc.data());
    });
    if (adminsSnap.empty) {
      console.log("No documents in 'admins' collection.");
    }
  } catch (e) {
    console.error("Admins Firestore check failed: ", e);
  }

  console.log("\n=== Checking Firestore teams Collection ===");
  try {
    const teamsSnap = await db.collection("teams").get();
    teamsSnap.forEach((doc) => {
      console.log(`Team Doc ID: ${doc.id} => Code: ${doc.data().team_code}, Name: ${doc.data().team_name}, Status: ${doc.data().status}`);
    });
    if (teamsSnap.empty) {
      console.log("No documents in 'teams' collection.");
    }
  } catch (e) {
    console.error("Teams Firestore check failed: ", e);
  }
}

check();
