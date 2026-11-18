export type CrosshairType = 'cruz' | 'ponto' | 'cruz-ponto' | 'circulo' | 't';
export type CrosshairColor = 'verde' | 'ciano' | 'branco' | 'vermelho' | 'amarelo';

export const CROSSHAIR_TYPES: CrosshairType[] = ['cruz', 'ponto', 'cruz-ponto', 'circulo', 't'];
export const CROSSHAIR_COLORS: CrosshairColor[] = ['verde', 'ciano', 'branco', 'vermelho', 'amarelo'];

export const CROSSHAIR_HEX: Record<CrosshairColor, string> = {
  verde: '#3dff7a',
  ciano: '#4fe6ff',
  branco: '#ffffff',
  vermelho: '#ff3d4d',
  amarelo: '#ffe14a',
};

/**
 * Inner markup for a `.xh` crosshair element. Lines are positioned by CSS from
 * the `--gap` variable, so the HUD can open the crosshair with weapon spread.
 */
export function crosshairHTML(type: CrosshairType): string {
  const dot = '<b class="xh-dot"></b>';
  const lines = (top: boolean): string =>
    '<i class="xh-r"></i><i class="xh-l"></i><i class="xh-b"></i>' + (top ? '<i class="xh-t"></i>' : '');
  switch (type) {
    case 'ponto': return dot;
    case 'cruz-ponto': return lines(true) + dot;
    case 'circulo': return '<s class="xh-ring"></s>' + dot;
    case 't': return lines(false);
    default: return lines(true);
  }
}

export function applyCrosshair(el: HTMLElement, type: CrosshairType, color: CrosshairColor): void {
  el.innerHTML = crosshairHTML(type);
  el.style.setProperty('--xh', CROSSHAIR_HEX[color] ?? CROSSHAIR_HEX.verde);
}
