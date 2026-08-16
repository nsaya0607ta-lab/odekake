module.exports = function previewItemCatchFollowupLoader(source) {
  let out = source;

  const stunFrom = '                draggingRef.current = false;\n                setStunned(true);';
  const stunTo = '                setStunned(true);';

  if (!out.includes(stunFrom)) {
    throw new Error('[preview hazards followup] stun drag pattern not found');
  }
  out = out.replace(stunFrom, stunTo);

  const assetReplacements = [
    ['/collection/items/hazard-time-minus.webp', '/collection/items/0A579968-29E0-439D-A98A-92F38CC0B038.jpg'],
    ['/collection/items/hazard-stun-battery.webp', '/collection/items/898B8C7F-E0C5-414C-A97D-402017BE9243.jpg'],
    ['/collection/items/hazard-blackout-squid.webp', '/collection/items/8AAFDB10-3454-496D-ACE2-57BA967B05D5.jpg'],
    ['/collection/items/hazard-box-shrink.webp', '/collection/items/FE1C526C-89E3-4B22-BD4F-4C7E8FA6D605.jpg'],
  ];

  for (const [from, to] of assetReplacements) {
    if (!out.includes(from)) {
      throw new Error('[preview hazards followup] asset path not found: ' + from);
    }
    out = out.replaceAll(from, to);
  }

  const imageFrom = '<Image src={entity.image} alt="" width={160} height={160} draggable={false} className="h-auto w-full object-contain" />';
  const imageTo = '<Image src={entity.image} alt="" width={160} height={160} draggable={false} className={`h-auto w-full object-contain ${NEGATIVE_HAZARD_IDS.has(entity.itemId ?? "") ? "mix-blend-multiply" : ""}`} />';

  if (!out.includes(imageFrom)) {
    throw new Error('[preview hazards followup] entity image pattern not found');
  }
  out = out.replace(imageFrom, imageTo);

  return out;
};
