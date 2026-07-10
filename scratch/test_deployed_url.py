import requests

url = "https://script.google.com/macros/s/AKfycby-LD5hgQj8Hv9MkuFa0GXd3EPbnbnZa5gnHgjEd43isbBBETUQttM5EF_h6DZ4R8EI5w/exec"
try:
    resp = requests.get(url, params={"action": "get_refuel_data"}, timeout=20)
    resp.raise_for_status()
    print("Response:", resp.json())
except Exception as e:
    print("Error:", e)
