module.exports = {
    env: {
        "browser": true,
        "es6": true,
        "es2017": true
    },
    root: true,
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: "tsconfig.json",
        tsconfigRootDir: ".",
    },
    plugins: [
        "@typescript-eslint"
    ],
    extends: [
        "plugin:@typescript-eslint/recommended"
    ],
    rules: {
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
    }
};
