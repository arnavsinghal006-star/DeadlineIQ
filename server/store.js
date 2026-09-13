/**
 * Simple in-memory storage for session assignments.
 * Keyed by sessionId (defaulting to 'default-session' if none provided).
 */

const sessions = new Map();

function getSessionId(req) {
  return req.headers['x-session-id'] || 'default-session';
}

function getAssignments(sessionId = 'default-session') {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  return sessions.get(sessionId);
}

function setAssignments(sessionId = 'default-session', assignments) {
  sessions.set(sessionId, assignments);
}

function addAssignments(sessionId = 'default-session', newAssignments) {
  const current = getAssignments(sessionId);
  const updated = [...current, ...newAssignments];
  sessions.set(sessionId, updated);
  return updated;
}

function removeAssignment(sessionId = 'default-session', assignmentId) {
  const current = getAssignments(sessionId);
  const updated = current.filter(a => a.id !== assignmentId);
  sessions.set(sessionId, updated);
  return updated;
}

function clearAssignments(sessionId = 'default-session') {
  sessions.set(sessionId, []);
}

module.exports = {
  getSessionId,
  getAssignments,
  setAssignments,
  addAssignments,
  removeAssignment,
  clearAssignments,
};
