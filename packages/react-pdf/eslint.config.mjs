import { config } from "@paradoc/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    rules: {
      // `tw` is takumi-pdf's Tailwind property. The package augments React's
      // `DOMAttributes` to declare it, so it is typed; the lint rule reads a
      // fixed list of DOM properties and cannot see the augmentation.
      "react/no-unknown-property": ["error", { ignore: ["tw"] }],
    },
  },
];
