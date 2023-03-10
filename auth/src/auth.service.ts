import { ForbiddenException, Injectable } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { PrismaService } from './prisma/prisma.service';
import * as argon from 'argon2';
import { RpcException } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    try {
      const hash = await argon.hash(dto.password);
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          hash,
        },
      });
      const token = await this.createToken(user.id);
      return {
        access_token: token,
      };
    } catch (error) {
      if (error.code === 'P2002') {
        throw new RpcException('Credentials is taken');
      }
    }
  }

  async login(dto: LoginDto) {
    //find the user in db
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
      },
    });
    //validate the password
    const validatePw: boolean = await argon.verify(user.hash, dto.password);
    if (!user || !validatePw) throw new RpcException('Incorrect credentials');

    const token = await this.createToken(user.id);
    return {
      access_token: token,
    };
  }

  async getUserById(userId: number) {
    try {
      return await this.prisma.user.findUnique({
        where: {
          id: userId
        },
        select: {
          email: true,
          hash: false,
          createdAt: true,
          updatedAt: true,
          id: true,
        },
      })
    } catch (error) {
      throw new RpcException('Incorrect userId')
    }
  }

  async createToken(userId: number) {
    return this.jwtService.sign({ userId });
  }
  async decodeToken(token: string) {
    const user = this.jwtService.decode(token);
    return user;
  }
}
