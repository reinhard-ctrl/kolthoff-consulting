/**
 * Client-side auth helpers — admin passcode via Cloud Function, workspace login.
 */

export async function authenticateAdmin(code, onSuccess, onError) {
  try {
    if (!window.verifyAdminPasscode) {
      onError('Auth service unavailable. Deploy Cloud Functions first.');
      return false;
    }
    const result = await window.verifyAdminPasscode(code);
    if (result.valid) {
      onSuccess(result);
      return true;
    }
    onError('Invalid admin passcode.');
    return false;
  } catch (e) {
    console.error('Admin auth error:', e);
    onError(e.message || 'Authentication failed.');
    return false;
  }
}

export async function loginWorkspaceUser(email, password) {
  if (!window.signInWithEmailAndPassword) throw new Error('Firebase Auth not loaded');
  const cred = await window.signInWithEmailAndPassword(window.firebaseAuth, email, password);
  return cred.user;
}

export async function loginWithGoogle() {
  const provider = new window.GoogleAuthProvider();
  const cred = await window.signInWithPopup(window.firebaseAuth, provider);
  return cred.user;
}

export function matchCoreUser(users, email) {
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase().trim());
}
