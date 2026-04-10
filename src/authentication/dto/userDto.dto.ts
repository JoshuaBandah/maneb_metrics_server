import { IsString, IsNotEmpty } from "class-validator";

export class UserDto {
    
  @IsString()
  @IsNotEmpty()
  firstname!: string;

  
  @IsString()
  @IsNotEmpty()
  lastname!: string;

  
  @IsString()
  @IsNotEmpty()
  role!: string;
  
    @IsString()
  @IsNotEmpty()
  email!: string;
}
