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
    print("[1] Авторизация на invat.antem.org...")
    login_url = f"{BASE_URL}/login/index.php"
    resp = session.get(login_url)
    soup = BeautifulSoup(resp.text, "html.parser")
    token_input = soup.find("input", {"name": "logintoken"})
    if not token_input:
        raise Exception("logintoken не найден на странице логина")
    
    token = token_input["value"]
    payload = {
        "anchor": "",
        "logintoken": token,
        "username": USERNAME,
        "password": PASSWORD
    }
    resp_post = session.post(login_url, data=payload)
    if "login/index.php" in resp_post.url:
        raise Exception("Ошибка авторизации: неверный логин или пароль")
    print("Успешная авторизация!")

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
                print(f"    Скачан медиа-файл: {filename}")
        return filename
    except Exception as e:
        print(f"    Ошибка скачивания медиа {url}: {e}")
        return None

def parse_hotpot(html, mod_id, title):
    soup = BeautifulSoup(html, "html.parser")
    
    # Извлечение заголовка и инструкций
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

    # Поиск медиафайлов (аудио, изображения)
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

    # Текст для чтения / чтения диалога (Reading / Story)
    reading_text = ""
    reading_div = soup.find(id="ReadingDiv") or soup.find(id="Reading") or soup.find("div", class_="reading")
    if reading_div:
        reading_text = reading_div.get_text("\n", strip=True)

    # Парсинг JS данных HotPotatoes
    scripts = soup.find_all("script")
    js_content = "\n".join([s.get_text() for s in scripts if s.get_text()])

    # Проверка типа упражнения: JCloze (вставка слов), JQuiz (тест), JMatch (сопоставление)
    exercise_type = "unknown"
    cloze_text = ""
    gaps = []
    questions = []

    # JCloze check
    if "Cloze" in js_content or "I = new Array();" in js_content or soup.find(id="ClozeDiv"):
        exercise_type = "cloze"
        cloze_div = soup.find(id="ClozeDiv")
        if cloze_div:
            # Извлекаем клоз-текст и спаны инпутов
            cloze_text = cloze_div.get_text(strip=True)

        # Извлечение правильных вариантов ответов из I[x][1][y][0] = '\u00...';
        # Пример: I[0][1][0][0] = '\u0043\u0069\u006E\u0065...';
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

    # JQuiz check
    if "I[0][0]" in js_content and not gaps:
        exercise_type = "quiz"

    # Если есть сырой текст упражнения (например диалоги с пропусками)
    return {
        "id": mod_id,
        "title": exercise_title,
        "instructions": instructions,
        "readingText": reading_text,
        "media": media_files,
        "type": exercise_type,
        "gaps": gaps,
        "questions": questions
    }

def main():
    login()
    
    course_url = f"{BASE_URL}/course/view.php?id={COURSE_ID}"
    print(f"[2] Загрузка карты курса {course_url}...")
    r_course = session.get(course_url)
    soup = BeautifulSoup(r_course.text, "html.parser")
    
    # Находим разделы курса (sections / topics)
    sections = []
    section_nodes = soup.find_all("li", class_=lambda c: c and "section" in c and "main" in c)
    if not section_nodes:
        section_nodes = soup.find_all("div", class_="section")

    print(f"Найдено секций: {len(section_nodes)}")
    
    all_activities = []
    
    # Извлечем все ссылки на активности с привязкой к названиям
    activity_links = soup.find_all("a", href=True)
    for a in activity_links:
        href = a["href"]
        if "/mod/hotpot/view.php?id=" in href:
            m_id = href.split("id=")[1].split("&")[0]
            txt = a.get_text(strip=True)
            if txt and not any(act["id"] == m_id for act in all_activities):
                all_activities.append({
                    "id": m_id,
                    "title": txt,
                    "url": href,
                    "type": "hotpot"
                })
        elif "/mod/resource/view.php?id=" in href:
            m_id = href.split("id=")[1].split("&")[0]
            txt = a.get_text(strip=True)
            if txt and not any(act["id"] == m_id for act in all_activities):
                all_activities.append({
                    "id": m_id,
                    "title": txt,
                    "url": href,
                    "type": "resource"
                })

    print(f"Всего обнаружено активностей: {len(all_activities)}")
    print(f"Сохраняем список в activities_list.json...")
    with open(os.path.join(OUTPUT_DIR, "activities_list.json"), "w", encoding="utf-8") as f:
        json.dump(all_activities, f, ensure_ascii=False, indent=2)

    print("Тестовый парсинг первых 5 активностей...")
    results = []
    for act in all_activities[:5]:
        print(f"  -> Обработка [{act['id']}] {act['title']}...")
        if act["type"] == "hotpot":
            attempt_url = f"{BASE_URL}/mod/hotpot/attempt.php?id={act['id']}"
            r_act = session.get(attempt_url)
            parsed = parse_hotpot(r_act.text, act["id"], act["title"])
            results.append(parsed)
            time.sleep(0.3)
            
    with open(os.path.join(OUTPUT_DIR, "sample_extracted.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("Тестовая выгрузка завершена. Файлы сохранены в extracted_course/")

if __name__ == "__main__":
    main()

