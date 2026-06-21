import { createAvailabilityOperations } from "./availability";
import { createCatalogOperations } from "./catalog";
import { createGrillOperations } from "./grill";
import { createPriceOperations } from "./prices";
import { createPublishOperations } from "./publish";
import { createServiceOperations } from "./service";
import type { AdminOperationContext } from "./types";

export function createAdminOperations(context: AdminOperationContext) {
  return {
    ...createAvailabilityOperations(context),
    ...createServiceOperations(context),
    ...createGrillOperations(context),
    ...createPriceOperations(context),
    ...createCatalogOperations(context),
    ...createPublishOperations(context),
  };
}
