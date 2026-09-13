const { GoogleGenAI, Type } = require('@google/genai');
const { v4: uuidv4 } = require('uuid');

/**
 * Extract assignment metadata from document text using Gemini.
 * Validates and normalizes output server-side.
 */
async function extractAssignmentFromText(text, filename) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'placeholder_will_set_later') {
    throw new Error('GEMINI_API_KEY is not set or configured on the server.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const currentDate = new Date().toISOString().split('T')[0];

  const prompt = `You are an academic assignment extraction assistant. 
Analyze the provided text from a student assignment document ("${filename}") and extract all relevant assignment details into structured JSON.

Document Text:
"""
${text}
"""

Instructions:
1. Identify the assignment title, course/subject name, deadline, original deadline text, key requirements, estimated completion time in hours, difficulty level, and extra notes.
2. If a specific deadline date/time is mentioned, convert it into a standard ISO 8601 string (e.g., "2026-09-25T23:59:00"). If no explicit date is given, set "deadline" to null.
3. Keep original text of the deadline in "deadlineText" (e.g. "Next Friday at midnight").
4. "estimatedHours" should be a realistic number of hours needed to complete the work based on complexity (e.g., 2.5, 5, 10).
5. "difficulty" must be one of "easy", "medium", or "hard".
6. "requirements" should be an array of specific key tasks or submission deliverables.
7. Today's reference date is ${currentDate}.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title of the assignment" },
      course: { type: Type.STRING, description: "Course or subject name (e.g., CS 201)" },
      deadline: { type: Type.STRING, description: "ISO 8601 datetime string, or null if not found", nullable: true },
      deadlineText: { type: Type.STRING, description: "Original deadline text as written in document" },
      requirements: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of key requirements and deliverables"
      },
      estimatedHours: { type: Type.NUMBER, description: "Estimated effort in hours" },
      difficulty: { type: Type.STRING, description: "easy, medium, or hard" },
      notes: { type: Type.STRING, description: "Additional details, submission guidelines, or grade weighting" }
    },
    required: ["title", "course", "deadlineText", "requirements", "estimatedHours", "difficulty", "notes"]
  };

  let rawJsonText;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.1,
      }
    });

    rawJsonText = response.text;
  } catch (err) {
    throw new Error(`Gemini API call failed: ${err.message}`);
  }

  // Server-side JSON parsing & validation
  let rawData;
  try {
    rawData = JSON.parse(rawJsonText);
  } catch (err) {
    throw new Error(`Gemini returned invalid JSON: ${err.message}`);
  }

  return validateAndNormalizeAssignment(rawData, filename);
}

/**
 * Deterministic validation and normalization of Gemini's extracted data.
 */
function validateAndNormalizeAssignment(data, filename) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid assignment data structure returned from AI.');
  }

  // 1. Title validation
  let title = (data.title && typeof data.title === 'string') ? data.title.trim() : '';
  if (!title) {
    title = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  }

  // 2. Course validation
  let course = (data.course && typeof data.course === 'string') ? data.course.trim() : '';
  if (!course) {
    course = 'General Academic';
  }

  // 3. Deadline ISO validation
  let deadline = null;
  if (data.deadline && typeof data.deadline === 'string') {
    const parsedDate = new Date(data.deadline);
    if (!isNaN(parsedDate.getTime())) {
      deadline = parsedDate.toISOString();
    }
  }

  // 4. Deadline original text
  let deadlineText = (data.deadlineText && typeof data.deadlineText === 'string') ? data.deadlineText.trim() : '';
  if (!deadlineText) {
    deadlineText = deadline ? new Date(deadline).toLocaleString() : 'No explicit deadline specified';
  }

  // 5. Requirements validation
  let requirements = [];
  if (Array.isArray(data.requirements)) {
    requirements = data.requirements
      .map(r => typeof r === 'string' ? r.trim() : '')
      .filter(r => r.length > 0);
  }
  if (requirements.length === 0) {
    requirements = ['Complete assignment per document instructions'];
  }

  // 6. Estimated hours validation
  let estimatedHours = parseFloat(data.estimatedHours);
  if (isNaN(estimatedHours) || estimatedHours <= 0) {
    estimatedHours = 3.0; // Reasonable fallback
  } else {
    estimatedHours = Math.round(estimatedHours * 10) / 10; // Round to 1 decimal place
  }

  // 7. Difficulty validation
  let difficulty = (data.difficulty && typeof data.difficulty === 'string') ? data.difficulty.toLowerCase().trim() : 'medium';
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    difficulty = 'medium';
  }

  // 8. Notes validation
  let notes = (data.notes && typeof data.notes === 'string') ? data.notes.trim() : '';

  return {
    id: uuidv4(),
    title,
    course,
    deadline,
    deadlineText,
    requirements,
    estimatedHours,
    difficulty,
    notes,
    sourceFile: filename,
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  extractAssignmentFromText,
  validateAndNormalizeAssignment
};
