module.exports = {
  displayName: 'shared-dto',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  passWithNoTests: true,
  coverageDirectory: '../../../coverage/libs/shared-dto',
};
