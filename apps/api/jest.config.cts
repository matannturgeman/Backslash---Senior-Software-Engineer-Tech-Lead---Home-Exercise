module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  moduleNameMapper: {
    '^@libs/server-cache$': '<rootDir>/../../libs/server/cache/src/index.ts',
    '^@libs/server-neo4j$': '<rootDir>/src/app/neo4j/index.ts',
    '^@libs/shared-types$': '<rootDir>/../../libs/shared/types/src/index.ts',
  },
  coverageDirectory: '../../coverage/apps/api',
};
