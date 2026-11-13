import os
import re
import json
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, unquote

BASE_URL = "https://invat.antem.org"
USERNAME = "rmo84791"
PASSWORD = "rmo847912026"
COURSE_DATA_FILE = "public/course_data.json"
MEDIA_DIR = "public/media"

os.makedirs(MEDIA_DIR, exist_ok=True)

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
})

def login():
    print("[1] Logging in to invat.antem.org...")
    login_url = f"{BASE_URL}/login/index.php"
    r = session.get(login_url)
    soup = BeautifulSoup(r.text, "html.parser")
    token_input = soup.find("input", {"name": "logintoken"})
    if not token_input:
        raise Exception("logintoken not found")
    
    token = token_input["value"]
    payload = {
        "anchor": "",
        "logintoken": token,
        "username": USERNAME,
        "password": PASSWORD
    }
    r_post = session.post(login_url, data=payload)
    if "login/index.php" in r_post.url:
        raise Exception("Login failed: invalid username or password")
    print("[1] Login successful!")

def download_media(url, save_filename):
    save_path = os.path.join(MEDIA_DIR, save_filename)
    if os.path.exists(save_path) and os.path.getsize(save_path) > 0:
        return True
    try:
        r = session.get(url, stream=True, timeout=20)
        if r.status_code == 200:
            with open(save_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=16384):
                    f.write(chunk)
            return True
        else:
            print(f"      [WARN] HTTP {r.status_code} for {url}")
            return False
    except Exception as e:
        print(f"      [ERROR] Failed to download {url}: {e}")
        return False

def sync_activity(act):
    act_id = act.get("id")
    if not act_id or not re.match(r"^\d+$", str(act_id)):
        return False

    url = f"{BASE_URL}/mod/hotpot/attempt.php?id={act_id}"
    try:
        r = session.get(url, timeout=25)
        if r.status_code != 200:
            print(f"  [WARN] Activity {act_id} returned HTTP {r.status_code}")
            return False
    except Exception as e:
        print(f"  [ERROR] Activity {act_id} fetch failed: {e}")
        return False

    soup = BeautifulSoup(r.text, "html.parser")
    
    # Check if we were redirected to a page without content
    if "attempt.php" not in r.url and "view.php" in r.url:
        return False

    # Find all images
    img_replacements = {}
    new_media_list = list(act.get("media", []))

    for img in soup.find_all("img"):
        src = img.get("src", "")
        if not src or "theme/image.php" in src or "gravatar.com" in src or "pix.php" in src:
            continue
        full_url = urljoin(url, src)
        clean_url = full_url.split("?")[0]
        base_name = os.path.basename(unquote(clean_url))
        if not base_name or "." not in base_name:
            continue

        # Scoped filename to avoid any collision
        scoped_filename = f"act_{act_id}_{base_name}"
        ok = download_media(full_url, scoped_filename)
        if ok:
            img_replacements[base_name] = scoped_filename
            img_replacements[src] = f"media/{scoped_filename}"
            if scoped_filename not in new_media_list:
                new_media_list.append(scoped_filename)
            if base_name in new_media_list:
                new_media_list.remove(base_name)

    # Find audio files
    for aud in soup.find_all(["audio", "source"]):
        src = aud.get("src", "")
        if not src:
            continue
        full_url = urljoin(url, src)
        clean_url = full_url.split("?")[0]
        base_name = os.path.basename(unquote(clean_url))
        if not base_name or "." not in base_name:
            continue
        download_media(full_url, base_name)
        if base_name not in new_media_list:
            new_media_list.append(base_name)

    # Replace image paths in bodyHtml and readingHtml
    body_html = act.get("bodyHtml", "") or ""
    reading_html = act.get("readingHtml", "") or ""

    for old_name, new_name in img_replacements.items():
        # Replace media/old_name with media/new_name
        body_html = re.sub(
            r'(src=["\'])media/' + re.escape(old_name) + r'(["\'])',
            r'\1media/' + new_name + r'\2',
            body_html
        )
        body_html = re.sub(
            r'(src=["\'])' + re.escape(old_name) + r'(["\'])',
            r'\1media/' + new_name + r'\2',
            body_html
        )
        reading_html = re.sub(
            r'(src=["\'])media/' + re.escape(old_name) + r'(["\'])',
            r'\1media/' + new_name + r'\2',
            reading_html
        )
        reading_html = re.sub(
            r'(src=["\'])' + re.escape(old_name) + r'(["\'])',
            r'\1media/' + new_name + r'\2',
            reading_html
        )

    act["bodyHtml"] = body_html
    act["readingHtml"] = reading_html
    act["media"] = new_media_list
    return len(img_replacements) > 0

def main():
    login()
    with open(COURSE_DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    total_updated = 0
    total_checked = 0

    print(f"\n[2] Scanning {len(data['sections'])} sections...")
    for s_idx, sec in enumerate(data["sections"]):
        sec_title = sec.get("title", f"Section {s_idx}")
        print(f"\n--- Section {s_idx}: {sec_title} ---")
        for a_idx, act in enumerate(sec.get("activities", [])):
            total_checked += 1
            act_id = act.get("id")
            act_title = act.get("title")
            changed = sync_activity(act)
            if changed:
                total_updated += 1
                print(f"  [OK] Activity {act_id} ({act_title}) updated with scoped images.")
            else:
                print(f"  [-] Activity {act_id} ({act_title}) checked.")

            # Save incrementally every 10 activities
            if total_checked % 10 == 0:
                with open(COURSE_DATA_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

    with open(COURSE_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n[DONE] Checked {total_checked} activities. Updated {total_updated} activities with verified images.")

if __name__ == "__main__":
    main()

