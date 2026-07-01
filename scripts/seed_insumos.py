#!/usr/bin/env python3
"""
seed_insumos.py — Parsea insumos_raw.tsv y puebla Supabase.
Ejecutar: python3 scripts/seed_insumos.py

REQUISITO: Ejecutar primero migrations/001_alter_ingredients_add_insumos_fields.sql
           en https://supabase.com/dashboard/project/aosweyggyalowhogjatz/sql/new
"""
import re, json, ssl, urllib.request, urllib.error, os, sys
from datetime import datetime

# ── Config ─────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://aosweyggyalowhogjatz.supabase.co"
ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvc3dleWdneWFsb3dob2dqYXR6Iiwicm9sZSI6"
    "ImFub24iLCJpYXQiOjE3ODI4NjQzOTUsImV4cCI6MjA5ODQ0MDM5NX0."
    "od5Zg10H_EflslfXYksolRAu81nFi2zd0vZRXDeqrcs"
)
CTX = ssl._create_unverified_context()

PROVIDER_COLS = {
    4: "Carniceria Samir",
    5: "Star Cash&Carry",
    6: "Chino centro",
    7: "Chino cash&carry",
    8: "Mercadona",
    9: "Makro",
}

# ── Helpers ─────────────────────────────────────────────────────────────────
def clean_price(val):
    if not val: return None
    v = val.strip().replace('€', '').replace(' ', '').replace(',', '.')
    if v in ('', '-', '0.00', '0'): return None
    try:
        f = round(float(v), 6)
        return f if f > 0 else None
    except ValueError:
        return None

def clean_unit(val):
    if not val or not val.strip(): return 'GR'
    v = val.strip().upper()
    return {'GR': 'GR', 'KG': 'KG', 'ML': 'ML', 'UNIDAD': 'Unidad'}.get(v, v)

def clean_date(val):
    if not val or val.strip() in ('', '-'): return None
    v = val.strip()
    for fmt in ('%d/%m/%y %H:%M', '%d/%m/%y %H:%M:%S', '%d/%m/%Y', '%d/%m/%y', '%d/%m/%y 0:00'):
        try:
            return datetime.strptime(v, fmt).strftime('%Y-%m-%dT00:00:00Z')
        except: pass
    m = re.match(r'^(\d{1,2})-(\d{1,2})$', v)
    if m:
        try: return datetime(2025, int(m.group(2)), int(m.group(1))).strftime('%Y-%m-%dT00:00:00Z')
        except: pass
    m2 = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', v)
    if m2:
        try: return datetime(int(m2.group(3)), int(m2.group(2)), int(m2.group(1))).strftime('%Y-%m-%dT00:00:00Z')
        except: pass
    return None

# ── Parse TSV ───────────────────────────────────────────────────────────────
script_dir = os.path.dirname(os.path.abspath(__file__))
tsv_path   = os.path.join(script_dir, 'insumos_raw.tsv')

records = []
seen_names = set()

with open(tsv_path, encoding='utf-8') as f:
    lines = f.readlines()[2:]   # Skip 2 header rows

for line in lines:
    cols = line.rstrip('\n').split('\t')
    while len(cols) < 15: cols.append('')

    categoria    = cols[0].strip().capitalize() if cols[0].strip() else None
    subcategoria = cols[1].strip().capitalize() if cols[1].strip() else None
    producto     = cols[2].strip()
    cat_nut_raw  = cols[3].strip()
    cat_nut      = None if cat_nut_raw.lower() in ('', 'sin asignar') else cat_nut_raw

    if not producto or producto == 'Producto': continue
    # Deduplicate by name
    key = producto.lower().strip()
    if key in seen_names: continue
    seen_names.add(key)

    # Provider prices → JSONB
    precios = {}
    for idx, pname in PROVIDER_COLS.items():
        p = clean_price(cols[idx]) if len(cols) > idx else None
        if p is not None:
            precios[pname] = p

    # Precio más bajo from col 10 (sheet-calculated)
    precio_bajo_raw = clean_price(cols[10]) if len(cols) > 10 else None
    # Fallback: derive from precios dict
    if precio_bajo_raw is None and precios:
        precio_bajo_raw = min(precios.values())

    # precio_por_gramo from col 11
    precio_gr_raw = clean_price(cols[11]) if len(cols) > 11 else None
    # If not present, derive: precio_por_kg / 1000
    if precio_gr_raw is None and precio_bajo_raw is not None:
        precio_gr_raw = round(precio_bajo_raw / 1000, 6)

    unidad  = clean_unit(cols[12]) if len(cols) > 12 else 'GR'
    proveedor = cols[13].strip() if len(cols) > 13 and cols[13].strip() not in ('', '-') else None
    fecha   = clean_date(cols[14]) if len(cols) > 14 else None

    # Determine precio_por_kg vs precio_por_u based on unit
    is_unit_price = unidad == 'Unidad'
    precio_por_kg = None if is_unit_price else precio_bajo_raw
    precio_por_u  = precio_bajo_raw if is_unit_price else None

    records.append({
        "name":                  producto,
        "category":              categoria,
        "subcategory":           subcategoria,
        "nutritional_category":  cat_nut,
        "unit":                  unidad,
        "precio_por_kg":         precio_por_kg,
        "precio_por_u":          precio_por_u,
        "precio_por_gramo":      precio_gr_raw,
        "precio_mas_bajo":       precio_bajo_raw,
        "proveedor_principal":   proveedor,
        "precios_por_proveedor": precios,
        "current_stock":         0.0,
        "min_stock":             0.0,
        "updated_at":            fecha or datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
    })

print(f"✅ TSV parseado: {len(records)} registros únicos\n")

# ── Pre-flight: verify new columns exist ────────────────────────────────────
def http_get(path):
    req = urllib.request.Request(
        f"{SUPABASE_URL}{path}",
        headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}"}
    )
    try:
        with urllib.request.urlopen(req, context=CTX) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

status, _ = http_get("/rest/v1/ingredients?select=precio_por_kg&limit=1")
if status == 400:
    print("❌ ERROR: Las columnas nuevas NO existen en Supabase.")
    print()
    print("   ▶ Ejecuta este SQL en el Dashboard de Supabase:")
    print("   https://supabase.com/dashboard/project/aosweyggyalowhogjatz/sql/new")
    print()
    mig = os.path.join(os.path.dirname(script_dir), 'migrations',
                       '001_alter_ingredients_add_insumos_fields.sql')
    with open(mig) as f:
        print(f.read())
    sys.exit(1)

print("✅ Columnas nuevas verificadas en Supabase\n")

# ── Upsert in batches ────────────────────────────────────────────────────────
def http_post(path, payload, extra_headers=None):
    data = json.dumps(payload, default=str).encode('utf-8')
    headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    if extra_headers: headers.update(extra_headers)
    req = urllib.request.Request(
        f"{SUPABASE_URL}{path}", data=data, headers=headers, method='POST'
    )
    try:
        with urllib.request.urlopen(req, context=CTX) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

BATCH = 40
inserted = 0
errors = 0

print(f"🚀 Iniciando upsert de {len(records)} insumos en Supabase...\n")
for i in range(0, len(records), BATCH):
    batch = records[i:i+BATCH]
    code, body = http_post("/rest/v1/ingredients?on_conflict=name", batch)
    n = len(batch)
    if code in (200, 201):
        inserted += n
        print(f"   ✅ Batch {i//BATCH+1:02d}: {n} registros → OK")
    else:
        errors += n
        print(f"   ❌ Batch {i//BATCH+1:02d}: {n} registros → ERROR {code}")
        print(f"      {body[:200]}")

print(f"\n{'─'*55}")
print(f"📊 Resultado:")
print(f"   ✅ Insertados/actualizados : {inserted}")
print(f"   ❌ Errores                 : {errors}")
print(f"   📦 Total procesados        : {len(records)}")
print(f"{'─'*55}")
if errors == 0:
    print(f"\n🎉 ¡Seed completado! {len(records)} insumos cargados en Supabase.")
