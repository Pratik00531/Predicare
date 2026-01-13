// Firebase Configuration and Services
import React from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  updateDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { HealthMetrics } from './health-data-service';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn('Firebase configuration is incomplete. Some features may not work.');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export const googleProvider = new GoogleAuthProvider();

// User Profile Interface
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  height?: number; // in cm
  weight?: number; // in kg
  medicalHistory?: string[];
  allergies?: string[];
  medications?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  healthGoals?: {
    dailySteps: number;
    sleepHours: number;
    caloriesTarget: number;
    exerciseMinutes: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Medical Record Interface
export interface MedicalRecord {
  id?: string;
  userId: string;
  type: 'consultation' | 'image_analysis' | 'health_data' | 'appointment';
  title: string;
  description: string;
  data: any; // Flexible data structure for different record types
  imageUrls?: string[];
  tags?: string[];
  timestamp: Timestamp;
  isPrivate: boolean;
}

// Authentication Service
class AuthService {
  private currentUser: User | null = null;

  constructor() {
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
    });
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Sign up with email and password
  async signUp(email: string, password: string, displayName: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update user profile
      await updateProfile(user, { displayName });

      // Create user profile in Firestore
      await this.createUserProfile(user, { displayName });

      return user;
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  }

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  }

  // Sign in with Google
  async signInWithGoogle(): Promise<User> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user profile exists, create if not
      const profileExists = await this.checkUserProfileExists(user.uid);
      if (!profileExists) {
        await this.createUserProfile(user, {
          displayName: user.displayName || 'User'
        });
      }

      return user;
    } catch (error: any) {
      console.error('Google sign in error:', error);
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error('Failed to sign out');
    }
  }

  // Create user profile in Firestore
  private async createUserProfile(user: User, additionalData: any = {}): Promise<void> {
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: additionalData.displayName || user.displayName || 'User',
      photoURL: user.photoURL,
      healthGoals: {
        dailySteps: 10000,
        sleepHours: 8,
        caloriesTarget: 2000,
        exerciseMinutes: 30
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...additionalData
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);
  }

  // Check if user profile exists
  private async checkUserProfileExists(uid: string): Promise<boolean> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      return userDoc.exists();
    } catch (error) {
      console.error('Error checking user profile:', error);
      return false;
    }
  }

  // Get friendly error messages
  private getAuthErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/popup-closed-by-user':
        return 'Sign in was cancelled.';
      default:
        return 'An error occurred during authentication. Please try again.';
    }
  }
}

// Database Service
class DatabaseService {
  // Get user profile
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  // Update user profile
  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update profile');
    }
  }

  // Save health data
  async saveHealthData(uid: string, healthData: HealthMetrics): Promise<string> {
    try {
      const healthRecord: MedicalRecord = {
        userId: uid,
        type: 'health_data',
        title: `Health Data - ${healthData.date}`,
        description: `Steps: ${healthData.steps}, Sleep: ${healthData.sleepHours}h, Calories: ${healthData.caloriesBurned}`,
        data: healthData,
        timestamp: Timestamp.now(),
        isPrivate: true
      };

      const docRef = await addDoc(collection(db, 'medical_records'), healthRecord);
      return docRef.id;
    } catch (error) {
      console.error('Error saving health data:', error);
      throw new Error('Failed to save health data');
    }
  }

  // Save medical consultation
  async saveMedicalConsultation(uid: string, consultation: any): Promise<string> {
    try {
      const record: MedicalRecord = {
        userId: uid,
        type: 'consultation',
        title: 'AI Medical Consultation',
        description: consultation.query,
        data: consultation,
        timestamp: Timestamp.now(),
        isPrivate: true
      };

      const docRef = await addDoc(collection(db, 'medical_records'), record);
      return docRef.id;
    } catch (error) {
      console.error('Error saving consultation:', error);
      throw new Error('Failed to save consultation');
    }
  }

  // Save image analysis
  async saveImageAnalysis(uid: string, analysis: any, imageFile?: File): Promise<string> {
    try {
      let imageUrls: string[] = [];

      // Upload image if provided
      if (imageFile) {
        const imageUrl = await this.uploadImage(uid, imageFile);
        imageUrls.push(imageUrl);
      }

      const record: MedicalRecord = {
        userId: uid,
        type: 'image_analysis',
        title: 'Medical Image Analysis',
        description: analysis.query || 'Image analysis',
        data: analysis,
        imageUrls,
        timestamp: Timestamp.now(),
        isPrivate: true
      };

      const docRef = await addDoc(collection(db, 'medical_records'), record);
      return docRef.id;
    } catch (error) {
      console.error('Error saving image analysis:', error);
      throw new Error('Failed to save image analysis');
    }
  }

  // Upload image to Firebase Storage
  async uploadImage(uid: string, file: File): Promise<string> {
    try {
      const timestamp = Date.now();
      const fileName = `${uid}/images/${timestamp}_${file.name}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  }

  // Get user's medical records
  async getMedicalRecords(uid: string, limit: number = 50): Promise<MedicalRecord[]> {
    try {
      const q = query(
        collection(db, 'medical_records'),
        where('userId', '==', uid),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const records: MedicalRecord[] = [];

      querySnapshot.forEach((doc) => {
        records.push({
          id: doc.id,
          ...doc.data()
        } as MedicalRecord);
      });

      return records.slice(0, limit);
    } catch (error) {
      console.error('Error getting medical records:', error);
      return [];
    }
  }

  // Delete medical record
  async deleteMedicalRecord(recordId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'medical_records', recordId));
    } catch (error) {
      console.error('Error deleting medical record:', error);
      throw new Error('Failed to delete record');
    }
  }

  // Get health data history
  async getHealthDataHistory(uid: string, days: number = 30): Promise<HealthMetrics[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const q = query(
        collection(db, 'medical_records'),
        where('userId', '==', uid),
        where('type', '==', 'health_data'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const healthData: HealthMetrics[] = [];

      querySnapshot.forEach((doc) => {
        const record = doc.data() as MedicalRecord;
        if (record.data) {
          healthData.push(record.data as HealthMetrics);
        }
      });

      return healthData;
    } catch (error) {
      console.error('Error getting health data history:', error);
      return [];
    }
  }
}

// Export service instances
export const authService = new AuthService();
export const databaseService = new DatabaseService();

// Auth state hook for React components
export const useAuthState = () => {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading };
};
