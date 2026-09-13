/**
 * Deterministic timeline calculation, priority scoring, conflict detection,
 * and recommendation engine for student assignments.
 */

/**
 * Process raw assignments and build complete timeline response.
 */
function buildTimeline(rawAssignments, referenceDate = new Date()) {
  const now = new Date(referenceDate);

  if (!Array.isArray(rawAssignments) || rawAssignments.length === 0) {
    return {
      assignments: [],
      recommendation: null,
      conflicts: [],
      stats: {
        totalAssignments: 0,
        totalEstimatedHours: 0,
        nearestDeadline: null,
        overdueCount: 0,
        criticalCount: 0,
        busiestCourse: null
      }
    };
  }

  // 1. Calculate urgency score and metadata for each assignment
  const processed = rawAssignments.map(assignment => {
    return enrichAssignment(assignment, now);
  });

  // Sort assignments: overdue first, then highest urgencyScore, then earliest deadline
  processed.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;

    if (b.urgencyScore !== a.urgencyScore) {
      return b.urgencyScore - a.urgencyScore;
    }

    if (a.deadline && b.deadline) {
      return new Date(a.deadline) - new Date(b.deadline);
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;

    return 0;
  });

  // 2. Detect deadline congestion / conflicts (48h window)
  const conflicts = detectConflicts(processed, now);

  // 3. Generate "YOUR NEXT MOVE" recommendation
  const recommendation = generateRecommendation(processed, conflicts, now);

  // 4. Calculate overall stats
  const stats = calculateStats(processed);

  return {
    assignments: processed,
    recommendation,
    conflicts,
    stats
  };
}

/**
 * Enriches assignment with deterministic urgencyScore, priority level, daysUntilDue, and isOverdue flag.
 */
function enrichAssignment(assignment, now) {
  const deadline = assignment.deadline ? new Date(assignment.deadline) : null;
  const hasDeadline = deadline && !isNaN(deadline.getTime());

  let hoursUntilDue = null;
  let daysUntilDue = null;
  let isOverdue = false;

  if (hasDeadline) {
    const diffMs = deadline.getTime() - now.getTime();
    hoursUntilDue = diffMs / (1000 * 60 * 60);
    daysUntilDue = Math.round((hoursUntilDue / 24) * 10) / 10;
    isOverdue = hoursUntilDue < 0;
  }

  // A. Proximity Score (0 - 100)
  let proximityScore = 15;
  if (hasDeadline) {
    if (isOverdue) {
      proximityScore = 100;
    } else if (hoursUntilDue <= 12) {
      proximityScore = 95;
    } else if (hoursUntilDue <= 24) {
      proximityScore = 85;
    } else if (hoursUntilDue <= 48) {
      proximityScore = 75;
    } else if (hoursUntilDue <= 72) {
      proximityScore = 65;
    } else if (hoursUntilDue <= 168) { // 7 days
      proximityScore = 45;
    } else if (hoursUntilDue <= 336) { // 14 days
      proximityScore = 25;
    } else {
      proximityScore = 10;
    }
  }

  // B. Effort / Workload Ratio Score (0 - 100)
  const hours = parseFloat(assignment.estimatedHours) || 3;
  let effortScore = 30;
  if (hasDeadline && !isOverdue && hoursUntilDue > 0) {
    const ratio = (hours / hoursUntilDue) * 100;
    effortScore = Math.min(100, Math.max(10, Math.round(ratio * 1.5)));
  } else {
    effortScore = Math.min(100, Math.round(hours * 12));
  }

  // C. Difficulty Score (0 - 100)
  const diffMap = { easy: 20, medium: 50, hard: 85 };
  const difficultyScore = diffMap[assignment.difficulty] || 50;

  // D. Weighted Urgency Score (0 - 100)
  const rawScore = 0.50 * proximityScore + 0.30 * effortScore + 0.20 * difficultyScore;
  const urgencyScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // E. Priority Label
  let priority = 'medium';
  if (urgencyScore >= 80 || isOverdue) {
    priority = 'critical';
  } else if (urgencyScore >= 60) {
    priority = 'high';
  } else if (urgencyScore >= 35) {
    priority = 'medium';
  } else {
    priority = 'low';
  }

  return {
    ...assignment,
    hoursUntilDue,
    daysUntilDue,
    isOverdue,
    urgencyScore,
    priority
  };
}

/**
 * Detects deadline conflicts (2 or more assignments due within 48 hours of each other).
 */
function detectConflicts(assignments) {
  const withDeadlines = assignments.filter(a => a.deadline && !a.isOverdue);
  if (withDeadlines.length < 2) return [];

  const conflicts = [];
  const processedPairs = new Set();

  for (let i = 0; i < withDeadlines.length; i++) {
    for (let j = i + 1; j < withDeadlines.length; j++) {
      const a1 = withDeadlines[i];
      const a2 = withDeadlines[j];
      const pairKey = [a1.id, a2.id].sort().join(':');

      if (processedPairs.has(pairKey)) continue;

      const time1 = new Date(a1.deadline).getTime();
      const time2 = new Date(a2.deadline).getTime();
      const diffHours = Math.abs(time1 - time2) / (1000 * 60 * 60);

      if (diffHours <= 48) {
        processedPairs.add(pairKey);

        // Find all assignments falling in this window
        const windowStart = Math.min(time1, time2);
        const windowEnd = Math.max(time1, time2);
        const cluster = withDeadlines.filter(a => {
          const t = new Date(a.deadline).getTime();
          return t >= windowStart - (12 * 3600 * 1000) && t <= windowEnd + (12 * 3600 * 1000);
        });

        const clusterIds = cluster.map(c => c.id);
        const totalHours = cluster.reduce((sum, c) => sum + (c.estimatedHours || 0), 0);
        const courseSet = [...new Set(cluster.map(c => c.course))];

        const alreadyAdded = conflicts.some(c => 
          c.assignmentIds.length === clusterIds.length &&
          clusterIds.every(id => c.assignmentIds.includes(id))
        );

        if (!alreadyAdded && cluster.length >= 2) {
          conflicts.push({
            id: `conflict-${conflicts.length + 1}`,
            assignmentIds: clusterIds,
            assignmentTitles: cluster.map(c => c.title),
            courses: courseSet,
            totalEstimatedHours: Math.round(totalHours * 10) / 10,
            count: cluster.length,
            message: `Deadline Congestion: ${cluster.length} assignments (${totalHours} hrs total effort) due within 48 hours across ${courseSet.join(', ')}.`
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Generates the "YOUR NEXT MOVE / WORK ON THIS NOW" recommendation.
 */
function generateRecommendation(assignments, conflicts) {
  if (assignments.length === 0) return null;

  // The top assignment is already sorted as #1
  const top = assignments[0];

  let reason = '';
  if (top.isOverdue) {
    reason = `OVERDUE TASK! ${top.title} was due ${Math.abs(top.daysUntilDue)} day(s) ago (${top.estimatedHours} hrs estimated effort). Tackle this first to minimize penalty.`;
  } else if (top.daysUntilDue !== null && top.daysUntilDue <= 2) {
    reason = `URGENT DEADLINE: Due in ${top.daysUntilDue === 0 ? 'less than 1 day' : top.daysUntilDue + ' days'}! Requires ~${top.estimatedHours} hrs of effort for ${top.course}.`;
  } else if (conflicts.some(c => c.assignmentIds.includes(top.id))) {
    const conflict = conflicts.find(c => c.assignmentIds.includes(top.id));
    reason = `HEAVY WORKLOAD CONGESTION: ${top.title} is part of a ${conflict.count}-assignment crunch period (${conflict.totalEstimatedHours} hrs total). Start early to avoid a last-minute bottleneck.`;
  } else if (top.difficulty === 'hard') {
    reason = `HIGH EFFORT TASK: ${top.title} has a difficulty rating of 'Hard' with ${top.estimatedHours} hrs estimated workload. Begin early for maximum efficiency.`;
  } else {
    reason = `TOP PRIORITY: Highest urgency score (${top.urgencyScore}/100) based on deadline proximity and estimated ${top.estimatedHours} hrs effort.`;
  }

  return {
    assignmentId: top.id,
    assignment: top,
    headline: "YOUR NEXT MOVE",
    reason
  };
}

/**
 * Calculates overall timeline statistics.
 */
function calculateStats(assignments) {
  const totalAssignments = assignments.length;
  const totalEstimatedHours = Math.round(
    assignments.reduce((sum, a) => sum + (parseFloat(a.estimatedHours) || 0), 0) * 10
  ) / 10;

  const validDeadlines = assignments
    .filter(a => a.deadline && !a.isOverdue)
    .map(a => new Date(a.deadline))
    .sort((d1, d2) => d1 - d2);

  const nearestDeadline = validDeadlines.length > 0 ? validDeadlines[0].toISOString() : null;
  const overdueCount = assignments.filter(a => a.isOverdue).length;
  const criticalCount = assignments.filter(a => a.priority === 'critical').length;

  // Find busiest course
  const courseMap = {};
  assignments.forEach(a => {
    courseMap[a.course] = (courseMap[a.course] || 0) + (a.estimatedHours || 1);
  });
  let busiestCourse = null;
  let maxHours = 0;
  for (const [course, hours] of Object.entries(courseMap)) {
    if (hours > maxHours) {
      maxHours = hours;
      busiestCourse = course;
    }
  }

  return {
    totalAssignments,
    totalEstimatedHours,
    nearestDeadline,
    overdueCount,
    criticalCount,
    busiestCourse
  };
}

module.exports = {
  buildTimeline,
  enrichAssignment,
  detectConflicts,
  generateRecommendation,
  calculateStats
};
