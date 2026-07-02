import re

filepath = "/Users/jordicandelareal/.gemini/antigravity-ide/brain/05b6bceb-3577-4a0a-91e3-230a2c41dd75/.system_generated/steps/282/content.md"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all occurrences of docs-sheet-tab-caption
captions = re.findall(r'docs-sheet-tab-caption">([^<]+)<', content)
print("Tab Captions found:", captions)

# We can also check if there are gid mapping in script tags or inline.
# In Google Sheets HTML, there is usually a list of sheet models:
# "sheetId":XXXXXX,"sheetName":"XXXXX"
sheet_models = re.findall(r'"sheetId"\s*:\s*([0-9]+)[^}]*"sheetName"\s*:\s*"([^"]+)"', content)
print("Sheet models 1:", sheet_models)

sheet_models2 = re.findall(r'"sheetName"\s*:\s*"([^"]+)"[^}]*"sheetId"\s*:\s*([0-9]+)', content)
print("Sheet models 2:", sheet_models2)

# If not found, let's search for sheetId in any context
sheet_ids = re.findall(r'"sheetId"\s*:\s*([0-9]+)', content)
print("All sheetIds:", list(set(sheet_ids)))
