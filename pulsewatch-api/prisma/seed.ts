import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: {
      email: 'demo@pulsewatch.local',
    },
    update: {},
    create: {
      email: 'demo@pulsewatch.local',
      passwordHash: 'demo@pulsewatch.local',
    },
  });

  console.log('Seed completed:', {
    userId: user.id,
    email: user.email,
  });
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });