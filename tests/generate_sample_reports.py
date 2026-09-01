from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

output_dir = Path("/home/sorbat30/.gemini/antigravity/scratch/AI-Powered-Healthcare-Intake-System/tests/sample_reports")
output_dir.mkdir(parents=True, exist_ok=True)

# 1. Generate Sample Blood Report Image
img_report = Image.new("RGB", (900, 700), color=(255, 255, 255))
draw = ImageDraw.Draw(img_report)

# Header
draw.rectangle([(0, 0), (900, 80)], fill=(30, 60, 110))
draw.text((40, 20), "METROPOLIS PATHOLOGY & DIAGNOSTICS LAB", fill=(255, 255, 255))
draw.text((40, 48), "ISO 9001:2015 Certified | Patient Intake Report ID: LAB-2026-9812", fill=(220, 230, 250))

# Demographics Box
draw.rectangle([(40, 100), (860, 180)], outline=(180, 180, 180), width=2)
draw.text((60, 115), "Patient Name: Rahul Verma                 Age/Gender: 45 / Male", fill=(0, 0, 0))
draw.text((60, 135), "Referred By: Dr. A. K. Sharma, MD          Date: 01-Sep-2026", fill=(0, 0, 0))
draw.text((60, 155), "Sample Type: EDTA Whole Blood & Serum    Status: Completed", fill=(0, 0, 0))

# Table Headers
draw.rectangle([(40, 200), (860, 230)], fill=(230, 240, 250))
draw.text((60, 208), "TEST PARAMETER", fill=(0, 50, 100))
draw.text((360, 208), "RESULT", fill=(0, 50, 100))
draw.text((500, 208), "UNIT", fill=(0, 50, 100))
draw.text((650, 208), "REFERENCE RANGE", fill=(0, 50, 100))

# Table Rows
rows = [
    ("Hemoglobin (Hb)", "8.5 (LOW)", "g/dL", "13.5 - 17.5"),
    ("Total WBC Count", "14,800 (HIGH)", "/uL", "4,000 - 11,000"),
    ("Platelet Count", "92,000 (LOW)", "/uL", "150,000 - 450,000"),
    ("Fasting Blood Sugar (FBS)", "148 (HIGH)", "mg/dL", "70 - 99"),
    ("HbA1c (Glycated Hb)", "7.8 % (HIGH)", "%", "4.0 - 5.6"),
    ("Serum Creatinine", "1.1", "mg/dL", "0.7 - 1.3"),
    ("Serum Sodium (Na+)", "138", "mEq/L", "135 - 145"),
    ("Serum Potassium (K+)", "4.2", "mEq/L", "3.5 - 5.1"),
]

y = 245
for param, result, unit, ref in rows:
    color = (200, 0, 0) if "HIGH" in result or "LOW" in result else (0, 0, 0)
    draw.text((60, y), param, fill=(0, 0, 0))
    draw.text((360, y), result, fill=color)
    draw.text((500, y), unit, fill=(80, 80, 80))
    draw.text((650, y), ref, fill=(80, 80, 80))
    draw.line([(40, y + 25), (860, y + 25)], fill=(230, 230, 230), width=1)
    y += 32

# Clinical Summary / Impression
draw.rectangle([(40, 530), (860, 650)], fill=(255, 245, 240), outline=(230, 150, 130), width=2)
draw.text((60, 545), "CLINICAL IMPRESSION & ADVISORY:", fill=(150, 0, 0))
draw.text((60, 570), "1. Moderate Anemia with Leukocytosis (Elevated WBC suggesting active infection).", fill=(0, 0, 0))
draw.text((60, 595), "2. Thrombocytopenia (Mild to Moderate Low Platelets) — Clinical correlation required.", fill=(0, 0, 0))
draw.text((60, 620), "3. Uncontrolled Glycemia (HbA1c 7.8%) — Endocrinology consultation recommended.", fill=(0, 0, 0))

report_path = output_dir / "sample_blood_report.png"
img_report.save(report_path)
print(f"Generated: {report_path}")

# 2. Generate Sample Doctor Prescription Image
img_rx = Image.new("RGB", (900, 680), color=(255, 255, 255))
draw_rx = ImageDraw.Draw(img_rx)

# Doctor Header
draw_rx.rectangle([(0, 0), (900, 90)], fill=(20, 80, 60))
draw_rx.text((40, 20), "DR. SANJAY MEHTA, MD (INTERNAL MEDICINE)", fill=(255, 255, 255))
draw_rx.text((40, 48), "Reg No: MMC-84721 | City Medical Clinic & Hospital", fill=(220, 250, 230))
draw_rx.text((40, 68), "Contact: +91-98200-11223 | Date: 01-Sep-2026", fill=(200, 240, 210))

# Patient Details
draw_rx.text((40, 110), "Patient: Mrs. Sunita Patel | Age: 52 yrs | Gender: Female | Weight: 64 kg", fill=(0, 0, 0))
draw_rx.line([(40, 135), (860, 135)], fill=(100, 100, 100), width=2)

# Diagnosis
draw_rx.text((40, 150), "DIAGNOSIS / CHIEF COMPLAINTS:", fill=(0, 60, 120))
draw_rx.text((60, 175), "• Acute Bronchial Infection with Productive Cough (3 Days)", fill=(0, 0, 0))
draw_rx.text((60, 198), "• Low Grade Fever (100.4 F) and Fatigue", fill=(0, 0, 0))

# Rx Symbol
draw_rx.text((40, 235), "Rx (MEDICATIONS PRESCRIBED):", fill=(180, 0, 0))

meds = [
    ("1. Tab. Amoxicillin + Clavulanate 625mg", "1 tablet - Twice daily (After Meals)", "5 Days"),
    ("2. Tab. Paracetamol 650mg (Dolo)", "1 tablet - Thrice daily when fever > 100 F", "3 Days"),
    ("3. Cap. Pantoprazole 40mg (Pan-40)", "1 capsule - Once daily in morning (Empty Stomach)", "7 Days"),
    ("4. Syr. Benadryl Cough Formula 10ml", "2 teaspoonfuls - Thrice daily after meals", "5 Days"),
    ("5. Tab. Cetirizine 10mg", "1 tablet - Once daily at bedtime", "5 Days"),
]

y_rx = 275
for med, dose, dur in meds:
    draw_rx.text((60, y_rx), med, fill=(0, 0, 0))
    draw_rx.text((480, y_rx), dose, fill=(0, 100, 50))
    draw_rx.text((750, y_rx), dur, fill=(100, 100, 100))
    draw_rx.line([(40, y_rx + 25), (860, y_rx + 25)], fill=(240, 240, 240), width=1)
    y_rx += 34

# General Advice
draw_rx.rectangle([(40, 470), (860, 570)], fill=(245, 255, 250), outline=(100, 180, 140), width=2)
draw_rx.text((60, 485), "SPECIAL INSTRUCTIONS & ADVICE:", fill=(0, 100, 50))
draw_rx.text((60, 510), "1. Drink plenty of warm fluids and steam inhalation twice daily.", fill=(0, 0, 0))
draw_rx.text((60, 535), "2. Complete full course of antibiotics (Amoxicillin 625mg) even if symptoms improve.", fill=(0, 0, 0))

# Doctor Signature
draw_rx.text((680, 610), "Dr. Sanjay Mehta", fill=(0, 50, 100))
draw_rx.text((680, 630), "[Digitally Signed]", fill=(120, 120, 120))

rx_path = output_dir / "sample_prescription.png"
img_rx.save(rx_path)
print(f"Generated: {rx_path}")
