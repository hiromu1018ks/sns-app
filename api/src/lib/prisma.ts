// Prisma クライアントのインスタンスをグローバルに管理し、開発時のホットリロードでも使い回す実装
import { PrismaClient } from '@prisma/client';

// グローバルオブジェクトに prisma インスタンスを保持するための型付け
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma クライアントの生成（開発時は詳細ログ、本番はエラーログのみ）
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

// 本番環境以外ではグローバルにインスタンスを保存し、再生成を防ぐ
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
