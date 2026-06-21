import type { AdminActionHandlerContext } from "./actionHandlers";
import {
  confirmDeleteCatalogItem,
  confirmDeleteCatalogOption,
  confirmDeleteGrillItem,
  confirmDeleteGrillProduct,
} from "./confirmations";
import {
  findCatalogItem,
  findCatalogItemOption,
  findGrillFamily,
  findGrillItem,
} from "../views/renderer";

export async function handleDeleteCatalogItemAction(
  context: AdminActionHandlerContext,
  target: HTMLElement,
): Promise<void> {
  const sectionId = target.dataset.sectionId;
  const itemId = target.dataset.itemId;
  const item = sectionId && itemId ? findCatalogItem(sectionId, itemId) : undefined;

  if (!item) {
    context.setStatus("No se encontró el item seleccionado.", "danger");
    return;
  }

  if (!context.formState.confirmUnsavedChanges() || !confirmDeleteCatalogItem(item.name)) {
    return;
  }

  await context.adminOperations.deleteCatalogItem(item);
}

export async function handleDeleteGrillItemAction(
  context: AdminActionHandlerContext,
  target: HTMLElement,
): Promise<void> {
  const itemId = target.dataset.itemId;
  const item = itemId ? findGrillItem(itemId) : undefined;

  if (!item) {
    context.setStatus("No se encontró la opción de parrilla seleccionada.", "danger");
    return;
  }

  if (!context.formState.confirmUnsavedChanges() || !confirmDeleteGrillItem(item.variant_name ?? item.name)) {
    return;
  }

  await context.adminOperations.deleteGrillItem(item);
}

export async function handleDeleteGrillProductAction(
  context: AdminActionHandlerContext,
  target: HTMLElement,
): Promise<void> {
  const familyId = target.dataset.familyId;
  const family = familyId ? findGrillFamily(familyId) : undefined;

  if (!family) {
    context.setStatus("No se encontró el producto de parrilla seleccionado.", "danger");
    return;
  }

  if (!context.formState.confirmUnsavedChanges() || !confirmDeleteGrillProduct(family.title)) {
    return;
  }

  await context.adminOperations.deleteGrillProduct(family);
}

export async function handleDeleteCatalogOptionAction(
  context: AdminActionHandlerContext,
  target: HTMLElement,
): Promise<void> {
  const sectionId = target.dataset.sectionId;
  const itemId = target.dataset.itemId;
  const optionId = target.dataset.optionId;
  const option = sectionId && itemId && optionId
    ? findCatalogItemOption(sectionId, itemId, optionId)
    : undefined;

  if (!option) {
    context.setStatus("No se encontró la opción seleccionada.", "danger");
    return;
  }

  if (!context.formState.confirmUnsavedChanges() || !confirmDeleteCatalogOption(option.name)) {
    return;
  }

  await context.adminOperations.deleteCatalogOption(option);
}
