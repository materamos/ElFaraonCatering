import { adminForms } from "../core/contracts";
import type {
  FixedPriceState,
  PricingLabel,
  VariantPriceState,
} from "../core/types";
import {
  escapeHtml,
  formatAmount,
  formatPricingLabel,
} from "../core/format";
import { disabledAttr, hiddenInput, renderEmpty } from "./html";

export function renderFixedPriceRows(
  rows: FixedPriceState[],
  emptyMessage: string,
  isBusy: boolean,
): string {
  return `
    <div class="admin-grid">
      <p class="admin-kicker">Precios</p>
      ${rows.length > 0 ? rows.map((row) => renderFixedPriceRow(row, isBusy)).join("") : renderEmpty(emptyMessage)}
    </div>
  `;
}

interface PriceRowRenderOptions {
  showTags?: boolean;
}

export function renderFixedPriceRow(
  price: FixedPriceState,
  isBusy: boolean,
  options: PriceRowRenderOptions = {},
): string {
  const label = formatPricingLabel(price.pricing_key, "Precio fijo");
  const showTags = options.showTags ?? true;

  return `
    <form class="admin-row admin-price-row" data-admin-form="${adminForms.fixedPrice}">
      <div class="admin-row__main">
        <p class="admin-row__title">${escapeHtml(label.title)}</p>
        ${showTags ? renderPriceTags(label) : ""}
        <p class="admin-row__meta">Actual: ${escapeHtml(formatAmount(price.amount))}</p>
      </div>
      <div class="admin-row__actions">
        ${hiddenInput("pricing_key", price.pricing_key)}
        <label class="admin-price-field">
          <span class="admin-label">Importe</span>
          <input class="admin-input" type="number" name="amount" min="0" step="1" inputmode="numeric" value="${price.amount}" required />
        </label>
        <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Guardar</button>
      </div>
    </form>
  `;
}

export function renderVariantPriceRow(
  variant: VariantPriceState,
  isBusy: boolean,
  options: PriceRowRenderOptions = {},
): string {
  const label = formatPricingLabel(variant.pricing_key, "Variantes");
  const showTags = options.showTags ?? true;

  return `
    <form class="admin-row admin-price-row" data-admin-form="${adminForms.variantPrice}">
      <div class="admin-row__main">
        <p class="admin-row__title">${escapeHtml(label.title)}</p>
        ${showTags ? renderPriceTags(label) : ""}
        <p class="admin-row__meta">Variante: ${escapeHtml(variant.name)}</p>
        <p class="admin-row__meta">Actual: ${escapeHtml(formatAmount(variant.amount))}</p>
      </div>
      <div class="admin-row__actions">
        ${hiddenInput("pricing_key", variant.pricing_key)}
        ${hiddenInput("variant_id", variant.variant_id)}
        <label class="admin-price-field">
          <span class="admin-label">Importe</span>
          <input class="admin-input" type="number" name="amount" min="0" step="1" inputmode="numeric" value="${variant.amount}" required />
        </label>
        <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Guardar</button>
      </div>
    </form>
  `;
}

function renderPriceTags(label: PricingLabel): string {
  return `
    <div class="admin-price-tags">
      ${label.tags.map((tag) => `<span class="admin-price-tag">${escapeHtml(tag)}</span>`).join("")}
    </div>
  `;
}
