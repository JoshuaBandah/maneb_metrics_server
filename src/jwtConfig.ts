// // jwt-config.module.ts
// import { Module } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
// import { ConfigModule, ConfigService } from '@nestjs/config';

// @Module({
//   imports: [ConfigModule],
//   providers: [
//     {
//       provide: 'JWT_ACCESS_TOKEN',
//       useFactory: (configService: ConfigService) => {
//                 const secret = process.env.REFRESH_JWT_SECRET; // Changed from JWT_REFRESH_TOKEN_SECRET
//         if (!secret) {
//           throw new Error('REFRESH_JWT_SECRET is missing in .env file');
//         }
//         return new JwtService({
//           secret: secret,
//           signOptions: { expiresIn: process.env.JWT_EXPIRE_IN || '5h' },
//         });
//       },
//       inject: [ConfigService],
//     },
//     // Refresh Token Provider
//     {
//       provide: 'JWT_REFRESH_TOKEN',
//       useFactory: (configService: ConfigService) => {
//         return new JwtService({
//           secret: configService.get<string>('jwtRefresh.secret'),
//           signOptions: { expiresIn: configService.get<number>('jwtRefresh.expiresIn') },
//         });
//       },
//       inject: [ConfigService],
//     },
//   ],
//   exports: ['JWT_ACCESS_TOKEN', 'JWT_REFRESH_TOKEN'],
// })
// export class JwtConfigModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import refreshJwtConfig from './authentication/config/refresh-jwt.config';
import jwtConfig from './authentication/config/jwt.config';

@Module({
  imports: [
    ConfigModule.forFeature(jwtConfig),
    ConfigModule.forFeature(refreshJwtConfig),
  ],
  providers: [
    {
      provide: 'JWT_ACCESS_TOKEN',
      useFactory: (configService: ConfigService) => {
        return new JwtService({
          secret: configService.get<string>('jwt.secret'),
          signOptions: { expiresIn: configService.get<number>('jwt.expiresIn') },
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'JWT_REFRESH_TOKEN',
      useFactory: (configService: ConfigService) => {
        return new JwtService({
          secret: configService.get<string>('jwtRefresh.secret'),
          signOptions: { expiresIn: configService.get<number>('jwtRefresh.expiresIn') },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['JWT_ACCESS_TOKEN', 'JWT_REFRESH_TOKEN'],
})
export class JwtCustomModule {}