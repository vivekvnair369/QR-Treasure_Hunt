const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// 1. Locate and load production service account key
let serviceAccountPath = null;
if (fs.existsSync(path.join(__dirname, "service-account.json"))) {
  serviceAccountPath = path.join(__dirname, "service-account.json");
} else if (fs.existsSync(path.join(__dirname, "..", "service-account.json"))) {
  serviceAccountPath = path.join(__dirname, "..", "service-account.json");
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !serviceAccountPath) {
  console.error("\x1b[31mERROR: Firebase production credentials not found.\x1b[0m");
  console.error("To seed the production database, please do one of the following:");
  console.error("  1. Download a Service Account private key JSON from Firebase Console > Project Settings > Service Accounts.");
  console.error("  2. Place it as 'service-account.json' in the root directory or 'functions' directory.");
  console.error("  3. Alternatively, export GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json\n");
  process.exit(1);
}

const config = serviceAccountPath ? { credential: admin.credential.cert(serviceAccountPath) } : {};
admin.initializeApp(config);

const auth = admin.auth();
const db = admin.firestore();

async function seed() {
  console.log("Seeding Production Firebase database...");

  try {
    // 2. Fetch or Create Admin Auth Account
    let adminUser;
    const adminEmail = "vivekvnair9037@gmail.com";
    try {
      adminUser = await auth.getUserByEmail(adminEmail);
      console.log(`Admin Auth account already exists for ${adminEmail} (UID: ${adminUser.uid}).`);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        adminUser = await auth.createUser({
          email: adminEmail,
          password: "adminpassword123", // Temporary password, to be reset on first login
          displayName: "Symposium Coordinator"
        });
        console.log(`Created new Auth admin account: ${adminEmail} with temp password.`);
      } else {
        throw e;
      }
    }

    // 3. Create Admin doc in Firestore
    await db.collection("admins").doc(adminUser.uid).set({
      email: adminEmail,
      role: "admin",
      name: "Symposium Coordinator"
    });
    console.log(`Created/Updated Firestore admin profile document for admins/${adminUser.uid}.`);

    // 4. Create active event configuration
    await db.collection("events").doc("active_event").set({
      name: "AITHERON ML 2026 Treasure Hunt",
      description: "National Level Technical Symposium QR Treasure Hunt Activity.",
      venue: "CS Campus Blocks",
      max_teams: 50,
      num_routes: 3,
      num_clues_per_route: 4,
      final_destination: "Seminar Hall 2",
      status: "ready",
      active: true,
      countdown_timer_active: false,
      grace_time_minutes: 5,
      max_time_limit_minutes: 90,
      scans_locked: false,
      leaderboard_frozen: false,
      leaderboard_hidden: false,
      total_paused_duration_seconds: 0
    });
    console.log("Created active event config.");

    // 5. Seed sample routes
    const routes = ["Route A", "Route B", "Route C"];
    const routeIds = [];
    for (const name of routes) {
      const rRef = db.collection("routes").doc(name.toLowerCase().replace(" ", "_"));
      await rRef.set({ name });
      routeIds.push(rRef.id);
      console.log(`Created route: ${name}`);
    }

    // 6. Seed sample clues & secrets
    const cluesPool = [
      { location_name: 'Library', clue_text: 'I have thousands of sheets but no beds, thousands of stories but no dreams.', answer: 'Library', hint: 'Go to the Central Library' },
      { location_name: 'AI Lab', clue_text: 'Where silicon chips meet artificial minds, and future software takes its designs.', answer: 'AI Lab', hint: 'Computer Science Department' },
      { location_name: 'Mechanical Block', clue_text: 'Listen to the gears grind and engines roar, where mechanical dreams take flight and soar.', answer: 'Mechanical Block', hint: 'Workshop Area' },
      { location_name: 'Canteen', clue_text: 'Where coffee brews and hunger dies, under the smell of hot samosa pies.', answer: 'Canteen', hint: 'Snack Joint' }
    ];

    for (const rId of routeIds) {
      let seq = 1;
      for (const clue of cluesPool) {
        const cId = `clue_${rId}_${seq}`;
        const qrId = `qr_${rId}_${seq}`;
        const secret = `secret_${rId}_${seq}`;

        await db.collection("qrCodes").doc(qrId).set({
          qr_id: qrId,
          clue_id: cId,
          secret_token: secret
        });

        await db.collection("clues").doc(cId).set({
          route_id: rId,
          sequence: seq,
          clue_text: clue.clue_text,
          answer: clue.answer,
          hint: clue.hint,
          location_name: clue.location_name,
          qr_id: qrId,
          enabled: true,
          placement_status: 'placed'
        });
        seq++;
      }
    }
    console.log("Created clues and QR codes mapping.");

    // 7. Create Test Teams
    const sampleTeams = [
      { name: "Cyber Knights", code: "T-CYBER", route: routeIds[0] },
      { name: "Data Wizards", code: "T-DATA", route: routeIds[1] },
      { name: "Code Breakers", code: "T-CODE", route: routeIds[2] }
    ];

    for (const t of sampleTeams) {
      const email = `${t.code.toLowerCase()}@aitheron.com`;
      let userRecord;
      try {
        userRecord = await auth.createUser({
          email: email,
          password: t.code,
          displayName: t.name
        });
        console.log(`Created Auth team account: ${email} with password: ${t.code}`);
      } catch (err) {
        if (err.code === 'auth/email-already-exists') {
          userRecord = await auth.getUserByEmail(email);
          console.log(`Team account ${email} already exists.`);
        } else {
          throw err;
        }
      }

      await db.collection("teams").doc(userRecord.uid).set({
        team_name: t.name,
        team_code: t.code,
        college_name: "Aitheron Engineering College",
        department: "CSE",
        leader_name: `${t.name} Leader`,
        phone: "9876543210",
        leader_email: `${t.code.toLowerCase()}@aitheron.com`,
        num_members: 3,
        member_names: "Alice, Bob, Charlie",
        route_id: t.route,
        status: "registered",
        current_sequence: 1,
        time_penalty_minutes: 0,
        bonus_time_minutes: 0,
        hints_used: 0,
        total_paused_duration_seconds: 0,
        paused_at: null
      });
      console.log(`Created Team: ${t.name} (Code: ${t.code})`);
    }

    console.log("\n=================================================");
    console.log("SUCCESS: Firebase Production database seed complete!");
    console.log("-------------------------------------------------");
    console.log(`ADMIN ACCOUNT: ${adminEmail}`);
    console.log("=================================================\n");

  } catch (e) {
    console.error("Seeding failed: ", e);
  }
}

seed();
