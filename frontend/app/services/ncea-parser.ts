// NCEA Portal text parser service
import type { SelectedItem, Grade } from '../page';
import { searchStandards } from './api';

export interface ParsedStandard {
  standard_number: number;
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
  unsatStandardNumbers: number[];
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
      case 'E':
      case 'EXCELLENCE*':
      case 'EXCELLENCE':
        return 'Excellence';
      case 'M':
      case 'MERIT':
        return 'Merit';
      case 'A':
      case 'ACHIEVED':
        return 'Achieved';
      case 'N':
      case 'NOT ACHIEVED':
        return 'Not Achieved';
      // WARNING: Defaulting to 'Achieved' for unknown results.
      default: return 'Achieved';
    }
  }

  // Check if a result is a known grade
  private isKnownGrade(result: string): boolean {
    const normalizedResult = result.trim().toUpperCase();
    return ['E', 'M', 'A', 'N', 'EXCELLENCE*', 'EXCELLENCE', 'MERIT', 'ACHIEVED', 'NOT ACHIEVED'].includes(normalizedResult);
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
    // Split by tabs and filter out empty strings
    const allParts = row.split('\t');
    const parts = allParts.map(p => p.trim()).filter(p => p !== '');

    if (parts.length < 4) return null;

    const standardNumber = parseInt(parts[0]);
    if (!standardNumber || isNaN(standardNumber)) return null;

    let assessmentType: 'IN' | 'EX' = 'IN';
    let title = '';
    let level = 0;
    let credits = 0;
    let result = '';

    // If second part is a small number, it's the old format (had a version column)
    const isOldFormat = !isNaN(parseInt(parts[1]));

    if (isOldFormat) {
      // Skip parts[1] (version) — we always default to latest version
      const rawAsm = (parts[2] ?? '').toString().toUpperCase();
      assessmentType = rawAsm.startsWith('EX') ? 'EX' : 'IN';
      title = parts[3] || '';

      if (allParts.length > 4 && /^[123]$/.test(allParts[4]?.trim())) {
        level = parseInt(allParts[4].trim());
      }

      for (let i = Math.max(4, allParts.length - 6); i < allParts.length; i++) {
        const part = allParts[i]?.trim();
        if (part && /^\d{1,2}$/.test(part)) {
          const num = parseInt(part, 10);
          if (num >= 1 && num <= 40 && credits === 0) credits = num;
        }
      }

      for (let i = allParts.length - 1; i >= 0; i--) {
        const part = allParts[i]?.trim();
        if (part && /^(N|A|M|E|ABS|SNA|RNA)$/.test(part)) {
          result = part;
          break;
        }
      }
    } else {
      // New format: Std No., Title, Level, Method, Credits, Result
      title = parts[1];
      level = parseInt(parts[2]) || 0;
      const methodStr = (parts[3] ?? '').toUpperCase();
      assessmentType = (methodStr.includes('PAPER') || methodStr.includes('EXAM')) ? 'EX' : 'IN';
      credits = parseInt(parts[4]) || 0;

      // Result may be missing if not yet graded
      if (parts.length >= 6) {
        result = parts.slice(5).join(' ').trim();
      }
    }

    if (level === 0) {
      for (const part of parts) {
        if (/^[123]$/.test(part)) {
          level = parseInt(part);
          break;
        }
      }
    }

    if (!standardNumber || !title || !level) {
      return null;
    }

    return {
      standard_number: standardNumber,
      assessment_type: assessmentType,
      title,
      level,
      credits,
      result,
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

    // Include standards with unknown grades (default to Achieved later), exclude ABS/SNA/RNA explicit failures
    const validResultStandards = level3Standards.filter(std => {
      const res = (std.result || '').trim().toUpperCase();
      return !['ABS', 'SNA', 'RNA', 'ABSENT'].includes(res);
    });

    // Validate against database
    const validStandards: SelectedItem[] = [];
    const invalidStandards: ParsedStandard[] = [];
    const unsatStandardNumbers: number[] = [];

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
            standard_version: undefined
          };
          validStandards.push(selectedItem);

          if (!this.isKnownGrade(std.result)) {
            unsatStandardNumbers.push(foundStandard.standard_number);
          }
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
      unsatStandardNumbers,
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