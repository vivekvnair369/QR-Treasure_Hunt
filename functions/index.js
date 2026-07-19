const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
admin.initializeApp();

const db = admin.firestore();

// Helper to log audit actions
async function logAudit(actionType, performedBy, ipAddress, affectedTeam, details) {
  await db.collection('auditLogs').add({
    action_type: actionType,
    performed_by: performedBy,
    timestamp: FieldValue.serverTimestamp(),
    ip_address: ipAddress || '127.0.0.1',
    affected_team: affectedTeam || null,
    details: details
  });
}

// 1. Team Login via code verification and custom token response
exports.loginTeam = functions.https.onCall(async (data, context) => {
  const { team_code } = data;
  if (!team_code) {
    throw new functions.https.HttpsError('invalid-argument', 'Team code is required.');
  }

  const teamSnap = await db.collection('teams').where('team_code', '==', team_code).get();
  if (teamSnap.empty) {
    throw new functions.https.HttpsError('not-found', 'Invalid team code.');
  }

  const teamDoc = teamSnap.docs[0];
  const teamData = teamDoc.data();

  const customToken = await admin.auth().createCustomToken(teamDoc.id, {
    role: 'team'
  });

  return {
    token: customToken,
    team: {
      id: teamDoc.id,
      ...teamData
    }
  };
});

// 2. Transaction-based QR Validation
exports.validateQR = functions.https.onCall(async (data, context) => {
  const { qr_id, token, device, ip_address } = data;

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  const teamId = context.auth.uid;

  return await db.runTransaction(async (transaction) => {
    // A. Check active event status
    const eventQuery = await db.collection('events').where('active', '==', true).limit(1).get();
    if (eventQuery.empty) {
      throw new functions.https.HttpsError('failed-precondition', 'No active event configured.');
    }
    const eventDoc = eventQuery.docs[0];
    const eventData = eventDoc.data();

    // Check pre-start status values
    if (['draft', 'registration_open', 'registration_closed', 'ready'].includes(eventData.status)) {
      throw new functions.https.HttpsError('failed-precondition', 'AITHERON ML 2026 has not started yet. QR scanning is disabled.');
    } else if (eventData.status === 'paused') {
      throw new functions.https.HttpsError('failed-precondition', 'AITHERON ML 2026 is paused. Checkpoint scanning is suspended.');
    } else if (['completed', 'archived'].includes(eventData.status)) {
      throw new functions.https.HttpsError('failed-precondition', 'AITHERON ML 2026 has ended. Scanning is inactive.');
    } else if (eventData.status !== 'running') {
      throw new functions.https.HttpsError('failed-precondition', 'QR scanning is not active at this time.');
    }

    if (eventData.scans_locked) {
      throw new functions.https.HttpsError('failed-precondition', 'Scanning is locked. Contact coordinator.');
    }

    // B. Get team info
    const teamRef = db.collection('teams').doc(teamId);
    const teamDocVal = await transaction.get(teamRef);
    if (!teamDocVal.exists) {
      throw new functions.https.HttpsError('not-found', 'Team document not found.');
    }
    const teamData = teamDocVal.data();

    if (teamData.status === 'disqualified') {
      throw new functions.https.HttpsError('permission-denied', 'Disqualified teams cannot scan checkpoints.');
    }

    // C. Get target QR
    const qrSnap = await db.collection('qrCodes').doc(qr_id).get();
    if (!qrSnap.exists) {
      await db.collection('scanLogs').add({
        team_id: teamId,
        team_name: teamData.team_name,
        qr_id: qr_id,
        status: 'invalid_sequence',
        timestamp: FieldValue.serverTimestamp(),
        device: device || 'Unknown',
        ip_address: ip_address || '127.0.0.1'
      });
      throw new functions.https.HttpsError('not-found', 'Invalid QR code.');
    }
    const qrData = qrSnap.data();

    if (qrData.secret_token !== token) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid QR secret token.');
    }

    // D. Fetch Associated Clue
    const clueRef = db.collection('clues').doc(qrData.clue_id);
    const clueDoc = await transaction.get(clueRef);
    if (!clueDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Associated clue not found.');
    }
    const clueData = clueDoc.data();

    // Route matching check
    if (clueData.route_id !== teamData.route_id) {
      await db.collection('scanLogs').add({
        team_id: teamId,
        team_name: teamData.team_name,
        qr_id: qr_id,
        status: 'wrong_route',
        timestamp: FieldValue.serverTimestamp(),
        device: device || 'Unknown',
        ip_address: ip_address || '127.0.0.1'
      });
      return { status: 'wrong_route', message: 'This QR does not belong to your assigned route.' };
    }

    // Sequence checks
    const targetSeq = clueData.sequence;
    const currentSeq = teamData.current_sequence;

    if (targetSeq < currentSeq) {
      return { status: 'already_scanned', message: 'You have already solved this checkpoint.' };
    } else if (targetSeq > currentSeq) {
      await db.collection('scanLogs').add({
        team_id: teamId,
        team_name: teamData.team_name,
        qr_id: qr_id,
        status: 'invalid_sequence',
        timestamp: FieldValue.serverTimestamp(),
        device: device || 'Unknown',
        ip_address: ip_address || '127.0.0.1'
      });
      return { status: 'invalid_sequence', message: 'Checkpoint scanned out of order.' };
    }

    const isFirstClue = currentSeq === 1 && (teamData.status === 'registered' || teamData.status === 'checked_in');
    const isLastClue = currentSeq >= eventData.num_clues_per_route;

    const updates = {};
    let statusResult = 'success';

    if (isFirstClue) {
      updates.status = 'active';
      updates.start_time = FieldValue.serverTimestamp();
      statusResult = 'success';
    }

    if (isLastClue) {
      updates.status = 'finished';
      updates.finish_time = FieldValue.serverTimestamp();
      statusResult = 'finished';
    } else {
      updates.current_sequence = currentSeq + 1;
    }

    transaction.update(teamRef, updates);

    // Save success scan log
    await db.collection('scanLogs').add({
      team_id: teamId,
      team_name: teamData.team_name,
      qr_id: qr_id,
      status: 'valid',
      timestamp: FieldValue.serverTimestamp(),
      device: device || 'Unknown',
      ip_address: ip_address || '127.0.0.1'
    });

    const auditIp = ip_address || '127.0.0.1';
    if (isFirstClue) {
      await logAudit('team_start', teamData.leader_name || 'Team', auditIp, teamData.team_name, 'Team started the treasure hunt.');
    } else if (isLastClue) {
      await logAudit('team_finish', teamData.leader_name || 'Team', auditIp, teamData.team_name, 'Team successfully completed the treasure hunt!');
    } else {
      await logAudit('team_scan', teamData.leader_name || 'Team', auditIp, teamData.team_name, `Team scanned checkpoint clue #${currentSeq}.`);
    }

    const elapsedSeconds = isLastClue ? Math.max(0, Math.floor((Date.now() - (teamData.start_time ? teamData.start_time.toMillis() : Date.now())) / 1000)) : 0;
    
    await db.collection('leaderboard').doc(teamId).set({
      team_name: teamData.team_name,
      status: updates.status || teamData.status,
      current_sequence: updates.current_sequence || teamData.current_sequence,
      elapsed_seconds: elapsedSeconds - ((teamData.bonus_time_minutes || 0) * 60) + ((teamData.time_penalty_minutes || 0) * 60),
      hints_used: teamData.hints_used || 0,
      finish_time: isLastClue ? FieldValue.serverTimestamp() : null
    }, { merge: true });

    return { status: statusResult, clue: clueData };
  });
});

// 3. Event Control endpoint
exports.controlEvent = functions.https.onCall(async (data, context) => {
  const { action, config } = data;

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Admin access required.');
  }

  // Verify Admin uid in admins collection
  const adminSnap = await db.collection('admins').doc(context.auth.uid).get();
  if (!adminSnap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Only administrators can control event settings.');
  }

  const activeEventQuery = await db.collection('events').where('active', '==', true).limit(1).get();
  let eventRef = null;
  if (!activeEventQuery.empty) {
    eventRef = activeEventQuery.docs[0].ref;
  } else {
    const docRef = await db.collection('events').add({
      name: "AITHERON ML 2026",
      status: "draft",
      active: true,
      date: FieldValue.serverTimestamp()
    });
    eventRef = docRef;
  }

  const ip = data.ip_address || '127.0.5.1';
  const adminUser = context.auth.token.email || 'admin';

  if (action === 'restore_config' && config) {
    const updatedConfig = { ...config };
    const dateFields = ['registration_start', 'registration_end', 'event_start', 'event_end'];
    dateFields.forEach(field => {
      if (updatedConfig[field]) {
        if (typeof updatedConfig[field] === 'string') {
          const date = new Date(updatedConfig[field]);
          if (!isNaN(date.getTime())) {
            updatedConfig[field] = Timestamp.fromDate(date);
          } else {
            updatedConfig[field] = null;
          }
        }
      } else {
        updatedConfig[field] = null;
      }
    });
    await eventRef.update(updatedConfig);
    await logAudit('restore_config', adminUser, ip, null, 'Imported and restored event configuration.');
    return { success: true };
  }

  if (action === 'backup_config') {
    const snapshot = await eventRef.get();
    return snapshot.data();
  }

  if (action === 'start') {
    await eventRef.update({
      status: 'running',
      event_start: FieldValue.serverTimestamp()
    });
    await logAudit('event_control', adminUser, ip, null, 'Admin launched the event.');
  } else if (action === 'pause') {
    await eventRef.update({
      status: 'paused',
      paused_at: FieldValue.serverTimestamp()
    });
    const runningTeams = await db.collection('teams').where('status', '==', 'active').get();
    const batch = db.batch();
    runningTeams.forEach(tDoc => {
      batch.update(tDoc.ref, {
        status: 'paused',
        paused_at: FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
    await logAudit('event_control', adminUser, ip, null, 'Suspended checkpoint scanning globally.');
  } else if (action === 'resume') {
    const eventDoc = await eventRef.get();
    const eventData = eventDoc.data();
    const pauseStart = eventData.paused_at ? eventData.paused_at.toMillis() : Date.now();
    const pauseDur = Math.floor((Date.now() - pauseStart) / 1000);
    const prevPause = eventData.total_paused_duration_seconds || 0;

    await eventRef.update({
      status: 'running',
      paused_at: null,
      total_paused_duration_seconds: prevPause + pauseDur
    });

    const pausedTeams = await db.collection('teams').where('status', '==', 'paused').get();
    const batch = db.batch();
    pausedTeams.forEach(tDoc => {
      const tData = tDoc.data();
      const tPauseStart = tData.paused_at ? tData.paused_at.toMillis() : Date.now();
      const tPauseDur = Math.floor((Date.now() - tPauseStart) / 1000);
      const tPrevPause = tData.total_paused_duration_seconds || 0;

      batch.update(tDoc.ref, {
        status: 'active',
        paused_at: null,
        total_paused_duration_seconds: tPrevPause + tPauseDur
      });
    });
    await batch.commit();
    await logAudit('event_control', adminUser, ip, null, 'Resumed the event. Scanning re-enabled.');
  } else if (action === 'end') {
    await eventRef.update({
      status: 'completed',
      event_end: FieldValue.serverTimestamp()
    });
    const activeTeams = await db.collection('teams').where('status', 'in', ['active', 'paused']).get();
    const batch = db.batch();
    activeTeams.forEach(tDoc => {
      batch.update(tDoc.ref, {
        status: 'finished',
        finish_time: FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
    await logAudit('event_control', adminUser, ip, null, 'Event marked as completed. All active team timers stopped.');
  } else if (action === 'lock_scans') {
    await eventRef.update({ scans_locked: true });
    await logAudit('event_control', adminUser, ip, null, 'Locked scans globally.');
  } else if (action === 'unlock_scans') {
    await eventRef.update({ scans_locked: false });
    await logAudit('event_control', adminUser, ip, null, 'Unlocked scans globally.');
  } else if (action === 'freeze_leaderboard') {
    await eventRef.update({ leaderboard_frozen: true });
    await logAudit('event_control', adminUser, ip, null, 'Froze leaderboard updates.');
  } else if (action === 'unfreeze_leaderboard') {
    await eventRef.update({ leaderboard_frozen: false });
    await logAudit('event_control', adminUser, ip, null, 'Unfroze leaderboard updates.');
  } else if (action === 'hide_leaderboard') {
    await eventRef.update({ leaderboard_hidden: true });
    await logAudit('event_control', adminUser, ip, null, 'Hid leaderboard from team dashboards.');
  } else if (action === 'show_leaderboard') {
    await eventRef.update({ leaderboard_hidden: false });
    await logAudit('event_control', adminUser, ip, null, 'Exposed leaderboard to team dashboards.');
  } else if (action === 'soft_reset') {
    const batch = db.batch();
    const scanLogs = await db.collection('scanLogs').get();
    scanLogs.forEach(doc => batch.delete(doc.ref));
    const teams = await db.collection('teams').get();
    teams.forEach(doc => {
      batch.update(doc.ref, {
        start_time: null,
        finish_time: null,
        status: 'registered',
        current_sequence: 1,
        time_penalty_minutes: 0,
        bonus_time_minutes: 0,
        hints_used: 0,
        total_paused_duration_seconds: 0,
        paused_at: null
      });
    });
    const lbDocs = await db.collection('leaderboard').get();
    lbDocs.forEach(doc => batch.delete(doc.ref));

    await batch.commit();

    await eventRef.update({
      paused_at: null,
      total_paused_duration_seconds: 0
    });
    await logAudit('event_control', adminUser, ip, null, 'Soft reset completed. Wiped logs and progress.');
  } else if (action === 'full_reset') {
    const batch = db.batch();
    const scanLogs = await db.collection('scanLogs').get();
    scanLogs.forEach(doc => batch.delete(doc.ref));
    const teams = await db.collection('teams').get();
    teams.forEach(doc => batch.delete(doc.ref));
    const lbDocs = await db.collection('leaderboard').get();
    lbDocs.forEach(doc => batch.delete(doc.ref));
    const clues = await db.collection('clues').get();
    clues.forEach(doc => batch.delete(doc.ref));
    const routes = await db.collection('routes').get();
    routes.forEach(doc => batch.delete(doc.ref));

    await batch.commit();

    await eventRef.update({
      status: 'draft',
      paused_at: null,
      total_paused_duration_seconds: 0
    });
    await logAudit('event_control', adminUser, ip, null, 'CRITICAL: Full reset completed. Cleared database completely.');
  }

  return { success: true };
});

// Helper to update leaderboard doc on changes
async function updateLeaderboardDoc(teamId) {
  const teamDoc = await db.collection('teams').doc(teamId).get();
  if (!teamDoc.exists) return;
  const teamData = teamDoc.data();
  
  let elapsedSeconds = 0;
  if (teamData.start_time) {
    const start = teamData.start_time.toMillis();
    const end = teamData.finish_time ? teamData.finish_time.toMillis() : Date.now();
    let duration = (end - start) / 1000;
    
    let totalPause = teamData.total_paused_duration_seconds || 0;
    if (teamData.status === 'paused' && teamData.paused_at) {
      totalPause += (Date.now() - teamData.paused_at.toMillis()) / 1000;
    }
    
    duration = duration - totalPause - ((teamData.bonus_time_minutes || 0) * 60) + ((teamData.time_penalty_minutes || 0) * 60);
    elapsedSeconds = Math.max(0, Math.floor(duration));
  }

  await db.collection('leaderboard').doc(teamId).set({
    team_name: teamData.team_name,
    status: teamData.status,
    current_sequence: teamData.current_sequence || 1,
    elapsed_seconds: elapsedSeconds,
    hints_used: teamData.hints_used || 0,
    finish_time: teamData.finish_time || null
  }, { merge: true });
}

// 4. Admin override on specific team
exports.overrideTeam = functions.https.onCall(async (data, context) => {
  const { team_id, action, bonus_time_minutes, penalty_minutes } = data;

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Admin access required.');
  }

  const adminSnap = await db.collection('admins').doc(context.auth.uid).get();
  if (!adminSnap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Only administrators can execute overrides.');
  }

  const teamRef = db.collection('teams').doc(team_id);
  const teamDoc = await teamRef.get();
  if (!teamDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Team not found.');
  }

  const teamData = teamDoc.data();
  const ip = data.ip_address || '127.0.0.1';
  const adminUser = context.auth.token.email || 'admin';

  if (action === 'unlock_next') {
    const nextSeq = teamData.current_sequence + 1;
    await teamRef.update({ current_sequence: nextSeq });
    await logAudit('manual_override', adminUser, ip, teamData.team_name, `Manually unlocked next sequence (${nextSeq}) clue.`);
  } else if (action === 'skip_current') {
    const nextSeq = teamData.current_sequence + 1;
    await teamRef.update({ current_sequence: nextSeq });
    await logAudit('manual_override', adminUser, ip, teamData.team_name, `Skipped checkpoint sequence ${teamData.current_sequence}.`);
  } else if (action === 'restart') {
    await teamRef.update({
      start_time: null,
      finish_time: null,
      status: 'registered',
      current_sequence: 1,
      time_penalty_minutes: 0,
      bonus_time_minutes: 0,
      hints_used: 0,
      total_paused_duration_seconds: 0,
      paused_at: null
    });
    await logAudit('manual_override', adminUser, ip, teamData.team_name, 'Wiped and reset all progress.');
  } else if (action === 'mark_completed') {
    await teamRef.update({
      status: 'finished',
      finish_time: FieldValue.serverTimestamp()
    });
    await logAudit('manual_override', adminUser, ip, teamData.team_name, 'Forced status completion.');
  } else if (action === 'bonus_time') {
    const updated = (teamData.bonus_time_minutes || 0) + bonus_time_minutes;
    await teamRef.update({ bonus_time_minutes: updated });
    await logAudit('manual_override', adminUser, ip, teamData.team_name, `Awarded ${bonus_time_minutes} minutes bonus time.`);
  } else if (action === 'time_penalty') {
    const updated = (teamData.time_penalty_minutes || 0) + penalty_minutes;
    await teamRef.update({ time_penalty_minutes: updated });
    await logAudit('manual_override', adminUser, ip, teamData.team_name, `Applied ${penalty_minutes} minutes penalty.`);
  } else if (action === 'pause') {
    await teamRef.update({
      status: 'paused',
      paused_at: FieldValue.serverTimestamp()
    });
    await logAudit('manual_override', adminUser, ip, teamData.team_name, 'Paused team timer.');
  } else if (action === 'resume') {
    const pauseStart = teamData.paused_at ? teamData.paused_at.toMillis() : Date.now();
    const pauseDur = Math.floor((Date.now() - pauseStart) / 1000);
    const prevPause = teamData.total_paused_duration_seconds || 0;
    
    await teamRef.update({
      status: 'active',
      paused_at: null,
      total_paused_duration_seconds: prevPause + pauseDur
    });
    await logAudit('manual_override', adminUser, ip, teamData.team_name, 'Resumed team timer.');
  }

  await updateLeaderboardDoc(team_id);

  return { success: true };
});
