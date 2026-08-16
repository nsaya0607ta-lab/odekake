module.exports = function previewItemCatchFollowupLoader(source) {
  let out = source;

  const stunFrom = '                draggingRef.current = false;\n                setStunned(true);';
  const stunTo = '                setStunned(true);';
  if (!out.includes(stunFrom)) {
    throw new Error('[preview hazards followup] stun drag pattern not found');
  }
  out = out.replace(stunFrom, stunTo);

  const imageFrom = '<Image src={entity.image} alt="" width={160} height={160} draggable={false} className="h-auto w-full object-contain" />';
  const imageTo = '<Image src={entity.image} alt="" width={160} height={160} draggable={false} className={`h-auto w-full object-contain ${NEGATIVE_HAZARD_IDS.has(entity.itemId ?? "") ? "mix-blend-multiply" : ""}`} />';
  if (!out.includes(imageFrom)) {
    throw new Error('[preview hazards followup] entity image pattern not found');
  }
  out = out.replace(imageFrom, imageTo);

  return out;
};
