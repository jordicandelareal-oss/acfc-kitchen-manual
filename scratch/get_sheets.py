import urllib.request
import re
import ssl

context = ssl._create_unverified_context()
url = "https://docs.google.com/spreadsheets/d/1ZkGa3yRh5LdRzMVkLDkhGZ8gehNV1Qn2JwGRg9idnrQ/edit"

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=context) as response:
        html = response.read().decode('utf-8')
    
    # Let's extract sheetNames and sheetIds
    # In newer sheets, it might be in JSON format like: {"name":"Insumos","id":0} or similar
    # Let's search for matches of: "name":"([^"]+)","id":([0-9]+) or similar
    # Let's find "name":"([^"]+)" and see if we get sheets
    names = re.findall(r'"name"\s*:\s*"([^"]+)"', html)
    print("Found names:", list(set(names))[:30])
    
    gids = re.findall(r'gid=([0-9]+)', html)
    print("Found gids in links:", list(set(gids)))
    
    # Look for the specific pattern: {"name":"...","id":...}
    pattern_matches = re.findall(r'\{[^}]*"name"\s*:\s*"([^"]+)"[^}]*"id"\s*:\s*([0-9]+)[^}]*\}', html)
    print("Found name-id pairs:", pattern_matches)
    
except Exception as e:
    print("Error:", e)
