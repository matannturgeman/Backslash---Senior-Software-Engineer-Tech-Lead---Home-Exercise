module.exports = {
  displayName: 'server-graph',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  moduleNameMapper: {
    '^@libs/server-cache$': '<rootDir>/../cache/src/index.ts',
    '^@libs/server-neo4j$': '<rootDir>/../../../apps/api/src/app/neo4j/index.ts',
    '^@libs/shared-types$': '<rootDir>/../../../libs/shared/types/src/index.ts',
  },
  passWithNoTests: true,
  coverageDirectory: '../../../coverage/libs/server-graph',
};
