import babel from "rollup-plugin-babel";
import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";

export default {
  input: "src/Fullik.js",

  // sourceMap: true,
  output: [
    {
      format: "umd",
      name: "FIK",
      file: "build/fik.js",
      indent: "\t",
      plugins: [
        babel({
          babelrc: false,
          presets: [["env", { modules: false, debug: true }]],
          exclude: "node_modules/**",
          plugins: ["external-helpers"],
          externalHelpers: true,
          runtimeHelpers: true
        }),
        resolve({
          jsnext: true,
          main: true,
          browser: true
        }),
        commonjs()
      ]
    },
    {
      format: "es",
      file: "build/fik.module.js",
      indent: "\t",
      plugins: [
        babel({
          babelrc: false,
          presets: [["env", { modules: false, debug: true }]],
          exclude: "node_modules/**",
          plugins: ["external-helpers"],
          externalHelpers: true,
          runtimeHelpers: true
        }),
        resolve({
          jsnext: true,
          main: true,
          browser: true
        }),
        commonjs()
      ]
    }
  ]
};
