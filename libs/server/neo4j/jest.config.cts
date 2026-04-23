module.exports = {
  displayName: 'server-neo4j',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  passWithNoTests: true,
  coverageDirectory: '../../../coverage/libs/server-neo4j',
};
