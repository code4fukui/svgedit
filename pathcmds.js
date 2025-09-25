export const cmdMove = (x, y) => ({ t: 'M', x, y });
export const cmdLine = (x, y) => ({ t: 'L', x, y });
export const cmdQuad = (x, y, cx, cy) =>  ({ t: 'Q', x, y, cx, cy });
export const cmdCurve = (x, y, cx, cy, cx2, cy2) => ({ t: 'C', x, y, cx, cy, cx2, cy2 });
