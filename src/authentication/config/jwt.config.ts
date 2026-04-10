import { registerAs } from '@nestjs/config';
import ms from 'ms';

// this is for access token
export default registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) { 
  }
  const expiresInEnv = process.env.JWT_EXPIRE_IN;
  return {
    secret,
    expiresIn: expiresInEnv,
  };
});
