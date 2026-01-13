import { useState } from "react";
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
import { MapPin, Phone, Navigation, Search, Building2, User, Stethoscope } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  specialty: string;
  address: string;
  distance: string;
  phone: string;
  type: "hospital" | "clinic" | "specialist";
  available: boolean;
}

const mockProviders: Provider[] = [
  {
    id: "1",
    name: "City General Hospital",
    specialty: "Emergency Medicine",
    address: "1234 Medical Center Dr, Suite 100",
    distance: "0.8 mi",
    phone: "(555) 123-4567",
    type: "hospital",
    available: true,
  },
  {
    id: "2",
    name: "Dr. Sarah Mitchell",
    specialty: "Internal Medicine",
    address: "456 Healthcare Ave, Suite 200",
    distance: "1.2 mi",
    phone: "(555) 234-5678",
    type: "specialist",
    available: true,
  },
  {
    id: "3",
    name: "Community Health Clinic",
    specialty: "Primary Care",
    address: "789 Wellness Blvd",
    distance: "1.5 mi",
    phone: "(555) 345-6789",
    type: "clinic",
    available: true,
  },
  {
    id: "4",
    name: "Dr. Michael Chen",
    specialty: "Cardiology",
    address: "321 Heart Center Way",
    distance: "2.1 mi",
    phone: "(555) 456-7890",
    type: "specialist",
    available: false,
  },
  {
    id: "5",
    name: "Regional Medical Center",
    specialty: "Multi-Specialty",
    address: "555 Hospital Road",
    distance: "3.4 mi",
    phone: "(555) 567-8901",
    type: "hospital",
    available: true,
  },
];

const specialties = [
  "All Specialties",
  "Primary Care",
  "Emergency Medicine",
  "Internal Medicine",
  "Cardiology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
];

const providerTypes = [
  { value: "all", label: "All Types" },
  { value: "hospital", label: "Hospitals" },
  { value: "clinic", label: "Clinics" },
  { value: "specialist", label: "Specialists" },
];

const providerIcons = {
  hospital: Building2,
  clinic: Stethoscope,
  specialist: User,
};

export default function Nearby() {
  const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "pending">("pending");
  const [pincode, setPincode] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All Specialties");
  const [selectedType, setSelectedType] = useState("all");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const requestLocation = () => {
    setIsLoading(true);
    // Simulate location request
    setTimeout(() => {
      setLocationPermission("granted");
      setProviders(mockProviders);
      setIsLoading(false);
    }, 1000);
  };

  const searchByPincode = () => {
    if (!pincode.trim()) return;
    setIsLoading(true);
    setTimeout(() => {
      setProviders(mockProviders);
      setIsLoading(false);
    }, 1000);
  };

  const filteredProviders = providers.filter((provider) => {
    const matchesSpecialty =
      selectedSpecialty === "All Specialties" ||
      provider.specialty === selectedSpecialty;
    const matchesType =
      selectedType === "all" || provider.type === selectedType;
    return matchesSpecialty && matchesType;
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface-elevated">
      {/* Page Header */}
      <div className="bg-background border-b border-border">
        <div className="clinical-container py-6">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Find Nearby Care
          </h1>
          <p className="text-muted-foreground">
            Locate hospitals, clinics, and specialists in your area for in-person care.
          </p>
        </div>
      </div>

      <div className="clinical-container py-6">
        {/* Location Permission / Search */}
        {locationPermission === "pending" && providers.length === 0 && (
          <div className="bg-background border border-border rounded-lg p-8 mb-6">
            <div className="max-w-md mx-auto text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <MapPin className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Enable Location Access
              </h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Allow Predicare to access your location to find healthcare providers near you, 
                or enter your ZIP code manually below.
              </p>

              <div className="space-y-4">
                <Button
                  variant="default"
                  size="lg"
                  className="w-full"
                  onClick={requestLocation}
                  disabled={isLoading}
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  {isLoading ? "Getting location..." : "Use My Location"}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background px-3 text-muted-foreground">or enter ZIP code</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Enter ZIP code"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={searchByPincode}
                    disabled={!pincode.trim() || isLoading}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Results */}
        {providers.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Filters Panel */}
            <div className="lg:col-span-1">
              <div className="bg-background border border-border rounded-lg p-5 sticky top-24">
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Filter Results
                </h3>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="specialty" className="text-sm">Specialty</Label>
                    <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                      <SelectTrigger id="specialty">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {specialties.map((specialty) => (
                          <SelectItem key={specialty} value={specialty}>
                            {specialty}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type" className="text-sm">Provider Type</Label>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providerTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Label className="text-sm mb-2 block">Update Location</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="ZIP code"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        className="flex-1"
                      />
                      <Button variant="outline" size="icon" onClick={searchByPincode}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Results List */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4 bg-background border border-border rounded-lg px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{filteredProviders.length}</span> providers found near you
                </p>
              </div>

              <div className="space-y-3">
                {filteredProviders.map((provider) => {
                  const ProviderIcon = providerIcons[provider.type];
                  return (
                    <div
                      key={provider.id}
                      className="bg-background border border-border rounded-lg p-5 hover:border-primary/30 transition-colors duration-150"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                            <ProviderIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-base font-semibold text-foreground truncate">
                                {provider.name}
                              </h3>
                              {provider.available ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium flex-shrink-0">
                                  Available
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium flex-shrink-0">
                                  Limited
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-primary font-medium mb-2">
                              {provider.specialty}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                {provider.distance}
                              </span>
                              <span className="truncate">{provider.address}</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-shrink-0"
                          asChild
                        >
                          <a href={`tel:${provider.phone}`}>
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </a>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredProviders.length === 0 && (
                <div className="bg-background border border-border rounded-lg p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No providers match your current filters. Try adjusting your search criteria.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
