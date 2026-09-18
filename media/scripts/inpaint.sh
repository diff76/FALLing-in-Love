#!/bin/bash
# inpaint.sh <base.png> <mask.png> "<prompt>" <out.png> — gpt_image_2 masked edit via Higgsfield (bash 3.2 safe)
set -e
B=$(higgsfield upload create "$1" --json 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
M=$(higgsfield upload create "$2" --json 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
J=$(higgsfield generate create gpt_image_2 --prompt "$3 Same clay style, lighting and colours as the picture; everything outside the mask stays exactly as it is." --image "$B" --is_inpaint true --mask "{\"id\":\"$M\"}" --aspect_ratio 3:2 --resolution 2k --quality high --json 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)[0])")
higgsfield generate wait "$J" --json > "$4.json" 2>/dev/null
URL=$(python3 -c "import json;d=json.load(open('$4.json'));d=d[0] if isinstance(d,list) else d;print(d.get('result_url',''))")
[ -n "$URL" ] && curl -fsSL "$URL" -o "$4" && echo "inpaint ok -> $4" || { echo "inpaint FAILED $4"; exit 1; }
