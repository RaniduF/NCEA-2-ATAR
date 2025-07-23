"use client";

import { useEffect, useRef } from "react";

export default function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Create static stars with different layers for parallax
    const stars: { x: number; y: number; baseX: number; baseY: number; size: number; baseOpacity: number; layer: number }[] = [];
    
    // Generate initial stars in 3 layers for parallax effect
    for (let i = 0; i < 150; i++) {
      const layer = Math.random() < 0.3 ? 1 : Math.random() < 0.6 ? 2 : 3; // 30% layer 1, 30% layer 2, 40% layer 3
      const baseX = Math.random() * canvas.width;
      const baseY = Math.random() * canvas.height;
      
      stars.push({
        x: baseX,
        y: baseY,
        baseX: baseX,
        baseY: baseY,
        size: layer === 1 ? Math.random() * 1 + 1.5 : layer === 2 ? Math.random() * 0.8 + 0.8 : Math.random() * 0.5 + 0.3,
        baseOpacity: layer === 1 ? Math.random() * 0.4 + 0.6 : layer === 2 ? Math.random() * 0.3 + 0.4 : Math.random() * 0.3 + 0.2,
        layer: layer
      });
    }

    let animationFrame: number;
    let mouseX = 0;
    let mouseY = 0;

    // Mouse tracking for parallax
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 50; // Reduced parallax intensity
      mouseY = (e.clientY / window.innerHeight - 0.5) * 50;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      // Clear canvas completely - no trails
      ctx.fillStyle = "rgba(16, 16, 20, 1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      stars.forEach((star) => {
        // Apply parallax effect based on layer (no drift movement)
        const parallaxMultiplier = star.layer === 1 ? 0.8 : star.layer === 2 ? 0.5 : 0.2;
        star.x = star.baseX + (mouseX * parallaxMultiplier);
        star.y = star.baseY + (mouseY * parallaxMultiplier);

        // Subtle twinkle effect
        const currentOpacity = star.baseOpacity + Math.sin(Date.now() * 0.0008 + star.baseX * 0.01) * 0.2;

        // Draw star (white only)
        ctx.save();
        ctx.globalAlpha = currentOpacity;
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowBlur = star.layer === 1 ? 6 : star.layer === 2 ? 3 : 1;
        ctx.shadowColor = "#FFFFFF";
        
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{
        background: "linear-gradient(135deg, #101014 0%, #0A0A0F 50%, #101014 100%)"
      }}
    />
  );
} 