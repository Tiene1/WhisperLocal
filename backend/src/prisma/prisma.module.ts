import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Module global exposant PrismaService à toute l'application.
 * Global pour éviter de le réimporter dans chaque module métier —
 * seuls les repositories l'injectent réellement (cf. règles CLAUDE.md).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
