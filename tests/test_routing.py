"""
tests/test_routing.py
======================
Automated Unit Tests for TNI Bot Search Engine Routing & Exact Anchoring.
Ensures zero-regression on search routing logic.
"""

import sys
import os

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tni_search_core import classify_query, is_duplicate_search

def test_info_routing():
    res1 = classify_query("INFO: TNI0061")
    assert res1["action"] == "INFO", f"Expected INFO, got {res1['action']}"
    assert res1["code"] == "TNI0061"

    res2 = classify_query("info: TNI0061_01")
    assert res2["action"] == "INFO"
    assert res2["code"] == "TNI0061_01"

    res3 = classify_query("/info TNI0122")
    assert res3["action"] == "INFO"
    assert res3["code"] == "TNI0122"

def test_clear_routing():
    res1 = classify_query("clear TNI0061")
    assert res1["action"] == "CLEAR"
    assert res1["code"] == "TNI0061"

    res2 = classify_query("CLEAR: TNI0061")
    assert res2["action"] == "CLEAR"
    assert res2["code"] == "TNI0061"

def test_tni_routing():
    res1 = classify_query("TNI0061")
    assert res1["action"] == "TNI"
    assert res1["code"] == "TNI0061"

    res2 = classify_query("/tni TNI0061_02")
    assert res2["action"] == "TNI"
    assert res2["code"] == "TNI0061_02"

def test_noise_rejection():
    # Long text with extra words should NOT trigger TNI exact match
    res1 = classify_query("TNI0061 440L")
    assert res1["action"] == "IGNORE", f"Expected IGNORE for noise, got {res1['action']}"

    res2 = classify_query("TNI0061 door open")
    assert res2["action"] == "IGNORE"

    res3 = classify_query("Please check TNI0061 status")
    assert res3["action"] == "IGNORE"

def test_admin_lookup():
    res1 = classify_query("mydata 123456789")
    assert res1["action"] == "ADMIN_LOOKUP"
    assert res1["target_id"] == "123456789"
    assert res1["field"] == "mydata"

    res2 = classify_query("/mysite 987654321")
    assert res2["action"] == "ADMIN_LOOKUP"
    assert res2["target_id"] == "987654321"
    assert res2["field"] == "mysite"

def test_dedup_cache():
    chat_id = 99999
    user_id = 88888
    query = "TNI0061"
    
    # First search -> Not duplicate
    assert not is_duplicate_search(chat_id, user_id, query, ttl=2.0)
    # Immediate repeat -> Duplicate!
    assert is_duplicate_search(chat_id, user_id, query, ttl=2.0)

if __name__ == "__main__":
    print("Running TNI Bot Search Routing Tests...")
    test_info_routing()
    print("  [PASS] test_info_routing")
    test_clear_routing()
    print("  [PASS] test_clear_routing")
    test_tni_routing()
    print("  [PASS] test_tni_routing")
    test_noise_rejection()
    print("  [PASS] test_noise_rejection")
    test_admin_lookup()
    print("  [PASS] test_admin_lookup")
    test_dedup_cache()
    print("  [PASS] test_dedup_cache")
    print("\n==========================================")
    print("ALL ROUTING TESTS PASSED PERFECTLY! [100%]")
    print("==========================================")
