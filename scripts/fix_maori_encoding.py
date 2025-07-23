import sys
import os
import re

# --- Path Setup ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from backend.app.db.session import SessionLocal
from backend.app.models.standard_models import Standard


def create_maori_word_replacements():
    """Create a mapping of common Māori words with '?' back to correct spelling"""
    
    # Common Māori words that appear in NCEA standards
    replacements = {
        # Common words
        'M?ori': 'Maori',
        'wh?nau': 'whanau', 
        'P?keh?': 'Pakeha',
        'kaum?tua': 'kaumatua',
        'wh?nui': 'whanui',
        'w?hi': 'wahi',
        'k?rero': 'korero',
        't?tari': 'totari',
        'p?oro': 'puoro',
        'm?ramatanga': 'maramatanga',
        'r?hia': 'rehia',
        'ataata': 'ataata',
        'p?mau': 'pumau',
        'ahurea': 'ahurea',
        'tikanga': 'tikanga',
        'iwi': 'iwi',
        'tangata': 'tangata',
        'whenua': 'whenua',
        'taiao': 'taiao',
        'rangatira': 'rangatira',
        'p?taiao': 'putaiao',
        'hangarau': 'hangarau',
        'matihiko': 'matihiko',
        'h?ngai': 'hangai',
        't?hua': 'tohua',
        'p?p?tanga': 'puputanga',
        'm?t?pono': 'matupono',
        'whakaawenga': 'whakaawenga',
        'panonitanga': 'panonitanga',
        'whakatairangatanga': 'whakatairangatanga',
        
        # Additional common words from remaining issues
        'Wh?riki': 'Whariki',
        'Te Wh?riki': 'Te Whariki',
        'p?kau': 'pukau',
        'M?tauranga': 'Matauranga',
        'Te M?tauranga': 'Te Matauranga',
        'Wh?nui': 'Whanui',
        'raranga': 'raranga',
        'wh?ngai': 'whangai',
        'Wh?ngai': 'Whangai',
        
        # Third round - more specific patterns
        'p?r?kau': 'purakau',
        'ng?': 'nga',
        'hap?': 'hapu',
        'm?rena': 'morena',
        'k?ngitanga': 'kingitanga',
        'p?whiri': 'powhiri',
        'h?hi': 'huhi',
        't?tika': 'tutika',
        'p?tae': 'putae',
        't?tua': 'tutua',
        'T?niko': 'Tuniko',
        't?kawe': 'tukawe',
        'R?kau': 'Rukau',
        't?me': 'tume',
        'hauk?inga': 'haukuinga',
        '?-Kiko': 'a-Kiko',
        'k?mara': 'kumara',
        'whakatau': 'whakatau',
        'nunumi': 'nunumi',
        'korero': 'korero',
        'tuku': 'tuku',
        'iho': 'iho',
        
        # Fourth round - final patterns
        'M?ui': 'Maui',
        't?tahi': 'tetahi',
        'r?kau': 'rakau',
        'T?roa': 'Turoa',
        'Te Ao T?roa': 'Te Ao Turoa',
        'hui r?': 'hui ra',
        'r? whanau': 'ra whanau',
        'mau r?kau': 'mau rakau',
        'momo r?kau': 'momo rakau',
        '?konga': 'akonga',
        't?roa': 'turoa',
        'ao t?roa': 'ao turoa',
        'm?hiotanga': 'mohiotanga',
        'P?nui': 'Panui',
        'Whakarongo': 'Whakarongo',
        'Tuhituhi': 'Tuhituhi',
        't?hura': 'tuhura',
        'arotake': 'arotake',
        'rautaki': 'rautaki',
        'hiahia': 'hiahia',
        'ahurea': 'ahurea',
        'rongo?': 'rongoa',
        'whakaora': 'whakaora',
        '?huatanga': 'ahuatanga',
        'taukumekume': 'taukumekume',
        'huatau': 'huatau',
        'kukuwhatanga': 'kukuwhatanga',
        'taumata': 'taumata',
        'waenga': 'waenga',
        'tuhinga': 'tuhinga',
        'matatika': 'matatika',
        'hangai': 'hangai',
        'whakataunga': 'whakataunga',
        'matupono': 'matupono',
        'whakamahi': 'whakamahi',
        'tikanga': 'tikanga',
        'taketake': 'taketake',
        'panonitanga': 'panonitanga',
        'hu?nga': 'huanga',
        'k?tuitui': 'kotuitui',
        'waihanga': 'waihanga',
        'motuhake': 'motuhake',
        'whakaputanga': 'whakaputanga',
        'wairua': 'wairua',
        'kikokiko': 'kikokiko',
        'whakaatu': 'whakaatu',
        'kaupapa': 'kaupapa',
        
        # Subjects
        'Te M?tauranga M?ori Wh?nui': 'Te Matauranga Maori Whanui',
        'Te Matauranga M?ori Wh?nui': 'Te Matauranga Maori Whanui',
        'Te M?tauranga Maori Wh?nui': 'Te Matauranga Maori Whanui',
        'M?ori Office Systems': 'Maori Office Systems',
        'M?ori Environmental Practices': 'Maori Environmental Practices',
        'W?hi Tapu': 'Wahi Tapu',
        'Wh?nau Ora and Community Support': 'Whanau Ora and Community Support',
        'Manaaki Marae - Wh?ngai Manuhiri': 'Manaaki Marae - Whangai Manuhiri',
        'Early Childhood: Family, Wh?nau, Community, and Society': 'Early Childhood: Family, Whanau, Community, and Society',
        'T?niko': 'Tuniko',
        'Te Mau R?kau': 'Te Mau Rukau',
        'Te Ara Nunumi - ?-Kiko': 'Te Ara Nunumi - a-Kiko',
        'Te Ao T?roa': 'Te Ao Turoa',
        'Ng? Taonga T?karo' : 'Nga Taonga Takaro',
        'Ng? K?rero o Neher?' : 'Nga Korero o Nehera',
        'Te Whakat?nanatanga' : 'Te Whakatinanatanga',
        'Manaaki Marae - Takat? Kai' : 'Manaaki Marae - Takatu Ka',
        'ng?' : 'nga',
        't?karo' : 'takaro',
        '?ta' : 'ata',
        
        # Individual character patterns (fallback)
        '?ori': 'aori',  # M?ori -> Maori
        '?nau': 'anau',  # wh?nau -> whanau
        '?keh?': 'akeha', # P?keh? -> Pakeha
        '?tauranga': 'atauranga', # M?tauranga -> Matauranga
        '?riki': 'ariki', # Wh?riki -> Whariki
        '?ngai': 'angai', # wh?ngai -> whangai
        '?mara': 'umara', # k?mara -> kumara
        '?whiri': 'owhiri', # p?whiri -> powhiri
        '?ngitanga': 'ingitanga', # k?ngitanga -> kingitanga
        '?rena': 'orena', # m?rena -> morena
        '?tika': 'utika', # t?tika -> tutika
        '?niko': 'uniko', # T?niko -> Tuniko
        '?kawe': 'ukawe', # t?kawe -> tukawe
        '?ui': 'aui', # M?ui -> Maui
        '?tahi': 'etahi', # t?tahi -> tetahi
        '?kau': 'akau', # r?kau -> rakau
        '?roa': 'uroa', # T?roa -> Turoa
        '?hura': 'uhura', # t?hura -> tuhura
        '?hiotanga': 'ohiotanga', # m?hiotanga -> mohiotanga
        '?nui': 'anui', # P?nui -> Panui
        'rongo?': 'rongoa', # rongo? -> rongoa
        '?huatanga': 'ahuatanga', # ?huatanga -> ahuatanga
        'hu?nga': 'huanga', # hu?nga -> huanga
        'k?tuitui': 'kotuitui', # k?tuitui -> kotuitui
        'kaum?tua': 'kaumatua',
        'wh?nui': 'whanui',
        'w?hi': 'wahi',
        'm?' : 'mo'
    }
    
    return replacements


def fix_encoding_issues():
    """Fix encoding issues in standard titles and subjects"""
    print("=== Fixing Māori Encoding Issues ===")
    
    replacements = create_maori_word_replacements()
    
    db = SessionLocal()
    try:
        # Find all standards with '?' in title or subject
        standards_with_issues = db.query(Standard).filter(
            (Standard.title.like('%?%')) | 
            (Standard.subject.like('%?%'))
        ).all()
        
        print(f"Found {len(standards_with_issues)} standards with encoding issues")
        
        fixed_count = 0
        
        for standard in standards_with_issues:
            original_title = standard.title
            original_subject = standard.subject
            
            # Fix title
            if standard.title and '?' in standard.title:
                fixed_title = standard.title
                for wrong, correct in replacements.items():
                    fixed_title = fixed_title.replace(wrong, correct)
                
                if fixed_title != standard.title:
                    print(f"Standard {standard.standard_number} - Title:")
                    print(f"  Before: {standard.title}")
                    print(f"  After:  {fixed_title}")
                    standard.title = fixed_title
            
            # Fix subject
            if standard.subject and '?' in standard.subject:
                fixed_subject = standard.subject
                for wrong, correct in replacements.items():
                    fixed_subject = fixed_subject.replace(wrong, correct)
                
                if fixed_subject != standard.subject:
                    print(f"Standard {standard.standard_number} - Subject:")
                    print(f"  Before: {standard.subject}")
                    print(f"  After:  {fixed_subject}")
                    standard.subject = fixed_subject
            
            # Check if anything was changed
            if (standard.title != original_title or 
                (standard.subject and standard.subject != original_subject)):
                fixed_count += 1
        
        # Commit changes
        db.commit()
        
        print(f"\n=== Fix Complete ===")
        print(f"Fixed encoding issues in {fixed_count} standards")
        
        # Show remaining issues
        remaining_issues = db.query(Standard).filter(
            (Standard.title.like('%?%')) | 
            (Standard.subject.like('%?%'))
        ).count()
        
        print(f"Remaining standards with '?' characters: {remaining_issues}")
        
        if remaining_issues > 0:
            print("\nRemaining issues may require manual review:")
            remaining = db.query(Standard).filter(
                (Standard.title.like('%?%')) | 
                (Standard.subject.like('%?%'))
            ).limit(5).all()
            
            for standard in remaining:
                print(f"Standard {standard.standard_number}:")
                if '?' in standard.title:
                    print(f"  Title: {standard.title}")
                if standard.subject and '?' in standard.subject:
                    print(f"  Subject: {standard.subject}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    fix_encoding_issues() 