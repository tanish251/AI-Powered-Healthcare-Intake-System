# 🧪 PS47 Medical Engine — Live OCR Information Extraction Demo Results

**Execution Timestamp**: 2026-09-01 14:38:33

**OCR Architecture**: PaddleOCR-VL-0.9B Vision Language Model + TrOCR Multi-Pass Consensus

---

## 📄 Laboratory Blood Report (`sample_blood_report.png`)

- **Patient ID**: `PATIENT_BLOOD_TEST_001`
- **OCR Processing Time**: `6457.27 ms`
- **Extracted Spans Count**: `1`

### Extracted Text Span 1

```text
METROPOLIS PATHOLOGY & DIAGNOSTICS LAB
ISO 9001:2015 Certified | Patient Intake Report ID: LAB-2026-9812
Patient Name: Rahul Verma Age/Gender: 45 / Male
Referred By: Dr. A K Sharma, MD Date: 01-Sep-2026
Sample Type: EDTA Whole Blood & Serum Status: Completed
TEST PARAMETER
RESULT
UNIT
REFERENCE RANGE
Hemoglobin (Hb)
8.5 (LOW)
g/dL
13.5 - 17.5
Total WBC Count
14,800 (HIGH)
/uL
4,000 - 11,000
Platelet Count
92,000 (LOW)
/uL
150,000 - 450,000
Fasting Blood Sugar (FBS)
148 (HIGH)
mg/dL
70 - 99
HbA1c (Glycated Hb)
7.8% (HIGH)
%
4.0 - 5.6
Serum Creatinine
1.1
mg/dL
0.7 - 1.3
Serum Sodium (Na+)
138
mEq/L
135 - 145
Serum Potassium (K+)
4.2
mEq/L
3.5 - 5.1
CLINICAL IMPRESSION & ADVISORY:
1. Moderate Anemia with Leukocytosis (Elevated WBC suggesting active infection).
2. Thrombocytopenia (Mild to Moderate Low Platelets) Clinical correlation required.
3. Uncontrolled Glycemia (HbA1c 7.8%) & Endocrinology consultation recommended.
```

- **Confidence Score**: `0.763`
- **Consensus Status**: `VERIFIED`
- **OCR Engine Used**: `paddleocr-vl-0.9b`
- **Agreement Ratio**: `1.0`

---

## 📄 Medical Doctor Prescription (`sample_prescription.png`)

- **Patient ID**: `PATIENT_PRESCRIPTION_002`
- **OCR Processing Time**: `3503.22 ms`
- **Extracted Spans Count**: `1`

### Extracted Text Span 1

```text
DR SANJAY MEHTA MD (INTERNAL MEDICINE)  
Reg No: MMC-84721 | City Medical Clinic & Hospital  
Contact: +91-98200-11223 | Date: 01-Sep-2026  
Patient: Mrs. Sunita Patel | Age: 52 yrs | Gender: Female | Weight: 64 kg  
DIAGNOSIS/CHIEF COMPLAINTS:  
℗ Acute Bronchial Infection with Productive Cough (3 Days)  
℗ Low Grade Fever (100.4 F) and Fatigue  
Rx (MEDICATIONS PRESCRIBED):  
1. Tab. Amoxicillin + Clavulanate 625mg  
1 tablet - Twice daily (After Meals)  
5 Days  
2. Tab. Paracetamol 650mg (Dolo)  
1 tablet - Thrice daily when fever > 100 F  
3 Days  
3. Cap. Pantoprazole 40mg (Pan-40)  
1 capsule - Once daily in morning (Empty Stomach)  
7 Days  
4. Syr. Benadryl Cough Formula 10ml  
2 teaspoonfuls - Thrice daily after meals  
5 Days  
5. Tab. Cetirizine 10mg  
1 tablet - Once daily at bedtime  
5 Days  
SPECIAL INSTRUCTIONS & ADVICE:  
1. Drink plenty of warm fluids and steam inhalation twice daily.  
2. Complete full course of antibiotics (Amoxicillin 625mg) even if symptoms improve.  
Dr. Sanjay Mehta  
[Digitally Signed]
```

- **Confidence Score**: `0.768`
- **Consensus Status**: `VERIFIED`
- **OCR Engine Used**: `paddleocr-vl-0.9b`
- **Agreement Ratio**: `1.0`

---
