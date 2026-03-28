/**
 * Declarative Net Request rules for CORS bypass.
 * These are defined statically in cors_rules.json (dist/).
 * This module provides the JSON content for the build step.
 */

export const corsRules = [
  {
    id: 1,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        {
          header: "Origin",
          operation: "set",
          value: "http://localhost",
        },
      ],
    },
    condition: {
      urlFilter: "http://localhost:11434/*",
      resourceTypes: ["xmlhttprequest", "fetch"],
    },
  },
  {
    id: 2,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        {
          header: "Origin",
          operation: "set",
          value: "http://localhost",
        },
      ],
    },
    condition: {
      urlFilter: "http://localhost:8080/*",
      resourceTypes: ["xmlhttprequest", "fetch"],
    },
  },
];
