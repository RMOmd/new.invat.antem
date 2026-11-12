import os
import re
import json
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, unquote

BASE_URL = "https://invat.antem.org"
COURSE_ID = 167
USERNAME = "rmo84791"
PASSWORD = "rmo847912026"

OUTPUT_DIR = "f:/romanian_test_platform/extracted_course"
MEDIA_DIR = os.path.join(OUTPUT_DIR, "media")
os.makedirs(MEDIA_DIR, exist_ok=True)

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
})

def login():
    login_url = f"{BASE_URL}/login/index.php"
    resp = session.get(login_url)
    soup = BeautifulSoup(resp.text, "html.parser")
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
    r = session.post(login_url, data=payload)
    if "login/index.php" in r.url:
        raise Exception("Login failed")
    print("Successfully logged in.")

def download_file(url):
    try:
        clean_url = url.split("?")[0]
        filename = os.path.basename(unquote(clean_url))
        if not filename or len(filename) > 80 or "." not in filename:
            filename = f"media_{abs(hash(url))}.mp3"
        local_path = os.path.join(MEDIA_DIR, filename)
        
        if not os.path.exists(local_path):
            r = session.get(url, stream=True, timeout=15)
            if r.status_code == 200:
                with open(local_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
        return filename
    except Exception as e:
        return None

def clean_html_content(soup_el):
    if not soup_el:
        return ""
    # remove unwanted elements
    for el in soup_el(["script", "link", "style"]):
        el.decompose()
    return str(soup_el).strip()

def parse_hotpot(html, mod_id, title):
    soup = BeautifulSoup(html, "html.parser")
    
    # 1. Title & Instructions
    exercise_title = ""
    title_div = soup.find(id="ExerciseTitle") or soup.find(id="ExerciseTitleDiv")
    if title_div:
        exercise_title = title_div.get_text(strip=True)
    if not exercise_title:
        exercise_title = title

    instructions = ""
    inst_div = soup.find(id="Instructions") or soup.find(id="InstructionsDiv")
    if inst_div:
        instructions = inst_div.get_text(strip=True)

    # 2. Media files
    media_files = []
    for audio in soup.find_all(["audio", "source"]):
        src = audio.get("src")
        if src:
            full_src = urljoin(BASE_URL, src)
            fn = download_file(full_src)
            if fn and fn not in media_files:
                media_files.append(fn)

    for link in soup.find_all("a", href=True):
        href = link["href"]
        if any(href.lower().endswith(ext) for ext in [".mp3", ".ogg", ".wav", ".m4a"]):
            full_src = urljoin(BASE_URL, href)
            fn = download_file(full_src)
            if fn and fn not in media_files:
                media_files.append(fn)

    for img in soup.find_all("img"):
        src = img.get("src")
        if src and "theme/image.php" not in src and "gravatar" not in src:
            full_src = urljoin(BASE_URL, src)
            fn = download_file(full_src)
            if fn and fn not in media_files:
                media_files.append(fn)

    # 3. Reading / Text section
    reading_text = ""
    reading_div = soup.find(id="ReadingDiv") or soup.find(id="Reading") or soup.find("div", class_="reading")
    if reading_div:
        reading_text = clean_html_content(reading_div)

    # 4. JavaScript arrays parsing
    scripts = soup.find_all("script")
    js_content = "\n".join([s.get_text() for s in scripts if s.get_text()])

    gaps = []
    exercise_type = "cloze"

    # JCloze pattern: I[gap][1][ans][0] = '\u00...';
    pattern = r"I\[(\d+)\]\[1\]\[(\d+)\]\[0\]\s*=\s*'([^']*)';"
    raw_matches = re.findall(pattern, js_content)
    gap_dict = {}
    for gap_idx, ans_idx, enc_val in raw_matches:
        gap_idx = int(gap_idx)
        val = enc_val.encode('utf-8').decode('unicode_escape')
        if gap_idx not in gap_dict:
            gap_dict[gap_idx] = []
        gap_dict[gap_idx].append(val)
    
    for k in sorted(gap_dict.keys()):
        gaps.append({
            "gapIndex": k,
            "correctAnswers": gap_dict[k]
        })

    # Body HTML
    cloze_body = ""
    body_div = soup.find("div", class_="ClozeBody") or soup.find(id="ClozeDiv") or soup.find(id="MainContent")
    if body_div:
        cloze_body = clean_html_content(body_div)

    return {
        "id": mod_id,
        "title": exercise_title,
        "instructions": instructions,
        "readingHtml": reading_text,
        "bodyHtml": cloze_body,
        "media": media_files,
        "type": exercise_type,
        "gaps": gaps
    }

def main():
    login()
    
    course_url = f"{BASE_URL}/course/view.php?id={COURSE_ID}"
    r_course = session.get(course_url)
    soup = BeautifulSoup(r_course.text, "html.parser")
    
    sections = []
    for sec in soup.find_all(['li', 'div', 'section'], class_=lambda c: c and 'section' in c):
        sec_id = sec.get('id', '')
        if not sec_id or not sec_id.startswith('section-'):
            continue
        
        sec_title_el = sec.find(['h3', 'h4', 'span'], class_=lambda c: c and ('sectionname' in c or 'section-title' in c))
        sec_title = sec_title_el.get_text(strip=True) if sec_title_el else sec_id
        
        acts = []
        for a in sec.find_all('a', href=True):
            href = a['href']
            if '/mod/hotpot/' in href:
                m_id = href.split("id=")[1].split("&")[0]
                name = a.get_text(strip=True)
                if name and not any(x['id'] == m_id for x in acts):
                    acts.append({
                        "id": m_id,
                        "title": name,
                        "url": href,
                        "type": "hotpot"
                    })
            elif '/mod/resource/' in href:
                m_id = href.split("id=")[1].split("&")[0]
                name = a.get_text(strip=True)
                if name and not any(x['id'] == m_id for x in acts):
                    acts.append({
                        "id": m_id,
                        "title": name,
                        "url": href,
                        "type": "resource"
                    })
        if acts:
            sections.append({
                "sectionId": sec_id,
                "title": sec_title,
                "activities": acts
            })

    total_acts = sum(len(s["activities"]) for s in sections)
    print(f"Total sections: {len(sections)}, Total activities to extract: {total_acts}")

    extracted_sections = []
    completed_count = 0

    progress_file = os.path.join(OUTPUT_DIR, "full_course_data.json")

    for s_idx, sec in enumerate(sections, 1):
        print(f"\n[{s_idx}/{len(sections)}] Section: {sec['title']} ({len(sec['activities'])} activities)")
        parsed_activities = []
        
        for act in sec["activities"]:
            completed_count += 1
            print(f"  ({completed_count}/{total_acts}) [{act['id']}] {act['title']}...")
            try:
                if act["type"] == "hotpot":
                    attempt_url = f"{BASE_URL}/mod/hotpot/attempt.php?id={act['id']}"
                    resp = session.get(attempt_url, timeout=20)
                    if resp.status_code == 200:
                        parsed = parse_hotpot(resp.text, act["id"], act["title"])
                        parsed_activities.append(parsed)
                    else:
                        print(f"    Warning: HTTP {resp.status_code}")
                elif act["type"] == "resource":
                    res_url = f"{BASE_URL}/mod/resource/view.php?id={act['id']}"
                    resp = session.get(res_url, timeout=20)
                    parsed_activities.append({
                        "id": act["id"],
                        "title": act["title"],
                        "type": "resource",
                        "url": resp.url
                    })
            except Exception as e:
                print(f"    Error parsing {act['id']}: {e}")
            
            time.sleep(0.15)
        
        extracted_sections.append({
            "sectionId": sec["sectionId"],
            "title": sec["title"],
            "activities": parsed_activities
        })
        
        # Save progress after each section
        with open(progress_file, "w", encoding="utf-8") as f:
            json.dump({
                "courseId": COURSE_ID,
                "courseTitle": "A1+: Румынский язык",
                "extractedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
                "totalSections": len(sections),
                "sections": extracted_sections
            }, f, ensure_ascii=False, indent=2)

    print("\nExtraction complete! All course data saved to full_course_data.json.")

if __name__ == "__main__":
    main()

