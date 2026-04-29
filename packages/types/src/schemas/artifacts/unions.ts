/**
 * Artifact union types
 */

import type { Document } from "./document";
import type { Form } from "./form";
import type { Checklist } from "./checklist";
import type { Bundle } from "./bundle";

/**
 * Any supported artifact type.
 * Union of all concrete artifact types.
 */
export type Artifact = Form | Document | Checklist | Bundle;
