import 'dotenv/config';
import { clientDb as prisma } from '../../utils/db';
import { seedOrgUnits } from './org-unit';
import { seedUsers } from './user';

async function main() {
  console.log('--- Starting Database Seeding ---');
  
  try {
    console.log('\n[1/2] Seeding Organization Units...');
    await seedOrgUnits();
    
    console.log('\n[2/2] Seeding Users...');
    await seedUsers();
    
    console.log('\n--- Database Seeding Completed Successfully ---');
  } catch (error) {
    console.error('\n--- Database Seeding Failed ---');
    console.error(error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
