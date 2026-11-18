export type HairStyle = 'fade' | 'curly' | 'ponytail' | 'buzz' | 'afro' | 'sidepart' | 'mohawk' | 'bald' | 'longtied' | 'braid' | 'buns';
export type TopStyle = 'jacket' | 'hoodie' | 'tshirt' | 'tank' | 'coat' | 'sweatervest' | 'polo' | 'jersey' | 'overalls' | 'medic';
export type PantsStyle = 'jeans' | 'shorts' | 'cargo' | 'track' | 'leggings';
export type Accessory =
  | 'glasses' | 'roundGlasses' | 'sunglasses' | 'capBack' | 'headphonesNeck' | 'headset' | 'beard' | 'mustache' | 'stubble'
  | 'hoops' | 'chain' | 'headband' | 'scarfMask' | 'tophat' | 'flower' | 'kneepads' | 'apron' | 'hairband' | 'watch' | 'gloves' | 'backpack' | 'sunhat';

export interface Appearance {
  gender: 'm' | 'f';
  height: number;
  build: number;
  belly: number;
  muscle: number;
  headSize: number;
  skin: number;
  hair: HairStyle;
  hairColor: number;
  eyeColor: number;
  top: TopStyle;
  topColor: number;
  topColor2: number;
  pants: PantsStyle;
  pantsColor: number;
  shoes: number;
  accent: number;
  accessories: Accessory[];
}

export const APPEARANCES: Record<string, Appearance> = {
  david: {
    gender: 'm', height: 1.0, build: 1.0, belly: 0, muscle: 0.5, headSize: 1, skin: 0xc68e62, hair: 'fade', hairColor: 0x1d1510, eyeColor: 0x3a2414,
    top: 'jacket', topColor: 0x1f4fa8, topColor2: 0x111a2e, pants: 'jeans', pantsColor: 0x23314a, shoes: 0xf2f2f2, accent: 0x4fc3ff,
    accessories: ['gloves', 'watch'],
  },
  jaogugu: {
    gender: 'm', height: 1.06, build: 0.92, belly: 0.1, muscle: 0.2, headSize: 1, skin: 0xf0c8a0, hair: 'curly', hairColor: 0x5a3a1e, eyeColor: 0x4a6a3a,
    top: 'tshirt', topColor: 0xe0702a, topColor2: 0x8a3a1a, pants: 'cargo', pantsColor: 0x6a6a4a, shoes: 0x3a2a1a, accent: 0xff8a3a,
    accessories: ['beard', 'capBack', 'apron'],
  },
  china: {
    gender: 'f', height: 0.95, build: 0.9, belly: 0, muscle: 0.2, headSize: 1, skin: 0xf3d2b0, hair: 'ponytail', hairColor: 0x0d0d10, eyeColor: 0x2a1a10,
    top: 'jacket', topColor: 0xe8b520, topColor2: 0x1a1a1a, pants: 'leggings', pantsColor: 0x1b1b22, shoes: 0xe8e8e8, accent: 0xffd34a,
    accessories: ['roundGlasses', 'headset'],
  },
  mallcon: {
    gender: 'm', height: 1.03, build: 1.12, belly: 0, muscle: 1, headSize: 0.98, skin: 0x7a4a2a, hair: 'buzz', hairColor: 0x120c08, eyeColor: 0x2a1a10,
    top: 'tank', topColor: 0x2e8a3a, topColor2: 0x1a4a22, pants: 'track', pantsColor: 0x1a1a1a, shoes: 0xd23a2a, accent: 0x9dff7a,
    accessories: ['headband', 'chain'],
  },
  mirela: {
    gender: 'f', height: 1.0, build: 0.98, belly: 0, muscle: 0.4, headSize: 1, skin: 0x4a2a1a, hair: 'afro', hairColor: 0x1a100a, eyeColor: 0x24140a,
    top: 'medic', topColor: 0xc23a7a, topColor2: 0xf4f4f4, pants: 'cargo', pantsColor: 0xeae6e0, shoes: 0x2a2a2a, accent: 0xff5ab8,
    accessories: ['hoops', 'hairband'],
  },
  caio: {
    gender: 'm', height: 1.02, build: 0.95, belly: 0, muscle: 0.3, headSize: 1, skin: 0xd9a77a, hair: 'sidepart', hairColor: 0x4a2e18, eyeColor: 0x3a5a7a,
    top: 'sweatervest', topColor: 0x6a6f78, topColor2: 0x9cc4e8, pants: 'jeans', pantsColor: 0xb8a27a, shoes: 0x5a3a20, accent: 0x8ab4ff,
    accessories: ['glasses', 'watch'],
  },
  boquinha: {
    gender: 'm', height: 0.93, build: 0.95, belly: 0.05, muscle: 0.2, headSize: 1.04, skin: 0xe2b48a, hair: 'mohawk', hairColor: 0x9a4aff, eyeColor: 0x3a2414,
    top: 'hoodie', topColor: 0x5a2a8a, topColor2: 0x2a1240, pants: 'jeans', pantsColor: 0x151518, shoes: 0xffffff, accent: 0xd28aff,
    accessories: ['headphonesNeck', 'chain'],
  },
  garcia: {
    gender: 'm', height: 1.02, build: 1.45, belly: 1, muscle: 0.4, headSize: 1.06, skin: 0xb8825a, hair: 'bald', hairColor: 0x2a1a10, eyeColor: 0x2a1a10,
    top: 'polo', topColor: 0x1c1c1f, topColor2: 0xf09a2a, pants: 'cargo', pantsColor: 0x2e3238, shoes: 0x1a1a1a, accent: 0xffb84a,
    accessories: ['mustache', 'stubble', 'sunglasses'],
  },
  biro: {
    gender: 'm', height: 1.04, build: 0.85, belly: 0, muscle: 0.1, headSize: 0.98, skin: 0xf5dcc6, hair: 'longtied', hairColor: 0x101014, eyeColor: 0x5a3a8a,
    top: 'coat', topColor: 0x2e2244, topColor2: 0x8a6aff, pants: 'jeans', pantsColor: 0x16141c, shoes: 0x0e0e10, accent: 0x8a6aff,
    accessories: ['scarfMask', 'tophat', 'gloves'],
  },
  isabela: {
    gender: 'f', height: 1.01, build: 0.95, belly: 0, muscle: 0.6, headSize: 0.98, skin: 0xd6a274, hair: 'braid', hairColor: 0x5a3418, eyeColor: 0x3a6a4a,
    top: 'jersey', topColor: 0x1aa88a, topColor2: 0xffffff, pants: 'shorts', pantsColor: 0x0e3a40, shoes: 0xffffff, accent: 0x4affd2,
    accessories: ['kneepads', 'headband'],
  },
  julia: {
    gender: 'f', height: 0.96, build: 0.92, belly: 0, muscle: 0.2, headSize: 1.0, skin: 0xf6d6c0, hair: 'buns', hairColor: 0xa8401a, eyeColor: 0x3a7a3a,
    top: 'overalls', topColor: 0x3f8a4a, topColor2: 0xf4f0e6, pants: 'jeans', pantsColor: 0x3f8a4a, shoes: 0x7a5a3a, accent: 0x5aff6a,
    accessories: ['flower', 'gloves', 'sunhat'],
  },
};
