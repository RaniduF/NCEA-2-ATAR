// NCEA Portal text parser service
import type { SelectedItem, Grade } from '../page';
import { searchStandards } from './api';

export interface ParsedStandard {
  standard_number: number;
  version: number;
  assessment_type: 'IN' | 'EX';
  title: string;
  level: number;
  credits: number;
  result: string;
  year: number;
  course?: string;
}

export interface ParseResult {
  standards: ParsedStandard[];
  level3Standards: ParsedStandard[];
  validStandards: SelectedItem[];
  invalidStandards: ParsedStandard[];
  missingGrades: number;
  summary: {
    totalFound: number;
    level3Found: number;
    validInDatabase: number;
    invalidNotInDatabase: number;
  };
}

export class NCEAPortalParser {
  
  // Map NCEA result codes to our grade system
  private mapResultToGrade(result: string): Grade {
    const normalizedResult = result.trim().toUpperCase();
    switch (normalizedResult) {
      case 'E': return 'Excellence';
      case 'M': return 'Merit';
      case 'A': return 'Achieved';
      case 'N': return 'Not Achieved';
      // WARNING: Defaulting to 'Achieved' for empty or unknown results.
      // This means that any missing, malformed, or unrecognized result codes will be treated as 'Achieved'.
      // This can significantly impact ATAR calculations or other downstream uses of this data,
      // as it may artificially inflate a student's results. If the data source or requirements change,
      // or if you expect non-standard result codes, review this logic carefully.
      // Consider logging a warning or tracking the number of such cases for audit purposes.
      default: return 'Achieved';
    }
  }

  // Extract year from section headers like "2024", "2023", etc.
  private extractYearFromContext(text: string, startIndex: number): number {
    const lines = text.substring(0, startIndex).split('\n');
    
    // Look backwards for year headers
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      
      // Look for standalone year (2024, 2023, etc.)
      const yearMatch = line.match(/^(20\d{2})$/);
      if (yearMatch) {
        return parseInt(yearMatch[1]);
      }
      
      // Look for "Credit Summary for Year" or similar patterns
      const yearInContextMatch = line.match(/(20\d{2})/);
      if (yearInContextMatch && line.includes('Year')) {
        return parseInt(yearInContextMatch[1]);
      }
    }
    
    // Default to current year if no year context found
    return new Date().getFullYear();
  }

  // Extract course name from section headers
  private extractCourseFromContext(text: string, startIndex: number): string | undefined {
    const lines = text.substring(0, startIndex).split('\n');
    
    // Look backwards for course headers like "Chemistry Three - Endorsed with..."
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      
      // Look for course endorsement lines
      const courseMatch = line.match(/^(.+?)\s*-\s*Endorsed with/);
      if (courseMatch) {
        return courseMatch[1].trim();
      }
    }
    
    return undefined;
  }

  // Parse a single standard row from the NCEA portal table
  private parseStandardRow(row: string, year: number, course?: string): ParsedStandard | null {
    // Standard row format: Std. Ver. Asm. Title Lvl. Education Organisation Māori Digital Crd. Result
    // Example: 91387	2	IN	Carry out an investigation in chemistry involving quantitative analysis	3	28					4	A
    
    // Split by tabs and filter out empty strings
    const parts = row.split('\t').map(p => p.trim()).filter(p => p !== '');
    
    if (parts.length < 4) return null;
    
    // First 4 parts are always: standard_number, version, assessment_type, title
    const standardNumber = parseInt(parts[0]);
    const version = parseInt(parts[1]);
    const assessmentType = parts[2] as 'IN' | 'EX';
    const title = parts[3];
    
    if (!standardNumber || !version || !assessmentType || !title) {
      return null;
    }
    
    // The rest of the parsing needs to handle the variable positions
    // Looking at the example: [std, ver, asm, title, level, org, māori?, digital?, credits, result]
    // But some fields might be empty (represented as empty tabs)
    
    let level = 0;
    let credits = 0;
    let result = '';
    
    // Re-split without filtering to preserve empty positions
    const allParts = row.split('\t');
    
    // Based on the NCEA format, level should be around position 4
    if (allParts.length > 4 && /^[123]$/.test(allParts[4]?.trim())) {
      level = parseInt(allParts[4].trim());
    }
    
    // Credits are typically near the end before result
    // Look for a number between 2-6 in the latter part of the array
    for (let i = Math.max(4, allParts.length - 4); i < allParts.length; i++) {
      const part = allParts[i]?.trim();
      if (part && /^\d{1,2}$/.test(part)) {
        const num = parseInt(part);
        if (num >= 2 && num <= 6 && credits === 0) {
          credits = num;
        }
      }
    }
    
    // Result is typically the last non-empty field
    for (let i = allParts.length - 1; i >= 0; i--) {
      const part = allParts[i]?.trim();
      if (part && /^(N|A|M|E|ABS|SNA|RNA)$/.test(part)) {
        result = part;
        break;
      }
    }
    
    // If we couldn't find level, try searching in all parts
    if (level === 0) {
      for (const part of parts) {
        if (/^[123]$/.test(part)) {
          level = parseInt(part);
          break;
        }
      }
    }
    
    // Validate required fields
    if (!standardNumber || !version || !assessmentType || !title || !level) {
      return null;
    }
    
    return {
      standard_number: standardNumber,
      version,
      assessment_type: assessmentType,
      title,
      level,
      credits: credits || 0, // Default to 0 if not found
      result: result || '', // Empty if no result
      year,
      course
    };
  }

  // Main parsing function
  async parseNCEAPortalText(portalText: string): Promise<ParseResult> {
    const lines = portalText.split('\n');
    const standards: ParsedStandard[] = [];
    
    let currentYear = new Date().getFullYear();
    let currentCourse: string | undefined;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and headers
      if (!line || line.startsWith('Std.') || line.startsWith('Enr.')) {
        continue;
      }
      
      // Update context for year and course
      const lineIndex = lines.slice(0, i).join('\n').length;
      currentYear = this.extractYearFromContext(portalText, lineIndex);
      currentCourse = this.extractCourseFromContext(portalText, lineIndex);
      
      // Try to parse as standard row (starts with standard number)
      if (/^\d{5,6}\t/.test(line)) {
        const parsed = this.parseStandardRow(line, currentYear, currentCourse);
        if (parsed) {
          standards.push(parsed);
        }
      }
    }
    
    // Filter for Level 3 standards only
    const level3Standards = standards.filter(std => std.level === 3);

    // Count missing grades among level 3 standards
    const missingGrades = level3Standards.filter(std => !std.result || std.result.trim() === '').length;
    
    // Include standards with missing grades (default to Achieved later), exclude ABS/SNA/RNA/N
    const validResultStandards = level3Standards.filter(std => 
      !['ABS', 'SNA', 'RNA', 'N'].includes((std.result || '').toUpperCase())
    );
    
    // Validate against database
    const validStandards: SelectedItem[] = [];
    const invalidStandards: ParsedStandard[] = [];
    
    for (const std of validResultStandards) {
      try {
        // Search for the standard in our database
        const searchResults = await searchStandards(std.standard_number.toString());
        
        // Check both direct results and related groups
        let foundStandard = searchResults.direct_results.find((standard: any) => 
          standard.standard_number === std.standard_number
        );
        
        if (!foundStandard) {
          // Search in related groups
          for (const group of searchResults.related_groups) {
            foundStandard = group.standards.find((standard: any) => 
              standard.standard_number === std.standard_number
            );
            if (foundStandard) break;
          }
        }
        
        if (foundStandard) {
          const selectedItem: SelectedItem = {
            standard: foundStandard,
            grade: this.mapResultToGrade(std.result),
            year_achieved: std.year,
            standard_version: std.version
          };
          validStandards.push(selectedItem);
        } else {
          invalidStandards.push(std);
        }
      } catch (error) {
        console.error(`Error validating standard ${std.standard_number}:`, error);
        invalidStandards.push(std);
      }
    }
    
    return {
      standards,
      level3Standards,
      validStandards,
      invalidStandards,
      missingGrades,
      summary: {
        totalFound: standards.length,
        level3Found: level3Standards.length,
        validInDatabase: validStandards.length,
        invalidNotInDatabase: invalidStandards.length
      }
    };
  }
}

// Export singleton instance
export const nceaParser = new NCEAPortalParser(); 