import { Module } from '@nestjs/common';

// ConfigModule: Environment configuration manage করে।
// ConfigService: .env ফাইল থেকে environment variable-এর value নিয়ে আসে।
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// @Module()-এর মধ্যে মূলত তিনটি গুরুত্বপূর্ণ property আছে। import / controllers / providers
// registerAsync() ব্যবহার করা হয়েছে কারণ JWT configuration সরাসরি hardcode না করে .env থেকে নিতে চাচ্ছো।
@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}