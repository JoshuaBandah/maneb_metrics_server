// k6-fast-break.js
import http from 'k6/http';
import { sleep } from 'k6';

const BASE_URL = 'http://localhost:3000';
const TOTAL_RECORDS = 4000;

function generateStudentData(studentNumber) {
  const startDate = new Date(2004, 0, 1);
  const targetDate = new Date(startDate);
  targetDate.setDate(startDate.getDate() + (studentNumber - 1));
  return {
    student_number: studentNumber.toString(),
    date_of_birth: targetDate.toISOString().split('T')[0]
  };
}

export const options = {
  scenarios: {
    fast_breaking: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2s', target: 50 },     // 2 seconds to 50 users
        { duration: '30s', target: 1500 },  // 30 seconds to 1500 users
        { duration: '30s', target: 3000 },  // 30 seconds to 3000 users
        { duration: '30s', target: 5000 },  // 30 seconds to 5000 users
        { duration: '1m', target: 1000 },   // 1 minute to 1000 users (ramp down)
        { duration: '30s', target: 0 },     // 30 seconds cooldown
        { duration: '1m', target: 3000 },   // 1 minute to 3000 users
        { duration: '30s', target: 0 },     // 30 seconds cooldown
        { duration: '1m', target: 5000 },   // 1 minute to 5000 users
        { duration: '30s', target: 0 },     // 30 seconds cooldown
      ],
      gracefulRampDown: '0s',
    },
  },
};

export default function() {
  const studentNumber = Math.floor(Math.random() * TOTAL_RECORDS) + 1;
  const student = generateStudentData(studentNumber);
  const url = `${BASE_URL}/grades/view-uncached-results?date_of_birth=${student.date_of_birth}&student_number=${student.student_number}`;
  
  // No timeout, no error handling - just raw speed
  http.get(url, { timeout: '30s' });
  
  // No sleep for maximum throughput
}