// Root-level Babel config: required so Metro applies babel-preset-expo to
// hoisted node_modules (e.g. react-native in a monorepo), not just files under
// mobile/. Without it, RN's Flow syntax reaches the bundle untransformed.
module.exports = {
  presets: ["babel-preset-expo"],
};
