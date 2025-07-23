"use client";

import { useState, useEffect } from "react";

interface YearWheelProps {
  years: number[];
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export default function YearWheel({ years, selectedYear, onYearChange }: YearWheelProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startMouseX, setStartMouseX] = useState(0);
  const [startDragOffset, setStartDragOffset] = useState(0);

  const spacing = 120; // Horizontal spacing between years
  const selectedIndex = years.indexOf(selectedYear);

  // Calculate the offset needed to center the selected year
  const centerOffset = -selectedIndex * spacing + dragOffset;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartMouseX(e.clientX);
    setStartDragOffset(dragOffset);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const mouseDelta = e.clientX - startMouseX;
    setDragOffset(startDragOffset + mouseDelta);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    // Calculate which year should be selected based on total offset
    const totalOffset = centerOffset;
    const nearestYearIndex = Math.round(-totalOffset / spacing);
    const clampedIndex = Math.max(0, Math.min(years.length - 1, nearestYearIndex));
    
    // Reset drag offset and update selected year
    setDragOffset(0);
    onYearChange(years[clampedIndex]);
  };

  const handleYearClick = (year: number) => {
    onYearChange(year);
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      <h2 className="text-2xl font-bold text-center">Select Calculation Year</h2>
      
      <div 
        className="relative w-96 h-32 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Horizontal wheel container */}
        <div 
          className="relative w-full h-full transition-transform duration-300 ease-out"
          style={{ 
            transform: `translateX(${centerOffset}px)`,
            transformOrigin: 'center'
          }}
        >
          {years.map((year, index) => {
            const offset = index * spacing; // Position each year based on its index
            
            const isSelected = year === selectedYear;
            const distanceFromSelected = Math.abs(index - selectedIndex);
            const opacity = 1 - Math.min(distanceFromSelected * 0.3, 0.8); // Fade based on distance from selected
            const scale = isSelected ? 1.3 : Math.max(1 - distanceFromSelected * 0.2, 0.6);
            
            return (
              <button
                key={year}
                onClick={() => handleYearClick(year)}
                className={`absolute w-16 h-16 rounded-full font-mono text-lg font-bold transition-all duration-300 flex items-center justify-center ${
                  isSelected 
                    ? "bg-accent text-background cosmic-glow" 
                    : "bg-card-bg border border-card-border text-foreground hover:border-accent/50"
                }`}
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%) translateX(${offset}px) scale(${scale})`,
                  opacity: opacity,
                  zIndex: isSelected ? 10 : Math.max(5 - distanceFromSelected, 1)
                }}
              >
                {year}
              </button>
            );
          })}
        </div>
        
        {/* Center indicator line */}
        <div className="absolute top-0 left-1/2 w-0.5 h-full bg-accent/30 transform -translate-x-1/2 z-20"></div>
        
        {/* Center selection indicator */}
        <div className="absolute top-2 left-1/2 w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-accent transform -translate-x-1/2 z-20"></div>
      </div>
      
      <div className="text-sm text-foreground/60 font-mono text-center">
        Drag horizontally to scroll • Click year to select
      </div>
    </div>
  );
} 