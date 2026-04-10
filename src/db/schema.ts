import { sql } from './db';

export async function createTables() {

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      user_id SERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    );
  `;
  await sql`
  CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    middle_name  VARCHAR(50),
    last_name  VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    student_number VARCHAR(50) UNIQUE NOT NULL,
    english VARCHAR(3),
    chichewa VARCHAR(3),
    mathematics VARCHAR(3),
    biology VARCHAR(3),
    physics VARCHAR(3),
    chemistry VARCHAR(3),
    agriculture VARCHAR(3),
    history VARCHAR(3),
    geography VARCHAR(3),
    social_studies VARCHAR(3),
    bible_knowledge VARCHAR(3),
    business_studies VARCHAR(3),
    accounting VARCHAR(3),
    computer_studies VARCHAR(3),
    home_economics VARCHAR(3),
    technical_drawing VARCHAR(3),
    exam_center VARCHAR(100)
  );
  `;
}


  // await sql`
  // CREATE TABLE IF NOT EXISTS results (
  //   id SERIAL PRIMARY KEY,
  //   first_name VARCHAR(50) NOT NULL,
  //   middle_name  VARCHAR(50),
  //   last_name  VARCHAR(100) NOT NULL,
  //   date_of_birth DATE NOT NULL,
  //   student_number VARCHAR(50) UNIQUE NOT NULL,
  //   exam_center VARCHAR(100),
  //   subject VARCHAR(50) NOT NULL,
  //   marks VARCHAR(3)
  //   UNIQUE (subject,student_number);
  // );
  // `;