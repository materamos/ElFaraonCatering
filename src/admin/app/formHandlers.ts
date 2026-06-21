import type { createAdminSessionController } from "./session";
import type { createAdminOperations } from "../operations";
import { adminForms } from "../core/contracts";
import type { RenderOptions } from "../core/types";

interface AdminFormHandlerContext {
  sessionController: ReturnType<typeof createAdminSessionController>;
  adminOperations: ReturnType<typeof createAdminOperations>;
  renderCurrentView(options?: RenderOptions): void;
}

export function createAdminFormHandlers(context: AdminFormHandlerContext) {
  async function handleFormSubmit(form: HTMLFormElement): Promise<void> {
    const formKind = form.dataset.adminForm;

    if (formKind === adminForms.login) {
      await context.sessionController.login(form);
      return;
    }

    if (formKind === adminForms.passwordResetRequest) {
      await context.sessionController.requestPasswordReset(form);
      return;
    }

    if (formKind === adminForms.setPassword) {
      await context.sessionController.setPassword(form);
      return;
    }

    if (!context.sessionController.getCurrentSession()) {
      context.sessionController.setAuthView("login");
      context.renderCurrentView({ focus: "view" });
      return;
    }

    if (formKind === adminForms.dailyMenu) {
      await context.adminOperations.saveDailyMenu(form);
      return;
    }

    if (formKind === adminForms.serviceKind) {
      await context.adminOperations.saveServiceKind(form);
      return;
    }

    if (formKind === adminForms.grillItem) {
      await context.adminOperations.saveGrillItem(form);
      return;
    }

    if (formKind === adminForms.grillProduct) {
      await context.adminOperations.saveGrillProduct(form);
      return;
    }

    if (formKind === adminForms.grillProductEdit) {
      await context.adminOperations.saveGrillProductEdit(form);
      return;
    }

    if (formKind === adminForms.grillItemEdit) {
      await context.adminOperations.saveGrillItemEdit(form);
      return;
    }

    if (formKind === adminForms.fixedPrice) {
      await context.adminOperations.saveFixedPrice(form);
      return;
    }

    if (formKind === adminForms.variantPrice) {
      await context.adminOperations.saveVariantPrice(form);
      return;
    }

    if (formKind === adminForms.catalogItem) {
      await context.adminOperations.saveCatalogItem(form);
      return;
    }

    if (formKind === adminForms.catalogItemEdit) {
      await context.adminOperations.saveCatalogItemEdit(form);
      return;
    }

    if (formKind === adminForms.catalogOption) {
      await context.adminOperations.saveCatalogOption(form);
      return;
    }

    if (formKind === adminForms.catalogOptionEdit) {
      await context.adminOperations.saveCatalogOptionEdit(form);
      return;
    }

    if (formKind === adminForms.changePassword) {
      await context.sessionController.changePassword(form);
    }
  }

  return { handleFormSubmit };
}
