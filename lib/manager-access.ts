/** Manager and storekeeper may always view mechanic-submitted parts and photos. */
export async function canManagerViewMechanicWork(): Promise<boolean> {
  return true;
}
