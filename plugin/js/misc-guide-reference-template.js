// Adapted from the supplied horizontal reference project (templates.js).
window.AKEGuideTemplate = (() => {
const { drawText, setFont, panel, drawBarChart, drawDonut, legendRow, drawImage, fillRR, strokeRR, rr, glowRR, textW, pageBG, placeholder, DONUT_COLORS } = window.AKEGuideReference;
/* ============================================================
 * templates.js — 预设模板定义（模块化：每个模块位置可拖拽调整）
 * 模板结构：{ id, name, desc, width, height, modules, schema, defaults, draw }
 *   modules: [{ id, label, rect:{x,y,w,h}, min:{w,h}? }]  ← 默认位置，可被 fields.layout 覆盖
 * ============================================================ */
'use strict';

/* ---------- 工具 ---------- */
function parseList(str, def) {
  if (str == null || String(str).trim() === '') return def;
  return String(str).split(/[,，]/).map(s => s.trim()).filter(Boolean);
}

/* 读取模块实际矩形：默认 rect 与用户 layout 覆盖合并 */
function moduleRect(f, mod) {
  const lay = (f.layout || {})[mod.id] || {};
  return {
    x: lay.x != null ? lay.x : mod.rect.x,
    y: lay.y != null ? lay.y : mod.rect.y,
    w: lay.w != null ? lay.w : mod.rect.w,
    h: lay.h != null ? lay.h : mod.rect.h,
  };
}

/* ---------- 通用：技能面板 ----------
   布局：技能图标 + RANK 等级 + 技能名称 整体在面板内垂直居中；
   名称文字顶与 RANK 底部固定间隔 nameRankGap(默认15px)。 */
function drawSkillSlots(ctx, x, y, w, h, skills, assets, opts = {}) {
  const {
    iconSize = 104, rankStyle = 'chip',
    rankGap = 16,      // 图标底 与 RANK 顶 的间隔
    nameRankGap = 15,  // RANK 底 与 名称文字顶 的固定间隔
  } = opts;
  const n = Math.max(1, skills.length);
  const slotW = w / n;
  const rankH = 24;
  const nameSize = Math.max(18, Math.round(iconSize / 4.3)); // 名称字号（104→24）
  // 名称字形高度：用 measureText 实测（不同字体度量不同，实测保证 15px 间隔精确）
  setFont(ctx, nameSize, 700);
  let ascent = nameSize * 0.85;
  try {
    const m0 = ctx.measureText('国');
    if (m0.actualBoundingBoxAscent) ascent = m0.actualBoundingBoxAscent;
  } catch (e) { /* 兼容旧浏览器 */ }
  const nameH = Math.round(ascent);   // 名称文字块高（用于居中）
  // 整体垂直居中；名称顶 = RANK底 + nameRankGap(15px)
  const groupH = iconSize + rankGap + rankH + nameRankGap + nameH;
  const top = y + Math.max(0, (h - groupH) / 2);
  const iy = top;                              // 图标顶
  const ry = top + iconSize + rankGap;         // RANK 顶
  const nameY = ry + rankH + nameRankGap + ascent; // 名称基准线
  skills.forEach((sk, i) => {
    const cx = x + slotW * i + slotW / 2;
    const ix = cx - iconSize / 2;
    const iconKey = 'skills.' + i + '.icon';
    if (assets[iconKey]) {
      glowRR(ctx, ix - 4, iy - 4, iconSize + 8, iconSize + 8, (iconSize + 8) / 2,
        '#262626', 'rgba(255,255,255,0.30)', 'rgba(255,178,40,0.30)', 12, 2);
      fillRR(ctx, ix, iy, iconSize, iconSize, iconSize / 2, '#2A2A2A');
      drawImage(ctx, assets[iconKey], ix + 6, iy + 6, iconSize - 12, iconSize - 12, 'cover', (iconSize - 12) / 2);
      strokeRR(ctx, ix, iy, iconSize, iconSize, iconSize / 2, 'rgba(255,255,255,0.22)', 2);
    } else if (assets.blank) {
      // 未上传技能图标：填充空白占位图
      glowRR(ctx, ix - 4, iy - 4, iconSize + 8, iconSize + 8, (iconSize + 8) / 2,
        '#262626', 'rgba(255,255,255,0.22)', 'rgba(255,178,40,0.18)', 10, 2);
      fillRR(ctx, ix, iy, iconSize, iconSize, iconSize / 2, '#2A2A2A');
      drawImage(ctx, assets.blank, ix + 6, iy + 6, iconSize - 12, iconSize - 12, 'cover', (iconSize - 12) / 2);
      strokeRR(ctx, ix, iy, iconSize, iconSize, iconSize / 2, 'rgba(255,255,255,0.22)', 2);
    } else {
      glowRR(ctx, ix - 4, iy - 4, iconSize + 8, iconSize + 8, (iconSize + 8) / 2,
        '#2A2A2A', 'rgba(255,255,255,0.22)', 'rgba(255,178,40,0.18)', 10, 2);
      drawText(ctx, sk.name || `技能${i + 1}`, cx, iy + iconSize / 2, {
        size: Math.max(14, iconSize / 7), weight: 700, color: '#8A8A8A', align: 'center', baseline: 'middle'
      });
    }
    // 等级行：按 "/" 拆分为多段（如 "9/专3"、"专1/专3"、"9"）
    // 纯数字段 → "RANK N" 文字胶囊；专精段 → 专精 icon 胶囊（无文字）；其他原文胶囊
    const rkRaw = sk.rank != null ? String(sk.rank).trim() : '';
    const segs = rkRaw.split('/').map(s => s.trim()).filter(Boolean);
    if (segs.length && rankStyle === 'chip' && ry + rankH <= y + h) {
      const units = segs.map(s => {
        const m = s.match(/^专(?:精)?\s*([1-3])$/);
        if (m) {
          return { kind: 'spec', n: m[1],
            img: assets.specs?.[m[1]] || null };
        }
        return { kind: 'txt', txt: /^\d+$/.test(s) ? 'RANK ' + s : s };
      });
      const iconS = 17;          // 专精图标尺寸 = 文字字号
      // 测量各段宽；超宽时压缩内边距
      const measure = (padX) => units.map(u => u.kind === 'spec'
        ? iconS + padX * 2
        : Math.ceil(textW(ctx, u.txt, 17, 700)) + padX * 2);
      const maxW = Math.max(40, slotW - 12);
      let padX = 10, gap = 6;
      let widths = measure(padX);
      let totalW = widths.reduce((a, b) => a + b, 0) + gap * (units.length - 1);
      if (totalW > maxW) {
        padX = 6; gap = 4;
        widths = measure(padX);
        totalW = widths.reduce((a, b) => a + b, 0) + gap * (units.length - 1);
      }
      let ux = cx - totalW / 2;
      units.forEach((u, ui) => {
        const w = widths[ui];
        fillRR(ctx, ux, ry, w, rankH, rankH / 2, 'rgba(0,0,0,0.5)');
        strokeRR(ctx, ux, ry, w, rankH, rankH / 2, 'rgba(255,178,40,0.6)', 1.5);
        if (u.kind === 'spec' && u.img) {
          drawImage(ctx, u.img, ux + (w - iconS) / 2, ry + (rankH - iconS) / 2, iconS, iconS, 'contain');
        } else {
          const txt = u.kind === 'spec' ? '专' + u.n : u.txt;
          drawText(ctx, txt, ux + w / 2, ry + rankH / 2, {
            size: 17, weight: 700, color: '#FFC000', align: 'center', baseline: 'middle'
          });
        }
        ux += w + gap;
      });
    }
    drawText(ctx, sk.name || '', cx, nameY, {
      size: nameSize, weight: 700, color: '#F0F0F0', align: 'center', baseline: 'alphabetic',
      shadow: 'rgba(0,0,0,0.7)', shadowBlur: 3
    });
  });
}


/* ---------- 通用：装备卡片 ---------- */
/* ---------- 通用：装备/武器卡片（装备建议与武器建议共用同一样式） ---------- */
function drawEquipCard(ctx, cx, cy, item, assets, idx, opts = {}) {
  const { frameSize = 104, statChips = 3, keyPrefix = 'equipments' } = opts;
  const fx = cx - frameSize / 2, fy = cy;
  const iconKey = keyPrefix + '.' + idx + '.icon';
  if (assets[iconKey]) {
    glowRR(ctx, fx, fy, frameSize, frameSize, 10, '#262626', 'rgba(255,255,255,0.26)', 'rgba(255,178,40,0.24)', 12, 2);
    drawImage(ctx, assets[iconKey], fx + 4, fy + 4, frameSize - 8, frameSize - 10, 'cover', 7);
  } else if (assets.blank) {
    // 未上传图标：填充空白占位图
    glowRR(ctx, fx, fy, frameSize, frameSize, 10, '#262626', 'rgba(255,255,255,0.20)', 'rgba(255,178,40,0.18)', 10, 2);
    drawImage(ctx, assets.blank, fx + 4, fy + 4, frameSize - 8, frameSize - 10, 'cover', 7);
  } else {
    glowRR(ctx, fx, fy, frameSize, frameSize, 10, '#262626', 'rgba(255,255,255,0.20)', 'rgba(255,178,40,0.18)', 10, 2);
    placeholder(ctx, fx + 8, fy + 8, frameSize - 16, frameSize - 16, '图标', 7);
  }
  // 星级色条：图标圆角矩形底部 5px 高的色块（6星#ff7100 / 5星#ffcc00 / 4星#b380ff / 3星#34C2FF）
  const sc = STAR_COLORS[Number(item.stars) || 0];
  if (sc) {
    ctx.save();
    rr(ctx, fx, fy, frameSize, frameSize, 10);
    ctx.clip();
    ctx.fillStyle = sc;
    ctx.fillRect(fx, fy + frameSize - 5, frameSize, 5);
    // 色条上沿一条高光细线
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(fx, fy + frameSize - 5, frameSize, 1);
    ctx.restore();
  }
  if (assets[keyPrefix + '.' + idx + '.element']) {
    drawImage(ctx, assets[keyPrefix + '.' + idx + '.element'], fx + frameSize - 40, fy + 5, 35, 35, 'contain');
  }
  drawText(ctx, item.name || '', cx, fy + frameSize - 10, {
    size: 19, weight: 700, color: '#FFFFFF', align: 'center', baseline: 'alphabetic',
    shadow: 'rgba(0,0,0,0.9)', shadowBlur: 4
  });
  const stats = parseList(item.stats, []);
  const ch = 24, gap = 5;
  const cw = Math.min(frameSize + 22, 122);
  const startY = fy + frameSize + 12;
  const shown = stats.slice(0, statChips);
  shown.forEach((s, i) => {
    const cyy = startY + i * (ch + gap);
    fillRR(ctx, cx - cw / 2, cyy, cw, ch, ch / 2, '#3A3A3A');
    strokeRR(ctx, cx - cw / 2, cyy, cw, ch, ch / 2, 'rgba(255,255,255,0.12)', 1);
    drawText(ctx, s, cx, cyy + ch / 2, {
      size: 17, weight: 600, color: '#E8E8E8', align: 'center', baseline: 'middle'
    });
  });
}

/* ---------- 通用：饼图面板（rect 相对；饼图+图例组合整体居中、互不重叠） ---------- */
function drawDonutPanel(ctx, r, segments, opts = {}) {
  const { title, donutR = 86, legendXOff = 244 } = opts;
  panel(ctx, r.x, r.y, r.w, r.h, { header: true, headerH: 56, title, r: 10 });
  const bodyTop = r.y + 56;
  const bodyH = r.h - 56;
  // 组合居中：饼图 + 间隙 + 图例；两侧各留 26px
  const gap = 28;
  const lw = Math.min(Math.max(150, r.w - 52 - donutR * 2 - gap), 300);
  const groupW = donutR * 2 + gap + lw;
  const left = Math.max(16, (r.w - groupW) / 2);
  const cx = r.x + left + donutR;
  const cy = bodyTop + bodyH / 2;
  const lx = cx + donutR + gap;
  // 实心扇形饼图（无镂空、无中心合计文字、扇区间无间距）
  drawDonut(ctx, cx, cy, donutR, segments, { solid: true, gap: 0 });
  const rows = segments.slice(0, 5);
  const rowH = Math.min(40, Math.max(24, (bodyH - 14) / rows.length));
  const small = rowH <= 28;
  const startY = cy - (rows.length * rowH) / 2 + rowH / 2;
  rows.forEach((seg, i) => {
    const col = seg.color && seg.color !== 'auto' ? seg.color : DONUT_COLORS[i % DONUT_COLORS.length];
    legendRow(ctx, lx, startY + i * rowH, col, seg.label || '', (Number(seg.value) || 0).toFixed(2) + '%', {
      box: small ? 22 : 28, boxH: small ? 11 : 14, size: small ? 16 : 19,
      valueSize: small ? 17 : 20, gap: small ? 7 : 9,
      labelColor: '#D0D0D0', valueColor: '#FFFFFF', lw
    });
  });
}

/* ============================================================
 * 模板 A：标准攻略图 · 立绘居左（庄方宜/伊冯型）
 * ============================================================ */

/* --- A 型模块绘制函数（全部相对 rect 定位） --- */

/* 职业/属性名称映射（与表单选项一致） */
const PROF_NAMES = { 0: '近卫', 2: '重装', 4: '辅助', 5: '术师', 7: '先锋', 8: '突击' };
const ELEM_NAMES = { Pulse: '电磁', Fire: '灼热', Cold: '寒冷', Natural: '自然', Physical: '物理' };

/* 星级色（干员名模块底部条 / 装备 / 武器通用） */
const STAR_COLORS = { 6: '#FF7100', 5: '#FFCC00', 4: '#B380FF', 3: '#34C2FF' };

/* 方形小徽标（左上角职业/属性标） */
function drawSquareBadge(ctx, x, y, size, img, label) {
  const r = 5;
  fillRR(ctx, x, y, size, size, r, '#3A3A3A');
  strokeRR(ctx, x, y, size, size, r, 'rgba(255,255,255,0.75)', 1.5);
  if (img) {
    ctx.save();
    rr(ctx, x, y, size, size, r);
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
  } else if (label) {
    drawText(ctx, label, x + size / 2, y + size / 2, {
      size: Math.max(10, size / 3), weight: 700, color: '#FFFFFF', align: 'center', baseline: 'middle'
    });
  }
}

/* 干员名模块：白底卡片 + 竖版头像 + 职业/属性方形图标 + 名字 + 底部星级色条
   图层顺序（自下而上）：卡片白底 → 头像（裁切在卡内）→ 底部50px白底 → 徽标/名字 → 星级色条 */
function drawModulePortraitA(ctx, f, assets, r) {
  const mw = 250, mh = 340;
  const mx = r.x + (r.w - mw) / 2, my = r.y;
  // 1) 卡片底色 #D9D9D9 + 灰边框（最底层）
  fillRR(ctx, mx, my, mw, mh, 6, '#D9D9D9');
  strokeRR(ctx, mx, my, mw, mh, 6, '#C2C2C2', 1.5);
  // 2) 竖版头像：铺满整卡并裁切在卡片内（cover 会溢出，必须 clip）
  ctx.save();
  rr(ctx, mx, my, mw, mh, 6);
  ctx.clip();
  if (assets.vicon) {
    drawImage(ctx, assets.vicon, mx, my, mw, mh, 'cover');
  } else if (assets.portrait) {
    drawImage(ctx, assets.portrait, mx, my, mw, mh, 'cover');
  } else {
    fillRR(ctx, mx, my, mw, mh, 0, '#E9EBEE');
    drawText(ctx, '上传竖版头像', mx + mw / 2, my + mh / 2 - 20, {
      size: 20, weight: 600, color: '#9AA0A8', align: 'center', baseline: 'middle'
    });
  }
  ctx.restore();
  // 3) 底部 50px 白底（盖住头像底部）
  fillRR(ctx, mx, my + mh - 50, mw, 50, 0, '#FFFFFF');
  // 4) 左上角：职业图标 + 属性图标（正方形）
  const profImg = assets.profIcon;
  const elemImg = assets.elemIcon;
  drawSquareBadge(ctx, mx + 6, my + 4, 34, profImg, PROF_NAMES[f.profession] || '');
  drawSquareBadge(ctx, mx + 6, my + 44, 34, elemImg, ELEM_NAMES[f.element] || '');
  // 5) 名字（深色，位于底部白底区）
  drawText(ctx, f.characterName || '', mx + 14, my + 310, {
    size: 32, weight: 700, color: '#1A1A1A', baseline: 'middle',
    shadow: 'rgba(0,0,0,0.15)', shadowBlur: 2
  });
  // 6) 底部星级色条（最上层，5px，颜色按星级：6星橙/5星金/4星紫/3星蓝）
  const rc = STAR_COLORS[Number(f.rarity) || 0];
  if (rc) {
    ctx.fillStyle = rc;
    ctx.fillRect(mx, my + mh - 5, mw, 5);
  }
}

function drawModuleSkillsA(ctx, f, assets, r) {
  panel(ctx, r.x, r.y, r.w, r.h, { header: true, headerH: 54, title: f.skillsTitle || '技能加点', r: 10 });
  drawSkillSlots(ctx, r.x, r.y + 54, r.w, r.h - 54, f.skills, assets, { iconSize: 104 });
}

function drawModulePotentialA(ctx, f, assets, r) {
  panel(ctx, r.x, r.y, r.w, r.h, { header: true, headerH: 54, title: '潜能收益', r: 10 });
  const potLabels = parseList(f.potLabels, []);
  const potValues = parseList(f.potValues, []).map(Number);
  const plen = Math.min(potLabels.length, potValues.length);
  drawBarChart(ctx, r.x + 46, r.y + 72, r.w - 92, r.h - 156,
    potLabels.slice(0, plen), potValues.slice(0, plen));
  drawText(ctx, '·注意事项', r.x + 52, r.y + r.h - 18, { size: 22, weight: 700, color: '#FFC000', baseline: 'alphabetic' });
  drawText(ctx, f.potNote || '', r.x + 52 + textW(ctx, '·注意事项', 22, 700) + 18, r.y + r.h - 18, {
    size: 22, weight: 500, color: '#E0E0E0', baseline: 'alphabetic'
  });
}

function drawModuleWeaponsA(ctx, f, assets, r) {
  panel(ctx, r.x, r.y, r.w, r.h, { header: true, headerH: 50, title: '武器建议', r: 10 });
  const cards = (f.weapons || []).slice(0, 4);
  // 两列卡片（含属性条）水平间距固定 20px，整体在面板内居中
  const frameW = 106, chipW = 122;   // drawEquipCard 默认帧宽/属性条宽
  const gap = 20;                    // 卡片间水平间距
  const colGap = chipW + gap;        // 列中心距
  const pairW = chipW * 2 + gap;     // 两卡总宽
  const left = r.x + (r.w - pairW) / 2;
  const colX = [left + chipW / 2, left + chipW / 2 + colGap];
  const rowY = [r.y + 68, r.y + 278];
  cards.forEach((item, i) => {
    drawEquipCard(ctx, colX[i % 2], rowY[Math.floor(i / 2)], item, assets, i, {
      frameSize: frameW, statChips: 3, keyPrefix: 'weapons'
    });
  });
}

function drawModuleEquipsA(ctx, f, assets, r) {
  panel(ctx, r.x, r.y, r.w, r.h, { header: true, headerH: 50, title: '装备建议', r: 10 });
  const cards = (f.equipments || []).slice(0, 8);
  // 4 列以面板中心对称分布（列间距 = 面板宽/4）
  const colX = [
    r.x + r.w * 0.125, r.x + r.w * 0.375,
    r.x + r.w * 0.625, r.x + r.w * 0.875,
  ];
  const rowY = [r.y + 66, r.y + 280];
  cards.forEach((item, i) => {
    drawEquipCard(ctx, colX[i % 4], rowY[Math.floor(i / 4)], item, assets, i, { frameSize: 106, statChips: 3 });
  });
}

const TEMPLATE_A = {
  id: 'std-left',
  name: '标准攻略图 · 立绘居左（庄方宜/伊冯型）',
  desc: '左侧角色立绘 + 右上潜能收益 + 技能加点 + 武器/装备建议 + 右下双饼图，1920×1080。进入布局模式可直接拖拽模块。',
  width: 1920, height: 1080,
  modules: [
    { id: 'portrait', label: '角色立绘', rect: { x: 30, y: 20, w: 300, h: 340 }, min: { w: 180, h: 200 } },
    { id: 'skills', label: '技能加点', rect: { x: 340, y: 20, w: 610, h: 340 }, min: { w: 400, h: 200 } },
    { id: 'potential', label: '潜能收益', rect: { x: 966, y: 20, w: 924, h: 504 }, min: { w: 480, h: 260 } },
    { id: 'weapons', label: '武器建议', rect: { x: 30, y: 372, w: 320, h: 504 }, min: { w: 220, h: 260 } },
    { id: 'equipments', label: '装备建议', rect: { x: 366, y: 372, w: 588, h: 504 }, min: { w: 380, h: 260 } },
    { id: 'ratio', label: '倍率分布', rect: { x: 966, y: 540, w: 462, h: 338 }, min: { w: 400, h: 260 } },
    { id: 'dmg', label: '伤害分布', rect: { x: 1444, y: 540, w: 446, h: 338 }, min: { w: 400, h: 260 } },
  ],

  draw(ctx, f, assets, builtins) {
    const W = this.width, H = this.height;
    assets = { ...assets, blank: builtins?.blank, specs: builtins?.specs };
    if (builtins && builtins.bg) {
      // 固定背景图
      drawImage(ctx, builtins.bg, 0, 0, W, H, 'cover');
    } else {
      pageBG(ctx, W, H, { bg: f.bgColor || '#212121' });
      // 无背景图时的左上角装饰
      if (assets.logo_topleft) {
        drawImage(ctx, assets.logo_topleft, 40, 14, 84, 84, 'contain');
      } else {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.translate(66, 56);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = '#FFB228';
        ctx.lineWidth = 3;
        ctx.strokeRect(-17, -17, 34, 34);
        ctx.strokeStyle = '#FFC000';
        ctx.lineWidth = 2;
        ctx.strokeRect(-11, -11, 22, 22);
        ctx.restore();
      }
    }
    drawModulePortraitA(ctx, f, assets, moduleRect(f, this.modules[0]));
    drawModuleSkillsA(ctx, f, assets, moduleRect(f, this.modules[1]));
    drawModulePotentialA(ctx, f, assets, moduleRect(f, this.modules[2]));
    drawModuleWeaponsA(ctx, f, assets, moduleRect(f, this.modules[3]));
    drawModuleEquipsA(ctx, f, assets, moduleRect(f, this.modules[4]));
    drawDonutPanel(ctx, moduleRect(f, this.modules[5]), f.ratioSegments,
      { title: f.ratioTitle || '倍率分布', donutR: 92, legendXOff: 244 });
    drawDonutPanel(ctx, moduleRect(f, this.modules[6]), f.dmgSegments,
      { title: f.dmgTitle || '伤害分布', donutR: 92, legendXOff: 240 });
    // 固定字幕层（最上层）
    if (builtins && builtins.subtitle) {
      drawImage(ctx, builtins.subtitle, 0, 0, W, H, 'cover');
    }
  }
};
return TEMPLATE_A;
})();
