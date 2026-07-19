process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "demo-aitheron"
});

const auth = admin.auth();
const db = admin.firestore();

async function seed() {
  console.log("Seeding local Firebase Emulators database...");

  try {
    // 1. Create Admin Auth Account
    let adminUser;
    try {
      adminUser = await auth.createUser({
        uid: "admin-uid-123",
        email: "admin@aitheron.com",
        password: "adminpass",
        displayName: "Symposium Admin"
      });
      console.log("Created Auth admin account: admin@aitheron.com");
    } catch (e) {
      if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
        adminUser = await auth.getUserByEmail("admin@aitheron.com");
        console.log("Admin Auth account already exists.");
      } else {
        throw e;
      }
    }

    // 2. Create Admin doc in Firestore
    await db.collection("admins").doc(adminUser.uid).set({
      email: "admin@aitheron.com",
      role: "admin",
      name: "Symposium Admin"
    });
    console.log("Created Firestore admin profile.");

    // 3. Create active event configuration
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

    // 4. Seed sample routes
    const routes = ["Route A", "Route B", "Route C"];
    const routeIds = [];
    for (const name of routes) {
      const rRef = db.collection("routes").doc(name.toLowerCase().replace(" ", "_"));
      await rRef.set({ name });
      routeIds.push(rRef.id);
      console.log(`Created route: ${name}`);
    }

    // 5. Seed sample clues & secrets
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

    // 6. Create Test Teams
    const sampleTeams = [
      { name: "Cyber Knights", code: "T-CYBER", route: routeIds[0] },
      { name: "Data Wizards", code: "T-DATA", route: routeIds[1] },
      { name: "Code Breakers", code: "T-CODE", route: routeIds[2] }
    ];

    for (const t of sampleTeams) {
      await db.collection("teams").doc(`team_${t.code.toLowerCase()}`).set({
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
    console.log("SUCCESS: Firebase Local Emulator seed complete!");
    console.log("-------------------------------------------------");
    console.log("ADMIN LOGIN CREDENTIALS:");
    console.log("Username: admin (or admin@aitheron.com)");
    console.log("Password: adminpass");
    console.log("-------------------------------------------------");
    console.log("SAMPLE TEAM CODE LOGIN:");
    console.log("Team Code: T-CYBER");
    console.log("=================================================\n");

  } catch (e) {
    console.error("Seeding failed: ", e);
  }
}

seed();
