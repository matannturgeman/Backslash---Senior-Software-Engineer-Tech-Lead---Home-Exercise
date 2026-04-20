module.exports = {
  displayName: 'client-server-communication',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/client-server-communication',
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 100,
      functions: 90,
      lines: 95,
    },
  },
};
