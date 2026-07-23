import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "coverage/**", "dist/**"]
  },
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off"
    }
  },
  {
    files: ["js/audio/timer.worker.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly"
      }
    }
  },
  {
    files: ["tests/**/*.js", "*.config.js"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  }
];
