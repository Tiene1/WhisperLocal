import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Wrapper NestJS autour du PrismaClient.
 *
 * Ce service est le SEUL point d'accès à Prisma dans toute l'application.
 * Il est injecté exclusivement dans les repositories de la couche
 * infrastructure (cf. CLAUDE.md — jamais d'accès Prisma direct ailleurs).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connexion à la base de données établie');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
