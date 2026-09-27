/**
 * The `service.ts` import boundary.
 *
 * A domain capability package bundles its wire contract (`./contracts`), its
 * router (which pulls `@paradoc/api-kernel` for auth/policy/middleware), and its
 * pure service. The service is API-free: it holds the business logic and must
 * not reach up into the contract/router layer.
 *
 * @type {import("eslint").Linter.Config[]}
 */
const serviceBoundary = [
  {
    files: ["**/service.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "./contracts",
                "./contracts/**",
                "../contracts",
                "../contracts/**",
                "../../contracts",
                "../../contracts/**",
                "../../../contracts",
                "../../../contracts/**",
                "../../../../contracts",
                "../../../../contracts/**",
              ],
              message:
                "A service.ts is api-free: it must not import its co-located ./contracts (the wire/router layer). Keep business logic decoupled from the contract; move shared types to a service-neutral module.",
            },
            {
              group: ["@paradoc/api-kernel", "@paradoc/api-kernel/**"],
              message:
                "A service.ts is api-free: it must not import @paradoc/api-kernel (auth/policy/middleware/procedure). That belongs in the router layer, not the service.",
            },
          ],
        },
      ],
    },
  },
];

export default serviceBoundary;
