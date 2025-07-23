"use client";

export default function CosmicLoader() {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      {/* Spinning galaxy */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent border-r-accent/50 animate-spin"></div>
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-purple-400 border-r-purple-400/50 animate-spin animate-reverse"></div>
        <div className="absolute inset-4 rounded-full border-2 border-transparent border-t-yellow-400 border-r-yellow-400/50 animate-spin"></div>
        
        {/* Central star */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
        </div>
      </div>
      
      {/* Loading text */}
      <div className="text-sm font-mono text-foreground/60 animate-pulse">
        Navigating the academic cosmos...
      </div>
      
      {/* Orbit dots */}
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-accent rounded-full animate-bounce"
            style={{
              animationDelay: `${i * 0.2}s`,
              animationDuration: "1s"
            }}
          ></div>
        ))}
      </div>
    </div>
  );
} 