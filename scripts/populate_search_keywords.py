import sys
import os
import json
import re
import nltk
from nltk.corpus import stopwords
import pandas as pd

# --- Path Setup ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from backend.app.db.session import SessionLocal
from backend.app.models.standard_models import Standard


def setup_nltk_dependencies():
    """Download required NLTK data"""
    required_data = ['stopwords']
    
    for item in required_data:
        try:
            nltk.data.find(f'corpora/{item}')
        except LookupError:
            print(f"Downloading NLTK '{item}'...")
            nltk.download(item)


def create_academic_jargon_filter():
    """Create comprehensive list of academic jargon to filter out"""
    
    # Academic verbs - generic action words
    academic_verbs = {
        'demonstrate', 'understand', 'understanding', 'apply', 'analyse', 'analyze',
        'evaluate', 'produce', 'develop', 'use', 'investigate', 'carry', 'conduct',
        'describe', 'complete', 'create', 'write', 'solve', 'meet', 'leading',
        'select', 'implement', 'examine', 'explore', 'explain', 'identify',
        'compare', 'contrast', 'assess', 'interpret', 'present', 'perform',
        'participate', 'engage', 'show', 'display', 'illustrate', 'determine',
        'establish', 'formulate', 'construct', 'design', 'plan', 'organize',
        'manage', 'communicate', 'discuss', 'review', 'synthesize', 'integrate'
    }
    
    # Academic qualifiers - generic descriptors
    academic_qualifiers = {
        'basic', 'simple', 'complex', 'advanced', 'fundamental', 'essential',
        'key', 'main', 'primary', 'secondary', 'major', 'minor', 'significant',
        'important', 'relevant', 'appropriate', 'suitable', 'effective',
        'efficient', 'comprehensive', 'detailed', 'thorough', 'extensive',
        'various', 'different', 'multiple', 'several', 'range', 'variety',
        'aspects', 'elements', 'features', 'characteristics', 'properties',
        'principles', 'concepts', 'theories', 'methods', 'techniques',
        'strategies', 'approaches', 'processes', 'procedures', 'systems',
        'structures', 'frameworks', 'models', 'patterns', 'relationships',
        'connections', 'links', 'interactions', 'influences', 'effects',
        'impacts', 'implications', 'consequences', 'outcomes', 'results',
        'evidence', 'information', 'data', 'knowledge', 'skills', 'abilities',
        'competencies', 'capabilities', 'requirements', 'standards', 'criteria'
    }
    
    # Academic nouns - generic academic terms
    academic_nouns = {
        'concept', 'concepts', 'theory', 'theories', 'principle', 'principles',
        'method', 'methods', 'technique', 'techniques', 'strategy', 'strategies',
        'approach', 'approaches', 'process', 'processes', 'procedure', 'procedures',
        'system', 'systems', 'structure', 'structures', 'framework', 'frameworks',
        'model', 'models', 'pattern', 'patterns', 'relationship', 'relationships',
        'aspect', 'aspects', 'element', 'elements', 'feature', 'features',
        'characteristic', 'characteristics', 'property', 'properties',
        'skill', 'skills', 'ability', 'abilities', 'knowledge', 'understanding',
        'awareness', 'comprehension', 'context', 'contexts', 'situation', 'situations',
        'scenario', 'scenarios', 'problem', 'problems', 'issue', 'issues',
        'factor', 'factors', 'variable', 'variables', 'component', 'components'
    }
    
    # Base English stopwords
    try:
        base_stopwords = set(stopwords.words('english'))
    except LookupError:
        base_stopwords = set()
    
    return base_stopwords.union(academic_verbs, academic_qualifiers, academic_nouns)


def extract_meaningful_phrases(text, jargon_filter):
    """Extract meaningful phrases from text, preserving important multi-word terms"""
    
    text_lower = text.lower()
    
    # Define important phrase patterns that should be preserved
    important_phrase_patterns = [
        # Mathematical/Science terms
        r'complex number[s]?', r'simple interest', r'advanced calculus',
        r'organic chemistry', r'inorganic chemistry', r'physical chemistry', r'analytical chemistry',
        r'molecular biology', r'cell biology', r'human biology', r'plant biology', r'animal biology',
        r'computer science', r'software engineering', r'hardware systems', r'network programming',
        r'data analysis', r'statistical analysis', r'mathematical analysis', r'scientific analysis',
        r'business studies', r'economic analysis', r'market research', r'financial planning',
        r'social studies', r'environmental science', r'political science',
        r'physical education', r'health education', r'early childhood',
        r'visual arts', r'performing arts', r'media studies', r'digital technologies',
        r'te reo maori', r'te ao', r'hangarau matihiko',
        
        # NCEA specific terms
        r'achievement standard[s]?', r'unit standard[s]?', r'ncea level', r'university entrance',
        r'atar calculation', r'merit endorsement', r'excellence endorsement',
        
        # Subject specific compound terms
        r'new zealand', r'aotearoa', r'cook islands', r'pacific island',
        r'classical studies', r'history of art', r'design and visual communication',
        r'construction and mechanical technologies', r'processing technologies',
        
        # Language terms
        r'spoken presentation', r'written text', r'visual text', r'oral text',
        r'foreign language', r'second language', r'bilingual education'
    ]
    
    # Extract important phrases first
    important_phrases = set()
    for pattern in important_phrase_patterns:
        matches = re.findall(pattern, text_lower)
        important_phrases.update(matches)
    
    # Extract individual meaningful words
    meaningful_words = set()
    
    # Clean text and split into words
    clean_text = re.sub(r'[^\w\s]', ' ', text_lower)
    words = clean_text.split()
    
    for word in words:
        # Skip jargon words
        if word in jargon_filter:
            continue
            
        # Skip very short words
        if len(word) <= 2:
            continue
            
        # Keep if it's part of an important phrase
        if any(word in phrase for phrase in important_phrases):
            meaningful_words.add(word)
            continue
        
        # Keep words that seem subject-specific (not generic academic terms)
        if word not in jargon_filter and len(word) > 3:
            # Additional filter for common but meaningless words
            generic_words = {
                'standard', 'level', 'assessment', 'achievement', 'unit', 'internal', 'external',
                'credits', 'version', 'text', 'texts', 'work', 'works', 'student', 'students',
                'learning', 'education', 'school', 'curriculum', 'programme', 'course'
            }
            
            if word not in generic_words:
                meaningful_words.add(word)
    
    return meaningful_words.union(important_phrases)


def generate_subject_groups(subject, assessment_type, standards_type):
    """Generate appropriate subject groups based on standard type"""
    
    groups = set()
    
    if not subject or not assessment_type:
        return groups
    
    # For Achievement Standards - include both internal and external groups
    if standards_type == 'Achievement':
        primary_group = f"{subject} {assessment_type}s"
        groups.add(primary_group)
        
        # Add cross-reference groups (internals can see externals and vice versa)
        if assessment_type == 'External':
            groups.add(f"{subject} Internals")
        elif assessment_type == 'Internal':
            groups.add(f"{subject} Externals")
    
    # For Unit Standards - only internal groups (as specified by user)
    elif standards_type == 'Unit':
        if assessment_type == 'Internal':
            groups.add(f"{subject} Internals")
        # Don't add external groups for unit standards
    
    # Add general subject group
    groups.add(subject)
    
    return groups


def load_manual_overrides(filepath):
    """Load manual keyword overrides and aliases"""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"standard_aliases": {}, "subject_overrides": {}}


def populate_enhanced_search_keywords():
    """Main function to populate enhanced search keywords"""
    
    print("=== Enhanced Search Keywords Population ===")
    
    # Setup dependencies
    setup_nltk_dependencies()
    jargon_filter = create_academic_jargon_filter()
    
    # Load manual overrides
    overrides_path = os.path.join(os.path.dirname(__file__), 'search_overrides.json')
    overrides = load_manual_overrides(overrides_path)
    aliases = overrides.get("standard_aliases", {})
    subject_overrides = overrides.get("subject_overrides", {})
    
    print(f"Loaded {len(aliases)} aliases and {len(subject_overrides)} subject overrides")
    
    db_session = SessionLocal()
    try:
        all_standards = db_session.query(Standard).all()
        print(f"Processing {len(all_standards)} standards...")
        
        updated_count = 0
        
        for standard in all_standards:
            std_num_str = str(standard.standard_number)
            
            # Get subject (with override if available)
            subject = subject_overrides.get(std_num_str, standard.subject)
            
            # Initialize primary keywords
            primary_keywords = set()
            
            # Add manual aliases
            if std_num_str in aliases:
                primary_keywords.update(aliases[std_num_str])
            
            # Add standard number
            primary_keywords.add(std_num_str)
            
            # Add subject (cleaned)
            if subject:
                subject_clean = re.sub(r'[^\w\s]', '', str(subject).lower())
                primary_keywords.add(subject_clean)
                # Also add individual words from subject
                for word in subject_clean.split():
                    if word not in jargon_filter and len(word) > 2:
                        primary_keywords.add(word)
            
            # Extract meaningful keywords from title
            if standard.title:
                title_keywords = extract_meaningful_phrases(standard.title, jargon_filter)
                primary_keywords.update(title_keywords)
            
            # Generate appropriate groups
            groups = generate_subject_groups(subject, standard.assessment_type, standard.standards_type)
            
            # Update search keywords
            search_keywords = {
                "primary": sorted(list(primary_keywords)),
                "groups": sorted(list(groups))
            }
            
            standard.search_keywords = search_keywords
            updated_count += 1
            
            # Progress indicator
            if updated_count % 100 == 0:
                print(f"  Processed {updated_count} standards...")
        
        # Commit changes
        db_session.commit()
        
        print(f"\n=== Population Complete ===")
        print(f"Successfully updated {updated_count} standards")
        print(f"Enhanced keyword extraction with jargon filtering applied")
        print(f"Unit standards properly configured (no external groups)")
        
        # Show some examples
        print(f"\nSample results:")
        sample_standards = db_session.query(Standard).limit(3).all()
        for std in sample_standards:
            print(f"Standard {std.standard_number} ({std.standards_type}):")
            print(f"  Title: {std.title[:60]}...")
            print(f"  Keywords: {std.search_keywords.get('primary', [])[:8]}")
            print(f"  Groups: {std.search_keywords.get('groups', [])}")
            print()
            
    except Exception as e:
        print(f"❌ Error: {e}")
        db_session.rollback()
    finally:
        db_session.close()


if __name__ == "__main__":
    populate_enhanced_search_keywords()
