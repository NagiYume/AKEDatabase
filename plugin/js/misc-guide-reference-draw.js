// Adapted from the supplied horizontal reference project (draw.js).
window.AKEGuideReference = (() => {
/* ============================================================
 * draw.js — Canvas 绘图基础库
 * 供 templates.js 使用：圆角矩形、面板、文字、柱状图、饼图等
 * ============================================================ */
'use strict';

/* 字体栈：思源黑体(Noto Sans SC / Source Han Sans SC)优先，可商用（SIL OFL 1.1） */
const FONT_STACK = '"Noto Sans SC","Source Han Sans SC","Source Han Sans CN","Microsoft YaHei","PingFang SC","SimHei",sans-serif';

/* ---------- 基础 ---------- */
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRR(ctx, x, y, w, h, r, color) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRR(ctx, x, y, w, h, r, color, lw = 1) {
  rr(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

/* 带阴影的圆角矩形（描边发光） */
function glowRR(ctx, x, y, w, h, r, fill, border, glowColor, blur = 10, lw = 2) {
  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = blur;
  rr(ctx, x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}

/* ---------- 文字 ---------- */
function setFont(ctx, size, weight = 400, family = FONT_STACK) {
  ctx.font = `${weight} ${size}px ${family}`;
}

function drawText(ctx, text, x, y, opts = {}) {
  const {
    size = 24, weight = 400, color = '#F0F0F0', align = 'left',
    baseline = 'alphabetic', shadow = null, shadowBlur = 4,
    spacing = 0, family = FONT_STACK, maxWidth = null
  } = opts;
  ctx.save();
  setFont(ctx, size, weight, family);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = shadowBlur; }
  let str = text;
  if (spacing && ctx.measureText) {
    // 简单字距：以空格近似（canvas 无原生字距，仅用于英文大写）
    str = text.split('').join(spacing > 0 ? '\u2009' : '');
  }
  if (maxWidth) {
    let tw = ctx.measureText(str).width;
    if (tw > maxWidth) {
      const scale = maxWidth / tw;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, 1);
      ctx.fillText(str, 0, 0);
      ctx.restore();
      ctx.restore();
      return;
    }
  }
  ctx.fillText(str, x, y);
  ctx.restore();
}

function textW(ctx, text, size, weight = 400) {
  setFont(ctx, size, weight);
  return ctx.measureText(text).width;
}

/* 文本垂直居中辅助：给定字体尺寸的基线偏移 */
const BASELINE = 0.35; // 视觉居中近似

/* ---------- 图片 ---------- */
function imgCover(ctx, img, x, y, w, h, r = 0) {
  // 居中裁剪填充
  const iw = img.width, ih = img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale, dh = ih * scale;
  const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
  ctx.save();
  if (r > 0) { rr(ctx, x, y, w, h, r); ctx.clip(); }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function imgContain(ctx, img, x, y, w, h, r = 0) {
  const iw = img.width, ih = img.height;
  if (!iw || !ih) return;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale, dh = ih * scale;
  const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
  ctx.save();
  if (r > 0) { rr(ctx, x, y, w, h, r); ctx.clip(); }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function drawImage(ctx, img, x, y, w, h, mode = 'cover', r = 0) {
  if (mode === 'contain') imgContain(ctx, img, x, y, w, h, r);
  else imgCover(ctx, img, x, y, w, h, r);
}

/* 素材缺失时的占位框 */
function placeholder(ctx, x, y, w, h, label, r = 10, opts = {}) {
  const { border = '#4A4A4A', bg = 'rgba(255,255,255,0.04)', textColor = '#8A8A8A' } = opts;
  fillRR(ctx, x, y, w, h, r, bg);
  strokeRR(ctx, x, y, w, h, r, border, 1.5);
  ctx.save();
  ctx.setLineDash([8, 6]);
  strokeRR(ctx, x + 6, y + 6, w - 12, h - 12, r - 4, border, 1);
  ctx.restore();
  drawText(ctx, label, x + w / 2, y + h / 2, {
    size: Math.max(13, Math.min(20, w / 9)), color: textColor, align: 'center', baseline: 'middle'
  });
}

/* ---------- 面板 ---------- */
/* 深色面板：底 + 边框 + 顶部标题栏 */
function panel(ctx, x, y, w, h, opts = {}) {
  const {
    bg = '#282828', border = '#3E3E3E', r = 10,
    header = null, headerH = 58, headerBg = '#383838',
    title = '', titleSize = 27, titleColor = '#FFFFFF',
    accent = '#FFB228', icon = null, iconW = 26, iconH = 26,
    glow = false, glowColor = 'rgba(255,178,40,0.25)'
  } = opts;

  ctx.save();
  if (glow) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
  }
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.shadowBlur = 0;
  strokeRR(ctx, x, y, w, h, r, border, 1.5);
  ctx.restore();

  if (header) {
    // 标题栏：顶部圆角矩形
    ctx.save();
    rr(ctx, x, y, w, headerH, r);
    ctx.rect(x, y + headerH - 6, w, 6);
    ctx.fillStyle = headerBg;
    ctx.fill();
    // 底部细分隔线
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 8, y + headerH - 1, w - 16, 1);
    ctx.restore();
    // 左侧金色小方块装饰
    fillRR(ctx, x + 16, y + (headerH - 18) / 2, 5, 18, 2, accent);
    if (icon) {
      drawImage(ctx, icon, x + 30, y + (headerH - iconH) / 2, iconW, iconH, 'contain');
      drawText(ctx, title, x + 30 + iconW + 10, y + headerH / 2, {
        size: titleSize, weight: 700, color: titleColor, baseline: 'middle'
      });
    } else {
      drawText(ctx, title, x + 32, y + headerH / 2, {
        size: titleSize, weight: 700, color: titleColor, baseline: 'middle'
      });
    }
  }
  return { bodyTop: header ? y + headerH : y };
}

/* 通用小圆角标签 */
function chip(ctx, x, y, w, h, text, opts = {}) {
  const {
    r = h / 2, bg = '#3A3A3A', border = 'rgba(255,255,255,0.14)',
    color = '#FFFFFF', size = 20, weight = 700, align = 'center'
  } = opts;
  fillRR(ctx, x, y, w, h, r, bg);
  strokeRR(ctx, x, y, w, h, r, border, 1);
  drawText(ctx, text, x + w / 2, y + h / 2, {
    size, weight, color, align: 'center', baseline: 'middle'
  });
}

/* 星级：n 颗小菱形（金色/灰） */
function drawStars(ctx, x, y, n, max = 6, opts = {}) {
  const { size = 13, gap = 7, color = '#FFC000', empty = '#4A4A4A' } = opts;
  for (let i = 0; i < max; i++) {
    const cx = x + i * (size + gap);
    ctx.save();
    ctx.translate(cx + size / 2, y + size / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i < n ? color : empty;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
}

/* ---------- 柱状图 ---------- */
function drawBarChart(ctx, x, y, w, h, labels, values, opts = {}) {
  const {
    barColor = '#FFB228', barTop = '#FFD873', labelColor = '#E8E8E8',
    valueColor = '#3A2A10', grid = 'rgba(255,255,255,0.06)',
    valueOnBar = true, minBarH = 6, r = 6
  } = opts;
  const n = labels.length;
  if (!n) return;
  const maxV = Math.max(...values, 1);
  const padB = 34, padT = 34;
  const plotH = h - padB - padT;
  const slot = w / n;
  const barW = Math.min(52, slot * 0.55);

  // 网格线
  ctx.save();
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const gy = y + padT + plotH * (1 - i / 4);
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }
  ctx.restore();

  for (let i = 0; i < n; i++) {
    const cx = x + slot * i + slot / 2;
    const v = values[i];
    const bh = Math.max(minBarH, plotH * (v / maxV));
    const by = y + padT + plotH - bh;
    // 柱体：渐变
    const grad = ctx.createLinearGradient(cx - barW / 2, by, cx - barW / 2, by + bh);
    grad.addColorStop(0, barTop);
    grad.addColorStop(1, barColor);
    rr(ctx, cx - barW / 2, by, barW, bh, Math.min(r, bh / 2, barW / 2));
    ctx.fillStyle = grad;
    ctx.fill();
    // 描边
    strokeRR(ctx, cx - barW / 2, by, barW, bh, Math.min(r, bh / 2, barW / 2), 'rgba(255,255,255,0.18)', 1);
    // 数值
    const vs = (typeof v === 'number' ? v.toFixed(1) : v) + '%';
    if (valueOnBar) {
      const tw = textW(ctx, vs, 21, 700);
      fillRR(ctx, cx - tw / 2 - 7, by - 28, tw + 14, 24, 5, 'rgba(20,16,4,0.85)');
      drawText(ctx, vs, cx, by - 16, { size: 21, weight: 700, color: barTop, align: 'center', baseline: 'middle' });
    } else {
      drawText(ctx, vs, cx, by - 8, { size: 20, weight: 700, color: valueColor, align: 'center' });
    }
    // 底部标签
    drawText(ctx, labels[i], cx, y + h - 8, {
      size: 19, weight: 600, color: labelColor, align: 'center', baseline: 'alphabetic'
    });
  }
}

/* ---------- 饼图 ---------- */
const DONUT_COLORS = ['#EF822F', '#76BD43', '#F2BA03', '#4874CB', '#E54C5E', '#9A6AE0', '#22C6D0', '#C0C0C0'];

function drawDonut(ctx, cx, cy, r, segments, opts = {}) {
  const { gap = 0.035, ring = 0.62, solid = false, start = -Math.PI / 2, colors = DONUT_COLORS } = opts;
  const total = segments.reduce((s, x) => s + Math.max(0, Number(x.value) || 0), 0);
  const rOut = r, rIn = solid ? 0 : r * ring;
  let a = start;
  if (total <= 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, rOut, 0, Math.PI * 2);
    ctx.fillStyle = '#2A2A2A';
    ctx.fill();
    if (!solid) {
      ctx.beginPath();
      ctx.arc(cx, cy, rIn, 0, Math.PI * 2);
      ctx.fillStyle = '#202020';
      ctx.fill();
    }
    return;
  }
  segments.forEach((seg, i) => {
    const v = Math.max(0, Number(seg.value) || 0);
    if (v <= 0) return;
    const a0 = a;
    const a1 = a0 + (v / total) * Math.PI * 2;
    const col = seg.color || colors[i % colors.length];
    const span = a1 - a0;
    const g = span <= gap * 2 ? 0 : gap; // 过小扇区不扣缝隙，避免 arc 反向绕满整圈
    ctx.beginPath();
    if (solid) {
      // 实心扇形：从圆心出发
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rOut, a0 + g, a1 - g);
    } else {
      // 环形扇区：外弧 + 内弧
      ctx.arc(cx, cy, rOut, a0 + g, a1 - g);
      ctx.arc(cx, cy, rIn, a1 - g, a0 + g, true);
    }
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    // 高光边
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    a = a1;
  });
  // 中心孔（仅环形模式）
  if (!solid) {
    ctx.beginPath();
    ctx.arc(cx, cy, rIn * 0.96, 0, Math.PI * 2);
    ctx.fillStyle = '#232323';
    ctx.fill();
  }
}

/* 图例行（自适应：数值右对齐，标签占据剩余空间，永不碰撞） */
function legendRow(ctx, x, y, color, label, value, opts = {}) {
  const {
    box = 30, boxH = 16, size = 21, valueSize = 22, gap = 10,
    labelColor = '#D8D8D8', valueColor = '#FFFFFF',
    valueX = null, lw = null
  } = opts;
  fillRR(ctx, x, y, box, boxH, 3, color);
  const vw = textW(ctx, value, valueSize, 700) + 4;
  let vx;
  if (valueX != null) vx = valueX;
  else if (lw != null) vx = x + lw - 8;
  else vx = x + 168;
  drawText(ctx, value, vx, y + boxH / 2, {
    size: valueSize, weight: 700, color: valueColor, baseline: 'middle', align: 'right'
  });
  let labelMax = null;
  if (lw != null) {
    const vw2 = (vx - (x + lw - 8)) + vw; // 数值实际占宽
    labelMax = Math.max(30, lw - (box + gap) - vw2 - 6);
  }
  drawText(ctx, label, x + box + gap, y + boxH / 2, {
    size, weight: 500, color: labelColor, baseline: 'middle', maxWidth: labelMax
  });
}

/* ---------- 渐变背景 ---------- */
function vGrad(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  return g;
}

function hGrad(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  return g;
}

/* 背景 + 外框 */
function pageBG(ctx, W, H, opts = {}) {
  const { bg = '#212121', frame = '#3C3C3C', frameInset = 22, frameW = 2 } = opts;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 轻微暗角
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  // 外框
  strokeRR(ctx, frameInset, frameInset, W - frameInset * 2, H - frameInset * 2, 14, frame, frameW);
}
return { drawText, setFont, panel, drawBarChart, drawDonut, legendRow, drawImage, fillRR, strokeRR, rr, glowRR, textW, pageBG, placeholder, DONUT_COLORS };
})();
