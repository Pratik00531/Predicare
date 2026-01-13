import { Link } from "react-router-dom";

interface LogoProps {
  className?: string;
  showText?: boolean;
  to?: string;
}

export default function Logo({ className = "", showText = true, to = "/" }: LogoProps) {
  const logoContent = (
    <div className={`flex items-center gap-0 ${className}`}>
      {/* Logo Image - Replace with your actual logo */}
      <img 
        src="/logo-icon.png" 
        alt="PrediCare Logo" 
        className="h-20 w-20 md:h-24 md:w-24 object-contain drop-shadow-lg -mr-6"
        onError={(e) => {
          // Fallback to SVG if image not found
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextElementSibling?.classList.remove('hidden');
        }}
      />
      {/* Fallback SVG (hidden by default) */}
      <svg
        className="h-20 w-20 md:h-24 md:w-24 text-primary hidden drop-shadow-lg"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="32" height="32" rx="6" fill="currentColor" />
        <path
          d="M16 8v16M8 16h16"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {showText && (
        <span className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
          Predicare
        </span>
      )}
    </div>
  );

  if (to) {
    return <Link to={to}>{logoContent}</Link>;
  }

  return logoContent;
}
