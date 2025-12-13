import '@testing-library/jest-dom';

// Set up test environment variables
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file::memory:?cache=shared';
process.env.PRISMA_ENGINE_TYPE = 'library';
