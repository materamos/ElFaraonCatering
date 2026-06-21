export function confirmPublishChanges(): boolean {
  return window.confirm(
    "Vas a publicar los cambios guardados de platos, parrilla, menú fijo, servicio activo y precios. La disponibilidad ya se aplica al instante. ¿Continuar?",
  );
}

export function confirmDeleteGrillProduct(title: string): boolean {
  return window.confirm(
    `Vas a eliminar ${title} y todas sus opciones de parrilla. El cambio se verá después de publicar. ¿Continuar?`,
  );
}

export function confirmDeleteCatalogItem(name: string): boolean {
  return window.confirm(
    `Vas a eliminar ${name} del menú fijo. El cambio se verá después de publicar. ¿Continuar?`,
  );
}

export function confirmDeleteGrillItem(name: string): boolean {
  return window.confirm(
    `Vas a eliminar la opción ${name} de parrilla. El cambio se verá después de publicar. ¿Continuar?`,
  );
}

export function confirmDeleteCatalogOption(name: string): boolean {
  return window.confirm(
    `Vas a eliminar el sabor ${name}. El cambio se verá después de publicar. ¿Continuar?`,
  );
}
