import requests
import base64
from nacl import encoding, public

PAT   = "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"
OWNER = "phonghdpxd-cmd"
REPO  = "TNI-SITE-DOWN"

SECRETS = {
    "TELEGRAM_API_ID":   "38060453",
    "TELEGRAM_API_HASH": "49dbb07f2d226a968571b11eab076d73",
    "TELEGRAM_SESSION":  "1BVtsOMEBu7v_GE-N-rKulnkKK3O-sBE1PMqnCjRi2VApCCU0bXDDsVf61kLHRzOllToqERAfbUmz3ZK0rsQxyPP-GNs--6bG82sdQ5TvuLIE9DZCgWHYZxaN4DjR5NheaWZHRgzt995kE_tgxiLHevhRdpcgb6lEjSgHHN0YtKaOzgHhV4-rzjWuH7HJjXOVK-MHjVXJ8H2oGFe0kXFxETnmCKAr_esBcwvGoLJYPiXyCtIuKQQVOItx6OB9WruotkeO3I1JVcgFu3S96QvfhqqsKkXc_vEP4d-u9S-ZvqvrYJSEf2u-6z0YScZwIrsiGUAYnDUy5ylUEVXkAXN3A5vTNSBEqPk=",
    "APPS_SCRIPT_URL":   "https://script.google.com/macros/s/AKfycbxKj5w2n9a3xhoPlJN2MQNf2q4HK5cYL8Dxl_5KB0XqZyV6lG7xnjXGtlpfv7VUM8Q1fA/exec",
    "REFUEL_APPS_SCRIPT_URL": "https://script.google.com/macros/s/AKfycbzZmFwP0j_Vr_m9mhQczzuVKFVoc7rNfVsz_HyM4JQTcgcdEFh8Zb5bNM5dsfHxZlxk/exec",
}

headers = {
    "Authorization": f"token {PAT}",
    "Accept": "application/vnd.github.v3+json",
}

# Get repo public key
pk_url = f"https://api.github.com/repos/{OWNER}/{REPO}/actions/secrets/public-key"
pk_resp = requests.get(pk_url, headers=headers)
print(f"Public key: {pk_resp.status_code}")
pk_data = pk_resp.json()
key_id  = pk_data["key_id"]
pub_key = pk_data["key"]

def encrypt_secret(pub_key_b64: str, secret: str) -> str:
    pk = public.PublicKey(pub_key_b64.encode("utf-8"), encoding.Base64Encoder())
    box = public.SealedBox(pk)
    encrypted = box.encrypt(secret.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")

for name, value in SECRETS.items():
    enc = encrypt_secret(pub_key, value)
    url = f"https://api.github.com/repos/{OWNER}/{REPO}/actions/secrets/{name}"
    r   = requests.put(url, headers=headers, json={"encrypted_value": enc, "key_id": key_id})
    status = "✅ OK" if r.status_code in (201, 204) else f"❌ {r.status_code} {r.text[:100]}"
    print(f"{name}: {status}")

print("\nDone!")
