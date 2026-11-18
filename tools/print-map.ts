import { GridMap } from '../src/shared/data/maps/GridMapBuilder';
import { usinaSpec } from '../src/shared/data/maps/usina';

const g = new GridMap(usinaSpec.width, usinaSpec.height);
for (const [ch, a, b, c, d] of usinaSpec.carve) g.fill(ch, a, b, c, d);
console.log('    ' + Array.from({ length: g.w }, (_, i) => (i % 10).toString()).join(''));
g.cells.forEach((row, j) => console.log(j.toString().padStart(3) + ' ' + row.join('')));
