import os

def find_script():
    search_dir = r"d:\6. AI"
    target_id = "1P4KGJzZhoCWqD9NpOffrD60dO2-QB1yPOg5v6zP7TH0"
    target_name1 = "Input ICT"
    target_name2 = "Update ICT"
    
    print(f"🔍 Starting scan in {search_dir}...")
    found_files = []
    
    for root, dirs, files in os.walk(search_dir):
        # Skip pycache and git
        if ".git" in root or "__pycache__" in root:
            continue
        for file in files:
            if file.endswith(".py"):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        if target_id in content or target_name1 in content or target_name2 in content:
                            print(f"⭐ Found matching script: {file_path}")
                            found_files.append(file_path)
                except Exception as e:
                    pass
                    
    if not found_files:
        print("❌ No matching Python files found in D:\\6. AI.")
    else:
        print(f"✅ Search finished. Found {len(found_files)} file(s).")

if __name__ == "__main__":
    find_script()
