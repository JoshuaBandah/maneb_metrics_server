import { forwardRef, Module } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';

import { UserModule } from '../user/user.module';
import { JwtCustomModule } from '../jwtConfig';

@Module({
  controllers: [AuthenticationController],
  providers: [AuthenticationService],
  imports: [
    JwtCustomModule,
    forwardRef(() => UserModule)
  ],
})
export class AuthenticationModule {}