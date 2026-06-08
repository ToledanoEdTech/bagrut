#!/usr/bin/env python3
"""Parse curriculum Excel into structured JSON for seeding."""
import json
from pathlib import Path

import openpyxl

SHEET_TO_PATH = {
    'תוכנית היבחנות חובה מב"ר, חנ"מ': "meubar_hinuch",
    "תוכנית היבחנות גמיש מתמטיקה אנגלית ומגמות": "flexible",
    "תוכנית היבחנות חובה רגילה": "regular",
    "תוכנית היבחנות חובה בית מדרש": "beit_midrash",
}

PATH_LABELS = {
    "meubar_hinuch": 'מב"ר / חנ"מ',
    "flexible": "גמיש (מתמטיקה, אנגלית, מגמות)",
    "regular": "רגילה",
    "beit_midrash": "בית מדרש",
}


def clean(val):
    if val is None or val == "":
        return None
    s = str(val).strip()
    if s.endswith(".0") and s[:-2].replace(".", "").isdigit():
        s = s[:-2]
    return s if s else None


def parse_percent(val):
    if val is None:
        return None
    s = str(val).strip().replace("%", "")
    try:
        f = float(s)
        if f <= 1:
            return round(f * 100, 2)
        return round(f, 2)
    except ValueError:
        return None


def is_units_number(val):
    if not val:
        return False
    s = str(val).strip().replace(".0", "")
    return s.isdigit() and 0 < int(s) <= 10


def is_header_row(row):
    joined = " ".join(str(c or "") for c in row[:6])
    return "מספר שאלון" in joined or "מספר יחידות" in joined


def is_subject_header(row):
    first = clean(row[0]) if row else None
    if not first:
        return False
    if first in ("מספר יחידות", "מספר שאלון"):
        return False
    if is_header_row(row):
        return True
    if len(row) > 1 and clean(row[1]) == "מספר יחידות":
        return True
    return False


def start_subject(name, units=None):
    return {"name": name, "units": units, "obligations": []}


def parse_sheet(rows):
    subjects = []
    current_subject = None
    current_obligation = None

    i = 0
    while i < len(rows):
        row = rows[i]
        first = clean(row[0]) if row else None
        second = clean(row[1]) if len(row) > 1 else None

        if is_subject_header(row):
            name = first
            units = None
            if second and is_units_number(second):
                units = int(float(second))
            current_subject = start_subject(name, units)
            subjects.append(current_subject)
            current_obligation = None
            i += 1
            continue

        if not current_subject:
            i += 1
            continue

        # Unit-level sub-section (מתמטיקה/אנגלית with 3,4,5 יח"ל)
        if not first and second and is_units_number(second):
            new_units = int(float(second))
            if current_subject["units"] is None:
                current_subject["units"] = new_units
            elif current_subject["units"] != new_units:
                current_subject = start_subject(current_subject["name"], new_units)
                subjects.append(current_subject)
                current_obligation = None

        questionnaire = clean(row[2]) if len(row) > 2 else None
        weight = parse_percent(row[3]) if len(row) > 3 else None
        event_name = clean(row[4]) if len(row) > 4 else None
        score_weight = parse_percent(row[5]) if len(row) > 5 else None
        score_component = clean(row[6]) if len(row) > 6 else None
        exam_type = clean(row[7]) if len(row) > 7 else None
        study_material = clean(row[8]) if len(row) > 8 else None
        exam_event = clean(row[9]) if len(row) > 9 else None
        grade_year = clean(row[10]) if len(row) > 10 else None

        has_questionnaire = questionnaire and questionnaire.replace(".", "").isdigit()

        if has_questionnaire or (weight is not None and not score_component and score_weight is None):
            if weight is None and has_questionnaire:
                weight = 100.0

            current_obligation = {
                "questionnaireNumber": questionnaire if has_questionnaire else None,
                "weightPercent": weight or 0,
                "eventName": event_name,
                "examType": exam_type or "פנימי",
                "studyMaterial": study_material,
                "examEvent": exam_event,
                "gradeYear": grade_year,
                "components": [],
                "subItems": [],
            }
            if score_component and score_weight is not None:
                current_obligation["components"].append({
                    "name": score_component,
                    "weightPercent": score_weight,
                })
            current_subject["obligations"].append(current_obligation)
        elif current_obligation:
            if score_component and score_weight is not None:
                current_obligation["components"].append({
                    "name": score_component,
                    "weightPercent": score_weight,
                })
            elif event_name and weight is not None and not has_questionnaire:
                current_obligation["subItems"].append({
                    "name": event_name,
                    "weightPercent": weight,
                })
            elif study_material and weight is not None and score_component:
                current_obligation["subItems"].append({
                    "name": study_material,
                    "weightPercent": weight,
                })

        i += 1

    return subjects


def main():
    xlsx = Path(__file__).parent.parent / "data" / "curriculum.xlsx"
    wb = openpyxl.load_workbook(xlsx)
    output = {"paths": []}

    path_keys = list(SHEET_TO_PATH.values())
    for idx, path_key in enumerate(path_keys):
        ws = wb.worksheets[idx]
        sheet_name = ws.title
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        subjects = parse_sheet(rows)
        output["paths"].append({
            "key": path_key,
            "label": PATH_LABELS[path_key],
            "sheetName": sheet_name,
            "subjects": subjects,
        })

    out_path = Path(__file__).parent.parent / "data" / "curriculum_parsed.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    total_subjects = sum(len(p["subjects"]) for p in output["paths"])
    total_obligations = sum(
        len(s["obligations"]) for p in output["paths"] for s in p["subjects"]
    )
    print(f"Parsed {len(output['paths'])} paths, {total_subjects} subjects, {total_obligations} obligations")
    print(f"Written to {out_path}")


if __name__ == "__main__":
    main()
