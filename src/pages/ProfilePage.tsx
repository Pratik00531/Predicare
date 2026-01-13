import React, { useState, useEffect } from 'react';
import { User, Heart, Activity, Target, Calendar, Settings, Edit2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  // Basic Info
  firstName: string;
  lastName: string;
  email: string;
  age: number;
  gender: string;
  height: number; // cm
  weight: number; // kg
  
  // Health Goals
  healthGoals: string[];
  activityLevel: string;
  medicalConditions: string;
  medications: string;
  allergies: string;
  
  // Preferences
  preferredLanguage: string;
  notifications: boolean;
  dataSharing: boolean;
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Initialize profile with user's display name from Firebase
  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    email: user?.email || '',
    age: 25,
    gender: '',
    height: 170,
    weight: 70,
    healthGoals: [],
    activityLevel: 'moderate',
    medicalConditions: '',
    medications: '',
    allergies: '',
    preferredLanguage: 'english',
    notifications: true,
    dataSharing: false
  });

  // Check if this is a new user (first time setup)
  const [isNewUser, setIsNewUser] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true);

  // Calculate BMI
  const calculateBMI = () => {
    if (profile.height && profile.weight) {
      const heightInMeters = profile.height / 100;
      return (profile.weight / (heightInMeters * heightInMeters)).toFixed(1);
    }
    return '0';
  };

  // Get BMI category
  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { category: 'Underweight', color: 'text-blue-600' };
    if (bmi < 25) return { category: 'Normal', color: 'text-green-600' };
    if (bmi < 30) return { category: 'Overweight', color: 'text-yellow-600' };
    return { category: 'Obese', color: 'text-red-600' };
  };

  const bmi = parseFloat(calculateBMI());
  const bmiInfo = getBMICategory(bmi);

  // Health Score calculation (mock)
  const calculateHealthScore = () => {
    let score = 70; // Base score
    
    // BMI impact
    if (bmi >= 18.5 && bmi < 25) score += 15;
    else if (bmi >= 25 && bmi < 30) score += 5;
    else score -= 10;
    
    // Activity level impact
    if (profile.activityLevel === 'high') score += 10;
    else if (profile.activityLevel === 'moderate') score += 5;
    
    // Age impact
    if (profile.age >= 18 && profile.age <= 30) score += 5;
    else if (profile.age <= 50) score += 3;
    
    return Math.min(Math.max(score, 0), 100);
  };

  const healthScore = calculateHealthScore();

  const handleSave = async () => {
    setLoading(true);
    try {
      // Save profile data to localStorage (in production, would save to Firebase)
      localStorage.setItem('userProfile', JSON.stringify(profile));
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock save delay
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoalToggle = (goal: string) => {
    setProfile(prev => ({
      ...prev,
      healthGoals: prev.healthGoals.includes(goal)
        ? prev.healthGoals.filter(g => g !== goal)
        : [...prev.healthGoals, goal]
    }));
  };

  const availableGoals = [
    'Weight Loss', 'Muscle Gain', 'Improve Cardio', 'Better Sleep',
    'Stress Management', 'Healthy Diet', 'Quit Smoking', 'Reduce Sugar'
  ];

  const handleLogout = async () => {
    try {
      await authService.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  useEffect(() => {
    // Check authentication first
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }

    // Check if user has completed profile setup
    const checkUserProfile = async () => {
      // In production, this would check Firebase for existing profile data
      const hasCompletedProfile = localStorage.getItem('profileCompleted');
      setIsNewUser(!hasCompletedProfile);
      setShowWelcome(!hasCompletedProfile);
      
      // Load saved profile data if exists
      const savedProfile = localStorage.getItem('userProfile');
      if (savedProfile) {
        const parsedProfile = JSON.parse(savedProfile);
        setProfile({
          ...parsedProfile,
          email: user?.email || parsedProfile.email
        });
      } else if (user) {
        // Initialize with user data from Firebase Auth
        const displayName = user.displayName || '';
        const nameParts = displayName.split(' ');
        
        setProfile(prev => ({ 
          ...prev, 
          email: user.email || '',
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || ''
        }));
      }
    };
    
    checkUserProfile();
  }, [isLoggedIn, user, navigate]);

  const handleCompleteSetup = async () => {
    // Mark profile as completed
    localStorage.setItem('profileCompleted', 'true');
    updateProfile(true); // Update auth context
    setIsNewUser(false);
    setShowWelcome(false);
    await handleSave();
  };

  // Welcome Modal Component
  const WelcomeModal = () => {
    if (!showWelcome) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Welcome to Predicare!</CardTitle>
            <CardDescription className="text-base">
              Let's set up your health profile to provide personalized AI recommendations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">What we'll collect:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Basic information (age, gender, height, weight)</li>
                <li>• Health goals and activity level</li>
                <li>• Medical history (optional)</li>
                <li>• Preferences and settings</li>
              </ul>
            </div>
            <Alert>
              <AlertDescription>
                Your data is encrypted and never shared without your permission. 
                You can update or delete your information anytime.
              </AlertDescription>
            </Alert>
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setShowWelcome(false)}
                className="flex-1"
              >
                Skip for Now
              </Button>
              <Button 
                onClick={() => setShowWelcome(false)}
                className="flex-1"
              >
                Let's Start
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <WelcomeModal />
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  {profile.firstName ? `${profile.firstName}'s Health Profile` : 'Your Health Profile'}
                </h1>
                <p className="text-gray-600">Manage your health information and preferences</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={() => navigate('/')}>
                Dashboard
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Health Score Card */}
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-green-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Your Health Score</h2>
                  <div className="flex items-center space-x-4">
                    <div className="text-4xl font-bold">{healthScore}</div>
                    <div>
                      <Badge className="bg-white/20 text-white border-white/30">
                        {healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs Improvement'}
                      </Badge>
                      <p className="text-sm opacity-90 mt-1">Keep up the great work!</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Heart className="h-16 w-16 opacity-20" />
                </div>
              </div>
              
              {/* Custom Health Score Progress Bar */}
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm text-white/90">
                  <span>Health Score Progress</span>
                  <span className="font-semibold">{healthScore}%</span>
                </div>
                <div className="relative w-full bg-white/20 rounded-full h-4 overflow-hidden backdrop-blur-sm">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                    style={{ 
                      width: `${healthScore}%`,
                      background: `linear-gradient(90deg, 
                        ${healthScore >= 80 ? '#10b981' : healthScore >= 60 ? '#fbbf24' : '#ef4444'} 0%, 
                        ${healthScore >= 80 ? '#059669' : healthScore >= 60 ? '#f59e0b' : '#dc2626'} 100%)`,
                      boxShadow: `0 0 20px ${healthScore >= 80 ? 'rgba(16, 185, 129, 0.5)' : healthScore >= 60 ? 'rgba(251, 191, 36, 0.5)' : 'rgba(239, 68, 68, 0.5)'}, inset 0 1px 3px rgba(255, 255, 255, 0.3)`
                    }}
                  >
                    {/* Shine effect */}
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      style={{
                        animation: 'shine 2s ease-in-out infinite',
                        transform: 'skewX(-25deg)'
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{calculateBMI()}</div>
              <div className="text-sm text-gray-600">BMI</div>
              <div className={`text-xs font-medium ${bmiInfo.color}`}>{bmiInfo.category}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{profile.age}</div>
              <div className="text-sm text-gray-600">Age</div>
              <div className="text-xs text-gray-500">Years</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{profile.healthGoals.length}</div>
              <div className="text-sm text-gray-600">Goals</div>
              <div className="text-xs text-gray-500">Active</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {profile.activityLevel === 'high' ? 'High' : profile.activityLevel === 'moderate' ? 'Moderate' : 'Low'}
              </div>
              <div className="text-sm text-gray-600">Activity</div>
              <div className="text-xs text-gray-500">Level</div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Tabs */}
        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Information</TabsTrigger>
            <TabsTrigger value="health">Health Information</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          {/* Basic Information Tab */}
          <TabsContent value="basic">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Tell us about yourself to get personalized health insights
                  </CardDescription>
                </div>
                <Button
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  disabled={loading}
                >
                  {loading ? (
                    'Saving...'
                  ) : isEditing ? (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  ) : (
                    <>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profile.firstName}
                      onChange={(e) => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profile.lastName}
                      onChange={(e) => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      value={profile.age}
                      onChange={(e) => setProfile(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={profile.gender}
                      onValueChange={(value) => setProfile(prev => ({ ...prev, gender: value }))}
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      value={profile.height}
                      onChange={(e) => setProfile(prev => ({ ...prev, height: parseInt(e.target.value) || 0 }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      value={profile.weight}
                      onChange={(e) => setProfile(prev => ({ ...prev, weight: parseInt(e.target.value) || 0 }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="activityLevel">Activity Level</Label>
                    <Select
                      value={profile.activityLevel}
                      onValueChange={(value) => setProfile(prev => ({ ...prev, activityLevel: value }))}
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low - Sedentary lifestyle</SelectItem>
                        <SelectItem value="moderate">Moderate - Exercise 3-4 times/week</SelectItem>
                        <SelectItem value="high">High - Daily exercise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Health Information Tab */}
          <TabsContent value="health">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Health Goals</CardTitle>
                  <CardDescription>
                    Select your health and fitness goals to get personalized recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {availableGoals.map((goal) => (
                      <Button
                        key={goal}
                        variant={profile.healthGoals.includes(goal) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleGoalToggle(goal)}
                        className="h-auto py-3 px-4 text-center"
                      >
                        {goal}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Medical Information</CardTitle>
                  <CardDescription>
                    Help us provide better recommendations by sharing relevant medical information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="conditions">Medical Conditions</Label>
                    <Textarea
                      id="conditions"
                      placeholder="List any current medical conditions, chronic illnesses, or health concerns..."
                      value={profile.medicalConditions}
                      onChange={(e) => setProfile(prev => ({ ...prev, medicalConditions: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="medications">Current Medications</Label>
                    <Textarea
                      id="medications"
                      placeholder="List current medications, supplements, or vitamins you're taking..."
                      value={profile.medications}
                      onChange={(e) => setProfile(prev => ({ ...prev, medications: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="allergies">Allergies</Label>
                    <Textarea
                      id="allergies"
                      placeholder="List any known allergies or food intolerances..."
                      value={profile.allergies}
                      onChange={(e) => setProfile(prev => ({ ...prev, allergies: e.target.value }))}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle>App Preferences</CardTitle>
                <CardDescription>
                  Customize your app experience and privacy settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Preferred Language</Label>
                    <Select
                      value={profile.preferredLanguage}
                      onValueChange={(value) => setProfile(prev => ({ ...prev, preferredLanguage: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="spanish">Spanish</SelectItem>
                        <SelectItem value="french">French</SelectItem>
                        <SelectItem value="german">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Push Notifications</Label>
                      <p className="text-sm text-gray-600">Receive health reminders and updates</p>
                    </div>
                    <Button
                      variant={profile.notifications ? "default" : "outline"}
                      size="sm"
                      onClick={() => setProfile(prev => ({ ...prev, notifications: !prev.notifications }))}
                    >
                      {profile.notifications ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Data Sharing</Label>
                      <p className="text-sm text-gray-600">Share anonymous data to improve AI models</p>
                    </div>
                    <Button
                      variant={profile.dataSharing ? "default" : "outline"}
                      size="sm"
                      onClick={() => setProfile(prev => ({ ...prev, dataSharing: !prev.dataSharing }))}
                    >
                      {profile.dataSharing ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 mt-8">
          <Button onClick={() => navigate('/')} variant="outline" size="lg">
            Back to Dashboard
          </Button>
          {isNewUser ? (
            <Button onClick={handleCompleteSetup} size="lg" disabled={loading} className="bg-gradient-to-r from-blue-600 to-green-600">
              {loading ? 'Setting up...' : 'Complete Setup & Continue'}
            </Button>
          ) : (
            <Button onClick={handleSave} size="lg" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>

      {/* Show welcome modal if new user */}
      {isNewUser && <WelcomeModal />}
    </div>
  );
};

export default ProfilePage;
