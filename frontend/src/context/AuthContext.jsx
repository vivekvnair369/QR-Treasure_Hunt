import React, { createContext, useState, useEffect, useContext } from 'react';
import { 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext(null);

const mapAuthError = (err) => {
  const code = err.code || '';
  if (code.includes('invalid-credential') || code.includes('user-not-found') || code.includes('wrong-password')) {
    return 'Username/email or password is incorrect.';
  }
  if (code.includes('too-many-requests')) {
    return 'Too many failed login attempts. Access has been temporarily restricted. Please try again later.';
  }
  if (code.includes('invalid-email')) {
    return 'Invalid email address format.';
  }
  if (code.includes('network-request-failed')) {
    return 'Network error. Please check your internet connection.';
  }
  return err.message || 'Authentication failed. Please try again.';
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeTeamSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous team listener
      if (unsubscribeTeamSnapshot) {
        unsubscribeTeamSnapshot();
        unsubscribeTeamSnapshot = null;
      }

      if (firebaseUser) {
        let isAdmin = false;
        try {
          // Auto-create default admin account during development if email matches
          if (firebaseUser.email === 'admin@aitheron.com') {
            const adminDocRef = doc(db, 'admins', firebaseUser.uid);
            const adminDoc = await getDoc(adminDocRef);
            if (!adminDoc.exists()) {
              await setDoc(adminDocRef, {
                email: firebaseUser.email,
                role: 'admin',
                name: 'Default Admin'
              });
              console.log("Auto-created default admin document in Firestore.");
            }
          }

          // 1. Check if user is Admin
          const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
          if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            setUser({ 
              uid: firebaseUser.uid,
              username: adminData.email || 'Admin', 
              role: adminData.role || 'admin' 
            });
            setTeam(null);
            setIsAuthenticated(true);
            setLoading(false);
            isAdmin = true;
          }
        } catch (adminErr) {
          console.log("Not an admin or permission denied (checking team profile):", adminErr);
        }

        if (!isAdmin) {
          // 2. Check if user is Team
          // Subscribe to real-time updates for team profile
          unsubscribeTeamSnapshot = onSnapshot(doc(db, 'teams', firebaseUser.uid), (teamDoc) => {
            if (teamDoc.exists()) {
              const teamData = teamDoc.data();
              const fullTeam = { id: teamDoc.id, ...teamData };
              setTeam(fullTeam);
              setUser({ 
                uid: firebaseUser.uid,
                username: teamData.team_name, 
                role: 'team' 
              });
              setIsAuthenticated(true);
            } else {
              // Document deleted or invalid role
              signOut(auth);
            }
            setLoading(false);
          }, (err) => {
            console.error("Team listener error:", err);
            setUser(null);
            setTeam(null);
            setIsAuthenticated(false);
            setLoading(false);
          });
        }
      } else {
        setUser(null);
        setTeam(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeTeamSnapshot) unsubscribeTeamSnapshot();
    };
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const adminLogin = async (username, password) => {
    setLoading(true);
    try {
      const email = username.includes('@') ? username : `${username}@aitheron.com`;
      await signInWithEmailAndPassword(auth, email, password);
      // Do not set loading to false here; let onAuthStateChanged handle it on state resolution
      return { success: true };
    } catch (err) {
      setLoading(false);
      return { success: false, error: mapAuthError(err) };
    }
  };

  const teamLogin = async (teamCode) => {
    setLoading(true);
    try {
      const email = `${teamCode.trim().toLowerCase()}@aitheron.com`;
      const password = teamCode.trim().toUpperCase();
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (err) {
      setLoading(false);
      return { success: false, error: mapAuthError(err) };
    }
  };

  return (
    <AuthContext.Provider value={{ user, team, setTeam, isAuthenticated, loading, logout, adminLogin, teamLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
