# backend/ai_scripts/ai_processor.py
import sys
import json
import os
import re
import time
from docx import Document
from PyPDF2 import PdfReader

# --- AI Model Initialization ---
summarizer = None
try:
    from transformers import pipeline
    summarizer = pipeline("summarization", model="sshleifer/distilbart-cnn-6-6")
except Exception as e:
    sys.stderr.write(f"ERROR (Python AI): Failed to load summarization model. Summaries will be disabled. Error: {e}\n")
# --- End AI Model Initialization ---

def extract_text_from_pdf(pdf_path):
    text = ""
    try:
        with open(pdf_path, 'rb') as file:
            reader = PdfReader(file)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        sys.stderr.write(f"ERROR (Python AI): Error extracting text from PDF: {e}\n")
    return text

def extract_text_from_docx(docx_path):
    text = ""
    try:
        doc = Document(docx_path)
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
    except Exception as e:
        sys.stderr.write(f"ERROR (Python AI): Error extracting text from DOCX: {e}\n")
    return text

def generate_ai_summary(text):
    if not summarizer:
        return "AI summarizer model could not be loaded."
    if not text or not text.strip():
        return "No text was provided to summarize."
    try:
        if len(text.split()) < 50:
            return ' '.join(text.split('.')[:3]) + '.'
        max_input_chars = 4000
        input_text = text[:max_input_chars]
        summary_result = summarizer(input_text, max_length=150, min_length=40, do_sample=False)
        return summary_result[0]['summary_text']
    except Exception:
        return "AI summary could not be generated for this document."

def predict_case_type(text):
    text_lower = text.lower()
    if 'criminal' in text_lower or 'bail' in text_lower or 'fir' in text_lower or 'offence' in text_lower: return "Criminal"
    if 'civil petition' in text_lower or 'writ petition' in text_lower or 'civil suit' in text_lower: return "Civil"
    if any(keyword in text_lower for keyword in ['company', 'corporate']): return "Corporate"
    if any(keyword in text_lower for keyword in ['property', 'land', 'revenue']): return "Property"
    if any(keyword in text_lower for keyword in ['divorce', 'custody', 'family']): return "Family"
    return "Other"

def predict_outcome(text):
    text_lower = text.lower()
    # **FIX:** Check for more specific outcomes first to avoid incorrect matches.
    if 'bail application is allowed' in text_lower or 'petition is granted' in text_lower: return "Favorable"
    if 'become infructuous' in text_lower: return "Disposed (Infructuous)"
    if any(keyword in text_lower for keyword in ['acquitted', 'allowed', 'set aside', 'successful']): return "Favorable"
    if any(keyword in text_lower for keyword in ['convicted', 'upheld', 'denied', 'dismissed', 'unfavorable']): return "Unfavorable"
    if any(keyword in text_lower for keyword in ['settlement', 'mediation', 'compromise']): return "Settlement"
    return "Pending"

def extract_party_names(text):
    # **FIX:** A much more robust regex that can handle newlines and different spacing.
    pattern = re.compile(r'([\w\s,./\r\n]+?)\s*\.{3}Petitioner\(s\)\s*Versus\s*([\w\s,./\r\n]+?)\s*\.{3}Respondent\(s\)', re.DOTALL | re.IGNORECASE)
    match = pattern.search(text)
    if match:
        party1 = ' '.join(match.group(1).strip().splitlines()).strip()
        party2 = ' '.join(match.group(2).strip().splitlines()).strip()
        return {"party1": party1, "party2": party2}
    return {"party1": "Not Found", "party2": "Not Found"}

def extract_legal_sections(text):
    patterns = [ r'Order\s+[A-Z]+\s+Rule\s+\d+\s+of\s+the\s+Supreme\s+Court\s+Rules,\s+\d{4}', r'\d{4}\s+SCMR\s+\d+', r'Section\s+\d+[\w-]*\b', r'Article\s+\d+[\w-]*\b', r'Rule\s+\d+[\w-]*\b', r'\b\d+[\w-]*\s+(?:PPC|CrPC|CPC|QSO)\b' ]
    all_sections = []
    for pattern in patterns:
        found = re.findall(pattern, text, re.IGNORECASE)
        if found: all_sections.extend(found)
    return list(dict.fromkeys(all_sections)) if all_sections else ["Not Found"]

def predict_winning_party(text, parties):
    if not text or parties.get('party1', 'Not Found') == "Not Found": return "Analysis not possible"
    f_kw = ['granted', 'allowed', 'acquitted', 'successful', 'in favor of', 'bail application is allowed']
    u_kw = ['dismissed', 'rejected', 'denied', 'convicted', 'against', 'failed']
    s_p1 = sum(1 for kw in f_kw if kw in text.lower())
    s_p2 = sum(1 for kw in u_kw if kw in text.lower())
    if s_p1 > s_p2: return f"Appears stronger for {parties['party1']} (Petitioner)"
    if s_p2 > s_p1: return f"Appears stronger for {parties['party2']} (Respondent)"
    if 'infructuous' in text.lower(): return "Case became infructuous; no winning party."
    return "Outcome appears neutral or unclear"

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(1)
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(json.dumps({"error": f"File not found: {file_path}"})); sys.exit(1)

    file_extension = os.path.splitext(file_path)[1].lower()
    if file_extension == '.pdf': extracted_text = extract_text_from_pdf(file_path)
    elif file_extension in ['.docx', '.doc']: extracted_text = extract_text_from_docx(file_path)
    else: print(json.dumps({"error": f"Unsupported file type: {file_extension}"})); sys.exit(1)
    
    if not extracted_text.strip():
        aiData = { "error": "Text extraction failed or document is empty." }
    else:
        parties = extract_party_names(extracted_text)
        aiData = {
            "summary": generate_ai_summary(extracted_text),
            "predictedCaseType": predict_case_type(extracted_text),
            "predictedOutcome": predict_outcome(extracted_text),
            "parties": parties,
            "sections": extract_legal_sections(extracted_text),
            "winningPartyPrediction": predict_winning_party(extracted_text, parties),
        }
    print(json.dumps(aiData))