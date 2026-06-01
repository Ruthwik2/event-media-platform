const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('Password123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@eventmedia.com' },
    update: {},
    create: {
      email: 'admin@eventmedia.com',
      username: 'admin',
      password: hashedPassword,
      fullName: 'System Admin',
      role: 'ADMIN',
      isEmailVerified: true,
    },
  });

  const photographer = await prisma.user.upsert({
    where: { email: 'photographer@eventmedia.com' },
    update: {},
    create: {
      email: 'photographer@eventmedia.com',
      username: 'photographer1',
      password: hashedPassword,
      fullName: 'John Photographer',
      role: 'PHOTOGRAPHER',
      isEmailVerified: true,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@eventmedia.com' },
    update: {},
    create: {
      email: 'member@eventmedia.com',
      username: 'clubmember1',
      password: hashedPassword,
      fullName: 'Jane Member',
      role: 'CLUB_MEMBER',
      isEmailVerified: true,
    },
  });

  // Use upsert to avoid creating duplicate events on every restart.
  // Requires a unique field — here we use `name` as the stable identifier.
  // Make sure your Prisma schema has @@unique([name]) or a similar constraint,
  // or replace `name` below with whichever unique field you prefer (e.g. a slug).
  const event = await prisma.event.upsert({
    where: { name: 'Annual Cultural Fest 2024' },
    update: {},
    create: {
      name: 'Annual Cultural Fest 2024',
      description: 'The biggest cultural festival of the year',
      category: 'Cultural',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-12-03'),
      location: 'Main Campus Auditorium',
      visibility: 'PUBLIC',
      creatorId: admin.id,
    },
  });

  // Same pattern for album — upsert keyed on name + eventId.
  // If your schema doesn't have @@unique([name, eventId]) yet, see the note below.
  const album = await prisma.album.upsert({
    where: {
      // This requires a @@unique([name, eventId]) constraint in schema.prisma.
      // See comment at the bottom of this file if you need to add it.
      name_eventId: {
        name: 'Opening Ceremony',
        eventId: event.id,
      },
    },
    update: {},
    create: {
      name: 'Opening Ceremony',
      description: 'Photos from the opening ceremony',
      visibility: 'PUBLIC',
      eventId: event.id,
    },
  });

  console.log('✅ Seed completed!');
  console.log('📧 Admin: admin@eventmedia.com / Password123!');
  console.log('📧 Photographer: photographer@eventmedia.com / Password123!');
  console.log('📧 Member: member@eventmedia.com / Password123!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());