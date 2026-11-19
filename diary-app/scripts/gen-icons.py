#!/usr/bin/env python3
"""
基于 assets/images/app-icon.png 生成上架所需的优质图标资源：
- assets/images/adaptive-icon.png (1024x1024 RGBA, 主体缩入 Android 66% 安全区，周边用渐变无缝延展，无抠图破洞)
- assets/images/splash-icon.png (1024x1024 RGBA, 居中圆角柔和图标徽章，适配浅色启动页)
- assets/images/notification-icon.png (96x96 RGBA, 4x超采样绘制纯白透明底「翻开的书本+嫩芽」剪影)
绝不覆盖 app-icon.png 或其他已有图片。
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "assets" / "images"
SRC = IMG_DIR / "app-icon.png"


def build_adaptive_icon(im: Image.Image, canvas_size: int = 1024, inner_size: int = 740) -> Image.Image:
    rgb = im.convert("RGB")
    w, h = rgb.size
    px = rgb.load()

    # 用左右边栏均色计算垂直背景渐变，确保延展边界 100% 无缝
    col_grad = []
    for y in range(h):
        r = int(round(sum(px[x, y][0] for x in (*range(0, 6), *range(w - 6, w))) / 12.0))
        g = int(round(sum(px[x, y][1] for x in (*range(0, 6), *range(w - 6, w))) / 12.0))
        b = int(round(sum(px[x, y][2] for x in (*range(0, 6), *range(w - 6, w))) / 12.0))
        col_grad.append((r, g, b))

    scaled = rgb.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
    pad_top = (canvas_size - inner_size) // 2
    pad_left = (canvas_size - inner_size) // 2

    canvas = Image.new("RGB", (canvas_size, canvas_size))
    cpx = canvas.load()
    for y in range(canvas_size):
        sy = int(round((y - pad_top) * (h - 1) / max(1, inner_size - 1)))
        sy = max(0, min(h - 1, sy))
        bg = col_grad[sy]
        for x in range(canvas_size):
            cpx[x, y] = bg

    # 软羽化遮罩拼接 scaled，消除任何接缝线
    mask = Image.new("L", (inner_size, inner_size), 255)
    mpx = mask.load()
    feather = 36
    for y in range(inner_size):
        dy = min(y, inner_size - 1 - y)
        ay = min(1.0, dy / feather)
        for x in range(inner_size):
            dx = min(x, inner_size - 1 - x)
            ax = min(1.0, dx / feather)
            mpx[x, y] = int(round(255 * min(ax, ay)))

    canvas.paste(scaled, (pad_left, pad_top), mask)
    return canvas.convert("RGBA")


def build_splash_icon(im: Image.Image, canvas_size: int = 1024, badge_size: int = 520) -> Image.Image:
    rgb = im.convert("RGB").resize((badge_size, badge_size), Image.Resampling.LANCZOS)
    # 轻微裁剪外部冗余空白，让书本与嫩芽在启动屏徽章内更饱满
    inset = int(badge_size * 0.06)
    cropped = rgb.crop((inset, inset, badge_size - inset, badge_size - inset)).resize(
        (badge_size, badge_size), Image.Resampling.LANCZOS
    )

    # 4x 超采样圆角遮罩
    hi = badge_size * 2
    hi_mask = Image.new("L", (hi, hi), 0)
    d = ImageDraw.Draw(hi_mask)
    r = int(hi * 0.225)
    d.rounded_rectangle((0, 0, hi - 1, hi - 1), radius=r, fill=255)
    mask = hi_mask.resize((badge_size, badge_size), Image.Resampling.LANCZOS)

    badge = cropped.convert("RGBA")
    badge.putalpha(mask)

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    # 淡淡的暖影提升立体感
    shadow = Image.new("RGBA", (badge_size, badge_size), (138, 110, 88, 0))
    sa = mask.point(lambda v: int(v * 0.16))
    shadow.putalpha(sa)
    shadow_pad = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    pos = (canvas_size - badge_size) // 2
    shadow_pad.paste(shadow, (pos, pos + 14))
    shadow_pad = shadow_pad.filter(ImageFilter.GaussianBlur(radius=18))

    canvas = Image.alpha_composite(canvas, shadow_pad)
    canvas.paste(badge, (pos, pos), badge)
    return canvas


def build_notification_icon(size: int = 96) -> Image.Image:
    # 4x 超采样绘制清晰的「翻开的日记本 + 嫩芽」纯白透明剪影
    s = size * 4  # 384
    hi = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(hi)
    W = (255, 255, 255, 255)
    T = (0, 0, 0, 0)

    # 左书页 & 右书页（圆润多边形）
    left_page = [
        (44, 274),
        (68, 198),
        (120, 188),
        (184, 214),
        (184, 304),
        (114, 282),
    ]
    right_page = [(s - x, y) for (x, y) in left_page]
    draw.polygon(left_page, fill=W)
    draw.polygon(right_page, fill=W)

    # 书底弧线托底
    draw.line([(40, 294), (118, 296), (192, 320), (266, 296), (344, 294)], fill=W, width=22, joint="curve")
    draw.ellipse((178, 308, 206, 332), fill=W)

    # 书脊中缝细隔断，增强辨识度
    draw.rectangle((186, 210, 198, 296), fill=T)

    # 中心芽茎
    draw.line([(192, 278), (192, 166), (206, 128)], fill=W, width=16, joint="curve")

    # 顶部右大叶
    leaf_tr = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d1 = ImageDraw.Draw(leaf_tr)
    d1.ellipse((196, 54, 294, 128), fill=W)
    leaf_tr = leaf_tr.rotate(24, center=(214, 118), resample=Image.Resampling.BICUBIC)
    hi = Image.alpha_composite(hi, leaf_tr)

    # 中部左叶
    leaf_ml = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(leaf_ml)
    d2.ellipse((98, 102, 186, 166), fill=W)
    leaf_ml = leaf_ml.rotate(-22, center=(174, 152), resample=Image.Resampling.BICUBIC)
    hi = Image.alpha_composite(hi, leaf_ml)

    # 下方右小叶
    leaf_br = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d3 = ImageDraw.Draw(leaf_br)
    d3.ellipse((196, 146, 260, 194), fill=W)
    leaf_br = leaf_br.rotate(18, center=(202, 178), resample=Image.Resampling.BICUBIC)
    hi = Image.alpha_composite(hi, leaf_br)

    return hi.resize((size, size), Image.Resampling.LANCZOS)


def main():
    if not SRC.exists():
        raise FileNotFoundError(f"Source icon missing: {SRC}")
    im = Image.open(SRC)

    adaptive = build_adaptive_icon(im)
    adaptive.save(IMG_DIR / "adaptive-icon.png", "PNG")

    splash = build_splash_icon(im)
    splash.save(IMG_DIR / "splash-icon.png", "PNG")

    notif = build_notification_icon(96)
    notif.save(IMG_DIR / "notification-icon.png", "PNG")

    print("Regenerated icons cleanly:")
    for name in ("adaptive-icon.png", "splash-icon.png", "notification-icon.png"):
        res = Image.open(IMG_DIR / name)
        print(f"  {name}: {res.size} {res.mode}")


if __name__ == "__main__":
    main()
