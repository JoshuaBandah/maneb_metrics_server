import http from 'k6/http';
import { sleep } from 'k6';

const BASE_URL = 'http://localhost:3000';
const METRIC_URL = 'http://localhost:3001';

const TOTAL_RECORDS = 4000;

const MAX_POLL_ATTEMPTS = 150;
const POLL_INTERVAL = 1;

const SUBMIT_MAX_RETRIES = 50;


// GENERATE STUDENT

function generateStudentData(studentNumber) {
  const startDate = new Date(2004, 0, 1);
  const targetDate = new Date(startDate);

  targetDate.setDate(startDate.getDate() + (studentNumber - 1));

  return {
    student_number: studentNumber.toString(),
    date_of_birth: targetDate.toISOString().split('T')[0],
  };
}


// SUBMIT (WITH RETRIES)

function submitToQueue(studentNumber, dateOfBirth) {
  const url =
    `${BASE_URL}/grades/view-cached-results-que` +
    `?date_of_birth=${encodeURIComponent(dateOfBirth)}` +
    `&student_number=${encodeURIComponent(studentNumber)}`;

  let attempts = 0;

  while (attempts < SUBMIT_MAX_RETRIES) {
    attempts++;

    const res = http.get(url, {
      timeout: '60s',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 202) {
      try {
        const body = JSON.parse(res.body);

        if (body.success && body.data?.jobId) {
          return {
            success: true,
            jobId: body.data.jobId,
            retries: attempts - 1,
          };
        }
      } catch (e) {}
    }

    // backoff before retry
    sleep(0.2 * attempts);
  }

  // ONLY FAIL AFTER ALL RETRIES
  return {
    success: false,
    jobId: null,
    reason: 'submit_failed_after_retries',
    retries: attempts,
  };
}


// POLL RESULT

function pollForResult(jobId) {
  const start = Date.now();
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const res = http.get(
      `${BASE_URL}/grades/queue/status/${jobId}`,
      {
        timeout: '60s',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    attempts++;

    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);

        if (body.status === 'completed') {
          return {
            success: true,
            waitTime: Date.now() - start,
            attempts,
          };
        }

        if (body.status === 'failed') {
          return {
            success: false,
            reason: 'backend_failed',
            attempts,
          };
        }
      } catch (e) {}
    }

    sleep(POLL_INTERVAL);
  }

  return {
    success: false,
    reason: 'timeout',
    attempts,
  };
}


// METRICS (ONLY FINAL RESULT)

function pushVUResult(result) {
  http.post(
    `${METRIC_URL}/k6/vu-result`,
    JSON.stringify(result),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: '30s',
    }
  );
}


// FLOW

function runFlow() {
  const studentNumber =
    Math.floor(Math.random() * TOTAL_RECORDS) + 1;

  const student = generateStudentData(studentNumber);

  // SUBMIT (WITH RETRIES)
  const submission = submitToQueue(
    student.student_number,
    student.date_of_birth
  );

  if (!submission.success) {
    return;
  }

  // POLL
  const result = pollForResult(submission.jobId);

  pushVUResult({
    vu: __VU,
    success: result.success,
    waitTime: result.waitTime || 0,
    retries: submission.retries || 0,
    pollAttempts: result.attempts || 0,
    stage: result.success ? 'completed' : 'failed_or_timeout',
    reason: result.reason || null,
  });
}


// LOAD TEST

export const options = {
  scenarios: {
    queue_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 10000 },
        { duration: '1m', target: 10000 },
        { duration: '30s', target: 0 },
      ],
    },
  },
};


// EXECUTION

export default function () {
  runFlow();
  sleep(Math.random() * 0.2);
}


// TEARDOWN

export function teardown() {
  console.log('Clearing metrics...');

  http.post(`${METRIC_URL}/k6/clear`, null, {
    timeout: '30s',
  });
}