import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Shield, Clock, MapPin, Lock } from "lucide-react";
import heroImage from "@/assets/hero-healthcare.jpg";

const features = [
  {
    icon: Shield,
    title: "Clinical Accuracy",
    description:
      "Our symptom assessment is built on evidence-based clinical guidelines and regularly validated by healthcare professionals.",
  },
  {
    icon: Clock,
    title: "24/7 Availability",
    description:
      "Access reliable health guidance whenever you need it, day or night, from any device.",
  },
  {
    icon: MapPin,
    title: "Care Navigation",
    description:
      "Find nearby healthcare providers, specialists, and emergency services based on your location and needs.",
  },
  {
    icon: Lock,
    title: "Privacy First",
    description:
      "Your health data is encrypted, protected, and never shared without your explicit consent.",
  },
];

const steps = [
  {
    number: "01",
    title: "Describe Your Symptoms",
    description:
      "Tell us what you're experiencing using our structured symptom assessment interface.",
  },
  {
    number: "02",
    title: "Receive Guidance",
    description:
      "Get evidence-based information about potential causes and recommended next steps.",
  },
  {
    number: "03",
    title: "Connect with Care",
    description:
      "Find appropriate healthcare providers or emergency services when needed.",
  },
];

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative">
          <div className="absolute inset-0">
            <img
              src={heroImage}
              alt="Healthcare professionals in clinical setting"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-foreground/70" />
          </div>

          <div className="relative clinical-container py-24 lg:py-32">
            <div className="max-w-2xl">
              <h1 className="text-4xl lg:text-5xl font-semibold text-primary-foreground leading-tight mb-6">
                Trusted Health Guidance When You Need It
              </h1>
              <p className="text-lg text-primary-foreground/80 mb-8 leading-relaxed">
                Predicare helps you understand your symptoms with clinical accuracy, 
                guiding you to the right level of care while protecting your privacy.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button variant="hero" size="xl" asChild>
                  <Link to="/signup">Get Started</Link>
                </Button>
                <Button
                  variant="hero-outline"
                  size="xl"
                  className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-foreground"
                  asChild
                >
                  <Link to="/#how-it-works">How It Works</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="clinical-section bg-background">
          <div className="clinical-container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-semibold text-foreground mb-4">
                Built for Clinical Trust
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Predicare combines advanced technology with rigorous clinical standards 
                to provide health guidance you can rely on.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="p-6 border border-border rounded-lg bg-card"
                  >
                    <div className="w-12 h-12 rounded-md bg-secondary flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="clinical-section bg-surface-elevated">
          <div className="clinical-container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-semibold text-foreground mb-4">
                How Predicare Works
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A straightforward process designed to get you the information and 
                care you need efficiently.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((step) => (
                <div key={step.number} className="relative">
                  <div className="text-5xl font-semibold text-border mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="about" className="clinical-section bg-primary">
          <div className="clinical-container text-center">
            <h2 className="text-3xl font-semibold text-primary-foreground mb-4">
              Start Your Health Assessment
            </h2>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
              Join thousands of users who trust Predicare for reliable health guidance. 
              Your privacy and wellbeing are our priority.
            </p>
            <Button
              variant="hero"
              size="xl"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              asChild
            >
              <Link to="/signup">Create Free Account</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
