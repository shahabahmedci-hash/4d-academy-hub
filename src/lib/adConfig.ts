// Adsterra Ad Configuration
// Replace the placeholder values below with your actual Adsterra ad unit details.
// You can get these from your Adsterra publisher dashboard after creating ad units.

// Ad unit key used by the original 4D Academy app.
const AD_KEY = "b4f84ebaa6e36fc2d5af8636a6ee86dd";

export const AD_CONFIG = {
  enabled: true,
  autoCloseSeconds: 0,
  cooldownSeconds: 10,
  banner: {
    desktop: {
      atOptions: {
        key: AD_KEY,
        format: "iframe",
        height: 50,
        width: 320,
        params: {},
      },
      scriptSrc: `//www.highperformanceformat.com/${AD_KEY}/invoke.js`,
    },
    mobile: {
      atOptions: {
        key: AD_KEY,
        format: "iframe",
        height: 50,
        width: 320,
        params: {},
      },
      scriptSrc: `//www.highperformanceformat.com/${AD_KEY}/invoke.js`,
    },
  },
} as const;

// Helper to check if ads are configured (not using placeholder keys)
export const isAdConfigured = () => {
  return (
    AD_CONFIG.enabled &&
    !AD_CONFIG.banner.desktop.atOptions.key.includes("YOUR_ADSTERRA")
  );
};
