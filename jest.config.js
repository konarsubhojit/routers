module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-native-async-storage|@react-native-community|@react-native-firebase|react-native-fs)/)',
  ],
};
