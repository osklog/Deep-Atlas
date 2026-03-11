import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "@react-native-async-storage/async-storage": path.resolve(
        __dirname,
        "__tests__/__mocks__/async-storage.ts"
      ),
      "expo-file-system/legacy": path.resolve(
        __dirname,
        "__tests__/__mocks__/expo-file-system.ts"
      ),
      "expo-sharing": path.resolve(
        __dirname,
        "__tests__/__mocks__/expo-sharing.ts"
      ),
      "expo-haptics": path.resolve(
        __dirname,
        "__tests__/__mocks__/expo-haptics.ts"
      ),
    },
  },
});
