/* =========================================================================
   试穿渲染：真人模特 + 真实服装
   每件商品都有一张"穿在身上"的实拍图（worn），所以上身效果是真的穿着，
   而不是把挂拍图贴到人身上。尺寸/灯光/姿势统一，做成门店标准数字模特。
   尺码建议按用户选择的身形单独计算。
   ========================================================================= */

const A = 'assets/';

/* 身形：用于"选一个和你接近的身形"与尺码建议 */
const BODIES = [
  { id:'m1', name:'Sora', gender:'f', height:165, shape:'匀称', note:'165cm · 匀称', tip:'最常见身形', img:A+'process/models__m1.jpg' },
  { id:'m2', name:'Mio',  gender:'f', height:158, shape:'娇小', note:'158cm · 娇小', tip:'看衣长是否偏长', img:A+'process/models__m2.jpg' },
  { id:'m3', name:'Aya',  gender:'f', height:168, shape:'运动', note:'168cm · 运动型', tip:'肩背偏厚', img:A+'process/models__m3.jpg' },
  { id:'m4', name:'Rin',  gender:'f', height:162, shape:'丰满', note:'162cm · 丰满', tip:'看版型包容性', img:A+'process/models__m4.jpg' },
  { id:'m5', name:'Kai',  gender:'m', height:176, shape:'匀称', note:'176cm · 匀称', tip:'男装参考', img:A+'process/models__m5.jpg' },
  { id:'m6', name:'Jun',  gender:'m', height:172, shape:'偏瘦', note:'172cm · 偏瘦', tip:'偏瘦身形', img:A+'process/models__m6.jpg' },
];

/* 在售货品：每件都有一张真人穿着照 */
const ITEMS = [
  { id:'w1', cat:'top', worn:A+'process/worn__w1.jpg', cut:A+'process/garments__g1.png', name:'燕麦羊毛开衫',  tone:'燕麦',   price:399,  stock:'本店 12 件', tag:'门店热卖', color:'#DCCFBA' },
  { id:'w2', cat:'top', worn:A+'process/worn__w2.jpg', cut:A+'process/garments__g2.png', name:'真丝垂感衬衫',  tone:'月光白', price:599,  stock:'本店 6 件',  tag:'新品',     color:'#F1EEE6' },
  { id:'w3', cat:'top', worn:A+'process/worn__w3.jpg', cut:A+'process/garments__g3.png', name:'重磅纯棉 T 恤', tone:'石墨黑', price:199,  stock:'本店 30 件', tag:'基础款',   color:'#3B3B3E' },
  { id:'w7', cat:'bottom', worn:A+'process/worn__w7.jpg', cut:A+'process/garments__g8.png', name:'高腰阔腿长裤',  tone:'米色',   price:529,  stock:'本店 11 件', tag:'垂感',     color:'#D9CDB8' },
  { id:'w5', cat:'dress', worn:A+'process/worn__w5.jpg', cut:A+'process/garments__g5.png', name:'雾霾蓝衬衫裙',  tone:'雾霾蓝', price:699,  stock:'本店 5 件',  tag:'新品',     color:'#8FA3B4' },
  { id:'w4', cat:'outer', worn:A+'process/worn__w4.jpg', cut:A+'process/garments__g4.png', name:'卡其长款风衣',  tone:'卡其',   price:1299, stock:'本店 4 件',  tag:'经典',     color:'#BE9F73',
    frames:[A+'process/worn__w4.jpg', A+'process/worn__w4_a45.jpg', A+'process/worn__w4_side.jpg', A+'process/worn__w4_back.jpg'] },
  { id:'w6', cat:'outer', worn:A+'process/worn__w6.jpg', cut:A+'process/garments__g6.png', name:'炭灰西装外套',  tone:'炭灰',   price:899,  stock:'本店 6 件',  tag:'通勤',     color:'#585860' },
];

const byId = id => ITEMS.find(i => i.id === id);
const bodyById = id => BODIES.find(b => b.id === id);
/* 男装：同样这几件的中性款，用男模特的真人穿着照（连衣裙只做女装） */
const MALE_WORN = {
  w1: A+'process/worn__male_m1.jpg',
  w2: A+'process/worn__male_m2.jpg',
  w3: A+'process/worn__male_m3.jpg',
  w7: A+'process/worn__male_m7.jpg',
  w4: A+'process/worn__male_m4.jpg',
  w6: A+'process/worn__male_m6.jpg',
};
const isMale = b => !!b && b.gender === 'm';
/* 按当前形象取这件衣服的人像：男装形象给男模特照片，女装形象给女模特照片 */
function wornFor(item, b) {
  if (isMale(b) && MALE_WORN[item.id]) return MALE_WORN[item.id];
  return item.worn;
}
/* 每件衣服的 4 个角度帧（正面 / 45° / 侧面 / 背面），男女装各自一套 */
function framesFor(item, b) {
  const male = isMale(b) && MALE_WORN[item.id];
  const key = male ? ('male_m' + item.id.slice(1)) : item.id;
  const f = s => `${A}process/worn__${key}${s}.jpg`;
  return [f(''), f('_a45'), f('_side'), f('_back')];
}
/* 男装形象下不展示连衣裙 */
function availableFor(b) {
  return isMale(b) ? ITEMS.filter(i => i.cat !== 'dress') : ITEMS;
}

/* 试穿结果：直接呈现真人穿着照 */
function figureSVG(opt) {
  const b = typeof opt.body === 'string' ? bodyById(opt.body) : opt.body;
  const items = (opt.items || []).map(i => (typeof i === 'string' ? byId(i) : i)).filter(Boolean);
  const src = items[0] ? wornFor(items[0], b) : (b ? b.img : BODIES[0].img);
  return `<div class="tryon ${opt.className || ''}"><img class="base" src="${src}" alt=""></div>`;
}

/* 商品卡：展示"穿在身上"的样子 */
function thumbSVG(item, b) {
  return `<div class="gthumb"><img src="${wornFor(item, b)}" alt=""></div>`;
}

/* 平铺搭配（静态兜底方案） */
function flatLay(items) {
  return `<div class="flatlay">${items.map(i => `<div class="fl-item">
    <div class="fl-img"><img src="${i.worn}" alt=""></div>
    <div class="fl-meta"><b>${i.name}</b><span>${i.tone} · ¥${i.price}</span></div></div>`).join('')}</div>`;
}

/* 推荐搭配（原型用规则表；生产环境可用销量/点击共现来算） */
const PAIR = {
  w1:{ p:'w7', why:'上装搭米色阔腿裤，同色系最不容易出错' },
  w2:{ p:'w7', why:'真丝衬衫配阔腿裤，通勤和周末都能穿' },
  w3:{ p:'w7', why:'基础黑T加阔腿裤，最简单的显腿长组合' },
  w6:{ p:'w7', why:'西装外套配阔腿裤，一套能直接上班' },
  w7:{ p:'w2', why:'阔腿裤配真丝衬衫，比 T 恤更抬气质' },
  w4:{ p:'w7', why:'风衣 + 阔腿裤是这一季最稳的通勤组合' },
  w5:{ p:'w4', why:'衬衫裙外搭长风衣，秋天正好' },
};
function pairOf(id) { const r = PAIR[id]; return r ? { item: byId(r.p), why: r.why } : null; }

window.MUYE = { BODIES, ITEMS, PAIR, pairOf, byId, bodyById, figureSVG, thumbSVG, flatLay,
  MALE_WORN, wornFor, framesFor, availableFor, isMale };



