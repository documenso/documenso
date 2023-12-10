import fs from 'node:fs';
import path from 'node:path';

const seedDatabase = async () => {
  const files = fs.readdirSync(path.join(__dirname, './seed'));

  for (const file of files) {
    const stat = fs.statSync(path.join(__dirname, './seed', file));

    if (stat.isFile()) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(path.join(__dirname, './seed', file));

      if ('seedDatabase' in mod && typeof mod.seedDatabase === 'function') {
        console.log(`[SEEDING]: ${file}`);
        await mod.seedDatabase();
      }
    }
  }
};

seedDatabase()
  .then(() => {
    console.log('Database seeded');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
