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
      num_clues_per_route: 3,
      current_round: 1,
      championship_started: false,
      championship_winner_id: "",
      championship_winner_name: "",
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
    const routes = [
      { id: "route_a", name: "Route A" },
      { id: "route_b", name: "Route B" },
      { id: "route_c", name: "Route C" },
      { id: "championship", name: "Championship Route" }
    ];
    for (const r of routes) {
      await db.collection("routes").doc(r.id).set({
        name: r.name,
        winner_team_id: "",
        winner_team_name: "",
        winner_finish_time: null,
        broadcast_hint: ""
      });
      console.log(`Created route: ${r.name}`);
    }

    // 6. Seed sample clues & secrets
    const routesClues = {
      route_a: [
        { location_name: 'Library', clue_text: 'I have thousands of sheets but no beds, thousands of stories but no dreams.', answer: 'Library', hint: 'Go to the Central Library' },
        { location_name: 'AI Lab', clue_text: 'Where silicon chips meet artificial minds, and future software takes its designs.', answer: 'AI Lab', hint: 'Computer Science Department' },
        { location_name: 'Seminar Hall A', clue_text: 'A hub of knowledge and seminar talks, where professors present and students walk.', answer: 'Seminar Hall A', hint: 'Block A main floor' }
      ],
      route_b: [
        { location_name: 'Mechanical Block', clue_text: 'Listen to the gears grind and engines roar, where mechanical dreams take flight and soar.', answer: 'Mechanical Block', hint: 'Workshop Area' },
        { location_name: 'Canteen', clue_text: 'Where coffee brews and hunger dies, under the smell of hot samosa pies.', answer: 'Canteen', hint: 'Snack Joint' },
        { location_name: 'Parking Area B', clue_text: 'A vast expanse where two-wheelers rest, resting in shade or in sun at its best.', answer: 'Parking Area B', hint: 'Near B Block entrance' }
      ],
      route_c: [
        { location_name: 'Chemistry Lab', clue_text: 'Where chemicals react and beakers glow, where liquids change color in a steady flow.', answer: 'Chemistry Lab', hint: 'Science Block Ground Floor' },
        { location_name: 'Telecom Lab', clue_text: 'Where antennas capture signals from the air, transmitting bytes and waves with care.', answer: 'Telecom Lab', hint: 'Block C Second Floor' },
        { location_name: 'Programming Lab', clue_text: 'Where lines of code are written on screens, and students code their software dreams.', answer: 'Programming Lab', hint: 'Block C Third Floor' }
      ],
      championship: [
        { location_name: 'Admin Block Plaza', clue_text: 'Where the national flag flies high and proud, in front of the main building\'s crowd.', answer: 'Admin Block Plaza', hint: 'Main Flagpole' },
        { location_name: 'College Ground', clue_text: 'Where green grass grows and athletes run, playing football or cricket in the sun.', answer: 'College Ground', hint: 'Sports Field Pavilion' },
        { location_name: 'Auditorium', clue_text: 'The final hall where winners are crowned, where the loudest cheers and applause resound.', answer: 'Auditorium', hint: 'Main Auditorium Building' }
      ]
    };

    for (const [rId, cluesList] of Object.entries(routesClues)) {
      let seq = 1;
      for (const clue of cluesList) {
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

    // 7. Create Test Teams (15 teams total: 5 per route A/B/C)
    const sampleTeams = [];
    for (let i = 1; i <= 5; i++) {
      sampleTeams.push({ name: `Alpha Team ${i}`, code: `T-ALPHA${i}`, route: "route_a" });
      sampleTeams.push({ name: `Beta Team ${i}`, code: `T-BETA${i}`, route: "route_b" });
      sampleTeams.push({ name: `Gamma Team ${i}`, code: `T-GAMMA${i}`, route: "route_c" });
    }

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
        leader_email: email,
        num_members: 3,
        member_names: "Alice, Bob, Charlie",
        route_id: t.route,
        original_route_id: t.route,
        status: "registered",
        current_sequence: 1,
        time_penalty_minutes: 0,
        bonus_time_minutes: 0,
        hints_used: 0,
        total_paused_duration_seconds: 0,
        paused_at: null,
        is_qualifying_winner: false,
        round: 1
      });
      console.log(`Created Team: ${t.name} (Code: ${t.code})`);
    }

    console.log("\n=================================================");
    console.log("SUCCESS: Firebase Production database seed complete!");
    console.log("-------------------------------------------------");
    console.log(`ADMIN ACCOUNT: ${adminEmail}`);
    console.log("Team Codes: T-A1 to T-A5, T-B1 to T-B5, T-C1 to T-C5");
    console.log("=================================================\n");

  } catch (e) {
    console.error("Seeding failed: ", e);
  }
}

seed();
