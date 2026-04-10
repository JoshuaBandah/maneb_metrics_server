import { forwardRef, Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthenticationModule } from '../authentication/authentication.module';
import { JwtCustomModule } from '../jwtConfig';

@Module({
  controllers: [UserController],
  imports: [
    JwtCustomModule,
    forwardRef(() => AuthenticationModule)
  ],
  providers: [UserService],
  exports: [UserService]
})
export class UserModule {}