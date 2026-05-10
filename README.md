# FileSage

React Native (bare) + TypeScript scaffold for the FileSage app.

## Android configuration

- **Application ID / package**: `com.filesage`
- **Minimum SDK**: 26
- **Target SDK**: 34

## Tooling

- ESLint + Prettier using React Native defaults (`@react-native/eslint-config`, `.prettierrc.js`)
- Jest configured with React Native preset (`@react-native/jest-preset`)
- TypeScript typecheck script: `npm run typecheck`

## Quickstart

```sh
npm ci
npm run lint
npm test
```

To run on Android (with emulator/device configured):

```sh
npm run android
```
