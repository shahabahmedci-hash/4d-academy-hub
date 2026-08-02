// Adsterra Ad Configuration
// Replace the placeholder values below with your actual Adsterra ad unit details.
// You can get these from your Adsterra publisher dashboard after creating ad units.

export const AD_CONFIG = {
  enabled: true,
  autoCloseSeconds: 0,
  cooldownSeconds: 10,
  banner: {
    desktop: {
      atOptions: {
        key: "b4f84ebaa6e36fc2d5af8636a6ee86dd",
        format: "iframe",
        height: 50,
        width: 320,
        params: {},
      },
      scriptSrc: "//www.highperformanceformat.com/b4f84ebaa6e36fc2d5af8636a6ee86dd/invoke.js",
    },
    mobile: {
      atOptions: {
        key: "b4f84ebaa6e36fc2d5af8636a6ee86dd",
        format: "iframe",
        height: 50,
        width: 320,
        params: {},
      },
      scriptSrc: "//www.highperformanceformat.com/b4f84ebaa6e36fc2d5af8636a6ee86dd/invoke.js",
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
