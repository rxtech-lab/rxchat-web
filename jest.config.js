const { createDefaultPreset } = require('ts-jest');

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transformIgnorePatterns: [
    '<rootDir>/node_modules/(?!(bcrypt-ts|react-markdown|remark-gfm|vfile|unist-util-.*|micromark.*|decode-named-character-reference|character-entities|property-information|hast-util-.*|mdast-util-.*|remark-.*)/)',
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
