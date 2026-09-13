require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const { extractText } = require('./parser');
const { extractAssignmentFromText } = require('./gemini');
const { buildTimeline } = require('./timeline');
const {
  getSessionId,
  getAssignments,
  addAssignments,
  removeAssignment,
  clearAssignments
} = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Multer: in-memory storage, 10MB limit, max 10 files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Accepted: PDF`));
    }
  },
});

// --- Routes ---

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/timeline — Returns current session timeline & recommendation
app.get('/api/timeline', (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const rawAssignments = getAssignments(sessionId);
    const timeline = buildTimeline(rawAssignments);
    res.json({ success: true, ...timeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload — Extract assignment info & add to timeline
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'placeholder_will_set_later') {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please set GEMINI_API_KEY in your environment or .env file.'
      });
    }

    const sessionId = getSessionId(req);
    const newAssignments = [];
    const errors = [];

    for (const file of req.files) {
      try {
        // Step 1: Text extraction from PDF
        const extracted = await extractText(file.buffer, file.mimetype, file.originalname);

        // Step 2: Gemini AI extraction & server-side validation
        const assignment = await extractAssignmentFromText(extracted.text, file.originalname);

        newAssignments.push(assignment);
      } catch (err) {
        errors.push({ filename: file.originalname, error: err.message });
      }
    }

    if (newAssignments.length > 0) {
      addAssignments(sessionId, newAssignments);
    }

    const updatedRaw = getAssignments(sessionId);
    const timeline = buildTimeline(updatedRaw);

    const statusCode = newAssignments.length > 0 ? 200 : 422;
    res.status(statusCode).json({
      success: newAssignments.length > 0,
      addedCount: newAssignments.length,
      errors,
      summary: `${newAssignments.length} assignment(s) added, ${errors.length} error(s).`,
      timeline
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/assignments/:id — Remove assignment by ID
app.delete('/api/assignments/:id', (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const { id } = req.params;
    removeAssignment(sessionId, id);
    const updatedRaw = getAssignments(sessionId);
    const timeline = buildTimeline(updatedRaw);
    res.json({ success: true, message: 'Assignment deleted.', timeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/assignments — Reset/Clear all assignments for session
app.delete('/api/assignments', (req, res) => {
  try {
    const sessionId = getSessionId(req);
    clearAssignments(sessionId);
    const timeline = buildTimeline([]);
    res.json({ success: true, message: 'All assignments cleared.', timeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Multer & General error handler ---
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`DeadlineIQ server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
