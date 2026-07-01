/**
 * Central feature toggles.
 *
 * A single mutable source of truth so experimental / discoverability affordances
 * can be turned on and off in one place (and flipped in tests) without threading
 * props through the tree. Flip a value here to change the default build; wire it
 * to a settings UI or query param later if runtime toggling is wanted.
 */
export interface FeatureFlags {
  /**
   * The persistent ⌥ badge on the radial menu's Sibling/Child buttons that
   * advertises the "hold ⌥ for twins" accelerator. Off by default — it's a
   * power-user hint that costs more screen real estate than it's worth as an
   * always-on element.
   */
  altHint: boolean;
  /**
   * The twin (MZ/DZ) options shown alongside the gender icons in the inline
   * gender popup, so a just-created person can be twinned in the same step as
   * choosing their sex.
   */
  twinsInGenderPopup: boolean;
}

export const featureFlags: FeatureFlags = {
  altHint: false,
  twinsInGenderPopup: true,
};
