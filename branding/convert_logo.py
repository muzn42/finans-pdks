import xml.etree.ElementTree as ET
import re

tree = ET.parse(r'c:\Users\alb\Desktop\ATF PDKS\finans-pdks\branding\albayrak_logo_yazili.svg')
root = tree.getroot()

paths = []
for g in root.findall('.//{http://www.w3.org/2000/svg}g'):
    path = g.find('{http://www.w3.org/2000/svg}path')
    if path is not None:
        t = g.get('transform', '')
        m = re.search(r'translate\(([^,]+),([^\)]+)\)', t)
        tx = float(m.group(1)) if m else 0.0
        ty = float(m.group(2)) if m else 0.0
        p_id = path.get('id')
        style = path.get('style', '')
        d = path.get('d')
        fill = '#000000'
        if 'fill:' in style:
            fill = style.split('fill:')[1].split(';')[0].upper()
        fill_type = 'evenOdd' if 'fill-rule:evenodd' in style else 'nonZero'
        paths.append({
            'id': p_id,
            'tx': tx,
            'ty': ty,
            'fill': fill,
            'fill_type': fill_type,
            'd': d
        })

emblem_ids = {'path50', 'path54', 'path58'}

# 1. ic_albayrak_emblem.xml
xml_emblem = '''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="153dp"
    android:height="129dp"
    android:viewportWidth="153"
    android:viewportHeight="129">
    <group
        android:translateX="-145"
        android:translateY="363"
        android:scaleY="-1">
'''
for p in paths:
    if p['id'] in emblem_ids:
        fill_attr = f'android:fillType="{p["fill_type"]}"' if p['fill_type'] != 'nonZero' else ''
        xml_emblem += f'''        <group android:translateX="{p['tx']}" android:translateY="{p['ty']}">
            <path
                android:fillColor="{p['fill']}"
                {fill_attr}
                android:pathData="{p['d']}" />
        </group>
'''
xml_emblem += '''    </group>
</vector>
'''

with open(r'c:\Users\alb\Desktop\ATF PDKS\finans-pdks\app\src\main\res\drawable\ic_albayrak_emblem.xml', 'w', encoding='utf-8') as f:
    f.write(xml_emblem)

# 2. ic_albayrak_logo_full.xml
xml_full = '''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="552dp"
    android:height="129dp"
    android:viewportWidth="552"
    android:viewportHeight="129">
    <group
        android:translateX="-145"
        android:translateY="363"
        android:scaleY="-1">
'''
for p in paths:
    fill_attr = f'android:fillType="{p["fill_type"]}"' if p['fill_type'] != 'nonZero' else ''
    xml_full += f'''        <group android:translateX="{p['tx']}" android:translateY="{p['ty']}">
            <path
                android:fillColor="{p['fill']}"
                {fill_attr}
                android:pathData="{p['d']}" />
        </group>
'''
xml_full += '''    </group>
</vector>
'''

with open(r'c:\Users\alb\Desktop\ATF PDKS\finans-pdks\app\src\main\res\drawable\ic_albayrak_logo_full.xml', 'w', encoding='utf-8') as f:
    f.write(xml_full)

# 3. Notification icon (pure white silhouette of the emblem)
xml_notif = '''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="153"
    android:viewportHeight="129">
    <group
        android:translateX="-145"
        android:translateY="363"
        android:scaleY="-1">
'''
for p in paths:
    if p['id'] in emblem_ids:
        xml_notif += f'''        <group android:translateX="{p['tx']}" android:translateY="{p['ty']}">
            <path
                android:fillColor="#FFFFFFFF"
                android:pathData="{p['d']}" />
        </group>
'''
xml_notif += '''    </group>
</vector>
'''
with open(r'c:\Users\alb\Desktop\ATF PDKS\finans-pdks\app\src\main\res\drawable\ic_albayrak_notification.xml', 'w', encoding='utf-8') as f:
    f.write(xml_notif)

# 4. App launcher foreground (108x108 adaptive icon, emblem centered inside 66dp area)
# Emblem is 153x129 (ratio 1.186). Scale it to fit ~60x50 inside 108x108.
# Scale factor = 60 / 153 = 0.392
# Center = (108 - 153*0.392)/2 = (108 - 60)/2 = 24
# Y Center = (108 - 129*0.392)/2 = (108 - 50.5)/2 = 28.7
scale = 0.38
trans_x = (108 - 153 * scale) / 2
trans_y = (108 - 129 * scale) / 2

xml_launcher = f'''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <group
        android:translateX="{trans_x:.1f}"
        android:translateY="{trans_y:.1f}">
        <group
            android:scaleX="{scale:.4f}"
            android:scaleY="{scale:.4f}">
            <group
                android:translateX="-145"
                android:translateY="363"
                android:scaleY="-1">
'''
for p in paths:
    if p['id'] in emblem_ids:
        fill_attr = f'android:fillType="{p["fill_type"]}"' if p['fill_type'] != 'nonZero' else ''
        xml_launcher += f'''                <group android:translateX="{p['tx']}" android:translateY="{p['ty']}">
                    <path
                        android:fillColor="{p['fill']}"
                        {fill_attr}
                        android:pathData="{p['d']}" />
                </group>
'''
xml_launcher += '''            </group>
        </group>
    </group>
</vector>
'''
with open(r'c:\Users\alb\Desktop\ATF PDKS\finans-pdks\app\src\main\res\drawable\ic_launcher_foreground.xml', 'w', encoding='utf-8') as f:
    f.write(xml_launcher)

print('All vector drawables successfully generated!')
