import requests

def test_auto_copy_endpoint():
    url = "https://script.google.com/macros/s/AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA/exec"
    payload = {"action": "trigger_auto_copy"}
    try:
        r = requests.post(url, json=payload, timeout=30)
        print(f"Trigger Auto Copy Response: Code {r.status_code}, Text: {r.text}")
    except Exception as e:
        print(f"Error calling trigger_auto_copy: {e}")

if __name__ == "__main__":
    test_auto_copy_endpoint()
