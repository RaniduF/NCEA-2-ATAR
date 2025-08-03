// API Service Layer for NCEA to ATAR Calculator
// Handles all backend communications with proper error handling and TypeScript types

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

// Type definitions matching backend schemas
export interface StandardResponse {
  standard_number: number;
  title: string;
  credits: number;
  assessment_type: 'Internal' | 'External';
  standards_type?: string;
  is_ue?: boolean;
  subject: string;
  search_keywords?: any;
}

export interface StandardSearchResponse {
  direct_results: StandardResponse[];
  related_groups: {
    name: string;
    standards: StandardResponse[];
  }[];
  suggestion?: {
    type: string;
    value: string;
  } | null;
}

export interface UserStandardInput {
  standard_number: number;
  grade: 'Excellence' | 'Merit' | 'Achieved' | 'Not Achieved';
}

export interface EstimatedATARResult {
  year: number;
  estimated_atar: number;
  statistical_value: number;
}

export interface ATARCalculationResponse {
  results: EstimatedATARResult[];
}

export interface APIError {
  message: string;
  status?: number;
  details?: any;
}

// Custom error class for API errors
export class APIRequestError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status: number = 500, details?: any) {
    super(message);
    this.name = 'APIRequestError';
    this.status = status;
    this.details = details;
  }
}

// Helper function for making API requests with error handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.log(`Making API request to: ${url}`); // Debug logging
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    console.log(`API response status: ${response.status}`); // Debug logging

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorDetails = null;

      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
        errorDetails = errorData;
      } catch (e) {
        // If we can't parse the error response, use the status text
      }

      throw new APIRequestError(errorMessage, response.status, errorDetails);
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof APIRequestError) {
      throw error;
    }

    // Handle network errors, timeout, etc.
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new APIRequestError(
        'Network error: Unable to connect to the server. Please check your internet connection and try again.',
        0
      );
    }

    throw new APIRequestError(
      'An unexpected error occurred while communicating with the server.',
      500,
      error
    );
  }
}

// API Service Functions

/**
 * Search for NCEA standards
 */
export async function searchStandards(query: string): Promise<StandardSearchResponse> {
  if (!query.trim()) {
    return {
      direct_results: [],
      related_groups: [],
      suggestion: null
    };
  }

  const encodedQuery = encodeURIComponent(query.trim());
  return apiRequest<StandardSearchResponse>(`/standards/?q=${encodedQuery}`);
}

/**
 * Get search suggestions for autocomplete
 */
export async function getSearchSuggestions(query: string): Promise<string[]> {
  if (!query.trim() || query.length < 2) {
    return [];
  }

  const encodedQuery = encodeURIComponent(query.trim());
  return apiRequest<string[]>(`/suggestions/?q=${encodedQuery}`);
}

/**
 * Calculate ATAR scores for given standards
 */
export async function calculateATAR(standards: UserStandardInput[]): Promise<ATARCalculationResponse> {
  if (!standards || standards.length === 0) {
    throw new APIRequestError('No standards provided for calculation', 400);
  }

  return apiRequest<ATARCalculationResponse>('/calculate-atar/', {
    method: 'POST',
    body: JSON.stringify({ standards }),
  });
}

/**
 * Utility function to convert frontend standard format to API format
 */
export function convertToAPIFormat(
  standardNumber: number,
  grade: 'Excellence' | 'Merit' | 'Achieved' | 'Not Achieved'
): UserStandardInput {
  return {
    standard_number: standardNumber,
    grade
  };
}

/**
 * Utility function to group standards by subject
 */
export function groupStandardsBySubject(standards: StandardResponse[]): Record<string, StandardResponse[]> {
  return standards.reduce((acc, standard) => {
    const subject = standard.subject || 'Other';
    if (!acc[subject]) {
      acc[subject] = [];
    }
    acc[subject].push(standard);
    return acc;
  }, {} as Record<string, StandardResponse[]>);
}

/**
 * Utility function to check API health
 */
export async function checkAPIHealth(): Promise<boolean> {
  try {
    // Derive base URL from API_BASE_URL by removing /api/v1 suffix
    const baseUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    
    // Make direct call to root endpoint
    const response = await fetch(`${baseUrl}/`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
}

/**
 * Debounced search function for performance optimization
 */
export function createDebouncedSearch<T extends any[], R>(
  searchFunction: (...args: T) => Promise<R>,
  delay: number = 300
) {
  let timeoutId: NodeJS.Timeout;

  return (...args: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        try {
          const result = await searchFunction(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
}

// Create debounced versions of search functions
export const debouncedSearchStandards = createDebouncedSearch(searchStandards, 300);
export const debouncedGetSuggestions = createDebouncedSearch(getSearchSuggestions, 200);

export default {
  searchStandards,
  getSearchSuggestions,
  calculateATAR,
  convertToAPIFormat,
  groupStandardsBySubject,
  checkAPIHealth,
  debouncedSearchStandards,
  debouncedGetSuggestions,
}; 