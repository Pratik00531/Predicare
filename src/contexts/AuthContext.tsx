import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '@/lib/firebase-service';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  profileCompleted: boolean;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (displayName: string) => Promise<void>;
  updateProfile: (completed: boolean) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Get profile completion status from localStorage
        const profileCompleted = localStorage.getItem(`profile_${firebaseUser.uid}`) === 'true';
        
        setFirebaseUser(firebaseUser);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          profileCompleted,
        });
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(getAuthErrorMessage(error.code));
    }
  };

  const signup = async (email: string, password: string, displayName: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });
      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      console.error('Signup error:', error);
      throw new Error(getAuthErrorMessage(error.code));
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      // Clear profile completion status
      if (user?.uid) {
        localStorage.removeItem(`profile_${user.uid}`);
      }
      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new Error('Failed to sign out');
    }
  };

  const updateUserProfile = async (displayName: string) => {
    if (!firebaseUser) {
      throw new Error('No user logged in');
    }
    
    try {
      await updateProfile(firebaseUser, { displayName });
      // Update local user state
      if (user) {
        setUser({ ...user, displayName });
      }
    } catch (error: any) {
      console.error('Update profile error:', error);
      throw new Error('Failed to update profile');
    }
  };

  const updateProfileCompletion = (completed: boolean) => {
    if (user?.uid) {
      localStorage.setItem(`profile_${user.uid}`, completed.toString());
      setUser({ ...user, profileCompleted: completed });
    }
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    isLoggedIn: !!user,
    login,
    signup,
    logout,
    updateUserProfile,
    updateProfile: updateProfileCompletion,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper function to get user-friendly error messages
function getAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    case 'auth/user-not-found':
      return 'No account found with this email';
    case 'auth/wrong-password':
      return 'Incorrect password';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later';
    default:
      return 'Authentication error. Please try again';
  }
}
