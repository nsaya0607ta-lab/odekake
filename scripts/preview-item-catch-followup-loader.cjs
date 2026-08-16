module.exports = function previewItemCatchFollowupLoader(source) {
  const from = '                draggingRef.current = false;\n                setStunned(true);';
  const to = '                setStunned(true);';

  if (!source.includes(from)) {
    throw new Error('[preview hazards followup] stun drag pattern not found');
  }

  return source.replace(from, to);
};
