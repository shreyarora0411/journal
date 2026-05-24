/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@journal/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@journal/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-clone-referenced-element|@react-native-community|expo-router|@react-native-async-storage|@react-native-community/datetimepicker|@react-navigation/.*|@shopify/restyle|react-native-svg|@sentry/react-native))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/dist/', '/build/'],
  testMatch: ['**/*.test.{ts,tsx}'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/test/**'],
};
