import { IsString, IsNotEmpty } from "class-validator";

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  role!:string
  
  @IsString()
  @IsNotEmpty()
  email!:string
}
