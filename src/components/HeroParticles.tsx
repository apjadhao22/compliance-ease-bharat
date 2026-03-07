import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export const HeroParticles = () => {
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        // Only run on client
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });

        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    if (windowSize.width === 0) return null;

    // Generate random particles
    const particles = Array.from({ length: 40 }).map((_, i) => {
        const size = Math.random() * 6 + 2; // Particle size between 2px and 8px
        const initialX = Math.random() * windowSize.width;
        const initialY = Math.random() * windowSize.height;

        return (
            <motion.div
                key={i}
                className="absolute rounded-full bg-primary/20 backdrop-blur-3xl"
                style={{
                    width: size,
                    height: size,
                    left: initialX,
                    top: initialY,
                    boxShadow: "0 0 10px 2px rgba(59, 130, 246, 0.3)", // Glow effect
                }}
                animate={{
                    x: [0, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, 0],
                    y: [0, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, 0],
                    opacity: [0.2, 0.8, 0.2],
                    scale: [1, 1.5, 1],
                }}
                transition={{
                    duration: Math.random() * 15 + 15, // Slow movement between 15-30s
                    repeat: Infinity,
                    ease: "linear",
                    times: [0, 0.33, 0.66, 1],
                }}
            />
        );
    });

    return (
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
            {/* Background base layer */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(207_68%_53%/0.1),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,hsl(207_68%_53%/0.15),transparent_70%)]" />

            {/* Moving Particles */}
            {particles}

            {/* Abstract connected lines/blobs to give "network" feel */}
            <motion.div
                className="absolute top-[20%] right-[10%] w-96 h-96 bg-primary/10 rounded-full blur-[100px]"
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.6, 0.3],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="absolute top-[40%] left-[5%] w-72 h-72 bg-accent/10 rounded-full blur-[80px]"
                animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.2, 0.5, 0.2],
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            />
        </div>
    );
};
