# ⚡ DeadlineIQ — AI-Powered Student Assignment Timeline

> **Prompt Wars Winner MVP** — Upload assignment PDF documents, automatically extract due dates and requirements via Gemini AI, and instantly generate a prioritized academic schedule with a **"YOUR NEXT MOVE"** recommendation engine.

---

## 🚀 Key Features

- 📄 **PDF Assignment Processing**: Upload 1 or multiple PDF syllabus/assignment documents simultaneously.
- 🤖 **AI-Powered Extraction**: Uses Google Gemini API (`gemini-3.6-flash`) to parse assignment title, course, due dates, difficulty, estimated effort hours, and key deliverable checklists.
- ⚡ **Deterministic Priority Engine**: Computes a transparent **Urgency Score (0–100)** considering deadline proximity, estimated workload, and difficulty.
- 🎯 **"YOUR NEXT MOVE" Recommendation**: Automatically highlights the single highest-priority task with a human-readable explanation reason.
- ⚠️ **48-Hour Congestion Detector**: Identifies deadline clusters within 48 hours and flags total accumulated workload hours.
- 🎨 **Modern Dark UI**: Polished glassmorphism single-page app built with pure HTML5, CSS3, and JavaScript.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, Multer
- **PDF Extraction**: `pdfjs-dist` (Mozilla PDF.js)
- **AI Integration**: Official `@google/genai` SDK (`gemini-3.6-flash`)
- **Frontend**: Vanilla HTML5 / CSS3 / ES6 JavaScript (Zero frontend framework dependencies)

---

## 💻 Local Setup & Development

### 1. Clone & Install Dependencies
```bash
git clone <your-repo-url>
cd promptwars
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root (or copy `.env.example`):

```bash
cp .env.example .env
```

Set your Gemini API key in `.env`:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=3000
```

### 3. Run the Server
```bash
# Production mode
npm start

# Development mode (auto-reload on Node 18+)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Production Deployment (Render.com)

1. Push this repository to **GitHub**.
2. Log into [Render.com](https://render.com) and click **New +** $\rightarrow$ **Web Service**.
3. Connect your GitHub repository.
4. Set the following build settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Under **Environment Variables**, add:
   - Key: `GEMINI_API_KEY`
   - Value: `<your-gemini-api-key>`
6. Click **Create Web Service**. Render will build and deploy the app automatically.

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check endpoint |
| `GET` | `/api/timeline` | Fetch current session timeline, hero recommendation, conflicts & stats |
| `POST` | `/api/upload` | Upload assignment PDFs (multipart/form-data `files`), extract with Gemini, update timeline |
| `DELETE` | `/api/assignments/:id` | Remove a single assignment from timeline |
| `DELETE` | `/api/assignments` | Clear all assignments for current session |

---

## 🔒 Security & Privacy

- `GEMINI_API_KEY` remains strictly server-side and is never exposed to the client.
- All assignment state is kept in-memory per session (no persistent database required).

---

## 📄 License
MIT License. Built for Prompt Wars 2026.
