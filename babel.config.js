module.exports = function() {
  const presets = [
    [
      "@babel/env",
      {
        targets: {
          edge: "17",
          firefox: "60",
          chrome: "67",
          safari: "11.1"
        },
        useBuiltIns: "usage",
        debug: true
      }
    ]
  ];
  const plugins = [
    "@babel/plugin-external-helpers",
    "@babel/plugin-proposal-private-methods"
  ];
  return {
    presets,
    plugins
  };
};
//module.exports = { presets };
