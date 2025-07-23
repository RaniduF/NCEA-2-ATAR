"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Search, Plus, Calculator, Star } from "lucide-react";
import CosmicLoader from "./CosmicLoader";
import YearWheel from "./YearWheel";

// Mock data - replace with actual API calls
interface Standard {
  id: string;
  name: string;
  credits: number;
  type: "Internal" | "External";
  subject: string;
  level: number;
  isUE: boolean;
}

interface Subject {
  id: string;
  name: string;
  standards: Standard[];
}

const mockSubjects: Subject[] = [
  {
    id: "physics",
    name: "Physics",
    standards: [
      { id: "p1", name: "Physics 3.1 - Mechanics", credits: 6, type: "External", subject: "Physics", level: 3, isUE: true },
      { id: "p2", name: "Physics 3.2 - Waves", credits: 4, type: "Internal", subject: "Physics", level: 3, isUE: true },
      { id: "p3", name: "Physics 3.3 - Electricity", credits: 6, type: "External", subject: "Physics", level: 3, isUE: true },
    ]
  },
  {
    id: "calculus",
    name: "Calculus",
    standards: [
      { id: "c1", name: "Calculus 3.1 - Differentiation", credits: 5, type: "External", subject: "Calculus", level: 3, isUE: true },
      { id: "c2", name: "Calculus 3.2 - Integration", credits: 6, type: "External", subject: "Calculus", level: 3, isUE: true },
      { id: "c3", name: "Calculus 3.3 - Complex Numbers", credits: 4, type: "Internal", subject: "Calculus", level: 3, isUE: true },
    ]
  },
];

const years = [2022, 2023, 2024, 2025];
const grades = ["E", "A", "M", "N"];

interface SelectedStandard {
  standard: Standard;
  grade: string;
}

export default function ATARCalculator() {
  const [selectedYear, setSelectedYear] = useState(2024);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedStandards, setSelectedStandards] = useState<SelectedStandard[]>([]);
  const [calculatedATAR, setCalculatedATAR] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const filteredSubjects = mockSubjects.filter(subject =>
    subject.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubjectSelect = (subject: Subject) => {
    setSelectedSubject(subject);
    setSearchQuery("");
  };

  const handleStandardToggle = (standard: Standard) => {
    const existing = selectedStandards.find(s => s.standard.id === standard.id);
    if (existing) {
      setSelectedStandards(selectedStandards.filter(s => s.standard.id !== standard.id));
    } else {
      setSelectedStandards([...selectedStandards, { standard, grade: "A" }]);
    }
  };

  const handleGradeChange = (standardId: string, grade: string) => {
    setSelectedStandards(selectedStandards.map(s => 
      s.standard.id === standardId ? { ...s, grade } : s
    ));
  };

  const calculateATAR = async () => {
    if (selectedStandards.length === 0) return;
    
    setIsCalculating(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock calculation
    const mockATAR = Math.random() * 100;
    setCalculatedATAR(mockATAR);
    setIsCalculating(false);
  };

  const totalCredits = selectedStandards.reduce((sum, s) => sum + s.standard.credits, 0);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-accent via-purple-400 to-yellow-400 bg-clip-text text-transparent mb-4">
            NCEA → ATAR Calculator
          </h1>
          <p className="text-xl text-foreground/80 font-mono">
            Chart your course through the academic cosmos
          </p>
          <div className="constellation-line mt-8 mb-8"></div>
        </div>

        {/* Year Wheel */}
        <div className="mb-12">
          <YearWheel 
            years={years}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Panel: Subject Selection */}
          <div className="space-y-6">
            <div className="bg-card-bg border border-card-border rounded-lg p-6 cosmic-glow">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-accent" />
                Select Subject
              </h3>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for a subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-input-bg border border-input-border focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all"
                />
                <Search className="absolute right-3 top-3.5 w-5 h-5 text-foreground/40" />
              </div>

              {searchQuery && (
                <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                  {filteredSubjects.map((subject) => (
                    <button
                      key={subject.id}
                      onClick={() => handleSubjectSelect(subject)}
                      className="w-full text-left px-4 py-3 rounded-lg bg-input-bg hover:bg-accent/10 border border-transparent hover:border-accent/30 transition-all"
                    >
                      <div className="font-medium">{subject.name}</div>
                      <div className="text-sm text-foreground/60 font-mono">
                        {subject.standards.length} standards available
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Standards Selection Panel */}
            {selectedSubject && (
              <div className="bg-card-bg border border-card-border rounded-lg p-6 cosmic-glow">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-accent" />
                  Standards for {selectedSubject.name}
                </h3>
                
                <div className="space-y-4">
                  {["Internal", "External"].map((type) => {
                    const typeStandards = selectedSubject.standards.filter(s => s.type === type);
                    if (typeStandards.length === 0) return null;
                    
                    return (
                      <div key={type}>
                        <h4 className="font-semibold text-accent mb-2">{type} Standards</h4>
                        <div className="space-y-2">
                          {typeStandards.map((standard) => {
                            const isSelected = selectedStandards.some(s => s.standard.id === standard.id);
                            return (
                              <label
                                key={standard.id}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                  isSelected 
                                    ? "bg-accent/10 border border-accent/30" 
                                    : "bg-input-bg border border-input-border hover:border-accent/30"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleStandardToggle(standard)}
                                  className="rounded bg-input-bg border-input-border text-accent focus:ring-accent"
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{standard.name}</div>
                                  <div className="text-sm text-foreground/60 font-mono">
                                    {standard.credits} credits {standard.isUE && "• UE approved"}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => setSelectedSubject(null)}
                  className="mt-4 w-full px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg transition-colors"
                >
                  Done with {selectedSubject.name}
                </button>
              </div>
            )}
          </div>

          {/* Right Panel: Selected Standards & Results */}
          <div className="space-y-6">
            {/* Selected Standards */}
            <div className="bg-card-bg border border-card-border rounded-lg p-6 cosmic-glow">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-accent" />
                Selected Standards ({totalCredits} credits)
              </h3>
              
              {selectedStandards.length === 0 ? (
                <p className="text-foreground/60 font-mono italic">
                  No standards selected yet. Start by searching for a subject.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedStandards.map(({ standard, grade }) => (
                    <div
                      key={standard.id}
                      className="flex items-center gap-3 p-3 bg-input-bg border border-input-border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{standard.name}</div>
                        <div className="text-sm text-foreground/60 font-mono">
                          {standard.subject} • {standard.credits} credits
                        </div>
                      </div>
                      <select
                        value={grade}
                        onChange={(e) => handleGradeChange(standard.id, e.target.value)}
                        className="px-3 py-2 bg-input-bg border border-input-border rounded focus:border-accent focus:ring-2 focus:ring-accent/30"
                      >
                        {grades.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleStandardToggle(standard)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Calculate Button */}
            {selectedStandards.length > 0 && (
              <button
                onClick={calculateATAR}
                disabled={isCalculating}
                className={`w-full px-6 py-4 rounded-lg font-bold text-lg transition-all ${
                  isCalculating
                    ? "bg-accent/50 cursor-not-allowed pulse-glow"
                    : "bg-accent hover:bg-accent-hover text-background cosmic-glow"
                }`}
              >
                {isCalculating ? (
                  <CosmicLoader />
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Calculate ATAR
                  </div>
                )}
              </button>
            )}

            {/* Results */}
            {calculatedATAR !== null && (
              <div className="bg-card-bg border border-card-border rounded-lg p-6 cosmic-glow twinkle">
                <h3 className="text-xl font-bold mb-4 text-accent">Estimated ATAR</h3>
                <div className="text-center">
                  <div className="text-5xl font-bold bg-gradient-to-r from-accent via-purple-400 to-yellow-400 bg-clip-text text-transparent font-mono">
                    {calculatedATAR.toFixed(2)}
                  </div>
                  <p className="text-foreground/60 mt-2 font-mono">
                    Based on {selectedYear} cohort data
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 