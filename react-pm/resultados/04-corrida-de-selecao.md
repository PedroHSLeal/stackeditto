editor | sequence | 0 ms pause | 10 ms pause | 30 ms pause | 100 ms pause
--- | --- | ---: | ---: | ---: | ---:
app (1.41.0 + patches) | click + End + type | 15/15 | 15/15 | 15/15 | 15/15
app (1.41.0 + patches) | End + ArrowDown + type | 15/15 | 15/15 | 15/15 | 15/15
vanilla 1.42.3 | click + End + type | 15/15 | 15/15 | 15/15 | 15/15
vanilla 1.42.3 | End + ArrowDown + type | 15/15 | 15/15 | 15/15 | 15/15
react-prosemirror | click + End + type | 12/15 | 15/15 | 15/15 | 15/15
react-prosemirror | End + ArrowDown + type | 13/15 | 15/15 | 15/15 | 15/15
react-prosemirror (controlled) | click + End + type | 9/15 | 13/15 | 15/15 | 15/15
react-prosemirror (controlled) | End + ArrowDown + type | 13/15 | 15/15 | 15/15 | 15/15

examples:
- react-prosemirror · click + End + type · 0 ms: heading "Section 0XYXY" → "XY"
- react-prosemirror · click + End + type · 0 ms: heading "XYXYXY" → "XY"
- react-prosemirror · click + End + type · 0 ms: heading "XYXYXYXYXY" → "XXYYXYXYXYXY"
- react-prosemirror · End + ArrowDown + type · 0 ms: Z landed in the heading ("Section 0Z")
- react-prosemirror · End + ArrowDown + type · 0 ms: Z landed in the heading ("Section 0ZZ")
- react-prosemirror (controlled) · click + End + type · 0 ms: heading "Section 0" → "XYSection 0"
- react-prosemirror (controlled) · click + End + type · 0 ms: heading "XYSection 0" → "XYXYSection 0"
- react-prosemirror (controlled) · click + End + type · 0 ms: heading "YSection 0XYXYXYXYXY" → "XYYXYSection 0XYXYXYXYXY"
- react-prosemirror (controlled) · click + End + type · 0 ms: heading "YSection 0XYXYXYXYXY" → "XY"
- react-prosemirror (controlled) · click + End + type · 0 ms: heading "XYXYXY" → "XY"
- react-prosemirror (controlled) · click + End + type · 0 ms: heading "XYXYXY" → "XY"
- react-prosemirror (controlled) · click + End + type · 10 ms: heading "XYXYXYXYXYXYXYXYXYXY" → "XYXYXYXYXYXYXYXYXYXYXYXY"
