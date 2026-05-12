// k6-populate-results.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const searchDuration = new Trend('search_duration');

const BASE_URL = 'http://localhost:3000';
const TOTAL_RECORDS = 4000;

// Generate student data based on your pattern
function generateStudentData(studentNumber) {
  const startDate = new Date(2004, 0, 1); // Jan 1, 2004
  const targetDate = new Date(startDate);
  targetDate.setDate(startDate.getDate() + (studentNumber - 1));
  
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  
  return {
    student_number: studentNumber.toString(),
    date_of_birth: `${year}-${month}-${day}`
  };
}

// Search results function
function searchResults(studentNumber, dateOfBirth) {
  const url = `${BASE_URL}/grades/view-uncached-results?date_of_birth=${encodeURIComponent(dateOfBirth)}&student_number=${encodeURIComponent(studentNumber)}`;
  
  const startTime = new Date();
  const response = http.get(url, {
    headers: { 'Content-Type': 'application/json' }
  });
  const duration = new Date() - startTime;
  
  searchDuration.add(duration);
  
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'success is true': (r) => JSON.parse(r.body).success === true,
  });
  
  errorRate.add(!success);
  
  return { success, duration };
}

// Sequential population (1 by 1)
export const sequentialPopulation = () => {
  const options = {
    scenarios: {
      sequential: {
        executor: 'shared-iterations',
        vus: 1,
        iterations: TOTAL_RECORDS,
      },
    },
    thresholds: {
      http_req_failed: ['rate<0.05'],
      http_req_duration: ['p(95)<2000'],
    },
  };
  return options;
};

// Rapid population with multiple VUs
export const rapidPopulation = () => {
  const options = {
    scenarios: {
      rapid: {
        executor: 'constant-vus',
        vus: 50,
        duration: '10m',
      },
    },
    thresholds: {
      http_req_failed: ['rate<0.10'],
      http_req_duration: ['p(95)<3000'],
    },
  };
  return options;
};

// Default: Sequential population
export let options = sequentialPopulation();

export default function() {
  const vuId = __VU;
  const iteration = __ITER;
  const studentNumber = iteration + 1;
  
  if (studentNumber > TOTAL_RECORDS) return;
  
  const student = generateStudentData(studentNumber);
  const result = searchResults(student.student_number, student.date_of_birth);
  
  if (result.success) {
    console.log(`✓ [${studentNumber}/${TOTAL_RECORDS}] Student ${studentNumber} - DOB: ${student.date_of_birth}`);
  } else {
    console.error(`✗ Failed: Student ${studentNumber} - DOB: ${student.date_of_birth}`);
  }
  
  sleep(0.1);
}