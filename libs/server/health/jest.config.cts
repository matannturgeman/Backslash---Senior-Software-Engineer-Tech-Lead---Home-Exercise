module.exports = {
  displayName: 'server-health',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  moduleNameMapper: {
    '^@libs/server-cache$': '<rootDir>/../cache/src/index.ts',
    '^@libs/server-graph$': '<rootDir>/../graph/src/index.ts',
  },
  passWithNoTests: true,
  coverageDirectory: '../../../coverage/libs/server-health',
};
