import http from 'k6/http';
import { sleep } from 'k6';

const BASE_URL = 'http://localhost:3000';
const METRIC_URL = 'http://localhost:3001';

const TOTAL_RECORDS = 4000;
const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL = 5;

// GENERATE STUDENT

function generateStudentData(studentNumber) {
  const startDate = new Date(2004, 0, 1);

  const targetDate = new Date(startDate);

  targetDate.setDate(
    startDate.getDate() +
      (studentNumber - 1)
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

// SUBMIT JOB

function submitToQueue(
  studentNumber,
  dateOfBirth
) {
  const url =
    `${BASE_URL}/grades/view-uncached-results` +
    `?date_of_birth=${encodeURIComponent(
      dateOfBirth
    )}` +
    `&student_number=${encodeURIComponent(
      studentNumber
    )}`;

  const res = http.get(url, {
    timeout: '5s',

    headers: {
      'Content-Type':
        'application/json',
    },
  });

  if (res.status !== 202) {
    return {
      success: false,
      jobId: null,
      reason: 'submit_failed',
    };
  }

  try {
    const body = JSON.parse(
      res.body
    );

    if (
      body.success &&
      body.data?.jobId
    ) {
      return {
        success: true,

        jobId:
          body.data.jobId,
      };
    }
  } catch (e) {}

  return {
    success: false,
    jobId: null,
    reason: 'invalid_response',
  };
}

// POLL RESULT

function pollForResult(jobId) {
  const start = Date.now();

  let attempts = 0;

  while (
    attempts <
    MAX_POLL_ATTEMPTS
  ) {
    const res = http.get(
      `${BASE_URL}/grades/queue/status/${jobId}`,
      {
        timeout: '5s',

        headers: {
          'Content-Type':
            'application/json',
        },
      }
    );

    attempts++;

    if (res.status === 200) {
      try {
        const body = JSON.parse(
          res.body
        );

        if (
          body.status ===
          'completed'
        ) {
          return {
            success: true,

            waitTime:
              Date.now() -
              start,
          };
        }

        if (
          body.status ===
          'failed'
        ) {
          return {
            success: false,

            reason:
              'backend_failed',
          };
        }
      } catch (e) {}
    }

    sleep(POLL_INTERVAL);
  }

  return {
    success: false,
    reason: 'timeout',
  };
}

// PUSH REALTIME RESULT

function pushVUResult(result) {
  http.post(
    `${METRIC_URL}/k6/vu-result`,
    JSON.stringify(result),
    {
      headers: {
        'Content-Type':
          'application/json',
      },

      timeout: '3s',
    }
  );
}

// MAIN FLOW

function runFlow() {
  const studentNumber =
    Math.floor(
      Math.random() *
        TOTAL_RECORDS
    ) + 1;

  const student =
    generateStudentData(
      studentNumber
    );

  const submission =
    submitToQueue(
      student.student_number,
      student.date_of_birth
    );

  // SUBMIT FAILED
  if (!submission.success) {
    pushVUResult({
      vu: __VU,

      success: false,

      stage: 'submit',

      reason:
        submission.reason,
    });

    return;
  }

  // POLL RESULT
  const result =
    pollForResult(
      submission.jobId
    );

  // FINAL RESULT
  pushVUResult({
    vu: __VU,

    success:
      result.success,

    waitTime:
      result.waitTime || 0,

    stage: result.success
      ? 'completed'
      : 'failed_or_timeout',

    reason:
      result.reason || null,
  });
}

// LOAD PROFILE

export const options = {
  scenarios: {
    queue_test: {
      executor: 'ramping-vus',

      stages: [
        {
          duration: '1m',
          target: 4000,
        },

        // optional ramp down
        {
          duration: '30s',
          target: 0,
        },
      ],
    },
  },
};


export default function () {
  runFlow();

  sleep(
    Math.random() * 0.5
  );
}


export function teardown() {
  console.log(
    'Waiting 1 minute before clearing metrics...'
  );

  sleep(30);

  console.log(
    'Sending clear request to metrics server...'
  );

  const res = http.post(
    `${METRIC_URL}/k6/clear`,
    null,
    {
      timeout: '15s',
    }
  );

  console.log(
    `Clear response status: ${res.status}`
  );
}