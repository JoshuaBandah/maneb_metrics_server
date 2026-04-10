import { registerAs } from '@nestjs/config';
import ms from 'ms';

//this is for refresh token
export default registerAs('jwtRefresh', () => {
  const secret = process.env.REFRESH_JWT_SECRET;
  if (!secret) {
   
  }

  const expiresInEnv = process.env.REFRESH_JWT_EXPIRE_IN;

  return {
    secret,
    expiresIn: expiresInEnv,
  };
});
