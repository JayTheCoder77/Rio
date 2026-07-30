import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from 'drizzle-kit';

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in the .env file');
}

export default defineConfig({
    schema: './src/schema.ts', // Your schema file path
    out: './drizzle', // Your migrations folder
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL,
    },
});


// local
// import { config } from 'dotenv';
// config({ path: '.env.local' });

// import { defineConfig } from 'drizzle-kit';

// if (!process.env.DATABASE_URL) {
//   throw new Error('DATABASE_URL is not set in .env.local');
// }

// // ...rest of config unchanged
// export default defineConfig({
//     schema: './src/schema.ts', // Your schema file path
//     out: './drizzle', // Your migrations folder
//     dialect: 'postgresql',
//     dbCredentials: {
//         url: process.env.DATABASE_URL,
//     },
// });