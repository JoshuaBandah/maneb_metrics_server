// k6-queue-test.js

import http from 'k6/http';
import { sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// =====================================
// Metrics
// =====================================

const errorRate = new Rate('error_rate');

const searchDuration = new Trend(
  'search_duration',
);

const queueWaitTime = new Trend(
  'queue_wait_time',
);

const failedRequests = new Counter(
  'failed_requests',
);

const queuedRequests = new Counter(
  'queued_requests',
);

const completedRequests = new Counter(
  'completed_requests',
);

// =====================================
// Config
// =====================================

const BASE_URL = 'http://localhost:3000';

const METRIC_URL = 'http://localhost:3001';

const TOTAL_RECORDS = 4000;

const POLL_INTERVAL = 5;

const MAX_POLL_ATTEMPTS = 10;

// =====================================
// Local VU Metrics
// NOTE:
// Every VU has its own copy.
// NestJS aggregates globally.
// =====================================

let localMetrics = {
  add_total_requests: 0,
  add_failed_requests: 0,
  add_completed_requests: 0,
  add_queued_requests: 0,
};

// =====================================
// Metric Push Timing
// =====================================

let lastMetricPush = Date.now();

const METRIC_PUSH_INTERVAL = 5000;

// =====================================
// Generate Student Data
// =====================================

function generateStudentData(studentNumber) {
  const startDate = new Date(2004, 0, 1);

  const targetDate = new Date(startDate);

  targetDate.setDate(
    startDate.getDate() +
      (studentNumber - 1),
  );

  return {
    student_number:
      studentNumber.toString(),

    date_of_birth:
      targetDate
        .toISOString()
        .split('T')[0],
  };
}

// =====================================
// Push Increment Metrics
// =====================================

function pushMetrics() {
  const hasMetrics =
    localMetrics.add_total_requests > 0 ||
    localMetrics.add_failed_requests > 0 ||
    localMetrics.add_completed_requests >
      0 ||
    localMetrics.add_queued_requests > 0;

  if (!hasMetrics) {
    return;
  }

  try {
    http.post(
      `${METRIC_URL}/k6/live`,
      JSON.stringify(localMetrics),
      {
        headers: {
          'Content-Type':
            'application/json',
        },

        timeout: '3s',
      },
    );

    // Reset after successful push
    localMetrics = {
      add_total_requests: 0,
      add_failed_requests: 0,
      add_completed_requests: 0,
      add_queued_requests: 0,
    };
  } catch (e) {
    console.error(
      'Failed to push metrics:',
      e,
    );
  }
}

// =====================================
// Submit Queue Request
// =====================================

function submitToQueue(
  studentNumber,
  dateOfBirth,
) {
  localMetrics.add_total_requests++;

  const url =
    `${BASE_URL}/grades/view-uncached-results` +
    `?date_of_birth=${encodeURIComponent(
      dateOfBirth,
    )}` +
    `&student_number=${encodeURIComponent(
      studentNumber,
    )}`;

  const startTime = Date.now();

  const response = http.get(url, {
    timeout: '5s',

    headers: {
      'Content-Type':
        'application/json',
    },
  });

  const duration =
    Date.now() - startTime;

  searchDuration.add(duration);

  let success = false;

  let jobId = null;

  if (response.status === 202) {
    try {
      const body = JSON.parse(
        response.body,
      );

      if (
        body.success &&
        body.data
      ) {
        success = true;

        jobId = body.data.jobId;

        queuedRequests.add(1);

        localMetrics.add_queued_requests++;
      }
    } catch (e) {
      success = false;
    }
  } else {
    failedRequests.add(1);

    localMetrics.add_failed_requests++;
  }

  errorRate.add(!success);

  return {
    success,
    jobId,
  };
}

// =====================================
// Poll Queue Status
// =====================================

function pollForResult(
  jobId,
  studentNumber,
) {
  const start = Date.now();

  let attempts = 0;

  while (
    attempts < MAX_POLL_ATTEMPTS
  ) {
    const url =
      `${BASE_URL}/grades/queue/status/${jobId}`;

    const response = http.get(url, {
      timeout: '5s',

      headers: {
        'Content-Type':
          'application/json',
      },
    });

    attempts++;

    if (response.status === 200) {
      try {
        const body = JSON.parse(
          response.body,
        );

        if (
          body.status ===
          'completed'
        ) {
          const waitTime =
            Date.now() - start;

          queueWaitTime.add(
            waitTime,
          );

          completedRequests.add(1);

          localMetrics.add_completed_requests++;

          return {
            success: true,
            waitTime,
          };
        }

        if (
          body.status === 'failed'
        ) {
          localMetrics.add_failed_requests++;

          return {
            success: false,
          };
        }
      } catch (e) {}
    }

    sleep(POLL_INTERVAL);
  }

  localMetrics.add_failed_requests++;

  return {
    success: false,
  };
}

// =====================================
// Full Workflow
// =====================================

function runQueueFlow() {
  const studentNumber =
    Math.floor(
      Math.random() *
        TOTAL_RECORDS,
    ) + 1;

  const student =
    generateStudentData(
      studentNumber,
    );

  const submission =
    submitToQueue(
      student.student_number,
      student.date_of_birth,
    );

  if (!submission.success) {
    return;
  }

  pollForResult(
    submission.jobId,
    studentNumber,
  );
}

// =====================================
// k6 Load Configuration
// =====================================

export let options = {
  scenarios: {
    queue_test: {
      executor: 'ramping-vus',

      stages: [
        {
          duration: '3m',
          target: 500,
        },

        {
          duration: '3m',
          target: 100,
        },

        {
          duration: '3m',
          target: 400,
        },
      ],
    },
  },
};

// =====================================
// Default Execution
// =====================================

export default function () {
  runQueueFlow();

  const now = Date.now();

  // Push every 5 seconds
  if (
    now - lastMetricPush >
    METRIC_PUSH_INTERVAL
  ) {
    pushMetrics();

    lastMetricPush = now;
  }

  sleep(Math.random() * 0.5);
}

// =====================================
// Final Summary
// =====================================

export function handleSummary(
  data,
) {
  const summary = {
    total_requests:
      data.metrics.http_reqs
        ?.count || 0,

    failed_requests:
      data.metrics
        .failed_requests?.count ||
      0,

    completed_requests:
      data.metrics
        .completed_requests
        ?.count || 0,

    queued_requests:
      data.metrics
        .queued_requests?.count ||
      0,

    error_rate:
      data.metrics.error_rate
        ?.rate || 0,

    avg_search_duration:
      data.metrics
        .search_duration?.avg ||
      0,

    avg_queue_wait:
      data.metrics
        .queue_wait_time?.avg ||
      0,
  };

  try {
    http.post(
      `${METRIC_URL}/k6/summary`,
      JSON.stringify(summary),
      {
        headers: {
          'Content-Type':
            'application/json',
        },
      },
    );
  } catch (e) {
    console.error(
      'Failed to send summary:',
      e,
    );
  }

  return {
    'summary.json':
      JSON.stringify(
        summary,
        null,
        2,
      ),
  };
}