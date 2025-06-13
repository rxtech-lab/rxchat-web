const { createDefaultPreset } = require('ts-jest');

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transformIgnorePatterns: [
    '<rootDir>/node_modules/(?!bcrypt-ts/)',
    '<rootDir>/tests/*.spec.ts',
  ],
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      {
        configFile: './babel.config.test.js',
      },
    ],
  },
  // Skip collecting coverage from the tests folder
  coveragePathIgnorePatterns: ['<rootDir>/tests/'],
};
