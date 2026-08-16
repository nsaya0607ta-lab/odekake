module.exports = function previewItemCatchFollowupLoader(source) {
  let out = source;

  // Keep the drag state while stunned so a held finger resumes movement automatically.
  const stunFrom = '                draggingRef.current = false;\n                setStunned(true);';
  const stunTo = '                setStunned(true);';
  if (out.includes(stunFrom)) out = out.replace(stunFrom, stunTo);

  // Always use the real transparent WebP assets in Preview, even if another loader
  // or an older Preview revision still points at the source JPEGs.
  const assetReplacements = [
    ['/collection/items/0A579968-29E0-439D-A98A-92F38CC0B038.jpg', '/collection/items/hazard-time-minus.webp'],
    ['/collection/items/FE1C526C-89E3-4B22-BD4F-4C7E8FA6D605.jpg', '/collection/items/hazard-box-shrink.webp'],
    ['/collection/items/8AAFDB10-3454-496D-ACE2-57BA967B05D5.jpg', '/collection/items/hazard-blackout-squid.webp'],
    ['/collection/items/898B8C7F-E0C5-414C-A97D-402017BE9243.jpg', '/collection/items/hazard-stun-battery.webp'],
  ];

  for (const [from, to] of assetReplacements) {
    out = out.split(from).join(to);
  }

  // A previous Preview workaround used blend modes to hide the white JPEG background.
  // Transparent WebP files should be rendered normally, so remove that workaround if present.
  out = out.replace(/\s*mix-blend-multiply/g, '');

  return out;
};
