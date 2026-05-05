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
        key: "b024d75e6c3bd263a57f21a31e7c1d85",
        format: "iframe",
        height: 50,
        width: 320,
        params: {},
      },
      scriptSrc: "//www.highperformanceformat.com/b024d75e6c3bd263a57f21a31e7c1d85/invoke.js",
    },
    mobile: {
      atOptions: {
        key: "b024d75e6c3bd263a57f21a31e7c1d85",
        format: "iframe",
        height: 50,
        width: 320,
        params: {},
      },
      scriptSrc: "//www.highperformanceformat.com/b024d75e6c3bd263a57f21a31e7c1d85/invoke.js",
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
