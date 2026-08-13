import requests

def test_live_auto_copy():
    url = "https://script.google.com/macros/s/AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA/exec?action=run_auto_copy"
    try:
        r = requests.get(url, timeout=45)
        print(f"Status Code: {r.status_code}")
        print(f"Response: {r.text}")
    except Exception as e:
        print(f"Error calling run_auto_copy: {e}")

if __name__ == "__main__":
    test_live_auto_copy()
