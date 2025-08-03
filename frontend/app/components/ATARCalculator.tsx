'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronDown, Search, Plus, X, BookOpen, CheckCircle, Calculator, Award, TrendingUp, ChevronRight, BarChart3, Users, Info, Star, AlertCircle, Wifi, WifiOff } from 'lucide-react';

// Import API services
import {
  searchStandards,
  getSearchSuggestions,
  calculateATAR,
  convertToAPIFormat,
  groupStandardsBySubject,
  checkAPIHealth,
  debouncedSearchStandards,
  debouncedGetSuggestions,
  StandardResponse,
  StandardSearchResponse,
  EstimatedATARResult,
  APIRequestError
} from '../services/api';

// Updated types to match backend API
type SelectedStandard = {
  standard: StandardResponse;
  grade: 'Excellence' | 'Merit' | 'Achieved' | 'Not Achieved';
};

type ATARResult = {
  year: number;
  score: number;
  statistical_value: number;
  description: string;
};

// Enhanced grade weighting system
const gradeWeights = { 
  'Excellence': 4, 
  'Merit': 3, 
  'Achieved': 2, 
  'Not Achieved': 0 
};

const years = [2025, 2024, 2023, 2022, 2021];

export default function ATARCalculator() {
  // Core state
  const [selectedYear, setSelectedYear] = useState<number>(years[0]);
  const [selectedStandards, setSelectedStandards] = useState<SelectedStandard[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [atarResults, setAtarResults] = useState<ATARResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showDetailedResults, setShowDetailedResults] = useState<boolean>(false);

  // API-related state
  const [searchResults, setSearchResults] = useState<StandardSearchResponse>({
    direct_results: [],
    related_groups: [],
    suggestion: null
  });
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState<boolean>(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isApiHealthy, setIsApiHealthy] = useState<boolean>(true);

  // Check API health on component mount
  useEffect(() => {
    const checkHealth = async () => {
      const healthy = await checkAPIHealth();
      setIsApiHealthy(healthy);
    };
    checkHealth();
  }, []);

  // Debounced search functionality
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults({ direct_results: [], related_groups: [], suggestion: null });
      setSearchSuggestions([]);
      return;
    }

    setIsSearchLoading(true);
    setApiError(null);

    try {
      // Perform both search and suggestions in parallel
      const [results, suggestions] = await Promise.all([
        debouncedSearchStandards(query),
        debouncedGetSuggestions(query)
      ]);

      setSearchResults(results);
      setSearchSuggestions(suggestions.slice(0, 5)); // Limit to 5 suggestions
    } catch (error) {
      console.error('Search error:', error);
      if (error instanceof APIRequestError) {
        setApiError(error.message);
      } else {
        setApiError('Search failed. Please try again.');
      }
    } finally {
      setIsSearchLoading(false);
    }
  }, []);

  // Effect to trigger search when searchTerm changes
  useEffect(() => {
    performSearch(searchTerm);
  }, [searchTerm, performSearch]);

  // Calculate total credits from all standards (including Not Achieved)
  const totalCredits = useMemo(() => {
    return selectedStandards.reduce((sum, s) => sum + s.standard.credits, 0);
  }, [selectedStandards]);

  // Count standards with grades (for display purposes only)
  const standardsWithGrades = useMemo(() => {
    return selectedStandards.filter(s => s.grade !== 'Not Achieved');
  }, [selectedStandards]);

  const addStandard = (standard: StandardResponse) => {
    // Check if already selected
    const alreadySelected = selectedStandards.some(s => s.standard.standard_number === standard.standard_number);
    if (!alreadySelected) {
      setSelectedStandards([...selectedStandards, { 
        standard, 
        grade: 'Not Achieved' // Default grade
      }]);
    }
    setSearchTerm(''); // Clear search
  };

  const removeStandard = (standardNumber: number) => {
    setSelectedStandards(selectedStandards.filter(s => s.standard.standard_number !== standardNumber));
  };

  const toggleGroupExpansion = (groupName: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(name => name !== groupName)
        : [...prev, groupName]
    );
  };

  const handleStandardChange = (standard: StandardResponse, grade: 'Excellence' | 'Merit' | 'Achieved' | 'Not Achieved') => {
    const existingIndex = selectedStandards.findIndex(s => s.standard.standard_number === standard.standard_number);
    
    if (existingIndex >= 0) {
      const updated = [...selectedStandards];
      updated[existingIndex] = { standard, grade };
      setSelectedStandards(updated);
    } else {
      setSelectedStandards([...selectedStandards, { standard, grade }]);
    }
  };

  const calculateMultiYearAtar = async () => {
    if (selectedStandards.filter(s => s.grade !== 'Not Achieved').length === 0) {
      setApiError('Please add at least one standard with a grade to calculate ATAR.');
      return;
    }

    setIsLoading(true);
    setAtarResults([]);
    setApiError(null);

    try {
      // Convert frontend format to API format - send ALL standards to backend
      // The backend will determine the best 90 credits based on difficulty weightings
      const apiStandards = selectedStandards
        .map(s => convertToAPIFormat(s.standard.standard_number, s.grade));

      // Call real ATAR calculation API
      const response = await calculateATAR(apiStandards);
      
      // Convert API response to frontend format
      const results: ATARResult[] = response.results.map(result => ({
        year: result.year,
        score: result.estimated_atar,
        statistical_value: result.statistical_value,
        description: result.year === 2025 ? 'Latest calculation' : 
                    result.year === 2024 ? 'Previous year' : 'Historical reference'
      }));
      
      setAtarResults(results.sort((a, b) => b.year - a.year));
      setShowDetailedResults(true);
    } catch (error) {
      console.error('ATAR calculation error:', error);
      if (error instanceof APIRequestError) {
        setApiError(`Calculation failed: ${error.message}`);
      } else {
        setApiError('ATAR calculation failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Note: ATAR calculation and ranking is now handled entirely by the backend

  const ProgressStepper = () => (
    <div className="flex items-center justify-center w-full mb-12">
      <div className="flex items-center space-x-8">
        <div className="flex items-center group">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-600">Step 1</p>
            <p className="font-serif text-lg text-slate-800">Search & Select</p>
          </div>
        </div>
        
        <div className="w-24 h-0.5 bg-gradient-to-r from-teal-200 to-slate-200"></div>
        
        <div className={`flex items-center group transition-all duration-300 ${selectedStandards.length > 0 ? 'opacity-100' : 'opacity-40'}`}>
          <div className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-300 ${
            selectedStandards.length > 0 
              ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white' 
              : 'bg-white border-2 border-slate-200 text-slate-400'
          }`}>
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-600">Step 2</p>
            <p className="font-serif text-lg text-slate-800">Add Grades</p>
          </div>
        </div>
        
        <div className="w-24 h-0.5 bg-gradient-to-r from-slate-200 to-slate-200"></div>
        
        <div className={`flex items-center group transition-all duration-300 ${atarResults.length > 0 ? 'opacity-100' : 'opacity-40'}`}>
          <div className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-300 ${
            atarResults.length > 0 
              ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white' 
              : 'bg-white border-2 border-slate-200 text-slate-400'
          }`}>
            <BarChart3 className="w-6 h-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-600">Step 3</p>
            <p className="font-serif text-lg text-slate-800">Calculate ATAR</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-600/10 to-transparent"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-24">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              {isApiHealthy ? (
                <div className="flex items-center space-x-2 text-green-400">
                  <Wifi className="w-5 h-5" />
                  <span className="text-sm">Connected to Live Database</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-red-400">
                  <WifiOff className="w-5 h-5" />
                  <span className="text-sm">API Connection Issues</span>
                </div>
              )}
            </div>
            <h1 className="font-serif text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
              NCEA to ATAR Calculator
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Connect directly to the official NZQA database for real-time standard lookup and accurate ATAR calculations.
            </p>
            <div className="flex items-center justify-center mt-8 space-x-6 text-slate-400">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5" />
                <span className="text-sm">Live NZQA Data</span>
              </div>
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span className="text-sm">Multi-Year Analysis</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span className="text-sm">Official Calculations</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Calculator */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="p-8 md:p-12">
            <ProgressStepper />

            {/* API Error Display */}
            {apiError && (
              <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <h4 className="font-semibold text-red-800">Error</h4>
                </div>
                <p className="text-red-700 mt-1">{apiError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Left Column: Search Interface */}
              <div className="lg:col-span-2 space-y-8">
                <div>
                  <h2 className="font-serif text-3xl font-bold text-slate-800 mb-2">Search NCEA Standards</h2>
                  <p className="text-slate-600">Search the official NZQA database to find and select your standards. Add grades for accurate ATAR calculation.</p>
                </div>
                
                {/* Year Selector Card */}
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <label htmlFor="year-select" className="block text-sm font-semibold text-slate-700 mb-3">Academic Year</label>
                  <div className="relative">
                    <select
                      id="year-select"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="w-full pl-4 pr-12 py-3 text-base border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none bg-white shadow-sm transition-all duration-200 hover:border-slate-300"
                    >
                      {years.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"/>
                  </div>
                </div>

                {/* Standard Search Card */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <label htmlFor="standard-search" className="block text-sm font-semibold text-slate-700 mb-3">
                    Search Standards Database
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"/>
                    <input
                      id="standard-search"
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Type subject name, standard number, or keyword..."
                      className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 hover:border-slate-300"
                    />
                    {isSearchLoading && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-500"></div>
                      </div>
                    )}
                  </div>

                  {/* Search Suggestions */}
                  {searchSuggestions.length > 0 && searchTerm && (
                    <div className="mt-3">
                      <h6 className="text-xs font-semibold text-slate-500 mb-2">SUGGESTIONS</h6>
                      <div className="flex flex-wrap gap-2">
                        {searchSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => setSearchTerm(suggestion)}
                            className="px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition-colors duration-150"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search Results */}
                  {searchTerm && (
                    <div className="mt-6 space-y-4">
                      {/* Direct Results */}
                      {searchResults.direct_results.map(standard => (
                        <div key={standard.standard_number} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h5 className="font-medium text-slate-800 mb-1">{standard.title}</h5>
                              <div className="flex items-center space-x-4 text-sm text-slate-500">
                                <span>#{standard.standard_number}</span>
                                <span>{standard.credits} credits</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  standard.assessment_type === 'External' 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {standard.assessment_type}
                                </span>
                                <span className="font-medium">{standard.subject}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => addStandard(standard)}
                              className="ml-4 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors duration-200 text-sm font-medium"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Related Groups */}
                      {searchResults.related_groups.map(group => (
                        <div key={group.name} className="border border-slate-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => toggleGroupExpansion(group.name)}
                            className="w-full p-4 text-left bg-slate-50 hover:bg-slate-100 transition-colors duration-150"
                          >
                            <div className="flex items-center justify-between">
                              <h5 className="font-semibold text-slate-800">{group.name}</h5>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-slate-500">{group.standards.length} standards</span>
                                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                                  expandedGroups.includes(group.name) ? 'rotate-90' : ''
                                }`} />
                              </div>
                            </div>
                          </button>
                          
                          {expandedGroups.includes(group.name) && (
                            <div className="p-4 space-y-3 bg-white">
                              {group.standards.map(standard => (
                                <div key={standard.standard_number} className="flex justify-between items-start p-3 bg-slate-50 rounded-lg">
                                  <div className="flex-1">
                                    <h6 className="font-medium text-slate-800 mb-1">{standard.title}</h6>
                                    <div className="flex items-center space-x-3 text-sm text-slate-500">
                                      <span>#{standard.standard_number}</span>
                                      <span>{standard.credits} credits</span>
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        standard.assessment_type === 'External' 
                                          ? 'bg-blue-100 text-blue-700' 
                                          : 'bg-green-100 text-green-700'
                                      }`}>
                                        {standard.assessment_type}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => addStandard(standard)}
                                    className="ml-3 px-3 py-1 bg-teal-500 text-white rounded-md hover:bg-teal-600 transition-colors duration-200 text-sm"
                                  >
                                    Add
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Suggestions */}
                      {searchResults.suggestion && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Info className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">Did you mean:</span>
                            <button
                              onClick={() => setSearchTerm(searchResults.suggestion!.value)}
                              className="text-blue-600 underline font-medium"
                            >
                              {searchResults.suggestion.value}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* No Results */}
                      {searchResults.direct_results.length === 0 && 
                       searchResults.related_groups.length === 0 && 
                       !searchResults.suggestion && 
                       !isSearchLoading && (
                        <div className="text-center py-8 text-slate-500">
                          <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300"/>
                          <p>No standards found for "{searchTerm}"</p>
                          <p className="text-sm mt-1">Try searching by subject name or standard number</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Selected Standards */}
                {selectedStandards.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-serif text-xl font-semibold text-slate-800">Your Selected Standards</h3>
                    <div className="space-y-3">
                      {selectedStandards.map(selectedStandard => {
                        return (
                          <div key={selectedStandard.standard.standard_number} className="bg-white rounded-xl p-4 border shadow-sm border-slate-200">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-2 flex-1">
                                <div className="flex-1">
                                  <h5 className="font-medium text-slate-800 leading-snug">{selectedStandard.standard.title}</h5>
                                  <div className="flex items-center space-x-4 mt-1 text-sm text-slate-500">
                                    <span>#{selectedStandard.standard.standard_number}</span>
                                    <span className="flex items-center">
                                      <span className="w-2 h-2 bg-teal-400 rounded-full mr-2"></span>
                                      {selectedStandard.standard.credits} credits
                                    </span>
                                    <span>{selectedStandard.standard.subject}</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      selectedStandard.standard.assessment_type === 'External' 
                                        ? 'bg-blue-100 text-blue-700' 
                                        : 'bg-green-100 text-green-700'
                                    }`}>
                                      {selectedStandard.standard.assessment_type}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <X 
                                onClick={() => removeStandard(selectedStandard.standard.standard_number)}
                                className="w-5 h-5 text-slate-400 hover:text-red-500 transition-colors duration-150 cursor-pointer flex-shrink-0 ml-4"
                              />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {(['Excellence', 'Merit', 'Achieved', 'Not Achieved'] as const).map(grade => (
                                <button
                                  key={grade}
                                  onClick={() => handleStandardChange(selectedStandard.standard, grade)}
                                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 text-center ${
                                    selectedStandard.grade === grade
                                      ? grade === 'Excellence' ? 'bg-emerald-500 text-white shadow-md ring-2 ring-emerald-400' :
                                        grade === 'Merit' ? 'bg-blue-500 text-white shadow-md ring-2 ring-blue-400' :
                                        grade === 'Achieved' ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-400' :
                                        'bg-slate-500 text-white shadow-md ring-2 ring-slate-400'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:scale-105'
                                  }`}
                                >
                                  {grade}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Enhanced Summary and Results */}
              <div className="space-y-6">
                {/* Progress Summary */}
                <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="font-serif text-2xl font-bold text-slate-800 mb-6">Academic Summary</h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-100">
                      <span className="font-medium text-slate-700">Total Credits</span>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-teal-600">{totalCredits}</span>
                        <span className="text-slate-500 ml-1">credits</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-100">
                      <span className="font-medium text-slate-700">Best 90 Credits</span>
                      <div className="text-right">
                        <span className="text-lg font-bold text-emerald-600">
                          {Math.min(totalCredits, 90)}
                        </span>
                        <span className="text-slate-500 ml-1">/ 90</span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((totalCredits / 90) * 100, 100)}%` }}
                      ></div>
                    </div>

                    {standardsWithGrades.length > 0 && (
                      <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Star className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-semibold text-emerald-800">Standards with Grades</span>
                        </div>
                        <p className="text-xs text-emerald-700">
                          {standardsWithGrades.length} standards with assigned grades
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Standards Overview */}
                {selectedStandards.length > 0 && (
                  <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                    <h4 className="font-semibold text-slate-800 mb-4 flex items-center justify-between">
                      <span>Standards Overview</span>
                      <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                        {selectedStandards.length} total
                      </span>
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                      {selectedStandards.map(({standard, grade}) => {
                        return (
                          <div key={standard.standard_number} className="flex justify-between items-center p-3 rounded-lg text-sm border bg-slate-50 border-slate-200">
                            <div className="flex items-center space-x-2 flex-1 pr-2">
                              <span className="text-slate-700 font-medium truncate">{standard.title}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-slate-500">{standard.credits}c</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                grade === 'Excellence' ? 'bg-emerald-100 text-emerald-700' :
                                grade === 'Merit' ? 'bg-blue-100 text-blue-700' :
                                grade === 'Achieved' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {grade === 'Excellence' ? 'E' : grade === 'Merit' ? 'M' : grade === 'Achieved' ? 'A' : 'NA'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Calculate Button */}
                <button
                  onClick={calculateMultiYearAtar}
                  disabled={isLoading || selectedStandards.filter(s => s.grade !== 'Not Achieved').length === 0 || !isApiHealthy}
                  className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold py-4 px-6 rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all duration-300 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed flex items-center justify-center text-lg shadow-lg transform hover:scale-105 disabled:transform-none"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      Calculating with Live Data...
                    </>
                  ) : !isApiHealthy ? (
                    <>
                      <WifiOff className="w-5 h-5 mr-2" />
                      API Unavailable
                    </>
                  ) : "Calculate Official ATAR"}
                </button>
                
                {/* Multi-Year ATAR Results */}
                {atarResults.length > 0 && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white p-6 rounded-xl shadow-xl">
                      <div className="text-center">
                        <p className="text-teal-100 mb-2">Your Official ATAR Score Range</p>
                        <p className="text-4xl font-bold mb-2">
                          {Math.min(...atarResults.map(r => r.score)).toFixed(2)} - {Math.max(...atarResults.map(r => r.score)).toFixed(2)}
                        </p>
                        <p className="text-sm text-teal-100 opacity-90">
                          Based on {selectedStandards.length} standards • {totalCredits} total credits
                        </p>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                      <h4 className="font-serif font-semibold text-slate-800 mb-4 flex items-center">
                        <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                        Official Year-by-Year Results
                      </h4>
                      <div className="space-y-3">
                        {atarResults.map(result => (
                          <div key={result.year} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <div>
                              <span className="font-medium text-slate-800">{result.year}</span>
                              <p className="text-xs text-slate-500">{result.description}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-bold text-slate-800">{result.score.toFixed(2)}</span>
                              <p className="text-xs text-slate-500">Statistical: {result.statistical_value.toFixed(4)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                      <h4 className="font-serif font-semibold text-slate-800 mb-3 flex items-center">
                        <Info className="w-5 h-5 mr-2 text-blue-600" />
                        Official Calculation Details
                      </h4>
                      <div className="space-y-2 text-sm text-slate-600">
                        <p>• <strong>Official NZQA Data:</strong> Calculations use real standard weightings from the NZQA database</p>
                        <p>• <strong>Multi-year analysis:</strong> Shows how your ATAR varies across different cohort years</p>
                        <p>• <strong>Best 90 credits:</strong> System automatically selects your highest-performing standards</p>
                        <p>• <strong>Statistical values:</strong> Raw scores before ATAR distribution conversion</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 