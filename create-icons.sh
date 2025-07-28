#!/bin/bash
# 创建简单的图标文件

# 创建临时目录
temp_dir=$(mktemp -d)
cd "$temp_dir"

# 创建SVG图标模板
cat > icon.svg << 'EOF'
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#007bff" rx="20"/>
  <circle cx="64" cy="40" r="20" fill="white"/>
  <circle cx="64" cy="88" r="20" fill="white"/>
  <rect x="54" y="40" width="20" height="48" fill="white"/>
</svg>
EOF

# 使用系统工具转换（macOS方法）
if command -v sips &> /dev/null; then
    # macOS自带sips工具
    for size in 16 48 128; do
        sips -s format png icon.svg --out "icon${size}.png" --resampleWidth $size --resampleHeight $size 2>/dev/null || {
            # 创建纯色图标
            sips -s format png -z $size $size -s dpiHeight 72 -s dpiWidth 72 --out "icon${size}.png" <<< "$(printf 'P6\n%d %d\n255\n' $size $size | head -c -1)$(printf '\x00\x7f\xff' | dd bs=$size count=$size 2>/dev/null)"
        }
    done
else
    # 创建简单的纯色图标
    for size in 16 48 128; do
        python3 -c "
import PIL.Image as Image
import numpy as np
img = Image.new('RGB', ($size, $size), color=(0, 123, 255))
img.save('icon${size}.png')
" 2>/dev/null || {
            # 创建文本文件作为占位符
            echo "Icon placeholder - replace with real PNG" > "icon${size}.png"
        }
    done
fi

# 复制图标到项目目录
cp icon*.png /Users/zonglin/claude/icons/

echo "图标文件已创建在 icons/ 目录"
ls -la /Users/zonglin/claude/icons/