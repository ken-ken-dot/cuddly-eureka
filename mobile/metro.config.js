const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Monorepo: allow Metro to resolve + watch the shared corrections.json at root.
const path = require("path");
config.watchFolders = [path.resolve(__dirname, "..")];

module.exports = config;
