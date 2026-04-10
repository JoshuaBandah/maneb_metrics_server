import { Exclude } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";

export class ReturnedUserDto {
    @IsString()
    @IsNotEmpty()
    @Exclude()
    userId!: string

    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @IsString()
    @IsNotEmpty()
    lastName!: string;


    @IsString()
    @IsNotEmpty()
    email!: string;

    @IsString()
    @IsNotEmpty()
    role!: string;


    @IsString()
    @IsNotEmpty()
    accessToken!: string;

    @IsString()
    @IsNotEmpty()
    refreshToken!: string;

}