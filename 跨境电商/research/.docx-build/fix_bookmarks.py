#!/usr/bin/env python3
# docx-js assigns every Bookmark the same numeric w:id ("1"). Names are unique (used for anchors),
# but the duplicate numeric ids violate the OOXML uniqueness constraint. Renumber them: the i-th
# bookmarkStart and i-th bookmarkEnd (sequential, non-overlapping heading bookmarks) both get id=i.
import re, sys, zipfile, os

path = sys.argv[1]
with zipfile.ZipFile(path) as z:
    names = z.namelist()
    data = {n: z.read(n) for n in names}

xml = data['word/document.xml'].decode('utf-8')
sc = [0]; ec = [0]
def rs(m): sc[0] += 1; return re.sub(r'w:id="\d+"', 'w:id="%d"' % sc[0], m.group(0))
def re_(m): ec[0] += 1; return re.sub(r'w:id="\d+"', 'w:id="%d"' % ec[0], m.group(0))
xml = re.sub(r'<w:bookmarkStart[^>]*/?>', rs, xml)
xml = re.sub(r'<w:bookmarkEnd[^>]*/?>', re_, xml)
data['word/document.xml'] = xml.encode('utf-8')

tmp = path + '.tmp'
with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as z:
    for n in names:
        z.writestr(n, data[n])
os.replace(tmp, path)
print(f"renumbered {sc[0]} bookmarkStart / {ec[0]} bookmarkEnd ids")
