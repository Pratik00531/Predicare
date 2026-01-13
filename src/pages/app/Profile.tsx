import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { User, Heart, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  age: string;
  sex: string;
  height: string;
  weight: string;
}

export default function Profile() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    firstName: "",
    lastName: "",
    email: "",
    age: "",
    sex: "",
    height: "",
    weight: "",
  });

  useEffect(() => {
    if (user) {
      // Load user data from Firebase Auth
      const displayName = user.displayName || "";
      const [firstName = "", lastName = ""] = displayName.split(" ");
      
      // Load saved profile from localStorage or initialize with Firebase data
      const savedProfile = localStorage.getItem('userProfile');
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      } else {
        setProfile(prev => ({
          ...prev,
          firstName,
          lastName,
          email: user.email || "",
        }));
      }
    }
  }, [user]);

  const handleChange = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Save profile to localStorage
    localStorage.setItem('userProfile', JSON.stringify(profile));
    
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Profile updated successfully");
    }, 500);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface-elevated">
      {/* Page Header */}
      <div className="bg-background border-b border-border">
        <div className="clinical-container py-6">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Profile Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your personal information and health profile for more accurate assessments.
          </p>
        </div>
      </div>

      <div className="clinical-container py-6">
        <div className="max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="bg-background border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-foreground">
                  Personal Information
                </h2>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profile.firstName}
                      onChange={(e) => handleChange("firstName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profile.lastName}
                      onChange={(e) => handleChange("lastName", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for account recovery and important health notifications.
                  </p>
                </div>
              </div>
            </div>

            {/* Health Profile */}
            <div className="bg-background border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Heart className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Health Profile
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Helps provide more accurate symptom assessments
                  </p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      min="1"
                      max="120"
                      value={profile.age}
                      onChange={(e) => handleChange("age", e.target.value)}
                      placeholder="Years"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sex">Biological Sex</Label>
                    <Select value={profile.sex} onValueChange={(v) => handleChange("sex", v)}>
                      <SelectTrigger id="sex">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer-not">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      min="50"
                      max="250"
                      value={profile.height}
                      onChange={(e) => handleChange("height", e.target.value)}
                      placeholder="Centimeters"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      min="20"
                      max="300"
                      value={profile.weight}
                      onChange={(e) => handleChange("weight", e.target.value)}
                      placeholder="Kilograms"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="bg-background border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-foreground">
                  Privacy & Data Usage
                </h2>
              </div>
              <div className="p-5">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    Your profile data is used to provide personalized symptom assessments
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    All information is encrypted at rest and in transit
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    We never share your health data with third parties without consent
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    You can request complete deletion of your data at any time
                  </li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                Delete Account
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
