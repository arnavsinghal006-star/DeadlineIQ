// DeadlineIQ — Frontend Controller Application Logic

document.addEventListener('DOMContentLoaded', () => {
  // DOM Element References
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileList = document.getElementById('fileList');
  const uploadBtn = document.getElementById('uploadBtn');
  const loadingBox = document.getElementById('loadingBox');
  const loadingMessage = document.getElementById('loadingMessage');
  const errorBanner = document.getElementById('errorBanner');
  const errorMessage = document.getElementById('errorMessage');
  const dismissErrorBtn = document.getElementById('dismissErrorBtn');
  const resetBtn = document.getElementById('resetBtn');

  const heroSection = document.getElementById('heroSection');
  const heroPriorityBadge = document.getElementById('heroPriorityBadge');
  const heroTitle = document.getElementById('heroTitle');
  const heroReason = document.getElementById('heroReason');
  const heroCourse = document.getElementById('heroCourse');
  const heroDeadline = document.getElementById('heroDeadline');
  const heroEffort = document.getElementById('heroEffort');
  const heroUrgencyScore = document.getElementById('heroUrgencyScore');

  const conflictsContainer = document.getElementById('conflictsContainer');
  const statsGrid = document.getElementById('statsGrid');
  const statTotal = document.getElementById('statTotal');
  const statHours = document.getElementById('statHours');
  const statOverdue = document.getElementById('statOverdue');
  const statBusiest = document.getElementById('statBusiest');

  const timelineSection = document.getElementById('timelineSection');
  const timelineList = document.getElementById('timelineList');
  const emptyState = document.getElementById('emptyState');

  let selectedFiles = [];

  // Initialize page on load
  fetchTimeline();

  // --- Drag and Drop File Selection ---
  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (droppedFiles.length > 0) {
      selectedFiles = droppedFiles;
      updateFilePreview();
    } else {
      showError('Please upload PDF documents only.');
    }
  });

  fileInput.addEventListener('change', () => {
    selectedFiles = Array.from(fileInput.files);
    updateFilePreview();
  });

  function updateFilePreview() {
    fileList.innerHTML = '';
    if (selectedFiles.length === 0) {
      fileList.classList.add('hidden');
      uploadBtn.disabled = true;
      return;
    }

    fileList.classList.remove('hidden');
    selectedFiles.forEach(file => {
      const item = document.createElement('div');
      item.className = 'file-item';
      const sizeKB = Math.round(file.size / 1024);
      item.innerHTML = `
        <span class="file-name">📄 ${escapeHtml(file.name)}</span>
        <span class="file-size">${sizeKB} KB</span>
      `;
      fileList.appendChild(item);
    });

    uploadBtn.disabled = false;
    hideError();
  }

  // --- Upload Action ---
  uploadBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    uploadBtn.disabled = true;
    showLoading('Reading PDF & extracting assignments with Gemini AI...');
    hideError();

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || (data.errors && data.errors[0] ? data.errors[0].error : 'Upload processing failed.'));
      }

      // Reset file selection
      selectedFiles = [];
      fileInput.value = '';
      updateFilePreview();

      // Render timeline
      renderTimeline(data.timeline);
    } catch (err) {
      showError(err.message || 'An unexpected error occurred during processing.');
    } finally {
      hideLoading();
      uploadBtn.disabled = selectedFiles.length === 0;
    }
  });

  // --- Reset Action ---
  resetBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear your current timeline?')) return;

    try {
      const res = await fetch('/api/assignments', { method: 'DELETE' });
      const data = await res.json();
      if (data.timeline) {
        renderTimeline(data.timeline);
      }
    } catch (err) {
      showError('Failed to clear assignments.');
    }
  });

  dismissErrorBtn.addEventListener('click', hideError);

  // --- Fetch Current Timeline ---
  async function fetchTimeline() {
    try {
      const res = await fetch('/api/timeline');
      const data = await res.json();
      if (data.success) {
        renderTimeline(data);
      }
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    }
  }

  // --- Delete Single Assignment ---
  async function deleteAssignment(id) {
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.timeline) {
        renderTimeline(data.timeline);
      }
    } catch (err) {
      showError('Failed to delete assignment.');
    }
  }

  // --- Render Full Timeline View ---
  function renderTimeline(timeline) {
    if (!timeline || !timeline.assignments || timeline.assignments.length === 0) {
      // Empty State
      heroSection.classList.add('hidden');
      conflictsContainer.classList.add('hidden');
      statsGrid.classList.add('hidden');
      timelineSection.classList.add('hidden');
      resetBtn.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    // Hide empty state, show content sections
    emptyState.classList.add('hidden');
    resetBtn.classList.remove('hidden');
    statsGrid.classList.remove('hidden');
    timelineSection.classList.remove('hidden');

    // 1. Render Hero Recommendation ("YOUR NEXT MOVE")
    if (timeline.recommendation && timeline.recommendation.assignment) {
      const rec = timeline.recommendation;
      const top = rec.assignment;

      heroSection.classList.remove('hidden');
      heroTitle.textContent = top.title;
      heroReason.textContent = rec.reason;
      heroCourse.textContent = top.course;
      heroDeadline.textContent = top.deadlineText || (top.deadline ? new Date(top.deadline).toLocaleString() : 'No explicit date');
      heroEffort.textContent = `${top.estimatedHours} hrs`;
      heroUrgencyScore.textContent = `${top.urgencyScore}/100`;

      heroPriorityBadge.textContent = top.priority.toUpperCase();
      heroPriorityBadge.className = `badge badge-${top.priority}`;
    } else {
      heroSection.classList.add('hidden');
    }

    // 2. Render Conflicts / Congestion Alerts
    conflictsContainer.innerHTML = '';
    if (timeline.conflicts && timeline.conflicts.length > 0) {
      conflictsContainer.classList.remove('hidden');
      timeline.conflicts.forEach(conflict => {
        const card = document.createElement('div');
        card.className = 'conflict-card';
        card.innerHTML = `
          <div class="conflict-icon">⚠️</div>
          <div class="conflict-text">${escapeHtml(conflict.message)}</div>
        `;
        conflictsContainer.appendChild(card);
      });
    } else {
      conflictsContainer.classList.add('hidden');
    }

    // 3. Render Stats Grid
    const stats = timeline.stats || {};
    statTotal.textContent = stats.totalAssignments || 0;
    statHours.textContent = `${stats.totalEstimatedHours || 0} hrs`;
    statOverdue.textContent = stats.overdueCount || 0;
    statBusiest.textContent = stats.busiestCourse || '—';

    // 4. Render Assignment Cards
    timelineList.innerHTML = '';
    timeline.assignments.forEach(assignment => {
      const card = document.createElement('div');
      card.className = `assignment-card ${assignment.priority}`;

      const formattedDeadline = assignment.deadlineText ||
        (assignment.deadline ? new Date(assignment.deadline).toLocaleDateString() : 'No explicit deadline');

      const reqsHTML = (assignment.requirements && assignment.requirements.length > 0)
        ? `
          <div class="requirements-box">
            <div class="requirements-title">Key Deliverables & Tasks</div>
            <ul class="requirements-list">
              ${assignment.requirements.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
            </ul>
          </div>
        ` : '';

      card.innerHTML = `
        <div class="card-top">
          <div>
            <div class="card-title">${escapeHtml(assignment.title)}</div>
            <div class="card-tags">
              <span class="badge badge-${assignment.priority}">${assignment.priority.toUpperCase()}</span>
              <span class="badge tag-course">${escapeHtml(assignment.course)}</span>
              <span class="badge tag-effort">⏳ ${assignment.estimatedHours} hrs effort</span>
              <span class="badge tag-effort">⚡ Score: ${assignment.urgencyScore}</span>
              ${assignment.difficulty ? `<span class="badge tag-effort">🎯 ${assignment.difficulty}</span>` : ''}
            </div>
          </div>
          <button class="btn btn-danger delete-btn" style="padding:0.35rem 0.65rem; font-size:0.8rem;" data-id="${assignment.id}">
            Delete
          </button>
        </div>
        
        <div class="card-details">
          <div>📅 <strong>Deadline:</strong> ${escapeHtml(formattedDeadline)}</div>
          ${assignment.notes ? `<div>📝 <strong>Notes:</strong> ${escapeHtml(assignment.notes)}</div>` : ''}
        </div>

        ${reqsHTML}
      `;

      timelineList.appendChild(card);
    });

    // Attach delete handlers
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        if (id) deleteAssignment(id);
      });
    });
  }

  // --- UI Helpers ---
  function showLoading(msg) {
    loadingMessage.textContent = msg;
    loadingBox.classList.remove('hidden');
  }

  function hideLoading() {
    loadingBox.classList.add('hidden');
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorBanner.classList.remove('hidden');
  }

  function hideError() {
    errorBanner.classList.add('hidden');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
