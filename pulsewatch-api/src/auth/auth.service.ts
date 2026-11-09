import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';

import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService,)
  {
    // 
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const passwordHash = await bcrypt.hash( dto.password, 12, );

    try {
      return await this.prisma.user.create({
        data: {
          email,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email is already registered',);
      }

      throw error;
    }
  }
  
  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
        throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
    });

    return { accessToken, tokenType: 'Bearer', expiresIn: '15m' };
    }
}