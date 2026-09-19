/* =========================================================================
   MUYE 沐野 · AI 虚拟试衣 —— 试衣渲染内核
   大屏端 / 手机端共用。纯参数化 SVG 合成，不依赖任何外部图片与网络。
   ========================================================================= */

const CX = 160; // 版型中心线

/* ---------------- 虚拟形象（不采集真人脸，这里是唯一"数据源"） ------------- */
const BODIES = [
  { id:'a1', name:'小柔', gender:'f', height:158, shape:'偏瘦', sh:36, w:25, h:33,
    skin:'#F3D6BF', hair:'#3A2C21', hairStyle:'long', note:'158cm · 偏瘦', tip:'适合观察版型是否偏宽' },
  { id:'a2', name:'阿泽', gender:'m', height:176, shape:'匀称', sh:49, w:33, h:36,
    skin:'#E7C3A4', hair:'#241E1B', hairStyle:'short', note:'176cm · 匀称', tip:'男装参考' },
  { id:'a3', name:'蔓蔓', gender:'f', height:165, shape:'匀称', sh:42, w:29, h:39,
    skin:'#F0D0B4', hair:'#4A3327', hairStyle:'bob', note:'165cm · 匀称', tip:'最常见身形' },
  { id:'a4', name:'圆圆', gender:'f', height:162, shape:'丰满', sh:45, w:35, h:47,
    skin:'#EBC9AE', hair:'#2B211C', hairStyle:'long', note:'162cm · 丰满', tip:'看显瘦与包容性' },
  { id:'a5', name:'阿岚', gender:'m', height:170, shape:'偏瘦', sh:45, w:30, h:34,
    skin:'#E3BE9C', hair:'#1F1B19', hairStyle:'short', note:'170cm · 偏瘦', tip:'偏瘦身形参考' },
  { id:'a6', name:'乐乐', gender:'f', height:168, shape:'运动', sh:43, w:31, h:38,
    skin:'#F1D3B8', hair:'#3A2C22', hairStyle:'pony', note:'168cm · 运动型', tip:'肩背偏厚' },
];

/* ------------------------------ 在售货品 ------------------------------ */
const ITEMS = [
  // 上装
  { id:'t1', cat:'top',    type:'knit',       name:'云朵针织衫',     price:399,  tone:'燕麦',   color:'#D8CAB4', color2:'#C2AF93', tag:'门店热卖', stock:'本店 12 件' },
  { id:'t2', cat:'top',    type:'shirt',      name:'真丝垂感衬衫',   price:599,  tone:'月光白', color:'#F1EEE6', color2:'#DAD4C6', tag:'新品',     stock:'本店 6 件' },
  { id:'t3', cat:'top',    type:'tee',        name:'重磅纯棉 T 恤',  price:199,  tone:'石墨黑', color:'#3B3B3E', color2:'#2A2A2D', tag:'基础款',   stock:'本店 30 件' },
  { id:'t4', cat:'top',    type:'turtleneck', name:'高领羊毛打底',   price:459,  tone:'奶油白', color:'#EFE6D7', color2:'#D9CBB4', tag:'',         stock:'本店 9 件' },
  { id:'t5', cat:'top',    type:'cardigan',   name:'复古拼色开衫',   price:529,  tone:'焦糖',   color:'#B97A4E', color2:'#96603A', tag:'限量',     stock:'本店 4 件' },
  { id:'t6', cat:'top',    type:'cami',       name:'微光缎面吊带',   price:329,  tone:'藕粉',   color:'#E4B9B1', color2:'#C99891', tag:'',         stock:'本店 7 件' },
  // 下装
  { id:'b1', cat:'bottom', type:'jeans',      name:'高腰直筒牛仔裤', price:499,  tone:'水洗蓝', color:'#5C7492', color2:'#455C79', tag:'门店热卖', stock:'本店 15 件' },
  { id:'b2', cat:'bottom', type:'askirt',     name:'A 字中长裙',     price:559,  tone:'燕麦',   color:'#C8B59B', color2:'#AF9979', tag:'',         stock:'本店 8 件' },
  { id:'b3', cat:'bottom', type:'wide',       name:'垂感阔腿裤',     price:529,  tone:'深灰',   color:'#4B4B50', color2:'#38383C', tag:'新品',     stock:'本店 11 件' },
  { id:'b4', cat:'bottom', type:'pleat',      name:'肌理百褶裙',     price:489,  tone:'米白',   color:'#E5DBC9', color2:'#CCC0A6', tag:'',         stock:'本店 5 件' },
  { id:'b5', cat:'bottom', type:'slack',      name:'直筒西裤',       price:599,  tone:'炭黑',   color:'#34343B', color2:'#242429', tag:'',         stock:'本店 13 件' },
  { id:'b6', cat:'bottom', type:'dskirt',     name:'牛仔半身裙',     price:429,  tone:'原色蓝', color:'#4E6484', color2:'#3C5070', tag:'',         stock:'本店 6 件' },
  // 连衣裙
  { id:'d1', cat:'dress',  type:'shirtdress', name:'收腰衬衫裙',     price:699,  tone:'雾霾蓝', color:'#8FA3B4', color2:'#71889B', tag:'新品',     stock:'本店 5 件' },
  { id:'d2', cat:'dress',  type:'slipdress',  name:'褶皱吊带长裙',   price:759,  tone:'香槟',   color:'#DCC9A8', color2:'#C1A980', tag:'',         stock:'本店 3 件' },
  { id:'d3', cat:'dress',  type:'knitdress',  name:'针织直筒裙',     price:649,  tone:'摩卡',   color:'#9C7F69', color2:'#7F6350', tag:'',         stock:'本店 7 件' },
  // 外套
  { id:'o1', cat:'outer',  type:'trench',     name:'直筒风衣',       price:1299, tone:'卡其',   color:'#BE9F73', color2:'#9E8259', tag:'经典',     stock:'本店 4 件' },
  { id:'o2', cat:'outer',  type:'blazer',     name:'短款西装外套',   price:899,  tone:'炭灰',   color:'#585860', color2:'#414148', tag:'',         stock:'本店 6 件' },
  { id:'o3', cat:'outer',  type:'coat',       name:'落肩羊毛大衣',   price:1599, tone:'燕麦',   color:'#D5C7B0', color2:'#B7A488', tag:'高定',     stock:'本店 2 件' },
];

const byId = id => ITEMS.find(i => i.id === id);
const bodyById = id => BODIES.find(b => b.id === id);

/* ------------------------------ 版型几何 ------------------------------ */
function torsoPath(b, e, len) {
  const { sh, w, h } = b, yT = 132, yW = 262, yH = 322;
  const flare = Math.max(0, len - 322) * 0.14;
  return `M${CX - sh - e},${yT}`
    + ` C${CX - sh - e + 2},200 ${CX - w - e - 8},228 ${CX - w - e},${yW}`
    + ` C${CX - w - e - 4},292 ${CX - h - e - 8},300 ${CX - h - e - 2},${yH}`
    + ` L${CX - h - e - 6 - flare},${len} Q${CX},${len + 16} ${CX + h + e + 6 + flare},${len}`
    + ` L${CX + h + e + 2},${yH}`
    + ` C${CX + h + e + 8},300 ${CX + w + e + 4},292 ${CX + w + e},${yW}`
    + ` C${CX + w + e + 8},228 ${CX + sh + e - 2},200 ${CX + sh + e},${yT}`
    + ` C${CX + sh + e - 12},${yT - 15} ${CX - sh - e + 12},${yT - 15} ${CX - sh - e},${yT} Z`;
}

/* 开襟外套的单侧衣片（中间留缝，露出内搭） */
function panelPath(b, side, e, len, center) {
  const { sh, w, h } = b, yT = 132, yW = 262, yH = 322;
  const flare = Math.max(0, len - 322) * 0.14;
  const sx = CX + side * (sh + e);
  const ix = CX + side * center;
  return `M${sx},${yT}`
    + ` C${CX + side * (sh + e + 2)},200 ${CX + side * (w + e + 8)},228 ${CX + side * (w + e)},${yW}`
    + ` C${CX + side * (w + e + 4)},292 ${CX + side * (h + e + 8)},300 ${CX + side * (h + e + 2)},${yH}`
    + ` L${CX + side * (h + e + 6 + flare)},${len}`
    + ` Q${CX + side * (h * 0.5)},${len + 12} ${ix},${len - 6}`
    + ` L${ix + side * 4},210 L${ix + side * 10},${yT + 2}`
    + ` L${sx},${yT} Z`;
}

function armLine(b, side, t) {
  const { sh } = b;
  const sx = CX + side * (sh - 8), sy = 158;
  const c1x = CX + side * (sh + 4), c1y = 200;
  const c2x = CX + side * (sh + 12), c2y = 266;
  const ex = CX + side * (sh + 15), ey = 332;
  const p = (a, c) => a + (c - a) * t;
  return {
    d: `M${sx},${sy} C${p(sx, c1x)},${p(sy, c1y)} ${p(c1x, c2x)},${p(c1y, c2y)} ${p(c1x, ex)},${p(c1y, ey)}`,
    end: [p(c1x, ex), p(c1y, ey)],
  };
}

function legLines(b, side) {
  const { h } = b;
  const x1 = CX + side * (h * 0.52), y1 = 316;
  const kx = CX + side * (h * 0.30), ky = 452;
  const ax = CX + side * (h * 0.26), ay = 570;
  return {
    thigh: `M${x1},${y1} C${x1 + side * 2},372 ${kx},402 ${kx},${ky}`,
    calf: `M${kx},${ky} C${kx},500 ${ax},530 ${ax},${ay}`,
    knee: [kx, ky], ankle: [ax, ay],
  };
}

/* ------------------------------ 底色人物 ------------------------------ */
function head(b) {
  const hc = b.hair;
  const back = {
    long: `<path d="M131,68 C125,120 129,158 127,190 L150,190 C144,154 144,110 148,82 Z" fill="${hc}"/>
           <path d="M189,68 C195,120 191,158 193,190 L170,190 C176,154 176,110 172,82 Z" fill="${hc}"/>`,
    bob: `<rect x="129" y="56" width="62" height="46" rx="23" fill="${hc}"/>`,
    short: `<rect x="135" y="52" width="50" height="32" rx="16" fill="${hc}"/>`,
    pony: `<rect x="135" y="52" width="50" height="34" rx="17" fill="${hc}"/>
           <circle cx="132" cy="55" r="11" fill="${hc}"/>`,
  }[b.hairStyle] || '';
  const cap = `<path d="M160,43 C182,43 190,59 188,83 C184,69 176,61 160,61 C144,61 136,69 132,83 C130,59 138,43 160,43 Z" fill="${hc}"/>`;
  return `${back}
    <circle cx="137" cy="76" r="4.5" fill="${b.skin}"/><circle cx="183" cy="76" r="4.5" fill="${b.skin}"/>
    <circle cx="160" cy="72" r="23" fill="${b.skin}"/>
    ${cap}
    <ellipse cx="152" cy="76" rx="2.4" ry="3.3" fill="#3B322A"/>
    <ellipse cx="168" cy="76" rx="2.4" ry="3.3" fill="#3B322A"/>
    <path d="M158,86 q2,2.2 4,0" stroke="#C08573" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
}

function bodyBase(b) {
  const s = [];
  [-1, 1].forEach(side => {
    const L = legLines(b, side);
    s.push(`<path d="${L.thigh}" stroke="${b.skin}" stroke-width="${b.h * 0.86}" fill="none"/>`);
    s.push(`<path d="${L.calf}" stroke="${b.skin}" stroke-width="${b.h * 0.6}" fill="none"/>`);
    s.push(`<ellipse cx="${L.ankle[0]}" cy="580" rx="13" ry="8" fill="${b.skin}"/>`);
    const A = armLine(b, side, 1);
    s.push(`<path d="${A.d}" stroke="${b.skin}" stroke-width="${b.sh * 0.5}" stroke-linecap="round" fill="none"/>`);
    s.push(`<circle cx="${A.end[0]}" cy="${A.end[1] + 7}" r="${b.sh * 0.24}" fill="${b.skin}"/>`);
  });
  s.push(`<path d="${torsoPath(b, 0, 322)}" fill="${b.skin}"/>`);
  s.push(`<rect x="${CX - 11}" y="98" width="22" height="44" rx="11" fill="${b.skin}"/>`);
  s.push(head(b));
  return s.join('');
}

/* 内搭打底（避免"未选上装"时露出身体） */
function innerLayer(b, uid, color = '#EAE3D7') {
  return `<clipPath id="${uid}bd"><path d="${torsoPath(b, 2, 330)}"/></clipPath>
  <g clip-path="url(#${uid}bd)"><rect x="0" y="146" width="320" height="192" fill="${color}"/>
  <rect x="0" y="316" width="320" height="30" fill="${color}" opacity=".85"/></g>`;
}

/* 领口（用底色"挖"出领型） */
function neckline(b, item, uid, len) {
  const c = `url(#${uid}c)`, e = 5;
  switch (item.type) {
    case 'turtleneck':
      return `<rect x="${CX - 14}" y="96" width="28" height="50" rx="12" fill="${c}"/>
              <rect x="${CX - 14}" y="96" width="28" height="50" rx="12" fill="none" stroke="${item.color2}" stroke-width="1.2" opacity=".45"/>`;
    case 'tee':
      return `<ellipse cx="${CX}" cy="141" rx="21" ry="12" fill="${b.skin}"/>
              <path d="M${CX - 21},141 a21,12 0 0 0 42,0" fill="none" stroke="${item.color2}" stroke-width="2.4" opacity=".55"/>`;
    case 'knit':
      return `<ellipse cx="${CX}" cy="141" rx="19" ry="11" fill="${b.skin}"/>
              <path d="M${CX - 19},140 a19,11 0 0 0 38,0" fill="none" stroke="${item.color2}" stroke-width="2.6" opacity=".5"/>`;
    case 'shirt':
      return `<path d="M${CX - 30},140 L${CX},172 L${CX + 30},140 L${CX + 18},132 L${CX},148 L${CX - 18},132 Z" fill="${item.color2}" opacity=".95"/>
              <line x1="${CX}" y1="166" x2="${CX}" y2="${len}" stroke="${item.color2}" stroke-width="2" opacity=".55"/>`;
    case 'cardigan':
      return `<path d="M${CX - 26},134 L${CX},190 L${CX + 26},134 L${CX + 14},128 L${CX},152 L${CX - 14},128 Z" fill="none" stroke="${item.color2}" stroke-width="2" opacity=".35"/>`;
    case 'cami':
      return `<path d="M${CX - b.sh - e},140 L${CX},186 L${CX + b.sh + e},140 L${CX + b.sh + e},130 L${CX},168 L${CX - b.sh - e},130 Z" fill="${b.skin}"/>
              <path d="M${CX - 26},128 L${CX - 16},172 M${CX + 26},128 L${CX + 16},172" stroke="${c}" stroke-width="7" stroke-linecap="round" fill="none"/>`;
    default:
      return '';
  }
}

function sleeve(b, side, item, uid, t, extra) {
  const A = armLine(b, side, t);
  const wdt = b.sh * 0.5 + 8 + (extra || 0);
  return `<path d="${A.d}" stroke="url(#${uid}c)" stroke-width="${wdt}" stroke-linecap="round" fill="none"/>
          <path d="${A.d}" stroke="${item.color2}" stroke-width="${wdt}" stroke-linecap="round" fill="none" opacity=".18"/>`;
}

/* ------------------------------ 上装 ------------------------------ */
function topGarment(b, item, uid) {
  const lenMap = { knit: 330, shirt: 334, tee: 326, turtleneck: 322, cardigan: 340, cami: 316 };
  const len = lenMap[item.type] || 326;
  const long = { knit: 1, shirt: 1, tee: 0.5, turtleneck: 0.98, cardigan: 1, cami: 0 };
  const t = long[item.type] ?? 0.98;
  const parts = [];
  if (item.type === 'cami') {
    parts.push(`<path d="${torsoPath(b, 5, len)}" fill="url(#${uid}c)"/>`);
    parts.push(neckline(b, item, uid, len));
  } else if (item.type === 'cardigan') {
    parts.push(sleeve(b, -1, item, uid, t), sleeve(b, 1, item, uid, t));
    parts.push(`<path d="${panelPath(b, -1, 6, len, 20)}" fill="url(#${uid}c)"/>`);
    parts.push(`<path d="${panelPath(b, 1, 6, len, 20)}" fill="url(#${uid}c)"/>`);
    parts.push(`<path d="M${CX - 20},140 L${CX - 20},${len - 8} M${CX + 20},140 L${CX + 20},${len - 8}" stroke="${item.color2}" stroke-width="2.4" opacity=".6" fill="none"/>`);
    [0, 1, 2].forEach(i => parts.push(`<circle cx="${CX - 20}" cy="${212 + i * 42}" r="4" fill="${item.color2}" opacity=".8"/>`));
  } else {
    parts.push(sleeve(b, -1, item, uid, t), sleeve(b, 1, item, uid, t));
    parts.push(`<path d="${torsoPath(b, 6, len)}" fill="url(#${uid}c)"/>`);
    parts.push(neckline(b, item, uid, len));
  }
  // 面料肌理
  if (item.type === 'knit' || item.type === 'turtleneck') {
    for (let y = 174; y < len - 12; y += 13) {
      parts.push(`<path d="M${CX - b.w - 8},${y} q${b.w + 8},5 ${(b.w + 8) * 2},0" stroke="${item.color2}" stroke-width="1" fill="none" opacity=".15"/>`);
    }
  }
  if (item.type === 'shirt' || item.type === 'shirtdress') {
    parts.push(`<line x1="${CX}" y1="166" x2="${CX}" y2="${len - 6}" stroke="${item.color2}" stroke-width="2" opacity=".5"/>`);
  }
  return parts.join('');
}

/* ------------------------------ 下装 ------------------------------ */
function bottomGarment(b, item, uid) {
  const parts = [`<path d="${torsoPath(b, 4, 344)}" fill="url(#${uid}c)"/>`];
  const skirt = {
    askirt: { hem: 468, flare: 40 },
    pleat:  { hem: 452, flare: 30 },
    dskirt: { hem: 424, flare: 24 },
  }[item.type];
  const waist = b.w + 8;
  if (skirt) {
    const hw = waist + skirt.flare;
    parts.push(`<path d="M${CX - waist},250 L${CX + waist},250 L${CX + hw},${skirt.hem} Q${CX},${skirt.hem + 16} ${CX - hw},${skirt.hem} Z" fill="url(#${uid}c)"/>`);
    const folds = item.type === 'pleat' ? 9 : 5;
    for (let i = 1; i < folds; i++) {
      const x = CX - waist + (waist * 2 / folds) * i;
      const hx = CX - hw + (hw * 2 / folds) * i;
      parts.push(`<line x1="${x}" y1="254" x2="${hx}" y2="${skirt.hem - 4}" stroke="${item.color2}" stroke-width="1.2" opacity=".35"/>`);
    }
    return parts.join('');
  }
  parts.push(`<path d="M${CX - waist},252 L${CX + waist},252 L${CX + waist + 2},346 L${CX - waist - 2},346 Z" fill="url(#${uid}c)"/>`);
  const wide = item.type === 'wide';
  [-1, 1].forEach(side => {
    const L = legLines(b, side);
    const tw = b.h * (wide ? 1.05 : 0.9) + 8;
    const cw = b.h * (wide ? 1.0 : 0.66) + 8;
    parts.push(`<path d="${L.thigh}" stroke="url(#${uid}c)" stroke-width="${tw}" fill="none"/>`);
    parts.push(`<path d="${L.calf}" stroke="url(#${uid}c)" stroke-width="${cw}" fill="none" stroke-linecap="butt"/>`);
    parts.push(`<line x1="${L.ankle[0] - cw / 2}" y1="${560}" x2="${L.ankle[0] + cw / 2}" y2="${560}" stroke="${item.color2}" stroke-width="2" opacity=".5"/>`);
  });
  parts.push(`<line x1="${CX}" y1="256" x2="${CX}" y2="346" stroke="${item.color2}" stroke-width="1.6" opacity=".45"/>`);
  if (item.type === 'jeans' || item.type === 'dskirt') {
    parts.push(`<path d="M${CX - 22},262 q22,10 44,0" stroke="${item.color2}" stroke-width="1.6" fill="none" opacity=".5" stroke-dasharray="4 3"/>`);
  }
  return parts.join('');
}

/* ------------------------------ 连衣裙 ------------------------------ */
function dressGarment(b, item, uid) {
  const spec = {
    shirtdress: { len: 330, hem: 486 },
    slipdress:  { len: 316, hem: 506 },
    knitdress:  { len: 330, hem: 442 },
  }[item.type];
  const parts = [];
  if (item.type === 'slipdress') {
    parts.push(`<path d="${torsoPath(b, 5, spec.len)}" fill="url(#${uid}c)"/>`);
  } else {
    const t = item.type === 'shirtdress' ? 1 : 0.98;
    parts.push(sleeve(b, -1, item, uid, t), sleeve(b, 1, item, uid, t));
    parts.push(`<path d="${torsoPath(b, 6, spec.len)}" fill="url(#${uid}c)"/>`);
  }
  const hw = b.h + 26;
  parts.push(`<path d="M${CX - b.h - 8},${spec.len - 16} L${CX + b.h + 8},${spec.len - 16} L${CX + hw},${spec.hem} Q${CX},${spec.hem + 18} ${CX - hw},${spec.hem} Z" fill="url(#${uid}c)"/>`);
  parts.push(`<line x1="${CX - b.h - 8}" y1="${spec.len - 12}" x2="${CX + b.h + 8}" y2="${spec.len - 12}" stroke="${item.color2}" stroke-width="2" opacity=".45"/>`);
  for (let i = 1; i < 5; i++) {
    const x = CX - hw + (hw * 2 / 5) * i;
    parts.push(`<line x1="${CX - b.h + (b.h * 2 / 5) * i}" y1="${spec.len - 6}" x2="${x}" y2="${spec.hem - 6}" stroke="${item.color2}" stroke-width="1.1" opacity=".3"/>`);
  }
  parts.push(neckline(b, item.type === 'slipdress' ? { ...item, type: 'cami' } : item, uid, spec.hem));
  if (item.type === 'knitdress') {
    for (let y = 172; y < spec.len; y += 13) {
      parts.push(`<path d="M${CX - b.w - 8},${y} q${b.w + 8},5 ${(b.w + 8) * 2},0" stroke="${item.color2}" stroke-width="1" fill="none" opacity=".14"/>`);
    }
  }
  return parts.join('');
}

/* ------------------------------ 外套 ------------------------------ */
function outerGarment(b, item, uid) {
  const spec = {
    trench: { len: 428, center: 26, belt: true },
    blazer: { len: 352, center: 22, belt: false },
    coat:   { len: 476, center: 28, belt: false },
  }[item.type];
  const parts = [sleeve(b, -1, item, uid, 1, 8), sleeve(b, 1, item, uid, 1, 8)];
  parts.push(`<path d="${panelPath(b, -1, 10, spec.len, spec.center)}" fill="url(#${uid}c)"/>`);
  parts.push(`<path d="${panelPath(b, 1, 10, spec.len, spec.center)}" fill="url(#${uid}c)"/>`);
  // 翻领
  parts.push(`<path d="M${CX - 44},132 L${CX - spec.center},196 L${CX - spec.center - 12},136 Z" fill="${item.color2}" opacity=".92"/>`);
  parts.push(`<path d="M${CX + 44},132 L${CX + spec.center},196 L${CX + spec.center + 12},136 Z" fill="${item.color2}" opacity=".92"/>`);
  if (spec.belt) {
    parts.push(`<rect x="${CX - b.w - 16}" y="272" width="${(b.w + 16) * 2}" height="20" rx="6" fill="${item.color2}" opacity=".9"/>`);
    parts.push(`<rect x="${CX - 12}" y="270" width="24" height="24" rx="5" fill="#8C7A5E"/>`);
  }
  [0, 1].forEach(i => parts.push(`<circle cx="${CX - spec.center - 6}" cy="${230 + i * 46}" r="3.6" fill="${item.color2}" opacity=".75"/>`));
  return parts.join('');
}

/* ------------------------------ 合成 ------------------------------ */
let __uid = 0;

function figureSVG(opt) {
  const b = typeof opt.body === 'string' ? bodyById(opt.body) : opt.body;
  const items = (opt.items || []).map(i => (typeof i === 'string' ? byId(i) : i)).filter(Boolean);
  const uid = 'u' + (++__uid) + '_';
  const top = items.find(i => i.cat === 'top');
  const bottom = items.find(i => i.cat === 'bottom');
  const dress = items.find(i => i.cat === 'dress');
  const outer = items.find(i => i.cat === 'outer');
  const parts = [];
  parts.push(`<ellipse cx="${CX}" cy="588" rx="74" ry="11" fill="#1B1A17" opacity=".05"/>`);
  parts.push(`<defs>
    <clipPath id="${uid}body"><path d="${torsoPath(b, 2, 330)}"/></clipPath>
    <clipPath id="${uid}shade"><path d="${torsoPath(b, 7, 356)}"/></clipPath>
    <linearGradient id="${uid}sg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity=".10"/>
      <stop offset=".30" stop-color="#000" stop-opacity="0"/>
      <stop offset=".72" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".16"/>
    </linearGradient>
  </defs>`);
  parts.push(bodyBase(b));
  parts.push(innerLayer(b, uid, dress ? '#EFEBE3' : '#EAE3D7'));
  if (bottom) parts.push(`<defs>${grad(uid + 'c', bottom.color, bottom.color2)}</defs>` + bottomGarment(b, bottom, uid));
  if (dress) parts.push(`<defs>${grad(uid + 'c', dress.color, dress.color2)}</defs>` + dressGarment(b, dress, uid));
  else if (top) parts.push(`<defs>${grad(uid + 'c', top.color, top.color2)}</defs>` + topGarment(b, top, uid));
  if (outer) parts.push(`<defs>${grad(uid + 'c', outer.color, outer.color2)}</defs>` + outerGarment(b, outer, uid));
  if (bottom || top || dress || outer) {
    parts.push(`<g clip-path="url(#${uid}shade)"><rect x="44" y="150" width="232" height="440" fill="url(#${uid}sg)"/></g>`);
  }
  const vb = opt.viewBox || '52 22 216 588';
  const cls = opt.className || '';
  return `<svg class="fig ${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}

function grad(id, c1, c2) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0.32" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
}

/* 商品缩略图：只展示该单品 */
function thumbSVG(item, bodyId = 'a3') {
  const vb = {
    top: '70 26 180 344',
    bottom: '62 232 196 356',
    dress: '58 24 204 496',
    outer: '54 22 212 470',
  }[item.cat];
  return figureSVG({ body: bodyId, items: [item], viewBox: vb, className: 'thumb' });
}

/* 生成"静态搭配图"（兜底方案） */
function flatLay(items) {
  return `<div class="flatlay">${items.map(i => `<div class="fl-item"><div class="fl-img">${thumbSVG(i)}</div>
    <div class="fl-meta"><b>${i.name}</b><span>${i.tone} · ¥${i.price}</span></div></div>`).join('')}</div>`;
}

window.MUYE = { BODIES, ITEMS, byId, bodyById, figureSVG, thumbSVG, flatLay };
