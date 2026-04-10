import { BadRequestException, ConflictException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { RegisterUserDto } from './dto/registerUserDto.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ReturnedUserDto } from './dto/returnedUser.dto';
import { sql } from '../db/db';

export interface User {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: string;
}

export interface tokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class UserService {
  constructor(
    @Inject('JWT_ACCESS_TOKEN') private readonly jwtAccessService: JwtService,
    @Inject('JWT_REFRESH_TOKEN') private readonly jwtRefreshService: JwtService,
  ) { }

  async registerUser(
    registerUserDto: RegisterUserDto,
    transactionSql?: any
  ): Promise<ReturnedUserDto> {
    const db = transactionSql || sql;


    try {
      const { firstName, lastName, email, password, role } = registerUserDto;
 
      if (role !== "admin") {
        throw new BadRequestException('this user cannot register through this endpoint');
      }
      // Check if user exists
      const existingUser = await db`
        SELECT user_id FROM users WHERE email = ${email}
      `;

      if (existingUser.length > 0) {
        throw new ConflictException('User with this phone number already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user
      const [newUser] = await db`
        INSERT INTO users (first_name, last_name, email, password, role)
        VALUES (${firstName}, ${lastName}, ${email}, ${hashedPassword}, ${role})
        RETURNING 
          user_id,
          first_name,
          last_name,
          email,
          role
      `;

      const payload = {
        userId: newUser.user_id,
        email: newUser.email
      };
      // Generate tokens
      const accessToken = await this.jwtAccessService.signAsync(payload);
      const refreshToken = await this.jwtRefreshService.signAsync(payload);

      // Return formatted result
      return {
        userId: newUser.user_id,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        email: newUser.email,
        role: newUser.role,
        accessToken,
        refreshToken,
      };
    }
    catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException("error creating user");
    }
  }

  async getUser(email: string): Promise<any | null> {
    try {
      const users = await sql<User[]>`
        SELECT * FROM users WHERE email = ${email}
      `;
      return users.length ? users : null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}