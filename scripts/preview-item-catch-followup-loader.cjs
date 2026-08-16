module.exports = function previewItemCatchFollowupLoader(source) {
  const stunFrom = '                draggingRef.current = false;\n                setStunned(true);';
  const stunTo = '                setStunned(true);';

  if (!source.includes(stunFrom)) {
    throw new Error('[preview hazards followup] stun drag pattern not found');
  }

  return source.replace(stunFrom, stunTo);
};
